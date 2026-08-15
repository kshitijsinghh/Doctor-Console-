import { TOUCH_BTN } from '../styles';

export default function Appointments({ appts, hasAppts, noAppts, apptDate, onSetApptDate, onApptToday, apptDateLabel }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 22, color: '#0e3b39' }}>
            Appointments
          </h2>
          <p style={{ color: '#5c7a76', fontSize: 14.5, marginTop: 2 }}>
            Scheduled for {apptDateLabel}, earliest first.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={apptDate}
            onChange={(e) => onSetApptDate(e.target.value)}
            style={{
              minHeight: 44, padding: '10px 12px', border: '1px solid #cfe3df', borderRadius: 10,
              fontSize: 14, background: '#fff', color: '#0e3b39', fontWeight: 600,
            }}
          />
          <button
            onClick={onApptToday}
            style={{
              ...TOUCH_BTN, padding: '10px 14px', borderRadius: 10, border: '1px solid #cfe3df',
              background: '#f2f9f8', color: '#0e756c', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Today
          </button>
        </div>
      </div>

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
