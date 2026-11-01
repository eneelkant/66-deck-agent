"use strict";

// V.1_79 - Gemini's way (one call per slide, schemas, source quotes, per-slide rules, labels by the code) and the fixes
// from the V.1_78 test decks (deck 50: General Kroger / Delta, Proposal Unilever / Mayo, Solution Fabrikam / Northwind and
// the Frontdoor rebrand; tests/fixtures/deck50-slide-log.json holds the Delta, Mayo and Northwind runs)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const LOG = JSON.parse(read("tests/fixtures/deck50-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => e.text);
const KROGER = "Create a 40-slide presentation for Kroger (kroger.com) on cutting food waste with Gemini and BigQuery. Targets: 25% less spoilage, $120M yearly savings and 2.5x faster replenishment decisions.";
const ctxFor = (p) => { const c = { log: [], userPrompt: p, approvedFacts: [], brand: JSON.parse(JSON.stringify(G.DEFAULT_BRAND)), assets: { icons: {}, design: {}, logos: {}, patterns: {} }, lib: null }; c.brief = G.briefFromText_(p, 40); return c; };

// a fresh sandbox whose Gemini calls are answered by the test (the per-slide calls, in order)
function writer(answers) {
  const S = loadAddon(5);
  S.__jobs = []; S.__answers = answers;
  vm.runInContext("UrlFetchApp = Object.assign({}, typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : {}, { fetchAll: function () { return []; } });" +
    "callGeminiParallel_ = function (jobs) { __jobs.push(jobs); return __answers.splice(0, jobs.length); }; recentDesigns_ = function () { return []; };", S);
  return S;
}
const RESEARCH = { research: [{ n: 1, title: "Kroger results", snippet: "Kroger reported total sales of $147.6 billion for fiscal 2025 across more than 2,700 supermarkets in 35 states." }], text: "", pdfs: [], images: [] };

test("version label is V.1_79 or later; SlideWriter.gs is pushed after Quality.gs", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(79|[8-9]\d)'/);
  const order = JSON.parse(read(".clasp.json")).filePushOrder;
  assert.ok(order.indexOf("SlideWriter.gs") > order.indexOf("Quality.gs"));
  assert.doesNotMatch(read("src/SlideWriter.gs"), /AIza[0-9A-Za-z_-]{20,}/);
});

// ---------------- A. Gemini's way

test("A1. a part is written one slide per call: each call has its own slide, its own rules and Gemini's rules", () => {
  const S = writer([
    { slides: [{ type: "stats", title: "Kroger operational scale", lead: "Scale multiplies every gain.", items: [
      { value: "$147.6B", label: "Total annual sales", text: "Kroger reported its total sales for the year.", source_quote: "Kroger reported total sales of $147.6 billion for fiscal 2025 across more than 2,700 supermarkets" },
      { value: "2,700+", label: "Supermarkets", text: "Stores run ordering decisions every day.", source_quote: "across more than 2,700 supermarkets in 35 states" },
      { value: "35", label: "States", text: "A wide footprint multiplies each improvement.", source_quote: "more than 2,700 supermarkets in 35 states" }], notes: "Scale [1]." }] },
    { slides: [{ type: "table", title: "Batch versus continuous ordering", columns: ["Capability", "Today", "With the new approach"], rows: [["Event ingestion", "", ""], ["Re-forecasting", "Nightly", "Intra-day"]], notes: "n" }] },
    { slides: [{ type: "timeline", title: "Delivery phases", items: [{ date: "Phase A", title: "Discover", text: "Map the data sources and baselines." }, { date: "Phase B", title: "Build", text: "Build pipelines and models in BigQuery." }, { date: "Phase D", title: "Scale", text: "Roll out to every division." }], notes: "n" }] },
    // the table asked again with every cell
    { slides: [{ type: "table", title: "Batch versus continuous ordering", columns: ["Capability", "Today", "With the new approach"], rows: [["Event ingestion", "Nightly files", "Streaming Pub/Sub events"], ["Re-forecasting", "Nightly", "Intra-day"]], notes: "n" }] }
  ]);
  const ctx = ctxFor(KROGER);
  const batch = { slides: [{ type: "stats", title: "Kroger operational scale" }, { type: "table", title: "Batch versus continuous ordering" }, { type: "timeline", title: "Delivery phases" }], deckSize: 40, deckTitle: "Kroger", otherTitles: [] };
  const plan = S.planContent(KROGER, "General", 3, RESEARCH, ctx, { batch: batch });
  same(S.__jobs.map((j) => j.length), [3, 1], "three slide calls, then one repair call");
  const p0 = S.__jobs[0][0].parts[0].text, p1 = S.__jobs[0][1].parts[0].text;
  assert.match(p0, /Write EXACTLY these 1 body slides/);
  assert.match(p0, /Kroger operational scale/); assert.doesNotMatch(p0, /1\. type "table"/);
  assert.match(p1, /Batch versus continuous ordering/);
  assert.match(p0, /source_quote/); assert.match(p0, /never in words/);
  assert.equal(plan.slides[0].items[0].value, "$147.6B", "the figure kept whole (deck 50 Kroger 5 showed 6B)");
  assert.ok(plan.slides[0].items.every((it) => !("source_quote" in it)), "quotes are checked, then removed");
  same(plan.slides[1].rows[0], ["Event ingestion", "Nightly files", "Streaming Pub/Sub events"], "the empty cells were written again");
  assert.match(ctx.log.join(" "), /Source quotes: 3 found in the research/);
});

