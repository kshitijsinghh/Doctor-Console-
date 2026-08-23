import { useEffect, useState, useCallback } from 'react';
import { fetchList, portalCheckin, savePatientProblem } from './api';

/* ─── helpers ─── */
function localToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function normMobile(m) { return (m || '').replace(/\D/g, ''); }
function num(x) { const n = parseFloat(x); return isNaN(n) ? 0 : n; }
function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmtTime(t) {
  if (!t) return '';
  if (/AM|PM/i.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + ap;
}
function dateParts(d) {
  if (!d) return { day: '', mon: '', yr: '' };
  try {
    const dt = new Date(d + 'T00:00:00');
    return {
      day: String(dt.getDate()),
      mon: dt.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
      yr: String(dt.getFullYear()),
    };
  } catch { return { day: '', mon: '', yr: '' }; }
}
function findAllByMobile(db, mobile) {
  const mm = normMobile(mobile);
  if (!mm || !db) return [];
  return db.order.map(id => db.patients[id]).filter(p => p.mobile === mm);
}
function treatmentLabel(c) {
  if (!c) return '—';
  return (/Other/.test(c.treatment || '') && c.treatmentOther) ? c.treatmentOther : (c.treatment || '—');
}
function complaintLabel(c) {
  if (!c) return '';
  const cc = Array.isArray(c.chiefComplaint) ? c.chiefComplaint.join(', ') : (c.chiefComplaint || '');
  return cc;
}

const SESSION_KEY = 'patient_session';
const GENDERS = ['Male', 'Female', 'Other'];
const CLINIC_NAME = 'PatientPad';

/* ─── tiny SVGs used across the portal ─── */
const ClipboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M9 12h6M9 16h4"/></svg>
);
const QrIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M20 14v.01M14 20h.01M20 20v-3"/></svg>
);
const GoogleLogo = () => (
  <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
);
const BackArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
);
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5"/></svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
);
const PlusIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
);
const HomeIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>
);
const FamilyIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M15.5 11a3 3 0 1 0-1.6-5.5"/><path d="M3 19v-1.4A3.6 3.6 0 0 1 6.6 14h4.8a3.6 3.6 0 0 1 3.6 3.6V19M17 14h.6a3.4 3.4 0 0 1 3.4 3.4V19"/></svg>
);
const CalIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0e756c" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0 }}><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>
);
const PeopleAddIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="10" cy="8" r="3.2"/><path d="M18 11h4M20 9v4"/></svg>
);

function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

/* ═══════════════════════════════════════════
   PortalApp — Patient Portal (all in one)
   ═══════════════════════════════════════════ */
