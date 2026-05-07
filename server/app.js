import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/realtime_chat_app';

// Fail-fast validations to avoid starting with invalid credentials.
if (!process.env.MONGO_URI) {
  console.warn('No MONGO_URI provided in environment; falling back to local MongoDB. For production, set MONGO_URI in server/.env');
} else if (process.env.MONGO_URI.includes('<') || process.env.MONGO_URI.includes('>') || process.env.MONGO_URI.includes('PASSWORD')) {
  console.error('MONGO_URI appears to contain a placeholder. Replace <db_password> with your actual password in server/.env before starting.');
  process.exit(1);
}

const chatMessageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    text: { type: String, required: true },
    senderId: { type: String, required: true },
  },
  { timestamps: true }
);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// User model to track connected sockets and last seen
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

const User = mongoose.model('User', userSchema);

// Room model to hold basic room metadata and counters
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    createdBy: { type: String },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

const Room = mongoose.model('Room', roomSchema);

const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

await connectToDatabase();

// Create HTTP server (NO `new`)
const server = createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

io.on('connection', async (socket) => {
  console.log('A user connected');
  console.log(`User ID: ${socket.id}`);

  // Persist a User record for this socket connection
  try {
    await User.findOneAndUpdate(
      { socketId: socket.id },
      { $set: { socketId: socket.id, connected: true, lastSeen: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('Failed to upsert user record:', err.message);
  }

  const emitRoomUsers = (roomName) => {
    const roomSize = io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    io.to(roomName).emit('room_users', { roomName, count: roomSize });
  };

  const leaveCurrentRoom = () => {
    const currentRoom = socket.data.currentRoom;

    if (!currentRoom) {
      return;
    }

    socket.leave(currentRoom);
    socket.data.currentRoom = null;
    emitRoomUsers(currentRoom);
  };

  // Helper to record that this socket left a room in the User document
  const removeRoomFromUser = async (roomName) => {
    try {
      await User.findOneAndUpdate(
        { socketId: socket.id },
        { $pull: { rooms: roomName }, $set: { lastSeen: new Date() } }
      );
    } catch (err) {
      console.error('Failed to remove room from user:', err.message);
    }
  };

  socket.on('message', async ({ message, room }) => {
    const trimmedMessage = message?.trim();
    const trimmedRoom = room?.trim();

    if (!trimmedMessage || !trimmedRoom) {
      return;
    }

    try {
      const savedMessage = await ChatMessage.create({
        room: trimmedRoom,
        text: trimmedMessage,
        senderId: socket.id,
      });

      // Update room metadata: increment messageCount and set lastMessageAt
      try {
        await Room.findOneAndUpdate(
          { name: trimmedRoom },
          { $inc: { messageCount: 1 }, $set: { lastMessageAt: savedMessage.createdAt } },
          { upsert: true }
        );
      } catch (err) {
        console.error('Failed to update room metadata:', err.message);
      }

      const messagePayload = {
        id: savedMessage.id,
        room: savedMessage.room,
        text: savedMessage.text,
        senderId: savedMessage.senderId,
        createdAt: savedMessage.createdAt,
      };

      console.log(`Message from ${trimmedRoom}: ${trimmedMessage}`);
      socket.to(trimmedRoom).emit('receive-message', messagePayload);
    } catch (error) {
      console.error('Failed to store message:', error.message);
      socket.emit('message_error', 'Message could not be stored. Try again.');
    }
  });

  socket.on('join_room', async (roomName) => {
    const trimmedRoomName = roomName?.trim();

    if (!trimmedRoomName) {
      return;
    }

    if (socket.data.currentRoom && socket.data.currentRoom !== trimmedRoomName) {
      leaveCurrentRoom();
    }

    socket.join(trimmedRoomName);
    socket.data.currentRoom = trimmedRoomName;
    console.log(`Socket ${socket.id} joined room: ${trimmedRoomName}`);

    // Upsert the Room metadata and add this room to the User record
    try {
      await Room.findOneAndUpdate(
        { name: trimmedRoomName },
        { $setOnInsert: { createdBy: socket.id }, $set: { lastMessageAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.error('Failed to upsert room record:', err.message);
    }

    try {
      await User.findOneAndUpdate(
        { socketId: socket.id },
        { $addToSet: { rooms: trimmedRoomName }, $set: { lastSeen: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.error('Failed to add room to user record:', err.message);
    }

    try {
      const roomHistory = await ChatMessage.find({ room: trimmedRoomName })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      socket.emit('room_history', {
        roomName: trimmedRoomName,
        messages: roomHistory.reverse().map((item) => ({
          id: item._id.toString(),
          room: item.room,
          text: item.text,
          senderId: item.senderId,
          createdAt: item.createdAt,
        })),
      });
    } catch (error) {
      console.error('Failed to load room history:', error.message);
      socket.emit('room_history', { roomName: trimmedRoomName, messages: [] });
    }

    emitRoomUsers(trimmedRoomName);
  });

  socket.on('leave_room', () => {
    const current = socket.data.currentRoom;
    leaveCurrentRoom();
    if (current) removeRoomFromUser(current);
  });

  socket.emit('welcome', `welcome to the server ,${socket.id}`);

  socket.on('disconnect', () => {
    leaveCurrentRoom();
    // mark user disconnected
    User.findOneAndUpdate(
      { socketId: socket.id },
      { $set: { connected: false, lastSeen: new Date() } }
    ).catch(err => console.error('Failed to mark user disconnected:', err.message));

    console.log('User disconnected', socket.id);
  });
  
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
