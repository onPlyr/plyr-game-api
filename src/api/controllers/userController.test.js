const userController = require('./userController');
const UserInfo = require('../../models/userInfo');
const { verifyMessage } = require('viem');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { closeRedisConnection } = require('../../db/redis');
const { params } = require('../routes');
const { generateJwtToken, verifyToken } = require('../../utils/jwt');
const Secondary = require('../../models/secondary');
const ApiKey = require('../../models/apiKey');
const { authenticator } = require('otplib');



const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const privateKey2 = generatePrivateKey();
const account2 = privateKeyToAccount(privateKey2);

jest.mock('../../models/userInfo');
jest.mock('../../models/secondary');
jest.mock('../../models/apiKey');
jest.mock('../../utils/jwt');
jest.mock('otplib');

describe('User Controller', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      query: {},
      request: { body: {} },
      body: {},
      params: {},
      status: 200,
      headers: {}
    };
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  describe('getUserExists', () => {
    test('returns 400 when plyrId is not provided', async () => {
      await userController.getUserExists(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'PlyrId or primaryAddress is required' });
    });

    test('returns false when user does not exist', async () => {
      ctx.params.queryStr = 'nonexistentId';
      UserInfo.findOne.mockResolvedValue(null);

      await userController.getUserExists(ctx);
      expect(ctx.body).toEqual({ exists: false });
    });

    test('returns true when user exists', async () => {
      ctx.params.queryStr = 'existingId';
      UserInfo.findOne.mockResolvedValue({ plyrId: 'existingId' });

      await userController.getUserExists(ctx);
      expect(ctx.body).toEqual({ exists: true });
    });
  });

  describe('postRegister', () => {
    test('returns 400 when required fields are missing', async () => {
      await userController.postRegister(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Address, signature, plyrId, secret are required' });
    });

    test('returns 400 when signature is invalid', async () => {
      let signature = await account.signMessage({
        message: 'hello',
      });

      ctx.request.body = {
        address: account.address,
        signature,
        plyrId: 'testId',
        secret: 'testSecret'
      };

      await userController.postRegister(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Invalid signature' });
    });

    test('successfully registers user when all inputs are valid', async () => {
      const signatureMessage = `PLYR[ID] Registration`;

      let signature = await account.signMessage({
        message: signatureMessage,
      });

      const testUser = {
        address: account.address,
        signature: signature,
        plyrId: 'testId',
        secret: 'testSecret'
      };
      ctx.request.body = testUser;
      UserInfo.create.mockResolvedValue(testUser);

      const mirror = calcMirrorAddress(testUser.address);

      await userController.postRegister(ctx);
      expect(ctx.body).toEqual({ 
        plyrId: testUser.plyrId.toLowerCase(), 
        mirrorAddress: mirror, 
        primaryAddress: testUser.address,
        avatar: 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR',
      });
    });
  });

  describe('postModifyAvatar', () => {
    beforeEach(() => {
      ctx.params.plyrId = 'testId';
      ctx.request.body = { avatar: 'https://example.com/avatar.jpg' };
      UserInfo.findOneAndUpdate = jest.fn();
    });

    test('returns 400 when plyrId is invalid', async () => {
      ctx.params.plyrId = '!!invalid-plyr-id';
      await userController.postModifyAvatar(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Invalid PLYR[ID]' });
    });

    test('returns 400 when avatar is not provided', async () => {
      ctx.request.body = {};
      UserInfo.findOne.mockResolvedValue(null);
      UserInfo.findOne.mockResolvedValue(null);
      const signatureMessage = "PLYR[ID] Update Profile Image";
      const signature = await account.signMessage({
        message: signatureMessage,
      });
      ctx.request.body = {
        plyrId: 'testid',
        avatar: '',
        signature: signature,
      };
      await userController.postModifyAvatar(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Avatar must be a non-empty string' });
    });

    test('returns 404 when user is not found', async () => {
      UserInfo.findOneAndUpdate.mockResolvedValue(null);
      UserInfo.findOne.mockResolvedValue(null);
      const signatureMessage = "PLYR[ID] Update Profile Image";
      const signature = await account.signMessage({
        message: signatureMessage,
      });
      ctx.request.body = {
        plyrId: 'testid',
        avatar: 'https://example.com/avatar.jpg',
        signature: signature,
      };
      await userController.postModifyAvatar(ctx);
      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: 'PLYR[ID] not found' });
    });

    test('successfully updates avatar when all inputs are valid', async () => {
      const updatedUser = {
        plyrId: 'testid',
        primaryAddress: account.address,
        avatar: 'https://example.com/avatar.jpg',
      };
      UserInfo.findOneAndUpdate.mockResolvedValue(updatedUser);
      UserInfo.findOne.mockResolvedValue(updatedUser);

      const signatureMessage = "PLYR[ID] Update Profile Image";
      const signature = await account.signMessage({
        message: signatureMessage,
      });

      ctx.request.body = {
        plyrId: 'testid',
        avatar: 'https://example.com/avatar.jpg',
        signature: signature,
      };

      await userController.postModifyAvatar(ctx);
      
      expect(UserInfo.findOneAndUpdate).toHaveBeenCalledWith(
        { plyrId: 'testid' },
        { $set: { avatar: 'https://example.com/avatar.jpg' } },
        { new: true }
      );
      expect(ctx.body).toEqual({ 
        plyrId: 'testid', 
        avatar: 'https://example.com/avatar.jpg'
      });
    });
  });

  describe('getUserInfo', () => {
    test('returns user info when valid plyrId is provided', async () => {
      const mockUser = {
        plyrId: 'testuser',
        mirror: '0xMirrorAddress',
        primaryAddress: '0xPrimaryAddress',
        chainId: 1,
        avatar: 'avatar.jpg',
        createdAt: new Date(),
      };
      UserInfo.findOne.mockResolvedValue(mockUser);

      ctx.params.plyrId = 'testuser';
      await userController.getUserInfo(ctx);

      expect(ctx.body).toEqual({
        plyrId: mockUser.plyrId,
        mirrorAddress: mockUser.mirror,
        primaryAddress: mockUser.primaryAddress,
        chainId: mockUser.chainId,
        avatar: expect.any(String),
        createdAt: mockUser.createdAt,
      });
    });

    test('returns user info when valid address is provided', async () => {
      const mockUser = {
        plyrId: 'testuser',
        mirror: '0xMirrorAddress',
        primaryAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        avatar: 'avatar.jpg',
        createdAt: new Date(),
      };
      UserInfo.findOne.mockResolvedValue(mockUser);

      ctx.params.plyrId = '0x1234567890123456789012345678901234567890';
      await userController.getUserInfo(ctx);

      expect(ctx.body).toEqual({
        plyrId: mockUser.plyrId,
        mirrorAddress: mockUser.mirror,
        primaryAddress: mockUser.primaryAddress,
        chainId: mockUser.chainId,
        avatar: expect.any(String),
        createdAt: mockUser.createdAt,
      });
    });

    test('returns 404 when user is not found', async () => {
      UserInfo.findOne.mockResolvedValue(null);

      ctx.params.plyrId = 'nonexistentuser';
      await userController.getUserInfo(ctx);

      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: 'PLYR[ID] not found' });
    });
  });

  describe('postSecondaryBind', () => {
    test('successfully binds secondary address', async () => {
      const mockUser = { plyrId: 'testuser', primaryAddress: account.address };
      UserInfo.findOne.mockResolvedValue(mockUser);
      Secondary.findOne.mockResolvedValue(null);
      Secondary.create.mockResolvedValue({});

      const singatureMessage = `PLYR[ID] Secondary Bind`;
      let signature = await account2.signMessage({
        message: singatureMessage,
      });

      ctx.request.body = {
        plyrId: 'testuser',
        secondaryAddress: account2.address,
        signature: signature,
      };

      await userController.postSecondaryBind(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        plyrId: 'testuser',
        secondaryAddress: account2.address,
      });
    });
  });

  describe('getSecondary', () => {
    test('returns secondary addresses for a plyrId', async () => {
      const mockSecondaries = [
        { plyrId: 'testuser', secondaryAddress: '0x2222222222222222222222222222222222222222' },
        { plyrId: 'testuser', secondaryAddress: '0x3333333333333333333333333333333333333333' },
      ];
      Secondary.find.mockResolvedValue(mockSecondaries);

      ctx.params.plyrId = 'testuser';
      await userController.getSecondary(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual(mockSecondaries);
    });
  });

  describe('postLogin', () => {
    test('successfully logs in user', async () => {
      const mockUser = {
        plyrId: 'testuser',
        secret: 'usersecret',
        primaryAddress: '0x1111111111111111111111111111111111111111',
        mirror: '0xMirrorAddress',
        nonce: {},
      };
      UserInfo.findOne.mockResolvedValue(mockUser);
      ApiKey.findOne.mockResolvedValue({ plyrId: 'testgame' });

      ctx.headers = { apikey: 'validapikey' };
      ctx.request.body = {
        plyrId: 'testuser',
        otp: '123456',
        expiresIn: 3600,
      };

      generateJwtToken.mockReturnValue('mockedjwttoken');
      authenticator.verify.mockReturnValue(true);

      await userController.postLogin(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toHaveProperty('sessionJwt', 'mockedjwttoken');
      expect(ctx.body).toHaveProperty('plyrId', 'testuser');
      expect(ctx.body).toHaveProperty('gameId', 'testgame');
      expect(ctx.body).toHaveProperty('primaryAddress', '0x1111111111111111111111111111111111111111');
      expect(ctx.body).toHaveProperty('mirrorAddress', '0xMirrorAddress');
    });
  });

  describe('postLogout', () => {
    test('successfully logs out user', async () => {
      const mockUser = {
        plyrId: 'testuser',
        nonce: { testgame: 1 },
      };
      UserInfo.findOne.mockResolvedValue(mockUser);
      ApiKey.findOne.mockResolvedValue({ plyrId: 'testgame' });

      verifyToken.mockReturnValue({ plyrId: 'testuser', nonce: 1, gameId: 'testgame' });

      ctx.headers = { apikey: 'validapikey' };
      ctx.request.body = { sessionJwt: 'validjwt' };

      await userController.postLogout(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Logout success' });
    });
  });

  describe("Verify User Session", () => {
    test('should verify a valid user JWT token', async () => {
      const token = 'validJwtToken';
      ctx.request.body = {
        sessionJwt: token,
      };

      verifyToken.mockReturnValue({ plyrId: 'testuser', nonce: 1, gameId: 'testgame' });

      UserInfo.findOne.mockResolvedValue({ plyrId: 'testuser', nonce: { testgame: 0 } });

      await userController.postUserSessionVerify(ctx);
      expect(ctx.status).toBe(200);
      expect(ctx.body.success).toBe(true);
      expect(ctx.body).toHaveProperty('payload');
    });
  });
});