const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');
const UserApprove = require("../../models/userApprove");

const checkAllowance = async (ctx, next) => {
  const { tokens, amounts, sessionJwts } = ctx.request.body;
  const gameId = ctx.state.apiKey.plyrId;

  if (!tokens || !amounts || !sessionJwts) {
    ctx.status = 401;
    ctx.body = { error: 'Tokens and amounts and sessionJwts are required' };
    return;
  }

  if (tokens.length !== amounts.length) {
    ctx.status = 401;
    ctx.body = { error: 'Tokens and amounts must be the same length' };
    return;
  }
  const plyrIds = Object.keys(sessionJwts);

  let errors = [];

  for (let i=0; i<tokens.length; i++) {
    const token = tokens[i];
    const amount = amounts[i];
    const plyrId = plyrIds[i];

    if (!isAddress(token) && !TOKEN_LIST[token.toLowerCase()]) {
      errors.push('Invalid token: ' + token);
    }

    if (amount === undefined || Number(amount) < 0) {
      errors.push('Invalid amount: ' + amount);
    }

    if (Number(amount) > 0) {
	    const userApprove = await UserApprove.findOne({ gameId, plyrId, token: token.toLowerCase() });
	    if (!userApprove) {
	      errors.push('User not approved: ' + plyrId);
	    }

	    if (Number(userApprove.amount) < Number(amount)) {
	      errors.push('Insufficient allowance: ' + plyrId);
	    }
    }
  }

  if (errors.length > 0) {
    ctx.status = 401;
    ctx.body = { error: errors };
    return;
  }

  await next();
};

module.exports = checkAllowance;
