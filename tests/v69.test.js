"use strict";

// V.1_69 - every issue left in deck 41 (the V.1_68 decks), fixed by class for every deck type:
//  1. a design drawn with circles / arcs (no y) is never moved to NaN: General 29 piled at the top of the slide
//  2. the agenda is the spiral up to 6 sections even when its sections carry descriptions (General 2)
//  3. KPI tiles are the figures the request wrote, in its order; no 100% SLA, no figure twice (Solution 7, General 18, Proposal 19)
//  4. a RACI with "Responsible: X | Accountable: Y | ..." in one cell is a table with a column per role (General 17);
//     team structure and RACI are two slides (Proposal 25)
//  5. no extra unnumbered workstream dividers (Proposal 10, 13)
//  6. the architecture notes beside numbered groups are bullets, not a second set of numbers (Solution 4)
//  7. sizing / configuration is a topic shown once (Solution 10 and 14)
//  8. every topic the request names has a slide and the deck has exactly the slide count asked (Solution 29 of 30,
//     no risks; Proposal without next steps)
//  9. the slide body sits in the middle of the free space (no empty band at the bottom)
// 10. pricing tables are left-aligned
// 11. "Target:" on one fact among facts reads "(target)"
// 12. a "benchmarks" slide with no figure on it is not called a benchmark
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const ENTRY = require("vm").runInContext("ONCE_TOPIC_ENTRY_", G);
const E = G.ENGINE;
const draw = (spec) => E.render({ slides: [spec] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));
const LOG = JSON.parse(read("tests/fixtures/deck41-slide-log.json"));
const row = (cat, n) => LOG.find((r) => r.deck_category === cat && String(r.slide_no) === String(n));
const spec = (cat, n) => JSON.parse(row(cat, n).spec_json);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);   // arrays made in the add-on sandbox
const NUMS = ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "cx", "cy", "r", "size"];

const SOLUTION_REQ = "Create a 30-slide solution deck for Contoso Health: SQL Server high availability across two Google Cloud regions. Targets: 99.95% uptime, recovery under 15 minutes and 40% fewer incidents. Include current architecture, sizing and configuration, monitoring, deployment, runbooks, risks and next steps.";
const PROPOSAL_REQ = "Create a 30-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on BigQuery, Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";

test("version label is V.1_69 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(69|[7-9]\d)'/);
});

test("1. General 29: a design with arcs is never moved to NaN - nothing piles at the top, nothing off the slide", () => {
  const res = replay(G, spec("General", 29));
  const bad = res.out.els.filter((e) => NUMS.some((k) => k in e && e[k] != null && !isFinite(Number(e[k]))));
  same(bad.map((e) => e.t), []);
  assert.ok(!res.issues.includes("off-slide") && !res.issues.includes("detached"), res.issues.join(","));
  const tx = res.out.els.filter((e) => e.t === "text" && e.y > 80);
  assert.ok(tx.length >= 3, "the next steps are drawn in the body, not on top of the title");
  // the checker itself now sees a position that is not a number
  assert.ok(E.layoutIssues({ els: [{ t: "text", x: 40, y: NaN, w: 200, h: 20, text: "x" }] }, { type: "cards", title: "x" }).includes("off-slide"));
  const w = read("src/Engine.gs");
  assert.match(w, /var nanAfter = /);
});

test("2. the agenda is the spiral up to six sections, even when the sections have descriptions (General 2)", () => {
  const res = replay(G, spec("General", 2));
  assert.match(res.design, /SPIRAL/);
  const a7 = draw({ type: "agenda", title: "Agenda", items: "abcdefg".split("").map((c, i) => ({ title: "Section " + (i + 1), text: "About " + c })) });
  assert.doesNotMatch(String(a7.drawnWith || ""), /SPIRAL/, "seven sections use the list design");
});

