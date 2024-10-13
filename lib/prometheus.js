const prefix = 'plebbit_uptime_monitor_'

import promClient from 'prom-client'
promClient.collectDefaultMetrics({prefix})

const up = new promClient.Gauge({
  name: `${prefix}up`,
  help: '1 = up, 0 = not up',
  registers: [promClient.register]
})
up.set(1)

// const labelNames = ['status_code', 'method', 'path']
// const httpRequestDurationSeconds = new promClient.Histogram({
//   name: `${prefix}http_request_duration_seconds`,
//   help: 'duration histogram of http responses labeled with: ' + labelNames.join(', '),
//   labelNames,
//   buckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
//   registers: [promClient.register]
// })

// const observeMetrics = (req, res) => {
//   const labels = {}
//   const timer = httpRequestDurationSeconds.startTimer(labels)
//   res.on('finish', () => {
//     labels.status_code = res.statusCode ?? 499
//     labels.method = req.method
//     // remove dynamic params from path label
//     labels.path = '/other'
//     if (req.url === '/') {
//       labels.path = '/'
//     } else if (req.url.startsWith('/ipns/')) {
//       labels.path = '/ipns'
//     } else if (req.url.startsWith('/ipfs/')) {
//       labels.path = '/ipfs'
//     } else if (req.url.startsWith('/api/v0/pubsub/sub')) {
//       labels.path = '/api/v0/pubsub/sub'
//     } else if (req.url.startsWith('/api/v0/pubsub/pub')) {
//       labels.path = '/api/v0/pubsub/pub'
//     }
//     timer()
//   })
// }

// const serverMetrics = (server) => {
//   server.on('request', (req, res) => {
//     observeMetrics(req, res)
//   })
// }

const prometheus = {promClient, prefix}
export default prometheus

export {promClient, prefix}
