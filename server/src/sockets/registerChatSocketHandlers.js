export function registerChatSocketHandlers(io, socket, { ChatMessage, Room, User }) {
  User.findOneAndUpdate(
    { socketId: socket.id },
    { $set: { socketId: socket.id, connected: true, lastSeen: new Date() } },
    { upsert: true }
  ).catch((error) => {
    console.error('Failed to upsert user record:', error.message);
  });

  const emitRoomUsers = (roomName) => {
    const roomSize = io.sockets.adapter.rooms.get(roomName)?.size ?? 0;
    io.to(roomName).emit('room_users', { roomName, count: roomSize });
  };

  const normalizeDisplayName = (name) => (typeof name === 'string' ? name.trim().toLowerCase() : '');

  const isDisplayNameTakenInRoom = async (roomName, displayName, excludeSocketId) => {
    const normalizedTarget = normalizeDisplayName(displayName);
    if (!roomName || !normalizedTarget) {
      return false;
    }

    const roomSocketIds = Array.from(io.sockets.adapter.rooms.get(roomName) || []);
    if (roomSocketIds.length === 0) {
      return false;
    }

    const roomUsers = await User.find({
      socketId: { $in: roomSocketIds },
      connected: true,
      displayName: { $exists: true, $ne: null },
    })
      .select({ socketId: 1, displayName: 1 })
      .lean();

    return roomUsers.some((user) => user.socketId !== excludeSocketId && normalizeDisplayName(user.displayName) === normalizedTarget);
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

  const removeRoomFromUser = async (roomName) => {
    try {
      await User.findOneAndUpdate(
        { socketId: socket.id },
        { $pull: { rooms: roomName }, $set: { lastSeen: new Date() } }
      );
    } catch (error) {
      console.error('Failed to remove room from user:', error.message);
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

      try {
        await Room.findOneAndUpdate(
          { name: trimmedRoom },
          { $inc: { messageCount: 1 }, $set: { lastMessageAt: savedMessage.createdAt } },
          { upsert: true }
        );
      } catch (error) {
        console.error('Failed to update room metadata:', error.message);
      }

      socket.to(trimmedRoom).emit('receive-message', {
        id: savedMessage.id,
        room: savedMessage.room,
        text: savedMessage.text,
        senderId: savedMessage.senderId,
        senderName: savedMessage.senderName,
        createdAt: savedMessage.createdAt,
      });
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

    let currentDisplayName = socket.data.displayName;
    if (!currentDisplayName) {
      try {
        const existingUser = await User.findOne({ socketId: socket.id }).select({ displayName: 1 }).lean();
        currentDisplayName = existingUser?.displayName;
      } catch (error) {
        console.error('Failed to load user displayName before join:', error.message);
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
      } catch (error) {
        console.error('Failed room name uniqueness check:', error.message);
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

    try {
      await Room.findOneAndUpdate(
        { name: trimmedRoomName },
        { $setOnInsert: { createdBy: socket.id }, $set: { lastMessageAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to upsert room record:', error.message);
    }

    try {
      await User.findOneAndUpdate(
        { socketId: socket.id },
        { $addToSet: { rooms: trimmedRoomName }, $set: { lastSeen: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to add room to user record:', error.message);
    }

    try {
      const roomHistory = await ChatMessage.find({ room: trimmedRoomName }).sort({ createdAt: -1 }).limit(200).lean();

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

      try {
        await ChatMessage.updateMany({ senderId: socket.id }, { $set: { senderName: name } });
      } catch (error) {
        console.error('Failed to update past messages with new display name:', error.message);
      }

      io.emit('user_name_updated', { socketId: socket.id, displayName: name });
      socket.emit('display_name_set', { displayName: name });
    } catch (error) {
      console.error('Failed to set display name for user:', error.message);
      socket.emit('display_name_error', { message: 'Failed to set display name. Please try again.' });
    }
  });

  socket.on('leave_room', () => {
    const current = socket.data.currentRoom;
    leaveCurrentRoom();

    if (current) {
      removeRoomFromUser(current);
    }
  });

  socket.emit('welcome', `welcome to the server ,${socket.id}`);

  socket.on('disconnect', () => {
    leaveCurrentRoom();

    User.findOneAndUpdate(
      { socketId: socket.id },
      { $set: { connected: false, lastSeen: new Date() } }
    ).catch((error) => console.error('Failed to mark user disconnected:', error.message));
  });
}