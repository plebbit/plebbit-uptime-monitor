import util from 'util'
// util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import dotenv from 'dotenv'
dotenv.config()
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv
import fs from 'fs-extra'
import fetch from 'node-fetch'

import {fetchMultisubUrl} from './lib/utils.js'
import config from './config.js'
import monitorState from './lib/monitor-state.js'
import {monitorSubplebbitsIpns} from './lib/subplebbit-ipns.js'
import {monitorSubplebbitsPubsub} from './lib/subplebbit-pubsub.js'
import {monitorIpfsGateways} from './lib/ipfs-gateway.js'

if (!config?.monitoring?.multisubs) {
  console.log(`missing config.js 'monitoring.multisubs'`)
  process.exit()
}

const apiPort = 3000
const multisubsIntervalMs = 1000 * 60 * 60
const subplebbitsIpnsIntervalMs = 1000 * 60 * 10
const subplebbitsPubsubIntervalMs = 1000 * 60 * 10
const ipfsGatewaysIntervalMs = 1000 * 60 * 10

// fetch subplebbits to monitor every hour
const multisubs = []
const getSubplebbitsMonitoring = async () => {
  const promises = await Promise.allSettled(config.monitoring.multisubs.map(multisubUrl => fetchMultisubUrl(multisubUrl)))
  for (const [i, {status, value: multisub, reason}] of promises.entries()) {
    if (status === 'fulfilled') {
      multisubs[i] = multisub
    }
    else {
      console.log(`failed getting subplebbits to monitor (${i + 1} of ${promises.length}): ${reason}`)
    }
  }

  const subplebbitsMap = new Map()
  for (const multisub of multisubs) {
    if (!multisub) {
      continue
    }
    for (const subplebbit of multisub.subplebbits) {
      if (!subplebbitsMap.has(subplebbit.address)) {
        subplebbitsMap.set(subplebbit.address, subplebbit)
      }
    }
  }

  // set initial state
  if (subplebbitsMap.size > 0) {
    monitorState.subplebbitsMonitoring = [...subplebbitsMap.values()]
    for (const subplebbit of monitorState.subplebbitsMonitoring) {
      monitorState.subplebbits[subplebbit.address] = {
        ...monitorState.subplebbits[subplebbit.address],
        address: subplebbit.address,
      }
    }
  }
}
setInterval(() => getSubplebbitsMonitoring().catch(e => console.log(e.message)), multisubsIntervalMs)

// fetch subs to monitor at least once before starting
while (!monitorState.subplebbitsMonitoring) {
  await getSubplebbitsMonitoring()
  if (!monitorState.subplebbitsMonitoring) {
    console.log('retrying getting subplebbits to monitor in 10 seconds')
    await new Promise(r => setTimeout(r, 10000))
  }
}

// fetch subplebbits ipns every 10min
monitorSubplebbitsIpns().catch(e => console.log(e.message))
setInterval(() => monitorSubplebbitsIpns().catch(e => console.log(e.message)), subplebbitsIpnsIntervalMs)

// rejoin pubsub every 10min
// setTimeout(() => monitorSubplebbitsPubsub().catch(e => console.log(e.message)), 1000 * 60) // wait for some pubsub topics to be fetched
// setInterval(() => monitorSubplebbitsPubsub().catch(e => console.log(e.message)), subplebbitsPubsubIntervalMs)

// fetch gateways every 10min
monitorIpfsGateways().catch(e => console.log(e.message))
setInterval(() => monitorIpfsGateways().catch(e => console.log(e.message)), ipfsGatewaysIntervalMs)

// start stats endpoint
import express from 'express'
const app = express()
app.listen(apiPort)
app.get('/', (req, res) => {
  const plebbit = {subplebbitsStats: {}, subplebbitCount: 0}
  const subplebbits = {}
  for (const subplebbitAddress in monitorState.subplebbits) {
    subplebbits[subplebbitAddress] = {
      address: subplebbitAddress,
      lastSubplebbitUpdateTimestamp: monitorState.subplebbits[subplebbitAddress].lastSubplebbitUpdateTimestamp,
      lastSubplebbitPubsubMessageTimetamp: monitorState.subplebbits[subplebbitAddress].lastSubplebbitPubsubMessageTimetamp,
      pubsubDhtPeers: monitorState.subplebbits[subplebbitAddress].pubsubDhtPeers?.length,
      pubsubPeers: monitorState.subplebbits[subplebbitAddress].pubsubPeers?.length,
      subplebbitStats: monitorState.subplebbits[subplebbitAddress].subplebbitStats
    }

    // add subplebbits stats to plebbit
    plebbit.subplebbitCount++
    for (const statsName in monitorState.subplebbits[subplebbitAddress].subplebbitStats) {
      if (!plebbit.subplebbitsStats[statsName]) {
        plebbit.subplebbitsStats[statsName] = 0
      }
      plebbit.subplebbitsStats[statsName] += monitorState.subplebbits[subplebbitAddress].subplebbitStats[statsName]
    }
  }
  const ipfsGateways = {}
  for (const ipfsGatewayUrl in monitorState.ipfsGateways) {
    ipfsGateways[ipfsGatewayUrl] = {
      url: ipfsGatewayUrl,
      ...monitorState.ipfsGateways[ipfsGatewayUrl]?.[monitorState.ipfsGateways[ipfsGatewayUrl].length - 1]
    }
  }

  const jsonResponse = JSON.stringify({subplebbits, ipfsGateways, plebbit}, null, 2)
  res.setHeader('Content-Type', 'application/json')
  // cache expires after 1 minutes (60 seconds), must revalidate if expired
  res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate')
  res.send(jsonResponse)
})

