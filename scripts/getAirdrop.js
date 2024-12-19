const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;
async function airdropInfo() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/airdrop/campaign/info",
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


async function main() {
  airdropInfo();
}

main().catch(console.error);
