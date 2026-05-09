import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { addUniqueRoom, createMessage, hydrateServerMessage } from '../utils/chatMessageUtils.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useChatRoomClient() {
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
  const loadingOlderRef = useRef(new Set());

  const [roomCursors, setRoomCursors] = useState({});
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

  useEffect(() => {
    userNameRef.current = userName;
    if (userName) {
      try {
        localStorage.setItem('chat:userName', userName);
      } catch (error) {
        console.warn('Failed to save userName:', error.message);
      }
    }
  }, [userName]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const fetchOlderMessages = async (roomToLoad) => {
    if (!roomToLoad) return;
    const cursor = roomCursors[roomToLoad];
    if (!cursor) return;
    if (loadingOlderRef.current.has(roomToLoad)) return;
    loadingOlderRef.current.add(roomToLoad);

    try {
      const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomToLoad)}/messages?limit=50&cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error(`failed to fetch older messages: ${response.status}`);
      const data = await response.json();
      const hydrated = (data.messages || []).map((item) =>
        hydrateServerMessage(
          {
            id: item.id,
            text: item.text,
            room: item.room,
            senderId: item.senderId,
            senderName: item.senderName,
            createdAt: item.createdAt,
          },
          socket.id
        )
      );

      setRoomMessages((previous) => {
        const existing = previous[roomToLoad] || [];
        return { ...previous, [roomToLoad]: [...hydrated, ...existing] };
      });
      setRoomCursors((previous) => ({ ...previous, [roomToLoad]: data.nextCursor || null }));
    } catch (error) {
      console.warn('Failed to load older messages for', roomToLoad, error.message);
    } finally {
      loadingOlderRef.current.delete(roomToLoad);
    }
  };

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

  const submitDisplayName = () => {
    const newName = userNameEdit.trim();

    if (!newName || settingDisplayName) {
      return;
    }

    setDisplayNameError('');
    setSettingDisplayName(true);

    if (setNameTimeoutRef.current) {
      clearTimeout(setNameTimeoutRef.current);
    }
    setNameTimeoutRef.current = setTimeout(() => {
      setSettingDisplayName(false);
      setDisplayNameError('Display name update timed out. Please try again.');
    }, 8000);

    setUserNameEdit('');

    try {
      socket.emit('set_display_name', newName);
    } catch (error) {
      console.warn('Could not emit set_display_name:', error.message);
    }
  };

  const useQuickRoom = (presetRoom) => {
    setRoomName(presetRoom);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

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

    setRoomMessages((previous) => ({
      ...previous,
      [currentRoom]: [...(previous[currentRoom] || []), outgoingMessage],
    }));

    const payload = {
      message: trimmedMessage,
      room: currentRoom,
      senderName: userNameRef.current || `Guest-${Math.random().toString(36).substring(2, 8)}`,
    };

    socket.emit('message', payload);
    setMessage('');
  };

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/rooms`);
        if (!response.ok) throw new Error(`rooms fetch failed: ${response.status}`);
        const rooms = await response.json();
        const names = Array.isArray(rooms) ? rooms.map((roomItem) => roomItem.name) : [];
        setRoomHistory((previous) => {
          const merged = new Set(previous || []);
          names.forEach((name) => merged.add(name));
          return Array.from(merged);
        });
      } catch (error) {
        console.warn('Could not load rooms list:', error.message);
      }
    })();

    const handleConnect = () => {
      setConnected(true);
    };

    const handleScroll = (event) => {
      const element = event.target;
      if (!element) return;
      if (element.scrollTop <= 8) {
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

      setRoomMessages((previous) => ({
        ...previous,
        [incomingMessage.room]: [...(previous[incomingMessage.room] || []), incomingMessage],
      }));
      setRoomHistory((previous) => addUniqueRoom(previous, incomingMessage.room));
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
      setRoomHistory((previous) => addUniqueRoom(previous, joinedRoom));
      setRoomUsers(0);

      (async () => {
        try {
          const response = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(joinedRoom)}/messages?limit=50`);
          if (!response.ok) throw new Error(`failed to fetch messages: ${response.status}`);
          const data = await response.json();
          const hydrated = (data.messages || []).map((item) =>
            hydrateServerMessage(
              {
                id: item.id,
                text: item.text,
                room: item.room,
                senderId: item.senderId,
                senderName: item.senderName,
                createdAt: item.createdAt,
              },
              socket.id
            )
          );
          setRoomMessages((previous) => ({ ...previous, [joinedRoom]: hydrated }));
          loadedRoomsRef.current.add(joinedRoom);
          setRoomCursors((previous) => ({ ...previous, [joinedRoom]: data.nextCursor || null }));
        } catch (error) {
          console.warn('Could not fetch persisted messages for', joinedRoom, error.message);
        }
      })();
    };

    const handleRoomJoinError = ({ message: errorMessage }) => {
      if (joinRoomTimeoutRef.current) {
        clearTimeout(joinRoomTimeoutRef.current);
        joinRoomTimeoutRef.current = null;
      }
      setJoiningRoom(false);
      setRoomError(errorMessage || 'Could not join this room.');
    };

    const handleRoomHistory = ({ roomName: historyRoom, messages: historyMessages = [] }) => {
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

      setRoomMessages((previous) => ({
        ...previous,
        [historyRoom]: hydratedMessages,
      }));
      setRoomHistory((previous) => addUniqueRoom(previous, historyRoom));
    };

    const handleUserNameUpdated = ({ socketId, displayName }) => {
      setRoomMessages((previous) => {
        const next = {};
        for (const [roomKey, messages] of Object.entries(previous)) {
          next[roomKey] = messages.map((item) => (item.senderId === socketId ? { ...item, sender: displayName } : item));
        }
        return next;
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

    const handleDisplayNameError = ({ message: errorMessage }) => {
      if (setNameTimeoutRef.current) {
        clearTimeout(setNameTimeoutRef.current);
        setNameTimeoutRef.current = null;
      }
      setSettingDisplayName(false);
      setDisplayNameError(errorMessage || 'Could not update display name.');
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

  return {
    messagesEndRef,
    messagesContainerRef,
    message,
    setMessage,
    room,
    roomName,
    setRoomName,
    roomHistory,
    activeRoom,
    connected,
    roomUsers,
    userName,
    userNameEdit,
    setUserNameEdit,
    displayNameError,
    roomError,
    joiningRoom,
    settingDisplayName,
    activeMessages,
    joinRoom,
    useQuickRoom,
    handleSubmit,
    submitDisplayName,
  };
}