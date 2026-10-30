"use strict";

// V.1_76 - the clean-up of the V.1_75 test decks (deck 47: General "Kroger", Proposal "Delta Air Lines", Solution
// "Northwind Logistics"; tests/fixtures/deck47-slide-log.json), fixed by kind for every deck type
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const LOG = JSON.parse(read("tests/fixtures/deck47-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));

const PRO = "Create a 40-slide proposal for Delta Air Lines (delta.com): a customer data platform on Google Cloud with BigQuery, Vertex AI and Looker to personalise offers for SkyMiles members. Success KPIs: 25% higher offer conversion, 60% faster campaign audience builds and 20% lower data platform cost. Include current state, target architecture, data governance, scope, timeline, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 40-slide presentation for Kroger (kroger.com) on using Gemini and Vertex AI to forecast store demand and reduce food waste. Targets: 15% better forecast accuracy, 20% less food waste and 2x faster replenishment planning. Include current state, target architecture, data foundation, model approach, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (prompt) => { const c = { log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }; c.brief = G.briefFromText_(prompt, 40); return c; };

test("version label is V.1_76 or later; the deck 47 log is V.1_75", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[6-9]|[8-9]\d)'/);
  assert.equal(LOG.length, 118);
  assert.ok(LOG.every((r) => r.agent_version === "V.1_75"));
});

test("1. Proposal 4: money with a one-letter unit is one figure ($61.6B) - never cut to \"6B\"", () => {
  const re = vm.runInContext("FIG_TOKEN_RE_", G);
  same("Delta made $61.6B and $7.4B; payback $45B. Revenue of $7.4.".match(re), ["$61.6B", "$7.4B", "$45B", "$7.4"]);
  same("up to 65% reduction, 3.98M tons, 38%–45%, 12,000 stores, 99.9%.".match(re), ["65%", "3.98M", "38%–45%", "12,000", "99.9%"]);
});

test("2. a sourced money figure stays on its tile; an unsourced one goes whole", () => {
  const mk = () => ({ type: "stats", title: "SkyMiles and digital channels lead Delta commercial growth", items: [
    { value: "$61.6B", label: "FY2024 operating revenue", text: "x" }, { value: "$7.4B", label: "SkyMiles cash sales", text: "y" }, { value: "~50%", label: "Direct digital share", text: "z" }] });
  const src = { research: [{ n: 5, title: "Delta IR", abstract: "Delta generated $61.6 billion in total operating revenue in FY2024, with $7.4 billion coming from cash sales of SkyMiles. Direct digital channels represent almost half (50%) of booking value.", excerpts: [] }], text: "" };
  const s = mk(); G.deckFigureCheck_([s], ctxFor(PRO), src);
  same(s.items.map((i) => i.value), ["$61.6B", "$7.4B", "~50%"]);
  const s2 = mk(); s2.items[0].value = "$9.9B"; G.deckFigureCheck_([s2], ctxFor(PRO), src);
  assert.ok(!s2.items.some((i) => /9\.9|^9B|^9$/.test(String(i.value))), JSON.stringify(s2.items.map((i) => i.value)));
  assert.ok(!s2.items.some((i) => /^\d?B$/.test(String(i.value))), "no half figure left");
});

test("3. General 12 / 17: a figure word left without its figure is repaired (heading) or the sentence goes", () => {
  const sp = { type: "cards", title: "Targeting 15% better forecast accuracy", items: [
    { title: "Up to reduction in lost sales", text: "Aligning store inventory with local signals prevents out-of-stock events." },
    { title: "Deep learning grocery MAPE", text: "Deploying deep learning LSTM models in retail grocery settings reduced demand forecast error down to MAPE from a traditional baseline MAPE. Neural architectures process non-linear consumer behaviors during unexpected local buying surges." },
    { title: "Keep up to date", text: "Teams stay up to speed with weekly reviews and up to 30% fewer tickets." }] };
  G.fragmentRepair_([sp], { log: [] });
  assert.equal(sp.items[0].title, "Reduction in lost sales");
  assert.equal(sp.items[1].text, "Neural architectures process non-linear consumer behaviors during unexpected local buying surges.");
  assert.equal(sp.items[2].text, "Teams stay up to speed with weekly reviews and up to 30% fewer tickets.");
});

