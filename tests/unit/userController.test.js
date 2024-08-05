const userController = require('../../src/api/controllers/userController');
const UserInfo = require('../../src/models/userInfo');
const { verifyMessage } = require('viem');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { calcMirrorAddress } = require('../../src/utils/calcMirror');
const { closeRedisConnection } = require('../../src/db/redis');
const { params } = require('../../src/api/routes');

const privateKey = generatePrivateKey();

const account = privateKeyToAccount(privateKey);

jest.mock('../../src/models/userInfo');

describe('User Controller', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      query: {},
      request: { body: {} },
      body: {},
      params: {},
      status: 200
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
      const singatureMessage = `PLYR[ID] Registration`;

      let signature = await account.signMessage({
        message: singatureMessage,
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
      console.log('ctx.body', ctx.body);
      expect(ctx.body).toEqual({ 
        plyrId: testUser.plyrId.toLowerCase(), 
        mirror, 
        primaryAddress: testUser.address 
      });
    });
  });

  describe('postModifyAvatar', () => {
    let ctx = {
      params: {},
      request: { body: {} },
      body: {},
      status: 200
    };
    
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
      await userController.postModifyAvatar(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Avatar must be a non-empty string' });
    });

    test('returns 404 when user is not found', async () => {
      UserInfo.findOneAndUpdate.mockResolvedValue(null);
      await userController.postModifyAvatar(ctx);
      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: 'PLYR[ID] not found' });
    });

    test('successfully updates avatar when all inputs are valid', async () => {
      const updatedUser = {
        plyrId: 'testid',
        avatar: 'https://example.com/avatar.jpg',
      };
      UserInfo.findOneAndUpdate.mockResolvedValue(updatedUser);

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
});