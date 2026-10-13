// Renders the two document pop-ups with realistic props. A temporal-dead-zone
// error, a bad hook order or a missing import throws here — none of which a
// Vite build or oxlint will tell you about.
import { renderToString } from 'react-dom/server';
import { PrescriptionSheet, ReceiptSheet, previewSrc, PatientHealthPanel, MultiSelect, TimePicker12h } from '../src/views/Clinical.jsx';
import { to12h } from '../src/whatsapp/ui.jsx';
import { WaProvider } from '../src/whatsapp/WaContext.jsx';
import { fmtClock, fmtDay, fmtDayOf } from '../src/whatsapp/ui.jsx';
import { fitTop } from '../src/whatsapp/appointments/EventPopover.jsx';
import BookingPanel, { panelPosition } from '../src/whatsapp/appointments/BookingPanel.jsx';
import WeekGrid from '../src/whatsapp/appointments/WeekGrid.jsx';
import { DAY_START_MIN, DAY_END_MIN } from '../src/whatsapp/appointments/WeekGrid.jsx';
import { docVersionForAttempt } from '../src/whatsapp/DocSend.jsx';
import { smsOtpEnabled, OtpChannelChooser, portalHistoryEnabled } from '../src/PortalApp.jsx';
import { idempotencyKeyFor } from '../src/whatsapp/waApi.js';
import { createElement as h } from 'react';

const rx = {
  dateLabel: '04 Oct 2026', name: 'Kshitij Singh', ageGender: '30 yrs · M',
  mobile: '9110968006', patientId: 'P0001', visitId: 'P0001_68',
  chiefComplaint: 'Pain', description: '', diagnosis: '', investigation: '',
  treatmentGroup: '', toothNumber: '', treatment: 'Scaling', advisedTreatment: '',
  medicalHistory: '', comments: '', meds: [], anyRemarks: false, hasMeds: false, noMeds: true,
};
const receipt = {
  dateLabel: '04 Oct 2026', name: 'Kshitij Singh', mobile: '9110968006',
  patientId: 'P0001', visitId: 'P0001_68', treatmentCost: '100', amountPaid: '100',
  balanceDue: '0', balanceLabel: '₹0', balanceColor: '#12805a', status: 'Fully Paid',
  mode: 'UPI', paySplits: [], lines: [], totalLabel: '₹100', paidLabel: '₹100',
};

const cases = [
  ['PrescriptionSheet, no docx template', () => h(PrescriptionSheet, { rx, onClose() {}, clinicName: 'Example Dental', clinicAddress: 'X', doctorName: 'Mehta', doctorQualification: 'BDS', rxTemplateUrl: null, hasDocxTemplate: false })],
  ['PrescriptionSheet, docx template',    () => h(PrescriptionSheet, { rx, onClose() {}, clinicName: 'Example Dental', clinicAddress: 'X', doctorName: 'Mehta', doctorQualification: 'BDS', rxTemplateUrl: null, hasDocxTemplate: true })],
  ['ReceiptSheet, no docx template',      () => h(ReceiptSheet, { receipt, onClose() {}, clinicName: 'Example Dental', clinicAddress: 'X', doctorName: 'Mehta', hasReceiptTemplate: false })],
  ['ReceiptSheet, docx template',         () => h(ReceiptSheet, { receipt, onClose() {}, clinicName: 'Example Dental', clinicAddress: 'X', doctorName: 'Mehta', hasReceiptTemplate: true })],
];

let pass = 0, fail = 0;
for (const waEnabled of [false, true]) {
  for (const [name, make] of cases) {
    const label = `${name} (waEnabled=${waEnabled})`;
    try {
      const html = renderToString(h(WaProvider, { org: { waEnabled }, orgLoaded: true }, make()));
      if (!html || html.length < 50) throw new Error('rendered almost nothing');
      pass++; console.log(`  ✓ ${label}`);
    } catch (e) {
      fail++; console.log(`  ✗ ${label}\n      ${e.message}`);
    }
  }
}
/* ── Idempotency key across resends ──────────────────────────────────────
   The key is deterministic on purpose so a double click collapses into one
   send. That same property made "Send again" a no-op: the backend saw a key
   it already had and returned the first message instead of sending. */

