{
    subplebbits: {[subplebbitAddress: string]: SubplebbitStatus}
    ipfsGateways: {[ipfsGatewaysUrl: string]: IpfsGatewayStatus}
    pubsubProviders: {[pubsubProviderUrl: string]: PubsubProviderStatus}
    httpRouters: {[httpRouterUrl: string]: HttpRouterStatus}
    plebbitPreviewers: {[plebbitPreviewerUrl: string]: PlebbitPreviewerStatus}
    chainProviders: {[chainProviderUrl: string]: ChainProviderStatus}
    webpages: {[webpageUrl: string]: WebpageStatus}
    nfts: {[nftName: string]: NftStatus}
    plebbit: PlebbitStatus
}

SubplebbitStatus {
    address: string
    getSubplebbitCount: number
    lastSubplebbitUpdateTimestamp: number
    ipnsDhtPeers: Multiaddresses[] // plebbit nodes dont run the ipfs dht, so only through delegated routing
    ipnsHttpRoutersPeers: Multiaddresses[]
    ipnsCidHttpRoutersPeers: Multiaddresses[]
    pubsubPeers: Multiaddresses[]
    pubsubDhtPeers: Multiaddresses[] // plebbit nodes dont run the ipfs dht, so only through delegated routing
    pubsubHttpRoutersPeers: Multiaddresses[]
    pubsubMessageCount: number
    lastPubsubMessageTimestamp: number
    lastSubplebbitPubsubMessageTimestamp: number
}

IpfsGatewayStatus {
    url: string
    commentFetchCount: number
    lastCommentFetchTime: number
    lastCommentFetchSuccess: bool
    lastCommentFetchAttemptCount: number
    subplebbitIpnsFetches: {[subplebbitAddress: string]: SubplebbitIpnsFetch}
}

SubplebbitIpnsFetch {
    subplebbitIpnsFetchCount: number
    lastSubplebbitIpnsFetchSuccess: bool
    lastSubplebbitIpnsFetchTime: number
    lastSubplebbitIpnsFetchTimestamp: number
    lastSubplebbitIpnsFetchAttemptTimestamp: number
    lastSubplebbitIpnsFetchAttemptCount: number
}

PubsubProviderStatus {
    url: string
    publishCount: number
    lastSubscribeTime: number
    lastPublishTime: number
    lastPublishSuccess: bool
    lastPublishAttemptCount: number
}

HttpRouterStatus {
    url: string
    getProvidersFetchCount: number
    lastGetProvidersFetchSuccess: number
    lastGetProvidersFetchTime: number
    subplebbitIpnsGetProvidersFetches: {[subplebbitAddress: string]: SubplebbitIpnsGetProvidersFetch}
}

SubplebbitIpnsGetProvidersFetch {
    subplebbitIpnsGetProvidersFetchCount: number
    lastSubplebbitIpnsGetProvidersFetchSuccess: bool
    lastSubplebbitIpnsGetProvidersFetchTime: number
    lastSubplebbitIpnsGetProvidersFetchProviderCount: number
}

NftStatus {
    name: string
    ipfsGatewayFetches: {[ipfsGatewayUrl: string]: NftIpfsGatewayFetch}
}

NftIpfsGatewayFetch {
    ipfsGatewayFetchCount: number
    lastIpfsGatewayFetchSuccess: bool
    lastIpfsGatewayFetchTime: number
}

PlebbitStatus {
    subplebbitCount: number
    subplebbitsStats: {
        allActiveUserCount: number
        allPostCount: number
        etc...
    }
}
