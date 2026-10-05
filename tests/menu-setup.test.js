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

function loadSetup() {
  const store = {};
  const sandbox = {
    console,
    Logger: { log() {} },
    Date,
    JSON,
    Object,
    String,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : ""; },
          setProperty(key, value) { store[key] = String(value); },
          deleteProperty(key) { delete store[key]; }
        };
      }
    },
    loadReferenceLibrary() { return { slides: [{ tag: "A" }], icons: [], companyFacts: [] }; },
    loadReferenceRuntime() { return { slides: { A: "id" }, icons: { I: ["x"] } }; },
    getBrandProfile() { return { name: "66degrees" }; }
  };
  vm.createContext(sandbox);
  const code = read("src/Code.gs");
  const start = code.indexOf("var INITIAL_SETUP_PROP");
  const end = code.indexOf("// Refreshes brand profile");
  assert.ok(start !== -1 && end > start, "setup helpers missing");
  vm.runInContext(code.slice(start, end), sandbox, { filename: "src/Code.gs" });
  sandbox.__store = store;
  return sandbox;
}

test("user menu omits admin/reference items and keeps production actions", () => {
  const code = read("src/Code.gs");
  const menu = code.slice(code.indexOf("function buildProductionMenu_()"), code.indexOf("function showGenerator()"));
  assert.match(menu, /Open 66° Deck Agent/);
  assert.match(menu, /Refresh brand kit/);
  assert.match(menu, /Refresh brand assets/);
  assert.doesNotMatch(menu, /Reference library status/);
  assert.doesNotMatch(menu, /Harvest reference deck \(admin\)/);
  assert.doesNotMatch(menu, /Icon check \(admin\)/);
  const onOpen = code.slice(code.indexOf("function onOpen()"), code.indexOf("function onInstall()"));
  assert.doesNotMatch(onOpen, /Reference library status/);
  assert.doesNotMatch(onOpen, /Harvest reference deck/);
  assert.doesNotMatch(onOpen, /Icon check/);
});

test("admin/reference helpers remain available internally", () => {
  const src = read("src/Reference.gs");
  assert.match(src, /function harvestReferenceDeck/);
  assert.match(src, /function referenceStatus/);
  assert.match(src, /function iconCheck/);
});

test("first-time setup is idempotent", () => {
  const sandbox = loadSetup();
  const first = sandbox.ensureInitialSetup_();
  const second = sandbox.ensureInitialSetup_();
  assert.equal(first.ok, true);
  assert.equal(first.skipped, false);
  assert.equal(second.ok, true);
  assert.equal(second.skipped, true);
  assert.equal(second.initializedAt, first.initializedAt);
  const forced = sandbox.ensureInitialSetup_(true);
  assert.equal(forced.ok, true);
  assert.equal(forced.skipped, false);
});

test("onInstall and showGenerator trigger initial setup", () => {
  const code = read("src/Code.gs");
  const install = code.slice(code.indexOf("function onInstall()"), code.indexOf("function buildProductionMenu_()"));
  assert.match(install, /ensureInitialSetup_/);
  const show = code.slice(code.indexOf("function showGenerator()"), code.indexOf("function showGeneratorSidebar"));
  assert.match(show, /ensureInitialSetup_/);
  assert.doesNotMatch(show, /\.setTitle\(\s*['"]66° Deck Agent['"]\s*\)/);
  const granted = code.slice(code.indexOf("function onFileScopeGranted"), code.indexOf("var INITIAL_SETUP_PROP"));
  assert.match(granted, /ensureInitialSetup_/);
  const manifest = JSON.parse(read("src/appsscript.json"));
  assert.equal(manifest.addOns.slides.onFileScopeGrantedTrigger.runFunction, "onFileScopeGranted");
});

test("icon manifest exists, files are present, and brand colors match", () => {
  const manifest = JSON.parse(read("assets/icons/manifest.json"));
  const sandbox = {
    console,
    Logger: { log() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Brand.gs"), sandbox, { filename: "src/Brand.gs" });
  const result = sandbox.validateBrandIconManifest_(manifest);
  assert.equal(result.ok, true, result.errors && result.errors.join("; "));
  const colors = { night_blue: "#040A1B", white: "#FFFDF9", accent_blue: "#0052FF" };
  for (const ic of manifest.icons) {
    for (const key of Object.keys(colors)) {
      const rel = ic.files[key];
      const svg = read(rel);
      assert.equal(sandbox.isUsableIconSvg_(svg), true, rel);
      assert.equal(sandbox.svgUsesBrandColor_(svg, colors[key]), true, rel + " " + colors[key]);
    }
  }
});
