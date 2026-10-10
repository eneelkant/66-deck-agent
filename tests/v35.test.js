"use strict";

// V.1_35: review of the "Flow chart deck Fixed" (Flowchart tab) and Create deck 9 ("Cloud cost optimization for strategic
// growth", 18 slides); agenda from 01 Introduction to Thank you; the sidebar's Presentation Type list.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FLOW9 = require("./fixtures/flow9-specs.js");

function loadCode(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 9, 2026" }, Session: { getScriptTimeZone: () => "UTC" } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Code.gs", "src/Diagram.gs", "src/DiagramDesignKit.gs", "src/DiagramDesign.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const irOf = (g, i) => g.ddSpecToIr_(JSON.parse(JSON.stringify(FLOW9[i])), FLOW9[i].type, "t");
const AREA = { x: 40, y: 92, w: 640, h: 260 };

/* ---------- Flowchart: words ---------- */

test("diagram leads: no 'This diagram illustrates', no shouted words or Title Case runs, never cut mid-word, full stop", () => {
  const g = loadCode();
  const a = irOf(g, 0).lead, b = irOf(g, 1).lead;
  [a, b].forEach((l) => {
    assert.doesNotMatch(l, /^(this|the) diagram/i);
    assert.match(l, /\.$/);
    assert.ok(l.length <= 150, l);
  });
  assert.doesNotMatch(b, /IDEA|DESIGN|BUILD|Agent Factory/);
  assert.match(b, /idea, design, build, validate, and deploy/);
  assert.match(g.ddLead_("THE GOVERNANCE BOARDS and DevSecOps review each RELEASE."), /^The governance boards and DevSecOps review each release\.$/, "known names keep their capitals");
  assert.equal(g.ddLead_("This diagram shows how Vertex AI and BigQuery feed the Gemini Enterprise app."), "Vertex AI and BigQuery feed the Gemini Enterprise app.");
  // a 140-character cut used to end in "the central govern"
  assert.doesNotMatch(a, /\bgovern\.$|\bcen\.$/);
});

test("flowchart cover: a real title (not the description sentence), sentence-case subtitle with whole titles only", () => {
  const g = loadCode();
  const read9 = { shows: ["The diagram illustrates an IT-managed AI governance framework for accelerating AI development with forward deployed engineers."],
    diagrams: [0, 1, 2, 3].map((i) => irOf(g, i)) };
  read9.diagrams[0].title = "IT-Managed AI Governance Framework Overview";
  const specs = g.flowchartDeckSpecs_("", read9, "deck.pptx");
  const cover = specs[0];
  assert.equal(cover.title, "IT-managed AI governance framework");
  assert.match(cover.subtitle, /^4 diagrams: IT-managed AI governance framework overview · /);
  assert.ok(cover.subtitle.length <= 150);
  cover.subtitle.replace(/^4 diagrams: /, "").replace(/ and \d more$/, "").split(" · ").forEach((t) => assert.ok(read9.diagrams.some((d) => g.sentenceCase_(d.title, 2).startsWith(t.slice(0, 10))), t));
  assert.deepEqual(Array.from(specs.map((s) => s.type)), ["cover", "diagram", "diagram", "diagram", "diagram", "closing"]);
  assert.equal(specs[5].subtitle, cover.title, "Thank-you subtitle is the clean cover title");
  read9.topics = ["Governed AI development with an agent factory"];
  assert.equal(g.flowchartDeckSpecs_("create a flowchart from this", read9, "")[0].title, "Governed AI development with an agent factory");
});

/* ---------- Flowchart: pictures ---------- */

function draw(g, i) {
  const ir = irOf(g, i);
  return { ir, els: g.drawDiagramDesign_(ir, AREA) };
}
const segs = (els) => els.filter((e) => e.t === "line");
const overlapping = (p, q) => {
  const hp = p.y1 === p.y2, hq = q.y1 === q.y2;
  if (hp !== hq) return false;
  if (hp) return Math.abs(p.y1 - q.y1) < 0.5 && Math.min(Math.max(p.x1, p.x2), Math.max(q.x1, q.x2)) - Math.max(Math.min(p.x1, p.x2), Math.min(q.x1, q.x2)) > 1;
  return Math.abs(p.x1 - q.x1) < 0.5 && Math.min(Math.max(p.y1, p.y2), Math.max(q.y1, q.y2)) - Math.max(Math.min(p.y1, p.y2), Math.min(q.y1, q.y2)) > 1;
};

test("supporting row (controls under a flow): each control has its own channel, no two arrows share a line, nothing loops round the outside", () => {
  const g = loadCode();
  [1, 3].forEach((i) => {
    const { ir, els } = draw(g, i);
    const L = segs(els);
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) assert.ok(!overlapping(L[a], L[b]), "slide " + (i + 2) + ": shared line " + JSON.stringify([L[a], L[b]]));
    const boxes = els.filter((e) => e.nodeId);
    const left = Math.min(...boxes.map((b) => b.x)), right = Math.max(...boxes.map((b) => b.x + b.w));
    L.forEach((l) => assert.ok(Math.min(l.x1, l.x2) >= left - 0.5 && Math.max(l.x1, l.x2) <= right + 0.5, "no loop outside the boxes"));
    // every control -> step arrow arrives from below with a head
    const heads = L.filter((l) => l.arrow && l.x1 === l.x2 && l.y2 < l.y1);
    const want = ir.edges.filter((e) => ir.nodes.find((n) => n.id === e.from).kind === "service").length;
    assert.equal(heads.length, want);
  });
});

