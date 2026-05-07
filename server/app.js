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

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log(`User ID: ${socket.id}`);

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
    leaveCurrentRoom();
  });

  socket.emit('welcome', `welcome to the server ,${socket.id}`);

  socket.on('disconnect', () => {
    leaveCurrentRoom();
    console.log('User disconnected',socket.id);
  });
  
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
