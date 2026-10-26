"use strict";

// V.1_57 (decks 30: Solmara Ports, Sprouts Farmers Market, Halcyon Health) - short Proposal and Solution decks have no
// divider slides; a General agenda lists sections; requested topics are never replaced; Gantt, fan and half-donut labels
// never overlap (a design whose texts run into each other gives way); time points are not KPIs; icons fit their items;
// current product names; no unrequested 66degrees proof in a Solution deck; slides without notes get real notes.
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

// ---- the drawing engine alone (all libraries)
function engine() {
  const g = { console, Math, JSON, String, Array, Object, Number, Date, RegExp };
  vm.createContext(g);
  vm.runInContext(read("src/Engine.gs") + ";this.ENGINE=ENGINE;", g);
  fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^(Proposal|Solution)(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort().forEach((f) => vm.runInContext(read("src/" + f), g));
  vm.runInContext(read("src/Reference.gs"), g);
  return g;
}
const lay = (g, sp) => g.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (sl) => sl.els.filter((e) => e.t === "text").map((e) => e.text);
const ALL = () => loadAll(() => ({}));

test("version label is V.1_57 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[7-9]|[6-9]\d)'/);
});

test("decision 1-A: a Solution Deck under 18 slides has no divider slides; 18 and more keep them", () => {
  const short = runSolution(15);
  assert.equal(short.drawn.length, 15);
  assert.ok(!short.drawn.some((d) => d.type === "section"), short.drawn.map((d) => d.type).join(","));
  assert.ok(short.drawn.filter((d) => !["cover", "agenda", "closing"].includes(d.type)).length >= 12, "every slot holds content");
  const long = runSolution(20);
  assert.ok(long.drawn.some((d) => d.type === "section"), "a 20-slide deck keeps its dividers");
});

test("decision 2: a General agenda lists 3-5 sections with the slides they hold, counts in titles still checked", () => {
  const sb = ALL();
  const slides = [{ type: "cover", title: "AI at Halcyon Health" }, { type: "agenda", title: "Agenda", items: [] }]
    .concat(Array.from({ length: 8 }, (x, i) => ({ type: "cards", title: i === 7 ? "Five decisions leadership needs to make" : "Topic number " + (i + 1), items: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }, { title: "D", text: "d" }] })))
    .concat([{ type: "closing", title: "Thank you" }]);
  sb.callGeminiJSON = () => ({ sections: [{ title: "Why now", count: 3 }, { title: "Where it helps", count: 3 }, { title: "How to start", count: 2 }] });
  assert.equal(sb.generalAgendaSections_(slides, { log: [] }), true);
  const items = slides[1].items;
  assert.deepEqual(items.map((i) => i.title), ["Why now", "Where it helps", "How to start"]);
  assert.ok(!items.some((i) => /introduction|thank you/i.test(i.title)));
  assert.match(items[0].text, / · /);
  assert.match(slides[9].title, /^Four decisions/, "a count word matches the four items: " + slides[9].title);
  // a grouping that does not add up is not used
  const s2 = JSON.parse(JSON.stringify(slides)); s2[1].items = []; delete s2[1].sectionGroups;
  sb.callGeminiJSON = () => ({ sections: [{ title: "Why now", count: 3 }, { title: "Rest", count: 2 }] });
  assert.equal(sb.generalAgendaSections_(s2, { log: [] }), false);
});

test("Sprouts Gantt: Phase 1 gets its lane, bar labels sit inside their bars, milestone labels never touch", () => {
  const g = engine();
  const sp = { deckLibrary: "proposal", type: "timeline", title: "Phased plan from discovery to 20-store pilot and rollout", lead: "A structured three-phase rollout.",
    periods: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"], notes: "After data integration in Phase 1, Phase 2 validates accuracy.",
    lanes: [{ name: "Phase 2: 20-store pilot and validation", bars: [{ start: 3, end: 4, label: "Run 20-store model pilot in fresh departments" }] },
      { name: "Phase 3: Chain-wide 477-store rollout", bars: [{ start: 5, end: 6, label: "Scale order feeds to 477 stores and 6 centers" }] },
      { name: "Governance and value checkpoints", bars: [{ start: 2, milestone: true, label: "Design checkpoint" }, { start: 4, milestone: true, label: "Pilot value checkpoint" }, { start: 6, milestone: true, label: "Scale handover" }] }],
    reference: { tag: "P66_GANTT" } };
  const sl = lay(g, sp);
  assert.equal(sl.drawnWith, "P66_GANTT");
  assert.ok(texts(sl).some((t) => /^Phase 1/.test(t)), texts(sl).join(" | "));
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(sl)), []);
  assert.ok(!texts(sl).some((t) => /…$/.test(t)), "no label cut");
  // labels that cannot be placed without touching: the Gantt gives way, never an overlap
  const crowded = JSON.parse(JSON.stringify(sp));
  crowded.lanes[2].bars = [1, 2, 3, 4, 5, 6].map((k) => ({ start: k, milestone: true, label: "A long checkpoint label number " + k }));
  const s2 = lay(g, crowded);
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(s2)), []);
});

