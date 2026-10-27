"use strict";

// V.1_58 (decks 31: Arcadia Freight Rail, Ulta Beauty, Brightwater Credit Union) - a quality gate draws every design with
// short, medium and long content (no texts on top of each other, few cut texts, little empty space); boxes and tables
// reach the bottom; panels never show headings only; texts are never cut into a wrong sentence; the right design for
// layers, regions, runbooks, roadmaps and risks; the request's figures stay; notes follow the slide; names keep capitals.
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
const texts = (sl) => sl.els.filter((e) => e.t === "text").map((e) => String(e.text));
const ALL = () => loadAll(() => ({}));
const GATE = require("./fixtures/quality-gate.js");

test("version label is V.1_58 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[8-9]|[6-9]\d)'/);
});

test("quality gate: every design at 2-6 items and three text lengths - never texts on top of each other, few cuts, little empty space", () => {
  const rows = GATE.survey(ROOT);
  const own = rows.filter((r) => r.own);
  assert.ok(own.length > 1000, "designs drawn: " + own.length);
  assert.equal(rows.filter((r) => r.err).length, 0, "no design throws");
  const ov = rows.filter((r) => r.ov);
  assert.equal(ov.length, 0, "texts on top of each other: " + ov.slice(0, 3).map((r) => r.drawnWith + " " + JSON.stringify(r.ovs)).join(" | "));
  const cut = own.filter((r) => r.cut && r.len <= 1);
  assert.ok(cut.length <= 21, "short texts cut: " + cut.length + " " + cut.slice(0, 3).map((r) => r.tag).join(", "));
  const gap = own.filter((r) => r.gap > 0.25 && !/AGENDA|SECTION|COVER|CLOSING/.test(r.tag));
  // V.1_65: a box that would stay mostly empty is made shorter (a nearly empty card is worse than a shorter slide), so with
  // the deliberately short test texts more slides end above the bottom; real slides get their room filled first (fit step)
  assert.ok(gap.length <= 85, "slides with a quarter of the space empty: " + gap.length);
  // with full texts and 3 or more items the slide is filled
  const full = gap.filter((r) => r.len >= 2 && r.n >= 3);
  assert.ok(full.length <= 8, "full slides with empty space: " + full.map((r) => r.tag + ":" + r.n).join(", "));
});

test("deck 31 fill: step columns, text sections, tables and the scorecard reach the bottom of the slide", () => {
  const g = engine();
  const check = (sp) => { const r = GATE.check(g, sp); return r; };
  const items = ["Decoupled telemetry buffering", "Asset ordering keys", "Ingestion schema validation", "Dead-letter topic isolation"].map((t) => ({ title: t, tag: "Pub/Sub", text: "Pub/Sub keeps the readings in order and isolates bad payloads." }));
  const a = check({ deckLibrary: "solution", type: "process", title: "Sensor readings streamed through Pub/Sub", items, reference: { tag: "S66_STEP_COLUMNS" } });
  assert.equal(a.drawnWith, "S66_STEP_COLUMNS"); assert.ok(a.gap < 0.12, "step columns gap " + a.gap);
  const b = check({ deckLibrary: "solution", type: "stats", title: "Traction motor failure modes", items: [{ value: ">98%", label: "Share of failures that are mechanical" }, { value: "115", label: "Tracked AC motor failures" }],
    columns: ["Failure mechanism", "Subsystem", "Root cause"], rows: [["Mechanical", "Bearings and gears", "Bearing wear"], ["Thermal", "Stator windings", "Heat spikes"], ["Electrical", "Inverter", "Insulation"]], reference: { tag: "S66_SCORECARD" } });
  assert.equal(b.drawnWith, "S66_SCORECARD"); assert.ok(b.gap < 0.12, "scorecard gap " + b.gap);
  const c = check({ deckLibrary: "solution", type: "bullets", title: "Next step", items: [{ title: "Define", points: ["Clarify the pilot scope and the failure modes to predict first."] }, { title: "Design", points: ["Finalize the Terraform modules for both regions."] }], reference: { tag: "S66_TEXT_SECTIONS" } });
  assert.equal(c.drawnWith, "S66_TEXT_SECTIONS"); assert.ok(c.gap < 0.12, "text sections gap " + c.gap);
});

