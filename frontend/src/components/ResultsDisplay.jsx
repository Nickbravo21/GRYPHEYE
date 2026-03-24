import React, { useState } from 'react';
import DetectionList from './DetectionList';

export default function ResultsDisplay({ result }) {
  const [tab, setTab] = useState('detections'); // 'detections' | 'raw'

  if (!result) return null;

  const tabStyle = (active) => ({
    padding: '8px 16px',
    background: active ? 'var(--bg-card)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      maxHeight: 260,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
      }}>
        <button style={tabStyle(tab === 'detections')} onClick={() => setTab('detections')}>
          DETECTIONS ({result.count})
        </button>
        <button style={tabStyle(tab === 'raw')} onClick={() => setTab('raw')}>
          RAW JSON
        </button>
        {result.frames && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {result.frames} FRAMES · {result.fps?.toFixed(1)} FPS
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {tab === 'detections' ? (
          <DetectionList detections={result.detections} type={result.type} />
        ) : (
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {JSON.stringify(result.detections?.slice(0, 10), null, 2)}
            {result.detections?.length > 10 && `\n… and ${result.detections.length - 10} more`}
          </pre>
        )}
      </div>
    </div>
  );
}
