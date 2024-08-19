const mongoose = require('mongoose');

const secondarySchema = new mongoose.Schema({
  plyrId: { type: String, required: true },
  secondaryAddress: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('Secondary', secondarySchema);