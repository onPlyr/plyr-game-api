const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  mirror: { type: String, required: true },
  secret: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserInfo', userInfoSchema);