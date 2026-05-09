export const formatTime = (date) =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

export const createMessage = ({ text, sender, room, isMine, senderId }) => ({
  id: crypto.randomUUID(),
  text,
  sender,
  room,
  senderId,
  time: new Date(),
  isMine,
});

export const hydrateServerMessage = (message, currentSocketId) => ({
  id: message.id || crypto.randomUUID(),
  text: message.text,
  senderId: message.senderId,
  sender: message.senderId === currentSocketId ? 'You' : (message.senderName || 'Guest'),
  room: message.room,
  time: message.createdAt ? new Date(message.createdAt) : new Date(),
  isMine: message.senderId === currentSocketId,
});

export const addUniqueRoom = (rooms, roomName) => {
  if (!roomName) {
    return rooms;
  }

  return rooms.includes(roomName) ? rooms : [...rooms, roomName];
};