test("a box with no arrows that wraps everything becomes a frame round the diagram", () => {
  const g = loadCode();
  const { ir, els } = draw(g, 2);
  assert.equal(ir.wrapper, "Unified governance & risk management wrapper");
  assert.ok(!ir.nodes.some((n) => /wrapper/i.test(n.label)), "not drawn as an orphan box");
  const frame = els.find((e) => e.zone && e.t === "rect");
  const boxes = els.filter((e) => e.nodeId);
  boxes.forEach((b) => assert.ok(b.x >= frame.x && b.y >= frame.y && b.x + b.w <= frame.x + frame.w && b.y + b.h <= frame.y + frame.h));
  assert.ok(els.some((e) => e.t === "text" && e.text === ir.wrapper));
});

test("two outputs of one box share a fork (no 3pt jogs); repositories are stores; one label size", () => {
  const g = loadCode();
  const { els } = draw(g, 2);
  const L = segs(els);
  L.forEach((l) => { const len = Math.abs(l.x2 - l.x1) + Math.abs(l.y2 - l.y1); assert.ok(len === 0 || len >= 5, "tiny jog " + JSON.stringify(l)); });
  const one = draw(g, 0);
  assert.deepEqual(Array.from(one.els.filter((e) => /repository/.test(e.text || "")).map((e) => e.shape)), ["FLOW_CHART_MAGNETIC_DISK", "FLOW_CHART_MAGNETIC_DISK"]);
  const sizes = new Set(one.els.filter((e) => e.nodeId && e.shape !== "FLOW_CHART_DECISION" && e.shape !== "FLOW_CHART_INPUT_OUTPUT").map((e) => e.textStyle.size));
  assert.deepEqual(Array.from(sizes), [10], "boxes grow a little rather than dropping a label to 9pt");
});

test("a picture that repeats an earlier one (same boxes) is left out", () => {
  const g = loadCode();
  assert.ok(g.ddSameness_(irOf(g, 1), irOf(g, 3)) >= 0.7);
  assert.ok(g.ddSameness_(irOf(g, 0), irOf(g, 2)) < 0.7);
  const src = read("src/DiagramDesign.gs");
  assert.match(src, /ALREADY ON EARLIER SLIDES/);
  assert.match(src, /it repeats/);
});

