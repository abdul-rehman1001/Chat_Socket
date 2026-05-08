import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Fade,
  Grow,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const quickRooms = ['design', 'team', 'general'];

const formatTime = (date) =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

const createMessage = ({ text, sender, room, isMine, senderId }) => ({
  id: crypto.randomUUID(),
  text,
  sender,
  room,
  senderId,
  time: new Date(),
  isMine,
});

const hydrateServerMessage = (message, currentSocketId) => ({
  id: message.id || crypto.randomUUID(),
  text: message.text,
  senderId: message.senderId,
  sender: message.senderId === currentSocketId ? 'You' : (message.senderName || 'Guest'),
  room: message.room,
  time: message.createdAt ? new Date(message.createdAt) : new Date(),
  isMine: message.senderId === currentSocketId,
});

const addUniqueRoom = (rooms, roomName) => {
  if (!roomName) {
    return rooms;
  }

  return rooms.includes(roomName) ? rooms : [...rooms, roomName];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const App = () => {
  const socket = useMemo(() => io(API_URL), []);
  const messagesEndRef = useRef(null);
  const roomRef = useRef('');
  const activeRoomRef = useRef('');
  const currentRoomTargetRef = useRef('');
  const loadedRoomsRef = useRef(new Set());
  const messagesContainerRef = useRef(null);
  const userNameRef = useRef('');
  const joinRoomTimeoutRef = useRef(null);
  const setNameTimeoutRef = useRef(null);
  const [roomCursors, setRoomCursors] = useState({});
  const loadingOlderRef = useRef(new Set());

  const [message, setMessage] = useState('');
  const [room, setRoom] = useState('');
  const [roomMessages, setRoomMessages] = useState({});
  const [roomHistory, setRoomHistory] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [activeRoom, setActiveRoom] = useState('');
  const [connected, setConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState(0);
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('chat:userName') || '';
    } catch {
      return '';
    }
  });
  const [userNameEdit, setUserNameEdit] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [settingDisplayName, setSettingDisplayName] = useState(false);

  // Save userName to localStorage when it changes
  useEffect(() => {
    userNameRef.current = userName;
    if (userName) {
      try {
        localStorage.setItem('chat:userName', userName);
      } catch (err) {
        console.warn('Failed to save userName:', err.message);
      }
    }
  }, [userName]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const joinRoom = (selectedRoom) => {
    const trimmedRoom = selectedRoom.trim();

    if (!trimmedRoom || joiningRoom) {
      return;
    }

    setRoomError('');
    setJoiningRoom(true);

    if (joinRoomTimeoutRef.current) {
      clearTimeout(joinRoomTimeoutRef.current);
    }
    joinRoomTimeoutRef.current = setTimeout(() => {
      setJoiningRoom(false);
      setRoomError('Room join timed out. Please try again.');
    }, 8000);

    currentRoomTargetRef.current = trimmedRoom;
    socket.emit('join_room', trimmedRoom);
  };

  const fetchOlderMessages = async (roomName) => {
    if (!roomName) return;
    const cursor = roomCursors[roomName];
    if (!cursor) return; // no more
    if (loadingOlderRef.current.has(roomName)) return;
    loadingOlderRef.current.add(roomName);

    try {
      const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomName)}/messages?limit=50&cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error(`failed to fetch older messages: ${res.status}`);
      const data = await res.json();
      const hydrated = (data.messages || []).map((m) =>
        hydrateServerMessage({ id: m.id, text: m.text, room: m.room, senderId: m.senderId, senderName: m.senderName, createdAt: m.createdAt }, socket.id)
      );

      setRoomMessages((prev) => {
        const existing = prev[roomName] || [];
        return { ...prev, [roomName]: [...hydrated, ...existing] };
      });
      setRoomCursors((prev) => ({ ...prev, [roomName]: data.nextCursor || null }));
    } catch (err) {
      console.warn('Failed to load older messages for', roomName, err.message);
    } finally {
      loadingOlderRef.current.delete(roomName);
    }
  };

  const useQuickRoom = (presetRoom) => {
    setRoomName(presetRoom);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    const currentRoom = roomRef.current.trim();

    if (!trimmedMessage || !currentRoom) {
      return;
    }

    const outgoingMessage = createMessage({
      text: trimmedMessage,
      sender: userNameRef.current || 'You',
      room: currentRoom,
      isMine: true,
      senderId: socket.id,
    });

    setRoomMessages((prev) => ({
      ...prev,
      [currentRoom]: [...(prev[currentRoom] || []), outgoingMessage],
    }));

    const payload = { message: trimmedMessage, room: currentRoom, senderName: userNameRef.current || `Guest-${Math.random().toString(36).substring(2, 8)}` };
    socket.emit('message', payload);
    setMessage('');
  };

  useEffect(() => {
    // Load persisted rooms list from server
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/rooms`);
        if (!res.ok) throw new Error(`rooms fetch failed: ${res.status}`);
        const rooms = await res.json();
        const names = Array.isArray(rooms) ? rooms.map((r) => r.name) : [];
        setRoomHistory((prev) => {
          const merged = new Set(prev || []);
          names.forEach((n) => merged.add(n));
          return Array.from(merged);
        });
      } catch (err) {
        console.warn('Could not load rooms list:', err.message);
      }
    })();

    const handleConnect = () => {
      setConnected(true);
    };

    const handleScroll = (e) => {
      const el = e.target;
      if (!el) return;
      if (el.scrollTop <= 8) {
        const current = activeRoomRef.current;
        fetchOlderMessages(current);
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      setRoomUsers(0);
      setJoiningRoom(false);
      setSettingDisplayName(false);
    };

    const handleMessage = (data) => {
      const fallbackRoom = activeRoomRef.current || roomRef.current || 'general';
      const payload =
        typeof data === 'string'
          ? { text: data, room: fallbackRoom, senderId: 'guest' }
          : {
              text: data?.text ?? data?.message ?? String(data),
              room: data?.room || fallbackRoom,
              senderId: data?.senderId || 'guest',
              senderName: data?.senderName,
              id: data?.id,
              createdAt: data?.createdAt,
            };

      const incomingMessage = hydrateServerMessage(payload, socket.id);

      setRoomMessages((prev) => ({
        ...prev,
        [incomingMessage.room]: [...(prev[incomingMessage.room] || []), incomingMessage],
      }));
      setRoomHistory((prev) => addUniqueRoom(prev, incomingMessage.room));
    };

    const handleRoomJoined = ({ roomName: joinedRoom }) => {
      if (!joinedRoom) return;
      if (joinRoomTimeoutRef.current) {
        clearTimeout(joinRoomTimeoutRef.current);
        joinRoomTimeoutRef.current = null;
      }
      setJoiningRoom(false);
      setRoomError('');
      setRoom(joinedRoom);
      setActiveRoom(joinedRoom);
      setRoomName('');
      setRoomHistory((prev) => addUniqueRoom(prev, joinedRoom));
      setRoomUsers(0);

      // Fetch persisted messages for the room via API (falls back to socket room_history)
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(joinedRoom)}/messages?limit=50`);
          if (!res.ok) throw new Error(`failed to fetch messages: ${res.status}`);
          const data = await res.json();
          const hydrated = (data.messages || []).map((m) =>
            hydrateServerMessage({ id: m.id, text: m.text, room: m.room, senderId: m.senderId, senderName: m.senderName, createdAt: m.createdAt }, socket.id)
          );
          setRoomMessages((prev) => ({ ...prev, [joinedRoom]: hydrated }));
          loadedRoomsRef.current.add(joinedRoom);
          setRoomCursors((prev) => ({ ...prev, [joinedRoom]: data.nextCursor || null }));
        } catch (err) {
          console.warn('Could not fetch persisted messages for', joinedRoom, err.message);
        }
      })();
    };

    const handleRoomJoinError = ({ message: errMessage }) => {
      if (joinRoomTimeoutRef.current) {
        clearTimeout(joinRoomTimeoutRef.current);
        joinRoomTimeoutRef.current = null;
      }
      setJoiningRoom(false);
      setRoomError(errMessage || 'Could not join this room.');
    };

    const handleRoomHistory = ({ roomName: historyRoom, messages: historyMessages = [] }) => {
      // If we already fetched messages via REST for this room, don't overwrite
      if (loadedRoomsRef.current.has(historyRoom)) return;
      const hydratedMessages = historyMessages.map((item) =>
        hydrateServerMessage(
          {
            id: item.id,
            text: item.text,
            room: item.room || historyRoom,
            senderId: item.senderId,
            senderName: item.senderName,
            createdAt: item.createdAt,
          },
          socket.id
        )
      );

      setRoomMessages((prev) => ({
        ...prev,
        [historyRoom]: hydratedMessages,
      }));
      setRoomHistory((prev) => addUniqueRoom(prev, historyRoom));
    };

    const handleUserNameUpdated = ({ socketId, displayName }) => {
      // Update any messages locally that were sent by this socketId
      setRoomMessages((prev) => {
        const out = {};
        for (const [r, msgs] of Object.entries(prev)) {
          out[r] = msgs.map((m) => (m.senderId === socketId ? { ...m, sender: displayName } : m));
        }
        return out;
      });

      if (socketId === socket.id) {
        if (setNameTimeoutRef.current) {
          clearTimeout(setNameTimeoutRef.current);
          setNameTimeoutRef.current = null;
        }
        setSettingDisplayName(false);
        setUserName(displayName || '');
        setDisplayNameError('');
      }
    };

    const handleDisplayNameSet = ({ displayName }) => {
      if (setNameTimeoutRef.current) {
        clearTimeout(setNameTimeoutRef.current);
        setNameTimeoutRef.current = null;
      }
      setSettingDisplayName(false);
      setUserName(displayName || '');
      setDisplayNameError('');
    };

    const handleDisplayNameError = ({ message: errMessage }) => {
      if (setNameTimeoutRef.current) {
        clearTimeout(setNameTimeoutRef.current);
        setNameTimeoutRef.current = null;
      }
      setSettingDisplayName(false);
      setDisplayNameError(errMessage || 'Could not update display name.');
    };

    const handleRoomUsers = ({ roomName: currentRoomName, count }) => {
      if (currentRoomName === currentRoomTargetRef.current || currentRoomName === activeRoomRef.current) {
        setRoomUsers(count);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receive-message', handleMessage);
    socket.on('room_joined', handleRoomJoined);
    socket.on('room_join_error', handleRoomJoinError);
    socket.on('room_history', handleRoomHistory);
    socket.on('user_name_updated', handleUserNameUpdated);
    socket.on('display_name_set', handleDisplayNameSet);
    socket.on('display_name_error', handleDisplayNameError);
    socket.on('room_users', handleRoomUsers);
    socket.on('welcome', () => setConnected(true));

    const node = messagesContainerRef.current;
    if (node) node.addEventListener('scroll', handleScroll);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receive-message', handleMessage);
      socket.off('room_joined', handleRoomJoined);
      socket.off('room_join_error', handleRoomJoinError);
      socket.off('room_history', handleRoomHistory);
      socket.off('user_name_updated', handleUserNameUpdated);
      socket.off('display_name_set', handleDisplayNameSet);
      socket.off('display_name_error', handleDisplayNameError);
      socket.off('room_users', handleRoomUsers);
      socket.off('welcome');
      if (joinRoomTimeoutRef.current) {
        clearTimeout(joinRoomTimeoutRef.current);
        joinRoomTimeoutRef.current = null;
      }
      if (setNameTimeoutRef.current) {
        clearTimeout(setNameTimeoutRef.current);
        setNameTimeoutRef.current = null;
      }
      socket.disconnect();
      if (node) node.removeEventListener('scroll', handleScroll);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages, activeRoom]);

  const activeMessages = roomMessages[activeRoom] || [];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at top left, rgba(124, 140, 255, 0.28), transparent 30%), radial-gradient(circle at top right, rgba(53, 208, 186, 0.18), transparent 24%), linear-gradient(160deg, #070b16 0%, #0b1020 46%, #101931 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.72), transparent 92%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: 'relative', py: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
            gap: { xs: 2, md: 3 },
            minHeight: { lg: 'calc(100vh - 64px)' },
          }}
        >
          <Fade in timeout={700}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(15, 22, 42, 0.92), rgba(10, 14, 28, 0.86))',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 28px 60px rgba(0, 0, 0, 0.34)',
              }}
            >
              <Stack spacing={3}>
                <Box>
                  <Typography variant="overline" sx={{ letterSpacing: 2, color: 'secondary.main' }}>
                    Chat
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.05, mt: 0.75 }}>
                    Live rooms, built for conversation.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.2 }}>
                    Join a room, stay in sync, and follow the conversation as it updates in real time.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {roomUsers >= 2 && (
                    <Chip
                      label="Connected"
                      color="success"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  <Chip
                    label={`Room ${activeRoom || 'none'}`}
                    variant="outlined"
                    sx={{ borderColor: 'rgba(255,255,255,0.18)' }}
                  />
                </Stack>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, color: 'text.secondary', mb: 1.25 }}>
                    Your name
                  </Typography>
                  <Stack spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={userNameEdit}
                      onChange={(e) => setUserNameEdit(e.target.value)}
                      label="Display name"
                      placeholder="e.g., Ali"
                      InputProps={{
                        sx: {
                          borderRadius: 2,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        if (userNameEdit.trim()) {
                          const newName = userNameEdit.trim();
                          setDisplayNameError('');
                          setUserNameEdit('');
                          try {
                            socket.emit('set_display_name', newName);
                          } catch (err) {
                            console.warn('Could not emit set_display_name:', err.message);
                          }
                        }
                      }}
                      sx={{ borderRadius: 999, fontWeight: 600 }}
                    >
                      Set name
                    </Button>
                    {displayNameError && (
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                        {displayNameError}
                      </Typography>
                    )}
                    {userName && (
                      <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                        ✓ {userName}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                {!connected && (
                  <LinearProgress
                    sx={{ borderRadius: 999, height: 6, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  />
                )}

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                <Box
                  component="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    joinRoom(roomName);
                  }}
                >
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, color: 'text.secondary' }}>
                      Join a room
                    </Typography>
                    <TextField
                      fullWidth
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      label="Room name"
                      placeholder="design-team"
                      InputProps={{
                        sx: {
                          borderRadius: 3,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      size="large"
                      type="submit"
                      sx={{ py: 1.35, borderRadius: 999, fontWeight: 700 }}
                    >
                      Join room
                    </Button>
                    {roomError && (
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                        {roomError}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, color: 'text.secondary', mb: 1.25 }}>
                    Quick rooms
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {quickRooms.map((item) => (
                      <Chip
                        key={item}
                        label={item}
                        onClick={() => useQuickRoom(item)}
                        clickable
                        sx={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '&:hover': { backgroundColor: 'rgba(124,140,255,0.18)' },
                        }}
                      />
                    ))}
                  </Stack>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    Click a room to fill the field, then press Join room to switch.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, color: 'text.secondary', mb: 1.25 }}>
                    Room history
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {roomHistory.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Join or create a room to see it here.
                      </Typography>
                    ) : (
                      roomHistory.map((item) => (
                        <Chip
                          key={item}
                          label={item}
                          onClick={() => joinRoom(item)}
                          clickable
                          color={item === activeRoom ? 'primary' : 'default'}
                          sx={{
                            backgroundColor: item === activeRoom ? 'rgba(124,140,255,0.22)' : 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': { backgroundColor: 'rgba(124,140,255,0.18)' },
                          }}
                        />
                      ))
                    )}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: 'secondary.main', mb: 0.5 }}>
                    Chat tips
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    The room history keeps your created rooms visible, and each room shows only its own messages.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Fade>

          <Grow in timeout={900}>
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: { xs: '70vh', lg: 'calc(100vh - 64px)' },
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(12, 17, 32, 0.92), rgba(8, 12, 22, 0.95))',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 28px 60px rgba(0, 0, 0, 0.34)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  p: { xs: 2, md: 2.5 },
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))',
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {activeRoom ? activeRoom : 'Select a room'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {activeMessages.length} messages in this conversation
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15 }}>Y</Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      You
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Ready to send
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box
                ref={messagesContainerRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  p: { xs: 2, md: 3 },
                  background: 'radial-gradient(circle at top center, rgba(124, 140, 255, 0.08), transparent 36%)',
                }}
              >
                {activeMessages.length === 0 ? (
                  <Box
                    sx={{
                      height: '100%',
                      minHeight: { xs: 360, lg: 520 },
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      px: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        Your conversation starts here
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Join a room on the left and send the first message.
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {activeMessages.map((msg) => (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          justifyContent: msg.isMine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            maxWidth: { xs: '88%', sm: '74%', md: '66%' },
                            p: 1.5,
                            borderRadius: msg.isMine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: msg.isMine
                              ? 'linear-gradient(135deg, rgba(124,140,255,0.96), rgba(53,208,186,0.92))'
                              : 'rgba(255,255,255,0.04)',
                            color: msg.isMine ? '#f8fbff' : 'text.primary',
                            transition: 'transform 180ms ease, box-shadow 180ms ease',
                            animation: 'messagePop 260ms ease both',
                            '@keyframes messagePop': {
                              from: { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
                              to: { opacity: 1, transform: 'translateY(0) scale(1)' },
                            },
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                            <Avatar
                              sx={{
                                width: 24,
                                height: 24,
                                fontSize: 12,
                                bgcolor: msg.isMine ? 'rgba(255,255,255,0.18)' : 'primary.main',
                              }}
                            >
                              {msg.isMine ? 'Y' : 'G'}
                            </Avatar>
                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                              {msg.sender}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              {msg.room}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              {formatTime(msg.time)}
                            </Typography>
                          </Stack>
                          <Typography variant="body1" sx={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                            {msg.text}
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                    <div ref={messagesEndRef} />
                  </Stack>
                )}
              </Box>

              <Box sx={{ p: { xs: 2, md: 2.5 }, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={1.5}>
                    <TextField
                      fullWidth
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      label="Write a message"
                      placeholder={activeRoom ? `Message #${activeRoom}` : 'Join a room first'}
                      disabled={!room}
                      InputProps={{
                        sx: {
                          borderRadius: 3,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        },
                      }}
                    />
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Press Enter or click send to post to the active room.
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        type="submit"
                        disabled={!message.trim() || !room}
                        sx={{
                          px: 3.5,
                          py: 1.25,
                          borderRadius: 999,
                          fontWeight: 800,
                          boxShadow: '0 14px 30px rgba(124, 140, 255, 0.28)',
                        }}
                      >
                        Send message
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Paper>
          </Grow>
        </Box>
      </Container>
    </Box>
  );
};

export default App;
