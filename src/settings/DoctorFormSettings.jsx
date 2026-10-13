import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FIELD_DEFS, DROPDOWN_DEFS, defaultConfig, mergeConfig, fieldOn, setField,
} from './formConfig';
import { createAutosave, statusLabel, SAVING, ERROR } from './autosave';
import {
  fetchDoctorFormSettings, saveDoctorFormSettings,
  createMedicine, updateMedicine, deleteMedicine,
} from './settingsApi';
import FieldsTab from './FieldsTab';
import DropdownsTab from './DropdownsTab';
import MedicinesTab from './MedicinesTab';
import { Toast, INK, TEAL, MUTED, LINE } from './ui';

const TABS = [
  { k: 'fields', label: 'Form fields' },
  { k: 'drop', label: 'Dropdown values' },
  { k: 'meds', label: 'My medicines' },
];

function StatusPill({ state }) {
  const tone = state === ERROR
    ? { color: '#b3261e', dot: '#b3261e' }
    : state === SAVING
      ? { color: MUTED, dot: '#e8a33a' }
      : { color: '#12805a', dot: null };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
      borderRadius: 100, background: '#fff', border: '1px solid ' + LINE,
      fontSize: 12.5, fontWeight: 700, color: tone.color,
    }}>
      {tone.dot
        ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot }} />
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
      {statusLabel(state)}
    </span>
  );
}

export default function DoctorFormSettings({ onBack }) {
  const [config, setConfig] = useState(defaultConfig);
  const [medicines, setMedicines] = useState([]);
  const [tab, setTab] = useState('fields');
  const [saveState, setSaveState] = useState('idle');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Autosave is armed only after a successful load.
  //
  // Without this, a clinic whose settings call fails once would have the
  // DEFAULT config saved straight over whatever they had configured, the first
  // time anyone touched a switch. A read failure must never become a write.
  const loaded = useRef(false);
  const saverRef = useRef(null);
  const toastTimer = useRef(null);

  const say = (t) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchDoctorFormSettings();
        if (!alive) return;
        setConfig(mergeConfig(r));
        setMedicines(Array.isArray(r.medicines) ? r.medicines : []);
        loaded.current = true;
      } catch (e) {
        if (!alive) return;
        // The form keeps working on defaults; only saving is held back.
        setLoadError(String((e && e.message) || 'Could not load your settings.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const saver = createAutosave({
      send: saveDoctorFormSettings,
      onState: setSaveState,
    });
    saverRef.current = saver;
    return () => { saver.flush(); saver.stop(); clearTimeout(toastTimer.current); };
  }, []);

  function change(next) {
    setConfig(next);
    if (loaded.current && saverRef.current) saverRef.current.push(next);
  }

  async function saveMedicine(med) {
    const saved = med.id
      ? await updateMedicine(med.id, med)
      : await createMedicine(med);
    const row = saved || { ...med, id: med.id || med.name };
    setMedicines((list) => (med.id
      ? list.map((m) => (m.id === med.id ? row : m))
      : [row].concat(list)));
  }

  async function removeMedicine(id) {
    await deleteMedicine(id);
    setMedicines((list) => list.filter((m) => m.id !== id));
  }

  const counts = useMemo(() => ({
    fields: FIELD_DEFS.filter((f) => fieldOn(config, f.k)).length + '/' + FIELD_DEFS.length,
    drop: String(DROPDOWN_DEFS.length),
    meds: String(medicines.length),
  }), [config, medicines.length]);

  const tabBtn = (on) => ({
    padding: '11px 16px', border: 0, background: 'transparent', fontWeight: 700,
    fontSize: 14.5, color: on ? INK : MUTED, cursor: 'pointer', whiteSpace: 'nowrap',
    borderBottom: '2.5px solid ' + (on ? TEAL : 'transparent'), marginBottom: -1, minHeight: 44,
  });

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 70px' }}>
      <style>{'.no-spin::-webkit-inner-spin-button,.no-spin::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.no-spin{-moz-appearance:textfield}'}</style>

      <div style={{ marginBottom: 16 }}>
        {!!onBack && (
          <button type="button" onClick={onBack}
            style={{ border: 0, background: 'none', color: TEAL, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', padding: '4px 0', marginBottom: 6, minHeight: 36 }}>
            ← Back
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 24, color: INK }}>
            Doctor&rsquo;s form settings
          </h1>
          {!loading && !loadError && <StatusPill state={saveState} />}
        </div>
        <p style={{ fontSize: 14, color: MUTED, marginTop: 2, textWrap: 'pretty' }}>
          Choose what appears in the doctor&rsquo;s form, edit dropdown lists, and keep a list of
          your usual medicines. Changes apply to new visits; saved visits keep what was recorded.
        </p>
      </div>

      {!!loadError && (
        <div style={{
          background: '#fdf0ec', border: '1px solid #f0d9d3', borderRadius: 12,
          padding: '12px 16px', marginBottom: 16, fontSize: 13.5, color: '#8a2c1b', textWrap: 'pretty',
        }}>
          <strong>Couldn&rsquo;t load your settings.</strong> {loadError} Showing the standard form
          below. Nothing you change here will be saved until this page loads properly — reload to
          try again, so an outage can&rsquo;t overwrite settings you already have.
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 14, color: MUTED, padding: '32px 0' }}>Loading your settings…</p>
      ) : (
        <>
          <div style={{
            display: 'flex', gap: 4, borderBottom: '1px solid #d6e7e3', marginBottom: 18,
            overflowX: 'auto', overflowY: 'hidden', paddingBottom: 1,
          }}>
            {TABS.map((t) => (
              <button key={t.k} type="button" onClick={() => setTab(t.k)} style={tabBtn(tab === t.k)}>
                {t.label}{' '}
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{counts[t.k]}</span>
              </button>
            ))}
          </div>

          {tab === 'fields' && (
            <FieldsTab config={config} onToggle={(k, on) => change(setField(config, k, on))} />
          )}
          {tab === 'drop' && (
            <DropdownsTab config={config} onChange={change} onToast={say} />
          )}
          {tab === 'meds' && (
            <MedicinesTab
              config={config}
              medicines={medicines}
              onSave={saveMedicine}
              onDelete={removeMedicine}
              onToast={say}
            />
          )}
        </>
      )}

      <Toast text={toast} />
    </main>
  );
}
