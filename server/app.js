import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
// Configurable CORS origin (set CLIENT_ORIGIN in production)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
// Minimal CORS for client requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Simple auth: if API_KEY is set, require it via `x-api-key` header or `api_key` query param
const API_KEY = process.env.API_KEY || '';

function authMiddleware(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  return next();
}

// Simple in-memory rate limiter (per-ip or per-api-key). Safe for development only.
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '120', 10); // requests per window
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '60000', 10); // window in ms
const rateStore = new Map();

function rateLimitMiddleware(req, res, next) {
  const key = API_KEY ? (req.headers['x-api-key'] || req.ip) : req.ip;
  const now = Date.now();
  const entry = rateStore.get(key) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateStore.set(key, entry);
  if (entry.count > RATE_LIMIT) {
    res.set('Retry-After', Math.ceil((entry.start + RATE_WINDOW_MS - now) / 1000));
    return res.status(429).json({ error: 'Too many requests, slow down' });
  }
  next();
}

// Apply auth + rate limit to API routes
app.use('/api', authMiddleware, rateLimitMiddleware);
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
    senderName: { type: String },
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
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Health check for quick monitoring
app.get('/api/healthz', async (req, res) => {
  try {
    const state = mongoose.connection.readyState; // 0 disconnected, 1 connected
    res.json({ ok: true, mongoState: state });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List rooms with metadata
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ lastMessageAt: -1 }).lean();
    res.json(rooms.map(r => ({ name: r.name, messageCount: r.messageCount || 0, lastMessageAt: r.lastMessageAt })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a message to a room (testing helper). Accepts { text, senderName }
app.post('/api/rooms/:name/messages', express.json(), async (req, res) => {
  const roomName = req.params.name;
  const { text, senderName } = req.body || {};
  if (!text || !roomName) return res.status(400).json({ error: 'text and room required' });

  try {
    const saved = await ChatMessage.create({ room: roomName, text, senderId: req.ip || 'api', senderName: senderName || undefined });
    // update room metadata
    await Room.findOneAndUpdate({ name: roomName }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: saved.createdAt } }, { upsert: true });
    res.json({ ok: true, id: saved._id.toString(), senderName: saved.senderName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent messages for a room (optional ?limit= & ?before=ISODate)
app.get('/api/rooms/:name/messages', async (req, res) => {
  const roomName = req.params.name;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const cursor = req.query.cursor;

  // cursor is a base64 JSON payload: { before: ISODateString }
  let before = null;
  if (cursor) {
    try {
      const json = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed && parsed.before) before = new Date(parsed.before);
    } catch (err) {
      // ignore invalid cursor
    }
  }

  try {
    const q = { room: roomName };
    if (before && !isNaN(before.getTime())) q.createdAt = { $lt: before };

    // fetch one extra to detect whether there's more
    const messagesDesc = await ChatMessage.find(q).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const hasMore = messagesDesc.length > limit;
    if (hasMore) messagesDesc.pop(); // keep only 'limit' items

    // messagesDesc is newest -> oldest; reverse to oldest -> newest for client
    const messagesAsc = messagesDesc.reverse();
    const out = messagesAsc.map(m => ({ id: m._id.toString(), room: m.room, text: m.text, senderId: m.senderId, senderName: m.senderName, createdAt: m.createdAt }));

    let nextCursor = null;
    if (hasMore && messagesDesc.length > 0) {
      // oldest of the returned set (after pop) is messagesDesc[messagesDesc.length - 1]
      const oldest = messagesDesc[messagesDesc.length - 1];
      if (oldest && oldest.createdAt) {
        const payload = { before: oldest.createdAt.toISOString() };
        nextCursor = Buffer.from(JSON.stringify(payload)).toString('base64');
      }
    }

    res.json({ room: roomName, messages: out, nextCursor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users.map(u => ({ socketId: u.socketId, connected: u.connected, lastSeen: u.lastSeen, rooms: u.rooms || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single user
app.get('/api/users/:socketId', async (req, res) => {
  try {
    const u = await User.findOne({ socketId: req.params.socketId }).lean();
    if (!u) return res.status(404).json({ error: 'not found' });
    res.json({ socketId: u.socketId, connected: u.connected, lastSeen: u.lastSeen, rooms: u.rooms || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', async (socket) => {

  // Persist a User record for this socket connection without blocking event handler registration.
  User.findOneAndUpdate(
    { socketId: socket.id },
    { $set: { socketId: socket.id, connected: true, lastSeen: new Date() } },
    { upsert: true }
  ).catch((err) => {
    console.error('Failed to upsert user record:', err.message);
  });

  const emitRoomUsers = (roomName) => {
    const roomSize = io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    io.to(roomName).emit('room_users', { roomName, count: roomSize });
  };

  const normalizeDisplayName = (name) => (typeof name === 'string' ? name.trim().toLowerCase() : '');

  const isDisplayNameTakenInRoom = async (roomName, displayName, excludeSocketId) => {
    const normalizedTarget = normalizeDisplayName(displayName);
    if (!roomName || !normalizedTarget) return false;

    const roomSocketIds = Array.from(io.sockets.adapter.rooms.get(roomName) || []);
    if (roomSocketIds.length === 0) return false;

    const roomUsers = await User.find({
      socketId: { $in: roomSocketIds },
      connected: true,
      displayName: { $exists: true, $ne: null },
    })
      .select({ socketId: 1, displayName: 1 })
      .lean();

    return roomUsers.some((u) => u.socketId !== excludeSocketId && normalizeDisplayName(u.displayName) === normalizedTarget);
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

  socket.on('message', async ({ message, room, senderName }) => {
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
        senderName: senderName || undefined,
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
        senderName: savedMessage.senderName,
        createdAt: savedMessage.createdAt,
      };

      socket.to(trimmedRoom).emit('receive-message', messagePayload);
    } catch (error) {
      console.error('Failed to store message:', error.message);
      socket.emit('message_error', 'Message could not be stored. Try again.');
    }
  });

  socket.on('join_room', async (roomName) => {
    const trimmedRoomName = roomName?.trim();

    if (!trimmedRoomName) {
      socket.emit('room_join_error', { roomName: trimmedRoomName, message: 'Room name is required.' });
      return;
    }

    // If user already has a display name, enforce uniqueness within the destination room.
    let currentDisplayName = socket.data.displayName;
    if (!currentDisplayName) {
      try {
        const existingUser = await User.findOne({ socketId: socket.id }).select({ displayName: 1 }).lean();
        currentDisplayName = existingUser?.displayName;
      } catch (err) {
        console.error('Failed to load user displayName before join:', err.message);
      }
    }

    if (currentDisplayName) {
      try {
        const taken = await isDisplayNameTakenInRoom(trimmedRoomName, currentDisplayName, socket.id);
        if (taken) {
          socket.emit('room_join_error', {
            roomName: trimmedRoomName,
            message: 'This name is already taken in that room. Choose another display name.',
          });
          return;
        }
      } catch (err) {
        console.error('Failed room name uniqueness check:', err.message);
        socket.emit('room_join_error', {
          roomName: trimmedRoomName,
          message: 'Could not join room right now. Please try again.',
        });
        return;
      }
    }

    if (socket.data.currentRoom && socket.data.currentRoom !== trimmedRoomName) {
      leaveCurrentRoom();
    }

    socket.join(trimmedRoomName);
    socket.data.currentRoom = trimmedRoomName;
    socket.emit('room_joined', { roomName: trimmedRoomName });

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
          senderName: item.senderName,
          createdAt: item.createdAt,
        })),
      });
    } catch (error) {
      console.error('Failed to load room history:', error.message);
      socket.emit('room_history', { roomName: trimmedRoomName, messages: [] });
    }

    emitRoomUsers(trimmedRoomName);
  });

  socket.on('set_display_name', async (displayName) => {
    const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined;
    try {
      if (!name) {
        socket.emit('display_name_error', { message: 'Display name cannot be empty.' });
        return;
      }

      const currentRoom = socket.data.currentRoom;
      if (currentRoom) {
        const taken = await isDisplayNameTakenInRoom(currentRoom, name, socket.id);
        if (taken) {
          socket.emit('display_name_error', {
            message: 'This name is already taken in this room. Please choose another one.',
            roomName: currentRoom,
          });
          return;
        }
      }

      socket.data.displayName = name;
      await User.findOneAndUpdate({ socketId: socket.id }, { $set: { displayName: name, lastSeen: new Date() } }, { upsert: true });

      // update past messages so other clients see the new display name
      try {
        await ChatMessage.updateMany({ senderId: socket.id }, { $set: { senderName: name } });
      } catch (err) {
        console.error('Failed to update past messages with new display name:', err.message);
      }

      io.emit('user_name_updated', { socketId: socket.id, displayName: name });
      socket.emit('display_name_set', { displayName: name });
    } catch (err) {
      console.error('Failed to set display name for user:', err.message);
      socket.emit('display_name_error', { message: 'Failed to set display name. Please try again.' });
    }
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
  });
  
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
