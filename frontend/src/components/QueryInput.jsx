import React from 'react';

const EXAMPLES = ['person', 'military vehicle', 'drone', 'tank', 'person with backpack', 'aircraft'];

export default function QueryInput({ value, onChange, disabled, onSubmit }) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && onSubmit()}
        placeholder="e.g. tank, drone, person with backpack"
        disabled={disabled}
        style={{
          width: '100%',
          padding: '11px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: 3,
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          outline: 'none',
          letterSpacing: '0.05em',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-bright)')}
      />

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 8,
      }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onChange(ex)}
            disabled={disabled}
            style={{
              padding: '3px 10px',
              background: value === ex ? 'rgba(0,255,65,0.15)' : 'transparent',
              border: `1px solid ${value === ex ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 2,
              color: value === ex ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
