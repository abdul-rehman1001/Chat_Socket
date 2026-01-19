import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import {
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Paper,
  Box,
  Divider,
  Chip,
} from "@mui/material";

const App = () => {
  const socket = useMemo(() => io("http://localhost:3000"), []);

  const [message, setMessage] = useState("");
  const [room, setRoom] = useState("");
  const [socketId, setSocketId] = useState("");
  const [messages, setMessages] = useState([]);
  const [roomName, setRoomName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    socket.emit("message", { message, room });
    setMessage("");
  };

  const joinRoomHandler = (e) => {
    e.preventDefault();
    if (roomName !== "") {
      socket.emit("join_room", roomName);
      console.log(`Joined room: ${roomName}`);
    }
    setRoomName("");
  };

  useEffect(() => {
    socket.on("connect", () => {
      setSocketId(socket.id);
      console.log("Connected to server", socket.id);

      socket.on("receive-message", (data) => {
        setMessages((prev) => [...prev, data]);
      });

      socket.on("welcome", (message) => {
        console.log(message);
      });

      return () => {
        socket.disconnect();
      };
    });
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={10} sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={600} gutterBottom>
                Real‑Time Chat
              </Typography>
              <Chip
                label={`Socket ID: ${socketId || "Connecting..."}`}
                color="primary"
                variant="outlined"
              />
            </Box>

            <Divider />

            {/* Join Room */}
            <Box component="form" onSubmit={joinRoomHandler}>
              <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
                <TextField
                  fullWidth
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  label="Room Name"
                />
                <Button
                  variant="contained"
                  size="large"
                  type="submit"
                  sx={{ px: 4 }}
                >
                  Join
                </Button>
              </Stack>
            </Box>

            {/* Send Message */}
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  label="Message"
                />
                <TextField
                  fullWidth
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  label="Room"
                />
                <Button
                  variant="contained"
                  size="large"
                  type="submit"
                >
                  Send Message
                </Button>
              </Stack>
            </Box>

            <Divider />

            {/* Messages */}
            <Stack
              spacing={1}
              sx={{
                maxHeight: 250,
                overflowY: "auto",
                backgroundColor: "#f9f9f9",
                p: 2,
                borderRadius: 2,
              }}
            >
              {messages.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center">
                  No messages yet
                </Typography>
              ) : (
                messages.map((msg, index) => (
                  <Paper
                    key={index}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "#e3f2fd",
                    }}
                  >
                    <Typography variant="body1">{msg}</Typography>
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default App;
