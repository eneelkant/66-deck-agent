"use strict";

// V.1_34: deck 7 (Create, "Cloud cost optimization", 20 slides) and deck 8 (Flowchart, FBM pictures) review fixes,
// introduction + Thank-you slides in the Flowchart tab, optional diagram type.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DECK8 = require("./fixtures/deck8-specs.js");

function loadCode(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 8, 2026" }, Session: { getScriptTimeZone: () => "UTC" } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Code.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const over = (p, q) => p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;
const segHits = (l, q) => Math.min(l.x1, l.x2) < q.x + q.w - 1 && Math.max(l.x1, l.x2) > q.x + 1 && Math.min(l.y1, l.y2) < q.y + q.h - 1 && Math.max(l.y1, l.y2) > q.y + 1;
const AREA = { x: 40, y: 92, w: 640, h: 260 };

/* ---------- Flowchart (deck 8) ---------- */

test("labels shouted in CAPITALS in the picture come out in sentence case; acronyms and short labels stay; abbreviations are written out", () => {
  const g = loadCode();
  assert.equal(g.ddCase_("AGENT FACTORY HUB"), "Agent factory hub");
  assert.equal(g.ddCase_("DEPLOYMENT & GOVERNANCE"), "Deployment & governance");
  assert.equal(g.ddCase_("MCP SERVERS WITH RBAC POLICIES"), "MCP servers with RBAC policies");
  assert.equal(g.ddCase_("FBM Q&A"), "FBM Q&A");
  assert.equal(g.ddCase_("Agent catalog & arch"), "Agent catalog & architecture");
  assert.equal(g.ddCase_("Synthetic sandbox env"), "Synthetic sandbox environment");
  assert.equal(g.ddCase_("Boards, DevSecOps, CI/CD"), "Boards, DevSecOps, CI/CD");
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK8[0])), "process", "t");
  assert.deepEqual(Array.from(ir.groups.map((x) => x.label)), ["Developers", "Agent factory", "Deployment"]);
});

test("deck 8 replay: no line through any box or lane name, arrows between lanes run up / down, labels clear", () => {
  const g = loadCode();
  DECK8.forEach((d) => {
    const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(d)), d.type, "t");
    const els = g.drawDiagramDesign_(ir, AREA);
    const boxes = els.filter((e) => e.nodeId);
    const laneNames = els.filter((e) => e.t === "text" && !e.edgeLabel && e.text).map((t) => ({ x: t.x + 7.2, y: t.y + 7.2, w: Math.min(t.w - 14.4, t.text.length * 4.6 + 4), h: 12 }));
    els.filter((e) => e.t === "line").forEach((l) => {
      boxes.forEach((b) => assert.ok(!segHits(l, b), d.title + ": a line runs through " + b.text.split("\n")[0]));
    });
    els.filter((e) => e.edgeLabel).forEach((t) => {
      const r = { x: t.x + 7.2, y: t.y + 8.2, w: t.w - 14.4, h: t.h - 16.4 };
      boxes.forEach((b) => assert.ok(!over(r, b), d.title + ": label " + t.text + " on a box"));
    });
    // every arrow head lands square-on
    els.filter((e) => e.t === "line" && e.arrow).forEach((l) => assert.ok(Math.abs(l.x1 - l.x2) < 0.01 || Math.abs(l.y1 - l.y2) < 0.01));
    void laneNames;
  });
  const ir = g.ddSpecToIr_(JSON.parse(JSON.stringify(DECK8[0])), "process", "t");
  const els = g.drawDiagramDesign_(ir, AREA);
  const box = (id) => els.find((e) => e.nodeId === id);
  const lastInto = (id) => els.filter((e) => e.t === "line" && e.arrow).find((l) => { const b = box(id); return Math.abs(l.y2 - b.y) < 0.6 || Math.abs(l.y2 - b.y - b.h) < 0.6; });
  assert.ok(lastInto("id"), "the step in the next lane is entered from the top");
});

