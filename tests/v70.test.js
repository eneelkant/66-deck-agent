"use strict";

// V.1_70 - step 1: the request is the source of truth, for every deck type (General, Solution, Proposal, HR...)
//  1. the brief: the request is read once (Gemini, temperature 0, checked by the code; the code alone when Gemini is not
//     reachable) into the client, the slide count, the topics, the figures in order, the prices
//  2. the brief goes into every prompt that writes slides, and with every part of a long deck
//  3. the figure check: a figure stays only when the brief, the request, the files, the approved facts or the research
//     back it (research: its source number goes in the notes); 100% uptime / SLA never stays; stray "Amber."
//  4. KPI slides: the brief's figures in its order, the label does not say the figure again, every tile has its text
//  5. one measure, one figure across the deck (1.5 billion daily / 1.6 billion weekly)
//  6. lower temperatures; dark content slides: at most 3, never next to another dark slide or a dark divider
// The fixtures are the slides of the three V.1_69 test decks (deck 42) that showed each issue.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const all = (sp) => JSON.stringify(Object.assign({}, sp, { notes: "" }));

const SOL = "Create a 30-slide solution deck for Contoso Health: SQL Server high availability across two Google Cloud regions. Targets: 99.95% uptime, recovery under 15 minutes and 40% fewer incidents. Include the current architecture and its failure points, sizing and configuration, monitoring, deployment, security, runbooks, risks and next steps.";
const PRO = "Create a 30-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 30-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const RESEARCH = [{ n: 3, title: "ZoomInfo company facts", findings: ["ZoomInfo processes 1.5 billion data points daily", "150 million contact profiles"] },
  { n: 4, title: "Data management productivity study (2025)", findings: ["unified data management gives 38% higher engineering productivity"] }];
const ctxFor = (prompt, extra) => {
  const ctx = Object.assign({ log: [], userPrompt: prompt, approvedFacts: [{ text: "4x Google Cloud Partner of the Year" }, { text: "1,000+ transformation projects" }], brand: { name: "66degrees" } }, extra || {});
  ctx.brief = G.briefFromText_(prompt, 30);
  return ctx;
};

test("version label is V.1_70 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7\d|[8-9]\d)'/);
  assert.ok(JSON.parse(read(".clasp.json")).filePushOrder.includes("Brief.gs"));
});

test("1. the brief: figures in the request's order, topics, prices, client - Gemini checked by the code", () => {
  const b = G.briefFromText_(PRO, 30);
  same(b.figures.map((f) => f.value), ["50%", "95%", "30%"]);
  assert.equal(b.client.domain, "bestbuy.com");
  same(b.prices, []);
  ["scope", "raci", "team", "risks", "support", "pricing", "next"].forEach((f) => assert.ok(b.families.includes(f), f));
  same(G.briefFromText_(SOL, 30).figures.map((f) => f.value.replace(/\s/g, "")), ["99.95%", "<15min", "40%"]);
  // Gemini's brief: a figure that is not in the request is dropped; one Gemini missed is added; the request's order wins
  const g = { client: { name: "Best Buy", domain: "bestbuy.com" }, topics: ["scope", "team structure", "RACI", "50% faster"],
    figures: [{ value: "95%", measure: "data quality pass rate", kind: "target" }, { value: "5,200 hours", measure: "hours saved", kind: "fact" }, { value: "50%", measure: "faster report builds", kind: "target" }],
    prices: ["$2M"], facts: ["Dataplex", "Looker"] };
  const m = G.mergeBrief_(b, g, PRO, "");
  same(m.figures.map((f) => f.value), ["50%", "95%", "30%"]);
  assert.equal(m.client.name, "Best Buy");
  same(m.topics, ["scope", "team structure", "RACI"], "a figure is never a topic");
  same(m.prices, [], "a price the request does not give is not a price");
  // through Gemini (stubbed): never fails, and falls back to the code when Gemini is not reachable
  const real = G.callGeminiJSON;
  G.callGeminiJSON = () => g;
  const viaGemini = G.buildBrief_(PRO, { text: "" }, { log: [], apiKey: "x" }, 30);
  G.callGeminiJSON = () => { throw new Error("offline"); };
  const ctxOff = { log: [], apiKey: "x" };
  const offline = G.buildBrief_(PRO, { text: "" }, ctxOff, 30);
  G.callGeminiJSON = real;
  assert.equal(viaGemini.source, "gemini");
  same(viaGemini.figures.map((f) => f.value), ["50%", "95%", "30%"]);
  assert.equal(offline.source, "code");
  same(offline.figures.map((f) => f.value), ["50%", "95%", "30%"]);
  assert.ok(ctxOff.log.some((l) => /Brief: read by the code/.test(l)));
});

