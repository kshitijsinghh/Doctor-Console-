// Consent forms: everything that can be decided without a network call.
//
// Kept pure and separate from the components for the same reason
// settings/formConfig.js is: the rules about what a doctor may send, what a
// patient has answered and what a row should say are worth testing directly,
// and they are the part that would be expensive to get wrong.

export const CONSENT_STATUSES = ['sent', 'opened', 'signed', 'expired', 'cancelled'];

// The placeholders a consent template may use. Deliberately a closed set:
// a template is written by clinic staff, and a typo must render as nothing
// visible rather than leaking the raw {{handlebars}} onto a legal document.
export const PLACEHOLDERS = [
  'patient_name', 'age', 'gender', 'procedure', 'doctor', 'clinic', 'date',
];

const str = (v) => String(v == null ? '' : v).trim();

/* ── status ──────────────────────────────────────────────────────────── */

// The status as it should be READ, which is not always the status as stored.
//
// A link that has run out of time is still stored as `sent` or `opened` —
// nothing writes to it at the moment it lapses. Deriving expiry here rather
// than from a sweep means a consent that ran out thirty seconds ago reads as
// expired now, instead of whenever a background job next happens to run.
export function effectiveStatus(consent, now = Date.now()) {
  if (!consent) return null;
  const stored = str(consent.status).toLowerCase();
  if (stored !== 'sent' && stored !== 'opened') return stored;
  const expires = consent.expiresAt ? Date.parse(consent.expiresAt) : NaN;
  if (Number.isFinite(expires) && now > expires) return 'expired';
  return stored;
}

export const isLive = (consent, now) => {
  const s = effectiveStatus(consent, now);
  return s === 'sent' || s === 'opened';
};

export const isSigned = (consent, now) => effectiveStatus(consent, now) === 'signed';

// A template is blocked for this visit while a consent for it is live or
// already signed. Sending a second copy of a form the patient has signed is
// how a clinic ends up with two different answers to the same question.
export function activeFor(consents, templateId, now = Date.now()) {
  return (consents || []).find((c) => c
    && c.templateId === templateId
    && (isLive(c, now) || isSigned(c, now))) || null;
}

/* ── rendering ───────────────────────────────────────────────────────── */

// The values a template's placeholders are filled from.
//
// `procedure` is the tooth-tagged treatment label — "extraction of tooth 36",
// not "Extraction" — because that is what the patient is agreeing to and the
// difference is the whole point of a consent form.
export function placeholderVals({ patient = {}, procedure = '', doctor = '', clinic = '', date = '' } = {}) {
  return {
    patient_name: str(patient.name),
    age: str(patient.age),
    gender: str(patient.gender),
    procedure: str(procedure),
    doctor: str(doctor),
    clinic: str(clinic),
    date: str(date),
  };
}

// Splits a paragraph into plain and filled-in segments, so the preview can
// highlight what came from the visit and the PDF can print the same text
// without the highlight.
export function segments(text, vals) {
  const out = [];
  for (const part of String(text == null ? '' : text).split(/(\{\{\w+\}\})/)) {
    if (!part) continue;
    const m = /^\{\{(\w+)\}\}$/.exec(part);
    if (m) out.push({ text: str(vals[m[1]]), filled: true, key: m[1] });
    else out.push({ text: part, filled: false, key: null });
  }
  return out;
}

export function renderTemplate(template, vals) {
  const t = template || {};
  return {
    title: str(t.title),
    paras: (t.paras || []).map((p) => ({ segs: segments(p, vals) })),
    risks: (t.risks || []).map(str).filter(Boolean),
  };
}

