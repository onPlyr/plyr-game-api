const config = require("../../config");
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../utils/jwt');

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

exports.postVerifyUserJwt = (ctx) => {
  const { token, plyrId, gamePartnerId } = ctx.request.body;
  const payload = verifyToken(token);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid token',
    };
    return;
  }

  if (payload.plyrId !== plyrId || payload.gamePartnerId !== gamePartnerId) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid plyrId or gamePartnerId',
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

  ctx.status = 200;
  ctx.body = {
    success: true,
    payload,
  };
}