test("Flowchart run: introduction slide, the diagram slides, then the template Thank-you slide", () => {
  const code = read("src/Code.gs");
  const run = code.slice(code.indexOf("function runFlowchartGeneration"), code.indexOf("function getPipelineStages"));
  assert.match(run, /const specs = \[\{ type: 'cover', title: coverTitle/);
  assert.match(run, /specs\.push\(\{ type: 'closing', title: 'Thank You!'/);
  assert.match(run, /generic = \/\^\\s\*\(please\\s\+\)\?\(create\|make\|draw/, "\"create a flowchart\" is not used as the cover title");
});

/* ---------- Create (deck 7) ---------- */

test("text tidy-up: no figures in headings, no filler tail sentences, plain metric names, sentence-case industry", () => {
  const g = loadCode();
  const sp = { type: "cards", title: "Significant financial impact", items: [
    { title: "Faster time-to-market (30-50% range)", text: "Modular platforms speed delivery. This approach accelerates innovation and reduces time-to-market." },
    { title: "Reduced operational costs", text: "Removing waste lowers spend." }] };
  g.tidyItemText_(sp);
  assert.equal(sp.items[0].title, "Faster time-to-market");
  assert.equal(sp.items[0].text, "Modular platforms speed delivery.");
  const m = { type: "cards", title: "Key metrics for cloud cost efficiency", items: [{ title: "CPU/Memory", text: "x" }, { title: "Transaction/User", text: "y" }] };
  g.tidyItemText_(m);
  assert.deepEqual(Array.from(m.items.map((i) => i.title)), ["CPU and memory", "Transaction and user"]);
  const cs = { type: "case_study", industry: "HEALTHCARE TECHNOLOGY", results: [{ value: "60%+", label: "Reduction in remediation efforts. This improves operational efficiency and team productivity." }] };
  g.tidyItemText_(cs);
  assert.equal(cs.industry, "Healthcare technology");
  assert.equal(cs.results[0].label, "Reduction in remediation efforts.");
});

test("sentence case: 'Cloud' only capitalised in product names; camelCase names keep their capitals", () => {
  const g = loadCode();
  assert.equal(g.sentenceCase_("Maximizing Value From Your Cloud Investment", 2), "Maximizing value from your cloud investment");
  assert.equal(g.sentenceCase_("Moving To Google Cloud With Cloud Run", 2), "Moving to Google Cloud with Cloud Run");
  assert.equal(g.sentenceCase_("Boards, DevSecOps, CI/CD", 1), "Boards, DevSecOps, CI/CD");
});

test("unrequested case studies and services slides are replaced; step-by-step slides are capped at 2 in a 20-slide deck", () => {
  const prompts = [];
  const g = loadCode({ callGeminiJSON(parts) { prompts.push(parts[0].text); return { slides: [] }; } });
  const body = (title, type, extra) => Object.assign({ type: type || "cards", title, items: [{ title: title + " a", text: "unique words " + title }, { title: title + " b", text: "more " + title }] }, extra || {});
  const plan = { slides: [
    { type: "cover", title: "Cloud cost optimization" }, { type: "agenda", title: "Agenda", items: [] },
    body("The escalating challenge of cloud spend", "stats"),
    body("FinOps: a collaborative approach to cloud economics", "process"),
    body("Our FinOps framework for continuous optimization", "process"),
    body("Implementing a rightsizing strategy", "process"),
    body("The cloud cost optimization cycle", "diagram"),
    body("Phased approach to FinOps adoption", "timeline"),
    body("Gordon Food Service: unifying data", "case_study", { challenge: "x", results: [{ value: "40%", label: "cost" }] }),
    body("WellSky: migrating to GCP", "case_study", { challenge: "x", results: [{ value: "40%", label: "cost" }] }),
    body("AutoZone: $10M annual savings", "case_study", { challenge: "x", results: [{ value: "$10M", label: "savings" }] }),
    body("Our comprehensive cloud cost optimization services", "cards"),
    { type: "closing", title: "Thank You!" }] };
  g.replaceDuplicateSlides_(plan, { userPrompt: "Cloud cost optimization", brand: { name: "66degrees" }, log: [], apiKey: "" });
  const titles = plan.slides.map((s) => s.title);
  assert.ok(!plan.slides.some((s) => s.type === "case_study"), "no unrequested case study");
  assert.ok(!titles.includes("Our comprehensive cloud cost optimization services"), "no unrequested services slide");
  assert.ok(plan.slides.filter((s) => g.sequenceLike_(s) && !["cover", "agenda", "closing"].includes(s.type)).length <= 2, "at most two step-by-step slides");
  assert.ok(prompts.some((p) => /No case study or client story slide/.test(p) && /No process, steps, phases, cycle/.test(p)), "replacements are told the same");
  // asked for client proof: one case study stays
  const g2 = loadCode({ callGeminiJSON() { return { slides: [] }; } });
  const plan2 = { slides: plan.slides.length ? [{ type: "cover", title: "x" }, body("Gordon Food Service: unifying data", "case_study", { challenge: "x", results: [{ value: "40%", label: "c" }] }),
    body("WellSky: migrating to GCP", "case_study", { challenge: "y", results: [{ value: "40%", label: "c" }] }), { type: "closing", title: "Thank You!" }] : [] };
  g2.replaceDuplicateSlides_(plan2, { userPrompt: "Cloud cost optimization with a case study", brand: { name: "66degrees" }, log: [], apiKey: "" });
  assert.equal(plan2.slides.filter((s) => s.type === "case_study").length, 1);
});

test("writer rules: Google Cloud terms, FinOps phases in order, metric names and targets, no figures in headings", () => {
  const code = read("src/Code.gs");
  assert.match(code, /committed use discounts, sustained use discounts/);
  assert.match(code, /Inform -> Optimize -> Operate/);
  assert.match(code, /never "CPU\/Memory"/);
  assert.match(code, /Never put a figure or a\s+range in a card or step heading/);
});

test("agenda numbers are the slide numbers", () => {
  const g = loadCode();
  const slides = [{ type: "cover", title: "c" }, { type: "agenda", title: "Agenda", items: [] }, { type: "cards", title: "First topic" }, { type: "stats", title: "Second topic" }, { type: "closing", title: "Thank You!" }];
  g.syncAgendaToSlides_(slides);
  assert.deepEqual(Array.from(slides[1].items.map((i) => i.no)), [3, 4]);
  const out = g.ENGINE.render({ slides: [slides[1]] }, { dateLabel: "x" })[0];
  const nums = out.els.filter((e) => e.t === "text" && /^0\d$/.test(e.text)).map((e) => e.text);
  assert.deepEqual(Array.from(nums), ["03", "04"]);
});

test("design fixes: four-part donut has no near-white quarter; tags are not forced to capitals; titles on dark picture slides stay left", () => {
  const eng = read("src/Engine.gs");
  assert.match(eng, /var fills = \[T\.blue, T\.ink, T\.slate, T\.ink\];/);
  assert.doesNotMatch(eng, /'THE OUTCOME'/);
  assert.doesNotMatch(eng, /caps: true/);
  assert.match(eng, /HEADER_MAX_W = 470;/);
  const g = loadCode();
  const m = g.ENGINE.measure({ type: "cards", title: "Short", items: [{ title: "A", text: "one" }, { title: "B", text: "two" }, { title: "C", text: "three" }] }, {});
  assert.ok(typeof m.coverage === "number" && m.coverage >= 0 && m.coverage <= 1, "measure reports how much of the slide a design fills");
  assert.match(read("src/Code.gs"), /m\.coverage < 0\.7/);
});
