import { useState, useEffect } from 'react';

export const INK = '#0e3b39';
export const TEAL = '#0e756c';
export const MUTED = '#5c7a76';
export const FAINT = '#8aa8a3';
export const LINE = '#dfece9';
export const HAIR = '#f2f7f6';

export const cardStyle = {
  background: '#fff', border: '1px solid ' + LINE, borderRadius: 16, overflow: 'hidden',
};

export const headingStyle = {
  fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 16, color: INK,
};

export const inputStyle = {
  width: '100%', padding: '10px 13px', border: '1px solid #d6e7e3',
  borderRadius: 10, fontSize: 14, background: '#f7fbfa', color: INK,
};

export const labelStyle = {
  display: 'block', fontWeight: 700, fontSize: 12.5, marginBottom: 6, color: INK,
};

export const primaryBtn = {
  padding: '10px 16px', borderRadius: 10, border: 0, background: TEAL,
  color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', minHeight: 40,
};

export const ghostBtn = {
  padding: '9px 15px', borderRadius: 9, border: '1px solid #d6e7e3', background: '#fff',
  color: '#4a6864', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 40,
};

export function chipStyle(on) {
  return {
    padding: '8px 13px', borderRadius: 100, fontWeight: 700, fontSize: 12.5,
    cursor: 'pointer', minHeight: 36,
    border: '1px solid ' + (on ? TEAL : '#d6e7e3'),
    background: on ? TEAL : '#fff',
    color: on ? '#fff' : '#33534f',
  };
}

export function useIsMobile(breakpoint = 760) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const onResize = () => setM((prev) => {
      const next = window.innerWidth < breakpoint;
      return prev === next ? prev : next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return m;
}

// The on/off switch. A locked field still shows its switch — the doctor should
// see that the setting exists and that it is on — but it cannot be moved, and
// says so.
export function Toggle({ on, disabled, onClick, title }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-pressed={!!on}
      aria-disabled={!!disabled}
      style={{
        flexShrink: 0, width: 44, height: 26, borderRadius: 100, border: 0, padding: 3,
        display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: on ? (disabled ? '#9fc9c2' : TEAL) : '#cfdcd9',
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );
}

export function Pill({ children, tone = 'grey' }) {
  const tones = {
    grey: { background: '#eef4f3', color: MUTED },
    teal: { background: '#e6f4f2', color: TEAL },
    amber: { background: '#fff4e5', color: '#8a4f0b' },
  };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', ...tones[tone] }}>
      {children}
    </span>
  );
}

export function Toast({ text }) {
  if (!text) return null;
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 95,
      background: INK, color: '#fff', padding: '11px 18px', borderRadius: 12,
      fontSize: 13.5, fontWeight: 600, maxWidth: 'calc(100vw - 32px)',
    }}>
      {text}
    </div>
  );
}
