// The consent bar in the doctor's form.
//
// Sits directly under the patient header so it is visible on both steps, and
// renders nothing at all when the clinic has no consent templates — a clinic
// that has not set consent up sees the form exactly as it was.

import { useMemo, useState } from 'react';
import { useConsents } from './ConsentsContext';
import {
  consentRows, summaryChips, suggestionFor, firstName, activeFor,
} from './consentModel';
import { resendConsent, cancelConsent } from './consentsApi';
import SendConsentSheet from './SendConsentSheet';
import ConsentPdfModal from './ConsentPdfModal';
import InClinicSignModal from './InClinicSignModal';

function Chevron({ open }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', transform: 'rotate(' + (open ? 180 : 0) + 'deg)', transition: 'transform .15s' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return (sameDay ? 'Today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) + ', ' + fmtTime(iso);
};

export default function ConsentBar({ visit, patient, treatments = [], doctorName = '', clinicName = '', readOnly = false }) {
  const { templates, templatesById, consents, enabled, applyConsent } = useConsents();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(null);      // { preselect }
  const [pdfFor, setPdfFor] = useState(null);
  const [signFor, setSignFor] = useState(null);
  const [dismissed, setDismissed] = useState([]); // this visit only
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');

  const now = Date.now();
  const rows = useMemo(
    () => consentRows(consents, templatesById, now, { time: fmtTime, when: fmtWhen }),
    [consents, templatesById, now],
  );
  const chips = useMemo(() => summaryChips(consents, now), [consents, now]);
  const suggestion = useMemo(
    () => suggestionFor({ templates, consents, treatments, dismissed, now }),
    [templates, consents, treatments, dismissed, now],
  );

  // The whole feature is invisible until a clinic has templates.
  if (!enabled) return null;

  const first = firstName(patient && patient.name);
  const noneSent = rows.length === 0;

  async function act(row, fn, failCopy) {
    const id = row.id;
    setBusyId(id);
    setErr('');
    try {
      const updated = await fn(id);
      if (updated) applyConsent(updated);
    } catch (e) {
      setErr((e && e.message) || failCopy);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #cfe3df', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: '#e6f4f2',
          color: '#0e756c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>✍</span>
        <span style={{ fontWeight: 700, color: '#0e3b39', fontSize: 14.5 }}>Consent forms</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
          {noneSent
            ? <span style={{ fontSize: 13, color: '#5c7a76' }}>None sent for this visit</span>
            : chips.map((c) => (
              <span key={c.key} style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                fontWeight: 700, fontSize: 12, background: c.bg, color: c.ink,
              }}>{c.label}</span>
            ))}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setSheet({ preselect: null })}
            style={{
              padding: '8px 13px', borderRadius: 9, border: 0, background: '#0e756c', color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >＋ Send consent form</button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Hide sent forms' : 'Show sent forms'}
          style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid #e2efec', background: '#f7fbfa',
            color: '#0e756c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><Chevron open={open} /></button>
      </div>

      {/* Shown even when the bar is collapsed — it is the one thing worth interrupting for. */}
      {suggestion && !readOnly && (
        <div style={{
          borderTop: '1px solid #f1dca6', background: '#fff8e6', padding: '9px 14px 9px 54px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ flex: '1 1 240px', fontSize: 13, color: '#6b4b06' }}>
            Suggested for <strong>{suggestion.treatment}</strong>: {suggestion.template.title} hasn’t been sent to {first}.
          </span>
          <button
            type="button"
            onClick={() => setSheet({ preselect: suggestion.template.templateId })}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 0, background: '#0e756c',
              color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            }}
          >Send</button>
          <button
            type="button"
            onClick={() => setDismissed((d) => d.concat(suggestion.template.templateId))}
            style={{ border: 0, background: 'none', color: '#8a6a1f', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
          >Not needed</button>
        </div>
      )}

      {err && (
        <p style={{ padding: '8px 14px 0 54px', margin: 0, fontSize: 12.5, color: '#c0392b', fontWeight: 600 }}>{err}</p>
      )}

      {open && (
        <div style={{ borderTop: '1px solid #eef4f3' }}>
          {noneSent && (
            <p style={{ padding: '14px 14px 14px 54px', margin: 0, fontSize: 13, color: '#8aa8a3' }}>
              Forms you send will appear here with their status.
            </p>
          )}
          {rows.map((r) => (
            <div key={r.id} style={{
              padding: '11px 14px 11px 54px', borderTop: '1px solid #f2f7f6',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 14 }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: r.subInk }}>{r.sub}</span>
              </span>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                fontWeight: 700, fontSize: 12, background: r.pill.bg, color: r.pill.ink,
              }}>{r.pill.label}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {r.can.view && (
                  <button type="button" onClick={() => setPdfFor(r)} style={{
                    padding: '6px 11px', borderRadius: 8, border: '1px solid #cfe3df', background: '#f2f9f8',
                    color: '#0e756c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                  }}>View PDF</button>
                )}
                {!readOnly && r.can.resend && (
                  <>
                    <button type="button" disabled={busyId === r.id}
                      onClick={() => act(r, resendConsent, 'Could not resend the link.')}
                      style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                    >{busyId === r.id ? 'Sending…' : 'Resend'}</button>
                    <button type="button" onClick={() => setSignFor(r)}
                      style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                    >Sign here now</button>
                  </>
                )}
                {!readOnly && r.can.cancel && (
                  <button type="button" disabled={busyId === r.id}
                    onClick={() => act(r, cancelConsent, 'Could not cancel the link.')}
                    style={{ border: 0, background: 'none', color: '#b3261e', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                  >Cancel link</button>
                )}
                {!readOnly && r.can.sendAgain && (
                  <button type="button"
                    onClick={() => setSheet({ preselect: r.consent.templateId })}
                    style={{
                      padding: '6px 11px', borderRadius: 8, border: 0, background: '#0e756c',
                      color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                    }}
                  >Send again</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {sheet && (
        <SendConsentSheet
          preselect={sheet.preselect}
          visit={visit}
          patient={patient}
          treatments={treatments}
          doctorName={doctorName}
          clinicName={clinicName}
          suggestedIds={suggestion ? [suggestion.template.templateId] : []}
          onClose={() => setSheet(null)}
          onSent={(row) => { applyConsent(row); setOpen(true); setSheet(null); }}
        />
      )}
      {pdfFor && <ConsentPdfModal row={pdfFor} onClose={() => setPdfFor(null)} />}
      {signFor && (
        <InClinicSignModal
          row={signFor}
          patient={patient}
          template={templatesById[signFor.consent.templateId]}
          onClose={() => setSignFor(null)}
          onSigned={(row) => { applyConsent(row); setSignFor(null); }}
        />
      )}
    </div>
  );
}

export { activeFor };
