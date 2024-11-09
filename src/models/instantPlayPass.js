const mongoose = require('mongoose');

const instantPlayPassSchema = new mongoose.Schema({
  plyrId: { type: String, required: true },
  gameId: { type: String, required: true },
  primaryAddress: { type: String, required: true },
  mirror: { type: String, required: true },
  keystoreJson: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('InstantPlayPass', instantPlayPassSchema);
