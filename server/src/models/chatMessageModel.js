import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    text: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);