test("Halcyon fan and half donut: captions never on the wedges or each other, never cut; centre label without a count", () => {
  const g = engine();
  const items = [{ title: "Approve charter and decision rights", text: "Confirm clinical, IT, legal, and operations leaders with board sign-off authority." },
    { title: "Select the first two pilot hospitals", text: "Select one flagship center and one community hospital to evaluate diverse workflows." },
    { title: "Prioritize the initial use case sequence", text: "Decide whether to launch ambient documentation and patient messaging together or one after the other with a gap of six weeks." },
    { title: "Standardize patient consent policy", text: "Approve network consent standards for ambient capture and AI messaging." }];
  for (const tag of ["66D_LAYOUT_DIAGRAM_007", "66D_LAYOUT_DIAGRAM_006"]) {
    for (const n of [4, 5]) {
      const its = n === 5 ? items.concat([{ title: "Fund the pilot", text: "Approve the pilot budget." }]) : items;
      const sl = lay(g, { type: "diagram", title: "Four decisions leadership needs to make today", lead: "Aligning on scope unlocks the plan.", center: "Decisions", items: its, reference: { tag } });
      assert.deepEqual(Array.from(g.ENGINE.textOverlaps(sl)), [], tag + " " + n);
      if (sl.drawnWith === tag) assert.ok(!texts(sl).some((t) => /…$/.test(t)), tag + " " + n + " cut a caption: " + texts(sl).join(" | "));   // a caption that would be cut gives way
    }
  }
  const short = items.map((it) => ({ title: it.title.split(" ").slice(0, 3).join(" "), text: it.text.split(" ").slice(0, 8).join(" ") + "." }));
  const fan = lay(g, { type: "diagram", title: "Four decisions", lead: "Lead.", center: "Decisions", items: short, reference: { tag: "66D_LAYOUT_DIAGRAM_007" } });
  assert.equal(fan.drawnWith, "66D_LAYOUT_DIAGRAM_007");
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(fan)), []);
  const sb = ALL();
  assert.equal(sb.centerLabel_("Five decisions leadership must make this year"), "Decisions");
  assert.equal(sb.centerLabel_("Four pillars of the data platform"), "Pillars");
  assert.equal(sb.centerLabel_("Achieve a unified view of patient data"), "Unified view");
  assert.equal(sb.centerLabel_("Clinical workflows that need redesign"), "Clinical workflows");
});

test("overlap check: two texts on top of each other are found; a design that would do it gives way", () => {
  const g = engine();
  const out = { els: [{ t: "text", x: 20, y: 100, w: 200, h: 30, text: "First label text", font: "sans", weight: 400, size: 10, align: "left", valign: "top" },
    { t: "text", x: 30, y: 104, w: 200, h: 30, text: "Second label text", font: "sans", weight: 400, size: 10, align: "left", valign: "top" },
    { t: "text", x: 20, y: 200, w: 200, h: 30, text: "Far away", font: "sans", weight: 400, size: 10, align: "left", valign: "top" }] };
  assert.equal(g.ENGINE.textOverlaps(out).length, 1);
  const T = ["Unified data foundation", "Demand forecasting models", "Store ordering workflow"];
  const sl = lay(g, { type: "cards", title: "A slide", lead: "Lead.", items: T.map((t) => ({ title: t, text: "Some text for " + t + ".", label: t, value: t })), reference: { tag: "66D_LAYOUT_CARDS_022" } });
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(sl)), []);
});

test("General slide 12: the stats column without a statement is not drawn with an empty left half", () => {
  const g = engine();
  const items = [["-30%", "Target: cut after-hours charting"], ["-40%", "Target: faster portal replies"], ["<10%", "Target: few edits"], ["85%", "Target: pilot usage"]].map((x) => ({ value: x[0], label: x[1], text: "Measured in the pilot." }));
  assert.equal(g.ENGINE.canDraw({ type: "stats", title: "Success metrics", items, reference: { tag: "66D_LAYOUT_CHART_002" } }), false);
  assert.equal(g.ENGINE.canDraw({ type: "stats", title: "Success metrics", takeaway: "Four measures decide the pilot.", items, reference: { tag: "66D_LAYOUT_CHART_002" } }), true);
});

