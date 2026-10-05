"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function makeTextStyle() {
  return {
    setFontFamily() {
      return this;
    },
    setFontSize() {
      return this;
    },
    setForegroundColor() {
      return this;
    },
    setBold() {
      return this;
    }
  };
}

function makeTextBox(text, w, h) {
  let value = String(text || "");
  return {
    getText() {
      return {
        setText(next) {
          value = String(next);
          return this;
        },
        asString() {
          return value;
        },
        getTextStyle() {
          return makeTextStyle();
        },
        getParagraphStyle() {
          return { setParagraphAlignment() { return this; } };
        }
      };
    },
    getWidth() {
      return w;
    },
    getHeight() {
      return h;
    },
    getBorder() {
      return { setTransparent() {} };
    },
    getFill() {
      return { setSolidFill() {} };
    }
  };
}

function makeFillShape(w, h) {
  return {
    getText() {
      throw new Error("The object (SLIDES_API385059013_20) has no text.");
    },
    getWidth() {
      return w;
    },
    getHeight() {
      return h;
    },
    getBorder() {
      return { setTransparent() {} };
    },
    getFill() {
      return { setSolidFill() {} };
    }
  };
}

function assertPositiveSize(kind, w, h) {
  if (!(Number(h) > 0)) {
    throw new Error("The height should be greater than zero.");
  }
  if (!(Number(w) > 0)) {
    throw new Error("The width should be greater than zero.");
  }
}

function loadRenderer() {
  const root = path.resolve(__dirname, "..");
  const sandbox = {
    console,
    SlidesApp: {
      ShapeType: {
        RECTANGLE: "RECTANGLE",
        ROUND_RECTANGLE: "ROUND_RECTANGLE",
        ELLIPSE: "ELLIPSE",
        DIAMOND: "DIAMOND"
      },
      ParagraphAlignment: { CENTER: "CENTER" },
      LineCategory: { STRAIGHT: "STRAIGHT" },
      ArrowStyle: { FILL_ARROW: "FILL_ARROW" },
      PredefinedLayout: { BLANK: "BLANK" },
      PageElementType: { SHAPE: "SHAPE" }
    }
  };
  vm.createContext(sandbox);
  for (const rel of ["src/Brand.gs", "src/EngineRenderer.gs"]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox, {
      filename: rel
    });
  }
  return sandbox;
}

function makeStrictSlide() {
  const inserts = [];
  return {
    inserts,
    getBackground() {
      return { setSolidFill() {} };
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
    insertTable(rowCount, colCount, x, y, w, h) {
      assertPositiveSize("table", w, h);
      inserts.push({ kind: "table", rowCount, colCount, x, y, w, h });
      const cells = {};
      return {
        getCell(r, c) {
          const key = r + ":" + c;
          if (!cells[key]) {
            let stored = " ";
            cells[key] = {
              getText() {
                return {
                  setText(value) {
                    stored = String(value);
                    return this;
                  },
                  getTextStyle() {
                    return makeTextStyle();
                  }
                };
              },
              getFill() {
                return { setSolidFill() {} };
              }
            };
          }
          return cells[key];
        }
      };
    },
    insertLine() {
      return {
        getLineFill() {
          return { setSolidFill() {} };
        },
        setWeight() {},
        setEndArrow() {}
      };
    }
  };
}

test("compact closing cards no longer insert a zero-height body text box", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  EngineRenderer.renderCard(slide, 36, 70, 648, 48, "01", "Context");
  const textBoxes = slide.inserts.filter((item) => item.kind === "text");
  assert.ok(textBoxes.length >= 1);
  for (const box of textBoxes) {
    assert.ok(box.h > 0, `zero-height text box: ${JSON.stringify(box)}`);
    assert.ok(box.w > 0, `zero-width text box: ${JSON.stringify(box)}`);
  }
  assert.ok(
    textBoxes.some((box) => /Context/.test(box.text)),
    "closing item text must still be rendered"
  );
});

test("renderSlide closing layout reproduces the runtime height error before the fix", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  EngineRenderer.renderSlide(slide, {
    category: "closing",
    title: "Next steps",
    elements: [
      { type: "text", title: "Context", body: "Where we are starting from." },
      { type: "text", title: "Approach", body: "How 66degrees creates leverage." },
      { type: "text", title: "Impact", body: "What success looks like." }
    ]
  });
  const heights = slide.inserts.map((item) => item.h);
  assert.ok(heights.length > 0);
  assert.ok(heights.every((h) => h > 0));
});

test("process nodes with overflow counts keep positive dimensions", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  const steps = Array.from({ length: 30 }, (_, i) => `Step ${i + 1}`);
  EngineRenderer.renderProcessNodes(slide, steps, 80);
  for (const item of slide.inserts) {
    assert.ok(item.w > 0);
    assert.ok(item.h > 0);
  }
});

test("diagram with many nodes and a tiny area still inserts positive boxes", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  const nodes = Array.from({ length: 25 }, (_, i) => ({
    id: `n${i}`,
    type: i === 0 ? "start" : "process",
    label: `N${i}`
  }));
  EngineRenderer.renderDiagram(
    slide,
    { direction: "LR", nodes, edges: [{ from: "n0", to: "n1" }] },
    { x: 36, y: 70, w: 80, h: 20 }
  );
  for (const item of slide.inserts) {
    assert.ok(item.w > 0, JSON.stringify(item));
    assert.ok(item.h > 0, JSON.stringify(item));
  }
});

test("insertTable with zero height is clamped instead of throwing", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  EngineRenderer.renderTable(slide, ["A", ""], [["", ""]], 36, 80, 0, 0);
  const table = slide.inserts.find((item) => item.kind === "table");
  assert.ok(table);
  assert.ok(table.w > 0);
  assert.ok(table.h > 0);
});

test("metric pills with a narrow card keep positive width and height", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeStrictSlide();
  EngineRenderer.renderMetric(slide, 36, 80, 20, 40, "92%", "Confidence", "+6%");
  for (const item of slide.inserts) {
    assert.ok(item.w > 0, JSON.stringify(item));
    assert.ok(item.h > 0, JSON.stringify(item));
  }
});
