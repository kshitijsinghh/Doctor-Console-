/**
 * Clinic Console — Google Sheets backend.
 *
 * Bound to a Google Sheet. Deploy as a Web App (Extensions > Apps Script,
 * paste this file, then Deploy > New deployment > Web app). See
 * ../apps-script/README.md for the full setup walkthrough.
 *
 * Sheets used (auto-created on first call if missing):
 *   Patients: patientId | mobile | name | age | gender | createdAt
 *   Visits:   visitId | patientId | visitNo | date | createdAt | done |
 *             chiefDescription | chiefComplaint | treatmentGroup | treatment |
 *             toothNumber | treatmentOther | treatmentCost | amountPaid |
 *             balanceDue | paymentMode | paymentStatus | treatmentStage |
 *             googleReviewTaken | nextAppointment | comments
 *   Settings: key | value   (rows: seq, upiQr)
 *
 * API (all responses are JSON):
 *   GET  ?action=list                      -> full snapshot
 *   POST { action: 'saveIntake', mobile, name, age, gender, date }
 *   POST { action: 'saveClinical', patientId, visitId, cform }
 *   POST { action: 'uploadQr', dataUrl, filename }
 *
 * POST bodies must be sent with Content-Type: text/plain from the browser
 * (not application/json) so the request stays a CORS "simple request" and
 * Apps Script doesn't 404 on the preflight OPTIONS it can't handle.
 */

var PATIENTS_SHEET = 'Patients';
var VISITS_SHEET = 'Visits';
var SETTINGS_SHEET = 'Settings';
var QR_FOLDER_NAME = 'Clinic Console QR';

