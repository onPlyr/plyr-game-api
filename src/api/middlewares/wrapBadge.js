
const wrapBadge = async (ctx, next) => {
    // add isBadge = true to body
    ctx.request.body.isBadge = true;
    ctx.query.isBadge = true;
    await next();
};

module.exports = wrapBadge;