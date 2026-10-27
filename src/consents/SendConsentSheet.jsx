// "Send consent form" — pick a template, read exactly what the patient will
// read, send it.
//
// One consent is one link is one WhatsApp message, so this sends the ticked
// template and closes. Ticking is single-select for that reason: a doctor who
// wants two forms sends twice, and each gets its own link the patient can
// finish independently.

import { useEffect, useMemo, useState } from 'react';
import { useConsents } from './ConsentsContext';
import {
  sheetRows, renderTemplate, renderPlainText, placeholderVals,
  missingPlaceholders, firstName,
} from './consentModel';
import { sendConsent } from './consentsApi';

const todayLabel = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function SendConsentSheet({
  preselect, visit, patient, treatments = [], doctorName = '', clinicName = '',
  suggestedIds = [], onClose, onSent,
}) {
  const { templates, consents } = useConsents();
  const rows = useMemo(
    () => sheetRows({ templates, consents, suggestedIds }),
    [templates, consents, suggestedIds],
  );

  const firstFree = (rows.find((r) => !r.disabled) || {}).id || null;
  const [picked, setPicked] = useState(() => {
    const pre = rows.find((r) => r.id === preselect && !r.disabled);
    return pre ? pre.id : firstFree;
  });
  const [extra, setExtra] = useState({});   // placeholders filled by hand
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const row = rows.find((r) => r.id === picked) || null;
  const template = row ? row.template : null;

  const procedure = useMemo(() => {
    const t = (treatments || []).filter(Boolean);
    return t.join(' and ');
  }, [treatments]);

  const vals = useMemo(() => ({
    ...placeholderVals({
      patient: patient || {},
      procedure,
      doctor: doctorName,
      clinic: clinicName,
      date: todayLabel(),
    }),
    ...extra,
  }), [patient, procedure, doctorName, clinicName, extra]);

  const missing = useMemo(() => (template ? missingPlaceholders(template, vals) : []), [template, vals]);
  const preview = useMemo(() => (template ? renderTemplate(template, vals) : null), [template, vals]);

  const first = firstName(patient && patient.name);
  const optedOut = !!(patient && patient.whatsappOff);
  const canSend = !!template && !missing.length && !sending && !optedOut;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setErr('');
    try {
      const saved = await sendConsent({
        visitId: visit,
        patientId: patient && patient.patientId,
        templateId: template.templateId,
        title: template.title,
        // The snapshot the patient will read, rendered here so that what was
        // previewed is exactly what is stored and signed.
        bodyText: renderPlainText(template, vals),
        treatment: procedure,
        toothNumbers: (patient && patient.toothNumbers) || '',
        vals,
      });
      if (saved) onSent(saved);
      else onClose();
    } catch (e) {
      setErr((e && e.message) || 'Could not send the consent form.');
      setSending(false);
    }
  }

  const chips = ['Patient name', 'Age', 'Gender', 'Procedure', 'Doctor', 'Today’s date'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,59,57,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Send consent form"
        style={{
          width: 'min(760px,100%)', maxHeight: '90vh', background: '#fff', borderRadius: 18,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 70px -20px rgba(14,59,57,.55)',
        }}
      >
        <div style={{
          flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid #eef4f3',
          display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
        }}>
          <div>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 18, color: '#0e3b39' }}>Send consent form</span>
            <span style={{ display: 'block', fontSize: 13, color: '#5c7a76' }}>
              To {(patient && patient.name) || 'the patient'} on WhatsApp · {(patient && patient.mobile) || ''}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #e2efec',
            background: '#f7fbfa', color: '#5c7a76', fontSize: 14, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: '#5c7a76', marginBottom: 2,
            }}>Templates for your clinic</span>
            {rows.map((r) => (
              <div key={r.id} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px', borderRadius: 10,
                border: '1px solid ' + (r.id === picked ? '#0e756c' : '#e6f0ee'),
                background: r.disabled ? '#f7fbfa' : (r.id === picked ? '#f2f9f8' : '#fff'),
                opacity: r.disabled ? 0.65 : 1,
              }}>
                <button
                  type="button"
                  disabled={r.disabled}
                  aria-label={'Select ' + r.title}
                  onClick={() => setPicked(r.id)}
                  style={{
                    flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: 6,
                    border: '1.5px solid ' + (r.id === picked ? '#0e756c' : '#cfe3df'),
                    background: r.id === picked ? '#0e756c' : '#fff', color: '#fff',
                    fontSize: 12, lineHeight: 1, cursor: r.disabled ? 'default' : 'pointer',
                  }}
                >{r.id === picked ? '✓' : ''}</button>
                <button
                  type="button"
                  disabled={r.disabled}
                  onClick={() => setPicked(r.id)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'none', cursor: r.disabled ? 'default' : 'pointer', padding: 0 }}
                >
                  <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: r.disabled ? '#8aa8a3' : '#0e3b39', fontSize: 14 }}>{r.title}</span>
                    {r.suggested && !r.disabled && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, background: '#fff5cc', color: '#7a5c00', fontSize: 11, fontWeight: 700 }}>Suggested</span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5c7a76' }}>{r.note}</span>
                </button>
              </div>
            ))}
            {!rows.length && (
              <p style={{ fontSize: 13, color: '#8aa8a3', margin: 0 }}>No consent templates yet. Add them in Settings.</p>
            )}
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0, background: '#f7fbfa', borderLeft: '1px solid #eef4f3', padding: '14px 16px' }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5c7a76',
            }}>Preview · what {first} will see</span>
            <div style={{
              marginTop: 8, background: '#fff', border: '1px solid #e2efec', borderRadius: 12,
              padding: '12px 14px', maxHeight: 280, overflow: 'auto',
            }}>
              {preview ? (
                <>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: '#0e3b39' }}>{preview.title}</span>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, color: '#33534f', lineHeight: 1.5 }}>
                    {preview.paras.map((p, i) => (
                      <p key={i} style={{ margin: 0 }}>
                        {p.segs.map((s, j) => (
                          <span key={j} style={s.filled ? {
                            background: '#e6f4f2', color: '#0e3b39', fontWeight: 700, borderRadius: 4, padding: '0 3px',
                          } : undefined}>{s.text}</span>
                        ))}
                      </p>
                    ))}
                  </div>
                  {preview.risks.length > 0 && (
                    <div style={{ marginTop: 10, background: '#fff8e6', border: '1px solid #f1dca6', borderRadius: 10, padding: '9px 11px' }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 12.5, color: '#6b4b06' }}>Possible risks</span>
                      <ul style={{ margin: '5px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#6b4b06', lineHeight: 1.5 }}>
                        {preview.risks.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: '#8aa8a3' }}>Pick a form to preview it.</p>
              )}
            </div>

            {missing.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#b3261e' }}>
                  This form needs {missing.length === 1 ? 'a detail' : 'details'} the visit doesn’t have yet
                </span>
                {missing.map((k) => (
                  <input
                    key={k}
                    value={extra[k] || ''}
                    onChange={(e) => setExtra((x) => ({ ...x, [k]: e.target.value }))}
                    placeholder={k.replace(/_/g, ' ')}
                    aria-label={k.replace(/_/g, ' ')}
                    style={{
                      display: 'block', width: '100%', marginTop: 6, padding: '8px 10px',
                      borderRadius: 9, border: '1px solid #e6c9c5', fontSize: 13,
                    }}
                  />
                ))}
              </div>
            )}

            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#33534f', marginTop: 12 }}>
              Filled in automatically from this visit
            </span>
            <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {chips.map((c) => (
                <span key={c} style={{
                  padding: '3px 9px', borderRadius: 100, background: '#e6f4f2',
                  color: '#0e756c', fontSize: 11.5, fontWeight: 700,
                }}>{c}</span>
              ))}
            </span>
          </div>
        </div>

        <div style={{
          flexShrink: 0, borderTop: '1px solid #eef4f3', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ flex: '1 1 240px', fontSize: 12.5, color: optedOut ? '#b3261e' : '#5c7a76' }}>
            {optedOut
              ? (patient && patient.name) + ' has turned off WhatsApp messages — print the form and sign in the clinic.'
              : first + ' gets one WhatsApp message with a secure link to this form.'}
          </span>
          {err && <span style={{ flexBasis: '100%', fontSize: 12.5, color: '#c0392b', fontWeight: 600 }}>{err}</span>}
          <button type="button" onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 10, border: '1px solid #d6e7e3',
            background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 0,
              background: canSend ? '#128c7e' : '#cfe0dc', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: canSend ? 'pointer' : 'default',
            }}
          >{sending ? 'Sending…' : 'Send on WhatsApp'}</button>
        </div>
      </div>
    </div>
  );
}
