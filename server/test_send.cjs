const { io } = require('socket.io-client');
const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  const socket = io('http://localhost:3000', { transports: ['websocket'], reconnectionAttempts: 3 });

  socket.on('connect', async () => {
    console.log('Connected as', socket.id);
    const room = 'test_autoname_room';
    const testName = 'TesterX';
    socket.emit('join_room', room);

    // wait a bit for join
    setTimeout(async () => {
      socket.emit('message', { message: 'hello from test', room, senderName: testName });
      console.log('sent message with senderName=', testName);

      // wait a bit for server to persist
      setTimeout(async () => {
        try {
          const res = await fetch(`http://localhost:3000/api/rooms/${encodeURIComponent(room)}/messages?limit=5`);
          const data = await res.json();
          console.log('API messages:', JSON.stringify(data, null, 2));
          const last = data.messages && data.messages[data.messages.length-1];
          if (last) {
            console.log('Last message senderName:', last.senderName);
            process.exit(last.senderName === testName ? 0 : 2);
          } else {
            console.error('No messages returned');
            process.exit(3);
          }
        } catch (err) {
          console.error('Fetch failed', err.message);
          process.exit(4);
        }
      }, 800);
    }, 400);
  });

  socket.on('connect_error', (err) => {
    console.error('connect_error', err.message);
    process.exit(5);
  });
})();