// Flattened to the exact text a patient reads. This is what gets snapshotted
// on the consent record and hashed, so it must not include any markup.
export function renderPlainText(template, vals) {
  const r = renderTemplate(template, vals);
  const lines = [r.title, ''];
  r.paras.forEach((p) => { lines.push(p.segs.map((s) => s.text).join('')); lines.push(''); });
  if (r.risks.length) {
    lines.push('Possible risks');
    r.risks.forEach((x) => lines.push('• ' + x));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Which placeholders a template needs that this visit cannot fill.
//
// Sending with a blank where the tooth number should be produces a consent
// form that does not say what it is consenting to, so the send sheet blocks
// on this rather than quietly rendering an empty space.
export function missingPlaceholders(template, vals) {
  const used = new Set();
  (template && template.paras ? template.paras : []).forEach((p) => {
    for (const m of String(p).matchAll(/\{\{(\w+)\}\}/g)) used.add(m[1]);
  });
  return [...used].filter((k) => PLACEHOLDERS.includes(k) && !str(vals[k]));
}

/* ── the row in the consent bar ──────────────────────────────────────── */

const PILL = {
  sent: { label: 'Sent', bg: '#fff5cc', ink: '#7a5c00' },
  opened: { label: 'Opened', bg: '#fff5cc', ink: '#7a5c00' },
  signed: { label: '✓ Signed', bg: '#e3f5ec', ink: '#12805a' },
  expired: { label: 'Expired', bg: '#eef2f1', ink: '#5c7a76' },
  cancelled: { label: 'Cancelled', bg: '#eef2f1', ink: '#5c7a76' },
};

export const pillFor = (status) => PILL[status] || PILL.sent;

export function subLineFor(consent, now = Date.now(), fmt = {}) {
  const time = fmt.time || ((x) => String(x || ''));
  const when = fmt.when || ((x) => String(x || ''));
  const s = effectiveStatus(consent, now);
  if (s === 'signed') return '✓ Signed ' + when(consent.signedAt);
  if (s === 'expired') return 'Link expired before signing';
  if (s === 'cancelled') return 'Link cancelled';
  if (s === 'opened') return 'Opened ' + time(consent.openedAt) + ' · not signed yet';
  return 'Sent ' + time(consent.sentAt) + ' · not opened yet';
}

// What the staff may do with this consent right now.
export function actionsFor(consent, now = Date.now()) {
  const s = effectiveStatus(consent, now);
  const live = s === 'sent' || s === 'opened';
  return {
    view: s === 'signed',
    // Resend repeats the SAME link. Only meaningful while it still works.
    resend: live,
    cancel: live,
    // Send again mints a new consent and a new link.
    sendAgain: s === 'expired' || s === 'cancelled',
  };
}

export function consentRows(consents, templatesById, now = Date.now(), fmt = {}) {
  return [...(consents || [])]
    .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
    .map((c) => {
      const s = effectiveStatus(c, now);
      return {
        id: c.consentId || c.id,
        consent: c,
        title: (templatesById && templatesById[c.templateId] && templatesById[c.templateId].title) || c.title || 'Consent form',
        status: s,
        sub: subLineFor(c, now, fmt),
        subInk: s === 'signed' ? '#12805a' : '#5c7a76',
        pill: pillFor(s),
        can: actionsFor(c, now),
      };
    });
}

export function summaryChips(consents, now = Date.now()) {
  const all = consents || [];
  const signed = all.filter((c) => effectiveStatus(c, now) === 'signed').length;
  const waiting = all.filter((c) => isLive(c, now)).length;
  const dead = all.filter((c) => {
    const s = effectiveStatus(c, now);
    return s === 'expired' || s === 'cancelled';
  }).length;
  const out = [];
  if (signed) out.push({ key: 'signed', label: '✓ ' + signed + ' signed', bg: '#e3f5ec', ink: '#12805a' });
  if (waiting) out.push({ key: 'waiting', label: waiting + ' waiting', bg: '#fff5cc', ink: '#7a5c00' });
  if (dead) out.push({ key: 'dead', label: dead + ' expired', bg: '#eef2f1', ink: '#5c7a76' });
  return out;
}

/* ── the suggestion row ──────────────────────────────────────────────── */

// Templates can be linked to treatments. When the doctor picks a linked
// treatment and that form has not been sent on this visit, the bar offers it.
//
// This only ever SUGGESTS. Nothing is sent without someone pressing a button:
// a consent form going out because a dropdown changed would be worse than
// forgetting to send one.
export function suggestionFor({ templates, consents, treatments, dismissed, now = Date.now() }) {
  const picked = (treatments || []).map((t) => str(t).toLowerCase()).filter(Boolean);
  if (!picked.length) return null;
  const skip = new Set(dismissed || []);
  for (const t of templates || []) {
    if (!t || t.active === false) continue;
    if (skip.has(t.templateId)) continue;
    const links = (t.linkedTreatments || []).map((x) => str(x).toLowerCase()).filter(Boolean);
    const hit = links.find((l) => picked.includes(l));
    if (!hit) continue;
    if (activeFor(consents, t.templateId, now)) continue;
    const label = (t.linkedTreatments || []).find((x) => str(x).toLowerCase() === hit);
    return { template: t, treatment: label || hit };
  }
  return null;
}

/* ── the send sheet ──────────────────────────────────────────────────── */

export function sheetRows({ templates, consents, suggestedIds, now = Date.now() }) {
  const sug = new Set(suggestedIds || []);
  return (templates || [])
    .filter((t) => t && t.active !== false)
    .map((t) => {
      const blocking = activeFor(consents, t.templateId, now);
      const blockedBy = blocking ? effectiveStatus(blocking, now) : null;
      return {
        template: t,
        id: t.templateId,
        title: str(t.title),
        note: blockedBy === 'signed' ? 'Already signed for this visit'
          : blockedBy ? 'Sent — waiting for signature'
            : str(t.note),
        disabled: !!blocking,
        suggested: sug.has(t.templateId),
      };
    });
}

export const firstName = (name) => str(name).split(/\s+/)[0] || 'the patient';
