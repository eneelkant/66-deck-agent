"use strict";

// Flowcharts and diagrams follow diagram-design (vendor/diagram-design): reading uploads (pictures, PDF, .pptx),
// two-step Vertex AI read (type selection, then the spec), and the type layouts drawn as editable shapes.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ---------- a tiny .zip writer / reader so a .pptx can be built and opened in the test ---------- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  Object.keys(files).forEach((name) => {
    const data = Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(files[name]);
    const crc = crc32(data), nm = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    locals.push(lh, nm, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nm);
    offset += 30 + nm.length + data.length;
  });
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat([cd, end]));
}
function readZip(buf) {
  const out = [];
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(p + 10);
  p = buf.readUInt32LE(p + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const name = buf.slice(p + 46, p + 46 + nl).toString(), off = buf.readUInt32LE(p + 42);
    const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
    const raw = buf.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + size);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    p += 46 + nl + el + cl;
  }
  return out;
}
const blob = (bytes, mime, name) => {
  const buf = Buffer.from(bytes);
  return { getBytes: () => buf, getDataAsString: () => buf.toString("utf8"), getName: () => name || "blob", getContentType: () => mime };
};
const UTILITIES = {
  base64Decode: (s) => Buffer.from(String(s), "base64"),
  base64Encode: (b) => Buffer.from(b).toString("base64"),
  newBlob: blob,
  unzip: (b) => readZip(b.getBytes()).map((f) => blob(f.data, "", f.name)),
  formatDate: () => "Oct 8, 2026"
};

function load(extra) {
  const sandbox = Object.assign({
    console, Logger: { log() {} }, Math, JSON, Date,
    CONFIG: { iconOrder: ["material"], roundedBoxes: true, maxSourceChars: 60000 },
    Utilities: UTILITIES,
    progressStage_() {},
    checkCancel_() {},
    sentenceCase_: (s) => String(s)
  }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  return sandbox;
}

const PNG_BIG = Buffer.alloc(60000, 7), PNG_LOGO = Buffer.alloc(900, 3);
function fbmLikePptx() {
  const slide = (no, text, rels) => ({
    ["ppt/slides/slide" + no + ".xml"]: '<p:sld><p:cSld><p:spTree><a:t>' + text + "</a:t></p:spTree></p:cSld></p:sld>",
    ["ppt/slides/_rels/slide" + no + ".xml.rels"]: "<Relationships>" + rels.map((r, i) => '<Relationship Id="rId' + i + '" Target="../media/' + r + '"/>').join("") + "</Relationships>"
  });
  return makeZip(Object.assign({ "[Content_Types].xml": "<Types/>" },
    slide(1, "IT-managed AI governance framework", ["image1.png", "logo.png"]),
    slide(2, "", ["image2.jpeg"]),
    slide(10, "Thank you &amp; next steps", []),
    { "ppt/media/image1.png": PNG_BIG, "ppt/media/logo.png": PNG_LOGO, "ppt/media/image2.jpeg": PNG_BIG }));
}

test("the diagram-design kit is generated from the vendored skill, up to date, with its MIT notice", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-diagram-kit.js"), "--check"], { stdio: "pipe" });
  assert.ok(fs.existsSync(path.join(ROOT, "vendor/diagram-design/LICENSE")));
  const g = load();
  const K = g.DIAGRAM_DESIGN_KIT;
  assert.match(K.source, /cathrynlavery\/diagram-design/);
  assert.match(read("src/DiagramDesignKit.gs"), /MIT License[\s\S]*Cathryn Lavery/);
  assert.match(K.philosophy, /highest-quality move is usually deletion/);
  assert.match(K.selection, /Decision logic with branches/);
  assert.match(K.budget, /Max nodes \| 9/);
  g.DiagramDesign.types.forEach((t) => assert.ok(K.types[t] && K.types[t].length > 200, "rules for " + t));
  assert.doesNotMatch(JSON.stringify(K.types), /<svg|<rect /, "web-renderer code is not bundled");
});

