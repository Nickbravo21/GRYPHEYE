import React, { useEffect, useMemo } from 'react';
import LoadingState from './LoadingState';

export default function PreviewWindow({ result, loading, progress, fileType, file }) {
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isEmpty = !result && !loading && !file;
  const showUploadedPreview = !result && !!file && !!previewUrl;

  return (
    <div style={{
      flex: 1,
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 400,
      position: 'relative',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {isEmpty && (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16, opacity: 0.2 }}>⊕</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            AWAITING TARGET DATA
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 8, opacity: 0.6 }}>
            Upload an image or video to begin detection
          </div>
        </div>
      )}

      {showUploadedPreview && fileType === 'image' && (
        <img
          src={previewUrl}
          alt="Uploaded preview"
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            zIndex: 1,
            border: '1px solid var(--border)',
            opacity: loading ? 0.5 : 1,
          }}
        />
      )}

      {showUploadedPreview && fileType === 'video' && (
        <video
          src={previewUrl}
          controls
          autoPlay
          muted
          loop
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            zIndex: 1,
            border: '1px solid var(--border)',
            opacity: loading ? 0.5 : 1,
          }}
        />
      )}

      {loading && <LoadingState fileType={fileType} progress={progress} />}

      {!loading && result?.type === 'image' && (
        <img
          src={result.image}
          alt="Detection result"
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            zIndex: 1,
            border: '1px solid var(--border)',
          }}
        />
      )}

      {!loading && result?.type === 'video' && (
        <video
          src={result.videoUrl}
          controls
          autoPlay
          loop
          muted
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            zIndex: 1,
            border: '1px solid var(--border)',
          }}
        />
      )}

      {/* Corner crosshairs */}
      {['topLeft','topRight','bottomLeft','bottomRight'].map((pos) => {
        const s = {
          position: 'absolute',
          width: 20, height: 20,
          ...(pos.includes('top') ? { top: 12 } : { bottom: 12 }),
          ...(pos.includes('Left') ? { left: 12 } : { right: 12 }),
          borderTop: pos.includes('top') ? '1px solid var(--accent-dim)' : 'none',
          borderBottom: pos.includes('bottom') ? '1px solid var(--accent-dim)' : 'none',
          borderLeft: pos.includes('Left') ? '1px solid var(--accent-dim)' : 'none',
          borderRight: pos.includes('Right') ? '1px solid var(--accent-dim)' : 'none',
          opacity: 0.5,
        };
        return <div key={pos} style={s} />;
      })}
    </div>
  );
}
