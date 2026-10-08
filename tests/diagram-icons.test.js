"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadDiagramIconStack(overrides) {
  const store = {};
  const fetches = [];
  const sandbox = Object.assign({
    console,
    Logger: { log() {} },
    Utilities: {
      base64Decode(s) { return Buffer.from(String(s), "base64"); },
      newBlob(bytes, mime, name) {
        const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        return {
          getDataAsString() { return buf.toString("utf8"); },
          getBytes() { return buf; },
          getName() { return name || "blob"; }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
          setProperty(k, v) { store[k] = String(v); },
          deleteProperty(k) { delete store[k]; }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, opts) {
        fetches.push({ url, opts });
        if (String(url).includes("/search?")) {
          return {
            getResponseCode() { return 200; },
            getContentText() { return JSON.stringify({ icons: ["lucide:cloud", "tabler:cloud"] }); }
          };
        }
        if (String(url).includes(".svg")) {
          return {
            getResponseCode() { return 200; },
            getContentText() {
              return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 12h20" stroke="#000"/></svg>';
            }
          };
        }
        return { getResponseCode() { return 500; }, getContentText() { return ""; } };
      }
    },
    ScriptApp: { getOAuthToken() { return "token"; } },
    callGeminiJSON() {
      return {
        type: "flowchart",
        direction: "LR",
        confidence: 0.9,
        nodes: [
          { id: "a", type: "process", label: "Start", emphasize: true, iconConcept: "cloud storage" },
          { id: "b", type: "process", label: "Process", iconConcept: "automation" },
          { id: "c", type: "terminator", label: "Done" }
        ],
        edges: [
          { from: "a", to: "b", label: "" },
          { from: "b", to: "c", label: "ok" }
        ],
        warnings: []
      };
    },
    progressStage_() {},
    layoutDiagramPositions(diagram, area) {
      const nodes = diagram.nodes || [];
      const out = {};
      nodes.forEach(function (n, i) {
        out[n.id] = { x: (area.x || 0) + i * 130, y: area.y || 0, w: 110, h: 44 };
      });
      return out;
    },
    ENGINE: { W: 720, H: 405, TOKENS: { white: "#FFFDF9", blue: "#0052FF", ink: "#040A1B" } },
    CONFIG: { maxSourceChars: 60000, iconOrder: ["library", "drive", "material"] }
  }, overrides || {});
  sandbox.__fetches = fetches;
  sandbox.__store = store;
  vm.createContext(sandbox);
  vm.runInContext(read("src/IconProvider.gs"), sandbox, { filename: "src/IconProvider.gs" });
  vm.runInContext(read("src/Diagram.gs"), sandbox, { filename: "src/Diagram.gs" });
  return sandbox;
}

test("A. diagram source detection classifies mermaid/drawio/excalidraw/svg/image", () => {
  const s = loadDiagramIconStack();
  assert.equal(s.detectUploadCategory_({ name: "flow.mmd", data: Buffer.from("flowchart LR\nA-->B").toString("base64") }), "structured-diagram");
  assert.equal(s.detectUploadCategory_({ name: "a.drawio", data: Buffer.from("<mxfile/>").toString("base64") }), "structured-diagram");
  assert.equal(s.detectUploadCategory_({
    name: "x.excalidraw",
    data: Buffer.from(JSON.stringify({ type: "excalidraw", elements: [] })).toString("base64")
  }), "structured-diagram");
  assert.equal(s.detectUploadCategory_({ name: "d.svg", mimeType: "image/svg+xml", data: Buffer.from("<svg></svg>").toString("base64") }), "structured-diagram");
  assert.equal(s.detectUploadCategory_({ name: "shot.png", mimeType: "image/png", data: "aaa" }), "image");
  assert.equal(s.detectUploadCategory_({ name: "notes.txt", data: Buffer.from("hello").toString("base64") }), "document");
});

test("B. Mermaid normalization produces valid IR", () => {
  const s = loadDiagramIconStack();
  const ir = s.parseMermaidToIr_("flowchart LR\nA[Input] --> B[Process]\nB --> C[Output]");
  const v = s.validateDiagramIr_(ir);
  assert.equal(v.ok, true, v.errors && v.errors.join("; "));
  assert.ok(ir.nodes.length >= 3);
  assert.ok(ir.edges.length >= 2);
  assert.equal(ir.brand.accent, "#0052FF");
});

