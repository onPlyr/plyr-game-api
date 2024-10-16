const UserApprove = require('../../models/userApprove');
const { getRedisClient, closeRedisConnection } = require('../../db/redis');
const redis = require('../../db/redis');
const gameController = require('./gameController');

jest.mock('../../models/userApprove');
jest.mock('../../db/redis');
jest.mock('../../services/game');
const { isJoined } = require('../../services/game');

const mockXadd = jest.fn().mockResolvedValue('mockedTaskId');
const mockRedisClient = {
  xadd: mockXadd,
};

// Mock the getRedisClient function to always return our mockRedisClient
redis.getRedisClient.mockReturnValue(mockRedisClient);

describe('Game Controller', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      request: { body: {} },
      body: {},
      status: 200,
    };
    isJoined.mockResolvedValue(true);
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  describe('postGameApprove', () => {
    test('successfully approves game', async () => {
      const approveData = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
        amount: 100,
        expiresIn: 3600
      };
      ctx.request.body = approveData;
      UserApprove.updateOne.mockResolvedValue({});

      await gameController.postGameApprove(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Approved' });
    });

    test('handles errors', async () => {
      ctx.request.body = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
        amount: 100,
        expiresIn: 3600
      };
      UserApprove.updateOne.mockRejectedValue(new Error('Database error'));

      await gameController.postGameApprove(ctx);
      console.log(ctx);
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: 'Database error' });
    });
  });

  describe('getGameAllowance', () => {
    test('successfully gets allowance for non-expired approval', async () => {
      const now = new Date();
      ctx.params = {
        plyrId: 'testplayer',
        gameId: 'testgame',
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
      ctx.params = {
        plyrId: 'testplayer',
        gameId: 'testgame',
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
      ctx.params = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
      };
      UserApprove.findOne.mockResolvedValue({ amount: 100 });

      await gameController.getGameAllowance(ctx);
      console.log('debug 2', ctx.body);
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ allowance: 100 });
    });

    test('handles errors', async () => {
      ctx.params = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
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
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr'
      };
      UserApprove.deleteOne.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
    });

    test('successfully revokes all approvals', async () => {
      ctx.request.body = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'all'
      };
      UserApprove.deleteMany.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
      expect(UserApprove.deleteMany).toHaveBeenCalledWith({
        plyrId: 'testplayer',
        gameId: 'testgame'
      });
    });

    test('successfully revokes approval', async () => {
      ctx.request.body = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
      };
      UserApprove.deleteOne.mockResolvedValue({});

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: 'Revoked' });
    });

    test('handles errors', async () => {
      ctx.request.body = {
        plyrId: 'testplayer',
        gameId: 'testgame',
        token: 'plyr',
      };
      UserApprove.deleteMany.mockRejectedValue(new Error('Database error'));

      await gameController.postGameRevoke(ctx);

      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: 'Database error' });
    });
  });

  describe('postGameCreate', () => {
    test('successfully creates a game', async () => {
      ctx.request.body = { expiresIn: 3600 };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };

      await gameController.postGameCreate(ctx);
      console.log(ctx.body);
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'createGameRoom',
        JSON.stringify({
          gameId: 'testGameId',
          expiresIn: 3600,
        })
      );
    });

    test('uses default expiresIn when not provided', async () => {
      ctx.request.body = {};
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };

      await gameController.postGameCreate(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'createGameRoom',
        JSON.stringify({
          gameId: 'testGameId',
          expiresIn: 30 * 24 * 60 * 60,
        })
      );
    });
  });

  describe('postGameJoin', () => {
    test('successfully joins a game', async () => {
      ctx.request.body = { roomId: 'testRoom', sessionJwts: { player1: 'jwt1', player2: 'jwt2' } };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };
  
      await gameController.postGameJoin(ctx);
  
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'joinGameRoom',
        JSON.stringify({
          plyrIds: ['player1', 'player2'],
          gameId: 'testGameId',
          roomId: 'testRoom',
        })
      );
    });
  });
  
  describe('postGameLeave', () => {
    test('successfully leaves a game', async () => {
      ctx.request.body = { roomId: 'testRoom', sessionJwts: { player1: 'jwt1', player2: 'jwt2' } };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };
  
      await gameController.postGameLeave(ctx);
  
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'leaveGameRoom',
        JSON.stringify({
          plyrIds: ['player1', 'player2'],
          gameId: 'testGameId',
          roomId: 'testRoom',
        })
      );
    });
  });
  
  describe('postGamePay', () => {
    test('successfully processes a payment', async () => {
      ctx.request.body = { roomId: 'testRoom', sessionJwts: { testplayer: 'jwt1' }, token: 'testToken', amount: 100 };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };

      isJoined.mockResolvedValue(true);
  
      await gameController.postGamePay(ctx);
      console.log(ctx.body);
  
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'payGameRoom',
        JSON.stringify({
          plyrId: 'testplayer',
          gameId: 'testGameId',
          roomId: 'testRoom',
          token: 'testToken',
          amount: 100,
        })
      );
    });
  });
  
  describe('postGameEarn', () => {
    test('successfully processes earnings', async () => {
      ctx.request.body = { roomId: 'testRoom', plyrId: 'testplayer', token: 'testToken', amount: 200 };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };

      isJoined.mockResolvedValue(true);
  
      await gameController.postGameEarn(ctx);
  
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'earnGameRoom',
        JSON.stringify({
          plyrId: 'testplayer',
          gameId: 'testGameId',
          roomId: 'testRoom',
          token: 'testToken',
          amount: 200,
        })
      );
    });
  });

  describe('postGameEnd', () => {
    test('successfully ends a game', async () => {
      ctx.request.body = { roomId: 'testRoom' };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };

      await gameController.postGameEnd(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'endGameRoom',
        JSON.stringify({
          gameId: 'testGameId',
          roomId: 'testRoom',
        })
      );
    });
  });

  describe('postGameClose', () => {
    test('successfully closes a game', async () => {
      ctx.request.body = { gameId: 'testGameId', roomId: 'testRoom' };

      await gameController.postGameClose(ctx);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'closeGameRoom',
        JSON.stringify({
          gameId: 'testGameId',
          roomId: 'testRoom',
        })
      );
    });
  });

  describe('postGameMulticall', () => {
    test('successfully processes multiple calls', async () => {
      const functionDatas = [
        { function: 'join', params: { roomId: 'room1' } },
        { function: 'pay', params: { roomId: 'room1', token: 'token1', amount: 50 } },
      ];
      ctx.request.body = { roomId: 'testRoom', functionDatas, sessionJwts: { player1: 'jwt1', player2: 'jwt2' } };
      ctx.state = {
        apiKey: { plyrId: 'testGameId' },
      };
  
      await gameController.postGameMulticall(ctx);
  
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        task: {
          id: 'mockedTaskId',
          status: 'PENDING',
        },
      });
      expect(mockRedisClient.xadd).toHaveBeenCalledWith(
        'mystream',
        '*',
        'multicallGameRoom',
        JSON.stringify({
          gameId: 'testGameId',
          roomId: 'testRoom',
          functionDatas,
          sessionJwts: { player1: 'jwt1', player2: 'jwt2' },
        })
      );
    });
  });

  // Add more tests for other functions as needed
});