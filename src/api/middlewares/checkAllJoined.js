const { isJoined } = require('../../services/game');
const checkAllJoined = async (ctx, next) => {
  const { roomId } = ctx.request.body;
  const gameId = ctx.state.apiKey.plyrId;
  const plyrIds = ctx.state.plyrIds;

  let errors = [];

  for (let i=0; i<plyrIds.length; i++) {
    const plyrId = plyrIds[i];

    const _joined = await isJoined({plyrId, gameId, roomId});
    if (!_joined) {
      errors.push('Player is not joined: ' + plyrId);
      continue;
    }
  }

  if (errors.length > 0) {
    ctx.status = 401;
    ctx.body = { error: errors };
    return;
  }

  await next();
};

module.exports = checkAllJoined;
