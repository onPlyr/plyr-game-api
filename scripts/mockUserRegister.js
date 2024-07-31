const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");

const apiKey = "39488631ccb3e1dcf8bb83da22000ba0";
const secretKey =
  "ef5567ed9e5450de4cc9ac7a04d4ac8e560043467d2066164d54672264347f5e";

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
      plyrId: "newTestUser111" + i,
      secret: "testSecret111" + i,
    };

    const timestamp = Date.now().toString();

    let hmac = generateHmacSignature(timestamp, newUser, secretKey);

    try {
      let ret = await axios.post(
        "http://localhost:3000/api/user/register",
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
