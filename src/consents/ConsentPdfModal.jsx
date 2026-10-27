// The signed consent, opened from the bar, Documents, or a patient record.
//
// It shows the stored PDF rather than re-rendering the consent from its
// template. The PDF is the artifact that was signed; anything redrawn in the
// browser is a picture of what we think it said, which is not the same thing
// and is exactly the distinction that matters if it is ever questioned.

import { useEffect, useState } from 'react';
import { consentPdfUrl } from './consentsApi';

export default function ConsentPdfModal({ row, onClose }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  const id = row && (row.id || (row.consent && row.consent.consentId));
  const title = (row && row.title) || 'Signed consent';

  useEffect(() => {
    let alive = true;
    if (!id) return undefined;
    consentPdfUrl(id)
      .then((u) => { if (alive) setUrl(u); })
      .catch((e) => { if (alive) setErr((e && e.message) || 'Could not open the signed PDF.'); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(14,59,57,.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Signed consent"
        style={{ width: 'min(760px,100%)', background: '#fff', borderRadius: 16, overflow: 'hidden', margin: 'auto' }}
      >
        <div style={{
          background: '#0e3b39', color: '#fff', padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
              textTransform: 'uppercase', color: '#7fd4c9',
            }}>Signed consent</span>
            <span style={{
              display: 'block', fontWeight: 700, fontSize: 16,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{title}</span>
          </span>
          <span style={{ display: 'flex', gap: 7 }}>
            <a
              href={url || undefined}
              download
              title="Download PDF"
              aria-label="Download PDF"
              style={{
                width: 34, height: 34, borderRadius: 9, background: url ? '#12a094' : 'rgba(255,255,255,.15)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: url ? 'auto' : 'none',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
              </svg>
            </a>
            <button type="button" onClick={onClose} aria-label="Close" style={{
              width: 34, height: 34, borderRadius: 9, border: 0,
              background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 15, cursor: 'pointer',
            }}>✕</button>
          </span>
        </div>

        <div style={{ background: '#f7fbfa', minHeight: 320 }}>
          {err && <p style={{ padding: 24, margin: 0, color: '#c0392b', fontWeight: 600, fontSize: 13.5 }}>{err}</p>}
          {!err && !url && <p style={{ padding: 24, margin: 0, color: '#5c7a76', fontSize: 13.5 }}>Opening the signed PDF…</p>}
          {!err && url && (
            <iframe
              src={url}
              title={title}
              style={{ display: 'block', width: '100%', height: '70vh', border: 0, background: '#fff' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