test("Solmara comparison: five rows keep two columns (named from the title); seven rows become a table, never text sections", () => {
  const g = engine();
  const rows = [["Fleet baseline", "340 cranes checked on fixed calendar schedules", "340 cranes streamed continuously to Pub/Sub"], ["Inspection trigger", "Manual walk-downs between vessel windows", "Condition-based alerts from live sensor thresholds"],
    ["Outage exposure", "$500k to $1M per hour unplanned downtime cost", "Early fault detection before berth stoppage"], ["Downtime impact", "Reactive repairs after component failure", "30% to 50% unplanned downtime reduction"],
    ["Maintenance cost", "Fixed labor and premature part replacement", "18% to 25% equipment maintenance cost reduction"]].map((r) => ({ label: r[0], left: r[1], right: r[2] }));
  const sp = { deckLibrary: "solution", type: "comparison", title: "Manual crane inspections vs predicted alerts", lead: "Condition-based monitoring prevents outages.", rows, reference: { tag: "S66_TWO_MODE_COMPARE" } };
  const a = lay(g, sp);
  assert.equal(a.drawnWith, "S66_TWO_MODE_COMPARE");
  assert.ok(texts(a).includes("Manual crane inspections") && texts(a).includes("Predicted alerts"));
  const b = lay(g, Object.assign({}, sp, { rows: rows.concat([{ label: "Spare parts", left: "Stocked by habit", right: "Ordered by predicted wear" }, { label: "Reporting", left: "Monthly spreadsheets", right: "Live dashboards" }]) }));
  assert.match(b.drawnWith, /TABLE/);
});

test("Solmara architecture: the numbered notes do not repeat 'Tier 1:' next to the numbered groups", () => {
  const g = engine();
  const groups = [["Tier 1: ingestion", "Edge PLC gateway", "Pub/Sub"], ["Tier 2: stream processing", "Dataflow", "Dead-letter topic"], ["Tier 3: analytical store", "BigQuery", "Cloud Storage"], ["Tier 4: ML and alerting", "Vertex AI endpoints", "Vertex AI monitoring"]]
    .map((x) => ({ label: x[0], items: [{ title: x[1], text: "What it does" }, { title: x[2], text: "What it does" }] }));
  const callouts = ["Tier 1: 340 STS crane PLCs publish JSON telemetry to global Pub/Sub topics with at-least-once delivery.", "Tier 2: Dataflow processes streams, computes rolling features, and dead-letters bad frames.",
    "Tier 3: BigQuery stores partitioned crane features; Cloud Storage holds model binaries.", "Tier 4: Vertex AI serves real-time RUL predictions and monitors incoming sensor features for drift."];
  const sl = lay(g, { deckLibrary: "solution", type: "diagram", title: "Reference architecture", lead: "Four tiers.", groups, callouts, reference: { tag: "S66_ARCH_NUMBERED" } });
  assert.equal(sl.drawnWith, "S66_ARCH_NUMBERED");
  assert.ok(!texts(sl).some((t) => /^Tier \d: \d/.test(t) || /^Tier \d: (Dataflow|BigQuery|Vertex)/.test(t)), texts(sl).join(" | "));
  assert.ok(texts(sl).some((t) => /^340 STS crane PLCs/.test(t)));
});

test("Sprouts: 'Week 1' is not a KPI next to real figures; group points read as one sentence", () => {
  const sb = ALL();
  const sp = { type: "stats", title: "Measuring success", items: [{ value: "10%-15%", label: "Target: store profit lift" }, { value: "Week 1", label: "Target: discovery workshop" }, { value: "-25%", label: "Target: fresh food shrink" }] };
  sb.dropTimeValues_(sp);
  assert.deepEqual(sp.items.map((i) => i.value), ["10%-15%", "-25%"]);
  assert.equal(sb.isFigureValue_("Q3"), false);
  assert.equal(sb.isFigureValue_("Day 30"), false);
  assert.equal(sb.isFigureValue_("2026"), false);
  assert.equal(sb.isFigureValue_("30%"), true);
  assert.equal(sb.isFigureValue_("3x"), true);
  const g = engine();
  const sl = lay(g, { deckLibrary: "proposal", type: "stats", title: "Measuring success and next steps", banner: "Immediate actions",
    items: [{ value: "10%", label: "Target: profit lift" }, { value: "-25%", label: "Target: shrink" }, { value: "85%", label: "Target: buyer adoption" }],
    groups: [{ label: "Data discovery workshop", points: ["Audit POS and shrink schemas", "Map regional warehouse feeds", "Define external driver sources"] }, { label: "Select pilot stores", points: ["Choose representative store formats", "Align across two fresh DCs"] }],
    reference: { tag: "P66_KPI_TILES" } });
  assert.equal(sl.drawnWith, "P66_KPI_TILES");
  assert.ok(texts(sl).includes("Audit POS and shrink schemas; map regional warehouse feeds; define external driver sources."), texts(sl).join(" | "));
  assert.ok(texts(sl).includes("Choose representative store formats; align across two fresh DCs."));
});

