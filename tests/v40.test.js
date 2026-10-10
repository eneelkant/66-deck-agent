"use strict";

// V.1_40: review of deck 16 (Apple proposal). Statement side points without a heading (slide 5 showed "[object Object]"),
// "X is no longer Y; it is Z" sentences, one outcome slide (slides 14 and 15 repeated it), whole figures and no slashes
// in stat labels, roles in sentence case without "(client)" in the text, no "trains Gemini" wording, a card text that
// fits instead of ending in "…", one number per phase, and the slide count kept (19 of 20).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
function loadCode(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 10, 2026" }, Session: { getScriptTimeZone: () => "UTC" } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Code.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const render = (g, s) => g.ENGINE.render({ slides: [s] }, { dateLabel: "x" })[0];
const texts = (out) => out.els.filter((e) => e.t === "text").map((e) => e.text);

test("statement slide: side points without a heading show their text only; a proposal keeps the cream background", () => {
  const g = loadCode();
  const s = { type: "statement", title: "The AI imperative", statement: "AI is an immediate necessity for retail service.", text: "Early adopters see returns.",
    points: [{ title: "", text: "Retailers increased their AI spending by an average of 19% in 2025." }, { title: "", text: "Nearly 60% of retailers reported a positive ROI from AI." }] };
  const out = render(g, Object.assign({ deckLibrary: "proposal", cobrand: true }, s));
  assert.ok(!texts(out).some((t) => /object Object/.test(t)), "no [object Object]");
  assert.ok(texts(out).some((t) => /Nearly 60% of retailers/.test(t)));
  assert.equal(out.bg, render(g, { type: "cards", deckLibrary: "proposal", cobrand: true, title: "x", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }, { title: "e", text: "f" }] }).bg);
  assert.ok(texts(render(g, Object.assign({}, s, { points: ["Plain string point", "Another point"] }))).includes("Plain string point"));
});

test("voice: direct statements, whole figures, no slash labels, roles in sentence case, no '(client)' text, no training claims", () => {
  const g = loadCode();
  assert.equal(g.directStatement_("AI is no longer a future concept; it is an immediate necessity for competitive retail customer service."),
    "AI is an immediate necessity for competitive retail customer service.");
  assert.equal(g.directStatement_("Support is not just faster, but more personal."), "Support is more personal.");
  g.setRunNames_("Create a proposal deck for Apple.", ["Apple"]);
  const slides = [
    { type: "stats", title: "Business outcomes", items: [{ value: "24.6%", label: "Increase in customer satisfaction" }, { value: "61", label: "Maintain/Exceed NPS" }, { value: "28%", label: "Reduction in churn" }] },
    { type: "table", title: "Team structure", columns: ["Role", "Responsibility"], rows: [
      ["Engagement Lead", "Primary point of contact."], ["AI/ML Engineer", "Develops, trains, and deploys Gemini and Vertex AI Search models, ensuring accuracy."],
      ["Retail operations lead (Apple)", "Represents retail needs and champions adoption. (client)"], ["IT security lead (client)", "Ensures compliance."]] }
  ];
  g.finalVoicePass_(slides, { userPrompt: "Create a proposal deck for Apple.", clientName: "Apple" });
  assert.equal(slides[0].items[0].value, "25%");
  assert.equal(slides[0].items[1].label, "Maintain or exceed NPS");
  const rows = slides[1].rows;
  assert.deepEqual(rows.map((r) => r[0]), ["Engagement lead", "AI/ML engineer", "Retail operations lead (Apple)", "IT security lead (Apple)"]);
  assert.equal(rows[1][1], "Develops, configures, and deploys Gemini and Vertex AI Search, ensuring accuracy.");
  assert.equal(rows[2][1], "Represents retail needs and champions adoption.");
  assert.match(read("src/Code.gs"), /never write that anyone trains them or builds "Vertex AI Search models"/);
});

test("one outcome slide: a new slide on a topic the deck already has is not used; the deck keeps its slide count", () => {
  const outcome = { type: "stats", title: "Business outcomes: elevating customer satisfaction", items: [{ value: "25%", label: "Increase in CSAT" }, { value: "28%", label: "Lower churn" }] };
  const fresh = [{ type: "stats", title: "Quantifiable business outcome targets", items: [{ value: "25%", label: "Target: faster resolution" }, { value: "15%", label: "Target: more self-service" }] }];
  const g = loadCode({ callGeminiJSON: (parts) => (/should be removed/.test(parts[0].text) ? { remove: [] } : { slides: JSON.parse(JSON.stringify(fresh)) }) });
  const body = (t, ty) => ({ type: ty || "cards", title: t, items: [{ title: t + " one", text: "words " + t }, { title: t + " two", text: "more " + t }] });
  const plan = { deck_title: "x", slides: [{ type: "cover", title: "x" }, { type: "agenda", title: "Agenda", items: [] }, body("Retail support challenges"),
    outcome, body("Agent assist for specialists"), body("Agent assist for specialists in stores"), { type: "closing", title: "Thank You!" }] };
  const ctx = { userPrompt: "A proposal for Apple retail support", apiKey: "k", log: [], brand: { name: "66degrees" } };
  g.replaceDuplicateSlides_(plan, ctx);
  assert.equal(plan.slides.length, 7, "slide count kept");
  assert.equal(plan.slides.filter((s) => g.topicFamily_(s) === "impact").length, 1, "one outcome slide");
  assert.ok(ctx.log.some((l) => /it stays/.test(l)), "the repeat stays when nothing new can replace it");
});

test("phases counted by their labels get no second number; card texts shrink half a point before they are cut", () => {
  const g = loadCode();
  const tl = render(g, { type: "timeline", title: "Phased plan", items: ["Discovery", "Pilot in one region", "Scale"].map((t, i) => ({ label: "Phase " + (i + 1), title: t, text: "Some words about " + t })) });
  assert.ok(!texts(tl).some((t) => /^0\d$/.test(t)), "no 01 / 02 / 03 under Phase 1 / 2 / 3");
  const dated = render(g, { type: "timeline", title: "Plan", items: ["A", "B", "C"].map((t, i) => ({ date: "Q" + (i + 1), title: t, text: "x" })) });
  assert.ok(texts(dated).includes("01"), "other labels keep the numbers");
  const long = "Provide instant, accurate answers and guided solutions through AI-powered virtual agents and intelligent search on every channel customers use, from chat to the Apple Store app.";
  const cards = render(g, { type: "cards", title: "Solution: AI-powered retail customer support", lead: "We propose a holistic approach leveraging Google Cloud AI to enhance customer experience and operational efficiency across the retail ecosystem.",
    items: [long, "Equip specialists with real-time AI insights, suggestions and summaries.", "Use AI to understand intent and context for tailored experiences.", "Analyze interaction data to find trends and improve processes.", "Protect data with enterprise-grade security and compliance."].map((t, i) => ({ title: "Card " + i, text: t, icon: "ai" })) });
  assert.ok(!texts(cards).some((t) => /…$/.test(t)), "no card text cut with an ellipsis");
});
