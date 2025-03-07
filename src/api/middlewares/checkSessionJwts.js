const { verifyToken } = require("../../utils/jwt");
const UserInfo = require("../../models/userInfo");


// input ctx.request.body
// sessionJwts: [jwt1, jwt2, jwt3] << just get a plyrid from jwt payload
// tokens: [plyr,plyr,plyr]
// amounts: [1,2,3]

const checkSessionJwts = async (ctx, next) => { 
  const _gameId = ctx.state.apiKey.plyrId;
  let { sessionJwts, gameId } = ctx.request.body;
  if (!gameId) {
    gameId = _gameId;
  }

  let isAllValid = true;
  let invalidPlyrIds = {};
  let users = {};
  try {
    if (!sessionJwts || sessionJwts.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'sessionJwts is empty' };
      return;
    }
    let plyrIds = await Promise.all(sessionJwts.map(async (sessionJwt) => {
      const payload = verifyToken(sessionJwt);
      if (!payload) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'Invalid sessionJwt';
        return;
      }
      const plyrId = payload.plyrId;
  
      if (payload.gameId !== gameId) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'Invalid gameId';
        return;
      }
  
      const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
      if (!user) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'User not found';
        return;
      }
  
      const nonce = user.nonce ? user.nonce : {};
      const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
      if (payload.nonce < gameNonce) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'JWT nonce is expired';
        return;
      }

      const deadline = user.deadline ? user.deadline : {};
      const gameDeadline = deadline[gameId] ? deadline[gameId] : (Date.now() + 86400*1000);
      if (gameDeadline < Date.now()) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'JWT deadline is expired';
        return;
      }

      users[plyrId] = user;
      return plyrId;
    }));
    ctx.state.plyrIds = plyrIds;
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = { error: error.message };
    return;
  }

  if (!isAllValid) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid sessionJwts', invalidPlyrIds };
    return;
  }

  ctx.state.users = users;
  await next();
};

module.exports = checkSessionJwts;