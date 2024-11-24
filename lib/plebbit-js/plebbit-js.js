// import the file to replace node-fetch first so it gets used in kubo and plebbit-js
import './use-node-fetch.js'
import config from '../../config.js'
import {create as createKubo} from 'kubo-rpc-client'
import {Agent as HttpsAgent} from 'https'
import {Agent as HttpAgent} from 'http'
import Plebbit from '@plebbit/plebbit-js'

const plebbitIpfsApi = await Plebbit({
  ...config.plebbitOptions,
  ipfsHttpClientsOptions: [config.ipfsApiUrl],
  pubsubHttpClientsOptions: [config.ipfsApiUrl]
})
plebbitIpfsApi.on('error', error => {
  // console.log(error) // logging plebbit errors are only useful for debugging, not production
})

const plebbit = await Plebbit(config.plebbitOptions)
plebbit.on('error', error => {
  // console.log(error) // logging plebbit errors are only useful for debugging, not production
})

const Agent = config.ipfsApiUrl?.startsWith('https') ? HttpsAgent : HttpAgent
const kubo = await createKubo({
  url: config.ipfsApiUrl, 
  agent: new Agent({keepAlive: true, maxSockets: Infinity})
})

const kuboPubsubProviders = {}
for (const pubsubProviderUrl of config.monitoring.pubsubProviderUrls || []) {
  const Agent = pubsubProviderUrl.startsWith('https') ? HttpsAgent : HttpAgent
  kuboPubsubProviders[pubsubProviderUrl] = await createKubo({
    url: pubsubProviderUrl, 
    agent: new Agent({keepAlive: true, maxSockets: Infinity})
  })
}

export {kubo, plebbitIpfsApi, plebbit, kuboPubsubProviders}
