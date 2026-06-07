import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import Room from './pages/Room';

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-950 text-white">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<Room />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SocketProvider>
  );
}