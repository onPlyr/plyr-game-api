const crypto = require('crypto');

function generateHmacSignature(timestamp, body, secretKey) {
  const bodyString = JSON.stringify(body);
  const data = timestamp + bodyString;
  return crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('hex');
}

module.exports = { generateHmacSignature };