const check = (name, ok, got) => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got ${JSON.stringify(got)}`); }
};

const key = (dv, attempt) => idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt(dv, attempt));

check('first send keeps the plain document version',
  key('04 Oct 2026', 0) === idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', '04 Oct 2026'), key('04 Oct 2026', 0));
check('a resend produces a different key',
  key('04 Oct 2026', 1) !== key('04 Oct 2026', 0), [key('04 Oct 2026', 0), key('04 Oct 2026', 1)]);
check('each further resend is distinct again',
  new Set([0, 1, 2, 3].map((a) => key('04 Oct 2026', a))).size === 4,
  [0, 1, 2, 3].map((a) => key('04 Oct 2026', a)));
check('a missing document version still yields a usable key',
  key(undefined, 1) !== key(undefined, 0) && /#1$/.test(key(undefined, 1)), key(undefined, 1));
check('an empty document version is not collapsed into the attempt marker',
  key('', 1) !== key('', 0), [key('', 0), key('', 1)]);
check('the two use cases never collide on the same attempt',
  idempotencyKeyFor('P0001_68', 'EPRESCRIPTION', docVersionForAttempt('04 Oct 2026', 1))
    !== idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1)));
check('different visits never collide on the same attempt',
  idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1))
    !== idempotencyKeyFor('P0001_69', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1)));


/* ── Preview URL ─────────────────────────────────────────────────────────
   A real PDF in an iframe gets the browser's own viewer furniture — toolbar,
   zoom box, thumbnail rail — over what should just look like the document. */

const signed = 'https://s3.amazonaws.com/c/receipt.pdf?X-Amz-Signature=abc&X-Amz-Date=1';

check('a pdf preview suppresses the browser viewer chrome',
  /#toolbar=0/.test(previewSrc(signed, 'pdf')) && /navpanes=0/.test(previewSrc(signed, 'pdf')),
  previewSrc(signed, 'pdf'));
check('the suppression is a fragment, so the signed query is untouched',
  previewSrc(signed, 'pdf').split('#')[0] === signed, previewSrc(signed, 'pdf'));
check('html previews are left exactly as they were',
  previewSrc(signed, 'html') === signed, previewSrc(signed, 'html'));
check('an unknown format is left alone rather than guessed at',
  previewSrc(signed, undefined) === signed, previewSrc(signed, undefined));
check('a missing url stays missing instead of becoming "#toolbar=0"',
  previewSrc(null, 'pdf') === null, previewSrc(null, 'pdf'));


/* ── Which day a message was sent ────────────────────────────────────────
   Run under TZ=Asia/Kolkata. The log printed the UTC date beside the local
   time, so anything sent between midnight and 5:30am IST was dated to the
   previous day while the clock beside it read the right hour. */

// 2026-10-04 03:23 IST.
const lateNight = '2026-10-03T21:53:00.000Z';
const midday = '2026-10-04T07:30:00.000Z';

check('a small-hours message is dated by the clinic\'s day, not UTC',
  fmtDayOf(lateNight) === '4 Oct', fmtDayOf(lateNight));
check('the old slice is what produced the wrong day',
  fmtDay(lateNight.slice(0, 10)) === '3 Oct', fmtDay(lateNight.slice(0, 10)));
check('the date agrees with the clock shown next to it',
  fmtClock(lateNight) === '3:23 am', fmtClock(lateNight));
check('a daytime message is unaffected',
  fmtDayOf(midday) === '4 Oct', fmtDayOf(midday));
check('a date bucket (plain YYYY-MM-DD) still formats as that day',
  fmtDay('2026-10-04') === '4 Oct', fmtDay('2026-10-04'));
check('no timestamp renders as empty, not "Invalid Date"',
  fmtDayOf(null) === '' && fmtDayOf(undefined) === '' && fmtDayOf('') === '',
  [fmtDayOf(null), fmtDayOf(undefined), fmtDayOf('')]);
check('an unparseable timestamp renders as empty',
  fmtDayOf('not a date') === '', fmtDayOf('not a date'));


/* ── Popover placement ───────────────────────────────────────────────────
   Opening the reschedule section makes the popover taller. The old code
   clamped against a hard-coded 440px, so the extra height — and the Save
   button at the bottom of it — went off the screen with no way to reach it. */

const VH = 900;

check('a popover near the top sits where its event is',
  fitTop(100, 420, VH) === 100, fitTop(100, 420, VH));
check('a short popover low down still fits',
  fitTop(600, 200, VH) + 200 + 12 <= VH, fitTop(600, 200, VH));
check('a tall popover is lifted so its bottom stays on screen',
  fitTop(600, 700, VH) + 700 + 12 <= VH, fitTop(600, 700, VH));
check('growing the panel moves it up rather than off the bottom',
  fitTop(600, 700, VH) < fitTop(600, 200, VH),
  [fitTop(600, 200, VH), fitTop(600, 700, VH)]);
check('the old 440 assumption is what failed for a reschedule-height panel',
  Math.min(Math.max(12, 600), Math.max(12, VH - 440)) + 700 > VH);
check('a panel taller than the viewport pins to the top gap, not a negative',
  fitTop(600, 2000, VH) === 12, fitTop(600, 2000, VH));
check('an anchor above the viewport is clamped to the gap',
  fitTop(-50, 300, VH) === 12, fitTop(-50, 300, VH));
check('a missing anchor falls back to a sane default',
  fitTop(0, 300, VH) === 80, fitTop(0, 300, VH));


/* ── Calendar hours ──────────────────────────────────────────────────────
   The grid ended at 8 PM while clinics run evening sessions past 9. */

check('the grid starts at 9 AM', DAY_START_MIN === 9 * 60, DAY_START_MIN);
check('and runs to 10 PM, so a 9:30 PM slot fits inside it',
  DAY_END_MIN >= 21 * 60 + 30 + 30, DAY_END_MIN);
check('a late evening session (4:30 PM to 9:30 PM) is fully visible',
  16 * 60 + 30 >= DAY_START_MIN && 21 * 60 + 30 <= DAY_END_MIN);
check('a 9:30 PM appointment ends on or before the last gridline',
  21 * 60 + 30 + 30 <= DAY_END_MIN, [21 * 60 + 60, DAY_END_MIN]);

/* ── Portal sign-in: the SMS channel is switched off ─────────────────────
   The code stays, so turning it back on is an env var rather than a change.
   What must not happen is a half-hidden state: the chooser gone but SMS
   still reachable, or — far worse — WhatsApp hidden along with it, which
   would leave patients with no way to sign in at all. */

check('an unset flag means SMS stays hidden', smsOtpEnabled({}) === false);
check('...as does an absent env object', smsOtpEnabled(undefined) === false);
check('"false" keeps it hidden', smsOtpEnabled({ VITE_PORTAL_SMS_OTP: 'false' }) === false);
check('an empty string keeps it hidden', smsOtpEnabled({ VITE_PORTAL_SMS_OTP: '' }) === false);
check('exactly "true" switches it on', smsOtpEnabled({ VITE_PORTAL_SMS_OTP: 'true' }) === true);
check('a boolean true works too, in case it is set in code',
  smsOtpEnabled({ VITE_PORTAL_SMS_OTP: true }) === true);
for (const near of ['TRUE', 'True', '1', 'yes', 'on']) {
  check(`${JSON.stringify(near)} is NOT treated as on`,
    smsOtpEnabled({ VITE_PORTAL_SMS_OTP: near }) === false, near);
}

const chooser = (enabled) => renderToString(
  h(OtpChannelChooser, { enabled, value: 'whatsapp', onChange() {} }));

check('switched off, the chooser renders nothing at all', chooser(false) === '', chooser(false));
check('...so the word SMS never reaches the patient', !/SMS/.test(chooser(false)));
check('switched on, both channels are offered',
  /WhatsApp/.test(chooser(true)) && /SMS/.test(chooser(true)), chooser(true));
check('switched on, the question is asked again',
  /Where should we send your code\?/.test(chooser(true)));
check('the current channel is the one marked selected',
  renderToString(h(OtpChannelChooser, { enabled: true, value: 'sms', onChange() {} }))
    !== chooser(true));

/* ── The doctor sees what the patient declared ───────────────────────────
   Rendered rather than unit-tested, because the thing that matters is what
   reaches the screen: a real allergy must appear in red once, a declared
   "none" must appear in the grid as evidence the question was asked, and an
   unanswered field must not appear at all. */

const panel = (cform) => renderToString(h(PatientHealthPanel, { cform }));

check('nothing filled in means no panel',
  panel({}) === '' && panel(null) === '', panel({}));
check('the doctor\'s own medical history does not raise the panel',
  panel({ medicalHistory: 'Hypertension' }) === '');

const alertPanel = panel({ patientProblem: 'Pain', patientAllergies: 'Penicillin' });
check('a real allergy is announced', /Allergy:/.test(alertPanel) && /Penicillin/.test(alertPanel));
check('...in the red alert colours', /#fdecea/.test(alertPanel) && /#b3261e/.test(alertPanel));
check('...exactly once, not repeated in the grid below',
  (alertPanel.match(/Penicillin/g) || []).length === 1, (alertPanel.match(/Penicillin/g) || []).length);
check('...and the patient\'s problem is still shown',
  /Today&#x27;s problem|Today's problem/.test(alertPanel) && /Pain/.test(alertPanel));

const nonePanel = panel({ patientAllergies: 'NKDA' });
check('a declared "none" raises no red alert', !/Allergy:/.test(nonePanel) && !/#fdecea/.test(nonePanel));
check('...but is shown, so the doctor knows it was asked',
  /NKDA/.test(nonePanel) && /Allergies/.test(nonePanel), nonePanel.slice(0, 120));

// The prefix-match bug, as it would appear on screen.
for (const v of ['Novocaine allergy', 'Nose drops', 'Nobivac']) {
  const p = panel({ patientAllergies: v });
  check(`${JSON.stringify(v)} reaches the doctor as a red alert`,
    /Allergy:/.test(p) && p.includes(v), v);
}
for (const v of ['None', 'No', 'NKDA', 'No known allergies']) {
  check(`${JSON.stringify(v)} does not trigger a false alarm`, !/Allergy:/.test(panel({ patientAllergies: v })), v);
}

const full = panel({
  patientProblem: 'Pain lower left', patientMedicalHistory: 'Diabetes',
  patientAllergies: 'Latex', patientDentalHistory: 'RCT 2022',
});
check('every declared field reaches the doctor',
  ['Pain lower left', 'Diabetes', 'Latex', 'RCT 2022'].every((t) => full.includes(t)));
check('the panel says where the information came from',
  /Filled in by the patient at check-in/.test(full));

/* ── Visit history can be switched off per clinic ────────────────────────
   On by default and off only for exactly "false". The defaults run opposite
   to the SMS flag on purpose: there the accident to avoid is leaving SMS on,
   here it is hiding a patient's own records by mistake. */

check('history is on when nothing is set', portalHistoryEnabled({}) === true);
check('...and when there is no env at all', portalHistoryEnabled(undefined) === true);
check('exactly "false" switches it off', portalHistoryEnabled({ VITE_PORTAL_HISTORY: 'false' }) === false);
check('"true" leaves it on', portalHistoryEnabled({ VITE_PORTAL_HISTORY: 'true' }) === true);
for (const near of ['FALSE', 'False', '0', 'no', 'off', '']) {
  check(`${JSON.stringify(near)} does NOT hide a patient's records`,
    portalHistoryEnabled({ VITE_PORTAL_HISTORY: near }) === true, near);
}