export default function PortalApp() {
  /* ── data ── */
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /* ── auth ── */
  const [email, setEmail] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  const [authError, setAuthError] = useState('');

  /* ── navigation: login | register | home | records | family ── */
  const [view, setView] = useState('login');

  /* ── active patient ── */
  const [myPatientId, setMyPatientId] = useState('');

  /* ── registration form ── */
  const [reg, setReg] = useState({ mobile: '', name: '', age: '', gender: '' });
  const [regError, setRegError] = useState('');
  const [regPickedId, setRegPickedId] = useState('');
  const [regAddingMember, setRegAddingMember] = useState(false);
  const [isAddingForFamily, setIsAddingForFamily] = useState(false);
  const [savingReg, setSavingReg] = useState(false);

  /* ── problem form ── */
  const [problemDraft, setProblemDraft] = useState('');
  const [problemSaved, setProblemSaved] = useState(false);
  const [editingProblem, setEditingProblem] = useState(false);
  const [savingProblem, setSavingProblem] = useState(false);

  /* ── detail sheet ── */
  const [detailVisitId, setDetailVisitId] = useState('');

  /* ── member sheet ── */
  const [memberSheet, setMemberSheet] = useState(false);

  /* ─── helpers for state ─── */
  function applySnapshot(res) {
    setDb({ patients: res.patients, order: res.order, seq: res.seq });
  }

  /* ─── load data ─── */
  const loadList = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetchList();
      applySnapshot(res);
      setLoadError('');
    } catch {
      setLoadError('Something went wrong, please try again');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  /* ─── init: restore session, load data ─── */
  useEffect(() => {
    loadList(false);
  }, [loadList]);

  /* Once db is loaded, restore session */
  useEffect(() => {
    if (!db) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || !s.email) return;
      setEmail(s.email);
      const found = db.order.find(id => (db.patients[id].email || '').toLowerCase() === s.email.toLowerCase());
      if (found) {
        setMyPatientId(found);
        setView('home');
        // restore problem draft
        const p = db.patients[found];
        const t = localToday();
        const openV = p.visits.filter(v => !v.done && v.date === t).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
        if (openV && openV.clinical && openV.clinical.patientProblem) {
          setProblemDraft(openV.clinical.patientProblem);
          setProblemSaved(true);
        }
      } else {
        setView('register');
      }
    } catch { /* ignore */ }
    // only run once when db first loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db !== null]);

  /* ─── auth actions ─── */
  function handleGoogleSignIn() {
    const clientId = getClientId();
    if (!clientId) { setAuthError('Google Client ID not configured.'); return; }
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'email profile',
        prompt: 'select_account',
      }).toString();
    window.location.href = authUrl;
  }

  function onAuthComplete(userEmail) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: userEmail })); } catch { /* */ }
    setEmail(userEmail);
    setAuthChecking(false);
    if (!db) { setView('register'); return; }
    const found = db.order.find(id => (db.patients[id].email || '').toLowerCase() === userEmail.toLowerCase());
    if (found) {
      setMyPatientId(found);
      setView('home');
      const p = db.patients[found];
      const t = localToday();
      const openV = p.visits.filter(v => !v.done && v.date === t).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
      if (openV && openV.clinical && openV.clinical.patientProblem) {
        setProblemDraft(openV.clinical.patientProblem);
        setProblemSaved(true);
      } else {
        setProblemDraft('');
        setProblemSaved(false);
      }
    } else {
      setMyPatientId('');
      setView('register');
      setReg({ mobile: '', name: '', age: '', gender: '' });
      setRegError('');
      setRegPickedId('');
      setRegAddingMember(false);
      setIsAddingForFamily(false);
    }
  }

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;
    setAuthChecking(true);
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!accessToken) { setAuthChecking(false); return; }

    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    })
      .then(r => r.json())
      .then(info => {
        const userEmail = (info.email || '').toLowerCase();
        if (!userEmail) {
          setAuthError('Could not get your email from Google.');
          setAuthChecking(false);
          return;
        }
        onAuthComplete(userEmail);
      })
      .catch(() => { setAuthError('Something went wrong, please try again.'); setAuthChecking(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
    setEmail('');
    setMyPatientId('');
    setView('login');
    setProblemDraft('');
    setProblemSaved(false);
    setEditingProblem(false);
    setDetailVisitId('');
    setMemberSheet(false);
    setAuthError('');
  }

  /* ─── registration ─── */
  function onRegMobileChange(val) {
    const raw = val.replace(/\D/g, '').slice(0, 10);
    setReg(r => ({ ...r, mobile: raw }));
    setRegError('');
    setRegPickedId('');
    setRegAddingMember(false);
  }

  async function saveRegister() {
    const mobile = normMobile(reg.mobile);
    if (!mobile) return setRegError('Please enter your mobile number.');
    if (mobile.length !== 10) return setRegError('Please enter a valid 10-digit mobile number.');

    const existing = findAllByMobile(db, mobile);
    if (existing.length > 0 && !regPickedId && !regAddingMember) {
      return setRegError('Please select who is visiting, or add a new family member.');
    }

    const needsFields = !regPickedId || regAddingMember;
    if (needsFields) {
      if (!reg.name.trim() || !String(reg.age).trim() || !reg.gender) {
        return setRegError('Please fill your name, age and gender.');
      }
    }

    // Duplicate name check when adding member
    if (regAddingMember) {
      const nameKey = reg.name.trim().toLowerCase();
      const dup = existing.some(p => p.name.trim().toLowerCase() === nameKey);
      if (dup) return setRegError('Someone with this name is already registered on this number. Please use a different name or select them above.');
    }

    setRegError('');
    setSavingReg(true);

    const checkinName = regPickedId && db.patients[regPickedId] ? db.patients[regPickedId].name : reg.name.trim();
    const checkinAge = regPickedId && db.patients[regPickedId] ? db.patients[regPickedId].age : reg.age;
    const checkinGender = regPickedId && db.patients[regPickedId] ? db.patients[regPickedId].gender : reg.gender;

    try {
      const res = await portalCheckin({ mobile, name: checkinName, age: checkinAge, gender: checkinGender, email });
      applySnapshot(res);

      // Find the patient by email or mobile+name
      const pid = res.patientId || db.order.find(id => {
        const p = res.patients[id];
        return p.mobile === mobile && p.name.toLowerCase() === checkinName.toLowerCase();
      });

      if (pid && res.patients[pid]) {
        setMyPatientId(pid);
        setView('home');
        setProblemDraft('');
        setProblemSaved(false);
        setEditingProblem(false);
      } else {
        // Fallback: find by email
        const byEmail = res.order.find(id => (res.patients[id].email || '').toLowerCase() === email.toLowerCase());
        if (byEmail) {
          setMyPatientId(byEmail);
          setView('home');
        }
      }
      setReg({ mobile: '', name: '', age: '', gender: '' });
      setRegPickedId('');
      setRegAddingMember(false);
      setIsAddingForFamily(false);
    } catch {
      setRegError('Something went wrong, please try again.');
    } finally {
      setSavingReg(false);
    }
  }

  /* ─── problem (what's troubling you) ─── */
  async function saveProblem() {
    if (!problemDraft.trim()) return;
    const me = db.patients[myPatientId];
    if (!me) return;
    const t = localToday();
    const openV = me.visits.filter(v => !v.done && v.date === t).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
    if (!openV) return;

    setSavingProblem(true);
    try {
      const res = await savePatientProblem({
        patientId: myPatientId,
        visitId: openV.visitId,
        patientProblem: problemDraft.trim(),
      });
      applySnapshot(res);
      setProblemSaved(true);
      setEditingProblem(false);
    } catch {
      // Optimistic: save locally anyway
      setProblemSaved(true);
      setEditingProblem(false);
    } finally {
      setSavingProblem(false);
    }
  }

  /* ─── navigation ─── */
  function goHome() {
    setView('home');
    setDetailVisitId('');
    setMemberSheet(false);
  }
  function goRecords() {
    setView('records');
    setDetailVisitId('');
  }
  function goFamily() {
    setView('family');
    setDetailVisitId('');
    setMemberSheet(false);
  }
  function goRegisterForFamily() {
    const me = db && db.patients[myPatientId];
    setView('register');
    setIsAddingForFamily(true);
    setRegAddingMember(true);
    setRegPickedId('');
    setRegError('');
    setReg({ mobile: me ? me.mobile : '', name: '', age: '', gender: '' });
    setMemberSheet(false);
  }

  /* ─── switch to another family member ─── */
  function switchToMember(pid) {
    setMyPatientId(pid);
    setView('home');
    setMemberSheet(false);
    setDetailVisitId('');
    // restore problem state for this member
    const p = db.patients[pid];
    if (p) {
      const t = localToday();
      const openV = p.visits.filter(v => !v.done && v.date === t).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
      if (openV && openV.clinical && openV.clinical.patientProblem) {
        setProblemDraft(openV.clinical.patientProblem);
        setProblemSaved(true);
      } else {
        setProblemDraft('');
        setProblemSaved(false);
      }
      setEditingProblem(false);
    }
  }
  function viewMemberRecords(pid) {
    setMyPatientId(pid);
    setView('records');
    setMemberSheet(false);
    setDetailVisitId('');
  }

  /* ─── refresh queue ─── */
  async function refreshQueue() {
    setRefreshing(true);
    try {
      const res = await fetchList();
      applySnapshot(res);
    } catch { /* ignore */ }
    setRefreshing(false);
  }

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  /* ── loading / error states ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#eef4f3' }}>
        <div style={{ width: 44, height: 44, border: '3.5px solid #d6e7e3', borderTopColor: '#12a094', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <span style={{ fontSize: 15, color: '#5c7a76', fontWeight: 600 }}>Loading, please wait...</span>
      </div>
    );
  }
  if (loadError && !db) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#eef4f3' }}>
        <div style={{ maxWidth: 460, background: '#fff', border: '1px solid #f6d3c8', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <p style={{ color: '#c0392b', fontWeight: 700, fontSize: 16 }}>Something went wrong, please try again</p>
          <button onClick={() => loadList(false)} style={{ marginTop: 16, padding: '11px 20px', borderRadius: 10, border: 0, background: '#0e3b39', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  /* ── derived data ── */
  const signedIn = !!email;
  const me = db && myPatientId ? db.patients[myPatientId] : null;
  const today = localToday();

  // Queue info
  let queueNo = null;
  let aheadCount = 0;
  if (me && db) {
    // Find today's visit for this patient to get queue number
    const todayVisit = me.visits.find(v => v.date === today);
    if (todayVisit) {
      // Queue number = count of patients who checked in today with visit date = today, in order
      const todayPatientIds = [];
      for (const pid of db.order) {
        const p = db.patients[pid];
        if (p.visits.some(v => v.date === today)) {
          todayPatientIds.push(pid);
        }
      }
      // Queue number is the position in today's order (1-based)
      // Backend assigns queueNumber on portalCheckin; look for it on the visit
      if (todayVisit.queueNumber) {
        queueNo = todayVisit.queueNumber;
        // Count patients ahead: those with lower queue number whose visit today is still open
        for (const pid of db.order) {
          if (pid === myPatientId) continue;
          const p = db.patients[pid];
          const tv = p.visits.find(v => v.date === today && v.queueNumber && v.queueNumber < queueNo);
          if (tv && !tv.done) aheadCount++;
        }
      } else {
        // Fallback: compute from order of today's visits
        let idx = 1;
        for (const pid of db.order) {
          const p = db.patients[pid];
          if (p.visits.some(v => v.date === today)) {
            if (pid === myPatientId) { queueNo = idx; break; }
            idx++;
          }
        }
        // Count ahead
        if (queueNo) {
          let qi = 0;
          for (const pid of db.order) {
            const p = db.patients[pid];
            const tv = p.visits.find(v => v.date === today);
            if (tv) {
              qi++;
              if (qi < queueNo && !tv.done && pid !== myPatientId) aheadCount++;
            }
          }
        }
      }
    }
  }

  const aheadText = aheadCount === 0 ? "You're next — please be seated."
    : aheadCount === 1 ? '1 patient ahead of you'
    : aheadCount + ' patients ahead of you';

  // Active visit (today)
  let activeVisit = null;
  let canStartVisit = false;
  if (me) {
    const openToday = me.visits.filter(v => !v.done && v.date === today).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
    const doneToday = me.visits.filter(v => v.done && v.date === today).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
    activeVisit = openToday || doneToday || null;
    canStartVisit = !openToday;
  }

  // Upcoming appointments (only when no visit today)
  let upcoming = [];
  if (me && !activeVisit) {
    for (const v of me.visits) {
      const na = v.clinical && v.clinical.nextAppointment;
      if (na && na >= today) {
        const parts = dateParts(na);
        upcoming.push({
          key: v.visitId + '_appt',
          day: parts.day, mon: parts.mon,
          timeLabel: v.clinical.nextAppointmentTime ? fmtTime(v.clinical.nextAppointmentTime) : 'No time set',
          forLabel: treatmentLabel(v.clinical),
          dateLabel: fmtDate(na),
          isToday: na === today,
        });
      }
    }
    upcoming.sort((a, b) => {
      if (a.dateLabel < b.dateLabel) return -1;
      if (a.dateLabel > b.dateLabel) return 1;
      return 0;
    });
  }

  // Past visits (for home view "My previous visits" section)
  let pastVisits = [];
  if (me) {
    const payMap = { 'Fully Paid': ['#e3f5ec', '#12805a'], 'Partially paid': ['#fdf0dc', '#a9741a'], 'Not paid': ['#fdecea', '#c0392b'] };
    pastVisits = me.visits
      .filter(v => !activeVisit || v.visitId !== activeVisit.visitId)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.no || 0) - (a.no || 0)))
      .map(v => {
        const c = v.clinical || {};
        const cols = payMap[c.paymentStatus] || ['#eef4f3', '#8aa8a3'];
        return {
          visitId: v.visitId, dateLabel: fmtDate(v.date),
          treatmentLbl: treatmentLabel(c) || (v.done ? '—' : 'Awaiting consultation'),
          status: v.done ? (c.paymentStatus || 'Completed') : (v.date === today ? 'In progress' : 'Awaiting doctor'),
          stBg: v.done ? cols[0] : '#fdf0dc', stInk: v.done ? cols[1] : '#a9741a',
          balanceLabel: inr(num(c.balanceDue)),
        };
      });
  }

  // Records view — all visits with lifetime stats
  let allVisits = [];
  let totalPaid = 0;
  let totalPending = 0;
  if (me) {
    const sorted = me.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    let runBal = 0;
    sorted.forEach(v => {
      const cost = num(v.clinical && v.clinical.treatmentCost);
      const paid = num(v.clinical && v.clinical.amountPaid);
      totalPaid += paid;
      runBal += cost - paid;
      if (runBal < 0) runBal = 0;
    });
    totalPending = runBal;

    const payMap = { 'Fully Paid': ['#e3f5ec', '#12805a'], 'Partially paid': ['#fdf0dc', '#a9741a'], 'Not paid': ['#fdecea', '#c0392b'] };
    allVisits = me.visits
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.no || 0) - (a.no || 0)))
      .map(v => {
        const c = v.clinical || {};
        const parts = dateParts(v.date);
        const cols = payMap[c.paymentStatus] || ['#eef4f3', '#8aa8a3'];
        const bal = num(c.balanceDue);
        return {
          visitId: v.visitId, date: v.date,
          day: parts.day, mon: parts.mon, yr: parts.yr,
          treatmentLbl: treatmentLabel(c) || (v.done ? '—' : 'Awaiting consultation'),
          complaintLbl: complaintLabel(c) || '—',
          status: v.done ? (c.paymentStatus || 'Completed') : (v.date === today ? 'In progress' : 'Awaiting doctor'),
          stBg: v.done ? cols[0] : '#fdf0dc', stInk: v.done ? cols[1] : '#a9741a',
          costLabel: num(c.treatmentCost) ? inr(num(c.treatmentCost)) : '—',
          balanceLabel: inr(bal),
          hasBalance: bal > 0,
          showCharges: v.done,
          pendingVisit: !v.done,
          done: v.done,
        };
      });
  }

  // Family members
  let familyMembers = [];
  if (me && db) {
    const onMobile = findAllByMobile(db, me.mobile);
    familyMembers = onMobile.map(p => {
      const isMe = p.patientId === myPatientId;
      const sorted = p.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
      let bal = 0;
      sorted.forEach(v => {
        bal += num(v.clinical && v.clinical.treatmentCost) - num(v.clinical && v.clinical.amountPaid);
        if (bal < 0) bal = 0;
      });
      const lastV = sorted.length > 0 ? sorted[sorted.length - 1] : null;
      return {
        patientId: p.patientId, name: p.name,
        initial: (p.name || '?').trim().charAt(0).toUpperCase(),
        meta: (p.age || '?') + ' yrs · ' + (p.gender || '—') + ' · ' + p.patientId,
        lastLabel: lastV ? 'Last visit ' + fmtDate(lastV.date) : 'No visits yet',
        isMe,
        hasPending: bal > 0,
        pendingLabel: inr(bal),
      };
    });
  }

  // Registration — matches on entered mobile
  const regMobile = normMobile(reg.mobile);
  const regMatches = regMobile.length === 10 ? findAllByMobile(db, regMobile) : [];
  const hasRegMatches = regMatches.length > 0 && !regAddingMember;
  const showRegFields = regMatches.length === 0 || regAddingMember || !!regPickedId;

  // Detail visit for bottom sheet is resolved inline at render time.

  /* ── show bottom tabs when signed in and on home/records/family ── */
  const showTabs = signedIn && me && (view === 'home' || view === 'records' || view === 'family');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460, minHeight: '100vh', background: '#eef4f3', display: 'flex', flexDirection: 'column' }}>

        {/* ── HEADER ── */}
        <header style={{ background: '#0e3b39', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: 'linear-gradient(135deg,#12a094,#0e756c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ClipboardIcon />
            </span>
            <span style={{ lineHeight: 1.1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '15.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CLINIC_NAME}</span>
              <span style={{ display: 'block', fontSize: '9.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: '#7fd4c9', fontWeight: 600 }}>Patient check-in</span>
            </span>
          </div>
          {signedIn && (
            <button onClick={signOut} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Sign out</button>
          )}
        </header>

        <main style={{ flex: 1, padding: '18px 16px 40px' }}>

          {/* ═══ 1. LOGIN ═══ */}
          {view === 'login' && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 20, padding: '28px 22px', textAlign: 'center', marginTop: 12 }}>
                <span style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 20, background: '#e6f4f2', alignItems: 'center', justifyContent: 'center', color: '#0e756c' }}>
                  <QrIcon />
                </span>
                <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 23, color: '#0e3b39', marginTop: 16, textWrap: 'balance' }}>Welcome to the clinic</h1>
                <p style={{ color: '#5c7a76', fontSize: 15, marginTop: 8, textWrap: 'pretty' }}>Sign in to check in for your visit, get your queue number and see your treatment details.</p>
                {authChecking ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0' }}>
                    <div style={{ width: 40, height: 40, border: '3.5px solid #d6e7e3', borderTopColor: '#12a094', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                    <span style={{ color: '#5c7a76', fontSize: 14, fontWeight: 600 }}>Signing in...</span>
                  </div>
                ) : (
                  <button onClick={handleGoogleSignIn} style={{
                    width: '100%', marginTop: 22, padding: 14, borderRadius: 12,
                    border: '1px solid #dbe6e4', background: '#fff', color: '#33534f',
                    fontWeight: 700, fontSize: '15.5px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
                    boxShadow: '0 2px 6px rgba(14,59,57,.07)',
                  }}>
                    <GoogleLogo />
                    Continue with Google
                  </button>
                )}
                {authError && <p style={{ color: '#c0392b', fontSize: 13, fontWeight: 600, marginTop: 14 }}>{authError}</p>}
                <p style={{ color: '#98b0ab', fontSize: 12, marginTop: 14 }}>We only use this to identify your records.</p>
              </div>
            </div>
          )}

          {/* ═══ 2. REGISTER ═══ */}
          {view === 'register' && (
            <div>
              {isAddingForFamily && (
                <button onClick={goFamily} style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BackArrow /> Back to family
                </button>
              )}
              <p style={{ color: '#12a094', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 12 }}>
                {isAddingForFamily ? 'FAMILY' : 'STEP 1'}
              </p>
              <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 24, color: '#0e3b39', marginTop: 4 }}>
                {isAddingForFamily ? 'Add a family member' : 'Check in for your visit'}
              </h1>
              <p style={{ color: '#5c7a76', fontSize: '14.5px', marginTop: 4 }}>
                {isAddingForFamily ? 'Register someone on the same mobile number.' : 'Enter your mobile number to get started.'}
              </p>

              <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: 20, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Mobile */}
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: 7 }}>Mobile number <span style={{ color: '#ef5a3c' }}>*</span></label>
                  <input
                    className="fld" value={reg.mobile} onChange={e => onRegMobileChange(e.target.value)}
                    inputMode="numeric" placeholder="10-digit number"
                    readOnly={isAddingForFamily}
                    style={{ width: '100%', padding: '13px 14px', border: '1px solid #d6e7e3', borderRadius: 11, fontSize: 16, background: isAddingForFamily ? '#f0f6f5' : '#f7fbfa' }}
                  />
                </div>

                {/* Who is visiting picker */}
                {hasRegMatches && (
                  <div>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#0e3b39', marginBottom: 4 }}>Who is visiting today?</p>
                    <p style={{ fontSize: '12.5px', color: '#98b0ab', marginBottom: 10 }}>We found existing records on this number.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {regMatches.map(m => {
                        const selected = regPickedId === m.patientId;
                        return (
                          <button key={m.patientId} onClick={() => {
                            setRegPickedId(m.patientId);
                            setRegAddingMember(false);
                            setRegError('');
                            setReg(r => ({ ...r, name: m.name, age: m.age, gender: m.gender }));
                          }} style={{
                            textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: 13, border: selected ? '2px solid #12a094' : '1px solid #e2efec',
                            borderRadius: 13, background: selected ? '#eef7f6' : '#fff', cursor: 'pointer',
                          }}>
                            <span style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: '50%', background: '#e6f4f2', color: '#0e756c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: "'Bricolage Grotesque'" }}>
                              {(m.name || '?').charAt(0).toUpperCase()}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                              <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 15 }}>{m.name}</span>
                              <span style={{ display: 'block', fontSize: '12.5px', color: '#98b0ab' }}>{(m.age || '?') + ' yrs · ' + (m.gender || '—')}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Adding new member banner */}
                {regAddingMember && regMatches.length > 0 && (
                  <div style={{ background: '#eef4fb', border: '1px solid #cfe0f0', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13.5px', color: '#2f5580' }}>Adding a new family member on this number.</span>
                    <button onClick={() => {
                      if (isAddingForFamily) { goFamily(); return; }
                      setRegAddingMember(false);
                      setRegPickedId('');
                      setRegError('');
                      setReg(r => ({ ...r, name: '', age: '', gender: '' }));
                    }} style={{ border: '1px solid #cfe0f0', background: '#fff', color: '#3d6fb0', fontWeight: 700, fontSize: '12.5px', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}

                {/* Name / Age / Gender fields */}
                {showRegFields && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: 7 }}>Full name <span style={{ color: '#ef5a3c' }}>*</span></label>
                      <input
                        className="fld" value={reg.name} onChange={e => setReg(r => ({ ...r, name: e.target.value }))}
                        placeholder="Your name" readOnly={!!regPickedId}
                        style={{ width: '100%', padding: '13px 14px', border: '1px solid #d6e7e3', borderRadius: 11, fontSize: 16, background: regPickedId ? '#f0f6f5' : '#f7fbfa' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: 7 }}>Age <span style={{ color: '#ef5a3c' }}>*</span></label>
                        <input
                          className="fld" value={reg.age} onChange={e => setReg(r => ({ ...r, age: e.target.value }))}
                          type="number" min="0" max="120" placeholder="Years" readOnly={!!regPickedId}
                          style={{ width: '100%', padding: '13px 14px', border: '1px solid #d6e7e3', borderRadius: 11, fontSize: 16, background: regPickedId ? '#f0f6f5' : '#f7fbfa' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: 7 }}>Gender <span style={{ color: '#ef5a3c' }}>*</span></label>
                        <select
                          value={reg.gender} onChange={e => setReg(r => ({ ...r, gender: e.target.value }))}
                          disabled={!!regPickedId}
                          style={{ width: '100%', padding: '13px 14px', border: '1px solid #d6e7e3', borderRadius: 11, fontSize: 16, background: regPickedId ? '#f0f6f5' : '#f7fbfa' }}
                        >
                          <option value="">Select...</option>
                          {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add member link */}
                {hasRegMatches && !regAddingMember && (
                  <button onClick={() => {
                    setRegAddingMember(true);
                    setRegPickedId('');
                    setRegError('');
                    setReg(r => ({ ...r, name: '', age: '', gender: '' }));
                  }} style={{ border: 0, background: 'none', color: '#8aa8a3', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    None of these? Add a new family member
                  </button>
                )}

                {/* Error */}
                {regError && <p style={{ color: '#c0392b', fontSize: '13.5px', fontWeight: 600 }}>{regError}</p>}

                {/* Submit */}
                <button onClick={saveRegister} disabled={savingReg} style={{
                  width: '100%', padding: 15, borderRadius: 12, border: 0,
                  background: savingReg ? '#8aa8a3' : '#ef5a3c', color: '#fff',
                  fontWeight: 700, fontSize: 16, cursor: savingReg ? 'default' : 'pointer',
                }}>
                  {savingReg ? 'Checking in...' : 'Check in & get queue number'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ 3. HOME ═══ */}
          {view === 'home' && me && (
            <div>
              {/* Patient identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#0e756c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: "'Bricolage Grotesque'" }}>
                  {(me.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ lineHeight: 1.2, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 19, color: '#0e3b39' }}>{me.name}</span>
                  <span style={{ display: 'block', fontSize: '12.5px', color: '#98b0ab' }}>
                    <span style={{ fontFamily: 'ui-monospace,monospace', color: '#0e756c', fontWeight: 600 }}>{myPatientId}</span> &middot; {(me.age || '?') + ' yrs · ' + (me.gender || '—')}
                  </span>
                </span>
              </div>

              {/* QUEUE CARD */}
              {queueNo !== null && (
                <div style={{ marginTop: 16, borderRadius: 20, background: 'linear-gradient(135deg,#0e756c,#0e3b39)', color: '#fff', padding: 22, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(127,212,201,.14)' }} />
                  <div style={{ position: 'relative' }}>
                    <span style={{ fontSize: '11.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: '#7fd4c9', fontWeight: 700 }}>Your queue number today</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
                      <span style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 56, lineHeight: 1 }}>{queueNo}</span>
                      <span style={{ fontSize: 14, color: '#bfe3dd' }}>{fmtDate(today)}</span>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#7fd4c9', animation: 'pulseDot 1.6s ease-in-out infinite', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{aheadText}</span>
                      <button onClick={refreshQueue} title="Refresh" aria-label="Refresh queue" style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                        border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)',
                        color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {refreshing ? (
                          <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                        ) : (
                          <RefreshIcon />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE VISIT */}
              {activeVisit && (
                <div style={{ marginTop: 14, background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '16.5px', color: '#0e3b39' }}>Today&apos;s visit</h3>
                    {(() => {
                      const c = activeVisit.clinical || {};
                      const payMap = { 'Fully Paid': ['#e3f5ec', '#12805a'], 'Partially paid': ['#fdf0dc', '#a9741a'], 'Not paid': ['#fdecea', '#c0392b'] };
                      const cols = payMap[c.paymentStatus] || ['#eef4f3', '#8aa8a3'];
                      const stLabel = activeVisit.done ? (c.paymentStatus || 'Completed') : 'Waiting for doctor';
                      const stBg = activeVisit.done ? cols[0] : '#fdf0dc';
                      const stInk = activeVisit.done ? cols[1] : '#a9741a';
                      return <span style={{ padding: '4px 11px', borderRadius: 100, fontSize: '11.5px', fontWeight: 700, background: stBg, color: stInk }}>{stLabel}</span>;
                    })()}
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#98b0ab', marginTop: 2 }}>
                    <span style={{ fontFamily: 'ui-monospace,monospace', color: '#0e756c', fontWeight: 600 }}>{activeVisit.visitId}</span> &middot; {fmtDate(activeVisit.date)}
                  </p>

                  {/* Awaiting doctor (done=false) */}
                  {!activeVisit.done && (
                    <div style={{ marginTop: 14 }}>
                      {problemSaved && !editingProblem ? (
                        <div>
                          <div style={{ background: '#e6f4f2', border: '1px solid #c9e6e1', borderRadius: 12, padding: '13px 15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '11.5px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#0e756c' }}>
                                <CheckIcon /> Sent to the doctor
                              </span>
                              <button onClick={() => setEditingProblem(true)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #c9e6e1', background: '#fff', color: '#0e756c', fontWeight: 700, fontSize: 12, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                                <EditIcon /> Edit
                              </button>
                            </div>
                            <p style={{ fontSize: '14.5px', color: '#0e3b39', marginTop: 8, textWrap: 'pretty' }}>{problemDraft}</p>
                          </div>
                          <p style={{ color: '#98b0ab', fontSize: '12.5px', marginTop: 10, textAlign: 'center' }}>Treatment &amp; payment details will appear here once your consultation is complete.</p>
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', marginBottom: 7 }}>
                            {editingProblem ? 'Edit your message' : "What's troubling you?"}
                          </label>
                          <textarea
                            value={problemDraft} onChange={e => setProblemDraft(e.target.value)}
                            placeholder="Describe your problem — pain, sensitivity, swelling, since when..."
                            style={{ width: '100%', minHeight: 96, padding: '13px 14px', border: '1px solid #d6e7e3', borderRadius: 11, fontSize: '15.5px', background: '#f7fbfa', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 9, marginTop: 10 }}>
                            {editingProblem && (
                              <button onClick={() => {
                                setEditingProblem(false);
                                // Restore saved problem
                                const openV = me.visits.filter(v => !v.done && v.date === today).sort((a, b) => (b.no || 0) - (a.no || 0))[0];
                                if (openV && openV.clinical && openV.clinical.patientProblem) {
                                  setProblemDraft(openV.clinical.patientProblem);
                                } else {
                                  setProblemDraft(problemDraft);
                                }
                              }} style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid #d6e7e3', background: '#fff', color: '#5c7a76', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                                Cancel
                              </button>
                            )}
                            <button onClick={saveProblem} disabled={savingProblem || !problemDraft.trim()} style={{
                              flex: 1, padding: 13, borderRadius: 11, border: 0,
                              background: (!problemDraft.trim() || savingProblem) ? '#8aa8a3' : '#0e756c',
                              color: '#fff', fontWeight: 700, fontSize: 15,
                              cursor: (!problemDraft.trim() || savingProblem) ? 'default' : 'pointer',
                            }}>
                              {savingProblem ? 'Saving...' : editingProblem ? 'Save changes' : 'Send to doctor'}
                            </button>
                          </div>
                          <p style={{ color: '#98b0ab', fontSize: '12.5px', marginTop: 10, textAlign: 'center' }}>The doctor will see this before your consultation.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed visit (done=true) */}
                  {activeVisit.done && (() => {
                    const c = activeVisit.clinical || {};
                    const cc = Array.isArray(c.chiefComplaint) ? c.chiefComplaint.join(', ') : (c.chiefComplaint || '');
                    const tr = treatmentLabel(c);
                    const rows = [
                      { k: 'Chief complaint', v: cc || '—' },
                      { k: 'Description', v: c.chiefDescription || '—' },
                      { k: 'Treatment group', v: c.treatmentGroup || '—' },
                      { k: 'Treatment', v: tr || '—' },
                    ];
                    if (c.patientProblem) rows.push({ k: 'What you told us', v: c.patientProblem });
                    const bal = num(c.balanceDue);
                    return (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {rows.map(r => (
                          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, paddingBottom: 9, borderBottom: '1px solid #f0f6f5' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#8aa8a3', flex: '0 0 auto' }}>{r.k}</span>
                            <span style={{ fontSize: '14.5px', color: '#33534f', textAlign: 'right' }}>{r.v}</span>
                          </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 2 }}>
                          <div style={{ background: '#f7fbfa', border: '1px solid #e6f1ef', borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Total</span>
                            <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17, color: '#0e3b39', marginTop: 2 }}>{inr(num(c.treatmentCost))}</span>
                          </div>
                          <div style={{ background: '#f2faf6', border: '1px solid #d9eee4', borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Paid</span>
                            <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17, color: '#12805a', marginTop: 2 }}>{inr(num(c.amountPaid))}</span>
                          </div>
                          <div style={{ background: '#fdf6f4', border: '1px solid #f6d3c8', borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Pending</span>
                            <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17, color: '#c0392b', marginTop: 2 }}>{inr(bal)}</span>
                          </div>
                        </div>
                        {c.nextAppointment && (
                          <div style={{ background: '#e6f4f2', border: '1px solid #c9e6e1', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
                            <CalIcon />
                            <span style={{ fontSize: 14, color: '#0e3b39' }}>
                              <strong>Next appointment</strong><br />
                              {fmtDate(c.nextAppointment)}{c.nextAppointmentTime ? ' · ' + fmtTime(c.nextAppointmentTime) : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* NEW VISIT CTA */}
              {canStartVisit && activeVisit === null && (
                <button onClick={() => {
                  // Go to register to check in for a new visit
                  setView('register');
                  setIsAddingForFamily(false);
                  setRegAddingMember(false);
                  setRegPickedId(myPatientId);
                  setRegError('');
                  setReg({ mobile: me.mobile, name: me.name, age: me.age, gender: me.gender });
                }} style={{
                  width: '100%', marginTop: 14, padding: 15, borderRadius: 13, border: 0,
                  background: '#ef5a3c', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                }}>
                  <PlusIcon /> Check in for a new visit
                </button>
              )}

              {/* UPCOMING APPOINTMENTS (only when no visit today) */}
              {upcoming.length > 0 && !activeVisit && (
                <div style={{ marginTop: 22 }}>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '16.5px', color: '#0e3b39', marginBottom: 10 }}>Upcoming appointments</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcoming.map(u => (
                      <div key={u.key} style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 16, padding: 14, display: 'flex', gap: 13, alignItems: 'center' }}>
                        <span style={{ flex: '0 0 auto', width: 52, borderRadius: 12, background: '#e6f4f2', padding: '8px 0', textAlign: 'center', lineHeight: 1.1 }}>
                          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 19, color: '#0e756c' }}>{u.day}</span>
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#0e756c' }}>{u.mon}</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                          <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 15 }}>{u.timeLabel}</span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: '#5c7a76' }}>{u.forLabel}</span>
                          <span style={{ display: 'block', fontSize: 12, color: '#98b0ab' }}>{u.dateLabel}</span>
                        </span>
                        {u.isToday && (
                          <span style={{ flex: '0 0 auto', padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#e6f4f2', color: '#0e756c' }}>Today</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CHECKING IN FOR SOMEONE ELSE */}
              {familyMembers.length > 1 && (
                <button onClick={() => setMemberSheet(true)} style={{
                  width: '100%', marginTop: 12, padding: 13, borderRadius: 12,
                  border: '1px solid #dfece9', background: '#fff', color: '#0e756c',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                }}>
                  <PeopleAddIcon /> Checking in for someone else?
                </button>
              )}

              {/* PAST VISITS */}
              {pastVisits.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '16.5px', color: '#0e3b39' }}>My previous visits</h3>
                    <button onClick={goRecords} style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>View all &rarr;</button>
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#98b0ab', marginBottom: 10 }}>Tap a visit to see full details.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pastVisits.slice(0, 3).map(v => (
                      <button key={v.visitId} onClick={() => setDetailVisitId(v.visitId)} style={{
                        textAlign: 'left', border: '1px solid #dfece9', borderRadius: 14, background: '#fff',
                        padding: '14px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0e3b39' }}>{v.dateLabel}</span>
                          <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: v.stBg, color: v.stInk }}>{v.status}</span>
                        </span>
                        <span style={{ fontSize: 14, color: '#33534f' }}>{v.treatmentLbl}</span>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: '12.5px', color: '#98b0ab' }}>
                          <span><span style={{ fontFamily: 'ui-monospace,monospace', color: '#0e756c', fontWeight: 600 }}>{v.visitId}</span> &middot; Balance {v.balanceLabel}</span>
                          <span style={{ color: '#0e756c', fontWeight: 700 }}>View &rarr;</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ 4. RECORDS ═══ */}
          {view === 'records' && me && (
            <div>
              <button onClick={goHome} style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BackArrow /> Back to today
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 24, color: '#0e3b39' }}>Records</h1>
                  <p style={{ color: '#5c7a76', fontSize: '14.5px', marginTop: 2 }}>
                    {me.name} &middot; <span style={{ fontFamily: 'ui-monospace,monospace', color: '#0e756c', fontWeight: 600 }}>{myPatientId}</span>
                  </p>
                </div>
              </div>

              {/* Lifetime tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 14, padding: '13px 10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Visits</span>
                  <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 20, color: '#0e3b39', marginTop: 2 }}>{me.visits.length}</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 14, padding: '13px 10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Paid</span>
                  <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 20, color: '#12805a', marginTop: 2 }}>{inr(totalPaid)}</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dfece9', borderRadius: 14, padding: '13px 10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8aa8a3' }}>Pending</span>
                  <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 20, color: '#c0392b', marginTop: 2 }}>{inr(totalPending)}</span>
                </div>
              </div>

              {/* Pending alert */}
              {totalPending > 0 && (
                <div style={{ marginTop: 12, background: '#fdf6f4', border: '1px solid #f6d3c8', borderRadius: 13, padding: '12px 14px', fontSize: '13.5px', color: '#b0442a' }}>
                  You have <strong>{inr(totalPending)}</strong> pending across your visits. You can settle this at the clinic reception.
                </div>
              )}

              {/* Visit history */}
              {allVisits.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '16.5px', color: '#0e3b39', marginBottom: 4 }}>Visit history</h3>
                  <p style={{ fontSize: '12.5px', color: '#98b0ab', marginBottom: 10 }}>Newest first &middot; tap any visit for full details.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allVisits.map(v => (
                      <button key={v.visitId} onClick={() => setDetailVisitId(v.visitId)} style={{
                        textAlign: 'left', border: '1px solid #dfece9', borderRadius: 16, background: '#fff',
                        padding: 14, cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'flex-start',
                      }}>
                        <span style={{ flex: '0 0 auto', width: 52, borderRadius: 12, background: '#e6f4f2', padding: '8px 0', textAlign: 'center', lineHeight: 1.1 }}>
                          <span style={{ display: 'block', fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 19, color: '#0e756c' }}>{v.day}</span>
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#0e756c' }}>{v.mon}</span>
                          <span style={{ display: 'block', fontSize: '9.5px', color: '#8aa8a3' }}>{v.yr}</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: '#0e3b39', fontSize: 15 }}>{v.treatmentLbl}</span>
                            <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 100, fontSize: '10.5px', fontWeight: 700, background: v.stBg, color: v.stInk }}>{v.status}</span>
                          </span>
                          <span style={{ fontSize: '12.5px', color: '#5c7a76' }}>{v.complaintLbl}</span>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#98b0ab' }}>
                            <span>
                              {v.showCharges && <span>Charges {v.costLabel}</span>}
                              {v.pendingVisit && <span style={{ fontStyle: 'italic' }}>Not billed yet</span>}
                              {v.hasBalance && <span style={{ color: '#c0392b', fontWeight: 700 }}> &middot; Due {v.balanceLabel}</span>}
                            </span>
                            <span style={{ color: '#0e756c', fontWeight: 700 }}>View &rarr;</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {allVisits.length === 0 && (
                <div style={{ marginTop: 20, background: '#fff', border: '1px solid #dfece9', borderRadius: 18, padding: '44px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15.5px', fontWeight: 600, color: '#5c7a76' }}>No visits yet.</p>
                  <p style={{ fontSize: '13.5px', color: '#98b0ab', marginTop: 5 }}>Your treatment history will appear here after your first consultation.</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ 5. FAMILY ═══ */}
          {view === 'family' && me && (
            <div>
              <button onClick={goHome} style={{ border: 0, background: 'none', color: '#0e756c', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BackArrow /> Back to today
              </button>
              <h1 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 24, color: '#0e3b39' }}>Family</h1>
              <p style={{ color: '#5c7a76', fontSize: '14.5px', marginTop: 2 }}>Everyone registered on this mobile number. Tap anyone to view their visit history.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {familyMembers.map(f => {
                  const isMe = f.isMe;
                  return (
                    <button key={f.patientId} onClick={() => {
                      if (isMe) return;
                      viewMemberRecords(f.patientId);
                    }} style={{
                      textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 13,
                      padding: 14, border: isMe ? '2px solid #12a094' : '1px solid #dfece9',
                      borderRadius: 16, background: isMe ? '#eef7f6' : '#fff',
                      cursor: isMe ? 'default' : 'pointer',
                    }}>
                      <span style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: '50%', background: '#e6f4f2', color: '#0e756c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, fontFamily: "'Bricolage Grotesque'" }}>
                        {f.initial}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#0e3b39', fontSize: 16 }}>{f.name}</span>
                          <span style={{ flexShrink: 0, fontSize: '11.5px', fontWeight: 700, color: '#0e756c' }}>{isMe ? 'Viewing' : 'View records →'}</span>
                        </span>
                        <span style={{ fontSize: '12.5px', color: '#98b0ab' }}>{f.meta}</span>
                        <span style={{ fontSize: '12.5px', color: '#5c7a76' }}>{f.lastLabel}</span>
                        {f.hasPending && (
                          <span style={{ fontSize: '12.5px', color: '#c0392b', fontWeight: 700 }}>Pending {f.pendingLabel}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button onClick={goRegisterForFamily} style={{
                width: '100%', marginTop: 14, padding: 14, borderRadius: 13,
                border: '1px dashed #cfe3df', background: '#f7fbfa', color: '#0e756c',
                fontWeight: 700, fontSize: '14.5px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <PlusIcon /> Add a new family member
              </button>
            </div>
          )}

          {/* ═══ MEMBER SHEET (checking in for someone else) ═══ */}
          {memberSheet && me && (
            <div onClick={() => setMemberSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(14,59,57,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 460, padding: '22px 20px 26px', maxHeight: '88vh', overflow: 'auto' }}>
                <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: '17.5px', color: '#0e3b39' }}>Who needs to see the doctor?</h3>
                <p style={{ fontSize: 13, color: '#98b0ab', marginTop: 3 }}>Everyone registered on this mobile number.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  {familyMembers.map(f => {
                    const isMe = f.isMe;
                    const hasTodayVisit = db.patients[f.patientId]?.visits.some(v => v.date === today && !v.done);
                    let actionLabel = 'Check in';
                    if (isMe) actionLabel = 'Viewing';
                    else if (hasTodayVisit) actionLabel = 'Open';
                    return (
                      <button key={f.patientId} onClick={() => {
                        if (isMe) { setMemberSheet(false); return; }
                        if (hasTodayVisit) { switchToMember(f.patientId); }
                        else { switchToMember(f.patientId); }
                      }} style={{
                        textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: 13, border: isMe ? '2px solid #12a094' : '1px solid #e2efec',
                        borderRadius: 13, background: isMe ? '#eef7f6' : '#fff', cursor: 'pointer',
                      }}>
                        <span style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: '50%', background: '#e6f4f2', color: '#0e756c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: "'Bricolage Grotesque'" }}>
                          {f.initial}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <span style={{ display: 'block', fontWeight: 700, color: '#0e3b39', fontSize: 15 }}>{f.name}</span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: '#98b0ab' }}>{f.meta}</span>
                        </span>
                        <span style={{ flex: '0 0 auto', color: '#0e756c', fontWeight: 700, fontSize: 13 }}>{actionLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={goRegisterForFamily} style={{
                  width: '100%', marginTop: 14, padding: 13, borderRadius: 12,
                  border: '1px dashed #cfe3df', background: '#f7fbfa', color: '#0e756c',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <PlusIcon /> Add a new family member
                </button>
                <button onClick={() => setMemberSheet(false)} style={{
                  width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: 0,
                  background: 'none', color: '#8aa8a3', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ═══ VISIT DETAIL SHEET ═══ */}
          {detailVisitId && me && (() => {
            const v = me.visits.find(x => x.visitId === detailVisitId);
            if (!v) return null;
            const c = v.clinical || {};
            const cc = Array.isArray(c.chiefComplaint) ? c.chiefComplaint.join(', ') : (c.chiefComplaint || '');
            const tr = treatmentLabel(c);
            const rows = [];
            if (v.done) {
              rows.push({ k: 'Chief complaint', v: cc || '—' });
              rows.push({ k: 'Description', v: c.chiefDescription || '—' });
              rows.push({ k: 'Treatment group', v: c.treatmentGroup || '—' });
              rows.push({ k: 'Treatment', v: tr || '—' });
              if (c.patientProblem) rows.push({ k: 'What you told us', v: c.patientProblem });
              rows.push({ k: 'Treatment cost', v: num(c.treatmentCost) ? inr(num(c.treatmentCost)) : '—' });
              rows.push({ k: 'Amount paid', v: num(c.amountPaid) ? inr(num(c.amountPaid)) : '—' });
              rows.push({ k: 'Balance due', v: num(c.balanceDue) ? inr(num(c.balanceDue)) : '—' });
              if (c.paymentStatus) rows.push({ k: 'Payment status', v: c.paymentStatus });
              if (c.nextAppointment) rows.push({ k: 'Next appointment', v: fmtDate(c.nextAppointment) + (c.nextAppointmentTime ? ' · ' + fmtTime(c.nextAppointmentTime) : '') });
              if (c.comments) rows.push({ k: 'Notes', v: c.comments });
            }
            return (
              <div onClick={() => setDetailVisitId('')} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(14,59,57,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '82vh', overflow: 'auto' }}>
                  <div style={{ position: 'sticky', top: 0, background: '#0e3b39', color: '#fff', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderRadius: '20px 20px 0 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '12.5px', color: '#7fd4c9', fontWeight: 700 }}>{v.visitId}</span>
                      <h3 style={{ fontFamily: "'Bricolage Grotesque'", fontWeight: 700, fontSize: 17 }}>{fmtDate(v.date)}</h3>
                    </div>
                    <button onClick={() => setDetailVisitId('')} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: 0, background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 16, cursor: 'pointer' }}>{'✕'}</button>
                  </div>
                  <div style={{ padding: '6px 20px 26px' }}>
                    {!v.done && (
                      <div style={{ background: '#fdf6ec', border: '1px solid #f4dfc0', borderRadius: 13, padding: '13px 15px', marginTop: 12, fontSize: 14, color: '#8a6320', textWrap: 'pretty' }}>
                        Awaiting doctor &mdash; your treatment and payment details will appear here once your consultation is complete.
                      </div>
                    )}
                    {rows.map(r => (
                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: '1px solid #f0f6f5' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#8aa8a3', flex: '0 0 auto' }}>{r.k}</span>
                        <span style={{ fontSize: '14.5px', color: '#33534f', textAlign: 'right' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </main>

        {/* ═══ BOTTOM TABS ═══ */}
        {showTabs && (
          <div>
            <div style={{ height: 76 }} />
            <nav style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
              display: 'flex', justifyContent: 'center',
              background: '#fff', borderTop: '1px solid #e2efec',
              boxShadow: '0 -8px 24px -14px rgba(14,59,57,.22)',
            }}>
              <div style={{ width: '100%', maxWidth: 460, display: 'flex', gap: 8, padding: '8px 14px calc(8px + env(safe-area-inset-bottom))' }}>
                <button onClick={goHome} style={{
                  flex: 1, padding: 10, borderRadius: 12, border: 0,
                  background: view === 'home' ? '#e6f4f2' : 'transparent',
                  color: view === 'home' ? '#0e756c' : '#8aa8a3',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <HomeIcon /> Today
                </button>
                <button onClick={goFamily} style={{
                  flex: 1, padding: 10, borderRadius: 12, border: 0,
                  background: view === 'family' ? '#e6f4f2' : 'transparent',
                  color: view === 'family' ? '#0e756c' : '#8aa8a3',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <FamilyIcon /> Family
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Global styles for portal-specific animations */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: .35; }
        }
      `}</style>

      {/* Full-screen loading overlay */}
      {(savingReg || savingProblem) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(238,244,243,.88)', backdropFilter: 'blur(2px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ width: 44, height: 44, border: '3.5px solid #d6e7e3', borderTopColor: '#12a094', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          <span style={{ fontSize: 15, color: '#5c7a76', fontWeight: 600 }}>Loading, please wait...</span>
        </div>
      )}
    </div>
  );
}
