// The doctor's form configuration: which fields appear, what each dropdown
// offers, and the clinic's medicine library.
//
// Everything here is pure. The page edits this shape, the form reads it, and
// the API only ever carries it — so the rules that matter (a locked field
// cannot be switched off, a hidden value still shows on the visit that used
// it) are decided in one place and can be tested without a browser.
//
// THE DEFAULTS ARE THE CURRENT LISTS IN options.js, deliberately.
//
// The changelog says to copy the prototype's DROPS verbatim, but it also says
// the prototype's data is sample data, and the two lists are not the same:
// DROPS has 21 treatments, options.js has 37. Seeding from DROPS would mean a
// clinic that opens this page once silently loses Irrigation, ICM, WL, Suture
// Removal, Pulpectomy, SDF, Braces and Aligners — options they use daily. The
// defaults have to be what the form offers today, or turning the feature on is
// a regression.

import {
  CHIEF_COMPLAINTS, TREATMENT_GROUPS, TREATMENTS,
  MEDICINE_FORMS, PAYMENT_MODES, DOC_KINDS, FOOD_OPTIONS,
} from '../options';

// ── fields ────────────────────────────────────────────────────────────────

export const CLINICAL_GROUP = 'Clinical (step 1)';
export const BILLING_GROUP = 'Billing & files (step 2)';

// `locked` fields cannot be switched off at all. `dep` means "forced off when
// that other field is off" — the rule is applied by fieldOn, never by the
// stored value, so a config written while the parent was on still behaves when
// the parent is later turned off.
export const FIELD_DEFS = [
  { g: CLINICAL_GROUP, k: 'medicalHistory', label: 'Medical history', desc: "Doctor's own note, separate from what the patient fills in.", on: true },
  { g: CLINICAL_GROUP, k: 'chiefComplaint', label: 'Chief complaint', desc: 'Multi-select from your list.', on: true, locked: true },
  { g: CLINICAL_GROUP, k: 'description', label: 'Description', desc: 'Free text about the complaint.', on: true },
  { g: CLINICAL_GROUP, k: 'diagnosis', label: 'Diagnosis', desc: 'Free text.', on: true },
  { g: CLINICAL_GROUP, k: 'advised', label: 'Advised treatment + tooth tagging', desc: 'Treatment planned for later visits.', on: true },
  { g: CLINICAL_GROUP, k: 'investigation', label: 'Investigation', desc: 'X-ray, IOPA, OPG, pulp test…', on: true },
  { g: CLINICAL_GROUP, k: 'treatmentGroup', label: 'Treatment group', desc: 'Also used as the receipt fallback when there is no payment split.', on: true, dep: 'treatment' },
  { g: CLINICAL_GROUP, k: 'treatment', label: 'Current treatment + tooth tagging', desc: 'What was done today.', on: true },
  { g: CLINICAL_GROUP, k: 'medicine', label: 'Prescribed medicine', desc: 'Medicines, dosage and duration. Uses My medicines.', on: true },
  { g: BILLING_GROUP, k: 'billing', label: 'Billing', desc: 'Cost, amount paid, payment split and balance.', on: true, locked: true },
  { g: BILLING_GROUP, k: 'followUp', label: 'Follow-up', desc: 'Treatment stage, next appointment, Google review.', on: true },
  { g: BILLING_GROUP, k: 'lab', label: 'Lab requirements', desc: 'Lab name, tooth number and description.', on: true },
  { g: BILLING_GROUP, k: 'documents', label: 'Documents', desc: 'X-rays, prescriptions and reports.', on: true },
  // The one field that ships off. Everything else defaults on so that a clinic
  // which never opens this page sees exactly the form it has today.
  { g: BILLING_GROUP, k: 'comments', label: 'Comments', desc: 'Internal notes for the visit.', on: false },
];

export const FIELD_KEYS = FIELD_DEFS.map((f) => f.k);
const FIELD_BY_KEY = {};
FIELD_DEFS.forEach((f) => { FIELD_BY_KEY[f.k] = f; });

