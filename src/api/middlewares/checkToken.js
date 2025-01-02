const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');

const checkToken = async (ctx, next) => {
  const { token, tokens } = ctx.request.body;

  if (!token && !tokens) {
    ctx.status = 401;
    ctx.body = { error: 'Token is required' };
    return;
  }

  if (token) {
    if (!isAddress(token) && !TOKEN_LIST()[token.toLowerCase()]) {
      console.log('TOKEN_LIST', TOKEN_LIST());
      console.log('token', token);
      ctx.status = 401;
      ctx.body = { error: 'Invalid token: ' + token };
      return;
    }
  
    if (isAddress(token)) {
      ctx.state.tokenAddress = token;
    } else {
      ctx.state.tokenAddress = TOKEN_LIST()[token.toLowerCase()].address;
    }
  } else if (tokens.length > 0) {
    for (const token of tokens) {
      if (!isAddress(token) && !TOKEN_LIST()[token.toLowerCase()]) {
        ctx.status = 401;
        ctx.body = { error: 'Invalid token: ' + token };
        return;
      }
    }
    ctx.state.tokenAddresses = [];
    for (const token of tokens) {
      if (isAddress(token)) {
        ctx.state.tokenAddresses.push(token);
      } else {
        ctx.state.tokenAddresses.push(TOKEN_LIST()[token.toLowerCase()].address);
      }
    }
  } else {
    ctx.status = 401;
    ctx.body = { error: 'Invalid token: ' + token + ' ' + tokens.join(', ') };
    return;
  }

  await next();
};

module.exports = checkToken;