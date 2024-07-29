const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  apiKey: { type: String, required: true, unique: true },
  secretKey: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiKey', apiKeySchema);