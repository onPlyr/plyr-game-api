const jwtController = require("../../src/api/controllers/jwtController");
const { generateJwtToken } = require('../../src/utils/jwt');

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

  test('should verify a valid user JWT token', () => {
    const token = generateJwtToken({ plyrId: 'newTestUser', gamePartnerId: 'testPartner', deadline: Date.now() + 10000 });
    const ctx = {
      request: {
        body: {
          token: token,
          plyrId: 'newTestUser',
          gamePartnerId: 'testPartner',
          deadline: Date.now() + 10000
        }
      }
    };
    jwtController.postVerifyUserJwt(ctx);
    expect(ctx.status).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body).toHaveProperty('payload');
  });

  test('should reject an invalid user JWT token', () => {
    const token = generateJwtToken({ plyrId: 'newTestUser', gamePartnerId: 'testPartner', deadline: Date.now() - 10000 });
    const ctx = {
      request: {
        body: {
          token: token,
          plyrId: 'newTestUser',
          gamePartnerId: 'testPartner',
        }
      }
    };
    jwtController.postVerifyUserJwt(ctx);
    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('Token expired');
  });
});