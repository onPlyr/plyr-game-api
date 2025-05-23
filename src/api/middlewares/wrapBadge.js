const { chain } = require('../../config');

const wrapBadge = async (ctx, next) => {
    // add isBadge = true to body
    ctx.request.body.chainId = chain.id;
    console.log('wrap Badge chainId', chain.id, chain);
    ctx.request.body.isBadge = true;
    ctx.query.isBadge = true;

    if (ctx.body?.badges) {
        ctx.body.nfts = ctx.body.badges;
    }

    if (ctx.body?.badge) {
        ctx.body.nft = ctx.body.badge;
    }

    if (ctx.query?.badge) {
        ctx.query.nft = ctx.query.badge;
    }
    await next();
};

module.exports = wrapBadge;