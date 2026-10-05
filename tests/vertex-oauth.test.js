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

function loadBrand(scriptProperties, fetchImpl) {
  const props = scriptProperties || {};
  const fetches = [];
  const sandbox = {
    console,
    Logger: { log() {} },
    CONFIG: { model: "gemini-2.5-flash", preferProModel: false, imageModel: "auto" },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.prototype.hasOwnProperty.call(props, key) ? props[key] : "";
          },
          setProperty() {},
          deleteProperty() {}
        };
      }
    },
    ScriptApp: { getOAuthToken() { return "test-oauth-token"; } },
    UrlFetchApp: {
      fetch(url, options) {
        fetches.push({ url, options });
        if (fetchImpl) return fetchImpl(url, options);
        throw new Error("network disabled");
      }
    },
    Utilities: { sleep() {}, newBlob() { return {}; }, base64Decode() { return []; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/Brand.gs"), sandbox, { filename: "src/Brand.gs" });
  sandbox.__fetches = fetches;
  return sandbox;
}

function jsonResponse(code, obj) {
  return {
    getResponseCode() { return code; },
    getContentText() { return JSON.stringify(obj); }
  };
}

test("VERTEX_PROJECT_ID, location, and model drive the Vertex endpoint", () => {
  const sandbox = loadBrand({
    VERTEX_PROJECT_ID: "demo-project",
    VERTEX_LOCATION: "us-central1",
    VERTEX_MODEL: "gemini-2.5-flash"
  });
  const config = sandbox.getVertexConfig_();
  assert.equal(config.projectId, "demo-project");
  assert.equal(config.location, "us-central1");
  assert.equal(config.model, "gemini-2.5-flash");
  assert.equal(
    sandbox.buildVertexEndpoint_(config),
    "https://us-central1-aiplatform.googleapis.com/v1/projects/demo-project/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
  );
});

test("getApiKey requires Vertex and never reads a Gemini API key", () => {
  const configured = loadBrand({ VERTEX_PROJECT_ID: "demo-project" });
  assert.equal(configured.getApiKey(), "vertex");
  const missing = loadBrand({});
  assert.throws(() => missing.getApiKey(), /VERTEX_PROJECT_ID/);
  assert.throws(() => missing.getApiKey(), (err) => !/GEMINI_API_KEY/.test(String(err.message)));
});

test("callVertexGemini_ uses Bearer OAuth and the Vertex generateContent URL", () => {
  const sandbox = loadBrand({ VERTEX_PROJECT_ID: "demo-project" }, () =>
    jsonResponse(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
  );
  const out = sandbox.callVertexGemini_({ contents: [{ role: "user", parts: [{ text: "hi" }] }] });
  assert.equal(sandbox.__fetches.length, 1);
  const call = sandbox.__fetches[0];
  assert.match(call.url, /us-central1-aiplatform\.googleapis\.com\/v1\/projects\/demo-project\/locations\/us-central1\/publishers\/google\/models\/gemini-2\.5-flash:generateContent/);
  assert.equal(call.options.headers.Authorization, "Bearer test-oauth-token");
  assert.equal(call.options.headers["x-goog-api-key"], undefined);
  assert.ok(!/generativelanguage/.test(call.url));
  assert.equal(out.result.candidates[0].content.parts[0].text, '{"ok":true}');
});

test("callGeminiJSON parses Vertex JSON candidates", () => {
  const sandbox = loadBrand({ VERTEX_PROJECT_ID: "demo-project" }, () =>
    jsonResponse(200, { candidates: [{ content: { parts: [{ text: '{"title":"Deck"}' }] } }] })
  );
  const parsed = sandbox.callGeminiJSON([{ text: "plan" }], "vertex", 0.2);
  assert.equal(parsed.title, "Deck");
});

test("Vertex 403 SERVICE_DISABLED reports API not enabled", () => {
  const sandbox = loadBrand({ VERTEX_PROJECT_ID: "demo-project" }, () =>
    jsonResponse(403, {
      error: {
        message: "Vertex AI API has not been used in project demo-project before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=demo-project then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry. SERVICE_DISABLED"
      }
    })
  );
  assert.throws(
    () => sandbox.callVertexGemini_({ contents: [] }),
    /Vertex AI API is not enabled for the linked Google Cloud project/
  );
});

test("Vertex 401 is an authentication error, not an API-key error", () => {
  const sandbox = loadBrand({ VERTEX_PROJECT_ID: "demo-project" }, () =>
    jsonResponse(401, { error: { message: "Unauthenticated" } })
  );
  assert.throws(() => sandbox.callVertexGemini_({ contents: [] }), /Vertex AI authentication failed \(HTTP 401\)/);
  assert.throws(() => sandbox.callVertexGemini_({ contents: [] }), (err) => !/API key/i.test(String(err.message)));
});

test("production source has no Gemini API-key path", () => {
  for (const rel of ["src/Brand.gs", "src/Code.gs", "src/Generator.html", "src/appsscript.json"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /\bGEMINI_API_KEY\b/);
    assert.doesNotMatch(src, /\bGOOGLE_API_KEY\b/);
    assert.doesNotMatch(src, /x-goog-api-key/);
    assert.doesNotMatch(src, /generativelanguage\.googleapis\.com/);
  }
});
