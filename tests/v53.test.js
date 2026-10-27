"use strict";

// V.1_53 (Meridian Cold Chain, deck 24 audit) - a Solution Deck never shows a client logo; some Solution slides are dark
// (black, content in white); batch 2 of the Solution designs (architecture with numbered groups, icon architecture,
// two regions, layer stack, code, table with notes, priority table, issue rows, two ways compared, needs mapping, chart
// with insights, dark statement, statement with explainers, banner with figures, gap bridge, lead list, two bullet
// columns, lifecycle columns, rising stages, dark U journey, level cards, client story, dark service hub); and the
// deck 24 fixes: no General layout in a Solution Deck, labels and product names cased, no double ticks, no invented
// results, no repeated or unrequested topics in the outline, balanced sections, designs only for what they are for,
// the streak photo instead of stock photos, no markdown code marks.
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
const render1 = (sb, spec) => sb.ENGINE.render({ slides: [Object.assign({ deckLibrary: "solution" }, spec)] }, { dateLabel: "Oct 15, 2026" })[0];
const sample = (tag, extra) => Object.assign(JSON.parse(JSON.stringify(SAMPLES.find((s) => tagOf(s) === tag && !s.dark))), extra || {});

test("version label is V.1_53 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[3-9]|[6-9]\d)'/);
});

test(".clasp.json pushes the batch 2 Solution design files after the first two", () => {
  const o = JSON.parse(read(".clasp.json")).filePushOrder;
  const i = o.indexOf("SolutionDesigns_2_Flows.gs");
  assert.equal(o.indexOf("SolutionDesigns_3_Tech.gs"), i + 1);
  assert.equal(o.indexOf("SolutionDesigns_4_Story.gs"), i + 2);
});

test("batch 2: the new Solution designs are in the Solution library only and each draws its sample", () => {
  const sb = SOL();
  const E = sb.ENGINE;
  const batch2 = ["S66_ARCH_NUMBERED", "S66_ARCH_ICON_GRAPH", "S66_REGION_TOPOLOGY", "S66_LAYER_STACK", "S66_CODE_PROBLEM_SOLUTION", "S66_TABLE_NOTES",
    "S66_PRIORITY_TABLE", "S66_ISSUE_ROWS", "S66_TWO_MODE_COMPARE", "S66_NEED_MAPPING", "S66_CHART_INSIGHT", "S66_DARK_STATEMENT", "S66_EXPLAINER_SPLIT",
    "S66_BANNER_SPLIT", "S66_GAP_BRIDGE", "S66_BOLD_LEAD_LIST", "S66_TWO_COL_BULLETS", "S66_LIFECYCLE_COLUMNS", "S66_RISING_STAGES", "S66_U_JOURNEY",
    "S66_LEVEL_CARDS", "S66_CLIENT_STORY", "S66_SERVICE_HUB_DARK"];
  batch2.forEach((t) => {
    assert.equal(E.inLibrary(t, "solution"), true, t);
    assert.equal(E.inLibrary(t, "proposal"), false, t);
    const out = render1(sb, sample(t));
    assert.equal(out.drawnWith, t, t + " draws its own sample");
    assert.ok(sb.SOLUTION_DESIGN_GUIDE_[t], t + " has its use-for line for Gemini");
  });
  assert.ok(Object.keys(E.SOLUTION_TAGS).length >= 50, "batch 1 + batch 2 + the shared dividers");
});

test("a Solution Deck never shows a client logo, and no logo is looked up", () => {
  const sb = SOL();
  let looked = 0;
  sb.findClientLogo_ = () => { looked++; return { id: "LOGO", source: "test" }; };
  vm.runInContext("findClientLogo_ = this.findClientLogo_", sb);
  const ctx = { presentationType: "Solution Deck", log: [], clientName: "Meridian Cold Chain", brand: { name: "66degrees" } };
  const p = sb.prepareProposal_("Create a solution deck for Meridian Cold Chain", {}, ctx, { clientName: "Meridian Cold Chain" });
  assert.equal(looked, 0, "no logo lookup in a Solution Deck");
  assert.equal(p.logoId, "");
  assert.ok(ctx.log.some((l) => /carries no client logo/.test(l)));
  const slides = [{ type: "cover", title: "x" }, { type: "cards", title: "y", items: [] }, { type: "section", title: "z" }];
  ctx.proposal.logoId = "LOGO";                                     // even with a logo id left over
  sb.applyProposalFrame_(slides, ctx);
  assert.ok(slides.every((sp) => !sp.cobrand && !sp.clientLogo), "no client logo on any slide");
  const out = render1(sb, Object.assign(sample("S66_ICON_CARD_GRID"), { cobrand: true }));
  assert.ok(!out.els.some((e) => e.asset === "client-logo"), "the engine never draws a client logo on a Solution slide");
  const { drawn } = runSolution(12);
  assert.ok(drawn.every((d) => !d.cobrand && !d.clientLogo));
});

