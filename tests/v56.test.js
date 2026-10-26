"use strict";

// V.1_56 (decks 28-29 and the model upgrade) - the jobs use the models set in Script properties (Gemini 4 Argon writes,
// Gemini 3.8 Flash checks, Nano Banana 2 draws icons; Gemini 2.5 stays the fallback and the default off the global
// region); the reasoning level is sent only to the models that take it; topics the request lists are never removed and
// the deck ends with its next step; a slide never loses its points to a bare statement; DR / P2 keep their capitals;
// recovery targets and "100% uptime" are flagged; retired products, claims about 66degrees and filler tails go;
// research figures say they are industry figures; notes carry no redirect links; the last result can be shown again.
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
const props = (sb, kv) => { const p = sb.PropertiesService.getScriptProperties(); Object.keys(kv).forEach((k) => p.setProperty(k, kv[k])); };
const CORVINA = "Create a solution deck for Corvina Rail Systems: technical tone. Condition-based maintenance for 1,200 rail switches on Google Cloud: sensor readings streamed through Pub/Sub and Dataflow into BigQuery, failure prediction with Vertex AI, the reference architecture, a primary and DR region design, security controls (IAM, VPC Service Controls, CMEK), today's manual track inspections vs predicted alerts, the deployment layers with Terraform, day-2 runbooks for known issues, support priorities, and the next step.";

test("version label is V.1_56 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[6-9]|[6-9]\d)'/);
});

test("off the global region the add-on keeps the Gemini 2.5 models", () => {
  const sb = SOL();
  props(sb, { VERTEX_PROJECT_ID: "p", VERTEX_LOCATION: "us-central1" });
  assert.equal(sb.CONFIG.model, "gemini-2.5-flash");
  assert.equal(sb.contentModel_(), "");
  assert.equal(sb.outlineModel_(), "gemini-2.5-pro");
  assert.equal(sb.CONFIG.imageModel, "auto");
});

test("on the global region: Argon writes, 3.8 Flash checks, Nano Banana 2 draws icons; properties override, off = 2.5", () => {
  const sb = SOL();
  props(sb, { VERTEX_PROJECT_ID: "p", VERTEX_LOCATION: "global" });
  assert.equal(sb.CONFIG.model, "gemini-3.8-flash");
  assert.equal(sb.contentModel_(), "gemini-4-argon");
  assert.equal(sb.outlineModel_(), "gemini-4-argon");
  assert.equal(sb.CONFIG.imageModel, "gemini-3.1-flash-image");
  props(sb, { CONTENT_MODEL: "gemini-3.8-flash", RESEARCH_MODEL: "off" });
  assert.equal(sb.contentModel_(), "gemini-3.8-flash");
  assert.equal(sb.CONFIG.model, "gemini-2.5-flash");
  assert.equal(sb.withModel_("gemini-4-argon", () => sb.CONFIG.model), "gemini-4-argon");
  assert.equal(sb.CONFIG.model, "gemini-2.5-flash", "restored after the call");
});

test("the reasoning level goes only to the models that take it", () => {
  const sb = SOL();
  assert.deepEqual(JSON.parse(JSON.stringify(sb.geminiThinkingConfig_("gemini-4-argon"))), { thinkingLevel: "LOW" });
  assert.equal(sb.geminiThinkingConfig_("gemini-2.5-flash"), null);
  assert.equal(sb.geminiThinkingConfig_("gemini-3.1-flash-image"), null);
  props(sb, { THINKING_LEVEL: "medium" });
  assert.equal(sb.geminiThinkingConfig_("gemini-3.8-flash").thinkingLevel, "MEDIUM");
  props(sb, { THINKING_LEVEL: "off" });
  assert.equal(sb.geminiThinkingConfig_("gemini-4-argon"), null);
});

test("a model that fails falls back to Gemini 2.5 Flash without the reasoning level, and the run says which model answered", () => {
  const sb = SOL();
  props(sb, { VERTEX_PROJECT_ID: "p", VERTEX_LOCATION: "global" });
  sb.ScriptApp = { getOAuthToken: () => "t" };
  const brand = read("src/Brand.gs"); const a = brand.indexOf("function callGeminiJSON("), b = brand.indexOf("\nfunction ", a + 10);
  vm.runInContext(brand.slice(a, b), sb);                       // the real Vertex call (the harness mocks it)
  const sent = [];
  sb.UrlFetchApp = { fetch(url, o) {
    const body = JSON.parse(o.payload); sent.push({ url, thinking: !!(body.generationConfig && body.generationConfig.thinkingConfig) });
    if (/gemini-4-argon/.test(url)) return { getResponseCode: () => 404, getContentText: () => JSON.stringify({ error: { message: "Publisher model was not found" } }) };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) };
  } };
  const r = JSON.parse(ev(sb, "JSON.stringify(withModel_('gemini-4-argon', function () { return callGeminiJSON([{ text: 'x' }], 'k', 0.3); }))"));
  assert.equal(r.ok, true, JSON.stringify(sent));
  assert.ok(/gemini-4-argon/.test(sent[0].url) && sent[0].thinking, "Argon asked with a reasoning level");
  const fb = sent.filter((x) => /gemini-2\.5-flash/.test(x.url))[0];
  assert.ok(fb && !fb.thinking, "Gemini 2.5 asked without it");
  assert.match(sb.modelsUsedLine_(sb.mergeModelsUsed_({})), /gemini-2\.5-flash \(fallback\) × 1/);
});