test("Ulta roadmap: gates inside the phase lanes or written as one-period bars become milestones; the Gantt draws", () => {
  const g = engine();
  const periods = ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"];
  const sp = { deckLibrary: "proposal", type: "timeline", title: "Phased roadmap from foundation to chain-wide rollout", lead: "Three phases.", periods, reference: { tag: "P66_GANTT" },
    lanes: [{ name: "Phase 1: Discovery and foundation", bars: [{ start: 1, end: 2, label: "BigQuery schema alignment and feature pipelines" }, { start: 2, milestone: true, label: "Gate 1: Data readiness" }] },
      { name: "Phase 2: Store and app pilot", bars: [{ start: 3, end: 4, label: "Pilot launch in target stores and mobile app" }, { start: 4, milestone: true, label: "Gate 2: Pilot lift validation" }] },
      { name: "Phase 3: Chain-wide rollout", bars: [{ start: 5, end: 6, label: "Full retail chain and web channel scale" }, { start: 6, milestone: true, label: "Gate 3: Production handoff" }] }] };
  const a = lay(g, sp);
  assert.equal(a.drawnWith, "P66_GANTT");
  assert.ok(texts(a).includes("Value checkpoints"), texts(a).join(" | "));
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(a)), []);
  const b = lay(g, Object.assign({}, sp, { lanes: [sp.lanes[0], sp.lanes[1], sp.lanes[2]].map((l) => ({ name: l.name, bars: [l.bars[0]] })).concat([{ name: "Value checkpoints and governance", bars: [2, 4, 6].map((k, i) => ({ start: k, end: k, label: "Gate " + (i + 1) + ": " + ["Data readiness", "Pilot lift validation", "Production handoff"][i] })) }]) }));
  assert.equal(b.drawnWith, "P66_GANTT");
  // steps written with their months become the Gantt
  const sb = ALL();
  const st = { deckLibrary: "proposal", type: "process", title: "Phased roadmap from foundation to chain-wide rollout", items: [
    { title: "BigQuery schema alignment and feature pipelines", text: "Phase 1: Discovery and foundation · Month 1 to Month 2" }, { title: "Gate 1: Data readiness", text: "Value checkpoints and governance · Month 2" },
    { title: "Pilot launch in target stores and mobile app", text: "Phase 2: Store and app pilot · Month 3 to Month 4" }, { title: "Gate 2: Pilot lift validation", text: "Value checkpoints and governance · Month 4" },
    { title: "Full retail chain and web channel scale", text: "Phase 3: Chain-wide rollout · Month 5 to Month 6" }, { title: "Gate 3: Production handoff", text: "Value checkpoints and governance · Month 6" }] };
  assert.equal(sb.roadmapAsGantt_(st), true);
  assert.equal(st.design, "P66_GANTT");
  assert.equal(st.lanes.length, 4);
  assert.deepEqual(Array.from(st.periods), periods);
});

test("Ulta slides 5 and 16: comparison and team content in other shapes is shown, never headings alone", () => {
  const g = engine();
  const shown = (sp) => texts(lay(g, sp)).join(" | ");
  assert.match(shown({ deckLibrary: "proposal", type: "comparison", title: "Current challenges", lead: "L", left: { title: "Current state", items: [{ title: "Batch promotions", text: "Weekly emails to every member" }] }, right: { title: "Future state", items: [{ title: "Real-time picks", text: "Recommendations per member" }] } }), /Weekly emails to every member/);
  assert.match(shown({ deckLibrary: "proposal", type: "comparison", title: "Current challenges", lead: "L", columns: ["Current state", "Future state"], rows: [{ label: "Promotions", left: "Batch", right: "Live" }, { label: "Data", left: "Silos", right: "Unified" }] }), /Promotions: Batch[\s\S]*Promotions: Live/);
  assert.match(shown({ deckLibrary: "proposal", type: "team", title: "Delivery team", lead: "L", items: [{ title: "Steering committee", points: ["Executive sponsor", "Architecture board"] }, { title: "Ulta Beauty team", points: ["Product owner"] }, { title: "66degrees team", points: ["Engagement lead"] }] }), /Executive sponsor\. Architecture board\./);   // V.1_63: points stay sentences
});

