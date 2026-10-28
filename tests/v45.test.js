"use strict";

// V.1_45: review of deck 19 (Marriott proposal). The photo strip is a picture exactly the size of the strip (selecting
// it no longer selects the whole slide); every content slide has a title; words never break in the middle; hub captions
// never overlap; risks never on a pyramid or a stack of layers; small website icons still count as a logo.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DESIGN_FILES = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort();

function mock(log, name) {
  const fn = function () {};
  return new Proxy(fn, { get(t, prop) {
    if (prop === Symbol.toPrimitive) return () => "";
    if (prop === "length") return 0;
    if (prop === "then") return undefined;
    return (...args) => { log.push([name + "." + String(prop)].concat(args)); return mock(log, name + "." + String(prop)); };
  } });
}
function load(extra) {
  const sandbox = Object.assign({ PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "STOCK_IMAGES_FOLDER_ID" ? "off" : null) }) }, console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Session: { getScriptTimeZone: () => "UTC" },
    Utilities: { newBlob: (b, t, n) => ({ blob: n, type: t }), base64Decode: () => [], formatDate: () => "x" },
    SlidesApp: { ParagraphAlignment: {}, ContentAlignment: {}, ShapeType: { RECTANGLE: "RECTANGLE", ELLIPSE: "ELLIPSE" }, LineCategory: {}, ArrowStyle: {}, DashStyle: {} } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs"].concat(DESIGN_FILES.map((f) => "src/" + f)).concat(["src/EngineRenderer.gs", "src/PhotoStrips.gs", "src/StockImages.gs", "src/Reference.gs", "src/ProposalKit.gs", "src/Code.gs"])
    .forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  sandbox.getBlobCached = (id) => ({ blob: "drive:" + id });
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
function drawn(g, spec) {
  const log = [];
  const ctx = { brand: { fonts: { heading: { slides: "Plus Jakarta Sans" }, mono: { slides: "IBM Plex Mono" } } },
    assets: { design: { "ds-section-bg": "SECTION_BG" }, logos: {}, patterns: {}, icons: {} }, tokens: null, slideIcons: {} };
  try { g.renderEngineSlide(mock(log, "slide"), spec, 1, ctx, 720, 405, "x"); } catch (e) {}
  return log;
}
const firstImage = (log) => {
  const i = log.find((c) => c[0] === "slide.insertImage");
  if (!i) return null;
  const at = (m) => (log.find((c) => c[0].startsWith("slide.insertImage") && c[0].endsWith("." + m)) || [])[1];
  return [i[0], i[1], at("setLeft"), at("setTop"), at("setWidth"), at("setHeight")];
};

// V.1_67 (deck 39): the streak picture is for transition slides only. A strip on a content slide gets a stock photo; with
// no stock photo it stays the design's solid Night Blue - never the streak picture, cut or whole
test("photo strip: never the streak picture on a content slide (no stock photo: the strip stays Night Blue)", () => {
  const g = load();
  const log = drawn(g, { type: "cards", deckLibrary: "proposal", title: "Understanding Marriott's needs", reference: { tag: "P66_COLUMNS_PHOTO" },
    items: [1, 2, 3, 4].map((i) => ({ title: "Need " + i, icon: "data", points: ["Create one profile of each guest", "Serve every guest the same way"] })) });
  const img = firstImage(log);
  assert.ok(!img || !/streak|SECTION_BG/.test(String(img[1].blob)), "no streak picture: " + (img && img[1].blob));
});

test("full-slide photo designs (dark dividers) keep the full photo", () => {
  const g = load();
  const img = firstImage(drawn(g, { type: "section", deckLibrary: "proposal", title: "Our approach", number: "02", reference: { tag: "P66_SECTION_DARK" } }));
  assert.equal(img[1].blob, "drive:SECTION_BG");
  assert.deepEqual(img.slice(2, 6), [0, 0, 720, 405]);
});

test("visible region: panels that run edge to edge leave the strip, band or panel; crops exist for every case", () => {
  const g = load();
  const W = 720, H = 405, R = (els) => Array.from(g.photoRegion_(els, W, H));
  assert.deepEqual(R([{ t: "rect", x: 0, y: 0, w: 600, h: 405, fill: "#FFFDF9" }]), [600, 0, 720, 405]);
  assert.deepEqual(R([{ t: "rect", x: 196, y: 0, w: 524, h: 405, fill: "#FFFDF9" }]), [0, 0, 196, 405]);
  assert.deepEqual(R([{ t: "rect", x: 0, y: 92, w: 720, h: 313, fill: "#FFFDF9" }]), [0, 0, 720, 92]);
  assert.deepEqual(R([{ t: "rect", x: 100, y: 100, w: 200, h: 100, fill: "#FFFDF9" }]), [0, 0, 720, 405], "a card is not a panel");
  [[600, 0, 720, 405], [480, 0, 720, 405], [0, 0, 196, 405], [0, 0, 720, 104], [0, 300, 720, 405]].forEach((r) => assert.ok(g.streakCropBlob_(r, W, H), r.join(",")));
  assert.equal(g.streakCropBlob_([0, 0, 720, 405], W, H), null);
  assert.equal(g.streakCropBlob_([300, 0, 720, 405], W, H), null, "a strip wider than any cut keeps the full photo");
  assert.ok(JSON.parse(read(".clasp.json")).filePushOrder.indexOf("PhotoStrips.gs") > JSON.parse(read(".clasp.json")).filePushOrder.indexOf("EngineRenderer.gs"));
});

