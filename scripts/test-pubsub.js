// import the file to replace node-fetch first so it gets used in kubo and plebbit-js
import '../lib/plebbit-js/use-node-fetch.js'
import config from '../config.js'
import {create as createKubo} from 'kubo-rpc-client'
import {Agent as HttpsAgent} from 'https'
import {Agent as HttpAgent} from 'http'

const kuboRpcUrl = 'http://127.0.0.1:5001'

const Agent = kuboRpcUrl?.startsWith('https') ? HttpsAgent : HttpAgent
const kubo = await createKubo({
  url: kuboRpcUrl, 
  agent: new Agent({keepAlive: true, maxSockets: Infinity})
})

const topic = '12D3KooW9xH5VFfSQ5YWoHK1fWS9Yc5C7yytbiqgg4UPvzG1NQB6'
const onMessage = (rawMessage) => {
  const message = new TextDecoder().decode(rawMessage?.data)
  console.log('message:', message)
}
const onError = (error, fatal) => {
  console.log('subscribe onError', {error, fatal})
  if (fatal) {
    console.log('fatal error, try subscribe again')
    trySubscribe()
  }
}
const trySubscribe = async () => {
  while (true) {
    try {
      await kubo.pubsub.subscribe(topic, onMessage, {onError})
      console.log('subscribed')
      break
    }
    catch (e) {
      console.log('failed subscribe, trying again in 5s')
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}
trySubscribe()

setInterval(() => {
  // kubo.pubsub.ls().then(res => console.log('ls', res)).catch(e => console.log('ls error', e.message))
  // kubo.pubsub.peers(topic).then(res => console.log('peers', res)).catch(e => console.log('peers error', e.message))
}, 5000)