test("a deck on the global region writes the outline and the slides with Argon, the checks with 3.8 Flash", () => {
  const seen = { outline: [], parts: [], client: [] };
  let sbRef = null;
  const bySample = {}; SAMPLES.forEach((s) => { bySample[s.reference.tag] = s; });
  const sb = loadAll((t) => {
    const m = sbRef.CONFIG.model;
    if (/Who is the CLIENT/.test(t)) { seen.client.push(m); return { client: "Corvina Rail Systems", domain: "corvina.com", confident: true }; }
    if (/Plan the OUTLINE/.test(t)) {
      seen.outline.push(m);
      return { deck_title: "Solution deck for Corvina Rail Systems", subtitle: "Condition-based maintenance for rail switches on Google Cloud", closing_subtitle: "Let's build the future of rail maintenance, together.",
        sections: [{ title: "The case", description: "Why", storyline: "s", slides: [{ type: "comparison", title: "Manual inspections vs. predicted alerts", message: "m", points: ["p"] }, { type: "stats", title: "The proven value of predictive maintenance", message: "m", points: ["p"] }, { type: "process", title: "Data ingestion via Pub/Sub", message: "m", points: ["p"] }] },
          { title: "Architecture", description: "How", storyline: "s", slides: [{ type: "diagram", title: "Reference architecture on Google Cloud", message: "m", points: ["p"] }, { type: "process", title: "Data processing with Dataflow and BigQuery", message: "m", points: ["p"] }, { type: "cards", title: "Failure prediction with Vertex AI", message: "m", points: ["p"] }] },
          { title: "Run it", description: "Ops", storyline: "s", slides: [{ type: "diagram", title: "Primary and DR region design", message: "m", points: ["p"] }, { type: "cards", title: "Layered security controls", message: "m", points: ["p"] }, { type: "diagram", title: "Deployment layers with Terraform", message: "m", points: ["p"] }, { type: "process", title: "Day-2 runbooks for known issues", message: "m", points: ["p"] }, { type: "table", title: "Support priorities", message: "m", points: ["p"] }] }] };
    }
    if (/Write exactly \d+ NEW slides/.test(t)) { const k = +t.match(/Write exactly (\d+)/)[1]; return { slides: Array.from({ length: k }, (x, i) => ({ type: "cards", title: "Extra rail topic " + (i + 1), message: "m", points: ["p"], section: 2 })) }; }
    if (/THIS IS PART OF A LONG DECK/.test(t)) {
      seen.parts.push(m);
      const out = [];
      t.split("\n").forEach((l) => { const q = l.match(/^\d+\. type "([^"]*)" \| title "([^"]*)"/); if (q) out.push({ type: q[1], title: q[2], lead: "Lead.", notes: "Notes.", items: [{ title: "One part", text: "First text about the rail solution." }, { title: "Two part", text: "Second text about the rail solution." }, { title: "Three part", text: "Third text about the rail solution." }] }); });
      return { slides: out };
    }
    return {};
  }, 3);
  sbRef = sb;
  props(sb, { VERTEX_PROJECT_ID: "p", VERTEX_LOCATION: "global" });
  let r = sb.generatePresentation({ mode: "create", presentationType: "Solution Deck", slideCount: 20, clientName: "Corvina Rail Systems", clientDomain: "corvina.com", prompt: CORVINA, runId: "R56" });
  let guard = 0; while (r && r.continue && guard++ < 20) r = sb.continueDeckGeneration(r.runId);
  assert.ok(seen.outline.length && seen.outline.every((m) => m === "gemini-4-argon"), "outline: " + seen.outline);
  assert.ok(seen.parts.length && seen.parts.every((m) => m === "gemini-4-argon"), "slides: " + seen.parts);
  assert.ok(seen.client.every((m) => m === "gemini-3.8-flash"), "client: " + seen.client);
  const titles = sb.drawn.map((d) => d.title);
  assert.ok(titles.some((t) => /reference architecture/i.test(t)), "architecture kept: " + titles.join(" | "));
  assert.ok(titles.some((t) => /terraform/i.test(t)), "Terraform kept");
  assert.ok(titles.some((t) => /next step/i.test(t)), "a next-step slide");
  assert.ok(!titles.some((t) => /proven value/i.test(t)), "no value slide in a technical deck");
  const cover = sb.drawn[0], closing = sb.drawn[sb.drawn.length - 1];
  assert.ok(!/^solution deck for/i.test(cover.title), "cover says the subject: " + cover.title);
  assert.ok(!/future|together/i.test(String(closing.subtitle || "")), "no slogan on the closing: " + closing.subtitle);
  let last = null; try { last = JSON.parse(sb.PropertiesService.getUserProperties().getProperty("LAST_RESULT_V1")); } catch (e) {}
  assert.ok(last && /^SUCCESS/.test(last.message), "the last result is kept for the menu");
});

