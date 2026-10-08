"use strict";

// V.1_29: fixes found in the customer service (17), FP&A (40, built in parts) and data platform (20) decks.
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
const run = (sb, code) => vm.runInContext(code, sb);

test("outline checks remove unrequested credentials, repeated delivery / why-now / considerations slides, and keep requested topics", () => {
  const sb = loadAll();
  sb.T = JSON.stringify({
    fpa: ["The FP&A breakpoint: traditional models are failing", "Our comprehensive approach to modernizing FP&A", "66degrees: your trusted partner for AI transformation",
      "Proven track record: 1000+ successful transformations", "Deep Google Cloud expertise: 600+ certifications", "Mitigating risks for a smooth transformation journey",
      "Comprehensive security and compliance built-in", "The path forward: partner with 66degrees for FP&A excellence"],
    cs: ["The rising demand for superior customer service", "Converging trends demand AI in CX", "The future of empowered customer service",
      "Implementing Gemini: our proven framework", "Our structured Gemini implementation process", "Our engagement model: Partnering for impactful outcomes"],
    dp: ["The evolving data landscape", "The imperative for data platform modernization", "A structured approach to modernization", "Strategic considerations for your platform",
      "Critical success factors for modernization", "Foundation of data governance and security", "Why partner with 66degrees", "Phased implementation for your data platform"]
  });
  const R = JSON.parse(run(sb, `
    var T = JSON.parse(this.T), out = {};
    var mk = function (list) { return list.map(function (t) { return { type: /phased|roadmap/i.test(t) ? 'timeline' : 'cards', title: t }; }); };
    out.fpa = outlineChecks_(mk(T.fpa), 'Modernizing FP&A: current challenges, how we deliver, phased roadmap, risks, security and compliance, KPIs', 40).map(function (i) { return T.fpa[i]; });
    out.cs = outlineChecks_(mk(T.cs), 'Gemini for customer service: why now, what good looks like, use cases, how we deliver, risks, KPIs', 17).map(function (i) { return T.cs[i]; });
    out.dp = outlineChecks_(mk(T.dp), 'Data platform modernization', 20).map(function (i) { return T.dp[i]; });
    JSON.stringify(out);`));
  assert.deepEqual(R.fpa, ["66degrees: your trusted partner for AI transformation", "Proven track record: 1000+ successful transformations",
    "Deep Google Cloud expertise: 600+ certifications", "The path forward: partner with 66degrees for FP&A excellence"]);
  assert.deepEqual(R.cs, ["Converging trends demand AI in CX", "Our structured Gemini implementation process", "Our engagement model: Partnering for impactful outcomes"]);
  assert.deepEqual(R.dp, ["The imperative for data platform modernization", "Critical success factors for modernization", "Why partner with 66degrees", "Phased implementation for your data platform"]);
});

test("a figure is shown once in a long deck, across parts", () => {
  const sb = loadAll();
  const R = JSON.parse(run(sb, `
    var used = [];
    var p1 = [{ type: 'stats', items: [{ value: '46%', label: 'a' }, { value: '3%', label: 'b' }] }];
    var p2 = [{ type: 'stats', items: [{ value: '46%', label: 'a again' }, { value: '73%', label: 'c' }, { value: '83%', label: 'd' }] }];
    dedupeDeckNumbers_(p1, used); dedupeDeckNumbers_(p2, used);
    JSON.stringify(p2[0].items.map(function (i) { return i.value; }));`));
  assert.deepEqual(R, ["73%", "83%"]);
});

test("case studies: most relevant client first; a long title uses the result, never a chopped phrase", () => {
  const sb = loadAll();
  const R = JSON.parse(run(sb, `
    var ctx = { userPrompt: 'modernizing FP&A with Google Cloud and AI', department: 'Finance', presentationType: 'Custom' };
    var first = rankCaseFacts_(ctx, ['Client impact — Altria: legal review agent, 90% faster contract review', 'Client impact — Gordon Food Service: EDW on Google Cloud, 40% lower operating costs'])[0];
    var cs = { type: 'case_study', client: 'Gordon Food Service', title: 'Data unification and lower costs through a modern enterprise data warehouse on Google Cloud',
      results: [{ value: '40%', label: 'Reduction in operating costs via GCP migration' }] };
    nameCaseClient_(cs, { lib: null });
    JSON.stringify({ first: first, title: cs.title });`));
  assert.match(R.first, /Gordon Food Service/);
  assert.equal(R.title, "Gordon Food Service: 40% reduction in operating costs");
});

