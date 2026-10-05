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
  // Basic balance check for critical tags
  const opens = (html.match(/<div\b/gi) || []).length;
  const closes = (html.match(/<\/div>/gi) || []).length;
  if (opens !== closes) {
    fail(`HTML div imbalance in ${rel}: open=${opens} close=${closes}`);
    return;
  }
  ok(`HTML structure looks valid: ${rel}`);
}

function assertNoSecrets() {
  const banned = [
    ".clasprc.json",
    "credentials.json",
    "service-account.json",
    ".env"
  ];
  for (const rel of banned) {
    if (exists(rel)) {
      fail(`Secret-like file must not be committed: ${rel}`);
    }
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
    "src/Spec.gs",
    "src/Qa.gs",
    "src/Generator.html"
  ];
  for (const rel of required) {
    if (!exists(rel)) fail(`Missing required file: ${rel}`);
    else ok(`Found ${rel}`);
  }
}

function assertManifest() {
  const manifest = JSON.parse(read("src/appsscript.json"));
  if (manifest.runtimeVersion !== "V8") {
    fail("appsscript.json runtimeVersion must be V8");
  } else {
    ok("Apps Script runtime is V8");
  }
  const scopes = manifest.oauthScopes || [];
  const needed = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/cloud-platform"
  ];
  for (const scope of needed) {
    if (scopes.indexOf(scope) === -1) fail(`Missing OAuth scope: ${scope}`);
    else ok(`OAuth scope present: ${scope}`);
  }
  if (!manifest.addOns || !manifest.addOns.slides) {
    fail("appsscript.json missing slides add-on config");
  } else {
    ok("Slides add-on config present");
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
}

function assertGasSyntaxAndSymbols() {
  const files = [
    "src/Brand.gs",
    "src/Spec.gs",
    "src/Reference.gs",
    "src/Qa.gs",
    "src/EngineRenderer.gs",
    "src/Engine.gs",
    "src/Rebrand.gs",
    "src/Code.gs"
  ];

  // Syntax check via Function constructor after mild GAS API stubs.
  const stubs = `
    var SlidesApp = {
      ShapeType: {RECTANGLE:1,ROUND_RECTANGLE:2,DIAMOND:3,ELLIPSE:4,CHEVRON:5,HOME_PLATE:6,TRIANGLE:7,RIGHT_ARROW:8},
      LineCategory: {STRAIGHT:1},
      ArrowStyle: {FILL_ARROW:1},
      ParagraphAlignment: {CENTER:1},
      PredefinedLayout: {BLANK:1},
      PageElementType: {SHAPE:1},
      getUi: function(){return {createMenu:function(){return {addItem:function(){return this;},addToUi:function(){}};},showSidebar:function(){},alert:function(){},ButtonSet:{OK:1}};},
      create: function(){return {getId:function(){return 'id';},getUrl:function(){return 'url';},getSlides:function(){return [{remove:function(){},getPageElements:function(){return [];},appendSlide:null}];},appendSlide:function(){return {getPageElements:function(){return [];},getNotesPage:function(){return {getSpeakerNotesShape:function(){return {getText:function(){return {setText:function(){}};}};}};}};}};},
      openById: function(){return {getName:function(){return 'x';},getSlides:function(){return [];}};}
    };
    var HtmlService = {createHtmlOutputFromFile:function(){return {setTitle:function(){return this;},setWidth:function(){return this;}};}};
    var CardService = {newCardBuilder:function(){return {setHeader:function(){return this;},addSection:function(){return this;},build:function(){return {};}};},newCardHeader:function(){return {setTitle:function(){return this;},setSubtitle:function(){return this;}};},newCardSection:function(){return {addWidget:function(){return this;}};},newTextParagraph:function(){return {setText:function(){return this;}};}};
    var PropertiesService = {getScriptProperties:function(){return {getProperty:function(){return '';}};}};
    var ScriptApp = {getOAuthToken:function(){return 'test-token';}};
    var UrlFetchApp = {fetch:function(){throw new Error('network disabled in validate');}};
    var DriveApp = {getFileById:function(){throw new Error('drive disabled in validate');}};
    var console = {error:function(){},log:function(){}};
  `;

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(stubs, sandbox);

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
    "showGeneratorSidebar",
    "runDeckGeneration",
    "getGeneratorBootstrap",
    "getFilteredReferenceLibrary",
    "getPipelineStages"
  ];
  for (const fn of requiredFns) {
    if (typeof sandbox[fn] !== "function") fail(`Missing global function: ${fn}`);
    else ok(`Global function present: ${fn}`);
  }

  const modules = ["Brand", "Spec", "Reference", "Qa", "Engine", "EngineRenderer", "Rebrand"];
  for (const mod of modules) {
    if (!sandbox[mod]) fail(`Missing module object: ${mod}`);
    else ok(`Module present: ${mod}`);
  }

  // Duplicate function names across files (naive)
  const fnNames = {};
  for (const rel of files) {
    const text = read(rel);
    const re = /function\s+([A-Za-z0-9_]+)\s*\(/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      if (fnNames[name] && fnNames[name] !== rel) {
        // Ignore common tiny locals by only flagging globals-like names
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
  if (/ShapeType\s*\[/.test(src)) {
    fail("EngineRenderer must not dynamically index ShapeType with arbitrary strings");
  } else {
    ok("EngineRenderer does not dynamically index ShapeType");
  }
  const insertCalls = src.match(/\.insertShape\s*\(/g) || [];
  if (insertCalls.length !== 1) {
    fail(`Expected exactly one insertShape call (insertShapeSafe_), found ${insertCalls.length}`);
  } else {
    ok("All shape inserts go through insertShapeSafe_");
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
    fail(`Expected exactly one insertTextBox call (addTextBox), found ${textBoxCalls.length}`);
  } else {
    ok("All text box inserts go through addTextBox");
  }
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
  assertShapeTypeSafety();
  assertGasSyntaxAndSymbols();

  if (failures > 0) {
    console.error(`\nValidation failed with ${failures} issue(s).`);
    process.exit(1);
  }
  console.log("\nValidation passed.");
}

main();
