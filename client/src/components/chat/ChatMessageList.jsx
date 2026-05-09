import { Box, Stack, Typography } from '@mui/material';

import { ChatMessageItem } from './ChatMessageItem.jsx';

export function ChatMessageList({ activeMessages, messagesEndRef, messagesContainerRef }) {
  return (
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
          {activeMessages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </Stack>
      )}
    </Box>
  );
}