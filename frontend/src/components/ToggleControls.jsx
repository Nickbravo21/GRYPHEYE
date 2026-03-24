import React from 'react';

function Toggle({ label, value, onChange, disabled, hint }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '7px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
          {label}
        </div>
        {hint && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        style={{
          width: 44,
          height: 22,
          borderRadius: 11,
          border: `1px solid ${value ? 'var(--accent)' : 'var(--text-muted)'}`,
          background: value ? 'rgba(0,255,65,0.2)' : 'transparent',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: value ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'left 0.2s, background 0.2s',
          boxShadow: value ? '0 0 6px var(--accent)' : 'none',
        }} />
      </button>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, disabled }) {
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent)' }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
    </div>
  );
}

export default function ToggleControls({ options, fileType, onChange, disabled }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 14px' }}>
      <Toggle
        label="Bounding Boxes"
        value={options.showBoxes}
        onChange={(v) => onChange('showBoxes', v)}
        disabled={disabled}
        hint="Draw detection rectangles"
      />
      <Toggle
        label="SAM Segmentation"
        value={options.useSam}
        onChange={(v) => onChange('useSam', v)}
        disabled={disabled}
        hint="Pixel-level masks (slower)"
      />
      <Toggle
        label="Show Masks"
        value={options.showMasks}
        onChange={(v) => onChange('showMasks', v)}
        disabled={disabled || !options.useSam}
        hint="Overlay mask colours"
      />
      {fileType === 'video' && (
        <Toggle
          label="Object Tracking"
          value={options.useTracking}
          onChange={(v) => onChange('useTracking', v)}
          disabled={disabled}
          hint="Persistent IDs across frames"
        />
      )}
      <Slider
        label="Box Confidence"
        value={options.boxThreshold}
        onChange={(v) => onChange('boxThreshold', v)}
        min={0.05}
        max={0.95}
        step={0.05}
        disabled={disabled}
      />
      <Slider
        label="Text Threshold"
        value={options.textThreshold}
        onChange={(v) => onChange('textThreshold', v)}
        min={0.05}
        max={0.95}
        step={0.05}
        disabled={disabled}
      />
    </div>
  );
}
