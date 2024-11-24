import path from 'path'
import {fileURLToPath} from 'url'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs-extra'
import ps from 'node:process'
import ProgressBar from 'progress'
import https from 'https'
import decompress from 'decompress'
import http from 'http'
import httpProxy from 'http-proxy'
import tcpPortUsed from 'tcp-port-used'

const basicAuthUsername = process.env.IPFS_BASIC_AUTH_USERNAME
const basicAuthPassword = process.env.IPFS_BASIC_AUTH_PASSWORD
const ipfsGatewayPort = 8080
const ipfsApiPort = 5001
const ipfsClientVersion = '0.32.1'
let ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_linux-amd64.tar.gz`
if (process.platform === 'win32') {
  ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_windows-amd64.zip`
}
if (process.platform === 'darwin') {
  ipfsClientUrl = `https://dist.ipfs.io/kubo/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_darwin-amd64.tar.gz`
}

const downloadWithProgress = (url) =>
  new Promise((resolve) => {
    const split = url.split('/')
    const fileName = split[split.length - 1]
    const chunks = []
    const req = https.request(url)
    req.on('response', (res) => {
      // handle redirects
      if (res.statusCode == 301 || res.statusCode === 302) {
        resolve(downloadWithProgress(res.headers.location))
        return
      }

      const len = parseInt(res.headers['content-length'], 10)
      console.log()
      const bar = new ProgressBar(`  ${fileName} [:bar] :rate/bps :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len,
      })
      res.on('data', (chunk) => {
        chunks.push(chunk)
        bar.tick(chunk.length)
      })
      res.on('end', () => {
        console.log('\n')
        resolve(Buffer.concat(chunks))
      })
    })
    req.end()
  })

// official kubo downloads need to be extracted
const downloadAndExtract = async (url, destinationPath) => {
  const binName = 'ipfs'
  const binPath = path.join(destinationPath, binName)
  if (fs.pathExistsSync(binPath)) {
    return
  }
  const split = url.split('/')
  const fileName = split[split.length - 1]
  const dowloadPath = path.join(destinationPath, fileName)
  const file = await downloadWithProgress(url)
  fs.ensureDirSync(destinationPath)
  await fs.writeFile(dowloadPath, file)
  await decompress(dowloadPath, destinationPath)
  const extractedPath = path.join(destinationPath, 'kubo')
  const extractedBinPath = path.join(extractedPath, binName)
  fs.moveSync(extractedBinPath, binPath)
  fs.removeSync(extractedPath)
  fs.removeSync(dowloadPath)
}

// use this custom function instead of spawnSync for better logging
// also spawnSync might have been causing crash on start on windows
const spawnAsync = (...args) =>
  new Promise((resolve, reject) => {
    const spawedProcess = spawn(...args)
    spawedProcess.on('exit', (exitCode, signal) => {
      if (exitCode === 0) resolve()
      else reject(Error(`spawnAsync process '${spawedProcess.pid}' exited with code '${exitCode}' signal '${signal}'`))
    })
    spawedProcess.stderr.on('data', (data) => console.error(data.toString()))
    spawedProcess.stdin.on('data', (data) => console.log(data.toString()))
    spawedProcess.stdout.on('data', (data) => console.log(data.toString()))
    spawedProcess.on('error', (data) => console.error(data.toString()))
  })

const startIpfs = async () => {
  const ipfsFileName = 'ipfs'
  const rootPath = path.dirname(fileURLToPath(import.meta.url))
  const ipfsFolderPath = path.resolve(rootPath, 'bin')
  const ipfsPath = path.resolve(ipfsFolderPath, ipfsFileName)
  const ipfsDataPath = path.resolve(rootPath, '.ipfs')

  // download or upgrade
  if (!fs.pathExistsSync(ipfsPath)) {
    await downloadAndExtract(ipfsClientUrl, ipfsFolderPath)
  }
  const versionMessage = spawnSync(ipfsPath, ['version']).stdout.toString().trim()
  if (!versionMessage.includes(ipfsClientVersion)) {
    console.log(`${versionMessage}, downloading version ${ipfsClientVersion}`)
    fs.removeSync(ipfsPath)
    fs.removeSync(ipfsDataPath)
    await downloadAndExtract(ipfsClientUrl, ipfsFolderPath)
  }

  console.log({ipfsPath, ipfsDataPath})

  fs.ensureDirSync(ipfsDataPath)
  const env = {IPFS_PATH: ipfsDataPath}
  // init ipfs client on first launch
  try {
    await spawnAsync(ipfsPath, ['init'], {env, hideWindows: true})
  } catch (e) {}

  // make sure repo is migrated
  try {
    await spawnAsync(ipfsPath, ['repo', 'migrate'], {env, hideWindows: true})
  } catch (e) {}

  // dont use 8080 port because it's too common
  await spawnAsync(ipfsPath, ['config', '--json', 'Addresses.Gateway', '"/ip4/127.0.0.1/tcp/6473"'], {
    env,
    hideWindows: true,
  })

  // use different port with proxy for debugging during env
  let apiAddress = '/ip4/127.0.0.1/tcp/5001'
  await spawnAsync(ipfsPath, ['config', 'Addresses.API', apiAddress], {env, hideWindows: true})

  await new Promise((resolve, reject) => {
    const ipfsProcess = spawn(ipfsPath, ['daemon', '--migrate', '--enable-pubsub-experiment', '--enable-namesys-pubsub'], {env, hideWindows: true})
    console.log(`ipfs daemon process started with pid ${ipfsProcess.pid}`)
    let lastError
    ipfsProcess.stderr.on('data', (data) => {
      lastError = data.toString()
      console.error(data.toString())
    })
    ipfsProcess.stdin.on('data', (data) => console.log(data.toString()))
    ipfsProcess.stdout.on('data', (data) => console.log(data.toString()))
    ipfsProcess.on('error', (data) => console.error(data.toString()))
    ipfsProcess.on('exit', () => {
      console.error(`ipfs process with pid ${ipfsProcess.pid} exited`)
      reject(Error(lastError))
    })
    process.on('exit', () => {
      try {
        ps.kill(ipfsProcess.pid)
      } catch (e) {
        console.log(e)
      }
      try {
        // sometimes ipfs doesnt exit unless we kill pid +1
        ps.kill(ipfsProcess.pid + 1)
      } catch (e) {
        console.log(e)
      }
    })
  })
}

let pendingStart = false
const start = async () => {
  if (pendingStart) {
    return
  }
  pendingStart = true
  try {
    const started = await tcpPortUsed.check(5001, '127.0.0.1')
    if (started) {
      return
    }
    await startIpfs()
  } catch (e) {
    console.log('failed starting ipfs', e)
  }
  pendingStart = false
}

// retry starting ipfs every 1 second,
// in case it was started by another client that shut down and shut down ipfs with it
start()
setInterval(() => {
  start()
}, 1000)

// start proxy
const proxy = httpProxy.createProxyServer({})

// rewrite the request
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  // remove headers that could potentially cause an ipfs 403 error
  proxyReq.removeHeader('CF-IPCountry')
  proxyReq.removeHeader('X-Forwarded-For')
  proxyReq.removeHeader('CF-RAY')
  proxyReq.removeHeader('X-Forwarded-Proto')
  proxyReq.removeHeader('CF-Visitor')
  proxyReq.removeHeader('sec-ch-ua')
  proxyReq.removeHeader('sec-ch-ua-mobile')
  proxyReq.removeHeader('user-agent')
  proxyReq.removeHeader('origin')
  proxyReq.removeHeader('sec-fetch-site')
  proxyReq.removeHeader('sec-fetch-mode')
  proxyReq.removeHeader('sec-fetch-dest')
  proxyReq.removeHeader('referer')
  proxyReq.removeHeader('CF-Connecting-IP')
  proxyReq.removeHeader('CDN-Loop')
})

proxy.on('error', (e, req, res) => {
  console.error(e)
  // if not ended, will hang forever
  res.end()
})

// start server
const startServer = (port) => {
  const server = http.createServer()

  // never timeout the keep alive connection
  server.keepAliveTimeout = 0

  server.on('request', async (req, res) => {
    // unrelated endpoints
    if (req.url === '/service-worker.js' || req.url === '/manifest.json' || req.url === '/favicon.ico') {
      res.end()
      return
    }

    // start of pubsub related endpoints
    console.log(req.method, req.url, req.rawHeaders)

    // basic auth allows any api
    let reqHasBasicAuth = false
    const reqBasicAuthHeader = (req.headers.authorization || '').split(' ')[1] || ''
    const [reqBasicAuthUsername, reqBasicAuthPassword] = Buffer.from(reqBasicAuthHeader, 'base64').toString().split(':')
    if (basicAuthUsername && basicAuthPassword && basicAuthUsername === reqBasicAuthUsername && basicAuthPassword === reqBasicAuthPassword) {
      reqHasBasicAuth = true
    }

    // debug api for prometheus metrics https://github.com/ipfs/kubo/blob/master/docs/config.md#internalbitswap 
    // e.g. http://127.0.0.1:5001/debug/metrics/prometheus
    if (req.url.startsWith('/debug/')) {
      // handle basic auth properly to be compatible with prometheus scrape services
      if ((basicAuthUsername || basicAuthPassword) && !reqHasBasicAuth) {
        res.setHeader('WWW-Authenticate', 'Basic')
        res.statusCode = 401
        res.end()
        return
      }
    }

    // fix error 'has been blocked by CORS policy'
    res.setHeader('Access-Control-Allow-Origin', '*')

    proxy.web(req, res, {target: `http://127.0.0.1:${ipfsApiPort}`})
  })
  server.on('error', console.error)
  server.listen(port)
  console.log(`proxy server listening on port ${port}`)
}
startServer(11111)
