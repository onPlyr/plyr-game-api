const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');

const checkToken = async (ctx, next) => {
  const { token } = ctx.request.body;

  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Token is required' };
    return;
  }

  if (!isAddress(token) && !TOKEN_LIST[token.toLowerCase()]) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid token' };
    return;
  }

  if (isAddress(token)) {
    ctx.state.tokenAddress = token;
  } else {
    ctx.state.tokenAddress = TOKEN_LIST[token.toLowerCase()];
  }

  await next();
};

module.exports = checkToken;