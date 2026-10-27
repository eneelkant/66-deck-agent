"use strict";

// V.1_65 (decks 37: Solution, Proposal, General): fixed by kind of problem, for every deck type.
//  1. empty space inside boxes: a box is as tall as its text needs, a single list is spread over its box
//  2. lead-ins that cannot be read on a dark slide (dark runs on a dark text): the run takes the text's colour
//  3. uneven bullets: a list is one text with real bullets and the same space between points
//  4. content in the wrong shape: a chart without figures, notes written as a list, target figures as text, a closing
//     paragraph as the last step, a radar drawn as support tiers
//  5. sentences cut in the middle
//  6. text said twice (a caption or takeaway repeating the lead; the industry figures pushed into the lead)
//  7. agenda rows that are not sections (Introduction, Thank you) in long decks
//  8. thin texts: the fit step asks Gemini for more points and longer texts
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

function load() {
  let sd = 7;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const sb = { console, Math: M, JSON, Date, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }), getUserProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 27, 2026", sleep() {}, newBlob: () => ({}), base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: {}, UrlFetchApp: { fetch: () => { throw new Error("no net"); } }, SlidesApp: {} };
  vm.createContext(sb);
  ORDER.forEach((f) => vm.runInContext(read("src/" + f), sb, { filename: f }));
  return sb;
}
const G = load();
const render = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));
const norm = (slides) => { const plan = { slides: JSON.parse(JSON.stringify(slides)) }; const ctx = { log: [] }; G.normalizeShapes_(plan, ctx); return plan.slides; };

test("version label is V.1_65 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[5-9]|[7-9]\d)'/);
});