/* ── The clinical pickers ────────────────────────────────────────────────
   All four are long enough to be worth typing into rather than scrolling.
   The search box only renders when `searchable` is passed, so the thing to
   assert is that it is passed — and that passing it changes nothing else. */

const picker = (props) => renderToString(h(MultiSelect, {
  value: [], options: ['Pain', 'Sensitivity', 'Swelling'], onChange() {}, ...props }));

check('a closed picker shows no search box', !/Search…/.test(picker({ searchable: true })));
check('options are listed either way',
  picker({ searchable: true }).length > 0 && picker({}).length > 0);
check('a selected value still shows as a chip',
  /Pain/.test(picker({ value: ['Pain'], searchable: true })), picker({ value: ['Pain'], searchable: true }).slice(0, 200));
check('searchable does not change what is selected',
  picker({ value: ['Pain'], searchable: true }).includes('Pain')
  && picker({ value: ['Pain'] }).includes('Pain'));

// The real assertion: every clinical picker in the form asks for search.
import { readFileSync } from 'node:fs';
const clinicalSrc = readFileSync('src/views/Clinical.jsx', 'utf8');
for (const field of ['chiefComplaint', 'advisedTreatment', 'treatmentGroup', 'treatment']) {
  const line = clinicalSrc.split('\n').find((l) =>
    l.includes('<MultiSelect value={cform.' + field + '}'));
  check(`${field} is a searchable dropdown`, !!line && / searchable/.test(line), line && line.trim().slice(0, 110));
}

