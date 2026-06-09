import { useState, useRef } from 'react';

export default function DropZone({ onFileDrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      onFileDrop(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      onFileDrop(file);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      className={`
        w-full border-2 border-dashed rounded-xl p-10
        flex flex-col items-center justify-center gap-3
        cursor-pointer transition-all duration-200
        ${isDragging
          ? 'border-violet-400 bg-violet-950/30'
          : 'border-gray-700 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-900'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {selectedFile ? (
        <>
          <div className="text-3xl">📄</div>
          <p className="text-white text-sm font-medium">{selectedFile.name}</p>
          <p className="text-gray-500 text-xs">{formatSize(selectedFile.size)}</p>
          <p className="text-violet-400 text-xs">Creating room...</p>
        </>
      ) : (
        <>
          <div className="text-3xl">📂</div>
          <p className="text-gray-300 text-sm">
            Drop a file here or <span className="text-violet-400">browse</span>
          </p>
          <p className="text-gray-600 text-xs">Max 50MB for best performance</p>
        </>
      )}
    </div>
  );
}