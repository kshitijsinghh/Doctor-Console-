// The doctor's form configuration model.
//
// Most of these exist to pin the two things that would hurt a live clinic:
// a config that arrives broken must still produce a usable form, and a value
// a doctor has hidden must still appear on the visit that already used it.
import {
  FIELD_DEFS, FIELD_KEYS, DROPDOWN_KEYS,
  defaultConfig, mergeConfig, mergeDropdown,
  fieldOn, fieldBlockedByParent, isLocked,
  enabledValues, valuesForVisit, valueRows,
  setField, toggleValue, setAllValues, addValue, removeValue, toWire,
  medSummary, medMatches, medSuggestions, validateMedicine, searchMedicines,
  medToRow, medAbbr, emptyMedicine,
} from '../src/settings/formConfig.js';
import { CHIEF_COMPLAINTS, TREATMENTS, TREATMENT_GROUPS, MEDICINE_FORMS } from '../src/options.js';

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : JSON.stringify(got)); }
};

/* ══ Defaults must reproduce today's form exactly ═══════════════════════ */

const d = defaultConfig();

check('14 fields are defined', FIELD_DEFS.length === 14, FIELD_DEFS.length);
check('every field except Comments defaults on',
  FIELD_KEYS.filter((k) => !fieldOn(d, k)).join() === 'comments',
  FIELD_KEYS.filter((k) => !fieldOn(d, k)));
// The whole safety argument for this feature: a clinic that never opens the
// settings page must see the form it has today, option for option.
check('the default chief complaint list IS options.js, not the prototype',
  enabledValues(d, 'chiefComplaint').join('|') === CHIEF_COMPLAINTS.join('|'));
check('the default treatment list IS options.js — all 37, not the prototype 21',
  enabledValues(d, 'treatment').length === TREATMENTS.length && TREATMENTS.length > 21,
  { got: enabledValues(d, 'treatment').length, expected: TREATMENTS.length });
check('...including the ones the prototype dropped',
  ['Irrigation', 'ICM', 'WL', 'Suture Removal', 'Pulpectomy', 'SDF', 'Braces', 'Aligners']
    .every((t) => enabledValues(d, 'treatment').includes(t)));
check('advised starts as the same list as current treatment',
  enabledValues(d, 'advised').join('|') === TREATMENTS.join('|'));
check('treatment group defaults to options.js', enabledValues(d, 'treatmentGroup').join('|') === TREATMENT_GROUPS.join('|'));
check('medicine type defaults to MEDICINE_FORMS', enabledValues(d, 'medType').join('|') === MEDICINE_FORMS.join('|'));
// labName has never had a built-in list; it comes from the clinic's Sheet.
check('lab name starts empty so the Sheet list still wins', enabledValues(d, 'labName').length === 0);
check('all 8 dropdown lists exist', DROPDOWN_KEYS.length === 8, DROPDOWN_KEYS);

/* ══ Locked fields and the dependency ══════════════════════════════════ */

check('chief complaint is locked', isLocked('chiefComplaint'));
check('billing is locked', isLocked('billing'));
check('a locked field cannot be switched off', fieldOn(setField(d, 'chiefComplaint', false), 'chiefComplaint'));
check('...not even by a config that says it is off',
  fieldOn(mergeConfig({ fields: { chiefComplaint: false, billing: false } }), 'chiefComplaint')
  && fieldOn(mergeConfig({ fields: { billing: false } }), 'billing'));

const noTreat = setField(d, 'treatment', false);
check('turning off current treatment forces treatment group off', fieldOn(noTreat, 'treatmentGroup') === false);
check('...and the page can say why', fieldBlockedByParent(noTreat, 'treatmentGroup') === true);
check('...even though the stored value still says on', noTreat.fields.treatmentGroup === true);
// The rule is applied on read, so turning the parent back on restores it
// rather than leaving the child silently off.
check('turning current treatment back on restores treatment group',
  fieldOn(setField(noTreat, 'treatment', true), 'treatmentGroup') === true);
