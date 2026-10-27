// Consent forms: the pure rules, and the one property that makes this safe
// to deploy before the backend exists — a clinic with no templates sees no
// consent UI at all.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://clinic.test/', pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch { /* provided */ }
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.fetch = async () => { throw new Error('no network in this test'); };

const { createRoot } = await import('react-dom/client');
const { act, createElement: h } = await import('react');
const M = await import('../src/consents/consentModel.js');
const ConsentBar = (await import('../src/consents/ConsentBar.jsx')).default;
const { ConsentsContext } = await import('../src/consents/ConsentsContext.jsx');

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('  ✓', n); }
  else { fail++; console.log('  ✗', n, got === undefined ? '' : String(JSON.stringify(got)).slice(0, 200)); }
};

const NOW = Date.parse('2026-10-27T10:00:00.000Z');
const iso = (offsetMin) => new Date(NOW + offsetMin * 60000).toISOString();

const TPL = {
  templateId: 't_ext',
  title: 'Tooth extraction consent',
  note: 'Linked to Extraction',
  paras: [
    'I, {{patient_name}} ({{age}}, {{gender}}), agree to {{procedure}} at {{clinic}}, to be done by {{doctor}} on {{date}}.',
    'The doctor has explained the options.',
  ],
  risks: ['Pain or swelling for a few days'],
  linkedTreatments: ['Extraction'],
  active: true,
};
const TPL2 = { templateId: 't_la', title: 'Local anaesthesia consent', note: 'Numbing injection', paras: ['I agree to {{procedure}}.'], risks: [], linkedTreatments: [], active: true };

const consent = (o = {}) => ({
  consentId: 'c1', templateId: 't_ext', visitId: 'P1_1',
  status: 'sent', sentAt: iso(-30), expiresAt: iso(+450), ...o,
});

/* ══ effectiveStatus ════════════════════════════════════════════════════ */
check('a fresh link reads as sent', M.effectiveStatus(consent(), NOW) === 'sent');
check('an opened link reads as opened',
  M.effectiveStatus(consent({ status: 'opened', openedAt: iso(-10) }), NOW) === 'opened');
// Nothing writes to the row when the clock runs out, so this has to be derived.
check('a link past its expiry reads as expired without anything writing to it',
  M.effectiveStatus(consent({ expiresAt: iso(-1) }), NOW) === 'expired',
  M.effectiveStatus(consent({ expiresAt: iso(-1) }), NOW));
check('...and an opened one too',
  M.effectiveStatus(consent({ status: 'opened', expiresAt: iso(-1) }), NOW) === 'expired');
// A signed consent is finished. Expiry must never reach back and undo it.
check('a signed consent is never expired by the clock',
  M.effectiveStatus(consent({ status: 'signed', signedAt: iso(-5), expiresAt: iso(-1) }), NOW) === 'signed');
check('a cancelled link stays cancelled', M.effectiveStatus(consent({ status: 'cancelled', expiresAt: iso(-1) }), NOW) === 'cancelled');
check('a consent with no expiry does not expire', M.effectiveStatus(consent({ expiresAt: null }), NOW) === 'sent');
check('an unreadable expiry does not expire it', M.effectiveStatus(consent({ expiresAt: 'soon' }), NOW) === 'sent');
check('a missing consent is null, not a throw', M.effectiveStatus(null, NOW) === null);

/* ══ what blocks a second send ══════════════════════════════════════════ */
check('a live consent blocks the same template', !!M.activeFor([consent()], 't_ext', NOW));
check('a signed consent blocks it too', !!M.activeFor([consent({ status: 'signed' })], 't_ext', NOW));
// These are the two that must NOT block — otherwise a lapsed form can never
// be sent again and the doctor is stuck.
check('an expired consent does not block', !M.activeFor([consent({ expiresAt: iso(-1) })], 't_ext', NOW));
check('a cancelled consent does not block', !M.activeFor([consent({ status: 'cancelled' })], 't_ext', NOW));
check('another template is unaffected', !M.activeFor([consent()], 't_la', NOW));

