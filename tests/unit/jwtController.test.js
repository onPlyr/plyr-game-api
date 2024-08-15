const jwtController = require("../../src/api/controllers/jwtController");
const { generateJwtToken } = require('../../src/utils/jwt');
const UserInfo = require('../../src/models/userInfo');

jest.mock('../../src/models/userInfo');

describe('JWT Controller', () => {
  afterAll(async () => {
  });

  test('generate and verify JWT token', () => {
    const ctx = {
      request: {
        body: {
          token: generateJwtToken({ id: 1 })
        }
      }
    };
    jwtController.postVerifyJwt(ctx);
    expect(ctx.status).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body).toHaveProperty('payload');
  });

  test('generate and reject bad JWT token', () => {
    let pk = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgUSLpddFfWR7q+tjn
1myg06VhHd5yIB5erpbJisuotcqhRANCAATToamLCZ3oPykRJMqn6ux3eVVyL/Tj
LylLu2R9Vn5Pdu0y671fVvqN/r3OT7YuZT3Wyp8TKwnPa7HMeTBQ2tLC
-----END PRIVATE KEY-----`;
    const ctx = {
      request: {
        body: {
          token: generateJwtToken({ id: 1 }, pk)
        }
      }
    };
    
    jwtController.postVerifyJwt(ctx);
    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('Invalid token');
  });

  test('should return base64 public key', () => {
    const ctx = {};
    jwtController.getPublicKey(ctx);
    expect(ctx.body).toHaveProperty('publicKey');
    expect(ctx.body.publicKey).toBe(process.env.JWT_PUBLIC_KEY);
  });

  it('should verify a valid user JWT token', async () => {
    const token = generateJwtToken({nonce: 0, plyrId: 'newTestUser', gameId: 'testPartner', deadline: Date.now() + 10000 });
    const ctx = {
      request: {
        header: {apiKey: 'testApiKey'},
        body: {
          token: token,
          plyrId: 'newTestUser',
          gameId: 'testPartner',
          deadline: Date.now() + 10000
        }
      }
    };

    UserInfo.findOne.mockResolvedValue({ plyrId: 'newTestUser' });

    await jwtController.postVerifyUserJwt(ctx);
    console.log(ctx.body);
    expect(ctx.status).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body).toHaveProperty('payload');
  });

  test('should reject an invalid user JWT token', async () => {
    const token = generateJwtToken({ plyrId: 'newTestUser', gameId: 'testPartner', deadline: Date.now() - 10000 });
    const ctx = {
      request: {
        body: {
          token: token,
          plyrId: 'newTestUser',
          gameId: 'testPartner',
        }
      }
    };
    await jwtController.postVerifyUserJwt(ctx);
    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('Token expired');
  });
});