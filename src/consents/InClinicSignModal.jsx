// Signing in the chair: staff open the form, hand over the device, the
// patient reads and signs.
//
// The same consent record as the WhatsApp flow, reaching the same signed PDF
// — only the identity differs. There is no token here because the staff
// session already proves who opened it; the server records who was signed in
// as the witness.

import { useEffect, useMemo, useState } from 'react';
import SignaturePad from './SignaturePad';
import { renderTemplate, placeholderVals, firstName } from './consentModel';
import { signInClinic } from './consentsApi';

const ROLES = [
  { id: 'PATIENT', label: 'The patient' },
  { id: 'PARENT', label: 'Parent' },
  { id: 'GUARDIAN', label: 'Guardian' },
];

export default function InClinicSignModal({ row, patient, template, onClose, onSigned }) {
  const [agreed, setAgreed] = useState(false);
  const [png, setPng] = useState(null);
  const [role, setRole] = useState('PATIENT');
  const [signerName, setSignerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const consent = row && row.consent;
  const patientName = (patient && patient.name) || '';
  const first = firstName(patientName);

  // The snapshot stored when the form was sent, so what is signed in the
  // clinic is word for word what was sent on WhatsApp. Falls back to
  // re-rendering only when an older record carries no snapshot.
  const body = useMemo(() => {
    if (consent && consent.bodyText) {
      return { title: consent.title || (template && template.title) || 'Consent form', text: consent.bodyText, risks: [] };
    }
    const vals = placeholderVals({ patient: patient || {}, procedure: (consent && consent.treatment) || '' });
    const r = renderTemplate(template, vals);
    return { title: r.title, text: r.paras.map((p) => p.segs.map((s) => s.text).join('')).join('\n\n'), risks: r.risks };
  }, [consent, template, patient]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // When someone other than the patient signs, their own name is required —
  // a guardian consent in the child's name records nothing useful.
  const nameNeeded = role !== 'PATIENT';
  const nameOk = !nameNeeded || signerName.trim().length > 1;
  const ready = agreed && !!png && nameOk && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setErr('');
    try {
      const saved = await signInClinic(row.id, {
        signaturePng: png,
        signerName: nameNeeded ? signerName.trim() : patientName,
        signerRole: role,
      });
      if (saved) onSigned(saved);
      else onClose();
    } catch (e) {
      setErr((e && e.message) || 'Could not save the signature.');
      setBusy(false);
    }
  }

  const hint = !agreed ? 'Tick the box and sign to continue'
    : !png ? 'Add a signature to continue'
      : !nameOk ? 'Enter the name of the person signing'
        : '';

  return (
    <div
      onClick={() => { if (!busy) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 86, background: 'rgba(14,59,57,.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 18, overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sign in clinic"
        style={{
          width: 'min(560px,100%)', background: '#fff', borderRadius: 16,
          overflow: 'hidden', margin: 'auto', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #eef4f3',
          display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
        }}>
          <div>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 17, color: '#0e3b39' }}>{body.title}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#5c7a76' }}>
              Signing in the clinic · hand the device to {first}
            </span>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #e2efec',
            background: '#f7fbfa', color: '#5c7a76', fontSize: 14, cursor: busy ? 'default' : 'pointer',
          }}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', maxHeight: '46vh', overflow: 'auto' }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13.5, color: '#33534f', lineHeight: 1.55 }}>{body.text}</p>
          {body.risks.length > 0 && (
            <div style={{ marginTop: 12, background: '#fff8e6', border: '1px solid #f1dca6', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#6b4b06' }}>Possible risks</span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: '#6b4b06', lineHeight: 1.5 }}>
                {body.risks.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <button
            type="button"
            onClick={() => setAgreed((v) => !v)}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left',
              padding: '11px 12px', borderRadius: 11, cursor: 'pointer',
              border: '1px solid ' + (agreed ? '#0e756c' : '#e6f0ee'),
              background: agreed ? '#f2f9f8' : '#fff',
            }}
          >
            <span style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 6, marginTop: 1,
              border: '1.5px solid ' + (agreed ? '#0e756c' : '#cfe3df'),
              background: agreed ? '#0e756c' : '#fff', color: '#fff', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{agreed ? '✓' : ''}</span>
            <span style={{ fontSize: 13.5, color: '#24403c', lineHeight: 1.45 }}>
              I have read this form, my questions have been answered, and I agree to the treatment described.
            </span>
          </button>

          <div style={{ marginTop: 12 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#33534f', marginBottom: 6 }}>Signing as</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 100, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (role === r.id ? '#0e756c' : '#cfe3df'),
                    background: role === r.id ? '#0e756c' : '#fff',
                    color: role === r.id ? '#fff' : '#0e756c',
                  }}
                >{r.label}</button>
              ))}
            </div>
            {nameNeeded && (
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full name of the person signing"
                aria-label="Full name of the person signing"
                style={{
                  display: 'block', width: '100%', marginTop: 8, padding: '9px 11px',
                  borderRadius: 9, border: '1px solid #cfe3df', fontSize: 13.5,
                }}
              />
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <SignaturePad name={nameNeeded ? (signerName || 'Signature') : patientName} onChange={setPng} disabled={busy} />
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #eef4f3', padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ flex: '1 1 200px', fontSize: 12.5, color: err ? '#c0392b' : '#5c7a76', fontWeight: err ? 600 : 400 }}>
            {err || hint}
          </span>
          <button type="button" onClick={onClose} disabled={busy} style={{
            padding: '10px 16px', borderRadius: 10, border: '1px solid #d6e7e3',
            background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
          }}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 0,
              background: ready ? '#0e756c' : '#cfe0dc', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: ready ? 'pointer' : 'default',
            }}
          >{busy ? 'Saving…' : 'Sign and submit'}</button>
        </div>
      </div>
    </div>
  );
}