test("A2. KPI and RACI slides are written with their own response schema (every field required, every cell filled)", () => {
  const kpi = G.slideSchema_({ type: "stats", title: "Target KPIs and how they are measured" }, {});
  const it = kpi.properties.slides.items.properties.items.items;
  same(it.required, ["value", "label", "text", "source_quote"]);
  const raci = G.slideSchema_({ type: "table", title: "RACI matrix across workstreams" }, {});
  assert.equal(raci.properties.slides.items.properties.rows.items.items.minLength, 1);
  assert.equal(G.slideSchema_({ type: "cards", title: "Current state" }, {}), null, "other slides keep their designs' own fields");
  const tb = G.tableSchema_(3);
  assert.equal(tb.properties.slides.items.properties.rows.items.items.minLength, 1);
  assert.equal(tb.properties.slides.items.properties.columns.minItems, 3);
});

test("A3. the calls of a part go out together; a call that fails is made again on its own", () => {
  const S = loadAddon(5);
  S.__sent = []; S.__again = 0;
  vm.runInContext(`
    requireVertexConfig_ = function () { return {}; }; buildVertexEndpoint_ = function () { return 'https://vertex/x'; };
    vertexAuthHeaders_ = function () { return { Authorization: 'Bearer t' }; }; contentModel_ = function () { return 'gemini-test'; };
    recordModelUsage_ = function () {}; withContentModel_ = function (c, fn) { return fn(); };
    callGeminiJSON = function () { __again++; return { slides: [{ type: 'cards', title: 'again' }] }; };
    UrlFetchApp = { fetchAll: function (reqs) { __sent.push(reqs); return reqs.map(function (r, i) {
      return { getResponseCode: function () { return i === 1 ? 503 : 200; },
        getContentText: function () { return JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ slides: [{ type: 'cards', title: 'slide ' + i }] }) }] } }] }); } }; }); } };`, S);
  const out = S.callGeminiParallel_([{ parts: [{ text: "a" }], temperature: 0.2, schema: { type: "object" } }, { parts: [{ text: "b" }] }, { parts: [{ text: "c" }] }], { log: [], apiKey: "k" });
  assert.equal(S.__sent.length, 1); assert.equal(S.__sent[0].length, 3);
  assert.ok(JSON.parse(S.__sent[0][0].payload).generationConfig.responseSchema, "the schema goes with its call");
  same(out.map((o) => o.slides[0].title), ["slide 0", "again", "slide 2"]);
  assert.equal(S.__again, 1);
});

test("A4. source quotes: a quote not in the research keeps no figure; risks use mitigation_strategy, never 'Fix:'", () => {
  const ctx = { log: [] };
  const slides = [{ type: "stats", title: "x", items: [{ value: "98.5%", label: "Accuracy", text: "t", source_quote: "an invented quote about accuracy that no source contains at all" }] },
    { type: "cards", title: "Key risks", items: [{ title: "Latency", text: "Slow lookups.", mitigation_strategy: "Fix: cache the frequent lookups." }] }];
  G.prepareWrittenSlides_(slides, ctx, RESEARCH, KROGER);
  assert.ok(!ctx.sourceQuotes || !ctx.sourceQuotes.length);
  assert.equal(slides[1].items[0].fix, "cache the frequent lookups.");
  assert.ok(!("mitigation_strategy" in slides[1].items[0]));
  assert.match(read("src/Quality.gs"), /mitigation as "mitigation_strategy"/);
  assert.match(read("src/Contracts.gs"), /"mitigation_strategy": the mitigation/);
  for (const r of [/never in words/, /exactly as the request gives it/, /never invent names of people/, /source_quote/, /never skip or repeat a label/]) assert.match(G.GEMINI_RULES_, r);
});

