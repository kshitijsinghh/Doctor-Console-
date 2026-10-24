// The reminder history inside the event pop-up, mounted for real.
//
// A build and the SSR smoke test both pass for a component whose expand
// handler throws, because the list only renders after a click and a fetch.
// This drives both.
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

// waFetch refuses to send without a session, and rightly so — it is the
// check that turns an expired token into a readable message instead of a
// bare 403. The test needs a signed-in staff user to get past it.
dom.window.localStorage.setItem('pp_session', JSON.stringify({
  accessToken: 'test-token',
  refreshToken: 'test-refresh',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: { email: 'staff@clinic.test', role: 'staff' },
}));

// Stubbed before the module graph loads, so waApi's real code path runs and
// only the network is replaced. A test that stubbed appointmentNotifications
// itself would pass with the URL built wrongly.
let lastUrl = null;
let nextBody = { ok: true, notifications: [] };
let failNext = false;
global.fetch = async (url) => {
  lastUrl = String(url);
  if (failNext) throw new Error('Network unreachable');
  return {
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => nextBody,
    text: async () => JSON.stringify(nextBody),
  };
};

const { createRoot } = await import('react-dom/client');
const { act, createElement: h } = await import('react');
const EventPopover = (await import('../src/whatsapp/appointments/EventPopover.jsx')).default;
const { notifLabel, notifChip, notifSummary } = await import('../src/whatsapp/statusModel.js');

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : String(got).slice(0, 220)); }
};

/* ══ The pure label helpers ═════════════════════════════════════════════ */
check('the chase has its own label, distinct from the plain reminder',
  notifLabel('APPOINTMENT_REMINDER_UNCONFIRMED') !== notifLabel('APPOINTMENT_REMINDER_TODAY'),
  [notifLabel('APPOINTMENT_REMINDER_UNCONFIRMED'), notifLabel('APPOINTMENT_REMINDER_TODAY')]);
check('a booking confirmation is named as one',
  /confirmation/i.test(notifLabel('APPOINTMENT_CONFIRMATION')), notifLabel('APPOINTMENT_CONFIRMATION'));
// Rows sent under the old schedule still carry this use case.
check('the retired day-before reminder still gets a label',
  notifLabel('APPOINTMENT_REMINDER') !== 'Message', notifLabel('APPOINTMENT_REMINDER'));
check('an unknown use case falls back rather than rendering blank',
  notifLabel('SOMETHING_NEW') === 'Message', notifLabel('SOMETHING_NEW'));
check('a missing use case does not throw', notifLabel(undefined) === 'Message');

check('a failed message is coloured as a problem',
  notifChip('Not delivered').ink !== notifChip('Sent').ink, notifChip('Not delivered'));
check('seen and delivered are told apart',
  notifChip('Seen').bg !== notifChip('Delivered').bg);
check('an unknown status still returns a usable chip',
  !!notifChip('anything').bg && !!notifChip('anything').ink);

check('no messages reads as none, not as zero', notifSummary([]) === 'No messages sent yet', notifSummary([]));
check('one message is singular', notifSummary([{}]) === '1 message sent', notifSummary([{}]));
check('three messages are plural', notifSummary([{}, {}, {}]) === '3 messages sent', notifSummary([{}, {}, {}]));
check('replies are counted in the summary',
  notifSummary([{ reply: 'Coming' }, {}]) === '2 messages sent · 1 replied',
  notifSummary([{ reply: 'Coming' }, {}]));
check('a null list does not throw', notifSummary(null) === 'No messages sent yet');

/* ══ Mounted ════════════════════════════════════════════════════════════ */
const EV = {
  appointmentId: 'A1',
  name: 'Kshitij New Test',
  mobile: '+919110968006',
  date: '2026-10-24',
  time: '12:30 PM',
  durationMin: 30,
  treatment: 'Consultation',
  visitId: null,
  status: 'sent',
  confirmation: { answer: null, answeredAt: null, changed: false, lastMessageStatus: 'sent' },
  reminders: [{ useCase: 'APPOINTMENT_CONFIRMATION', sentAt: '2026-10-24T02:44:00.000Z' }],
  lastSentAt: '2026-10-24T02:44:00.000Z',
};

let container, root;
async function mount(ev = EV) {
  container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(EventPopover, {
      ev, anchor: { top: 100, left: 100 }, isMobile: false,
      optedOut: false, busy: false, error: '',
      onClose() {}, onReschedule() {}, onCancel() {}, onSendNow() {}, onOpenVisit: null,
    }));
  });
}
async function unmount() { await act(async () => { root.unmount(); }); container.remove(); }

