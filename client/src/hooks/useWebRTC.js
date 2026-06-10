import { useEffect, useRef, useState, useCallback } from 'react';
import { RTC_CONFIG } from '../config';

const CHUNK_SIZE = 64 * 1024;
const BUFFER_THRESHOLD = 1024 * 1024;

export function useWebRTC({ socket, roomId, role, onFileReceived, onProgress }) {
  const peerRef = useRef(null);
  const channelRef = useRef(null);
  const hasHandledOffer = useRef(false);
  const listenersSetUp = useRef(false);
  const [connectionState, setConnectionState] = useState('idle');

  // ── Create and wire up RTCPeerConnection ───────────────
  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection(RTC_CONFIG);

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', candidate);
    };

    peer.oniceconnectionstatechange = () => {
  const state = peer.iceConnectionState;
  console.log('ICE state:', state);
  // Only handle failures here — connected is set by DataChannel onopen
  if (state === 'disconnected' || state === 'failed' || state === 'closed') {
    setConnectionState('disconnected');
  }
};

    return peer;
  }, [socket]);

  // ── Sender: initiate offer after receiver joins ────────
  const startAsInitiator = useCallback(async () => {
  setConnectionState('connecting');
  const peer = createPeer();
  peerRef.current = peer;

  const channel = peer.createDataChannel('fileTransfer');
channelRef.current = channel;

channel.onopen = () => {
  console.log('DataChannel open — ready to send');
  setConnectionState('connected'); // ← moved here, fires only when truly open
};
channel.onerror = (e) => console.error('DataChannel error:', e);

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit('offer', offer);
  console.log('Offer sent');
}, [createPeer, socket]);

  // ── Receiver: handle incoming offer ───────────────────
  const handleOffer = useCallback(async (offer) => {
  setConnectionState('connecting');
  const peer = createPeer();
  peerRef.current = peer;

  peer.ondatachannel = ({ channel }) => {
    console.log('DataChannel received by receiver');
    channelRef.current = channel;

    // Wire up receiver channel directly here
    let metadata = null;
    let receivedChunks = [];
    let pendingHeader = null;
    let expectingBinary = false;
    let startTime = null;
    let bytesReceived = 0;
    let transferDone = false;

    channel.onopen = () => {
      console.log('DataChannel open — ready to receive');
      setConnectionState('connected');
    };

    channel.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        const message = JSON.parse(data);

        if (message.type === 'metadata') {
          metadata = message;
          receivedChunks = new Array(message.totalChunks);
          startTime = Date.now();
          bytesReceived = 0;
          console.log(`Receiving: ${message.name}`);
          return;
        }

        if (message.type === 'chunk') {
          pendingHeader = message;
          expectingBinary = true;
          return;
        }

        if (message.type === 'done') {
  transferDone = true;
  console.log('Done message received');
  return;
}
      }

      if (data instanceof ArrayBuffer && expectingBinary && pendingHeader) {
        expectingBinary = false;
        const { index, hash } = pendingHeader;

        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const computedHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (computedHash !== hash) {
          console.error(`Hash mismatch on chunk ${index}`);
          return;
        }

        receivedChunks[index] = data;
        console.log(
  `Chunk ${index} stored. Total: ${
    receivedChunks.filter(c => c !== undefined).length
  }/${metadata.totalChunks}`
);
       if (
  transferDone &&
  receivedChunks.every(chunk => chunk !== undefined)
) {
  console.log('All chunks received. Rebuilding file...');

  const blob = new Blob(receivedChunks, {
    type: metadata.mimeType,
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = metadata.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded: ${metadata.name}`);
}       

        bytesReceived += data.byteLength;

        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speedMBps = ((bytesReceived / elapsed) / (1024 * 1024)).toFixed(2);
          onProgress({
            received: bytesReceived,
            total: metadata.size,
            percent: Math.round((bytesReceived / metadata.size) * 100),
            speed: speedMBps,
          });
        }

        pendingHeader = null;
      }
    };

    channel.onerror = (e) => console.error('DataChannel error:', e);
  };

  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit('answer', answer);
  console.log('Answer sent');
}, [createPeer, socket, onProgress, onFileReceived]);

  // ── Sender DataChannel setup ───────────────────────────
  const setupSenderChannel = (channel) => {
    channel.onopen = () => {
      console.log('DataChannel open — ready to send');
      setConnectionState('connected');
    };
    channel.onerror = (e) => console.error('DataChannel error:', e);
  };

  // ── Receiver DataChannel setup ─────────────────────────
  const setupReceiverChannel = (channel) => {
    let metadata = null;
    let receivedChunks = [];
    let pendingHeader = null;
    let expectingBinary = false;
    let startTime = null;
    let bytesReceived = 0;

    channel.onopen = () => {
      console.log('DataChannel open — ready to receive');
      setConnectionState('connected');
    };

    channel.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        const message = JSON.parse(data);

        if (message.type === 'metadata') {
          metadata = message;
          receivedChunks = new Array(message.totalChunks);
          startTime = Date.now();
          bytesReceived = 0;
          console.log(`Receiving: ${message.name}`);
          return;
        }

        if (message.type === 'chunk') {
          pendingHeader = message;
          expectingBinary = true;
          return;
        }

        if (message.type === 'done') {
          await reassembleAndDownload();
          return;
        }
      }

      if (data instanceof ArrayBuffer && expectingBinary && pendingHeader) {
        expectingBinary = false;
        const { index, hash } = pendingHeader;

        // Verify SHA-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const computedHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (computedHash !== hash) {
          console.error(`Hash mismatch on chunk ${index}`);
          return;
        }

        receivedChunks[index] = data;
        bytesReceived += data.byteLength;

        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speedMBps = ((bytesReceived / elapsed) / (1024 * 1024)).toFixed(2);
          onProgress({
            received: bytesReceived,
            total: metadata.size,
            percent: Math.round((bytesReceived / metadata.size) * 100),
            speed: speedMBps,
          });
        }

        pendingHeader = null;
      }
    };

    const reassembleAndDownload = async () => {
      const missing = receivedChunks.findIndex(c => c === undefined);
      if (missing !== -1) {
        console.error(`Missing chunk at index ${missing}`);
        return;
      }

      const blob = new Blob(receivedChunks, { type: metadata.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Downloaded: ${metadata.name}`);
      setConnectionState('done');
      if (onFileReceived) onFileReceived({ name: metadata.name, size: metadata.size });
    };

    channel.onerror = (e) => console.error('DataChannel error:', e);
  };

  // ── Send file ──────────────────────────────────────────
  const sendFile = useCallback(async (file) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return;

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    channel.send(JSON.stringify({
      type: 'metadata',
      name: file.name,
      size: file.size,
      totalChunks,
      mimeType: file.type,
    }));

    let chunkIndex = 0;
    let offset = 0;

    while (offset < file.size) {
      if (channel.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise((resolve) => {
          channel.onbufferedamountlow = resolve;
          channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD / 2;
        });
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();

      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      channel.send(JSON.stringify({
        type: 'chunk',
        index: chunkIndex,
        totalChunks,
        size: arrayBuffer.byteLength,
        hash: hashHex,
      }));
      channel.send(arrayBuffer);

      if (onProgress) {
        onProgress({
          sent: offset + arrayBuffer.byteLength,
          total: file.size,
          percent: Math.round(((chunkIndex + 1) / totalChunks) * 100),
        });
      }

      offset += CHUNK_SIZE;
      chunkIndex++;
    }

    channel.send(JSON.stringify({ type: 'done' }));
    console.log('File send complete');
  }, [onProgress]);

  // ── Socket listeners ───────────────────────────────────
  useEffect(() => {
  if (!socket || listenersSetUp.current) return;
  listenersSetUp.current = true;

  console.log('Setting up socket listeners, role:', role);

  const onReceiverJoined = () => {
    console.log('receiver-joined received, role:', role);
    if (role === 'sender') startAsInitiator();
  };

  const onOffer = (offer) => {
    console.log('offer received, role:', role);
    if (role === 'receiver' && !hasHandledOffer.current) {
      hasHandledOffer.current = true;
      handleOffer(offer);
    }
  };

  const onAnswer = async (answer) => {
    console.log('answer received');
    if (peerRef.current) {
      await peerRef.current.setRemoteDescription(answer);
    }
  };

  const onIceCandidate = async (candidate) => {
    if (peerRef.current) {
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  };

  const onPeerDisconnected = ({ role: disconnectedRole }) => {
    setConnectionState('disconnected');
    console.log(`${disconnectedRole} disconnected`);
  };

  socket.on('receiver-joined', onReceiverJoined);
  socket.on('offer', onOffer);
  socket.on('answer', onAnswer);
  socket.on('ice-candidate', onIceCandidate);
  socket.on('peer-disconnected', onPeerDisconnected);

  return () => {
    socket.off('receiver-joined', onReceiverJoined);
    socket.off('offer', onOffer);
    socket.off('answer', onAnswer);
    socket.off('ice-candidate', onIceCandidate);
    socket.off('peer-disconnected', onPeerDisconnected);
    listenersSetUp.current = false;
  };
}, [socket]);
  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      channelRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  return {
    connectionState,
    sendFile,
    dataChannel: channelRef,
  };
}