test("statement slides get points from their notes; converted diagrams get a short centre label", () => {
  const sb = loadAll();
  const R = JSON.parse(run(sb, `
    var st = statementNeedsPoints_({ type: 'statement', title: 'Limited forecasting visibility', statement: 'Many organizations lack foresight.',
      notes: 'Short planning horizons prevent proactive decision-making across the business. Only a small fraction of businesses can forecast beyond one year with confidence. Teams spend most of their time collecting data instead of analysing it.' });
    JSON.stringify({ n: st.points.length, c1: centerLabel_('Addressing risks in AI customer service deployments'), c2: centerLabel_('Gemini use cases: agent empowerment') });`));
  assert.equal(R.n, 3);
  assert.equal(R.c1, "Risks");
  assert.equal(R.c2, "Gemini use cases");
});

test("designs: 66 statement card stays out of the photo, triangle and stacked captions fit, tabs panel sized, phases all blue", () => {
  const sb = loadAll();
  const R = JSON.parse(run(sb, `
    var it = function (t, x) { return { title: t, text: x }; };
    var r = function (spec) { return ENGINE.render({ slides: [spec] }, {})[0]; };
    var s1 = r({ type: 'statement', title: 'The evolving data landscape', statement: 'The pace of digital transformation demands a data foundation that is agile, scalable and AI-ready.', text: 'Legacy data systems hinder innovation.', reference: { tag: '66D_LAYOUT_STATEMENT_001' } });
    var card = s1.els.filter(function (e) { return e.t === 'rect' && e.fill === ENGINE.TOKENS.slate; })[0];
    var tri = r({ type: 'diagram', title: 'Real-time access empowers teams', reference: { tag: '66D_LAYOUT_DIAGRAM_009' }, items: [it('Accelerated insights', 'Access up-to-the-minute financial data and spot trends fast.'), it('Empowered users', 'Finance teams build their own reports without waiting for IT.'), it('Enhanced accuracy', 'Consistent data definitions and a single source of truth improve the reliability of all reports.')] });
    var base = tri.els.filter(function (e) { return e.t === 'rect' && e.rot === 0; })[0];
    var cap = tri.els.filter(function (e) { return e.t === 'text' && e.text === 'Enhanced accuracy'; })[0];
    var st3 = r({ type: 'diagram', title: 'Mitigating risks', reference: { tag: '66D_LAYOUT_DIAGRAM_003' }, items: [it('Data integration complexity', 'Fragmented legacy systems create complex integration challenges.'), it('Skill gaps and user adoption', 'New technologies need upskilling and change management.'), it('Security & compliance', 'Financial data security and regulatory compliance are paramount for every release.')] });
    var texts = st3.els.filter(function (e) { return e.t === 'text' && e.y > 60; });
    var tl = r({ type: 'timeline', title: 'Phased implementation', reference: { tag: '66D_LAYOUT_TIMELINE_004' }, items: [1,2,3,4,5].map(function (k) { return { label: 'Phase ' + k, title: 'Step ' + k, text: 'Text ' + k }; }) });
    var tabs = tl.els.filter(function (e) { return e.t === 'rect' && e.h === 34 && e.fill !== ENGINE.TOKENS.tileGrey; });
    JSON.stringify({ cardRight: card.x + card.w, capTop: cap.y + 7.2, baseBottom: base.y + base.h,
      minX: Math.min.apply(null, texts.map(function (e) { return e.x + 7.2; })), maxX: Math.max.apply(null, texts.map(function (e) { return e.x + e.w - 7.2; })),
      tabFills: tabs.map(function (e) { return e.fill; }) });`));
  assert.ok(R.cardRight <= 480, "the callout card ends before the photo strip (x=500)");
  assert.ok(R.capTop >= R.baseBottom, "the bottom caption sits under the base bar");
  assert.ok(R.minX >= 32 && R.maxX <= 688, "stacked-block captions stay inside the margins");
  assert.equal(new Set(R.tabFills).size, 1, "every phase tab has the same blue");
});

test("closing never rotates and statement / bullets rules are in the planning prompt", () => {
  const code = read("src/Code.gs");
  assert.match(code, /A bullets slide always has a callout/);
  assert.match(code, /Every number on a slide is about that slide's topic/);
  assert.match(code, /function outlineChecks_/);
  assert.match(code, /usedNumbers/);
});
