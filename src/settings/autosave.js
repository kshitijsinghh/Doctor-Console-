// Debounced autosave with one request in flight at a time.
//
// There is no Save button on the settings page, so this is the only thing
// standing between a doctor's edit and losing it. Three rules it has to keep:
//
//   * only one request in flight, or two toggles half a second apart can land
//     out of order and the older one wins;
//   * a change made DURING a request is sent after it, not dropped;
//   * a failed request is retried with the change still held, and the newest
//     change always wins over a stale retry.
//
// The timer functions are injectable so this can be tested without waiting in
// real time, and without a browser.

export const IDLE = 'idle';
export const SAVING = 'saving';
export const SAVED = 'saved';
export const ERROR = 'error';

export function createAutosave({
  send,
  delay = 500,
  retryDelay = 3000,
  onState,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (t) => clearTimeout(t),
} = {}) {
  let timer = null;
  let pending = null;        // { value } — null means nothing waiting
  let inFlight = false;
  let state = IDLE;
  let stopped = false;

  function setState(next) {
    if (next === state) return;
    state = next;
    if (onState) onState(next);
  }

  function arm(ms) {
    if (timer) cancel(timer);
    timer = schedule(run, ms);
  }

  async function run() {
    timer = null;
    if (stopped || inFlight || !pending) return;
    const sending = pending.value;
    pending = null;
    inFlight = true;
    try {
      await send(sending);
      inFlight = false;
      if (stopped) return;
      // Something was edited while this was in the air. Send that too, rather
      // than reporting "saved" for a document that is already out of date.
      if (pending) { setState(SAVING); arm(0); }
      else setState(SAVED);
    } catch {
      inFlight = false;
      if (stopped) return;
      // Put the change back so it is not lost — unless a newer one arrived in
      // the meantime, in which case the newer one supersedes it and retrying
      // the old value would undo the doctor's latest edit.
      if (!pending) pending = { value: sending };
      setState(ERROR);
      arm(retryDelay);
    }
  }

  return {
    // Call on every edit with the complete current document.
    push(value) {
      if (stopped) return;
      pending = { value };
      setState(SAVING);
      arm(delay);
    },
    // Send immediately if anything is waiting — used when leaving the page.
    flush() {
      if (stopped || !pending) return;
      arm(0);
    },
    state: () => state,
    hasPending: () => !!pending || inFlight,
    stop() {
      stopped = true;
      if (timer) cancel(timer);
      timer = null;
    },
  };
}

export function statusLabel(state) {
  if (state === SAVING) return 'Saving…';
  if (state === SAVED) return 'All changes saved';
  if (state === ERROR) return "Couldn't save — retrying";
  return 'Changes save automatically';
}
