// Booking an appointment from the calendar, with or without a visit.
//
// Anchored beside the click on a desktop, a bottom sheet on a phone. The
// draft lives in the parent so the ghost block on the grid can follow it.

import { useMemo } from 'react';
import { fmtDay, fmtMin } from '../ui';
import { firstName } from '../statusModel';
import {
  BOOKING_DUR_MIN, duplicatePatient, familyOn, overlapping,
  searchPatients, slotOptions, validateDraft,
} from './slotMath';

const PANEL_W = 400;
const GENDERS = ['Male', 'Female', 'Others'];

const label = { display: 'block', fontWeight: 700, fontSize: 12.5, color: '#33534f', marginBottom: 6 };
const input = {
  width: '100%', padding: '11px 13px', border: '1px solid #d6e7e3', borderRadius: 10,
  fontSize: 14.5, background: '#f7fbfa', color: '#0e3b39', fontFamily: 'inherit',
};
const req = <span style={{ color: '#ef5a3c' }}>*</span>;

// Keeps the card beside the click without letting it fall off screen: flipped
// to the left when there is no room on the right, and never above the top.
export function panelPosition(x, y, vw, vh, w = PANEL_W, h = 640) {
  const height = Math.min(h, vh - 32);
  let left = x + 18;
  if (left + w > vw - 16) left = x - w - 18;
  left = Math.max(16, left);
  const top = Math.max(16, Math.min(y - 120, vh - height - 16));
  return { left, top, maxHeight: height };
}

function Segmented({ value, onChange }) {
  const seg = (on) => ({
    flex: 1, padding: '9px 10px', borderRadius: 9, border: 0, cursor: 'pointer',
    fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
    background: on ? '#fff' : 'transparent', color: on ? '#0e3b39' : '#5c7a76',
    boxShadow: on ? '0 1px 3px rgba(14,59,57,.18)' : 'none',
  });
  return (
    <div style={{ display: 'flex', gap: 4, background: '#eef4f3', borderRadius: 11, padding: 4 }}>
      <button type="button" onClick={() => onChange('existing')} style={seg(value === 'existing')}>Existing patient</button>
      <button type="button" onClick={() => onChange('new')} style={seg(value === 'new')}>New patient</button>
    </div>
  );
}

function Avatar({ name, big }) {
  const s = big ? 36 : 32;
  return (
    <span style={{
      flexShrink: 0, width: s, height: s, borderRadius: '50%',
      background: big ? '#0e756c' : '#e6f4f2', color: big ? '#fff' : '#0e756c',
      fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bricolage Grotesque'",
    }}>{(String(name || '?').trim()[0] || '?').toUpperCase()}</span>
  );
}

