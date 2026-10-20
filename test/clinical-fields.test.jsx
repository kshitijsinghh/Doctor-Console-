// Mounts the real doctor's form and drives it to step 2.
//
// The render smoke test can only see step 1: `step` is internal state and the
// billing page is never rendered until someone clicks the tab. Step 2 is
// exactly where the riskiest edits are — the Follow-up, Lab and Documents
// guards are hand-written JSX fragments, and Comments sits INSIDE the Follow-up
// grid while being a separate setting. If those nest wrongly, the build still
// passes and a doctor loses a field.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://clinic.test/', pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch { /* Node already provides one */ }
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act, createElement: h } = await import('react');
const Clinical = (await import('../src/views/Clinical.jsx')).default;
const { FormConfigContext } = await import('../src/settings/FormConfigContext.jsx');
const { WaProvider } = await import('../src/whatsapp/WaContext.jsx');
const { defaultConfig, setField, addValue, toggleValue } = await import('../src/settings/formConfig.js');
const MedicinesTab = (await import('../src/settings/MedicinesTab.jsx')).default;

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : String(got).slice(0, 220)); }
};

const LIBRARY = [
  { id: 'm1', name: 'Amoxicillin 500mg', unit: 'Capsule', morning: true, afternoon: true, evening: false, night: true, food: 'After Food', duration: '5', remarks: 'Complete the full course' },
  { id: 'm2', name: 'Ibuprofen 400mg', unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '3', remarks: '' },
];

function makeProps(cform, onSetField) {
  return {
    cur: { visitId: 'P0001_9', name: 'Kshitij Singh', mobile: '9110968006', date: '2026-10-13' },
    hasHistory: false, cform, onSetField,
    prevPending: 0, prevPendingLabel: '₹0',
    amountToCollect: 0, amountToCollectLabel: '₹0',
    computedBalance: 0, computedBalanceLabel: '₹0', balanceColor: '#12805a',
    hasPending: false, noPending: true, pendingTotalLabel: '₹0', pendingList: [],
    hasQr: false, noQr: true, qrUrl: '', qrUploadLabel: 'Upload scanner',
    onUploadQr() {}, showQr: false, onOpenQr() {}, onCloseQr() {},
    savedFlash: false, onGoBack() {}, onSaveClinical() {}, onSaveAndNext() {}, saving: false,
    error: '', apptCountText: '', showApptCount: false,
    db: { patients: {}, order: [] }, curPatientId: 'P0001',
    labNames: ['DentCare Lab'], readOnly: false, onCreateNewVisit() {},
    clinicName: 'Example Dental', clinicAddress: 'X', doctorName: 'Mehta', doctorQualification: 'BDS',
    rxTemplateUrl: null, hasDocxTemplate: false, hasReceiptTemplate: false, onPaymentSaved() {},
  };
}

const baseCform = () => ({
  chiefComplaint: [], treatment: [], advisedTreatment: [], treatmentGroup: [],
  medicines: [], treatmentTeeth: {}, advisedTeeth: {}, paySplits: [], documents: [],
  treatmentStage: '', nextAppointment: '', nextAppointmentTime: '', labName: '',
  comments: '', medicalHistory: '', diagnosis: '', investigation: '', chiefDescription: '',
  treatmentCost: '', amountPaid: '', paymentMode: '',
});

// Mounts the form and returns helpers. `cform` is kept in a closure and
// updated by onSetField, so the form behaves like the real one: typing into a
// medicine row actually changes the row.
function mount(config, { cform = baseCform(), medicines = LIBRARY, props = {}, addMedicines } = {}) {
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let state = cform;
  let extra = props;
  const sets = [];
  const ctx = { config, medicines, loaded: true, reload() {}, addMedicines: addMedicines || (async () => []) };

  function render() {
    root.render(
      h(WaProvider, { org: { waEnabled: false }, orgLoaded: true },
        h(FormConfigContext.Provider, { value: ctx },
          h(Clinical, {
            ...makeProps(state, (k, v) => { sets.push([k, v]); state = { ...state, [k]: v }; render(); }),
            ...extra,
          }))),
    );
  }
  act(() => { render(); });

  const text = () => host.textContent || '';
  const html = () => host.innerHTML;
  const findByText = (sel, re) => [...host.querySelectorAll(sel)].find((el) => re.test(el.textContent || ''));
  const click = (el) => { act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };

  function gotoStep2() {
    const tab = findByText('button', /2 · Billing/);
    if (!tab) throw new Error('step 2 tab not found');
    click(tab);
  }

  const update = (partial) => { extra = { ...extra, ...partial }; act(() => { render(); }); };

  return { host, root, text, html, findByText, click, gotoStep2, sets, update, state: () => state,
    unmount: () => act(() => root.unmount()) };
}

