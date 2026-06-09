export default function StatusBadge({ state }) {
  const config = {
    idle:         { label: 'Waiting',      color: 'bg-gray-700 text-gray-300' },
    connecting:   { label: 'Connecting',   color: 'bg-yellow-900 text-yellow-300' },
    connected:    { label: 'Connected',    color: 'bg-green-900 text-green-300' },
    done:         { label: 'Complete',     color: 'bg-violet-900 text-violet-300' },
    disconnected: { label: 'Disconnected', color: 'bg-red-900 text-red-300' },
  };

  const { label, color } = config[state] || config.idle;

  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${color}`}>
      {label}
    </span>
  );
}