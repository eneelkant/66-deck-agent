"use strict";

// V.1_39: review of deck 15 (Apple proposal, 20 slides). Every topic the request lists gets a slide (goals, architecture,
// security approach, team structure; the phases exactly as listed); no repeated before/after, process or target slides;
// clean stat values and labels; product and client names keep their capitals; sentence case in labels and table rows;
// Gemini grounded (not trained) on client content; presenter notes on every slide; vendor blogs are not sources;
// one background in a proposal; bullets fill the slide; five cards use the full width.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const APPLE = require("./fixtures/apple15-specs.js");

function loadCode(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 10, 2026" }, Session: { getScriptTimeZone: () => "UTC" } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Code.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const copy = (x) => JSON.parse(JSON.stringify(x));
const SKIP = { cover: 1, agenda: 1, closing: 1, template: 1, team: 1 };

test("the request's topic list is read from 'Cover:' (not the first colon), with bracketed parts kept together", () => {
  const g = loadCode();
  const t = Array.from(g.requestedTopics_(APPLE.PROMPT));
  assert.equal(t[0], "Apple's current challenges");
  assert.ok(t.includes("architecture") && t.includes("security approach") && t.includes("team structure") && t.includes("why 66degrees"));
  const plan = t.find((x) => /^phased delivery plan/.test(x));
  assert.ok(plan, "the phased plan is one topic");
  assert.deepEqual(Array.from(g.topicParts_(plan)), ["discovery", "pilot in one region", "scale"]);
  assert.ok(!t.some((x) => /Customer Engagement Suite|Looker dashboards/.test(x)), "the product list after 'Google Cloud:' is not a topic list");
});

test("deck 15: missing topics are found, and the six generic steps are rewritten as the three phases asked for", () => {
  const g = loadCode();
  const gaps = g.missingTopics_(copy(APPLE.SLIDES), APPLE.PROMPT, SKIP);
  assert.deepEqual(Array.from(gaps.missing), ["our understanding of their goals", "architecture", "security approach", "team structure"]);
  assert.equal(gaps.rework.length, 1);
  assert.match(APPLE.SLIDES[gaps.rework[0].i].title, /^Implementation journey/);
  // covered topics are not reported: challenges, the solution, both agents, data, outcomes with targets, why 66degrees
  ["Apple's current challenges", "proposed solution", "how the virtual agent", "agent assist work", "data", "expected business outcomes with clear targets", "why 66degrees"]
    .forEach((topic) => assert.notEqual(g.slideForTopic_(copy(APPLE.SLIDES), topic, SKIP), -1, topic));
});

test("deck 15: repeats go (second before/after, second process, agent targets) and the required slides take their places", () => {
  const prompts = [];
  const fresh = [
    { type: "process", title: "Phased delivery plan", lead: "Three phases.", items: [{ title: "Discovery", text: "a" }, { title: "Pilot in one region", text: "b" }, { title: "Scale", text: "c" }] },
    { type: "cards", title: "Apple's goals for retail support", items: [{ title: "Consistent answers", text: "a" }, { title: "Shorter waits", text: "b" }, { title: "Faster bookings", text: "c" }] },
    { type: "diagram", title: "Solution architecture on Google Cloud", center: "Customer Engagement Suite", items: [{ title: "Conversational Agents", text: "a" }, { title: "Agent Assist", text: "b" }, { title: "Vertex AI Search", text: "c" }, { title: "BigQuery", text: "d" }] },
    { type: "cards", title: "Data and security approach", items: [{ title: "Access control", text: "a" }, { title: "Encryption", text: "b" }, { title: "Monitoring", text: "c" }] },
    { type: "cards", title: "Team structure", items: [{ title: "Engagement lead", text: "a" }, { title: "Solution architect", text: "b" }, { title: "Support operations lead (client)", text: "c" }] }
  ];
  const g = loadCode({ callGeminiJSON: (parts) => { prompts.push(parts[0].text); return /should be removed/.test(parts[0].text) ? { remove: [] } : { slides: copy(fresh) }; } });
  const plan = { deck_title: "x", slides: copy(APPLE.SLIDES) };
  const ctx = { userPrompt: APPLE.PROMPT, apiKey: "k", log: [], brand: { name: "66degrees" } };
  g.replaceDuplicateSlides_(plan, ctx);
  const titles = plan.slides.map((s) => s.title);
  assert.equal(plan.slides.length, 20, "the slide count asked for stays");
  assert.equal(plan.slides.filter((s) => g.beforeAfterSlide_(s)).length, 1, "one current / future comparison");
  assert.ok(titles.includes("Targeting success: key performance indicators"), "the KPI slide is the target slide kept");
  assert.ok(!titles.includes("Boosting agent productivity and empowerment"));
  assert.ok(!titles.includes("Approach to AI transformation") && !titles.includes("Implementation journey: from pilot to scale"));
  ["Phased delivery plan", "Apple's goals for retail support", "Solution architecture on Google Cloud", "Data and security approach", "Team structure"]
    .forEach((t) => assert.ok(titles.includes(t), t));
  const ask = prompts.find((p) => /THESE SLIDES ARE REQUIRED/.test(p));
  assert.match(ask, /phased delivery plan: use exactly these parts, in this order, as the items: discovery, pilot in one region, scale/);
  assert.match(ask, /never names of people/);
  const gaps = g.missingTopics_(plan.slides, APPLE.PROMPT, SKIP);
  assert.deepEqual([gaps.missing.length, gaps.rework.length], [0, 0], "every requested topic now has its slide");
});

test("deck 15 voice pass: stat values, metric names, names and sentence case, grounded not trained, notes everywhere", () => {
  const g = loadCode();
  g.setRunNames_(APPLE.PROMPT, ["Apple"]);
  const slides = copy(APPLE.SLIDES);
  slides.forEach((sp) => { if (sp.title && sp.type !== "closing") sp.title = g.sentenceCase_(sp.title, 2); });
  g.finalVoicePass_(slides, { userPrompt: APPLE.PROMPT });
  g.finalizeNotes_({ slides }, { research: [] });
  const kpi = slides[14].items;
  assert.deepEqual(kpi.map((i) => i.value), ["20-30%", "15-25%", "10-15%", "10-20%"], "no full stop after a figure; target ranges stay");
  assert.deepEqual(kpi.map((i) => i.label), ["Target: improvement in CSAT", "Target: reduction in average handle time", "Target: increase in first contact resolution", "Target: boost in agent satisfaction"]);
  assert.equal(slides[10].title, "Instant knowledge access with Vertex AI Search");
  assert.ok(slides[5].items.some((i) => i.title === "Vertex AI Search"));
  assert.equal(slides[9].right.label, "Future state with AI");
  assert.deepEqual(slides[17].rows.map((r) => r[0]), ["AI leadership", "Technical prowess", "Proven track record", "End-to-end delivery"]);
  assert.equal(slides[2].callout.title, "Maintaining Apple's service standard");
  assert.match(slides[2].points[3], /Genius Bar/);
  assert.equal(slides[13].items[1].text, "Prepare knowledge base, ground Gemini in Apple-specific content.");
  APPLE.SLIDES.forEach((orig, i) => { if (!/cover|agenda|closing/.test(orig.type) && !orig.notes) assert.match(String(slides[i].notes || ""), /Walk through /, orig.title); });
  assert.match(slides[14].notes, /Walk through 20-30% improvement in CSAT/);
  assert.match(slides[4].notes, /Check before sharing: wide ranges/, "vendor ranges are flagged");
  // a name with one capital stays; Title Case heading words are lowered
  assert.equal(g.headingCase_("Integration with Salesforce CRM"), "Integration with Salesforce CRM");
  assert.equal(g.headingCase_("Future State with AI"), "Future state with AI");
  assert.equal(g.sentenceCase_("Faster support. Teams work better with Gemini.", 2), "Faster support. Teams work better with Gemini.");
  assert.equal(g.groundedNotTrained_("Training the Gemini models on store data"), "Grounding Gemini in store content");
});

test("wide market ranges leave a stats slide when two other figures remain; targets keep their ranges", () => {
  const g = loadCode();
  const sp = { type: "stats", title: "The value of AI in service", items: [{ value: "300-600%+", label: "ROI" }, { value: "80%", label: "Issues resolved" }, { value: "40%", label: "Lower cost" }] };
  g.dropWideRanges_(sp);
  assert.deepEqual(sp.items.map((i) => i.value), ["80%", "40%"]);
  const t = { type: "stats", items: [{ value: "20-30%", label: "Target: CSAT" }, { value: "10%", label: "Target: AHT" }] };
  g.dropWideRanges_(t);
  assert.equal(t.items.length, 2);
});

test("research: competing vendors' blogs are not sources; analysts and Google are", () => {
  const g = loadCode();
  const list = g.toResearchSources_([
    { title: "ROI of AI Customer Service: 2026 Benchmarks - Fin AI Agent", publisher: "Fin AI Agent", findings: ["300-600% ROI"] },
    { title: "Apple Store Wait Times; Bane Or Boon?", publisher: "The Wavetec Blog", findings: ["wait"] },
    { title: "Gartner Survey Finds AI Spending by Customer Service Leaders Has Surged", publisher: "Gartner", findings: ["x"] },
    { title: "Customer Engagement Suite overview", publisher: "Google Cloud Blog", findings: ["y"] }
  ]);
  assert.deepEqual(list.map((s) => s.journal), ["Gartner", "Google Cloud Blog"]);
  assert.deepEqual(list.map((s) => s.n), [1, 2], "sources renumbered");
  assert.match(read("src/Code.gs"), /Do NOT use marketing blogs of software vendors/);
});

test("engine: one background in a proposal (comparison), bullets spread down the slide, a fifth card uses the full width", () => {
  const g = loadCode();
  const render = (s) => g.ENGINE.render({ slides: [s] }, { dateLabel: "x" })[0];
  const cmp = { type: "comparison", title: "x", left: { label: "Current state", points: ["a", "b"] }, right: { label: "Future state", points: ["c", "d"] } };
  assert.equal(render(Object.assign({ deckLibrary: "proposal", cobrand: true }, cmp)).bg, render({ type: "cards", deckLibrary: "proposal", cobrand: true, title: "x", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }, { title: "e", text: "f" }] }).bg);
  assert.notEqual(render(cmp).bg, render(Object.assign({ deckLibrary: "proposal" }, cmp)).bg, "General decks keep their grey comparison");
  const b = render({ type: "bullets", title: "Challenges", points: ["One: a short point about the first thing.", "Two: a short point about the second thing.", "Three: a short point.", "Four: a short point."], callout: { title: "Why", text: "Because it matters to the client and the team." } });
  const dots = b.els.filter((e) => e.t === "ellipse").map((e) => e.y);
  assert.ok(dots[dots.length - 1] - dots[0] > 100, "the four points use the height of the slide (was about 75pt)");
  const five = render({ type: "cards", title: "x", items: ["a", "b", "c", "d", "e"].map((t) => ({ title: t, text: "text", icon: "ai" })) });
  const boxes = five.els.filter((e) => (e.t === "rect" || e.t === "roundrect") && e.h > 60 && e.w > 100);
  const lastRow = boxes.filter((e) => e.y === Math.max.apply(null, boxes.map((x) => x.y)));
  assert.equal(lastRow.length, 2);
  assert.ok(Math.abs(lastRow[1].x + lastRow[1].w - (boxes[2].x + boxes[2].w)) < 1, "the last row ends where the first row ends");
});
