const mongoose = require('mongoose');

const userApproveSchema = new mongoose.Schema({
  plyrId: { type: String, required: true },
  gameId: { type: String, required: true },
  token: { type: String, required: true },
  amount: { type: Number, required: true },
  expiresIn: { type: Number, default: 365*86400 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserApprove', userApproveSchema);