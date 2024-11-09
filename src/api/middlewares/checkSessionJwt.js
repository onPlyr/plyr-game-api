const { verifyToken } = require("../../utils/jwt");
const UserInfo = require("../../models/userInfo");

const checkSessionJwt = async (ctx, next) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwt } = ctx.request.body;
  try {
    if (!sessionJwt) {
      ctx.status = 400;
      ctx.body = { error: 'sessionJwt is empty' };
      return;
    }
    const payload = verifyToken(sessionJwt);
    if (!payload) {
      throw new Error('Invalid sessionJwt');
    }

    if (payload.gameId !== gameId) {
      throw new Error('Invalid gameId');
    }

    const user = await UserInfo.findOne({ plyrId: payload.plyrId.toLowerCase() });
    if (!user) {
      throw new Error('User not found');
    }

    const nonce = user.nonce ? user.nonce : {};
    const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
    if (payload.nonce < gameNonce) {
      throw new Error('JWT nonce is expired');
    }

    ctx.state.payload = payload;
    ctx.state.user = user;
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
    return;
  }

  await next();
};

module.exports = checkSessionJwt;