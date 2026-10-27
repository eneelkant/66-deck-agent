"use strict";
// V.1_64: the whole add-on in one sandbox (Slides, Drive and Gemini not reachable), for replaying logged slides
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");
function loadAddon(seed) {
  let sd = seed || 7;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const sb = { console, Math: M, JSON, Date, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }), getUserProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 27, 2026", sleep() {}, newBlob: () => ({}), base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: {}, UrlFetchApp: { fetch: () => { throw new Error("no net"); } }, SlidesApp: {} };
  vm.createContext(sb);
  const order = JSON.parse(fs.readFileSync(path.join(ROOT, ".clasp.json"), "utf8")).filePushOrder.filter((f) => /\.gs$/.test(f));
  order.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "src", f), "utf8"), sb, { filename: f }));
  return sb;
}
// A logged slide drawn again with the current code: its design and what the deck check finds
function replay(sb, spec) {
  const out = sb.ENGINE.render({ slides: [spec] }, { dateLabel: "x" })[0];
  return { design: out.drawnWith || "", issues: ((out.qa && out.qa.issues) || []).slice(), fixed: ((out.qa && out.qa.fixed) || []).slice(), out };
}
module.exports = { loadAddon, replay, ROOT };