test("every content slide has a title: Gemini writes the missing ones, else the lead is shortened", () => {
  let asked = null;
  const g = load({ callGeminiJSON: (parts) => { asked = parts[0].text; return { titles: [{ id: 0, title: "Guests expect personalised service." }] }; } });
  const slides = [{ type: "cover", title: "x" },
    { type: "cards", title: "", lead: "Guest expectations for personalized service are rapidly increasing across the hospitality sector.", items: [{ title: "Rising expectations" }] },
    { type: "process", lead: "Our methodology focuses on building a robust data foundation and activating AI to deliver hyper-personalized guest experiences." },
    { type: "section", title: "" }];
  g.ensureTitles_(slides.slice(0, 2), { log: [] });
  assert.equal(slides[1].title, "Guests expect personalised service");
  assert.match(asked, /no title/);
  const g2 = load({ callGeminiJSON: () => { throw new Error("offline"); } });
  g2.ensureTitles_(slides, { log: [] });
  assert.ok(slides[2].title && slides[2].title.length <= 58, slides[2].title);
  assert.ok(/^Our methodology focuses on building/.test(slides[2].title), slides[2].title);
  assert.equal(slides[3].title, "", "dividers and frame slides are left alone");
  const code = read("src/Code.gs");
  assert.ok(/Every body slide has a "title"/.test(code));
});

test("a long word never breaks in the middle: a smaller size, or a break after the hyphen, or the fit step shortens it", () => {
  const g = load();
  const K = g.ENGINE.kit;
  const els = [];
  K.text(els, 0, 0, 113, 40, "Hyper-personalized engagement", { weight: 500, max: 11, min: 10, maxLines: 3 });
  const t = els.find((e) => e.t === "text");
  const lines = g.ENGINE.wrap(t.text, 113, "sans", 500, t.size);
  assert.ok(!lines.some((l) => /^d\b/.test(l)) && !lines.some((l) => /personalize$/.test(l)), lines.join(" | "));
  const f = g.ENGINE.fit("Supercalifragilisticexpialidocious", 40, 14, { weight: 500, max: 11, min: 10, maxLines: 1 });
  assert.equal(f.truncated, true, "flagged for the fit step");
  assert.ok(!/\n/.test(f.text), "never split into pieces on two lines: " + f.text);
});

test("hub: captions that would run into each other give another design", () => {
  const g = load();
  const long = "Integration with property management systems and staff tools to empower hotel teams with guest insights at every stay.";
  const s = { type: "diagram", deckLibrary: "proposal", title: "Guest data platform architecture", center: "Guest data platform", reference: { tag: "P66_HUB" },
    items: ["Hotel operations", "BigQuery", "Sensitive Data Protection", "Gemini", "Looker Studio", "Loyalty app"].map((t) => ({ title: t, text: long })) };
  assert.equal(g.ENGINE.canDraw(s), false);
  assert.equal(g.ENGINE.canDraw(Object.assign({}, s, { items: s.items.map((it) => ({ title: it.title, text: "Short line." })) })), true);
});

test("risks never on a pyramid or a stack of layers, even when Gemini picks it", () => {
  const g = load();
  const risks = { type: "diagram", deckLibrary: "proposal", design: "P66_ISO_CALLOUTS", title: "Key risks and mitigation strategies",
    items: [{ title: "Data", text: "a" }, { title: "Adoption", text: "b" }, { title: "Privacy", text: "c" }] };
  const tags = g.drawableDesigns_("diagram", 3, risks).map((d) => d.tag);
  assert.ok(!tags.includes("P66_ISO_CALLOUTS") && !tags.includes("P66_PYRAMID"));
  assert.ok(g.drawableDesigns_("diagram", 3, Object.assign({}, risks, { title: "A layered data platform" })).some((d) => d.tag === "P66_ISO_CALLOUTS"));
  assert.ok(/Risks are ONE slide/.test(read("src/Code.gs")) && /Team and governance are ONE slide/.test(read("src/Code.gs")));
});

test("client logo: a 32 px website icon is still used when nothing better is found", () => {
  const png = (w, bytes) => { const b = new Array(bytes).fill(0); [0x89, 0x50, 0x4e, 0x47].forEach((v, i) => (b[i] = v)); b[19] = w & 255; b[18] = (w >> 8) & 255; return b; };
  let resp = null;
  const g = load({ UrlFetchApp: { fetch: () => resp } });
  resp = { getResponseCode: () => 200, getBlob: () => ({ getContentType: () => "image/png", getBytes: () => png(32, 600) }) };
  assert.ok(g.fetchImage_("https://x/i.png", 2500, "Website icon"));
});

test("version label is V.1_45 or later", () => {
  assert.ok(/AGENT_VERSION_ = '66° Deck Agent V\.1_(4[5-9]|[5-9][0-9])'/.test(read("src/Code.gs")));
});