export function fieldDef(key) { return FIELD_BY_KEY[key] || null; }
export function isLocked(key) { return !!(FIELD_BY_KEY[key] && FIELD_BY_KEY[key].locked); }

// ── dropdown lists ────────────────────────────────────────────────────────

// `base: []` means there is no built-in list to seed from. labName is the only
// one: its values have always come from the clinic's own Google Sheet, so the
// form keeps reading them from there until the doctor adds values here.
export const DROPDOWN_DEFS = [
  { k: 'chiefComplaint', label: 'Chief complaint', help: "Shown as a multi-select in the doctor's form.", base: CHIEF_COMPLAINTS },
  { k: 'treatmentGroup', label: 'Treatment group', help: 'Multi-select. Also drives the receipt line item when there is no payment split.', base: TREATMENT_GROUPS },
  { k: 'treatment', label: 'Current treatment', help: 'Multi-select with per-tooth tagging.', base: TREATMENTS },
  { k: 'advised', label: 'Advised treatment', help: 'Multi-select with per-tooth tagging. Starts as the same list as Current treatment.', base: TREATMENTS },
  { k: 'medType', label: 'Medicine type', help: 'The Type dropdown on each prescribed medicine, and in My medicines.', base: MEDICINE_FORMS },
  { k: 'labName', label: 'Lab name', help: 'Lab requirements in step 2. Until you add values here, the list from your Google Sheet is used.', base: [] },
  { k: 'payMode', label: 'Payment mode', help: 'Billing section.', base: PAYMENT_MODES },
  { k: 'docType', label: 'Document type', help: 'Documents section in step 2.', base: DOC_KINDS },
];

export const DROPDOWN_KEYS = DROPDOWN_DEFS.map((d) => d.k);
const DROP_BY_KEY = {};
DROPDOWN_DEFS.forEach((d) => { DROP_BY_KEY[d.k] = d; });

export function dropdownDef(key) { return DROP_BY_KEY[key] || null; }

// ── normalising what came back from the server ────────────────────────────

export function defaultFields() {
  const out = {};
  FIELD_DEFS.forEach((f) => { out[f.k] = f.on; });
  return out;
}

export function defaultDropdown(key) {
  const def = DROP_BY_KEY[key];
  if (!def) return [];
  return def.base.map((value) => ({ value, enabled: true, custom: false }));
}

export function defaultDropdowns() {
  const out = {};
  DROPDOWN_KEYS.forEach((k) => { out[k] = defaultDropdown(k); });
  return out;
}

export function defaultConfig() {
  return { fields: defaultFields(), dropdowns: defaultDropdowns() };
}

// Built-ins first in the order options.js declares them, then the doctor's own
// in the order they were added — which is what the form shows and what the
// settings page lists.
//
// A built-in missing from the stored list is appended as enabled rather than
// treated as deleted. That is what lets a later release add a treatment and
// have every clinic pick it up; without it, the first clinic to open this page
// would freeze its list forever.
export function mergeDropdown(key, stored) {
  const def = DROP_BY_KEY[key];
  if (!def) return [];
  const rows = Array.isArray(stored) ? stored : null;
  if (!rows) return defaultDropdown(key);

  const byValue = new Map();
  rows.forEach((r) => {
    if (!r) return;
    const value = String(r.value == null ? '' : r.value).trim();
    if (!value || byValue.has(value.toLowerCase())) return;
    byValue.set(value.toLowerCase(), {
      value,
      enabled: r.enabled !== false,
      custom: !!r.custom,
    });
  });

  const out = [];
  const used = new Set();
  def.base.forEach((value) => {
    const hit = byValue.get(value.toLowerCase());
    used.add(value.toLowerCase());
    // A built-in is never custom, whatever the stored row claims — that flag
    // is what decides whether a delete button appears, and a built-in must
    // only ever be hidden.
    out.push(hit ? { value, enabled: hit.enabled, custom: false } : { value, enabled: true, custom: false });
  });
  rows.forEach((r) => {
    if (!r) return;
    const value = String(r.value == null ? '' : r.value).trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (used.has(lower)) return;
    used.add(lower);
    const hit = byValue.get(lower);
    if (hit) out.push(hit);
  });
  return out;
}

