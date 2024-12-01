const tokenListService = require('../../services/tokenListService');

const getTokenList = async (ctx) => {
    try {
        const tokenList = await tokenListService.getTokenList();
        if (!tokenList) {
            ctx.status = 503;
            ctx.body = { error: 'Token list not available yet' };
            return;
        }
        ctx.body = tokenList;
    } catch (error) {
        console.error('Error in getTokenList:', error);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
    }
};

module.exports = {
    getTokenList
};
