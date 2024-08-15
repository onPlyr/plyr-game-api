const config = require("../../config");
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../utils/jwt');
const UserInfo = require('../../models/userInfo');

exports.getPublicKey = (ctx) => {
  ctx.body = {
    publicKey: process.env.JWT_PUBLIC_KEY
  };
};

exports.postVerifyJwt = (ctx) => {
  const token = ctx.request.body.token;
  const payload = verifyToken(token);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid token',
    };
    return;
  }
  console.log('payload', payload);
  ctx.status = 200;
  ctx.body = {
    success: true,
    payload,
  };
}

exports.postVerifyUserJwt = async (ctx) => {
  const { token, plyrId, gameId } = ctx.request.body;
  const payload = verifyToken(token);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid token',
    };
    return;
  }

  if (payload.plyrId !== plyrId || payload.gameId !== gameId) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid plyrId or gameId',
    };
    return;
  }

  if (payload.deadline < Date.now()) {
    ctx.status = 401;
    ctx.body = {
      error: 'Token expired',
    };
    return;
  }

  const user = await UserInfo.findOne({ plyrId });
  if (!user) {
    ctx.status = 401;
    ctx.body = {
      error: 'User not found',
    };
    return;
  }

  const nonce = user.nonce ? user.nonce : {};
  const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
  if (isNaN(payload.nonce) || payload.nonce < gameNonce) {
    ctx.status = 401;
    ctx.body = {
      error: 'JWT nonce is expired',
    };
    return;
  }

  ctx.status = 200;
  ctx.body = {
    success: true,
    payload,
  };
}