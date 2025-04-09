const mongoose = require('mongoose');

const gameCreditSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  credit: { type: Number, required: true, default: 10000 },
});

gameCreditSchema.index({ gameId: 1 }, { unique: true });

module.exports = mongoose.model('GameCredit', gameCreditSchema);