test("texts are never cut into a different sentence: no comma clause closed with a full stop, no 16-word cut", () => {
  const g = engine();
  const f = g.ENGINE.kit.fit("Select the initial focus among member chat answers, loan document summaries, or call wrap-up notes for the first pilot.", 150, 30, { weight: 400, max: 10, min: 10, maxLines: 2 });
  assert.ok(!/summaries\.$/.test(f.text), "a list is not closed after its second option: " + f.text);
  const long = "Goal: clarify pilot scope and prioritize failure modes across Arcadia Freight Rail traction motors · Input: sample JSON or Avro payloads from two depots and the last twelve months of work orders.";
  const sl = lay(g, { deckLibrary: "solution", type: "timeline", title: "Next step: technical discovery and pilot", items: [1, 2, 3, 4].map((k) => ({ title: "Phase " + k, text: long })) });
  assert.ok(!texts(sl).some((t) => /\bor\.$|\band\.$/.test(t)), texts(sl).join(" | "));
  assert.doesNotMatch(read("src/Engine.gs"), /w\.slice\(0, 16\)\.join/);
});

test("Brightwater chart: long category labels take three lines at a smaller size instead of being cut", () => {
  const g = engine();
  const sl = lay(g, { type: "chart", title: "Credit unions lead banking in production AI adoption", lead: "Nearly six in ten.", chart: { type: "bar", unit: "%", categories: ["AI in at least one function", "GenAI in production (credit unions)", "GenAI in production (banks)", "Credit union chatbots", "Enterprise AI charter"], series: [{ name: "", values: [67, 59, 49, 46, 16] }] }, insight: { title: "Close the governance gap", text: "Brightwater can join the 16%." } });
  const labels = texts(sl).filter((t) => /production|function|chatbots|charter/.test(t));
  assert.ok(labels.length >= 5 && !labels.some((t) => /…$/.test(t)), labels.join(" | "));
});

test("Brightwater slide 10: the layered stack never runs its texts under the + marks or into the chips (it gives way)", () => {
  const g = engine();
  const L = [["Member and staff channels", "Web and mobile member chat, contact center telephony desktop, and loan officer underwriting portal."], ["Application and copilot layer", "Customer Engagement Suite with Agent Assist for live calls, wrap-up note generator."],
    ["Grounding and safety layer", "Gemini on Vertex AI and Vertex AI Search grounded strictly in Brightwater manuals, policies and support articles."], ["Data and security foundation", "BigQuery audit logs, Looker Studio quality dashboards, and encrypted credit union document repositories."]];
  const sl = lay(g, { type: "architecture", title: "Google Cloud architecture for grounded member services", lead: "Gemini, Agent Assist and Vertex AI Search ground every output in Brightwater content.", layers: L.map((x) => ({ title: x[0], text: x[1] })),
    parts: ["Vertex AI Search", "Agent Assist", "Gemini on Vertex AI", "BigQuery", "Looker Studio"], takeaway: "Gemini models are grounded in Brightwater approved documents and are never trained on member data.", reference: { tag: "66D_LAYOUT_PRODUCT_001" } });
  assert.deepEqual(Array.from(g.ENGINE.textOverlaps(sl)), []);
  assert.ok(!texts(sl).some((t) => /…$/.test(t)));
  const ok = lay(g, { type: "architecture", title: "Layers", layers: [{ title: "Channels", text: "Chat and phone." }, { title: "Copilot", text: "Agent Assist." }, { title: "Data", text: "BigQuery." }], reference: { tag: "66D_LAYOUT_PRODUCT_001" } });
  assert.equal(ok.drawnWith, "66D_LAYOUT_PRODUCT_001");
});

