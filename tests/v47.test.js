"use strict";

// V.1_47 (Apple 30-slide proposal audit): a long deck has exactly the slides asked for; every requested topic (risks)
// has its slide; no unrequested client story; slides sit in their section; one team / governance slide; an architecture
// slide is an architecture diagram; a KPI slide is never empty; a Gantt roadmap has 3+ lanes; no ALL CAPS, no hype
// words; data sources never on a pyramid or a layer stack; puzzle only for labels; cards fill the slide; rows never spill.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

// The whole add-on in one sandbox, with Slides / Drive / Gemini mocked
function loadAll(gemini, seed) {
  let sd = seed || 1;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const slides = [], drawn = [], props = {}, uprops = {}, files = {};
  const mkSlide = () => ({ getObjectId: () => "s" + slides.length, remove() {}, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) });
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n" };
  const sb = { console, Math: M, JSON, Date, Logger: { log() {} },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty(k, v) { props[k] = v; } }),
      getUserProperties: () => ({ getProperty: (k) => uprops[k] || null, setProperty(k, v) { uprops[k] = v; }, deleteProperty(k) { delete uprops[k]; } }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 14, 2026", sleep() {}, newBlob: () => ({}), base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), searchFiles: () => ({ hasNext: () => false }), getFolderById: () => { throw new Error("no folder"); },
      createFile: (n, j) => { const id = "F" + Object.keys(files).length; files[id] = j; return { getId: () => id, setContent(x) { files[id] = x; }, setTrashed() {} }; },
      getFileById: (id) => ({ setContent(x) { files[id] = x; }, setTrashed() {}, getBlob: () => ({ getDataAsString: () => files[id] }) }),
      createFolder: () => ({ createFile: () => ({ getId: () => "LOGO1" }) }) },
    UrlFetchApp: { fetch: () => { throw new Error("no net"); } } };
  vm.createContext(sb);
  ORDER.forEach((f) => vm.runInContext(read("src/" + f), sb, { filename: f }));
  Object.assign(sb, {
    loadRunContext_(ctx) { ctx.apiKey = "k"; ctx.brand = JSON.parse(JSON.stringify(sb.DEFAULT_BRAND)); ctx.assets = { design: {}, logos: {}, patterns: {}, icons: [] }; ctx.lib = null; ctx.tokens = null; },
    callGeminiJSON: (parts) => gemini(parts[0].text || ""),
    researchTopic_: () => ({ research: [] }),
    renderEngineSlide(slide, spec) { drawn.push(JSON.parse(JSON.stringify(spec))); },
    insertTemplateSlide_: () => false
  });
  sb.drawn = drawn;
  return sb;
}
const ev = (sb, code) => vm.runInContext(code, sb);

// ---- the outline deck 20 got: 20 body slides instead of 23, a client story nobody asked for, no risks, the client's
//      needs in section 02, the architecture as cards, the team and the governance as two slides
const S1 = "Understanding Apple's needs", S2 = "Our approach & solution architecture", S3 = "Data governance & delivery plan", S4 = "Team, governance & risks";
const OUTLINE = { deck_title: "Revolutionizing demand forecasting & supply chain planning at Apple", subtitle: "Google Cloud with BigQuery, Vertex AI and Gemini", closing_subtitle: "Partner with 66degrees",
  sections: [
    { title: S1, description: "Why manual forecasting can no longer keep up", slides: [
      { type: "comparison", title: "Manual forecasting creates significant business risk" }, { type: "cards", title: "Inaccurate forecasts impact Apple's bottom line" },
      { type: "diagram", title: "AI is a game-changer for supply chain management" }, { type: "cards", title: "Google Cloud powers the future of supply chains" },
      { type: "diagram", title: "Achieve a unified view of sales and inventory" }] },
    { title: S2, description: "How the solution works", slides: [
      { type: "process", title: "Our proven methodology drives successful outcomes" }, { type: "process", title: "Key principles for AI-driven demand forecasting" },
      { type: "diagram", title: "BigQuery: the foundation for unified data analytics" }, { type: "cards", title: "Vertex AI Forecast delivers highly accurate predictions" },
      { type: "diagram", title: "Gemini enhances planning with intelligent summaries" }, { type: "process", title: "Understanding Apple's current forecasting needs" }] },
    { title: S3, description: "Data, architecture and the plan", slides: [
      { type: "cards", title: "Data governance critical for AI success" }, { type: "cards", title: "High-level solution architecture overview" },
      { type: "process", title: "Ensuring data quality and integration for AI inputs" }, { type: "timeline", title: "Project roadmap: key phases and milestones" },
      { type: "case_study", title: "Gordon Food Service unified data for demand planning" }, { type: "cards", title: "Expert team drives your AI transformation" }] },
    { title: S4, description: "Who does what, and how we measure success", slides: [
      { type: "cards", title: "Collaborative project governance and oversight" }, { type: "process", title: "Continuous improvement and optimization strategy" },
      { type: "stats", title: "Key performance indicators for measuring success" }] }] };
