"use strict";

// V.1_46: photo strips show stock images from the brand folder (about 95 in 100) instead of the streak pattern, chosen
// by shape and words, cropped to fill the strip exactly on a pale slide; pillars cards stop before the strip.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DESIGN_FILES = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort();

function jpeg(w, h) {      // smallest JPEG header the size reader understands (SOF0 with width and height)
  const b = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255];
  while (b.length < 3000) b.push(0);
  return b;
}
const FILES = [
  { id: "P1", name: "portrait-person-ai-robot.jpg", w: 2000, h: 3000 },
  { id: "L1", name: "technology-concept-with-futuristic-element.jpg", w: 4000, h: 2250 },
  { id: "L2", name: "human-robot-hand-touching-futuristic-ai-concept.jpg", w: 6000, h: 4000 }
];
function mock(log, name) {
  const fn = function () {};
  return new Proxy(fn, { get(t, prop) {
    if (prop === Symbol.toPrimitive) return () => "";
    if (prop === "length") return 0;
    if (prop === "then") return undefined;
    return (...args) => { log.push([name + "." + String(prop)].concat(args)); return mock(log, name + "." + String(prop)); };
  } });
}
function load(opts) {
  opts = opts || {};
  const files = opts.files || FILES;
  const fetched = [];
  const sandbox = { console, Logger: { log() {} }, Math: Object.create(Math), JSON, Date, CONFIG: { iconOrder: ["material"] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "STOCK_IMAGES_FOLDER_ID" ? (opts.folder || null) : null) }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    ScriptApp: { getOAuthToken: () => "t" },
    DriveApp: {
      getFolderById: (id) => { if (id !== "1hlpJeCwfLMNTfYjw97vJjj-Ug5se4rIL") throw new Error("no folder"); let i = 0;
        return { getFiles: () => ({ hasNext: () => i < files.length, next: () => { const f = files[i++];
          return { getId: () => f.id, getName: () => f.name, getDescription: () => f.desc || "", getSize: () => 5e6, getMimeType: () => "image/jpeg" }; } }) }; },
      getFileById: () => { throw new Error("not used"); }
    },
    UrlFetchApp: { fetch: (url) => { fetched.push(url); const id = /id=([^&]+)/.exec(url)[1], f = files.find((x) => x.id === id);
      return { getResponseCode: () => 200, getBlob: () => ({ id, getContentType: () => "image/jpeg", getBytes: () => jpeg(f.w, f.h) }) }; } },
    Utilities: { newBlob: (b, t, n) => ({ blob: n, type: t }), base64Decode: () => [] },
    SlidesApp: { ParagraphAlignment: {}, ContentAlignment: {}, ShapeType: { RECTANGLE: "RECTANGLE", ELLIPSE: "ELLIPSE" }, LineCategory: {}, ArrowStyle: {}, DashStyle: {} } };
  sandbox.Math.random = opts.random || (() => 0.5);
  vm.createContext(sandbox);
  ["src/Engine.gs"].concat(DESIGN_FILES.map((f) => "src/" + f)).concat(["src/EngineRenderer.gs", "src/PhotoStrips.gs", "src/StockImages.gs", "src/ProposalKit.gs"])
    .forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  sandbox.getBlobCached = (id) => ({ blob: "drive:" + id });
  sandbox.fetched = fetched;
  return sandbox;
}

test("push order: stock images after the photo strips", () => {
  const o = JSON.parse(read(".clasp.json")).filePushOrder;
  assert.ok(o.indexOf("StockImages.gs") > o.indexOf("PhotoStrips.gs") && o.indexOf("StockImages.gs") < o.indexOf("Code.gs"));
});

test("a tall strip gets a tall image, a wide band a wide image; images are not repeated in a deck", () => {
  const g = load();
  const ctx = { log: [] };
  const strip = g.pickStockImage_([560, 0, 720, 405], { title: "Guest data platform" }, ctx);
  assert.equal(strip.id, "P1");
  const band = g.pickStockImage_([0, 0, 720, 100], { title: "Options" }, ctx);
  assert.ok(band.id === "L1" || band.id === "L2");
  const next = g.pickStockImage_([0, 0, 720, 100], { title: "Options" }, ctx);
  assert.notEqual(next.id, band.id, "the other wide image first");
  assert.ok(g.fetched.every((u) => /^https:\/\/drive\.google\.com\/thumbnail\?id=/.test(u)), "resized copies, never the 15 MB originals");
});

