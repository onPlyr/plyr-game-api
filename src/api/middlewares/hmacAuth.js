const crypto = require('crypto');
const ApiKey = require('../../models/apiKey');

function hmacAuth(requiredRole) {
  return async (ctx, next) => {
    const { signature, timestamp, apikey } = ctx.headers;
    const bodyString = JSON.stringify(ctx.request.body);
    console.log('using apiKey:', apikey);

    if (!signature || !timestamp || !apikey) {
      ctx.status = 401;
      ctx.body = { error: 'Missing authentication headers' };
      return;
    }

    const apiKeyDoc = await ApiKey.findOne({ apiKey: apikey });

    if (!apiKeyDoc) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid API key' };
      return;
    }

    const data = timestamp + bodyString;
    const expectedSignature = crypto
      .createHmac('sha256', apiKeyDoc.secretKey)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid signature' };
      return;
    }

    // Check if the timestamp is within an acceptable range (e.g., 5 minutes)
    const timestampDate = new Date(parseInt(timestamp));
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (Math.abs(now - timestampDate) > fiveMinutes) {
      ctx.status = 401;
      ctx.body = { error: 'Request expired' };
      return;
    }

    // Check role
    if (requiredRole && apiKeyDoc.role !== requiredRole && apiKeyDoc.role !== 'admin') {
      ctx.status = 403;
      ctx.body = { error: 'Insufficient permissions' };
      return;
    }

    ctx.state.apiKey = apiKeyDoc;
    return next();
  };
}

module.exports = hmacAuth;