test("A5. the outline gets exactly one KPI slide when the request gives targets (the deck keeps its size)", () => {
  const ctx = ctxFor(KROGER);
  const outline = { slides: [
    { type: "section", title: "Current state" }, { type: "cards", title: "Store waste today" }, { type: "cards", title: "Why now" }, { type: "process", title: "Ordering process" },
    { type: "section", title: "Delivery and value" }, { type: "process", title: "Delivery plan" }, { type: "table", title: "Pricing options" }, { type: "process", title: "Next steps" }],
    agendaItems: [{ title: "Current state", points: [] }, { title: "Delivery and value", points: [] }] };
  const before = outline.slides.length;
  assert.equal(G.ensureKpiOutline_(outline, ctx, KROGER), "added");
  const kpis = outline.slides.filter((o) => G.onceTopicOfEntry_(o) === "kpi");
  assert.equal(kpis.length, 1); assert.equal(kpis[0].type, "stats");
  assert.equal(outline.slides.length, before, "one slide of the longest section made room");
  const i = outline.slides.indexOf(kpis[0]), pr = outline.slides.findIndex((o) => /Pricing/.test(o.title));
  assert.ok(i < pr, "before the pricing slide");
  assert.equal(G.ensureKpiOutline_({ slides: [{ type: "cards", title: "x" }] }, { brief: {} }, "A deck about data platforms"), "", "no targets: no KPI slide forced");
  assert.match(read("src/Code.gs"), /ensureKpiOutline_\(outline, ctx, p\.userPrompt\)/);
});

test("A6. sequence labels are written by the code (deck 50 General 2 slide 22: Phase A, B, D)", () => {
  const sp = spec("General", 22);
  G.sequenceLabels_(sp);
  same(sp.items.map((i) => i.date), ["Phase A", "Phase B", "Phase C"]);
  const w = { type: "process", items: [{ title: "Wave 1: pilot" }, { title: "Wave 2: scale" }, { title: "Wave 4: run" }] };
  G.sequenceLabels_(w);
  same(w.items.map((i) => i.title), ["Wave 1: pilot", "Wave 2: scale", "Wave 3: run"]);
  const m = { type: "timeline", items: [{ date: "Month 1" }, { date: "Month 3" }] };
  G.sequenceLabels_(m); same(m.items.map((i) => i.date), ["Month 1", "Month 3"], "months are times, not a sequence");
});

// ---------------- B. Create fixes

test("B1. figures are never cut at a decimal point or after 'U.S.' (Kroger 5 '6B', Mayo 4 'S. 84 hours')", () => {
  same(G.splitSentences_("$147.6B is the largest. In the U.S., physicians average 1.84 hours. Next."), ["$147.6B is the largest. ", "In the U.S., physicians average 1.84 hours. ", "Next."]);
  assert.equal(G.splitSentences_("Kroger: $147.6B in sales, the largest grocery company. More text.").join(""), "Kroger: $147.6B in sales, the largest grocery company. More text.");
  for (const f of ["src/Brief.gs", "src/Engine.gs"]) assert.doesNotMatch(read(f), /match\(\/\[\^\.!\?\]\+\[\.!\?\]\*\(\\s\+\|\$\)\/g\)/, f);
  // the price check takes a whole amount and only on a pricing slide or next to price words
  const ctx = ctxFor(KROGER);
  const sp = { type: "stats", title: "Kroger operational scale", items: [{ value: "$147.6B", label: "Total annual sales", text: "Kroger sold $147.6B last year." }, { value: "2,700+", label: "Stores", text: "x" }, { value: "35", label: "States", text: "y" }] };
  const code = read("src/Code.gs");
  assert.match(code, /\(\?:k\|m\|mn\|b\|bn\|t\|tn\|million\|billion\|trillion\)\?\(\?!\[\\w\.\]\)/);   // (V.1_80: and T)
  assert.match(code, /if \(!pricingHere && !PRICE_CTX\.test\(x\)\) return x;/);
  assert.ok(sp && ctx);
});