test("a .pptx is opened without Drive: the picture of each slide (not the logo) and its words", () => {
  const g = load();
  const up = { name: "Copy of FBM - AI (1).pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: fbmLikePptx().toString("base64") };
  const parts = g.diagramUploadParts_(up);
  assert.equal(parts.kind, "pptx");
  assert.deepEqual(Array.from(parts.slides.map((s) => s.slide)), [1, 2, 10], "slides in number order");
  assert.equal(parts.slides[0].images.length, 1, "logo dropped");
  assert.equal(parts.slides[0].images[0].mime, "image/png");
  assert.equal(parts.slides[1].images[0].mime, "image/jpeg");
  assert.equal(parts.slides[2].text, "Thank you & next steps");
  assert.equal(parts.items.filter((i) => i.image).length, 2);
  assert.equal(g.diagramUploadParts_({ name: "old.ppt", data: "" }).kind, "unsupported");
  assert.equal(g.diagramUploadParts_({ name: "a.pdf", mimeType: "application/pdf", data: "JVBE" }).kind, "pdf");
  assert.equal(g.diagramUploadParts_({ name: "a.png", mimeType: "image/png", data: "iVBO" }).kind, "image");
});

function geminiStub(answers) {
  const calls = [];
  return { calls, fn(parts) { calls.push(parts); return answers[calls.length - 1] || {}; } };
}

test("Vertex AI reads with diagram-design: 1) type selection with the selection table and budget, 2) the spec with the type's rules", () => {
  const stub = geminiStub([
    { is_diagram: true, shows: "Hub-and-spoke AI governance", type: "architecture", elements: 22,
      slides: [{ title: "Overview", type: "architecture", focus: "zones" }, { title: "Agent factory", type: "flowchart", focus: "pipeline" }] },
    { diagrams: [
      { title: "Hub-and-spoke governance", lead: "", type: "architecture", groups: [{ id: "a", label: "Business units", kind: "zone" }, { id: "h", label: "Hub", kind: "hub" }],
        nodes: [{ id: "m", label: "Marketing", kind: "actor", group: "a" }, { id: "f", label: "Agent factory", kind: "hub", group: "h", focal: true }, { id: "x", label: "Extra", group: "h", focal: true }, { id: "y", label: "Third focal", group: "h", focal: true }],
        edges: [{ from: "m", to: "f", label: "Builds" }] },
      { title: "Agent factory pipeline", type: "flowchart", nodes: [{ id: "i", label: "Idea", kind: "start" }, { id: "v", label: "Valid?", kind: "decision" }, { id: "d", label: "Deploy", kind: "end" }],
        edges: [{ from: "i", to: "v" }, { from: "v", to: "d", label: "Yes" }, { from: "v", to: "i", label: "No", style: "dashed" }] }
    ] }
  ]);
  const g = load({ callGeminiJSON: stub.fn });
  const res = g.diagramDesignRead_({ items: [{ label: "fbm slide 1", image: { mime: "image/png", data: "AAAA" } }] }, {}, { log: [], apiKey: "k", brand: { name: "66degrees" } });
  assert.equal(stub.calls.length, 2);
  const p1 = stub.calls[0][0].text, p2 = stub.calls[1][0].text;
  assert.match(p1, /diagram-design/); assert.match(p1, /Decision logic with branches/); assert.match(p1, /Max nodes \| 9/);
  assert.ok(stub.calls[0].some((x) => x.inline_data && x.inline_data.mime_type === "image/png"), "picture sent to Vertex AI");
  assert.match(p2, /TYPE "architecture"/); assert.match(p2, /TYPE "flowchart"/); assert.match(p2, /Group components by tier or trust boundary/);
  assert.equal(res.diagrams.length, 2, "overview + detail");
  assert.equal(res.diagrams[0].type, "architecture");
  assert.equal(res.diagrams[0].nodes.filter((n) => n.emphasize).length, 2, "at most two focal elements");
  assert.equal(res.diagrams[1].edges[2].dashed, true);
  assert.equal(res.diagrams[1].nodes[0].type, "terminator");
});

test("a photo that is not a diagram is handed back (Create keeps it as an image), and the user's type wins", () => {
  const stub = geminiStub([{ is_diagram: false, shows: "a team photo" }]);
  const g = load({ callGeminiJSON: stub.fn });
  const res = g.diagramDesignRead_({ items: [{ label: "team.jpg", image: { mime: "image/jpeg", data: "AA" } }] }, {}, { log: [] });
  assert.equal(res.diagrams.length, 0);
  assert.equal(res.notDiagram.length, 1);
  assert.equal(stub.calls.length, 1, "no spec call for a photo");
  const stub2 = geminiStub([{ is_diagram: true, type: "architecture", slides: [{ type: "architecture" }] }, { diagrams: [{ type: "architecture", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] }] }]);
  const g2 = load({ callGeminiJSON: stub2.fn });
  const r2 = g2.diagramDesignRead_({ items: [{ label: "d", text: "" }] }, { prompt: "a then b", wantedType: "swimlane" }, { log: [] });
  assert.match(stub2.calls[0][0].text, /asked for type "swimlane"/);
  assert.equal(r2.diagrams[0].type, "swimlane");
});

