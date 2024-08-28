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

  await next();
};

module.exports = checkToken;