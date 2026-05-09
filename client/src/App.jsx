import { Box, Container } from '@mui/material';

import { ChatConversation } from './components/chat/ChatConversation.jsx';
import { ChatSidebar } from './components/chat/ChatSidebar.jsx';
import { quickRooms } from './constants/chatRooms.js';
import { useChatRoomClient } from './hooks/useChatRoomClient.js';

const App = () => {
  const {
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
  } = useChatRoomClient();

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
          <ChatSidebar
            activeRoom={activeRoom}
            connected={connected}
            displayNameError={displayNameError}
            joiningRoom={joiningRoom}
            onJoinRoom={joinRoom}
            onQuickRoom={useQuickRoom}
            onSetDisplayName={submitDisplayName}
            roomError={roomError}
            roomHistory={roomHistory}
            roomName={roomName}
            roomUsers={roomUsers}
            settingDisplayName={settingDisplayName}
            setRoomName={setRoomName}
            setUserNameEdit={setUserNameEdit}
            userName={userName}
            userNameEdit={userNameEdit}
            quickRooms={quickRooms}
          />

          <ChatConversation
            activeRoom={activeRoom}
            activeMessages={activeMessages}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            message={message}
            setMessage={setMessage}
            room={room}
            onSubmit={handleSubmit}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default App;
