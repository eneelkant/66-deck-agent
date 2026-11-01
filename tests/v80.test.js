"use strict";

// V.1_80 - the permanent fixes from the V.1_79 test decks (deck 51: General Target / United, Proposal Nestlé / Cleveland
// Clinic, Solution Contoso / Tailspin and the Frontdoor rebrand; tests/fixtures/deck51-slide-log.json holds the United,
// Cleveland Clinic and Tailspin runs). The checks that came back in new forms now also run as the last word on every
// slide, right before it is drawn.
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const LOG = JSON.parse(read("tests/fixtures/deck51-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => e.text);
const NESTLE = "Create a 40-slide proposal deck for Nestlé (nestle.com) to modernise supply planning on Google Cloud. Targets: forecast accuracy from 70% to 88%, 15% lower inventory and a 10-week pilot. Include executive summary, approach, scope, timeline, team, RACI, KPIs, risks, pricing options, why 66degrees and next steps.";
const UNITED = "Create a 40-slide presentation for United Airlines (united.com) on a Vertex AI assistant for contact-centre agents. Targets: 45 seconds lower average handle time, 20 percent fewer repeat calls and a 4.5/5 agent satisfaction score. Include current state, solution, scope, timeline, team, RACI, KPIs, risks, support, pricing options, why 66degrees and next steps.";
const CLEVELAND = "Create a 40-slide proposal deck for Cleveland Clinic (clevelandclinic.org) for a Gemini assistant that drafts discharge summaries. Targets: 90 minutes saved per clinician per week, under 2% factual error rate and HIPAA-aligned controls. Include approach, scope, phases, team, RACI, KPIs, risks, support, pricing options, why 66degrees and next steps.";

test("version label is V.1_80 or later; every slide gets the last word as it is drawn", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(8\d|9\d)'/);
  assert.match(read("src/Code.gs"), /if \(typeof lastWord_ === 'function'\) specs\.forEach\(function \(sp\) \{ try \{ lastWord_\(sp, ctx\);/);
  assert.match(read("src/UsageLog.gs"), /concat\(\(spec && spec\.preFixed\) \|\| \[\]\)/, "its fixes go to the slide log");
});

// ---------------- A. figures

test("A1. '$1.7T' is read whole (Target 21 showed '7T')", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(G.figTokens_("Reclaim value: $1.7T in annual inventory distortion."))).map((t) => t.text), ["$1.7T"]);
  assert.match(read("src/Code.gs"), /\(\?:k\|m\|mn\|b\|bn\|t\|tn\|million\|billion\|trillion\)/);
});

test("A2. 'Pub/Sub' stays Pub/Sub (Tailspin 12); other slash pairs still read 'A or b'", () => {
  assert.equal(G.slashWords_("Pub/Sub topics"), "Pub/Sub topics");
  assert.equal(G.slashWords_("Maintain/Exceed NPS"), "Maintain or exceed NPS");
  const sp = spec("Solution", 12);
  G.lastWord_(sp, { userPrompt: "x" });
  assert.ok(sp.items.every((it) => !/Pub or sub/i.test(it.title)), JSON.stringify(sp.items.map((i) => i.title)));
});

test("A3. KPI values in digits on the drawn slide (United 25 '20 percent')", () => {
  const sp = spec("General", 25);
  sp.items[1].value = "20 percent";
  G.lastWord_(sp, { userPrompt: UNITED });
  assert.equal(sp.items[1].value, "20%");
  assert.ok(sp.preFixed.includes("final-text"));
});

// ---------------- B. missing slides

test("B1. the topic list is the 'Include ...' sentence, never the 'Targets:' clause (Nestlé lost pricing, timeline, team, RACI)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(G.requestedTopics_(NESTLE))), ["executive summary", "approach", "scope", "timeline", "team", "RACI", "KPIs", "risks", "pricing options", "why 66degrees", "next steps"]);
  assert.deepEqual(JSON.parse(JSON.stringify(G.requestedTopics_("Build a deck on Gemini adoption covering why now, use cases, risks"))), ["why now", "use cases", "risks"]);
});

