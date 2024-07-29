const mongoose = require('mongoose');
const config = require('../config');

async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Could not connect to MongoDB', err);
    process.exit(1);
  }
}

async function closeDB() {
  try {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Error disconnecting from MongoDB', err);
  }
}

module.exports = { connectDB, closeDB };