// Last match, not first: querySelectorAll returns ancestors before children
// and a wrapper's textContent equals its only child's, so the first hit is
// usually the container rather than the element carrying the handler.
function byText(re) {
  const all = [...container.querySelectorAll('button, div, span, p')].filter((el) => re.test(el.textContent || ''));
  return all[all.length - 1] || null;
}
const toggle = () => [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-expanded') !== null);

await mount();
check('the pop-up renders with a history section', !!toggle(), container.innerHTML.slice(0, 200));
check('it starts collapsed', toggle().getAttribute('aria-expanded') === 'false', toggle().getAttribute('aria-expanded'));
// The count comes off the calendar payload, so the header is right before
// any request is made.
check('...and already counts what the calendar told it',
  /1 message sent/.test(toggle().textContent), toggle().textContent);
check('...without having fetched anything yet', lastUrl === null, lastUrl);

nextBody = {
  ok: true,
  notifications: [
    { useCase: 'APPOINTMENT_CONFIRMATION', sentAt: '2026-10-24T02:44:00.000Z', status: 'Seen', reply: 'Coming' },
    { useCase: 'APPOINTMENT_REMINDER_UNCONFIRMED', sentAt: '2026-10-24T03:10:00.000Z', status: 'Delivered', reply: null },
  ],
};
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => {});

check('expanding it fetches the appointment\'s notifications',
  !!lastUrl && lastUrl.includes('/whatsapp/appointments/A1/notifications'), lastUrl);
check('...and passes the clinic id', !!lastUrl && lastUrl.includes('clinicId='), lastUrl);
check('...it is now expanded', toggle().getAttribute('aria-expanded') === 'true');
check('the confirmation row is listed', !!byText(/Booking confirmation/), container.textContent.slice(0, 300));
check('the chase row is listed and named differently',
  !!byText(/asked again/), container.textContent.slice(0, 400));
check('a reply is shown against the message that got it',
  /replied Coming/.test(container.textContent), container.textContent.slice(0, 400));
check('each row carries its delivery status',
  /Seen/.test(container.textContent) && /Delivered/.test(container.textContent));
check('the header now reflects what came back',
  /2 messages sent · 1 replied/.test(toggle().textContent), toggle().textContent);

// Collapsing and re-expanding must not fire a second request.
const urlAfterFirst = lastUrl;
lastUrl = null;
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => {});
check('re-opening reuses what was already loaded', lastUrl === null, lastUrl);
check('...and still shows the rows', !!byText(/Booking confirmation/));
await unmount();

/* ── An appointment with nothing sent ── */
lastUrl = null;
nextBody = { ok: true, notifications: [] };
await mount({ ...EV, reminders: [] });
check('an appointment with no messages says so in the header',
  /Message history/.test(toggle().textContent), toggle().textContent);
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => {});
check('...and says nothing has been sent once opened',
  /Nothing has been sent/.test(container.textContent), container.textContent.slice(0, 300));
await unmount();

/* ── A failing request must not blank the pop-up ── */
failNext = true;
await mount();
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => {});
// waFetch converts a dead network into this copy; the history section must
// show it rather than rendering an empty list, which would read as "we never
// sent this patient anything".
check('a failed load shows an error rather than an empty list',
  /could not reach the messaging service/i.test(container.textContent), container.textContent.slice(-300));
check('...and does NOT claim nothing was sent',
  !/Nothing has been sent/.test(container.textContent), container.textContent.slice(-300));
// The whole point: the pop-up is for rescheduling, and a broken history
// request must not take the buttons with it.
check('...and the Reschedule button is still there',
  !!byText(/Reschedule/), container.textContent.slice(0, 300));
check('...and Cancel appointment too', !!byText(/Cancel appointment/));
failNext = false;
await unmount();

/* ── Opening a different appointment must not show the first one's rows ── */
nextBody = {
  ok: true,
  notifications: [{ useCase: 'APPOINTMENT_CONFIRMATION', sentAt: '2026-10-24T02:44:00.000Z', status: 'Seen', reply: null }],
};
await mount();
await act(async () => { toggle().dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
await act(async () => {});
check('the first appointment\'s history is open', !!byText(/Booking confirmation/));
await act(async () => {
  root.render(h(EventPopover, {
    ev: { ...EV, appointmentId: 'A2', reminders: [] }, anchor: { top: 100, left: 100 }, isMobile: false,
    optedOut: false, busy: false, error: '',
    onClose() {}, onReschedule() {}, onCancel() {}, onSendNow() {}, onOpenVisit: null,
  }));
});
await act(async () => {});
check('switching appointment collapses it again',
  toggle().getAttribute('aria-expanded') === 'false', toggle().getAttribute('aria-expanded'));
check('...and the previous rows are gone',
  !byText(/Booking confirmation/), container.textContent.slice(0, 300));
await unmount();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
