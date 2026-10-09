"use strict";

// V.1_33: fixes from the deck 6 review (FBM pictures through diagram-design), the slide meter (1-10) and the type choice.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DECK6 = require("./fixtures/deck6-specs.js");

function load(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], roundedBoxes: true },
    progressStage_() {}, checkCancel_() {} }, extra || {});
  vm.createContext(sandbox);
  const code = read("src/Code.gs");
  const a = code.indexOf("function sentenceCase_"), b = code.indexOf("// Template thumbnails", a);
  vm.runInContext(code.slice(a, b).replace(/^const /gm, "var "), sandbox, { filename: "sentenceCase_" });
  ["src/Engine.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  return sandbox;
}
const AREA = { x: 40, y: 92, w: 640, h: 260 };
const over = (p, q, m) => p.x < q.x + q.w - (m || 0.5) && q.x < p.x + p.w - (m || 0.5) && p.y < q.y + q.h - (m || 0.5) && q.y < p.y + p.h - (m || 0.5);
const segHits = (l, q) => Math.min(l.x1, l.x2) < q.x + q.w - 1 && Math.max(l.x1, l.x2) > q.x + 1 && Math.min(l.y1, l.y2) < q.y + q.h - 1 && Math.max(l.y1, l.y2) > q.y + 1;

function drawAll(g) {
  return DECK6.map((d) => {
    const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(d)), d.type, "deck6");
    return { d, ir, els: g.drawDiagramDesign_(ir, AREA) };
  });
}

test("deck 6 replay: boxes never overlap, never too narrow, every arrow avoids boxes it does not connect", () => {
  const g = load();
  drawAll(g).forEach(({ d, ir, els }) => {
    const boxes = els.filter((e) => (e.t === "rect" || e.t === "shape") && e.text);
    assert.equal(boxes.length, ir.nodes.length, d.title + ": all boxes drawn");
    boxes.forEach((b) => assert.ok(b.w >= 84, d.title + ": " + b.text + " is " + b.w + "pt wide"));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!over(boxes[i], boxes[j]), d.title + ": overlap");
    els.filter((e) => e.t === "line").forEach((l) => {
      assert.ok(Math.abs(l.x1 - l.x2) < 0.01 || Math.abs(l.y1 - l.y2) < 0.01, d.title + ": orthogonal");
      const through = boxes.filter((b) => segHits(l, b));
      // a segment may only touch the boxes at its own ends (it starts / stops on their edge, never crosses inside)
      through.forEach((b) => assert.fail(d.title + ": a line runs through " + b.text.split("\n")[0]));
    });
  });
});

test("deck 6 replay: labels never sit on boxes, lines or each other; arrows enter boxes square-on", () => {
  const g = load();
  drawAll(g).forEach(({ d, els }) => {
    const boxes = els.filter((e) => (e.t === "rect" || e.t === "shape") && e.text);
    const labels = els.filter((e) => e.edgeLabel).map((t) => ({ text: t.text, x: t.x + 7.2, y: t.y + 8.2, w: t.w - 14.4, h: t.h - 16.4 }));
    labels.forEach((r, i) => {
      boxes.forEach((b) => assert.ok(!over(r, b), d.title + ": label " + r.text + " on " + b.text));
      labels.slice(i + 1).forEach((q) => assert.ok(!over(r, q), d.title + ": labels " + r.text + " / " + q.text));
    });
    const lines = els.filter((e) => e.t === "line");
    lines.filter((l) => l.arrow).forEach((l) => {
      const into = boxes.find((b) => Math.abs(l.x2 - b.x) < 0.6 || Math.abs(l.x2 - b.x - b.w) < 0.6 || Math.abs(l.y2 - b.y) < 0.6 || Math.abs(l.y2 - b.y - b.h) < 0.6);
      if (!into) return;
      const horiz = Math.abs(l.y1 - l.y2) < 0.01;
      const onSide = Math.abs(l.x2 - into.x) < 0.6 || Math.abs(l.x2 - into.x - into.w) < 0.6;
      if (onSide && l.y2 > into.y + 1 && l.y2 < into.y + into.h - 1) assert.ok(horiz, d.title + ": arrow into the side of " + into.text.split("\n")[0] + " is horizontal");
      assert.ok(Math.hypot(l.x2 - l.x1, l.y2 - l.y1) >= 7.9, d.title + ": arrow head has a run before it");
    });
  });
});