// Anything the server sends is treated as advisory: unknown keys are dropped,
// missing ones fall back to the default. A malformed config must still produce
// a usable form — a doctor cannot work around an empty dropdown.
export function mergeConfig(stored) {
  const src = (stored && typeof stored === 'object') ? stored : {};
  const fields = defaultFields();
  const sf = (src.fields && typeof src.fields === 'object') ? src.fields : {};
  FIELD_DEFS.forEach((f) => {
    if (f.locked) { fields[f.k] = true; return; }
    if (typeof sf[f.k] === 'boolean') fields[f.k] = sf[f.k];
  });

  const sd = (src.dropdowns && typeof src.dropdowns === 'object') ? src.dropdowns : {};
  const dropdowns = {};
  DROPDOWN_KEYS.forEach((k) => { dropdowns[k] = mergeDropdown(k, sd[k]); });

  return { fields, dropdowns, updatedAt: src.updatedAt || null };
}

// ── reading the config ────────────────────────────────────────────────────

// The single answer to "does this field appear?". Locked wins over anything
// stored, and a dependent field is off whenever its parent is.
export function fieldOn(config, key) {
  const def = FIELD_BY_KEY[key];
  if (!def) return true;
  if (def.locked) return true;
  if (def.dep && !fieldOn(config, def.dep)) return false;
  const fields = (config && config.fields) || {};
  return typeof fields[key] === 'boolean' ? fields[key] : def.on;
}

// True when the field is off only because its parent is off. The settings page
// shows a different explanation for this than for a field the doctor
// themselves switched off.
export function fieldBlockedByParent(config, key) {
  const def = FIELD_BY_KEY[key];
  if (!def || !def.dep) return false;
  return !fieldOn(config, def.dep);
}

export function valueRows(config, key) {
  const d = (config && config.dropdowns) || {};
  return Array.isArray(d[key]) ? d[key] : defaultDropdown(key);
}

// What the form's dropdown offers.
export function enabledValues(config, key) {
  return valueRows(config, key).filter((r) => r.enabled).map((r) => r.value);
}

// What the form's dropdown offers WHEN EDITING A PARTICULAR VISIT.
//
// A value the doctor has since hidden, or deleted, must still appear while
// looking at the visit that used it — otherwise opening an old visit silently
// blanks the field, and saving writes that blank back. `current` is whatever
// the visit holds: a string, or an array for a multi-select.
export function valuesForVisit(config, key, current) {
  const base = enabledValues(config, key);
  const seen = new Set(base.map((v) => v.toLowerCase()));
  const extras = [];
  const consider = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (!s || seen.has(s.toLowerCase())) return;
    seen.add(s.toLowerCase());
    extras.push(s);
  };
  if (Array.isArray(current)) current.forEach(consider);
  else consider(current);
  return base.concat(extras);
}

// ── editing the config (pure reducers) ────────────────────────────────────

export function setField(config, key, on) {
  if (isLocked(key)) return config;
  return { ...config, fields: { ...config.fields, [key]: !!on } };
}

const withRows = (config, key, rows) => ({
  ...config,
  dropdowns: { ...config.dropdowns, [key]: rows },
});

export function toggleValue(config, key, value) {
  const rows = valueRows(config, key).map((r) => (r.value === value ? { ...r, enabled: !r.enabled } : r));
  return withRows(config, key, rows);
}

export function setAllValues(config, key, enabled) {
  return withRows(config, key, valueRows(config, key).map((r) => ({ ...r, enabled: !!enabled })));
}

// Returns { config, error }. Case-insensitive duplicates are refused, because
// two values differing only in case read as one list to a doctor and as two
// to every report that groups by treatment.
export function addValue(config, key, raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return { config, error: '' };
  const rows = valueRows(config, key);
  if (rows.some((r) => r.value.toLowerCase() === value.toLowerCase())) {
    return { config, error: '“' + value + '” is already in this list.' };
  }
  return { config: withRows(config, key, rows.concat([{ value, enabled: true, custom: true }])), error: '' };
}

