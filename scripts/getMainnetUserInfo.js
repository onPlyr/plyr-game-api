const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.MAINNET_APIKEY;
const secretKey = process.env.MAINNET_SECRET;
const API_ENDPOINT = "https://api.plyr.network";

async function userInfo() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      API_ENDPOINT + "/api/user/info/notmike",
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
      API_ENDPOINT + "/api/user/balance/notmike",
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
      API_ENDPOINT + "/api/user/balance/notmike/0x413F1a8F0A2Bd9b6D31B2CA91c4aa7bC08266731",
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

  try {
    let ret = await axios.get(
      API_ENDPOINT + "/api/user/balance/notmike/gamr",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("userTokenBalance 2", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function isGame() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      API_ENDPOINT + "/api/isGame/testgame-1724945535246",
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

async function userActiveSessions() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      API_ENDPOINT + "/api/user/activeSessions/fennec2",
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("activeSessions", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function main() {
  for (let i = 0; i < 100; i++) {
    console.log(`Iteration ${i + 1}`);
    userInfo();
  }
  // userInfo();
  // userBalance();
  // userTokenBalance();
  // isGame();
  // userActiveSessions();
}

main().catch(console.error);
