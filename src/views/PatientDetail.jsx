import { useState } from 'react';

function num(x) { const n = parseFloat(x); return isNaN(n) ? 0 : n; }
function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
}

const PAY_MAP = {
  'Fully Paid': ['#e3f5ec', '#12805a'],
  'Partially paid': ['#fdf0dc', '#a9741a'],
  'Not paid': ['#fdecea', '#c0392b'],
};

function buildDetailRows(v) {
  const c = v.clinical || {};
  const rows = [];
  const add = (k, val) => { if (val) rows.push({ k, v: val }); };
  add('Date', fmtDate(v.date));
  add('Chief complaint', c.chiefComplaint);
  add('Description', c.chiefDescription);
  add('Treatment group', c.treatmentGroup);
  add('Treatment', /Other/.test(c.treatment) && c.treatmentOther ? c.treatmentOther : c.treatment);
  if (num(c.treatmentCost)) add('Treatment cost', inr(num(c.treatmentCost)));
  if (num(c.amountPaid)) add('Amount paid', inr(num(c.amountPaid)));
  if (c.balanceDue !== undefined && c.balanceDue !== '') add('Balance due', inr(num(c.balanceDue)));
  add('Payment mode', c.paymentMode);
  add('Payment status', c.paymentStatus);
  add('Treatment stage', c.treatmentStage);
  if (c.treatmentStage === 'Complete') add('Google review taken', c.googleReviewTaken);
  if ((c.treatmentStage === 'In Progress' || c.treatmentStage === 'Follow Up Pending') && c.nextAppointment) {
    add('Next appointment', fmtDate(c.nextAppointment) + (c.nextAppointmentTime ? ' at ' + fmtTime(c.nextAppointmentTime) : ''));
  }
  add('Comments', c.comments);
  return rows;
}

export default function PatientDetail({ patient, patientId, onGoBack }) {
  const [detailVisit, setDetailVisit] = useState(null);

  if (!patient) return null;

  const p = patient;
  const sorted = p.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));

  let totalCost = 0, totalPaid = 0, bal = 0;
  sorted.forEach((v) => {
    totalCost += num(v.clinical && v.clinical.treatmentCost);
    totalPaid += num(v.clinical && v.clinical.amountPaid);
    bal += num(v.clinical && v.clinical.treatmentCost) - num(v.clinical && v.clinical.amountPaid);
    if (bal < 0) bal = 0;
  });
  const outstanding = bal;

  let status;
  if (outstanding > 0 && totalPaid > 0) status = 'Partially paid';
  else if (outstanding > 0) status = 'Not paid';
  else status = 'Fully Paid';

  const [stBg, stInk] = PAY_MAP[status] || ['#eef4f3', '#8aa8a3'];
  const ageGender = (p.age || '?') + '/' + (p.gender || '—');

  const visitCards = sorted.slice().reverse().map((v) => {
    const c = v.clinical || {};
    const tr = /Other/.test(c.treatment) && c.treatmentOther ? c.treatmentOther : (c.treatment || '—');
    const cost = num(c.treatmentCost);
    const balance = num(c.balanceDue);
    const ps = c.paymentStatus || '—';
    const [vBg, vInk] = PAY_MAP[ps] || ['#eef4f3', '#8aa8a3'];
    return { visitId: v.visitId, dateLabel: fmtDate(v.date), treatmentLabel: tr, costLabel: cost ? inr(cost) : '—', balanceLabel: balance ? inr(balance) : '—', status: ps, stBg: vBg, stInk: vInk, visit: v };
  });

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <button onClick={onGoBack}
        style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
        ← Back to patients
      </button>

      <div style={{
        background: 'linear-gradient(135deg,#0e756c,#0e3b39)', borderRadius: 18, padding: '22px 24px',
        color: '#fff', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7fd4c9', fontWeight: 700 }}>Patient</span>
          <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 26, marginTop: 4 }}>{p.name}</h1>
          <p style={{ color: '#bfe3dd', fontSize: 14, marginTop: 2 }}>
            <span style={{ fontFamily: 'ui-monospace,monospace' }}>{patientId}</span> · {ageGender}
          </p>
          <p style={{ color: '#bfe3dd', fontSize: 14, marginTop: 2 }}>
            {p.mobile} · {p.visits.length} visit(s)
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <span style={{ display: 'inline-block', padding: '5px 13px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: stBg, color: stInk }}>{status}</span>
          <a href={'tel:' + p.mobile} title="Call patient"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.35)',
              color: '#fff', fontWeight: 700, fontSize: 13.5, textDecoration: 'none',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02l-2.2 2.2z" />
            </svg>
            Call
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginTop: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 15, padding: '14px 16px' }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8aa8a3' }}>Total billed</span>
          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#0e3b39', marginTop: 2 }}>{inr(totalCost)}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 15, padding: '14px 16px' }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8aa8a3' }}>Paid</span>
          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#12805a', marginTop: 2 }}>{inr(totalPaid)}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 15, padding: '14px 16px' }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8aa8a3' }}>Pending</span>
          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#c0392b', marginTop: 2 }}>{inr(outstanding)}</span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: '20px 22px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 16, color: '#0e3b39' }}>Visit history</h3>
          <span style={{ fontSize: 12.5, color: '#98b0ab' }}>Latest first · tap for details</span>
        </div>
        {visitCards.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visitCards.map((vc) => (
              <button key={vc.visitId} onClick={() => setDetailVisit(vc.visit)}
                style={{
                  textAlign: 'left', border: '1px solid #eef4f3', borderRadius: 12,
                  background: '#fff', padding: '13px 15px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 6, width: '100%',
                }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#0e756c', fontWeight: 700 }}>{vc.visitId}</span>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11.5, fontWeight: 700, background: vc.stBg, color: vc.stInk }}>{vc.status}</span>
                </span>
                <span style={{ fontSize: 14, color: '#33534f' }}>{vc.treatmentLabel}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: 14, fontSize: 12.5, color: '#5c7a76' }}>
                  {vc.dateLabel} · Cost {vc.costLabel} · Balance {vc.balanceLabel}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ color: '#8aa8a3', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No visits recorded yet.</p>
        )}
      </div>

      {detailVisit && (
        <div onClick={() => setDetailVisit(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,59,57,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '82vh', overflow: 'auto' }}>
            <div style={{
              position: 'sticky', top: 0, background: '#0e3b39', color: '#fff',
              padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderRadius: '20px 20px 0 0',
            }}>
              <div>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, color: '#7fd4c9', fontWeight: 700 }}>{detailVisit.visitId}</span>
                <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17 }}>{p.name} · {fmtDate(detailVisit.date)}</h3>
              </div>
              <button onClick={() => setDetailVisit(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '8px 22px 22px' }}>
              {buildDetailRows(detailVisit).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid #f0f6f5' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#8aa8a3', flex: '0 0 auto' }}>{r.k}</span>
                  <span style={{ fontSize: 14, color: '#33534f', textAlign: 'right' }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
