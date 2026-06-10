import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import DropZone from '../components/DropZone';

export default function Home() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState('');

  // Sender: drop a file → create room → go to room page
  const handleFileDrop = (file) => {
  console.log("File dropped:", file);

  if (!socket) {
    console.log("Socket is null");
    return;
  }

  console.log("Emitting create-room");

  socket.emit('create-room', ({ roomId }) => {
    console.log("Room created response:", roomId);

    navigate(`/room/${roomId}`, {
      state: { role: 'sender', file }
    });
  });
};

  // Receiver: enter room ID → join room → go to room page
  const handleJoinRoom = () => {
    if (!roomInput.trim()) return;
    navigate(`/room/${roomInput.trim()}`, { state: { role: 'receiver' } });
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 gap-12">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          P2P <span className="text-violet-400">Share</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Direct browser-to-browser file transfer. No server ever sees your file.
        </p>
      </div>

      {/* Sender section */}
      <div className="w-full max-w-md flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest text-gray-500">
          Send a file
        </p>
        <DropZone onFileDrop={handleFileDrop} />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 w-full max-w-md">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-gray-600 text-xs uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Receiver section */}
      <div className="w-full max-w-md flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest text-gray-500">
          Receive a file
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomInput}
            onChange={(e) => { setRoomInput(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3
                       text-white placeholder-gray-600 text-sm
                       focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={handleJoinRoom}
            className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-3
                       rounded-lg text-sm font-medium transition-colors"
          >
            Join
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
      </div>

    </div>
  );
}