test("icons: words the icon search misreads are mapped; no light bulb for physicians; one picture never twice on a slide", () => {
  const sb = ALL();
  const sp = { type: "cards", title: "Where generative AI helps", items: [{ title: "Physician documentation", text: "Drafts clinical notes.", icon: "lightbulb" }, { title: "Draft review", text: "Clinicians review.", icon: "draft" },
    { title: "Data foundation", text: "Unified records.", icon: "database" }, { title: "Analytics store", text: "Warehouse tables.", icon: "data warehouse" }, { title: "Sign-off", text: "Final approval.", icon: "sign-off" }] };
  sb.distinctIcons_(sp);
  const ic = sp.items.map((i) => i.icon);
  assert.equal(ic[0], "stethoscope");
  assert.equal(ic[1], "file text");
  assert.equal(ic[2], "database");
  assert.notEqual(ic[3], "database");
  assert.equal(ic[4], "circle check");
  assert.equal(new Set(ic).size, ic.length);
  assert.match(read("src/Code.gs"), /ICON RULES:/);
  assert.equal(read("src/IconProvider.gs"), read("src/IconProvider.gs"));
});

test("product names: Cloud Pub/Sub, Cloud Dataflow and Cloud Functions are written by their current names", () => {
  const sb = ALL();
  assert.equal(sb.currentProductNames_("Cloud Pub/Sub feeds Cloud Dataflow; Google Cloud Functions route alerts to Data Studio."), "Pub/Sub feeds Dataflow; Cloud Run functions route alerts to Looker Studio.");
  assert.equal(sb.currentProductNames_("Cloud Run functions"), "Cloud Run functions");
  assert.match(read("src/ProposalKit.gs"), /Current Google Cloud names/);
  assert.match(read("src/SolutionKit.gs"), /never "Cloud Pub\/Sub"/);
});

test("Solmara: a 66degrees proof box nobody asked for leaves a Solution slide; a request for proof keeps it", () => {
  const sb = ALL();
  const mk = () => ({ type: "table", deckLibrary: "solution", title: "Predictive maintenance across 340 cranes", columns: ["A", "B"], rows: [["a", "b"]],
    tips: [{ title: "Proof from 66degrees observability and industry 4.0 benchmarks", points: ["66degrees Cloud Evolve deployment decreased client outages by 45%+", "McKinsey: 25% to 55% lower opex"] }] });
  const sp = mk();
  assert.ok(sb.dropBrandProof_(sp, { userPrompt: "Create a solution deck for Solmara Ports: predictive crane maintenance." }) > 0);
  assert.equal(sp.tips, undefined);
  const kept = mk();
  assert.equal(sb.dropBrandProof_(kept, { userPrompt: "Create a solution deck for Solmara Ports with a relevant client case study." }), 0);
  assert.ok(kept.tips.length);
});

test("slides without notes get presenter notes from one call; a figure the slide does not show is refused", () => {
  const sb = ALL();
  const plan = { slides: [{ type: "cover", title: "C" }, { type: "stats", title: "Success metrics", notes: "", items: [{ value: "-30%", label: "Target: after-hours charting", text: "Measured from EHR logs." }] },
    { type: "cards", title: "Decisions", notes: "Check before sharing: figures not found (85%).", items: [{ title: "Approve the charter", text: "Confirm the leaders." }] },
    { type: "cards", title: "Keep", notes: "Real notes already here for this slide.", items: [{ title: "x", text: "y" }] }] };
  let asked = "";
  sb.callGeminiJSON = (parts) => { asked = parts[0].text; return { notes: [{ slide: 1, notes: "Start with the after-hours charting target of -30%, measured from EHR activity logs against the baseline." }, { slide: 2, notes: "These four decisions unlock the plan; 90% of the work depends on the charter." }, { slide: 3, notes: "Should never replace notes that exist already on the slide." }] }; };
  const ctx = { log: [] };
  sb.finalizeNotes_(plan, { research: [] }, ctx);
  assert.match(asked, /SLIDE 1:/); assert.match(asked, /SLIDE 2:/); assert.doesNotMatch(asked, /SLIDE 3:/);
  assert.match(plan.slides[1].notes, /^Start with the after-hours charting target of -30%/);
  assert.doesNotMatch(plan.slides[2].notes, /90%/, "an invented figure is refused");
  assert.match(plan.slides[2].notes, /Walk through|Check before sharing/);
  assert.equal(plan.slides[3].notes, "Real notes already here for this slide.");
});

test("protected files stay untouched", () => {
  ["src/IconProvider.gs", "src/DiagramDesignKit.gs", "src/ClientLogoProvider.gs", "src/Generator.html"].forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});
