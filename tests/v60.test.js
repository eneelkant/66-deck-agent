"use strict";

// V.1_60 (rebrand, deck 30/33): transparent wrappers and theme colours read right; nothing added to the design; casing run
// by run with bullets, numbers, colons and product names kept; texts of one kind shrink together; the 66 mark takes the
// old mark's place and never covers the footer text.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));
const { virtualSlides } = require("./fixtures/virtual-slides.js");
const DECK = JSON.parse(read("tests/fixtures/rebrand-playbook.json"));

function rebrand(review) {
  const V = virtualSlides(DECK);
  const logs = [];
  const sb = { console, Math, JSON, Date, Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }), getUserProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 27, 2026", sleep() {}, newBlob: () => ({}), base64Encode: () => "", base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: { getFileById: () => ({ getBlob: () => ({}) }) }, UrlFetchApp: { fetch: () => { throw new Error("no net"); } },
    Slides: V.api.Slides, SlidesApp: V.api.SlidesApp };
  vm.createContext(sb);
  ORDER.forEach((f) => vm.runInContext(read("src/" + f), sb, { filename: f }));
  const drawn = [];
  Object.assign(sb, { callGeminiJSON: () => review, renderEngineSlide: (slide, spec, n, ctx, w, h, date) => drawn.push({ spec, date, sansOnly: !!ctx.sansOnly }),
    getBlobCached: () => ({}), progressStage_() {}, progressSlides_() {}, progressSlide_() {}, checkCancel_() {}, flushPresentation() {},
    validateDeckAgainstReference: () => [], cleanOldBrandLayouts_() {}, saveRotation_() {} });
  vm.runInContext("CONFIG.reviewWithGemini = true;", sb);
  const ctx = { log: [], apiKey: "k", brand: JSON.parse(JSON.stringify(sb.DEFAULT_BRAND)), assets: { design: { "ds-mark-dark": "M" }, icons: {}, logos: {}, patterns: {} }, lib: null, tokens: null };
  const stats = sb.rebrandPresentation("P", ctx, {});
  return { V, sb, ctx, stats, drawn, logs };
}
const REVIEW = { slides: [{ index: 0, slide_type: "cover", redraw: true, redraw_spec: { type: "cover", title: "Gemini Enterprise Onboarding and Adoption Playbook", subtitle: "For IT / Security Admins, Adoption Leads and Executive Sponsors" } }] };
const hex = (c) => c ? "#" + [c.red, c.green, c.blue].map((v) => ("0" + Math.round((v || 0) * 255).toString(16)).slice(-2)).join("").toUpperCase() : null;
const runOf = (R, start) => { const f = R.V.all().find((x) => R.V.textOf(x.e).startsWith(start)); if (!f) return null; return f.e.shape.text.textElements.find((t) => t.textRun && t.textRun.content.trim()).textRun.style; };
let R = null;
const run = () => R || (R = rebrand(REVIEW));
const find = (R, pred) => { let hit = null; const w = (els) => (els || []).forEach((e) => { if (pred(e)) hit = hit || e; if (e.elementGroup) w(e.elementGroup.children); }); R.V.state.slides.forEach((p) => w(p.pageElements)); return hit; };
const byText = (R, start) => find(R, (e) => (R.V.textOf(e) || "").startsWith(start));
const style = (e) => e.shape.text.textElements.find((t) => t.textRun && t.textRun.content.trim()).textRun.style;
const color = (R, e) => R.sb.colorHex_(style(e).foregroundColor && style(e).foregroundColor.opaqueColor);

test("version label is V.1_60 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6\d|[7-9]\d)'/);
});

test("transparent wrappers and theme colours: slide 6 text is readable, slide 2's dark card stays dark with white text", () => {
  const R = run();
  const s6 = byText(R, "View subscription details");
  assert.ok(s6, "slide 6 heading");
  assert.notEqual(color(R, s6), "#FFFDF9", "slide 6 heading must not be white on a light panel");
  const mid = byText(R, "Operational efficiency");
  assert.equal(color(R, mid), "#FFFDF9");
  const card = find(R, (e) => e.objectId === "e40");
  assert.ok(R.sb.luminance(R.sb.fillHex_(card.shape.shapeProperties.shapeBackgroundFill)) < 0.25, "middle card stays dark");
  assert.ok(!R.logs.concat(R.ctx.log).some((l) => /cannot be read/.test(l)), "the rebrand check finds no unreadable text");
});

