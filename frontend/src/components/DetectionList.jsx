import React from 'react';

const COLORS = ['#00ff41','#ff5252','#5282ff','#ffd232','#c850ff','#32e6c8','#ffa032','#ff50c8'];
const getColor = (id) => COLORS[parseInt(id) % COLORS.length];

function ConfBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#00ff41' : pct >= 40 ? '#ffd700' : '#ff4136';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, boxShadow: `0 0 4px ${color}` }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color, minWidth: 34 }}>{pct}%</span>
    </div>
  );
}

export default function DetectionList({ detections, type }) {
  if (!detections || detections.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        NO TARGETS DETECTED
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {detections.map((det, i) => {
        const colorId = det.tracking_id !== undefined && det.tracking_id !== null ? det.tracking_id : det.id ?? i;
        const color = getColor(colorId);
        return (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${color}33`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 3,
              padding: '7px 12px',
              minWidth: 160,
              flex: '1 1 160px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {det.label}
              </span>
              {det.tracking_id !== null && det.tracking_id !== undefined && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color, background: `${color}22`, padding: '1px 6px', borderRadius: 2 }}>
                  #{det.tracking_id}
                </span>
              )}
              {type === 'video' && det.frame !== undefined && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  f{det.frame}
                </span>
              )}
            </div>
            <ConfBar value={det.confidence} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {det.box
                ? `${Math.round(det.box.x)},${Math.round(det.box.y)}  ${Math.round(det.box.width)}×${Math.round(det.box.height)}`
                : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
