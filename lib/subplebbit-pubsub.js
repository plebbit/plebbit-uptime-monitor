import config from '../config.js'
import monitorState from './monitor-state.js'
import {fetchDhtPeers, fetchHttpRoutersPeers, pubsubTopicToDhtKey, getTimeAgo, fetchKuboApi, createCounter} from './utils.js'
import * as cborg from 'cborg'
import {toString as uint8ArrayToString} from 'uint8arrays/to-string'
import {kubo, plebbitIpfsApi} from './plebbit-js/plebbit-js.js'
import prometheus from './prometheus.js'
import Debug from 'debug'
const debug = Debug('plebbit-uptime-monitor:subplebbit-pubsub')

const fakeChallengeRequestsIntervalMs = 1000 * 60 * 5
const lastSubplebbitPubsubMessageTooOldMs = 1000 * 60 * 30
const pubsubPeersIntervalMs = 1000 * 10

export const monitorSubplebbitsPubsub = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring || []) {
    const pubsubTopic = monitorState.subplebbits[subplebbit?.address]?.pubsubTopic
    const subplebbitPublicKey = monitorState.subplebbits[subplebbit?.address]?.publicKey
    monitorSubplebbitPubsub(subplebbit, pubsubTopic, subplebbitPublicKey)
      .catch(e => debug(e.message))
  }
}

const monitorSubplebbitPubsub = async (subplebbit, pubsubTopic, subplebbitPublicKey) => {
  if (!pubsubTopic) {
    throw Error(`can't monitor pubsub for '${subplebbit?.address}' no pubsub topic found yet`)
  }
  if (!subplebbitPublicKey) {
    throw Error(`can't monitor pubsub for '${subplebbit?.address}' no subplebbit public key found yet`)
  }

  // the dht and http router key used to announce/find providers for the pubsub topic of the subplebbit
  const pubsubPeersCid = await pubsubTopicToDhtKey(pubsubTopic)

  fetchDhtPeers(pubsubPeersCid)
    .then(pubsubDhtPeers => {
      debug(`fetched subplebbit pubsub dht peers for '${subplebbit.address}' ${pubsubDhtPeers.length} peers`)
      monitorState.subplebbits[subplebbit.address] = {...monitorState.subplebbits[subplebbit.address], pubsubDhtPeers}
      prometheusObserveSubplebbitPubsubPeers(subplebbit.address, 'Dht', pubsubDhtPeers)
    })
    .catch(e => {
      debug(`failed to fetch subplebbit pubsub dht peers for '${subplebbit.address}': ${e.message}`)
      prometheusObserveSubplebbitPubsubPeers(subplebbit.address, 'Dht')
    })

  fetchHttpRoutersPeers(pubsubPeersCid)
    .then(pubsubHttpRoutersPeers => {
      debug(`fetched subplebbit pubsub http routers peers for '${subplebbit.address}' ${pubsubHttpRoutersPeers.length} peers`)
      monitorState.subplebbits[subplebbit.address] = {...monitorState.subplebbits[subplebbit.address], pubsubHttpRoutersPeers}
      prometheusObserveSubplebbitPubsubPeers(subplebbit.address, 'HttpRouters', pubsubHttpRoutersPeers)
    })
    .catch(e => {
      debug(`failed to fetch subplebbit pubsub http routers peers for '${subplebbit.address}': ${e.message}`)
      prometheusObserveSubplebbitPubsubPeers(subplebbit.address, 'HttpRouters')
    })

  startListeningToPubsubMessages(subplebbit, pubsubTopic, subplebbitPublicKey)
    .catch(e => debug(`failed start listening to pubsub message for '${subplebbit.address}': ${e.message}`))

  startFetchingPubsubPeers(subplebbit, pubsubTopic)
}
// test
// config.monitorState = {...config.monitorState, writeFile: false}
// monitorState.subplebbitsMonitoring = [{address: 'business-and-finance.eth'}]
// monitorSubplebbitsPubsub()

const fetchPubsubPeers = async (subplebbit, pubsubTopic) => {
  if (!pubsubTopic) {
    throw Error(`can't fetch pubsub peers for '${subplebbit?.address}' no pubsub topic found yet`)
  }

  try {
    // probably not needed to check subscriptions
    // const subscriptions = await kubo.pubsub.ls()
    // if (!subscriptions.includes(pubsubTopic)) {
    //   throw Error(`not yet subscribed to pubsub topic '${pubsubTopic}'`)
    // }

    const pubsubPeers = await kubo.pubsub.peers(pubsubTopic)
    return pubsubPeers
  }
  catch (e) {
    throw Error(`failed fetching pubsub peers for '${subplebbit.address}': ${e.message}`)
  }
}
// test
// debug(await fetchPubsubPeers({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh'))

