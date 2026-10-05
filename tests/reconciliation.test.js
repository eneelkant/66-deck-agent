"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const NO_TEXT_ERROR = "The object (SLIDES_API385059013_20) has no text.";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadEngine() {
  const sandbox = {
    console,
    Logger: { log() {} },
    CONFIG: { iconOrder: ["material"], roundedBoxes: false }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Engine.gs"), sandbox, { filename: "src/Engine.gs" });
  return sandbox;
}

function loadBrand() {
  const sandbox = {
    console,
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return ""; }, setProperty() {}, deleteProperty() {} };
      }
    },
    ScriptApp: { getOAuthToken() { return "oauth-token"; } },
    UrlFetchApp: { fetch() { throw new Error("network disabled"); } },
    CacheService: { getUserCache() { return { put() {}, get() { return null; } }; } },
    DriveApp: { getFileById() { throw new Error("drive disabled"); } },
    SlidesApp: {
      PageElementType: { SHAPE: "SHAPE", GROUP: "GROUP", TABLE: "TABLE" },
      getActivePresentation() { return null; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Brand.gs"), sandbox, { filename: "src/Brand.gs" });
  return sandbox;
}

function loadRenderer() {
  const sandbox = {
    console,
    Logger: { log() {} },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE"
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/EngineRenderer.gs"), sandbox, { filename: "src/EngineRenderer.gs" });
  return sandbox;
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
  for (const rel of ["src/Brand.gs", "src/Engine.gs", "src/EngineRenderer.gs", "src/Code.gs"]) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  return sandbox;
}

function assertPositiveEls(els, label) {
  for (const el of els) {
    if (el.w != null) assert.ok(el.w > 0, `${label} ${el.t} width ${el.w}`);
    if (el.h != null) assert.ok(el.h > 0, `${label} ${el.t} height ${el.h}`);
    if (el.size != null) assert.ok(el.size > 0, `${label} ${el.t} size ${el.size}`);
  }
}

const SAMPLE_ITEMS = [
  { title: "One", text: "First item.", value: "40%", label: "Savings" },
  { title: "Two", text: "Second item.", value: "15 min", label: "Response" },
  { title: "Three", text: "Third item.", value: "90%", label: "Uptime" }
];

function specFor(type) {
  const base = { type, title: type + " title", subtitle: "Subtitle", lead: "Lead copy" };
  if (type === "cover") return { type, title: "66degrees deck", subtitle: "Leadership briefing" };
  if (type === "agenda") return { type, title: "Agenda", items: SAMPLE_ITEMS };
  if (type === "section") return { type, title: "Section" };
  if (type === "cards") return { type, title: "Cards", items: SAMPLE_ITEMS };
  if (type === "stats") return { type, title: "Stats", items: SAMPLE_ITEMS };
  if (type === "table") {
    return { type, title: "Table", columns: ["KPI", "Now", "Next"], rows: [["NPS", "70", "80"], ["CSAT", "90", "95"]] };
  }
  if (type === "process") return { type, title: "Process", items: SAMPLE_ITEMS };
  if (type === "timeline") {
    return {
      type,
      title: "Timeline",
      items: [
        { date: "Q1", title: "Pilot", text: "Start." },
        { date: "Q2", title: "Scale", text: "Expand." },
        { date: "Q3", title: "Operate", text: "Run." }
      ]
    };
  }
  if (type === "comparison") {
    return {
      type,
      title: "Comparison",
      left: { label: "Now", title: "Current", points: ["Slow", "Manual", "Costly"] },
      right: { label: "Next", title: "Future", points: ["Fast", "Automated", "Efficient"] }
    };
  }
  if (type === "next_steps") return { type, title: "Next steps", items: SAMPLE_ITEMS, cta: "Book a workshop" };
  if (type === "bullets") return { type, title: "Bullets", items: SAMPLE_ITEMS };
  if (type === "statement") {
    return { type, title: "Key message", text: "Cloud modernization pays for itself.", items: SAMPLE_ITEMS };
  }
  if (type === "chart") {
    return {
      type,
      title: "Chart",
      chart: { type: "bar", categories: ["A", "B", "C"], series: [{ name: "Value", values: [10, 20, 30] }] }
    };
  }
  if (type === "case_study") {
    return {
      type,
      title: "Case study",
      challenge: ["Legacy data platform."],
      solution: ["Migrated to BigQuery."],
      results: [{ value: "$3M", label: "Annual savings" }, { value: "40%", label: "Cost reduction" }]
    };
  }
  if (type === "quote") return { type, title: "Quote", quote: "The migration paid for itself.", attribution: "CIO" };
  if (type === "closing") return { type, title: "Thank You", subtitle: "Next conversation" };
  return base;
}

test("V1_17 source modules are present", () => {
  for (const rel of [
    "src/Code.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/Reference.gs",
    "src/Brand.gs",
    "src/Rebrand.gs",
    "src/ShapeKit.gs",
    "src/Generator.html",
    "src/appsscript.json"
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
  }
});

test("ENGINE.layouts includes every V1_17 content type", () => {
  const { ENGINE } = loadEngine();
  const expected = [
    "cover", "agenda", "section", "cards", "stats", "table", "process", "timeline",
    "comparison", "next_steps", "bullets", "statement", "chart", "case_study", "quote", "closing"
  ];
  for (const type of expected) {
    assert.ok(ENGINE.layouts.includes(type), `missing layout ${type}`);
  }
});

test("every ENGINE layout and metrics alias keeps positive dimensions", () => {
  const { ENGINE } = loadEngine();
  const types = ENGINE.layouts.slice();
  types.push("metrics");
  for (const type of types) {
    const out = ENGINE.render({ slides: [specFor(type === "metrics" ? "stats" : type)] }, { dateLabel: "Oct 5, 2026" })[0];
    assert.ok(out.els.length > 0, `${type} produced no elements`);
    assertPositiveEls(out.els, type);
  }
});

test("unknown architecture/flowchart/diagram types fall back to bullets", () => {
  const { ENGINE } = loadEngine();
  for (const type of ["architecture", "flowchart", "diagram", "unknown_widget"]) {
    const out = ENGINE.render({
      slides: [{ type, title: type, items: SAMPLE_ITEMS }]
    })[0];
    assert.equal(out.type, "bullets");
    assertPositiveEls(out.els, type);
  }
});

test("metrics alias renders as stats", () => {
  const { ENGINE } = loadEngine();
  const out = ENGINE.render({
    slides: [{ type: "metrics", title: "KPIs", items: SAMPLE_ITEMS }]
  })[0];
  assert.equal(out.type, "stats");
  assertPositiveEls(out.els, "metrics");
});

test("splitSpace/innerSize/boxH never return non-positive values", () => {
  const { ENGINE } = loadEngine();
  assert.ok(ENGINE.splitSpace(0, 8, 12) >= 1);
  assert.ok(ENGINE.splitSpace(-40, 3, 10) >= 1);
  assert.ok(ENGINE.splitSpace(NaN, 0, NaN) >= 1);
  assert.ok(ENGINE.innerSize(10, 40) >= 1);
  assert.ok(ENGINE.innerSize(NaN, 8) >= 1);
  assert.ok(ENGINE.boxH(200, -10) >= 1);
  assert.ok(ENGINE.boxH(NaN, NaN) >= 1);
  assert.ok(ENGINE.posSize(0, -4).w >= 1);
  assert.ok(ENGINE.posSize(Infinity, undefined).h >= 1);
});

test("cover agenda comparison quote closing footer stay drawable", () => {
  const { ENGINE } = loadEngine();
  const slides = ENGINE.render({
    slides: [
      specFor("cover"),
      specFor("agenda"),
      specFor("comparison"),
      specFor("quote"),
      specFor("closing")
    ]
  });
  assert.equal(slides.length, 5);
  slides.forEach((slide, i) => assertPositiveEls(slide.els, `core-${i}`));
  assert.ok(slides[4].noFooter);
});

test("brand color/typography/facts helpers match the 2026 kit", () => {
  const sandbox = loadBrand();
  assert.equal(sandbox.BRAND_COLORS.blue, "#0052FF");
  assert.equal(sandbox.BRAND_COLORS.nightBlue, "#040A1B");
  assert.equal(sandbox.DEFAULT_BRAND.fonts.heading.slides, "Plus Jakarta Sans");
  assert.equal(sandbox.DEFAULT_BRAND.fonts.mono.slides, "IBM Plex Mono");
  const facts = vm.runInContext("APPROVED_FACTS", sandbox);
  assert.ok(facts.length > 10);
  assert.equal(sandbox.substituteFont("Saans"), "Plus Jakarta Sans");
  assert.equal(sandbox.substituteFont("MD IO"), "IBM Plex Mono");
  const rgb = sandbox.hexToRgb("#0052FF");
  assert.equal(rgb[0], 0);
  assert.equal(rgb[1], 82);
  assert.equal(rgb[2], 255);
  assert.ok(sandbox.luminance("#FFFDF9") > sandbox.luminance("#040A1B"));
});

test("generationResult and bootstrap both resolve to the active presentation", () => {
  const sandbox = loadPipeline();
  const boot = sandbox.getGeneratorBootstrap();
  const result = sandbox.generationResult_("SUCCESS: done", sandbox.SlidesApp.getActivePresentation(), 8);
  assert.equal(boot.presentationId, "active-id");
  assert.match(boot.url, /active-id/);
  assert.equal(result.presentationId, boot.presentationId);
  assert.equal(result.url, boot.url);
  assert.equal(result.ok, true);
  assert.equal(result.slideCount, 8);
});

test("default Create path never calls SlidesApp.create", () => {
  const code = read("src/Code.gs");
  const start = code.indexOf("function generatePresentationRun_");
  const end = code.indexOf("function specTitle_");
  const run = code.slice(start, end);
  const defaultStart = run.indexOf("if (!CONFIG.useBeautifulAi)");
  const defaultBranch = run.slice(defaultStart, run.indexOf("} else {", defaultStart));
  assert.match(run, /const target = SlidesApp\.getActivePresentation\(\)/);
  assert.match(defaultBranch, /drawSlidesIntoActive_\(target/);
  assert.doesNotMatch(defaultBranch, /createWorkingDeck_/);
  assert.doesNotMatch(defaultBranch, /SlidesApp\.create\(/);
  assert.match(code, /useBeautifulAi:\s*false/);
});

test("sidebar completion uses the returned active presentation URL", () => {
  const html = read("src/Generator.html");
  assert.match(html, /generatePresentation/);
  assert.match(html, /Open presentation/);
  assert.match(html, /if \(msg\.presentationId\) currentPresentation\.id = msg\.presentationId/);
  assert.match(html, /if \(msg\.url\) currentPresentation\.url = msg\.url/);
  assert.match(html, /setOpenLink\(url\)/);
  assert.match(html, /getGeneratorBootstrap/);
});

test("pipeline stages stay in the V1_17 create order", () => {
  const sandbox = loadPipeline();
  assert.equal(Array.from(sandbox.getPipelineStages()).join(","), "research,write,match,fit,brand,insert");
  const stages = vm.runInContext("PROGRESS_STAGES.create.map(function (s) { return s[0]; }).join(',')", sandbox);
  assert.equal(stages, "research,write,match,fit,brand,insert");
});

test("overlayTextIfNeeded writes overlay boxes for fill-only shapes", () => {
  const { EngineRenderer } = loadRenderer();
  const calls = [];
  const slide = {
    insertTextBox(text, x, y, w, h) {
      calls.push({ text, x, y, w, h });
      return { getText() { return { setText() { return this; } }; } };
    }
  };
  const fill = { getText() { throw new Error(NO_TEXT_ERROR); } };
  EngineRenderer.overlayTextIfNeeded(slide, fill, { text: "Node A" }, { x: 8, y: 9, w: 40, h: 20 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, "Node A");
  assert.ok(calls[0].w > 0);
  assert.ok(calls[0].h > 0);
});

test("Rebrand targets an existing presentation id in place", () => {
  const rebrand = read("src/Rebrand.gs");
  assert.match(rebrand, /function rebrandPresentation\(presId, ctx, opts\)/);
  assert.match(rebrand, /Slides\.Presentations\.get\(presId/);
  assert.doesNotMatch(rebrand, /SlidesApp\.create\(/);
  assert.match(rebrand, /function nearestColor_/);
  assert.match(rebrand, /function mapFillColor/);
});

test("Reference library keeps V1_17 selection/harvest/rotation helpers", () => {
  const src = read("src/Reference.gs");
  for (const name of [
    "loadReferenceLibrary",
    "selectReferences",
    "selectReferenceForSpec",
    "harvestReferenceDeck",
    "harvestIcons_",
    "iconCheck",
    "saveRotation_",
    "TYPE_ALIASES",
    "NO_REFERENCE_TYPES"
  ]) {
    assert.match(src, new RegExp(name));
  }
  assert.match(src, /metrics:\s*'stats'/);
});

test("ShapeKit embedded kit remains complete", () => {
  const src = read("src/ShapeKit.gs");
  const m = src.match(/b64:\s*'([^']+)'/);
  assert.ok(m, "missing b64");
  assert.ok(m[1].length > 38000, `truncated kit ${m[1].length}`);
  assert.match(src, /ROUND_RECTANGLE/);
  assert.match(src, /radiusPt:\s*3/);
});

test("manifest keeps advanced services under dependencies", () => {
  const manifest = JSON.parse(read("src/appsscript.json"));
  assert.equal(manifest.runtimeVersion, "V8");
  assert.ok(!manifest.enabledAdvancedServices);
  assert.equal(manifest.dependencies.enabledAdvancedServices[0].userSymbol, "Slides");
  assert.ok(manifest.oauthScopes.includes("https://www.googleapis.com/auth/cloud-platform"));
  assert.ok(manifest.oauthScopes.includes("https://www.googleapis.com/auth/script.container.ui"));
});

test("Vertex OAuth is the only model-generation path", () => {
  const brand = read("src/Brand.gs");
  const code = read("src/Code.gs");
  const src = brand + "\n" + code;
  assert.match(brand, /VERTEX_PROJECT_ID/);
  assert.match(brand, /ScriptApp\.getOAuthToken\(\)/);
  assert.match(brand, /aiplatform\.googleapis\.com/);
  assert.match(brand, /function callVertexGemini_/);
  assert.doesNotMatch(src, /\bGEMINI_API_KEY\b/);
  assert.doesNotMatch(src, /generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(src, /x-goog-api-key/);
});
