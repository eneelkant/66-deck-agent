"use strict";

// V.1_67 (deck 39: Solution "Contoso Health", Proposal "Tailwind Traders", General "Zoominfo"; replayed from the slide log,
// tests/fixtures/deck39-slide-log.json). Fixed by kind, for every deck type:
//  1. boxes end just under their text and the group moves down a little instead of stretching
//  2. one typeface: no IBM Plex Mono for figures or step numbers
//  3. "Field: value · Field: value" texts read as sentences; "Target:" / "Industry benchmark:" labels go on KPI slides
//  4. topics with lists of details are icon rows or an icon grid; scenarios with a closing paragraph are cards
//  5. icon circles in brand colours; tags are one shape each, all of a column the same width; no purple column
//  6. the streak picture only on transition slides (strips and bands get a stock photo or stay Night Blue)
//  7. content Gemini wrote that was not shown: a "headline" figure, a RACI matrix's rows, headings-only scope points
//  8. no invented prices, no 100% SLA, no chart of unrelated measures, no column that says the same in every row
//  9. a closing paragraph written as the last step is the takeaway; names keep their capitals; a capital after a colon
// 10. the slide log numbers slides from the cover (the working copy's empty first slide is not counted)
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const LOG = JSON.parse(read("tests/fixtures/deck39-slide-log.json"));
const G = loadAddon(5);
const specOf = (start, cat) => {
  const r = LOG.find((x) => x.title.startsWith(start) && (!cat || x.deck_category === cat));
  assert.ok(r, "logged slide " + start);
  return JSON.parse(r.spec_json);
};
const draw = (spec) => G.ENGINE.render({ slides: [spec] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));
const boxesOf = (o) => o.els.filter((e) => (e.t === "rect" || e.t === "roundrect") && e.h >= 90 && e.w >= 80 && e.w < 700 && e.y >= 60);
const inkBottom = (o, B) => Math.max(...o.els.filter((e) => e.t === "text" && e.x + 3.6 >= B.x - 1 && e.x + e.w - 3.6 <= B.x + B.w + 1 && e.y + 3.6 >= B.y - 1 && e.y < B.y + B.h).map((e) => e.y + (e.vh || e.h) - 3.6));

test("version label is V.1_67 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[7-9]|[7-9]\d)'/);
});

test("1. boxes end just under their text (Solution 15 deployment columns, 20/21 KPI tiles, General 20)", () => {
  ["How the solution is deployed", "Target RTO", "Network throughput"].forEach((t) => {
    const o = draw(specOf(t, "Solution Deck"));
    boxesOf(o).forEach((B) => {
      const low = inkBottom(o, B);
      if (!isFinite(low)) return;
      assert.ok(B.y + B.h - low <= Math.max(26, B.h * 0.2), t + ": box " + Math.round(B.h) + " ends " + Math.round(B.y + B.h - low) + "pt under its text");
    });
  });
  const code = read("src/Engine.gs");
  assert.match(code, /function centreContent_\(out\)/);
  assert.doesNotMatch(code, /Math\.min\(B\.h, BOTTOM - 65 - B\.y\)/, "no floor that keeps boxes stretched");
});

test("2. one typeface: figures and step numbers are Plus Jakarta Sans (no IBM Plex Mono)", () => {
  const o = draw(specOf("Network throughput", "Solution Deck"));
  assert.ok(o.els.filter((e) => e.t === "text").every((e) => e.font !== "mono"));
  assert.match(read("src/EngineRenderer.gs"), /mono = sans;/);
});

test("3. record-style texts read as sentences; no 'Target:' / 'Industry benchmark:' labels on KPI slides", () => {
  const o = draw(specOf("Network throughput", "Solution Deck"));
  const t = texts(o).join(" | ");
  assert.doesNotMatch(t, / · /, "no 'Field: x · Field: y'");
  assert.doesNotMatch(t, /\bStorage: |\bPurpose: /);
  assert.doesNotMatch(t, /Target: /);
  const b = draw(specOf("Industry benchmarks on", "Proposal Deck"));
  assert.ok(!texts(b).some((x) => /^Industry benchmark:/.test(x)), texts(b).join(" | "));
});

test("4. topics with details are icon rows / an icon grid (Solution 22); scenarios are cards (Solution 24)", () => {
  const h = draw(specOf("HIPAA", "Solution Deck"));
  assert.equal(h.drawnWith, "S66_TOPIC_ROWS");
  assert.ok(h.els.filter((e) => e.t === "icon").length >= 4, "one icon per topic");
  const r = draw(specOf("Operational runbooks for", "Solution Deck"));
  assert.equal(r.type, "cards");
  ["Unplanned zone failure", "Regional disaster", "Quorum exhaustion", "Planned OS patching"].forEach((w) => assert.ok(texts(r).includes(w), w));
  // the plan step gives such slides the topic design, so the fit step can shorten long details
  assert.match(read("src/Code.gs"), /sp\.lockTag = 'S66_TOPIC_ROWS'/);
  // two groups stay a comparison
  const two = draw({ deckLibrary: "proposal", type: "bullets", title: "Legacy versus target", items: [{ title: "Legacy", points: ["Queues delay analysis", "Silos conflict"] }, { title: "Target", points: ["Self-service", "One set of KPIs"] }] });
  assert.notEqual(two.drawnWith, "S66_TOPIC_ROWS");
});