var PATIENTS_HEADERS = ['patientId', 'mobile', 'name', 'age', 'gender', 'createdAt'];
var VISITS_HEADERS = [
  'visitId', 'patientId', 'visitNo', 'date', 'createdAt', 'done',
  'patientType', 'chiefDescription', 'chiefComplaint', 'treatmentGroup', 'treatment', 'toothNumber', 'treatmentOther',
  'treatmentCost', 'amountPaid', 'balanceDue',
  'paymentMode', 'paymentStatus', 'treatmentStage', 'googleReviewTaken',
  'nextAppointment', 'nextAppointmentTime', 'comments', 'calendarEventId',
];

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'list') return jsonOut_(action_list_());
    return jsonOut_({ ok: false, error: 'Unknown or missing action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action;
    if (action === 'saveIntake') return jsonOut_(action_saveIntake_(body));
    if (action === 'saveClinical') return jsonOut_(action_saveClinical_(body));
    if (action === 'uploadQr') return jsonOut_(action_uploadQr_(body));
    return jsonOut_({ ok: false, error: 'Unknown or missing action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- sheet plumbing ----------

function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet_(name, headers) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureColumns_(sh, headers) {
  var existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var set = {};
  existing.forEach(function (h) { set[String(h).trim()] = true; });
  for (var i = 0; i < headers.length; i++) {
    if (!set[headers[i]]) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(headers[i]);
    }
  }
}

function ensureAllSheets_() {
  ensureSheet_(PATIENTS_SHEET, PATIENTS_HEADERS);
  var visitsSh = ensureSheet_(VISITS_SHEET, VISITS_HEADERS);
  ensureColumns_(visitsSh, VISITS_HEADERS);
  var settings = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);
  var map = settingsMap_(settings);
  if (!('seq' in map)) settings.appendRow(['seq', 0]);
  if (!('upiQr' in map)) settings.appendRow(['upiQr', '']);
}

function headerIndex_(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = {};
  for (var i = 0; i < headers.length; i++) idx[String(headers[i]).trim()] = i;
  return idx;
}

function sheetRows_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { idx: headerIndex_(sh), rows: [] };
  var lastCol = sh.getLastColumn();
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return { idx: headerIndex_(sh), rows: values };
}

function rowToObj_(idx, row) {
  var o = {};
  for (var key in idx) o[key] = row[idx[key]];
  return o;
}

function settingsMap_(sh) {
  var data = sheetRows_(sh);
  var map = {};
  data.rows.forEach(function (r) {
    map[r[data.idx.key]] = r[data.idx.value];
  });
  return map;
}

function setSetting_(sh, key, value) {
  var data = sheetRows_(sh);
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i][data.idx.key] === key) {
      sh.getRange(i + 2, data.idx.value + 1).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

// ---------- read model (mirrors the prototype's db.patients/db.order shape) ----------

function readSnapshot_() {
  var patientsSh = ensureSheet_(PATIENTS_SHEET, PATIENTS_HEADERS);
  var visitsSh = ensureSheet_(VISITS_SHEET, VISITS_HEADERS);
  var settingsSh = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);

  var pData = sheetRows_(patientsSh);
  var vData = sheetRows_(visitsSh);
  var settings = settingsMap_(settingsSh);

  var patients = {};
  var order = [];
  pData.rows.forEach(function (row) {
    var p = rowToObj_(pData.idx, row);
    if (!p.patientId) return;
    patients[p.patientId] = {
      patientId: p.patientId,
      mobile: String(p.mobile || ''),
      name: p.name || '',
      age: p.age === '' ? '' : p.age,
      gender: p.gender || '',
      visits: [],
    };
    order.push(p.patientId);
  });

  vData.rows.forEach(function (row) {
    var v = rowToObj_(vData.idx, row);
    if (!v.visitId || !patients[v.patientId]) return;
    patients[v.patientId].visits.push({
      visitId: v.visitId,
      no: v.visitNo,
      date: v.date instanceof Date ? formatDate_(v.date) : String(v.date || ''),
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt || ''),
      done: v.done === true || v.done === 'TRUE' || v.done === 'true',
      clinical: {
        patientType: v.patientType || '',
        chiefComplaint: v.chiefComplaint || '',
        chiefDescription: v.chiefDescription || '',
        treatmentGroup: v.treatmentGroup || '',
        treatment: v.treatment || '',
        toothNumber: v.toothNumber instanceof Date ? '' : String(v.toothNumber || ''),
        treatmentOther: v.treatmentOther || '',
        treatmentCost: v.treatmentCost === '' ? '' : String(v.treatmentCost),
        amountPaid: v.amountPaid === '' ? '' : String(v.amountPaid),
        balanceDue: v.balanceDue === '' ? '' : String(v.balanceDue),
        paymentMode: v.paymentMode || '',
        paymentStatus: v.paymentStatus || '',
        treatmentStage: v.treatmentStage || '',
        googleReviewTaken: v.googleReviewTaken || '',
        nextAppointment: v.nextAppointment instanceof Date ? formatDate_(v.nextAppointment) : String(v.nextAppointment || ''),
        nextAppointmentTime: v.nextAppointmentTime instanceof Date ? Utilities.formatDate(v.nextAppointmentTime, Session.getScriptTimeZone(), 'HH:mm') : String(v.nextAppointmentTime || ''),
        comments: v.comments || '',
      },
    });
  });

  for (var pid in patients) {
    patients[pid].visits.sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
  }

  return {
    ok: true,
    patients: patients,
    order: order,
    seq: Number(settings.seq || 0),
    upiQr: settings.upiQr || '',
  };
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Etc/UTC', 'yyyy-MM-dd');
}

// ---------- Google Calendar integration ----------

function getClinicCalendar_() {
  var settingsSh = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);
  var settings = settingsMap_(settingsSh);
  var calId = settings.calendarId || '';
  if (calId) {
    try {
      var cal = CalendarApp.getCalendarById(calId);
      if (cal) return cal;
    } catch (e) {}
  }
  var cal = CalendarApp.createCalendar('PatientPad Appointments');
  setSetting_(settingsSh, 'calendarId', cal.getId());
  return cal;
}