/* ── Appointment time: the sheet holds two formats ───────────────────────
   58 rows in 24-hour and 60 in 12-hour, because the clinical form's picker
   writes "2:00 PM" and the Appointments tab's reschedule writes "14:00".
   The picker could only read the first, so a rescheduled visit opened with
   an empty time — and re-saving it would have wiped the time entirely. */

const tp = (value) => renderToString(h(TimePicker12h, { value, onChange() {} }));
// react-dom/server emits <option value="2" selected="">, value first.
const chosen = (html) => (html.match(/<option value="([^"]*)"[^>]*selected/g) || [])
  .map((m) => m.match(/value="([^"]*)"/)[1]);

check('a 12-hour value still reads correctly',
  chosen(tp('2:00 PM')).join('|') === '2|00|PM', chosen(tp('2:00 PM')));
check('a 24-hour value now reads too — the reported bug',
  chosen(tp('14:00')).join('|') === '2|00|PM', chosen(tp('14:00')));
check('morning 24-hour times keep AM', chosen(tp('09:30')).join('|') === '9|30|AM', chosen(tp('09:30')));
check('midnight is 12 AM, not 0', chosen(tp('00:15')).join('|') === '12|15|AM', chosen(tp('00:15')));
check('noon is 12 PM, not 0 PM', chosen(tp('12:45')).join('|') === '12|45|PM', chosen(tp('12:45')));
check('an off-five minute is offered rather than dropped',
  chosen(tp('14:07')).join('|') === '2|07|PM', chosen(tp('14:07')));
