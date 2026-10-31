"use strict";

// V.1_77 - the fixes from the V.1_76 test decks (deck 48: General "Home Depot", Proposal "Marriott", Solution
// "Contoso Bank"; tests/fixtures/deck48-slide-log.json), for every deck type
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const LOG = JSON.parse(read("tests/fixtures/deck48-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const GEN = "Create a 40-slide presentation for Home Depot (homedepot.com) on using Gemini and Vertex AI to improve online product search and recommendations. Online sales are roughly $20B a year. Targets: 20% higher search conversion, 30% fewer zero-result searches and 2x faster catalogue enrichment. Include current state, target architecture, data foundation, model approach, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (p) => { const c = { log: [], userPrompt: p, approvedFacts: [], brand: { name: "66degrees" } }; c.brief = G.briefFromText_(p, 40); return c; };

test("version label is V.1_77 or later; the deck 48 log is V.1_76 with 40 slides per deck", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[7-9]|[8-9]\d)'/);
  assert.equal(LOG.length, 120);
  ["General", "Proposal Deck", "Solution Deck"].forEach((c) => assert.equal(LOG.filter((r) => r.deck_category === c).length, 40, c));
});

test("1. Solution 22 / 34: the slide is pale only once its stock picture is placed (a white title stays readable)", () => {
  const code = read("src/EngineRenderer.gs");
  assert.match(code, /slide\.getBackground\(\)\.setSolidFill\(out\.bg\);/);
  assert.doesNotMatch(code, /setSolidFill\(partial && \(stock \|\| cut\) \? ENGINE\.TOKENS\.white : out\.bg\)/);
  assert.match(code, /if \(stock \|\| cut\) \{ try \{ slide\.getBackground\(\)\.setSolidFill\(ENGINE\.TOKENS\.white\); \} catch \(err\) \{\} \}/);
  const o = draw(spec("S", 22));
  assert.equal(o.bg, "#040A1B", "the band design keeps Night Blue under its white title");
});

test("2. Solution 4: the checker's own notes never appear on a slide", () => {
  const o = draw(spec("S", 4));
  assert.ok(!o.els.some((e) => e.t === "text" && /notes-figures|shape|fixes/.test(String(e.text))), "no checker word drawn");
});

test("3. General 6: each KPI tile names its own target", () => {
  const sp = spec("G", 6);
  G.conformKpi_(sp, ctxFor(GEN));
  same(sp.items.map((i) => i.value + " " + i.label), ["20% Higher search conversion", "30% Fewer zero-result searches", "2x Faster catalogue enrichment"]);
});

test("4. General 35: the pricing line is put back at the end when an earlier step removed it", () => {
  const sp = spec("G", 35);
  const c = ctxFor(GEN);
  G.finishSlides_([sp], c);
  assert.match(sp.lead, /Pricing is confirmed after the scoping workshop\.$/);
  assert.ok(draw(sp).els.some((e) => e.t === "text" && /Pricing is confirmed after the scoping workshop/.test(String(e.text))));
});

test("deck 48 replayed with V.1_77: no slide gets a new checker problem", () => {
  const worse = [];
  LOG.forEach((r) => {
    let s; try { s = JSON.parse(r.spec_json); } catch (e) { return; }
    const o = draw(s);
    const before = String(r.issues || "").split(",").filter(Boolean);
    const bad = ((o.qa && o.qa.issues) || []).filter((k) => ["empty", "cut", "overlap", "off-slide", "detached", "lost-figures", "lost-content"].includes(k) && !before.includes(k));
    if (bad.length) worse.push(r.deck_category[0] + r.slide_no + " " + bad.join(","));
  });
  same(worse, []);
});
