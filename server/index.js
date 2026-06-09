const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Signaling server is running ✅'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// { roomId: { sender: socketId, receiver: socketId | null } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('Peer connected:', socket.id);

  socket.on('create-room', (callback) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    rooms[roomId] = { sender: socket.id, receiver: null };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'sender';
    console.log(`Room created: ${roomId}`);
    callback({ roomId });
  });

  socket.on('join-room', (roomId, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ error: 'Room not found' });
    if (room.receiver) return callback({ error: 'Room is full' });

    room.receiver = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'receiver';

    socket.to(room.sender).emit('receiver-joined');
    console.log(`Receiver joined room ${roomId}`);
    callback({ ok: true });
  });

  socket.on('offer', (offer) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    socket.to(room.receiver).emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    socket.to(room.sender).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    const targetId = socket.data.role === 'sender' ? room.receiver : room.sender;
    if (targetId) socket.to(targetId).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    const { roomId, role } = socket.data;
    if (!roomId || !rooms[roomId]) return;
    console.log(`${role} disconnected from room ${roomId}`);
    socket.to(roomId).emit('peer-disconnected', { role });
    delete rooms[roomId];
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));