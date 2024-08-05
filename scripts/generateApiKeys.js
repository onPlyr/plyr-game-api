const mongoose = require('mongoose');
const crypto = require('crypto');
const ApiKey = require('../src/models/apiKey');
const config = require('../src/config');

const MONGODB_URI = config.mongodbUri;

mongoose.connect(MONGODB_URI);

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function generateApiKeys() {
  const apiKeys = [
    { plyrId: 'tester', apiKey: generateApiKey(), secretKey: generateSecretKey(), role: 'user' },
    { plyrId: 'tester', apiKey: generateApiKey(), secretKey: generateSecretKey(), role: 'user' },
    { plyrId: 'tester', apiKey: generateApiKey(), secretKey: generateSecretKey(), role: 'admin' }
  ];

  try {
    await ApiKey.insertMany(apiKeys);
    console.log('API keys generated and stored successfully');
    console.log(apiKeys);
  } catch (error) {
    console.error('Error generating API keys:', error);
  } finally {
    mongoose.disconnect();
  }
}

generateApiKeys();