check('the dependency is enforced on the wire shape too',
  toWire(noTreat).fields.treatmentGroup === false, toWire(noTreat).fields.treatmentGroup);

/* ══ A broken config must never produce an empty form ══════════════════ */

const broken = [null, undefined, {}, 'nonsense', 42, { fields: null, dropdowns: 'x' }, { dropdowns: { treatment: 'oops' } }];
check('every malformed config still yields the full treatment list',
  broken.every((b) => enabledValues(mergeConfig(b), 'treatment').length === TREATMENTS.length));
check('...and still renders chief complaint',
  broken.every((b) => fieldOn(mergeConfig(b), 'chiefComplaint')));
check('a dropdown of garbage rows falls back to nothing usable being lost',
  mergeDropdown('treatment', [null, {}, { value: '   ' }]).length === TREATMENTS.length);

/* ══ Merging forward: a new built-in reaches clinics that saved earlier ══ */

// A clinic saved its config when the list was shorter. Adding a treatment in a
// later release must reach them, or the first clinic to open this page freezes
// its list for good.
const old = mergeConfig({ dropdowns: { treatment: [{ value: 'RCT', enabled: false, custom: false }] } });
check('a built-in missing from a saved config is restored, enabled',
  valueRows(old, 'treatment').length === TREATMENTS.length);
check('...while the one that was explicitly hidden stays hidden',
  enabledValues(old, 'treatment').includes('RCT') === false);
check('...and built-ins keep options.js order',
  valueRows(old, 'treatment').slice(0, TREATMENTS.length).map((r) => r.value).join('|') === TREATMENTS.join('|'));

// A stored row claiming a built-in is custom must not get a delete button.
const liar = mergeConfig({ dropdowns: { treatment: [{ value: 'RCT', enabled: true, custom: true }] } });
check('a stored row cannot promote a built-in to deletable',
  valueRows(liar, 'treatment').find((r) => r.value === 'RCT').custom === false);
check('...so removeValue refuses it',
  valueRows(removeValue(liar, 'treatment', 'RCT'), 'treatment').some((r) => r.value === 'RCT'));

/* ══ Adding, hiding and deleting values ════════════════════════════════ */

let c = defaultConfig();
const a1 = addValue(c, 'treatment', '  Pulpotomy  ');
c = a1.config;
check('a new value is trimmed and added', enabledValues(c, 'treatment').includes('Pulpotomy') && !a1.error);
check('...at the end, after the built-ins',
  valueRows(c, 'treatment')[valueRows(c, 'treatment').length - 1].value === 'Pulpotomy');
check('...and is marked as the doctor\'s own', valueRows(c, 'treatment').find((r) => r.value === 'Pulpotomy').custom === true);

const dup = addValue(c, 'treatment', 'pulpotomy');
check('a case-insensitive duplicate is refused', /already in this list/.test(dup.error), dup.error);
check('...and nothing is added', valueRows(dup.config, 'treatment').length === valueRows(c, 'treatment').length);
check('a duplicate of a built-in is refused too', /already in this list/.test(addValue(c, 'treatment', 'rct').error));
check('an empty value is ignored without an error',
  addValue(c, 'treatment', '   ').error === '' && valueRows(addValue(c, 'treatment', '   ').config, 'treatment').length === valueRows(c, 'treatment').length);

c = removeValue(c, 'treatment', 'Pulpotomy');
check('a value the doctor added can be deleted', !enabledValues(c, 'treatment').includes('Pulpotomy'));

c = toggleValue(defaultConfig(), 'chiefComplaint', 'Teeth Grinding');
check('a built-in can be hidden', !enabledValues(c, 'chiefComplaint').includes('Teeth Grinding'));
check('...but is still in the list, so it can come back',
  valueRows(c, 'chiefComplaint').some((r) => r.value === 'Teeth Grinding'));
check('hide all empties the form list', enabledValues(setAllValues(c, 'chiefComplaint', false), 'chiefComplaint').length === 0);
check('show all restores it', enabledValues(setAllValues(c, 'chiefComplaint', true), 'chiefComplaint').length === CHIEF_COMPLAINTS.length);

