// The autosave engine. There is no Save button on the settings page, so this
// is the only thing between a doctor's edit and losing it.
import { createAutosave, statusLabel, IDLE, SAVING, SAVED, ERROR } from '../src/settings/autosave.js';

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : JSON.stringify(got)); }
};

// A controllable clock: nothing fires until time is advanced by hand.
function clock() {
  let at = 0, seq = 0;
  const jobs = new Map();
  return {
    schedule(fn, ms) { const id = ++seq; jobs.set(id, { fn, due: at + ms }); return id; },
    cancel(id) { jobs.delete(id); },
    async tick(ms) {
      at += ms;
      // Jobs can schedule more jobs; keep going until nothing more is due.
      for (let guard = 0; guard < 100; guard++) {
        const due = [...jobs.entries()].filter(([, j]) => j.due <= at).sort((a, b) => a[1].due - b[1].due);
        if (!due.length) break;
        for (const [id, j] of due) { jobs.delete(id); j.fn(); }
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      }
      await Promise.resolve();
    },
  };
}

// A sender whose promises are resolved by the test, so "in flight" is a state
// the test can hold open.
function sender() {
  const calls = [];
  let gate = [];
  const fn = (value) => new Promise((resolve, reject) => {
    calls.push(value);
    gate.push({ resolve, reject });
  });
  return {
    fn, calls,
    settle: async (i, ok = true) => { ok ? gate[i].resolve({}) : gate[i].reject(new Error('network')); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); },
    inFlight: () => gate.length - gate.filter((g) => g.done).length,
  };
}

const states = (a) => a.log;
function make(opts = {}) {
  const c = clock(), s = sender();
  const log = [];
  const a = createAutosave({
    send: s.fn, onState: (st) => log.push(st),
    schedule: c.schedule, cancel: c.cancel, ...opts,
  });
  a.log = log;
  return { a, c, s };
}

/* ══ Debounce ═════════════════════════════════════════════════════════ */

let { a, c, s } = make();
check('nothing is sent before the debounce elapses', (a.push('v1'), s.calls.length === 0));
check('the pill says Saving as soon as an edit happens', states(a).join() === 'saving', states(a));
await c.tick(499);
check('...still nothing at 499ms', s.calls.length === 0);
await c.tick(2);
check('...and it goes at 500ms', s.calls.length === 1 && s.calls[0] === 'v1', s.calls);

await s.settle(0);
check('a successful save reports saved', a.state() === SAVED, a.state());

// Rapid toggling must be one request carrying the final value, not five.
({ a, c, s } = make());
a.push('a'); await c.tick(100);
a.push('b'); await c.tick(100);
a.push('c'); await c.tick(100);
a.push('d'); await c.tick(600);
check('five rapid edits collapse into one request', s.calls.length === 1, s.calls);
check('...carrying the last value', s.calls[0] === 'd', s.calls);

/* ══ One request in flight ════════════════════════════════════════════ */

// The failure this prevents: two toggles land out of order and the server
// keeps the older document, silently undoing the doctor's second click.
({ a, c, s } = make());
a.push('first'); await c.tick(600);
check('the first request is away', s.calls.length === 1);

a.push('second'); await c.tick(600);
check('a second edit does NOT open a second request while one is in flight',
  s.calls.length === 1, s.calls);
check('...and the pill still says saving', a.state() === SAVING);

await s.settle(0);
await c.tick(10);
check('...it goes as soon as the first comes back', s.calls.length === 2 && s.calls[1] === 'second', s.calls);
check('...and only then does it say saved', a.state() === SAVING, a.state());
await s.settle(1);
check('...saved once the queue is empty', a.state() === SAVED, a.state());

/* ══ Failure: retry, and never lose the change ════════════════════════ */

({ a, c, s } = make({ retryDelay: 3000 }));
a.push('doc1'); await c.tick(600);
await s.settle(0, false);
check('a failed save reports the error state', a.state() === ERROR, a.state());
check('...with the copy the spec asks for', statusLabel(ERROR) === "Couldn't save — retrying");
check('...and it has not given up', a.hasPending() === true);

await c.tick(2999);
check('...retry waits for the retry delay', s.calls.length === 1, s.calls);
await c.tick(2);
check('...then retries with the SAME document', s.calls.length === 2 && s.calls[1] === 'doc1', s.calls);
await s.settle(1);
check('...and recovers to saved', a.state() === SAVED, a.state());

// A retry must never resurrect a stale document over a newer edit.
({ a, c, s } = make({ retryDelay: 3000 }));
a.push('old'); await c.tick(600);
await s.settle(0, false);
a.push('new');
await c.tick(4000);
check('an edit made after a failure supersedes the failed document',
  s.calls.length === 2 && s.calls[1] === 'new', s.calls);
check('...the stale value is never resent', !s.calls.slice(1).includes('old'), s.calls);

// Repeated failure keeps retrying rather than dropping the edit on the floor.
({ a, c, s } = make({ retryDelay: 1000 }));
a.push('x'); await c.tick(600);
await s.settle(0, false); await c.tick(1100);
await s.settle(1, false); await c.tick(1100);
await s.settle(2, false); await c.tick(1100);
check('it keeps retrying through repeated failures', s.calls.length === 4, s.calls.length);
check('...always with the change still held', s.calls.every((v) => v === 'x'), s.calls);

/* ══ Leaving the page ═════════════════════════════════════════════════ */

({ a, c, s } = make());
a.push('unsent');
a.flush();
await c.tick(1);
check('flush sends a pending change immediately', s.calls.length === 1 && s.calls[0] === 'unsent', s.calls);

({ a, c, s } = make());
a.flush(); await c.tick(10);
check('flush with nothing pending sends nothing', s.calls.length === 0);

({ a, c, s } = make());
a.push('dropped');
a.stop();
await c.tick(5000);
check('stop cancels a pending save', s.calls.length === 0, s.calls);

({ a, c, s } = make());
a.push('v'); await c.tick(600);
a.stop();
await s.settle(0);
check('a response arriving after stop does not touch state', a.state() === SAVING, a.state());

/* ══ Labels ═══════════════════════════════════════════════════════════ */

check('idle copy', statusLabel(IDLE) === 'Changes save automatically');
check('saving copy', statusLabel(SAVING) === 'Saving…');
check('saved copy', statusLabel(SAVED) === 'All changes saved');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
