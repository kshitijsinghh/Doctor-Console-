// Consent templates for the clinic, and the consents raised on one visit.
//
// Fails closed, deliberately. If the endpoint is missing, unreachable or
// returns nothing, `templates` stays empty — and the console hides consent
// entirely. A clinic that has not set consent up, and a clinic whose backend
// is not deployed yet, look identical and neither sees a broken feature.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listTemplates, listConsents } from './consentsApi';

export const ConsentsContext = createContext({
  templates: [],
  templatesById: {},
  consents: [],
  loaded: false,
  enabled: false,
  reloadConsents: async () => {},
  applyConsent: () => {},
});

export const useConsents = () => useContext(ConsentsContext);

export function ConsentsProvider({ visitId, children }) {
  const [templates, setTemplates] = useState([]);
  const [consents, setConsents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Templates are clinic-wide and change rarely, so they load once.
  useEffect(() => {
    let alive = true;
    listTemplates()
      .then((rows) => { if (alive) setTemplates(rows || []); })
      .catch(() => { if (alive) setTemplates([]); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const reloadConsents = useCallback(async () => {
    if (!visitId) { setConsents([]); return []; }
    try {
      const rows = await listConsents({ visitId });
      setConsents(rows || []);
      return rows || [];
    } catch {
      // Leave whatever is on screen rather than blanking the list: a failed
      // refresh must not make it look as though nothing was ever sent.
      return consents;
    }
  }, [visitId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A different visit is a different set of consents. Cleared first so one
  // visit's forms are never shown under another visit's name.
  useEffect(() => {
    setConsents([]);
    if (!visitId || !templates.length) return;
    let alive = true;
    listConsents({ visitId })
      .then((rows) => { if (alive) setConsents(rows || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [visitId, templates.length]);

  // Replaces one consent in place after send, resend, cancel or signing, so
  // the bar updates without a round trip.
  const applyConsent = useCallback((row) => {
    if (!row) return;
    const id = row.consentId || row.id;
    setConsents((cur) => {
      const i = cur.findIndex((c) => (c.consentId || c.id) === id);
      if (i === -1) return [row, ...cur];
      const next = cur.slice();
      next[i] = { ...next[i], ...row };
      return next;
    });
  }, []);

  const templatesById = useMemo(() => {
    const map = {};
    (templates || []).forEach((t) => { if (t && t.templateId) map[t.templateId] = t; });
    return map;
  }, [templates]);

  const value = useMemo(() => ({
    templates,
    templatesById,
    consents,
    loaded,
    // The one flag the rest of the console asks about.
    enabled: templates.length > 0,
    reloadConsents,
    applyConsent,
  }), [templates, templatesById, consents, loaded, reloadConsents, applyConsent]);

  return <ConsentsContext.Provider value={value}>{children}</ConsentsContext.Provider>;
}
