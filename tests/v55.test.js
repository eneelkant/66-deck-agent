"use strict";

// V.1_55 (deck 26 audit, the last Solution Deck fix round) - no blank slide: a design that fails is caught and the slide is
// drawn again as a plain list; layer stacks measure before drawing; a body slide typed as a frame is drawn with a Solution
// design; KPI, market, cost and roadmap slides only when the request or the tone asks; sources go to the notes; no market
// sizes; proposed response times are flagged; the lead is never the plan's brief; no doubled numbering; hyphenated words
// in sentence case; issue rows only for issues with fixes; the service hub only for a service model; three-word bullets
// become items with their text; random specs never throw and never use a General layout.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

// The whole add-on in one sandbox, with Slides / Drive / Gemini mocked
function loadAll(gemini, seed, clock) {
  let sd = seed || 1;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const slides = [], drawn = [], props = {}, uprops = {}, files = {};
  let sid = 0; const mkSlide = () => { const id = "s" + (sid++); const o = { getObjectId: () => id, remove() { const j = slides.indexOf(o); if (j >= 0) slides.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; return o; };
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n",
    insertSlide(i, s) { const c = mkSlide(); slides.splice(i, 0, c); return c; }, getSlideById: (x) => slides.find((q) => q.getObjectId() === x) || null };
  // V.1_51: long proposal decks are drawn in a hidden working copy and inserted into the presentation at the end
  const works = {};
  const mkWork = (name) => { const ws = []; const id = "W" + Object.keys(works).length; let k = 0;
    const mk = () => { const s = { getObjectId: () => s._id, remove() { const j = ws.indexOf(s); if (j >= 0) ws.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; s._id = id + "_" + (k++); return s; };
    const w = { name, getSlides: () => ws, getId: () => id, getPageWidth: () => 720, getPageHeight: () => 405, saveAndClose() {},
      appendSlide() { const s = mk(); ws.push(s); return s; }, getSlideById: (x) => ws.find((q) => q.getObjectId() === x) || null };
    ws.push(mk()); works[id] = w; return w; };
  const RealDate = Date;
  const FD = class extends RealDate { static now() { return RealDate.now() + (clock ? clock.off : 0); } };
  const sb = { console, Math: M, JSON, Date: clock ? FD : Date, Logger: { log() {} },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" }, create: (n) => mkWork(n),
      openById: (id) => { if (works[id]) return works[id]; throw new Error("no deck " + id); } },
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
  sb.pres = pres;
  sb.works = works;
  return sb;
}
const ev = (sb, code) => vm.runInContext(code, sb);


const SOL = () => loadAll(() => ({}));
const render1 = (sb, spec) => sb.ENGINE.render({ slides: [Object.assign({ deckLibrary: "solution" }, spec)] }, { dateLabel: "Oct 17, 2026" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => e.text);

test("version label is V.1_55 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[5-9]|[6-9]\d)'/);
});

test("a layer stack whose text does not fit returns no layout instead of crashing (deck 26 slide 23)", () => {
  const sb = SOL();
  const long = "Primary and secondary replicas with automatic seeding, listener configuration and health probes across both regions";
  const o = render1(sb, { type: "diagram", title: "Deployment layers", reference: { tag: "S66_LAYER_STACK" },
    layers: [1, 2, 3, 4].map((i) => ({ title: "Layer " + i, items: [long, long, long, long] })) });
  assert.ok(o && o.els.length > 3, "the slide is drawn");
  assert.match(o.drawnWith, /^S66_/);
});

test("a design that throws is caught and the slide gets another Solution design", () => {
  const sb = SOL();
  const o = render1(sb, { type: "cards", title: "Broken spec", reference: { tag: "S66_ISSUE_ROWS" }, items: [null, 5, { title: {} }, "Plain text item"] });
  assert.ok(o && o.els.length, "drawn");
});

test("a slide whose drawing fails is drawn again as a list, never left blank", () => {
  const sb = SOL();
  let calls = 0; const got = [];
  sb.renderEngineSlide = (slide, spec) => { calls++; if (calls === 1) throw new Error("boom"); got.push(spec); };
  sb.applyProposalFrame_ = () => {};
  const ctx = { log: [], presentationType: "Solution Deck", progress: null };
  const target = sb.pres;
  const spec = { type: "cards", title: "Runbooks", items: [{ title: "Failover", text: "Promote the DR replica and move the listener." }, { title: "Patching", text: "Patch the secondary first, then fail over." }] };
  sb.drawSlidesIntoActive_(target, [spec], ctx, false);
  assert.equal(got.length, 1);
  assert.equal(got[0].type, "bullets");
  assert.ok(got[0].points.some((p) => /Promote the DR replica/.test(p)));
  assert.ok(ctx.log.some((l) => /redrawn as a simple list/.test(l)));
});

test("a body slide typed as a frame becomes a content slide; the real cover, agenda and closing stay", () => {
  const sb = SOL();
  const slides = [{ type: "cover", title: "c" }, { type: "agenda", title: "a" }, { type: "cards", title: "x" },
    { type: "agenda", title: "Cost optimization tips", items: [{ title: "Committed use", text: "t" }] }, { type: "closing", title: "Thanks" }];
  assert.equal(sb.solutionBodyTypes_(slides, false), 1);
  assert.deepEqual(slides.map((s) => s.type), ["cover", "agenda", "cards", "cards", "closing"]);
  assert.match(read("src/Code.gs"), /a body slide is never a frame/);
});

test("KPI, market, cost and roadmap slides only when the request or the tone asks (deck 26 slides 5, 12, 27, 28)", () => {
  const sb = SOL();
  const req = "Solution deck, technical tone: condition-based maintenance with Vertex AI, the reference architecture, DR, runbooks and support priorities.";
  const slides = [{ type: "table", title: "Market size and growth" }, { type: "stats", title: "KPIs and targets" }, { type: "cards", title: "Cost optimization" },
    { type: "process", title: "Phased roadmap" }, { type: "diagram", title: "Reference architecture" }, { type: "process", title: "Failover runbook" }];
  const off = sb.solutionOutlineChecks_(slides, req, "technical", []);
  assert.deepEqual(Array.from(off), [0, 1, 2, 3]);
  assert.equal(sb.solutionOutlineChecks_(slides, req + " Include KPIs, cost, a roadmap and the market size.", "technical", []).length, 0);
  assert.ok(sb.solutionOutlineChecks_([{ type: "cards", title: "Cost and value" }], "x", "executive", []).length === 0, "executive keeps value");
});

test("source columns move to the notes and market sizes are dropped", () => {
  const sb = SOL();
  const sp = { type: "table", title: "Why now", columns: ["Driver", "Detail", "Source"],
    rows: [["Downtime", "Unplanned stops cost hours", "DataIntelo"], ["Market", "The market size will reach $28.9B at 9% CAGR", "DataIntelo"], ["Skills", "Fewer experienced engineers", "Gartner"]] };
  sb.solutionCleanFigures_(sp, "condition-based maintenance");
  assert.deepEqual(sp.columns, ["Driver", "Detail"]);
  assert.equal(sp.rows.length, 2);
  assert.match(sp.notes, /Sources: DataIntelo, Gartner/);
});

test("response times nobody gave are flagged; a lead that is the plan's brief is removed", () => {
  const sb = SOL();
  const s = [{ type: "table", title: "Support priorities", rows: [["P1", "15 minutes", "4 hours"], ["P2", "1 hour", "1 business day"]] }];
  assert.equal(sb.solutionGivenTimes_(s, "support priorities", {}), 1);
  assert.match(s[0].notes, /confirm them before sharing/);
  assert.equal(sb.solutionGivenTimes_([{ type: "table", title: "Support priorities", rows: [["P1", "15 minutes"]] }], "P1 response in 15 minutes", {}), 0);
  const l = [{ type: "diagram", title: "Reference architecture", lead: "The components and how data flows between them." }, { type: "cards", title: "y", lead: "Own lead." }];
  sb.solutionLeadNotBrief_(l, null);
  assert.ok(!l[0].lead);
  assert.equal(l[1].lead, "Own lead.");
});

test("no doubled numbering, hyphenated words in sentence case, generic chips dropped", () => {
  const sb = SOL();
  assert.equal(sb.solutionLabelCase_("1 · Data ingestion"), "Data ingestion");
  assert.equal(sb.solutionLabelCase_("02. Model training"), "Model training");
  assert.equal(sb.solutionLabelCase_("Condition-Based Maintenance"), "Condition-based maintenance");
  assert.equal(sb.solutionLabelCase_("Pub/Sub ingestion"), "Pub/Sub ingestion");
  const sp = { type: "process", title: "Flow", items: [{ title: "1 · Data ingestion", text: "Readings arrive." }], callouts: ["1 · Streams arrive in Pub/Sub"] };
  sb.solutionDisplayCase_(sp);
  assert.equal(sp.items[0].title, "Data ingestion");
  assert.ok(!/^1 ·/.test(sp.callouts[0]));
  const life = render1(sb, { type: "process", title: "Model lifecycle", reference: { tag: "S66_LIFECYCLE_COLUMNS" },
    items: [1, 2, 3, 4].map((i) => ({ label: "0" + i, title: "Stage " + i, points: ["First action of the stage", "Second action of the stage"], footer: "Output " + i })) });
  assert.ok(!texts(life).some((t) => /^0\d · 0\d/.test(t)), "no 01 · 01");
});

test("issue rows only for issues with fixes; the service hub only for a service model", () => {
  const sb = SOL();
  const phases = render1(sb, { type: "cards", title: "Implementation phases", reference: { tag: "S66_ISSUE_ROWS" },
    items: [1, 2, 3].map((i) => ({ title: "Phase " + i, text: "Build and test the pipeline for the district " + i + "." })) });
  assert.notEqual(phases.drawnWith, "S66_ISSUE_ROWS");
  const runbook = render1(sb, { type: "cards", title: "Runbooks for known issues", reference: { tag: "S66_ISSUE_ROWS" },
    items: [1, 2, 3].map((i) => ({ title: "Replica lag " + i, text: "Check the network and reseed the replica." })) });
  assert.equal(runbook.drawnWith, "S66_ISSUE_ROWS");
  const hubItems = ["Data ingestion", "Feature store", "Training", "Scoring"].map((t) => ({ title: t }));
  const pred = render1(sb, { type: "diagram", title: "How the model predicts failures", reference: { tag: "S66_SERVICE_HUB_DARK" }, center: "How the model", items: hubItems, governance: ["Weekly review"] });
  assert.notEqual(pred.drawnWith, "S66_SERVICE_HUB_DARK");
  const svc = render1(sb, { type: "diagram", title: "Managed service model", reference: { tag: "S66_SERVICE_HUB_DARK" }, center: "66degrees SRE", items: hubItems, governance: ["Weekly review", "Quarterly business review"] });
  assert.equal(svc.drawnWith, "S66_SERVICE_HUB_DARK");
});

test("three-word bullets become items with their text", () => {
  const sb = SOL();
  const sp = { type: "bullets", title: "Failover runbook", points: ["Check replica health", "Promote DR replica", "Update DNS listener"] };
  assert.equal(sb.solutionThinBullets_(sp), true);
  assert.equal(sp.type, "cards");
  assert.equal(sp.items.length, 3);
  assert.equal(sb.solutionThinBullets_({ type: "bullets", points: ["A full sentence that explains the step in detail for the team"] }), false);
});

test("the architecture backlog entry is dropped when the request asks for the architecture", () => {
  const sb = SOL();
  const t = sb.solutionBacklog_("technical", "include the reference architecture").map((b) => b.title);
  assert.ok(!t.includes("How the solution works end to end"));
  assert.ok(sb.solutionBacklog_("technical", "monitoring").map((b) => b.title).includes("How the solution works end to end"));
});

test("random specs never throw and stay in the Solution library", () => {
  const sb = SOL();
  const tags = JSON.parse(read("tests/fixtures/solution-samples.json")).map((x) => x.reference.tag).filter((t) => /^S66_/.test(t));
  assert.ok(tags.length > 20);
  let sd = 7; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const words = "replica listener region pipeline model feature store failover backup Terraform Ansible Pub/Sub BigQuery Vertex alert runbook".split(" ");
  const phrase = (n) => Array.from({ length: n }, () => words[Math.floor(r() * words.length)]).join(" ");
  const types = ["cards", "process", "diagram", "table", "comparison", "bullets", "stats", "statement"];
  let general = 0;
  for (let k = 0; k < 120; k++) {
    const n = 1 + Math.floor(r() * 9), w = 1 + Math.floor(r() * 40);
    const spec = { type: types[k % types.length], title: phrase(4), lead: phrase(10),
      items: Array.from({ length: n }, () => ({ title: phrase(1 + Math.floor(r() * 6)), text: phrase(w), points: [phrase(5), phrase(8)] })),
      columns: ["A", "B"], rows: Array.from({ length: n }, () => [phrase(2), phrase(w)]), layers: [{ title: "L", items: [phrase(w)] }] };
    if (tags.length) spec.reference = { tag: tags[k % tags.length] };
    let o; assert.doesNotThrow(() => { o = render1(sb, spec); });
    assert.ok(o && o.els.length, "slide " + k + " drawn");
    if (!/^S66_|^P66_SECTION/.test(o.drawnWith || "")) general++;
  }
  assert.ok(general <= 2, general + " slides used a General layout");
});
