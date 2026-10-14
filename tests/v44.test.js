"use strict";

// V.1_44: the photo behind dark / photo designs (dark streaks, navy) is a normal picture at the back of the slide,
// not the slide background, so it can be selected, replaced or deleted in Google Slides. General and Proposal Decks.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DESIGN_FILES = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort();

// Any Slides object: every method returns another mock, so the renderer can draw without a real presentation
function mock(log, name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      return (...args) => { log.push([name + "." + String(prop)].concat(args)); return mock(log, name + "." + String(prop)); };
    }
  });
}

function load() {
  const sandbox = { console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"] },
    Utilities: { newBlob: (b, t, n) => ({ blob: n }), base64Decode: () => [] },
    SlidesApp: { ParagraphAlignment: {}, ContentAlignment: {}, ShapeType: { RECTANGLE: "RECTANGLE", ELLIPSE: "ELLIPSE" }, LineCategory: {}, ArrowStyle: {}, DashStyle: {} } };
  vm.createContext(sandbox);
  ["src/Engine.gs"].concat(DESIGN_FILES.map((f) => "src/" + f)).concat(["src/EngineRenderer.gs", "src/ProposalKit.gs"])
    .forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  sandbox.getBlobCached = (id) => ({ blob: "drive:" + id });
  return sandbox;
}

function drawn(g, spec, assets) {
  const log = [];
  const slide = mock(log, "slide");
  const ctx = { brand: { fonts: { heading: { slides: "Plus Jakarta Sans" }, mono: { slides: "IBM Plex Mono" } } },
    assets: { design: assets || {}, logos: {}, patterns: {}, icons: {} }, tokens: null, slideIcons: {} };
  try { g.renderEngineSlide(slide, spec, 1, ctx, 720, 405, "x"); } catch (e) { /* drawing details are not under test */ }
  return log;
}

test("navy divider: the navy photo is a picture at the back (selectable), not the slide background", () => {
  const g = load();
  const log = drawn(g, { type: "section", deckLibrary: "proposal", title: "Our approach", points: ["One", "Two"], reference: { tag: "P66_SECTION_NAVY" } });
  assert.ok(!log.some((c) => /setPictureFill/.test(c[0])), "no picture background");
  assert.ok(log.some((c) => c[0] === "slide.getBackground.setSolidFill"), "solid colour background underneath");
  const firstImage = log.findIndex((c) => c[0] === "slide.insertImage");
  assert.ok(firstImage !== -1);
  const call = log[firstImage];
  assert.equal(call[1].blob, "navy-bg.jpg");
  const at = (m) => (log.find((c) => c[0].startsWith("slide.insertImage") && c[0].endsWith("." + m)) || [])[1];
  assert.deepEqual([at("setLeft"), at("setTop"), at("setWidth"), at("setHeight")], [0, 0, 720, 405], "covers the whole slide");
  assert.ok(log.some((c) => c[0] === "slide.insertImage.sendToBack"), "sent to the back");
  assert.ok(!log.slice(0, firstImage).some((c) => /insertTextBox|insertShape/.test(c[0])), "placed before any text or shape");
});

test("General and proposal photo designs (dark streaks from Drive) use the same picture, not the background", () => {
  const g = load();
  const log = drawn(g, { type: "section", deckLibrary: "proposal", title: "Delivery plan", number: "02", reference: { tag: "P66_SECTION_DARK" } }, { "ds-section-bg": "SECTION_BG_ID" });
  const img = log.find((c) => c[0] === "slide.insertImage");
  assert.equal(img[1].blob, "drive:SECTION_BG_ID");
  assert.ok(!log.some((c) => /setPictureFill/.test(c[0])));
  assert.ok(!/setPictureFill/.test(read("src/EngineRenderer.gs")), "no slide uses a picture background any more");
});

test("a slide without a photo only gets its solid background", () => {
  const g = load();
  const log = drawn(g, { type: "cards", title: "Plain", items: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }] });
  assert.ok(log.some((c) => c[0] === "slide.getBackground.setSolidFill"));
  assert.ok(!log.some((c) => c[0] === "slide.insertImage"));
});

test("version label is V.1_44 or later", () => {
  assert.ok(/AGENT_VERSION_ = '66° Deck Agent V\.1_(4[4-9]|[5-9]\d)'/.test(read("src/Code.gs")));
});
