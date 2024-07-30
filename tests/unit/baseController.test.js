const baseController = require('../../src/api/controllers/baseController');
const { closeRedisConnection } = require('../../src/db/redis');

describe('Base Controller', () => {
  afterAll(async () => {
    await closeRedisConnection();
  });
  test('getNow returns current time', () => {
    const ctx = {};
    baseController.getNow(ctx);
    expect(ctx.body).toHaveProperty('now');
    expect(new Date(ctx.body.now)).toBeInstanceOf(Date);
  });

  test('getStatus returns server status', () => {
    const ctx = {};
    baseController.getStatus(ctx);
    expect(ctx.body).toHaveProperty('status');
    expect(ctx.body).toHaveProperty('timestamp');
    expect(ctx.body).toHaveProperty('uptime');
    expect(ctx.body).toHaveProperty('memory');
    expect(ctx.body).toHaveProperty('cpu');
    expect(ctx.body.status).toBe('operational');
  });
});