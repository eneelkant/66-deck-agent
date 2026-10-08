"use strict";

// V.1_30: fixes from the 40-slide FP&A deck (credentials in disguise, next steps, repeated topics, empty slides,
// client figures as general facts, Title Case, section dividers and a numbered agenda for long decks).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
function loadAll() {
  const props = {};
  const sb = {
    console, Math, JSON, Date, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; }, getProperties: () => props, deleteProperty() {} }), getUserProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {} }), getScriptCache: () => ({ get: () => null, getAll: () => ({}), putAll() {}, removeAll() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  vm.createContext(sb);
  ["src/Engine.gs", "src/Brand.gs", "src/Reference.gs", "src/Code.gs"].forEach((f) => vm.runInContext(read(f), sb, { filename: f }));
  vm.runInContext("this.ENGINE = ENGINE;", sb);
  return sb;
}
const run = (sb, code) => JSON.parse(vm.runInContext(code, sb));

test("the FP&A deck's disguised credentials, next steps and repeated topics are caught", () => {
  const sb = loadAll();
  sb.T = JSON.stringify(["Google Cloud: the intelligent finance backbone", "The integrated Google Cloud data platform", "66degrees: your trusted AI transformation partner",
    "Our holistic approach to AI transformation", "Key pillars of our delivery methodology", "Our deep expertise across Google Cloud & AI",
    "Managing risks in AI implementation", "Ensuring AI model reliability and explainability", "Change management: people, process, technology",
    "Addressing barriers to AI adoption success", "Building Trust and Adoption for AI in FP&A", "Measuring AI value: process efficiency KPIs",
    "Measuring AI value: decision quality KPIs", "Measuring AI value: risk & strategic KPIs", "Streamlining data ingestion for FP&A on Google Cloud",
    "Gordon Food Service: unified data for analytics", "Next steps: your FP&A transformation journey"]);
  const R = run(sb, `var T = JSON.parse(this.T);
    var sl = T.map(function (t) { return { type: /Gordon/.test(t) ? 'case_study' : 'cards', title: t }; });
    JSON.stringify(outlineChecks_(sl, 'Modernizing FP&A with Google Cloud and AI: challenges, data platform, AI use cases, how we deliver, roadmap, risks, security and compliance, change management, KPIs, client result', 40).map(function (i) { return T[i]; }));`);
  ["66degrees: your trusted AI transformation partner", "Key pillars of our delivery methodology", "Our deep expertise across Google Cloud & AI",
    "Measuring AI value: decision quality KPIs", "Measuring AI value: risk & strategic KPIs", "Next steps: your FP&A transformation journey"].forEach((t) => assert.ok(R.includes(t), "removes: " + t));
  assert.ok(!R.includes("Gordon Food Service: unified data for analytics"), "the case study stays");
  assert.ok(!R.includes("Our holistic approach to AI transformation"), "one delivery slide stays");
  assert.ok(R.includes("The integrated Google Cloud data platform") || R.includes("Streamlining data ingestion for FP&A on Google Cloud"), "platform repeats are cut");
});

test("Title Case with small words and hyphens becomes sentence case", () => {
  const sb = loadAll();
  const R = run(sb, `JSON.stringify([sentenceCase_('Building Trust and Adoption for AI in FP&A', 2), sentenceCase_('Transforming Finance for the Future', 2),
    sentenceCase_('Unlock Strategic Value with AI-Powered FP&A', 2), sentenceCase_('AI-Powered FP&A use cases', 2), sentenceCase_('Modernizing FP&A with Google Cloud and AI', 2)]);`);
  assert.deepEqual(R, ["Building trust and adoption for AI in FP&A", "Transforming finance for the future", "Unlock strategic value with AI-powered FP&A",
    "AI-powered FP&A use cases", "Modernizing FP&A with Google Cloud and AI"]);
});

test("empty slides get their missing content; client figures stay on case studies", () => {
  const sb = loadAll();
  const R = run(sb, `
    callGeminiJSON = function (parts) { var list = JSON.parse(parts[0].text.split('\\n').pop());
      return { fixes: list.map(function (x) { var a = []; for (var k = 0; k < x.add; k++) a.push(x.kind === 'bullets' ? 'Label ' + k + ': text' : x.kind === 'kpis' ? { value: (20 + k) + '%', label: 'Target: faster close ' + k, text: 't' } : { title: 'Point ' + k, text: 'Text ' + k }); return { id: x.id, add: a }; }) }; };
    var plan = { slides: [
      { type: 'cards', title: 'Impact of AI: efficiency and decision quality', items: [{ title: 'FP&A leaders expect AI impact', text: 'x' }] },
      { type: 'statement', title: "Leveraging Google's AI innovations", statement: 'Secure and reliable AI for finance' },
      { type: 'stats', title: 'Delivering tangible business impact', items: [{ value: '$10M+', label: 'Annual savings from reduced data center costs' }, { value: '12%', label: 'Target: faster planning cycles' }, { value: '3x', label: 'Faster reporting' }] }
    ] };
    var ctx = { brand: { name: '66degrees' }, apiKey: 'x', log: [], userPrompt: 'FP&A', lib: { companyFacts: [{ category: 'case_study', statement: 'Client: Wayfair. $10M+ in annual savings from reduced data center costs.' }] } };
    var removed = clientNumbersOnCasesOnly_(plan.slides, ctx);
    fillThinSlides_(plan, ctx);
    JSON.stringify({ removed: removed, cards: plan.slides[0].items.length, points: (plan.slides[1].points || []).length, stats: plan.slides[2].items.map(function (i) { return i.value; }) });`);
  assert.equal(R.removed, 1);
  assert.equal(R.cards, 3);
  assert.equal(R.points, 3);
  assert.ok(!R.stats.includes("$10M+"));
  assert.equal(R.stats.length, 3, "the KPI slide is topped up to 3 figures");
});

test("designs: section divider shows its description, 4 dark-band cards are 2 x 2, second statement design, case boxes sized to content", () => {
  const sb = loadAll();
  const R = run(sb, `
    var r = function (spec) { return ENGINE.render({ slides: [spec] }, {})[0]; };
    var sec = r({ type: 'section', number: '02', title: 'Building a unified data foundation', lead: 'One governed platform for every finance number' });
    var it = function (t) { return { title: t, text: 'A concrete line of text about ' + t + '.' }; };
    var band = r({ type: 'cards', title: 'Key pillars', items: [it('A'), it('B'), it('C'), it('D')], reference: { tag: '66D_LAYOUT_CARDS_017' } });
    var cardsX = band.els.filter(function (e) { return e.t === 'rect' && e.fill === ENGINE.TOKENS.white && e.w > 100; }).map(function (e) { return Math.round(e.x); });
    var st = r({ type: 'statement', title: 'Why now', statement: 'Finance teams must move from reporting to foresight.', points: [it('Speed'), it('Accuracy'), it('Focus')], reference: { tag: 'ENGINE_STATEMENT_BAND' } });
    var cs = r({ type: 'case_study', title: 'Gordon Food Service: unified data', challenge: 'Fragmented data across SAP, Oracle and Dynamics.', solution: ['Built an EDW on Google Cloud.', 'Unified the sources.'], results: [{ value: '40%', label: 'Lower operating costs' }], reference: { tag: '66D_LAYOUT_CASE_STUDY_004' } });
    var box = cs.els.filter(function (e) { return e.t === 'rect' && e.fill === ENGINE.TOKENS.blue; })[0];
    JSON.stringify({ lead: sec.els.some(function (e) { return e.t === 'text' && /governed platform/.test(e.text); }), cols: Array.from(new Set(cardsX)).length,
      band: st.els.some(function (e) { return e.t === 'rect' && e.fill === ENGINE.TOKENS.blue && e.w > 600; }), caseH: box.h });`);
  assert.ok(R.lead);
  assert.equal(R.cols, 2);
  assert.ok(R.band);
  assert.ok(R.caseH < 286, "case study boxes are not stretched to the bottom");
});

test("long decks: dividers per section, numbered agenda with slide ranges", () => {
  const code = read("src/Code.gs");
  assert.match(code, /withDividers\.push\(\{ type: 'section'/);
  assert.match(code, /'slides ' \+ first \+ '–'/);
  assert.match(code, /referenceForTag_\(ctx\.lib, '66D_LAYOUT_AGENDA_002'\)/);
});
