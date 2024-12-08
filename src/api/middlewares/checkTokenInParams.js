const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');

const checkTokenInParams = async (ctx, next) => {
  const { tokenName } = ctx.params;

  if (!tokenName) {
    ctx.status = 401;
    ctx.body = { error: 'tokenName is required' };
    return;
  }

  if (!isAddress(tokenName) && !TOKEN_LIST()[tokenName.toLowerCase()]) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid tokenName' };
    return;
  }

  if (isAddress(tokenName)) {
    ctx.state.tokenAddress = tokenName;
  } else {
    ctx.state.tokenAddress = TOKEN_LIST()[tokenName.toLowerCase()].address;
  }

  await next();
};

module.exports = checkTokenInParams;