import { useState, useRef, useEffect } from 'react';
import { medSuggestions, medSummary } from './formConfig';

// The medicine-name input, with suggestions from the clinic's library.
//
// Used in two places and deliberately the same component in both: the
// prescribed-medicine row in the doctor's form, and the preview on the
// settings page. If the preview were a separate mock-up it would drift from
// what the doctor actually gets, which is the one thing a preview must not do.
//
// It is an input first and a picker second. Typing always wins: a doctor who
// types a medicine that is not in the library and tabs away keeps what they
// typed. Nothing here can blank the field.
export default function MedicinePicker({
  value, medicines, onChangeText, onPick, onUseTyped,
  disabled, placeholder = 'Start typing… e.g. amo', style, inputStyle, autoFocus,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  const typed = String(value || '');
  const sugg = open ? medSuggestions(medicines, typed) : [];
  const showPanel = open && !!typed.trim() && (sugg.length > 0 || !!onUseTyped);

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => { setActive(0); }, [typed]);

  // A click on a suggestion fires after blur, so closing is deferred rather
  // than immediate — otherwise the panel unmounts before the click lands and
  // the doctor's pick does nothing.
  const deferClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  const cancelClose = () => clearTimeout(closeTimer.current);

  function choose(med) {
    cancelClose();
    setOpen(false);
    if (onPick) onPick(med);
  }

  function pickTyped() {
    cancelClose();
    setOpen(false);
    if (onUseTyped) onUseTyped(typed.trim());
  }

  function onKeyDown(e) {
    if (!showPanel) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); }
      return;
    }
    const rows = sugg.length + (onUseTyped ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % rows); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + rows) % rows); return; }
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter') {
      // Only intercept Enter when a suggestion is genuinely highlighted. A
      // doctor typing a one-off name and pressing Enter should not have a
      // half-matching medicine pushed into the row.
      if (active < sugg.length) { e.preventDefault(); choose(sugg[active]); }
      else if (onUseTyped) { e.preventDefault(); pickTyped(); }
    }
  }

  const baseInput = {
    width: '100%', padding: '11px 13px', border: '1px solid #d6e7e3',
    borderRadius: 10, fontSize: 14.5, background: disabled ? '#f2f7f6' : '#fff',
    color: '#0e3b39',
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...(style || {}) }}>
      <input
        className="fld"
        value={typed}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setOpen(true); if (onChangeText) onChangeText(e.target.value); }}
        onFocus={() => { cancelClose(); setOpen(true); }}
        onBlur={deferClose}
        onKeyDown={onKeyDown}
        style={{ ...baseInput, ...(inputStyle || {}) }}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
      />
      {showPanel && (
        <div
          onMouseDown={cancelClose}
          style={{
            position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 30,
            background: '#fff', border: '1px solid #dfece9', borderRadius: 12,
            boxShadow: '0 20px 44px -16px rgba(14,59,57,.4)', overflow: 'hidden',
          }}
        >
          {sugg.map((m, i) => (
            <button
              key={m.id || m.name}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(m)}
              style={{
                width: '100%', textAlign: 'left', border: 0,
                borderTop: i === 0 ? 0 : '1px solid #f2f7f6',
                padding: '10px 13px', cursor: 'pointer',
                background: i === active ? '#f2f9f8' : '#fff',
              }}
            >
              <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 14 }}>{m.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#5c7a76' }}>{medSummary(m)}</span>
            </button>
          ))}
          {onUseTyped && (
            <button
              type="button"
              onMouseEnter={() => setActive(sugg.length)}
              onClick={pickTyped}
              style={{
                width: '100%', textAlign: 'left', border: 0,
                borderTop: sugg.length ? '1px solid #eef4f3' : 0,
                background: active === sugg.length ? '#f2f9f8' : '#fbfdfd',
                padding: '10px 13px', cursor: 'pointer', fontSize: 13,
                color: '#0e756c', fontWeight: 700,
              }}
            >
              Use “{typed.trim()}” as a one-off medicine
            </button>
          )}
        </div>
      )}
    </div>
  );
}