test("5. brand-coloured icon circles; tags are one shape each, one width per column; no purple", () => {
  const ir = draw(specOf("Clinical database downtime", "Solution Deck"));
  assert.ok(!ir.els.some((e) => (e.line && /F2A33A|9AA6B2/i.test(String(e.line.color))) || /F2A33A|FDF0DC/i.test(String(e.fill || ""))));
  const nm = draw(specOf("Compute and persistent disk", "Solution Deck"));
  const tags = nm.els.filter((e) => e.t === "roundrect" && e.text);
  assert.equal(tags.length, 4);
  assert.equal(new Set(tags.map((e) => Math.round(e.w))).size, 1, "one width");
  assert.ok(tags.every((e) => e.textStyle && e.textStyle.font === "Plus Jakarta Sans"));
  assert.ok(!texts(nm).some((t) => /^(Compute Engine|Persistent Disk|VPC network)$/.test(t)), "the tag word is inside its shape, not a separate box");
  assert.ok(!nm.els.some((e) => /3D1E8F/i.test(String(e.fill || ""))), "no purple");
});

test("6. the streak picture only on transition slides", () => {
  const src = read("src/EngineRenderer.gs");
  assert.match(src, /const photo = partial \? \(stock \|\| null\)/);
  assert.match(read("src/StockImages.gs"), /STOCK_IMAGE_SHARE_ = 1;/);
});

test("7. content that was written but not shown: headline figure, RACI rows, headings-only scope", () => {
  const k = draw(specOf("Target success KPIs", "Proposal Deck"));
  assert.ok(texts(k).includes("50%"), "the 50% target from the headline is a tile");
  assert.equal(k.drawnWith, "P66_KPI_TILES");
  const raci = draw(specOf("RACI matrix across", "Proposal Deck"));
  assert.equal(raci.type, "table");
  assert.ok(texts(raci).some((t) => /^Platform foundation and IAM security setup$/.test(t)));
  // the plan step turns heading-only points into items, so the fill step writes what each covers
  const plan = { slides: [specOf("Scope: what is in", "Proposal Deck")] };
  G.normalizeShapes_(plan, { log: [], userPrompt: "x" });
  assert.equal(plan.slides[0].type, "cards");
  assert.deepEqual(Array.from(plan.slides[0].items.map((i) => i.title)), ["In scope", "Out of scope", "Key assumptions", "Dependencies", "Future phases"]);
});

test("8. no invented prices; no 100% SLA tile; no chart of unrelated measures; no same-value column", () => {
  const plan = { slides: [specOf("Commercial pricing", "General")] };
  const ctx = { log: [], userPrompt: "Enterprise data platform proposal for Zoominfo with pricing options" };
  G.normalizeShapes_(plan, ctx);
  assert.doesNotMatch(JSON.stringify(plan.slides[0].rows), /\$\d/);
  assert.equal(plan.slides[0].takeaway, "Pricing is confirmed after the scoping workshop.");
  const given = { slides: [specOf("Commercial pricing", "General")] };
  G.normalizeShapes_(given, { log: [], userPrompt: "Option 1 is $285K, the pod $85K a month and the retainer $25K a month" });
  assert.match(JSON.stringify(given.slides[0].rows), /\$285K/, "a price the request gives stays");
  const sla = draw(specOf("Service credit", "Solution Deck"));
  assert.ok(!texts(sla).includes("100%"));
  const ch = draw(specOf("Projected developer", "General"));
  assert.equal(ch.type, "stats");
  const gd = draw(specOf("Quarterly game day", "Solution Deck"));
  assert.ok(!texts(gd).includes("Supported"));
});

test("9. closing paragraph as a step -> takeaway; names keep capitals; capital after a colon", () => {
  const ns = draw(specOf("Next steps to launch", "Proposal Deck"));
  assert.ok(!ns.els.some((e) => e.t === "text" && /^0\d$/.test(e.text) && e.text === "04"), "the closing paragraph is not a fourth step");
  assert.equal(ns.els.filter((e) => e.t === "text" && /^0\d$/.test(e.text)).length, 3, "three steps");
  assert.equal(G.sentenceCase_("Cluster and always on", 2), "Cluster and Always On");
  assert.equal(G.sentenceCase_("North america's premier Google Cloud specialist", 2), "North America's premier Google Cloud specialist");
  assert.equal(G.sentenceCase_("Phase 4: Value Checkpoint", 2), "Phase 4: Value checkpoint");
});

test("10. the slide log counts from the cover in a long deck's working copy", () => {
  const code = read("src/Code.gs");
  assert.match(code, /target\.getId\(\) === ctx\.workId\) noBase = Math\.max\(0, noBase - 1\)/);
  assert.match(code, /if \(st\.workId\) ctx\.workId = st\.workId;/);
});

test("all 90 logged slides of deck 39: none empty, none with texts on top of each other, none cut", () => {
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => x === "empty" || x === "overlap" || x === "cut");
    if (iss.length) bad.push(r.title + ": " + iss.join(","));
  });
  assert.deepEqual(bad, []);
});
