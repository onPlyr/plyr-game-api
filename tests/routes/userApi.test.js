const request = require('supertest');
const { app } = require('../../src/api/app');
const { connectDB, closeDB } = require('../../src/db/mongoose');
const ApiKey = require('../../src/models/apiKey');
const UserInfo = require('../../src/models/userInfo');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { generateHmacSignature } = require('../../src/utils/hmacUtils');
const { calcMirrorAddress } = require('../../src/utils/calcMirror');
const { closeRedisConnection } = require('../../src/db/redis');
const { generateJwtToken } = require('../../src/utils/jwt');

jest.mock('../../src/models/userInfo');

describe('User API', () => {
  let userApiKey, privateKey, account, secondary;

  beforeAll(async () => {
    await connectDB();
    userApiKey = await ApiKey.create({ 
      plyrId: 'tester',
      apiKey: 'user-key', 
      secretKey: 'user-secret', 
      role: 'user' 
    });
    privateKey = generatePrivateKey();
    account = privateKeyToAccount(privateKey);
    privateKey = generatePrivateKey();
    secondary = privateKeyToAccount(privateKey);
  });

  afterAll(async () => {
    await ApiKey.deleteMany({apiKey: 'user-key'});
    await closeDB();
    await closeRedisConnection();
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
        `/api/user/exists/${existingPlyrId}`, 
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
        plyrId: newUser.plyrId.toLowerCase(), 
        mirror: expectedMirror,
        primaryAddress: newUser.address,
        avatar: 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR',
      });
    });
  });

  describe('GET /api/user/info/:plyrId', () => {
    it('should return user info', async () => {
      const plyrId = 'testUser';
      const userInfo = {
        plyrId: plyrId,
        primaryAddress: account.address,
        mirror: calcMirrorAddress(account.address),
        chainId: 62831,
        avatar: 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR',
        createdAt: Date.now()
      };

      UserInfo.findOne.mockResolvedValue(userInfo);

      const response = await makeAuthenticatedRequest(
        'get',
        `/api/user/info/${plyrId}`,
        userApiKey.apiKey,
        userApiKey.secretKey,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(userInfo);
    });
  });

  describe('POST /api/user/secondary/bind', () => {
    it('should success bind secondary address', async () => {
      const signatureMessage = `PLYR[ID] Secondary Bind`;
      const signature = await secondary.signMessage({ message: signatureMessage });

      const plyrId = 'testUser';
      const userInfo = {
        plyrId: plyrId,
        primaryAddress: account.address,
        mirror: calcMirrorAddress(account.address),
        chainId: 62831,
        avatar: 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR',
        createdAt: Date.now()
      };

      UserInfo.findOne.mockResolvedValue(userInfo);

      const response = await makeAuthenticatedRequest(
        'post', 
        '/api/user/secondary/bind', 
        userApiKey.apiKey, 
        userApiKey.secretKey, 
        {
          plyrId,
          secondaryAddress: secondary.address,
          signature,
        }
      );

      expect(response.status).toBe(200);
      
    });
  });

  describe("GET /api/jwt/publicKey", () => {
    it('should return the public key', async () => {
      const response = await makeAuthenticatedRequest(
        'get',
        '/api/jwt/publicKey',
        userApiKey.apiKey,
        userApiKey.secretKey
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('publicKey');
    });
  });

  describe("POST /api/jwt/verify", () => {
    it('should verify a valid JWT token', async () => {
      const token = generateJwtToken({ id: 1 });
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/jwt/verify',
        userApiKey.apiKey,
        userApiKey.secretKey,
        {
          token
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('payload');
    });
  });

  describe("POST /api/jwt/verifyUser", () => {
    it('should verify a valid user JWT token', async () => {
      const token = generateJwtToken({nonce: 0, plyrId: 'newTestUser', gameId: 'testPartner', deadline: Date.now() + 10000 });
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/jwt/verifyUser',
        userApiKey.apiKey,
        userApiKey.secretKey,
        {
          token,
          plyrId: 'newTestUser',
          gameId: 'testPartner',
          deadline: Date.now() + 10000
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('payload');
    });
  });
});