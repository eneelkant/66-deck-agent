"use strict";

// V.1_73 - step 4 (the checker blocks a bad slide: written again once, then a safe layout) + the issues of the V.1_72
// test decks (deck 44), for every deck type
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const LOG = JSON.parse(read("tests/fixtures/deck44-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const all = (sp) => JSON.stringify(Object.assign({}, sp, { notes: "" }));
const NUMS = ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "cx", "cy", "r", "size"];

const PRO = "Create a 40-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 40-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (prompt, extra) => { const c = Object.assign({ log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }, extra || {}); c.brief = G.briefFromText_(prompt, 40); return c; };

test("version label is V.1_73 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[3-9]|[8-9]\d)'/);
  assert.ok(JSON.parse(read(".clasp.json")).filePushOrder.includes("Gate.gs"));
});

test("step 4: a slide that still fails is written again once (schema) and kept only when it then passes", () => {
  const bad = { type: "cards", deckLibrary: "proposal", title: "Five long cards", items: Array.from({ length: 4 }, (x, k) => ({ title: "Card " + (k + 1), text: ("A very long text that runs on and on about the platform and its many parts. ").repeat(9) })) };
  const real = { c: G.callGeminiJSON, w: G.withContentModel_, i: G.gateIssues_ };
  let schema = null;
  G.withContentModel_ = (c, fn) => fn();
  G.callGeminiJSON = (p, k, t, o) => { schema = o && o.schema; return { slides: [{ id: 0, items: bad.items.map((it, k) => ({ title: it.title, text: "A short text for card " + (k + 1) + "." })) }] }; };
  const slides = [bad];
  // the slide fails first (a cut text), passes after the rewrite
  G.gateIssues_ = (sp) => (/very long/.test(JSON.stringify(sp)) ? ["cut"] : []);
  const res = G.gateSlides_(slides, ctxFor(PRO, { apiKey: "k" }), Date.now());
  G.callGeminiJSON = real.c; G.withContentModel_ = real.w; G.gateIssues_ = real.i;
  assert.equal(res.rewritten, 1);
  assert.match(slides[0].items[0].text, /^A short text/);
  same(schema, JSON.parse(JSON.stringify(vm.runInContext("GATE_SCHEMA_", G))));
});

test("step 4: what still fails is drawn with a safe layout that keeps every figure", () => {
  const sp = { type: "cards", deckLibrary: "proposal", title: "Value of the platform", items: [
    { value: "205%", label: "Three-year ROI", text: "Measured across enterprise deployments of BigQuery and Looker." },
    { value: "38%", label: "Engineering productivity", text: "Gained through automated pipeline and quality management." },
    { value: "117%", label: "Lakehouse ROI", text: "Return on unifying lakehouse workloads with governance." }] };
  const safe = G.gateSafeLayout_(sp, {});
  assert.ok(safe, "a safe layout is found");
  assert.equal(G.gateIssues_(safe, {}).length, 0);
  const shown = JSON.stringify(G.ENGINE.render({ slides: [safe] }, { dateLabel: "x" })[0].els.map((e) => e.text || ""));
  ["205%", "38%", "117%"].forEach((v) => assert.ok(shown.includes(v), v));
  const code = read("src/Code.gs");
  assert.equal((code.match(/deckGate_\(plan\.slides, ctx, (started|b0)\);/g) || []).length, 2, "short and long decks");
});

test("1. dark slides: never beside a dark divider, at most 3, also across parts (Solution rule)", () => {
  const ctx = { log: [], presentationType: "Solution Deck", proposal: { sectionStyle: "dark" } };
  const real = G.isSolutionDeck_;
  G.isSolutionDeck_ = () => true;
  const card = (t) => ({ type: "cards", title: t, reference: { tag: "S66_ICON_CARD_GRID" } });
  const sec = (t) => ({ type: "section", title: t, reference: { tag: "P66_SECTION_DARK" } });
  const deck = [sec("A")].concat(Array.from({ length: 30 }, (x, k) => (k % 6 === 5 ? sec("S" + k) : card("c" + k))));
  G.solutionDarkRhythm_(deck, ctx);
  G.isSolutionDeck_ = real;
  const dark = deck.map((s, i) => (s.dark ? i : -1)).filter((i) => i >= 0);
  assert.ok(dark.length <= 3, "at most 3: " + dark.length);
  dark.forEach((i) => {
    assert.notEqual(deck[i - 1].type, "section", "not after a divider");
    assert.ok(!deck[i + 1] || deck[i + 1].type !== "section", "not before a divider");
  });
  assert.match(read("src/Code.gs"), /ctx\.nextPartStartsDark = !!all\[st\.next \+ part\.length\]/);
});

