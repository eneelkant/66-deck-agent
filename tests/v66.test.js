"use strict";

// V.1_66 (deck 38: Solution "Contoso Health", Proposal "Zoominfo", General "Zoominfo"; replayed from the slide log
// deck_agent.deck_slides, tests/fixtures/deck38-slide-log.json). Fixed by kind, for every deck type:
//  1. titles over the wrong content: a long-deck part is matched to its outline by content, never by position alone
//  2. an empty slide: a Gantt written where no Gantt design can draw it becomes a table of workstreams x phases
//  3. figures in headings ("205% · Industry benchmark") and in sentences on a KPI slide become KPI tiles
//  4. notes and slide never give different figures; a why-66degrees slide shows facts, not "Target:" tiles
//  5. a levels slide (L1-L3) shows the levels only; a stack of layers keeps every point in order
//  6. typed "!" / "i" marks become the row's icon; a menu never cuts its texts ("…"); a panel heading is never cut
//  7. thin option texts are written out in full and start with a capital; the option bars stay inside the slide
//  8. a statement that repeats the title goes; next steps show their steps
//  9. boxes end a little under their text (never far above the footer)
// 10. the agenda: the spiral for up to 6 sections in every deck type, the list designs for 7 or more; no slide ranges
// 11. the slide log numbers a slide by its place in the deck
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const LOG = JSON.parse(read("tests/fixtures/deck38-slide-log.json"));
const G = loadAddon(5);
const specOf = (start, cat, after) => {
  const r = LOG.find((x) => x.title.startsWith(start) && (!cat || x.deck_category === cat) && (!after || x.ts_ist > after));
  assert.ok(r, "logged slide " + start);
  return JSON.parse(r.spec_json);
};
const draw = (spec) => G.ENGINE.render({ slides: [spec] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));
const ZOOMINFO = "2026-10-28T11:2";

test("version label is V.1_66 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[6-9]|[7-9]\d)'/);
});

test("1. a part of a long deck is matched to its outline by content: no title over another slide's content (General 15-16)", () => {
  const outline = [
    { type: "cards", title: "Phase 1 prioritizes core governance and pipeline foundations", brief: "phase 1 work" },
    { type: "table", title: "Joint team structure unites Zoominfo and 66degrees", brief: "who does what on both sides" },
    { type: "table", title: "RACI matrix defines the team structure on both sides", brief: "responsible, accountable, consulted, informed" },
    { type: "timeline", title: "12-week execution timeline from mobilization to launch", brief: "weeks 1-12 tracks" }];
  // Gemini wrote the team structure and the RACI as one table, so it returned 3 slides with its own titles
  const got = [
    { type: "cards", title: "Phase 1 prioritizes core governance and pipeline foundations", items: [{ title: "GCP landing zone setup", text: "Provision the project hierarchy." }] },
    { type: "table", title: "RACI matrix across Zoominfo and 66degrees teams", columns: ["Deliverable", "66degrees", "Zoominfo"], rows: [["Landing zone", "Responsible", "Accountable"]] },
    { type: "diagram", title: "Twelve-week delivery tracks", items: [{ title: "Weeks 1-3: mobilization and landing zone", text: "Finalize blueprints." }, { title: "Weeks 10-12: enablement", text: "Hand off to L1-L3 support." }] }];
  const m = G.matchOutline_(outline, got);
  assert.equal(m.byOutline[0], got[0]);
  assert.equal(m.byOutline[2], got[1], "the RACI table takes the RACI entry");
  assert.equal(m.byOutline[3], got[2], "the timeline takes the timeline entry, not the KPI or RACI title");
  assert.ok(!m.byOutline[1], "the team-structure entry Gemini did not write is not filled with a neighbour's content");
  const code = read("src/Code.gs");
  assert.doesNotMatch(code, /byTitle \|\| got\[k\]/, "no fallback to the slide at the same position");
  assert.match(code, /sp\.leaveOut = true/);
});

