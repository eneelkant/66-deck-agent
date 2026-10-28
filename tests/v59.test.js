"use strict";

// V.1_59 (rebrand of the Gemini Enterprise playbook deck) - shapes inside groups are measured where they really are on the
// slide (the subtitle is never a card's label, nothing in a group is moved with slide positions); dark panels stay
// dark with white text (option A); Plus Jakarta Sans only; texts that no longer fit in the brand font are set a little
// smaller; titles and headings in sentence case with the deck's names kept; one 66 mark, footer text clear of it; one
// background; the cover keeps its date and the slide's own words; a rebrand check reports overlapping or unreadable text.
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

test("version label is V.1_59 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(59|[6-9]\d)'/);
});

test("nothing inside a group is moved with slide positions; a card's label is never taken for the subtitle", () => {
  const R = run();
  const inGroup = new Set();
  const walk = (els, g) => (els || []).forEach((e) => { if (g) inGroup.add(e.objectId); if (e.elementGroup) walk(e.elementGroup.children, true); });
  DECK.slides.forEach((p) => walk(p.pageElements, false));
  const moves = R.V.log.requests.filter((r) => r.updatePageElementTransform);
  assert.equal(moves.filter((r) => inGroup.has(r.updatePageElementTransform.objectId)).length, 0);
  // the labels the old rebrand pulled up over the subtitle stay where they were
  ["Tactical efficiency", "Phase 0 goal", "Stage 1: prerequisites", "WAU", "03"].forEach((t) => {
    const before = DECK.slides.map((p) => p).length && R.V.all().find((x) => R.V.textOf(x.e).replace(/\s+/g, " ").toLowerCase() === t.toLowerCase());
    assert.ok(before, t + " is still on its slide");
    assert.ok(!moves.some((r) => r.updatePageElementTransform.objectId === before.e.objectId), t + " was not moved");
  });
});

test("option A: text on dark panels and bars is white, dark panels stay dark, Plus Jakarta Sans only", () => {
  const R = run();
  ["Phase 0 goal", "Excite the organization", "Exit criteria", "Lifecycle operations", "Gemini Enterprise MVP", "Transformation roadmap", "Optimization loops", "Formal Legal"].forEach((t) => {
    const st = runOf(R, t);
    assert.ok(st, t);
    assert.equal(hex(st.foregroundColor.opaqueColor.rgbColor), "#FFFDF9", t + " is white");
  });
  const fonts = new Set();
  R.V.all().forEach(({ e }) => ((e.shape && e.shape.text && e.shape.text.textElements) || []).forEach((t) => { if (t.textRun && t.textRun.content.trim()) fonts.add(t.textRun.style.fontFamily); }));
  assert.deepEqual([...fonts], ["Plus Jakarta Sans"]);
  assert.ok(R.drawn.every((d) => d.sansOnly), "engine-drawn slides of a rebrand use Plus Jakarta Sans too");
  assert.match(read("src/EngineRenderer.gs"), /mono = sans;/);   // V.1_67: Plus Jakarta Sans only, in every deck
});

test("texts that no longer fit in Plus Jakarta Sans are set smaller; the rebrand check finds no new overlaps", () => {
  const R = run();
  assert.ok(R.stats.shrunk >= 5, "shrunk " + R.stats.shrunk);
  const before = (() => { const V = virtualSlides(DECK); R.sb.Slides = V.api.Slides; return R.sb.rebrandQa_("P", 0, 14); })();
  const after = R.ctx.log.find((l) => /^Rebrand check/.test(l));
  const overlapsBefore = before.filter((x) => /runs into/.test(x)).length;
  const overlapsAfter = (after.match(/runs into/g) || []).length;
  assert.ok(overlapsAfter <= overlapsBefore, "overlaps " + overlapsBefore + " -> " + overlapsAfter + " | " + after);
  assert.doesNotMatch(after, /slide 3: "Manages communications/);
  assert.doesNotMatch(after, /cannot be read/);
});

test("titles and headings in sentence case; the deck's names and acronyms keep their capitals", () => {
  const R = run();
  const texts = R.V.all().map(({ e }) => R.V.textOf(e)).filter(Boolean);
  ["Core adoption team structure", "Phase 1: Data integration & safety controls", "Compliance & data risk checkpoint", "Phase 1B: Adoption team & MVP validation", "Success metrics & KPIs", "Individual productivity"].forEach((t) => assert.ok(texts.includes(t), t + " | " + texts.filter((x) => x.length < 60).slice(0, 12).join(" / ")));
  assert.ok(texts.some((t) => /Model Armor/.test(t)) && texts.some((t) => /Gemini Enterprise/.test(t)));
  assert.equal(R.sb.fixAllCaps("ROLE 01"), "Role 01");
  assert.equal(R.sb.fixAllCaps("CRITERION"), "Criterion");
  assert.equal(R.sb.fixAllCaps("WAU"), "WAU");
});

test("one 66 mark per slide (the deck's old marks go) and footer text clear of it; one background", () => {
  const R = run();
  const marks = R.V.log.images.filter((m) => m.page !== R.V.state.slides[0].objectId).length;   // (V.1_61: the cover keeps its picture)
  assert.equal(marks, 13, "one mark on each content slide");
  const oldMarks = R.V.all().filter(({ e }) => e.image && !/^img/.test(e.objectId));
  const bottomLeft = oldMarks.filter(({ e }) => (e.transform.translateY || 0) / 12700 > 340 && (e.transform.translateX || 0) / 12700 < 80);
  assert.equal(bottomLeft.length, 0, "no old footer mark left");
  const bgs = new Set(R.V.state.slides.slice(1).map((p) => JSON.stringify(p.pageProperties)));
  assert.equal(bgs.size, 1);
});

test("the cover keeps its date and its own words (the reviewer's retyped title and subtitle are put back)", () => {
  const R = run();
  const cover = R.drawn[0];
  assert.equal(cover.date, "September 2026");
  assert.equal(cover.spec.title, "Gemini Enterprise Onboarding & Adoption Playbook");
  assert.equal(cover.spec.subtitle, "For IT / Security Admins, Adoption Leads, and Executive Sponsors");
  assert.equal(R.sb.originalDate_({ texts: [{ text: "No date here" }] }), "");
  assert.match(read("src/Engine.gs"), /if \(ctx\.dateLabel\) text\(els, 29\.5, 368/);
  assert.match(read("src/Rebrand.gs"), /copied EXACTLY as the slide shows it/);
});
