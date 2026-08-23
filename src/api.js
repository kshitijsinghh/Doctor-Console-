// Talks to the Google Apps Script Web App (see apps-script/README.md) that
// reads/writes the clinic's Google Sheet. This is the only source of data —
// nothing is cached in localStorage.

const BASE_URL = import.meta.env.VITE_SHEETS_API_URL;
const CACHE_KEY = 'patientpad_list_cache';

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

async function handle(res) {
  if (!res.ok) throw new Error('Something went wrong, please try again');
  const json = await res.json();
  if (!json.ok) throw new Error('Something went wrong, please try again');
  return json;
}

async function fetchWithRetry(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    const retry = await fetch(url, opts);
    return retry;
  } catch {
    const retry = await fetch(url, opts);
    return retry;
  }
}

export async function fetchList() {
  assertConfigured();
  const res = await fetchWithRetry(BASE_URL + '?action=list');
  const json = await handle(res);
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
  const res = await fetchWithRetry(BASE_URL, opts);
  return handle(res);
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
