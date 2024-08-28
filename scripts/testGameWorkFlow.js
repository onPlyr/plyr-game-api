const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;

let game = {
  privateKey: generatePrivateKey(),
  plyrId: "testgame-" + Date.now(),
}

let users = [
  {
    privateKey: generatePrivateKey(),
    plyrId: "testuser1-" + Date.now(),
  },
  {
    privateKey: generatePrivateKey(),
    plyrId: "testuser2-" + Date.now(),
  },
]

async function registerUsers(user) {
  const signatureMessage = `PLYR[ID] Registration`;
  const account = privateKeyToAccount(user.privateKey);
  const signature = await account.signMessage({ message: signatureMessage });

  const newUser = {
    address: account.address,
    signature: signature,
    plyrId: user.plyrId,
    secret: user.plyrId,
  };
  
  user.account = account;
  user.address = account.address;
  user.secret = user.plyrId;

  const timestamp = Date.now().toString();

  let hmac = generateHmacSignature(timestamp, newUser, secretKey);

  try {
    let ret = await axios.post(
      process.env.API_ENDPOINT + "/api/user/register",
      newUser,
      {
        headers: {
          apikey: apiKey,
          signature: hmac,
          timestamp: timestamp,
        },
      }
    );
    console.log("ret", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }
}

async function main() {
  // register 3 users (the first one is the game creator)
  await registerUsers(game);
  await registerUsers(users[0]);
  await registerUsers(users[1]);
  // create game
  // join game
  // pay
  // earn
  // end game
}

main().then(()=>console.log('done')).catch(console.error);