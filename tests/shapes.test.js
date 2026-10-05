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

test("layoutDiagramPositions keeps node dimensions positive with many nodes", () => {
  const { EngineRenderer } = loadRenderer();

  const nodes = Array.from({ length: 20 }, (_, i) => ({
    id: `node-${i}`,
    label: `Node ${i}`,
    type: "process"
  }));

  const positions = EngineRenderer.layoutDiagramPositions(
    { direction: "LR", nodes },
    { x: 20, y: 80, w: 680, h: 260 }
  );

  for (const node of nodes) {
    const pos = positions[node.id];
    assert.ok(pos, `missing position for ${node.id}`);
    assert.ok(pos.w > 0, `non-positive width for ${node.id}: ${pos.w}`);
    assert.ok(pos.h > 0, `non-positive height for ${node.id}: ${pos.h}`);
  }
});

test("layoutDiagramPositions keeps node dimensions positive for TB diagrams", () => {
  const { EngineRenderer } = loadRenderer();

  const nodes = Array.from({ length: 20 }, (_, i) => ({
    id: `node-${i}`,
    label: `Node ${i}`,
    type: "process"
  }));

  const positions = EngineRenderer.layoutDiagramPositions(
    { direction: "TB", nodes },
    { x: 20, y: 80, w: 680, h: 260 }
  );

  for (const node of nodes) {
    const pos = positions[node.id];
    assert.ok(pos, `missing position for ${node.id}`);
    assert.ok(pos.w > 0, `non-positive width for ${node.id}: ${pos.w}`);
    assert.ok(pos.h > 0, `non-positive height for ${node.id}: ${pos.h}`);
  }
});

test("layoutDiagramPositions stays positive with overflow counts and missing area", () => {
  const { EngineRenderer } = loadRenderer();
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}` }));

  const crowded = EngineRenderer.layoutDiagramPositions(
    { direction: "LR", nodes },
    { x: 0, y: 0, w: 100, h: 40 }
  );
  for (const node of nodes) {
    assert.ok(crowded[node.id].w > 0);
    assert.ok(crowded[node.id].h > 0);
  }

  const emptyArea = EngineRenderer.layoutDiagramPositions(
    { direction: "TB", nodes: [{ id: "only" }] },
    { x: 0, y: 0, w: 0, h: 0 }
  );
  assert.ok(emptyArea.only.w > 0);
  assert.ok(emptyArea.only.h > 0);
});

test("safeBox never returns zero or negative width/height", () => {
  const { EngineRenderer } = loadRenderer();
  const samples = [
    [0, 0, 0, 0],
    [10, 10, -40, -12],
    [0, 0, NaN, undefined],
    [0, 0, null, ""]
  ];
  for (const [x, y, w, h] of samples) {
    const box = EngineRenderer.safeBox(x, y, w, h);
    assert.ok(box.w > 0, `width ${box.w} for ${w}`);
    assert.ok(box.h > 0, `height ${box.h} for ${h}`);
  }
});
