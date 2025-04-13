const { isAddress } = require('viem');
const { chainNameToChainId, nftAlias } = require('../../config');
const UserInfo = require('../../models/userInfo');
const Secondary = require('../../models/secondary');
const MetaJson = require('../../models/metaJson');
const { getNftByAddresses } = require('../../services/subgraph');
const NodeCache = require('node-cache');
const axios = require('axios');

// Initialize cache with 1 hour TTL
const metaCache = new NodeCache({ stdTTL: 3600 });

const getNft = async (ctx) => {
    const { chain, contract, plyrId } = ctx.params;
    if (!chain || !contract || !plyrId) {
        ctx.status = 400;
        ctx.body = {
            error: 'Chain, contract, and plyrId are required'
        };
        return;
    }

    let _secondary = true;
    let _primary = true;
    let _chain = chain;
    let _contract = contract;

    const { secondary, primary } = ctx.query;
    if (secondary === 'false') {
        _secondary = false;
    }
    if (primary === 'false') {
        _primary = false;
    }

    if (isNaN(chain)) {
        _chain = chainNameToChainId[chain];
        if (isNaN(_chain)) {
            ctx.status = 400;
            ctx.body = {
                error: 'Invalid chain'
            };
            return;
        }
    }

    if (!isAddress(contract)) {
        if (nftAlias[_chain] && nftAlias[_chain][contract]) {
            _contract = nftAlias[_chain][contract];
        } else {
            ctx.status = 400;
            ctx.body = {
                error: 'Invalid contract'
            };
            return;
        }
    }

    if (isAddress(plyrId)) {
        ctx.status = 400;
        ctx.body = {
            error: 'Invalid PLYR[ID]'
        };
        return;
    }

    let _addrs = await getAddessesFromPlyrId(plyrId);
    if (!_addrs) {
        ctx.status = 400;
        ctx.body = {
            error: 'Invalid PLYR[ID]'
        };
        return;
    }
    if (!_primary) {
        delete _addrs.primaryAddress;
    }
    if (!_secondary) {
        delete _addrs.secondaryAddresses;
    }

    const addrs = [_addrs.mirrorAddress, _addrs.primaryAddress, ..._addrs.secondaryAddresses];

    const nfts = await getNftByAddresses(_chain, _contract, addrs);

    console.log('getNftByAddresses', nfts.length);

    const metaJsons = await getMetaJson(nfts.map(nft => nft.nft.tokenURI));

    ctx.status = 200;
    ctx.body = nfts.map((v) => {
        return {
            owner: v.owner,
            uri: v.nft.tokenURI,
            collection: _contract,
            quantity: v.quantity,
            tokenId: v.nft.tokenID,
            ...metaJsons[v.nft.tokenURI],
        }
    });
}

async function getAddessesFromPlyrId(plyrId) {
    const user = await UserInfo.findOne({ plyrId });
    if (!user) {
        return null;
    }

    const secondaries = await Secondary.find({ plyrId });
    if (secondaries.length > 0) {
        return {
            primaryAddress: user.primaryAddress,
            mirrorAddress: user.mirror,
            secondaryAddresses: secondaries.map(secondary => secondary.secondaryAddress)
        };
    }

    return {
        primaryAddress: user.primaryAddress,
        mirrorAddress: user.mirror,
        secondaryAddresses: [],
    };
}

const getMetaJson = async (uris) => {
    console.log('[getMetaJson] Start with uris:', uris);
    if (!Array.isArray(uris)) {
        uris = [uris];
    }

    const results = {};
    const missedUris = [];

    // Try to get from memory cache first
    for (const uri of uris) {
        const cached = metaCache.get(uri);
        if (cached) {
            console.log(`[getMetaJson] Cache hit for uri: ${uri}`);
            results[uri] = cached;
        } else {
            console.log(`[getMetaJson] Cache miss for uri: ${uri}`);
            missedUris.push(uri);
        }
    }

    if (missedUris.length > 0) {
        console.log(`[getMetaJson] Checking database for ${missedUris.length} uris:`, missedUris);
        // Try to get from database
        const dbResults = await MetaJson.find({ uri: { $in: missedUris } });
        console.log(`[getMetaJson] Found ${dbResults.length} results in database`);
        
        dbResults.forEach(item => {
            console.log(`[getMetaJson] DB hit for uri: ${item.uri}`);
            results[item.uri] = item.data;
            metaCache.set(item.uri, item.data);
            const index = missedUris.indexOf(item.uri);
            if (index > -1) {
                missedUris.splice(index, 1);
            }
        });

        // Fetch remaining from network
        if (missedUris.length > 0) {
            console.log(`[getMetaJson] Fetching ${missedUris.length} uris from network:`, missedUris);
            const fetchPromises = missedUris.map(async uri => {
                try {
                    console.log(`[getMetaJson] Fetching from network: ${uri}`);
                    const response = await axios.get(uri);
                    const data = response.data;
                    results[uri] = data;
                    console.log(`[getMetaJson] Network fetch success for uri: ${uri}`);
                    // Save to cache
                    metaCache.set(uri, data);
                    // Save to database
                    await new MetaJson({ uri, data }).save();
                    console.log(`[getMetaJson] Saved to cache and DB: ${uri}`);
                    return { uri, data };
                } catch (error) {
                    console.error(`[getMetaJson] Failed to fetch metadata from ${uri}:`, error.message);
                    return { uri, data: null };
                }
            });

            await Promise.all(fetchPromises);
        }
    }

    console.log('[getMetaJson] Final results:', results);
    return results;
}

exports.getNft = getNft;
exports.getMetaJson = getMetaJson;