test("B2. the request's targets are read from the request; a pilot length is not a target", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(G.requestTargets_(UNITED))), [{ value: "45 seconds", label: "Lower average handle time" }, { value: "20%", label: "Fewer repeat calls" }, { value: "4.5/5", label: "Agent satisfaction score" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(G.requestTargets_(NESTLE))), [{ value: "88%", label: "Forecast accuracy" }, { value: "15%", label: "Lower inventory" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(G.requestTargets_(CLEVELAND))).map((t) => t.value), ["90 minutes", "under 2%"]);
  assert.match(read("src/Code.gs"), /requestTargets_\(userPrompt\)\.length >= 2\)\) && askedOnce\.indexOf\('kpi'\)/);
});

test("B3. the outline's KPI slide is locked: whatever a later step made of it, it is drawn as the target tiles (Cleveland Clinic)", () => {
  const outline = { slides: [{ type: "section", title: "Value" }, { type: "stats", title: "Success KPIs and target figures" }, { type: "cards", title: "Pricing options" }], agendaItems: [] };
  assert.equal(G.ensureKpiOutline_(outline, { brief: {} }, CLEVELAND), "kept");
  assert.equal(outline.slides[1].kpiLock, true);
  assert.match(read("src/Code.gs"), /if \(o\.kpiLock\) sp\.kpiLock = true;/);
  const sp = Object.assign(spec("Proposal", 17), { kpiLock: true });            // the slide came back as cards
  G.lastWord_(sp, { userPrompt: CLEVELAND });
  assert.equal(sp.type, "stats");
  assert.equal(sp.items.map((i) => i.value).join("|"), "90 minutes|under 2%");
  assert.ok(sp.preFixed.includes("kpi-locked"));
  assert.ok(draw(sp).els.some((e) => e.text === "90 minutes"));
});

test("B4. duplicate topics: a second 'why 66degrees' or assumptions slide is the same once-only topic (Target 38, United 21/22)", () => {
  assert.equal(G.onceTopicOf_("Strong Google Cloud enterprise AI capabilities"), "why66");
  assert.equal(G.onceTopicOf_("Governance boundaries and operational assumptions"), "assumptions");
  assert.equal(G.onceTopicOf_("Assumptions and dependencies"), "assumptions");
  assert.match(read("src/SlideWriter.gs"), /OTHER SLIDES OF THIS PART \(written at the same time - do not cover their topics on this slide\)/);
});

test("B5. comparisons keep both sides (schema); a table of 3+ columns is read by its columns (Nestlé 30, Tailspin 29)", () => {
  const sc = G.slideSchema_({ type: "comparison", title: "Pilot scope versus enterprise scale" }, {});
  assert.equal(sc.properties.slides.items.required.join("|"), "type|title|left|right|notes");
  assert.equal(G.slideSchema_({ type: "comparison", title: "Key risks and mitigations" }, {}), null, "risk slides keep their own fields");
  const sp = { type: "table", title: "BigQuery GIS versus in-stream geofence evaluation", columns: ["Dimension", "Tier 2 Dataflow", "Tier 3 BigQuery", "Recommended allocation"],
    rows: [["Primary spatial workload", "Active perimeter crossings", "Historical route analysis", "Instant checks in Dataflow"], ["Latency profile", "Per event", "Scheduled joins", "Dataflow for alerts"]] };
  G.solutionRescue_(sp);
  const groups = JSON.parse(JSON.stringify(sp.items));
  assert.equal(groups[0].title, "Tier 2 Dataflow");
  assert.deepEqual(groups[0].points, ["Primary spatial workload: active perimeter crossings", "Latency profile: per event"]);
});

// ---------------- C. content

