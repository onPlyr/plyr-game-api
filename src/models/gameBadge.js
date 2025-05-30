const mongoose = require('mongoose');

const gameBadgeSchema = new mongoose.Schema({
  gameId: { type: String, required: true, lowercase: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  tokenId: { type: String, required: true },
  plyrId: { type: String, required: true },
  owner: { type: String, required: true },
  metaJson: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

gameBadgeSchema.index({ gameId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('GameBadge', gameBadgeSchema);