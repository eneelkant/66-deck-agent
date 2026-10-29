"use strict";

// V.1_68 — the checker, for every deck type (General, Proposal, Solution, and every type added later, e.g. HR):
//  1. before drawing: every slide is checked for text half outside its box, shapes off the slide, boxes much taller than
//     their text, "Field: x · Field: y" texts, "·" headings, the title written twice (plus the V.1_64 checks); a slide
//     that fails is drawn again with the design that shows it best
//  2. the safety net: fitting the boxes to their text, and moving the slide body, only stay when nothing gets worse -
//     no text, heading or icon leaves the box it was in, nothing new overlaps or leaves the slide (deck 40: headings
//     left above their boxes, the first row of a grid cut off)
//  3. after drawing: the real Google Slides slide is read back - shapes off the page are moved back, another typeface is
//     set to Plus Jakarta Sans, a text half outside its box is reported (result message and slide log)
//  4. the deck: a topic shown once (scope, RACI, KPIs, pricing, risks, support, team, why 66degrees, next steps) keeps
//     its first slide; its later repeat's place is filled with another topic (deck 40: two scope slides)
//  5. today's fixes: tags centred, real icons instead of "?", a RACI written as sentences is a table, no "·" headings,
//     scope headings of up to seven words get their content
//  6. the release gate: every design of every library and all 210 logged slides pass
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");
const GATE = require("./fixtures/quality-gate.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const E = G.ENGINE;
const draw = (spec) => E.render({ slides: [spec] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));
const LOGS = ["deck38-slide-log.json", "deck39-slide-log.json"].map((f) => JSON.parse(read("tests/fixtures/" + f))).flat();

test("version label is V.1_68 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[8-9]|[7-9]\d)'/);
});

