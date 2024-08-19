const jwt = require('jsonwebtoken');
const config = require('../config');

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtPublicKey, { algorithms: ['ES256'] });
  } catch (error) {
    return null;
  }
}

function generateJwtToken(payload, expiresIn = 86400, privateKey) {
  return jwt.sign(payload, privateKey || config.jwtPrivateKey, { algorithm: 'ES256', expiresIn });
}

module.exports = {
  verifyToken,
  generateJwtToken
};