test("C1. benchmark figures say so; a highlight the request did not set is a benchmark (United 6, 12, 27)", () => {
  const o = draw({ type: "chart", title: "Agent performance across the industry", chart: { type: "bar", categories: ["Tenure reduction rate", "General staff handle time", "Newer agent handle time"], series: [{ name: "x", values: [9, 11, 18] }], unit: "%" } });
  assert.ok(texts(o).filter((t) => t === "Industry benchmark").length >= 3, JSON.stringify(texts(o)));
  const sp = spec("General", 12);
  G.lastWord_(sp, { userPrompt: UNITED });
  assert.ok(sp.items.every((it) => !it.highlight || /^Industry benchmark: /.test(it.highlight)), JSON.stringify(sp.items.map((i) => i.highlight)));
});

test("C2. 'Target:' / '(target)' only on the KPI slide; a duration is never a KPI (Nestlé 16, 25, 27)", () => {
  const sp = { type: "cards", title: "Translating 15% lower inventory", items: [{ title: "Target: dairy write-offs", text: "a" }, { title: "Promotional uplift modeling (target)", text: "b" }] };
  G.lastWord_(sp, { userPrompt: NESTLE });
  assert.equal(sp.items.map((i) => i.title).join("|"), "Dairy write-offs|Promotional uplift modeling");
  const k = { type: "stats", title: "Deconstructing the targets", items: [{ value: "88%", label: "Forecast accuracy" }, { value: "15%", label: "Lower inventory" }, { value: "10-week", label: "Pilot" }] };
  G.lastWord_(k, { userPrompt: NESTLE });
  assert.equal(k.items.map((i) => i.value).join("|"), "88%|15%");
});

test("C3. one Accountable per RACI row; sizing tables say 'To be confirmed in sizing workshop' (Contoso 36, 8)", () => {
  const r = { type: "table", title: "RACI matrix", columns: ["Workstream", "66degrees", "App leads", "Database team"], rows: [["Refactoring", "Responsible", "Accountable / Responsible", "Accountable"]] };
  G.lastWord_(r, { userPrompt: "x" });
  assert.equal(r.rows[0].join("|"), "Refactoring|Responsible|Accountable / Responsible|Consulted");
  const z = { type: "table", title: "Workload sizing and resource allocation model", columns: ["Tier", "Resource specification", "Peak"], rows: [["Cloud Run API", "vCPU and memory limits per service", "Autoscaled instances to max cap"], ["Cloud Run worker", "vCPU and memory limits per service", "Autoscaled instances to max cap"], ["AlloyDB primary", "16 vCPU and 128 GB memory", "Linear scaling at 90% CPU"]] };
  G.lastWord_(z, { userPrompt: "x" });
  assert.equal(z.rows[0][1], "To be confirmed in sizing workshop");
  assert.equal(z.rows[2][1], "16 vCPU and 128 GB memory");
});

test("C4. promises, old model names, client names, product names and spelling (Contoso 24, Cleveland 24/37, Target 1, United)", () => {
  assert.equal(G.noPromises_("Target: zero recovery point objective (RPO = 0) with no data loss"), "Target: a near-zero recovery point objective designed to prevent data loss");
  assert.equal(G.modelNames_("Gemini 1.5 Pro orchestration; more than 25%+ of all agentic AI work"), "Gemini on Vertex AI orchestration; more than 25% of all agentic AI work");
  assert.equal(G.clientNameCase_("Accelerating store fulfillment at target", "Target"), "Accelerating store fulfillment at Target");
  assert.equal(G.clientNameCase_("Hit the target faster", "Target"), "Hit the target faster");
  assert.equal(G.usSpelling_("contact centre leads optimise and analyse traveller behaviour"), "contact center leads optimize and analyze traveler behavior");
  const o = draw({ type: "bullets", title: "How it works", points: [{ title: "Live guidance", text: "Vertex AI Agent Assist listens to calls" }, { title: "Store labor", text: "BigQuery and Gemini replenishment" }, { title: "Summaries", text: "Drafts wrap-up notes" }] });
  const all = texts(o).join(" ");
  assert.match(all, /Live guidance: Vertex AI Agent Assist/); assert.match(all, /Store labor: BigQuery/);
  for (const r of [/currency symbol/, /To be confirmed in sizing workshop/, /Industry benchmark: 11%/, /American English spelling/, /Gemini 1\.5 Pro/]) assert.match(G.GEMINI_RULES_, r);
});

