"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadModules() {
  const root = path.resolve(__dirname, "..");
  const sandbox = { console };
  vm.createContext(sandbox);
  for (const rel of ["src/Brand.gs", "src/Spec.gs", "src/Reference.gs", "src/Qa.gs"]) {
    vm.runInContext(
      fs.readFileSync(path.join(root, rel), "utf8"),
      sandbox,
      { filename: rel }
    );
  }
  return sandbox;
}

test("Spec.validate accepts a well-formed PresentationSpec", () => {
  const { Spec } = loadModules();
  const result = Spec.validate({
    metadata: { title: "Demo Deck" },
    department: "Sales",
    presentationType: "Pitch",
    theme: "66degrees",
    slides: [
      {
        id: "s1",
        category: "cover",
        title: "Demo",
        elements: []
      },
      {
        id: "s2",
        category: "flowchart",
        title: "Flow",
        diagram: {
          type: "flowchart",
          direction: "LR",
          nodes: [
            { id: "a", type: "start", label: "Start" },
            { id: "b", type: "process", label: "Work" }
          ],
          edges: [{ from: "a", to: "b" }]
        }
      }
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.department, "Sales");
  assert.equal(result.value.slides.length, 2);
  assert.equal(result.value.slides[1].diagram.nodes.length, 2);
});

test("Spec.validate repairs fenced / slightly invalid JSON", () => {
  const { Spec } = loadModules();
  const raw = "```json\n{\n  metadata: {title: \"X\"},\n  department: \"General\",\n  slides: [{title: \"One\", category: \"cover\"},]\n}\n```";
  const result = Spec.validate(raw);
  assert.equal(result.ok, true);
  assert.equal(result.value.slides[0].title, "One");
});

test("Spec.validate rejects empty slides", () => {
  const { Spec } = loadModules();
  const result = Spec.validate({ department: "General", slides: [] });
  assert.equal(result.ok, false);
});

test("Reference filtering includes general layouts for Sales", () => {
  const { Reference } = loadModules();
  const filtered = Reference.getFilteredReferenceLibrary("Sales");
  assert.ok(filtered.length >= 6);
  assert.ok(filtered.some((x) => x.id === "ref_cover_hero"));
});

test("Reference selection applies reuse penalties and assigns layoutIds", () => {
  const { Spec, Reference } = loadModules();
  const ir = Spec.validate({
    department: "Delivery",
    presentationType: "Workshop",
    slides: [
      { category: "cover", title: "A" },
      { category: "kpi", title: "B" },
      { category: "cards", title: "C" },
      { category: "process", title: "D" },
      { category: "closing", title: "E" }
    ]
  }).value;

  const selected = Reference.selectReferenceForSpec(ir, {}, "Delivery");
  assert.equal(selected.spec.slides.length, 5);
  selected.spec.slides.forEach((slide) => {
    assert.ok(slide.layoutId, "layoutId assigned");
  });
  const ids = selected.spec.slides.map((s) => s.layoutId);
  assert.equal(new Set(ids).size, ids.length, "unique layouts preferred");
});

test("Brand snaps unknown colors to palette", () => {
  const { Brand } = loadModules();
  const snapped = Brand.snapToPalette("#0040EE");
  assert.equal(snapped, Brand.COLORS.PRIMARY_BLUE);
});

test("Qa.enforceBrandOnSpec fills missing titles", () => {
  const { Spec, Qa } = loadModules();
  const spec = Spec.validate({
    department: "Executive",
    slides: [{ category: "content", title: "" }]
  }).value;
  const qa = Qa.enforceBrandOnSpec(spec);
  assert.equal(qa.ok, true);
  assert.ok(qa.spec.slides[0].title);
});