test("B2. figures as digits, targets as the request wrote them, no invented people", () => {
  assert.equal(G.wordsToDigits_("Achieving twenty-five percent spoilage reduction"), "Achieving 25% spoilage reduction");
  assert.equal(G.wordsToDigits_("One hundred twenty million dollar savings breakdown"), "$120M savings breakdown");
  assert.equal(G.wordsToDigits_("15 percent fewer missed connections"), "15% fewer missed connections");
  assert.equal(G.wordsToDigits_("Three operational friction points"), "Three operational friction points");
  const ctx = { log: [], userPrompt: "Targets: 2 hours saved per clinician per week, under 1% transcription error and HIPAA-aligned controls." };
  const sl = [{ type: "cards", title: "Achieving under 1% transcription errors", items: [{ title: "x", text: "We target a word error rate under 0.9%, exceeding your threshold." }] }];
  G.targetsExact_(sl, ctx);
  assert.match(sl[0].items[0].text, /under 1%/);
  const sl2 = [{ type: "cards", title: "Building on foundations", lead: "This initiative accelerates the backbone under Willem Uijen's vision.", items: [] }];
  G.inventedPeople_(sl2, { log: [], userPrompt: "Unilever forecasting" }, RESEARCH);
  assert.doesNotMatch(sl2[0].lead, /Willem/);
  assert.match(sl2[0].lead, /in line with the client's vision/);
});

test("B3. names in their maker's case (gRPC, mTLS, KEDA, FNOL, Avro, Vertex AI) and as the sources write them (Hellmann's)", () => {
  assert.equal(G.productCase_("GRPC bidirectional streaming"), "gRPC bidirectional streaming");
  assert.equal(G.productCase_("MTLS between claims pods"), "mTLS between claims pods");
  assert.equal(G.productCase_("Keda polls unacknowledged fnol messages"), "KEDA polls unacknowledged FNOL messages");
  assert.equal(G.productCase_("Validate avro schema"), "Validate Avro schema");
  assert.equal(G.productCase_("policy: vertex AI Search pulls fare rules"), "policy: Vertex AI Search pulls fare rules");
  assert.equal(G.productCase_("cloud storage costs"), "cloud storage costs");
  const o = draw({ type: "cards", title: "Streaming", items: [{ title: "gRPC streaming", text: "gRPC connections stay open." }, { title: "b", text: "c" }, { title: "d", text: "e" }] });
  assert.ok(texts(o).some((t) => /^gRPC/.test(t)) && !texts(o).some((t) => /GRPC/.test(t)));
  const sl = [{ type: "cards", title: "x", items: [{ title: "Dove and hellmann's scale", text: "t" }], notes: "Brands such as Dove and Hellmann's grew. Sales of Hellmann's rose." }];
  G.nameCaseFromSources_(sl, { userPrompt: "x" }, { research: [] });
  assert.equal(sl[0].items[0].title, "Dove and Hellmann's scale");
});

test("B4. RACI roles each with their capital; credentials one way; no repeated words; no generic headings", () => {
  assert.equal(G.raciCell_("Responsible / accountable"), "Responsible / Accountable");
  assert.equal(G.raciCell_("Joint Responsible (R)"), "Responsible");
  assert.match(read("src/Contracts.gs"), /const roleOut = role;/);
  assert.equal(G.credentialsForm_("supported by a 600+ strong global footprint of cloud experts"), "supported by a team of 350+ technical experts");
  assert.equal(G.credentialsForm_("Delivered 1000+ transformation projects"), "Delivered 1,000+ transformation projects");
  assert.equal(G.repeatedWords_("via Google Cloud Cloud Healthcare API"), "via Google Cloud Healthcare API");
  const p14 = spec("Proposal", 14);
  G.genericItemTitles_(p14);
  assert.ok(p14.items.every((it) => !/^(Bar|Industry)$/.test(it.title)), JSON.stringify(p14.items.map((i) => i.title)));
  const team = { type: "process", items: [{ title: "Joint Executive Steering Committee", text: "x" }] };
  G.nestedHeadingsCase_(team);
  assert.equal(team.items[0].title, "Joint executive steering committee");
  assert.equal(G.trailingPunct_("Integrating retailer POS velocity,", "title"), "Integrating retailer POS velocity");
});

test("B5. a product's pricing is not the commercial pricing slide (Northwind 29)", () => {
  assert.equal(G.onceTopicOf_("BigQuery slot reservations vs on-demand query pricing"), "");
  assert.equal(G.onceTopicOf_("Commercial pricing options and models"), "pricing");
  assert.equal(G.isCommercialPricing_("Pricing options"), true);
  assert.equal(G.isCommercialPricing_("BigQuery slot reservations vs on-demand query pricing"), false);
  assert.match(read("src/Brief.gs"), /TECH_PRICING_RE_\.test\(String\(sp\.title/);
});

test("B6. dark rule: a dark-only Solution design never makes a 4th dark slide or sits after a dark divider", () => {
  const sp = { type: "process", title: "Security architecture", reference: { tag: "S66_U_JOURNEY" }, items: [{ title: "Cloud KMS", text: "Keys" }, { title: "Workload Identity", text: "No keys" }, { title: "VPC-SC", text: "Perimeter" }] };
  assert.equal(G.solutionForceLight_(sp), true);
  assert.equal(sp.type, "cards"); assert.equal(sp.reference, null);
  assert.match(read("src/SolutionKit.gs"), /solutionLightInstead_\(sp\) \|\| solutionLightInstead_\(sp, 0\.5\) \|\| solutionForceLight_\(sp\)/);
  assert.match(read("src/Code.gs"), /the dark rule is a rule - with no light design of its type, the items are drawn as light cards/);
});

test("B7. dividers: every Proposal / Solution divider shows its line; titles fit whole (agenda and divider the same)", () => {
  const o = draw({ type: "section", deckLibrary: "proposal", title: "Delivery approach", lead: "Phases, team and change enablement", reference: { tag: "P66_SECTION_DARK" }, lockTag: "P66_SECTION_DARK", number: "04" });
  assert.ok(texts(o).includes("Phases, team and change enablement"), JSON.stringify(texts(o)));
  assert.equal(G.topicsLead_(["Scope and boundaries", "Delivery plan", "RACI matrix"]), "Scope and boundaries, delivery plan and RACI matrix");
  assert.equal(G.fitSectionTitle_("Target Google Cloud demand forecasting and multi-variable data platforms for planners"), "Target Google Cloud demand forecasting");
  assert.equal(G.sectionNameOf_(["Enterprise data security and governance on", "ERP integration"]), "Enterprise data security and governance and ERP integration");
  assert.equal(G.proposalShort_("Target Google Cloud demand forecasting and multi-variable data", 80), "Target Google Cloud demand forecasting and multi-variable data");
  assert.equal(G.trimDangling_("Governance on and"), "Governance");
});

test("B8. a slide sits in the section named for its topic (Northwind 11 monitoring)", () => {
  const secs = [
    { title: "Current architecture and ingestion", list: [{ type: "cards", title: "Batch bottlenecks" }, { type: "cards", title: "Pub/Sub design" }, { type: "cards", title: "Monitoring and alerting across the platform" }] },
    { title: "Sizing, security and monitoring", list: [{ type: "cards", title: "Security architecture" }, { type: "table", title: "Infrastructure sizing" }] }];
  assert.equal(G.topicHomes_(secs, { log: [] }), 1);
  assert.ok(secs[1].list.some((o) => /Monitoring/.test(o.title)));
  assert.equal(secs[0].list.length, 2);
});

test("B9. no fake curve; tables as rows keep their headings; unverified shares leave the slide text", () => {
  const curve = { type: "process", title: "In-flight geofence detection", reference: { tag: "S66_VALUE_CURVE" }, deckLibrary: "solution",
    items: [{ label: "Dataflow broadcast view", title: "Ingest", points: ["Load route side inputs"] }, { label: "Stateful DoFn", title: "Evaluate", points: ["Compare GPS to corridors"] }, { label: "Exception routing", title: "Alert", points: ["Publish ETA breaches"] }] };
  const o = draw(curve);
  assert.ok(!texts(o).includes("Value") && !texts(o).includes("Time"), JSON.stringify(texts(o)));
  const sp = { type: "table", title: "Slot reservations vs on-demand", columns: ["Factor", "Slot reservations", "On-demand"], rows: [["Cost", "Predictable baseline spend", "Unbounded scan charges"], ["Scaling", "Autoscaling slots", "Shared pool"], ["Isolation", "Dedicated pools", "No isolation"]] };
  G.solutionRescue_(sp);
  // (V.1_80: a 3+ column table is read by its columns - each option keeps its own points)
  assert.match(JSON.stringify(sp), /"title":"Slot reservations","points":\["Cost: predictable baseline spend","Scaling: autoscaling slots"/);
  const ctx = { userPrompt: "x", brief: { figures: [] } };
  const s2 = [{ type: "cards", title: "Path to lower inventory", items: [{ title: "a", text: "Planners hit 98.5% service levels while cutting buffers. Overrides fall." }, { title: "b", text: "c" }] }];
  G.flagUnverifiedFigures_(s2, { research: [{ text: "x".repeat(300) }] }, [], ctx);
  assert.doesNotMatch(s2[0].items[0].text, /98\.5%/); assert.match(s2[0].notes, /Figures left out .*98\.5%/);
});

// ---------------- C. Rebrand

test("C1. a rebrand keeps every word (never the 160-character copy) and the design of its content slides", () => {
  const long = "Compares data outcomes between legacy PL/SQL execution and modernized .NET microservice pathways. QA executes endpoints, captures JSON responses, and compares them 1:1 against live test database data.";
  const sp = { type: "cards", items: [{ title: "API parity testing", text: long }] };
  G.keepOriginalWording_(sp, { texts: [{ text: long.slice(0, 160), full: long }] });
  assert.equal(sp.items[0].text, long);
  const code = read("src/Rebrand.gs");
  assert.match(code, /full: txt, x: Math\.round/);
  assert.match(code, /a rebrand does not redraw content slides/);
  assert.match(code, /holdsIcon/);
  assert.match(code, /box: ic\.box \|\| \{ x: bb\.x, y: bb\.y, w: bb\.w, h: bb\.h \}/);
});

test("C2. cover: names keep their capitals and the facts break between facts; closing: Author / Target on their own line", () => {
  assert.equal(G.capsLabel_("66DEGREES & FRONTDOOR"), "66degrees & Frontdoor");
  const lines = G.factsLines_(["66degrees & Frontdoor", "QA Strategy & Delivery", "52 PL/SQL Objects in Scope", "Karate API Automation", "1:1 Oracle Data Parity"]);
  lines.split("\n").forEach((ln) => assert.doesNotMatch(ln, /·\s*$|^\s*·/));
  const o = draw({ type: "closing", keepTitle: true, title: "Phase 1 strategy ready for review", subtitle: "Aligned for delivery.", facts: ["Author: R · Target: 28/09/2026 - 07/12/2026"] });
  assert.ok(texts(o).includes("Author: R · Target: 28/09/2026 - 07/12/2026"));
  assert.match(read("src/Rebrand.gs"), /\(author\|target\|prepared by\|presented by\|date\|contact\)\\s\*:/);
});

test("C3. short content sits a little above the middle; icons move with it; the mark keeps clear; the check sees icons on text", () => {
  const S = 960 / 720;
  let seq = 0;
  const box = (text, x, y, w, h, size) => ({ objectId: "t79_" + (++seq), size: { width: { magnitude: w * 12700 }, height: { magnitude: h * 12700 } },
    transform: { scaleX: 1, scaleY: 1, translateX: x * 12700, translateY: y * 12700 },
    shape: { shapeType: "TEXT_BOX", shapeProperties: {}, text: { textElements: [{ paragraphMarker: { style: {} } }, { textRun: { content: text + "\n", style: { fontSize: { magnitude: size } } } }] } } });
  const title = box("Exit Criteria", 60, 39, 900, 32.4, 27);
  const a = box("100% Test execution", 60, 300, 300, 21, 13), b = box("All planned tests executed", 60, 330, 300, 40, 10);
  const roles = G.detectRoles({ pageElements: [title, a, b] }, {}, 960, 540, S, {});
  const reqs = [];
  const dy = G.liftContent_(reqs, { pageElements: [title, a, b] }, roles, {}, S, 960, 540);
  const target = Math.max(62 * S, 16.6 * S + 32.4 + 16 * S);
  assert.ok(dy > 0 && 300 - dy > target + 20, "moved up, not to the very top: " + dy);
  const code = read("src/Rebrand.gs");
  assert.match(code, /c\.box\.y >= lineY/);
  assert.match(code, /pushes the mark left/);
  assert.match(code, /an icon sits on "/);
  assert.match(read("src/UsageLog.gs"), /'icon-on-text'/);
});
