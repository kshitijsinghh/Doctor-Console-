// Talks to the Google Apps Script Web App (see apps-script/README.md) that
// reads/writes the clinic's Google Sheet. This is the only source of data —
// nothing is cached in localStorage.

const BASE_URL = import.meta.env.VITE_SHEETS_API_URL;
const CACHE_KEY = 'patientpad_list_cache';
const AWS_URL = import.meta.env.VITE_AWS_API_URL;
const CLINIC_ID = import.meta.env.VITE_CLINIC_ID;

export function getCachedList() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function cacheList(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function assertConfigured() {
  if (!BASE_URL) {
    throw new Error(
      'VITE_SHEETS_API_URL is not set. Copy .env.example to .env, deploy the ' +
      'Apps Script backend (see apps-script/README.md), and paste its Web App URL in.'
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   Diagnostics
   ──────────────────────────────────────────────────────────────
   Every Apps Script request is timed and, if anything went wrong or it ran
   slow, reported to the Lambda's /log endpoint (-> CloudWatch).

   The logging lives HERE, at the transport layer, not in the UI's catch
   blocks. A POST whose first attempt fails and whose retry succeeds never
   reaches a catch block — the app sees success — yet that is exactly the
   sequence that writes the row twice. Logging per attempt is the only way
   to see it.
   ────────────────────────────────────────────────────────────── */

// Distinguishes concurrent users/tabs of the same clinic in the logs.
const SESSION_ID = Math.random().toString(36).slice(2, 10);

// Successful requests slower than this are logged too — the Apps Script
// 302 -> googleusercontent redirect has been observed taking 8-34s, and that
// latency is what burns the shared daily script quota.
const SLOW_MS = 6000;

// ── Logging switches (Vite inlines these at build time — changing one needs a
//    rebuild + redeploy, not just an env change in Vercel) ──

// 1.0 = log every request. Drop to ~0.05 once a baseline exists; failures and
// slow requests are ALWAYS logged regardless of this rate.
const LOG_SAMPLE_RATE = 1.0;

// Include request AND response payloads, on success as well as failure.
// NOTE: these carry clinical detail (diagnosis, medicines, notes) and, for the
// snapshot endpoints, the whole patient list. Enabled deliberately for
// debugging — pair it with a short CloudWatch/S3 retention.
const LOG_BODIES = true;

// Log response bodies on success too, not just on failure. Successful
// saveIntake/portalCheckin/list responses are the full clinic snapshot
// (~60-200 KB), so this is the setting that makes logging expensive and slow.
const LOG_SUCCESS_RESPONSES = true;

// Generous ceiling; the Lambda spills anything oversized to S3 rather than
// letting CloudWatch truncate it.
const BODY_MAX = 2 * 1024 * 1024;

// sendBeacon and fetch(keepalive) are both capped at 64 KB by the browser, and
// sendBeacon fails SILENTLY when over. Anything larger goes by plain fetch.
const BEACON_MAX = 50 * 1024;

// fetch() has NO default timeout. Without this, an Apps Script request that
// hangs leaves the promise pending forever: the doctor sees a spinner, gives
// up and reloads, and no log record is ever produced — the one failure mode
// the diagnostics would otherwise be blind to.
// 45s is comfortably above the slowest successful response observed (34s,
// during the googleusercontent redirect incidents).
const REQUEST_TIMEOUT_MS = 45000;

async function fetchWithTimeout(url, opts) {
  if (typeof AbortController === 'undefined') return fetch(url, opts);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(opts || {}), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clip(str, max) {
  const t = typeof str === 'string' ? str : '';
  return t.length > max ? t.slice(0, max) + '…[cut ' + t.length + ']' : t;
}

function logEvent(record) {
  try {
    if (!AWS_URL) return;
    const body = JSON.stringify({
      ts: new Date().toISOString(),
      clinicId: CLINIC_ID || '',
      sessionId: SESSION_ID,
      ...record,
    });
    const url = `${AWS_URL}/log`;
    const small = body.length <= BEACON_MAX;

    // text/plain, NOT application/json. application/json is not a
    // CORS-safelisted content type, so it forces an OPTIONS preflight on every
    // single log call — extra latency, and a whole class of CORS failures for
    // something that must never be able to disturb the app. text/plain makes
    // this a "simple" cross-origin request with no preflight at all. The body
    // is still JSON; the Lambda parses it regardless of the declared type.
    // This mirrors what the Apps Script calls already do.
    const TYPE = 'text/plain;charset=UTF-8';

    // Small records go by beacon so they survive a tab close or navigation.
    // sendBeacon returns false when it would exceed the browser's 64 KB
    // in-flight budget — that return value MUST be checked, or the record is
    // dropped without a trace.
    if (small && navigator.sendBeacon) {
      const queued = navigator.sendBeacon(url, new Blob([body], { type: TYPE }));
      if (queued) return;
    }
    // Large records (full clinic snapshots) exceed the 64 KB cap that applies
    // to both sendBeacon and keepalive fetches, so they go as a normal fetch.
    // Trade-off: a normal fetch does not survive the tab closing mid-flight.
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': TYPE },
      body,
      keepalive: small,
    }).catch(() => {});
  } catch { /* diagnostics must never break the app */ }
}

// Reads the body as text first so the raw payload is available to the logger
// on failure; res.json() can only be consumed once.
async function handle(res) {
  let text = '';
  try { text = await res.text(); } catch { /* body already gone */ }

  if (!res.ok) {
    const e = new Error('Something went wrong, please try again');
    e.httpStatus = res.status;
    e.responseBody = text;
    throw e;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // Apps Script served HTML instead of JSON — typically a quota/permission
    // interstitial rather than our own error envelope.
    const e = new Error('The clinic server returned an unexpected response.');
    e.httpStatus = res.status;
    e.nonJson = true;
    e.responseBody = text;
    throw e;
  }
  if (!json.ok) {
    const e = new Error(json.error || 'Something went wrong, please try again');
    e.httpStatus = res.status;
    e.serverError = json.error || '';
    e.responseBody = text;
    throw e;
  }
  // Stash the raw text so the caller can log it; non-enumerable so it never
  // reaches the UI, React state, or the localStorage snapshot cache.
  Object.defineProperty(json, '__raw', { value: text, enumerable: false });
  return json;
}

// Two attempts, as before — retries are deliberately kept for POSTs. Each
// attempt is timed and recorded separately.
async function fetchWithRetry(url, opts, ctx) {
  const method = (opts && opts.method) || 'GET';
  const attempts = [];
  let res = null;

  for (let n = 1; n <= 2; n++) {
    const t0 = Date.now();
    try {
      res = await fetchWithTimeout(url, opts);
      attempts.push({ n, outcome: res.ok ? 'ok' : 'http_error', httpStatus: res.status, ms: Date.now() - t0 });
      if (res.ok) break;
    } catch (err) {
      res = null;
      // A hang and a dropped connection need telling apart: the first means
      // Apps Script is stuck or throttled, the second is the clinic's network.
      const timedOut = err && (err.name === 'AbortError' || /abort/i.test(String(err.message || '')));
      attempts.push({
        n,
        outcome: timedOut ? 'timeout' : 'network_error',
        error: String((err && err.message) || err),
        ms: Date.now() - t0,
      });
    }
  }

  const totalMs = attempts.reduce((a, x) => a + x.ms, 0);
  const failedFirst = attempts.length > 1;
  const finalOk = !!(res && res.ok);

  // A write that was sent twice and eventually succeeded has very likely been
  // applied twice — saveIntake appends a visit row unconditionally.
  const duplicateRisk = method === 'POST' && failedFirst && finalOk;

  // Failures, retries and slow calls are always logged; clean fast requests
  // are sampled, so the log keeps a denominator to compute an error rate from.
  const notable = !finalOk || failedFirst || totalMs > SLOW_MS;
  if (notable || Math.random() < LOG_SAMPLE_RATE) {
    logEvent({
      kind: 'apps_script_request',
      action: (ctx && ctx.action) || 'list',
      method,
      patientId: (ctx && ctx.patientId) || '',
      visitId: (ctx && ctx.visitId) || '',
      attempts,
      attemptCount: attempts.length,
      finalOutcome: finalOk ? 'ok' : 'failed',
      totalMs,
      slow: totalMs > SLOW_MS,
      timedOut: attempts.some((a) => a.outcome === 'timeout'),
      duplicateRisk,
      sampled: !notable,
      requestBody: LOG_BODIES && opts && opts.body ? clip(opts.body, BODY_MAX) : undefined,
    });
  }
  return res;
}

export async function fetchList() {
  assertConfigured();
  const res = await fetchWithRetry(BASE_URL + '?action=list', undefined, { action: 'list' });
  if (!res) throw new Error('Could not reach the clinic server. Check your connection.');
  const json = await handle(res);
  if (LOG_BODIES && LOG_SUCCESS_RESPONSES) {
    logEvent({
      kind: 'apps_script_response',
      action: 'list', method: 'GET',
      httpStatus: res.status,
      finalOutcome: 'ok',
      responseBody: clip(json.__raw, BODY_MAX),
      responseBytes: (json.__raw || '').length,
      serverPerf: json._perf || null,
    });
  }
  cacheList(json);
  return json;
}

async function post(payload) {
  assertConfigured();
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  };
  const ctx = { action: payload.action, patientId: payload.patientId, visitId: payload.visitId };
  const res = await fetchWithRetry(BASE_URL, opts, ctx);
  if (!res) {
    const e = new Error('Could not reach the clinic server. Check your connection.');
    e.networkFailure = true;
    throw e;
  }
  try {
    const json = await handle(res);
    if (LOG_BODIES && LOG_SUCCESS_RESPONSES) {
      logEvent({
        kind: 'apps_script_response',
        action: payload.action, method: 'POST',
        patientId: payload.patientId || '', visitId: payload.visitId || '',
        httpStatus: res.status,
        finalOutcome: 'ok',
        requestBody: clip(opts.body, BODY_MAX),
        responseBody: clip(json.__raw, BODY_MAX),
        responseBytes: (json.__raw || '').length,
        // Apps Script's own phase timings, returned inside the response so
        // measuring them costs no extra request and no UrlFetch quota.
        serverPerf: json._perf || null,
      });
    }
    return json;
  } catch (err) {
    // handle() failures (non-2xx, non-JSON, {ok:false}) are not seen by
    // fetchWithRetry when the HTTP layer itself returned 200.
    logEvent({
      kind: 'apps_script_error',
      action: payload.action, method: 'POST',
      patientId: payload.patientId || '', visitId: payload.visitId || '',
      httpStatus: err.httpStatus || null,
      serverError: err.serverError || '',
      nonJson: !!err.nonJson,
      message: String(err.message || ''),
      requestBody: LOG_BODIES ? clip(opts.body, BODY_MAX) : undefined,
      // Full response text only on failure — a successful saveIntake returns
      // the entire clinic snapshot (~178 KB), which is noise, not signal.
      responseBody: LOG_BODIES ? clip(err.responseBody, BODY_MAX) : undefined,
    });
    throw err;
  }
}

export function saveIntake({ mobile, name, age, gender, date }) {
  return post({ action: 'saveIntake', mobile, name, age, gender, date });
}

export function saveClinical({ patientId, visitId, cform }) {
  return post({ action: 'saveClinical', patientId, visitId, cform });
}

export function uploadQr({ dataUrl, filename }) {
  return post({ action: 'uploadQr', dataUrl, filename });
}

export function portalCheckin({ mobile, name, age, gender, email }) {
  return post({ action: 'portalCheckin', mobile, name, age, gender, email });
}

export function savePatientProblem({ patientId, visitId, patientProblem }) {
  return post({ action: 'savePatientProblem', patientId, visitId, patientProblem });
}

export function savePayment({ visitId, patientId, patientName, mobile, date, treatmentCost, amountPaid, balanceDue, paymentMode, paySplits, clinicId }) {
  return post({ action: 'savePayment', visitId, patientId, patientName, mobile, date, treatmentCost, amountPaid, balanceDue, paymentMode, paySplits, clinicId });
}

// ── AWS Backend API ──

async function awsJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('AWS API error: ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'AWS API error');
  return json;
}

export async function fetchOrg() {
  if (!AWS_URL || !CLINIC_ID) return null;
  try {
    const json = await awsJson(`${AWS_URL}/org/${CLINIC_ID}`);
    return json.org;
  } catch { return null; }
}

export async function getUploadUrl({ visitId, fileName, fileType, docKind }) {
  if (!AWS_URL || !CLINIC_ID) return null;
  return awsJson(`${AWS_URL}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId: CLINIC_ID, visitId, fileName, fileType, docKind }),
  });
}

export async function uploadToS3(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error('S3 upload failed: ' + res.status);
}

export async function getDocumentUrl(key) {
  if (!AWS_URL) return null;
  const safePath = key.split('/').map(encodeURIComponent).join('/');
  const json = await awsJson(`${AWS_URL}/document/${safePath}`);
  return json.url;
}

export async function getRxTemplateUrl() {
  if (!AWS_URL || !CLINIC_ID) return null;
  try {
    const json = await awsJson(`${AWS_URL}/org/${CLINIC_ID}/rx-template`);
    return json.url;
  } catch { return null; }
}

export async function generatePrescriptionPdf(visitData) {
  if (!AWS_URL || !CLINIC_ID) throw new Error('AWS not configured');
  const json = await awsJson(`${AWS_URL}/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId: CLINIC_ID, type: 'prescription', visitData }),
  });
  return json;
}

export async function getReceiptTemplateUrl() {
  if (!AWS_URL || !CLINIC_ID) return null;
  try {
    const json = await awsJson(`${AWS_URL}/org/${CLINIC_ID}/receipt-template`);
    return json.url;
  } catch { return null; }
}

export async function uploadReceiptTemplate(file) {
  if (!AWS_URL || !CLINIC_ID) throw new Error('AWS not configured');
  const json = await awsJson(`${AWS_URL}/org/${CLINIC_ID}/receipt-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType: file.type }),
  });
  await uploadToS3(json.uploadUrl, file);
  return json;
}

export async function generateReceiptPdf(visitData) {
  if (!AWS_URL || !CLINIC_ID) throw new Error('AWS not configured');
  const json = await awsJson(`${AWS_URL}/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId: CLINIC_ID, type: 'receipt', visitData }),
  });
  return json;
}

export function getClinicId() {
  return CLINIC_ID || '';
}