test("the slide's words pick the image (robot hand for a human + AI slide)", () => {
  const g = load();
  const img = g.pickStockImage_([0, 0, 720, 100], { title: "Humans and AI agents work hand in hand" }, { log: [] });
  assert.equal(img.id, "L2");
});

test("about 5 strips in 100 keep the streak pattern; no folder or folder off -> pattern", () => {
  assert.equal(load({ random: () => 0.97 }).pickStockImage_([560, 0, 720, 405], { title: "x" }, { log: [] }), null);
  assert.equal(load({ folder: "off" }).pickStockImage_([560, 0, 720, 405], { title: "x" }, { log: [] }), null);
  assert.equal(load({ files: [] }).pickStockImage_([560, 0, 720, 405], { title: "x" }, { log: [] }), null);
});

function drawn(g, spec) {
  const log = [];
  const ctx = { log: [], brand: { fonts: { heading: { slides: "Plus Jakarta Sans" }, mono: { slides: "IBM Plex Mono" } } },
    assets: { design: { "ds-section-bg": "SECTION_BG" }, logos: {}, patterns: {}, icons: {} }, tokens: null, slideIcons: {} };
  try { g.renderEngineSlide(mock(log, "slide"), spec, 1, ctx, 720, 405, "x"); } catch (e) {}
  return log;
}
const at = (log, m) => (log.find((c) => c[0].startsWith("slide.insertImage") && c[0].endsWith("." + m)) || [])[1];

test("strip slide: the stock image fills the strip exactly (cropped, not stretched) on a pale slide", () => {
  const g = load();
  const spec = { type: "comparison", deckLibrary: "proposal", title: "Agentic AI: the next evolution in hospitality", reference: { tag: "P66_TWO_PANELS" },
    left: { label: "Traditional AI", title: "Reactive", points: ["Responds to triggers", "Needs explicit rules", "Works in silos"] },
    right: { label: "Agentic AI", title: "Proactive", points: ["Understands intent", "Adapts and learns", "Orchestrates systems"] } };
  const log = drawn(g, spec);
  const img = log.find((c) => c[0] === "slide.insertImage");
  assert.equal(img[1].id, "P1", "a stock image");
  const L = at(log, "setLeft"), Wd = at(log, "setWidth");
  assert.equal(L + Wd, 720);
  assert.deepEqual([at(log, "setTop"), at(log, "setHeight")], [0, 405], "full height of the strip: no dark bands");
  const rep = log.find((c) => c[0] === "slide.insertImage.replace");
  assert.ok(rep && rep[2] === true, "replaced with crop = true (fills at its own proportions)");
  const bg = log.find((c) => c[0] === "slide.getBackground.setSolidFill");
  assert.equal(bg[1], g.ENGINE.TOKENS.white, "pale slide, no black behind the strip");
});

test("pillars: the cards end before the photo strip", () => {
  const g = load();
  const it = ["Increased guest loyalty", "Optimized operations", "Revenue growth"].map((t) => ({ title: t, text: "Targeted offers and dynamic pricing powered by AI raise occupancy and revenue.", points: ["BigQuery", "Gemini"] }));
  const out = g.ENGINE.render({ slides: [{ type: "cards", deckLibrary: "proposal", title: "Impact of AI in hospitality", items: it, reference: { tag: "P66_PILLARS" } }] }, { dateLabel: "x" })[0];
  const strip = g.photoRegion_(out.els, 720, 405)[0];
  const right = Math.max(...out.els.filter((e) => e.y > 60 && e.t === "rect" && e.x > 1).map((e) => e.x + e.w));
  assert.ok(right <= strip - 8, "cards end at " + right + ", strip starts at " + strip);
});

test("version label is V.1_46 or later", () => {
  assert.ok(/AGENT_VERSION_ = '66° Deck Agent V\.1_(4[6-9]|[5-9][0-9])'/.test(read("src/Code.gs")));
});
