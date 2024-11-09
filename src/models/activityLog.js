const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  plyrId: { type: String, required: false },
  gameId: { type: String, required: false },
  type: { type: String, required: false },
  action: { type: String, required: false },
  data: { type: Object, required: false },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
