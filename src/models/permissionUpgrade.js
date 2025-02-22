const mongoose = require('mongoose');

const permissionUpgradeSchema = new mongoose.Schema({
  plyrId: { type: String, required: true, unique: true },
  information: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  approvedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
});

module.exports = mongoose.model('PermissionUpgrade', permissionUpgradeSchema);