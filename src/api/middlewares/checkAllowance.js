const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');
const UserApprove = require("../../models/userApprove");

const checkAllowance = async (ctx, next) => {
  const { token, amount, sessionJwts } = ctx.request.body;
  const gameId = ctx.state.apiKey.plyrId;

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

  if (!amount || Number(amount) <= 0) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid amount' };
    return;
  }

  const plyrIds = Object.keys(sessionJwts);
  const plyrId = plyrIds[0];
  const userApprove = await UserApprove.findOne({ gameId, plyrId, token });

  if (!userApprove) {
    ctx.status = 401;
    ctx.body = { error: 'User not approved' };
    return;
  }

  if (Number(userApprove.amount) < Number(amount)) {
    ctx.status = 401;
    ctx.body = { error: 'Insufficient allowance' };
    return;
  }

  await next();
};

module.exports = checkAllowance;