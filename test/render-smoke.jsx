// Renders the two document pop-ups with realistic props. A temporal-dead-zone
// error, a bad hook order or a missing import throws here — none of which a
// Vite build or oxlint will tell you about.
import { renderToString } from 'react-dom/server';
import { PrescriptionSheet, ReceiptSheet } from '../src/views/Clinical.jsx';
import { WaProvider } from '../src/whatsapp/WaContext.jsx';
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
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
