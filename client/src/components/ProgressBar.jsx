export default function ProgressBar({
  percent,
  speed,
  received,
  sent,
  total,
}) {
  const transferred = received ?? sent ?? 0;

  const formatMB = (bytes) =>
    (bytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{percent}%</span>
        {speed && <span>{speed} MB/s</span>}
      </div>

      {total > 0 && (
        <div className="text-xs text-gray-500">
          {formatMB(transferred)} MB / {formatMB(total)} MB
        </div>
      )}
    </div>
  );
}