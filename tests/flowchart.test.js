"use strict";

// Flowchart tab: a new slide right after the current one, with an aligned, layered flowchart.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function loadDiagram() {
  const sandbox = { console, Logger: { log() {} }, CONFIG: { iconOrder: ["material"], roundedBoxes: true } };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Engine.gs") + "\n" + read("src/Diagram.gs") + ";this.ENGINE=ENGINE;this.DiagramIR=DiagramIR;", sandbox, { filename: "engine+diagram" });
  return sandbox;
}

const N = (id, label, type) => ({ id, label, type: type || "process" });
const E = (from, to, label) => ({ from, to, label });
const AREA = { x: 40, y: 80, w: 640, h: 270 };

const SAMPLES = {
  linear: { type: "flowchart", nodes: [N("a", "Invoice received", "terminator"), N("b", "Match to purchase order"), N("c", "Check amount"), N("d", "Approve payment"), N("e", "Pay supplier", "terminator")],
    edges: [E("a", "b"), E("b", "c"), E("c", "d"), E("d", "e")] },
  branch: { type: "flowchart", nodes: [N("s", "Ticket opened", "terminator"), N("t", "Classify"), N("u", "Urgent?", "decision"), N("v", "Page on-call"), N("w", "Add to queue"), N("x", "Resolve"), N("y", "Close", "terminator")],
    edges: [E("s", "t"), E("t", "u"), E("u", "v", "Yes"), E("u", "w", "No"), E("v", "x"), E("w", "x"), E("x", "y")] },
  long: { type: "process", nodes: Array.from({ length: 10 }, (_, i) => N("n" + i, "Step number " + (i + 1))),
    edges: Array.from({ length: 9 }, (_, i) => E("n" + i, "n" + (i + 1))) },
  loop: { type: "flowchart", nodes: [N("a", "Build model"), N("b", "Peer review"), N("c", "Passes?", "decision"), N("d", "Publish", "terminator")],
    edges: [E("a", "b"), E("b", "c"), E("c", "d", "Yes"), E("c", "a", "No")] }
};

const overlap = (p, q) => p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;

test("flowchart layout: every sample fits the area, boxes never overlap, the chart is centred", () => {
  const g = loadDiagram();
  Object.keys(SAMPLES).forEach((name) => {
    const L = g.DiagramIR.layoutFlowchart(SAMPLES[name], AREA);
    const boxes = Object.keys(L.pos).map((k) => L.pos[k]);
    assert.equal(boxes.length, SAMPLES[name].nodes.length, name + ": every step is placed");
    boxes.forEach((b) => {
      assert.ok(b.x >= AREA.x - 0.5 && b.x + b.w <= AREA.x + AREA.w + 0.5, name + ": inside horizontally");
      assert.ok(b.y >= AREA.y - 0.5 && b.y + b.h <= AREA.y + AREA.h + 0.5, name + ": inside vertically");
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), name + ": no overlap");
    const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
    assert.ok(Math.abs((minX - AREA.x) - (AREA.x + AREA.w - maxX)) < 1, name + ": centred left-right");
    assert.ok(Math.abs((minY - AREA.y) - (AREA.y + AREA.h - maxY)) < 1, name + ": centred top-bottom");
  });
});

test("flowchart layout: a straight chain sits on one line, a long chain wraps, branches share a column", () => {
  const g = loadDiagram();
  const lin = g.DiagramIR.layoutFlowchart(SAMPLES.linear, AREA);
  const cys = Object.keys(lin.pos).map((k) => Math.round(lin.pos[k].cy));
  assert.equal(new Set(cys).size, 1, "all steps on one row");
  assert.equal(g.DiagramIR.layoutFlowchart(SAMPLES.long, AREA).dir, "SNAKE");
  const br = g.DiagramIR.layoutFlowchart(SAMPLES.branch, AREA).pos;
  assert.ok(Math.abs(br.v.cx - br.w.cx) < 0.5, "Yes and No targets in the same column");
  assert.ok(Math.abs((br.v.cy + br.w.cy) / 2 - br.u.cy) < 0.5, "branches balanced around the decision");
});

