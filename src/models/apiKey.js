const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  plyrId: { type: String, required: true},
  apiKey: { type: String, required: true, unique: true },
  secretKey: { type: String, required: true },
  role: { type: String, enum: ['user', 'game', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiKey', apiKeySchema);