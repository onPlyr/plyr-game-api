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
      "https://api-testnet.plyr.network/api/task/status/1722914434180-0",
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