// Only a value the doctor added can go. A built-in is hidden instead, so every
// visit that already references it stays readable.
export function removeValue(config, key, value) {
  const rows = valueRows(config, key);
  const row = rows.find((r) => r.value === value);
  if (!row || !row.custom) return config;
  return withRows(config, key, rows.filter((r) => r.value !== value));
}

// What goes over the wire. Derived from the merged config rather than kept
// alongside it, so the page only ever has one copy of the truth.
export function toWire(config) {
  const fields = {};
  FIELD_DEFS.forEach((f) => { fields[f.k] = fieldOn(config, f.k); });
  const dropdowns = {};
  DROPDOWN_KEYS.forEach((k) => {
    dropdowns[k] = valueRows(config, k).map((r) => ({ value: r.value, enabled: !!r.enabled, custom: !!r.custom }));
  });
  return { fields, dropdowns };
}

// ── medicines ─────────────────────────────────────────────────────────────

// Stored in the SAME shape as a row of the doctor's form, not the changelog's
// { type, slots[], days, instructions }.
//
// Picking a medicine then becomes an assignment rather than a translation, and
// a translation layer is exactly where a field quietly stops pre-filling: the
// form's select offers `unit` from MEDICINE_FORMS and `food` from
// FOOD_OPTIONS, so a library that stored its own vocabulary could hand the row
// a value its own dropdown does not contain.
export const MED_SLOTS = [
  { k: 'morning', label: 'Morning', initial: 'M' },
  { k: 'afternoon', label: 'Afternoon', initial: 'A' },
  { k: 'evening', label: 'Evening', initial: 'E' },
  { k: 'night', label: 'Night', initial: 'N' },
];

export const MED_TYPE_ABBR = {
  Tablet: 'TAB', Capsule: 'CAP', Syrup: 'SYR', Gel: 'GEL', Mouthwash: 'MW',
  Ointment: 'OINT', Drops: 'DRP', Injection: 'INJ', Toothpaste: 'TP',
  Powder: 'PWD', Spray: 'SPR',
};

export function medAbbr(med) {
  return MED_TYPE_ABBR[(med && med.unit) || ''] || 'MED';
}

export function emptyMedicine(config) {
  const types = enabledValues(config, 'medType');
  return {
    id: '', name: '',
    unit: types[0] || MEDICINE_FORMS[0],
    morning: true, afternoon: false, evening: false, night: true,
    food: FOOD_OPTIONS[0], duration: '', remarks: '',
  };
}

// The fields a library medicine contributes to a prescription row. `id` and
// anything else the library keeps are deliberately not copied: the row is what
// gets printed, and it must not carry a reference back to a record that can
// later be renamed or deleted.
export function medToRow(med) {
  return {
    name: med.name || '',
    unit: med.unit || '',
    morning: !!med.morning, afternoon: !!med.afternoon,
    evening: !!med.evening, night: !!med.night,
    food: med.food || '',
    duration: med.duration == null ? '' : String(med.duration),
    remarks: med.remarks || '',
  };
}

export function medSlotLabels(med) {
  return MED_SLOTS.filter((s) => med && med[s.k]);
}

// "Tablet · M-A-N (Morning, Afternoon, Night) · After Food · 5 days"
export function medSummary(med) {
  if (!med) return '';
  const slots = medSlotLabels(med);
  const timing = slots.length
    ? slots.map((s) => s.initial).join('-') + ' (' + slots.map((s) => s.label).join(', ') + ')'
    : '';
  return [med.unit, timing, med.food, med.duration ? med.duration + ' days' : '']
    .filter(Boolean).join(' · ');
}

// Matches the start of any word, so "amo" finds Amoxicillin 500mg and "500"
// finds it too. Words split on spaces, +, / and -.
export function medMatches(med, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return false;
  const name = String((med && med.name) || '').toLowerCase();
  if (!name) return false;
  if (name.startsWith(q)) return true;
  return name.split(/[\s+/-]+/).filter(Boolean).some((w) => w.startsWith(q));
}

export const MED_SUGGESTION_LIMIT = 5;