test("Arcadia: Terraform layers become the layer stack, the DR pair the region topology, and steps written as fields keep every field", () => {
  const sb = ALL();
  const layers = [4, 3, 2, 1].map((k) => ({ title: "Layer " + k + ": " + ["network foundation", "security and IAM", "data and messaging", "ML and streaming"][k - 1], points: ["Part A" + k, "Part B" + k, "Part C" + k] }));
  const alts = sb.proposalAlternatives_({ deckLibrary: "solution", type: "process", title: "Deployment layers with Terraform", items: layers });
  const stack = alts.find((a) => Array.isArray(a.layers) && a.layers.length === 4);
  assert.ok(stack, "a layer stack alternative");
  assert.equal(stack.layers[0].label, "ML and streaming");
  assert.ok(sb.ENGINE.canDraw(Object.assign({}, stack, { reference: { tag: "S66_LAYER_STACK" } })));
  const dr = sb.proposalAlternatives_({ deckLibrary: "solution", type: "comparison", title: "Primary and DR region design",
    left: { title: "Primary region (active)", items: [{ title: "Pub/Sub and Dataflow", text: "Active ingestion and Beam workers" }, { title: "Vertex AI endpoints", text: "Active scoring" }] },
    right: { title: "DR region (passive)", items: [{ title: "Standby Dataflow and Vertex AI", text: "No compute until failover" }, { title: "BigQuery replica", text: "Cross-region replication" }] } });
  const reg = dr.find((a) => Array.isArray(a.regions));
  assert.ok(reg && sb.ENGINE.canDraw(Object.assign({}, reg, { reference: { tag: "S66_REGION_TOPOLOGY" } })), "region topology");
  const steps = sb.proposalAlternatives_({ deckLibrary: "solution", type: "timeline", title: "Next step", items: [{ title: "Define", goal: "clarify the pilot scope", input: "sample JSON payloads" }, { title: "Design", goal: "craft the architecture", action: "finalize Terraform modules" }] });
  const p = steps.find((a) => a.type === "process");
  assert.equal(p.items[0].text, "Goal: clarify the pilot scope · Input: sample JSON payloads");
});

test("Arcadia runbooks: rows without a status show the icon of their subject, not 'i' and '!' marks; the fix is body text", () => {
  const g = engine();
  const items = ["Pub/Sub dead-letter queue spike", "Dataflow worker backlog growth", "Vertex AI feature skew alert", "Primary region outage failover"].map((t) => ({ title: t, text: "Inspect the signal, apply the documented fix and confirm recovery." }));
  const sl = lay(g, { deckLibrary: "solution", type: "cards", title: "Day-2 runbooks for known issues", items, reference: { tag: "S66_ISSUE_ROWS" } });
  assert.equal(sl.drawnWith, "S66_ISSUE_ROWS");
  assert.ok(!texts(sl).some((t) => t === "!" || t === "i"));
  assert.ok(sl.els.filter((e) => e.t === "icon").length >= 4);
  const withStatus = lay(g, { deckLibrary: "solution", type: "cards", title: "Known issues", items: items.map((it, i) => Object.assign({ status: i ? "high" : "low" }, it)), reference: { tag: "S66_ISSUE_ROWS" } });
  assert.ok(texts(withStatus).includes("!"));
});

test("Ulta risks: every risk row shows its mitigation", () => {
  const g = engine();
  const items = [{ title: "In-store tablet latency", text: "Peak hours slow tablet lookups.", points: ["Edge caching with POS sync fallback"] }, { title: "Seasonal model drift", text: "Trends shift quickly.", points: ["Automated retraining on recent buying"] }, { title: "Loyalty PII exposure", text: "Identifiers in training data.", points: ["Tokenize identifiers before ingest"] }];
  const sl = lay(g, { deckLibrary: "proposal", type: "cards", title: "Risk management and mitigations", items, reference: { tag: "P66_DELIVERABLE_ROWS" } });
  const all = texts(sl).join(" | ");
  assert.match(all, /Mitigation: Edge caching/); assert.match(all, /Mitigation: Tokenize identifiers/);
});

test("KPIs: a study window is not a KPI, a target is not also a benchmark, a KPI needs a figure; the notes drop what the slide dropped", () => {
  const sb = ALL();
  const a = { type: "stats", title: "Failure modes", items: [{ value: ">98%", label: "Share of failures that are mechanical" }, { value: "115", label: "Tracked AC motor failures" }, { value: "15 mo", label: "Study operational tracking window" }] };
  sb.dropTimeValues_(a);
  assert.deepEqual(a.items.map((i) => i.value), [">98%", "115"]);
  const b = { type: "cards", title: "Success metrics", items: [{ value: "2.3x", label: "Target: buyer purchase confidence (industry benchmark)" }, { value: "10% - 30%", label: "Target: marketing ROI gain" }, { value: "", label: "Target: session basket size and conversion tracking" }] };
  sb.dropTimeValues_(b);
  assert.equal(b.items.length, 2);
  assert.equal(b.items[0].label, "Industry benchmark: buyer purchase confidence");
  const c = { type: "stats", title: "Pilot metrics", notes: "All four pilot success metrics are anchored in benchmarks: a 15% reduction in handling time, a 20% improvement in first-contact resolution, 5-minute loan preparation and 95%+ accuracy.",
    items: [{ value: "15%", label: "Target: handling time" }, { value: "5 min", label: "Target: loan preparation" }, { value: "95%+", label: "Target: accuracy" }], _dropped: [{ value: "20%", label: "Target: first-contact resolution" }] };
  const n = sb.notesWithoutDropped_(c);
  assert.doesNotMatch(n, /20%/); assert.match(n, /All three pilot/);
  assert.match(read("src/Code.gs"), /String\(userPrompt \|\| ''\)\]\.join\(' '\);/, "the request's own figures count as sourced");
});

