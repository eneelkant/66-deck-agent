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
    "src/Diagram.gs",
    "src/IconProvider.gs",
    "src/Generator.html",
    "assets/icons/manifest.json"
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
  const grantedFn = manifest.addOns && manifest.addOns.slides && manifest.addOns.slides.onFileScopeGrantedTrigger && manifest.addOns.slides.onFileScopeGrantedTrigger.runFunction;
  if (grantedFn !== "onFileScopeGranted") fail("onFileScopeGrantedTrigger must run onFileScopeGranted");
  else ok("First-time file-scope grant runs onFileScopeGranted");

  if (manifest.enabledAdvancedServices) {
    fail("enabledAdvancedServices must live under dependencies, not at the top level");
  } else {
    ok("enabledAdvancedServices is not at the top-level manifest");
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
  if (!/Diagram\.gs/.test(order) || !/IconProvider\.gs/.test(order)) {
    fail(".clasp.json filePushOrder must include Diagram.gs and IconProvider.gs");
  } else {
    ok(".clasp.json push order includes Diagram and IconProvider");
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
    var DriveApp = {
      getFileById:function(){throw new Error('drive disabled in validate');},
      getFolderById:function(){throw new Error('drive disabled in validate');},
      createFolder:function(){return {getId:function(){return 'folder';}};},
      getRootFolder:function(){return {createFile:function(){return {getId:function(){return 'file';}};}}; }
    };
    var MimeType = {PLAIN_TEXT:'text/plain', CSV:'text/csv', PDF:'application/pdf', GOOGLE_SLIDES:'application/vnd.google-apps.presentation'};
    var console = {error:function(){},log:function(){}};
  `;
}

function assertGasSyntaxAndSymbols() {
  const files = [
    "src/Brand.gs",
    "src/ShapeKit.gs",
    "src/IconProvider.gs",
    "src/Diagram.gs",
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
    "renderEngineSlide",
    "normalizePresentationType_",
    "normalizeDepartment_",
    "clampSlideCount_",
    "applyDepartmentFilter_",
    "callVertexGemini_",
    "getVertexConfig_",
    "isVertexConfigured_",
    "buildVertexEndpoint_",
    "buildProductionMenu_",
    "ensureInitialSetup_",
    "runInitialSetup_",
    "validateBrandIconManifest_",
    "detectUploadCategory_",
    "validateDiagramIr_",
    "parseMermaidToIr_",
    "parseDrawioToIr_",
    "parseExcalidrawToIr_",
    "parseSvgToIr_",
    "attachDiagramsToPlan_",
    "diagramIrToEngineElements_",
    "resolveIconRequest_",
    "sanitizeIconSvg_",
    "resolveIconsForPlan_"
  ];
  for (const fn of requiredFns) {
    if (typeof sandbox[fn] !== "function") fail(`Missing global function: ${fn}`);
    else ok(`Global function present: ${fn}`);
  }

  if (!sandbox.ENGINE) fail("Missing ENGINE layout object");
  else ok("ENGINE layout object present");
  if (!sandbox.EngineRenderer) fail("Missing EngineRenderer object");
  else ok("EngineRenderer object present");
  if (!sandbox.DiagramIR) fail("Missing DiagramIR object");
  else ok("DiagramIR object present");
  if (!sandbox.IconProvider) fail("Missing IconProvider object");
  else ok("IconProvider object present");
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
  if (!/function generationResult_/.test(code)) {
    fail("Code.gs missing generationResult_");
  } else {
    ok("generationResult_ returns active presentation metadata");
  }
  if (!/return generationResult_\(msg, target, copied\)/.test(code)) {
    fail("Create completion must return the active presentation via generationResult_");
  } else {
    ok("Create completion returns the active presentation");
  }
  if (!/function overlayTextIfNeeded_/.test(read("src/EngineRenderer.gs"))) {
    fail("EngineRenderer missing overlayTextIfNeeded_ for shapes without text frames");
  } else {
    ok("EngineRenderer overlays text on shapes without a text frame");
  }
  const html = read("src/Generator.html");
  if (!/msg\.presentationId/.test(html) || !/currentPresentation\.url = msg\.url/.test(html)) {
    fail("Generator.html must bind the completion link to the returned presentation");
  } else {
    ok("Generator.html completion link uses the returned presentation id/url");
  }
  if (!/<h2>\s*66° Deck Agent\s*<\/h2>/.test(html)) {
    fail("Generator.html must use the 66° Deck Agent headline");
  } else {
    ok("Generator.html uses 66° Deck Agent headline");
  }
  if (/<h2>\s*66degrees AI Presentation Generator\s*<\/h2>/.test(html)) {
    fail("Generator.html must not use the obsolete generator heading");
  } else {
    ok("Generator.html does not use the obsolete generator heading");
  }
  if (!/Prompt \+ docs/.test(html)) {
    fail("Generator.html missing product subtitle");
  } else {
    ok("Generator.html has product subtitle");
  }
  if (!/presentationType:\s*presentationType/.test(html) || !/department:\s*department/.test(html) || !/slideCount:\s*slides/.test(html)) {
    fail("Generator.html must send presentationType, department, and slideCount to generatePresentation");
  } else {
    ok("Generator.html sends presentationType, department, and slideCount");
  }
  if (!/id="presentationType"/.test(html) || !/id="department"/.test(html)) {
    fail("Generator.html missing presentation type / department controls");
  } else {
    ok("Generator.html has presentation type and department controls");
  }
  if (!/min="3"/.test(html) || !/max="20"/.test(html) || /max="100"/.test(html)) {
    fail("Generator.html slide count must be 3–20");
  } else {
    ok("Generator.html slide count is 3–20");
  }
  if (!/data\.presentationType/.test(code) || !/data\.department/.test(code) || !/data\.slideCount/.test(code)) {
    fail("Code.gs must read presentationType, department, and slideCount from generator data");
  } else {
    ok("Code.gs reads presentationType, department, and slideCount");
  }
  if (!/PRESENTATION TYPE:/.test(code) || !/DEPARTMENT:/.test(code)) {
    fail("planContent must include presentation type and department");
  } else {
    ok("planContent includes presentation type and department");
  }
  const brand = read("src/Brand.gs");
  for (const name of ["Pitch", "Strategy", "Proposal", "Sales", "Case Study", "Report", "Custom"]) {
    if (brand.indexOf("'" + name + "'") === -1 && brand.indexOf('"' + name + '"') === -1) {
      fail("Brand.gs PRESENTATION_TYPES missing " + name);
    }
  }
  for (const name of ["Sales", "Marketing", "Technology", "Finance", "Operations", "HR", "Leadership", "Other"]) {
    if (brand.indexOf("'" + name + "'") === -1 && !new RegExp("\\b" + name + "\\b").test(brand)) {
      fail("Brand.gs DEPARTMENTS missing " + name);
    }
  }
  ok("Brand.gs has presentation type and department catalogs");
  if (!/function splitSpace/.test(read("src/Engine.gs")) || !/function innerSize/.test(read("src/Engine.gs"))) {
    fail("Engine.gs missing splitSpace/innerSize geometry helpers");
  } else {
    ok("Engine.gs has splitSpace and innerSize geometry helpers");
  }
}

function assertNoDriveRestApi() {
  const files = [
    "src/Code.gs",
    "src/Brand.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/ShapeKit.gs",
    "src/Generator.html"
  ];
  const banned = [
    /googleapis\.com\/drive\//,
    /googleapis\.com\/upload\/drive\//,
    /\bDrive\.Files\b/,
    /\bDrive\.About\b/,
    /serviceusage\.googleapis\.com/
  ];
  let hits = 0;
  for (const rel of files) {
    const src = read(rel);
    for (const re of banned) {
      if (re.test(src)) {
        fail(`${rel} contains forbidden Drive REST / Advanced Drive usage (${re})`);
        hits += 1;
      }
    }
  }
  if (!hits) ok("No Drive REST / Advanced Drive / serviceusage enablement calls in source");

  const brand = read("src/Brand.gs");
  if (!/function exportDriveFileAsText_/.test(brand) || !/function isDriveApiEnablementError_/.test(brand)) {
    fail("Brand.gs missing DriveApp-safe export/enablement helpers");
  } else {
    ok("Brand.gs has DriveApp-safe export helpers");
  }
  if (!/function trashDriveFileById_/.test(brand)) {
    fail("Brand.gs missing trashDriveFileById_");
  } else {
    ok("Drive trash uses DriveApp helper");
  }

  const code = read("src/Code.gs");
  if (/Make sure the Google Drive API is enabled/.test(code)) {
    fail("Code.gs must not instruct end users to enable the Drive API");
  } else {
    ok("Code.gs does not ask users to enable the Drive API");
  }
}

function assertVertexOauthOnly() {
  const srcFiles = [
    "src/Code.gs",
    "src/Brand.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/ShapeKit.gs",
    "src/Generator.html",
    "src/appsscript.json"
  ];
  const banned = [
    { re: /\bGEMINI_API_KEY\b/, label: "GEMINI_API_KEY" },
    { re: /\bGOOGLE_API_KEY\b/, label: "GOOGLE_API_KEY" },
    { re: /x-goog-api-key/, label: "x-goog-api-key" },
    { re: /generativelanguage\.googleapis\.com/, label: "generativelanguage.googleapis.com" }
  ];
  let hits = 0;
  for (const rel of srcFiles) {
    const src = read(rel);
    for (const item of banned) {
      if (item.re.test(src)) {
        fail(`${rel} must not contain ${item.label}`);
        hits += 1;
      }
    }
  }
  if (!hits) ok("No Gemini API-key / AI Studio authentication path in production source");

  const brand = read("src/Brand.gs");
  if (!/function callVertexGemini_/.test(brand) || !/ScriptApp\.getOAuthToken\(\)/.test(brand) || !/aiplatform\.googleapis\.com/.test(brand)) {
    fail("Brand.gs missing Vertex AI OAuth helper");
  } else {
    ok("Brand.gs has Vertex AI OAuth helper");
  }
  if (!/Vertex AI API is not enabled/.test(brand)) {
    fail("Brand.gs must report when Vertex AI API is not enabled");
  } else {
    ok("Brand.gs reports missing Vertex AI API clearly");
  }

  const code = read("src/Code.gs");
  const show = code.slice(code.indexOf("function showGenerator()"), code.indexOf("function showGeneratorSidebar"));
  if (/\.setTitle\(\s*['"]66° Deck Agent['"]\s*\)/.test(show)) {
    fail("showGenerator must not set the outer sidebar title to 66° Deck Agent");
  } else {
    ok("Outer sidebar title is not configured as 66° Deck Agent");
  }
  if (!/showSidebar/.test(show) || !/createHtmlOutputFromFile\('Generator'\)/.test(show)) {
    fail("showGenerator must still open the Generator sidebar");
  } else {
    ok("showGenerator still opens the Generator sidebar");
  }
  const html = read("src/Generator.html");
  if (!/<h2>\s*66° Deck Agent\s*<\/h2>/.test(html)) {
    fail("Inner Generator heading 66° Deck Agent must remain");
  } else {
    ok("Inner Generator heading 66° Deck Agent is retained");
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

function assertProductionMenu() {
  const code = read("src/Code.gs");
  const onOpen = code.slice(code.indexOf("function onOpen()"), code.indexOf("function onInstall()"));
  const menu = code.slice(code.indexOf("function buildProductionMenu_()"), code.indexOf("function showGenerator()"));
  const userVisible = onOpen + "\n" + menu;
  const banned = [
    "Reference library status",
    "Harvest reference deck (admin)",
    "Icon check (admin)"
  ];
  banned.forEach(function (label) {
    if (userVisible.indexOf(label) !== -1) fail("User menu must not contain: " + label);
    else ok("User menu hides: " + label);
  });
  ["Open 66° Deck Agent", "Refresh brand kit", "Refresh brand assets"].forEach(function (label) {
    if (userVisible.indexOf(label) === -1) fail("User menu missing: " + label);
    else ok("User menu includes: " + label);
  });
  if (!/function harvestReferenceDeck/.test(read("src/Reference.gs")) || !/function iconCheck/.test(read("src/Reference.gs")) || !/function referenceStatus/.test(read("src/Reference.gs"))) {
    fail("Admin/reference helpers must remain as internal functions");
  } else {
    ok("Admin/reference helpers remain internal");
  }
  if (!/function ensureInitialSetup_/.test(code) || !/function onInstall\(\)/.test(code) || !/ensureInitialSetup_\(\)/.test(code.slice(code.indexOf("function onInstall()"), code.indexOf("function buildProductionMenu_")))) {
    fail("onInstall must run ensureInitialSetup_");
  } else {
    ok("onInstall runs first-time setup");
  }
}

function assertDiagramAndIconIntelligence() {
  const diagram = read("src/Diagram.gs");
  const icons = read("src/IconProvider.gs");
  const code = read("src/Code.gs");
  const engine = read("src/Engine.gs");
  if (!/function validateDiagramIr_/.test(diagram) || !/function parseMermaidToIr_/.test(diagram)) {
    fail("Diagram.gs missing IR validation/parsers");
  } else ok("Diagram IR parsers present");
  if (!/function sanitizeIconSvg_/.test(icons) || !/api\.iconify\.design/.test(icons)) {
    fail("IconProvider must sanitize SVG and use Iconify-compatible retrieval");
  } else ok("IconProvider sanitization and Iconify adapter present");
  if (/require\(|from ['"]bun|npx better-icons|mcpServers/.test(diagram + icons)) {
    fail("Diagram/IconProvider must not require Node/Bun/MCP at runtime");
  } else ok("No Node/Bun/MCP runtime dependency in diagram/icon modules");
  if (!/progressStage_\(ctx, 'diagram'/.test(code) || !/progressStage_\(ctx, 'icons'/.test(code)) {
    fail("Create pipeline must include diagram and icons progress stages");
  } else ok("Create pipeline includes diagram/icons stages");
  if (!/attachDiagramsToPlan_/.test(code) || !/resolveIconsForPlan_/.test(code)) {
    fail("Create pipeline must attach diagrams and resolve icons");
  } else ok("Create pipeline wires diagram and icon intelligence");
  if (/architecture:\s*'bullets'|flowchart:\s*'bullets'|diagram:\s*'bullets'/.test(engine)) {
    fail("ENGINE must not force architecture/flowchart/diagram to bullets");
  } else ok("ENGINE routes architecture/flowchart to diagram layouts");
  const createBlock = code.match(/create:\s*\[[\s\S]*?\],\s*create_beautiful:/);
  if (!createBlock || !/\['diagram'/.test(createBlock[0]) || !/\['icons'/.test(createBlock[0])) {
    fail("PROGRESS_STAGES.create must include diagram and icons");
  } else ok("PROGRESS_STAGES.create includes diagram and icons");
}

function assertBrandIconAssets() {
  const rel = "assets/icons/manifest.json";
  let manifest;
  try {
    manifest = JSON.parse(read(rel));
    ok("Icon manifest JSON valid");
  } catch (e) {
    fail("Icon manifest JSON invalid: " + e.message);
    return;
  }
  const colors = { night_blue: "#040A1B", white: "#FFFDF9", accent_blue: "#0052FF" };
  const styles = { night_blue: "night-blue", white: "white", accent_blue: "accent-blue" };
  if (manifest.brand !== "66degrees") fail("Icon manifest brand must be 66degrees");
  else ok("Icon manifest brand is 66degrees");
  if (!Array.isArray(manifest.icons) || !manifest.icons.length) {
    fail("Icon manifest has no icons");
    return;
  }
  let broken = 0;
  for (const ic of manifest.icons) {
    for (const key of Object.keys(colors)) {
      const fileRel = ic.files && ic.files[key];
      if (!fileRel || !exists(fileRel)) {
        fail("Missing icon file for " + ic.id + " " + key);
        broken += 1;
        continue;
      }
      const svg = read(fileRel);
      if (!/<svg[\s>]/i.test(svg) || !/viewBox=/i.test(svg) || !/<\/svg>/i.test(svg)) {
        fail(fileRel + " is not a usable SVG");
        broken += 1;
      }
      if (svg.toUpperCase().indexOf(colors[key].toUpperCase()) === -1) {
        fail(fileRel + " missing brand color " + colors[key]);
        broken += 1;
      }
      if (fileRel.indexOf("assets/icons/" + styles[key] + "/") !== 0) {
        fail(fileRel + " is not in the " + styles[key] + " folder");
        broken += 1;
      }
    }
  }
  if (!broken) ok("Icon manifest files exist with brand colors");
}

function main() {
  console.log("Validating 66-deck-agent...\n");
  assertRequiredFiles();
  assertJson("package.json");
  assertJson(".clasp.json");
  assertJson("src/appsscript.json");
  assertJson("assets/icons/manifest.json");
  assertYaml(".github/workflows/deploy.yml");
  assertHtml("src/Generator.html");
  assertManifest();
  assertClaspConfig();
  assertNoSecrets();
  assertShapeKitIntact();
  assertShapeTypeSafety();
  assertNoDriveRestApi();
  assertVertexOauthOnly();
  assertSamePresentation();
  assertProductionMenu();
  assertBrandIconAssets();
  assertDiagramAndIconIntelligence();
  assertGasSyntaxAndSymbols();

  if (failures > 0) {
    console.error(`\nValidation failed with ${failures} issue(s).`);
    process.exit(1);
  }
  console.log("\nValidation passed.");
}

main();
