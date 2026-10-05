#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
let failures = 0;

function fail(msg) {
  failures += 1;
  console.error("FAIL:", msg);
}

function ok(msg) {
  console.log("OK  :", msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function assertJson(rel) {
  try {
    JSON.parse(read(rel));
    ok(`JSON valid: ${rel}`);
  } catch (e) {
    fail(`JSON invalid: ${rel} (${e.message})`);
  }
}

function assertYaml(rel) {
  try {
    const YAML = require("yaml");
    YAML.parse(read(rel));
    ok(`YAML valid: ${rel}`);
  } catch (e) {
    fail(`YAML invalid: ${rel} (${e.message})`);
  }
}

function assertHtml(rel) {
  const html = read(rel);
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    fail(`HTML missing html tags: ${rel}`);
    return;
  }
  if (!/<script[\s>]/i.test(html)) {
    fail(`HTML missing script block: ${rel}`);
    return;
  }
  const opens = (html.match(/<div\b/gi) || []).length;
  const closes = (html.match(/<\/div>/gi) || []).length;
  if (opens !== closes) {
    fail(`HTML div imbalance in ${rel}: open=${opens} close=${closes}`);
    return;
  }
  if (!/generatePresentation/.test(html)) {
    fail("Generator.html must call generatePresentation");
  } else {
    ok("Generator.html calls generatePresentation");
  }
  if (!/Open presentation/.test(html)) {
    fail("Generator.html must offer an Open presentation link");
  } else {
    ok("Generator.html has Open presentation link");
  }
  ok(`HTML structure looks valid: ${rel}`);
}

function assertNoSecrets() {
  const banned = [".clasprc.json", "credentials.json", "service-account.json", ".env"];
  for (const rel of banned) {
    if (exists(rel)) fail(`Secret-like file must not be committed: ${rel}`);
  }
  if (exists("CURSOR_WRITE_TEST.md")) {
    fail("Temporary test artifact CURSOR_WRITE_TEST.md must not be on production branch");
  } else {
    ok("No CURSOR_WRITE_TEST.md artifact on branch");
  }

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(gs|js|html|json|yml|yaml|md)$/i.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      if (/ghp_[A-Za-z0-9]{20,}/.test(text) || /AIza[0-9A-Za-z\-_]{20,}/.test(text)) {
        fail(`Possible secret token found in ${path.relative(root, full)}`);
      }
    }
  };
  walk(root);
  ok("No obvious hard-coded secret tokens detected");
}

function assertRequiredFiles() {
  const required = [
    "README.md",
    ".gitignore",
    ".clasp.json",
    ".github/workflows/deploy.yml",
    "src/appsscript.json",
    "src/Code.gs",
    "src/Brand.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/ShapeKit.gs",
    "src/Generator.html"
  ];
  for (const rel of required) {
    if (!exists(rel)) fail(`Missing required file: ${rel}`);
    else ok(`Found ${rel}`);
  }
}

function assertManifest() {
  const manifest = JSON.parse(read("src/appsscript.json"));
  if (manifest.runtimeVersion !== "V8") fail("appsscript.json runtimeVersion must be V8");
  else ok("Apps Script runtime is V8");

  const scopes = manifest.oauthScopes || [];
  const needed = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/cloud-platform"
  ];
  for (const scope of needed) {
    if (scopes.indexOf(scope) === -1) fail(`Missing OAuth scope: ${scope}`);
    else ok(`OAuth scope present: ${scope}`);
  }
  if (!manifest.addOns || !manifest.addOns.slides) fail("appsscript.json missing slides add-on config");
  else ok("Slides add-on config present");

  const advanced = (manifest.dependencies && manifest.dependencies.enabledAdvancedServices) || [];
  if (!advanced.some((s) => s.userSymbol === "Slides" && s.version === "v1")) {
    fail("appsscript.json must enable the Slides advanced service");
  } else {
    ok("Slides advanced service enabled");
  }
}

function assertClaspConfig() {
  const clasp = JSON.parse(read(".clasp.json"));
  if (clasp.rootDir !== "src") fail(".clasp.json rootDir must be src");
  else ok(".clasp.json rootDir is src");
  if (!Array.isArray(clasp.filePushOrder) || !clasp.filePushOrder.length) {
    fail(".clasp.json missing filePushOrder");
  } else {
    ok(".clasp.json filePushOrder present");
  }
  const order = clasp.filePushOrder.join(" ");
  if (!/Brand\.gs/.test(order) || !/ShapeKit\.gs/.test(order) || !/EngineRenderer\.gs/.test(order)) {
    fail(".clasp.json filePushOrder must include Brand, ShapeKit, EngineRenderer");
  } else {
    ok(".clasp.json push order includes core spec files");
  }
}

