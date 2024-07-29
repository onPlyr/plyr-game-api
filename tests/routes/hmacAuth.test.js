const request = require('supertest');
const { app } = require('../../src/api/app');
const { connectDB, closeDB } = require('../../src/db/mongoose');
const ApiKey = require('../../src/models/apiKey');
const { generateHmacSignature } = require('../../src/utils/hmacUtils');

describe('HMAC Authentication and Authorization', () => {
  let userApiKey, adminApiKey;

  beforeAll(async () => {
    await connectDB();
    userApiKey = await ApiKey.create({ apiKey: 'user-key', secretKey: 'user-secret', role: 'user' });
    adminApiKey = await ApiKey.create({ apiKey: 'admin-key', secretKey: 'admin-secret', role: 'admin' });
  });

  afterAll(async () => {
    await ApiKey.deleteMany({});
    await closeDB();
  });

  async function makeAuthenticatedRequest(endpoint, apiKey, secretKey) {
    const timestamp = Date.now().toString();
    const body = {};
    const signature = generateHmacSignature(timestamp, body, secretKey);

    return request(app.callback())
      .get(endpoint)
      .set('apikey', apiKey)
      .set('signature', signature)
      .set('timestamp', timestamp)
      .send(body);
  }

  it('should allow user access to /api/now', async () => {
    const response = await makeAuthenticatedRequest('/api/now', userApiKey.apiKey, userApiKey.secretKey);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('now');
  });

  it('should allow admin access to /api/now', async () => {
    const response = await makeAuthenticatedRequest('/api/now', adminApiKey.apiKey, adminApiKey.secretKey);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('now');
  });

  it('should allow admin access to /api/status', async () => {
    const response = await makeAuthenticatedRequest('/api/status', adminApiKey.apiKey, adminApiKey.secretKey);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'operational');
  });

  it('should deny user access to /api/status', async () => {
    const response = await makeAuthenticatedRequest('/api/status', userApiKey.apiKey, userApiKey.secretKey);
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Insufficient permissions');
  });
});