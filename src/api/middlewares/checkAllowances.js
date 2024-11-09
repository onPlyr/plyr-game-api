const { isAddress } = require("viem");
const { TOKEN_LIST } = require('../../config');
const UserApprove = require("../../models/userApprove");

const checkAllowances = async (ctx, next) => {
  const { tokens, amounts } = ctx.request.body;
  const gameId = ctx.state.apiKey.plyrId;
  const plyrIds = ctx.state.plyrIds;

  if (!tokens || !amounts || !plyrIds) {
    ctx.status = 401;
    ctx.body = { error: 'Tokens and amounts and sessionJwts are required' };
    return;
  }

  if (tokens.length !== amounts.length) {
    ctx.status = 401;
    ctx.body = { error: 'Tokens and amounts must be the same length' };
    return;
  }

  let errors = [];

  for (let i=0; i<tokens.length; i++) {
    const token = tokens[i];
    const amount = amounts[i];
    const plyrId = plyrIds[i];

    if (!isAddress(token) && !TOKEN_LIST[token.toLowerCase()]) {
      errors.push('Invalid token: ' + token);
      continue;
    }

    if (amount === undefined || Number(amount) < 0) {
      errors.push('Invalid amount: ' + amount);
      continue;
    }

    if (Number(amount) > 0) {
	    const userApprove = await UserApprove.findOne({ gameId, plyrId, token: token.toLowerCase() });
	    if (!userApprove) {
	      errors.push('User not approved: ' + plyrId);
      continue;
	    }

	    if (Number(userApprove.amount) < Number(amount)) {
	      errors.push('Insufficient allowance: ' + plyrId);
        continue;
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

module.exports = checkAllowances;
