const request = require('supertest');
const { app } = require('../../src/api/app');
const { connectDB, closeDB } = require('../../src/db/mongoose');
const ApiKey = require('../../src/models/apiKey');
const UserInfo = require('../../src/models/userInfo');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { generateHmacSignature } = require('../../src/utils/hmacUtils');
const { calcMirrorAddress } = require('../../src/utils/calcMirror');

jest.mock('../../src/models/userInfo');

describe('User API', () => {
  let userApiKey, privateKey, account;

  beforeAll(async () => {
    await connectDB();
    userApiKey = await ApiKey.create({ 
      apiKey: 'user-key', 
      secretKey: 'user-secret', 
      role: 'user' 
    });
    privateKey = generatePrivateKey();
    account = privateKeyToAccount(privateKey);
  });

  afterAll(async () => {
    await ApiKey.deleteMany({});
    await closeDB();
  });

  async function makeAuthenticatedRequest(method, endpoint, apiKey, secretKey, body = {}) {
    const timestamp = Date.now().toString();
    const signature = generateHmacSignature(timestamp, body, secretKey);

    return request(app.callback())[method](endpoint)
      .set('apikey', apiKey)
      .set('signature', signature)
      .set('timestamp', timestamp)
      .send(body);
  }

  describe('GET /api/user/exists', () => {
    it('should return true for existing user', async () => {
      const existingPlyrId = 'existingUser';
      UserInfo.findOne.mockResolvedValue({ plyrId: existingPlyrId });

      const response = await makeAuthenticatedRequest(
        'get', 
        `/api/user/exists?plyrId=${existingPlyrId}`, 
        userApiKey.apiKey, 
        userApiKey.secretKey
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ exists: true });
    });
  });

  describe('POST /api/user/register', () => {
    it('should successfully register a new user', async () => {
      const signatureMessage = `PLYR[ID] Registration`;
      const signature = await account.signMessage({ message: signatureMessage });

      const newUser = {
        address: account.address,
        signature: signature,
        plyrId: 'newTestUser111',
        secret: 'testSecret111'
      };

      UserInfo.create.mockResolvedValue(newUser);

      const response = await makeAuthenticatedRequest(
        'post', 
        '/api/user/register', 
        userApiKey.apiKey, 
        userApiKey.secretKey, 
        newUser
      );

      console.log(response.status);
      console.log(response.body);

      const expectedMirror = calcMirrorAddress(newUser.address);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        plyrId: newUser.plyrId, 
        mirror: expectedMirror 
      });
    });
  });
});