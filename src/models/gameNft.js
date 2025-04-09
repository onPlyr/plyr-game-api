const mongoose = require('mongoose');

const gameNftSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  nft: { type: String, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  image: { type: String, required: false },
  chain: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

gameNftSchema.index({ gameId: 1, nft: 1 }, { unique: true });

module.exports = mongoose.model('GameNft', gameNftSchema);