/* ══ Old visits keep their values ══════════════════════════════════════ */

// The failure this prevents: open a visit recorded against a treatment that
// has since been hidden, and the multi-select silently drops it — then saving
// writes the blank back over the record.
const hidden = toggleValue(defaultConfig(), 'treatment', 'RCT');
check('a hidden value is gone from a fresh form', !enabledValues(hidden, 'treatment').includes('RCT'));
check('...but present when editing a visit that used it',
  valuesForVisit(hidden, 'treatment', ['RCT', 'Crown']).includes('RCT'));
check('...and so is a value deleted outright',
  valuesForVisit(defaultConfig(), 'treatment', ['Some Bespoke Treatment']).includes('Some Bespoke Treatment'));
check('...appended, never reordering the live list',
  valuesForVisit(defaultConfig(), 'treatment', ['Zzz Gone']).slice(-1)[0] === 'Zzz Gone');
check('...with no duplicate when the value is still live',
  valuesForVisit(defaultConfig(), 'treatment', ['RCT']).filter((v) => v === 'RCT').length === 1);
check('a single string value works as well as an array',
  valuesForVisit(hidden, 'treatment', 'RCT').includes('RCT'));
check('an empty current value changes nothing',
  valuesForVisit(defaultConfig(), 'treatment', '').length === TREATMENTS.length);

/* ══ The wire shape ════════════════════════════════════════════════════ */

const wire = toWire(defaultConfig());
check('the wire shape is { fields, dropdowns }',
  Object.keys(wire).sort().join() === 'dropdowns,fields', Object.keys(wire));
check('every field is a boolean', FIELD_KEYS.every((k) => typeof wire.fields[k] === 'boolean'));
check('every value row is { value, enabled, custom }',
  DROPDOWN_KEYS.every((k) => wire.dropdowns[k].every((r) =>
    typeof r.value === 'string' && typeof r.enabled === 'boolean' && typeof r.custom === 'boolean')));
// A save followed by a load must not drift, or autosave would rewrite the
// record on every page open.
check('a round trip through the wire is stable',
  JSON.stringify(toWire(mergeConfig(wire))) === JSON.stringify(wire));

const edited = addValue(toggleValue(defaultConfig(), 'treatment', 'RCT'), 'treatment', 'Pulpotomy').config;
check('an edited config also round-trips',
  JSON.stringify(toWire(mergeConfig(toWire(edited)))) === JSON.stringify(toWire(edited)));

/* ══ Medicines ═════════════════════════════════════════════════════════ */

const MED = (name, unit, slots, food, duration, remarks) => ({
  id: name, name, unit,
  morning: slots.includes('M'), afternoon: slots.includes('A'),
  evening: slots.includes('E'), night: slots.includes('N'),
  food, duration, remarks,
});
const meds = [
  MED('Amoxicillin 500mg', 'Capsule', 'MAN', 'After Food', '5', 'Complete the full course'),
  MED('Amoxicillin + Clavulanic acid 625mg', 'Tablet', 'MN', 'After Food', '5', ''),
  MED('Ibuprofen 400mg', 'Tablet', 'MN', 'After Food', '3', 'Only if in pain'),
  MED('Paracetamol 650mg', 'Tablet', 'MAN', 'After Food', '3', 'Max 3 a day'),
  MED('Chlorhexidine 0.2% mouthwash', 'Mouthwash', 'MN', 'After Food', '7', '10 ml, rinse 30 sec'),
  MED('Pantoprazole 40mg', 'Tablet', 'M', 'Before Food', '5', 'Empty stomach'),
];

check('the summary line reads as the spec describes',
  medSummary(meds[0]) === 'Capsule · M-A-N (Morning, Afternoon, Night) · After Food · 5 days',
  medSummary(meds[0]));
check('a medicine with no timing omits that part',
  medSummary({ unit: 'Gel', food: 'After Food', duration: '' }) === 'Gel · After Food', medSummary({ unit: 'Gel', food: 'After Food', duration: '' }));