test("1+3. a list is one text with real bullets and even spacing, spread over its box", () => {
  const pts = ["Data is spread across five systems.", "Reports take two weeks to build.", "Teams do not trust the numbers."];
  ["general", "solution"].forEach((lib) => {
    const o = render({ type: "bullets", deckLibrary: lib, title: "Where we are today", points: pts });
    const lists = o.els.filter((e) => e.t === "text" && e.list);
    assert.ok(lists.length >= 1, lib + ": drawn as a bullet list (" + o.drawnWith + ")");
    lists.forEach((l) => {
      assert.ok(l.list.gap >= 0 && l.list.indent > 0, lib + ": one gap and one indent for every point");
      assert.ok(!/^[•·]/m.test(l.text), lib + ": real bullets, not typed dots");
    });
  });
  const r = read("src/EngineRenderer.gs");
  assert.match(r, /DISC_CIRCLE_SQUARE/);
  assert.match(r, /setSpaceBelow/);
  assert.match(read("src/ProposalDesigns_1_Understanding.gs"), /K\.bulletList\(/, "Proposal designs use the same list");
});

test("1. a box is as tall as its text needs; boxes in a row stay the same height", () => {
  const eng = read("src/Engine.gs");
  assert.match(eng, /function compactBoxes_\(out\)/);
  assert.match(eng, /compactBoxes_\(/);
});

test("2. a lead-in run darker than a dark slide's text takes the text's colour; the brand blue is kept", () => {
  const eng = read("src/Engine.gs");
  assert.match(eng, /isLight\(el\.color\) !== isLight\(c\)/);
  assert.match(eng, /0052FF/);
});

test("4a. notes written as a list: one text, or the slide's points when it has none", () => {
  const [a, b] = norm([
    { type: "cards", title: "Plan", items: [{ title: "A", text: "x" }, { title: "B", text: "y" }], notes: ["First note", "Second note"] },
    { type: "bullets", title: "Why now", notes: ["Costs are rising.", "The contract ends in June."] }]);
  assert.equal(a.notes, "First note. Second note.");
  assert.deepEqual(Array.from(b.points), ["Costs are rising.", "The contract ends in June."]);
  assert.doesNotMatch(String(a.notes), /\.,/);
});

test("4b. a chart without figures becomes cards of its categories (deck 37 Proposal slide 36)", () => {
  const [s] = norm([{ type: "chart", title: "Current vs future state", chart: { type: "bar", categories: ["Current state", "Future state"], series: [{ name: "x", values: ["manual reports", "self-service"] }] }, points: ["Dashboards refresh hourly."] }]);
  assert.equal(s.type, "cards");
  assert.deepEqual(s.items.map((i) => i.title), ["Current state", "Future state"]);
  assert.ok(!s.chart);
  const [ok] = norm([{ type: "chart", title: "Revenue", chart: { categories: ["2024", "2025", "2026"], series: [{ values: [10, 12, 15] }] } }]);
  assert.equal(ok.type, "chart", "a real chart stays a chart");
});

test("4c. target figures written as text become KPI tiles (deck 37 Solution slide 37)", () => {
  const [s] = norm([{ type: "cards", title: "Success KPIs", items: [
    { title: "Report build time", text: "Target: 55% faster within six months" },
    { title: "Data trust", text: "Target: 90% of leaders use the dashboards weekly" },
    { title: "Cost", text: "Target: 30% lower run cost" }] }]);
  assert.equal(s.type, "stats");
  assert.deepEqual(s.items.map((i) => i.value), ["55%", "90%", "30%"]);
  assert.ok(s.items.every((i) => /^Target: /.test(i.label)));
});

test("4d. a long closing paragraph written as the last step becomes the takeaway (deck 37 Proposal slide 38)", () => {
  const long = "Taken together these steps give the client one trusted view of revenue, cut the time to build a report from weeks to hours and leave the internal team able to run and extend the platform on its own after hand-over.";
  const [s] = norm([{ type: "process", title: "Next steps", items: [{ title: "Kick-off", text: "Agree scope and owners." }, { title: "Discovery", text: "Map the five source systems." }, { title: "Build", text: "Deliver the first dashboards." }, { text: long }] }]);
  assert.equal(s.items.length, 3);
  assert.equal(s.takeaway, long);
});

test("6. a caption, takeaway or callout that repeats the lead is dropped (deck 37 Proposal slide 21)", () => {
  const lead = "One governed data platform gives every team the same trusted numbers.";
  const [s] = norm([{ type: "cards", title: "Vision", lead, takeaway: "One governed data platform gives every team the same trusted numbers.", items: [{ title: "A", text: "x" }, { title: "B", text: "y" }, { title: "C", text: "z" }] }]);
  assert.equal(s.takeaway, "");
  const [t] = norm([{ type: "cards", title: "Vision", lead, takeaway: "Hand-over in week twelve keeps the internal team in charge.", items: [] }]);
  assert.ok(t.takeaway, "a different takeaway stays");
});

test("6. Solution: the industry figures sentence only becomes the lead when the slide has none", () => {
  assert.match(read("src/SolutionKit.gs"), /V\.1_65/);
});

test("4e. the support tiers design only for tiers / levels / support (deck 37 Proposal slide 35)", () => {
  const gates = vm.runInContext("HARD_TOPIC_GATES_", G), topics = vm.runInContext("DESIGN_TOPICS_", G);
  assert.ok(gates.P66_TIERS);
  assert.ok(!topics.P66_TIERS.test("Data readiness assessment Governance Quality Skills Tooling"));
  assert.ok(topics.P66_TIERS.test("Support model L1 L2 L3"));
  const o = render({ type: "cards", deckLibrary: "proposal", title: "Data readiness assessment", items: [
    { title: "Governance", text: "Owners are named for two of five domains." }, { title: "Quality", text: "Duplicates in the customer table." },
    { title: "Skills", text: "Two analysts know SQL well." }] });
  assert.notEqual(o.drawnWith, "P66_TIERS");
});

test("5. a shortened text is whole sentences, never cut in the middle (deck 37 Solution slide 6)", () => {
  const long = "Primary and secondary replicas with automatic seeding, listener configuration and health probes across both regions";
  const o = render({ type: "diagram", deckLibrary: "solution", title: "Deployment layers", reference: { tag: "S66_LAYER_STACK" },
    layers: [1, 2, 3, 4].map((i) => ({ title: "Layer " + i, items: [long, long, long, long] })) });
  texts(o).slice(1).join("\n").split("\n").filter(Boolean).forEach((t) => {
    if (t.split(/\s+/).length > 4) assert.match(t.trim(), /[.!?]$/, "ends as a sentence: " + t);
    assert.doesNotMatch(t, /regions Primary/, "two points never run together: " + t);
  });
});

test("7. the agenda lists the sections only, in short and long decks of every type", () => {
  const code = read("src/Code.gs");
  assert.doesNotMatch(code, /unshift\(\{ title: 'Introduction'/);
  assert.doesNotMatch(code, /push\(\{ title: 'Thank you'/);
});

test("8. the fit step adds points to a thin list and lets short texts grow; item texts are asked for in every deck type", () => {
  const code = read("src/Code.gs");
  assert.match(code, /add_points/);
  assert.match(code, /u\.text\.length \+ 320, 420/);
  assert.match(code, /function normalizeShapes_\(plan, ctx\)/);
  assert.match(code, /normalizeShapes_\(plan, ctx\)/);
});

test("reported slides: every replayed slide comes out clean", () => {
  const dir = path.join(ROOT, "tests/fixtures/reported");
  fs.readdirSync(dir).filter((f) => /\.json$/.test(f)).forEach((f) => {
    const spec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const o = render(spec.spec || spec);
    const iss = (o.qa && o.qa.issues) || [];
    assert.ok(iss.filter((x) => x === "empty" || x === "overlap").length === 0, f + ": " + iss.join(","));
  });
});
