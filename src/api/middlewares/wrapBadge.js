
const wrapBadge = async (ctx, next) => {
    // add isBadge = true to body
    const { chainId } = ctx.request.body;
    const { _chainId } = ctx.query;
    if (![16180, 62831].includes(chainId || _chainId)) {
        ctx.status = 400;
        ctx.body = { error: 'Only plyr and plyrTestnet support badge' };
        return;
    }
    ctx.request.body.isBadge = true;
    ctx.query.isBadge = true;
    await next();
};

module.exports = wrapBadge;