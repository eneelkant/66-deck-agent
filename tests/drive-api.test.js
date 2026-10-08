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

function loadCreateStack(options) {
  options = options || {};
  const driveCalls = [];
  const urlCalls = [];
  const slides = [];
  const sandbox = {
    console,
    Logger: { log() {} },
    Session: { getScriptTimeZone() { return "America/Los_Angeles"; } },
    Utilities: {
      formatDate() { return "Oct 5, 2026"; },
      sleep() {},
      getUuid() { return "uuid"; },
      base64Encode() { return "b64"; },
      base64Decode() { return []; },
      newBlob(data, mime, name) {
        return {
          getBytes() { return []; },
          getDataAsString() { return String(data || ""); },
          getContentType() { return mime || "application/octet-stream"; },
          getName() { return name || "blob"; },
          setName(n) { name = n; return this; },
          setContentType(m) { mime = m; return this; }
        };
      }
    },
    CacheService: {
      getUserCache() {
        return {
          put() {},
          get() { return null; }
        };
      },
      getScriptCache() {
        return { put() {}, get() { return null; }, removeAll() {} };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            if (key === "VERTEX_PROJECT_ID") return options.vertex ? "demo-project" : "";
            if (key === "SCITE_API_KEY") return options.sciteKey || "";
            return "";
          },
          setProperty() {},
          deleteProperty() {},
          getProperties() { return {}; },
          setProperties() {}
        };
      }
    },
    ScriptApp: { getOAuthToken() { return "oauth-token"; } },
    MimeType: {
      PLAIN_TEXT: "text/plain",
      CSV: "text/csv",
      PDF: "application/pdf",
      GOOGLE_SLIDES: "application/vnd.google-apps.presentation"
    },
    UrlFetchApp: {
      fetch(url, opts) {
        urlCalls.push({ url: String(url), opts: opts || {} });
        if (/googleapis\.com\/drive|googleapis\.com\/upload\/drive/.test(String(url))) {
          throw new Error("Permission denied while enabling APIs: drive for GCP project 556488555124.");
        }
        if (/scite\.ai/.test(String(url))) {
          return {
            getResponseCode() { return 401; },
            getContentText() { return '{"error":"unauthorized"}'; }
          };
        }
        if (/generateContent|aiplatform\.googleapis/.test(String(url))) {
          return {
            getResponseCode() { return 200; },
            getContentText() {
              return JSON.stringify({
                candidates: [{
                  content: { parts: [{ text: JSON.stringify({
                    deck_title: "Demo",
                    slides: [
                      { type: "cover", title: "Demo", subtitle: "Test" },
                      { type: "cards", title: "Body", items: [{ title: "One", text: "A" }, { title: "Two", text: "B" }] },
                      { type: "closing", title: "Thank You" }
                    ]
                  }) }] },
                  groundingMetadata: { groundingChunks: [] }
                }]
              });
            }
          };
        }
        throw new Error("unexpected fetch: " + url);
      }
    },
    DriveApp: {
      getFileById(id) {
        driveCalls.push(["getFileById", id]);
        if (options.driveAppThrows) {
          throw new Error("Permission denied while enabling APIs: drive for GCP project 556488555124.");
        }
        return {
          getId() { return id; },
          getName() { return "Source Doc"; },
          getMimeType() { return options.sourceMime || "application/vnd.google-apps.document"; },
          getBlob() {
            return {
              getBytes() { return [1, 2, 3]; },
              getDataAsString() { return "plain text source"; }
            };
          },
          getAs(mime) {
            return {
              getDataAsString() { return "exported via DriveApp.getAs " + mime; },
              getBytes() { return [9, 9, 9]; }
            };
          },
          setTrashed() { driveCalls.push(["setTrashed", id]); }
        };
      },
      getFolderById(id) {
        driveCalls.push(["getFolderById", id]);
        if (options.driveAppThrows) {
          throw new Error("Permission denied while enabling APIs: drive for GCP project 556488555124.");
        }
        return {
          getId() { return id; },
          getFiles() {
            return { hasNext() { return false; }, next() { return null; } };
          },
          getFolders() {
            return { hasNext() { return false; }, next() { return null; } };
          },
          createFolder(name) {
            driveCalls.push(["createFolder", name, id]);
            return { getId() { return "new-folder"; } };
          },
          createFile(blob) {
            driveCalls.push(["createFile", blob && blob.getName && blob.getName()]);
            return { getId() { return "created-file"; } };
          }
        };
      },
      createFolder(name) {
        driveCalls.push(["createFolder", name]);
        return { getId() { return "new-folder"; } };
      },
      getRootFolder() {
        return {
          createFolder(name) {
            driveCalls.push(["rootCreateFolder", name]);
            return { getId() { return "new-folder"; } };
          },
          createFile(blob) {
            driveCalls.push(["rootCreateFile", blob && blob.getName && blob.getName()]);
            return { getId() { return "root-file"; } };
          }
        };
      }
    },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE",
        DIAMOND: "DIAMOND",
        CHEVRON: "CHEVRON",
        HOME_PLATE: "HOME_PLATE"
      },
      LineCategory: { STRAIGHT: "STRAIGHT" },
      PredefinedLayout: { BLANK: "BLANK" },
      ParagraphAlignment: { START: "START", CENTER: "CENTER", END: "END" },
      ContentAlignment: { TOP: "TOP", MIDDLE: "MIDDLE", BOTTOM: "BOTTOM" },
      PageElementType: { SHAPE: "SHAPE", GROUP: "GROUP", TABLE: "TABLE" },
      getActivePresentation() {
        return {
          getId() { return "active-id"; },
          getUrl() { return "https://docs.google.com/presentation/d/active-id/edit"; },
          getName() { return "Current deck"; },
          getPageWidth() { return 720; },
          getPageHeight() { return 405; },
          getSlides() { return slides; },
          appendSlide() {
            const slide = {
              getPageElements() { return []; },
              getBackground() { return { setSolidFill() {}, setPictureFill() {} }; },
              getNotesPage() {
                return { getSpeakerNotesShape() { return { getText() { return { setText() { return this; }, asString() { return ""; } }; } }; } };
              },
              insertShape() { return { getFill() { return { setSolidFill() {}, setTransparent() {} }; }, getBorder() { return { setTransparent() {}, setWeight() { return this; }, getLineFill() { return { setSolidFill() {} }; } }; }, getText() { throw new Error("no text"); } }; },
              insertTextBox() {
                return {
                  getText() {
                    return {
                      setText() { return this; },
                      getTextStyle() {
                        return {
                          setFontFamily() { return this; },
                          setFontFamilyAndWeight() { return this; },
                          setFontSize() { return this; },
                          setForegroundColor() { return this; },
                          setBold() { return this; }
                        };
                      },
                      getParagraphStyle() {
                        return {
                          setParagraphAlignment() { return this; },
                          setLineSpacing() { return this; },
                          setSpaceAbove() { return this; },
                          setSpaceBelow() { return this; }
                        };
                      },
                      getRange() {
                        return {
                          getTextStyle() {
                            return {
                              setFontFamily() { return this; },
                              setFontFamilyAndWeight() { return this; },
                              setFontSize() { return this; },
                              setForegroundColor() { return this; },
                              setBold() { return this; }
                            };
                          }
                        };
                      }
                    };
                  },
                  getAutofit() { return { disableAutofit() {} }; },
                  setContentAlignment() { return this; },
                  getBorder() { return { setTransparent() {} }; }
                };
              },
              insertLine() { return { setWeight() { return this; }, getLineFill() { return { setSolidFill() {} }; } }; },
              insertImage() { return {}; }
            };
            slides.push(slide);
            return slide;
          }
        };
      },
      create() { throw new Error("SlidesApp.create must not be used for default generation"); },
      openById() {
        return {
          getName() { return "x"; },
          getSlides() { return []; },
          getPageWidth() { return 720; },
          getPageHeight() { return 405; },
          saveAndClose() {}
        };
      }
    }
  };
  vm.createContext(sandbox);
  for (const rel of [
    "src/Brand.gs",
    "src/ShapeKit.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Code.gs"
  ]) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  sandbox.__driveCalls = driveCalls;
  sandbox.__urlCalls = urlCalls;
  return sandbox;
}

