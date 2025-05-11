const { nftSubgraphs } = require('../config');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 }); // 60 seconds TTL
const cache2 = new NodeCache({ stdTTL: 365*24*3600 }); // 1 year TTL

exports.getNftByAddresses = async (chain, contract, addrs) => {
    const cacheKey = `${chain}-${contract}-${addrs.sort().join(',')}`;

    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const url = nftSubgraphs[chain];
    const query = `
        query {
            ownerships(first: 1000, where: { nft_: { contract: "${contract}" }, owner_in: ${JSON.stringify(addrs.map(addr => addr.toLowerCase()))} }) {
                owner
                nft {
                    tokenID
                    tokenURI
                }
                quantity
            }
        }
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
    });

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.statusText}`);
    }

    const { data, errors } = await response.json();
    
    if (errors) {
        throw new Error(`GraphQL Errors: ${JSON.stringify(errors)}`);
    }

    cache.set(cacheKey, data.ownerships);
    return data.ownerships;
}

exports.getNftByTokenId = async (chain, contract, tokenId) => {
    const cacheKey = `${chain}-${contract}-${tokenId}`;
    console.log('getNftByTokenId', cacheKey);

    const cachedResult = cache2.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const url = nftSubgraphs[chain];
    console.log('getNftByTokenId', url);
    const query = `
        query {
            nfts( where: { contract: "${contract.toLowerCase()}", tokenID: "${tokenId}" }) {
                tokenID
                tokenURI
                ownership {
                    owner
                    quantity
                }
            }
        }
    `;

    console.log('getNftByTokenId', query);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
    });

    console.log('getNftByTokenId', response);

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.statusText}`);
    }

    const { data, errors } = await response.json();
    console.log('getNftByTokenId', data, errors);    
    if (errors) {
        throw new Error(`GraphQL Errors: ${JSON.stringify(errors)}`);
    }

    cache2.set(cacheKey, data.nfts);
    return data.nfts;
}
