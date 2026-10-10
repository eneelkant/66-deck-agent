"use strict";

/**
 * Regression: normal Create must not auto-reconstruct raster images as diagrams.
 * Flowchart mode is the dedicated image/prompt → flowchart path.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function tinyPngB64() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  ).toString("base64");
}

/** Extract and run only readUploadedFile_ with a minimal sandbox (avoids Code.gs globals). */
function loadReadUpload() {
  const ingestCalls = [];
  const code = read("src/Code.gs");
  const start = code.indexOf("function readUploadedFile_");
  const end = code.indexOf("\nfunction convertUploadToGoogle_");
  assert.ok(start >= 0 && end > start, "readUploadedFile_ block found");
  const fnSrc = code.slice(start, end);
  const sandbox = {
    console,
    Logger: { log() {} },
    CONFIG: { maxSourceChars: 50000 },
    Utilities: {
      base64Decode(s) { return Buffer.from(String(s), "base64"); },
      newBlob(bytes) {
        const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        return { getDataAsString() { return buf.toString("utf8"); }, getBytes() { return buf; } };
      }
    },
    progressStage_() {},
    detectUploadCategory_(upload) {
      const name = String(upload.name || "");
      const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || "";
      if (/^(png|jpe?g|webp|gif)$/i.test(ext)) return "image";
      if (/^(mmd|mermaid|drawio|dio|excalidraw|svg)$/i.test(ext)) return "structured-diagram";
      return "other";
    },
    ingestUploadedDiagram_(upload, sources) {
      ingestCalls.push({ name: upload.name });
      sources.diagrams = sources.diagrams || [];
      sources.diagrams.push({
        name: upload.name,
        category: "image",
        ir: { type: "flowchart", nodes: [{ id: "a", label: "A" }], edges: [] }
      });
      return { ok: true, category: "image", ir: sources.diagrams[0].ir };
    },
    diagramUploadParts_() { return { kind: "images", items: [], slides: [] }; },
    diagramDesignRead_() { return { diagrams: [], notDiagram: [], log: [] }; },
    noteDiagramsForPlanner_() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fnSrc, sandbox, { filename: "readUploadedFile_" });
  return { sandbox, ingestCalls };
}

test("Create + raster image: no diagram ingestion; image kept as reference", () => {
  const { sandbox, ingestCalls } = loadReadUpload();
  const sources = { text: "", pdfs: [], images: [], diagrams: [], diagramFallbacks: [] };
  const ctx = { log: [] };
  sandbox.readUploadedFile_(
    { name: "sketch.png", mimeType: "image/png", data: tinyPngB64() },
    sources,
    ctx,
    { allowDiagramIngest: false, mode: "create" }
  );
  assert.equal(ingestCalls.length, 0, "ingestUploadedDiagram_ must not run in Create");
  assert.equal(sources.diagrams.length, 0);
  assert.equal(sources.images.length, 1);
  assert.equal(sources.images[0].role, "reference");
  assert.match(ctx.log.join(" "), /reference/i);
});

test("Create + ordinary JPG reference: reference-image behavior intact", () => {
  const { sandbox, ingestCalls } = loadReadUpload();
  const sources = { text: "", pdfs: [], images: [], diagrams: [] };
  const ctx = { log: [] };
  sandbox.readUploadedFile_(
    { name: "photo.jpg", mimeType: "image/jpeg", data: tinyPngB64() },
    sources,
    ctx,
    { allowDiagramIngest: false }
  );
  assert.equal(ingestCalls.length, 0);
  assert.equal(sources.images.length, 1);
  assert.equal(sources.images[0].mime, "image/jpeg");
});

test("allowDiagramIngest true: raster enters diagram ingestion", () => {
  const { sandbox, ingestCalls } = loadReadUpload();
  const sources = { text: "", pdfs: [], images: [], diagrams: [] };
  const ctx = { log: [] };
  sandbox.readUploadedFile_(
    { name: "flow.png", mimeType: "image/png", data: tinyPngB64() },
    sources,
    ctx,
    { allowDiagramIngest: true }
  );
  assert.equal(ingestCalls.length, 1);
  assert.equal(sources.diagrams.length, 1);
});

test("Flowchart mode forces flowchart type when Auto is selected", () => {
  const html = read("src/Generator.html");
  assert.match(html, /Auto \(flowchart\)/);
  // V.1_41: the Create tab no longer carries the long "pictures are not converted into flowcharts" note (the server still
  // never converts Create uploads: allowDiagramIngest is false below)
  assert.match(html, /only place that turns a sketch/i);

  const code = read("src/Code.gs");
  assert.match(
    code,
    /data\.diagramType && data\.diagramType !== 'auto' \? String\(data\.diagramType\) : 'flowchart'/
  );
  assert.match(code, /allowDiagramIngest: false/);
});