test("2. General 12: the Gantt Gemini wrote is drawn as a table with every workstream (it was an empty slide)", () => {
  const o = draw(specOf("Phased implementation", "General"));
  assert.equal(o.drawnWith, "base:table");
  const t = texts(o).join(" | ");
  ["Architecture and infrastructure", "Data engineering and pipelines", "Governance and quality", "BI and team enablement"].forEach((w) => assert.ok(t.includes(w), w));
  assert.deepEqual(Array.from(o.qa.issues), []);
  assert.ok(o.qa.fixed.includes("gantt-as-table"));
  // a Proposal Deck with real lanes keeps its Gantt
  const p = draw({ deckLibrary: "proposal", type: "timeline", title: "Roadmap", periods: ["M1", "M2", "M3", "M4", "M5", "M6"],
    lanes: [1, 2, 3].map((i) => ({ name: "Lane " + i, bars: [{ start: i, end: i + 2, label: "Work " + i }] })), reference: { tag: "P66_GANTT" } });
  assert.equal(p.drawnWith, "P66_GANTT");
});

test("3. figures written into headings or sentences are KPI tiles (Solution 18, Proposal 21)", () => {
  const sol = draw(specOf("KPI targets for Contoso"));
  assert.equal(sol.drawnWith, "S66_KPI_TEXT_TILES");
  assert.ok(texts(sol).includes("100%") && texts(sol).includes("<15 min"));
  assert.ok(!texts(sol).some((t) => /^100% ·/.test(t)), "never the figure inside the heading");
  const eco = draw(specOf("Economic impact", "Proposal Deck", ZOOMINFO));
  assert.equal(eco.drawnWith, "P66_KPI_TILES");
  ["205%", "5,200", "15%–20%"].forEach((v) => assert.ok(texts(eco).includes(v), v));
  assert.ok(!texts(eco).some((t) => / · Industry/.test(t)));
  // a score ("4", "4/5") is not a KPI: the skills ratings stay rows
  const sk = draw(specOf("Data readiness assessment: skills", "Proposal Deck"));
  assert.notEqual(sk.type, "stats");
});

test("4. notes never give other figures than the slide; a why-66degrees slide shows facts, not 'Target:' tiles", () => {
  const k = draw(specOf("Success KPIs with target figures for Zoominfo"));
  assert.doesNotMatch(k.notes, /55%|90%|30%/, "the notes' figures that the slide does not show are left out");
  const w = draw(specOf("Why 66degrees: Google"));
  assert.ok(!texts(w).some((t) => /^Target/i.test(t)), texts(w).join(" | "));
  assert.ok(texts(w).includes("100%") && texts(w).includes("Google Cloud focus"));
});

test("5. a levels slide shows L1-L3 only (the bridge goes to the callout); layers keep every point in order", () => {
  const lv = draw(specOf("Support model with L1, L2, and L3 levels", "Proposal Deck", ZOOMINFO));
  assert.equal(lv.drawnWith, "P66_PYRAMID");
  assert.ok(!texts(lv).includes("04"), "three levels");
  assert.ok(!texts(lv).some((t) => /^Immediate critical conference bridge$/.test(t)));
  assert.ok(lv.els.filter((e) => e.t === "text" && /^(Cloud Monitoring|Operations engineers|Senior cloud)/.test(e.text)).every((e) => e.valign === "middle"), "texts centred on their level");
  const spec = specOf("Deployment layers across");
  const ly = draw(spec);
  assert.equal(ly.drawnWith, "S66_LAYER_STACK");
  const all = texts(ly).join("\n");
  spec.layers.forEach((l) => l.items.forEach((p) => assert.ok(all.includes(p), "kept: " + p)));
  const labels = texts(ly).filter((t) => /^Layer \d/.test(t));
  assert.deepEqual(Array.from(labels), ["Layer 4: monitoring", "Layer 3: database", "Layer 2: compute", "Layer 1: network"]);
  assert.ok(!/: \w+: /.test(all), "never a double colon");
});