/* ══ Step 2: the hand-written fragments ════════════════════════════════ */

let m = mount(defaultConfig());
m.gotoStep2();
check('step 2 renders at all with the default configuration', /Billing/.test(m.text()), m.text().slice(0, 120));
check('Follow-up is there', /Treatment stage/.test(m.text()));
check('Lab requirements is there', /Lab Requirements/.test(m.text()));
check('Documents is there', /Documents/.test(m.text()));
check('Comments is NOT, because it ships off', !/Any notes for this visit/.test(m.html()));
m.unmount();

// Comments and Follow-up share a grid in the markup but are separate settings.
m = mount(setField(defaultConfig(), 'comments', true));
m.gotoStep2();
check('switching Comments on shows it', /Any notes for this visit/.test(m.html()));
m.unmount();

m = mount(setField(setField(defaultConfig(), 'comments', true), 'followUp', false));
m.gotoStep2();
check('switching off Follow-up removes Treatment stage', !/Treatment stage/.test(m.text()));
check('...and removes the Follow-up heading', !/Follow-up/.test(m.text()));
// The one that would silently break if the guards were nested.
check('...but does NOT take Comments with it', /Any notes for this visit/.test(m.html()));
check('...and Billing is untouched', /Treatment cost/.test(m.text()));
m.unmount();

m = mount(setField(defaultConfig(), 'lab', false));
m.gotoStep2();
check('switching off Lab requirements removes it', !/Lab Requirements/.test(m.text()));
check('...and leaves Documents', /Documents/.test(m.text()));
check('...and leaves Follow-up', /Treatment stage/.test(m.text()));
m.unmount();

m = mount(setField(defaultConfig(), 'documents', false));
m.gotoStep2();
check('switching off Documents removes it', !/Documents/.test(m.text()));
check('...and leaves Lab requirements', /Lab Requirements/.test(m.text()));
check('...and leaves Billing', /Treatment cost/.test(m.text()));
m.unmount();

// Everything optional off at once — the worst case for mismatched fragments.
let allOff = defaultConfig();
['medicalHistory', 'description', 'diagnosis', 'advised', 'investigation', 'treatment', 'medicine', 'followUp', 'lab', 'documents']
  .forEach((k) => { allOff = setField(allOff, k, false); });
m = mount(allOff);
check('with every optional field off, step 1 still renders', /Chief complaint/.test(m.text()));
check('...and only the locked field remains',
  !/Medical history|Diagnosis|Investigation|Prescribed medicine/.test(m.text()), m.text().slice(0, 200));
m.gotoStep2();
check('...and step 2 still renders its locked Billing section', /Treatment cost/.test(m.text()));
m.unmount();

/* ══ Lab name: the migration from the Google Sheet ═════════════════════ */