test("two opposite arrows become one two-way arrow; a label repeated on many arrows is shown once; decision loops stay apart", () => {
  const g = load();
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[3])), "architecture", "t");
  const mk = ir.edges.filter((e) => (e.from === "mk" && e.to === "h") || (e.from === "h" && e.to === "mk"));
  assert.equal(mk.length, 1);
  assert.equal(mk[0].both, true);
  assert.equal(ir.edges.filter((e) => e.label === "Product building").length, 1);
  const els = g.drawDiagramDesign_(ir, AREA);
  assert.ok(els.some((e) => e.t === "line" && e.startArrow), "double-headed arrow drawn");
  const loop = g.ddSpecToIr_({ type: "flowchart", nodes: [{ id: "a", label: "Build" }, { id: "v", label: "Valid?", kind: "decision" }, { id: "d", label: "Done", kind: "end" }],
    edges: [{ from: "a", to: "v" }, { from: "v", to: "a", label: "No" }, { from: "v", to: "d", label: "Yes" }] }, "flowchart", "t");
  assert.equal(loop.edges.length, 3, "decision exits are never merged");
});

test("lanes / zones that only repeat their box are dropped; a zone around one box is dropped; details are sentence case", () => {
  const g = load();
  const one = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[0])), "process", "t");
  assert.deepEqual(Array.from(one.groups.map((x) => x.label)), ["Governance hub"]);
  const hub = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[3])), "architecture", "t");
  assert.ok(!hub.groups.some((x) => x.label === "Central hub" || x.label === "Governance"), "single-box zones dropped");
  assert.equal(hub.nodes.find((n) => n.id === "fw").sub, "Unified governance & risk management");
  assert.equal(hub.nodes.find((n) => n.id === "h").sub, "66degrees centralized hub");
  const six = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[5])), "data-flow", "t");
  assert.equal(six.groups.find((x) => x.id === "l1").label, "", "a lane named like its box loses the repeated name");
  assert.equal(g.sentenceCase_("Business FDEs and APIs", 1), "Business FDEs and APIs", "acronym plurals keep capitals");
});

test("a hub without its own zone still sits in the centre with feeders left and outputs right", () => {
  const g = load();
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[3])), "architecture", "t");
  const els = g.drawDiagramDesign_(ir, AREA);
  const box = (id) => els.find((e) => e.nodeId === id);
  assert.ok(box("mk").x < box("h").x && box("h").x + box("h").w < box("ad").x, "departments | hub | outputs");
  const zones = els.filter((e) => e.zone);
  zones.forEach((z) => {
    const inside = els.filter((e) => e.nodeId && e.x >= z.x && e.x + e.w <= z.x + z.w && e.y >= z.y - 1 && e.y < z.y + z.h);
    inside.forEach((b) => assert.ok(b.y + b.h <= z.y + z.h + 0.5, "box " + b.text + " stays inside its zone"));
  });
});

test("flowchart order starts at the start step; supporting controls sit in a row under the flow", () => {
  const g = load();
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[4])), "process", "t");
  const els = g.drawDiagramDesign_(ir, AREA);
  const box = (id) => els.find((e) => e.nodeId === id);
  ["i", "d", "b", "v", "p"].reduce((prev, id) => { assert.ok(box(id).x > prev, id + " is right of the step before"); return box(id).x; }, -1);
  ["ds", "gb", "ci", "va"].forEach((id) => assert.ok(box(id).y > box("v").y + box("v").h, id + " sits under the flow"));
  assert.ok(els.some((e) => e.t === "line" && e.dash), "the iterate loop is dashed");
});

test("text fits its box: a detail line is left off before anything spills; data and store shapes are real shapes", () => {
  const g = load();
  const six = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[5])), "data-flow", "t");
  g.drawDiagramDesign_(six, AREA).filter((e) => e.text && e.textStyle).forEach((e) => {
    const w = e.shape === "FLOW_CHART_INPUT_OUTPUT" ? e.w * 0.74 : e.shape === "FLOW_CHART_DECISION" ? e.w * 0.62 : e.w;
    const [label, sub] = e.text.split("\n");
    const need = g.ddLines_(label, w, e.textStyle.size) * e.textStyle.size * 1.2 + (sub ? g.ddLines_(sub, w, e.textStyle.subSize) * e.textStyle.subSize * 1.2 : 0);
    assert.ok(need <= e.h, e.text.replace("\n", " / ") + " fits");
  });
  const r = read("src/EngineRenderer.gs");
  assert.match(r, /FLOW_CHART_INPUT_OUTPUT: true/);
  assert.match(r, /FLOW_CHART_MAGNETIC_DISK: true/);
  assert.match(r, /setStartArrow/);
  assert.doesNotMatch(read("src/Diagram.gs") + read("src/DiagramDesign.gs"), /FLOW_CHART_DATA'/);
});