/* ══ rendering ══════════════════════════════════════════════════════════ */
const VALS = M.placeholderVals({
  patient: { name: 'Ananya Rao', age: '32', gender: 'Female' },
  procedure: 'extraction of tooth 36', doctor: 'Dr. Surmayee', clinic: 'Surmayee Dental', date: '27 October 2026',
});
const segs = M.segments('I, {{patient_name}}, agree.', VALS);
check('a placeholder becomes a filled segment',
  segs.length === 3 && segs[1].filled === true && segs[1].text === 'Ananya Rao', segs);
check('...and the surrounding text is not marked filled', segs[0].filled === false && segs[2].filled === false);
const plain = M.renderPlainText(TPL, VALS);
check('plain text carries the filled values', /Ananya Rao/.test(plain) && /extraction of tooth 36/.test(plain), plain.slice(0, 120));
// The snapshot is what gets signed, so it must never contain raw handlebars.
check('...and no unreplaced handlebars survive', !/\{\{/.test(plain), plain);
check('...and the risks are included', /Pain or swelling/.test(plain));
check('an unknown placeholder renders as nothing, not as {{junk}}',
  !/\{\{/.test(M.renderPlainText({ paras: ['A {{nope}} B'] }, VALS)),
  M.renderPlainText({ paras: ['A {{nope}} B'] }, VALS));

check('nothing is missing when the visit fills everything', M.missingPlaceholders(TPL, VALS).length === 0, M.missingPlaceholders(TPL, VALS));
const noProc = { ...VALS, procedure: '' };
check('a blank procedure is reported as missing',
  M.missingPlaceholders(TPL, noProc).includes('procedure'), M.missingPlaceholders(TPL, noProc));

/* ══ the suggestion row ═════════════════════════════════════════════════ */
const sug = (o = {}) => M.suggestionFor({ templates: [TPL, TPL2], consents: [], treatments: ['Extraction'], dismissed: [], now: NOW, ...o });
check('a linked treatment suggests its template', sug() && sug().template.templateId === 't_ext', sug());
check('...naming the treatment that triggered it', sug().treatment === 'Extraction', sug().treatment);
check('an unrelated treatment suggests nothing', sug({ treatments: ['Scaling'] }) === null);
check('no treatment selected suggests nothing', sug({ treatments: [] }) === null);
check('matching ignores case', !!sug({ treatments: ['extraction'] }));
check('a form already sent is not suggested again', sug({ consents: [consent()] }) === null);
check('a signed form is not suggested again', sug({ consents: [consent({ status: 'signed' })] }) === null);
// An expired one SHOULD come back: the patient never signed it.
check('an expired form is suggested again', !!sug({ consents: [consent({ expiresAt: iso(-1) })] }));
check('"Not needed" hides it for this visit', sug({ dismissed: ['t_ext'] }) === null);
check('an inactive template is never suggested',
  M.suggestionFor({ templates: [{ ...TPL, active: false }], consents: [], treatments: ['Extraction'], now: NOW }) === null);

/* ══ the send sheet ═════════════════════════════════════════════════════ */
let rows = M.sheetRows({ templates: [TPL, TPL2], consents: [consent()], suggestedIds: ['t_la'], now: NOW });
check('a template with a live consent is disabled', rows[0].disabled === true, rows[0]);
check('...and says why', rows[0].note === 'Sent — waiting for signature', rows[0].note);
check('a signed one says so instead',
  M.sheetRows({ templates: [TPL], consents: [consent({ status: 'signed' })], now: NOW })[0].note === 'Already signed for this visit');
check('a free template keeps its own note', rows[1].disabled === false && rows[1].note === 'Numbing injection', rows[1]);
check('the suggested one is flagged', rows[1].suggested === true);
check('an inactive template is not offered at all',
  M.sheetRows({ templates: [{ ...TPL, active: false }], consents: [], now: NOW }).length === 0);

/* ══ rows and chips ═════════════════════════════════════════════════════ */
const byId = { t_ext: TPL, t_la: TPL2 };
const list = [
  consent({ consentId: 'a', sentAt: iso(-120) }),
  consent({ consentId: 'b', templateId: 't_la', sentAt: iso(-10), status: 'signed', signedAt: iso(-5) }),
];
const r = M.consentRows(list, byId, NOW, { time: () => '3:30 pm', when: () => 'Today, 3:35 pm' });
check('rows are newest first', r[0].id === 'b', r.map((x) => x.id));
check('a row takes its title from the template', r[0].title === 'Local anaesthesia consent', r[0].title);
check('a signed row offers View PDF and nothing destructive',
  r[0].can.view === true && r[0].can.resend === false && r[0].can.cancel === false, r[0].can);
check('a live row offers Resend and Cancel but no PDF',
  r[1].can.resend === true && r[1].can.cancel === true && r[1].can.view === false, r[1].can);
check('an expired row offers Send again only',
  M.actionsFor(consent({ expiresAt: iso(-1) }), NOW).sendAgain === true
  && M.actionsFor(consent({ expiresAt: iso(-1) }), NOW).resend === false);

const chips = M.summaryChips(list, NOW);
check('chips count signed and waiting separately',
  chips.length === 2 && chips[0].label === '✓ 1 signed' && chips[1].label === '1 waiting', chips);
check('nothing sent means no chips', M.summaryChips([], NOW).length === 0);

/* ══ Mounted: the fail-closed property ══════════════════════════════════ */
let container, root;
function mount(ctx, props = {}) {
  container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  root = createRoot(container);
  const value = {
    templates: [], templatesById: {}, consents: [], loaded: true,
    enabled: (ctx.templates || []).length > 0, reloadConsents: async () => {}, applyConsent: () => {},
    ...ctx,
  };
  act(() => {
    root.render(h(ConsentsContext.Provider, { value },
      h(ConsentBar, {
        visit: 'P1_1',
        patient: { patientId: 'P1', name: 'Ananya Rao', mobile: '+919876543210' },
        treatments: [], doctorName: 'Dr. S', clinicName: 'Test Dental', ...props,
      })));
  });
  return container;
}
const unmount = () => { act(() => root.unmount()); container.remove(); };

// This is what makes the branch safe to deploy before the backend exists:
// no templates means no consent UI, and the form looks exactly as it did.
mount({ templates: [], enabled: false });
check('with no templates the bar renders NOTHING', container.textContent === '', container.textContent.slice(0, 80));
check('...not even an empty wrapper', container.children.length === 0, container.innerHTML.slice(0, 80));
unmount();

mount({ templates: [TPL, TPL2], templatesById: byId, enabled: true, consents: [] });
check('with templates the bar appears', /Consent forms/.test(container.textContent));
check('...and says nothing has been sent', /None sent for this visit/.test(container.textContent));
check('...and offers to send one', /Send consent form/.test(container.textContent));
check('...and starts collapsed',
  container.querySelector('[aria-expanded]').getAttribute('aria-expanded') === 'false');
unmount();

mount({ templates: [TPL, TPL2], templatesById: byId, enabled: true, consents: list });
check('chips show once forms exist', /1 signed/.test(container.textContent) && /1 waiting/.test(container.textContent));
check('the sent forms are hidden until expanded', !/Local anaesthesia consent/.test(container.textContent));
act(() => { container.querySelector('[aria-expanded]').dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
check('expanding lists them', /Local anaesthesia consent/.test(container.textContent) && /Tooth extraction consent/.test(container.textContent));
check('...the signed one offers View PDF', /View PDF/.test(container.textContent));
check('...and the live one offers Cancel link', /Cancel link/.test(container.textContent));
unmount();

// The suggestion must show even while the bar is collapsed.
mount({ templates: [TPL, TPL2], templatesById: byId, enabled: true, consents: [] }, { treatments: ['Extraction'] });
check('a linked treatment surfaces the suggestion while collapsed',
  /Suggested for/.test(container.textContent) && /Tooth extraction consent/.test(container.textContent),
  container.textContent.slice(0, 200));
const notNeeded = [...container.querySelectorAll('button')].find((b) => /Not needed/.test(b.textContent));
act(() => { notNeeded.dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
check('"Not needed" dismisses it', !/Suggested for/.test(container.textContent));
unmount();

// A past visit is read-only: nothing that writes may be offered.
mount({ templates: [TPL], templatesById: byId, enabled: true, consents: list }, { readOnly: true });
check('a read-only visit still shows the bar', /Consent forms/.test(container.textContent));
check('...but offers no Send button', !/Send consent form/.test(container.textContent));
act(() => { container.querySelector('[aria-expanded]').dispatchEvent(new dom.window.Event('click', { bubbles: true })); });
check('...and no Cancel link', !/Cancel link/.test(container.textContent));
check('...while View PDF stays available', /View PDF/.test(container.textContent));
unmount();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
