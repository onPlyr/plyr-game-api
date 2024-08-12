const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

console.log(privateKey);
const base64PrivateKey = Buffer.from(privateKey).toString('base64');
console.log(base64PrivateKey);
console.log('-----')
console.log(publicKey);
const base64PublicKey = Buffer.from(publicKey).toString('base64');
console.log(base64PublicKey);