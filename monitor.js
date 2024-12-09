import util from 'util'
util.inspect.defaultOptions.depth = process.env.DEBUG_DEPTH
import dotenv from 'dotenv'
dotenv.config()
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv
console.log({argv})
import fs from 'fs-extra'
import fetch from 'node-fetch'
import Debug from 'debug'
Debug.enable('plebbit-uptime-monitor:*')

import {fetchMultisubUrl} from './lib/utils.js'
import config from './config.js'
import monitorState from './lib/monitor-state.js'
import {monitorSubplebbitsIpns} from './lib/subplebbit-ipns.js'
import {monitorSubplebbitsPubsub} from './lib/subplebbit-pubsub.js'
import {monitorIpfsGateways} from './lib/ipfs-gateway.js'
import {monitorPubsubProviders} from './lib/pubsub-provider.js'
import {monitorHttpRouters} from './lib/http-router.js'
import {monitorPlebbitPreviewers} from './lib/plebbit-previewer.js'
import {monitorChainProviders} from './lib/chain-provider.js'
import {monitorWebpages} from './lib/webpage.js'
import {monitorNfts} from './lib/nft.js'

// start server on port 3000
import './lib/server.js'

if (!config?.monitoring?.multisubs) {
  console.log(`missing config.js 'monitoring.multisubs'`)
  process.exit()
}

const multisubsIntervalMs = 1000 * 60 * 60
const subplebbitsIpnsIntervalMs = 1000 * 60 * 10
const subplebbitsPubsubIntervalMs = 1000 * 60 * 10
const ipfsGatewaysIntervalMs = 1000 * 60 * 10
const pubsubProvidersIntervalMs = 1000 * 60 * 10
const httpRoutersIntervalMs = 1000 * 60 * 10
const plebbitPreviewersIntervalMs = 1000 * 60 * 10
const chainProvidersIntervalMs = 1000 * 60
const webpagesIntervalMs = 1000 * 60 * 10
const nftsIntervalMs = 1000 * 60 * 10

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

const isMonitoring = (name) => argv.only === name || (argv.only?.length || 0) < 1 || argv.only.includes(name)
const isMonitoringOnly = (name) => argv.only === name || (argv.only?.length === 1 && argv.only[0] === name)

// fetch subplebbits ipns every 10min
if (isMonitoring('subplebbitsIpns')) {
  monitorSubplebbitsIpns().catch(e => console.log(e.message))
  setInterval(() => monitorSubplebbitsIpns().catch(e => console.log(e.message)), subplebbitsIpnsIntervalMs)
}

// rejoin pubsub every 10min
if (isMonitoring('subplebbitsPubsub')) {
  setTimeout(() => {
    monitorSubplebbitsPubsub().catch(e => console.log(e.message))
    setInterval(() => monitorSubplebbitsPubsub().catch(e => console.log(e.message)), subplebbitsPubsubIntervalMs)
  }, isMonitoringOnly('subplebbitsPubsub') ? 1 : 1000 * 180) // wait for some pubsub topics to be fetched
}

// fetch ipfs gateways every 10min
if (isMonitoring('ipfsGateways')) {
  setTimeout(() => {
    monitorIpfsGateways().catch(e => console.log(e.message))
    setInterval(() => monitorIpfsGateways().catch(e => console.log(e.message)), ipfsGatewaysIntervalMs)
  }, isMonitoringOnly('ipfsGateways') ? 1 : 1000 * 60) // wait to not ddos ipfs gateways from monitorSubplebbitsIpns
}

// publish to pubsub providers every 10min
if (isMonitoring('pubsubProviders')) {
  monitorPubsubProviders().catch(e => console.log(e.message))
  setInterval(() => monitorPubsubProviders().catch(e => console.log(e.message)), pubsubProvidersIntervalMs)
}

// fetch http routers every 10min
if (isMonitoring('httpRouters')) {
  setTimeout(() => {
    monitorHttpRouters().catch(e => console.log(e.message))
    setInterval(() => monitorHttpRouters().catch(e => console.log(e.message)), httpRoutersIntervalMs)
  }, isMonitoringOnly('httpRouters') ? 1 : 1000 * 120) // wait to not ddos http routers from monitorSubplebbitsIpns
}

// fetch plebbit previewers every 10min
if (isMonitoring('plebbitPreviewers')) {
  setTimeout(() => {
    monitorPlebbitPreviewers().catch(e => console.log(e.message))
    setInterval(() => monitorPlebbitPreviewers().catch(e => console.log(e.message)), plebbitPreviewersIntervalMs)
  }, isMonitoringOnly('plebbitPreviewers') ? 1 : 1000 * 60) // wait for some subplebbit.lastPostCid to be fetched
}

// fetch chain providers every 1min
if (isMonitoring('chainProviders')) {
  monitorChainProviders().catch(e => console.log(e.message))
  setInterval(() => monitorChainProviders().catch(e => console.log(e.message)), chainProvidersIntervalMs)
}

// fetch webpages every 10min
if (isMonitoring('webpages')) {
  monitorWebpages().catch(e => console.log(e.message))
  setInterval(() => monitorWebpages().catch(e => console.log(e.message)), webpagesIntervalMs)
}

// fetch nfts every 10min
if (isMonitoring('nfts')) {
  monitorNfts().catch(e => console.log(e.message))
  setInterval(() => monitorNfts().catch(e => console.log(e.message)), nftsIntervalMs)
}
