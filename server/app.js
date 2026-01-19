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

  socket.on('message', ({message,room}) => {
    console.log(`Message from ${room}: ${message}`);
    socket.to(room).emit('receive-message', message); // Broadcast the message to all connected clients
  }

  );

  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room: ${roomName}`);
  } 
  );

  socket.emit('welcome', `welcome to the server ,${socket.id}`);

  socket.on('disconnect', () => {
    console.log('User disconnected',socket.id);
  });
  
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