const PROMPT = "Create a proposal deck for Apple: demand forecasting and supply chain planning with Google Cloud (BigQuery, Vertex AI, Gemini). Cover: understanding Apple's needs, our approach and solution architecture, data governance, delivery plan and roadmap, team and governance, risks, KPIs.";
const card = (t, x) => ({ title: t, text: x });
function content(o) {
  const T = o.title;
  if (/key performance/i.test(T)) return { type: "stats", title: T, lead: "Targets for Apple.", items: [{ value: "20%", label: "Forecast accuracy" }, { value: "15%", label: "Lower inventory cost" }, { value: "30%", label: "Faster planning" }] };
  if (/roadmap/i.test(T)) return { type: "timeline", title: T, design: "P66_GANTT", periods: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"],
    lanes: [{ name: "Discovery", bars: [{ start: 1, end: 2, label: "Scope" }] }, { name: "Build", bars: [{ start: 3, end: 6, label: "Models" }] }] };
  if (/methodology/i.test(T)) return { type: "process", title: T, design: "P66_CHEVRON_PHASES", items: [card("DEFINE", "Clarify the goals and the scope in workshops with the planning teams."), card("DESIGN", "Design the data platform, the models and the integration."), card("PLAN", "Plan the effort, the resources and the timeline."), card("VALUE CHECKPOINT", "Measure the value against the goals with the sponsors.")] };
  if (/architecture/i.test(T)) return { type: "cards", title: T, items: [card("Unified data platform", "BigQuery consolidates sales and inventory data."), card("Forecasting models", "Vertex AI manages the models."), card("Planning insights", "Gemini writes planning summaries.")] };
  return { type: o.type === "stats" ? "stats" : "cards", title: T, lead: "Lead for " + T + ".", items: [card("First point", "A sentence that explains the first point in about twelve words here."), card("Second point", "A sentence that explains the second point in about twelve words here."), card("Third point", "A sentence that explains the third point in about twelve words here.")] };
}
function gemini(short, used) {
  return (t) => {
    if (/Who is the CLIENT/.test(t)) return { client: "Apple", domain: "apple.com", confident: true };
    if (/Plan the OUTLINE/.test(t)) return JSON.parse(JSON.stringify(OUTLINE));
    if (/Write exactly \d+ NEW slides/.test(t)) return short ? { slides: [] } : { slides: Array.from({ length: +t.match(/Write exactly (\d+)/)[1] }, (x, i) => ({ type: "cards", title: "Another new topic " + (i + 1), brief: "x", section: 2 })) };
    if (/THIS IS PART OF A LONG DECK/.test(t)) {
      if (used) used.push(t);
      return { slides: t.split("\n").filter((l) => /^\d+\. type "/.test(l)).map((l) => { const m = l.match(/type "([^"]*)" \| title "([^"]*)"/); return Object.assign(content({ type: m[1], title: m[2] }), { notes: "Notes." }); }) };
    }
    if (/look empty/.test(t)) { const list = JSON.parse(t.split("\n").pop()); return { fixes: list.map((x) => ({ id: x.id, add: x.kind === "lanes" ? [{ name: "Data platform", bars: [{ start: 2, end: 5, label: "Pipelines" }] }, { name: "Adoption", bars: [{ start: 4, end: 6, label: "Training" }] }] : x.kind === "kpis" ? [{ value: "25%", label: "Target: forecast accuracy", text: "t" }, { value: "10%", label: "Target: fewer stock-outs", text: "t" }, { value: "2 days", label: "Target: planning cycle", text: "t" }].slice(0, x.add) : [] })) }; }
    if (/show an architecture/.test(t)) { const list = JSON.parse(t.split("\n").pop()); return { slides: list.map((x) => ({ id: x.id, columns: [{ label: "Data sources", items: [{ title: "Sales and POS", text: "Daily sales" }, { title: "Inventory systems", text: "Stock" }] }, { label: "Google Cloud", items: [{ title: "BigQuery", text: "Planning data" }, { title: "Vertex AI Forecast", text: "Forecasts" }] }, { label: "Planning teams", items: [{ title: "Gemini summaries", text: "Insights" }] }], links: ["Daily loads", "Forecasts"], takeaway: "One platform from data to decisions" })) }; }
    return {};
  };
}
function outline(short) {
  const sb = loadAll(gemini(short));
  return JSON.parse(ev(sb, `(function () {
    var ctx = { apiKey: 'k', brand: DEFAULT_BRAND, lib: null, log: [], presentationType: 'Proposal Deck', department: 'Other' };
    var o = planOutline_(${JSON.stringify(PROMPT)}, 'Proposal Deck', 30, { text: '', pdfs: [], images: [], research: [] }, ctx);
    return JSON.stringify({ o: o, log: ctx.log });
  })()`));
}

test("outline: exactly the slides asked for, even when Gemini writes too few (dividers count)", () => {
  for (const short of [true, false]) {
    const { o } = outline(short);
    const dividers = o.slides.filter((s) => s.type === "section" && s.level !== 2).length;
    assert.equal(o.slides.length + 3, 30, "cover + agenda + outline + closing = 30 (short=" + short + ")");
    assert.equal(dividers, o.sections.length);
  }
});

test("outline: requested risks get their slide; no unrequested case study; one team / governance slide", () => {
  for (const short of [true, false]) {
    const { o } = outline(short);
    const titles = o.slides.map((s) => s.title);
    assert.ok(titles.some((t) => /\brisks\b/i.test(t)), "a risk slide: " + titles.join(" | "));
    assert.ok(!o.slides.some((s) => s.type === "case_study"), "no client story");
    assert.ok(!titles.some((t) => /Gordon/.test(t)));
    const team = titles.filter((t) => /expert team|project governance/i.test(t));
    assert.equal(team.length, 1, team.join(" | "));
  }
});

test("outline: the client's needs slide sits in the needs section; architecture is a diagram; hype words gone", () => {
  const { o } = outline(true);
  const idx = (re) => o.slides.findIndex((s) => re.test(s.title));
  const sec2 = o.slides.findIndex((s) => s.type === "section" && s.number === "02");
  assert.ok(idx(/current forecasting needs/) < sec2, "needs slide before divider 02");
  assert.equal(o.slides[idx(/architecture overview/)].type, "diagram");
  assert.doesNotMatch(o.deck_title, /revolutioni/i);
  assert.ok(!o.slides.some((s) => /game-changer/i.test(s.title)));
  const a1 = o.agendaItems.find((a) => a.title === "Understanding Apple's needs");
  assert.ok(a1.points.some((p) => /current forecasting needs/.test(p)), "the agenda lists it in section 01");
});

test("long deck of 30: 30 slides drawn; KPI slide filled; roadmap with 3+ lanes; architecture diagram; no ALL CAPS", () => {
  const used = [];
  const sb = loadAll(gemini(true, used), 3);
  let r = sb.generatePresentation({ mode: "create", presentationType: "Proposal Deck", slideCount: 30, clientName: "Apple", clientDomain: "apple.com", prompt: PROMPT, runId: "RUN1" });
  for (let k = 0; r && r.continue && k < 20; k++) r = sb.continueDeckGeneration(r.runId);
  const d = sb.drawn;
  assert.equal(d.length, 30, d.map((s) => s.title).join(" | "));
  const kpi = d.find((s) => /key performance/i.test(s.title));
  assert.ok(kpi && (kpi.items || []).length >= 3, "KPI items");
  const road = d.find((s) => /roadmap/i.test(s.title));
  assert.ok(road.type !== "timeline" || road.lanes.length >= 3, "roadmap lanes " + (road.lanes || []).length);
  const arch = d.find((s) => /architecture overview/i.test(s.title));
  assert.equal(arch.reference && arch.reference.tag, "P66_ARCH_FLOW");
  const meth = d.find((s) => /methodology/i.test(s.title));
  assert.deepEqual(meth.items.map((i) => i.title), ["Define", "Design", "Plan", "Value checkpoint"]);
  assert.ok(d.every((s) => s.type === "cover" || s.type === "closing" || (s.reference && /^P66_/.test(s.reference.tag))), "every slide in a proposal design");
  assert.ok(used.slice(1).some((t) => /Designs already used on earlier slides of this deck/.test(t)), "later parts are told which designs are used");
});

test("a KPI slide is never emptied by the one-figure-per-deck rule", () => {
  const sb = loadAll(() => ({}));
  const R = JSON.parse(ev(sb, `(function () {
    var used = ['20%', '15%', '30%'];
    var p = [{ type: 'stats', title: 'KPIs', items: [{ value: '20%', label: 'a' }, { value: '15%', label: 'b' }, { value: '30%', label: 'c' }] }];
    dedupeDeckNumbers_(p, used);
    var t = [{ type: 'stats', title: 'KPIs', items: [{ value: '20%', label: 'Target: accuracy' }, { value: '9%', label: 'x' }] }];
    dedupeStatValues_([{ type: 'case_study', results: [{ value: '20%' }] }].concat(t));
    var e = statsNeedNumbers_({ type: 'stats', title: 'KPIs', items: [] });
    return JSON.stringify({ kept: p[0].items.length, target: t[0].items.length, empty: e.type });
  })()`));
  assert.equal(R.kept, 3);
  assert.equal(R.target, 2);
  assert.equal(R.empty, "stats");
});

test("ALL CAPS names become sentence case; acronyms stay; hype words are replaced", () => {
  const sb = loadAll(() => ({}));
  const R = JSON.parse(ev(sb, `JSON.stringify([headingCase_('VALUE CHECKPOINT'), headingCase_('DEFINE'), headingCase_('AI / ML'), headingCase_('KPI'), headingCase_('DATA & AI READINESS'),
    sentenceCase_('Revolutionizing demand forecasting & supply chain planning at Apple', 2), removeHypeText_('AI is a game-changer for supply chain management')])`));
  assert.deepEqual(R.slice(0, 5), ["Value checkpoint", "Define", "AI / ML", "KPI", "Data & AI readiness"]);
  assert.equal(removeHype(R[5]), "Improving demand forecasting & supply chain planning at Apple");
  assert.equal(R[6], "AI is a major step forward for supply chain management");
  function removeHype(x) { return ev(sb, "removeHypeText_(" + JSON.stringify(x) + ")"); }
});

// ---- designs
function engine() {
  const g = { console, Math, JSON, String, Array, Object, Number, Date };
  vm.createContext(g);
  vm.runInContext(read("src/Engine.gs") + ";this.ENGINE=ENGINE;", g);
  fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort().forEach((f) => vm.runInContext(read("src/" + f), g));
  vm.runInContext(read("src/Reference.gs"), g);
  return g;
}
const lay = (g, sp) => g.ENGINE.render({ slides: [Object.assign({ deckLibrary: "proposal" }, sp)] }, { dateLabel: "x" })[0];
const can = (g, sp, tag) => g.ENGINE.canDraw(Object.assign({ deckLibrary: "proposal" }, sp, { reference: { tag } }));
const maxBottom = (sl) => Math.max(...sl.els.filter((e) => e.y > 70 && e.t !== "image" && e.t !== "line").map((e) => e.y + (e.h || e.size || 0)));

test("Gantt: 2 lanes are not drawn (mostly empty); 3-4 lanes fill the slide", () => {
  const g = engine();
  const periods = ["M1", "M2", "M3", "M4", "M5", "M6"];
  const lane = (n) => ({ name: "Lane " + n, bars: [{ start: n, end: n + 2, label: "Bar " + n }] });
  assert.equal(can(g, { type: "timeline", title: "Roadmap", periods, lanes: [lane(1), lane(2)] }, "P66_GANTT"), false);
  const sl = lay(g, { type: "timeline", title: "Roadmap", periods, lanes: [lane(1), lane(2), lane(3)], reference: { tag: "P66_GANTT" } });
  assert.ok(maxBottom(sl) > 250, "grid reaches " + maxBottom(sl));
});

test("data sources are never a pyramid or a layer stack; pyramid only for levels", () => {
  const g = engine();
  const items = [{ title: "Sales data", text: "Historical sales." }, { title: "Inventory data", text: "Stock levels." }, { title: "Supplier data", text: "Lead times." }, { title: "Vertex AI forecast", text: "Forecasts." }];
  assert.equal(can(g, { type: "diagram", title: "Maturity levels", items }, "P66_PYRAMID"), false);
  assert.equal(can(g, { type: "diagram", title: "Platform layers", items }, "P66_ISO_CALLOUTS"), false);
  const tags = (sp) => vm.runInContext("drawableDesigns_('diagram', 4, " + JSON.stringify(Object.assign({ deckLibrary: "proposal" }, sp)) + ").map(function (d) { return d.tag; })", g);
  assert.ok(!tags({ title: "BigQuery: the foundation for unified data analytics", design: "P66_PYRAMID", items }).includes("P66_PYRAMID"));
  assert.ok(tags({ title: "Four levels of planning maturity", items: [{ title: "Reactive" }, { title: "Managed" }, { title: "Predictive" }, { title: "Autonomous" }] }).includes("P66_PYRAMID"));
});

test("puzzle: an even puzzle of labels only (never 3 + 2, never hiding item texts)", () => {
  const g = engine();
  const lab = (n) => Array.from({ length: n }, (x, i) => ({ title: "Block " + (i + 1) }));
  assert.equal(can(g, { type: "diagram", title: "Fit together", items: lab(5) }, "P66_PUZZLE"), false);
  assert.equal(can(g, { type: "diagram", title: "Fit together", items: lab(4) }, "P66_PUZZLE"), true);
  assert.equal(can(g, { type: "diagram", title: "Fit together", items: lab(4).map((x) => Object.assign(x, { text: "Design and deploy forecasting models." })) }, "P66_PUZZLE"), false);
});

test("phase columns: 'Phase n:' only on a plan; a data-quality process keeps its own step names", () => {
  const g = engine();
  const items = ["Assess data", "Standardize", "Augment", "Pipelines"].map((t) => ({ title: t, points: ["A short point about " + t + "."] }));
  const texts = (title) => lay(g, { type: "process", title, items, reference: { tag: "P66_PHASE_COLUMNS" } }).els.filter((e) => e.t === "text").map((e) => e.text).join(" | ");
  assert.match(texts("Deployment phases for the pilot"), /Phase 1: Assess data/);
  assert.doesNotMatch(texts("Ensuring data quality for AI inputs"), /Phase 1:/);
});

test("deliverable bar: 'Deliverable' only for a deliverable; the title stops before the photo strip", () => {
  const g = engine();
  const items = [{ title: "Quality", text: "High-quality inputs." }, { title: "Compliance", text: "Privacy rules." }, { title: "Trust", text: "Lineage and access." }];
  const t1 = lay(g, { type: "cards", title: "Data governance is critical for AI success across the business", items, takeaway: "Governance keeps data safe.", reference: { tag: "P66_DELIVERABLE_ROWS" } });
  assert.ok(!t1.els.some((e) => e.t === "text" && e.text === "Deliverable"));
  const title = t1.els.find((e) => e.t === "text" && /^Data governance/.test(e.text));
  assert.ok(title.x + title.w <= 500, "title ends at " + (title.x + title.w));
  const t2 = lay(g, { type: "cards", title: "Phase 1", items, deliverable: "Data quality report", reference: { tag: "P66_DELIVERABLE_ROWS" } });
  assert.ok(t2.els.some((e) => e.t === "text" && e.text === "Deliverable"));
});

test("cards fill the slide: card grid, 2 x 2 cards and two cards + photo leave no empty bottom band", () => {
  const g = engine();
  const four = Array.from({ length: 4 }, (x, i) => ({ title: "Card " + i, text: "A short text for the card number " + i + "." }));
  assert.ok(maxBottom(lay(g, { type: "cards", title: "Grid", items: four, reference: { tag: "P66_CARD_GRID" } })) > 320);
  assert.ok(maxBottom(lay(g, { type: "cards", title: "Two by two", items: four, reference: { tag: "P66_CARDS_2X2" } })) > 320);
  const two = four.slice(0, 2);
  assert.ok(maxBottom(lay(g, { type: "cards", title: "From and to", items: two, reference: { tag: "P66_TWO_CARDS_PHOTO" } })) > 320);
});

test("numbered rows: each row is tall enough for its text measured a little narrower (no spill in Slides)", () => {
  const g = engine();
  const items = [{ title: "Integration", text: "Unifying disparate data sources into a single platform for a comprehensive and consistent view of your supply chain." },
    { title: "Accuracy", text: "Leveraging advanced machine learning to deliver highly precise demand predictions, minimizing forecast errors." },
    { title: "Scalability", text: "Designing solutions that can handle massive datasets and grow smoothly with expanding operations." }];
  const sl = lay(g, { type: "process", title: "Key principles", items, reference: { tag: "P66_NUMBERED_ROWS" } });
  const rows = sl.els.filter((e) => e.t === "rect" && e.w > 400 && e.y > 60);
  sl.els.filter((e) => e.t === "text" && items.some((it) => it.text === e.text)).forEach((e) => {
    const row = rows.find((r) => e.y >= r.y && e.y < r.y + r.h);
    const need = g.ENGINE.kit.textH(e.text, e.w - 14, 10);
    assert.ok(e.y + need <= row.y + row.h + 0.5, "text needs " + need + " in row of " + row.h);
  });
});

test("version label is V.1_47", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_ = '66° Deck Agent V\.1_47'/);
});
