const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');

const checkTokens = async (ctx, next) => {
  const { tokens } = ctx.request.body;

  if (!tokens) {
    ctx.status = 401;
    ctx.body = { error: 'Token is required' };
    return;
  }

  for (const token of tokens) {
    if (!isAddress(token) && !TOKEN_LIST()[token.toLowerCase()]) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid token: ' + token };
      return;
    }
  }

  await next();
};

module.exports = checkTokens;