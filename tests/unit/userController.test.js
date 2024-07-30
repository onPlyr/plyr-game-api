const userController = require('../../src/api/controllers/userController');
const UserInfo = require('../../src/models/userInfo');
const { verifyMessage } = require('viem');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { calcMirrorAddress } = require('../../src/utils/calcMirror');
const { closeRedisConnection } = require('../../src/db/redis');

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
      expect(ctx.body).toEqual({ error: 'PlyrId is required' });
    });

    test('returns false when user does not exist', async () => {
      ctx.query.plyrId = 'nonexistentId';
      UserInfo.findOne.mockResolvedValue(null);

      await userController.getUserExists(ctx);
      expect(ctx.body).toEqual({ exists: false });
    });

    test('returns true when user exists', async () => {
      ctx.query.plyrId = 'existingId';
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
      expect(ctx.body).toEqual({ plyrId: testUser.plyrId, mirror });
    });
  });
});