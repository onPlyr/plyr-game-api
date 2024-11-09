const mongoose = require('mongoose');

const mirrorClaimSchema = new mongoose.Schema({
  plyrId: { type: String, required: true, unique: true },
  gameId: { type: String, required: true },
  primaryAddress: { type: String, required: true },
  mirror: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MirrorClaim', mirrorClaimSchema);