test("runFlowchartGeneration does not call planContent (no general deck planner)", () => {
  const inserted = [];
  const rendered = [];
  const planCalls = [];
  const slides = [{ getObjectId: () => "s1" }];
  const pres = {
    getSlides: () => slides,
    getSelection: () => ({ getCurrentPage: () => slides[0] }),
    insertSlide(i) {
      const s = { getObjectId: () => "n" + inserted.length, selectAsCurrentPage() { s.selected = true; } };
      inserted.push({ i, s });
      slides.splice(i, 0, s);
      return s;
    },
    getPageWidth: () => 720,
    getPageHeight: () => 405,
    getId: () => "p",
    getUrl: () => "u"
  };
  const sandbox = {
    console, Logger: { log() {} }, Date, Math, JSON,
    CONFIG: { maxSourceChars: 1000, useBeautifulAi: false, useReferenceLibrary: false },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" } },
    Utilities: {
      formatDate: () => "Oct 8, 2026",
      base64Decode: (s) => Buffer.from(String(s), "base64"),
      newBlob: () => ({ getDataAsString: () => "" })
    },
    Session: { getScriptTimeZone: () => "UTC" },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 500,
        getContentText: () => "",
        getBlob: () => ({ getContentType: () => "", getBytes: () => [] }),
        getHeaders: () => ({})
      })
    },
    DriveApp: {},
    ScriptApp: { getOAuthToken: () => "t" }
  };
  vm.createContext(sandbox);
  ["src/Code.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => {
    try { vm.runInContext(read(f), sandbox, { filename: f }); } catch (e) { /* optional deps */ }
  });
  const spec = {
    title: "Ticket triage", lead: "", type: "flowchart",
    nodes: [
      { id: "s", label: "Start", kind: "start" },
      { id: "u", label: "Urgent?", kind: "decision" },
      { id: "y", label: "Done", kind: "end" }
    ],
    edges: [{ from: "s", to: "u" }, { from: "u", to: "y", label: "Yes" }]
  };
  let wantedSeen = "";
  Object.assign(sandbox, {
    loadRunContext_(ctx) { ctx.tokens = null; ctx.brand = { name: "66degrees" }; },
    planContent() { planCalls.push(1); return { slides: [] }; },
    callGeminiJSON() {
      return { is_diagram: true, type: "flowchart", slides: [{ title: "Ticket triage", type: "flowchart" }] };
    },
    diagramDesignRead_(parts, opts) {
      wantedSeen = opts && opts.wantedType;
      return {
        diagrams: [Object.assign({}, spec, { type: opts.wantedType || "flowchart" })],
        notDiagram: [],
        log: []
      };
    },
    diagramUploadParts_() { return { kind: "images", items: [], slides: [] }; },
    ingestUploadedDiagram_() { return { ok: false }; },
    renderEngineSlide(slide, sp) { rendered.push(sp); },
    generationResult_: (msg, t, n) => ({ message: msg, count: n }),
    flowchartDeckSpecs_(text, readRes) {
      return [
        { type: "cover", title: "Intro" },
        { type: "diagram", title: "Flow", diagram: readRes.diagrams[0] },
        { type: "closing", title: "Thank You!" }
      ];
    },
    progressInit_() {},
    progressStage_() {},
    checkCancel_() {},
    progressSave_() {}
  });
  assert.equal(typeof sandbox.runFlowchartGeneration, "function");
  const res = sandbox.runFlowchartGeneration({ mode: "Flowchart", prompt: "Start → decide → done", diagramType: "auto" });
  assert.equal(planCalls.length, 0, "general deck planner must not run");
  assert.equal(wantedSeen, "flowchart", "Auto must force flowchart");
  assert.ok(rendered.length >= 1);
  assert.match(String(res.message || ""), /SUCCESS|slides/i);
});

test("invalid diagram IR is rejected before render merge", () => {
  const sandbox = { console, Logger: { log() {} }, CONFIG: { iconOrder: ["material"], roundedBoxes: true } };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Engine.gs") + "\n" + read("src/Diagram.gs"), sandbox, { filename: "d" });
  const bad = { type: "flowchart", nodes: [], edges: [{ from: "x", to: "y" }] };
  const check = sandbox.validateDiagramIr_(bad);
  assert.equal(check.ok, false);
  const out = { els: [{ t: "text", text: "Title", y: 20, h: 20 }], notes: "" };
  sandbox.applyDiagramIrToEngineOutput_(out, { title: "Title", diagram: bad }, null);
  assert.match(out.notes, /invalid/i);
  assert.equal(out.fromDiagramIr, undefined);
});

test("source code: Create path never enables diagram ingest for uploads", () => {
  const code = read("src/Code.gs");
  assert.match(code, /allowDiagramIngest: false,\s*mode: 'create'/);
  assert.match(code, /if \(allowDiagramIngest && typeof ingestUploadedDiagram_ === 'function'\)/);
});
