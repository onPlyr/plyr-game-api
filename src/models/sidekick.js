const mongoose = require('mongoose');

const sidekickSchema = new mongoose.Schema({
  random: { type: String, required: true, unique: true },
  jwt: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sidekick', sidekickSchema);