const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // tighten this in production
    methods: ['GET', 'POST']
  }
});

// In-memory room registry
// { roomId: { sender: socketId, receiver: socketId | null } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('Peer connected:', socket.id);

  // ── SENDER: creates a room ──────────────────────────────
  socket.on('create-room', (callback) => {
    const roomId = crypto.randomBytes(4).toString('hex'); // e.g. "a3f9c021"
    rooms[roomId] = { sender: socket.id, receiver: null };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'sender';
    console.log(`Room created: ${roomId} by ${socket.id}`);
    callback({ roomId });
  });

  // ── RECEIVER: joins a room ──────────────────────────────
  socket.on('join-room', (roomId, callback) => {
    const room = rooms[roomId];

    if (!room) {
      return callback({ error: 'Room not found' });
    }
    if (room.receiver) {
      return callback({ error: 'Room is full' });
    }

    room.receiver = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'receiver';

    // Tell the sender a receiver has arrived — sender initiates the offer
    socket.to(room.sender).emit('receiver-joined');
    console.log(`Receiver ${socket.id} joined room ${roomId}`);
    callback({ ok: true });
  });

  // ── WebRTC Signaling: forward offer ────────────────────
  socket.on('offer', (offer) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    // Sender → Receiver
    socket.to(room.receiver).emit('offer', offer);
  });

  // ── WebRTC Signaling: forward answer ───────────────────
  socket.on('answer', (answer) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    // Receiver → Sender
    socket.to(room.sender).emit('answer', answer);
  });

  // ── WebRTC Signaling: forward ICE candidates ───────────
  socket.on('ice-candidate', (candidate) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    const targetId =
      socket.data.role === 'sender' ? room.receiver : room.sender;
    if (targetId) {
      socket.to(targetId).emit('ice-candidate', candidate);
    }
  });

  // ── Cleanup on disconnect ───────────────────────────────
  socket.on('disconnect', () => {
    const { roomId, role } = socket.data;
    if (!roomId || !rooms[roomId]) return;

    console.log(`${role} disconnected from room ${roomId}`);

    // Notify the other peer
    socket.to(roomId).emit('peer-disconnected', { role });

    // Clean up the room
    delete rooms[roomId];
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});