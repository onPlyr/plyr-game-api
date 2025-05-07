const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
const { authenticator } = require("otplib");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;

let game = {
  plyrId: "testgame-1724945535246",
  secret: "testgame-1724945535246",
  apiKey: "19be0c4e364031ba643bde49e7341e8e",
  secKey: "feef5477c9e118e128b08f4e8ad9f0ad59e1db33d143aef8c4e994929d0d9db7",
  primaryAddress: '0x27Db722f2440E6A679dd1B3728010604CBBD22a9',
  mirrorAddress: '0x73320d7d76610629913b61fB3F3c9fADACe98bD5',
}

let users = [
  {
    plyrId: 'testuser1-1724945535246',
    secret: 'testuser1-1724945535246',
    mirrorAddress: '0x70682a6511cDA6B0d71C689b7d0e30146fE7cf79',
    primaryAddress: '0x9fA92d80df311c249DE11E66BA1BAE8C7Aca354C',
  },
  {
    plyrId: 'testuser2-1724945535246',
    secret: 'testuser2-1724945535246',
    mirrorAddress: '0x12786413b79dE9B2472d067dcBc5A34D45Fb12D2',
    primaryAddress: '0xE54e7A4212c2957163d2e69280Ee95C3d338ecBC',
  },
]

async function makeAuthenticatedRequest(method, endpoint, apiKey, secretKey, body = {}) {
  const timestamp = Date.now().toString();
  const signature = generateHmacSignature(timestamp, body, secretKey);
  let ret;
  if (method === 'get') {
    ret = await axios.get(
      process.env.API_ENDPOINT + endpoint,
      {
        headers: {
          apikey: apiKey,
          signature: signature,
          timestamp: timestamp,
        },
      }
    );
  } else {
    ret = await axios[method](
      process.env.API_ENDPOINT + endpoint, 
      body,
      {
        headers: {
          apikey: apiKey,
          signature: signature,
          timestamp: timestamp,
        },
      }
    );
  }
  
  return ret.data;
}

async function createGame() {
  const body = {
    expiresIn: 86400,
  }
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, body, game.secKey);
  let ret = await axios.post(
    process.env.API_ENDPOINT + "/api/game/create",
    body,
    {
      headers: {
        apikey: game.apiKey,
        signature: hmac,
        timestamp: timestamp,
      },
    }
  );
  console.log("ret", ret.data);
  let taskId = ret.data.task.id;
  let roomId = null;
  while (true) {
    // get roomId 
    hmac = generateHmacSignature(timestamp, {}, game.secKey);
    ret = await axios.get(
      process.env.API_ENDPOINT + "/api/task/status/" + taskId,
      {
        headers: {
          apikey: game.apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("ret", ret.data);
    if (ret.data.status !== 'PENDING') {
      roomId = ret.data.taskData.result.roomId;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  console.log("roomId", roomId);
  return roomId;
}

async function createJoinPayGame(sessionJwts, tokens, amounts) {
  const body = {
    expiresIn: 86400,
    sessionJwts: sessionJwts,
    tokens: tokens,
    amounts: amounts,
    sync: true,
  }
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, body, game.secKey);
  let ret = await axios.post(
    process.env.API_ENDPOINT + "/api/game/createJoinPay",
    body,
    {
      headers: {
        apikey: game.apiKey,
        signature: hmac,
        timestamp: timestamp,
      },
    }
  );
  console.log("ret", ret.data);
  roomId = ret.data.taskData.result.roomId;
  console.log("roomId", roomId);
  return roomId;
}

async function loginAndApprove(user) {
  console.log("user login and approve", user);
  const body = {
    plyrId: user.plyrId,
    otp: authenticator.generate(user.secret),
    gameId: game.plyrId,
    tokens: ['plyr', 'gamr'],
    amounts: ['0.001', '0.001'], 
    expiresIn: 3600,
  }

  const response = await makeAuthenticatedRequest(
    'post',
    '/api/user/loginAndApprove',
    game.apiKey,
    game.secKey,
    body
  );

  console.log("response", response);
  return response.sessionJwt;
}

async function approveToken(user) {
  const body = {
    plyrId: user.plyrId,
    gameId: game.plyrId,
    otp: authenticator.generate(user.secret),
    token: 'plyr', 
    amount: '0.001', 
    expiresIn: 3600,
  }
  const response = await makeAuthenticatedRequest(
    'post',
    '/api/game/approve',
    game.apiKey,
    game.secKey,
    body
  );

  console.log("response", response);
  return response;
}

async function main() {
  // users login and get sessionJwts
  let user1SessionJwt = await loginAndApprove(users[0]);
  let user2SessionJwt = await loginAndApprove(users[1]);
  
  let body;
  let response;
  let status;

  let roomId = await createJoinPayGame([user1SessionJwt, user2SessionJwt], ['plyr', 'plyr'], ['0.000001', '0.000001']);

  // verify sessionJwt

  body = {
    sessionJwt: user1SessionJwt,
  }
  response = await makeAuthenticatedRequest(
    'post',
    '/api/user/session/verify',
    game.apiKey,
    game.secKey,
    body
  );
  console.log("verify sessionJwt 1 response", response);

  body = {
    sessionJwt: user2SessionJwt,
  }
  response = await makeAuthenticatedRequest(
    'post',
    '/api/user/session/verify',
    game.apiKey,
    game.secKey,
    body
  );

  console.log("verify sessionJwt 2 response", response);
  
  // earn leave end
  body = {
    roomId: roomId,
    plyrIds: [users[0].plyrId, users[1].plyrId],
    tokens: ['plyr', 'plyr'],
    amounts: ['0.000001', '0.000001'],
    sync: true,
  }

  response = await makeAuthenticatedRequest(
    'post',
    '/api/game/earnLeaveEnd',
    game.apiKey,
    game.secKey,
    body
  );
  console.log("earnLeaveEnd response", JSON.stringify(response, null, 2));
}

main().then(()=>console.log('done')).catch(console.error);