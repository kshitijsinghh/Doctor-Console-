import { useState } from 'react';
import { TOUCH_BTN } from '../styles';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toYmd(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function CalendarPicker({ selected, onSelect, apptDatesMap }) {
  const selDate = parseYmd(selected);
  const [viewYear, setViewYear] = useState(selDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selDate.getMonth());

  const todayStr = todayYmd();

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onSelect(todayStr);
  };

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{
      background: '#fff', border: '1px solid #dfece9', borderRadius: 18,
      padding: '16px 14px 12px', userSelect: 'none',
    }}>
      {/* Month/year nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
        <button onClick={prevMonth} style={{
          ...TOUCH_BTN, width: 36, height: 36, borderRadius: 10, border: '1px solid #dfece9',
          background: '#f2f9f8', color: '#0e756c', fontSize: 16, cursor: 'pointer', padding: 0,
        }}>‹</button>
        <span style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 16, color: '#0e3b39' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{
          ...TOUCH_BTN, width: 36, height: 36, borderRadius: 10, border: '1px solid #dfece9',
          background: '#f2f9f8', color: '#0e756c', fontSize: 16, cursor: 'pointer', padding: 0,
        }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#98b0ab',
            padding: '4px 0 8px', letterSpacing: '.04em', textTransform: 'uppercase',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={'e' + i} />;
          const ymd = toYmd(new Date(viewYear, viewMonth, day));
          const isSelected = ymd === selected;
          const isToday = ymd === todayStr;
          const apptCount = (apptDatesMap || {})[ymd] || 0;

          return (
            <button
              key={day}
              onClick={() => onSelect(ymd)}
              style={{
                ...TOUCH_BTN, width: '100%', aspectRatio: '1', border: 0, borderRadius: 12,
                background: isSelected ? '#0e756c' : 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, position: 'relative',
              }}
            >
              <span style={{
                fontSize: 14.5, fontWeight: isSelected || isToday ? 700 : 500,
                color: isSelected ? '#fff' : isToday ? '#0e756c' : '#0e3b39',
                lineHeight: 1,
              }}>{day}</span>
              {apptCount > 0 && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: isSelected ? '#ffd666' : '#e8a912',
                  display: 'block', flexShrink: 0,
                }} />
              )}
              {apptCount === 0 && <span style={{ width: 5, height: 5, display: 'block', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <button onClick={goToday} style={{
          ...TOUCH_BTN, padding: '7px 16px', borderRadius: 10, border: '1px solid #dfece9',
          background: '#f2f9f8', color: '#0e756c', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>Today</button>
      </div>
    </div>
  );
}

export default function Appointments({ appts, hasAppts, noAppts, apptDate, onSetApptDate, onApptToday, apptDateLabel, apptDatesMap }) {
  const [showCal, setShowCal] = useState(false);

  const handleDateSelect = (ymd) => {
    onSetApptDate(ymd);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#0e3b39' }}>
            Appointments
          </h2>
          <p style={{ color: '#5c7a76', fontSize: 14.5, marginTop: 2 }}>
            Scheduled for <strong style={{ color: '#0e3b39' }}>{apptDateLabel}</strong>, earliest first.
          </p>
        </div>
        <button
          onClick={() => setShowCal(!showCal)}
          style={{
            ...TOUCH_BTN, padding: '10px 14px', borderRadius: 10, border: '1px solid #cfe3df',
            background: showCal ? '#0e756c' : '#fff', color: showCal ? '#fff' : '#0e756c',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {showCal ? 'Hide calendar' : 'Pick date'}
        </button>
      </div>

      {showCal && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <CalendarPicker selected={apptDate} onSelect={handleDateSelect} apptDatesMap={apptDatesMap} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '0 4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8a912', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: '#5c7a76' }}>Has scheduled appointments</span>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, overflow: 'hidden' }}>
        {hasAppts && (
          <>
            <div className="table-view" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#7a9994', fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 700 }}>Time</th>
                    <th style={{ padding: '12px 12px', fontWeight: 700 }}>Patient</th>
                    <th style={{ padding: '12px 12px', fontWeight: 700 }}>Mobile</th>
                    <th style={{ padding: '12px 12px', fontWeight: 700 }}>Treatment</th>
                    <th style={{ padding: '12px 12px', fontWeight: 700 }}>Stage</th>
                    <th style={{ padding: '12px 20px', fontWeight: 700 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.visitId} style={{ borderTop: '1px solid #eef4f3' }}>
                      <td style={{ padding: '13px 20px', fontWeight: 700, color: '#0e3b39' }}>{a.timeLabel}</td>
                      <td style={{ padding: '13px 12px', color: '#33534f' }}>{a.name}</td>
                      <td style={{ padding: '13px 12px', color: '#5c7a76' }}>{a.mobile}</td>
                      <td style={{ padding: '13px 12px', color: '#5c7a76' }}>{a.treatmentLabel}</td>
                      <td style={{ padding: '13px 12px', color: '#5c7a76' }}>{a.stage}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                        <button
                          onClick={a.open}
                          style={{ ...TOUCH_BTN, padding: '8px 14px', borderRadius: 9, border: '1px solid #cfe3df', background: '#f2f9f8', color: '#0e756c', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                          View Visit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-view">
              {appts.map((a) => (
                <button
                  key={a.visitId}
                  onClick={a.open}
                  style={{
                    textAlign: 'left', border: 0, borderTop: '1px solid #eef4f3', background: '#fff',
                    padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: 14, width: '100%',
                  }}
                >
                  <span style={{
                    flex: '0 0 auto', minWidth: 64, padding: '8px 10px', borderRadius: 12,
                    background: '#e6f4f2', color: '#0e756c', fontWeight: 700, fontSize: 14,
                    textAlign: 'center', lineHeight: 1.2,
                  }}>
                    {a.timeLabel}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 15.5 }}>{a.name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#5c7a76' }}>{a.treatmentLabel} · {a.stage}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#98b0ab' }}>{a.mobile}</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0e756c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
        {noAppts && (
          <div style={{ padding: '54px 20px', textAlign: 'center', color: '#8aa8a3' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#5c7a76' }}>No appointments on {apptDateLabel}.</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>
              Pick another date, or set a "Next appointment" in a doctor form.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
