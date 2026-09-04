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
  if (!json.ok) throw new Error(json.error || 'Something went wrong, please try again');
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

export function savePayment({ visitId, patientId, patientName, mobile, date, treatmentCost, amountPaid, balanceDue, paymentMode, paySplits, clinicId }) {
  return post({ action: 'savePayment', visitId, patientId, patientName, mobile, date, treatmentCost, amountPaid, balanceDue, paymentMode, paySplits, clinicId });
}

// ── AWS Backend API ──

const AWS_URL = import.meta.env.VITE_AWS_API_URL;
const CLINIC_ID = import.meta.env.VITE_CLINIC_ID;

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

