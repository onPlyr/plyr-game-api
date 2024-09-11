const { verifyToken } = require("../../utils/jwt");
const UserInfo = require("../../models/userInfo");


// input ctx.request.body
// sessionJwts: {
//   plyrId0: 'sessionJwt0',
//   plyrId1: 'sessionJwt1',
//   plyrId2: 'sessionJwt2',
// }
// output ctx.body
// {
//   error: 'Invalid sessionJwts',
//   invalidPlyrIds: {
//     plyrId0: 'Invalid sessionJwt',
//   }
// }

const checkSessionJwts = async (ctx, next) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts } = ctx.request.body;
  let isAllValid = true;
  let invalidPlyrIds = {};
  let users = {};
  try {
    if (!sessionJwts || Object.keys(sessionJwts).length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'sessionJwts is empty' };
      return;
    }
    await Promise.all(Object.keys(sessionJwts).map(async (plyrId) => {
      const sessionJwt = sessionJwts[plyrId];
      const payload = verifyToken(sessionJwt);
      if (!payload) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'Invalid sessionJwt';
        return;
      }
  
      if (payload.gameId !== gameId) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'Invalid gameId';
        return;
      }
  
      if (plyrId !== payload.plyrId) {
        isAllValid = false;
        invalidPlyrIds[plyrId] = 'Invalid plyrId';
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
      users[plyrId] = user;
    }));
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
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