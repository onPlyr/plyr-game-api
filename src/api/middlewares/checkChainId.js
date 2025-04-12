const { CHAIN_CONFIG } = require("../../config");

const checkChainId = async (ctx, next) => {
    const { chainId } = ctx.request.body;

    if (!chainId) {
        ctx.status = 401;
        ctx.body = { error: 'Chain ID is required' };
        return;
    }

    const chainTag = getChainTag(chainId);
    if (!chainTag) {
        ctx.status = 401;
        ctx.body = { error: 'Invalid chain ID' };
        return;
    }

    ctx.state.chainTag = chainTag;

    await next();
};

const getChainTag = (chainId) => {
    for (const tag in CHAIN_CONFIG) {
        if (Number(CHAIN_CONFIG[tag].chainId) === Number(chainId)) {
            return tag;
        }
    }
    return null;
}

module.exports = {
    checkChainId,
    getChainTag,
};