test("1. the checker finds a text half outside its box, a note across a card, a shape off the slide, record text, dot headings, a repeated title", () => {
  const spec = { type: "cards", title: "Delivery risks" };
  const box = { t: "rect", x: 32, y: 140, w: 200, h: 180, fill: "#FFFDF9" };
  const txt = (y, x, w, s) => ({ t: "text", x: x || 36, y, w: w || 190, h: 30, vh: 30, size: 11, weight: 500, text: s || "Delayed source access" });
  assert.ok(E.layoutIssues({ els: [box, txt(124)] }, spec).includes("detached"), "a heading across the top edge");
  assert.ok(!E.layoutIssues({ els: [box, txt(150)] }, spec).includes("detached"), "a heading inside its box is fine");
  assert.ok(E.layoutIssues({ els: [box, txt(200, 24, 670, "A full-width note that runs straight across the edge of the card on the left")] }, spec).includes("detached"), "a note across the card's side");
  assert.ok(E.layoutIssues({ els: [{ t: "rect", x: 600, y: 300, w: 200, h: 80, fill: "#0052FF" }] }, spec).includes("off-slide"));
  assert.ok(E.layoutIssues({ els: [txt(200, 300, 380, "Storage: pd-extreme for logs · Purpose: prevents commit delays")] }, spec).includes("record-text"));
  assert.ok(E.layoutIssues({ els: [txt(200, 300, 380, "L1 and L2 · operations and recovery")] }, spec).includes("dot-heading"));
  assert.ok(!E.layoutIssues({ els: [txt(200, 300, 380, "205% · three-year ROI")] }, spec).includes("dot-heading"), "a figure with its label is not a heading");
  assert.ok(E.layoutIssues({ els: [txt(24, 25, 670, "Delivery risks"), txt(200, 300, 380, "Delivery risks")] }, spec).includes("repeat-title"));
  // the checker's findings choose the design: a slide with one of them is drawn again
  const w = read("src/Engine.gs");
  assert.match(w, /var QA_WEIGHT_ = \{ detached: 40, 'off-slide': 40/);
  assert.match(w, /layoutIssues_\(out, s\)\.forEach\(function \(k\) \{ if \(k !== 'hollow'/);
});

test("2. the safety net: fitting boxes never leaves a heading, text or icon behind (deck 40)", () => {
  const w = read("src/Engine.gs");
  assert.match(w, /function boxTies_\(els\)/);
  assert.match(w, /!tiesHold_\(out\.els, ties\)/);
  assert.match(w, /out\.qa\.fixed\.push\('fit-reverted'\)/);
  // the body moves as one piece: the header is marked and stays, everything under it moves together
  const sp = { type: "cards", deckLibrary: "proposal", title: "Delivery risks and proactive mitigations", lead: "Early identification keeps the schedule intact.",
    items: [{ title: "Delayed source access", points: ["Mitigate delayed POS extract access", "Submit firewall requests in week one"] },
      { title: "Unmapped loyalty records", points: ["Resolve unmapped loyalty IDs via profiling rules", "Review exceptions weekly"] },
      { title: "Scope creep and low adoption", points: ["Control scope through a change board", "Embed analysts in sprint demos"] }] };
  ["P66_ICON_COLUMNS", "P66_CARD_GRID", "P66_COLUMNS_PHOTO", "P66_PILLARS", "P66_PARADIGM_DARK"].forEach((tag) => {
    const o = draw(Object.assign({}, sp, { reference: { tag } }));
    assert.ok(!o.qa.issues.includes("detached"), tag + " " + o.qa.issues.join(","));
  });
});

test("3. the checker on the real slide: off-page shapes moved back, another typeface corrected, text outside its box reported", () => {
  const src = read("src/EngineRenderer.gs");
  assert.match(src, /function checkDrawnSlide_\(slide, pageW, pageH, ctx\)/);
  assert.match(src, /const real = checkDrawnSlide_\(slide, pageW, pageH, ctx\)/);
  // a mock Google Slides slide: one shape off the page, one text in IBM Plex Mono half across a card's top edge
  const moved = [], fonts = [];
  const el = (b, opts) => ({
    getLeft: () => b.x, getTop: () => b.y, getWidth: () => b.w, getHeight: () => b.h,
    setLeft: (v) => { b.x = v; moved.push(v); }, setTop: (v) => { b.y = v; },
    getPageElementType: () => "SHAPE",
    asShape: () => ({
      getText: () => ({ asString: () => opts.text || "", getRuns: () => (opts.text ? [{ asString: () => opts.text, getTextStyle: () => ({ getFontFamily: () => opts.font }) }] : []),
        getTextStyle: () => ({ setFontFamily: (f) => fonts.push(f) }) }),
      getFill: () => ({ getType: () => (opts.fill ? "SOLID" : "NONE") })
    })
  });
  G.SlidesApp.PageElementType = { SHAPE: "SHAPE" };
  G.SlidesApp.FillType = { SOLID: "SOLID" };
  const slide = { getPageElements: () => [
    el({ x: 650, y: 300, w: 120, h: 60 }, { fill: true }),
    el({ x: 32, y: 140, w: 200, h: 180 }, { fill: true }),
    el({ x: 36, y: 110, w: 190, h: 50 }, { text: "Delayed source access", font: "IBM Plex Mono" })] };
  const res = G.checkDrawnSlide_(slide, 720, 405, { brand: { fonts: { heading: { slides: "Plus Jakarta Sans" } } } });
  assert.ok(res.fixed.includes("off-slide") && moved.includes(600), "moved back inside the page");
  assert.ok(res.fixed.includes("font") && fonts.includes("Plus Jakarta Sans"));
  assert.ok(res.issues.includes("detached"));
});

test("4. a topic shown once keeps its first slide; the later repeat's place is filled (deck 40: two scope slides)", () => {
  assert.equal(G.onceTopicOf_("Platform scope: what is in and what is out"), "scope");
  assert.equal(G.onceTopicOf_("Scope: what is in and what is out"), "scope");
  assert.equal(G.onceTopicOf_("RACI matrix across delivery workstreams"), "raci");
  assert.equal(G.onceTopicOf_("Current challenges across 400 stores"), "");
  const code = read("src/Code.gs");
  assert.match(code, /if \(onceSeen\[f\]\) \{ ctx\.log\.push\('Outline: "'/);
  assert.ok(code.indexOf("const onceSeen = {}") < code.indexOf("if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, holes, backlog);"), "the place is filled after");
});

test("5. today's fixes: centred tags, real icons, RACI sentences as a table, no dot headings, scope headings", () => {
  const nm = draw(JSON.parse(read("tests/fixtures/reported/deck39-sol-s12-tags.json")).spec);
  const tags = nm.els.filter((e) => e.t === "roundrect" && e.text);
  assert.equal(tags.length, 4);
  const dark = nm.els.filter((e) => e.t === "rect" && e.h > 30 && e.x > 500);
  tags.forEach((tg) => {
    const col = dark.find((c) => tg.y >= c.y && tg.y < c.y + c.h);
    assert.ok(col, "the tag sits in its column");
    assert.ok(Math.abs((tg.x + tg.w / 2) - (col.x + col.w / 2)) < 2, "centred in its column");
  });
  assert.doesNotMatch(read("src/ProposalDesigns_1_Understanding.gs"), /icon: 'decision question'/);
  const raci = draw({ type: "comparison", deckLibrary: "proposal", title: "RACI matrix across delivery workstreams", lead: "Explicit decision rights across both organizations.",
    left: { label: "66degrees R · Tailwind A or C", points: ["Architecture and security: 66degrees R, Tailwind A for cloud IAM policies", "Pipeline and Looker build: 66degrees R and A, Tailwind C for logic", "Dataplex rule coding: 66degrees R, Tailwind A for threshold validation"] },
    right: { label: "Tailwind R and A · 66degrees C", points: ["Source system access: Tailwind R and A, 66degrees C for firewall rules"] } });
  assert.equal(raci.type, "table");
  ["Workstream", "66degrees", "Tailwind", "Responsible and accountable"].forEach((w) => assert.ok(texts(raci).includes(w), w));
  const sup = draw({ type: "bullets", deckLibrary: "proposal", title: "Support model", items: [{ title: "L1 and L2 · operations and recovery", points: ["24/7 monitoring and triage", "Pipeline restarts"] }, { title: "L3 · engineering", points: ["Root-cause fixes", "Schema tuning"] }, { title: "Bridge · critical incidents", points: ["Live bridge", "Follow-the-sun"] }] });
  assert.ok(texts(sup).includes("L1 and L2: operations and recovery"));
  const plan = { slides: [{ type: "bullets", title: "Scope: what is in and what is out", points: ["In initial scope", "Out of scope (future phases)", "Deferred to subsequent releases", "Items requiring technical spikes"] }] };
  G.normalizeShapes_(plan, { log: [], userPrompt: "x" });
  assert.equal(plan.slides[0].type, "cards", "headings become items, so their content is written");
});

test("6. release gate: every design of every library - nothing half outside its box, nothing off the slide", () => {
  const rows = GATE.survey(ROOT).filter((r) => r.own);
  assert.ok(rows.length > 1000, "designs drawn: " + rows.length);
  const bad = rows.filter((r) => ((r.o.qa && r.o.qa.issues) || []).some((k) => k === "detached" || k === "off-slide" || k === "overlap"));
  assert.deepEqual(bad.map((r) => r.tag + ":" + r.n + ":" + r.len + " " + r.o.qa.issues.join(",")), []);
  const reverted = rows.filter((r) => ((r.o.qa && r.o.qa.fixed) || []).includes("fit-reverted"));
  assert.ok(reverted.length <= 10, "box fitting undone on few designs: " + reverted.length);
});

test("6. release gate: all 210 logged slides (decks 38, 39) and every reported slide pass the checker", () => {
  assert.equal(LOGS.length, 210);
  const bad = [];
  LOGS.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => ["empty", "overlap", "cut", "detached", "off-slide", "record-text", "dot-heading", "repeat-title"].indexOf(x) !== -1);
    if (iss.length) bad.push(r.title + ": " + iss.join(","));
  });
  assert.deepEqual(bad, []);
  fs.readdirSync(path.join(ROOT, "tests/fixtures/reported")).filter((f) => /\.json$/.test(f)).forEach((f) => {
    const res = replay(G, JSON.parse(read("tests/fixtures/reported/" + f)).spec);
    assert.ok(!res.issues.some((k) => k === "detached" || k === "off-slide"), f + ": " + res.issues.join(","));
  });
});