test("6. status rows show icons (no typed '!' / 'i'); a menu never cuts its texts; a panel heading is never cut", () => {
  const ir = draw(specOf("Operational readiness"));
  assert.equal(ir.drawnWith, "S66_ISSUE_ROWS");
  assert.ok(!texts(ir).some((t) => t === "!" || t === "i"));
  assert.equal(ir.els.filter((e) => e.t === "icon").length, 4);
  const menu = draw(specOf("Why 66degrees is the right", "General"));
  assert.ok(!texts(menu).some((t) => /…$/.test(t)), texts(menu).filter((t) => /…$/.test(t)).join(" | "));
  assert.deepEqual(Array.from(menu.qa.issues), []);
});

test("7. option texts start with a capital; the option bars stay inside the slide", () => {
  const pr = draw(specOf("Pricing options tailored"));
  assert.equal(pr.drawnWith, "P66_DIAGONAL_OPTIONS");
  assert.ok(texts(pr).includes("Fixed-price 12-week outcome"));
  assert.match(read("src/ProposalDesigns_2_Cards.gs"), /Math\.min\(cBot \+ 24, H - 26\)/);
  // the fill step counts an option of under six words as having no text, and asks for it in full
  const code = read("src/Code.gs");
  assert.match(code, /tx\.split\(\/\\s\+\/\)\.length < 6/);
  assert.match(code, /the text says that in full/);
});

test("8. a statement that repeats the title goes; next steps show their steps (Solution 29)", () => {
  const ns = draw(specOf("Recommended next steps"));
  assert.equal(ns.type, "process");
  const t = texts(ns);
  assert.equal(t.filter((x) => x === "Recommended next steps to initiate deployment").length, 1, "the title once");
  ["Conduct architecture workshops", "Provision pilot environment", "Execute failover game day"].forEach((w) => assert.ok(t.includes(w), w));
});

test("9. boxes end a little under their text, never far above the footer (General 20)", () => {
  const o = draw(specOf("Continuous mitigation"));
  const boxes = o.els.filter((e) => e.t === "rect" && e.y > 120 && e.h > 90);
  assert.ok(boxes.length >= 4);
  boxes.forEach((b) => { assert.ok(b.h < 205, "shorter than before: " + b.h); assert.ok(b.y + b.h >= 296, "still fills the slide: " + (b.y + b.h)); });
  assert.equal(new Set(boxes.map((b) => Math.round(b.h))).size, 1, "one height for the row");
});

test("10. the agenda: spiral for up to 6 sections in every deck type, the list for 7 or more; no slide ranges", () => {
  ["general", "solution", "proposal"].forEach((lib) => {
    const items = (n) => Array.from({ length: n }, (_, i) => ({ title: "Section " + (i + 1), text: "What it covers" }));
    assert.equal(draw({ type: "agenda", title: "Agenda", deckLibrary: lib, items: items(4) }).drawnWith, "P66_AGENDA_SPIRAL", lib + " 4");
    assert.equal(draw({ type: "agenda", title: "Agenda", deckLibrary: lib, items: items(6) }).drawnWith, "P66_AGENDA_SPIRAL", lib + " 6");
    assert.notEqual(draw({ type: "agenda", title: "Agenda", deckLibrary: lib, items: items(9), reference: { tag: "P66_AGENDA_SPIRAL" } }).drawnWith, "P66_AGENDA_SPIRAL", lib + " 9");
  });
  LOG.filter((r) => r.slide_type === "agenda").forEach((r) => assert.equal(draw(JSON.parse(r.spec_json)).drawnWith, "P66_AGENDA_SPIRAL", r.deck_category));
  assert.doesNotMatch(read("src/Code.gs"), /'slides ' \+ first/);
});

test("11. the slide log numbers a slide by its place in the deck", () => {
  const code = read("src/Code.gs");
  assert.match(code, /renderEngineSlide\(slide, specs\[i\], noBase \+ i \+ 1/);
  assert.match(code, /noBase = blankDeck \? 0 : Math\.max\(0, target\.getSlides\(\)\.length - specs\.length\)/);
});

test("all 120 logged slides of deck 38: none empty, none with texts on top of each other, none cut", () => {
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => x === "empty" || x === "overlap" || x === "cut");
    if (iss.length) bad.push(r.title + ": " + iss.join(","));
  });
  assert.deepEqual(bad, []);
});