const isFetchingPubsubPeers = {}
const startFetchingPubsubPeers = (subplebbit, pubsubTopic) => {
  if (isFetchingPubsubPeers[pubsubTopic]) {
    return
  }
  isFetchingPubsubPeers[pubsubTopic] = true

  setInterval(() => {
    fetchPubsubPeers(subplebbit, pubsubTopic)
      .then(pubsubPeers => {
        if (Math.random() < 0.05) {
          debug(`fetched ${pubsubPeers.length} pubsub peers for '${subplebbit.address}'`)
        }
        monitorState.subplebbits[subplebbit.address] = {
          ...monitorState.subplebbits[subplebbit.address],
          pubsubPeers
        }
        prometheusObserveSubplebbitPubsubPeers(subplebbit.address, 'Pubsub', pubsubPeers)
      })
      .catch(e => debug(e.message))
  }, pubsubPeersIntervalMs)
}

const countPubsubMessage = createCounter()
const isListeningToPubsubMessages = {}
const startListeningToPubsubMessages = async (subplebbit, pubsubTopic, subplebbitPublicKey) => {
  if (isListeningToPubsubMessages[pubsubTopic]) {
    return
  }
  isListeningToPubsubMessages[pubsubTopic] = true

  const onPubsubMessageReceived = (rawPubsubMessage) => {
    const stats = {pubsubMessageCount: countPubsubMessage(subplebbit.address)}
    try {
      const pubsubMessage = cborg.decode(rawPubsubMessage?.data)
      // debug(subplebbit.address, {pubsubMessage})
      const pubsubMessagePublicKeyBase64 = uint8ArrayToString(pubsubMessage?.signature?.publicKey, 'base64')
      stats.lastPubsubMessageTimestamp = Math.round(Date.now() / 1000)

      // TODO: this can be exploited by republishing old subplebbit messages, needs more validation
      if (subplebbitPublicKey === pubsubMessagePublicKeyBase64) {
        stats.lastSubplebbitPubsubMessageTimestamp = stats.lastPubsubMessageTimestamp
        debug(`got pubsub message from subplebbit '${subplebbit?.address}'`)
      }
      else {
        debug(`got pubsub message in '${subplebbit?.address}'`)
      }
    }
    catch (e) {
      debug(`failed onPubsubMessageReceived for '${subplebbit.address}': ${e.message}`)
    }
    monitorState.subplebbits[subplebbit.address] = {
      ...monitorState.subplebbits[subplebbit.address],
      ...stats
    }
    prometheusObserveSubplebbitPubsubMessage(subplebbit.address, stats)
  }

  try {
    await kubo.pubsub.subscribe(pubsubTopic, onPubsubMessageReceived)
    debug(`subscribed to subplebbit pubsub '${subplebbit?.address}'`)

    // give some time to get a message before starting publishing fake ones
    setTimeout(() => {
      startPublishingFakeChallengeRequests(subplebbit).catch(e => debug(e.message))
    }, lastSubplebbitPubsubMessageTooOldMs)
  }
  catch (e) {
    isListeningToPubsubMessages[pubsubTopic] = false
    throw e
  }
}

const publishFakeChallengeRequest = async (subplebbit) => {
  const signer = await plebbitIpfsApi.createSigner()
  const getRandomString = () => (Math.random() + 1).toString(36).replace('.', '')
  const comment = await plebbitIpfsApi.createComment({
    signer,
    subplebbitAddress: subplebbit.address,
    title: `I am the subplebbit uptime monitor ${getRandomString()}`,
    content: `I am the subplebbit uptime monitor ${getRandomString()}`
  })
  comment.on('challenge', (challenge) => {
    debug(`fake challenge request got challenge from '${subplebbit.address}'`)
    comment.stop()
  })
  comment.on('challengeverification', (challengeVerification) => {
    debug(`fake challenge request got challenge verification from '${subplebbit.address}'`)
    comment.stop()
  })
  await comment.publish()
}

const startPublishingFakeChallengeRequests = async (subplebbit) => {
  const publishFakeChallengeRequests = () => {
    const lastSubplebbitPubsubMessageTimetamp = monitorState.subplebbits[subplebbit.address]?.lastSubplebbitPubsubMessageTimetamp
    const lastSubplebbitPubsubMessageTimetampIsTooOldTimestamp = (Date.now() - lastSubplebbitPubsubMessageTooOldMs) / 1000
    if (!lastSubplebbitPubsubMessageTimetamp || lastSubplebbitPubsubMessageTimetampIsTooOldTimestamp > lastSubplebbitPubsubMessageTimetamp) {
      debug(`last pubsub message from '${subplebbit.address}' ${getTimeAgo(lastSubplebbitPubsubMessageTimetamp)}, publishing fake challenge request`)
      publishFakeChallengeRequest(subplebbit).catch(e => debug(e.message)) 
    }
  }
  publishFakeChallengeRequests()
  setInterval(() => publishFakeChallengeRequests(), fakeChallengeRequestsIntervalMs)
}
// test
// debug(await startPublishingFakeChallengeRequests({address: 'plebmusic.eth'}))

