const tokenListService = require('../../services/tokenListService');

const getTokenList = async (ctx) => {
    try {
        const _tokenList = await tokenListService.getTokenList();
        if (!_tokenList) {
            ctx.status = 503;
            ctx.body = { error: 'Token list not available yet' };
            return;
        }
        const tokenList = { ..._tokenList, tokens: [..._tokenList.tokens] };
        console.log('params', ctx.params, tokenList.tokens.length);
        if (ctx.params && ctx.params.tokenId) {
            const tokens = tokenList.tokens.filter(token => token.apiId === ctx.params.tokenId);
            if (tokens.length > 0) {
                ctx.body = tokens[0];
            } else {
                ctx.status = 404;
                ctx.body = { error: 'Token not found' };
            }
            tokenList.tokens = tokens;
            ctx.body = tokenList;
        } else {
            ctx.body = tokenList;
        }
    } catch (error) {
        console.error('Error in getTokenList:', error);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
    }
};

module.exports = {
    getTokenList
};