test("the request's topics are read whole (1,200 and 'a primary and DR region design')", () => {
  const sb = SOL();
  const t = Array.from(sb.requestedTopics_(CORVINA));
  assert.ok(t.includes("primary and DR region design"), t.join(" | "));
  assert.ok(t.includes("reference architecture"));
  assert.ok(!t.some((x) => /^Condition-based maintenance for 1$/.test(x)));
  assert.equal(sb.requestedTopics_("Create a deck: risks and KPIs, the roadmap, and the team.").length >= 3, true);
});

test("deck 29: the outline checks never remove a requested topic, and a shared word no longer covers one", () => {
  const sb = SOL();
  const outline = [{ type: "diagram", title: "Reference architecture on Google Cloud", message: "How data flows" }, { type: "process", title: "Data ingestion via Pub/Sub", message: "Sensor readings and the architecture" },
    { type: "process", title: "Deployment layers with Terraform" }, { type: "stats", title: "The proven value of predictive maintenance" }, { type: "process", title: "Next steps: implementation plan" }, { type: "diagram", title: "End-to-end reference architecture" }];
  assert.deepEqual(Array.from(sb.outlineChecks_(outline, CORVINA, 20, null, { solution: true, tone: "technical" })).sort(), [3, 5]);
  const d29 = ["Data ingestion via Pub/Sub", "Data processing with Dataflow & BigQuery", "Layered security controls", "Primary and DR region design", "Day-2 runbooks for known issues"].map((title) => ({ type: "cards", title, message: "The architecture and its layers" }));
  assert.equal(sb.solutionTopicCovered_(d29, "reference architecture"), false);
  assert.equal(sb.solutionTopicCovered_(d29, "deployment layers with Terraform"), false);
  assert.equal(sb.solutionTopicCovered_(d29, "sensor readings streamed through Pub/Sub"), true);
  assert.equal(sb.solutionTopicCovered_(d29, "security controls (IAM / VPC Service Controls / CMEK)"), true);
});

test("deck 29 slide 15: security controls written in other fields are kept, never reduced to the title", () => {
  const sb = SOL();
  const sp = { type: "cards", deckLibrary: "solution", title: "Layered security controls", lead: "A multi-layered security approach protects data and resources.",
    layers: [{ name: "Identity", controls: ["IAM roles with least privilege", "Workload identity for Dataflow"] }, { name: "Perimeter", controls: ["VPC Service Controls around BigQuery and Vertex AI"] }, { name: "Encryption", controls: ["CMEK keys in Cloud KMS for BigQuery tables"] }] };
  assert.ok(sb.solutionTextCount_(sp) >= 4);
  sb.proposalCoerce_(sp, { log: [] }, {});
  assert.notEqual(sp.type, "statement");
  assert.match(JSON.stringify(sp), /CMEK keys in Cloud KMS/);
  const sp2 = { type: "cards", deckLibrary: "solution", title: "Layered security controls", controls: [{ control: "VPC Service Controls", text: "A perimeter around BigQuery" }, { control: "CMEK", text: "Customer keys" }] };
  assert.ok(sb.solutionRescue_(sp2));
  assert.match(JSON.stringify(sp2), /A perimeter around BigQuery/);
});

test("DR, HA and P1-P4 keep their capitals", () => {
  const sb = SOL();
  assert.equal(sb.solutionLabelCase_("DR region"), "DR region");
  assert.equal(sb.solutionLabelCase_("Primary and DR Regions"), "Primary and DR regions");
  const sp = { type: "table", title: "Support model and priorities", columns: ["Priority", "What it means"], rows: [["P1 (crit)", "Platform outage"], ["p2 (high)", "Degraded service"], ["P4 (low)", "General inquiry"]] };
  sb.solutionDisplayCase_(sp);
  assert.deepEqual(sp.rows.map((r) => r[0].slice(0, 2)), ["P1", "P2", "P4"]);
});

