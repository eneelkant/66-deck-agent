"use strict";

// V.1_72 - step 3 (each slide kind in the shape its designs need, with a response schema) + the issues of the V.1_71
// test decks (deck 43), for every deck type
//  S1. Brand.gs callGeminiJSON: an optional response schema; a call without one sends exactly what it sent before; a model
//      that refuses the schema is asked again without it
//  S2. the slide contracts: KPI and pricing slides put in shape by the code, RACI / team / risks / next steps written
//      again by Gemini with the schema, used only when the answer passes the contract
//  S3. the brief is asked with its schema
//  1-13. the deck-43 fixes
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const V = (name) => vm.runInContext(name, G);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const LOG = JSON.parse(read("tests/fixtures/deck43-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const texts = (o) => o.els.filter((e) => e.text && typeof e.text === "string").map((e) => String(e.text));
const all = (sp) => JSON.stringify(Object.assign({}, sp, { notes: "" }));
const NUMS = ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "cx", "cy", "r", "size"];

const SOL = "Create a 30-slide solution deck for Contoso Health: SQL Server high availability across two Google Cloud regions. Targets: 99.95% uptime, recovery under 15 minutes and 40% fewer incidents. Include the current architecture and its failure points, sizing and configuration, monitoring, deployment, security, runbooks, risks and next steps.";
const PRO = "Create a 30-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 30-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (prompt, extra) => { const c = Object.assign({ log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }, extra || {}); c.brief = G.briefFromText_(prompt, 30); return c; };

test("version label is V.1_72 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[2-9]|[8-9]\d)'/);
  assert.ok(JSON.parse(read(".clasp.json")).filePushOrder.includes("Contracts.gs"));
});

test("S1. callGeminiJSON: the schema is sent when given; without it the call is unchanged; a refused schema is dropped once", () => {
  const sent = [];
  const realV = G.callVertexGemini_, realR = G.requireVertexConfig_, realM = G.modelCandidates;
  G.requireVertexConfig_ = () => {};
  G.modelCandidates = () => ["gemini-test"];
  const ok = { result: { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] } };
  G.callVertexGemini_ = (payload) => { sent.push(JSON.parse(JSON.stringify(payload.generationConfig))); return ok; };
  G.callGeminiJSON([{ text: "x" }], "k", 0.2);
  assert.equal(sent[0].responseSchema, undefined, "no schema: the same request as before");
  same(Object.keys(sent[0]).filter((k) => k !== "thinkingConfig").sort(), ["responseMimeType", "temperature"]);
  sent.length = 0;
  const schema = { type: "OBJECT", properties: { a: { type: "INTEGER" } } };
  same(G.callGeminiJSON([{ text: "x" }], "k", 0.2, { schema }), { a: 1 });
  same(sent[0].responseSchema, schema);
  // a model that refuses the schema: asked again without it, and the deck goes on
  sent.length = 0;
  let calls = 0;
  G.callVertexGemini_ = (payload) => { calls++; sent.push(JSON.parse(JSON.stringify(payload.generationConfig))); if (payload.generationConfig.responseSchema) throw new Error("Vertex AI error 400: Invalid JSON payload received. Unknown name \"responseSchema\""); return ok; };
  same(G.callGeminiJSON([{ text: "x" }], "k", 0.2, { schema }), { a: 1 });
  assert.equal(calls, 2);
  assert.ok(sent[0].responseSchema && !sent[1].responseSchema);
  G.callVertexGemini_ = realV; G.requireVertexConfig_ = realR; G.modelCandidates = realM;
});

test("S2/1. a KPI slide written as cards without figures becomes the request's figures, in order (Proposal 8)", () => {
  const ctx = ctxFor(PRO);
  const p8 = spec("Pro", 8);
  assert.equal(G.contractKind_(p8, ctx), "kpi");
  G.conformSlides_([p8], ctx);
  assert.equal(p8.type, "stats");
  same(p8.items.map((i) => i.value), ["50%", "95%", "30%"]);
  assert.ok(p8.items.every((i) => i.text.length > 30), "each tile keeps the text of the card it matches");
  assert.doesNotMatch(p8.items.map((i) => i.label).join(" "), /target:|\d%/i);
  // drawn: the figures are on the slide
  const t = texts(G.ENGINE.render({ slides: [p8] }, { dateLabel: "x" })[0]);
  ["50%", "95%", "30%"].forEach((v) => assert.ok(t.includes(v), v));
});

