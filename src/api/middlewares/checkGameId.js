const ApiKey = require('../../models/apiKey');

const checkGameId = async (ctx, next) => {
  const { gameId } = ctx.request.body;

  if (!gameId) {
    ctx.status = 401;
    ctx.body = { error: 'Game ID is required' };
    return;
  }

  const apiKey = await ApiKey.findOne({ plyrId: gameId.toLowerCase() });
  if (!apiKey) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid game ID' };
    return;
  }

  await next();
};

module.exports = checkGameId;