test("recovery targets and support times nobody gave are flagged, 100% uptime becomes high availability", () => {
  const sb = SOL();
  const dr = [{ type: "diagram", title: "Primary and DR region design", takeaway: "This design targets 100% uptime with RTO < 1 hour and RPO < 15 minutes." }];
  assert.equal(sb.solutionGivenTimes_(dr, CORVINA, {}), 1);
  assert.match(dr[0].takeaway, /targets high availability with RTO < 1 hour/);
  assert.match(dr[0].notes, /confirm them before sharing/);
  const sup = [{ type: "table", title: "Managed support priorities", rows: [["P1", "15-min response"], ["P2", "1-hour response"]] }];
  assert.equal(sb.solutionGivenTimes_(sup, CORVINA, {}), 1);
  assert.match(sup[0].notes, /15-min/);
});

test("retired products, claims about 66degrees and filler tails go", () => {
  const sb = SOL();
  const sp = { type: "process", title: "Ingestion", items: [{ title: "IoT Core", text: "Cloud IoT Core connects the switches. This constant data flow is crucial." }, { title: "Registry", text: "Images in Container Registry." }],
    notes: "66degrees provides a support framework. All requests are worked by expert engineers day or night using a follow-the-sun method." };
  sb.solutionFactsClean_(sp, CORVINA, []);
  assert.equal(sp.items[0].title, "IoT gateway");
  assert.equal(sp.items[0].text, "IoT gateway connects the switches.");
  assert.match(sp.items[1].text, /Artifact Registry/);
  assert.doesNotMatch(sp.notes, /follow-the-sun|day or night/);
  assert.match(sp.notes, /support framework/);
  const keep = { type: "cards", title: "x", items: [{ title: "a", text: "Pub/Sub handles thousands of messages per second." }] };
  sb.solutionFactsClean_(keep, CORVINA, []);
  assert.equal(keep.items[0].text, "Pub/Sub handles thousands of messages per second.");
});

test("research figures on a results slide say they are industry figures", () => {
  const sb = SOL();
  const slides = [{ type: "stats", title: "The proven value of predictive maintenance", items: [{ value: "20%", label: "Maintenance cost reduction" }, { value: "15%", label: "Reliability increase" }] }];
  sb.solutionResultsGuard_(slides, CORVINA, { research: [{ findings: ["Predictive maintenance cut maintenance cost by 20% and raised reliability by 15%"] }] }, { clientName: "Corvina Rail Systems", log: [] });
  assert.match(slides[0].lead, /Industry figures from published research/);
});

test("notes keep the source title and publisher, never a redirect link", () => {
  const sb = SOL();
  const plan = { slides: [{ type: "cards", title: "x", notes: "Text [1]. Source: railwayacademy.org, https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA" }] };
  sb.finalizeNotes_(plan, { research: [{ n: 1, title: "Predictive maintenance in rail", journal: "Railway Academy", year: 2025, url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/XYZ" }] });
  assert.doesNotMatch(plan.slides[0].notes, /grounding-api-redirect/);
  assert.match(plan.slides[0].notes, /\[1\] Predictive maintenance in rail \(Railway Academy, 2025\)/);
});

test("the menu can show the last result and test the AI models", () => {
  const src = read("src/Code.gs");
  assert.match(src, /addItem\('Show last result', 'showLastResult'\)/);
  assert.match(src, /addItem\('Test AI models', 'testAiModels'\)/);
  const sb = SOL();
  props(sb, { VERTEX_PROJECT_ID: "p", VERTEX_LOCATION: "global" });
  sb.ScriptApp = { getOAuthToken: () => "t" };
  sb.UrlFetchApp = { fetch(url, o) { const b = JSON.parse(o.payload); const img = !!b.generationConfig.responseModalities;
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(img ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }] } }] } : { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) }; } };
  const rep = sb.testConfiguredModels_();
  assert.match(rep, /OK +Outline: gemini-4-argon/);
  assert.match(rep, /OK +Slide writing: gemini-4-argon/);
  assert.match(rep, /OK +Research and checks: gemini-3\.8-flash/);
  assert.match(rep, /OK +Icons: gemini-3\.1-flash-image/);
  assert.match(rep, /All models answered/);
});

test("Brand.gs: only the reasoning level and the model record were added to the Vertex call", () => {
  const b = read("src/Brand.gs");
  assert.match(b, /geminiThinkingConfig_\(models\[m\]\)/);
  assert.match(b, /noteGeminiModel_\(models\[m\], m > 0\)/);
  assert.match(b, /function vertexAuthHeaders_\(\) \{\n  return \{ Authorization: 'Bearer ' \+ ScriptApp\.getOAuthToken\(\) \};/);
});