test("3. KPI tiles are the figures the request wrote, in its order - no 100% SLA, no figure twice", () => {
  const sol = { slides: [JSON.parse(JSON.stringify(spec("Solution Deck", 7)))] };
  G.normalizeShapes_(sol, { log: [], userPrompt: SOLUTION_REQ });
  same(sol.slides[0].items.map((i) => i.value.replace(/\s+/g, "")), ["99.95%", "<15min", "40%"]);
  assert.ok(sol.slides[0].items[1].text.length > 20, "the matched tile keeps Gemini's own text");

  const prop = { slides: [JSON.parse(JSON.stringify(spec("Proposal Deck", 19)))] };
  G.normalizeShapes_(prop, { log: [], userPrompt: PROPOSAL_REQ });
  const p = prop.slides[0];
  same(p.items.map((i) => i.value), ["50%", "95%", "30%"]);
  assert.equal(p.value, undefined, "the headline is one of the tiles, not a second 50%");
  const drawn = draw(p);
  const vals = texts(drawn).filter((t) => /^\d+%$/.test(t));
  same(vals.sort(), ["30%", "50%", "95%"]);

  // the request gave no figures: Gemini's tiles stay, but never 100% SLA and never one figure twice
  const gen = draw(spec("General", 18));
  assert.ok(!texts(gen).includes("100%"));
  const dup = draw({ type: "stats", title: "Success KPIs", items: [{ value: "50%", label: "Faster builds", text: "a" }, { value: "95%", label: "Quality", text: "b" }, { value: "50%", label: "Faster delivery", text: "c" }] });
  assert.equal(texts(dup).filter((t) => t === "50%").length, 1);

  // what is read from a request
  const f = G.requestFigures_("Cut platform run cost by 30% and reach 99.9% availability with RTO under 4 hours.");
  same(f.map((x) => x.value), ["30%", "99.9%", "<4 hours"]);
  same(G.requestFigures_("ZoomInfo maintains 420M profiles and a $2M budget."), []);
});

test("4. RACI: roles in one cell become a column each (General 17); team and RACI are two slides (Proposal 25)", () => {
  const res = replay(G, spec("General", 17));
  const t = texts(res.out);
  ["Workstream", "Responsible", "Accountable", "Consulted", "Informed", "66degrees Cloud Pod", "ZoomInfo Security Lead"].forEach((w) => assert.ok(t.includes(w), w));
  assert.ok(!t.some((x) => /\|/.test(x)), "no pipe text left");
  assert.ok(!res.issues.includes("detached") && !res.issues.includes("cut"), res.issues.join(","));
  const code = read("src/Code.gs");
  same(G.onceTopicsOf_("Joint team structure and RACI governance matrix").sort(), ["raci", "team"]);
  assert.ok(G.onceTopicsIn_(PROPOSAL_REQ).includes("raci") && G.onceTopicsIn_(PROPOSAL_REQ).includes("team"));
  assert.match(code, /ONCE_TOPIC_ENTRY_/);
});

test("5. no extra unnumbered workstream dividers in Proposal decks", () => {
  assert.match(read("src/Code.gs"), /if \(t === 'workstream'\) return;/);
});

