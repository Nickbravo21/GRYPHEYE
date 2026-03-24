import React, { useRef, useState, useCallback } from 'react';

const styles = {
  dropzone: (isDragging) => ({
    border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-bright)'}`,
    borderRadius: 4,
    padding: '28px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragging ? 'var(--accent-glow)' : 'var(--bg-card)',
    transition: 'all 0.2s ease',
    position: 'relative',
  }),
  fileInfo: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    background: 'none',
    border: '1px solid rgba(255,65,54,0.4)',
    color: '#ff4136',
    padding: '2px 8px',
    borderRadius: 2,
    fontSize: '0.65rem',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  icon: { fontSize: '2rem', marginBottom: 8, display: 'block' },
  hint: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    marginTop: 6,
  },
  types: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  label: {
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    letterSpacing: '0.05em',
  },
};

export default function UploadPanel({ onFileSelect, disabled }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('Unsupported file type. Please upload an image (jpg/png) or video (mp4).');
      return;
    }
    setSelectedFile(f);
    onFileSelect(f, isImage ? 'image' : 'video');
  }, [onFileSelect]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onClick = () => !disabled && inputRef.current?.click();

  const clear = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelect(null, null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div>
      <div
        style={styles.dropzone(isDragging)}
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span style={styles.icon}>
          {selectedFile
            ? selectedFile.type.startsWith('image/') ? '🖼' : '🎬'
            : '📁'}
        </span>
        <div style={styles.label}>
          {selectedFile ? selectedFile.name : 'DROP FILE OR CLICK TO BROWSE'}
        </div>
        <div style={styles.hint}>
          {selectedFile ? formatSize(selectedFile.size) : 'Drag & drop or click to select'}
        </div>
        <div style={styles.types}>Supported: JPG · PNG · MP4</div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,video/mp4,video/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {selectedFile && (
        <div style={styles.fileInfo}>
          <span style={{ color: selectedFile.type.startsWith('image/') ? 'var(--accent)' : 'var(--warning)' }}>
            {selectedFile.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFile.name}
          </span>
          <button style={styles.clearBtn} onClick={clear}>CLEAR</button>
        </div>
      )}
    </div>
  );
}
