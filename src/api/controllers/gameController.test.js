const gameController = require('./gameController');
const UserApprove = require('../../models/userApprove');
const { closeRedisConnection } = require('../../db/redis');

jest.mock('../../models/userApprove');
jest.mock('../../db/redis');

describe('Game Controller', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      request: { body: {} },
      body: {},
      status: 200,
    };
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  describe('postGameApprove', () => {
    test('successfully approves game', async () => {
      const approveData = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'plyr',
        amount: 100,
        expiresIn: 3600
      };
      ctx.request.body = approveData;
      UserApprove.updateOne.mockResolvedValue({});

      await gameController.postGameApprove(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Approved' });
      expect(UserApprove.updateOne).toHaveBeenCalledWith(
        { plyrId: 'testPlayer', gameId: 'testGame', token: 'plyr' },
        approveData,
        { upsert: true }
      );
    });

    test('handles errors', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        amount: 100,
        expiresIn: 3600
      };
      UserApprove.updateOne.mockRejectedValue(new Error('Database error'));

      await gameController.postGameApprove(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: 'Database error' });
    });
  });

  describe('getGameAllowance', () => {
    test('successfully gets allowance for non-expired approval', async () => {
      const now = new Date();
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'plyr'
      };
      UserApprove.findOne.mockResolvedValue({
        amount: 100,
        expiresIn: 3600,
        createdAt: new Date(now.getTime() - 1000000) // 1000 seconds ago
      });

      await gameController.getGameAllowance(ctx);
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ allowance: 100 });
    });

    test('returns 0 allowance for expired approval', async () => {
      const now = new Date();
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'plyr'
      };
      UserApprove.findOne.mockResolvedValue({
        amount: 100,
        expiresIn: 3600,
        createdAt: new Date(now.getTime() - 4000000) // 4000 seconds ago, which is more than expiresIn
      });

      await gameController.getGameAllowance(ctx);
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ allowance: 0 });
    });

    test('successfully gets allowance', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame'
      };
      UserApprove.findOne.mockResolvedValue({ amount: 100 });

      await gameController.getGameAllowance(ctx);
      console.log(ctx.body);
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ allowance: 100 });
    });

    test('handles errors', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame'
      };
      UserApprove.findOne.mockRejectedValue(new Error('Database error'));

      await gameController.getGameAllowance(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: 'Database error' });
    });
  });

  describe('postGameRevoke', () => {
    test('successfully revokes approval for specific token', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'plyr'
      };
      UserApprove.deleteOne.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
      expect(UserApprove.deleteOne).toHaveBeenCalledWith({
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'plyr'
      });
    });

    test('successfully revokes all approvals', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame',
        token: 'all'
      };
      UserApprove.deleteMany.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
      expect(UserApprove.deleteMany).toHaveBeenCalledWith({
        plyrId: 'testPlayer',
        gameId: 'testGame'
      });
    });

    test('successfully revokes approval', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame'
      };
      UserApprove.deleteOne.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
      expect(UserApprove.deleteOne).toHaveBeenCalledWith({
        plyrId: 'testPlayer',
        gameId: 'testGame'
      });
    });

    test('handles errors', async () => {
      ctx.request.body = {
        plyrId: 'testPlayer',
        gameId: 'testGame'
      };
      UserApprove.deleteOne.mockRejectedValue(new Error('Database error'));

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: 'Database error' });
    });
  });

  // Add more tests for other functions as needed
});