/* ---------- layouts ---------- */
const AREA = { x: 40, y: 84, w: 640, h: 268 };
const SPECS = {
  architecture: { type: "architecture", groups: [{ id: "bu", label: "Business units", kind: "zone" }, { id: "hub", label: "Hub", kind: "hub" }, { id: "out", label: "Deployment", kind: "zone" }],
    nodes: [{ id: "m", label: "Marketing", group: "bu" }, { id: "e", label: "Engineering", group: "bu" }, { id: "s", label: "Sales", group: "bu" }, { id: "f", label: "Agent factory", kind: "hub", group: "hub", focal: true },
      { id: "g", label: "Governance boards", group: "hub" }, { id: "c", label: "Agent catalog", kind: "store", group: "out" }, { id: "d", label: "Deployed apps", kind: "end", group: "out" }],
    edges: [{ from: "m", to: "f" }, { from: "e", to: "f" }, { from: "s", to: "f", label: "Builds" }, { from: "f", to: "c", label: "Publish" }, { from: "c", to: "d" }] },
  swimlane: { type: "swimlane", groups: [{ id: "a", label: "Accounts payable", kind: "lane" }, { id: "b", label: "Budget owner", kind: "lane" }],
    nodes: [{ id: "1", label: "Receive invoice", kind: "start", group: "a" }, { id: "2", label: "Approve?", kind: "decision", group: "b" }, { id: "3", label: "Pay", kind: "end", group: "a" }, { id: "4", label: "Reject", group: "b" }],
    edges: [{ from: "1", to: "2" }, { from: "2", to: "3", label: "Yes" }, { from: "2", to: "4", label: "No" }] },
  layers: { type: "layers", groups: [{ id: "l1", label: "Experience", kind: "layer" }, { id: "l2", label: "Data", kind: "layer" }],
    nodes: [{ id: "a", label: "Dashboards", group: "l1" }, { id: "b", label: "Agents", group: "l1" }, { id: "c", label: "BigQuery", group: "l2" }], edges: [] },
  "org-chart": { type: "org-chart", nodes: [{ id: "r", label: "Steering group" }, { id: "a", label: "Platform" }, { id: "b", label: "Governance" }, { id: "a1", label: "MLOps" }, { id: "a2", label: "Data" }],
    edges: [{ from: "r", to: "a" }, { from: "r", to: "b" }, { from: "a", to: "a1" }, { from: "a", to: "a2" }] },
  loop: { type: "loop", nodes: [{ id: "h", label: "Agent catalog", kind: "hub" }, { id: "a", label: "Find" }, { id: "b", label: "Build" }, { id: "c", label: "Validate" }, { id: "d", label: "Deploy" }, { id: "e", label: "Measure" }],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }, { from: "d", to: "e" }, { from: "e", to: "a" }, { from: "d", to: "h", style: "dashed" }] },
  flowchart: { type: "flowchart", nodes: [{ id: "i", label: "Idea", kind: "start" }, { id: "b", label: "Build", sub: "IaC agents" }, { id: "v", label: "Valid?", kind: "decision" }, { id: "d", label: "Deploy", kind: "end" }],
    edges: [{ from: "i", to: "b" }, { from: "b", to: "v" }, { from: "v", to: "d", label: "Yes" }, { from: "v", to: "b", label: "No", style: "dashed" }] }
};
const over = (p, q) => p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;

