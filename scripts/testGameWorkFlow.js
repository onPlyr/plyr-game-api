const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
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

async function main() {
  // register 3 users (the first one is the game creator), game, user1, user2
  // create game
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
  // join game
  // pay
  // earn
  // end game
}

main().then(()=>console.log('done')).catch(console.error);