function syncCalendarEvent_(visitId, patientName, nextAppt, nextApptTime, treatment, existingEventId) {
  var settingsSh = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);
  var settings = settingsMap_(settingsSh);
  var cal = getClinicCalendar_();
  var guests = (settings.allowedEmails || '').split(',').map(function (e) { return e.trim(); }).filter(Boolean);

  if (!nextAppt) {
    if (existingEventId) {
      try { var ev = cal.getEventById(existingEventId); if (ev) ev.deleteEvent(); } catch (e) {}
    }
    return '';
  }

  var h = 9, m = 0;
  if (nextApptTime) {
    var p = nextApptTime.split(':');
    h = parseInt(p[0], 10) || 9;
    m = parseInt(p[1], 10) || 0;
  }
  var start = new Date(nextAppt + 'T' + ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':00');
  var end = new Date(start.getTime() + 30 * 60000);
  var title = patientName + ' — ' + (treatment || 'Appointment');
  var desc = 'Visit: ' + visitId + '\nPatient: ' + patientName + '\nTreatment: ' + (treatment || '—');

  if (existingEventId) {
    try {
      var ev = cal.getEventById(existingEventId);
      if (ev) {
        ev.setTitle(title);
        ev.setDescription(desc);
        ev.setTime(start, end);
        return existingEventId;
      }
    } catch (e) {}
  }

  var opts = { description: desc };
  if (guests.length) { opts.guests = guests.join(','); opts.sendInvites = true; }
  var ev = cal.createEvent(title, start, end, opts);
  return ev.getId();
}

// ---------- actions ----------

function action_list_() {
  ensureAllSheets_();
  return readSnapshot_();
}

function normMobile_(m) {
  return String(m || '').replace(/\D/g, '');
}

function action_saveIntake_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureAllSheets_();
    var mobile = normMobile_(body.mobile);
    var name = String(body.name || '').trim();
    var age = body.age;
    var gender = String(body.gender || '');
    var date = String(body.date || '');
    if (!mobile) return { ok: false, error: 'Mobile number is required.' };
    if (!name || String(age).trim() === '' || !gender || !date) {
      return { ok: false, error: 'Name, age, gender and date are required.' };
    }

    var patientsSh = ensureSheet_(PATIENTS_SHEET, PATIENTS_HEADERS);
    var visitsSh = ensureSheet_(VISITS_SHEET, VISITS_HEADERS);
    var settingsSh = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);

    var pData = sheetRows_(patientsSh);
    var patientId = null;
    var rowIdx = -1;
    var nameToMatch = name.toLowerCase();
    for (var i = 0; i < pData.rows.length; i++) {
      if (String(pData.rows[i][pData.idx.mobile]) === mobile &&
          String(pData.rows[i][pData.idx.name] || '').trim().toLowerCase() === nameToMatch) {
        patientId = pData.rows[i][pData.idx.patientId];
        rowIdx = i;
        break;
      }
    }

    if (patientId) {
      var r = rowIdx + 2;
      patientsSh.getRange(r, pData.idx.age + 1).setValue(age);
      patientsSh.getRange(r, pData.idx.gender + 1).setValue(gender);
    } else {
      var settings = settingsMap_(settingsSh);
      var seq = Number(settings.seq || 0) + 1;
      patientId = 'P' + ('0000' + seq).slice(-4);
      patientsSh.appendRow([patientId, mobile, name, age, gender, new Date().toISOString()]);
      setSetting_(settingsSh, 'seq', seq);
    }

    var vData = sheetRows_(visitsSh);
    var visitNo = 1;
    vData.rows.forEach(function (row) {
      if (row[vData.idx.patientId] === patientId) visitNo++;
    });
    var visitId = patientId + '_' + visitNo;
    var blank = {};
    VISITS_HEADERS.forEach(function (h) { blank[h] = ''; });
    var newRow = VISITS_HEADERS.map(function (h) {
      if (h === 'visitId') return visitId;
      if (h === 'patientId') return patientId;
      if (h === 'visitNo') return visitNo;
      if (h === 'date') return date;
      if (h === 'createdAt') return new Date().toISOString();
      if (h === 'done') return false;
      return '';
    });
    visitsSh.appendRow(newRow);

    var snap = readSnapshot_();
    snap.patientId = patientId;
    snap.visitId = visitId;
    return snap;
  } finally {
    lock.releaseLock();
  }
}

