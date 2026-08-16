// Static dropdown option lists, ported verbatim from Clinic Console.dc.html
// (already deduplicated there from the raw lists the clinic provided).

export const GENDERS = ['Male', 'Female', 'Others'];

export const CHIEF_COMPLAINTS = [
  'General Check-up', 'Stains / Deposits', 'Decayed Tooth', 'Dislodged Filling',
  'Dislodged Bridge', 'Dislodged Crown / Cap', 'Dislodged Crown / Cap, Dislodged Filling',
  'Loose Tooth', 'Sensitivity', 'Bleeding Gums', 'Teeth Grinding', 'Broken Tooth',
  'Food Lodgement', 'Pain', 'Pain, Swelling', 'Swelling', 'Ulcer / Burning Sensation',
  'TMJ Pain / Difficulty Opening Mouth', 'Wisdom Tooth Pain', 'Other',
];

export const TREATMENT_GROUPS = [
  'Preventive', 'Restorative', 'Prosthodontics', 'Consultation', 'Oral Surgery',
  'Endodontics', 'Pain', 'Paediatric Dentistry', 'Implantology', 'Orthodontist', 'Periodontics', 'Other',
];

export const TREATMENTS = [
  'Scaling & Polishing', 'Composite Restoration', 'Bridge', 'Consultation',
  'GIC Restoration', 'Extraction', 'Irrigation', 'RCT', 'Post & Core',
  'Crown Preparation', 'Crown', 'BMP', 'Access Opening', 'Crown Recementation',
  'Obturation', 'ICM', 'Core Build-up', 'Suture Removal', 'WL',
  'Surgical Extraction', 'Bridge Removal', 'Impression', 'Night Guard Delivery',
  'Temporary Restoration', 'Endocrown Preparation', 'Implant',
  'Crown Removal', 'Re-RCT', 'Braces', 'Aligners', 'Other',
];

export const TOOTH_NUMBERS = [
  '1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8',
  '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8',
  '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8',
  '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7', '4-8',
];

export const TOOTH_NUMBERS_KID = [
  '5-1', '5-2', '5-3', '5-4', '5-5',
  '6-1', '6-2', '6-3', '6-4', '6-5',
  '7-1', '7-2', '7-3', '7-4', '7-5',
  '8-1', '8-2', '8-3', '8-4', '8-5',
];

export const PATIENT_TYPES = ['Adult', 'Kid'];

export const PAYMENT_MODES = ['UPI', 'Debit Card', 'Credit Card'];
export const YES_NO = ['Yes', 'No'];
export const TREATMENT_STAGES = ['Complete', 'In Progress'];
