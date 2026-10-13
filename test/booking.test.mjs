// Booking a slot from the calendar.
//
// The arithmetic here decides what time a patient is told to arrive, so the
// cases that matter are the boundaries: a click near closing time, a booking
// in the past, and two people registered on one phone.
import {
  slotFromOffset, nextQuarter, prefillFor, slotOptions, isPast, overlapping,
  searchPatients, familyOn, duplicatePatient, validateDraft,
  SLOT_MIN, BOOKING_DUR_MIN,
} from '../src/whatsapp/appointments/slotMath.js';
import { DAY_END_MIN, DAY_START_MIN, PX_PER_HOUR } from '../src/whatsapp/appointments/WeekGrid.jsx';

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : JSON.stringify(got)); }
};
const hhmm = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

/* ── Clicking the grid ──────────────────────────────────────────────────── */

check('a click at the very top is the opening time',
  slotFromOffset(0) === DAY_START_MIN, hhmm(slotFromOffset(0)));
check('one hour down is one hour later',
  slotFromOffset(PX_PER_HOUR) === DAY_START_MIN + 60, hhmm(slotFromOffset(PX_PER_HOUR)));

// Snapping DOWN is the point: a click a few pixels past 11:00 means "about
// eleven", and rounding up would move the appointment away from the pointer.
check('a click just past the hour snaps back to it',
  slotFromOffset(PX_PER_HOUR * 2 + 3) === DAY_START_MIN + 120,
  hhmm(slotFromOffset(PX_PER_HOUR * 2 + 3)));
check('a click at 14 minutes past still snaps to the hour',
  slotFromOffset(PX_PER_HOUR * 2 + PX_PER_HOUR * (14 / 60)) === DAY_START_MIN + 120);
check('a click at 15 minutes past lands on the quarter',
  slotFromOffset(PX_PER_HOUR * 2 + PX_PER_HOUR * (15 / 60)) === DAY_START_MIN + 135);
check('every snapped time is a quarter hour',
  [0, 7, 61, 123, 400, 777].every((y) => slotFromOffset(y) % SLOT_MIN === 0));

// The booked block is 30 minutes, so the latest start has to leave room.
check('a click at the very bottom leaves room for the whole slot',
  slotFromOffset(99999) === DAY_END_MIN - BOOKING_DUR_MIN,
  hhmm(slotFromOffset(99999)));
check('...and that block ends exactly at closing time',
  slotFromOffset(99999) + BOOKING_DUR_MIN === DAY_END_MIN);
check('a click above the grid cannot book before opening',
  slotFromOffset(-500) === DAY_START_MIN);

/* ── The "New" button ───────────────────────────────────────────────────── */

check('next quarter rounds forward, never to now',
  nextQuarter(10 * 60 + 1) === 10 * 60 + 15, hhmm(nextQuarter(10 * 60 + 1)));
check('exactly on a quarter moves to the next one',
  nextQuarter(10 * 60) === 10 * 60 + 15, hhmm(nextQuarter(10 * 60)));
check('before opening time it offers the opening time',
  nextQuarter(6 * 60) === DAY_START_MIN, hhmm(nextQuarter(6 * 60)));
check('after closing it still offers a bookable slot, not a time off the grid',
  nextQuarter(23 * 60 + 50) === DAY_END_MIN - BOOKING_DUR_MIN,
  hhmm(nextQuarter(23 * 60 + 50)));

const TODAY = '2026-10-15';
check('on today, prefill is the next free quarter',
  prefillFor(TODAY, TODAY, 11 * 60 + 7).start === 11 * 60 + 15,
  prefillFor(TODAY, TODAY, 11 * 60 + 7));
check('on a future day, prefill is 10 AM on that day',
  JSON.stringify(prefillFor('2026-10-20', TODAY, 11 * 60 + 7)) === JSON.stringify({ date: '2026-10-20', start: 600 }),
  prefillFor('2026-10-20', TODAY, 11 * 60 + 7));
// Nobody books into last Tuesday; sending them to today is the useful default.
check('on a past day, prefill jumps to today',
  prefillFor('2026-10-01', TODAY, 11 * 60 + 7).date === TODAY,
  prefillFor('2026-10-01', TODAY, 11 * 60 + 7));

/* ── The Start time options ─────────────────────────────────────────────── */

const opts = slotOptions();
check('options start at opening time', opts[0] === DAY_START_MIN);
check('the last option leaves room for a 30-minute booking',
  opts[opts.length - 1] === DAY_END_MIN - BOOKING_DUR_MIN, hhmm(opts[opts.length - 1]));
check('options are every 15 minutes with no gaps',
  opts.every((m, i) => i === 0 || m - opts[i - 1] === SLOT_MIN));
check('a click can always be represented by an option',
  [0, 13, 250, 99999].every((y) => opts.includes(slotFromOffset(y))));

/* ── Past times ─────────────────────────────────────────────────────────── */

check('yesterday is past', isPast('2026-10-14', 10 * 60, TODAY, 11 * 60) === true);
check('earlier today is past', isPast(TODAY, 10 * 60, TODAY, 11 * 60) === true);
check('later today is not', isPast(TODAY, 12 * 60, TODAY, 11 * 60) === false);
check('tomorrow morning is not past, even before now o\'clock',
  isPast('2026-10-16', 9 * 60, TODAY, 11 * 60) === false);

/* ── Overlaps ───────────────────────────────────────────────────────────── */

