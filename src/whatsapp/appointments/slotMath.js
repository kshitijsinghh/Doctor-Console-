// The arithmetic behind booking a slot by clicking the grid, kept apart from
// the panel so it can be tested without a browser.

import { DAY_END_MIN, DAY_START_MIN, PX_PER_HOUR } from './WeekGrid';

export const SLOT_MIN = 15;        // clicks snap to a quarter hour
export const BOOKING_DUR_MIN = 30; // fixed; there is no duration control

// Where in the day a click landed.
//
// Snapped DOWN, not to the nearest quarter: a click just past 11:00 means
// "around eleven", and rounding it up to 11:15 moves the appointment away
// from what the person pointed at. Clamped so the 30-minute block still ends
// by closing time rather than being drawn off the bottom of the grid.
export function slotFromOffset(offsetY, pxPerHour = PX_PER_HOUR) {
  const raw = DAY_START_MIN + (offsetY / pxPerHour) * 60;
  const snapped = Math.floor(raw / SLOT_MIN) * SLOT_MIN;
  const latest = DAY_END_MIN - BOOKING_DUR_MIN;
  return Math.max(DAY_START_MIN, Math.min(snapped, latest));
}

// The next quarter hour that has not already started. Used to pre-fill the
// panel when "New" is pressed while looking at today.
export function nextQuarter(nowMin) {
  const q = Math.ceil((nowMin + 1) / SLOT_MIN) * SLOT_MIN;
  return Math.max(DAY_START_MIN, Math.min(q, DAY_END_MIN - BOOKING_DUR_MIN));
}

// What the "New" button should open with, given where the calendar is parked.
//
// Looking at a past day, the useful default is today — nobody books into last
// Tuesday. On today, the next free quarter. On a future day, 10 AM, because
// the current clock time means nothing on a day that has not arrived.
export function prefillFor(anchorDate, today, nowMin) {
  if (anchorDate < today) return { date: today, start: nextQuarter(nowMin) };
  if (anchorDate === today) return { date: today, start: nextQuarter(nowMin) };
  return { date: anchorDate, start: 10 * 60 };
}

// The 15-minute options for the Start time select: 9:00 AM through 7:45 PM,
// so a 30-minute booking always ends inside the day.
export function slotOptions() {
  const out = [];
  for (let m = DAY_START_MIN; m <= DAY_END_MIN - BOOKING_DUR_MIN; m += SLOT_MIN) out.push(m);
  return out;
}

export function isPast(date, startMin, today, nowMin) {
  if (date < today) return true;
  return date === today && startMin < nowMin;
}

// Appointments on the same day whose time overlaps the draft. Not an error —
// double-booking a chair is sometimes deliberate — so this only drives a
// warning.
export function overlapping(events, date, startMin, durMin = BOOKING_DUR_MIN) {
  const end = startMin + durMin;
  return (events || []).filter((e) => e
    && e.date === date
    && e.startMin < end
    && startMin < (e.endMin != null ? e.endMin : e.startMin + (Number(e.durationMin) || BOOKING_DUR_MIN)));
}

export const digitsOf = (s) => String(s == null ? '' : s).replace(/\D/g, '');

// Name (case-insensitive, anywhere) or mobile digits. One box, because asking
// reception to choose which field they are searching is a question they
// should not have to answer.
export function searchPatients(patients, query, limit = 6) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const qd = digitsOf(q);
  return (patients || []).filter((p) => {
    if (!p) return false;
    if (String(p.name || '').toLowerCase().includes(q)) return true;
    return !!qd && digitsOf(p.mobile).includes(qd);
  }).slice(0, limit);
}

// Everyone already registered on a mobile number. A shared number is normal —
// families book on one phone — so this is a note, not an error.
export function familyOn(patients, mobile) {
  const d = digitsOf(mobile);
  if (d.length !== 10) return [];
  return (patients || []).filter((p) => p && digitsOf(p.mobile) === d);
}

// Identity is mobile + name, the same rule intake and the portal already use.
// Anything else would let the same person be created twice from here and once
// from reception.
export function duplicatePatient(patients, mobile, name) {
  const d = digitsOf(mobile);
  const n = String(name || '').trim().toLowerCase();
  if (!d || !n) return null;
  return (patients || []).find((p) => p
    && digitsOf(p.mobile) === d
    && String(p.name || '').trim().toLowerCase() === n) || null;
}

// What stops a booking being saved. Returns a message or '' — the order is
// the order a person fills the form in, so they are told about the first
// thing they missed rather than the last.
export function validateDraft(draft, { patients, today, nowMin }) {
  const d = draft || {};
  if (isPast(d.date, d.start, today, nowMin)) return 'That time has already passed — pick a later slot.';

  if (d.who === 'existing') {
    if (!d.pick) return 'Search and select a patient first.';
    return '';
  }

  if (!String(d.name || '').trim()) return "Enter the patient's name.";
  if (digitsOf(d.mobile).length !== 10) return 'Enter a valid 10-digit mobile number.';
  if (String(d.age == null ? '' : d.age).trim() === '') return "Enter the patient's age.";
  const age = Number(d.age);
  if (!Number.isFinite(age) || age < 0 || age > 120) return 'Enter an age between 0 and 120.';
  if (!d.gender) return "Select the patient's gender.";

  const dup = duplicatePatient(patients, d.mobile, d.name);
  if (dup) return dup.name + ' is already registered on this number — switch to Existing patient and pick them.';
  return '';
}