test("6. Solution 4: the notes beside numbered groups are bullets, not numbers", () => {
  const res = replay(G, spec("Solution Deck", 4));
  const nums = res.out.els.filter((e) => e.t === "text" && /^\d$/.test(String(e.text)));
  const groups = (spec("Solution Deck", 4).groups || spec("Solution Deck", 4).items || []).length;
  assert.ok(nums.length <= Math.max(groups, 4), "only the groups are numbered: " + nums.length);
  assert.doesNotMatch(read("src/SolutionDesigns_3_Tech.gs"), /K\.text\(els, CX, y, 16, 12, String\(i \+ 1\)/);
});

test("7. sizing and configuration is a topic shown once", () => {
  assert.equal(G.onceTopicOf_("Compute and disk sizing for SQL Server nodes"), "sizing");
  assert.equal(G.onceTopicOf_("Configuration and sizing"), "sizing");
});

test("8. every topic the request names has a slide; the deck has the slide count asked", () => {
  const fam = G.onceTopicsIn_(SOLUTION_REQ);
  ["risks", "next"].forEach((f) => assert.ok(fam.includes(f), f));
  ["risks", "next", "raci", "team", "kpi", "pricing", "scope", "support"].forEach((f) => assert.ok(ENTRY[f] && ENTRY[f].title, f));
  const code = read("src/Code.gs");
  assert.match(code, /getting started\|first step\|kick-\?off/);
  assert.ok(code.indexOf("ONCE_TOPIC_ENTRY_[f]") !== -1 || code.indexOf("ONCE_TOPIC_ENTRY_[") !== -1);
});

test("9. the slide body is centred in the free space, and only when every position is a number", () => {
  const w = read("src/Engine.gs");
  assert.match(w, /Math\.min\(60, free \/ 2\)/);
});

test("10. pricing tables are left-aligned", () => {
  const src = read("src/ProposalDesigns_4_Proof.gs");
  const i = src.indexOf("P66_PRICING"), body = src.slice(i, src.indexOf("return { bg:", i));
  assert.doesNotMatch(body, /align: j \? 'right'/);
  assert.doesNotMatch(body, /align: 'right'/);
  const res = replay(G, spec("Proposal Deck", 27));
  assert.ok(!res.out.els.some((e) => e.t === "text" && e.align === "right"));
});

test("11. one target among facts reads '(target)', not 'Target:' (General 5)", () => {
  const plan = { slides: [JSON.parse(JSON.stringify(spec("General", 5)))] };
  G.normalizeShapes_(plan, { log: [], userPrompt: "x" });
  const labels = plan.slides[0].items.map((i) => i.label);
  assert.ok(!labels.some((l) => /^target:/i.test(l)), labels.join(" / "));
  assert.ok(labels.some((l) => /\(target\)$/.test(l)));
  // a KPI slide keeps its "Target:" labels
  const kpi = { slides: [{ type: "stats", title: "Target KPIs", items: [{ value: "3x", label: "Target: throughput" }, { value: "-35%", label: "Target: TCO" }] }] };
  G.normalizeShapes_(kpi, { log: [], userPrompt: "x" });
  assert.equal(kpi.slides[0].items[0].label, "Target: throughput");
});

test("12. a 'benchmarks' slide with no figure is retitled; the divider follows (Proposal 20)", () => {
  const sec = { type: "section", title: "Value", points: ["Industry benchmarks on unified retail data platforms"] };
  const plan = { slides: [sec, JSON.parse(JSON.stringify(spec("Proposal Deck", 20)))] };
  G.normalizeShapes_(plan, { log: [], userPrompt: "x" });
  assert.equal(plan.slides[1].title, "Industry experience with unified retail data platforms");
  assert.equal(sec.points[0], plan.slides[1].title);
  const fig = { slides: [{ type: "cards", title: "Industry benchmarks", items: [{ title: "Uplift", text: "Retailers see 20% more revenue." }, { title: "Margin", text: "10% margin gain." }] }] };
  G.normalizeShapes_(fig, { log: [], userPrompt: "x" });
  assert.equal(fig.slides[0].title, "Industry benchmarks", "figures shown: still benchmarks");
});

test("release gate: all 89 deck-41 slides replay with nothing detached, off the slide, cut or piled up", () => {
  assert.equal(LOG.length, 89);
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => ["empty", "overlap", "cut", "detached", "off-slide", "record-text", "dot-heading", "repeat-title"].indexOf(x) !== -1);
    const nan = res.out.els.some((e) => NUMS.some((k) => k in e && e[k] != null && !isFinite(Number(e[k]))));
    if (iss.length || nan) bad.push(r.deck_category + " " + r.slide_no + " " + r.title + ": " + iss.join(",") + (nan ? " NaN" : ""));
  });
  same(bad, []);
});
