const mongoose = require('mongoose');

const chipSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  chip: { type: String, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

chipSchema.index({ gameId: 1, chip: 1 }, { unique: true });

module.exports = mongoose.model('Chip', chipSchema);