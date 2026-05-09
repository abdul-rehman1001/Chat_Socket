import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    socketId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },
    connected: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },
    rooms: [{ type: String }],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);