"use strict";

// V.1_49: Proposal Deck photo strips use the "Stock Images" folder (1DVsF7jnyWonnKW7z6GlUgDUvR8UA68_T) instead of
// "Stock Images Testing"; a Script property still pointing at the testing folder is moved to the new one; Adobe Stock
// names ("AdobeStock_124720034.jpeg") are matched by their Drive descriptions.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const NEW = "1DVsF7jnyWonnKW7z6GlUgDUvR8UA68_T", OLD = "1hlpJeCwfLMNTfYjw97vJjj-Ug5se4rIL";
// a few of the real files in the folder (name, Drive description, shape)
const FILES = [
  { id: "A1", name: "AdobeStock_690547511.jpeg", desc: "Vector Abstract, science, futuristic, energy technology concept. Digital image of light rays, stripes lines with blue light", w: 4000, h: 2250 },
  { id: "A2", name: "AdobeStock_381681511.jpeg", desc: "Business team collaboration discussing working analyzing with financial data and marketing growth report graph", w: 6000, h: 4000 },
  { id: "A3", name: "AdobeStock_822408091.jpeg", desc: "Abstract business futuristic background with glowing lines. Data technology hyper realistic --ar 3:4 Job ID: 05e6", w: 3000, h: 4000 },
  { id: "A4", name: "AdobeStock_124720034.jpeg", desc: "808671", w: 5000, h: 3333 }
];
function jpeg(w, h) {
  const b = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255];
  while (b.length < 3000) b.push(0);
  return b;
}
function load(prop) {
  const opened = [];
  const sb = { console, Logger: { log() {} }, Math: Object.create(Math), JSON, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "STOCK_IMAGES_FOLDER_ID" ? (prop || null) : null) }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    ScriptApp: { getOAuthToken: () => "t" },
    DriveApp: { getFolderById: (id) => { opened.push(id); if (id !== NEW) throw new Error("no folder"); let i = 0;
      return { getFiles: () => ({ hasNext: () => i < FILES.length, next: () => { const f = FILES[i++];
        return { getId: () => f.id, getName: () => f.name, getDescription: () => f.desc, getSize: () => 5e6, getMimeType: () => "image/jpeg" }; } }) }; } },
    UrlFetchApp: { fetch: (url) => { const id = /id=([^&]+)/.exec(url)[1], f = FILES.find((x) => x.id === id);
      return { getResponseCode: () => 200, getBlob: () => ({ id, getContentType: () => "image/jpeg", getBytes: () => jpeg(f.w, f.h) }) }; } } };
  sb.Math.random = () => 0.5;
  vm.createContext(sb);
  vm.runInContext(read("src/StockImages.gs"), sb, { filename: "StockImages.gs" });
  sb.opened = opened;
  return sb;
}

test("the Stock Images folder is the default; the testing folder is no longer read", () => {
  const g = load();
  assert.equal(g.stockImagesFolderId_(), NEW);
  assert.equal(g.stockImagesList_({ log: [] }).length, 4);
  assert.deepEqual(g.opened, [NEW]);
  assert.doesNotMatch(read("src/StockImages.gs"), new RegExp("STOCK_IMAGES_DEFAULT_FOLDER_ = '" + OLD));
});

test("a Script property still set to the testing folder uses the new folder; another folder or 'off' is respected", () => {
  assert.equal(load(OLD).stockImagesFolderId_(), NEW);
  assert.equal(load("someOtherFolder").stockImagesFolderId_(), "someOtherFolder");
  assert.equal(load("off").stockImagesFolderId_(), "");
});

test("Adobe Stock names say nothing: descriptions pick the image; numbers and 'AdobeStock' are not words", () => {
  const g = load();
  assert.deepEqual(Array.from(g.stockWords_("AdobeStock_124720034.jpeg")), []);
  const img = g.pickStockImage_([0, 0, 720, 120], { title: "Financial data and growth reporting" }, { log: [] });
  assert.equal(img.id, "A2");
  const tall = g.pickStockImage_([560, 0, 720, 405], { title: "Data platform" }, { log: [] });
  assert.equal(tall.id, "A3", "a tall abstract data image for a tall strip");
});