test("every type is drawn in the area: no overlapping boxes, orthogonal arrows, labels clear of boxes, one text size", () => {
  const g = load();
  Object.keys(SPECS).forEach((type) => {
    const ir = g.ddSpecToIr_(SPECS[type], type, "t");
    assert.ok(ir, type + " spec accepted");
    const els = g.drawDiagramDesign_(ir, AREA);
    const boxes = els.filter((e) => (e.t === "rect" || e.t === "shape") && e.text);
    assert.equal(boxes.length, ir.nodes.length, type + ": every node drawn");
    boxes.forEach((b) => {
      assert.ok(b.x >= AREA.x - 1 && b.x + b.w <= AREA.x + AREA.w + 1 && b.y >= AREA.y - 1 && b.y + b.h <= AREA.y + AREA.h + 1, type + ": " + b.text + " inside the area");
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!over(boxes[i], boxes[j]), type + ": " + boxes[i].text + " / " + boxes[j].text);
    if (type !== "loop") {
      els.filter((e) => e.t === "line").forEach((l) => assert.ok(Math.abs(l.x1 - l.x2) < 0.01 || Math.abs(l.y1 - l.y2) < 0.01, type + ": no diagonal arrows"));
    }
    els.filter((e) => e.edgeLabel).forEach((t) => {
      const ink = { x: t.x + 7.2, y: t.y + 7.2, w: t.w - 14.4, h: t.h - 14.4 };
      boxes.forEach((b) => assert.ok(!over(ink, b), type + ": label " + t.text + " clear of " + b.text));
    });
    const sizes = new Set(boxes.filter((b) => b.shape !== "FLOW_CHART_DECISION").map((b) => b.textStyle.size));
    assert.ok(sizes.size <= 1, type + ": one label size");
    assert.ok(boxes.filter((b) => b.fill === "#0052FF").length <= 2, type + ": accent on 1-2 elements");
  });
});

test("shape carries meaning: start/end ovals, decision diamond, store cylinder, dashed return flows", () => {
  const g = load();
  const ir = g.ddSpecToIr_(SPECS.architecture, "architecture", "t");
  const els = g.drawDiagramDesign_(ir, AREA);
  assert.ok(els.some((e) => e.shape === "FLOW_CHART_MAGNETIC_DISK" && /catalog/.test(e.text)));
  assert.ok(els.some((e) => e.shape === "FLOW_CHART_TERMINATOR" && /Deployed/.test(e.text)));
  assert.ok(els.filter((e) => e.zone).length >= 3, "zones drawn behind the boxes");
  const f = g.drawDiagramDesign_(g.ddSpecToIr_(SPECS.flowchart, "flowchart", "t"), AREA);
  assert.ok(f.some((e) => e.shape === "FLOW_CHART_DECISION"));
  assert.ok(f.some((e) => e.t === "line" && e.dash), "the No loop is dashed");
  assert.ok(f.some((e) => e.text === "Build\nIaC agents" && e.textStyle.subSize < e.textStyle.size), "detail line is smaller");
});

test("a diagram slide without an intro line keeps no stray box label near the title", () => {
  const g = load();
  const ir = g.ddSpecToIr_({ type: "flowchart", nodes: [{ id: "a", label: "Start", kind: "start" }, { id: "b", label: "Create flowchart" }, { id: "c", label: "End", kind: "end" }],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }] }, "flowchart", "t");
  const out = g.ENGINE.render({ slides: [{ type: "diagram", title: "Flowchart presentation creation process", lead: "", diagram: ir, items: ir.nodes.map((n) => ({ title: n.label, text: n.label })) }] }, { dateLabel: "x" })[0];
  const loose = out.els.filter((e) => e.t === "text" && /^Start$/.test(e.text));
  assert.equal(loose.length, 0, "no floating 'Start' text");
  const title = out.els.find((e) => e.t === "text" && /Flowchart presentation/.test(e.text));
  const boxes = out.els.filter((e) => (e.t === "rect" || e.t === "shape") && e.text);
  assert.equal(boxes.length, 3);
  boxes.forEach((b) => assert.ok(b.y > title.y + 20));
});

test("Create: each uploaded diagram takes over the slide that matches its topic, with the diagram's title", () => {
  const g = load();
  const ir = g.ddSpecToIr_(Object.assign({ title: "Hub-and-spoke AI governance", lead: "Departments build on one hub" }, SPECS.architecture), "architecture", "fbm.pptx");
  const plan = { slides: [
    { type: "cover", title: "AI at FBM" }, { type: "agenda", title: "Agenda" },
    { type: "cards", title: "Why AI now", items: [{ title: "Speed" }] },
    { type: "bullets", title: "How governance works", points: [], items: [{ title: "Agent factory and governance boards" }] },
    { type: "closing", title: "Thank you" }] };
  const n = g.attachDiagramsToPlan_(plan, { diagrams: [{ name: "fbm.pptx", ir }] }, { log: [] });
  assert.equal(n, 1);
  assert.equal(plan.slides[3].type, "diagram");
  assert.equal(plan.slides[3].title, "Hub-and-spoke AI governance");
  assert.equal(plan.slides[2].type, "cards", "other slides untouched");
  // long decks: no match in this part and not the last part -> wait
  const later = { slides: [{ type: "cards", title: "Pricing", items: [] }] };
  const src = { diagrams: [{ name: "x", ir }] };
  assert.equal(g.attachDiagramsToPlan_(later, src, { log: [] }, { force: false }), 0);
  assert.equal(g.attachDiagramsToPlan_(later, src, { log: [] }, { force: true }), 1);
});

