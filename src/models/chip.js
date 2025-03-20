const mongoose = require('mongoose');

const chipSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  chip: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chip', chipSchema);