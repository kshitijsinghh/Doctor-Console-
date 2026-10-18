import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { defaultConfig, mergeConfig } from './formConfig';
import { fetchDoctorFormSettings, createMedicine } from './settingsApi';

// One load at boot, shared by the doctor's form and anything else that needs
// to know what the form is configured to show.
//
// It never blocks and never fails loudly: a clinic whose settings call errors
// gets the default configuration, which is the form exactly as it is today.
// The alternative — a doctor staring at a spinner or an empty form because a
// config fetch timed out — is far worse than ignoring their customisation for
// one session.

// Exported so a test can render the doctor's form against a chosen
// configuration without standing up the API.
export const FormConfigContext = createContext({
  config: defaultConfig(),
  medicines: [],
  loaded: false,
  addMedicines: async () => [],
  reload: () => {},
});

export function FormConfigProvider({ children }) {
  const [config, setConfig] = useState(defaultConfig);
  const [medicines, setMedicines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchDoctorFormSettings();
        if (!alive) return;
        setConfig(mergeConfig(r));
        setMedicines(Array.isArray(r.medicines) ? r.medicines : []);
        setLoaded(true);
      } catch {
        // Defaults stand. Deliberately silent: the console has nothing useful
        // to tell a doctor mid-consultation about a settings fetch, and the
        // form in front of them works.
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [nonce]);

  // Save medicines the doctor wrote on a prescription but has never added to
  // their library.
  //
  // Sequential, not parallel: the server checks the existing names before
  // inserting, so two creates in flight at once can both pass the check and
  // both insert. A prescription has a handful of rows, so the cost is nothing.
  //
  // Every failure is swallowed. This runs after a visit has already been
  // saved, and a duplicate or a dropped connection must never surface as
  // something going wrong with the visit.
  const addMedicines = useCallback(async (list) => {
    const saved = [];
    for (const med of (list || [])) {
      try {
        const row = await createMedicine(med);
        if (row) saved.push(row);
      } catch { /* the visit is already saved; the library can catch up later */ }
    }
    if (saved.length) setMedicines((cur) => cur.concat(saved));
    return saved;
  }, []);

  const value = useMemo(
    () => ({ config, medicines, loaded, addMedicines, reload: () => setNonce((n) => n + 1) }),
    [config, medicines, loaded, addMedicines],
  );
  return <FormConfigContext.Provider value={value}>{children}</FormConfigContext.Provider>;
}

export function useFormConfig() {
  return useContext(FormConfigContext);
}