export function medSuggestions(meds, query, limit = MED_SUGGESTION_LIMIT) {
  const q = String(query || '').trim();
  if (!q) return [];
  return (meds || []).filter((m) => medMatches(m, q)).slice(0, limit);
}

// Returns an error string, or '' when the medicine can be saved.
export function validateMedicine(med, allMeds) {
  const name = String((med && med.name) || '').trim();
  if (!name) return 'Enter the medicine name.';
  const clash = (allMeds || []).some(
    (m) => m.id !== (med.id || '') && String(m.name || '').trim().toLowerCase() === name.toLowerCase(),
  );
  if (clash) return 'This medicine is already in your list.';
  return '';
}

export function searchMedicines(meds, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return meds || [];
  return (meds || []).filter((m) => medMatches(m, q) || String(m.name || '').toLowerCase().includes(q));
}

// ── a field that is off but has already been filled in ────────────────────
//
// Switching a field off hides it from NEW visits. A visit that was recorded
// while the field was on still holds its value, and that value has to stay
// reachable — otherwise opening an old visit silently drops it from the form,
// and the next save writes the record back without it.
//
// This is the field-level counterpart of valuesForVisit, which already does
// the same job for individual dropdown values.

// Which cform properties each field owns. A field counts as "already filled
// in" when any one of them holds something.
export const FIELD_VALUE_KEYS = {
  medicalHistory: ['medicalHistory'],
  chiefComplaint: ['chiefComplaint'],
  description: ['chiefDescription'],
  diagnosis: ['diagnosis'],
  advised: ['advisedTreatment', 'advisedTreatmentOther', 'advisedTeeth'],
  investigation: ['investigation'],
  treatmentGroup: ['treatmentGroup'],
  treatment: ['treatment', 'treatmentOther', 'treatmentTeeth', 'toothNumber'],
  medicine: ['medicines'],
  billing: [],
  followUp: ['treatmentStage', 'nextAppointment', 'nextAppointmentTime', 'googleReviewTaken'],
  lab: ['labName', 'labToothNumber', 'labDescription'],
  documents: ['documents'],
  comments: ['comments'],
};

function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).some((k) => hasValue(v[k]));
  return String(v).trim() !== '';
}

export function fieldHasValue(cform, key) {
  if (!cform) return false;
  return (FIELD_VALUE_KEYS[key] || []).some((k) => {
    // A prescription always carries one blank row once "Add medicine" is
    // pressed, so a non-empty array is not the same as a prescription.
    if (k === 'medicines') {
      return Array.isArray(cform.medicines)
        && cform.medicines.some((m) => m && String(m.name || '').trim() !== '');
    }
    return hasValue(cform[k]);
  });
}

// The single answer to "does this field appear on THIS visit?".
//
// Note this overrides the treatmentGroup→treatment dependency as well: if a
// visit recorded a treatment group before Current treatment was switched off,
// the group still shows. Keeping the record readable matters more than the
// tidiness of the dependency.
export function fieldVisible(config, cform, key) {
  return fieldOn(config, key) || fieldHasValue(cform, key);
}

// True only when the field is showing BECAUSE of the visit, not the config.
export function fieldKeptForVisit(config, cform, key) {
  return !fieldOn(config, key) && fieldHasValue(cform, key);
}

// ── learning medicines from what was prescribed ───────────────────────────

// Anything shorter is far more likely to be a slip than a medicine, and a
// two-character entry in the library would match almost every search.
export const MIN_LEARNABLE_NAME = 3;

// The prescribed rows that are not already in the library, in the library's
// own shape and ready to save. Matching is case-insensitive, and two identical
// rows in one prescription yield one medicine.
export function newMedicinesFrom(rows, library) {
  const known = new Set(
    (library || []).map((m) => String((m && m.name) || '').trim().toLowerCase()).filter(Boolean),
  );
  const out = [];
  (rows || []).forEach((r) => {
    if (!r) return;
    const name = String(r.name || '').trim();
    if (name.length < MIN_LEARNABLE_NAME) return;
    const lower = name.toLowerCase();
    if (known.has(lower)) return;
    known.add(lower);
    out.push(medToRow({ ...r, name }));
  });
  return out;
}