test("S2/13. a pricing slide says it is pricing and how pricing is settled (Proposal 27)", () => {
  const ctx = ctxFor(PRO);
  const p27 = spec("Pro", 27);
  assert.equal(G.contractKind_(p27, ctx), "pricing");
  G.conformSlides_([p27], ctx);
  assert.match(p27.title, /^Pricing options: /);
  assert.equal(p27.takeaway, "Pricing is confirmed after the scoping workshop.");
});

test("S2. RACI / team / risks / next steps out of shape are written again with the schema; an answer out of shape is not used", () => {
  const ctx = ctxFor(PRO, { apiKey: "k" });
  const raci = { type: "cards", title: "RACI matrix for delivery", items: [{ title: "Best Buy", text: "Approves scope." }, { title: "66degrees", text: "Builds the platform." }] };
  const team = { type: "cards", title: "Joint team structure", items: [{ title: "Sponsor", text: "Owns it." }] };
  let askedSchema = null, prompt = "";
  const realC = G.callGeminiJSON, realW = G.withContentModel_;
  G.withContentModel_ = (c, fn) => fn();
  G.callGeminiJSON = (parts, k, t, opts) => {
    askedSchema = opts && opts.schema; prompt = parts[0].text;
    return { slides: [
      { id: 0, title: "RACI matrix for delivery", columns: ["Workstream", "66degrees", "Best Buy IT", "Best Buy business"],
        rows: [["Architecture", "Responsible", "Accountable", "Consulted"], ["Pipelines", "Responsible", "Consulted", "Informed"], ["Looker models", "Responsible", "Consulted", "Accountable"], ["Cutover", "Responsible", "Accountable", "Informed"]] },
      { id: 1, title: "Joint team structure", items: [{ title: "Sponsor", text: "short" }] }] };
  };
  const n = G.conformSlides_([raci, team], ctx);
  G.callGeminiJSON = realC; G.withContentModel_ = realW;
  same(askedSchema, JSON.parse(JSON.stringify(V("CONTRACT_SCHEMA_"))));
  assert.match(prompt, /FIXED BRIEF/);
  assert.equal(n, 1);
  assert.equal(raci.type, "table");
  same(raci.columns, ["Workstream", "66degrees", "Best Buy IT", "Best Buy business"]);
  assert.equal(team.items.length, 1, "an answer that misses the contract is not used");
  // the contracts themselves
  assert.deepEqual(G.contractGaps_({ type: "table", title: "RACI", columns: ["W", "A", "B"], rows: [["x", "Responsible", "Informed"], ["y", "Accountable", "Consulted"], ["z", "R", "A / C"]] }, "raci", ctx).length, 0);
  assert.ok(G.contractGaps_({ type: "table", columns: ["W", "A", "B"], rows: [["x", "Builds pipelines", "Informed"], ["y", "R", "C"], ["z", "R", "A"]] }, "raci", ctx).length);
});

test("S3. the brief is asked with its schema", () => {
  assert.match(read("src/Brief.gs"), /\{ schema: BRIEF_SCHEMA_ \}/);
  let got = null;
  const real = G.callGeminiJSON;
  G.callGeminiJSON = (p, k, t, o) => { got = o; return { topics: [], figures: [], prices: [] }; };
  G.buildBrief_(PRO, { text: "" }, { log: [], apiKey: "k" }, 30);
  G.callGeminiJSON = real;
  assert.ok(got && got.schema && got.schema.properties.figures);
});

test("2. the figure check never leaves 'baseline: of' (Solution 6)", () => {
  const s6 = { type: "cards", title: "Historical incident analysis", items: [{ title: "Outages from OS patching", text: "Contoso Health baseline: 42% of historical unplanned database outages originated from manual in-place OS patching." }, { title: "b", text: "Second card text here." }], notes: "" };
  G.guardFigures_([s6], ctxFor(SOL), { research: [] });
  assert.doesNotMatch(s6.items[0].text, /baseline:\s+of/);
});

test("3. a dark slide is never right before the divider that opens the next part of a long deck (Solution 9, Proposal 8)", () => {
  const code = read("src/Code.gs");
  assert.match(code, /const nextDark = nextSp \? normalizeType_\(nextSp\.type\) === 'section' : !!ctx\.nextPartStartsDark;/);
  assert.match(code, /ctx\.nextPartStartsDark = !!after && after\.type === 'section';/);
});

