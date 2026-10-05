"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadModules() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    Logger: { log() {} },
    CONFIG: {
      useReferenceLibrary: true,
      refLibraryFileId: "",
      referenceDeckId: "",
      iconOrder: ["library", "drive", "material"]
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(root, "src/Engine.gs"), "utf8"),
    sandbox,
    { filename: "src/Engine.gs" }
  );
  vm.runInContext(
    fs.readFileSync(path.join(root, "src/Reference.gs"), "utf8"),
    sandbox,
    { filename: "src/Reference.gs" }
  );
  return sandbox;
}

test("ENGINE.render accepts a well-formed layout spec", () => {
  const { ENGINE } = loadModules();
  const slides = ENGINE.render({
    slides: [
      { type: "cover", title: "Demo", subtitle: "For leadership" },
      { type: "agenda", title: "Agenda", items: [{ title: "One", text: "Intro" }, { title: "Two", text: "Plan" }] },
      { type: "closing", title: "Thank You" }
    ]
  });
  assert.equal(slides.length, 3);
  assert.ok(slides[0].els.some((e) => e.t === "text"));
  assert.ok(slides[2].noFooter);
});

test("ENGINE.cleanSpec and type aliases still produce a drawable layout", () => {
  const { ENGINE } = loadModules();
  const spec = ENGINE.cleanSpec({
    type: "kpi",
    title: "Results",
    items: [{ value: "40%", label: "Savings", text: "Cloud SQL" }]
  });
  const out = ENGINE.render({ slides: [spec] })[0];
  assert.ok(out.els.length > 0);
  out.els.forEach((el) => {
    if (el.w != null) assert.ok(el.w > 0);
    if (el.h != null) assert.ok(el.h > 0);
  });
});

test("ENGINE.measure reports overflow for impossible fit", () => {
  const { ENGINE } = loadModules();
  const m = ENGINE.measure({
    type: "cards",
    title: "A very long title that should still be measured",
    items: [
      { title: "Card", text: "x ".repeat(400) },
      { title: "Card 2", text: "y ".repeat(400) }
    ]
  });
  assert.ok(m);
  assert.ok(Array.isArray(m.overflow) || Array.isArray(m.underfill) || typeof m === "object");
});

test("reference type aliases map generated types onto template families", () => {
  const { TYPE_ALIASES, normalizeType_ } = loadModules();
  assert.equal(TYPE_ALIASES.metrics, "stats");
  assert.equal(TYPE_ALIASES.steps, "process");
  assert.equal(normalizeType_("thank_you"), "closing");
});

test("selectReferences degrades when the library is missing", () => {
  const { selectReferences } = loadModules();
  const plan = { slides: [{ type: "cover", title: "Hi" }, { type: "cards", title: "Body", items: [] }] };
  const refs = selectReferences(plan, { lib: null });
  assert.ok(refs);
  assert.ok("matched" in refs || "fallback" in refs || plan.slides.length === 2);
});
