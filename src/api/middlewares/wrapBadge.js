const { chain } = require('../../config');

const wrapBadge = async (ctx, next) => {
    // add isBadge = true to body
    ctx.request.body.chainId = chain.chain.id;
    ctx.query.chainId = chain.chain.id.toString();
    console.log('wrap Badge chainId', chain.chain.id, chain.chain);
    ctx.request.body.isBadge = true;
    ctx.query.isBadge = true;

    if (ctx.request.body?.badges) {
        ctx.request.body.nfts = ctx.request.body.badges;
    }

    if (ctx.request.body?.badge) {
        ctx.request.body.nft = ctx.request.body.badge;
    }

    if (ctx.query?.badge) {
        ctx.query.nft = ctx.query.badge;
    }
    await next();
};

module.exports = wrapBadge;