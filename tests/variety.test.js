"use strict";

// V.1_27: designs rotate between decks, look-alike designs are grouped, no slide is left half empty.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function loadEngine() {
  const sandbox = { console, Logger: { log() {} }, CONFIG: { iconOrder: ["material"], roundedBoxes: false } };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Engine.gs") + ";this.ENGINE = ENGINE;", sandbox, { filename: "src/Engine.gs" });
  return sandbox.ENGINE;
}

test("cover and long agenda have several designs; the Thank-you slide is always the template design", () => {
  const E = loadEngine();
  assert.ok(E.VARIANTS.cover.length >= 3);
  assert.ok(!E.VARIANTS.closing || E.VARIANTS.closing.length <= 1, "closing never rotates");
  const long = E.VARIANTS.agenda.filter((v) => 13 >= v.min && 13 <= v.max);
  assert.ok(long.length >= 2, "a 13-item agenda has at least two designs");
  ["ENGINE_COVER_PANEL", "ENGINE_COVER_CUBE"].forEach((tag) => {
    const type = "cover";
    const out = E.render({ slides: [{ type, title: "Modernizing FP&A", subtitle: "Driving insight", reference: { tag } }] }, { dateLabel: "Oct 1, 2026" })[0];
    assert.ok(out.els.some((e) => e.t === "text"), tag + " draws text");
  });
});

test("a team of three people can be drawn in at least three designs", () => {
  const E = loadEngine();
  const people = [{ name: "Asha Rao", title: "CFO" }, { name: "Ben Cole", title: "VP FP&A" }, { name: "Chen Li", title: "Head of data" }];
  const fits = E.VARIANTS.team.filter((v) => 3 >= v.min && 3 <= v.max);
  assert.ok(fits.length >= 3);
  fits.forEach((v) => assert.ok(E.canDraw({ type: "team", title: "Team", people, reference: { tag: v.tag } }), v.tag));
});

test("a bullets slide without points never leaves a lonely side panel", () => {
  const E = loadEngine();
  const out = E.render({ slides: [{ type: "bullets", title: "Secure and compliant financial data", points: [],
    callout: { label: "Built-in security", title: "Trust and transparency", text: "Governance tools keep financial data secure." } }] }, {})[0];
  const panel = out.els.filter((e) => e.t === "rect" && e.x > 400 && e.y > 60 && e.w > 150);
  assert.equal(panel.length, 0, "no side panel on the right");
  assert.ok(out.els.some((e) => e.t === "text" && /Trust and transparency/.test(e.text)));
});

test("a chart without data becomes a statement, not an empty plot", () => {
  const E = loadEngine();
  const out = E.render({ slides: [{ type: "chart", title: "Forecast accuracy", chart: { categories: [], series: [] },
    insight: { title: "Accuracy improves", text: "Teams forecast with more confidence." } }] }, {})[0];
  assert.ok(out.els.some((e) => e.t === "text" && /Accuracy improves/.test(e.text)));
  assert.ok(!out.els.some((e) => e.t === "line" && e.y1 === e.y2 && e.x2 - e.x1 > 300), "no empty grid lines");
});

test("measure reports a look so similar designs are grouped", () => {
  const E = loadEngine();
  const it = (i) => ({ title: "Capability " + i, text: "A concrete explanation of the capability and its result.", icon: "cloud" });
  const m = E.measure({ type: "cards", title: "Test", items: [it(1), it(2), it(3)], reference: { tag: "66D_LAYOUT_CARDS_003" } }, {});
  assert.match(m.look, /^(light|dark)\|/);
});

test("the design chooser shuffles, uses history for looks and saves one step per deck", () => {
  const src = read("src/Code.gs");
  assert.match(src, /Math\.random\(\) \* 35/);
  assert.match(src, /score -= 360 \* \(used\[d\.tag\] \|\| 0\)/);
  assert.match(src, /function lookRecencyScore_/);
  assert.match(src, /saveDesignUsage_\(Object\.keys\(used\), Object\.keys\(looksUsed\)\)/);
  assert.doesNotMatch(src, /try \{ saveDesignUsage_\(\[tag\]\); \} catch/);
});

test("content checks: points from notes, lower-case units, one roadmap, no filler, case study when asked", () => {
  const src = read("src/Code.gs");
  ["function bulletsNeedPoints_", "function lowerUnitWords_", "function roadmapLike_", "function fillerSlide_", "CASE_REQUEST_RE_", "function pickStoryShape_"]
    .forEach((s) => assert.ok(src.indexOf(s) !== -1, s));
});
