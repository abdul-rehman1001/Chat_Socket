import express from 'express';

export function createApiRouter({ ChatMessage, Room, User }) {
  const router = express.Router();

  router.get('/healthz', async (req, res) => {
    try {
      const state = ChatMessage.db.readyState;
      res.json({ ok: true, mongoState: state });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get('/rooms', async (req, res) => {
    try {
      const rooms = await Room.find().sort({ lastMessageAt: -1 }).lean();
      res.json(rooms.map((room) => ({ name: room.name, messageCount: room.messageCount || 0, lastMessageAt: room.lastMessageAt })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/rooms/:name/messages', express.json(), async (req, res) => {
    const roomName = req.params.name;
    const { text, senderName } = req.body || {};

    if (!text || !roomName) {
      return res.status(400).json({ error: 'text and room required' });
    }

    try {
      const saved = await ChatMessage.create({
        room: roomName,
        text,
        senderId: req.ip || 'api',
        senderName: senderName || undefined,
      });

      await Room.findOneAndUpdate(
        { name: roomName },
        { $inc: { messageCount: 1 }, $set: { lastMessageAt: saved.createdAt } },
        { upsert: true }
      );

      res.json({ ok: true, id: saved._id.toString(), senderName: saved.senderName });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/rooms/:name/messages', async (req, res) => {
    const roomName = req.params.name;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    const cursor = req.query.cursor;

    let before = null;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        if (parsed && parsed.before) {
          before = new Date(parsed.before);
        }
      } catch (error) {
        // ignore invalid cursor
      }
    }

    try {
      const query = { room: roomName };
      if (before && !Number.isNaN(before.getTime())) {
        query.createdAt = { $lt: before };
      }

      const messagesDesc = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit + 1).lean();
      const hasMore = messagesDesc.length > limit;
      if (hasMore) {
        messagesDesc.pop();
      }

      const messagesAsc = messagesDesc.reverse();
      const messages = messagesAsc.map((message) => ({
        id: message._id.toString(),
        room: message.room,
        text: message.text,
        senderId: message.senderId,
        senderName: message.senderName,
        createdAt: message.createdAt,
      }));

      let nextCursor = null;
      if (hasMore && messagesDesc.length > 0) {
        const oldest = messagesDesc[messagesDesc.length - 1];
        if (oldest && oldest.createdAt) {
          nextCursor = Buffer.from(JSON.stringify({ before: oldest.createdAt.toISOString() })).toString('base64');
        }
      }

      res.json({ room: roomName, messages, nextCursor });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/users', async (req, res) => {
    try {
      const users = await User.find().lean();
      res.json(users.map((user) => ({ socketId: user.socketId, connected: user.connected, lastSeen: user.lastSeen, rooms: user.rooms || [] })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/users/:socketId', async (req, res) => {
    try {
      const user = await User.findOne({ socketId: req.params.socketId }).lean();
      if (!user) {
        return res.status(404).json({ error: 'not found' });
      }

      res.json({ socketId: user.socketId, connected: user.connected, lastSeen: user.lastSeen, rooms: user.rooms || [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}