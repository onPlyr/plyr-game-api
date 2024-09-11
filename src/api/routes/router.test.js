const request = require('supertest');
const { app } = require('../../api/app');
const { connectDB, closeDB } = require('../../db/mongoose');
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');
const { generateHmacSignature } = require('../../utils/hmacUtils');
const { authenticator } = require('otplib');
const { is2faUsed } = require('../../utils/utils');
const { closeRedisConnection } = require('../../db/redis');


jest.mock('../../models/userInfo');
jest.mock('../../utils/utils');

describe('OTP Auth Middleware', () => {
  let userApiKey;

  beforeAll(async () => {
    await connectDB();
    userApiKey = await ApiKey.create({ 
      plyrId: 'tester',
      apiKey: 'user-key', 
      secretKey: 'user-secret', 
      role: 'user' 
    });
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

  describe('POST /api/game/approve', () => {
    it('should successfully authenticate with valid OTP', async () => {
      const plyrId = 'testUser';
      const secret = 'TESTSECRET';
      const otp = authenticator.generate(secret);

      const user = {
        plyrId,
        secret,
        bannedAt: 0,
      };

      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp, gameId: 'testGame', token: 'plyr', amount: '100', expiresIn: 3600 }
      );
      expect(response.status).toBe(200);
    });

    it('should return 401 if OTP is already used', async () => {
      const plyrId = 'testUser';
      const otp = '123456';

      is2faUsed.mockReturnValue(true);

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp, gameId: 'testGame', token: 'plyr', amount: '100', expiresIn: 3600 }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: '2FA token already used' });
    });

    it('should return 404 if user is not found', async () => {
      const plyrId = 'nonexistentUser';
      const otp = '123456';

      UserInfo.findOne.mockResolvedValue(null);
      is2faUsed.mockReturnValue(false);

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp, gameId: 'testGame', token: 'plyr', amount: '100', expiresIn: 3600 }
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 403 if user is banned', async () => {
      const plyrId = 'bannedUser';
      const otp = '123456';

      const user = {
        plyrId,
        secret: 'TESTSECRET',
        bannedAt: Date.now(),
      };

      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp, gameId: 'testGame', token: 'plyr', amount: '100', expiresIn: 3600 }
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'User is temporary locked' });
    });

    it('should return 401 if OTP is invalid', async () => {
      const plyrId = 'testUser';
      const secret = 'TESTSECRET';
      const invalidOtp = '000000';

      const user = {
        plyrId,
        secret,
        bannedAt: 0,
        loginFailedCount: 0,
      };

      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);
      UserInfo.updateOne = jest.fn();

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp: invalidOtp, gameId: 'testGame', token: 'plyr', amount: '100', expiresIn: 3600 }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid 2fa token' });
      expect(UserInfo.updateOne).toHaveBeenCalledWith(
        { plyrId: user.plyrId },
        { $inc: { loginFailedCount: 1 } }
      );
    });

    it('should return 401 if token is invalid', async () => {
      const plyrId = 'testUser';
      const secret = 'TESTSECRET';
      const otp = authenticator.generate(secret);
      const invalidToken = 'invalidToken';

      const user = {
        plyrId,
        secret,
        bannedAt: 0,
      };

      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);

      const response = await makeAuthenticatedRequest(
        'post',
        '/api/game/approve',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp, gameId: 'testGame', token: invalidToken, amount: '100', expiresIn: 3600 }
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });
  });

  describe('POST /api/user/login', () => {
    it('should successfully login with valid credentials and OTP', async () => {
      const plyrId = 'testUser';
      const secret = 'TESTSECRET';
      const otp = authenticator.generate(secret);
  
      const user = {
        plyrId,
        secret,
        bannedAt: 0,
        loginFailedCount: 0,
      };
  
      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);
  
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/user/login',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp }
      );
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionJwt');
    });
  
    it('should return 401 if OTP is invalid', async () => {
      const plyrId = 'testUser';
      const secret = 'TESTSECRET';
      const invalidOtp = '000000';
  
      const user = {
        plyrId,
        secret,
        bannedAt: 0,
        loginFailedCount: 0,
      };
  
      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);
      UserInfo.updateOne = jest.fn();
  
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/user/login',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp: invalidOtp }
      );
  
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid 2fa token' });
      expect(UserInfo.updateOne).toHaveBeenCalledWith(
        { plyrId: user.plyrId },
        { $inc: { loginFailedCount: 1 } }
      );
    });
  
    it('should return 401 if OTP is already used', async () => {
      const plyrId = 'testUser';
      const otp = '123456';
  
      is2faUsed.mockReturnValue(true);
  
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/user/login',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp }
      );
  
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: '2FA token already used' });
    });
  
    it('should return 404 if user is not found', async () => {
      const plyrId = 'nonexistentUser';
      const otp = '123456';
  
      UserInfo.findOne.mockResolvedValue(null);
      is2faUsed.mockReturnValue(false);
  
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/user/login',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp }
      );
  
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  
    it('should return 403 if user is banned', async () => {
      const plyrId = 'bannedUser';
      const otp = '123456';
  
      const user = {
        plyrId,
        secret: 'TESTSECRET',
        bannedAt: Date.now(),
      };
  
      UserInfo.findOne.mockResolvedValue(user);
      is2faUsed.mockReturnValue(false);
  
      const response = await makeAuthenticatedRequest(
        'post',
        '/api/user/login',
        userApiKey.apiKey,
        userApiKey.secretKey,
        { plyrId, otp }
      );
  
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'User is temporary locked' });
    });
  });
});
