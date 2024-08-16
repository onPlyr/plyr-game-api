const mongoose = require('mongoose');
const crypto = require('crypto');
const ApiKey = require('../src/models/apiKey');
const config = require('../src/config');

const MONGODB_URI = config.mongodbUri;

mongoose.connect(MONGODB_URI);

const plyrId = process.argv[2];

if (!plyrId) {
  console.error('Please provide a plyrId as a command line argument');
  process.exit(1);
}

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function generateApiKeys() {
  const apiKeys = [
    { plyrId, apiKey: generateApiKey(), secretKey: generateSecretKey(), role: 'user' },
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