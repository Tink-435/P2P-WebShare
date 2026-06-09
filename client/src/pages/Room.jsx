import { useParams } from 'react-router-dom';

export default function Room() {
  const { roomId } = useParams();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold">Room: {roomId}</h1>
    </div>
  );
}