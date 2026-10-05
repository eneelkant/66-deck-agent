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

function loadPipeline() {
  const sandbox = {
    console,
    Logger: { log() {} },
    Session: { getScriptTimeZone() { return "America/Los_Angeles"; } },
    Utilities: { formatDate() { return "Oct 5, 2026"; }, sleep() {}, getUuid() { return "uuid"; } },
    CacheService: { getUserCache() { return { put() {}, get() { return null; } }; } },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return ""; }, setProperty() {}, deleteProperty() {} };
      },
      getUserProperties() {
        return { getProperty() { return "{}"; }, setProperty() {}, deleteProperty() {} };
      }
    },
    ScriptApp: { getOAuthToken() { return "test-oauth-token"; } },
    UrlFetchApp: { fetch() { throw new Error("network disabled"); } },
    DriveApp: { getFileById() { throw new Error("drive disabled"); } },
    SlidesApp: {
      ShapeType: { RECTANGLE: "RECTANGLE", ROUND_RECTANGLE: "ROUND_RECTANGLE", ELLIPSE: "ELLIPSE" },
      LineCategory: { STRAIGHT: "STRAIGHT" },
      PredefinedLayout: { BLANK: "BLANK" },
      getActivePresentation() {
        return {
          getId() { return "active-id"; },
          getUrl() { return "https://docs.google.com/presentation/d/active-id/edit"; },
          getName() { return "Current deck"; },
          getPageWidth() { return 720; },
          getPageHeight() { return 405; },
          getSlides() { return [{ getPageElements() { return []; } }]; }
        };
      },
      create() { throw new Error("SlidesApp.create must not be used for default generation"); }
    }
  };
  vm.createContext(sandbox);
  for (const rel of ["src/Brand.gs", "src/Engine.gs", "src/EngineRenderer.gs", "src/Reference.gs", "src/Code.gs"]) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  return sandbox;
}

function htmlOptions(html, id) {
  const block = html.match(new RegExp('id="' + id + '"[\\s\\S]*?</select>'));
  assert.ok(block, "missing select " + id);
  return Array.from(block[0].matchAll(/<option value="([^"]+)"/g)).map((m) => m[1]);
}

test("Generator.html headline, mode, and subtitle match Deck Agent UI", () => {
  const html = read("src/Generator.html");
  assert.match(html, /<h2>\s*66° Deck Agent\s*<\/h2>/);
  assert.match(html, /Prompt \+ docs → structured, on-brand Google Slides\./);
  assert.doesNotMatch(html, /<h2>\s*66degrees AI Presentation Generator\s*<\/h2>/);
  assert.doesNotMatch(html, /66° Deck Studio/);
  assert.match(html, />Create</);
  assert.match(html, />Rebrand</);
  assert.match(html, /class="accent"/);
});

