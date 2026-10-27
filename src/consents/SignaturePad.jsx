// The signature canvas.
//
// Hand-written rather than pulled from a library, because the three things
// that actually matter here are small and specific: pointer events so a
// finger, a mouse and a stylus take one code path; `touch-action: none` so
// the page does not scroll out from under someone signing on a phone; and a
// minimum stroke length so a stray tap is not accepted as a signature.

import { useCallback, useEffect, useRef, useState } from 'react';

// Drawn at a fixed internal size and scaled by CSS, so the stored PNG is the
// same resolution whatever the screen — a signature captured on a phone and
// one captured on a clinic tablet print identically.
const W = 640;
const H = 280;

// Below this, it was a tap or a slip of the finger, not a signature.
export const MIN_STROKE_PX = 40;

export default function SignaturePad({ name = '', onChange, disabled = false, height = 140 }) {
  const ref = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const travelled = useRef(0);
  const [hasInk, setHasInk] = useState(false);

  const reset = useCallback(() => {
    const el = ref.current;
    const ctx = ctxRef.current;
    if (el && ctx) ctx.clearRect(0, 0, el.width, el.height);
    travelled.current = 0;
    setHasInk(false);
    if (onChange) onChange(null);
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = W;
    el.height = H;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14306b';
    ctxRef.current = ctx;
  }, []);

  // Canvas coordinates from a pointer event, scaled from the element's
  // rendered size to the fixed internal size.
  const at = (e) => {
    const el = ref.current;
    const r = el.getBoundingClientRect();
    return [
      (e.clientX - r.left) * el.width / (r.width || 1),
      (e.clientY - r.top) * el.height / (r.height || 1),
    ];
  };

  // Reported as a data URL only once there is enough ink to be a signature.
  const emit = () => {
    if (!onChange) return;
    const el = ref.current;
    if (!el) return;
    onChange(travelled.current >= MIN_STROKE_PX ? el.toDataURL('image/png') : null);
  };

  function down(e) {
    if (disabled) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawing.current = true;
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const p = at(e);
    last.current = p;
    // A dot, so a deliberate full stop still leaves a mark.
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0] + 0.1, p[1] + 0.1);
    ctx.stroke();
    setHasInk(true);
  }

  function move(e) {
    if (!drawing.current || disabled) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = at(e);
    const prev = last.current || p;
    travelled.current += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    last.current = p;
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    emit();
  }

  const inked = hasInk;
  return (
    <div>
      <div
        style={{
          position: 'relative', height, borderRadius: 12,
          border: '2px dashed ' + (inked ? '#0e756c' : '#cfe3df'),
          background: disabled ? '#f7fbfa' : '#fff',
          transition: 'border-color .15s',
        }}
      >
        {!inked && (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#8aa8a3', fontSize: 14, pointerEvents: 'none',
          }}>
            Sign here with your finger
          </span>
        )}
        <canvas
          ref={ref}
          aria-label="Signature"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            touchAction: 'none', cursor: disabled ? 'default' : 'crosshair',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
        <span style={{ flex: 1, borderTop: '1px solid #24403c', paddingTop: 4, fontSize: 12, color: '#5c7a76' }}>
          ✕ {name}
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={disabled || !inked}
          style={{
            border: 0, background: 'none', padding: 0, fontSize: 12.5, fontWeight: 700,
            color: inked ? '#0e756c' : '#b7cbc7', cursor: inked && !disabled ? 'pointer' : 'default',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