/* ---------- Create: words, icons, topics ---------- */

test("voice pass: filler sentences anywhere, figures in headings, Google Cloud terms, DevOps, sales words in titles", () => {
  const g = loadCode();
  const S = [
    { type: "process", title: "Our proven cloud cost optimization methodology", items: [{ title: "Assess", text: "We analyse spend across projects. This phase includes a full inventory. This ensures nothing is missed." }] },
    { type: "cards", title: "Quantifiable impact of effective optimization", items: [{ title: "Faster time-to-market (30-50% range)", text: "Teams ship faster. This enhances market responsiveness." }] },
    { type: "diagram", title: "Common pitfalls", items: [{ title: "Missed commitments", text: "Failing to leverage reserved instances or savings plans." }, { title: "Engineering and devops", text: "No Cost Explorer reviews." }] },
    { type: "table", title: "Proactive resource and commitment optimization", columns: ["Topic", "What it means"], rows: [["Rightsizing", "Match machine types to use. We help you forecast demand."]] }
  ];
  g.finalVoicePass_(S, { userPrompt: "Cloud cost optimization for strategic growth" });
  assert.equal(S[0].title, "Cloud cost optimization methodology");
  assert.equal(S[0].items[0].text, "We analyse spend across projects.");
  assert.equal(S[1].title, "Impact of effective optimization", "no numbers on the slide: not 'quantifiable'");
  assert.equal(S[1].items[0].title, "Faster time-to-market");
  assert.equal(S[1].items[0].text, "Teams ship faster.");
  assert.equal(S[2].items[0].text, "Failing to leverage committed use discounts.");
  assert.equal(S[2].items[1].title, "Engineering and DevOps");
  assert.match(S[2].items[1].text, /Cloud Billing reports/);
  assert.deepEqual(Array.from(S[3].columns), ["Lever", "How it works"]);
  assert.equal(S[3].rows[0][1], "Match machine types to use.");
  const aws = [{ type: "cards", title: "x", items: [{ title: "a", text: "Use reserved instances." }] }];
  g.finalVoicePass_(aws, { userPrompt: "Cost optimization on AWS" });
  assert.match(aws[0].items[0].text, /reserved instances/, "kept when the request is about AWS");
});

test("every card gets its own meaningful icon (no repeated light bulbs, no '!' badges)", () => {
  const g = loadCode();
  const sp = { type: "cards", title: "Risks of unmanaged cloud spending", items: [
    { title: "Budget overruns", text: "x", icon: "idea" }, { title: "Reduced innovation", text: "x", icon: "idea" },
    { title: "Security vulnerabilities", text: "x" }, { title: "Operational inefficiencies", text: "x" }] };
  g.distinctIcons_(sp);
  const icons = sp.items.map((i) => i.icon);
  assert.deepEqual(Array.from(icons), ["wallet", "rocket", "security", "gauge"]);
  const eng = read("src/Engine.gs");
  const v = eng.slice(eng.indexOf("V['66D_LAYOUT_CARDS_024']"), eng.indexOf("TEMPLATE DESIGNS: DIAGRAMS"));
  assert.match(v, /icon\(els, autoIcon\(it\), c\.x \+ 17, c\.y \+ 17, 12, true, '!'\)/);
});

