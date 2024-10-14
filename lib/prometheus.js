const prefix = 'plebbit_uptime_monitor_'

import promClient from 'prom-client'
promClient.collectDefaultMetrics({prefix})

const up = new promClient.Gauge({
  name: `${prefix}up`,
  help: '1 = up, 0 = not up',
  registers: [promClient.register]
})
up.set(1)

const prometheus = {promClient, prefix}
export default prometheus

export {promClient, prefix}
