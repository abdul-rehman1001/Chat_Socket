import { Box, Button, Chip, Divider, Fade, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';

export function ChatSidebar({
  activeRoom,
  connected,
  displayNameError,
  joiningRoom,
  onJoinRoom,
  onQuickRoom,
  onSetDisplayName,
  roomError,
  roomHistory,
  roomName,
  roomUsers,
  settingDisplayName,
  setRoomName,
  setUserNameEdit,
  userName,
  userNameEdit,
  quickRooms,
}) {
  return (
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
            {roomUsers >= 2 && <Chip label="Connected" color="success" sx={{ fontWeight: 600 }} />}
            <Chip label={`Room ${activeRoom || 'none'}`} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
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
                onChange={(event) => setUserNameEdit(event.target.value)}
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
                onClick={onSetDisplayName}
                disabled={!userNameEdit.trim() || settingDisplayName}
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

          {!connected && <LinearProgress sx={{ borderRadius: 999, height: 6, backgroundColor: 'rgba(255,255,255,0.08)' }} />}

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          <Box component="form" onSubmit={(event) => { event.preventDefault(); onJoinRoom(roomName); }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, color: 'text.secondary' }}>
                Join a room
              </Typography>
              <TextField
                fullWidth
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                label="Room name"
                placeholder="design-team"
                InputProps={{
                  sx: {
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  },
                }}
              />
              <Button variant="contained" size="large" type="submit" disabled={joiningRoom} sx={{ py: 1.35, borderRadius: 999, fontWeight: 700 }}>
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
                  onClick={() => onQuickRoom(item)}
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
                    onClick={() => onJoinRoom(item)}
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
  );
}