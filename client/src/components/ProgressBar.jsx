export default function ProgressBar({ percent, speed }) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{percent}%</span>
        {speed && <span>{speed} MB/s</span>}
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="bg-violet-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}