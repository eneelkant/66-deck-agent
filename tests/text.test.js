"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const NO_TEXT_ERROR = "The object (SLIDES_API385059013_20) has no text.";

function loadRenderer() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    Logger: { log() {} },
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE"
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

test("writeTextSafe skips fill shapes that have no text frame", () => {
  const { EngineRenderer } = loadRenderer();
  const fill = {
    getText() { throw new Error(NO_TEXT_ERROR); }
  };
  assert.equal(EngineRenderer.hasTextFrame(fill), false);
  assert.equal(EngineRenderer.writeTextSafe(fill, "label"), false);
});

test("writeTextSafe writes to text-capable objects", () => {
  const { EngineRenderer } = loadRenderer();
  let stored = "";
  const box = {
    getText() {
      return {
        setText(v) { stored = String(v); return this; }
      };
    }
  };
  assert.equal(EngineRenderer.hasTextFrame(box), true);
  assert.equal(EngineRenderer.writeTextSafe(box, "Hello"), true);
  assert.equal(stored, "Hello");
});

test("insertTextBoxSafe always uses positive dimensions", () => {
  const { EngineRenderer } = loadRenderer();
  const calls = [];
  const slide = {
    insertTextBox(text, x, y, w, h) {
      if (!(w > 0) || !(h > 0)) throw new Error("The height should be greater than zero.");
      calls.push({ text, x, y, w, h });
      return { getText() { return { setText() { return this; } }; } };
    }
  };
  EngineRenderer.insertTextBoxSafe(slide, "x", 0, 0, 0, -8);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].w > 0);
  assert.ok(calls[0].h > 0);
});

test("overlayTextIfNeeded skips overlay when the shape already has a text frame", () => {
  const { EngineRenderer } = loadRenderer();
  let stored = "";
  const calls = [];
  const slide = {
    insertTextBox(text, x, y, w, h) {
      calls.push({ text, x, y, w, h });
      return { getText() { return { setText() { return this; } }; } };
    }
  };
  const box = {
    getText() {
      return {
        setText(v) { stored = String(v); return this; }
      };
    }
  };
  EngineRenderer.overlayTextIfNeeded(slide, box, { text: "Keep on shape" }, { x: 0, y: 0, w: 40, h: 20 });
  assert.equal(stored, "Keep on shape");
  assert.equal(calls.length, 0);
});

test("setSpeakerNotesSafe does not throw when notes shape has no text", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = {
    getNotesPage() {
      return {
        getSpeakerNotesShape() {
          return { getText() { throw new Error(NO_TEXT_ERROR); } };
        }
      };
    }
  };
  assert.doesNotThrow(() => EngineRenderer.setSpeakerNotesSafe(slide, "notes"));
});
