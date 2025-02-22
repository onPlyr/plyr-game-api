const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);