test("source tree has no Drive REST or Advanced Drive Files usage", () => {
  const files = [
    "src/Code.gs",
    "src/Brand.gs",
    "src/Reference.gs",
    "src/Rebrand.gs",
    "src/Engine.gs",
    "src/EngineRenderer.gs",
    "src/ShapeKit.gs"
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.doesNotMatch(src, /googleapis\.com\/drive\//);
    assert.doesNotMatch(src, /googleapis\.com\/upload\/drive\//);
    assert.doesNotMatch(src, /\bDrive\.Files\b/);
    assert.doesNotMatch(src, /serviceusage\.googleapis\.com/);
  }
});

test("readSourceDocument uses DriveApp.getAs and never hits drive.googleapis.com", () => {
  const sandbox = loadCreateStack({ vertex: true });
  const sources = { text: "", pdfs: [], images: [] };
  sandbox.readSourceDocument("https://docs.google.com/document/d/abc1234567890123456789012/edit", sources);
  assert.match(sources.text, /exported via DriveApp\.getAs|SOURCE DOCUMENT/);
  assert.equal(sandbox.__urlCalls.filter((c) => /drive/.test(c.url)).length, 0);
  assert.ok(sandbox.__driveCalls.some((c) => c[0] === "getFileById"));
});

test("getAssetIndex soft-fails when DriveApp throws enablement errors", () => {
  const sandbox = loadCreateStack({ driveAppThrows: true, vertex: true });
  const assets = sandbox.getAssetIndex(true);
  assert.ok(assets);
  assert.equal(typeof assets.icons, "object");
  assert.equal(sandbox.__urlCalls.filter((c) => /drive/.test(c.url)).length, 0);
});

test("Research path does not attempt Drive REST API enablement", () => {
  const sandbox = loadCreateStack({ vertex: true, geminiKey: "vertex" });
  // Force empty stores / no scite so Gemini research runs.
  const result = sandbox.generatePresentation({
    mode: "create",
    prompt: "3-slide overview of cloud modernization for leadership",
    slides: 3,
    runId: "test-research-drive"
  });
  assert.equal(sandbox.__urlCalls.filter((c) => /googleapis\.com\/(?:upload\/)?drive\//.test(c.url)).length, 0);
  assert.ok(result);
  assert.equal(result.presentationId, "active-id");
  assert.match(result.url, /active-id/);
});

test("trashDriveFile uses DriveApp and never UrlFetchApp Drive REST", () => {
  const sandbox = loadCreateStack({ vertex: true });
  sandbox.trashDriveFile("file-123");
  assert.ok(sandbox.__driveCalls.some((c) => c[0] === "setTrashed" && c[1] === "file-123"));
  assert.equal(sandbox.__urlCalls.length, 0);
});

test("isDriveApiEnablementError detects the Research-stage failure text", () => {
  const sandbox = loadCreateStack({ vertex: true });
  assert.equal(
    sandbox.isDriveApiEnablementError_("Permission denied while enabling APIs: drive for GCP project 556488555124."),
    true
  );
  assert.equal(sandbox.isDriveApiEnablementError_("Gemini is busy"), false);
  assert.match(
    sandbox.sanitizeDriveError_("Permission denied while enabling APIs: drive for GCP project 556488555124."),
    /Drive REST API was not used|unavailable/i
  );
});

test("ensureThumbFolder and uploadDriveFile use DriveApp only", () => {
  const sandbox = loadCreateStack({ vertex: true });
  const folderId = sandbox.ensureThumbFolder_();
  assert.equal(folderId, "new-folder");
  const blob = sandbox.Utilities.newBlob("{}", "application/json", "runtime.json");
  const id = sandbox.uploadDriveFile_(blob, "application/json", folderId, null);
  assert.equal(id, "created-file");
  assert.equal(sandbox.__urlCalls.filter((c) => /drive/.test(c.url)).length, 0);
});

test("Office upload conversion no longer calls Drive REST", () => {
  const sandbox = loadCreateStack({ vertex: true });
  const sources = { text: "", pdfs: [], images: [] };
  assert.throws(
    () => sandbox.readUploadedFile_({
      name: "brief.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: Buffer.from("fake").toString("base64")
    }, sources),
    /not converted via the Drive REST API|Google Docs/
  );
  assert.equal(sandbox.__urlCalls.filter((c) => /drive/.test(c.url)).length, 0);
});
