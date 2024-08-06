const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const apiKey = process.env.TEST_APIKEY;
const secretKey = process.env.TEST_SECRET;

async function main() {
  // test create 100 users with random plyrId and secret
  for (let i = 0; i < 2; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const signatureMessage = `PLYR[ID] Registration`;
    const signature = await account.signMessage({ message: signatureMessage });

    const newUser = {
      address: account.address,
      signature: signature,
      plyrId: "newTestUser115" + i,
      secret: "testSecret115" + i,
    };

    const timestamp = Date.now().toString();

    let hmac = generateHmacSignature(timestamp, newUser, secretKey);

    try {
      let ret = await axios.post(
        "https://api-testnet.plyr.network/api/user/register",
        // "http://localhost:3000/api/user/register",
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
}

main().catch(console.error);
