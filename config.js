export default {
  monitoring: {
    // multisub urls or file paths to monitor (will support ipns names in the future)
    multisubs: [
      'https://raw.githubusercontent.com/plebbit/temporary-default-subplebbits/master/multisub.json',
      './temporary-default-subplebbits-multisub.json'
    ],
    ipfsGatewayUrls: [
      'https://ipfsgateway.xyz',
      'https://ipfs.io',
      'https://cloudflare-ipfs.com',
      'https://4everland.io',
      'https://gateway.pinata.cloud',
      'https://flk-ipfs.xyz',
      'https://ipfs.cyou',
      'https://dweb.link',
      'https://gateway.plebpubsub.xyz',
      'https://gateway.forumindex.com'
    ],
    pubsubProviderUrls: [
      'https://pubsubprovider.xyz/api/v0', 
      'https://plebpubsub.xyz/api/v0', 
      'https://rannithepleb.com/api/v0'
    ],
    httpRouterUrls: [
      'https://routing.lol',
      'https://peers.pleb.bot',
    ],
    plebbitPreviewerUrls: [
      'https://pleb.bz'
    ],
    chainProviders: {
      eth: {urls: ['https://ethrpc.xyz', 'ethers.js', 'viem'], chainId: 1},
      sol: {urls: ['https://solrpc.xyz', 'web3.js']}
    },
    webpages: [
      {url: 'https://plebbit.com', match: '[Ss]eedit|[Pp]lebchan|[Ee]steban|[Rr]eddit'},
      {url: 'https://plebbit.online', match: '[Gg]rafana'},
      {url: 'https://api.plebbit.online', match: 'allActiveUserCount'},
      {url: 'https://plebbit.eth.limo', match: '<title>Plebbit</title>'},
      {url: 'https://plebbit.eth.link', match: '<title>Plebbit</title>'},
      {url: 'https://plebbit.eth.sucks', match: '<title>Plebbit</title>'},
      {url: 'https://plebbit-eth.ipns.dweb.link', match: '<title>Plebbit</title>'},
      {url: 'https://seedit.app', match: 'reddit alternative'},
      {url: 'https://seedit.netlify.app', match: 'reddit alternative'},
      {url: 'https://seedit.eth.limo', match: 'reddit alternative'},
      {url: 'https://seedit.eth.link', match: 'reddit alternative'},
      {url: 'https://seedit.eth.sucks', match: 'reddit alternative'},
      {url: 'https://seedit-eth.ipns.dweb.link', match: 'reddit alternative'},
      {url: 'https://plebchan.app', match: '4chan alternative'},
      {url: 'https://plebchan.netlify.app', match: '4chan alternative'},
      {url: 'https://plebchan.eth.limo', match: '4chan alternative'},
      {url: 'https://plebchan.eth.link', match: '4chan alternative'},
      {url: 'https://plebchan.eth.sucks', match: '4chan alternative'},
      {url: 'https://plebchan-eth.ipns.dweb.link', match: '4chan alternative'},
      {url: 'https://plebones.netlify.app', match: 'bare bones'},
      {url: 'https://plebones.eth.limo', match: 'bare bones'},
      {url: 'https://plebones.eth.link', match: 'bare bones'},
      {url: 'https://plebones.eth.sucks', match: 'bare bones'},
      {url: 'https://plebones-eth.ipns.dweb.link', match: 'bare bones'}
    ],
    nfts: [
      {name: 'ExosPlebs', baseUri: 'Qmakn3p9v7EBo2VXkPitPqPMVzdZ1wpghaF5fPCHg1nePa', totalSupply: 10000, ipfsGatewayUrls: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://4everland.io', 'https://flk-ipfs.xyz']},
      {name: 'BitcoinBrothers', baseUri: 'bafybeia3w4w7rdyxaamdlb44rpf3fltvbabhjdny36erzgklafhceamyea', tokenUriSuffix: '.json', totalSupply: 10000, ipfsGatewayUrls: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://4everland.io', 'https://flk-ipfs.xyz']},
      {name: 'BoredApeYachtClub', baseUri: 'QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq', totalSupply: 10000, ipfsGatewayUrls: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://4everland.io', 'https://flk-ipfs.xyz']}
    ]
  },
  delegatedRoutingUrls: [
    'https://delegated-ipfs.dev'
  ],
  ipfsApiUrl: 'http://127.0.0.1:5001/api/v0',
  plebbitOptions: {
    ipfsGatewayUrls: [
      'https://ipfs.io',
      'https://ipfsgateway.xyz',
      'https://gateway.plebpubsub.xyz',
      'https://4everland.io'
    ],
    pubsubHttpClientsOptions: ['https://pubsubprovider.xyz/api/v0'],
    chainProviders: {
      eth: {urls: ['https://ethrpc.xyz', 'viem', 'ethers.js'], chainId: 1},
      sol: {urls: ['https://solrpc.xyz', 'web3.js'], chainId: 1}
    },
    httpRoutersOptions: [
      'https://routing.lol',
      'https://peers.pleb.bot'
    ]
  }
}