import { useState } from 'react';
import {
  CHIEF_COMPLAINTS, TREATMENT_GROUPS, TREATMENTS, TOOTH_NUMBERS, TOOTH_NUMBERS_KID, PATIENT_TYPES, PAYMENT_MODES, YES_NO, TREATMENT_STAGES,
} from '../options';
import { TOUCH_BTN, FLUID_GRID_2COL } from '../styles';

const fieldStyle = {
  width: '100%', minHeight: 44, padding: '12px 14px', border: '1px solid #d6e7e3', borderRadius: 10,
  fontSize: 15, background: '#f7fbfa',
};
const labelStyle = { display: 'block', fontWeight: 700, fontSize: 13.5, marginBottom: 7 };
const h3Style = { fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 16, color: '#0e3b39' };
const roStyle = { opacity: 0.7, background: '#f0f4f3', cursor: 'default' };

function num(x) { const n = parseFloat(x); return isNaN(n) ? 0 : n; }

function MultiSelect({ value, options, onChange, placeholder, disabled, allowOther, searchable }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allTokens = value ? value.split(', ').filter(Boolean) : [];
  const stdOptions = allowOther ? options.filter((o) => o !== 'Other') : options;
  const stdSelected = allTokens.filter((t) => stdOptions.includes(t));

  let isOtherOn = false;
  let otherText = '';
  if (allowOther) {
    const custom = allTokens.filter((t) => !stdOptions.includes(t) && t !== 'Other');
    isOtherOn = allTokens.includes('Other') || custom.length > 0;
    otherText = custom.join(', ');
  }

  const displayChips = allowOther
    ? [...stdSelected, ...(isOtherOn ? (otherText ? [otherText] : ['Other']) : [])]
    : allTokens;

  function buildVal(std, oText, oOn) {
    const parts = [...std];
    if (oOn) parts.push(oText || 'Other');
    return parts.join(', ');
  }

  function toggle(opt) {
    if (allowOther && opt === 'Other') {
      onChange(isOtherOn ? stdSelected.join(', ') : buildVal(stdSelected, '', true));
      return;
    }
    const base = allowOther ? stdSelected : allTokens;
    const next = base.includes(opt) ? base.filter((s) => s !== opt) : [...base, opt];
    onChange(allowOther ? buildVal(next, otherText, isOtherOn) : next.join(', '));
  }

  function removeChip(chip) {
    if (allowOther && !stdOptions.includes(chip)) {
      onChange(stdSelected.join(', '));
      return;
    }
    toggle(chip);
  }

  const filtered = searchable && search
    ? stdOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : stdOptions;

  const checkBox = (on) => (
    <span style={{
      width: 18, height: 18, borderRadius: 4,
      border: '2px solid ' + (on ? '#12a094' : '#d6e7e3'),
      background: on ? '#12a094' : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {on && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => { if (!disabled) { if (open) setSearch(''); setOpen(!open); } }}
        style={{
          ...fieldStyle, display: 'flex', flexWrap: 'wrap', gap: 6,
          cursor: disabled ? 'default' : 'pointer',
          alignItems: 'center', minHeight: 44, paddingRight: 32,
          opacity: disabled ? 0.7 : 1, background: disabled ? '#f0f4f3' : fieldStyle.background,
          position: 'relative',
        }}
      >
        {displayChips.length === 0 && <span style={{ color: '#98b0ab', flex: 1 }}>{placeholder || 'Select…'}</span>}
        {displayChips.map((s) => (
          <span
            key={s}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 100, background: '#e0f0ed',
              fontSize: 13, fontWeight: 600, color: '#0e756c',
            }}
          >
            {s}
            {!disabled && <span
              onClick={(e) => { e.stopPropagation(); removeChip(s); }}
              style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, color: '#5c7a76', marginLeft: 2 }}
            >&times;</span>}
          </span>
        ))}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8aa8a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && !disabled && (
        <>
          <div onClick={() => { setOpen(false); setSearch(''); }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            maxHeight: 260, overflowY: 'auto', background: '#fff',
            border: '1px solid #d6e7e3', borderRadius: 10, marginTop: 4,
            boxShadow: '0 8px 24px rgba(14,59,57,.12)',
          }}>
            {searchable && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #eef4f3', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()} placeholder="Search…" autoFocus
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d6e7e3', borderRadius: 8, fontSize: 14, background: '#f7fbfa' }}
                />
              </div>
            )}
            {filtered.map((opt) => {
              const on = stdSelected.includes(opt);
              return (
                <div
                  key={opt} onClick={() => toggle(opt)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: on ? '#eef7f6' : '#fff', borderBottom: '1px solid #f0f6f5',
                  }}
                >
                  {checkBox(on)}
                  <span style={{ color: on ? '#0e3b39' : '#5c7a76', fontWeight: on ? 600 : 400 }}>{opt}</span>
                </div>
              );
            })}
            {allowOther && (!search || 'other'.includes(search.toLowerCase())) && (
              <>
                <div onClick={() => toggle('Other')}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: isOtherOn ? '#eef7f6' : '#fff', borderBottom: '1px solid #f0f6f5',
                  }}
                >
                  {checkBox(isOtherOn)}
                  <span style={{ color: isOtherOn ? '#0e3b39' : '#5c7a76', fontWeight: isOtherOn ? 600 : 400 }}>Other</span>
                </div>
                {isOtherOn && (
                  <div style={{ padding: '4px 14px 10px', background: '#eef7f6' }}>
                    <input
                      value={otherText}
                      onChange={(e) => onChange(buildVal(stdSelected, e.target.value, true))}
                      onClick={(e) => e.stopPropagation()} placeholder="Type here…" autoFocus
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #d6e7e3', borderRadius: 8, fontSize: 14, background: '#fff' }}
                    />
                  </div>
                )}
              </>
            )}
            {searchable && search && filtered.length === 0 && (
              <div style={{ padding: '14px', color: '#98b0ab', fontSize: 14, textAlign: 'center' }}>No matches</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function TimePicker12h({ value, onChange, disabled }) {
  let hr = '', min = '', ap = 'AM';
  if (value) {
    const m = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m) { hr = m[1]; min = m[2]; ap = m[3].toUpperCase(); }
  }
  const build = (h, m, a) => {
    if (!h) return '';
    return h + ':' + (m || '00').padStart(2, '0') + ' ' + a;
  };
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const selStyle = { ...fieldStyle, flex: 1, minWidth: 0, ...(disabled ? roStyle : {}) };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select value={hr} onChange={(e) => onChange(build(e.target.value, min, ap))} style={selStyle} disabled={disabled}>
        <option value="">Hr</option>
        {hours.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select value={min} onChange={(e) => onChange(build(hr, e.target.value, ap))} style={selStyle} disabled={disabled}>
        <option value="">Min</option>
        {mins.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={ap} onChange={(e) => onChange(build(hr, min, e.target.value))} style={selStyle} disabled={disabled}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmtTime(t) {
  if (!t) return '—';
  if (/AM|PM/i.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return '—';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return hr + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}
function dash(x) { return (x === undefined || x === null || x === '') ? '—' : x; }

export default function Clinical({
  cur, hasHistory, cform, onSetField,
  showTreatmentOther, showAdvisedTreatmentOther, prevPending, prevPendingLabel, amountToCollect, amountToCollectLabel, computedBalance, computedBalanceLabel, balanceColor,
  hasPending, noPending, pendingTotalLabel, pendingList,
  hasQr, noQr, qrUrl, qrUploadLabel, onUploadQr,
  showQr, onOpenQr, onCloseQr,
  savedFlash, onGoBack, onSaveClinical, saving, error,
  apptCountText, showApptCount,
  db, curPatientId,
  readOnly, onCreateNewVisit,
}) {
  const [detailVisit, setDetailVisit] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const remaining = amountToCollect - num(cform.amountPaid);
  const computedStatus = remaining <= 0 ? 'Fully Paid' : (num(cform.amountPaid) > 0 ? 'Partially paid' : 'Not paid');
  const statusColorMap = { 'Fully Paid': ['#e3f5ec', '#12805a'], 'Partially paid': ['#fdf0dc', '#a9741a'], 'Not paid': ['#fdecea', '#c0392b'] };
  const scm = statusColorMap[computedStatus] || ['#eef4f3', '#8aa8a3'];

  let detail = null;
  if (detailVisit && db) {
    const dp = db.patients[detailVisit.pid];
    const dv = dp && dp.visits.find((x) => x.visitId === detailVisit.visitId);
    if (dv) {
      const c = dv.clinical || {};
      const trd = (/Other/.test(c.treatment) && c.treatmentOther) ? c.treatmentOther : c.treatment;
      const advTrd = (/Other/.test(c.advisedTreatment) && c.advisedTreatmentOther) ? c.advisedTreatmentOther : c.advisedTreatment;
      detail = {
        title: dv.visitId, dateLabel: fmtDate(dv.date), name: dp.name,
        rows: [
          { k: 'Patient type', v: dash(c.patientType) },
          { k: 'Medical history', v: dash(c.medicalHistory) },
          { k: 'Chief complaint', v: dash(c.chiefComplaint) }, { k: 'Description', v: dash(c.chiefDescription) },
          { k: 'Treatment group', v: dash(c.treatmentGroup) }, { k: 'Current treatment', v: dash(trd) },
          { k: 'Advised treatment', v: dash(advTrd) },
          { k: 'Tooth number', v: dash(c.toothNumber) },
          { k: 'Treatment cost', v: c.treatmentCost ? inr(num(c.treatmentCost)) : '—' },
          { k: 'Amount paid', v: c.amountPaid ? inr(num(c.amountPaid)) : '—' },
          { k: 'Balance due', v: c.balanceDue ? inr(num(c.balanceDue)) : '—' },
          { k: 'Payment mode', v: dash(c.paymentMode) }, { k: 'Payment status', v: dash(c.paymentStatus) },
          { k: 'Treatment stage', v: dash(c.treatmentStage) }, { k: 'Google review taken', v: dash(c.googleReviewTaken) },
          { k: 'Next appointment', v: c.nextAppointment ? fmtDate(c.nextAppointment) : '—' },
          { k: 'Next appointment time', v: fmtTime(c.nextAppointmentTime) },
          { k: 'Comments', v: dash(c.comments) },
        ],
      };
    }
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <button
        onClick={onGoBack}
        style={{
          ...TOUCH_BTN, justifyContent: 'flex-start', border: 0, background: 'none', color: '#0e756c',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '10px 0', marginBottom: 4, marginLeft: -2,
        }}
      >
        &larr; Back
      </button>

      <div
        style={{
          background: 'linear-gradient(135deg,#0e756c,#0e3b39)', borderRadius: 18, padding: '22px 24px',
          color: '#fff', display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7fd4c9', fontWeight: 700 }}>
            {readOnly ? 'Appointment · Visit details' : 'Doctor · Clinical record'}
          </span>
          <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 26, marginTop: 4 }}>{cur.name}</h1>
          <p style={{ color: '#bfe3dd', fontSize: 14, marginTop: 2 }}>{cur.ageGender} · {cur.mobile}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontFamily: 'ui-monospace,monospace', fontSize: 13, color: '#bfe3dd' }}>Patient {cur.patientId}</span>
          <span style={{ display: 'block', fontFamily: 'ui-monospace,monospace', fontSize: 18, fontWeight: 700 }}>{cur.visitId}</span>
          <span style={{ display: 'block', fontSize: 13, color: '#bfe3dd', marginTop: 2 }}>{cur.dateLabel}</span>
        </div>
      </div>

      {hasHistory && (
        <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: '20px 24px', marginTop: 16 }}>
          <h3 style={{ ...h3Style, marginBottom: 4 }}>Visit history</h3>
          <p style={{ color: '#98b0ab', fontSize: 12.5, marginBottom: 12 }}>Tap a row to see everything recorded at that visit.</p>
          {(() => {
            const visibleHistory = showAllHistory ? cur.history : cur.history.slice(-2);
            const hasMore = cur.history.length > 2 && !showAllHistory;
            return (
              <>
                <div className="table-view" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 600 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#7a9994', fontSize: 11.5, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Visit</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Date</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Treatment</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Cost</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Balance</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '8px 10px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleHistory.map((h) => (
                        <tr
                          key={h.visitId}
                          onClick={() => setDetailVisit({ pid: curPatientId, visitId: h.visitId })}
                          style={{ borderTop: '1px solid #eef4f3', background: h.rowBg, cursor: 'pointer' }}
                        >
                          <td style={{ padding: '9px 10px', fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#0e756c', fontWeight: 600 }}>{h.visitId}</td>
                          <td style={{ padding: '9px 10px', color: '#5c7a76' }}>{h.dateLabel}</td>
                          <td style={{ padding: '9px 10px', color: '#5c7a76' }}>{h.treatmentLabel}</td>
                          <td style={{ padding: '9px 10px', color: '#33534f' }}>{h.cost}</td>
                          <td style={{ padding: '9px 10px', color: '#33534f' }}>{h.balance}</td>
                          <td style={{ padding: '9px 10px', color: '#5c7a76' }}>{h.status}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: '#0e756c', fontWeight: 700, fontSize: 12 }}>View &rarr;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card-view">
                  {visibleHistory.map((h) => (
                    <div
                      key={h.visitId}
                      onClick={() => setDetailVisit({ pid: curPatientId, visitId: h.visitId })}
                      style={{ padding: '10px 12px', borderTop: '1px solid #eef4f3', background: h.rowBg, display: 'flex', flexDirection: 'column', gap: 3, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#0e756c', fontWeight: 600 }}>{h.visitId}</span>
                        <span style={{ fontSize: 12, color: '#5c7a76' }}>{h.dateLabel}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#5c7a76' }}>{h.treatmentLabel}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, color: '#33534f' }}>
                          Cost {h.cost} · Balance {h.balance} · {h.status}
                        </span>
                        <span style={{ color: '#0e756c', fontWeight: 700, fontSize: 12 }}>View &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <button
                    onClick={() => setShowAllHistory(true)}
                    style={{ display: 'block', width: '100%', padding: '12px 0', border: 0, borderTop: '1px solid #eef4f3', background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
                  >
                    View more ({cur.history.length - 2} earlier visits)
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: 24, marginTop: 16 }}>
        <h3 style={{ ...h3Style, marginBottom: 16 }}>Doctor's form</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Patient type</label>
            <select
              value={cform.patientType} onChange={(e) => { onSetField('patientType', e.target.value); onSetField('toothNumber', ''); }}
              style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            >
              <option value="">Select…</option>
              {PATIENT_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Medical history</label>
            <textarea
              value={cform.medicalHistory} onChange={(e) => onSetField('medicalHistory', e.target.value)}
              placeholder="Known medical conditions, allergies, medications…"
              style={{ ...fieldStyle, minHeight: 68, resize: 'vertical', ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            />
          </div>
          <div>
            <label style={labelStyle}>Chief complaint</label>
            <MultiSelect
              value={cform.chiefComplaint} options={CHIEF_COMPLAINTS}
              onChange={(v) => onSetField('chiefComplaint', v)} placeholder="Select…" disabled={readOnly}
              allowOther
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input
              className="fld" value={cform.chiefDescription} onChange={(e) => onSetField('chiefDescription', e.target.value)}
              placeholder="Notes on the chief complaint" style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            />
          </div>
          <div>
            <label style={labelStyle}>Treatment group</label>
            <MultiSelect
              value={cform.treatmentGroup} options={TREATMENT_GROUPS}
              onChange={(v) => onSetField('treatmentGroup', v)} placeholder="Select…" disabled={readOnly}
              allowOther
            />
          </div>
          <div>
            <label style={labelStyle}>Current treatment</label>
            <MultiSelect
              value={cform.treatment} options={TREATMENTS}
              onChange={(v) => onSetField('treatment', v)} placeholder="Select…" disabled={readOnly}
              allowOther
            />
          </div>
          <div>
            <label style={labelStyle}>Advised treatment</label>
            <MultiSelect
              value={cform.advisedTreatment} options={TREATMENTS}
              onChange={(v) => onSetField('advisedTreatment', v)} placeholder="Select…" disabled={readOnly}
              allowOther
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Tooth number</label>
            <MultiSelect
              value={cform.toothNumber} options={cform.patientType === 'Kid' ? TOOTH_NUMBERS_KID : TOOTH_NUMBERS}
              onChange={(v) => onSetField('toothNumber', v)} placeholder="Select…" disabled={readOnly}
              searchable
            />
          </div>
        </div>

        <h3 style={{ ...h3Style, margin: '24px 0 16px' }}>Billing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: FLUID_GRID_2COL, gap: 16 }}>
          <div>
            <label style={labelStyle}>Charges for this visit (₹)</label>
            <input
              className="fld" value={cform.treatmentCost} onChange={(e) => onSetField('treatmentCost', e.target.value)}
              type="number" min="0" placeholder="0" style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            />
          </div>
          <div>
            <label style={labelStyle}>Pending payment <span style={{ color: '#98b0ab', fontWeight: 400 }}>(auto)</span></label>
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', background: '#f7fbfa', border: '1px solid #e2efec', color: prevPending > 0 ? '#c0392b' : '#12805a', fontWeight: 700 }}>
              {prevPendingLabel}
            </div>
          </div>
          <div
            style={{
              gridColumn: '1 / -1', borderRadius: 12, padding: '14px 16px', background: '#f2f9f8', border: '1px solid #cfe3df',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: '#5c7a76' }}>
              Amount to be collected = charges for this visit + pending payment
            </span>
            <span style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#0e3b39' }}>
              {amountToCollectLabel}
            </span>
          </div>
          <div>
            <label style={labelStyle}>Paid in this visit (₹)</label>
            <input
              className="fld" value={cform.amountPaid} onChange={(e) => onSetField('amountPaid', e.target.value)}
              type="number" min="0" placeholder="0" style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            />
          </div>
          <div>
            <label style={labelStyle}>Payment mode</label>
            <select value={cform.paymentMode} onChange={(e) => onSetField('paymentMode', e.target.value)} style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}>
              <option value="">Select…</option>
              {PAYMENT_MODES.map((pm) => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Payment status <span style={{ color: '#98b0ab', fontWeight: 400 }}>(auto)</span></label>
            <div style={{ padding: '11px 14px', border: '1px solid #e2efec', borderRadius: 10, background: '#f7fbfa', display: 'flex', alignItems: 'center' }}>
              <span style={{ display: 'inline-block', padding: '5px 13px', borderRadius: 100, fontSize: 13.5, fontWeight: 700, background: scm[0], color: scm[1] }}>
                {computedStatus}
              </span>
            </div>
          </div>
        </div>

        {!readOnly && <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 240, borderRadius: 12, padding: '14px 16px', background: '#fdf6f4', border: '1px solid #f6d3c8' }}>
            {hasPending && (
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#b0442a' }}>
                  Total pending (all visits)
                </span>
                <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 24, color: '#c0392b', marginTop: 2 }}>
                  {pendingTotalLabel}
                </span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pendingList.map((pd) => (
                    <span key={pd.visitId} style={{ fontSize: 13, color: '#8a5b4e' }}>
                      <span style={{ fontFamily: 'ui-monospace,monospace', color: '#c0392b', fontWeight: 600 }}>{pd.visitId}</span> · {pd.dateLabel} — <strong>{pd.amount}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {noPending && (
              <span style={{ fontSize: 14, color: '#12805a', fontWeight: 600 }}>✓ No pending balance for this patient.</span>
            )}
          </div>
          <div style={{ flex: '0 0 168px', borderRadius: 12, padding: 14, background: '#f2f9f8', border: '1px dashed #cfe3df', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0e756c', marginBottom: 8 }}>UPI scanner</span>
            <button
              onClick={onOpenQr} title="Show UPI scanner"
              style={{
                width: 88, height: 88, borderRadius: 12, border: '1px solid #cfe3df', background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', margin: '0 auto',
              }}
            >
              {hasQr && <img src={qrUrl} alt="UPI QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              {noQr && (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0e756c" strokeWidth="1.7">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3M20 14v.01M14 20h.01M20 20v-3" />
                </svg>
              )}
            </button>
            <label style={{ display: 'block', minHeight: 44, padding: '10px 0', marginTop: 3, fontSize: 12, fontWeight: 700, color: '#0e756c', cursor: 'pointer', textDecoration: 'underline' }}>
              {qrUploadLabel}
              <input type="file" accept="image/*" onChange={onUploadQr} style={{ display: 'none' }} />
            </label>
          </div>
        </div>}

        <h3 style={{ ...h3Style, margin: '24px 0 16px' }}>Follow-up</h3>
        <div style={{ display: 'grid', gridTemplateColumns: FLUID_GRID_2COL, gap: 16 }}>
          <div>
            <label style={labelStyle}>Treatment stage</label>
            <select value={cform.treatmentStage} onChange={(e) => onSetField('treatmentStage', e.target.value)} style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}>
              <option value="">Select…</option>
              {TREATMENT_STAGES.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
            </select>
          </div>
          {cform.treatmentStage === 'Complete' && (
            <div>
              <label style={labelStyle}>Google review taken</label>
              <select value={cform.googleReviewTaken} onChange={(e) => onSetField('googleReviewTaken', e.target.value)} style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly}>
                <option value="">Select…</option>
                {YES_NO.map((yn) => <option key={yn} value={yn}>{yn}</option>)}
              </select>
            </div>
          )}
          {(cform.treatmentStage === 'In Progress' || cform.treatmentStage === 'Follow Up Pending') && (
            <>
              <div>
                <label style={labelStyle}>Next appointment date</label>
                <input type="date" value={cform.nextAppointment} onChange={(e) => onSetField('nextAppointment', e.target.value)} style={{ ...fieldStyle, ...(readOnly ? roStyle : {}) }} disabled={readOnly} />
                {showApptCount && (
                  <p style={{ marginTop: 7, fontSize: 13, color: '#0e756c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#12a094' }} />
                    {apptCountText}
                  </p>
                )}
              </div>
              {cform.nextAppointment && (
                <div>
                  <label style={labelStyle}>Next appointment time</label>
                  <TimePicker12h value={cform.nextAppointmentTime} onChange={(v) => onSetField('nextAppointmentTime', v)} disabled={readOnly} />
                </div>
              )}
            </>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Comments</label>
            <textarea
              value={cform.comments} onChange={(e) => onSetField('comments', e.target.value)}
              placeholder="Any notes for this visit…"
              style={{ ...fieldStyle, minHeight: 84, resize: 'vertical', ...(readOnly ? roStyle : {}) }} disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {savedFlash && (
        <p style={{ marginTop: 14, color: '#0e756c', fontSize: 14, fontWeight: 700 }}>✓ Record saved.</p>
      )}
      {error && (
        <p style={{ marginTop: 14, color: '#c0392b', fontSize: 14, fontWeight: 600 }}>{error}</p>
      )}

      {readOnly ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onGoBack}
            style={{ ...TOUCH_BTN, padding: '11px 20px', borderRadius: 10, border: '1px solid #d6e7e3', background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Back
          </button>
          <button
            onClick={onCreateNewVisit}
            style={{
              ...TOUCH_BTN, padding: '11px 22px', borderRadius: 10, border: 0, background: '#12a094', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Create New Visit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onGoBack}
            style={{ ...TOUCH_BTN, padding: '11px 20px', borderRadius: 10, border: '1px solid #d6e7e3', background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onSaveClinical}
            disabled={saving}
            style={{
              ...TOUCH_BTN, padding: '11px 22px', borderRadius: 10, border: 0, background: '#0e756c', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {detail && (
        <div
          onClick={() => setDetailVisit(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,59,57,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 0, maxWidth: 480, width: '100%', maxHeight: '82vh', overflow: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, background: '#0e3b39', color: '#fff', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
              <div>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, color: '#7fd4c9', fontWeight: 700 }}>{detail.title}</span>
                <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17 }}>{detail.name} · {detail.dateLabel}</h3>
              </div>
              <button
                onClick={() => setDetailVisit(null)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '8px 22px 22px' }}>
              {detail.rows.map((r) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid #f0f6f5' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#8aa8a3', flex: '0 0 auto' }}>{r.k}</span>
                  <span style={{ fontSize: 14, color: '#33534f', textAlign: 'right' }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showQr && (
        <div
          onClick={onCloseQr}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,59,57,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 18, color: '#0e3b39' }}>Scan to pay via UPI</h3>
            {hasQr && (
              <img src={qrUrl} alt="UPI QR scanner" style={{ width: '100%', maxWidth: 280, margin: '16px auto 0', borderRadius: 12, display: 'block' }} />
            )}
            {noQr && (
              <p style={{ color: '#8aa8a3', fontSize: 14, margin: '18px 0' }}>
                No scanner uploaded yet. Use "Upload scanner" under the UPI scanner tile to add one.
              </p>
            )}
            <button
              onClick={onCloseQr}
              style={{ ...TOUCH_BTN, marginTop: 18, padding: '11px 22px', borderRadius: 10, border: 0, background: '#0e3b39', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
