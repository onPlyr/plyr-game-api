const { generateHmacSignature } = require("../src/utils/hmacUtils");
const axios = require("axios");
require('dotenv').config();

const game = {
  apiKey: process.env.ZOONO_APIKEY,
  secKey: process.env.ZOONO_SECRET,
}

async function makeAuthenticatedRequest(method, endpoint, apiKey, secretKey, body = {}) {
  const timestamp = Date.now().toString();
  const signature = generateHmacSignature(timestamp, body, secretKey);
  let ret;
  if (method === 'get') {
    ret = await axios.get(
      process.env.API_ENDPOINT + endpoint,
      {
        headers: {
          apikey: apiKey,
          signature: signature,
          timestamp: timestamp,
        },
      }
    );
  } else {
    ret = await axios[method](
      process.env.API_ENDPOINT + endpoint, 
      body,
      {
        headers: {
          apikey: apiKey,
          signature: signature,
          timestamp: timestamp,
        },
      }
    );
  }
  
  return ret.data;
}

async function registerNewUser() {
  const body = {
    tokens: ['plyr', 'gamr'],
  }
  try {
    const response = await makeAuthenticatedRequest(
      'post',
      '/api/instantPlayPass/register',
      game.apiKey,
      game.secKey,
      body
    );
    console.log("New user registered:", response);
  } catch (error) {
    console.error("Registration failed:", error.response?.data || error.message);
  }
}

async function main() {
  console.log("Starting instant play pass registration every 30-40 seconds...");
  
  // Register first user immediately
  await registerNewUser();
  
  // Then register a new user every 30-40 seconds
  const scheduleNextRegistration = async () => {
    const delay = Math.floor(Math.random() * (40000 - 30000 + 1) + 30000); // Random between 30000-40000ms
    await new Promise(resolve => setTimeout(resolve, delay));
    await registerNewUser();
    scheduleNextRegistration();
  };
  
  scheduleNextRegistration();
}

main().catch(console.error);