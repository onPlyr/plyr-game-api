const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;
async function userInfo() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/user/info/test-account",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("userInfo", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function userBalance() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/user/balance/test-account",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("userBalance", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function userTokenBalance() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/user/balance/test-account/0xa875625fe8A955406523E52E485f351b92908ce1",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("userTokenBalance", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function isGame() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/isGame/testgame-1724945535246",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("isGame", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function main() {
  userInfo();
  userBalance();
  userTokenBalance();
  isGame();
}

main().catch(console.error);