test("4. General 7: a slide whose points are the request's targets is the KPI slide when the deck has none", () => {
  const c = ctxFor(GEN);
  const slides = [spec("G", 7)];
  G.conformSlides_(slides, c);
  assert.equal(slides[0].type, "stats");
  same(slides[0].items.map((i) => i.value + " " + i.label), ["15% Better forecast accuracy", "20% Less food waste", "2x Faster replenishment planning"]);
  assert.match(slides[0].takeaway, /predictive AI/);
  const o = draw(slides[0]);
  same(o.qa.issues.filter((k) => ["empty", "cut", "overlap", "lost-figures"].includes(k)), []);
});

test("5. General 1: a client name the request also writes as a web address keeps its capital", () => {
  G.setRunNames_(GEN, []);
  assert.equal(G.keepNames_("Transforming replenishment at kroger with Gemini and Vertex AI"), "Transforming replenishment at Kroger with Gemini and Vertex AI");
});

test("6. General 39: a heading never ends on a half phrase (shortened or written so)", () => {
  assert.equal(G.halfPhrase_("Design technical"), true);
  assert.equal(G.halfPhrase_("Design technical architecture"), false);
  const sp = { type: "process", title: "Next steps", items: [{ title: "Design technical", text: "Kroger IT finalizes BigQuery data contracts." }, { title: "Final strategic", text: "Set the strategic direction for pilots." }, { title: "Plan pilot timeline", text: "x y z" }] };
  G.finishSlides_([sp], { log: [] });
  same(sp.items.map((i) => i.title), ["Design technical approach", "Final strategic direction", "Plan pilot timeline"]);
  assert.match(read("src/Code.gs"), /if \(it\.action === 'shorten' && halfPhrase_\(txt\) && !halfPhrase_\(String\(it\.current \|\| ''\)\)\) return;/);
});

test("7. Proposal 38: the pricing slide says how pricing is settled in its lead (shown by every design)", () => {
  const sp = spec("P", 38);
  G.conformSlides_([sp], ctxFor(PRO));
  assert.match(sp.lead, /Pricing is confirmed after the scoping workshop\.$/);
  assert.ok(texts(draw(sp)).some((t) => /Pricing is confirmed after the scoping workshop/.test(t)));
});

test("8. absolute promises: \"guaranteeing completion\", \"Zero dropped tracking requests\"", () => {
  const sp = { type: "cards", title: "Options", lead: "Zero dropped tracking requests", items: [{ title: "a", text: "This minimizes financial risk while guaranteeing completion." }, { title: "b", text: "c d" }] };
  G.finishSlides_([sp], { log: [] });
  assert.equal(sp.items[0].text, "This minimizes financial risk with clear completion milestones.");
  assert.equal(sp.lead, "Minimal dropped tracking requests");
});

test("9. Solution: a slide left out and a short outline are written to the slide log", () => {
  const code = read("src/Code.gs");
  assert.match(code, /recordSlide_\(sp, \{ drawnWith: 'left-out', qa: \{ issues: \['left-out'\], fixed: \[\] \} \}, null\)/);
  assert.match(code, /drawnWith: 'outline-short', qa: \{ issues: \['outline-short'\]/);
});

test("10. Proposal 37: tiers written as items are the slide; the support sentences beside them go to the notes", () => {
  const o = draw(spec("P", 37));
  const t = texts(o).join(" | ");
  assert.match(t, /Platform monitoring and triage/);
  assert.match(t, /Vertex AI and architecture engineering/);
  assert.match(o.notes, /Also on this topic: Expert engineers receive and work all support requests/);
});

test("deck 47 replayed with V.1_76: no slide gets a new checker problem", () => {
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