test("flowchart elements: text inside boxes, arrow heads on every connection, labelled branches, loop underneath", () => {
  const g = loadDiagram();
  const els = g.DiagramIR.flowchartToElements(SAMPLES.loop, AREA);
  const boxes = els.filter((e) => e.t === "rect" || e.t === "shape");
  assert.equal(boxes.length, 4);
  boxes.forEach((b) => { assert.ok(b.text && b.textStyle && b.textStyle.align === "center" && b.textStyle.valign === "middle"); });
  assert.ok(boxes.some((b) => b.shape === "FLOW_CHART_DECISION"));
  const arrows = els.filter((e) => e.t === "line" && e.arrow);
  assert.equal(arrows.length, SAMPLES.loop.edges.length, "one arrow head per connection");
  const labels = els.filter((e) => e.t === "text").map((e) => e.text);
  assert.deepEqual(Array.from(labels).sort(), ["No", "Yes"]);
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  assert.ok(els.some((e) => e.t === "line" && e.y1 > bottom && e.y2 > bottom), "loop runs under the chart");
  // branch labels never sit on top of a box
  const bels = g.DiagramIR.flowchartToElements(SAMPLES.branch, AREA);
  const bboxes = bels.filter((e) => e.t === "rect" || e.t === "shape");
  bels.filter((e) => e.t === "text").forEach((t) => {
    const inner = { x: t.x + 7.2, y: t.y + 7.2, w: t.w - 14.4, h: t.h - 14.4 };
    const textW = 6 * t.text.length;
    const ink = t.align === "right" ? { x: inner.x + inner.w - textW, y: inner.y, w: textW, h: inner.h } : inner;
    bboxes.forEach((b) => assert.ok(!overlap(ink, b), "label " + t.text + " clear of boxes"));
  });
});

test("a diagram slide keeps its title and draws the flowchart below it", () => {
  const g = loadDiagram();
  const out = g.ENGINE.render({ slides: [{ type: "diagram", title: "Support ticket triage", lead: "Urgent tickets skip the queue", diagram: SAMPLES.branch, items: [] }] }, { dateLabel: "Oct 1, 2026" })[0];
  const title = out.els.find((e) => e.t === "text" && /Support ticket triage/.test(e.text));
  assert.ok(title, "title kept");
  const boxes = out.els.filter((e) => (e.t === "rect" || e.t === "shape") && e.text);
  assert.equal(boxes.length, SAMPLES.branch.nodes.length);
  boxes.forEach((b) => assert.ok(b.y >= title.y + 20, "chart starts under the title"));
});

test("the sidebar has a Flowchart tab without direction or placement choices", () => {
  const html = read("src/Generator.html");
  assert.match(html, /mode-flowchart/);
  assert.match(html, /id="flowText"/);
  assert.match(html, /id="flowTypes"/);
  assert.doesNotMatch(html, /id="flowDir"|id="flowPlace"/);
  assert.match(html, /right after the slide you are on/);
  assert.match(html, /runFlowchartGeneration\(payload\)/);
});

function loadCode(slides, currentIndex) {
  const inserted = [];
  const rendered = [];
  const pres = {
    getSlides: () => slides,
    getSelection: () => ({ getCurrentPage: () => (currentIndex == null ? null : slides[currentIndex]) }),
    insertSlide(i) { const s = { getObjectId: () => "new", selectAsCurrentPage() { s.selected = true; } }; inserted.push({ i, s }); slides.splice(i, 0, s); return s; },
    getPageWidth: () => 720, getPageHeight: () => 405
  };
  const sandbox = {
    console, Logger: { log() {} }, Date, Math, JSON,
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" } },
    Utilities: { formatDate: () => "Oct 8, 2026" }, Session: { getScriptTimeZone: () => "UTC" }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Code.gs"), sandbox, { filename: "src/Code.gs" });
  vm.runInContext(read("src/Diagram.gs"), sandbox, { filename: "src/Diagram.gs" });
  Object.assign(sandbox, {
    loadRunContext_(ctx) { ctx.tokens = null; },
    flowchartIrFromText_: () => ({ title: "Ticket triage", lead: "", ir: SAMPLES.branch }),
    renderEngineSlide(slide, spec) { rendered.push(spec); },
    generationResult_: (msg, t, n) => ({ message: msg, count: n })
  });
  return { sandbox, inserted, rendered };
}

test("runFlowchartGeneration always adds a new slide right after the current slide", () => {
  const sl = (id) => ({ getObjectId: () => id });
  const slides = [sl("s1"), sl("s2"), sl("s3")];
  const { sandbox, inserted, rendered } = loadCode(slides, 1);
  const res = sandbox.runFlowchartGeneration({ mode: "Flowchart", prompt: "Ticket opened, classify, if urgent page on-call else queue, resolve, close" });
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].i, 2, "inserted after slide 2");
  assert.ok(inserted[0].s.selected, "new slide is selected");
  assert.equal(rendered[0].type, "diagram");
  assert.match(res.message, /^SUCCESS: flowchart added as slide 3/);
});

test("runFlowchartGeneration with no current slide adds the flowchart at the end, and needs input", () => {
  const sl = (id) => ({ getObjectId: () => id });
  const { sandbox, inserted } = loadCode([sl("a"), sl("b")], null);
  sandbox.runFlowchartGeneration({ prompt: "Step one then step two" });
  assert.equal(inserted[0].i, 2);
  assert.throws(() => sandbox.runFlowchartGeneration({ prompt: "" }), /Describe the steps/);
});
