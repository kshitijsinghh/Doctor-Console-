// Renders the two document pop-ups with realistic props. A temporal-dead-zone
// error, a bad hook order or a missing import throws here — none of which a
// Vite build or oxlint will tell you about.
import { renderToString } from 'react-dom/server';
import { PrescriptionSheet, ReceiptSheet, previewSrc } from '../src/views/Clinical.jsx';
import { WaProvider } from '../src/whatsapp/WaContext.jsx';
import { fmtClock, fmtDay, fmtDayOf } from '../src/whatsapp/ui.jsx';
import { docVersionForAttempt } from '../src/whatsapp/DocSend.jsx';
import { idempotencyKeyFor } from '../src/whatsapp/waApi.js';
import { createElement as h } from 'react';

const rx = {
  dateLabel: '04 Oct 2026', name: 'Kshitij Singh', ageGender: '30 yrs · M',
  mobile: '9110968006', patientId: 'P0001', visitId: 'P0001_68',
  chiefComplaint: 'Pain', description: '', diagnosis: '', investigation: '',
  treatmentGroup: '', toothNumber: '', treatment: 'Scaling', advisedTreatment: '',
  medicalHistory: '', comments: '', meds: [], anyRemarks: false, hasMeds: false, noMeds: true,
};
const receipt = {
  dateLabel: '04 Oct 2026', name: 'Kshitij Singh', mobile: '9110968006',
  patientId: 'P0001', visitId: 'P0001_68', treatmentCost: '100', amountPaid: '100',
  balanceDue: '0', balanceLabel: '₹0', balanceColor: '#12805a', status: 'Fully Paid',
  mode: 'UPI', paySplits: [], lines: [], totalLabel: '₹100', paidLabel: '₹100',
};

const cases = [
  ['PrescriptionSheet, no docx template', () => h(PrescriptionSheet, { rx, onClose() {}, clinicName: 'Indu Dental', clinicAddress: 'X', doctorName: 'Indu', doctorQualification: 'BDS', rxTemplateUrl: null, hasDocxTemplate: false })],
  ['PrescriptionSheet, docx template',    () => h(PrescriptionSheet, { rx, onClose() {}, clinicName: 'Indu Dental', clinicAddress: 'X', doctorName: 'Indu', doctorQualification: 'BDS', rxTemplateUrl: null, hasDocxTemplate: true })],
  ['ReceiptSheet, no docx template',      () => h(ReceiptSheet, { receipt, onClose() {}, clinicName: 'Indu Dental', clinicAddress: 'X', doctorName: 'Indu', hasReceiptTemplate: false })],
  ['ReceiptSheet, docx template',         () => h(ReceiptSheet, { receipt, onClose() {}, clinicName: 'Indu Dental', clinicAddress: 'X', doctorName: 'Indu', hasReceiptTemplate: true })],
];

let pass = 0, fail = 0;
for (const waEnabled of [false, true]) {
  for (const [name, make] of cases) {
    const label = `${name} (waEnabled=${waEnabled})`;
    try {
      const html = renderToString(h(WaProvider, { org: { waEnabled }, orgLoaded: true }, make()));
      if (!html || html.length < 50) throw new Error('rendered almost nothing');
      pass++; console.log(`  ✓ ${label}`);
    } catch (e) {
      fail++; console.log(`  ✗ ${label}\n      ${e.message}`);
    }
  }
}
/* ── Idempotency key across resends ──────────────────────────────────────
   The key is deterministic on purpose so a double click collapses into one
   send. That same property made "Send again" a no-op: the backend saw a key
   it already had and returned the first message instead of sending. */

