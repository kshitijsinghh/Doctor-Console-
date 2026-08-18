import { useEffect, useState } from 'react';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Intake from './views/Intake';
import Clinical from './views/Clinical';
import Appointments from './views/Appointments';
import Patients from './views/Patients';
import PatientDetail from './views/PatientDetail';
import { fetchList, saveIntake, saveClinical, uploadQr, getCachedList } from './api';

function today() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth() {
  return new Date().toISOString().slice(0, 8) + '01';
}
function normMobile(m) {
  return (m || '').replace(/\D/g, '');
}
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}
function num(x) {
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
}
function inr(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtTime(t) {
  if (!t) return '—';
  if (/AM|PM/i.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return hr + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}
function blankClinical() {
  return {
    patientType: '', medicalHistory: '', chiefComplaint: '', chiefDescription: '', treatmentGroup: '', treatment: '', advisedTreatment: '', toothNumber: '', treatmentOther: '', advisedTreatmentOther: '',
    treatmentCost: '', amountPaid: '', balanceDue: '', paymentMode: '',
    treatmentStage: '', googleReviewTaken: '', nextAppointment: '', nextAppointmentTime: '', comments: '',
  };
}
function findAllByMobile(db, mobile) {
  const mm = normMobile(mobile);
  if (!mm || !db) return [];
  const result = [];
  for (const id of db.order) {
    if (db.patients[id].mobile === mm) result.push(db.patients[id]);
  }
  return result;
}

export default function App({ user, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [db, setDbState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [apptDate, setApptDate] = useState(today());
  const [showApptCal, setShowApptCal] = useState(false);

  const [form, setForm] = useState({ mobile: '', name: '', age: '', gender: '', date: today() });
  const [lookupState, setLookupState] = useState('');
  const [existingPatientId, setExistingPatientId] = useState('');
  const [mobilePatients, setMobilePatients] = useState([]);
  const [addAnother, setAddAnother] = useState(false);
  const [intakeMode, setIntakeMode] = useState('new');
  const [intakeSearch, setIntakeSearch] = useState('');
  const [intakeError, setIntakeError] = useState('');
  const [savingIntake, setSavingIntake] = useState(false);

  const [curPatientId, setCurPatientId] = useState('');
  const [curVisitId, setCurVisitId] = useState('');
  const [detailPid, setDetailPid] = useState('');
  const [cform, setCform] = useState(blankClinical());
  const [savedFlash, setSavedFlash] = useState(false);
  const [savingClinical, setSavingClinical] = useState(false);
  const [clinicalError, setClinicalError] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [clinicalReadOnly, setClinicalReadOnly] = useState(false);

  function applySnapshot(res) {
    setDbState({ patients: res.patients, order: res.order, seq: res.seq, upiQr: res.upiQr });
  }

  async function loadList(isRefresh) {
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
  }

  useEffect(() => {
    const cached = getCachedList();
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
      loadList(true);
    } else {
      loadList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.history.replaceState({ view: 'dashboard' }, '');
    const onPop = (e) => {
      setView(e.state?.view || 'dashboard');
      setDetailPid(e.state?.detailPid || '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function pushView(v) {
    window.history.pushState({ view: v }, '');
    setView(v);
  }
  function replaceView(v) {
    window.history.replaceState({ view: v }, '');
    setView(v);
  }
  function goBack() {
    window.history.back();
  }

  function goDash() {
    pushView('dashboard');
  }
  function goAppts() {
    pushView('appointments');
  }
  function goIntake() {
    pushView('intake');
    setForm({ mobile: '', name: '', age: '', gender: '', date: today() });
    setLookupState('');
    setExistingPatientId('');
    setMobilePatients([]);
    setAddAnother(false);
    setIntakeError('');
    setIntakeMode('new');
    setIntakeSearch('');
  }
  function goPatients() {
    pushView('patients');
  }
  function openPatientDetail(pid) {
    setDetailPid(pid);
    window.history.pushState({ view: 'patientDetail', detailPid: pid }, '');
    setView('patientDetail');
  }

  function onLookup(mobile) {
    const m = mobile || form.mobile;
    const matches = findAllByMobile(db, m);
    setMobilePatients(matches);
    setAddAnother(false);
    if (matches.length > 0) {
      const p = matches[0];
      setLookupState('existing');
      setExistingPatientId(p.patientId);
      setIntakeError('');
      setForm((f) => ({ ...f, name: p.name, age: p.age, gender: p.gender }));
    } else if (normMobile(m)) {
      setLookupState('new');
      setExistingPatientId('');
      setIntakeError('');
    }
  }

  function onSelectPatient(pid) {
    const p = mobilePatients.find((x) => x.patientId === pid);
    if (!p) return;
    setExistingPatientId(p.patientId);
    setAddAnother(false);
    setIntakeError('');
    setForm((f) => ({ ...f, name: p.name, age: p.age, gender: p.gender }));
  }

  function onAddAnother() {
    setAddAnother(true);
    setExistingPatientId('');
    setIntakeError('');
    setForm((f) => ({ ...f, name: '', age: '', gender: '' }));
  }

  function onCancelAddAnother() {
    setAddAnother(false);
    const p = mobilePatients[0];
    if (p) {
      setExistingPatientId(p.patientId);
      setForm((f) => ({ ...f, name: p.name, age: p.age, gender: p.gender }));
    }
  }

  async function startVisitForExisting(pid) {
    const p = db.patients[pid];
    if (!p) return;
    const intakeData = { mobile: p.mobile, name: p.name, age: p.age, gender: p.gender, date: today() };
    const optNo = p.visits.length + 1;
    const optVid = pid + '_' + optNo;
    const optVisit = { visitId: optVid, no: optNo, date: today(), done: false, clinical: null, createdAt: new Date().toISOString() };
    const optDb = { ...db, patients: { ...db.patients } };
    optDb.patients[pid] = { ...p, visits: [...p.visits, optVisit] };
    setDbState(optDb);
    setCurPatientId(pid);
    setCurVisitId(optVid);
    const autoType = Number(p.age) <= 12 ? 'Kid' : 'Adult';
    setCform({ ...blankClinical(), patientType: autoType });
    setSavedFlash(false);
    setClinicalError('');
    setClinicalReadOnly(false);
    setForm({ mobile: '', name: '', age: '', gender: '', date: today() });
    setLookupState('');
    setExistingPatientId('');
    setMobilePatients([]);
    setAddAnother(false);
    setIntakeMode('new');
    setIntakeSearch('');
    replaceView('clinical');
    try {
      const res = await saveIntake(intakeData);
      applySnapshot(res);
      if (res.patientId !== pid) setCurPatientId(res.patientId);
      if (res.visitId !== optVid) setCurVisitId(res.visitId);
    } catch {
      setClinicalError('Visit creation failed — please go back and try again.');
    }
  }

  async function onSaveIntake() {
    const mm = normMobile(form.mobile);
    if (!mm) return setIntakeError('Please enter a mobile number.');
    if (mm.length !== 10) return setIntakeError('Mobile number must be exactly 10 digits.');
    if (!form.name.trim() || !String(form.age).trim() || !form.gender || !form.date) {
      return setIntakeError('Name, age, gender and date are required.');
    }
    if (addAnother) {
      const dupName = mobilePatients.some((p) => p.name.toLowerCase() === form.name.trim().toLowerCase());
      if (dupName) {
        return setIntakeError('Another patient with this name already exists on this number. Please use a different name.');
      }
    }
    setIntakeError('');

    const intakeData = { mobile: mm, name: form.name.trim(), age: form.age, gender: form.gender, date: form.date };
    const allOnMobile = findAllByMobile(db, mm);
    const existingP = addAnother ? null : allOnMobile.find((p) => p.name.toLowerCase() === form.name.trim().toLowerCase());
    const optPid = existingP ? existingP.patientId : 'P' + String(db.seq + 1).padStart(4, '0');
    const optNo = existingP ? existingP.visits.length + 1 : 1;
    const optVid = optPid + '_' + optNo;

    const optVisit = { visitId: optVid, no: optNo, date: form.date, done: false, clinical: null, createdAt: new Date().toISOString() };
    const optDb = { ...db, patients: { ...db.patients } };
    if (existingP) {
      optDb.patients[optPid] = { ...existingP, visits: [...existingP.visits, optVisit] };
    } else {
      optDb.patients[optPid] = { patientId: optPid, name: intakeData.name, age: intakeData.age, gender: intakeData.gender, mobile: mm, visits: [optVisit] };
      optDb.order = [optPid, ...db.order];
      optDb.seq = db.seq + 1;
    }

    setDbState(optDb);
    setCurPatientId(optPid);
    setCurVisitId(optVid);
    const autoType = Number(form.age) <= 12 ? 'Kid' : 'Adult';
    setCform({ ...blankClinical(), patientType: autoType });
    setSavedFlash(false);
    setClinicalError('');
    setClinicalReadOnly(false);
    setForm({ mobile: '', name: '', age: '', gender: '', date: today() });
    setLookupState('');
    setExistingPatientId('');
    setMobilePatients([]);
    setAddAnother(false);
    replaceView('clinical');

    try {
      const res = await saveIntake(intakeData);
      applySnapshot(res);
      if (res.patientId !== optPid) setCurPatientId(res.patientId);
      if (res.visitId !== optVid) setCurVisitId(res.visitId);
    } catch {
      setClinicalError('Visit creation failed — please go back and try again.');
    }
  }

  function openVisit(pid, visitId, readOnly) {
    const p = db.patients[pid];
    const v = p && p.visits.find((x) => x.visitId === visitId);
    setCurPatientId(pid);
    setCurVisitId(visitId);
    const base = v && v.clinical ? { ...blankClinical(), ...v.clinical } : blankClinical();
    if (!base.patientType && p) {
      base.patientType = Number(p.age) <= 12 ? 'Kid' : 'Adult';
    }
    setCform(base);
    setSavedFlash(false);
    setClinicalError('');
    setClinicalReadOnly(!!readOnly);
    pushView('clinical');
  }

  function onCreateNewVisitFromAppt(pid) {
    const p = db.patients[pid];
    if (!p) return;
    setForm({ mobile: p.mobile, name: p.name, age: p.age, gender: p.gender, date: today() });
    setLookupState('existing');
    setExistingPatientId(pid);
    setMobilePatients(findAllByMobile(db, p.mobile));
    setAddAnother(false);
    setIntakeError('');
    setClinicalReadOnly(false);
    pushView('intake');
  }

  async function onSaveClinical() {
    setSavingClinical(true);
    setClinicalError('');
    try {
      const res = await saveClinical({ patientId: curPatientId, visitId: curVisitId, cform });
      applySnapshot(res);
      setSavedFlash(true);
      setTimeout(() => {
        setSavedFlash(false);
        replaceView('dashboard');
      }, 900);
    } catch {
      setClinicalError('Something went wrong, please try again');
    } finally {
      setSavingClinical(false);
    }
  }

  function onUploadQr(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await uploadQr({ dataUrl: reader.result, filename: file.name });
        applySnapshot(res);
      } catch {
        setClinicalError('Something went wrong, please try again');
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, background: '#eef4f3',
      }}>
        <div style={{
          width: 44, height: 44, border: '3.5px solid #d6e7e3',
          borderTopColor: '#12a094', borderRadius: '50%',
          animation: 'spin .7s linear infinite',
        }} />
        <span style={{ fontSize: 15, color: '#5c7a76', fontWeight: 600 }}>Loading, please wait...</span>
      </div>
    );
  }
  if (loadError && !db) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, background: '#fff', border: '1px solid #f6d3c8', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <p style={{ color: '#c0392b', fontWeight: 700, fontSize: 16 }}>Something went wrong, please try again</p>
          <button
            onClick={() => loadList(false)}
            style={{ marginTop: 16, padding: '11px 20px', borderRadius: 10, border: 0, background: '#0e3b39', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const inRange = (d) => {
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const rows = [];
  for (const pid of db.order) {
    const p = db.patients[pid];
    for (const v of p.visits) {
      const ps = (v.clinical && v.clinical.paymentStatus) || '';
      const tr = v.clinical ? (/Other/.test(v.clinical.treatment) && v.clinical.treatmentOther ? v.clinical.treatmentOther : v.clinical.treatment) : '';
      const payMap = { 'Fully Paid': ['#e3f5ec', '#12805a'], 'Partially paid': ['#fdf0dc', '#a9741a'], 'Not paid': ['#fdecea', '#c0392b'] };
      const pm = payMap[ps] || ['#eef4f3', '#8aa8a3'];
      rows.push({
        pid, visitId: v.visitId, no: v.no, ts: Date.parse(v.createdAt) || 0, date: v.date,
        dateLabel: fmtDate(v.date), name: p.name, ageGender: (p.age || '?') + ' · ' + (p.gender || '—'),
        mobile: p.mobile, treatmentLabel: tr || '—', done: v.done,
        payLabel: ps || 'Pending', payBg: pm[0], payInk: pm[1],
        actionLabel: v.done ? 'View / Edit' : 'Doctor form',
        open: () => openVisit(pid, v.visitId),
      });
    }
  }
  rows.sort((a, b) => b.ts - a.ts);
  const rangeRows = rows.filter((r) => inRange(r.date));
  const qq = q.trim().toLowerCase();
  const visitRows = qq ? rangeRows.filter((r) => (r.name + ' ' + r.mobile + ' ' + r.visitId + ' ' + r.pid).toLowerCase().includes(qq)) : rangeRows;

  const rangePatientIds = Array.from(new Set(rangeRows.map((r) => r.pid)));
  let pendingAmount = 0;
  let pendingPatients = 0;
  rangePatientIds.forEach((pid) => {
    const sorted = db.patients[pid].visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    let bal = 0;
    sorted.forEach((v) => {
      bal += num(v.clinical && v.clinical.treatmentCost) - num(v.clinical && v.clinical.amountPaid);
      if (bal < 0) bal = 0;
    });
    if (bal > 0) { pendingPatients++; pendingAmount += bal; }
  });
  const pendingVisits = rangeRows.filter((r) => !r.done).length;
  const stats = [
    { label: 'Patients', value: rangePatientIds.length, color: '#0e756c' },
    { label: 'Visits', value: rangeRows.length, color: '#0e756c' },
    { label: 'Pending visits', value: pendingVisits, color: '#ef5a3c' },
    { label: 'Pending amount', value: inr(pendingAmount), color: '#ef5a3c' },
  ];

  // Appointments: collect all dates with appointments + filter by selected date
  const appts = [];
  const apptDatesMap = {};
  for (const pid of db.order) {
    const p = db.patients[pid];
    for (const v of p.visits) {
      const na = v.clinical && v.clinical.nextAppointment;
      if (!na) continue;
      apptDatesMap[na] = (apptDatesMap[na] || 0) + 1;
      if (na === apptDate) {
        const trr = v.clinical ? (/Other/.test(v.clinical.treatment) && v.clinical.treatmentOther ? v.clinical.treatmentOther : v.clinical.treatment) : '';
        const nat = (v.clinical && v.clinical.nextAppointmentTime) || '';
        appts.push({
          date: na, time: nat, timeLabel: fmtTime(nat), name: p.name, mobile: p.mobile,
          patientId: pid, visitId: v.visitId, treatmentLabel: trr || '—',
          stage: (v.clinical.treatmentStage || '—'),
          open: () => openVisit(pid, v.visitId, true),
        });
      }
    }
  }
  appts.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const apptDateLabel = fmtDate(apptDate);

  const allPatients = db.order.map((pid) => {
    const p = db.patients[pid];
    const sorted = p.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    let bal = 0;
    let totalP = 0;
    sorted.forEach((v) => {
      bal += num(v.clinical && v.clinical.treatmentCost) - num(v.clinical && v.clinical.amountPaid);
      totalP += num(v.clinical && v.clinical.amountPaid);
      if (bal < 0) bal = 0;
    });
    const lastVisit = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    let st;
    if (bal > 0 && totalP > 0) st = 'Partially paid';
    else if (bal > 0) st = 'Not paid';
    else st = 'Fully Paid';
    return {
      patientId: pid, name: p.name, age: p.age, gender: p.gender, mobile: p.mobile,
      ageGender: (p.age || '?') + '/' + (p.gender || '—'),
      lastDate: lastVisit ? lastVisit.date : '',
      lastLabel: lastVisit ? fmtDate(lastVisit.date) : '—',
      visitCount: p.visits.length,
      outstanding: bal, status: st,
    };
  });
  const outstandingTotal = allPatients.reduce((s, p) => s + p.outstanding, 0);

  const allOnMobile = findAllByMobile(db, form.mobile);
  const matchedPatient = addAnother ? null : allOnMobile.find((p) => p.name.toLowerCase() === form.name.trim().toLowerCase());
  const previewPatientId = matchedPatient ? matchedPatient.patientId : 'P' + String(db.seq + 1).padStart(4, '0');
  const nextVisitNo = matchedPatient ? matchedPatient.visits.length + 1 : 1;
  const previewVisitId = previewPatientId + '_' + nextVisitNo;

  const intakeSearchQ = intakeSearch.trim().toLowerCase();
  const intakeResults = [];
  if (intakeSearchQ) {
    for (const pid of db.order) {
      if (intakeResults.length >= 20) break;
      const p = db.patients[pid];
      if ((p.name + ' ' + p.mobile + ' ' + pid).toLowerCase().includes(intakeSearchQ)) {
        const sorted = p.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
        const lastVisit = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        intakeResults.push({
          patientId: pid, name: p.name, mobile: p.mobile,
          ageGender: (p.age || '?') + ' · ' + (p.gender || '—'),
          initial: (p.name || '?')[0].toUpperCase(),
          lastLabel: lastVisit ? fmtDate(lastVisit.date) : '—',
          nextVisitNo: p.visits.length + 1,
          open: () => startVisitForExisting(pid),
        });
      }
    }
  }

  const curP = db.patients[curPatientId];
  const curV = curP && curP.visits.find((x) => x.visitId === curVisitId);
  const cur = {
    name: curP ? curP.name : '', patientId: curPatientId, visitId: curVisitId,
    mobile: curP ? curP.mobile : '', ageGender: curP ? (curP.age || '?') + ' yrs · ' + (curP.gender || '—') : '',
    dateLabel: curV ? fmtDate(curV.date) : '',
  };
  const history = [];
  const pendingList = [];
  let pendingTotal = 0;
  if (curP) {
    const sorted = curP.visits.slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    let runBal = 0;
    let lastReset = -1;
    sorted.forEach((v, i) => {
      const isCur = v.visitId === curVisitId;
      const cost = isCur ? num(cform.treatmentCost) : num(v.clinical && v.clinical.treatmentCost);
      const paid = isCur ? num(cform.amountPaid) : num(v.clinical && v.clinical.amountPaid);
      runBal += cost - paid;
      if (runBal < 0) { runBal = 0; lastReset = i; }
    });
    pendingTotal = runBal;
    const rawPending = [];
    sorted.forEach((v, i) => {
      const isCur = v.visitId === curVisitId;
      const cost = isCur ? num(cform.treatmentCost) : num(v.clinical && v.clinical.treatmentCost);
      const paid = isCur ? num(cform.amountPaid) : num(v.clinical && v.clinical.amountPaid);
      const visitOwes = cost - paid;
      const trr = v.clinical ? (/Other/.test(v.clinical.treatment) && v.clinical.treatmentOther ? v.clinical.treatmentOther : v.clinical.treatment) : '';
      if (i > lastReset && visitOwes > 0) {
        rawPending.push({ visitId: v.visitId, dateLabel: fmtDate(v.date), rawAmount: visitOwes, current: isCur });
      }
      const bal = num(v.clinical && v.clinical.balanceDue);
      history.push({
        visitId: v.visitId, dateLabel: fmtDate(v.date), treatmentLabel: trr || '—',
        cost: cost ? inr(cost) : '—', balance: bal ? inr(bal) : '—',
        status: (v.clinical && v.clinical.paymentStatus) || '—', current: isCur, rowBg: isCur ? '#eef7f6' : '#fff',
      });
    });
    let credit = rawPending.reduce((s, p) => s + p.rawAmount, 0) - pendingTotal;
    for (const p of rawPending) {
      if (credit <= 0) break;
      const absorb = Math.min(credit, p.rawAmount);
      p.rawAmount -= absorb;
      credit -= absorb;
    }
    for (const p of rawPending) {
      if (p.rawAmount > 0) {
        pendingList.push({ visitId: p.visitId, dateLabel: p.dateLabel, amount: inr(p.rawAmount), current: p.current });
      }
    }
  }
  cur.history = history;
  let prevPending = 0;
  if (curP) {
    const prevSorted = curP.visits.filter((v) => v.visitId !== curVisitId).slice().sort((a, b) => (a.no || 0) - (b.no || 0));
    prevSorted.forEach((v) => {
      prevPending += num(v.clinical && v.clinical.treatmentCost) - num(v.clinical && v.clinical.amountPaid);
      if (prevPending < 0) prevPending = 0;
    });
  }
  const computedBalance = num(cform.treatmentCost) + prevPending - num(cform.amountPaid);

  // Appointment count for the selected next date in clinical form
  let apptCount = 0;
  if (cform.nextAppointment) {
    for (const pid of db.order) {
      for (const v of db.patients[pid].visits) {
        if (v.visitId === curVisitId) continue;
        if (v.clinical && v.clinical.nextAppointment === cform.nextAppointment) apptCount++;
      }
    }
  }
  const apptCountText = apptCount === 0
    ? 'No other appointments booked on this day.'
    : apptCount === 1
      ? '1 appointment already booked on this day.'
      : apptCount + ' appointments already booked on this day.';

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header view={view} onGoDash={goDash} onGoAppts={goAppts} onGoPatients={goPatients} user={user} onLogout={onLogout} />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 22px 60px' }}>
        {loadError && (
          <p style={{ color: '#c0392b', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{loadError}</p>
        )}

        {view === 'dashboard' && (
          <Dashboard
            dateFrom={dateFrom} dateTo={dateTo}
            onSetRange={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onRefresh={() => loadList(true)} refreshing={refreshing}
            stats={stats} q={q} onSetQ={setQ}
            visitRows={visitRows} hasVisits={visitRows.length > 0} noVisits={rows.length === 0}
          />
        )}

        {view === 'appointments' && (
          <Appointments
            appts={appts} hasAppts={appts.length > 0} noAppts={appts.length === 0}
            apptDate={apptDate} onSetApptDate={setApptDate}
            onApptToday={() => setApptDate(today())} apptDateLabel={apptDateLabel}
            apptDatesMap={apptDatesMap}
            showCal={showApptCal} onSetShowCal={setShowApptCal}
          />
        )}

        {view === 'patients' && (
          <Patients
            allPatients={allPatients} outstandingTotal={outstandingTotal}
            onOpenPatient={openPatientDetail}
          />
        )}

        {view === 'patientDetail' && detailPid && db.patients[detailPid] && (
          <PatientDetail
            patient={db.patients[detailPid]} patientId={detailPid}
            onGoBack={goBack}
          />
        )}

        {view === 'intake' && (
          <Intake
            form={form} onSetField={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
            onLookup={onLookup} lookupState={lookupState} existingPatientId={existingPatientId} nextVisitNo={nextVisitNo}
            previewPatientId={previewPatientId} previewVisitId={previewVisitId}
            mobilePatients={mobilePatients} addAnother={addAnother}
            onSelectPatient={onSelectPatient} onAddAnother={onAddAnother} onCancelAddAnother={onCancelAddAnother}
            intakeError={intakeError} onGoBack={goBack} onSaveIntake={onSaveIntake} saving={savingIntake}
            intakeMode={intakeMode} onSetIntakeMode={setIntakeMode}
            intakeSearch={intakeSearch} onSetIntakeSearch={setIntakeSearch}
            intakeResults={intakeResults} hasIntakeResults={intakeResults.length > 0}
            showIntakeEmpty={!!intakeSearchQ && intakeResults.length === 0}
          />
        )}

        {view === 'clinical' && curP && (
          <Clinical
            cur={cur} hasHistory={history.length > 0}
            cform={cform} onSetField={(k, v) => setCform((f) => ({ ...f, [k]: v }))}
            showTreatmentOther={/Other/.test(cform.treatment)}
            showAdvisedTreatmentOther={/Other/.test(cform.advisedTreatment)}
            prevPending={prevPending} prevPendingLabel={inr(prevPending)}
            amountToCollect={num(cform.treatmentCost) + prevPending}
            amountToCollectLabel={inr(num(cform.treatmentCost) + prevPending)}
            computedBalance={computedBalance}
            computedBalanceLabel={inr(computedBalance)}
            balanceColor={computedBalance > 0 ? '#c0392b' : '#12805a'}
            hasPending={pendingList.length > 0} noPending={pendingList.length === 0}
            pendingTotalLabel={inr(pendingTotal)} pendingList={pendingList}
            hasQr={!!db.upiQr} noQr={!db.upiQr} qrUrl={db.upiQr}
            qrUploadLabel={db.upiQr ? 'Replace scanner' : 'Upload scanner'} onUploadQr={onUploadQr}
            showQr={showQr} onOpenQr={() => setShowQr(true)} onCloseQr={() => setShowQr(false)}
            savedFlash={savedFlash} onGoBack={goBack} onSaveClinical={onSaveClinical} saving={savingClinical}
            error={clinicalError}
            apptCountText={apptCountText} showApptCount={!!cform.nextAppointment}
            db={db} curPatientId={curPatientId}
            readOnly={clinicalReadOnly}
            onCreateNewVisit={() => onCreateNewVisitFromAppt(curPatientId)}
          />
        )}
      </main>

      {(view === 'dashboard' || view === 'appointments' || view === 'patients') && !(view === 'appointments' && showApptCal) && (
        <button
          onClick={goIntake}
          title="New visit"
          aria-label="New visit"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 70, height: 58, padding: '0 24px',
            border: 0, borderRadius: 100, background: '#ef5a3c', color: '#fff', fontWeight: 700,
            fontSize: 15.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
            boxShadow: '0 14px 30px -8px rgba(239,90,60,.55)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Visit
        </button>
      )}

      {(savingIntake || savingClinical) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(238,244,243,.88)', backdropFilter: 'blur(2px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, border: '3.5px solid #d6e7e3',
            borderTopColor: '#12a094', borderRadius: '50%',
            animation: 'spin .7s linear infinite',
          }} />
          <span style={{ fontSize: 15, color: '#5c7a76', fontWeight: 600 }}>
            Loading, please wait...
          </span>
        </div>
      )}
    </div>
  );
}
