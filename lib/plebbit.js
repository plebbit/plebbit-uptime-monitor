import monitorState from './monitor-state.js'
import prometheus from './prometheus.js'

const peersNames = ['ipnsDhtPeers', 'ipnsHttpRoutersPeers', 'ipnsCidHttpRoutersPeers', 'pubsubDhtPeers', 'pubsubHttpRoutersPeers', 'pubsubPeers']

const getUniquePeerCounts = () => {
  const peersMaps = {}
  peersNames.forEach(peersName => {
    peersMaps[peersName] = new Map()
  })
  for (const subplebbitAddress in monitorState.subplebbits) {
    for (const peersName in peersMaps) {
      for (const peer of monitorState.subplebbits[subplebbitAddress][peersName] || []) {
        peersMaps[peersName].set(peer.ID || peer, peer) // peer can be an object or string
      }
    }
  }
  const peerCounts = {}
  for (const peersName in peersMaps) {
    peerCounts[`${peersName.replace(/s$/, '')}Count`] = peersMaps[peersName].size
  }
  return peerCounts
}

const getUniquePeerCount = (peersName) => {
  const peersMap = new Map()
  for (const subplebbitAddress in monitorState.subplebbits) {
    for (const peer of monitorState.subplebbits[subplebbitAddress][peersName] || []) {
      peersMap.set(peer.ID || peer, peer) // peer can be an object or string
    }
  }
  return peersMap.size
}

// prometheus
const labelNames = []
const counters = {}
const gauges = {}
const toSnakeCase = (string) => string.replace(/([a-zA-Z])(?=[A-Z])/g,'$1_').toLowerCase()
for (const peersName of peersNames) {
  const peerCountName = `${peersName.replace(/s$/, '')}Count`
  gauges[`plebbit${peerCountName}`] = new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}plebbit_${toSnakeCase(peerCountName)}`,
    help: `gauge of plebbit ${toSnakeCase(peerCountName).replaceAll('_', ' ')} labeled with: ${labelNames.join(', ')}`,
    labelNames, registers: [prometheus.promClient.register],
    collect() {
      this.set(getUniquePeerCount(peersName))
    }
  })
}

const plebbit = {getUniquePeerCounts}
export default plebbit

export {getUniquePeerCounts}
