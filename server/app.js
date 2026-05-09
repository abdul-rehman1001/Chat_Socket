import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { serverEnvironment, validateMongoUri } from './src/config/serverEnvironment.js';
import { connectToMongo } from './src/db/connectToMongo.js';
import { ChatMessage } from './src/models/chatMessageModel.js';
import { Room } from './src/models/roomModel.js';
import { User } from './src/models/userModel.js';
import { createApiRouter } from './src/routes/createApiRouter.js';
import { createCorsHeadersMiddleware } from './src/middleware/createCorsHeadersMiddleware.js';
import { createApiKeyMiddleware } from './src/middleware/createApiKeyMiddleware.js';
import { createRateLimitMiddleware } from './src/middleware/createRateLimitMiddleware.js';
import { registerChatSocketHandlers } from './src/sockets/registerChatSocketHandlers.js';

validateMongoUri(process.env.MONGO_URI);

await connectToMongo(serverEnvironment.mongoUri);

const app = express();
app.use(createCorsHeadersMiddleware(serverEnvironment.clientOrigin));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(
  '/api',
  createApiKeyMiddleware(serverEnvironment.apiKey),
  createRateLimitMiddleware({
    apiKeyEnabled: Boolean(serverEnvironment.apiKey),
    rateLimit: serverEnvironment.rateLimit,
    rateWindowMs: serverEnvironment.rateWindowMs,
  }),
  createApiRouter({ ChatMessage, Room, User })
);

const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: serverEnvironment.clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  registerChatSocketHandlers(io, socket, { ChatMessage, Room, User });
});

server.listen(serverEnvironment.port, () => {
  console.log(`Server is running on port ${serverEnvironment.port}`);
});
