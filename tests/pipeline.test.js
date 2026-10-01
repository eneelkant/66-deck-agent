"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadEngineStack() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => ""
      })
    },
    UrlFetchApp: {
      fetch: () => {
        throw new Error("network disabled");
      }
    },
    DriveApp: {
      getFileById: () => {
        throw new Error("drive disabled");
      }
    },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUNDED_RECTANGLE: "ROUNDED_RECTANGLE",
        DIAMOND: "DIAMOND",
        ELLIPSE: "ELLIPSE"
      },
      LineCategory: { STRAIGHT: "STRAIGHT" },
      ArrowStyle: { FILL_ARROW: "FILL_ARROW" },
      ParagraphAlignment: { CENTER: "CENTER" },
      PredefinedLayout: { BLANK: "BLANK" },
      PageElementType: { SHAPE: "SHAPE" }
    }
  };
  vm.createContext(sandbox);
  for (const rel of [
    "src/Brand.gs",
    "src/Spec.gs",
    "src/Reference.gs",
    "src/Qa.gs",
    "src/Engine.gs",
    "src/Code.gs"
  ]) {
    // EngineRenderer / Rebrand need heavy Slides mocks; skipped here.
    if (rel === "src/Code.gs") {
      // Provide minimal stubs used at load-time only.
    }
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox, {
      filename: rel
    });
  }
  return sandbox;
}

test("Engine.validateInput enforces slide bounds and HTTPS source URLs", () => {
  const { Engine } = loadEngineStack();
  assert.throws(() => Engine.validateInput({ prompt: "x", slideCount: 2 }), /3 and 20/);
  assert.throws(
    () => Engine.validateInput({ prompt: "x", sourceUrl: "http://example.com" }),
    /HTTPS/
  );
  const ok = Engine.validateInput({
    prompt: "Build a sales pitch",
    department: "Sales",
    presentationType: "Pitch",
    slideCount: 8
  });
  assert.equal(ok.department, "Sales");
});

test("Deterministic planner builds a valid diverse PresentationSpec", () => {
  const { Engine, Spec } = loadEngineStack();
  const request = Engine.validateInput({
    prompt: "Cloud migration value story for executives",
    department: "Executive",
    presentationType: "Executive Brief",
    slideCount: 10
  });
  const research = Engine.researchTopic(request.prompt, "");
  const fallback = Engine.buildFallbackSpec(request, research);
  const validated = Spec.validate(fallback);
  assert.equal(validated.ok, true);
  assert.equal(validated.value.slides.length, 10);
  assert.equal(validated.value.slides[0].category, "cover");
  assert.equal(validated.value.slides[9].category, "closing");
  const categories = new Set(validated.value.slides.map((s) => s.category));
  assert.ok(categories.size >= 4);
});

test("generatePresentationSpec falls back when Gemini key missing", () => {
  const { Engine } = loadEngineStack();
  const request = Engine.validateInput({
    prompt: "Delivery operating model workshop",
    department: "Delivery",
    presentationType: "Workshop",
    slideCount: 6
  });
  const research = Engine.researchTopic(request.prompt, "");
  const result = Engine.generatePresentationSpec(request, "", research);
  assert.equal(result.ok, true);
  assert.ok((result.warnings || []).join(" ").includes("GEMINI_API_KEY"));
});

test("planDiagrams synthesizes flowchart DSL when missing", () => {
  const { Engine, Spec } = loadEngineStack();
  const spec = Spec.validate({
    department: "Solutions",
    slides: [
      {
        category: "flowchart",
        title: "Flow",
        elements: [
          { title: "Lead" },
          { title: "Qualify?" },
          { title: "Propose" },
          { title: "Win" }
        ]
      }
    ]
  }).value;
  const planned = Engine.planDiagrams(spec);
  assert.ok(planned.slides[0].diagram);
  assert.equal(planned.slides[0].diagram.nodes.length, 4);
  assert.equal(planned.slides[0].diagram.edges.length, 3);
});

test("pipeline stage list is complete and ordered", () => {
  const { getPipelineStages } = loadEngineStack();
  const stages = getPipelineStages();
  assert.deepEqual(stages[0], "input_validation");
  assert.deepEqual(stages[stages.length - 1], "final_presentation");
  assert.equal(stages.length, 12);
});
