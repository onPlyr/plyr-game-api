const { isAddress } = require("viem");

const TOKEN_LIST = {
  'plyr': '0x0000000000000000000000000000000000000000',
  'gamr': '0xa875625fe8A955406523E52E485f351b92908ce1', // testnet
};

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