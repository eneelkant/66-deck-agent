"use strict";

// V.1_36: Rebrand review (BMI rate card): tables redrawn from the source with every row and column, continuation
// slides instead of cut rows, grouped cells, right-aligned numbers, sentence-case titles / headers, and the old brand
// (tagline, corner triangle, Work Sans) removed from the slide masters and layouts.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const BMI = JSON.parse(read("tests/fixtures/bmi-tables.json"));

function load(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Brand.gs", "src/Rebrand.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const tableSpec = (g, i) => { const t = g.extractSourceTable_(BMI[i]); return { type: "table", title: "Rate card (INR)", columns: t.columns, rows: t.rows, fromSource: true }; };

test("source tables are read cell by cell: every row, every column, merged groups kept", () => {
  const g = load();
  [0, 1].forEach((i) => {
    const t = g.extractSourceTable_(BMI[i]);
    assert.deepEqual(Array.from(t.columns), ["Skill", "Experience", "Role", "Hourly Rate (INR)", "Weekly Rate (INR)"]);
    assert.equal(t.rows.length, 12, "all 12 rate rows");
    t.rows.forEach((r) => assert.equal(r.length, 5));
    assert.equal(t.rows[4][1], "0-3");
    assert.equal(t.rows[1][0], "", "covered cell of a merge stays empty");
  });
  const t1 = g.extractSourceTable_(BMI[1]);
  assert.equal(t1.rows[8][0], "Project Manager / Scrum Master");
  assert.equal(t1.rows[11][4], "₹294,525");
});

test("the table design draws all rows and columns, headers whole, numbers right-aligned, a group label once", () => {
  const g = load();
  [0, 1].forEach((i) => {
    const sp = tableSpec(g, i);
    assert.equal(g.ENGINE.tableRowsThatFit(sp), 12);
    const out = g.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
    const texts = out.els.filter((e) => e.t === "text");
    const all = texts.map((e) => e.text);
    sp.rows.forEach((r) => r.forEach((v) => { if (v) assert.ok(all.includes(g.ENGINE.cleanText(v)), "missing " + v); }));
    sp.columns.forEach((c) => assert.ok(all.includes(c), "header " + c));
    assert.ok(!all.some((t) => /…/.test(t)), "nothing cut with an ellipsis");
    const price = texts.find((e) => e.text === sp.rows[0][3]);
    assert.equal(price.align, "right");
    assert.equal(all.filter((t) => t === sp.rows[0][0]).length, 1, "group label shown once");
    const sizes = new Set(texts.filter((e) => e.y > 60).map((e) => e.size));
    assert.deepEqual(Array.from(sizes), [10]);
  });
});

test("the 3-4 column and 2-column table designs never take a table they would cut", () => {
  const g = load();
  const sp = Object.assign(tableSpec(g, 1), { reference: { tag: "66D_LAYOUT_TABLE_004" } });
  assert.equal(g.ENGINE.canDraw(sp), false);
  const small = { type: "table", title: "x", columns: ["A", "B", "C"], rows: [["1", "2", "3"], ["4", "5", "6"]], reference: { tag: "66D_LAYOUT_TABLE_004" } };
  assert.equal(g.ENGINE.canDraw(small), true);
});

test("a long table continues on new slides: every row kept, group label carried, '(continued)' title", () => {
  const g = load();
  const base = tableSpec(g, 0);
  const rows = [].concat(base.rows, base.rows, base.rows);           // 36 rows
  const parts = g.splitTableSpec_(Object.assign({}, base, { rows: rows }));
  assert.ok(parts.length >= 3);
  assert.equal(parts.reduce((a, p) => a + p.rows.length, 0), 36);
  parts.slice(1).forEach((p) => { assert.match(p.title, /\(continued\)$/); assert.ok(String(p.rows[0][0]).trim(), "group label carried"); });
  const src = read("src/Rebrand.gs");
  assert.match(src, /deck\.insertSlide\(at, SlidesApp\.PredefinedLayout\.BLANK\)/);
});

test("sentence case for rebranded titles and headers, names untouched; old taglines removed", () => {
  const g = load();
  assert.equal(g.rebrandCase_("Rate Card (INR)"), "Rate card (INR)");
  assert.equal(g.rebrandCase_("Hourly Rate (INR)"), "Hourly rate (INR)");
  assert.equal(g.rebrandCase_("Burns & McDonnell India\nProposed Rates"), "Burns & McDonnell India\nProposed rates");
  assert.equal(g.rebrandCase_("Google Cloud Partner Overview"), "Google Cloud partner overview");
  const spec = { type: "cover", title: "Burns & McDonnell India", subtitle: "#LetsGetYouThere" };
  g.stripOldBrandText_(spec);
  assert.equal(spec.subtitle, "");
});

test("old brand on the slide masters / layouts: tagline, triangle and Work Sans text removed, placeholders get the brand font", () => {
  const sent = [];
  const layouts = [{ objectId: "L1", pageElements: [
    { objectId: "ph", shape: { placeholder: { type: "TITLE" }, text: { textElements: [{ textRun: { content: "Title", style: { fontFamily: "Arial" } } }] } } },
    { objectId: "tag", shape: { shapeType: "TEXT_BOX", text: { textElements: [{ textRun: { content: "#LetsGetYouThere", style: { fontFamily: "Work Sans Medium" } } }] } } },
    { objectId: "tri", shape: { shapeType: "RIGHT_TRIANGLE", shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: { red: 0.03, green: 0.21, blue: 0.76 } } } } } } }] }];
  const g = load({ Slides: { Presentations: { get: () => ({ masters: [{ objectId: "M", pageElements: [] }], layouts: layouts }) } } });
  g.runBatches = (id, reqs) => { reqs.forEach((r) => sent.push(r)); };
  const ctx = { log: [] };
  g.cleanOldBrandLayouts_("p", ctx, {});
  const deleted = sent.filter((r) => r.deleteObject).map((r) => r.deleteObject.objectId);
  assert.deepEqual(deleted.sort(), ["tag", "tri"]);
  const style = sent.find((r) => r.updateTextStyle);
  assert.equal(style.updateTextStyle.objectId, "ph");
  assert.equal(style.updateTextStyle.style.fontFamily, "Plus Jakarta Sans");
  assert.match(ctx.log[0], /old-brand/);
});

test("rebrand flow: title + table slides are redrawn from the source table, never from Gemini's retyped copy", () => {
  const src = read("src/Rebrand.gs");
  assert.match(src, /const tEl = largestTable_\(slides\[i\]\);/);
  assert.match(src, /fromSource: true, reference: null/);
  assert.match(src, /!r\.spec\.fromSource && refs\[i\]/);
  assert.match(src, /cleanOldBrandLayouts_\(presId, ctx, stats\)/);
  assert.match(src, /OLD_BRAND_TEXT_RE_\.test\(t\.text\)\) &&/);
});
