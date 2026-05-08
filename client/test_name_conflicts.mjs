import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3100';

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 8000);
    socket.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(t);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });
}

async function emitAndWait(socket, emitEvent, emitPayload, waitEvent, timeoutMs = 5000) {
  const waitPromise = waitForEvent(socket, waitEvent, timeoutMs);
  socket.emit(emitEvent, emitPayload);
  return waitPromise;
}

function waitForOneOf(socket, events, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const handlers = new Map();
    const t = setTimeout(() => {
      for (const [ev, handler] of handlers.entries()) {
        socket.off(ev, handler);
      }
      reject(new Error(`timeout waiting for one of: ${events.join(', ')}`));
    }, timeoutMs);

    for (const ev of events) {
      const handler = (payload) => {
        clearTimeout(t);
        for (const [otherEv, otherHandler] of handlers.entries()) {
          socket.off(otherEv, otherHandler);
        }
        resolve({ event: ev, payload });
      };
      handlers.set(ev, handler);
      socket.on(ev, handler);
    }
  });
}

async function emitAndWaitOneOf(socket, emitEvent, emitPayload, events, timeoutMs = 5000) {
  const waitPromise = waitForOneOf(socket, events, timeoutMs);
  socket.emit(emitEvent, emitPayload);
  return waitPromise;
}

async function expectNoEvent(socket, event, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const onEvent = (payload) => {
      socket.off(event, onEvent);
      reject(new Error(`unexpected ${event}: ${JSON.stringify(payload)}`));
    };
    socket.on(event, onEvent);

    setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, timeoutMs);
  });
}

async function run() {
  const c1 = io(SERVER_URL, { transports: ['websocket'] });
  const c2 = io(SERVER_URL, { transports: ['websocket'] });
  const c3 = io(SERVER_URL, { transports: ['websocket'] });

  try {
    await Promise.all([waitForConnect(c1), waitForConnect(c2), waitForConnect(c3)]);

    [c1, c2, c3].forEach((c, i) => {
      c.on('room_joined', (p) => console.log(`c${i + 1} room_joined`, p));
      c.on('room_join_error', (p) => console.log(`c${i + 1} room_join_error`, p));
      c.on('display_name_set', (p) => console.log(`c${i + 1} display_name_set`, p));
      c.on('display_name_error', (p) => console.log(`c${i + 1} display_name_error`, p));
      c.on('connect_error', (e) => console.log(`c${i + 1} connect_error`, e.message));
    });

    const c1Join = await emitAndWaitOneOf(c1, 'join_room', 'room-alpha', ['room_joined', 'room_join_error']);
    if (c1Join.event !== 'room_joined') {
      throw new Error(`c1 failed to join room-alpha: ${JSON.stringify(c1Join.payload)}`);
    }
    await emitAndWait(c1, 'set_display_name', 'Ahmed', 'display_name_set');

    const c2Join = await emitAndWaitOneOf(c2, 'join_room', 'room-alpha', ['room_joined', 'room_join_error']);
    if (c2Join.event !== 'room_joined') {
      throw new Error(`c2 failed to join room-alpha: ${JSON.stringify(c2Join.payload)}`);
    }
    const duplicateNameErr = await emitAndWait(c2, 'set_display_name', 'Ahmed', 'display_name_error');

    await emitAndWait(c2, 'set_display_name', 'Bilal', 'display_name_set');
    await expectNoEvent(c2, 'display_name_error', 1200);

    const c3Join = await emitAndWaitOneOf(c3, 'join_room', 'room-beta', ['room_joined', 'room_join_error']);
    if (c3Join.event !== 'room_joined') {
      throw new Error(`c3 failed to join room-beta: ${JSON.stringify(c3Join.payload)}`);
    }
    await emitAndWait(c3, 'set_display_name', 'SameName', 'display_name_set');

    await emitAndWait(c1, 'set_display_name', 'SameName', 'display_name_set');
    const joinConflictErr = await emitAndWait(c1, 'join_room', 'room-beta', 'room_join_error');

    console.log('PASS: duplicate-name rejected in same room');
    console.log('display_name_error:', duplicateNameErr);
    console.log('PASS: room switch rejected when name conflicts in target room');
    console.log('room_join_error:', joinConflictErr);
  } finally {
    c1.disconnect();
    c2.disconnect();
    c3.disconnect();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err.message);
  process.exitCode = 1;
});
