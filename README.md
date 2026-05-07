# Real-Time Chat Application

A chat application that allows users to communicate in real-time through dedicated chat rooms. Built with the latest web technologies for speed, reliability, and ease of use.


## What is This Project?

This is a web application where:
- Users can create or join chat rooms
- Send and receive messages instantly
- Chat with multiple people in real-time
- Modern, clean, and easy-to-use interface

**Think of it like a digital meeting room where everyone can chat together instantly**

---

## How It Works (Simple Explanation)

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BROWSER                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  • Type your message                             │   │
│  │  • Hit Send                                      │   │
│  │  • See replies instantly                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────┘
                  │ (Instant Connection)
                  ↓
        ┌─────────────────────┐
        │   SERVER COMPUTER   │
        │  (Receives messages)│
        │  (Sends to others)  │
        └─────────────────────┘
                  ↑
                  │
┌─────────────────┴───────────────────────────────────────┐
│                   OTHER USERS                           │
│  • See your message instantly                           │
│  • Can reply to you immediately                         │
└─────────────────────────────────────────────────────────┘
```

---

##  Quick Start

### Step 1: Get the Code
```bash
git clone <your-repository-url>
cd Chat_Socket
```

### Step 2: Install Server (Backend)
```bash
cd server
npm install
```

### Step 3: Install Client (Frontend)
```bash
cd ../client
npm install
```

### Step 4: Start the Server
```bash
cd ../server
# PowerShell (Windows)
Copy-Item .env.example .env
# macOS/Linux
# cp .env.example .env
npm run dev
```
**Server is now running on http://localhost:3000**

Before starting, update `server/.env` with your MongoDB connection string:

```env
MONGO_URI=mongodb://127.0.0.1:27017/realtime_chat_app
PORT=3000
```

### Step 5: Start the Client (Open New Terminal)
```bash
cd client
npm run dev
```
**Open your browser to http://localhost:5173**

### Step 6: Start Chatting
1. Type a room name (e.g., "developers", "friends", "team")
2. Click "Join Room"
3. Type your message
4. Click "Send"
5. All users in that room see your message instantly.

---

## 📁 Project Layout Explained

```
Chat_Socket/
│
├── 📂 server/                    ← Backend 
│   ├── app.js                    ← Main server code
│   ├── package.json              ← Server dependencies list
│   └── node_modules/             ← Downloaded packages
│
├── 📂 client/                    ← Frontend 
│   ├── 📂 src/
│   │   ├── App.jsx               ← Main chat interface
│   │   ├── main.jsx              ← Start point
│   │   └── 📂 assets/            ← Images & files
│   │
│   ├── 📂 public/                ← Public files
│   ├── package.json              ← Client dependencies list
│   ├── vite.config.js            ← Build settings
│   ├── eslint.config.js          ← Code quality rules
│   └── node_modules/             ← Downloaded packages
│
└── README.md                      ← This file!
```


---

## Technology Stack 

### Frontend 
| Technology           | 
|----------------------|
| **React**            |
| **Vite**             | 
| **Socket.IO Client** | 
| **Material-UI**      |

### Backend (The Server)
| Technology     |
|----------------|
| **Express.js** | 
| **Socket.IO**  | 
| **MongoDB + Mongoose**  |
| **Node.js**    |
| **CORS**       | 


---

## 📝 All Commands You Need

### Server Commands

| Command | What it does |
|---------|-------------|
| `npm install` | Downloads all packages needed |
| `npm run dev` | Starts server with auto-refresh |


## 🔧 How the Features Work

### 1️⃣ **Join a Room**
- Type any room name (e.g., "JavaScript", "Cats", "team")
- Click "Join"
- You're now in that room
- **Same room = Same conversation**

### 2️⃣ **Send Messages**
- Type your message in the text box
- Press Enter or click Send
- Your message appears instantly
- Everyone in the room sees it

### 3️⃣ **Real-Time Updates**
- Messages appear immediately (no refresh needed)
- Smooth, seamless experience

---

## Accessing the App

Once everything is running:

| What      |   Address                | 
|-----------|--------------------------|
| Backend   | `http://localhost:3000`  | 
| Frontend  | `http://localhost:5173`  | 




## Common Problems & Solutions

### Problem 1: "Cannot connect to server"
**Why:** Server isn't running
**Solution:** 
```bash
cd server
npm run dev
```

### Problem 2: "CORS error"
**Why:** Frontend and backend aren't talking
**Solution:** Make sure both are running on correct ports (3000 & 5173)

### Problem 3: "Module not found"
**Why:** Dependencies not installed
**Solution:**
```bash
npm install
```

### Problem 4: "Port already in use"
**Why:** Something else is using port 3000 or 5173
**Solution:** Stop other programs or restart your computer

### Problem 5: "Messages not appearing"
**Why:** Not in same room or connection issues
**Solution:** 
- Check both users are in same room
- Refresh browser
- Check browser console for errors





## File Descriptions

### `server/app.js`
The main server file that:
- Creates the web server
- Handles connections
- Routes messages between users

### `client/src/App.jsx`
The main chat interface:
- Text boxes for input
- Displays messages
- Handles user interactions

### `package.json` files
Lists all tools needed:
- `npm install` reads this and downloads everything