test("C. draw.io normalization recovers nodes/edges", () => {
  const s = loadDiagramIconStack();
  const xml = `
  <mxfile><diagram>
    <mxGraphModel><root>
      <mxCell id="1" value="Start" vertex="1"><mxGeometry x="10" y="10" width="100" height="40"/></mxCell>
      <mxCell id="2" value="End" vertex="1"><mxGeometry x="200" y="10" width="100" height="40"/></mxCell>
      <mxCell id="3" edge="1" source="1" target="2" value="go"/>
    </root></mxGraphModel>
  </diagram></mxfile>`;
  const ir = s.parseDrawioToIr_(xml);
  assert.equal(s.validateDiagramIr_(ir).ok, true);
  assert.equal(ir.nodes.length, 2);
  assert.equal(ir.edges.length, 1);
});

test("D. Excalidraw normalization recovers labeled nodes", () => {
  const s = loadDiagramIconStack();
  const payload = {
    type: "excalidraw",
    elements: [
      { id: "r1", type: "rectangle", x: 0, y: 0, width: 120, height: 48, boundElements: [{ id: "t1", type: "text" }] },
      { id: "t1", type: "text", text: "Auth", containerId: "r1", x: 10, y: 10, width: 80, height: 20 },
      { id: "r2", type: "rectangle", x: 200, y: 0, width: 120, height: 48, boundElements: [{ id: "t2", type: "text" }] },
      { id: "t2", type: "text", text: "API", containerId: "r2", x: 210, y: 10, width: 80, height: 20 },
      { id: "a1", type: "arrow", startBinding: { elementId: "r1" }, endBinding: { elementId: "r2" } }
    ]
  };
  const ir = s.parseExcalidrawToIr_(JSON.stringify(payload));
  assert.equal(s.validateDiagramIr_(ir).ok, true);
  assert.ok(ir.nodes.some((n) => n.label === "Auth"));
  assert.ok(ir.edges.length >= 1);
});

test("E. SVG normalization extracts text nodes", () => {
  const s = loadDiagramIconStack();
  const ir = s.parseSvgToIr_('<svg viewBox="0 0 10 10"><text>Alpha</text><text>Beta</text></svg>');
  assert.equal(s.validateDiagramIr_(ir).ok, true);
  assert.equal(ir.nodes.length, 2);
});

test("F. raster/image diagram extraction fallback when confidence is low", () => {
  const s = loadDiagramIconStack({
    callGeminiJSON() { return { type: "flowchart", confidence: 0.1, nodes: [], edges: [], warnings: ["not a diagram"] }; }
  });
  const sources = { images: [], diagrams: [], diagramFallbacks: [] };
  const result = s.ingestUploadedDiagram_({
    name: "ai.png",
    mimeType: "image/png",
    data: Buffer.from("fake").toString("base64")
  }, sources, { log: [], apiKey: "vertex" });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.ok(sources.diagramFallbacks.length >= 1);
  assert.ok(sources.images.length >= 1);
});

test("G/H. flowchart IR validation enforces node/edge consistency", () => {
  const s = loadDiagramIconStack();
  const bad = s.validateDiagramIr_({
    type: "flowchart",
    direction: "LR",
    nodes: [{ id: "a", label: "A", width: 10, height: 10 }],
    edges: [{ from: "a", to: "missing" }]
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /missing node/.test(e)));
});

test("I. diagram dimension safety keeps positive boxes", () => {
  const s = loadDiagramIconStack();
  const ir = s.parseMermaidToIr_("flowchart TB\nA[One] --> B[Two] --> C[Three]");
  const els = s.diagramIrToEngineElements_(ir, { x: 40, y: 70, w: 640, h: 280 });
  assert.ok(els.length > 0);
  els.filter((e) => e.t === "shape" || e.t === "rect").forEach((e) => {
    assert.ok(e.w > 0 && e.h > 0);
  });
  els.filter((e) => e.t === "line").forEach((e) => {
    assert.ok(Number.isFinite(e.x1) && Number.isFinite(e.y1) && Number.isFinite(e.x2) && Number.isFinite(e.y2));
  });
});

test("J/K. better-icons provider abstraction resolves semantic icons", () => {
  const s = loadDiagramIconStack();
  const local = s.resolveIconRequest_({ concept: "cloud storage", brandColor: "#0052FF", style: "outline" });
  assert.equal(local.ok, true);
  assert.ok(local.svg.includes("#0052FF") || local.color === "#0052FF");
  assert.match(local.iconId, /cloud/i);

  const remote = s.resolveIconRequest_({ concept: "database warehouse", brandColor: "#040A1B", style: "outline" });
  assert.ok(remote.svg);
  assert.ok(remote.source === "better-icons" || remote.source === "66degrees-local" || remote.source === "fallback");
  assert.ok(s.__fetches.length >= 1);
});

