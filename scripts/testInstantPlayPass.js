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

async function createUserWithClaimingCode(plyrId, code) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const signatureMessage = `PLYR[ID] Registration with claiming code: ${code}`;
  const signature = await account.signMessage({ message: signatureMessage });

  const newUser = {
    address: account.address,
    signature: signature,
    plyrId: plyrId,
    secret: "test_secret_" + (new Date()).getTime(),
  };

  const timestamp = Date.now().toString();

  let hmac = generateHmacSignature(timestamp, newUser, secretKey);

  try {
    let ret = await axios.post(
      process.env.API_ENDPOINT + `/api/user/register/${code}`,
      newUser,
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("createUserWithClaimingCode response", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function main() {
  let body = {
    tokens: ['plyr', 'gamr'],
  }
  response = await makeAuthenticatedRequest(
    'post',
    '/api/instantPlayPass/register',
    game.apiKey,
    game.secKey,
    body
  );
  console.log("instantPlayPass/register response", response);

  let sessionJwt = response.sessionJwt;

  body = {
    sessionJwt,
  }
  response = await makeAuthenticatedRequest(
    'post',
    '/api/instantPlayPass/reveal/claimingCode',
    game.apiKey,
    game.secKey,
    body
  );
  console.log("instantPlayPass/reveal/claimingCode response", response);

  let claimingCode = response.claimingCode;

  response = await makeAuthenticatedRequest(
    'get',
    `/api/instantPlayPass/verify/claimingCode/${claimingCode}`,
    game.apiKey,
    game.secKey,
  );
  console.log("instantPlayPass/verify/claimingCode response", response);

  response = await makeAuthenticatedRequest(
    'post',
    '/api/instantPlayPass/reveal/privateKey',
    game.apiKey,
    game.secKey,
    body
  );
  console.log("instantPlayPass/reveal/privateKey response", response);

  await createUserWithClaimingCode(response.plyrId + "-claimed", claimingCode);
}

main().then(()=>console.log('done')).catch(console.error);