test("a box label that only starts like the title is not mistaken for it (no stray text)", () => {
  const g = load();
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK6[5])), "data-flow", "t");
  const out = g.ENGINE.render({ slides: [{ type: "diagram", title: DECK6[5].title, lead: DECK6[5].lead, diagram: ir, items: ir.nodes.map((n) => ({ title: n.label, text: n.label })) }] }, { dateLabel: "x" })[0];
  const strays = out.els.filter((e) => e.t === "text" && /^Departmental inputs$/.test(e.text));
  assert.equal(strays.length, 0);
});

test("swimlane steps never get narrower than 84pt: a long lane turns the lanes into columns", () => {
  const g = load();
  const ir = g.ddSpecToIr_({ type: "swimlane", groups: [{ id: "a", label: "Sales team", kind: "lane" }, { id: "b", label: "Finance team", kind: "lane" }],
    nodes: "One,Two,Three,Four,Five,Six,Seven".split(",").map((l, i) => ({ id: "n" + i, label: "Step " + l, group: i % 2 ? "b" : "a" })),
    edges: [0, 1, 2, 3, 4, 5].map((i) => ({ from: "n" + i, to: "n" + (i + 1) })) }, "swimlane", "t");
  const els = g.drawDiagramDesign_(ir, AREA);
  const boxes = els.filter((e) => e.nodeId);
  boxes.forEach((b) => assert.ok(b.w >= 84));
  assert.ok(boxes[1].y > boxes[0].y, "steps run down the slide");
});

test("slide meter: N slides shared across the pictures, each told exactly how many to draw", () => {
  const calls = [];
  const g = load({ callGeminiJSON(parts) {
    calls.push(parts[0].text);
    if (/Return ONLY JSON: \{"is_diagram"/.test(parts[0].text)) {
      const n = Number((parts[0].text.match(/EXACTLY (\d+) diagram/) || [])[1] || 1);
      return { is_diagram: true, type: "flowchart", slides: Array.from({ length: n }, (_, i) => ({ title: "S" + i, type: "flowchart" })) };
    }
    const n = (parts[0].text.match(/"focus"/g) || []).length;
    return { diagrams: Array.from({ length: Math.max(1, n) }, (_, i) => ({ title: "D" + i, type: "flowchart", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] })) };
  } });
  const pic = (n) => ({ label: "p" + n, image: { mime: "image/png", data: "AA" } });
  const res = g.diagramDesignRead_({ items: [pic(1), pic(2)] }, { slides: 5 }, { log: [] });
  const asked = calls.filter((t) => /is_diagram/.test(t) && /EXACTLY/.test(t)).map((t) => Number(t.match(/EXACTLY (\d+)/)[1]));
  assert.deepEqual(asked, [3, 2], "5 slides over 2 pictures = 3 + 2");
  assert.equal(res.diagrams.length, 5);
  calls.length = 0;
  const one = g.diagramDesignRead_({ items: [pic(1), pic(2), pic(3)] }, { slides: 2 }, { log: [] });
  assert.equal(one.diagrams.length, 2, "only as many pictures as slides");
  assert.ok(one.log.some((l) => /slide count \(2\) is used up/.test(l)));
  const code = read("src/Code.gs");
  assert.match(code, /const slidesWanted = Math\.max\(1, Math\.min\(10, Math\.round\(Number\(data\.slides\) \|\| 1\)\)\)/);
});

test("panel: the type is optional (Auto, a type, or nothing), a chosen type is used for every slide, and a 1-10 slide meter is sent", () => {
  const html = read("src/Generator.html");
  assert.match(html, /id="flowTypes" role="group"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1, "Auto is chosen at the start");
  assert.match(html, /Diagram type <span class="opt">\(optional\)<\/span>/);
  assert.match(html, /var off = b && b\.classList\.contains\("active"\);/, "clicking the chosen chip clears it (nothing chosen = Auto)");
  assert.match(html, /id="flowSlides" type="range" min="1" max="10"/);
  assert.match(html, /id="flowSlidesInput" type="number" min="1" max="10"/);
  assert.match(html, /slides: state\.flow\.slides,/);
  assert.match(html, /v = Math\.max\(1, Math\.min\(10, v\)\);/);
  const ds = read("src/DiagramDesign.gs");
  assert.match(ds, /if \(forced && d\) d\.type = forced;/, "the chosen type wins on every slide");
});
