const request = require('supertest');
const { app, startServer } = require('../../src/api/app');

describe('API Routes', () => {
  let server;

  beforeAll(() => {
    server = startServer();
  });

  afterAll(done => {
    if (server && server.close) {
      server.close(done);
    } else {
      done();
    }
  });

  test('GET /api/now returns current time', async () => {
    const response = await request(app.callback()).get('/api/now');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('now');
    expect(new Date(response.body.now)).toBeInstanceOf(Date);
  });

  test('GET /api/status returns server status', async () => {
    const response = await request(app.callback()).get('/api/status');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('cpu');
    expect(response.body.status).toBe('operational');
  });
});