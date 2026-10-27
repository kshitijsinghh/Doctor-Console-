// The consent endpoints, reached the same way the settings API is: through
// waFetch, which is the one place that knows the base URL, the token, the
// timeout and the error copy.
import { waFetch } from '../whatsapp/waApi';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID || '';
const enc = encodeURIComponent;

// The clinic's consent templates. An empty list is a valid answer and means
// the clinic has not set any up — the console then hides consent entirely.
export function listTemplates() {
  return waFetch('/consents/templates?clinicId=' + enc(CLINIC_ID), undefined,
    { op: 'listConsentTemplates' }).then((j) => j.templates || []);
}

export function saveTemplate(template) {
  const id = template.templateId || '';
  return waFetch('/consents/templates/' + enc(id), {
    method: 'PUT',
    body: JSON.stringify({ clinicId: CLINIC_ID, ...template }),
  }, { op: 'saveConsentTemplate' }).then((j) => j.template || null);
}

// POST rather than DELETE: the API's CORS AllowMethods has no DELETE, and
// changing it would rewrite a setting every route on the API shares.
export function deleteTemplate(templateId) {
  return waFetch('/consents/templates/' + enc(templateId) + '/delete', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID }),
  }, { op: 'deleteConsentTemplate' });
}

export function listConsents({ visitId, patientId } = {}) {
  const q = ['clinicId=' + enc(CLINIC_ID)];
  if (visitId) q.push('visitId=' + enc(visitId));
  if (patientId) q.push('patientId=' + enc(patientId));
  return waFetch('/consents?' + q.join('&'), undefined,
    { op: 'listConsents' }).then((j) => j.consents || []);
}

// One consent, one link, one WhatsApp message.
//
// `bodyText` is the rendered snapshot the patient will read, computed here
// and stored by the server. Rendering it client-side and sending it means
// what the doctor previewed is exactly what gets signed — the server does not
// re-render it from a template that may have been edited in between.
export function sendConsent({ visitId, patientId, templateId, bodyText, title, treatment, toothNumbers, vals }) {
  return waFetch('/consents', {
    method: 'POST',
    body: JSON.stringify({
      clinicId: CLINIC_ID, visitId, patientId, templateId,
      bodyText, title, treatment, toothNumbers, vals,
    }),
  }, { op: 'sendConsent', meta: { visitId, templateId } }).then((j) => j.consent || null);
}

// Sends the SAME link again in a new message. Does not mint a new token:
// a patient who kept the first message must not find it suddenly dead.
export function resendConsent(consentId) {
  return waFetch('/consents/' + enc(consentId) + '/resend', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID }),
  }, { op: 'resendConsent' }).then((j) => j.consent || null);
}

export function cancelConsent(consentId) {
  return waFetch('/consents/' + enc(consentId) + '/cancel', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID }),
  }, { op: 'cancelConsent' }).then((j) => j.consent || null);
}

// In-clinic signing: the staff session is the identity, so there is no token.
export function signInClinic(consentId, { signaturePng, signerName, signerRole }) {
  return waFetch('/consents/' + enc(consentId) + '/sign', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID, signaturePng, signerName, signerRole }),
  }, { op: 'signConsentInClinic' }).then((j) => j.consent || null);
}

// A short-lived signed URL. Never a public one — a signed consent is the most
// sensitive document the clinic holds.
export function consentPdfUrl(consentId) {
  return waFetch('/consents/' + enc(consentId) + '/pdf?clinicId=' + enc(CLINIC_ID), undefined,
    { op: 'consentPdfUrl' }).then((j) => j.url || '');
}