// test
// setInterval(async () => debug(await monitorSubplebbitPubsub({address: 'business-and-finance.eth'}, '12D3KooWNMybS8JqELi38ZBX897PrjWbCrGoMKfw3bgoqzC2n1Dh', 'umVN3GWZtpq4ZJokGwplTbyOt5HGJ03wDHTbQ4m3rxg')), 10000)

// prometheus
const labelNames = ['subplebbit_address']
const counters = {
  subplebbitPubsubMessageCount: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_pubsub_message_count`,
    help: `count of subplebbit pubsub message labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register]
  })
}
const gauges = {
  subplebbitPubsubSecondsSinceLastPubsubMessage: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}subplebbit_pubsub_seconds_since_last_pubsub_message`,
    help: `gauge of subplebbit pubsub seconds since last pubsub message labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register],
    collect() {
      for (const subplebbit of Object.values(monitorState.subplebbits)) {
        if (subplebbit?.address && subplebbit.lastPubsubMessageTimestamp) {
          this.set({subplebbit_address: subplebbit.address}, Math.ceil(Date.now() / 1000) - subplebbit.lastPubsubMessageTimestamp)
        }
      }
    }
  }),
  subplebbitPubsubSecondsSinceLastSubplebbitPubsubMessage: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}subplebbit_pubsub_seconds_since_last_subplebbit_pubsub_message`,
    help: `gauge of subplebbit pubsub seconds since last subplebbit pubsub message labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register],
    collect() {
      for (const subplebbit of Object.values(monitorState.subplebbits)) {
        if (subplebbit?.address && subplebbit.lastSubplebbitPubsubMessageTimestamp) {
          this.set({subplebbit_address: subplebbit.address}, Math.ceil(Date.now() / 1000) - subplebbit.lastSubplebbitPubsubMessageTimestamp)
        }
      }
    }
  })
}
const toSnakeCase = (string) => string.replace(/([a-zA-Z])(?=[A-Z])/g,'$1_').toLowerCase()
// add all subplebbit pubsub peers types
const peerTypes = ['Dht', 'HttpRouters', 'Pubsub']
for (const peerType of peerTypes) {
  counters[`subplebbitPubsub${peerType}PeersFetchCount`] = new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_pubsub_${toSnakeCase(peerType)}_peers_fetch_count`,
    help: `count of subplebbit pubsub ${toSnakeCase(peerType).replaceAll('_', ' ')} peers fetch labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register]
  })
  counters[`subplebbitPubsub${peerType}PeersFetchSuccessCount`] = new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_pubsub_${toSnakeCase(peerType)}_peers_fetch_success_count`,
    help: `count of subplebbit pubsub ${toSnakeCase(peerType).replaceAll('_', ' ')} peers fetch success labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register]
  })
  gauges[`lastSubplebbitPubsub${peerType}PeersFetchSuccess`] = new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}last_subplebbit_pubsub_${toSnakeCase(peerType)}_peers_fetch_success`,
    help: `success gauge of last subplebbit pubsub ${toSnakeCase(peerType).replaceAll('_', ' ')} peers fetch labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register]
  })
  gauges[`lastSubplebbitPubsub${peerType}PeerCount`] = new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}last_subplebbit_pubsub_${toSnakeCase(peerType)}_peer_count`,
    help: `gauge of last subplebbit pubsub ${toSnakeCase(peerType).replaceAll('_', ' ')} peer count labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register]
  })
}
const prometheusObserveSubplebbitPubsubPeers = (subplebbitAddress, peerType, peers) => {
  const labels = {subplebbit_address: subplebbitAddress}
  // counters
  counters[`subplebbitPubsub${peerType}PeersFetchCount`].inc(labels, 1)
  if (peers) {
    counters[`subplebbitPubsub${peerType}PeersFetchSuccessCount`].inc(labels, 1)
  }
  // gauges
  gauges[`lastSubplebbitPubsub${peerType}PeersFetchSuccess`].set(labels, peers ? 1 : 0)
  if (peers) {
    gauges[`lastSubplebbitPubsub${peerType}PeerCount`].set(labels, peers.length)
  }
}
const prometheusObserveSubplebbitPubsubMessage = (subplebbitAddress, stats) => {
  const labels = {subplebbit_address: subplebbitAddress}
  counters.subplebbitPubsubMessageCount.inc(labels, 1)
}
