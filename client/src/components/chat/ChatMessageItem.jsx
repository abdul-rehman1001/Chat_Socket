import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';

import { formatTime } from '../../utils/chatMessageUtils.js';

export function ChatMessageItem({ message }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: message.isMine ? 'flex-end' : 'flex-start',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: { xs: '88%', sm: '74%', md: '66%' },
          p: 1.5,
          borderRadius: message.isMine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: message.isMine
            ? 'linear-gradient(135deg, rgba(124,140,255,0.96), rgba(53,208,186,0.92))'
            : 'rgba(255,255,255,0.04)',
          color: message.isMine ? '#f8fbff' : 'text.primary',
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
              bgcolor: message.isMine ? 'rgba(255,255,255,0.18)' : 'primary.main',
            }}
          >
            {message.isMine ? 'Y' : 'G'}
          </Avatar>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
            {message.sender}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {message.room}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {formatTime(message.time)}
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {message.text}
        </Typography>
      </Paper>
    </Box>
  );
}