test("L. icon color normalization only allows brand colors", () => {
  const s = loadDiagramIconStack();
  assert.equal(s.normalizeBrandIconColor_("#ff0000", false), "#040A1B");
  assert.equal(s.normalizeBrandIconColor_("#0052FF", false), "#0052FF");
  assert.equal(s.normalizeBrandIconColor_("x", true), "#FFFDF9");
});

test("M. SVG sanitization strips script and javascript URLs", () => {
  const s = loadDiagramIconStack();
  const dirty = '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><a href="javascript:alert(1)"/><path d="M1 1" onclick="x"/></svg>';
  const clean = s.sanitizeIconSvg_(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /onclick=/i);
  assert.match(clean, /viewBox=/);
});

test("N. icon cache stores and reuses provider results", () => {
  const s = loadDiagramIconStack();
  const first = s.resolveIconRequest_({ concept: "unique-cloud-xyz", brandColor: "#0052FF", size: 24 });
  const fetchesBefore = s.__fetches.length;
  // Force a cache write via better-icons path then read again.
  if (first.source === "better-icons") {
    const second = s.resolveIconRequest_({ concept: "unique-cloud-xyz", brandColor: "#0052FF", size: 24 });
    assert.equal(second.iconId, first.iconId);
    assert.ok(s.__fetches.length >= fetchesBefore);
  } else {
    s.putCachedIcon_({
      iconId: "lucide:cloud",
      source: "better-icons",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>',
      color: "#0052FF"
    }, 24);
    const hit = s.getCachedIcon_("better-icons", "lucide:cloud", "#0052FF", 24);
    assert.ok(hit);
    assert.equal(hit.iconId, "lucide:cloud");
  }
});

test("O. missing icon falls back safely without fabricated remote IDs", () => {
  const s = loadDiagramIconStack({
    UrlFetchApp: {
      fetch() { return { getResponseCode() { return 500; }, getContentText() { return ""; } }; }
    }
  });
  // Reload with failing network
  const sandbox = loadDiagramIconStack({
    UrlFetchApp: {
      fetch() { return { getResponseCode() { return 404; }, getContentText() { return ""; } }; }
    }
  });
  const result = sandbox.resolveIconRequest_({ concept: "zzzz-nonexistent-icon-concept-999", brandColor: "#040A1B" });
  assert.ok(result.svg);
  assert.ok(result.fallback || result.source === "66degrees-local" || result.source === "fallback");
  assert.doesNotMatch(String(result.iconId), /^made-up:/);
});

test("P. licensing/source metadata retained on resolved icons", () => {
  const s = loadDiagramIconStack();
  const result = s.resolveIconRequest_({ concept: "security", brandColor: "#0052FF" });
  assert.ok(result.attribution || result.license || result.source);
  assert.ok(result.iconId);
  assert.ok(result.source);
});

test("V. upload flow ingests mermaid into sources.diagrams", () => {
  const s = loadDiagramIconStack();
  const sources = { text: "", pdfs: [], images: [], diagrams: [], diagramFallbacks: [] };
  const mermaid = "flowchart LR\nStart[Start] --> Work[Work] --> Done[Done]";
  const result = s.ingestUploadedDiagram_({
    name: "flow.mmd",
    mimeType: "text/plain",
    data: Buffer.from(mermaid).toString("base64")
  }, sources, { log: [] });
  assert.equal(result.ok, true);
  assert.equal(sources.diagrams.length, 1);
  const plan = {
    slides: [
      { type: "cover", title: "Cover" },
      { type: "cards", title: "Overview", items: [{ title: "A" }] },
      { type: "closing", title: "Thanks" }
    ]
  };
  const attached = s.attachDiagramsToPlan_(plan, sources, { log: [] });
  assert.equal(attached, 1);
  assert.ok(plan.slides.some((sl) => sl.diagram && sl.visual && sl.visual.type));
});

test("W. progress helpers exist for diagram/icons stages in Code.gs", () => {
  const code = read("src/Code.gs");
  assert.match(code, /\['diagram', 'Analyzing diagram'\]/);
  assert.match(code, /\['icons', 'Selecting icons'\]/);
  assert.match(code, /Rebuilding flowchart/);
  assert.match(code, /Applying brand styling|Drawing the slides/);
});