test("2. RACI: roles only, rows written as objects become table rows (Proposal 35, Solution 37)", () => {
  const ctx = ctxFor(PRO);
  const p35 = spec("Pro", 35), s37 = spec("Sol", 37);
  G.conformSlides_([p35, s37], ctx);
  [p35, s37].forEach((sp) => {
    assert.equal(sp.type, "table");
    sp.rows.forEach((r) => r.slice(1).forEach((c) => assert.match(c, /^(Responsible|Accountable|Consulted|Informed)( \/ (responsible|accountable|consulted|informed))*$/, c)));
    assert.equal(G.contractGaps_(sp, "raci", ctx).length, 0);
  });
  same(s37.columns, ["Workstream", "Contoso Health IT", "66degrees Cloud Operations"]);
  assert.match(p35.notes, /Roles in detail: .*scope and strategy inputs/);
});

test("3. a risk slide shows its mitigations (Solution 38: 'Risk: ...; Mitigation: ...' in one field)", () => {
  const s38 = spec("Sol", 38);
  G.conformSlides_([s38], ctxFor(PRO));
  s38.items.forEach((it) => {
    assert.doesNotMatch(it.fix, /^Risk:|Impact:/);
    assert.ok(it.fix.length > 20 && it.text.length > 20);
  });
  const t = JSON.stringify(G.ENGINE.render({ slides: [s38] }, { dateLabel: "x" })[0].els.map((e) => e.text || ""));
  assert.match(t, /Enable native backup and log stream compression/);
});

test("4. no broken text after a figure is taken out (Solution 6, Proposal 14 and 32)", () => {
  ["averages to per minute due to delayed procedures.", "Industry research shows downtime costs between and per minute.",
    "in technical labor productivity and development gains", "saved by retiring legacy BI licenses and infrastructure",
    "Consolidating redundant legacy reports cuts development time by"].forEach((t) => assert.ok(G.isFragment_(t), t));
  ["Store data on E: and L: volumes for logs.", "Zone A and zone B each run a replica.", "Rebuild indexes during off-peak hours."].forEach((t) => assert.ok(!G.isFragment_(t), t));
  const sp = { type: "cards", title: "Economic impact", lead: "Consolidating redundant legacy reports into modular Looker Explores cuts development time by",
    items: [{ title: "ROI", text: "Three-year return measured across deployments." }, { title: "Labor", text: "in technical labor productivity and development gains" }, { title: "Licences", text: "saved by retiring legacy BI licenses and infrastructure" }, { title: "Speed", text: "Faster builds through reusable models." }] };
  G.fragmentRepair_([sp], { log: [] });
  assert.equal(sp.lead, "Consolidating redundant legacy reports into modular Looker Explores cuts development time");
  same(sp.items.map((i) => i.title), ["ROI", "Speed"]);
  // over every logged slide of decks 38-44: nothing is left broken
  ["deck38", "deck39", "deck41", "deck42", "deck43", "deck44"].forEach((f) => JSON.parse(read("tests/fixtures/" + f + "-slide-log.json")).forEach((r) => {
    let s; try { s = JSON.parse(r.spec_json); } catch (e) { return; }
    G.fragmentRepair_([s], { log: [] });
    ["lead", "takeaway"].forEach((k) => { if (typeof s[k] === "string" && s[k]) assert.ok(!G.isFragment_(s[k]), f + " " + r.slide_no + " " + s[k]); });
    (s.items || []).forEach((it) => { if (it && typeof it.text === "string" && it.text) assert.ok(!G.isFragment_(it.text), f + " " + r.slide_no + " " + it.text); });
  }));
});

