const config = require("../../config");
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../utils/jwt');

exports.getPublicKey = (ctx) => {
  ctx.body = {
    publicKey: process.env.JWT_PUBLIC_KEY
  };
};

exports.getVerifyJWT = (ctx) => {
  const token = ctx.request.query.token;
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
