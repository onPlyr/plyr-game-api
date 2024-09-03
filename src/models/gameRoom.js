const mongoose = require('mongoose');

const gameRoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  gameId: { type: String, required: true },
  roomAddress: { type: String, required: true },
  expiresIn: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['created', 'ended'], default: 'created' },
});

module.exports = mongoose.model('GameRoom', gameRoomSchema);