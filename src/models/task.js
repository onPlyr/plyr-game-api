const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  taskData: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], required: true },
  errorMessage: { type: String },
  completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);