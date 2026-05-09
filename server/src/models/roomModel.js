import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    createdBy: { type: String },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

export const Room = mongoose.model('Room', roomSchema);