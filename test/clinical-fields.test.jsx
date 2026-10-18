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


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
