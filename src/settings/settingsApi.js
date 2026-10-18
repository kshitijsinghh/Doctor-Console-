// The doctor's-form settings API.
//
// Lives on the same AWS Lambda as /whatsapp/*, behind the same API Gateway
// authorizer, and reuses waFetch so the token, timeout, slow-request logging
// and error copy are not reimplemented here.

import { waFetch } from '../whatsapp/waApi';
import { toWire } from './formConfig';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID;

const qs = (params) => {
  const p = new URLSearchParams();
  Object.keys(params || {}).forEach((k) => {
    const v = params[k];
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? '?' + s : '';
};

// ONE call at boot returning the config AND the whole medicine library.
//
// The changelog specifies a separate `GET /medicines?q=` search endpoint. That
// is the wrong shape for the job it actually has to do: the autocomplete fires
// on every keystroke in the middle of writing a prescription, and a network
// round trip per keystroke is unusable. A clinic's library is a few hundred
// records at most — a handful of KB — so it is fetched once and filtered in
// the browser, which is instant and works when the connection stutters.
//
// Server-side search stays available for later if a library ever gets big
// enough to need it; nothing here prevents adding it.
export async function fetchDoctorFormSettings() {
  const json = await waFetch('/settings/doctor-form' + qs({ clinicId: CLINIC_ID }), undefined,
    { op: 'fetchDoctorFormSettings' });
  return {
    fields: (json && json.fields) || null,
    dropdowns: (json && json.dropdowns) || null,
    medicines: (json && json.medicines) || [],
    updatedAt: (json && json.updatedAt) || null,
  };
}

// The whole document every time, not a patch. It is small, and a patch
// protocol would need the server to understand the locked-field and
// dependency rules in a second place to apply one safely.
export function saveDoctorFormSettings(config) {
  return waFetch('/settings/doctor-form', {
    method: 'PUT',
    body: JSON.stringify({ clinicId: CLINIC_ID, ...toWire(config) }),
  }, { op: 'saveDoctorFormSettings' });
}

export function createMedicine(med) {
  return waFetch('/medicines', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID, ...med }),
  }, { op: 'createMedicine' }).then((j) => (j && j.medicine) || null);
}

export function updateMedicine(id, med) {
  return waFetch('/medicines/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify({ clinicId: CLINIC_ID, ...med }),
  }, { op: 'updateMedicine' }).then((j) => (j && j.medicine) || null);
}

// A POST, not a DELETE. The API Gateway CORS config allows GET, POST, OPTIONS
// and PUT, so a browser preflight for DELETE is refused — and widening that
// list means rewriting a setting shared by every route on the API, where a
// mistake would break every clinic's console at once.
export function deleteMedicine(id) {
  return waFetch('/medicines/' + encodeURIComponent(id) + '/delete', {
    method: 'POST',
    body: JSON.stringify({ clinicId: CLINIC_ID }),
  }, { op: 'deleteMedicine' });
}