test("2. the brief is in every prompt that writes slides and goes with every part of a long deck", () => {
  const code = read("src/Code.gs");
  assert.match(code, /REQUEST: "\$\{userPrompt[^\n]*\n\$\{typeof briefPromptBlock_ === 'function' \? briefPromptBlock_\(ctx\) : ''\}/);
  assert.match(code, /typeof briefPromptBlock_ === 'function' \? briefPromptBlock_\(ctx\) : '',\s+\/\/ V\.1_70/);
  assert.match(code, /brief: ctx\.brief \|\| null, outline: outline/);
  assert.match(code, /if \(st\.brief\) ctx\.brief = st\.brief;/);
  assert.ok(code.indexOf("ctx.brief = buildBrief_(userPrompt, sources, ctx, totalSlides)") < code.indexOf("return startLongDeck_(ctx, target"), "built before a long deck starts");
  const block = G.briefPromptBlock_(ctxFor(PRO));
  assert.match(block, /Target figures, in this order[^\n]*50% faster report builds; 95%[^\n]*; 30% lower platform run cost/);
  assert.match(block, /No prices are given/);
  assert.match(block, /Never 100% uptime, availability or SLA/);
  // the figure check runs twice in both paths: after the content is written and just before the notes and drawing
  assert.equal((code.match(/deckFigureCheck_\(plan\.slides, ctx, (st\.)?sources\);/g) || []).length, 4);
});

test("3. figures without a source leave the slide; research figures stay with their source in the notes", () => {
  // Proposal 6: "38% · Industry benchmark: engineering productivity" (research [4]), headings "Industry benchmark: ..." with no figure
  const p6 = { type: "cards", title: "The industry cost of ungoverned data and legacy BI", lead: "Enterprise benchmarks show substantial financial drag from poor data quality and fragmented lakes.",
    items: [{ title: "Industry benchmark: annual quality cost", text: "Average annual enterprise cost of poor data quality in wasted labor and operational errors across ungoverned systems." },
      { title: "51% · 5-year TCO reduction", text: "Consolidating fragmented workloads onto Google Cloud reduces total operational expenditure over a five-year horizon." },
      { title: "38% · Industry benchmark: engineering productivity", text: "Data engineering productivity gain achieved through unified data management." }], notes: "" };
  G.guardFigures_([p6], ctxFor(PRO), { research: RESEARCH });
  same(p6.items.map((i) => i.title), ["Annual quality cost", "5-year TCO reduction", "38% · Industry benchmark: engineering productivity"]);
  assert.match(p6.notes, /Figures on this slide: from source 4 in the Sources list \[4\]/);
  assert.match(p6.notes, /Figures left out[^\n]*51%/);

  // Proposal 12: "Industry benchmark: 5,200 hours saved annually ..." (no source) - the point goes, the list keeps the rest
  const p12 = { type: "bullets", title: "Accelerating report builds by 50% with Looker", points: ["Centralized metric definitions eliminate repetitive SQL rewrites across teams",
    "Self-service exploration empowers merchandising teams to answer ad-hoc questions", "Version-controlled Git workflows enable parallel collaborative BI development",
    "Industry benchmark: 5,200 hours saved annually in analyst and engineering time"], notes: "" };
  G.guardFigures_([p12], ctxFor(PRO), { research: RESEARCH });
  assert.equal(p12.points.length, 3);
  assert.ok(!all(p12).includes("5,200"));
  assert.equal(p12.title, "Accelerating report builds by 50% with Looker", "a figure of the request stays");

  // General 17: "$1.0M in legacy platform license retirements and $1.9M in labour savings" - no price was given
  const g17 = { type: "comparison", title: "Current cost distribution versus optimised cloud spend", right: { label: "Optimised Google Cloud state", points: ["Consolidated compute on BigQuery with autoscaling slots",
    "Single-copy Apache Iceberg tables on Cloud Storage", "Zero-copy data sharing via Analytics Hub", "Up to $1.0M in legacy platform license retirements and $1.9M in labour savings"] }, notes: "" };
  G.guardFigures_([g17], ctxFor(GEN), { research: RESEARCH });
  assert.ok(!/\$1\.[09]M/.test(all(g17)));

  // General 15: "5,200 hours saved annually" tile and "38% productivity" (research) in one text
  const g15 = { type: "bullets", title: "Engineering scope for analytical query overhaul", callout: { title: "5,200 hours saved annually",
    text: "Organisations migrating to BigQuery and Looker save 5,200 hours annually in data engineering. Unified data management achieves a 38% engineering productivity gain." }, notes: "" };
  g15.lead = "Unified data management achieves a 38% engineering productivity gain.";
  G.guardFigures_([g15], ctxFor(GEN), { research: RESEARCH });
  assert.ok(!all(g15).includes("5,200"), all(g15));
  assert.equal(g15.callout, undefined, "a callout whose heading is a figure without a source goes whole");
  assert.ok(g15.lead.includes("38%"), "a research figure stays");
  assert.match(g15.notes, /Figures on this slide: from source 4 in the Sources list \[4\]/);

  // approved 66degrees facts stay
  const g27 = { type: "cards", title: "Why 66degrees", items: [{ title: "Recognised partner", text: "4x Google Cloud Partner of the Year." }, { title: "Proven delivery", text: "More than 1,000 transformation projects." }], notes: "" };
  G.guardFigures_([g27], ctxFor(GEN), { research: [] });
  assert.ok(all(g27).includes("4x") && all(g27).includes("1,000"));
});

test("3. 100% uptime / SLA never stays; stray status words go (Solution 4, 8, 27)", () => {
  const s4 = { type: "cards", title: "Current architecture and its failure points", items: [
    { title: "Single-zone database hosting vulnerability", text: "Migrate to multi-zone Compute Engine VMs backed by a 100% monthly uptime SLA. Amber." },
    { title: "Lack of cross-region disaster recovery replica", text: "Deploy an asynchronous Always On Availability Group replica in a secondary Google Cloud region. Amber." }], notes: "" };
  G.guardFigures_([s4], ctxFor(SOL), { research: [] });
  assert.ok(!all(s4).includes("100%"));
  assert.ok(!/Amber/.test(all(s4)));
  const s27 = { type: "stats", title: "Chaos engineering and GameDay validation", items: [{ value: "30-120s", label: "Intra-region zone failover window" }, { value: "100%", label: "Compute Engine multi-zone SLA" }, { value: "99.95%", label: "Uptime target" }], notes: "" };
  G.guardFigures_([s27], ctxFor(SOL), { research: [] });
  // (V.1_71: "30-120s" is a time the request and the sources do not give, so it goes too - see v71.test.js)
  assert.ok(!all(s27).includes("100%") && all(s27).includes("99.95%"), all(s27));
  // "routing 100% of contact center logs" is not a service-level claim
  const ok = { type: "cards", title: "Customer care data", items: [{ title: "All logs", text: "Routing 100% of contact center logs into BigQuery." }], notes: "" };
  G.guardFigures_([ok], ctxFor("Route 100% of contact center logs into BigQuery."), { research: [] });
  assert.ok(all(ok).includes("100%"));
});

test("3. a chart of invented figures is not drawn as a chart (General 10)", () => {
  const g10 = { type: "chart", title: "Query latency and throughput performance", chart: { kind: "bar", categories: ["Contact", "Intent", "Cube sync", "Bulk export"],
    series: [{ name: "Legacy SQL", values: [120, 85, 40, 25] }, { name: "BQ slots", values: [360, 255, 120, 75] }] }, notes: "" };
  G.guardFigures_([g10], ctxFor(GEN), { research: RESEARCH });
  assert.equal(g10.type, "cards");
  same(g10.items.map((i) => i.title), ["Contact", "Intent", "Cube sync", "Bulk export"]);
  assert.equal(g10.chart, undefined);
});

test("4. KPI slides: the brief's figures in its order, the label does not repeat the figure (Proposal 7)", () => {
  const p7 = { type: "stats", title: "Target success KPIs for Best Buy", items: [
    { value: "95%", label: "Data quality pass rate", text: "Achieve a 95% automated data quality pass rate across retail domains using Dataplex profiling and validation rules." },
    { value: "50%", label: "50% faster report builds", text: "Looker semantic modeling and unified retail datasets reduce analyst preparation time." },
    { value: "30%", label: "30% lower platform run cost", text: "Consolidating legacy data silos onto BigQuery reduces overall infrastructure spend." }] };
  const plan = { slides: [p7] };
  G.normalizeShapes_(plan, ctxFor(PRO));
  same(p7.items.map((i) => i.value), ["50%", "95%", "30%"]);
  same(p7.items.map((i) => i.label), ["Faster report builds", "Data quality pass rate", "Lower platform run cost"]);
  // a tile with its figure and no text gets one sentence (no new figures), in every deck type
  const s5 = { type: "stats", title: "Target uptime, recovery and incident reduction KPIs", items: [{ value: "99.95%", label: "Uptime", text: "" },
    { value: "< 15 min", label: "Target cross-region recovery time", text: "Achieved using an asynchronous commit SQL Server replica in the disaster recovery region." }, { value: "40%", label: "Fewer incidents", text: "" }] };
  const real = G.callGeminiJSON;
  let asked = "";
  G.callGeminiJSON = (parts) => { asked = parts[0].text; return { fixes: [{ id: 0, add: ["Measured monthly across both regions by Cloud Monitoring uptime checks.", "-", "Tracked as the incident count before and after cutover."] }] }; };
  G.fillThinSlides_({ slides: [s5] }, ctxFor(SOL, { apiKey: "x" }), { textsOnly: true });
  G.callGeminiJSON = real;
  assert.match(asked, /kind "kpitexts"/);
  assert.match(asked, /use ONLY these target figures from the request, in this order: 99\.95% uptime/);
  assert.ok(s5.items[0].text.length > 20 && s5.items[2].text.length > 20);
  assert.match(s5.items[1].text, /^Achieved using/, "a tile with its text keeps it");
});

test("5. one measure, one figure across the deck (General 13: 1.5 billion daily / 1.6 billion weekly)", () => {
  const a = { type: "statement", title: "Instant access across massive contact profiles", lead: "Processing 1.5 billion records daily requires millisecond analytics.", text: "Processing 1.6 billion records weekly across hybrid engines creates bottlenecks.", notes: "" };
  const b = { type: "cards", title: "Real-time intent ingestion", items: [{ title: "Ingest", text: "Ingest 1.6 billion records weekly into queryable storage." }], notes: "" };
  const ctx = ctxFor("ZoomInfo processes 1.5 billion records daily on Google Cloud.");
  G.sameMeasureFigures_([a, b], ctx);
  assert.ok(!all(a).includes("1.6 billion") && !all(b).includes("1.6 billion"), all(a) + all(b));
  // with no figure from the request, nothing is changed: the notes ask to check
  const c = { type: "cards", title: "x", items: [{ title: "a", text: "2 billion records daily." }, { title: "b", text: "3 billion records weekly." }], notes: "" };
  G.sameMeasureFigures_([c], ctxFor("no figures"));
  assert.match(c.notes, /Check before sharing: one measure with different figures/);
});

test("6. lower temperatures for slide JSON; dark content slides: at most 3, never next to a dark slide or divider", () => {
  const code = read("src/Code.gs");
  assert.match(code, /callGeminiJSON\(parts, ctx\.apiKey, usePlanner \? 0\.1 : 0\.2\)/);
  assert.match(code, /callGeminiJSON\(parts, ctx\.apiKey, libOutline \? 0\.2 : 0\.3\)/);
  assert.doesNotMatch(code, /callGeminiJSON\(\[\{ text: (prompt|topPrompt) \}\], ctx\.apiKey, 0\.6\)/);
  assert.match(read("src/Brief.gs"), /callGeminiJSON\(\[\{ text: briefPrompt_\(prompt, files, slideCount\) \}\], ctx && ctx\.apiKey, 0,/);   // (V.1_72: and its schema)
  const ok = vm.runInContext("darkContentAllowed_", G);
  assert.equal(ok(false, false, 0, 4), true);
  assert.equal(ok(true, false, 0, 4), false, "after a dark slide or divider");
  assert.equal(ok(false, true, 0, 4), false, "before a dark divider");
  assert.equal(ok(false, false, 3, 4), false, "three already");
  assert.match(code, /if \(m\.dark && !darkContentAllowed_\(prevDark, nextDark, darkUsed, darkMax\)\) score -= 400;/);
  assert.match(code, /prevDark = type === 'section';\s+\/\/ V\.1_70/);
});

test("release gate: the figure check never empties a slide of the deck-41 log and keeps every figure of the requests", () => {
  const LOG = JSON.parse(read("tests/fixtures/deck41-slide-log.json"));
  const ctx = ctxFor(SOL + " " + PRO + " " + GEN);
  LOG.forEach((r) => {
    const sp = JSON.parse(r.spec_json);
    const before = JSON.stringify(sp);
    G.guardFigures_([sp], ctx, { research: [] });
    assert.ok(String(sp.title || "").trim(), r.slide_no + " keeps its title");
    if (Array.isArray(sp.items)) assert.ok(sp.items.length >= Math.min(2, JSON.parse(before).items.length), r.deck_category + " " + r.slide_no + " keeps its items");
    ["99.95%", "40%", "50%", "95%", "30%", "99.9%", "35%"].forEach((f) => { if (before.includes('"value":"' + f + '"')) assert.ok(JSON.stringify(sp).includes(f), f + " kept on " + r.slide_no); });
  });
});