check('an empty value leaves the picker blank',
  chosen(tp('')).join('|') === '||AM', chosen(tp('')));
// The real value from one clinic's sheet: a spreadsheet epoch, not a time.
check('an unreadable value does not become an invented time',
  chosen(tp('1899-12-30T05:38:50.000Z')).join('|') === '||AM',
  chosen(tp('1899-12-30T05:38:50.000Z')));

/* The write side: the reschedule normalises so the split stops growing. */
check('to12h converts what <input type="time"> produces', to12h('14:00') === '2:00 PM', to12h('14:00'));
check('to12h leaves an already-12-hour value alone', to12h('2:00 PM') === '2:00 PM', to12h('2:00 PM'));
check('to12h is idempotent', to12h(to12h('14:00')) === '2:00 PM');
check('to12h on empty stays empty', to12h('') === '' && to12h(null) === '' && to12h(undefined) === '');
check('to12h refuses an out-of-range hour rather than wrapping it',
  to12h('25:00') === '' && to12h('99:99') === '', [to12h('25:00'), to12h('99:99')]);
check('to12h refuses a value that is not a time',
  to12h('1899-12-30T05:38:50.000Z') === '', to12h('1899-12-30T05:38:50.000Z'));

/* ── Booking a slot from the calendar ────────────────────────────────────
   The panel decides what a patient is told and whether a duplicate record
   gets made, so these assert what reaches the screen rather than the state
   behind it. */

const PATIENTS = [
  { patientId: 'P0001', name: 'Kshitij Singh', mobile: '9110968006' },
  { patientId: 'P0002', name: 'Anita Singh', mobile: '9110968006' },
  { patientId: 'P0004', name: 'Priya Sharma', mobile: '9000000011', whatsappOff: true },
];
const EVENTS = [{ date: '2026-10-15', startMin: 600, endMin: 630, name: 'Rohit Verma' }];
const baseDraft = {
  date: '2026-10-15', start: 11 * 60, who: 'existing', q: '', pick: null,
  name: '', mobile: '', age: '', gender: '', address: '', treatment: '', err: '', pos: null,
};
// renderToString puts <!-- --> between adjacent text nodes, which splits an
// interpolated name out of the sentence around it. Stripped so assertions can
// read the sentence a person would see.
const bookPanel = (over) => renderToString(h(BookingPanel, {
  draft: { ...baseDraft, ...over }, patients: PATIENTS, events: EVENTS,
  today: '2026-10-15', nowMin: 9 * 60, isPhone: false, saving: false,
  onChange() {}, onClose() {}, onSave() {},
})).replace(/<!-- -->/g, '');

check('the panel names itself and the slot',
  /New appointment/.test(bookPanel({})) && /11:00 AM/.test(bookPanel({})) && /11:30 AM/.test(bookPanel({})),
  bookPanel({}).slice(0, 200));
check('both patient modes are offered',
  /Existing patient/.test(bookPanel({})) && /New patient/.test(bookPanel({})));
check('the search box is shown before anyone is picked', /Search name or mobile number/.test(bookPanel({})));

check('typing a name lists matches',
  /Kshitij Singh/.test(bookPanel({ q: 'kshi' })), bookPanel({ q: 'kshi' }).slice(0, 300));
check('a shared number lists everyone on it',
  /Kshitij Singh/.test(bookPanel({ q: '9110968006' })) && /Anita Singh/.test(bookPanel({ q: '9110968006' })));