test("Create reads a .pptx (words to the writer, pictures through diagram-design) instead of rejecting it", () => {
  const code = read("src/Code.gs");
  const body = code.slice(code.indexOf("function readUploadedFile_"), code.indexOf("function convertUploadToGoogle_"));
  assert.match(body, /ext === 'pptx' && typeof diagramUploadParts_ === 'function'/);
  assert.match(body, /diagramDesignRead_\(\{ items: pics \}/);
  assert.ok(body.indexOf("ext === 'pptx'") < body.indexOf("/^(doc|docx|odt|xls|xlsx|ods|ppt|pptx|odp)$/"), "pptx handled before the Office rejection");
});

test("Flowchart tab: a .pptx with two diagram pictures becomes slides right after the current one, in order", () => {
  const calls = [];
  const sel = { is_diagram: true, type: "architecture", slides: [{ type: "architecture" }] };
  const spec = (t) => ({ diagrams: [{ title: t, type: "architecture", groups: [], nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] }] });
  const answers = [sel, spec("First picture"), sel, spec("Second picture")];
  const slides = [{ getObjectId: () => "s1" }, { getObjectId: () => "s2" }];
  const inserted = [], rendered = [];
  const pres = {
    getSlides: () => slides,
    getSelection: () => ({ getCurrentPage: () => slides[0] }),
    insertSlide(i) { const s = { getObjectId: () => "n" + i, selectAsCurrentPage() { s.selected = true; } }; inserted.push(i); slides.splice(i, 0, s); return s; },
    getPageWidth: () => 720, getPageHeight: () => 405
  };
  const sandbox = { console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { maxSourceChars: 60000 }, Utilities: UTILITIES, Session: { getScriptTimeZone: () => "UTC" },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" } } };
  vm.createContext(sandbox);
  ["src/Code.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  Object.assign(sandbox, {
    loadRunContext_(ctx) { ctx.brand = { name: "66degrees" }; },
    callGeminiJSON(parts) { calls.push(parts); return answers[calls.length - 1]; },
    renderEngineSlide(slide, s) { rendered.push(s); },
    generationResult_: (msg, t, n) => ({ message: msg, count: n })
  });
  const res = sandbox.runFlowchartGeneration({ prompt: "create a flowchart", files: [{ name: "Copy of FBM - AI (1).pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: fbmLikePptx().toString("base64") }] });
  assert.equal(calls.length, 4, "two Vertex AI calls per picture");
  assert.deepEqual(inserted, [1, 2], "after slide 1, in order");
  assert.deepEqual(rendered.map((r) => r.title), ["First picture", "Second picture"]);
  assert.match(res.message, /2 diagram slides added as slides 2-3/);
  assert.throws(() => sandbox.runFlowchartGeneration({ files: [{ name: "notes.docx", data: "AAAA" }] }), /not a picture, PDF, PowerPoint or diagram file/);
});

test("panel: the Flowchart tab takes pictures, PDF and PowerPoint, checks dropped files, and keeps its own file", () => {
  const html = read("src/Generator.html");
  assert.match(html, /id="flowFileInput" type="file" accept="[^"]*\.pdf[^"]*\.pptx/);
  assert.match(html, /var FLOW_EXT = /);
  assert.match(html, /can't be used for a flowchart/);
  assert.match(html, /data-type="layers"/);
  assert.match(html, /data-type="loop"/);
  const gen = html.slice(html.indexOf('if (state.mode === "Flowchart") {'), html.indexOf("setSlides($(\"slideCountInput\").value);"));
  assert.match(gen, /var f = state\.flow\.file;/);
  assert.doesNotMatch(gen, /state\.files/, "the Create tab's files are never sent with a flowchart");
});
