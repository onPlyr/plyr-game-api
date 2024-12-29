const { isAddress } = require('viem');
const { chainNameToChainId, nftAlias } = require('../../config');
const UserInfo = require('../../models/userInfo');
const Secondary = require('../../models/secondary');
const { getNftByAddresses } = require('../../services/subgraph');

exports.getNft = async (ctx) => {
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

    ctx.status = 200;
    ctx.body = nfts;
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
