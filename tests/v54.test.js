"use strict";

// V.1_54 (Harbourline Water Utility, deck 25 audit) - every topic the request lists gets its own slide (a section title no
// longer covers it); a short Solution outline is filled with the request's topics and solution topics of its tone, never
// the Proposal list (risks, KPIs, scope, assumptions, testing, change management); every slide is drawn from the Solution
// library (also slides added late); dark slides also in decks with dark dividers; the slide's words choose its design
// (layers -> layer stack, architecture -> architecture, priorities -> priority table); headings without text get their
// text; roadmaps are phases (no Gantt); risks are issue rows; architecture slides become diagrams; no "proposal" on the
// cover; the client's name, region ids and mixed-case names keep their case; code blocks stay as written.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

// The whole add-on in one sandbox, with Slides / Drive / Gemini mocked
function loadAll(gemini, seed, clock) {
  let sd = seed || 1;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const slides = [], drawn = [], props = {}, uprops = {}, files = {};
  let sid = 0; const mkSlide = () => { const id = "s" + (sid++); const o = { getObjectId: () => id, remove() { const j = slides.indexOf(o); if (j >= 0) slides.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; return o; };
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n",
    insertSlide(i, s) { const c = mkSlide(); slides.splice(i, 0, c); return c; }, getSlideById: (x) => slides.find((q) => q.getObjectId() === x) || null };
  // V.1_51: long proposal decks are drawn in a hidden working copy and inserted into the presentation at the end
  const works = {};
  const mkWork = (name) => { const ws = []; const id = "W" + Object.keys(works).length; let k = 0;
    const mk = () => { const s = { getObjectId: () => s._id, remove() { const j = ws.indexOf(s); if (j >= 0) ws.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; s._id = id + "_" + (k++); return s; };
    const w = { name, getSlides: () => ws, getId: () => id, getPageWidth: () => 720, getPageHeight: () => 405, saveAndClose() {},
      appendSlide() { const s = mk(); ws.push(s); return s; }, getSlideById: (x) => ws.find((q) => q.getObjectId() === x) || null };
    ws.push(mk()); works[id] = w; return w; };
  const RealDate = Date;
  const FD = class extends RealDate { static now() { return RealDate.now() + (clock ? clock.off : 0); } };
  const sb = { console, Math: M, JSON, Date: clock ? FD : Date, Logger: { log() {} },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" }, create: (n) => mkWork(n),
      openById: (id) => { if (works[id]) return works[id]; throw new Error("no deck " + id); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty(k, v) { props[k] = v; } }),
      getUserProperties: () => ({ getProperty: (k) => uprops[k] || null, setProperty(k, v) { uprops[k] = v; }, deleteProperty(k) { delete uprops[k]; } }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 14, 2026", sleep() {}, newBlob: () => ({}), base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), searchFiles: () => ({ hasNext: () => false }), getFolderById: () => { throw new Error("no folder"); },
      createFile: (n, j) => { const id = "F" + Object.keys(files).length; files[id] = j; return { getId: () => id, setContent(x) { files[id] = x; }, setTrashed() {} }; },
      getFileById: (id) => ({ setContent(x) { files[id] = x; }, setTrashed() {}, getBlob: () => ({ getDataAsString: () => files[id] }) }),
      createFolder: () => ({ createFile: () => ({ getId: () => "LOGO1" }) }) },
    UrlFetchApp: { fetch: () => { throw new Error("no net"); } } };
  vm.createContext(sb);
  ORDER.forEach((f) => vm.runInContext(read("src/" + f), sb, { filename: f }));
  Object.assign(sb, {
    loadRunContext_(ctx) { ctx.apiKey = "k"; ctx.brand = JSON.parse(JSON.stringify(sb.DEFAULT_BRAND)); ctx.assets = { design: {}, logos: {}, patterns: {}, icons: [] }; ctx.lib = null; ctx.tokens = null; },
    callGeminiJSON: (parts) => gemini(parts[0].text || ""),
    researchTopic_: () => ({ research: [] }),
    renderEngineSlide(slide, spec) { drawn.push(JSON.parse(JSON.stringify(spec))); },
    insertTemplateSlide_: () => false
  });
  sb.drawn = drawn;
  sb.pres = pres;
  sb.works = works;
  return sb;
}
const ev = (sb, code) => vm.runInContext(code, sb);

const SAMPLES = JSON.parse(read("tests/fixtures/solution-samples.json"));
const SHARED = ["P66_SECTION_DARK", "P66_SECTION_LIGHT"];

// A Solution Deck run with Gemini mocked: the outline follows the asked sections; each slide takes the first design
// offered for it, filled from the fixture sample of that design
function runSolution(n, prompt, seed, opts) {
  opts = opts || {};
  const bySample = {}; SAMPLES.forEach((s) => { bySample[s.reference.tag] = s; });
  const used = {}; const prompts = { outline: "", parts: [], short: "" };
  const fill = (type, title, list) => {
    const tags = String(list || "").split(",").map((x) => x.trim()).filter((t) => bySample[t]);
    const tag = tags.find((t) => !used[t]) || tags[0];
    if (!tag) return { type, title, lead: "Lead.", items: [{ title: "One", text: "First text about the solution." }, { title: "Two", text: "Second text about the solution." }, { title: "Three", text: "Third text about the solution." }] };
    used[tag] = 1; const s = JSON.parse(JSON.stringify(bySample[tag])); delete s.reference;
    return Object.assign(s, { design: tag, title, notes: "Notes." });
  };
  const sb = loadAll((t) => {
    if (/Who is the CLIENT/.test(t)) return { client: "Nordlys Energi", domain: "nordlys.no", confident: true };
    if (opts.outline && /Plan the OUTLINE/.test(t)) { prompts.outline = t; return JSON.parse(JSON.stringify(opts.outline)); }
    if (/Write exactly \d+ NEW slides/.test(t) && opts.noTopUp) return { slides: [] };
    if (/Write exactly \d+ NEW slides/.test(t)) { const k = +t.match(/Write exactly (\d+)/)[1]; return { slides: Array.from({ length: k }, (x, i) => ({ type: ["process", "table", "diagram", "cards"][i % 4], title: "Extra grid topic " + (i + 1), message: "m", points: ["p"], section: 1 + (i % 2) })) }; }
    if (/Plan the OUTLINE/.test(t)) {
      prompts.outline = t;
      const body = +(t.match(/BODY SLIDES: exactly (\d+)/) || [0, n])[1], ns = +(t.match(/grouped into (\d+) sections/) || [0, 2])[1];
      const titles = ["Why grid forecasting needs to change", "What we built", "What we proved", "How to run it"].slice(0, ns);
      const per = Math.max(1, Math.floor(body / titles.length)); let k = 0;
      const types = ["table", "comparison", "cards", "stats", "process", "cards", "table", "process"];
      return { deck_title: "Grid forecasting for Nordlys Energi", subtitle: "Load forecasting on BigQuery and Vertex AI", closing_subtitle: "Ready for the pilot",
        sections: titles.map((title, i) => ({ title, description: "What part " + (i + 1) + " shows", storyline: "Part " + (i + 1) + " proves one thing.",
          slides: Array.from({ length: i === titles.length - 1 ? body - per * (titles.length - 1) : per }, () => { k++; return { type: types[k % types.length], title: "Grid topic " + k, message: "Message " + k, points: ["Point a" + k, "Point b" + k] }; }) })) };
    }
    if (/THIS IS PART OF A LONG DECK/.test(t)) {
      prompts.parts.push(t);
      const L = t.split("\n"); const out = [];
      L.forEach((l, i) => { const m = l.match(/^\d+\. type "([^"]*)" \| title "([^"]*)"/); if (!m) return;
        let list = ""; for (let j = i + 1; j < Math.min(L.length, i + 5); j++) { const q = L[j].match(/designs to choose from: (.*)/); if (q) { list = q[1]; break; } if (/^\d+\. type/.test(L[j])) break; }
        const sp = opts.special && opts.special(m[1], m[2]); out.push(sp ? Object.assign(sp, { notes: "Notes." }) : fill(m[1], m[2], list)); });
      return { slides: out };
    }
    if (/DESIGN MENU/.test(t)) {
      prompts.short = t;
      const k = +(t.match(/exactly (\d+) slides/i) || [0, n])[1];
      const tags = SAMPLES.map((s) => s.reference.tag).filter((x) => /^S66_/.test(x) && x !== "S66_AGENDA_ROWS");
      return { deck_title: "Nordlys", slides: Array.from({ length: k }, (x, i) => fill("cards", "Short topic " + (i + 1), tags.slice(i * 2).join(","))) };
    }
    return {};
  }, seed || 1);
  let r = sb.generatePresentation({ mode: "create", presentationType: "Solution Deck", slideCount: n, clientName: "Nordlys Energi", clientDomain: "nordlys.no",
    prompt: prompt || "Create a solution deck for Nordlys Energi: technical tone. Grid load forecasting on BigQuery and Vertex AI, data pipelines, model tests and a run book.", runId: "R52" });
  let guard = 0; while (r && r.continue && guard++ < 20) r = sb.continueDeckGeneration(r.runId);
  return { sb, r, drawn: sb.drawn, prompts };
}
const tagOf = (d) => (d.reference && d.reference.tag) || "";


const SOL = () => loadAll(() => ({}));
const render1 = (sb, spec) => sb.ENGINE.render({ slides: [Object.assign({ deckLibrary: "solution" }, spec)] }, { dateLabel: "Oct 17, 2026" })[0];
const PROPOSAL_FILLER = /^(Key risks and how we mitigate them|How we will measure success|Scope: what is in and what is out|Assumptions and dependencies|Testing and quality assurance|Change management and adoption|Success criteria for the pilot|Training plan for users)$/;
const D25_PROMPT = "Create a solution deck for Harbourline Water Utility: technical tone. Smart-meter leak detection on Google Cloud: meter readings streamed through Pub/Sub and Dataflow into BigQuery, leak prediction with Vertex AI, the reference architecture, a primary and DR region design, security controls (IAM, VPC Service Controls, CMEK), today's manual leak surveys vs automated alerts, the deployment layers with Terraform, day-2 runbooks, support priorities, and the next step.";
const D25_OUTLINE = { deck_title: "Smart leak detection on Google Cloud", subtitle: "A technical solution proposal for Harbourline Water Utility", closing_subtitle: "Thank you for your time",
  sections: [
    { title: "Current state and ingestion pipeline", description: "Manual surveys and the automated approach", slides: [["cards", "Manual surveys are reactive and resource-intensive"], ["process", "Streaming meter data into a central data warehouse"]] },
    { title: "Solution architecture and prediction", description: "The technical design for leak detection", slides: [["diagram", "High availability with primary and DR regions"]] },
    { title: "Security, deployment, and business impact", description: "How the solution is secured and deployed", slides: [["cards", "Securing data with defense-in-depth"], ["process", "Infrastructure as code with Terraform"]] },
    { title: "Operations, support, and next steps", description: "How the solution is run", slides: [["statement", "Initiate a design and planning workshop"], ["process", "Streamlining day-2 operations with runbooks"]] }]
    .map((s) => Object.assign({}, s, { storyline: s.description, slides: s.slides.map(([type, title]) => ({ type, title, message: "Covers " + title.toLowerCase(), points: ["p"] })) })) };

test("version label is V.1_54 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[4-9]|[6-9]\d)'/);
});

test("deck 25 replayed: every listed topic has its own slide and no Proposal filler is added", () => {
  const { drawn, r } = runSolution(20, D25_PROMPT, 2, { outline: D25_OUTLINE, noTopUp: true });
  assert.equal(drawn.length, 20);
  const titles = drawn.filter((d) => d.type !== "section").map((d) => d.title);
  assert.deepEqual(titles.filter((t) => PROPOSAL_FILLER.test(t)), [], "no risks / KPIs / scope / assumptions / testing / change management");
  [/architecture/i, /prediction|vertex ai/i, /priorit/i, /\bvs\b|versus|compared/i, /layers/i, /runbook/i, /regions?/i].forEach((re) =>
    assert.ok(titles.some((t) => re.test(t)), "a slide for " + re + " in: " + titles.join(" | ")));
  assert.equal(titles.filter((t) => /secur/i.test(t)).length, 1, "security once (the topic counts as covered): " + titles.join(" | "));
  assert.equal(titles.filter((t) => /next step|workshop/i.test(t)).length, 1, "one next step");
  const cover = drawn[0];
  assert.ok(!/proposal/i.test(cover.title + " " + cover.subtitle), "no 'proposal' on the cover: " + cover.subtitle);
  assert.ok(!/thank/i.test(drawn[drawn.length - 1].subtitle || ""), "the Thank-you subtitle is not a second thank you");
  assert.ok(drawn[drawn.length - 1].subtitle, "the Thank-you slide has its subtitle");
  drawn.forEach((d) => {
    if (/cover|agenda|closing/.test(d.type)) return;
    assert.equal(d.deckLibrary, "solution");
    const o = render1(SOL(), d);
    assert.ok(/^(S66_|P66_SECTION_)/.test(o.drawnWith || ""), d.title + " drawn with " + o.drawnWith);
  });
  assert.match(r.message, /no client logo/);
});

test("a short Solution outline is filled from solution topics of its tone, never the Proposal list", () => {
  const sb = SOL();
  ["technical", "executive", "offering", "enablement", "internal"].forEach((tone) => {
    const list = sb.solutionBacklog_(tone, "x");
    assert.ok(list.length >= 3);
    list.forEach((b) => assert.ok(!PROPOSAL_FILLER.test(b.title), tone + ": " + b.title));
  });
  assert.equal(sb.solutionTopicEntry_("the reference architecture").type, "diagram");
  assert.equal(sb.solutionTopicEntry_("support priorities").type, "table");
  assert.equal(sb.solutionTopicEntry_("today's manual leak surveys vs automated alerts").type, "comparison");
  assert.equal(sb.solutionTopicEntry_("day-2 runbooks").type, "process");
  assert.equal(sb.solutionTopicEntry_("the deployment layers with Terraform").type, "diagram");
  assert.equal(sb.solutionTopicEntry_("next step").title, "The next step");
  assert.equal(sb.solutionTopicCovered_([{ type: "cards", title: "Securing data with defense-in-depth" }], "security controls (IAM / VPC Service Controls / CMEK)"), true);
  assert.equal(sb.solutionTopicCovered_([{ type: "statement", title: "Initiate a design and planning workshop" }], "next step"), true);
  assert.equal(sb.solutionTopicCovered_([{ type: "cards", title: "Securing data" }], "support priorities"), false);
  assert.equal(sb.outlineChecks_([{ type: "statement", title: "Next steps: a pilot on one district" }], "A deck about leaks", 20, null, { solution: true, tone: "technical" }).length, 0, "a Solution Deck keeps its next step");
});

test("near-duplicate check ignores the words of the deck's subject", () => {
  const sb = SOL();
  const sl = ["Leak alerts from smart meters", "Smart meter leak data in BigQuery", "Leak prediction from meter flow", "Leak dashboards for meter teams", "Meter leak runbooks"].map((t) => ({ type: "cards", title: t, message: t }));
  assert.equal(sb.solutionOutlineChecks_(sl, "leak detection with smart meters", "technical", []).length, 0);
});

test("dark slides also come in decks whose dividers are dark", () => {
  const sb = SOL();
  const specs = [{ type: "cover" }, { type: "agenda" }];
  for (let s = 0; s < 4; s++) {
    specs.push({ type: "section", reference: { tag: "P66_SECTION_DARK" } });
    for (let i = 0; i < 4; i++) specs.push({ type: "cards", reference: { tag: "S66_ICON_CARD_GRID" } });
  }
  const n = sb.solutionDarkRhythm_(specs, { presentationType: "Solution Deck", proposal: {} });
  assert.ok(n >= 2, "dark body slides: " + n);
  specs.forEach((sp, i) => { if (sp.dark) assert.ok(specs[i - 1].type !== "section" && !specs[i - 1].dark, "never right after a dark divider or a dark slide"); });
});

test("the slide's words choose its design first", () => {
  const sb = SOL();
  const first = (title, type) => sb.proposalShortlist_({ type: type || "cards", title, tone: "technical" }, {}, "solution")[0].tag;
  assert.equal(first("Deployment layers with Terraform"), "S66_LAYER_STACK");
  assert.equal(first("Reference architecture on Google Cloud", "diagram"), "S66_ARCH_NUMBERED");
  assert.equal(first("Support priorities", "table"), "S66_PRIORITY_TABLE");
  assert.equal(first("Primary and DR regions", "diagram"), "S66_REGION_TOPOLOGY");
  assert.equal(first("Manual surveys vs automated alerts", "comparison"), "S66_TWO_MODE_COMPARE");
  assert.notEqual(first("Streamlining day-2 operations with runbooks"), "S66_ARCH_ICON_GRAPH", "streamlining is not a data stream");
  assert.ok(sb.proposalShortlist_({ type: "timeline", title: "Rollout roadmap" }, {}, "solution").length > 0, "a roadmap has Solution designs");
});

test("headings without text get their text; a Solution roadmap is phases; risks become issue rows; architecture becomes a diagram", () => {
  let asked = "";
  const sb = loadAll((t) => {
    asked += t;
    if (/look empty/.test(t)) { const list = JSON.parse(t.split("\n").pop()); return { fixes: list.map((x) => ({ id: x.id, add: x.has.map((h) => h + " runs on Google Cloud and is owned by the operations team.") })) }; }
    if (/show an architecture/.test(t)) { const list = JSON.parse(t.split("\n").pop()); return { slides: list.map((x) => ({ id: x.id, columns: [{ label: "Meters", items: [{ title: "Smart meters", text: "Readings" }] }, { label: "Platform", items: [{ title: "BigQuery", text: "Store" }] }, { label: "Teams", items: [{ title: "Dispatch", text: "Alerts" }] }], links: ["Readings", "Alerts"] })) }; }
    return {};
  });
  const ctx = { presentationType: "Solution Deck", apiKey: "k", log: [], brand: { name: "66degrees" }, userPrompt: "x" };
  const plan = { slides: [{ type: "cards", title: "Change management", items: [{ title: "Technical enablement" }, { title: "Internal advocates" }, { title: "Stakeholder alignment" }] },
    { type: "stats", title: "Targets", items: [{ label: "Accuracy" }] }] };
  sb.fillThinSlides_(plan, ctx);
  assert.ok(plan.slides[0].items.every((it) => /Google Cloud/.test(it.text)), "each heading got its text");
  assert.ok(!/"kind":"(kpis|kpivalues)"/.test(asked), "no invented targets in a Solution Deck");
  const tl = { type: "timeline", title: "Rollout", periods: ["Q1", "Q2", "Q3", "Q4"], lanes: [{ name: "Pilot", bars: [{ start: 1, end: 2, label: "One district" }] }, { name: "Rollout", bars: [{ start: 3, end: 4, label: "All districts" }] }] };
  sb.solutionTimelineAsProcess_(tl);
  assert.equal(tl.type, "process");
  assert.equal(tl.items[0].timing, "Q1–Q2");
  assert.ok(!tl.lanes && !tl.periods);
  const risks = [{ type: "cards", title: "Key risks", items: [{ title: "Data quality", mitigation: "Validate at ingestion" }, { title: "Model drift", mitigation: "Retrain monthly" }, { title: "Skills gap", mitigation: "Runbooks and training" }] }];
  sb.riskSlidesWithMitigations_(risks, ctx);
  assert.equal(risks[0].design, "S66_ISSUE_ROWS");
  assert.equal(risks[0].items[0].fix, "Validate at ingestion");
  const arch = [{ type: "cards", title: "Reference architecture", items: [{ title: "a", text: "b" }] }];
  sb.architectureAsDiagram_(arch, ctx);
  assert.equal(arch[0].type, "diagram");
  assert.equal(arch[0].design, "S66_ARCH_ICON_GRAPH");
  assert.match(asked, /solution deck/);
});

test("names and ids keep their case, code blocks stay as written, chips only for real owners, long fixes are shortened", () => {
  const sb = SOL();
  const sp = { type: "cards", title: "x", items: [{ title: "Zone A", text: "us-central1-a runs active compute" }, { title: "gMSA service identity", text: "gMSA rotates passwords" }], code: "SELECT a\nFROM t\nGROUP BY a" };
  sb.solutionDisplayCase_(sp);
  sb.solutionVoiceClean_(sp);
  assert.equal(sp.items[0].text, "us-central1-a runs active compute");
  assert.equal(sp.items[1].text, "gMSA rotates passwords");
  assert.equal(sp.code, "SELECT a\nFROM t\nGROUP BY a");
  const named = { title: "Integration with existing harbourline systems", items: [{ text: "harbourline billing and water usage" }] };
  sb.restoreName_(named, "Harbourline Water Utility");
  assert.equal(named.title, "Integration with existing Harbourline systems");
  assert.equal(named.items[0].text, "Harbourline billing and water usage", "a common word of the name (water) is left alone");
  const quad = render1(sb, { type: "cards", title: "Manual surveys", reference: { tag: "S66_QUAD_RULE_CARDS" }, items: [
    { title: "Process", text: "Field teams check for visible leaks.", tag: "Current state" }, { title: "Limitation", text: "Leaks found only during surveys.", tag: "Inefficiency" },
    { title: "Impact", text: "High non-revenue water.", tag: "Financial burden" }, { title: "Constraint", text: "Teams run at capacity.", tag: "Resource gap" }] });
  assert.equal(quad.drawnWith, "S66_QUAD_RULE_CARDS");
  assert.ok(!quad.els.some((e) => e.t === "text" && /Current state|Inefficiency/.test(e.text)), "no generic chips");
  const long = "Data validation at ingestion, anomaly detection in Dataflow and regular data audits. This ensures data quality from the source, preventing bad data from corrupting downstream processes. Automated checks identify unusual patterns across all meters.";
  const issues = render1(sb, { type: "cards", title: "Risks", reference: { tag: "S66_ISSUE_ROWS" }, items: [1, 2, 3, 4].map((i) => ({ title: "Risk " + i, fix: long })) });
  assert.equal(issues.drawnWith, "S66_ISSUE_ROWS");
  assert.ok(issues.els.some((e) => e.t === "text" && e.text === "Data validation at ingestion, anomaly detection in Dataflow and regular data audits."));
});

test("too much text never sends a Solution slide to a General layout", () => {
  const sb = SOL();
  const para = "This component processes every meter reading in near real time, enriches it with the district and pipe data, applies the leak rules and writes the result to the warehouse for the analysts and the model. ".repeat(3);
  const o = render1(sb, { type: "cards", title: "Too much text", items: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ title: "Component " + i, text: para })) });
  assert.match(o.drawnWith, /^S66_/, "drawn with " + o.drawnWith);
});

test("every slide is drawn from its library, also a slide added after the frame", () => {
  const src = read("src/Code.gs");
  assert.match(src, /if \(sp && String\(sp\.type \|\| ''\)\.toLowerCase\(\) !== 'template' && sp\.deckLibrary !== lib\) sp\.deckLibrary = lib;/);
  assert.match(src, /const backlog = solutionOutline && typeof solutionBacklog_ === 'function'/);
  assert.match(src, /section: solutionOutline \? '' : sc\.title/);
});
