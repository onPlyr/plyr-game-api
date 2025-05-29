const mongoose = require('mongoose');

const gameBadgeCollectionSchema = new mongoose.Schema({
  gameId: { type: String, required: true, lowercase: true, trim: true },
  badgeCollection: { type: String, required: true },
  name: { type: String, required: true, uppercase: true, trim: true },
  symbol: { type: String, required: true, uppercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

gameBadgeCollectionSchema.index({ gameId: 1, badgeCollection: 1 }, { unique: true });

module.exports = mongoose.model('GameBadgeCollection', gameBadgeCollectionSchema);