test("design unchanged: no blue rule bars added, bullet dots kept, deck's icons kept", () => {
  const R = run();
  const added = R.V.log.requests.filter((r) => r.createShape).length;
  assert.equal(added, 0, "a rebrand adds no shapes");
  const dot = find(R, (e) => e.objectId === "e382");
  assert.ok(R.sb.fillHex_(dot.shape.shapeProperties.shapeBackgroundFill), "bullet dot keeps a visible fill");
  assert.equal(R.stats.icons, 0, "the deck's own icons are not swapped");
});

test("casing: bullets and numbers kept in front, word after a colon or dot separator capitalised, product names kept", () => {
  const R = run();
  ["1. Target persona", "Stage 1: Prerequisites", "Step 2: Value mapping process", "Adoption lead · Monthly", "SharePoint asset friction",
    "VPC Service Controls", "Access Transparency", "Success metrics & KPIs"].forEach((t) => assert.ok(byText(R, t), "missing: " + t));
  assert.ok(byText(R, "• View subscription details\n• Update seat quantities"));
  // sentence lines in a multi-line text stay as written; the label and heading lines above them are cased
  assert.ok(byText(R, "Week 4\nTelemetry review\nIT/Admin Lead evaluates"));
});

test("case fixes are made run by run: TOTAL SCORE keeps its big number", () => {
  const R = run();
  const e = byText(R, "Total score");
  const runs = e.shape.text.textElements.filter((t) => t.textRun && t.textRun.content.trim());
  const big = runs.find((t) => /12/.test(t.textRun.content));
  assert.ok(big.textRun.style.fontSize.magnitude > runs[0].textRun.style.fontSize.magnitude, "12 stays larger than the label");
});

test("texts of the same kind shrink together; the rebrand check finds no overlaps", () => {
  const R = run();
  const a = style(byText(R, "Self-Volunteered Champions")).fontSize.magnitude;
  const b = style(byText(R, "Manager Nominations")).fontSize.magnitude;
  assert.equal(a, b);
  assert.ok(R.ctx.log.some((l) => /no overlapping or unreadable text/.test(l)), R.ctx.log.join("\n"));
});

test("the 66 mark takes the old mark's place on every slide and never covers footer text", () => {
  const R = run();
  const marks = R.V.log.images.filter((m) => m.page !== R.V.state.slides[0].objectId);   // the cover keeps its picture (V.1_61)
  assert.ok(marks.length >= 10);
  marks.forEach((m) => {
    assert.ok(Math.abs(m.x - 18) < 1 && m.w < 22, "mark at the old mark's place: " + JSON.stringify(m));
    const page = R.V.state.slides.find((p) => p.objectId === m.page);
    const w = (els) => (els || []).forEach((e) => {
      const t = R.V.textOf(e); if (e.elementGroup) return w(e.elementGroup.children);
      if (!t) return; const bb = R.sb.elementBounds(e);
      if (bb.y + bb.h > m.y && bb.y < m.y + m.h) assert.ok(bb.x >= m.x + m.w || bb.x + bb.w <= m.x, "footer text under the mark: " + t);
    });
    R.sb.indexAbsolute_(page.pageElements, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, false);
    w(page.pageElements);
  });
});

test("with no old mark in the deck, footer text that touches the new mark moves right", () => {
  const V = virtualSlides(DECK);
  const sb = { Logger: { log() {} } };
  vm.createContext(sb);
  vm.runInContext(read("src/Rebrand.gs").match(/function clearFooterText_[\s\S]*?\n}\n/)[0], sb);
  const page = V.api.SlidesApp.openById("P").getSlides()[7];
  sb.clearFooterText_(page, { x: 22.3, y: 376.8, w: 24.3, h: 16.2 }, 405);
  const ft = V.state.slides[7].pageElements.find((e) => e.objectId === "e414");
  assert.ok(ft.transform.translateX / 12700 >= 22.3 + 24.3 + 5 - 0.01);
});