test("dark slides: about one body slide in five, never two in a row, drawn black with white text", () => {
  const sb = SOL();
  const specs = [{ type: "cover" }, { type: "agenda" }, { type: "section", reference: { tag: "P66_SECTION_LIGHT" } }];
  for (let i = 0; i < 14; i++) specs.push({ type: "cards", reference: { tag: i % 2 ? "S66_ICON_CARD_GRID" : "S66_PLAIN_TABLE" } });
  const ctx = { presentationType: "Solution Deck", proposal: { client: null, logoId: "" } };
  const n = sb.solutionDarkRhythm_(specs, ctx);
  assert.ok(n >= 2 && n <= 4, "dark slides: " + n);
  specs.forEach((sp, i) => { if (sp.dark) assert.ok(!specs[i - 1].dark && sp.reference.tag === "S66_ICON_CARD_GRID", "dark only on a dark-capable design, never twice in a row"); });
  ["S66_ICON_CARD_GRID", "S66_NUMBERED_CARD_GRID", "S66_THREE_CARD_COLUMNS", "S66_QUAD_RULE_CARDS", "S66_STEP_COLUMNS", "S66_LIFECYCLE_COLUMNS", "S66_LEVEL_CARDS"].forEach((t) => {
    const out = render1(sb, sample(t, { dark: true }));
    assert.equal(out.drawnWith, t);
    assert.equal(out.dark, true, t + " dark");
    assert.ok(/^#0/.test(out.bg), t + " black background");
    const title = out.els.find((e) => e.t === "text");
    assert.equal(title.color, sb.ENGINE.TOKENS.white, t + " white title");
  });
  ["S66_DARK_STATEMENT", "S66_U_JOURNEY", "S66_SERVICE_HUB_DARK"].forEach((t) => assert.equal(render1(sb, sample(t)).dark, true, t + " is always dark"));
  const { drawn } = runSolution(30, null, 3);
  const body = drawn.filter((d) => !/cover|agenda|closing|section/.test(d.type));
  assert.ok(drawn.some((d) => d.dark), "a 30-slide Solution Deck has dark slides");
  drawn.forEach((d, i) => { if (d.dark && i) assert.ok(!drawn[i - 1].dark); });
  assert.ok(drawn.filter((d) => d.dark).length <= Math.ceil(body.length / 3));
});

test("deck 24: labels and product names keep their case, ticks are not doubled, no markdown code marks", () => {
  const sb = SOL();
  const sp = { type: "process", title: "Real-time data transformation with Dataflow", items: [
    { title: "Input", points: ["source: pub/sub subscription", "format: reads json messages", "service: google cloud pub/sub"] },
    { title: "Regression Model", points: ["Model Type · Trained on historical data"] }],
    columns: ["aspect", "description"], rows: [["schema", "by day on timestamp"]],
    left: { label: "Current Manual Process", points: ["✗ manual checks create delays"] } };
  sb.solutionDisplayCase_(sp);
  assert.deepEqual(sp.items[0].points, ["Source: Pub/Sub subscription", "Format: reads JSON messages", "Service: Google Cloud Pub/Sub"]);
  assert.equal(sp.items[1].title, "Regression model");
  assert.equal(sp.items[1].points[0], "Model type · Trained on historical data");
  assert.deepEqual(sp.columns, ["Aspect", "Description"]);
  assert.equal(sp.rows[0][0], "Schema");
  assert.equal(sp.left.label, "Current manual process");
  assert.equal(sp.left.points[0], "Manual checks create delays");
  assert.equal(sb.ENGINE.cleanText("Clustered by `truck_id` for speed"), "Clustered by truck_id for speed");
  const out = render1(sb, sample("S66_CROSS_CHECK", { left: { label: "Old", points: ["✗ manual checks", "✗ paper logs"] }, right: { label: "New", points: ["✓ alerts in a minute", "✓ full history"] } }));
  assert.ok(!out.els.some((e) => e.t === "text" && /^[✓✗]\s*[✓✗]/.test(e.text) || (e.t === "text" && /✗ manual/.test(e.text))), "one mark per point, drawn by the design");
  const code = render1(sb, sample("S66_CODE_PROBLEM_SOLUTION"));
  assert.equal(code.drawnWith, "S66_CODE_PROBLEM_SOLUTION", "a code block keeps its lines (not joined into one)");
});

test("deck 24: results the request did not give become targets (no invented pilot results)", () => {
  const sb = SOL();
  const ctx = { log: [], proposal: { client: "Meridian Cold Chain" } };
  const slides = [{ type: "stats", title: "Pilot results: spoilage reduction", items: [
    { label: "Pilot result", value: "<2%", text: "The spoilage rate observed during the pilot." },
    { label: "Trucks in the pilot", value: "40", text: "Refrigerated trucks." }], takeaway: "The pilot cut spoilage by 75%. Results feed the rollout plan." },
    { type: "stats", title: "Market growth", items: [{ label: "Market size", value: "$7B" }] }];
  const n = sb.solutionResultsGuard_(slides, "Pilot results from 40 trucks", { text: "", research: [] }, ctx);
  assert.equal(n, 1);
  assert.equal(slides[0].items[0].value, undefined, "the invented result is gone");
  assert.match(slides[0].items[0].label, /^Target: pilot result/);
  assert.equal(slides[0].items[1].value, "40", "a figure from the request stays");
  assert.equal(slides[0].takeaway, "Results feed the rollout plan.", "the sentence with the invented figure goes");
  assert.equal(slides[1].items[0].value, "$7B", "not a results slide: left to the figure check");
  assert.match(slides[0].notes, /shown as targets/);
});

test("deck 24: nothing in a Solution Deck falls back to a General layout", () => {
  const sb = SOL();
  // slide 13: a comparison in a shape no design reads -> text, drawn by a Solution design
  const odd = { type: "comparison", title: "Automated alerts vs manual discovery", deckLibrary: "solution",
    columns: [{ title: "Manual", items: ["Checks every 4 hours", "Damage found on arrival"] }, { title: "Automated", items: ["Alerts within minutes"] }] };
  assert.equal(sb.solutionRescue_(odd), true);
  assert.equal(odd.type, "bullets");
  // a reference that cannot draw (3 items on a 4-6 grid, one empty) -> another Solution design, never base:*
  const out = render1(sb, { type: "bullets", title: "The financial impact", reference: { tag: "S66_NUMBERED_CARD_GRID" },
    items: [{ title: "Cargo damaged", points: ["."] }, { title: "Product loss", points: ["Excursions lead to losses."] }, { title: "Fines", points: ["Re-shipments and fines."] }] });
  assert.match(out.drawnWith, /^S66_/, "drawn with " + out.drawnWith);
  assert.ok(!out.els.some((e) => e.t === "text" && e.text === "Cargo damaged"), "a heading without text is left out");
  // statements now have Solution designs
  assert.match(render1(sb, { type: "statement", title: "Why it matters", statement: "Every load watched every minute, and every warning reaches someone." }).drawnWith, /^S66_/);
  // a whole deck: every body slide is drawn by a Solution design
  const { sb: sb2, drawn } = runSolution(20, null, 4);
  drawn.forEach((d) => {
    if (/cover|agenda|closing/.test(d.type)) return;
    const o = sb2.ENGINE.render({ slides: [d] }, { dateLabel: "x" })[0];
    assert.ok(/^(S66_|P66_SECTION_)/.test(o.drawnWith || ""), d.title + " drawn with " + o.drawnWith);
  });
});

test("deck 24: the outline loses a repeated comparison and unrequested topics, and its sections are balanced", () => {
  const sb = SOL();
  const slides = [
    { type: "comparison", title: "Current state: manual temperature checks", message: "Manual checks are slow" },
    { type: "process", title: "Real-time data transformation with Dataflow" },
    { type: "comparison", title: "Automated alerts vs. manual discovery", message: "Alerts beat manual discovery" },
    { type: "stats", title: "Predictive maintenance opportunities" },
    { type: "statement", title: "The market imperative for IoT adoption" }];
  const req = "Solution deck: technical tone. Temperature monitoring, current manual checks vs automated alerts.";
  const out = sb.solutionOutlineChecks_(slides, req, "technical", []);
  assert.equal(JSON.stringify(out.slice().sort()), "[2,3,4]");
  assert.equal(sb.solutionOutlineChecks_([{ type: "cards", title: "The market opportunity" }], "A deck", "executive", []).length, 0, "an executive deck may show the market");
  const secs = [{ title: "The challenge and data foundation", list: Array.from({ length: 8 }, (x, i) => ({ type: "cards", title: i > 5 ? "Spoilage prediction with Vertex AI " + i : "Challenge slide " + i })) },
    { title: "Predictive analytics and architecture", description: "Using AI to predict spoilage", list: [{ type: "cards", title: "a" }, { type: "cards", title: "b" }, { type: "cards", title: "c" }] },
    { title: "Security", list: [{ type: "cards", title: "d" }, { type: "cards", title: "e" }, { type: "cards", title: "f" }, { type: "cards", title: "g" }, { type: "cards", title: "h" }] }];
  const moved = sb.solutionBalanceSections_(secs);
  assert.ok(moved >= 2);
  const sizes = secs.map((s) => s.list.length);
  assert.ok(Math.max.apply(null, sizes) - Math.min.apply(null, sizes) <= 2, "balanced: " + sizes);
  assert.ok(/Vertex AI/.test(secs[1].list[0].title), "the prediction slides moved to the prediction section");
  const { prompts } = runSolution(12);
  assert.match(prompts.outline, /no market size, industry trends or adjacent opportunities/);
  assert.match(prompts.outline, /Sections of similar size/);
});

test("deck 24: designs only for what they are for", () => {
  const sb = SOL();
  const curve = sample("S66_VALUE_CURVE");
  assert.notEqual(render1(sb, Object.assign({}, curve, { title: "How the prediction model is trained" })).drawnWith, "S66_VALUE_CURVE", "a process is not a value curve");
  assert.notEqual(render1(sb, Object.assign({}, curve, { items: curve.items.map((it) => ({ title: it.title, points: it.points })) })).drawnWith, "S66_VALUE_CURVE", "no stage labels: no value curve");
  const loop = sample("S66_STEP_LOOP_FLOW"); delete loop.loop;
  assert.notEqual(render1(sb, loop).drawnWith, "S66_STEP_LOOP_FLOW", "no feedback loop: not the loop flow");
  const tiers = { type: "cards", title: "Project team and governance model", reference: { tag: "S66_OFFER_TIERS" }, items: [
    { title: "Phase 1", timing: "Immediate", text: "Authorize phase 1.", funding: "Meridian approval" }, { title: "Next 200 trucks", timing: "Coming quarter", text: "Onboard 200 trucks.", funding: "Scope" },
    { title: "Full fleet", timing: "Three phases", text: "Full visibility.", funding: "Goal" }] };
  assert.notEqual(render1(sb, tiers).drawnWith, "S66_OFFER_TIERS");
  const grid = render1(sb, sample("S66_NUMBERED_CARD_GRID", { items: sample("S66_NUMBERED_CARD_GRID").items.slice(0, 4) }));
  const xs = [...new Set(grid.els.filter((e) => e.t === "rect" && e.w > 200).map((e) => Math.round(e.x)))];
  assert.equal(xs.length, 2, "four numbered cards as 2 x 2");
  const rows = sample("S66_LABEL_ROWS"); rows.items.forEach((it) => { it.timing = "near real-time"; });
  assert.ok(!render1(sb, rows).els.some((e) => e.t === "text" && /near real-time/.test(e.text)), "a timing every row repeats is left out");
  const tint = sample("S66_TINT_PANELS"); tint.items[0].title = "<2% · Pilot result";
  assert.notEqual(render1(sb, tint).drawnWith, "S66_TINT_PANELS", "figures are not panel headings");
});

test("deck 24: Solution photo strips use the 66degrees streak photo, never a stock photo", () => {
  const src = read("src/EngineRenderer.gs");
  assert.match(src, /solutionSlide = !!spec && spec\.deckLibrary === 'solution'/);
  assert.match(src, /stock = !solutionSlide && typeof pickStockImage_/);
});

test("deck 24 replayed: the Meridian Cold Chain deck comes out clean", () => {
  const outline = { deck_title: "Real-time cold chain monitoring", subtitle: "A technical solution for Meridian Cold Chain", closing_subtitle: "Deploying a proven solution",
    sections: [
      { title: "The challenge and data foundation", description: "The cost of manual monitoring", slides: [["cards", "The financial impact of cold chain failures"], ["comparison", "Current state: manual temperature checks"], ["diagram", "IoT sensor data stream architecture"], ["process", "Real-time data transformation with Dataflow"], ["table", "The analytical data warehouse in BigQuery"], ["cards", "Spoilage-risk prediction with Vertex AI"], ["process", "How the prediction model is trained"]] },
      { title: "Predictive analytics and architecture", description: "Using AI to predict spoilage", slides: [["comparison", "Automated alerts vs. manual discovery"], ["diagram", "Full solution reference architecture"], ["stats", "Predictive maintenance opportunities"], ["statement", "The market imperative for IoT adoption"]] },
      { title: "Security controls and pilot validation", description: "Securing the platform and proving its value", slides: [["process", "A multi-layered security approach"], ["table", "Identity and Access Management with IAM"], ["cards", "Protecting data with VPC Service Controls"], ["statement", "Pilot program scope: 40-truck validation"], ["stats", "Pilot results: spoilage reduction"]] },
      { title: "Deployment, governance, and next steps", description: "The plan for rollout and management", slides: [["process", "Automated deployment with Terraform"], ["cards", "The three deployment layers"], ["process", "Cut-over run book for fleet rollout"], ["cards", "Project team and governance model"], ["statement", "Next step: initiate full fleet deployment"]] }]
      .map((s) => Object.assign({}, s, { storyline: s.description, slides: s.slides.map(([type, title]) => ({ type, title, message: "Proves " + title.toLowerCase(), points: ["p"] })) })) };
  const special = (type, title) => {
    if (/Pilot results/.test(title)) return { type: "stats", design: "S66_TIER_VALUE", title, context: "Pilot performance", items: [{ label: "Pilot result", value: "<2%", title: "Spoilage rate", text: "Observed during the 90-day pilot." }, { label: "Improvement", value: "75%+", title: "Improvement", text: "Reduction achieved." }, { label: "Trucks", value: "40", title: "Trucks", text: "In the pilot." }], takeaway: "Next: fleet rollout." };
    if (/Current state/.test(title)) return { type: "comparison", design: "S66_CROSS_CHECK", title, left: { label: "Current Manual Process", points: ["✗ manual checks create delays", "✗ damage found late"] }, right: { label: "Automated Alerts", points: ["✓ alerts within minutes", "✓ crews act early"] } };
    if (/Dataflow/.test(title)) return { type: "process", design: "S66_LABEL_ROWS", title, items: [{ label: "Step 1", title: "Input", timing: "near real-time", points: ["source: pub/sub subscription", "format: reads json messages"] }, { label: "Step 2", title: "Transform", timing: "near real-time", points: ["parsing: extracts readings", "enrichment: adds truck data"] }, { label: "Step 3", title: "Output", timing: "near real-time", points: ["destination: BigQuery table", "purpose: ml model training"] }] };
    return null;
  };
  const { drawn, r } = runSolution(30, "Create a solution deck for Meridian Cold Chain: technical tone. Real-time temperature monitoring with Pub/Sub, Dataflow, BigQuery and Vertex AI, current manual checks vs automated alerts, pilot results from 40 trucks, a cut-over run book.", 1, { outline, special });
  assert.equal(drawn.length, 30);
  const titles = drawn.map((d) => d.title);
  ["Automated alerts vs. manual discovery", "Predictive maintenance opportunities", "The market imperative for IoT adoption"].forEach((t) => assert.ok(titles.indexOf(t) === -1, "removed: " + t));
  assert.ok(drawn.every((d) => !d.cobrand), "no client logo");
  const bad = drawn.map(tagOf).filter((t) => t && !/^S66_/.test(t) && SHARED.indexOf(t) === -1);
  assert.deepEqual(bad, []);
  const pilot = drawn.find((d) => /Pilot results/.test(d.title));
  assert.ok(!JSON.stringify(pilot.items || []).includes("<2%") && !JSON.stringify(pilot.items || []).includes("75%"), "no invented pilot result");
  const flow = drawn.find((d) => /Dataflow/.test(d.title));
  assert.ok(JSON.stringify(flow.items).includes("Source: Pub/Sub subscription") && JSON.stringify(flow.items).includes("reads JSON messages"));
  const cmp = drawn.find((d) => /Current state/.test(d.title));
  assert.ok(!/✗|✓/.test(JSON.stringify(cmp.left) + JSON.stringify(cmp.right)), "no marks written into the points");
  const secs = []; let cur = -1;
  drawn.forEach((d) => { if (d.type === "section") { secs.push(0); cur++; } else if (cur >= 0 && !/closing/.test(d.type)) secs[cur]++; });
  assert.ok(Math.max.apply(null, secs) - Math.min.apply(null, secs) <= 2, "balanced sections: " + secs);
  assert.match(r.message, /no client logo/);
});