const events = [
  { date: TODAY, startMin: 600, endMin: 630, name: 'Priya Sharma' },
  { date: TODAY, startMin: 700, endMin: 730, name: 'Rohit Verma' },
  { date: '2026-10-16', startMin: 600, endMin: 630, name: 'Other Day' },
];
check('an identical slot overlaps', overlapping(events, TODAY, 600).length === 1);
check('a slot starting inside another overlaps',
  overlapping(events, TODAY, 615)[0].name === 'Priya Sharma');
check('a slot ending exactly as another starts does NOT overlap',
  overlapping(events, TODAY, 570).length === 0, overlapping(events, TODAY, 570));
check('a slot starting exactly as another ends does NOT overlap',
  overlapping(events, TODAY, 630).length === 0, overlapping(events, TODAY, 630));
check('a free gap overlaps nothing', overlapping(events, TODAY, 650).length === 0);
check('another day is not an overlap', overlapping(events, TODAY, 600).every((e) => e.date === TODAY));
check('an appointment with only durationMin is still compared',
  overlapping([{ date: TODAY, startMin: 600, durationMin: 45 }], TODAY, 630).length === 1);

/* ── Finding a patient ──────────────────────────────────────────────────── */

const patients = [
  { patientId: 'P0001', name: 'Kshitij Singh', mobile: '9110968006' },
  { patientId: 'P0002', name: 'Anita Singh', mobile: '9110968006' },
  { patientId: 'P0003', name: 'Rohit Verma', mobile: '98765 43210' },
  { patientId: 'P0004', name: 'priya sharma', mobile: '9000000011', whatsappOff: true },
];

check('an empty query returns nothing, not everyone', searchPatients(patients, '').length === 0);
check('name search is case-insensitive',
  searchPatients(patients, 'PRIYA')[0].patientId === 'P0004');
check('a partial name matches anywhere in it',
  searchPatients(patients, 'verma')[0].patientId === 'P0003');
check('digits search the mobile',
  searchPatients(patients, '98765').map((p) => p.patientId).join() === 'P0003');
check('a spaced-out stored number still matches plain digits',
  searchPatients(patients, '9876543210')[0].patientId === 'P0003');
check('a shared number returns everyone on it',
  searchPatients(patients, '9110968006').map((p) => p.patientId).join() === 'P0001,P0002');
check('results are capped', searchPatients(patients, 'a', 2).length <= 2);
check('a query matching nobody returns nothing', searchPatients(patients, 'zzz').length === 0);

/* ── Families and duplicates ────────────────────────────────────────────── */

check('a shared number lists the family',
  familyOn(patients, '9110968006').map((p) => p.name).join(', ') === 'Kshitij Singh, Anita Singh');
check('a partial number is not enough to claim a family',
  familyOn(patients, '91109').length === 0);
check('an unused number has no family', familyOn(patients, '9999999999').length === 0);

check('same name and number is a duplicate',
  duplicatePatient(patients, '9110968006', 'Kshitij Singh').patientId === 'P0001');
check('...case and spacing do not hide it',
  duplicatePatient(patients, '91109 68006', '  kshitij singh ').patientId === 'P0001');
check('a different name on the same number is NOT a duplicate',
  duplicatePatient(patients, '9110968006', 'Baby Singh') === null);
check('the same name on a different number is NOT a duplicate',
  duplicatePatient(patients, '9000000099', 'Kshitij Singh') === null);

/* ── What blocks a save ─────────────────────────────────────────────────── */

const ctx = { patients, today: TODAY, nowMin: 11 * 60 };
const draft = (o) => ({ date: TODAY, start: 12 * 60, who: 'existing', ...o });

check('a past slot is refused first of all',
  validateDraft(draft({ start: 9 * 60, pick: patients[0] }), ctx) === 'That time has already passed — pick a later slot.');
check('an existing booking with nobody picked is refused',
  validateDraft(draft({}), ctx) === 'Search and select a patient first.');
check('an existing booking with a patient is allowed',
  validateDraft(draft({ pick: patients[0] }), ctx) === '');

const nw = (o) => draft({ who: 'new', name: 'New Person', mobile: '9000000022', age: '30', gender: 'Male', ...o });
check('a complete new patient is allowed', validateDraft(nw(), ctx) === '', validateDraft(nw(), ctx));
check('a missing name is refused', /name/.test(validateDraft(nw({ name: '  ' }), ctx)));
check('a 9-digit mobile is refused', /10-digit/.test(validateDraft(nw({ mobile: '911096800' }), ctx)));
check('an 11-digit mobile is refused', /10-digit/.test(validateDraft(nw({ mobile: '91109680066' }), ctx)));
check('a missing age is refused', /age/.test(validateDraft(nw({ age: '' }), ctx)));
check('age zero is allowed — infants are patients',
  validateDraft(nw({ age: '0' }), ctx) === '', validateDraft(nw({ age: '0' }), ctx));
check('an impossible age is refused', /0 and 120/.test(validateDraft(nw({ age: '150' }), ctx)));
check('a missing gender is refused', /gender/.test(validateDraft(nw({ gender: '' }), ctx)));
check('a duplicate patient is refused by name',
  /already registered/.test(validateDraft(nw({ name: 'Anita Singh', mobile: '9110968006' }), ctx)));
check('...but a new family member on the same number is allowed',
  validateDraft(nw({ name: 'Baby Singh', mobile: '9110968006' }), ctx) === '',
  validateDraft(nw({ name: 'Baby Singh', mobile: '9110968006' }), ctx));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