test("5-7. support in any wording; testing, monitoring, security once (twice in a long deck only on another angle)", () => {
  assert.equal(G.onceTopicOf_("Day two enterprise support and operational model"), "support");
  assert.equal(G.onceTopicOf_("Support model"), "support");
  assert.equal(G.onceTopicOf_("Testing and quality assurance"), "qa");
  assert.equal(G.onceTopicOf_("Quality assurance and automated data validation process"), "qa");
  assert.equal(G.onceTopicOf_("Observability stack with Cloud Monitoring and ops agent"), "monitoring");
  assert.equal(G.onceTopicOf_("Joint team structure and program governance"), "team");
  assert.equal(G.onceLimit_("monitoring", 40), 2);
  assert.equal(G.onceLimit_("monitoring", 30), 1);
  assert.equal(G.onceLimit_("support", 40), 1);
  assert.ok(G.sharedWords_("Testing and quality assurance", "Quality assurance and automated data validation process") >= 2, "the same angle: the second goes");
  assert.ok(G.sharedWords_("Security architecture for SQL Server and clinical data", "Identity, network firewall, and audit controls") < 2, "another angle: it may stay in a long deck");
});

test("8. a slide stays with its section when sections are balanced (Solution 33)", () => {
  const secs = [
    { title: "Deployment and operational runbooks", list: [{ type: "process", title: "Infrastructure as Code provisioning pipeline" }, { type: "process", title: "Runbook: Automated local high availability failover" }, { type: "process", title: "Runbook: Cross-region disaster recovery failover" }, { type: "process", title: "Runbook: Failback and post-outage resynchronization" }, { type: "process", title: "Runbook: Zero-downtime OS and SQL patching" }, { type: "cards", title: "Database migration plan" }, { type: "cards", title: "Day-2 support model" }] },
    { title: "Risks, governance, and next steps", list: [{ type: "table", title: "Operational RACI matrix" }, { type: "cards", title: "Key risks and how we mitigate them" }] }];
  G.solutionBalanceSections_(secs);
  assert.ok(!/runbook/i.test(secs[1].list[0].title), "the runbooks stay in their section: " + secs[1].list.map((o) => o.title).join(" | "));
});

test("9. a list of headings (up to six words) gets its descriptions (Proposal 32)", () => {
  const p32 = spec("Pro", 32);
  const plan = { slides: [p32] };
  G.normalizeShapes_(plan, ctxFor(PRO));
  assert.equal(plan.slides[0].type, "cards");
  assert.equal(plan.slides[0].items.length, 5);
});

test("10-11. the request's target beats research in text; credential counts only as approved", () => {
  const p18 = { type: "cards", title: "Engineering for lower platform run cost", items: [{ title: "a", text: "Retire servers." }, { title: "b", text: "Tier storage." }],
    takeaway: "Industry benchmark: 25% to 35% run cost reduction with serverless data fabrics.", points: [] };
  G.targetFiguresInText_([p18], ctxFor(PRO));
  assert.doesNotMatch(all(p18), /25% to 35%/);
  const g35 = { type: "cards", title: "Why 66degrees", items: [{ title: "Premier partner credentials", text: "Hold 6 Google Cloud Specializations and 84 Partner Expertise designations across data analytics and migration." }, { title: "Scale", text: "Deploy 350+ technical experts backed by 600+ Google Cloud certifications." }] };
  G.credentialCounts_([g35], ctxFor(GEN));
  assert.doesNotMatch(all(g35), /84 Partner Expertise/);
  assert.match(all(g35), /6 Google Cloud Specializations/);
  assert.match(all(g35), /350\+ technical experts/);
});

test("12. each target has one slide of its own (General 13 / 17, 14 / 18)", () => {
  assert.match(read("src/Code.gs"), /the target "' \+ hit\.value \+ ' ' \+ hit\.label \+ '" has its slide/);
});

test("release gate: all 80 deck-44 slides replay with nothing cut, detached, off the slide, lost or piled up", () => {
  assert.equal(LOG.length, 80);
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => ["empty", "overlap", "cut", "detached", "off-slide", "record-text", "dot-heading", "repeat-title", "lost-content", "lost-figures"].indexOf(x) !== -1);
    const nan = res.out.els.some((e) => NUMS.some((k) => k in e && e[k] != null && !isFinite(Number(e[k]))));
    if (iss.length || nan) bad.push(r.deck_category + " " + r.slide_no + ": " + iss.join(",") + (nan ? " NaN" : ""));
  });
  same(bad, []);
});
