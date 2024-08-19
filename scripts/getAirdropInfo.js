const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;
async function main() {
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
    console.log("ret", ret.data);
  } catch (error) {
    console.log(error.response.data);
  }

  try {
    let ret = await axios.get(
      process.env.API_ENDPOINT + "/api/airdrop/campaign/0/claimableReward/0xc472803f504468387fa97fc03c4f2a87ce4e7460",
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

main().catch(console.error);
