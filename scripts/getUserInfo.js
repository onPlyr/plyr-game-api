const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
const apiKey = "39488631ccb3e1dcf8bb83da22000ba0";
const secretKey =
  "ef5567ed9e5450de4cc9ac7a04d4ac8e560043467d2066164d54672264347f5e";

async function main() {
  const timestamp = Date.now().toString();
  let hmac = generateHmacSignature(timestamp, {}, secretKey);

  try {
    let ret = await axios.get("http://localhost:3000/api/user/info/newTestUser1111",
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