export default function BookingPanel({
  draft, patients, events, today, nowMin, isPhone, saving, onChange, onClose, onSave,
}) {
  const d = draft;

  const results = useMemo(
    () => (d.who === 'existing' && !d.pick ? searchPatients(patients, d.q) : []),
    [d.who, d.pick, d.q, patients],
  );
  const family = useMemo(
    () => (d.who === 'new' ? familyOn(patients, d.mobile) : []),
    [d.who, d.mobile, patients],
  );
  const clashes = useMemo(
    () => overlapping(events, d.date, d.start),
    [events, d.date, d.start],
  );

  const set = (patch) => onChange({ ...d, ...patch, err: '' });

  // The patient as far as the form knows — used for the WhatsApp line before
  // anything has been saved.
  const who = d.who === 'existing' ? d.pick : (d.name.trim() ? { name: d.name, whatsappOff: false } : null);
  const waOff = !!(who && who.whatsappOff);
  const first = who ? firstName(who.name) : '';

  const blocking = validateDraft(d, { patients, today, nowMin });
  const dup = d.who === 'new' ? duplicatePatient(patients, d.mobile, d.name) : null;

  const panelStyle = isPhone || !d.pos
    ? {
      position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '92vh', overflowY: 'auto',
      background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -20px 50px -20px rgba(14,59,57,.5)',
    }
    : {
      position: 'fixed', width: PANEL_W, left: d.pos.left, top: d.pos.top,
      maxHeight: d.pos.maxHeight, overflowY: 'auto',
      background: '#fff', border: '1px solid #dfece9', borderRadius: 16,
      boxShadow: '0 30px 70px -20px rgba(14,59,57,.5)',
    };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 85,
        background: isPhone ? 'rgba(14,59,57,.45)' : 'transparent',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '16px 18px 10px' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0e756c' }}>
              New appointment
            </span>
            <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 18, color: '#0e3b39', marginTop: 2 }}>
              {fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span style={{ display: 'block', fontSize: 13.5, color: '#4a6864' }}>
              {fmtMin(d.start)} – {fmtMin(d.start + BOOKING_DUR_MIN)}
            </span>
          </div>
          <button
            onClick={onClose} title="Close" aria-label="Close"
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: 0, background: 'transparent', color: '#4a6864', cursor: 'pointer', fontSize: 17 }}
          >✕</button>
        </div>

        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Segmented
            value={d.who}
            onChange={(who2) => set({ who: who2, ...(who2 === 'new' ? { pick: null } : {}) })}
          />

          {d.who === 'existing' && (
            <div>
              {!d.pick && (
                <div>
                  <label style={label}>Find patient</label>
                  <input
                    value={d.q} onChange={(e) => set({ q: e.target.value, pick: null })}
                    placeholder="Search name or mobile number" autoFocus style={input}
                  />
                  {results.length > 0 && (
                    <div style={{ marginTop: 6, border: '1px solid #e2efec', borderRadius: 11, overflow: 'hidden' }}>
                      {results.map((p) => (
                        <button
                          key={p.patientId}
                          onClick={() => set({ pick: p, q: '' })}
                          style={{
                            width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid #f0f6f5',
                            background: '#fff', padding: '10px 12px', display: 'flex', gap: 11, alignItems: 'center', cursor: 'pointer',
                          }}
                        >
                          <Avatar name={p.name} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 14 }}>{p.name}</span>
                            <span style={{ display: 'block', fontSize: 12, color: '#5c7a76' }}>
                              {p.mobile} · {p.patientId}{p.whatsappOff ? ' · WhatsApp off' : ''}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!d.q.trim() && results.length === 0 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#4a6864', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      No patient found.
                      <button
                        // Carries the typed text across rather than making them
                        // type it twice: digits are a number, anything else a name.
                        onClick={() => set({
                          who: 'new',
                          name: /\d/.test(d.q) ? d.name : d.q.trim(),
                          mobile: /\d/.test(d.q) ? d.q.replace(/\D/g, '') : d.mobile,
                        })}
                        style={{ border: 0, background: 'none', padding: 0, color: '#0e756c', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                      >Add as a new patient</button>
                    </div>
                  )}
                </div>
              )}
              {!!d.pick && (
                <div style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '11px 12px', border: '1px solid #cfe3df', borderRadius: 12, background: '#f2f9f8' }}>
                  <Avatar name={d.pick.name} big />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 14.5 }}>{d.pick.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5c7a76' }}>{d.pick.mobile} · {d.pick.patientId}</span>
                  </span>
                  <button
                    onClick={() => set({ pick: null, q: '' })}
                    style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
                  >Change</button>
                </div>
              )}
            </div>
          )}

          {d.who === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Full name {req}</label>
                <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Patient name" style={input} />
              </div>
              <div>
                <label style={label}>Mobile number {req}</label>
                <input
                  value={d.mobile} inputMode="numeric"
                  onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="98765 43210" style={input}
                />
              </div>
              <div>
                <label style={label}>Age {req}</label>
                <input value={d.age} onChange={(e) => set({ age: e.target.value })} type="number" min="0" max="120" placeholder="Years" style={input} />
              </div>
              {family.length > 0 && (
                <p style={{ gridColumn: '1 / -1', fontSize: 12.5, color: '#6b4b06', background: '#fff8e6', border: '1px solid #f1dca6', borderRadius: 10, padding: '8px 11px', marginTop: -4 }}>
                  This number already has {family.map((p) => p.name).join(', ')}. Saving adds a new family member.
                </p>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Gender {req}</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {GENDERS.map((g) => {
                    const on = d.gender === g;
                    return (
                      <button
                        key={g} type="button" onClick={() => set({ gender: g })}
                        style={{
                          padding: '8px 13px', borderRadius: 100, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          border: '1px solid ' + (on ? '#0e756c' : '#d6e7e3'),
                          background: on ? '#0e756c' : '#fff', color: on ? '#fff' : '#33534f',
                        }}
                      >{g}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Address</label>
                <input value={d.address} onChange={(e) => set({ address: e.target.value })} placeholder="House / street, sector, city" style={input} />
              </div>
              <p style={{ gridColumn: '1 / -1', fontSize: 12, color: '#5c7a76', marginTop: -4 }}>
                We&apos;ll send appointment reminders, prescriptions and receipts to this number on WhatsApp.
                Patients can reply STOP at any time.
              </p>
            </div>
          )}

          <div style={{ borderTop: '1px solid #eef4f3', paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div>
              <label style={label}>Date</label>
              <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>Start time</label>
              <select value={String(d.start)} onChange={(e) => set({ start: Number(e.target.value) })} style={input}>
                {slotOptions().map((m) => <option key={m} value={String(m)}>{fmtMin(m)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>
                Treatment / reason <span style={{ color: '#8aa8a3', fontWeight: 400 }}>(optional)</span>
              </label>
              <input value={d.treatment} onChange={(e) => set({ treatment: e.target.value })} placeholder="e.g. RCT follow-up, consultation" style={input} />
            </div>
          </div>

          {/* Not blocking: double-booking a chair is sometimes deliberate. */}
          {clashes.length > 0 && (
            <p style={{ fontSize: 12.5, color: '#8a4f0b', background: '#fff4e5', border: '1px solid #f0d2a6', borderRadius: 10, padding: '8px 11px' }}>
              Overlaps with {clashes.map((c) => c.name + ' (' + fmtMin(c.startMin) + ')').join(', ')}. You can still book it.
            </p>
          )}

          {!!who && (
            <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45, color: waOff ? '#5c7a76' : '#0f5f42' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{waOff ? '○' : '●'}</span>
              <span>
                {waOff
                  ? first + ' has WhatsApp turned off — call to confirm this time.'
                  : first + ' will get a WhatsApp confirmation for ' + fmtDay(d.date) + ', ' + fmtMin(d.start)
                    + ' when you save, and a reminder the day before.'}
              </span>
            </p>
          )}

          {/* The duplicate is shown as you type, not held back until save. */}
          {!!dup && !d.err && (
            <p style={{ fontSize: 13, color: '#b3261e', fontWeight: 600 }}>
              {dup.name} is already registered on this number — switch to Existing patient and pick them.
            </p>
          )}
          {!!d.err && <p style={{ fontSize: 13, color: '#b3261e', fontWeight: 600 }}>{d.err}</p>}
        </div>

        <div style={{
          position: 'sticky', bottom: 0, padding: '12px 18px calc(12px + env(safe-area-inset-bottom))',
          background: '#f7fbfa', borderTop: '1px solid #eef4f3', display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose} disabled={saving}
            style={{ padding: '10px 17px', borderRadius: 100, border: '1px solid #d6e7e3', background: '#fff', color: '#4a6864', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer' }}
          >Cancel</button>
          <button
            onClick={() => onSave(blocking)} disabled={saving}
            style={{ padding: '10px 20px', borderRadius: 100, border: 0, background: saving ? '#8aa8a3' : '#0e756c', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer' }}
          >{saving ? 'Booking…' : 'Book appointment'}</button>
        </div>
      </div>
    </div>
  );
}
