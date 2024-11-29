import config from '../config.js'
import monitorState from './monitor-state.js'
import {fetchHtml, createCounter} from './utils.js'
import prometheus from './prometheus.js'
import Debug from 'debug'
const debug = Debug('plebbit-uptime-monitor:plebbit-previewer')

const initPlebbitPreviewerMonitorState = (plebbitPreviewerUrl) => {
  if (!monitorState.plebbitPreviewers[plebbitPreviewerUrl]) {
    monitorState.plebbitPreviewers[plebbitPreviewerUrl] = {}
  }
}

export const monitorPlebbitPreviewers = async () => {
  debug(`monitoring ${config.monitoring.plebbitPreviewerUrls?.length} plebbit previewers: ${config.monitoring.plebbitPreviewerUrls?.join(' ')}`)
  for (const plebbitPreviewerUrl of config.monitoring.plebbitPreviewerUrls || []) {
    initPlebbitPreviewerMonitorState(plebbitPreviewerUrl)

    // comment preview fetches
    getCommentPreviewFetchStats(plebbitPreviewerUrl)
      .then(stats => {
        monitorState.plebbitPreviewers[plebbitPreviewerUrl] = stats
        prometheusObserveCommentPreviewFetch(plebbitPreviewerUrl, stats)
      })
      .catch(e => debug(e.message))
  }
}

const getRandomPlebbitPreviewerUrlPath = () => {
  const yesterday = Math.round(Date.now() / 1000) - 60 * 60 * 24
  const paths = Object.values(monitorState.subplebbits)
    .map(subplebbit => {
      if (subplebbit?.lastSubplebbitUpdateTimestamp > yesterday && subplebbit.lastPostCid) {
        return `/p/${subplebbit.address}/c/${subplebbit.lastPostCid}`
      }
    })
    .filter(item => !!item)
  return paths[Math.floor(Math.random() * paths.length)]
}

const countCommentPreviewFetch = createCounter()
const getCommentPreviewFetchStats = async (plebbitPreviewerUrl) => {
  let lastCommentPreviewFetchSuccess = false
  let lastCommentPreviewFetchTime

  let attempts = 3
  while (attempts--) {
    let url
    try {
      const urlPath = getRandomPlebbitPreviewerUrlPath()
      if (!urlPath) {
        throw Error(`failed getting random lastPostCid from monitorState.subplebbits to monitor '${plebbitPreviewerUrl}'`)
      }
      url = `${plebbitPreviewerUrl}${urlPath}`

      const beforeTimestamp = Date.now()
      const fetchedHtml = await fetchHtml(url)
      if (!fetchedHtml.includes('osted by u/')) {
        throw Error(`failed fetching got response '${fetchedHtml.substring(0, 300).replace(/\s*\n\s*/g, ' ')}'`)
      }
      lastCommentPreviewFetchSuccess = true
      lastCommentPreviewFetchTime = (Date.now() - beforeTimestamp) / 1000

      debug(`fetched comment preview '${url}' in ${lastCommentPreviewFetchTime}s`)
      break
    }
    catch (e) {
      if (!attempts) {
        debug(`failed fetching comment preview '${url}': ${e.message}`)
      }
    }
  }

  return {
    commentPreviewFetchCount: countCommentPreviewFetch(plebbitPreviewerUrl),
    lastCommentPreviewFetchSuccess,
    lastCommentPreviewFetchTime
  }
}
// test
// debug(await getCommentPreviewFetchStats('https://pleb.bz'))

// test
// monitorPlebbitPreviewers(); setInterval(() => monitorPlebbitPreviewers(), 1000 * 60 * 10)

// prometheus
const commentPreviewFetchLabelNames = ['plebbit_previewer_url']
const counters = {
  commentPreviewFetchCount: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}plebbit_previewer_comment_preview_fetch_count`,
    help: `count of plebbit previewers comment preview fetch labeled with: ${commentPreviewFetchLabelNames.join(', ')}`,
    labelNames: commentPreviewFetchLabelNames, registers: [prometheus.promClient.register]
  }),
  commentPreviewFetchDurationSeconds: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}plebbit_previewer_comment_preview_fetch_duration_seconds_sum`,
    help: `count of plebbit previewers comment preview fetch duration seconds labeled with: ${commentPreviewFetchLabelNames.join(', ')}`,
    labelNames: commentPreviewFetchLabelNames, registers: [prometheus.promClient.register]
  }),
  commentPreviewFetchSuccessCount: new prometheus.promClient.Counter({
    name: `${prometheus.prefix}plebbit_previewer_comment_preview_fetch_success_count`,
    help: `count of plebbit previewers comment preview fetch success labeled with: ${commentPreviewFetchLabelNames.join(', ')}`,
    labelNames: commentPreviewFetchLabelNames, registers: [prometheus.promClient.register]
  })
}
const gauges = {
  lastCommentPreviewFetchDurationSeconds: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}plebbit_previewer_last_comment_preview_fetch_duration_seconds`,
    help: `duration gauge of last plebbit previewers comment preview fetch labeled with: ${commentPreviewFetchLabelNames.join(', ')}`,
    labelNames: commentPreviewFetchLabelNames, registers: [prometheus.promClient.register]
  }),
  lastCommentPreviewFetchSuccess: new prometheus.promClient.Gauge({
    name: `${prometheus.prefix}plebbit_previewer_last_comment_preview_fetch_success`,
    help: `success gauge of last plebbit previewers comment preview fetch labeled with: ${commentPreviewFetchLabelNames.join(', ')}`,
    labelNames: commentPreviewFetchLabelNames, registers: [prometheus.promClient.register]
  })
}
const isNumber = (number) => typeof number === 'number' && isFinite(number)
const prometheusObserveCommentPreviewFetch = (plebbitPreviewerUrl, stats) => {
  const labels = {plebbit_previewer_url: plebbitPreviewerUrl}
  // counters
  counters.commentPreviewFetchCount.inc(labels, 1)
  if (stats.lastCommentPreviewFetchSuccess) {
    counters.commentPreviewFetchSuccessCount.inc(labels, 1)
  }
  if (isNumber(stats.lastCommentPreviewFetchTime)) {
    counters.commentPreviewFetchDurationSeconds.inc(labels, stats.lastCommentPreviewFetchTime)
  }
  // gauges
  if (isNumber(stats.lastCommentPreviewFetchTime)) {
    gauges.lastCommentPreviewFetchDurationSeconds.set(labels, stats.lastCommentPreviewFetchTime)
  }
  gauges.lastCommentPreviewFetchSuccess.set(labels, stats.lastCommentPreviewFetchSuccess ? 1 : 0)
}
