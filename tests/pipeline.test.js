"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadEngineStack(scriptProperties) {
  const props = scriptProperties || {};
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    Logger: { log() {} },
    Session: { getScriptTimeZone() { return "America/Los_Angeles"; } },
    Utilities: {
      formatDate() { return "Oct 5, 2026"; },
      sleep() {},
      getUuid() { return "uuid"; }
    },
    CacheService: {
      getUserCache() {
        return { put() {}, get() { return null; } };
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) =>
          Object.prototype.hasOwnProperty.call(props, key) ? props[key] : "",
        setProperty() {},
        deleteProperty() {}
      })
    },
    ScriptApp: { getOAuthToken: () => "test-oauth-token" },
    UrlFetchApp: {
      fetch: () => { throw new Error("network disabled"); }
    },
    DriveApp: {
      getFileById: () => { throw new Error("drive disabled"); }
    },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        DIAMOND: "DIAMOND",
        ELLIPSE: "ELLIPSE",
        CHEVRON: "CHEVRON",
        HOME_PLATE: "HOME_PLATE"
      },
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
  for (const rel of [
    "src/Brand.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/Code.gs"
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox, {
      filename: rel
    });
  }
  return sandbox;
}

test("CONFIG defaults keep Beautiful.ai off so slides draw in-place", () => {
  const { CONFIG } = loadEngineStack();
  assert.equal(CONFIG.useBeautifulAi, false);
  assert.equal(CONFIG.useReferenceLibrary, true);
  assert.equal(CONFIG.roundedBoxes, true);
});

test("Vertex defaults location and model when unset", () => {
  const sandbox = loadEngineStack({ VERTEX_PROJECT_ID: "demo-project" });
  const config = sandbox.getVertexConfig_();
  assert.equal(config.projectId, "demo-project");
  assert.equal(config.location, "us-central1");
  assert.equal(config.model, "gemini-2.5-flash");
  assert.equal(sandbox.isVertexConfigured_(), true);
});

test("regional Vertex endpoint construction", () => {
  const sandbox = loadEngineStack({
    VERTEX_PROJECT_ID: "demo-project",
    VERTEX_LOCATION: "us-central1",
    VERTEX_MODEL: "gemini-2.5-flash"
  });
  const url = sandbox.buildVertexEndpoint_(sandbox.getVertexConfig_());
  assert.equal(
    url,
    "https://us-central1-aiplatform.googleapis.com/v1/projects/demo-project/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
  );
});

test("global Vertex endpoint construction", () => {
  const sandbox = loadEngineStack({
    VERTEX_PROJECT_ID: "demo-project",
    VERTEX_LOCATION: "global",
    VERTEX_MODEL: "gemini-2.5-flash"
  });
  const url = sandbox.buildVertexEndpoint_(sandbox.getVertexConfig_());
  assert.equal(
    url,
    "https://aiplatform.googleapis.com/v1/projects/demo-project/locations/global/publishers/google/models/gemini-2.5-flash:generateContent"
  );
});

test("getApiKey uses Vertex sentinel when VERTEX_PROJECT_ID is set", () => {
  const sandbox = loadEngineStack({ VERTEX_PROJECT_ID: "demo-project" });
  assert.equal(sandbox.getApiKey(), "vertex");
});

test("bootstrap reports the active presentation URL", () => {
  const { getGeneratorBootstrap } = loadEngineStack();
  const boot = getGeneratorBootstrap();
  assert.equal(boot.presentationId, "active-id");
  assert.match(boot.url, /active-id/);
  assert.ok(boot.stages.includes("research"));
});

test("pipeline stages follow the spec create flow", () => {
  const { getPipelineStages } = loadEngineStack();
  const stages = Array.from(getPipelineStages());
  assert.equal(stages.join(","), "research,write,match,fit,brand,insert");
});

test("ENGINE.cleanSpec strips stray color codes", () => {
  const { ENGINE } = loadEngineStack();
  const cleaned = ENGINE.cleanSpec({
    type: "cards",
    title: "Hello #0052FF world",
    items: [{ title: "One", text: "Body" }]
  });
  assert.equal(cleaned.title.includes("#0052FF"), false);
});

test("same-presentation targeting uses getActivePresentation", () => {
  const root = path.resolve(__dirname, "..");
  const code = fs.readFileSync(path.join(root, "src/Code.gs"), "utf8");
  assert.match(code, /const target = SlidesApp\.getActivePresentation\(\)/);
  assert.match(code, /drawSlidesIntoActive_\(target, plan\.slides, ctx, blankDeck\)/);
  assert.doesNotMatch(
    code.slice(code.indexOf("if (!CONFIG.useBeautifulAi)"), code.indexOf("} else {")),
    /createWorkingDeck_/
  );
});

test("Create completion returns the same active presentation id as bootstrap", () => {
  const sandbox = loadEngineStack();
  const boot = sandbox.getGeneratorBootstrap();
  const result = sandbox.generationResult_(
    "SUCCESS: 8 branded slides added to this presentation",
    sandbox.SlidesApp.getActivePresentation(),
    8
  );
  assert.equal(result.presentationId, "active-id");
  assert.equal(result.presentationId, boot.presentationId);
  assert.equal(result.url, boot.url);
  assert.equal(result.ok, true);
});

test("default generate path source does not create a second deck", () => {
  const root = path.resolve(__dirname, "..");
  const code = fs.readFileSync(path.join(root, "src/Code.gs"), "utf8");
  const createCalls = code.match(/SlidesApp\.create\(/g) || [];
  assert.equal(createCalls.length, 1, "SlidesApp.create must remain only as the optional Beautiful.ai working copy helper");
  assert.match(code, /function createWorkingDeck_/);
  const helper = code.slice(code.indexOf("function createWorkingDeck_"), code.indexOf("function drawSlidesIntoActive_"));
  assert.match(helper, /SlidesApp\.create\(/);
});
