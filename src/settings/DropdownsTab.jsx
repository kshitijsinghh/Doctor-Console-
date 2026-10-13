import { useState } from 'react';
import { DROPDOWN_DEFS, valueRows, addValue, toggleValue, removeValue, setAllValues } from './formConfig';
import {
  cardStyle, headingStyle, inputStyle, primaryBtn, Pill,
  INK, TEAL, MUTED, FAINT, HAIR, useIsMobile,
} from './ui';

export default function DropdownsTab({ config, onChange, onToast }) {
  const [sel, setSel] = useState(DROPDOWN_DEFS[0].k);
  const [newVal, setNewVal] = useState('');
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');
  const isMobile = useIsMobile();

  const def = DROPDOWN_DEFS.find((d) => d.k === sel);
  const rows = valueRows(config, sel);
  const q = filter.trim().toLowerCase();
  const shown = rows.filter((r) => !q || r.value.toLowerCase().includes(q));
  const enabledCount = rows.filter((r) => r.enabled).length;

  function pick(k) {
    setSel(k); setNewVal(''); setErr(''); setFilter('');
  }

  function add() {
    const v = newVal.trim();
    if (!v) return;
    const r = addValue(config, sel, v);
    if (r.error) { setErr(r.error); return; }
    onChange(r.config);
    setNewVal(''); setErr('');
    onToast('Added “' + v + '”');
  }

  return (
    <div style={{
      display: 'grid', gap: 16, alignItems: 'start',
      gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(240px,280px) minmax(0,1fr)',
    }}>
      <div style={cardStyle}>
        {DROPDOWN_DEFS.map((d, i) => {
          const a = valueRows(config, d.k);
          const on = d.k === sel;
          return (
            <button
              key={d.k}
              type="button"
              onClick={() => pick(d.k)}
              style={{
                width: '100%', border: 0, borderTop: i === 0 ? 0 : '1px solid ' + HAIR,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', color: INK, minHeight: 44,
                background: on ? '#e6f4f2' : '#fff',
                borderLeft: '3px solid ' + (on ? TEAL : 'transparent'),
              }}
            >
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{d.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
                  {a.filter((x) => x.enabled).length} shown · {a.filter((x) => x.custom).length} added by you
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.4" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          );
        })}
      </div>

      <div style={cardStyle}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef4f3' }}>
          <h3 style={{ ...headingStyle, fontSize: 17 }}>{def.label}</h3>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 2, textWrap: 'pretty' }}>{def.help}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <input
              value={newVal}
              onChange={(e) => { setNewVal(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="Add your own value…"
              style={{ ...inputStyle, flex: '1 1 220px', width: 'auto', minWidth: 0 }}
            />
            <button type="button" onClick={add} style={primaryBtn}>＋ Add</button>
          </div>
          {!!err && <p style={{ fontSize: 12.5, color: '#b3261e', marginTop: 6, fontWeight: 600 }}>{err}</p>}
        </div>

        <div style={{
          padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          background: '#fbfdfd', borderBottom: '1px solid #eef4f3',
        }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter values"
            style={{ ...inputStyle, background: '#fff', flex: '0 1 220px', width: 'auto', minWidth: 140, padding: '8px 12px', fontSize: 13.5 }}
          />
          <span style={{ fontSize: 12.5, color: MUTED }}>
            {enabledCount} of {rows.length} shown in the form
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => onChange(setAllValues(config, sel, true))}
              style={{ border: 0, background: 'none', color: TEAL, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Show all</button>
            <button type="button" onClick={() => onChange(setAllValues(config, sel, false))}
              style={{ border: 0, background: 'none', color: MUTED, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Hide all</button>
          </span>
        </div>

        <div style={{ maxHeight: 520, overflow: 'auto' }}>
          {shown.map((r) => (
            <div key={r.value} style={{
              padding: '9px 18px', borderTop: '1px solid ' + HAIR,
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <button
                type="button"
                onClick={() => onChange(toggleValue(config, sel, r.value))}
                title={r.enabled ? 'Hide from form' : 'Show in form'}
                aria-pressed={r.enabled}
                style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid ' + (r.enabled ? TEAL : '#b5c8c4'),
                  background: r.enabled ? TEAL : '#fff',
                }}
              >
                {r.enabled ? '✓' : ''}
              </button>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14,
                color: r.enabled ? INK : FAINT,
                textDecoration: r.enabled ? 'none' : 'line-through',
              }}>
                {r.value}
              </span>
              {r.custom && <Pill tone="teal">Yours</Pill>}
              {r.custom && (
                <button
                  type="button"
                  onClick={() => { onChange(removeValue(config, sel, r.value)); onToast('Deleted “' + r.value + '”'); }}
                  title="Delete"
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: '1px solid #f0d9d3',
                    background: '#fff', color: '#b3261e', cursor: 'pointer', fontSize: 13, flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {shown.length === 0 && (
            <p style={{ padding: '24px 18px', fontSize: 13.5, color: MUTED }}>
              {rows.length === 0
                ? 'Nothing here yet. Add your first value above.'
                : 'No values match.'}
            </p>
          )}
        </div>

        <p style={{
          padding: '11px 18px', fontSize: 12, color: MUTED,
          borderTop: '1px solid #eef4f3', background: '#fbfdfd', textWrap: 'pretty',
        }}>
          Unticked values are hidden from the doctor&rsquo;s form but kept on old visits.
          Built-in values can be hidden, not deleted; values you add can be deleted.
        </p>
      </div>
    </div>
  );
}