// update history every 5 min
const maxTimestamps = 500
let historyFiles = []
let historyRecentCache = {}
const updateHistory = async () => {
  await fs.ensureDir('history')
  historyFiles = await fs.readdir('history')

  // add recent cache for faster loading
  const _historyRecentCache = {}
  let cacheCount = 0
  while (cacheCount++ < maxTimestamps) {
    const historyFilesIndex = historyFiles.length - cacheCount
    if (historyFilesIndex < 0) {
      break
    }
    const historyFile = historyFiles[historyFilesIndex]
    _historyRecentCache[historyFile] = JSON.parse(await fs.readFile(`history/${historyFile}`, 'utf8'))  
  }
  historyRecentCache = _historyRecentCache
}
updateHistory().catch(e => console.log(e.message))
setInterval(() => updateHistory().catch(e => console.log(e.message)), 1000 * 60 * 5)

// history endpoint
app.get('/history', async (req, res) => {
  console.log(req.method, req.url, req.query)
  const isPastAndImmutable = req.query.to ? Date.now() > new Date(req.query.to).getTime() : false
  if (isPastAndImmutable) {
    // if query has a 'to' timestamp, it is in the past, it can never update and is immutable
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  else {
    // cache expires after 10 minutes (600 seconds), must revalidate if expired
    res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate')
  }

  try {
    const from = req.query.from ? new Date(req.query.from).getTime() : 0 // in ms or date string
    const to = req.query.to ? new Date(req.query.to).getTime() : Infinity // in ms or date string
    const ipfsGatewayUrl = req.query.ipfsGatewayUrl
    const subplebbitAddress = req.query.subplebbitAddress
    const include = req.query.include?.split(',')
    const interval = req.query.interval // in seconds

    // filter by timestamp
    const historyFilesToRead = []
    let previousTimestamp
    for (const historyFile of historyFiles) {
      const timestamp = new Date(historyFile).getTime()
      if (timestamp >= from && timestamp <= to) {
        // interval size
        if (previousTimestamp && interval) {
          const previousTimestampInterval = timestamp - previousTimestamp
          if (previousTimestampInterval < interval) {
            continue
          }
        }
        previousTimestamp = timestamp
        historyFilesToRead.push(historyFile)
        if (historyFilesToRead.length > maxTimestamps) {
          throw Error(`too many results (more than ${maxTimestamps}), add to=timestamp-ms, from=timestamp-ms and/or interval=ms to your query`)
        }
      }
    }

    // filter by url query params
    const promises = []
    for (const historyFile of historyFilesToRead) {
      const getTimestampAndStats = async () => {
        const stats = historyRecentCache[historyFile] || JSON.parse(await fs.readFile(`history/${historyFile}`, 'utf8'))

        // filters
        let filteredStats
        if (ipfsGatewayUrl) {
          filteredStats = {...filteredStats, ipfsGateways: {[ipfsGatewayUrl]: stats.ipfsGateways[ipfsGatewayUrl]}}
        }
        if (subplebbitAddress) {
          filteredStats = {...filteredStats, subplebbits: {[subplebbitAddress]: stats.subplebbits[subplebbitAddress]}}
        }
        if (!filteredStats) {
          filteredStats = stats
        }

        // include
        if (include?.length) {
          for (const propName in filteredStats) {
            if (!include.includes(propName)) {
              delete filteredStats[propName]
            }
          }
        }

        const timestamp = new Date(historyFile).getTime()
        return [timestamp, filteredStats]
      }
      promises.push(getTimestampAndStats())
    }
    const filteredHistory = await Promise.all(promises)

    const jsonResponse = JSON.stringify(filteredHistory)
    res.setHeader('Content-Type', 'application/json')
    res.send(jsonResponse)
  }
  catch (e) {
    console.log(e)
    res.status(404)
    res.send(e.message)
  }
})

// prometheus endpoint
import {promClient} from './lib/prometheus.js'
app.get('/metrics/prometheus', async (req, res) => {
  try {
    const metricsResponse = await promClient.register.metrics()
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8'
    })
    res.write(metricsResponse)    
  }
  catch (e) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8'
    })
    res.write(e.message)   
  }
  res.end()
})

// save history every 1min
setInterval(async () => {
  const history = await fetch(`http://127.0.0.1:${apiPort}`).then(res => res.json())
  await fs.ensureDir('history')
  await fs.writeFile(`history/${new Date().toISOString()}`, JSON.stringify(history))
}, 1000 * 60)

// debug
// console.log('monitoring', monitorState.subplebbitsMonitoring)
// setInterval(() => console.log(monitorState.subplebbits), 10000)