test("unrequested credentials are caught by their content; off-topic AI slides are replaced; replacements have spares", () => {
  const g = loadCode();
  const cred = { type: "cards", title: "Partnering for sustained cloud financial excellence", items: [{ title: "Expertise", text: "350+ experts and 600+ Google Cloud certifications." }, { title: "Impact", text: "Google's Preferred Partner for Enterprise AI." }] };
  assert.ok(g.credentialsContent_(cred));
  assert.ok(!g.credentialsContent_({ type: "cards", title: "Key decisions", items: [{ title: "Tagging", text: "Label every project." }] }));
  assert.ok(g.offTopicAi_({ title: "AI adoption increases cost complexity" }, "Cloud cost optimization for strategic growth"));
  assert.ok(!g.offTopicAi_({ title: "AI adoption increases cost complexity" }, "AI cost management"));
  const src = read("src/Code.gs");
  assert.match(src, /'Write ' \+ \(dupIdx\.length \+ 3\) \+ ' NEW body slide/);
  assert.match(src, /finalVoicePass_\(plan\.slides, ctx\);[^\n]*\n\s+plan\.slides = enforceDeckStructure_/);
});

test("design fixes: donut centre keeps hyphenated words; the tree design takes pairs only; the menu design shows each point's explanation", () => {
  const g = loadCode();
  assert.equal(g.centerLabel_("Cross-functional roles in FinOps"), "Cross-functional roles");
  const it = (n) => Array.from({ length: n }, (_, i) => ({ title: "Pillar " + i, text: "Some words about it." }));
  const tree = (n) => g.ENGINE.canDraw({ type: "diagram", title: "x", items: it(n), reference: { tag: "66D_LAYOUT_DIAGRAM_008" } });
  assert.equal(tree(5), false);
  assert.equal(tree(4), true);
  const spec = { type: "bullets", title: "Cloud waste", reference: { tag: "66D_LAYOUT_BULLETS_001" }, points: ["Increased waste: Idle resources keep running.", "Rapid adoption: Projects grow faster than reviews.", "New focus: Finance and engineering share one view."], callout: { title: "t", text: "x" } };
  const out = g.ENGINE.render({ slides: [spec] }, { dateLabel: "x" })[0];
  const texts = out.els.filter((e) => e.t === "text").map((e) => e.text);
  assert.ok(texts.includes("Idle resources keep running."));
  assert.ok(texts.includes("Increased waste"));
});

/* ---------- Agenda and the Presentation Type list ---------- */

test("agenda: 01 Introduction ... Thank you, up to 20 rows", () => {
  const g = loadCode();
  const body = Array.from({ length: 17 }, (_, i) => ({ type: "cards", title: "Topic " + (i + 1) }));
  const slides = [{ type: "cover", title: "c" }, { type: "agenda", title: "Agenda", items: [] }].concat(body, [{ type: "closing", title: "Thank You!" }]);
  g.syncAgendaToSlides_(slides);
  const items = slides[1].items;
  assert.equal(items.length, 19);
  assert.equal(items[0].title, "Introduction");
  assert.equal(items[18].title, "Thank you");
  const out = g.ENGINE.render({ slides: [slides[1]] }, { dateLabel: "x" })[0];
  const nums = out.els.filter((e) => e.t === "text" && /^\d\d$/.test(e.text)).map((e) => e.text);
  assert.equal(nums[0], "01");
  assert.equal(nums[nums.length - 1], "19");
  assert.match(read("src/Code.gs"), /agendaItems\.unshift\(\{ title: 'Introduction'/, "long decks too");
});

test("Presentation Type: label, the five types in order, guidance for each", () => {
  const g = loadCode();
  assert.deepEqual(Array.from(g.DECK_TYPES_), ["Proposal Deck", "HR Leadership, Internal", "General", "Delivery Deck", "Solution Deck"]);
  g.DECK_TYPES_.forEach((t) => assert.ok(g.DECK_TYPE_GUIDANCE_[t], t));
  assert.match(g.DECK_TYPE_GUIDANCE_["HR Leadership, Internal"], /no 66degrees credentials/);
  const html = read("src/Generator.html");
  assert.match(html, /<label for="presentationType">Deck type<\/label>/);   // V.1_41: "Presentation Type" -> "Deck type"
  assert.doesNotMatch(html, /<label for="presentationType">Type<\/label>/);
  assert.equal(g.normalizePresentationType_(""), "General");
});
