import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';

export default function Room() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const role = state?.role;
  const file = state?.file;

  const [progress, setProgress] = useState({ percent: 0, speed: null });
  const [receivedFile, setReceivedFile] = useState(null);
  const [copied, setCopied] = useState(false);

  const { connectionState, sendFile } = useWebRTC({
    socket,
    roomId,
    role,
    onProgress: (p) => setProgress(p),
    onFileReceived: (f) => setReceivedFile(f),
  });

  // Sender: once connected, start sending the file
  useEffect(() => {
    if (role === 'sender' && connectionState === 'connected' && file) {
      sendFile(file);
    }
  }, [connectionState]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Redirect if no role (direct URL access)
  if (!role) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 gap-8">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          P2P <span className="text-violet-400">Share</span>
        </h1>
        <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">
          {role === 'sender' ? 'Sending' : 'Receiving'}
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6">

        {/* Room ID + status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Room ID</p>
            <p className="text-white font-mono text-lg">{roomId}</p>
          </div>
          <StatusBadge state={connectionState} />
        </div>

        {/* Sender: show invite link */}
        {role === 'sender' && connectionState !== 'done' && (
          <div className="flex flex-col gap-2">
            <p className="text-gray-500 text-xs uppercase tracking-widest">
              Share this link with the receiver
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-gray-300 text-xs font-mono truncate">
                {window.location.href}
              </div>
              <button
                onClick={copyLink}
                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2
                           rounded-lg text-xs font-medium transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* File info */}
        {file && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <p className="text-white text-sm font-medium">{file.name}</p>
              <p className="text-gray-500 text-xs">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        {(connectionState === 'connected' || connectionState === 'done') && (
          <ProgressBar percent={progress.percent} speed={progress.speed} />
        )}

        {/* Waiting for receiver */}
        {role === 'sender' && connectionState === 'idle' && (
          <p className="text-gray-500 text-sm text-center animate-pulse">
            Waiting for receiver to join...
          </p>
        )}

        {/* Receiver waiting */}
        {role === 'receiver' && connectionState === 'idle' && (
          <p className="text-gray-500 text-sm text-center animate-pulse">
            Connecting to sender...
          </p>
        )}

        {/* Done */}
        {connectionState === 'done' && (
          <div className="text-center">
            <p className="text-green-400 text-sm font-medium">
              ✅ Transfer complete!
            </p>
            {receivedFile && (
              <p className="text-gray-500 text-xs mt-1">{receivedFile.name} downloaded</p>
            )}
          </div>
        )}

        {/* Disconnected */}
        {connectionState === 'disconnected' && (
          <div className="text-center">
            <p className="text-red-400 text-sm font-medium">
              ⚠️ Peer disconnected
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 text-violet-400 text-xs hover:underline"
            >
              Start a new transfer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}