check('slots always read in a fixed order, whatever order they were set',
  medSummary(MED('x', 'Tablet', 'NM', 'After Food', '', '')) === 'Tablet · M-N (Morning, Night) · After Food');

check('"amo" matches both amoxicillins', medSuggestions(meds, 'amo').length === 2);
check('"500" matches on a word that is not the first', medSuggestions(meds, '500').map((m) => m.name).join() === 'Amoxicillin 500mg');
check('matching is case-insensitive', medSuggestions(meds, 'AMO').length === 2);
check('"clav" matches across a +', medSuggestions(meds, 'clav').length === 1);
check('"0.2" matches across a %', medSuggestions(meds, '0.2').length === 1, medSuggestions(meds, '0.2').map((m) => m.name));
// Deliberate: a mid-word match would make "ol" offer half the list.
check('a mid-word fragment does NOT match', medSuggestions(meds, 'mox').length === 0);
check('an empty query offers nothing', medSuggestions(meds, '   ').length === 0);
check('no more than 5 suggestions', medSuggestions(meds.concat(meds).concat(meds), 'a').length <= 5);

check('a blank name is rejected', validateMedicine({ name: '  ' }, meds) === 'Enter the medicine name.');
check('a duplicate name is rejected', /already in your list/.test(validateMedicine({ id: '', name: 'ibuprofen 400MG' }, meds)));
check('...but editing that same medicine is fine',
  validateMedicine({ id: 'Ibuprofen 400mg', name: 'Ibuprofen 400mg' }, meds) === '');
check('a new unique name is fine', validateMedicine({ id: '', name: 'Ketorolac 10mg' }, meds) === '');

const row = medToRow(meds[0]);
check('a picked medicine fills exactly the row fields',
  Object.keys(row).sort().join() === 'afternoon,duration,evening,food,morning,name,night,remarks,unit',
  Object.keys(row).sort());
check('...with no id leaking into the prescription row', row.id === undefined);
check('...and the values carried across',
  row.name === 'Amoxicillin 500mg' && row.unit === 'Capsule' && row.morning === true
  && row.evening === false && row.food === 'After Food' && row.duration === '5'
  && row.remarks === 'Complete the full course', row);
// The row's own selects are populated from MEDICINE_FORMS and FOOD_OPTIONS, so
// a library value outside those lists would render as a blank select.
check('the unit a medicine carries is one the form\'s select offers',
  meds.every((m) => MEDICINE_FORMS.includes(m.unit)));
check('a new medicine starts with a type the form offers',
  MEDICINE_FORMS.includes(emptyMedicine(defaultConfig()).unit), emptyMedicine(defaultConfig()).unit);
check('the type badge falls back rather than showing nothing', medAbbr({ unit: 'Nonsense' }) === 'MED');
check('known types get their badge', medAbbr(meds[0]) === 'CAP' && medAbbr(meds[1]) === 'TAB');

// The library's search box is deliberately broader than the form's
// autocomplete. Searching your own list should be forgiving; offering
// suggestions mid-prescription should not, or "amo" would put Paracetamol in
// front of a doctor reaching for Amoxicillin.
check('library search matches mid-word', searchMedicines(meds, 'mox').length === 2, searchMedicines(meds, 'mox').map((m) => m.name));
check('...so "amo" also finds Paracetamol',
  searchMedicines(meds, 'amo').map((m) => m.name).includes('Paracetamol 650mg')
  && searchMedicines(meds, 'amo').length === 3, searchMedicines(meds, 'amo').map((m) => m.name));
check('...while the form\'s autocomplete does NOT offer Paracetamol for "amo"',
  medSuggestions(meds, 'amo').map((m) => m.name).join() === 'Amoxicillin 500mg,Amoxicillin + Clavulanic acid 625mg',
  medSuggestions(meds, 'amo').map((m) => m.name));
check('an empty search returns everything', searchMedicines(meds, '').length === meds.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
