const { nftSubgraphs } = require('../config');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 }); // 60 seconds TTL

exports.getNftByAddresses = async (chain, contract, addrs) => {
    const cacheKey = `${chain}-${contract}-${addrs.sort().join(',')}`;

    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const url = nftSubgraphs[chain];
    const query = `
        query {
            ownerships(where: { nft_: { contract: "${contract}" }, owner_in: ${JSON.stringify(addrs.map(addr => addr.toLowerCase()))} }) {
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