test("C5. a figure used as a heading says what it measures (Cleveland Clinic 4 '1.20 burnout drop')", () => {
  const sp = spec("Proposal", 4);
  G.lastWord_(sp, { userPrompt: CLEVELAND });
  assert.ok(!sp.items.some((i) => /^1\.20\b/.test(i.title)), JSON.stringify(sp.items.map((i) => i.title)));
});

// ---------------- D. layout

test("D1. no text under 7 pt unless it cannot fit; a design used once is not used again while another fits (Tailspin 38, United 10/20)", () => {
  assert.match(read("src/Engine.gs"), /if \(spec\.max != null && spec\.max < 7\) spec = Object\.assign\(\{\}, spec, \{ max: 7/);
  assert.match(read("src/Code.gs"), /a design already\s*\n\s*\/\/ used in this deck is a candidate only when no unused design shows the content well/);
});

// ---------------- E. rebrand

test("E1. rebrand: no false overlap, rows close up before the footer, short content nearer the middle, cover facts in sentence case", () => {
  const code = read("src/Rebrand.gs");
  assert.match(code, /\(b\.w - 0\.5\) \/ 0\.95\), 'sans', 400, size\)/);
  assert.match(code, /content that still reaches the footer area/);
  assert.match(code, /blockH < avail \* 0\.78 \? target \+ \(avail - blockH\) \* 0\.3/);
  const facts = G.coverFacts_({ title: "PL/SQL to .NET Microservices Modernization", subtitle: "Phase 1" }, { texts: [{ text: "PL/SQL to .NET Microservices Modernization", x: 60, y: 189 }, { text: "QA Strategy & Delivery", x: 240, y: 160 }, { text: "52 PL/SQL Objects in Scope", x: 60, y: 366 }] });
  assert.equal(facts, "QA strategy & delivery · 52 PL/SQL objects in scope");
});

test("E2. the footer squeeze closes gaps only (sizes unchanged) and moves icons with their rows", () => {
  const S = 960 / 720; let seq = 0;
  const box = (text, x, y, w, h, size) => ({ objectId: "t80_" + (++seq), size: { width: { magnitude: w * 12700 }, height: { magnitude: h * 12700 } }, transform: { scaleX: 1, scaleY: 1, translateX: x * 12700, translateY: y * 12700 },
    shape: { shapeType: "TEXT_BOX", shapeProperties: {}, text: { textElements: [{ paragraphMarker: { style: {} } }, { textRun: { content: text + "\n", style: { fontSize: { magnitude: size } } } }] } } });
  const title = box("Test automation strategy", 60, 22, 900, 32, 27);
  const rows = [0, 1, 2, 3, 4].map((k) => box("Row " + k + " text", 120, 80 + k * 88, 780, 80, 12));   // (x 120: not taken for a subtitle)   // the last row ends at 512 > 493
  const roles = G.detectRoles({ pageElements: [title].concat(rows) }, {}, 960, 540, S, {});
  const reqs = [];
  G.liftContent_(reqs, { pageElements: [title].concat(rows) }, roles, {}, S, 960, 540);
  assert.ok(reqs.length >= 4, "rows moved: " + reqs.length);
  reqs.forEach((q) => { assert.equal(q.updatePageElementTransform.transform.scaleY, 1); });
  assert.equal(typeof roles.squeeze, "function");
  assert.ok(roles.squeeze(500) > roles.squeeze(100));
});