const check = (name, ok, got) => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got ${JSON.stringify(got)}`); }
};

const key = (dv, attempt) => idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt(dv, attempt));

check('first send keeps the plain document version',
  key('04 Oct 2026', 0) === idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', '04 Oct 2026'), key('04 Oct 2026', 0));
check('a resend produces a different key',
  key('04 Oct 2026', 1) !== key('04 Oct 2026', 0), [key('04 Oct 2026', 0), key('04 Oct 2026', 1)]);
check('each further resend is distinct again',
  new Set([0, 1, 2, 3].map((a) => key('04 Oct 2026', a))).size === 4,
  [0, 1, 2, 3].map((a) => key('04 Oct 2026', a)));
check('a missing document version still yields a usable key',
  key(undefined, 1) !== key(undefined, 0) && /#1$/.test(key(undefined, 1)), key(undefined, 1));
check('an empty document version is not collapsed into the attempt marker',
  key('', 1) !== key('', 0), [key('', 0), key('', 1)]);
check('the two use cases never collide on the same attempt',
  idempotencyKeyFor('P0001_68', 'EPRESCRIPTION', docVersionForAttempt('04 Oct 2026', 1))
    !== idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1)));
check('different visits never collide on the same attempt',
  idempotencyKeyFor('P0001_68', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1))
    !== idempotencyKeyFor('P0001_69', 'PAYMENT_RECEIPT', docVersionForAttempt('04 Oct 2026', 1)));


/* ── Preview URL ─────────────────────────────────────────────────────────
   A real PDF in an iframe gets the browser's own viewer furniture — toolbar,
   zoom box, thumbnail rail — over what should just look like the document. */

const signed = 'https://s3.amazonaws.com/c/receipt.pdf?X-Amz-Signature=abc&X-Amz-Date=1';

check('a pdf preview suppresses the browser viewer chrome',
  /#toolbar=0/.test(previewSrc(signed, 'pdf')) && /navpanes=0/.test(previewSrc(signed, 'pdf')),
  previewSrc(signed, 'pdf'));
check('the suppression is a fragment, so the signed query is untouched',
  previewSrc(signed, 'pdf').split('#')[0] === signed, previewSrc(signed, 'pdf'));
check('html previews are left exactly as they were',
  previewSrc(signed, 'html') === signed, previewSrc(signed, 'html'));
check('an unknown format is left alone rather than guessed at',
  previewSrc(signed, undefined) === signed, previewSrc(signed, undefined));
check('a missing url stays missing instead of becoming "#toolbar=0"',
  previewSrc(null, 'pdf') === null, previewSrc(null, 'pdf'));


/* ── Which day a message was sent ────────────────────────────────────────
   Run under TZ=Asia/Kolkata. The log printed the UTC date beside the local
   time, so anything sent between midnight and 5:30am IST was dated to the
   previous day while the clock beside it read the right hour. */

// 2026-10-04 03:23 IST.
const lateNight = '2026-10-03T21:53:00.000Z';
const midday = '2026-10-04T07:30:00.000Z';

check('a small-hours message is dated by the clinic\'s day, not UTC',
  fmtDayOf(lateNight) === '4 Oct', fmtDayOf(lateNight));
check('the old slice is what produced the wrong day',
  fmtDay(lateNight.slice(0, 10)) === '3 Oct', fmtDay(lateNight.slice(0, 10)));
check('the date agrees with the clock shown next to it',
  fmtClock(lateNight) === '3:23 am', fmtClock(lateNight));
check('a daytime message is unaffected',
  fmtDayOf(midday) === '4 Oct', fmtDayOf(midday));
check('a date bucket (plain YYYY-MM-DD) still formats as that day',
  fmtDay('2026-10-04') === '4 Oct', fmtDay('2026-10-04'));
check('no timestamp renders as empty, not "Invalid Date"',
  fmtDayOf(null) === '' && fmtDayOf(undefined) === '' && fmtDayOf('') === '',
  [fmtDayOf(null), fmtDayOf(undefined), fmtDayOf('')]);
check('an unparseable timestamp renders as empty',
  fmtDayOf('not a date') === '', fmtDayOf('not a date'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