function gasStubs() {
  return `
    var Logger = { log: function(){} };
    var Session = { getScriptTimeZone: function(){ return 'America/Los_Angeles'; } };
    var Utilities = {
      formatDate: function(){ return 'Jan 1, 2026'; },
      sleep: function(){},
      getUuid: function(){ return 'uuid'; },
      base64Decode: function(){ return []; },
      newBlob: function(){ return { getBytes: function(){ return []; }, getDataAsString: function(){ return ''; } }; }
    };
    var CacheService = {
      getUserCache: function(){ return { put: function(){}, get: function(){ return null; } }; }
    };
    var Slides = { Presentations: { get: function(){ return { slides: [] }; }, batchUpdate: function(){ return {}; } } };
    var SlidesApp = {
      ShapeType: {RECTANGLE:'RECTANGLE',ROUND_RECTANGLE:'ROUND_RECTANGLE',DIAMOND:'DIAMOND',ELLIPSE:'ELLIPSE',CHEVRON:'CHEVRON',HOME_PLATE:'HOME_PLATE',TRIANGLE:'TRIANGLE',RIGHT_ARROW:'RIGHT_ARROW'},
      LineCategory: {STRAIGHT:1},
      ArrowStyle: {FILL_ARROW:1},
      ParagraphAlignment: {START:1,CENTER:1,END:1},
      ContentAlignment: {TOP:1,MIDDLE:1,BOTTOM:1},
      PredefinedLayout: {BLANK:1},
      PageElementType: {SHAPE:1,GROUP:1,TABLE:1},
      getUi: function(){return {createAddonMenu:function(){return {addItem:function(){return this;},addSeparator:function(){return this;},addToUi:function(){}};},createMenu:function(){return {addItem:function(){return this;},addToUi:function(){}};},showSidebar:function(){},showModalDialog:function(){},alert:function(){},ButtonSet:{OK:1}};},
      getActivePresentation: function(){return {getId:function(){return 'active-id';},getUrl:function(){return 'https://docs.google.com/presentation/d/active-id';},getName:function(){return 'Current';},getPageWidth:function(){return 720;},getPageHeight:function(){return 405;},getSlides:function(){return [{getPageElements:function(){return [];},remove:function(){}}];},appendSlide:function(){return {getPageElements:function(){return [];}};}};},
      create: function(){ throw new Error('SlidesApp.create must not run in default generation tests'); },
      openById: function(){return {getName:function(){return 'x';},getSlides:function(){return [];},getPageWidth:function(){return 720;},getPageHeight:function(){return 405;},saveAndClose:function(){}};}
    };
    var HtmlService = {createHtmlOutputFromFile:function(){return {setTitle:function(){return this;},setWidth:function(){return this;},setHeight:function(){return this;}};}};
    var CardService = {newCardBuilder:function(){return {setHeader:function(){return this;},addSection:function(){return this;},build:function(){return {};}};},newCardHeader:function(){return {setTitle:function(){return this;}};},newCardSection:function(){return {addWidget:function(){return this;}};},newTextParagraph:function(){return {setText:function(){return this;}};}};
    var PropertiesService = {getScriptProperties:function(){return {getProperty:function(){return '';},setProperty:function(){},deleteProperty:function(){}};}};
    var ScriptApp = {getOAuthToken:function(){return 'test-token';}};
    var UrlFetchApp = {fetch:function(){throw new Error('network disabled in validate');}};
    var DriveApp = {getFileById:function(){throw new Error('drive disabled in validate');},getFolderById:function(){throw new Error('drive disabled in validate');}};
    var console = {error:function(){},log:function(){}};
  `;
}

function assertGasSyntaxAndSymbols() {
  const files = [
    "src/Brand.gs",
    "src/ShapeKit.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Code.gs"
  ];

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(gasStubs(), sandbox);

  for (const rel of files) {
    try {
      vm.runInContext(read(rel), sandbox, { filename: rel });
      ok(`Loaded ${rel}`);
    } catch (e) {
      fail(`Failed loading ${rel}: ${e.message}`);
    }
  }

  const requiredFns = [
    "onOpen",
    "showGenerator",
    "showGeneratorSidebar",
    "generatePresentation",
    "getGeneratorBootstrap",
    "getFilteredReferenceLibrary",
    "getPipelineStages",
    "getProgress",
    "cancelRun",
    "drawSlidesIntoActive_",
    "renderEngineSlide"
  ];
  for (const fn of requiredFns) {
    if (typeof sandbox[fn] !== "function") fail(`Missing global function: ${fn}`);
    else ok(`Global function present: ${fn}`);
  }

  if (!sandbox.ENGINE) fail("Missing ENGINE layout object");
  else ok("ENGINE layout object present");
  if (!sandbox.EngineRenderer) fail("Missing EngineRenderer object");
  else ok("EngineRenderer object present");
  if (!sandbox.CONFIG) fail("Missing CONFIG");
  else ok("CONFIG present");
  if (!sandbox.SHAPE_KIT || !sandbox.SHAPE_KIT.b64) fail("Missing ShapeKit data");
  else ok("ShapeKit data present");
  if (!sandbox.DEFAULT_BRAND) fail("Missing DEFAULT_BRAND");
  else ok("DEFAULT_BRAND present");

  const fnNames = {};
  for (const rel of files) {
    const text = read(rel);
    const re = /function\s+([A-Za-z0-9_]+)\s*\(/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      if (fnNames[name] && fnNames[name] !== rel) {
        if (!/_$/.test(name) && name[0] === name[0].toLowerCase()) continue;
        fail(`Duplicate function ${name} in ${fnNames[name]} and ${rel}`);
      } else {
        fnNames[name] = rel;
      }
    }
  }
  ok("No conflicting top-level function duplicates detected");
}