m = mount(defaultConfig());
m.gotoStep2();
act(() => { const acc = m.findByText('button', /Lab Requirements/); acc.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
check("the Sheet's lab list is used while none is configured", /DentCare Lab/.test(m.html()));
m.unmount();

m = mount(addValue(defaultConfig(), 'labName', 'Precision Dental Lab').config);
m.gotoStep2();
act(() => { const acc = m.findByText('button', /Lab Requirements/); acc.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
check('...and the configured list takes over once there is one', /Precision Dental Lab/.test(m.html()));
check('...replacing the Sheet list rather than merging with it', !/DentCare Lab/.test(m.html()));
m.unmount();

/* ══ A visit keeps a value the doctor has since hidden ═════════════════ */

// The failure this prevents: open a visit recorded against a lab that has
// since been hidden, the select silently drops it, and saving writes the blank
// back over the record. Checked on the native <select> because that is the one
// configured list whose options are in the DOM without being opened — a closed
// MultiSelect renders none, and draws selected values as chips either way.
const hiddenLab = toggleValue(addValue(defaultConfig(), 'labName', 'Precision Dental Lab').config, 'labName', 'Precision Dental Lab');
m = mount(addValue(hiddenLab, 'labName', 'Smile Crafts').config,
  { cform: { ...baseCform(), labName: 'Precision Dental Lab' } });
m.gotoStep2();
act(() => { m.findByText('button', /Lab Requirements/).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
const labOpts = [...m.host.querySelectorAll('option')].map((o) => o.textContent);
check('a hidden value is still offered on the visit that uses it',
  labOpts.includes('Precision Dental Lab'), labOpts);
check('...and the visible list is otherwise unchanged', labOpts.includes('Smile Crafts'), labOpts);
m.unmount();

// ...and it is genuinely hidden on a visit that does not use it.
m = mount(addValue(hiddenLab, 'labName', 'Smile Crafts').config, { cform: { ...baseCform(), labName: '' } });
m.gotoStep2();
act(() => { m.findByText('button', /Lab Requirements/).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
const freshOpts = [...m.host.querySelectorAll('option')].map((o) => o.textContent);
check('a hidden value is gone from a visit that does not use it',
  !freshOpts.includes('Precision Dental Lab'), freshOpts);
m.unmount();

/* ══ The medicine autocomplete, driven as a doctor drives it ═══════════ */

function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

m = mount(defaultConfig(), { cform: { ...baseCform(), medicines: [{ name: '', unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '', remarks: '' }] } });
const nameInput = [...m.host.querySelectorAll('input')].find((i) => /Amoxicillin 500mg/.test(i.placeholder || ''));
check('the medicine row has a name input', !!nameInput);

typeInto(nameInput, 'amo');
check('typing offers the matching medicines',
  /Amoxicillin 500mg/.test(m.html()) && /Amoxicillin \+ Clavulanic/.test(m.html()) === false,
  m.html().includes('Amoxicillin 500mg'));
check('...with the summary line', /Capsule · M-A-N/.test(m.html()), (m.html().match(/Capsule[^<]*/) || [])[0]);
check('...and the one-off escape hatch', /as a one-off medicine/.test(m.html()));

const suggestion = [...m.host.querySelectorAll('button')].find((b) => /Amoxicillin 500mg/.test(b.textContent || ''));
m.click(suggestion);

const row = m.state().medicines[0];
check('picking fills the whole row in ONE update',
  row.name === 'Amoxicillin 500mg' && row.unit === 'Capsule' && row.duration === '5'
  && row.remarks === 'Complete the full course' && row.afternoon === true,
  row);
// The bug this guards: seven sequential single-key updates would each rebuild
// from the pre-pick row, so only the last field would survive.
check('...not field by field', m.sets.filter(([k]) => k === 'medicines').length === 2, m.sets.map(([k]) => k));
check('...and the suggestion panel closes', !/as a one-off medicine/.test(m.html()));
check('...and nothing is written back to the library',
  LIBRARY[0].duration === '5' && LIBRARY[0].name === 'Amoxicillin 500mg');
m.unmount();

// Typing goes through titleCase; picking must not, or a saved name like
// "Chlorhexidine 0.2% mouthwash" would come back as "... Mouthwash".
m = mount(defaultConfig(), {
  medicines: [{ id: 'c1', name: 'Chlorhexidine 0.2% mouthwash', unit: 'Mouthwash', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '7', remarks: '10 ml, rinse 30 sec' }],
  cform: { ...baseCform(), medicines: [{ name: '', unit: 'Tablet', morning: false, afternoon: false, evening: false, night: false, food: 'After Food', duration: '', remarks: '' }] },
});
const n4 = [...m.host.querySelectorAll('input')].find((i) => /Amoxicillin 500mg/.test(i.placeholder || ''));
typeInto(n4, 'chlor');
const chlorBtn = [...m.host.querySelectorAll('button')].find((b) => /Chlorhexidine/.test(b.textContent || ''));
m.click(chlorBtn);
check('a picked medicine keeps the library\'s exact casing',
  m.state().medicines[0].name === 'Chlorhexidine 0.2% mouthwash', m.state().medicines[0].name);
m.unmount();

// A medicine that is not in the library must survive being typed.
m = mount(defaultConfig(), { cform: { ...baseCform(), medicines: [{ name: '', unit: 'Tablet', morning: false, afternoon: false, evening: false, night: false, food: 'After Food', duration: '', remarks: '' }] } });
const n2 = [...m.host.querySelectorAll('input')].find((i) => /Amoxicillin 500mg/.test(i.placeholder || ''));
typeInto(n2, 'Ketorolac 10mg');
check('a medicine that is not in the library is kept as typed',
  m.state().medicines[0].name === 'Ketorolac 10mg', m.state().medicines[0].name);
check('...and no saved medicine is offered for it',
  ![...m.host.querySelectorAll('button')].some((b) => /Amoxicillin 500mg/.test(b.textContent || '')));
m.unmount();

// An empty library must not break the row.
m = mount(defaultConfig(), { medicines: [], cform: { ...baseCform(), medicines: [{ name: '', unit: 'Tablet', morning: false, afternoon: false, evening: false, night: false, food: 'After Food', duration: '', remarks: '' }] } });
const n3 = [...m.host.querySelectorAll('input')].find((i) => /Amoxicillin 500mg/.test(i.placeholder || ''));
typeInto(n3, 'amo');
// Clinical.setMed title-cases the name as you type. That is existing
// behaviour, not something this feature introduced, and the autocomplete is
// case-insensitive so it keeps matching regardless.
check('an empty library still lets the doctor type', m.state().medicines[0].name === 'Amo',
  m.state().medicines[0].name);
check('...and offers the one-off row only', /as a one-off medicine/.test(m.html()));
m.unmount();

/* ══ A field switched off still shows on a visit that recorded it ══════ */

// Switched off and the visit is empty — gone, as before.
m = mount(setField(defaultConfig(), 'diagnosis', false));
check('a switched-off field is gone from a new visit', !/Clinical diagnosis/.test(m.html()));
m.unmount();

// Switched off but this visit recorded one — it must still be editable, or
// opening the visit drops the value and the next save writes it away.
m = mount(setField(defaultConfig(), 'diagnosis', false),
  { cform: { ...baseCform(), diagnosis: 'Irreversible pulpitis' } });
check('...but shows on a visit that recorded a value', /Clinical diagnosis/.test(m.html()));
check('...with the value in it', m.html().includes('Irreversible pulpitis'), 'value missing');
m.unmount();

m = mount(setField(defaultConfig(), 'medicine', false),
  { cform: { ...baseCform(), medicines: [{ name: 'Ibuprofen 400mg', unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '3', remarks: '' }] } });
check('a prescription keeps the medicine section visible', /Prescribed medicine/.test(m.text()));
m.unmount();

m = mount(setField(defaultConfig(), 'medicine', false),
  { cform: { ...baseCform(), medicines: [{ name: '', unit: 'Tablet', morning: false, afternoon: false, evening: false, night: false, food: 'After Food', duration: '', remarks: '' }] } });
check('...but a blank medicine row does not', !/Prescribed medicine/.test(m.text()));
m.unmount();

// Step 2, where the guards are hand-written fragments.
m = mount(setField(defaultConfig(), 'lab', false), { cform: { ...baseCform(), labName: 'DentCare Lab' } });
m.gotoStep2();
check('a lab name recorded earlier keeps Lab Requirements visible', /Lab Requirements/.test(m.text()));
m.unmount();

m = mount(setField(defaultConfig(), 'followUp', false), { cform: { ...baseCform(), treatmentStage: 'In Progress' } });
m.gotoStep2();
check('a treatment stage recorded earlier keeps Follow-up visible', /Treatment stage/.test(m.text()));
m.unmount();

m = mount(setField(defaultConfig(), 'followUp', false), { cform: baseCform() });
m.gotoStep2();
check('...and an empty visit still hides it', !/Treatment stage/.test(m.text()));
m.unmount();

// Current treatment off, but the visit recorded a treatment group: the record
// wins over the dependency.
m = mount(setField(defaultConfig(), 'treatment', false), { cform: { ...baseCform(), treatmentGroup: ['Endodontics'] } });
check('a recorded treatment group survives its parent being switched off',
  /Treatment group/.test(m.text()));
m.unmount();

/* ══ A medicine written on a prescription is added to the library ══════ */

function learner() {
  const calls = [];
  return { calls, fn: async (list) => { calls.push(list); return list.map((x, i) => ({ ...x, id: 'new' + i })); } };
}

const rxRow = (name) => ({ name, unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '3', remarks: 'Only if in pain' });

let L = learner();
m = mount(defaultConfig(), {
  medicines: LIBRARY,
  cform: { ...baseCform(), medicines: [rxRow('Ketorolac 10mg')] },
  addMedicines: L.fn,
});
check('nothing is learned before the visit saves', L.calls.length === 0);
m.update({ savedFlash: true });
check('a medicine not in the library is learned once the visit saves',
  L.calls.length === 1 && L.calls[0][0].name === 'Ketorolac 10mg', L.calls);
check('...carrying the whole row, not just the name',
  L.calls[0][0].duration === '3' && L.calls[0][0].remarks === 'Only if in pain'
  && L.calls[0][0].night === true, L.calls[0][0]);
// savedFlash stays true for ~900ms and the form re-renders in that window;
// the effect is keyed on the flag alone so it runs once, not once per render.
m.update({ savedFlash: true, saving: false });
m.update({ savedFlash: true, error: '' });
check('...once, however many times the form re-renders meanwhile', L.calls.length === 1, L.calls.length);
m.unmount();

L = learner();
m = mount(defaultConfig(), {
  medicines: LIBRARY,
  cform: { ...baseCform(), medicines: [rxRow('Amoxicillin 500mg')] },
  addMedicines: L.fn,
});
m.update({ savedFlash: true });
check('a medicine already in the library is not learned again', L.calls.length === 0, L.calls);
m.unmount();

L = learner();
m = mount(defaultConfig(), {
  medicines: LIBRARY,
  cform: { ...baseCform(), medicines: [rxRow('')] },
  addMedicines: L.fn,
});
m.update({ savedFlash: true });
check('a blank row teaches nothing', L.calls.length === 0);
m.unmount();

// A read-only view is someone looking at an appointment, not prescribing.
L = learner();
m = mount(defaultConfig(), {
  medicines: LIBRARY,
  cform: { ...baseCform(), medicines: [rxRow('Ketorolac 10mg')] },
  addMedicines: L.fn,
  props: { readOnly: true },
});
m.update({ savedFlash: true, readOnly: true });
check('a read-only view never writes to the library', L.calls.length === 0);
m.unmount();

// The visit must save even when the library write blows up.
m = mount(defaultConfig(), {
  medicines: LIBRARY,
  cform: { ...baseCform(), medicines: [rxRow('Ketorolac 10mg')] },
  addMedicines: async () => { throw new Error('network'); },
});
let threw = false;
try { m.update({ savedFlash: true }); } catch { threw = true; }
check('a failing library write does not break the saved form', !threw);
m.unmount();

/* ══ The whole chain, with only fetch stubbed ═════════════════════════
   Every test above hands Clinical a fake addMedicines, so the path from the
   form through the context, the settings API and waFetch has never actually
   run. This is the part that decides whether a medicine reaches the server. */

const { FormConfigProvider } = await import('../src/settings/FormConfigContext.jsx');

dom.window.localStorage.setItem('pp_session', JSON.stringify({
  accessToken: 'test-token', expiresAt: Math.floor(Date.now() / 1000) + 3600,
}));

const http = [];
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = String(opts.method || 'GET').toUpperCase();
  let body = null;
  try { body = opts.body ? JSON.parse(opts.body) : null; } catch { /* not json */ }
  http.push({ url: u, method, body });
  if (u.includes('/settings/doctor-form')) {
    return new Response(JSON.stringify({ ok: true, fields: null, dropdowns: null, medicines: [], updatedAt: null }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/medicines')) {
    return new Response(JSON.stringify({ ok: true, medicine: { id: 'srv1', ...(body || {}) } }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};

async function settle() {
  for (let i = 0; i < 12; i++) await act(async () => { await Promise.resolve(); });
}

function mountReal(cform) {
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let state = cform;
  let extra = {};
  function render() {
    root.render(
      h(WaProvider, { org: { waEnabled: false }, orgLoaded: true },
        h(FormConfigProvider, null,
          h(Clinical, {
            ...makeProps(state, (k, v) => { state = { ...state, [k]: v }; render(); }),
            ...extra,
          }))),
    );
  }
  act(() => { render(); });
  return {
    host,
    update: (p) => { extra = { ...extra, ...p }; act(() => { render(); }); },
    unmount: () => act(() => root.unmount()),
  };
}

const realRow = { name: 'Ketorolac 10mg', unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '2', remarks: 'Only if in pain' };
const real = mountReal({ ...baseCform(), medicines: [realRow] });
await settle();

check('the console loads its settings at boot',
  http.some((c) => c.method === 'GET' && c.url.includes('/settings/doctor-form')),
  http.map((c) => c.method + ' ' + c.url));

const before = http.filter((c) => c.url.includes('/medicines')).length;
check('nothing is posted to the library before the visit saves', before === 0, before);

real.update({ savedFlash: true });
await settle();

const posts = http.filter((c) => c.method === 'POST' && c.url.includes('/medicines'));
check('saving the visit POSTs the new medicine for real', posts.length === 1,
  http.filter((c) => c.url.includes('/medicines')).map((c) => c.method + ' ' + c.url));
check('...to the create endpoint, not the delete one',
  posts.length === 1 && /\/medicines$/.test(posts[0].url.split('?')[0]), posts[0] && posts[0].url);
check('...with the clinic id the Lambda requires',
  posts.length === 1 && posts[0].body.clinicId === 'clinic_test', posts[0] && posts[0].body);
check('...and the whole row, not just the name',
  posts.length === 1 && posts[0].body.name === 'Ketorolac 10mg' && posts[0].body.unit === 'Tablet'
  && posts[0].body.duration === '2' && posts[0].body.remarks === 'Only if in pain'
  && posts[0].body.night === true, posts[0] && posts[0].body);
check('...and no id, so the server assigns one',
  posts.length === 1 && posts[0].body.id === undefined, posts[0] && posts[0].body);
real.unmount();

// A medicine already in the library must not be posted again.
http.length = 0;
global.fetch = (function (inner) {
  return async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/settings/doctor-form') && String(opts.method || 'GET').toUpperCase() === 'GET') {
      http.push({ url: u, method: 'GET', body: null });
      return new Response(JSON.stringify({
        ok: true, fields: null, dropdowns: null, updatedAt: null,
        medicines: [{ id: 'srv1', name: 'Ketorolac 10mg', unit: 'Tablet', morning: true, afternoon: false, evening: false, night: true, food: 'After Food', duration: '2', remarks: '' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return inner(url, opts);
  };
}(global.fetch));

const real2 = mountReal({ ...baseCform(), medicines: [realRow] });
await settle();
real2.update({ savedFlash: true });
await settle();
check('a medicine already in the library is not posted again',
  http.filter((c) => c.method === 'POST' && c.url.includes('/medicines')).length === 0,
  http.map((c) => c.method + ' ' + c.url));
real2.unmount();

/* ══ Typing a free-text value must produce ONE value, not one per letter ══

   The regression this pins: the dropdown options were being widened with the
   LIVE field value, so each partial the doctor typed into the Other box
   became a known option, which MultiSelect then reclassified from a draft
   into a standard selected chip the next keystroke could not replace.
   Typing "New" left N, Ne and New behind as three separate complaints. */

const clickEl = (el) => act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
// Last match, not first: a wrapper's textContent equals its only child's, and
// querySelectorAll returns ancestors first — so the first hit is the div with
// no click handler on it.
const byText = (mm, sel, re) => [...mm.host.querySelectorAll(sel)].filter((el) => re.test((el.textContent || '').trim())).pop();

function openPicker(mm, labelText) {
  const lab = [...mm.host.querySelectorAll('label')].find((l) => (l.textContent || '').trim() === labelText);
  if (!lab) throw new Error('no label: ' + labelText);
  const box = lab.nextElementSibling && lab.nextElementSibling.querySelector('div');
  if (!box) throw new Error('no chip box for ' + labelText);
  clickEl(box);
}

m = mount(defaultConfig());
openPicker(m, 'Chief complaint');
check('the picker opens', /Add Other/.test(m.text()), m.text().slice(0, 100));

const addOther = byText(m, 'div', /^Add Other$/);
check('the Add Other row is there', !!addOther);
clickEl(addOther);

const otherInput = [...m.host.querySelectorAll('input')].find((i) => /Type here/.test(i.placeholder || ''));
check('an empty free-text row appears', !!otherInput);

if (otherInput) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  for (const partial of ['N', 'Ne', 'New', 'New c', 'New cv']) {
    act(() => {
      setter.call(otherInput, partial);
      otherInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  const got = m.state().chiefComplaint;
  check('typing five characters leaves ONE value, not five',
    Array.isArray(got) && got.length === 1, got);
  check('...and it is the whole thing that was typed',
    Array.isArray(got) && got[0] === 'New cv', got);
  // The chip box must agree: one chip, not a trail of prefixes.
  check('...and the field shows one chip',
    (m.html().match(/New cv/g) || []).length >= 1 && !/>N<|>Ne</.test(m.html()), got);
}
m.unmount();

// The option list handed to a MultiSelect must never contain the live value.
m = mount(defaultConfig(), { cform: { ...baseCform(), chiefComplaint: ['Halfway typed'] } });
openPicker(m, 'Chief complaint');
const tickable = [...m.host.querySelectorAll('span')]
  .map((el) => (el.childElementCount === 0 ? (el.textContent || '').trim() : ''))
  .filter(Boolean);
check('a free-text value is not offered back as a tickable option',
  !tickable.includes('Halfway typed'), tickable.filter((t) => /Halfway/.test(t)));
// It is still kept — as a free-text row, which is how MultiSelect has always
// held values outside its list, and why it needs no help from the config.
check('...but the visit still holds it', /Halfway typed/.test(m.html()));
m.unmount();

/* ══ Deleting a medicine from the list row ════════════════════════════
   The row itself opens the editor when clicked, and deleting cannot be
   undone, so the two things worth pinning are that the bin does not delete
   on the first press and does not open the editor instead. */

function mountMeds({ medicines = LIBRARY, onDelete = async () => {}, onSave = async () => {} } = {}) {
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(h(MedicinesTab, {
      config: defaultConfig(), medicines, onSave, onDelete, onToast() {},
    }));
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

const binFor = (mm, name) => [...mm.host.querySelectorAll('button')]
  .find((b) => (b.getAttribute('aria-label') || '') === 'Delete ' + name);

let md = mountMeds();
check('every row has a delete button', !!binFor(md, 'Amoxicillin 500mg') && !!binFor(md, 'Ibuprofen 400mg'));
check('...labelled for assistive tech', binFor(md, 'Amoxicillin 500mg').getAttribute('title') === 'Delete Amoxicillin 500mg');
md.unmount();

const deleted = [];
md = mountMeds({ onDelete: async (id) => { deleted.push(id); } });
clickEl(binFor(md, 'Amoxicillin 500mg'));
check('one press does NOT delete', deleted.length === 0, deleted);
check('...it asks first', /Delete\?/.test(md.host.textContent || ''));
// Clicking the row opens the editor; the bin must not do that instead.
check('...and does not open the editor', !/Edit medicine/.test(md.host.textContent || ''));

clickEl([...md.host.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Cancel'));
check('cancel backs out', !/Delete\?/.test(md.host.textContent || '') && deleted.length === 0);

clickEl(binFor(md, 'Amoxicillin 500mg'));
const confirmBtn = [...md.host.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Delete');
check('the confirm button is there', !!confirmBtn);
await act(async () => { confirmBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
check('confirming deletes that medicine', deleted.join() === 'm1', deleted);
check('...and only that one', deleted.length === 1);
md.unmount();

// Only one row can be asking at a time.
md = mountMeds();
clickEl(binFor(md, 'Amoxicillin 500mg'));
clickEl(binFor(md, 'Ibuprofen 400mg'));
check('asking on a second row cancels the first',
  (md.host.textContent.match(/Delete\?/g) || []).length === 1,
  (md.host.textContent.match(/Delete\?/g) || []).length);
md.unmount();

// A failure must say so rather than pretend the medicine went.
md = mountMeds({ onDelete: async () => { throw new Error('network'); } });
clickEl(binFor(md, 'Amoxicillin 500mg'));
await act(async () => {
  [...md.host.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Delete')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
check('a failed delete leaves the medicine in the list', /Amoxicillin 500mg/.test(md.host.textContent || ''));
md.unmount();

/* ══ A draft keeps its text even once it spells an existing option ═════
   Typing "RCT New" used to stop dead at "RCT": that text named a standard
   option, so the row was reclassified, the input vanished mid-word and the
   rest of the name could not be typed. */

function typeOther(mm, label, text, { perChar = true } = {}) {
  openPicker(mm, label);
  const add = byText(mm, 'div', /^Add Other$/);
  clickEl(add);
  const input = [...mm.host.querySelectorAll('input')].find((i) => /Type here/.test(i.placeholder || ''));
  if (!input) throw new Error('no free-text row');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  const steps = perChar ? text.split('').map((_, i) => text.slice(0, i + 1)) : [text];
  for (const partial of steps) {
    act(() => {
      setter.call(input, partial);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  return input;
}

m = mount(defaultConfig());
let input = typeOther(m, 'Current treatment', 'RCT New');
check('the input survives passing through an exact option name', !!input.isConnected, 'input was removed');
check('...and still holds everything typed', input.value === 'RCT New', input.value);
check('the value is the full free-text entry, not the option it passed through',
  m.state().treatment.join() === 'RCT New', m.state().treatment);
m.unmount();

// Longer, and through an option name that is a prefix of another option.
m = mount(defaultConfig());
input = typeOther(m, 'Current treatment', 'Crown Lengthening');
check('a name extending an existing option types through',
  input.value === 'Crown Lengthening' && m.state().treatment.join() === 'Crown Lengthening',
  { typed: input.value, value: m.state().treatment });
m.unmount();

// Typing exactly an option and leaving the box settles it into a tick.
m = mount(defaultConfig());
input = typeOther(m, 'Current treatment', 'RCT');
check('typing an exact option name still holds it as a draft while focused',
  input.isConnected && input.value === 'RCT');
act(() => { input.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })); });
check('...and settles to the option itself on blur', m.state().treatment.join() === 'RCT', m.state().treatment);
check('...with the free-text row gone',
  ![...m.host.querySelectorAll('input')].some((i) => /Type here/.test(i.placeholder || '') && i.value === 'RCT'));
m.unmount();

// Enter settles too, and must not leave a duplicate behind.
m = mount(defaultConfig());
input = typeOther(m, 'Current treatment', 'RCT');
act(() => { input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
check('Enter settles an exact match', m.state().treatment.join() === 'RCT', m.state().treatment);
check('...exactly once', m.state().treatment.filter((v) => v === 'RCT').length === 1, m.state().treatment);
m.unmount();

// A genuine free-text value must not be swallowed on blur.
m = mount(defaultConfig());
input = typeOther(m, 'Current treatment', 'RCT New');
act(() => { input.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })); });
check('a free-text value survives blur unchanged', m.state().treatment.join() === 'RCT New', m.state().treatment);
m.unmount();

// Ticking an option and then typing a name that starts with it.
m = mount(defaultConfig(), { cform: { ...baseCform(), treatment: ['Crown'] } });
input = typeOther(m, 'Current treatment', 'Crown Lengthening');
check('an already-ticked option is not disturbed by a draft that extends it',
  m.state().treatment.includes('Crown') && m.state().treatment.includes('Crown Lengthening'),
  m.state().treatment);
check('...and neither is duplicated',
  m.state().treatment.filter((v) => v === 'Crown').length === 1, m.state().treatment);
m.unmount();

// Removing the chip for a draft whose text spells an option must remove the
// row, not toggle the option.
m = mount(defaultConfig());
input = typeOther(m, 'Current treatment', 'RCT');
const chipX = [...m.host.querySelectorAll('span')]
  .filter((el) => (el.textContent || '').trim() === '×' || (el.textContent || '').trim() === '×').pop();
if (chipX) {
  clickEl(chipX);
  check('removing the chip clears the value', (m.state().treatment || []).join() === '', m.state().treatment);
}
m.unmount();


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
