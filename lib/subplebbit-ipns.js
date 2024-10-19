import config from '../config.js'
import monitorState from './monitor-state.js'
import {plebbit} from './plebbit-js/plebbit-js.js'
import {getPlebbitAddressFromPublicKey, getTimeAgo} from './utils.js'
import prometheus from './prometheus.js'

export const monitorSubplebbitsIpns = async () => {
  for (const subplebbit of monitorState.subplebbitsMonitoring) {
    console.log(`fetching subplebbit '${subplebbit?.address}' ipns`)
    ;(async () => {
      try {
        const subplebbitUpdate = await plebbit.getSubplebbit(subplebbit?.address)
        console.log(`fetched subplebbit '${subplebbit?.address}' ipns last updated ${getTimeAgo(subplebbitUpdate.updatedAt)}`)
        monitorState.subplebbits[subplebbit?.address] = {
          ...monitorState.subplebbits[subplebbit?.address],
          lastSubplebbitUpdateTimestamp: subplebbitUpdate.updatedAt,
          pubsubTopic: subplebbitUpdate.pubsubTopic, // needed for pubsub monitoring
          publicKey: subplebbitUpdate.signature.publicKey // needed for pubsub monitoring
        }

        prometheusObserveSubplebbitUpdate(subplebbit?.address, subplebbitUpdate)

        if (subplebbitUpdate.statsCid) {
          try {
            const subplebbitStats = JSON.parse(await plebbit.fetchCid(subplebbitUpdate.statsCid))
            monitorState.subplebbits[subplebbit?.address] = {...monitorState.subplebbits[subplebbit?.address], subplebbitStats}
            prometheusObserveSubplebbitStats(subplebbit?.address, subplebbitStats)
          }
          catch (e) {
            console.log(`failed to get subplebbit '${subplebbit?.address}' stats: ${e.message}`)
          }
        }

        // TODO: fetch how many dht peers for subplebbit update
        // const text = await fetch(`https://delegated-ipfs.dev/routing/v1/providers/${subplebbitUpdate.updateCid}`).then(res => res.text())
      }
      catch (e) {
        console.log(`failed to get subplebbit '${subplebbit?.address}': ${e.message}`)
        prometheusObserveSubplebbitUpdateFailed(subplebbit?.address)
      }
    })()
  }
}

// prometheus
const counterLabelNames = ['subplebbit_address']
const counters = {
  subplebbitUpdateFetchCount: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_update_fetch_count`,
    help: `count of subplebbit update fetch labeled with: ${counterLabelNames.join(', ')}`,
    labelNames: counterLabelNames, registers: [prometheus.promClient.register]
  }),
  subplebbitUpdateFetchSuccessCount: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_update_fetch_success_count`,
    help: `count of subplebbit update fetch success labeled with: ${counterLabelNames.join(', ')}`,
    labelNames: counterLabelNames, registers: [prometheus.promClient.register]
  }),
  subplebbitUpdateFetchSecondsSinceUpdatedAtSum: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}subplebbit_update_fetch_seconds_since_updated_at_sum`,
    help: `sum of subplebbit update seconds since last update labeled with: ${counterLabelNames.join(', ')}`,
    labelNames: counterLabelNames, registers: [prometheus.promClient.register]
  })
}
const gaugeLabelNames = ['subplebbit_address']
const gauges = {
  lastSubplebbitUpdateFetchSuccess: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}last_subplebbit_update_fetch_success`,
    help: `success gauge of last subplebbit update fetch labeled with: ${gaugeLabelNames.join(', ')}`,
    labelNames: gaugeLabelNames, registers: [prometheus.promClient.register]
  }),
  lastSubplebbitUpdateFetchSecondsSinceUpdatedAt: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}last_subplebbit_update_fetch_seconds_since_updated_at`,
    help: `gauge of subplebbit update seconds since last update labeled with: ${gaugeLabelNames.join(', ')}`,
    labelNames: gaugeLabelNames, registers: [prometheus.promClient.register]
  })
}
// add all subplebbit stats times and names, e.g. subplebbitStats.allActiveUserCount
const subplebbitStatsTimes = ['hour', 'day', 'week', 'month', 'year', 'all']
const subplebbitStatsNames = ['ActiveUser', 'Post', 'Reply']
const toSnakeCase = (string) => string.replace(/([a-zA-Z])(?=[A-Z])/g,'$1_').toLowerCase()
for (const statsName of subplebbitStatsNames) {
  for (const statsTime of subplebbitStatsTimes) {
    gauges[`subplebbitStats${statsTime}${statsName}Count`] = new prometheus.promClient.Gauge({
      name: `${prometheus.prefix}subplebbit_stats_${statsTime}_${toSnakeCase(statsName)}_count`,
      help: `gauge of subplebbit stats ${statsTime} ${toSnakeCase(statsName).replaceAll('_', ' ')} count labeled with: ${gaugeLabelNames.join(', ')}`,
      labelNames: gaugeLabelNames, registers: [prometheus.promClient.register]
    })
  }
}
const isNumber = (number) => typeof number === 'number' && isFinite(number)
const prometheusObserveSubplebbitUpdate = (subplebbitAddress, subplebbitUpdate) => {
  const secondsSinceUpdatedAt = Math.ceil(Date.now() / 1000) - subplebbitUpdate.updatedAt
  // counters
  counters.subplebbitUpdateFetchCount.inc({subplebbit_address: subplebbitAddress}, 1)
  counters.subplebbitUpdateFetchSuccessCount.inc({subplebbit_address: subplebbitAddress}, 1)
  if (isNumber(secondsSinceUpdatedAt)) {
    counters.subplebbitUpdateFetchSecondsSinceUpdatedAtSum.inc({subplebbit_address: subplebbitAddress}, secondsSinceUpdatedAt)
  }
  // gauges
  gauges.lastSubplebbitUpdateFetchSuccess.set({subplebbit_address: subplebbitAddress}, 1)
  if (isNumber(secondsSinceUpdatedAt)) {
    gauges.lastSubplebbitUpdateFetchSecondsSinceUpdatedAt.set({subplebbit_address: subplebbitAddress}, secondsSinceUpdatedAt)
  }
}
const prometheusObserveSubplebbitUpdateFailed = (subplebbitAddress) => {
  // counters
  counters.subplebbitUpdateFetchCount.inc({subplebbit_address: subplebbitAddress}, 1)
  // gauges
  gauges.lastSubplebbitUpdateFetchSuccess.set({subplebbit_address: subplebbitAddress}, 0)
}
const prometheusObserveSubplebbitStats = (subplebbitAddress, subplebbitStats) => {
  // add all subplebbit stats times and names
  for (const statsName of subplebbitStatsNames) {
    for (const statsTime of subplebbitStatsTimes) {
      const value = subplebbitStats?.[`${statsTime}${statsName}Count`]
      if (isNumber(value)) {
        gauges[`subplebbitStats${statsTime}${statsName}Count`].set({subplebbit_address: subplebbitAddress}, value)
      }
    }
  }
}
