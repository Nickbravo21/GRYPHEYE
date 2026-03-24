import React from 'react';

export default function LoadingState({ fileType, progress }) {
  return (
    <div style={{ textAlign: 'center', zIndex: 1, width: '100%', maxWidth: 360, padding: 20 }}>
      {/* Spinning target */}
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
        <svg viewBox="0 0 80 80" style={{ animation: 'spin 2s linear infinite', position: 'absolute', inset: 0 }}>
          <circle cx="40" cy="40" r="36" stroke="rgba(0,255,65,0.15)" strokeWidth="2" fill="none" />
          <circle cx="40" cy="40" r="36" stroke="#00ff41" strokeWidth="2" fill="none"
            strokeDasharray="60 166" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 80 80" style={{ animation: 'spin 3s linear infinite reverse', position: 'absolute', inset: 0 }}>
          <circle cx="40" cy="40" r="22" stroke="rgba(0,255,65,0.1)" strokeWidth="1.5" fill="none" />
          <circle cx="40" cy="40" r="22" stroke="var(--accent-dim)" strokeWidth="1.5" fill="none"
            strokeDasharray="30 108" strokeLinecap="round" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)',
        }}>
          {fileType === 'video' ? `${progress}%` : '...'}
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: 8 }}>
        {fileType === 'video' ? 'PROCESSING VIDEO FRAMES' : 'RUNNING INFERENCE'}
      </div>

      {fileType === 'video' && (
        <div style={{ background: 'rgba(0,255,65,0.08)', border: '1px solid var(--border)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 10 }}>
        {fileType === 'image'
          ? 'Grounding DINO + SAM segmentation running…'
          : 'Grounding DINO + ByteTrack per-frame…'}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