test("Generator data contains presentationType, department, and slideCount", () => {
  const html = read("src/Generator.html");
  assert.match(html, /generatePresentation\(\{/);
  assert.match(html, /presentationType:\s*presentationType/);
  assert.match(html, /department:\s*department/);
  assert.match(html, /slideCount:\s*slides/);
  assert.match(html, /type:\s*presentationType/);
  assert.match(html, /slides:\s*slides/);
  assert.match(html, /mode:\s*m/);
  assert.match(html, /prompt:\s*prompt/);
  assert.match(html, /sourceUrl:\s*source/);
  assert.match(html, /upload:\s*upload/);
});

test("presentation type and department options match the backend catalogs", () => {
  const html = read("src/Generator.html");
  const sandbox = loadPipeline();
  assert.deepEqual(htmlOptions(html, "presentationType"), Array.from(sandbox.PRESENTATION_TYPES));
  assert.deepEqual(htmlOptions(html, "department"), Array.from(sandbox.DEPARTMENTS));
  assert.ok(sandbox.PRESENTATION_TYPES.includes("Pitch"));
  assert.ok(sandbox.DEPARTMENTS.includes("Sales"));
});

test("slide count validation clamps to 3–20", () => {
  const sandbox = loadPipeline();
  assert.equal(sandbox.clampSlideCount_(8), 8);
  assert.equal(sandbox.clampSlideCount_(2), 3);
  assert.equal(sandbox.clampSlideCount_(100), 20);
  assert.equal(sandbox.clampSlideCount_(""), 8);
  assert.equal(sandbox.clampSlideCount_(NaN), 8);
  const html = read("src/Generator.html");
  assert.match(html, /min="3"/);
  assert.match(html, /max="20"/);
  assert.match(html, /const MIN_SLIDES = 3, MAX_SLIDES = 20/);
});

test("presentationType and department normalize and reach the planner", () => {
  const sandbox = loadPipeline();
  assert.equal(sandbox.normalizePresentationType_("Pitch"), "Pitch");
  assert.equal(sandbox.normalizePresentationType_("Sales Presentation"), "Sales");
  assert.equal(sandbox.normalizePresentationType_("unknown"), "Custom");
  assert.equal(sandbox.normalizeDepartment_("Leadership"), "Leadership");
  assert.equal(sandbox.normalizeDepartment_("tech"), "Technology");
  assert.equal(sandbox.normalizeDepartment_(""), "Other");
  const src = read("src/Code.gs");
  assert.match(src, /data\.presentationType \|\| data\.type/);
  assert.match(src, /normalizeDepartment_\(data\.department\)/);
  assert.match(src, /clampSlideCount_\(data\.slideCount/);
  assert.match(src, /PRESENTATION TYPE: \$\{presentationType\}/);
  assert.match(src, /DEPARTMENT: \$\{ctx\.department/);
  assert.match(src, /applyDepartmentFilter_\(ctx\.lib, department\)/);
});

test("bootstrap exposes type, department, and slide bounds for the same presentation", () => {
  const sandbox = loadPipeline();
  const boot = sandbox.getGeneratorBootstrap();
  assert.equal(boot.presentationId, "active-id");
  assert.match(boot.url, /active-id/);
  assert.deepEqual(Array.from(boot.presentationTypes), Array.from(sandbox.PRESENTATION_TYPES));
  assert.deepEqual(Array.from(boot.departments), Array.from(sandbox.DEPARTMENTS));
  assert.equal(boot.minSlides, 3);
  assert.equal(boot.maxSlides, 20);
});

test("department filter keeps general slides and falls back when nothing matches", () => {
  const sandbox = loadPipeline();
  const slides = [
    { tag: "A", usefulFor: ["sales pitch"], category: "sales" },
    { tag: "B", usefulFor: ["general"], category: "cover" },
    { tag: "C", usefulFor: ["finance report"], category: "finance" }
  ];
  const sales = sandbox.filterLibrarySlidesByDepartment_(slides, "Sales");
  assert.deepEqual(sales.map((s) => s.tag), ["A", "B"]);
  const other = sandbox.filterLibrarySlidesByDepartment_(slides, "Other");
  assert.equal(other.length, 3);
  const filtered = sandbox.applyDepartmentFilter_({ slides: slides, keep: true }, "Sales");
  assert.equal(filtered.keep, true);
  assert.ok(filtered.slides.length >= 2);
});

test("reference scoring prefers department-aligned usefulFor tags", () => {
  const sandbox = loadPipeline();
  const lib = {
    slides: [
      { tag: "66D_SALES", usefulFor: ["sales"], category: "sales", priority: "SECONDARY", uiComponents: [], background: { type: "light" }, reusable: true },
      { tag: "66D_FIN", usefulFor: ["finance"], category: "finance", priority: "PRIMARY", uiComponents: [], background: { type: "light" }, reusable: true }
    ],
    slideTypeMapping: [{ generatedType: "bullets", primaryReference: "66D_SALES", secondaryReferences: ["66D_FIN"] }]
  };
  const spec = { type: "bullets", title: "Offer", points: ["Proof", "Value", "Next"] };
  const salesRef = sandbox.selectReferenceForSpec(lib, spec, { lastTag: null, counts: {}, department: "Sales" });
  assert.equal(salesRef.tag, "66D_SALES");
});

test("Create pipeline still draws into the active presentation", () => {
  const code = read("src/Code.gs");
  const html = read("src/Generator.html");
  assert.match(code, /const target = SlidesApp\.getActivePresentation\(\)/);
  assert.match(html, /getGeneratorBootstrap/);
  assert.match(html, /Open presentation/);
  assert.match(html, /if \(msg\.presentationId\) currentPresentation\.id = msg\.presentationId/);
});
