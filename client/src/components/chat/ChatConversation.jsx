import { Avatar, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';

import { ChatMessageList } from './ChatMessageList.jsx';

export function ChatConversation({
  activeRoom,
  activeMessages,
  messagesContainerRef,
  messagesEndRef,
  message,
  setMessage,
  room,
  onSubmit,
}) {
  return (
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

      <ChatMessageList activeMessages={activeMessages} messagesContainerRef={messagesContainerRef} messagesEndRef={messagesEndRef} />

      <Box sx={{ p: { xs: 2, md: 2.5 }, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={1.5}>
            <TextField
              fullWidth
              value={message}
              onChange={(event) => setMessage(event.target.value)}
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
  );
}