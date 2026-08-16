import { GENDERS } from '../options';
import { TOUCH_BTN, FLUID_GRID_2COL } from '../styles';

const fieldStyle = {
  width: '100%', minHeight: 44, padding: '12px 14px', border: '1px solid #d6e7e3', borderRadius: 10,
  fontSize: 15, background: '#f7fbfa',
};
const labelStyle = { display: 'block', fontWeight: 700, fontSize: 13.5, color: '#33534f', marginBottom: 7 };

export default function Intake({
  form, onSetField, onLookup, lookupState, existingPatientId, nextVisitNo,
  previewPatientId, previewVisitId,
  mobilePatients, addAnother, onSelectPatient, onAddAnother, onCancelAddAnother,
  intakeError, onGoBack, onSaveIntake, saving,
}) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <p style={{ color: '#12a094', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 12.5 }}>
        Reception · Patient intake
      </p>
      <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 28, color: '#0e3b39', marginTop: 6 }}>
        Register a visit
      </h1>
      <p style={{ color: '#5c7a76', fontSize: 15, marginTop: 6 }}>
        Enter the mobile number first. A known number loads the existing patient; a new number creates a new patient ID.
      </p>

      <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: 24, marginTop: 20 }}>
        <label style={labelStyle}>
          Mobile number <span style={{ color: '#ef5a3c' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="fld" value={form.mobile}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              onSetField('mobile', digits);
              if (digits.length === 10) setTimeout(() => onLookup(digits), 0);
            }}
            inputMode="numeric" placeholder="e.g. 9876543210" maxLength={10}
            style={{ flex: 1, minWidth: 200, ...fieldStyle }}
          />
          <button
            onClick={onLookup}
            style={{ ...TOUCH_BTN, padding: '12px 20px', borderRadius: 10, border: 0, background: '#0e3b39', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}
          >
            Look up
          </button>
        </div>

        {lookupState === 'existing' && !addAnother && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '13px 16px', borderRadius: 12, background: '#e6f4f2', border: '1px solid #c9e6e1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#0e756c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                ✓
              </span>
              <span style={{ fontSize: 14, color: '#0e3b39' }}>
                <strong>Returning patient — {form.name}</strong> ({existingPatientId}). This will be visit <strong>#{nextVisitNo}</strong>. Details are pre-filled below.
              </span>
            </div>

            {mobilePatients.length > 1 && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
                <span style={{ fontSize: 12.5, color: '#7a9994', fontWeight: 600 }}>On this number:</span>
                {mobilePatients.map((p) => (
                  <button
                    key={p.patientId}
                    onClick={() => onSelectPatient(p.patientId)}
                    style={{
                      ...TOUCH_BTN, padding: '5px 12px', borderRadius: 100, border: '1px solid ' + (p.patientId === existingPatientId ? '#12a094' : '#d6e7e3'),
                      background: p.patientId === existingPatientId ? '#e6f4f2' : '#fff',
                      color: p.patientId === existingPatientId ? '#0e756c' : '#5c7a76',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10, padding: '0 4px' }}>
              <span
                onClick={onAddAnother}
                style={{ fontSize: 13, color: '#8aa8a3', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Someone else on this number? Add another patient
              </span>
            </div>
          </div>
        )}

        {lookupState === 'existing' && addAnother && (
          <div style={{ marginTop: 14, padding: '13px 16px', borderRadius: 12, background: '#fdf6f4', border: '1px solid #f6d3c8', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#8a5b4e' }}>
              Adding another patient on this number — enter a different name (a new Patient ID is created).
            </span>
            <span
              onClick={onCancelAddAnother}
              style={{ fontSize: 13, color: '#b0442a', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
            >
              Cancel
            </span>
          </div>
        )}

        {lookupState === 'new' && (
          <div style={{ marginTop: 14, padding: '13px 16px', borderRadius: 12, background: '#fdf0ec', border: '1px solid #f6d3c8', fontSize: 14, color: '#b0442a' }}>
            <strong>New patient.</strong> A fresh Patient ID will be generated on save.
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: 24, marginTop: 16, display: 'grid', gridTemplateColumns: FLUID_GRID_2COL, gap: 16 }}>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, padding: '12px 15px', borderRadius: 12, background: '#f2f9f8', border: '1px dashed #cfe3df' }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8aa8a3' }}>Patient ID</span>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 16, fontWeight: 700, color: '#0e756c' }}>{previewPatientId}</span>
          </div>
          <div style={{ flex: 1, minWidth: 150, padding: '12px 15px', borderRadius: 12, background: '#f2f9f8', border: '1px dashed #cfe3df' }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8aa8a3' }}>Visit ID (auto)</span>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 16, fontWeight: 700, color: '#0e756c' }}>{previewVisitId}</span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>
            Date <span style={{ color: '#ef5a3c' }}>*</span>
          </label>
          <input type="date" value={form.date} onChange={(e) => onSetField('date', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>
            Gender <span style={{ color: '#ef5a3c' }}>*</span>
          </label>
          <select value={form.gender} onChange={(e) => onSetField('gender', e.target.value)} style={fieldStyle}>
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Full name <span style={{ color: '#ef5a3c' }}>*</span>
          </label>
          <input className="fld" value={form.name} onChange={(e) => onSetField('name', e.target.value)} placeholder="Patient name" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>
            Age <span style={{ color: '#ef5a3c' }}>*</span>
          </label>
          <input
            className="fld" value={form.age} onChange={(e) => onSetField('age', e.target.value)}
            type="number" min="0" max="120" placeholder="Years" style={fieldStyle}
          />
        </div>
      </div>

      {intakeError && (
        <p style={{ marginTop: 14, color: '#c0392b', fontSize: 14, fontWeight: 600 }}>{intakeError}</p>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={onGoBack}
          style={{ ...TOUCH_BTN, padding: '13px 22px', borderRadius: 11, border: '1px solid #d6e7e3', background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={onSaveIntake}
          disabled={saving}
          style={{
            ...TOUCH_BTN, flex: 1, padding: '13px 22px', borderRadius: 11, border: 0, background: '#ef5a3c', color: '#fff',
            fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Create visit & open doctor form →'}
        </button>
      </div>
    </div>
  );
}
