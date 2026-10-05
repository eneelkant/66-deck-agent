"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const NO_TEXT_ERROR = "The object (SLIDES_API385059013_20) has no text.";

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

function makeTextRange(initial) {
  let value = initial == null ? "\n" : String(initial);
  const style = makeTextStyle();
  return {
    setText(text) {
      value = String(text);
      return this;
    },
    asString() {
      return value;
    },
    getTextStyle() {
      return style;
    },
    getParagraphStyle() {
      return {
        setParagraphAlignment() {
          return this;
        }
      };
    }
  };
}

function makeTextBox(text, w, h) {
  const range = makeTextRange(text);
  return {
    getText() {
      return range;
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

function makeFillShape() {
  return {
    getText() {
      throw new Error(NO_TEXT_ERROR);
    },
    getBorder() {
      return { setTransparent() {} };
    },
    getFill() {
      return { setSolidFill() {} };
    }
  };
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

function makeSlide() {
  const calls = [];
  const slide = {
    calls,
    insertShape(type) {
      calls.push(["insertShape", type]);
      return makeFillShape();
    },
    insertTextBox(text, x, y, w, h) {
      calls.push(["insertTextBox", String(text || "")]);
      return makeTextBox(text, w, h);
    },
    insertLine() {
      return {
        getLineFill() {
          return { setSolidFill() {} };
        },
        setWeight() {},
        setEndArrow() {}
      };
    },
    insertTable(rowCount, colCount) {
      const cells = [];
      for (let r = 0; r < rowCount; r++) {
        cells[r] = [];
        for (let c = 0; c < colCount; c++) {
          let stored = "";
          cells[r][c] = {
            getText() {
              return {
                setText(value) {
                  stored = String(value);
                  return this;
                },
                getTextStyle() {
                  if (!stored) {
                    throw new Error(NO_TEXT_ERROR);
                  }
                  return makeTextStyle();
                }
              };
            },
            getFill() {
              return { setSolidFill() {} };
            }
          };
        }
      }
      return {
        getCell(r, c) {
          return cells[r][c];
        }
      };
    }
  };
  return slide;
}

test("Brand.setShapeText does not throw when the shape has no text frame", () => {
  const { Brand } = loadRenderer();
  const result = Brand.setShapeText(makeFillShape(), "Label", { bold: true });
  assert.equal(result, null);
});

test("Brand.setShapeText still writes text boxes", () => {
  const { Brand } = loadRenderer();
  const box = makeTextBox("", 100, 20);
  const tr = Brand.setShapeText(box, "Hello", { bold: true });
  assert.equal(tr.asString(), "Hello");
});

test("Brand.applyTextStyle does not throw on empty ranges with no text", () => {
  const { Brand } = loadRenderer();
  const emptyRange = {
    getTextStyle() {
      throw new Error(NO_TEXT_ERROR);
    }
  };
  Brand.applyTextStyle(emptyRange, { bold: true });
});

test("Brand.fitTextSize does not throw when the shape has no text", () => {
  const { Brand } = loadRenderer();
  const size = Brand.fitTextSize(makeFillShape(), 12, 8);
  assert.equal(size, 12);
});

test("process nodes overlay text boxes instead of writing into fill shapes", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeSlide();
  EngineRenderer.renderProcessNodes(slide, ["Align", "Build"], 80);
  assert.ok(slide.calls.some((call) => call[0] === "insertShape"));
  assert.ok(slide.calls.some((call) => call[0] === "insertTextBox" && call[1] === "Align"));
  assert.ok(slide.calls.some((call) => call[0] === "insertTextBox" && call[1] === "Build"));
});

test("diagram nodes overlay labels when shapes have no text frame", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeSlide();
  EngineRenderer.renderDiagram(slide, {
    nodes: [
      { id: "n1", type: "start", label: "Input" },
      { id: "n2", type: "process", label: "Work" }
    ],
    edges: [{ from: "n1", to: "n2" }]
  });
  assert.ok(slide.calls.some((call) => call[0] === "insertTextBox" && call[1] === "Input"));
  assert.ok(slide.calls.some((call) => call[0] === "insertTextBox" && call[1] === "Work"));
});

test("metric trend pills overlay text instead of styling a no-text round rect", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeSlide();
  EngineRenderer.renderMetric(slide, 36, 80, 200, 110, "92%", "Confidence", "+6%");
  assert.ok(slide.calls.some((call) => call[0] === "insertTextBox" && call[1] === "+6%"));
});

test("renderTable styles empty cells without throwing", () => {
  const { EngineRenderer } = loadRenderer();
  const slide = makeSlide();
  EngineRenderer.renderTable(slide, ["Workstream", ""], [["Experience", ""]], 36, 80, 600, 160);
});