test("4, 6, 7. a section never has a slide's name; next steps is the last body slide; no one-word titles", () => {
  const ctx = ctxFor(GEN);
  const secs = [
    { title: "Engineering resilient enterprise data platforms", list: [{ type: "statement", title: "Engineering resilient enterprise data platforms" }, { type: "process", title: "Engineering 99.9% pipeline availability" }, { type: "cards", title: "Accelerating query throughput by 3x" }] },
    { title: "Team, governance and next steps", list: [{ type: "process", title: "Next steps to launch data modernisation" }, { type: "cards", title: "Security" }, { type: "table", title: "Project RACI matrix" }] }];
  G.finalOutlineOrder_(secs, ctx);
  assert.notEqual(secs[0].title, "Engineering resilient enterprise data platforms");
  assert.equal(secs[1].list[secs[1].list.length - 1].title, "Next steps to launch data modernisation");
  assert.equal(secs[1].list.find((o) => /security/i.test(o.title)).title, "Security controls and compliance");
  assert.match(read("src/Code.gs"), /finalOutlineOrder_\(secs, ctx\);/);
});

test("5. the agenda is the spiral for four sections, also with a long section name (General 2)", () => {
  const res = replay(G, spec("Gen", 2));
  assert.equal(res.design, "P66_AGENDA_SPIRAL");
  assert.ok(!res.out.els.some((e) => e.x + (e.w || 0) > 700), "the wider tags stay on the slide");
});

test("8. 66degrees credentials only as approved: specializations count, no ranking claims (General 27)", () => {
  const g27 = spec("Gen", 27);
  G.approvedCredentialClaims_([g27], { log: [], userPrompt: GEN });
  const t = all(g27);
  assert.doesNotMatch(t, /12 Google Cloud Specializations|second largest/i);
  assert.match(t, /6 Google Cloud Specializations/);
  assert.equal(g27.items.length, 3, "the item that was only the ranking claim goes");
});

test("9. a risk table never cuts its mitigations and is not written twice (General 19)", () => {
  const res = replay(G, spec("Gen", 19));
  assert.ok(!res.issues.includes("cut") && !res.issues.includes("lost-content"), res.issues.join(","));
  assert.ok(!texts(res.out).some((x) => /…|\.\.\.$/.test(x)));
});

test("10. never an empty 'Figures on this slide' line (Proposal 18)", () => {
  const sp = { type: "cards", title: "Co-delivery", items: [{ title: "a", text: "Blueprints cut migration risk by 35% across waves." }, { title: "b", text: "Text." }], notes: "" };
  G.guardFigures_([sp], ctxFor(PRO), { research: [{ n: "", title: "Forrester", findings: ["35% lower migration risk"] }, { n: 6, title: "Forrester TEI", findings: ["migration risk by 35%"] }] });
  assert.doesNotMatch(sp.notes, /Figures on this slide:\s*\./);
});

test("11. English words only (General 29: 'cuatro-step')", () => {
  const g29 = spec("Gen", 29);
  G.foreignWords_([g29]);
  assert.match(g29.lead, /four-step/);
});

test("12. a slide joining team and RACI keeps one topic, also when the request asks for neither (Solution 25)", () => {
  assert.match(read("src/Code.gs"), /const keepAsked = parts\.filter/);
});

test("Solution 13: no headings joined with '·' in regions, zones, details or links", () => {
  const res = replay(G, spec("Sol", 13));
  assert.ok(!res.issues.includes("dot-heading"));
});

test("release gate: all 90 deck-43 slides replay with nothing cut, detached, off the slide, lost or piled up", () => {
  assert.equal(LOG.length, 90);
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => ["empty", "overlap", "cut", "detached", "off-slide", "record-text", "dot-heading", "repeat-title", "lost-content", "lost-figures"].indexOf(x) !== -1);
    const nan = res.out.els.some((e) => NUMS.some((k) => k in e && e[k] != null && !isFinite(Number(e[k]))));
    if (iss.length || nan) bad.push(r.deck_category + " " + r.slide_no + ": " + iss.join(",") + (nan ? " NaN" : ""));
  });
  same(bad, []);
});
