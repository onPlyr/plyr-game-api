const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
  plyrId: { type: String, required: true, unique: true },
  primaryAddress: { type: String, required: true },
  mirror: { type: String, required: true },
  secret: { type: String, required: true },
  chainId: { type: Number, required: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  nonce: { type: Object, default: {} },
  loginFailedCount: { type: Number, default: 0 },
  bannedAt: { type: Number, default: 0},
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserInfo', userInfoSchema);