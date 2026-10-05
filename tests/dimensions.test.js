"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const NO_TEXT_ERROR = "The object (SLIDES_API385059013_20) has no text.";

function makeTextStyle() {
  return {
    setFontFamily() { return this; },
    setFontFamilyAndWeight() { return this; },
    setFontSize() { return this; },
    setForegroundColor() { return this; },
    setBold() { return this; }
  };
}

function makeTextBox(text, w, h) {
  let value = String(text || "");
  return {
    getText() {
      return {
        setText(next) { value = String(next); return this; },
        asString() { return value; },
        getTextStyle() { return makeTextStyle(); },
        getParagraphStyle() {
          return {
            setParagraphAlignment() { return this; },
            setLineSpacing() { return this; },
            setSpaceAbove() { return this; },
            setSpaceBelow() { return this; }
          };
        },
        getRange() { return { getTextStyle() { return makeTextStyle(); } }; }
      };
    },
    getAutofit() { return { disableAutofit() {} }; },
    setContentAlignment() { return this; },
    getWidth() { return w; },
    getHeight() { return h; },
    getBorder() {
      return {
        setTransparent() {},
        setWeight() { return this; },
        getLineFill() { return { setSolidFill() {} }; }
      };
    },
    getFill() { return { setSolidFill() {}, setTransparent() {} }; }
  };
}

function makeFillShape(w, h) {
  return {
    getText() { throw new Error(NO_TEXT_ERROR); },
    getWidth() { return w; },
    getHeight() { return h; },
    getBorder() {
      return {
        setTransparent() {},
        setWeight() { return this; },
        getLineFill() { return { setSolidFill() {} }; }
      };
    },
    getFill() { return { setSolidFill() {}, setTransparent() {} }; }
  };
}

function assertPositiveSize(kind, w, h) {
  if (!(Number(h) > 0)) throw new Error("The height should be greater than zero.");
  if (!(Number(w) > 0)) throw new Error("The width should be greater than zero.");
}

function loadStack() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    Logger: { log() {} },
    CONFIG: { iconOrder: ["material"], roundedBoxes: false },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE",
        DIAMOND: "DIAMOND",
        CHEVRON: "CHEVRON",
        HOME_PLATE: "HOME_PLATE"
      },
      ParagraphAlignment: { START: "START", CENTER: "CENTER", END: "END" },
      ContentAlignment: { TOP: "TOP", MIDDLE: "MIDDLE", BOTTOM: "BOTTOM" },
      LineCategory: { STRAIGHT: "STRAIGHT" }
    }
  };
  vm.createContext(sandbox);
  for (const rel of ["src/Engine.gs", "src/EngineRenderer.gs"]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox, { filename: rel });
  }
  return sandbox;
}

function makeStrictSlide() {
  const inserts = [];
  return {
    inserts,
    getPageElements() { return []; },
    getBackground() { return { setSolidFill() {}, setPictureFill() {} }; },
    getNotesPage() {
      return { getSpeakerNotesShape() { return makeTextBox("", 100, 40); } };
    },
    insertShape(type, x, y, w, h) {
      assertPositiveSize("shape", w, h);
      inserts.push({ kind: "shape", type, x, y, w, h });
      return makeFillShape(w, h);
    },
    insertTextBox(text, x, y, w, h) {
      assertPositiveSize("text", w, h);
      inserts.push({ kind: "text", text: String(text || ""), x, y, w, h });
      return makeTextBox(text, w, h);
    },
    insertLine(cat, x1, y1, x2, y2) {
      inserts.push({ kind: "line", x1, y1, x2, y2 });
      return { setWeight() { return this; }, getLineFill() { return { setSolidFill() {} }; } };
    },
    insertImage() { return {}; }
  };
}

function brandCtx() {
  return {
    brand: {
      fonts: {
        heading: { slides: "Plus Jakarta Sans" },
        mono: { slides: "IBM Plex Mono" }
      }
    },
    assets: { design: {}, logos: {}, icons: {}, patterns: {} },
    tokens: null,
    lib: null
  };
}

function assertPositiveEls(els, label) {
  for (const el of els) {
    if (el.w != null) assert.ok(el.w > 0, `${label} ${el.t} width ${el.w}`);
    if (el.h != null) assert.ok(el.h > 0, `${label} ${el.t} height ${el.h}`);
    if (el.size != null) assert.ok(el.size > 0, `${label} ${el.t} size ${el.size}`);
  }
}

test("ENGINE card/table/metric/timeline/process/closing layouts keep positive dimensions", () => {
  const { ENGINE } = loadStack();
  const deck = {
    slides: [
      {
        type: "cards",
        title: "Capabilities",
        items: [
          { title: "One", text: "First capability." },
          { title: "Two", text: "Second capability." },
          { title: "Three", text: "Third capability." }
        ]
      },
      {
        type: "stats",
        title: "Impact",
        items: [
          { value: "40%", label: "Cost reduction", text: "Operating costs." },
          { value: "15 min", label: "Response", text: "Mean time." }
        ]
      },
      {
        type: "table",
        title: "Comparison",
        columns: ["Item", "Now", "Next"],
        rows: [["A", "1", "2"], ["B", "3", "4"]]
      },
      {
        type: "process",
        title: "Delivery",
        items: [
          { title: "Discover", text: "Workshops." },
          { title: "Build", text: "Platform." },
          { title: "Run", text: "Operate." }
        ]
      },
      {
        type: "timeline",
        title: "Roadmap",
        items: [
          { date: "Q1", title: "Pilot", text: "Start." },
          { date: "Q2", title: "Scale", text: "Expand." },
          { date: "Q3", title: "Operate", text: "Run." }
        ]
      },
      { type: "closing", title: "Thank You", subtitle: "Next conversation" }
    ]
  };
  const rendered = ENGINE.render(deck, { dateLabel: "Oct 5, 2026" });
  assert.equal(rendered.length, 6);
  rendered.forEach((slide, i) => {
    assert.ok(slide.els.length > 0, `slide ${i} empty`);
    assertPositiveEls(slide.els, `slide ${i}`);
  });
});

test("renderEngineSlide never creates non-positive dimensions", () => {
  const { renderEngineSlide } = loadStack();
  const slide = makeStrictSlide();
  renderEngineSlide(
    slide,
    {
      type: "closing",
      title: "Thank You",
      subtitle: "Leadership workshop"
    },
    1,
    brandCtx(),
    720,
    405,
    "Oct 5, 2026"
  );
  assert.ok(slide.inserts.length > 0);
  for (const item of slide.inserts) {
    if (item.w != null) assert.ok(item.w > 0);
    if (item.h != null) assert.ok(item.h > 0);
  }
});

test("compact cards and tiny page sizes still render with positive boxes", () => {
  const { renderEngineSlide } = loadStack();
  const slide = makeStrictSlide();
  renderEngineSlide(
    slide,
    {
      type: "cards",
      title: "Short",
      items: [{ title: "A", text: "B" }]
    },
    1,
    brandCtx(),
    10,
    10,
    "Oct 5, 2026"
  );
  assert.ok(slide.inserts.some((x) => x.kind === "shape" || x.kind === "text"));
});

test("table rendering uses positive dimensions", () => {
  const { ENGINE } = loadStack();
  const out = ENGINE.render({
    slides: [{
      type: "table",
      title: "Metrics",
      columns: ["KPI", "Value"],
      rows: [["NPS", "70"], ["CSAT", "90"]]
    }]
  })[0];
  assertPositiveEls(out.els, "table");
});