function action_saveClinical_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureAllSheets_();
    var patientId = String(body.patientId || '');
    var visitId = String(body.visitId || '');
    var cform = body.cform || {};
    if (!patientId || !visitId) return { ok: false, error: 'Missing patient or visit id.' };

    var visitsSh = ensureSheet_(VISITS_SHEET, VISITS_HEADERS);
    var vData = sheetRows_(visitsSh);

    var num = function (x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; };
    var targetRow = -1;
    var otherVisits = [];
    for (var i = 0; i < vData.rows.length; i++) {
      var row = vData.rows[i];
      if (row[vData.idx.patientId] !== patientId) continue;
      if (row[vData.idx.visitId] === visitId) { targetRow = i; continue; }
      otherVisits.push({ visitNo: num(row[vData.idx.visitNo]), cost: num(row[vData.idx.treatmentCost]), paid: num(row[vData.idx.amountPaid]) });
    }
    if (targetRow === -1) return { ok: false, error: 'Visit not found: ' + visitId };
    otherVisits.sort(function (a, b) { return a.visitNo - b.visitNo; });
    var prevPending = 0;
    otherVisits.forEach(function (v) {
      prevPending += v.cost - v.paid;
      if (prevPending < 0) prevPending = 0;
    });

    var amountToCollect = num(cform.treatmentCost) + prevPending;
    var remaining = amountToCollect - num(cform.amountPaid);
    var balanceDue = remaining;
    var paymentStatus = remaining <= 0 ? 'Fully Paid' : (num(cform.amountPaid) > 0 ? 'Partially paid' : 'Not paid');
    var r = targetRow + 2;
    var fields = {
      patientType: cform.patientType || '',
      chiefComplaint: cform.chiefComplaint || '',
      chiefDescription: cform.chiefDescription || '',
      treatmentGroup: cform.treatmentGroup || '',
      treatment: cform.treatment || '',
      toothNumber: cform.toothNumber || '',
      treatmentOther: cform.treatmentOther || '',
      treatmentCost: cform.treatmentCost || '',
      amountPaid: cform.amountPaid || '',
      balanceDue: String(balanceDue),
      paymentMode: cform.paymentMode || '',
      paymentStatus: paymentStatus,
      treatmentStage: cform.treatmentStage || '',
      googleReviewTaken: cform.googleReviewTaken || '',
      nextAppointment: cform.nextAppointment || '',
      nextAppointmentTime: cform.nextAppointmentTime || '',
      comments: cform.comments || '',
      done: true,
    };
    for (var key in fields) {
      var cell = visitsSh.getRange(r, vData.idx[key] + 1);
      if (key === 'toothNumber' || key === 'nextAppointmentTime') cell.setNumberFormat('@');
      cell.setValue(fields[key]);
    }

    try {
      var shouldHaveEvent = fields.treatmentStage === 'In Progress' && fields.nextAppointment;
      var existingEventId = (vData.idx.calendarEventId !== undefined)
        ? String(vData.rows[targetRow][vData.idx.calendarEventId] || '') : '';

      if (shouldHaveEvent || existingEventId) {
        var patientsSh = ensureSheet_(PATIENTS_SHEET, PATIENTS_HEADERS);
        var pData = sheetRows_(patientsSh);
        var patientName = '';
        for (var pi = 0; pi < pData.rows.length; pi++) {
          if (pData.rows[pi][pData.idx.patientId] === patientId) {
            patientName = pData.rows[pi][pData.idx.name] || '';
            break;
          }
        }
        var newEventId = syncCalendarEvent_(
          visitId, patientName,
          shouldHaveEvent ? fields.nextAppointment : '',
          shouldHaveEvent ? fields.nextAppointmentTime : '',
          fields.treatment, existingEventId
        );
        if (vData.idx.calendarEventId !== undefined) {
          visitsSh.getRange(r, vData.idx.calendarEventId + 1).setValue(newEventId);
        }
      }
    } catch (calErr) {
      // Calendar sync is non-critical — don't fail the save
    }

    return readSnapshot_();
  } finally {
    lock.releaseLock();
  }
}

function action_uploadQr_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureAllSheets_();
    var dataUrl = String(body.dataUrl || '');
    var m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return { ok: false, error: 'Invalid image data.' };
    var mimeType = m[1];
    var bytes = Utilities.base64Decode(m[2]);
    var filename = String(body.filename || 'upi-qr');

    var folders = DriveApp.getFoldersByName(QR_FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(QR_FOLDER_NAME);

    var blob = Utilities.newBlob(bytes, mimeType, filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';

    var settingsSh = ensureSheet_(SETTINGS_SHEET, ['key', 'value']);
    setSetting_(settingsSh, 'upiQr', url);

    return readSnapshot_();
  } finally {
    lock.releaseLock();
  }
}
