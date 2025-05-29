const mongoose = require('mongoose');

const gameBadgeRuleSchema = new mongoose.Schema({
  gameId: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  attributes: { type: Array, required: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  supplyCount: { type: Number, default: 0 },
  holderCount: { type: Number, default: 0 },
  holders: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
});

gameBadgeRuleSchema.index({ gameId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('GameBadgeRule', gameBadgeRuleSchema);