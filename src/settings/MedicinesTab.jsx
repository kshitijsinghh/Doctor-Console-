import { useState } from 'react';
import { FOOD_OPTIONS } from '../options';
import {
  MED_SLOTS, searchMedicines, medSummary, medAbbr, emptyMedicine,
  validateMedicine, enabledValues, medToRow,
} from './formConfig';
import MedicinePicker from './MedicinePicker';
import {
  cardStyle, headingStyle, inputStyle, labelStyle, primaryBtn, ghostBtn, chipStyle, Pill,
  INK, TEAL, MUTED, FAINT, HAIR, useIsMobile,
} from './ui';

export default function MedicinesTab({ config, medicines, onSave, onDelete, onToast }) {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pq, setPq] = useState('');
  const [picked, setPicked] = useState(null);
  const isMobile = useIsMobile();

  const shown = searchMedicines(medicines, q);
  const types = enabledValues(config, 'medType');
  const patch = (p) => { setDraft((d) => ({ ...d, ...p })); setErr(''); };

  async function save() {
    const message = validateMedicine(draft, medicines);
    if (message) { setErr(message); return; }
    setBusy(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onToast(draft.id ? 'Medicine updated' : 'Added to My medicines');
      setDraft(null); setErr('');
    } catch (e) {
      setErr(String((e && e.message) || 'Could not save that medicine.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete(draft.id);
      onToast('Medicine deleted');
      setDraft(null);
    } catch (e) {
      setErr(String((e && e.message) || 'Could not delete that medicine.'));
    } finally {
      setBusy(false);
    }
  }

  // The preview shows a row pre-filled exactly as the doctor's form would fill
  // it, using the same component and the same mapping — not a mock-up of it.
  const previewRow = picked ? (picked.oneOff ? { name: picked.name } : medToRow(picked)) : null;

  const editor = draft && (
    <div style={{ ...cardStyle, border: '1px solid #9fd3c9', boxShadow: '0 16px 40px -24px rgba(14,59,57,.45)' }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid #eef4f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h3 style={headingStyle}>{draft.id ? 'Edit medicine' : 'Add medicine'}</h3>
        <button type="button" onClick={() => { setDraft(null); setErr(''); }}
          style={{ width: 30, height: 30, borderRadius: 8, border: 0, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 15 }}>✕</button>
      </div>
      <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Medicine name <span style={{ color: '#ef5a3c' }}>*</span></label>
          <input className="fld" value={draft.name} onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Amoxicillin 500mg" style={{ ...inputStyle, fontSize: 14.5 }} autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={draft.unit} onChange={(e) => patch({ unit: e.target.value })} style={{ ...inputStyle, fontSize: 14.5 }}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Default duration (days)</label>
          <input className="fld no-spin" type="number" min="0" value={draft.duration}
            onChange={(e) => patch({ duration: e.target.value })} placeholder="5" style={{ ...inputStyle, fontSize: 14.5 }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Before or after food</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {FOOD_OPTIONS.map((f) => (
              <button key={f} type="button" onClick={() => patch({ food: f })} style={chipStyle(draft.food === f)}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>When to take</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {MED_SLOTS.map((s) => (
              <button key={s.k} type="button" onClick={() => patch({ [s.k]: !draft[s.k] })} style={chipStyle(!!draft[s.k])}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Instructions</label>
          <input className="fld" value={draft.remarks} onChange={(e) => patch({ remarks: e.target.value })}
            placeholder="e.g. Complete the full course" style={{ ...inputStyle, fontSize: 14.5 }} />
        </div>
        {!!err && <p style={{ gridColumn: '1 / -1', fontSize: 12.5, color: '#b3261e', fontWeight: 600 }}>{err}</p>}
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid #eef4f3', background: '#fbfdfd', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!!draft.id && (
          <button type="button" onClick={remove} disabled={busy}
            style={{ border: 0, background: 'none', color: '#b3261e', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', minHeight: 40 }}>Delete</button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => { setDraft(null); setErr(''); }} style={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.65 : 1 }}>
            {busy ? 'Saving…' : 'Save medicine'}
          </button>
        </span>
      </div>
    </div>
  );

  const preview = (
    <div style={{ ...cardStyle, padding: '16px 18px' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: TEAL }}>
        Preview · in the doctor&rsquo;s form
      </span>
      <h3 style={{ ...headingStyle, marginTop: 2 }}>Type a few letters</h3>
      <p style={{ fontSize: 12.5, color: MUTED, marginTop: 2, textWrap: 'pretty' }}>
        Matches the start of any word, so &ldquo;amo&rdquo; or &ldquo;500&rdquo; both work.
      </p>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Medicine name</label>
        <MedicinePicker
          value={pq}
          medicines={medicines}
          onChangeText={(t) => { setPq(t); setPicked(null); }}
          onPick={(m) => { setPicked(m); setPq(m.name); }}
          onUseTyped={(name) => { setPicked({ name, oneOff: true }); setPq(name); }}
        />
      </div>

      {picked && (
        <div style={{ marginTop: 14, border: '1px solid #e2efec', borderRadius: 13, padding: '13px 14px', background: '#fbfdfd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: INK, fontSize: 14.5 }}>{picked.name}</span>
            <Pill tone={picked.oneOff ? 'amber' : 'teal'}>{picked.oneOff ? 'One-off' : 'From your list'}</Pill>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
            {(picked.oneOff
              ? ['Type —', 'When —', 'Food —', 'Days —']
              : [previewRow.unit || '—',
                MED_SLOTS.filter((s) => previewRow[s.k]).map((s) => s.label).join(', ') || '—',
                previewRow.food || '—',
                (previewRow.duration || '—') + ' days']
            ).map((p, i) => (
              <span key={i} style={{ padding: '4px 10px', borderRadius: 100, background: '#e6f4f2', color: TEAL, fontWeight: 700, fontSize: 12 }}>{p}</span>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>
            {picked.oneOff
              ? 'Fill in type, timing and duration for this patient.'
              : (previewRow.remarks ? 'Instructions: ' + previewRow.remarks : 'No instructions saved.')}
          </p>
          <p style={{ fontSize: 12, color: FAINT, marginTop: 8, borderTop: '1px solid #eef4f3', paddingTop: 8, textWrap: 'pretty' }}>
            Everything is pre-filled from your list and can still be changed for this patient.
          </p>
        </div>
      )}

      {picked && picked.oneOff && !!picked.name && (
        <button
          type="button"
          onClick={() => setDraft({ ...emptyMedicine(config), name: picked.name })}
          style={{ marginTop: 10, border: 0, background: 'none', color: TEAL, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', minHeight: 40 }}
        >
          Save “{picked.name}” to my medicines
        </button>
      )}
    </div>
  );

  const list = (
    <div style={cardStyle}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid #eef4f3', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={headingStyle}>My medicines</h3>
        <span style={{ fontSize: 12.5, color: MUTED }}>{medicines.length} saved</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
          style={{ ...inputStyle, marginLeft: 'auto', flex: '0 1 200px', width: 'auto', minWidth: 120, padding: '8px 12px', fontSize: 13.5 }} />
        <button type="button" onClick={() => { setDraft(emptyMedicine(config)); setErr(''); }} style={{ ...primaryBtn, padding: '9px 14px', fontSize: 13 }}>
          ＋ Add medicine
        </button>
      </div>
      {shown.map((m) => (
        <div
          key={m.id || m.name}
          onClick={() => { setDraft({ ...m }); setErr(''); }}
          style={{
            padding: '12px 18px', borderTop: '1px solid ' + HAIR, display: 'flex', gap: 12,
            alignItems: 'center', cursor: 'pointer',
            background: draft && draft.id === m.id ? '#f2f9f8' : '#fff',
          }}
        >
          <span style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: '#e6f4f2',
            color: TEAL, fontWeight: 700, fontSize: 11.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{medAbbr(m)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, color: INK, fontSize: 14.5 }}>{m.name}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{medSummary(m)}</span>
            {!!m.remarks && (
              <span style={{ display: 'block', fontSize: 12, color: '#8a5b2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.remarks}</span>
            )}
          </span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </div>
      ))}
      {shown.length === 0 && (
        <p style={{ padding: '24px 18px', fontSize: 13.5, color: MUTED }}>
          {medicines.length === 0
            ? 'No medicines yet. Add the ones you prescribe most and they will come up as you type in the doctor’s form.'
            : 'No medicines match.'}
        </p>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      {/* On a phone the editor and preview sit above the list, so tapping a
          row does not scroll the thing you just opened off the screen. */}
      <div style={{ flex: '1.55 1 460px', minWidth: 0, order: isMobile ? 2 : 1 }}>{list}</div>
      <div style={{ flex: '1 1 300px', minWidth: 0, order: isMobile ? 1 : 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {editor}
        {preview}
      </div>
    </div>
  );
}