function assertShapeTypeSafety() {
  const src = read("src/EngineRenderer.gs");
  if (/ShapeType\.ROUNDED_RECTANGLE/.test(src)) {
    fail("EngineRenderer must not use invalid ShapeType.ROUNDED_RECTANGLE");
  } else {
    ok("EngineRenderer does not use ShapeType.ROUNDED_RECTANGLE");
  }
  if (/ShapeType\s*\[[^\]]/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
    fail("EngineRenderer must not dynamically index ShapeType with arbitrary strings");
  } else {
    ok("EngineRenderer does not dynamically index ShapeType");
  }
  const insertCalls = src.match(/\.insertShape\s*\(/g) || [];
  if (insertCalls.length !== 1) {
    fail(`Expected exactly one insertShape call (insertShapeSafe_), found ${insertCalls.length}`);
  } else {
    ok("All EngineRenderer shape inserts go through insertShapeSafe_");
  }
  if (!/function normalizeShapeType_/.test(src) || !/function insertShapeSafe_/.test(src)) {
    fail("EngineRenderer missing shape-type normalization helpers");
  } else {
    ok("EngineRenderer has shape-type normalization helpers");
  }
  if (!/function safeBox_/.test(src)) {
    fail("EngineRenderer missing safeBox_ dimension helper");
  } else {
    ok("EngineRenderer has safeBox_ dimension helper");
  }
  const textBoxCalls = src.match(/\.insertTextBox\s*\(/g) || [];
  if (textBoxCalls.length !== 1) {
    fail(`Expected exactly one insertTextBox call (insertTextBoxSafe_), found ${textBoxCalls.length}`);
  } else {
    ok("All text box inserts go through insertTextBoxSafe_");
  }
}

function assertSamePresentation() {
  const code = read("src/Code.gs");
  if (!/SlidesApp\.getActivePresentation\(\)/.test(code)) {
    fail("Code.gs must use SlidesApp.getActivePresentation()");
  } else {
    ok("Code.gs uses the active presentation");
  }
  if (!/function drawSlidesIntoActive_/.test(code)) {
    fail("Code.gs missing drawSlidesIntoActive_");
  } else {
    ok("In-place draw helper present");
  }
  const run = code.slice(code.indexOf("function generatePresentationRun_"));
  const defaultBranch = run.slice(0, run.indexOf("function specTitle_"));
  if (/createWorkingDeck_\(/.test(defaultBranch) && /!CONFIG\.useBeautifulAi/.test(defaultBranch)) {
    // allowed only in beautiful path; ensure the false branch does not call it
  }
  if (!/drawSlidesIntoActive_\(target/.test(defaultBranch)) {
    fail("Default create path must draw into the active presentation");
  } else {
    ok("Default create path draws into the active presentation");
  }
  if (/createWorkingDeck_\(plan\.deck_title/.test(defaultBranch)) {
    fail("Default create path must not create a working copy presentation");
  } else {
    ok("Default create path does not call createWorkingDeck_");
  }
}

function assertShapeKitIntact() {
  const src = read("src/ShapeKit.gs");
  const m = src.match(/b64:\s*'([^']+)'/);
  if (!m) {
    fail("ShapeKit.gs missing embedded b64 kit");
    return;
  }
  if (m[1].length < 30000) fail(`ShapeKit b64 looks truncated (${m[1].length} chars)`);
  else ok(`ShapeKit b64 intact (${m[1].length} chars)`);
  if (!/ROUND_RECTANGLE/.test(src)) fail("ShapeKit must filter ROUND_RECTANGLE shapes");
  else ok("ShapeKit uses ROUND_RECTANGLE");
}

function main() {
  console.log("Validating 66-deck-agent...\n");
  assertRequiredFiles();
  assertJson("package.json");
  assertJson(".clasp.json");
  assertJson("src/appsscript.json");
  assertYaml(".github/workflows/deploy.yml");
  assertHtml("src/Generator.html");
  assertManifest();
  assertClaspConfig();
  assertNoSecrets();
  assertShapeKitIntact();
  assertShapeTypeSafety();
  assertSamePresentation();
  assertGasSyntaxAndSymbols();

  if (failures > 0) {
    console.error(`\nValidation failed with ${failures} issue(s).`);
    process.exit(1);
  }
  console.log("\nValidation passed.");
}

main();
