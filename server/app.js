import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const PORT = process.env.PORT || 3000;

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

  socket.on('message', ({message,room}) => {
    console.log(`Message from ${room}: ${message}`);
    socket.to(room).emit('receive-message', message); // Broadcast the message to all connected clients
  }

  );

  socket.on('join_room', (roomName) => {
    if (socket.data.currentRoom && socket.data.currentRoom !== roomName) {
      leaveCurrentRoom();
    }

    socket.join(roomName);
    socket.data.currentRoom = roomName;
    console.log(`Socket ${socket.id} joined room: ${roomName}`);
    emitRoomUsers(roomName);
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