test("notes follow the slide: agenda notes list the agenda; the proposed-times note names only times still on the slide", () => {
  const sb = ALL();
  const ag = { type: "agenda", title: "Agenda", notes: "Walk through the 17-part story and the client proof.", items: [{ title: "The case for adoption now" }, { title: "High-impact workflows" }, { title: "Controlling risks" }, { title: "Governance model and next steps" }] };
  const sup = { type: "cards", title: "Support priorities", items: [{ title: "Severity 1", text: "Immediate 15-minute response." }, { title: "Severity 2", text: "Two-hour response." }],
    notes: "Engineers work every request.\nThe times on this slide (15 min, 30 min, 4 hours, 24 hours) are proposals, not given in the request: confirm them before sharing." };
  sb.finalizeNotes_({ slides: [ag, sup] }, { research: [] }, null);
  assert.match(ag.notes, /four parts/); assert.doesNotMatch(ag.notes, /client proof/);
  assert.match(sup.notes, /\(15 min\)/); assert.doesNotMatch(sup.notes, /24 hours/);
});

test("names from the research keep their capitals; joined points keep 'Google'; table labels are sentence case", () => {
  const sb = ALL();
  sb.setRunNames_("Create a proposal deck for Ulta Beauty.", ["Ulta Beauty"]);
  const slides = [{ type: "stats", title: "Loyalty scale", items: [{ value: "300+", label: "Datasets in project darwin" }], notes: "Through Project Darwin, over 300 datasets reside in BigQuery. BigQuery Darwin feeds the models." }];
  sb.addRunNames_(sb.namesFromNotes_(slides));
  assert.equal(sb.keepNames_("Datasets in project darwin"), "Datasets in Project Darwin");
  assert.ok(!sb.namesFromNotes_([{ notes: "In Phase 1 we start. Walk through the plan with the Team." }]).some((n) => /Phase/.test(n)));
  const g = engine();
  const sl = lay(g, { deckLibrary: "proposal", type: "stats", title: "Footprint", banner: "Ready", items: [{ value: "46.7M", label: "Members" }, { value: "95%", label: "Sales" }, { value: "1,505", label: "Stores" }],
    groups: [{ label: "Cloud foundation", points: ["BigQuery data warehouse", "Google Kubernetes Engine", "E-commerce web platform"] }, { label: "Channels", points: ["Stores", "App"] }], reference: { tag: "P66_KPI_TILES" } });
  assert.ok(texts(sl).includes("BigQuery data warehouse; Google Kubernetes Engine; e-commerce web platform."), texts(sl).join(" | "));
  const t = { type: "table", title: "Owners", columns: ["Governance Role", "Cadence"], rows: [["Executive Sponsor (COO / VP Member Services)", "Bi-weekly"]] };
  sb.finalVoicePass_([t], { userPrompt: "x" });
  assert.equal(t.rows[0][0], "Executive sponsor (COO / VP member services)");
});

test("a requested topic a slide already covers loosely is rewritten in that slot, never written a second time", () => {
  const src = read("src/Code.gs");
  assert.match(src, /gaps\.rework\.push\(\{ i: loose, topic: t, retitle: true \}\)/);
  assert.match(src, /keep its content, name the topic in the title/);
});

test("the fit check takes a third round and keeps a shorter rewrite; prompts carry the deck 31 rules", () => {
  const src = read("src/Code.gs");
  assert.match(src, /round < 3/);
  assert.match(src, /txt\.length >= String\(it\.current \|\| ''\)\.length/);
  assert.match(src, /chart categories are 1-3 words and all different/);
  assert.match(read("src/ProposalKit.gs"), /A risk always carries its mitigation/);
  assert.match(read("src/SolutionKit.gs"), /Layers are written as layers\[\{label, items\[\]\}\]/);
});
