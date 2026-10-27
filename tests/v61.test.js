"use strict";

// V.1_61 (rebrand, deck 34): bullets of one kind share a size across the slide; KPIs are never the title; one card
// style per deck and white cards on grey cards; "RISK AREA" cased; subtitles keep their line count; the cover keeps
// its product picture.
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

test("version label is V.1_61 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[1-9]|[7-9]\d)'/);
});

test("slide 3: every bullet of the five role cards has the same size (kinds are found across the slide, not per card)", () => {
  const R = run();
  const sizes = ["Champions the vision", "Owns the rollout plan", "Manages communications calendar", "Leads early-adopter program",
    "Sets up connectors", "Drafts org-wide communications", "Surface critical use cases"].map((t) => style(byText(R, t)).fontSize.magnitude);
  assert.equal(new Set(sizes).size, 1, JSON.stringify(sizes));
  assert.ok(sizes[0] >= 7, "measured against the box itself, not 4 pt narrower: " + sizes[0]);
});

test("slide 14: a KPI in a card is never the title (WAU stays blue like ROI and CSAT)", () => {
  const R = run();
  assert.equal(color(R, byText(R, "WAU")), color(R, byText(R, "ROI")));
  assert.equal(style(byText(R, "Success metrics")).fontSize.magnitude, 20);
});

test("one card style on every slide; a card on a card is white (slides 8 and 14 inner panels stay visible)", () => {
  const R = run();
  const fillOf = (id) => R.sb.fillHex_(find(R, (e) => e.objectId === id).shape.shapeProperties.shapeBackgroundFill);
  ["e17", "e535", "e644"].forEach((id) => assert.equal(fillOf(id), "#F3F2F0", id));     // slides 2, 12, 14 cards
  assert.notEqual(fillOf("e358"), fillOf("e356"), "slide 8 option panel differs from its container");
  assert.notEqual(fillOf("e678"), fillOf("e674"), "slide 14 inner card differs from its container");
});

test("casing: short words in capitals are not acronyms, spacing is kept", () => {
  const R = run();
  assert.ok(byText(R, "Risk area"));
  assert.ok(byText(R, "Use case definition framework: Persona-to-task mapping  [EXAMPLE]"));
});

test("slide 5: the subtitle does not wrap to more lines than it had", () => {
  const R = run();
  assert.ok(style(byText(R, "Activates the technical setup")).fontSize.magnitude < 10);
});

test("the cover keeps its product picture, right of the title and above the badge", () => {
  const R = run();
  const pic = R.V.log.images.filter((m) => m.page === R.V.state.slides[0].objectId);
  assert.equal(pic.length, 1);
  assert.ok(pic[0].x >= 540 && pic[0].y + pic[0].h <= 310 && pic[0].x + pic[0].w <= 708, JSON.stringify(pic[0]));
});