check('an opted-out patient is flagged in the results',
  /WhatsApp off/.test(bookPanel({ q: 'Priya' })), bookPanel({ q: 'Priya' }).slice(0, 400));
check('no match offers to add them instead',
  /No patient found/.test(bookPanel({ q: 'zzzz' })) && /Add as a new patient/.test(bookPanel({ q: 'zzzz' })));

const picked = bookPanel({ pick: PATIENTS[0] });
check('a picked patient replaces the search with a card',
  /Kshitij Singh/.test(picked) && /Change/.test(picked) && !/Search name or mobile/.test(picked));
check('...and the WhatsApp line promises a confirmation',
  /will get a WhatsApp confirmation/.test(picked), picked.slice(0, 200));
check('an opted-out patient is told to be called instead',
  /has WhatsApp turned off — call to confirm/.test(bookPanel({ pick: PATIENTS[2] })));
check('...and is NOT promised a confirmation',
  !/will get a WhatsApp confirmation/.test(bookPanel({ pick: PATIENTS[2] })));

const newMode = bookPanel({ who: 'new' });
check('the new-patient form asks for the same fields as intake',
  ['Full name', 'Mobile number', 'Age', 'Gender', 'Address'].every((f) => newMode.includes(f)));
check('the WhatsApp disclosure is shown', /reply STOP at any time/.test(newMode));
check('a shared number warns it adds a family member',
  /already has Kshitij Singh, Anita Singh/.test(bookPanel({ who: 'new', mobile: '9110968006' })),
  bookPanel({ who: 'new', mobile: '9110968006' }).slice(0, 200));
check('a duplicate name on that number is called out before saving',
  /already registered on this number/.test(bookPanel({ who: 'new', mobile: '9110968006', name: 'Anita Singh' })));
check('a NEW name on that number is not',
  !/already registered on this number/.test(bookPanel({ who: 'new', mobile: '9110968006', name: 'Baby Singh' })));

check('an overlapping slot warns but does not forbid',
  /Overlaps with Rohit Verma/.test(bookPanel({ start: 600, pick: PATIENTS[0] }))
  && /You can still book it/.test(bookPanel({ start: 600, pick: PATIENTS[0] })));
check('a free slot shows no overlap warning', !/Overlaps with/.test(bookPanel({ start: 780, pick: PATIENTS[0] })));
check('duration is fixed — no duration control is offered',
  !/Duration/i.test(bookPanel({})), 'no duration field');
check('an error passed in is displayed', /pick a later slot/.test(bookPanel({ err: 'That time has already passed — pick a later slot.' })));

/* Where the floating card lands. */
const vw = 1400, vh = 900;
check('the card sits to the right of the click when there is room',
  panelPosition(300, 400, vw, vh).left === 318, panelPosition(300, 400, vw, vh));
check('...and flips left when there is not',
  panelPosition(1300, 400, vw, vh).left === 1300 - 400 - 18, panelPosition(1300, 400, vw, vh));
check('it never starts off the left edge', panelPosition(5, 400, 500, vh).left >= 16);
check('it never starts above the top', panelPosition(300, 10, vw, vh).top >= 16);
check('a tall card is lifted so it stays on screen',
  panelPosition(300, 880, vw, vh).top + panelPosition(300, 880, vw, vh).maxHeight <= vh);

/* The ghost block and the clickable grid. */
const grid = (props) => renderToString(h(WeekGrid, {
  days: ['2026-10-15'], eventsByDay: { '2026-10-15': [] }, onOpenEvent() {}, ...props,
}));
check('the grid shows a cell cursor when booking is possible',
  /cursor:cell/.test(grid({ onSlotClick() {} }).replace(/\s/g, '')), 'cursor');
check('...and not when it is not', !/cursor:cell/.test(grid({}).replace(/\s/g, '')));
check('a draft paints a ghost block with the name and time',
  /Kshitij Singh · 11:00 AM–11:30 AM/.test(
    grid({ onSlotClick() {}, draftDurMin: 30, draft: { date: '2026-10-15', start: 660, label: 'Kshitij Singh · 11:00 AM–11:30 AM' } })));
check('the ghost is not clickable',
  /pointer-events:none/.test(grid({ onSlotClick() {}, draft: { date: '2026-10-15', start: 660, label: 'x' } }).replace(/\s/g, '')));
check('a draft on another day paints nothing here',
  !/ghostlabel/.test(grid({ onSlotClick() {}, draft: { date: '2026-10-16', start: 660, label: 'ghostlabel' } })));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
