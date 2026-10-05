"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadRenderer() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE",
        DIAMOND: "DIAMOND",
        TRIANGLE: "TRIANGLE",
        CHEVRON: "CHEVRON",
        HOME_PLATE: "HOME_PLATE",
        LEFT_ARROW: "LEFT_ARROW",
        RIGHT_ARROW: "RIGHT_ARROW",
        UP_ARROW: "UP_ARROW",
        DOWN_ARROW: "DOWN_ARROW"
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(root, "src/EngineRenderer.gs"), "utf8"),
    sandbox,
    { filename: "src/EngineRenderer.gs" }
  );
  return sandbox;
}

test("normalizeShapeType maps known internal names to valid ShapeType values", () => {
  const { EngineRenderer, SlidesApp } = loadRenderer();
  const n = EngineRenderer.normalizeShapeType;

  assert.equal(n("rect"), SlidesApp.ShapeType.RECTANGLE);
  assert.equal(n("rectangle"), SlidesApp.ShapeType.RECTANGLE);
  assert.equal(n("RECTANGLE"), SlidesApp.ShapeType.RECTANGLE);
  assert.equal(n("ellipse"), SlidesApp.ShapeType.ELLIPSE);
  assert.equal(n("Ellipse"), SlidesApp.ShapeType.ELLIPSE);
  assert.equal(n("roundrect"), SlidesApp.ShapeType.ROUND_RECTANGLE);
  assert.equal(n("round rect"), SlidesApp.ShapeType.ROUND_RECTANGLE);
  assert.equal(n("ROUND_RECTANGLE"), SlidesApp.ShapeType.ROUND_RECTANGLE);
  assert.equal(n("diamond"), SlidesApp.ShapeType.DIAMOND);
  assert.equal(n("decision"), SlidesApp.ShapeType.DIAMOND);
  assert.equal(n("chevron"), SlidesApp.ShapeType.CHEVRON);
  assert.equal(n("HOME_PLATE"), SlidesApp.ShapeType.HOME_PLATE);
  assert.equal(n("process"), SlidesApp.ShapeType.ROUND_RECTANGLE);
  assert.equal(n("start"), SlidesApp.ShapeType.ELLIPSE);
  assert.equal(n("end"), SlidesApp.ShapeType.ELLIPSE);
});

test("normalizeShapeType maps the invalid ROUNDED_RECTANGLE name to ROUND_RECTANGLE", () => {
  const { EngineRenderer, SlidesApp } = loadRenderer();
  assert.equal(SlidesApp.ShapeType.ROUNDED_RECTANGLE, undefined);
  assert.equal(
    EngineRenderer.normalizeShapeType("ROUNDED_RECTANGLE"),
    SlidesApp.ShapeType.ROUND_RECTANGLE
  );
  assert.equal(
    EngineRenderer.normalizeShapeType("rounded_rectangle"),
    SlidesApp.ShapeType.ROUND_RECTANGLE
  );
});

test("normalizeShapeType falls back safely for unknown values", () => {
  const { EngineRenderer, SlidesApp } = loadRenderer();
  const n = EngineRenderer.normalizeShapeType;
  const fallback = SlidesApp.ShapeType.RECTANGLE;

  assert.equal(n("not-a-real-shape"), fallback);
  assert.equal(n("customBlob"), fallback);
  assert.equal(n(""), fallback);
  assert.equal(n(null), fallback);
  assert.equal(n(undefined), fallback);
});

test("normalizeShapeType never returns undefined or ROUNDED_RECTANGLE", () => {
  const { EngineRenderer } = loadRenderer();
  const n = EngineRenderer.normalizeShapeType;
  const samples = [
    "rect",
    "ellipse",
    "roundrect",
    "ROUNDED_RECTANGLE",
    "rounded rectangle",
    "HOME_PLATE",
    "CHEVRON",
    "triangle",
    "arrow",
    "process",
    "decision",
    "unknown-model-shape",
    "ShapeType.RECTANGLE",
    123,
    {},
    null,
    undefined
  ];

  for (const sample of samples) {
    const resolved = n(sample);
    assert.notEqual(resolved, undefined, `undefined for ${String(sample)}`);
    assert.notEqual(resolved, null, `null for ${String(sample)}`);
    assert.notEqual(resolved, "ROUNDED_RECTANGLE", `invalid enum for ${String(sample)}`);
    assert.match(String(resolved), /^[A-Z][A-Z0-9_]*$/);
  }
});
