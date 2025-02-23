const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  data: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auth', authSchema);