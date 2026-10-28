"use strict";

// V.1_52 - the Solution Deck: its own design library (S66_*, from the 66degrees solution decks), never mixed with the
// Proposal Deck designs (only the two section dividers are shared); Gemini reads the TONE of the content (technical,
// executive, offering, enablement, internal) and writes the storyline and every slide in that tone; Solution Decks of
// 8+ slides are planned first (storyline) and built in parts like a long Proposal Deck.
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
const SHARED = ["P66_SECTION_DARK", "P66_SECTION_LIGHT", "P66_AGENDA_SPIRAL"];   // V.1_66: the spiral agenda (up to 6 sections) in every deck type

// A Solution Deck run with Gemini mocked: the outline follows the asked sections; each slide takes the first design
// offered for it, filled from the fixture sample of that design
function runSolution(n, prompt, seed) {
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
        out.push(fill(m[1], m[2], list)); });
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

test("version label is V.1_52 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[2-9]|[6-9]\d)'/);
});

test(".clasp.json pushes the Solution files after the Proposal files they build on", () => {
  const o = JSON.parse(read(".clasp.json")).filePushOrder;
  ["SolutionDesigns_1_Cards.gs", "SolutionDesigns_2_Flows.gs", "SolutionKit.gs"].forEach((f) => assert.ok(o.indexOf(f) !== -1, f + " is pushed"));
  assert.ok(o.indexOf("SolutionDesigns_1_Cards.gs") > o.indexOf("ProposalDesigns_4_Proof.gs"));
  assert.ok(o.indexOf("SolutionKit.gs") > o.indexOf("ProposalKit.gs"));
});

test("design libraries never mix: S66 designs only in a Solution Deck, Proposal designs only in a Proposal Deck (dividers shared)", () => {
  const sb = loadAll(() => ({}));
  const E = sb.ENGINE;
  const sol = Object.keys(E.SOLUTION_TAGS).filter((t) => SHARED.indexOf(t) === -1), prop = Object.keys(E.PROPOSAL_TAGS);
  assert.ok(sol.length >= 25, "the Solution library has its designs: " + sol.length);
  sol.forEach((t) => {
    assert.ok(/^S66_/.test(t), t + " is named S66_");
    assert.equal(E.inLibrary(t, "solution"), true, t);
    assert.equal(E.inLibrary(t, "proposal"), false, t + " never in a Proposal Deck");
    assert.equal(E.inLibrary(t, "general"), false, t + " never in a General deck");
  });
  prop.forEach((t) => assert.equal(E.inLibrary(t, "solution"), SHARED.indexOf(t) !== -1, t + (SHARED.indexOf(t) !== -1 ? " is shared" : " never in a Solution Deck")));
  const menuS = E.designMenu("solution"), menuP = E.designMenu("proposal"), menuG = E.designMenu("");
  assert.ok(!/S66_/.test(menuP) && !/S66_/.test(menuG), "no Solution design offered to a Proposal or General deck");
  const p66 = (menuS.match(/P66_[A-Z_]+/g) || []).filter((t) => SHARED.indexOf(t) === -1);
  assert.deepEqual(p66, [], "no Proposal-only design offered to a Solution Deck");
});

test("every Solution design draws its sample in a Solution Deck and never in a Proposal Deck", () => {
  const sb = loadAll(() => ({}));
  const E = sb.ENGINE;
  const tags = SAMPLES.map(tagOf);
  Object.keys(E.SOLUTION_TAGS).filter((t) => SHARED.indexOf(t) === -1).forEach((t) => assert.ok(tags.indexOf(t) !== -1, "a sample exists for " + t));
  SAMPLES.forEach((s) => {
    const t = tagOf(s);
    assert.equal(E.canDraw(Object.assign({}, s, { deckLibrary: "solution" })), true, t + " draws in a Solution Deck");
    if (/^S66_/.test(t)) assert.equal(E.canDraw(Object.assign({}, s, { deckLibrary: "proposal" })), false, t + " never draws in a Proposal Deck");
  });
});

test("Solution designs never cut a text short (no ellipsis) and keep inside the slide", () => {
  const sb = loadAll(() => ({}));
  SAMPLES.forEach((s) => {
    const out = sb.ENGINE.render({ slides: [Object.assign({ deckLibrary: "solution" }, s)] }, { dateLabel: "Oct 15, 2026" });
    (out || []).forEach((sl) => (sl.els || []).forEach((e) => {
      if (e.t === "text") assert.ok(!/…$/.test(String(e.text)), tagOf(s) + " cut: " + e.text);
      if (e.t === "text" || e.t === "rect") assert.ok(e.y + e.h <= 405.5 && e.x + e.w <= 720.5, tagOf(s) + " element inside the slide");
    }));
  });
});

test("the tone of the content: asked by name wins, otherwise the words of the request (and the sources)", () => {
  const sb = loadAll(() => ({}));
  const tone = (p, src) => sb.solutionTone_(p, { text: src || "" });
  assert.equal(tone("Solution deck for Acme, tone: offering. Cloud migration and architecture"), "offering");
  assert.equal(tone("Executive tone. Terraform, Ansible and a run book"), "executive");
  assert.equal(tone("Architecture and configuration of a BigQuery data platform with Terraform, IAM and test results"), "technical");
  assert.equal(tone("Managed services offering for Apigee with tiers, pricing and what is included"), "offering");
  assert.equal(tone("Business case for the CFO: value, ROI and the decision needed"), "executive");
  assert.equal(tone("Enablement plan: training levels, champions and cohorts to drive adoption"), "enablement");
  assert.equal(tone("Internal pipeline review for our sales team: wins, gaps and asks"), "internal");
  assert.equal(tone("A solution deck for Acme"), "executive", "nothing points: executive");
  assert.equal(tone("A solution deck for Acme", "Failover runbook, cluster topology, latency and VPC settings"), "technical", "the attached text decides when the request is silent");
});

test("the tone card goes into the outline and every part prompt, and the tone is logged", () => {
  const { r, prompts } = runSolution(12);
  assert.match(r.message, /Tone of the content: Technical\./);
  assert.match(prompts.outline, /TONE OF THE CONTENT: Technical/);
  assert.match(prompts.outline, /THINK LIKE THE SOLUTION ARCHITECT/);
  assert.ok(prompts.parts.length >= 1);
  prompts.parts.forEach((p) => {
    assert.match(p, /TONE OF THE CONTENT: Technical/);
    assert.ok(!/designs to choose from: [^\n]*P66_/.test(p.replace(/P66_SECTION_(DARK|LIGHT)/g, "")), "only Solution designs are offered");
    assert.match(p, /designs to choose from: S66_/);
  });
});

test("a tone instruction is never read as a requested topic", () => {
  const sb = loadAll(() => ({}));
  const t = sb.requestedTopics_("Create a solution deck for Nordlys: technical tone. Data pipelines, model tests and a run book.");
  assert.ok(!t.some((x) => /tone/i.test(x)), JSON.stringify(t));
  assert.ok(t.some((x) => /run book/i.test(x)), JSON.stringify(t));
  assert.ok(!sb.requestedTopics_("Deck for Acme. Tone: executive. Cover: value, roadmap").some((x) => /tone|executive/i.test(x)));
});

test("Solution Decks of 8+ slides are planned and built in parts; 7 slides stay one run", () => {
  const a = runSolution(8);
  assert.match(a.r.message, /built in parts/);
  assert.equal(a.drawn.length, 8);
  const b = runSolution(7);
  assert.ok(!/built in parts/.test(b.r.message), "a 7-slide Solution Deck is one run");
  assert.ok(b.prompts.short && /Solution Deck designs/.test(b.prompts.short), "the short path offers the Solution design menu");
  assert.ok(!/P66_(?!SECTION_)/.test(b.prompts.short.split("DESIGN MENU")[1] || ""), "no Proposal design in the short menu");
});

test("a Solution Deck is drawn only from its library: agenda rows, shared dividers, S66 designs", () => {
  [12, 20, 30].forEach((n, i) => {
    const { drawn } = runSolution(n, null, i + 2);
    assert.equal(drawn.length, n, n + " slides drawn");
    const bad = drawn.map(tagOf).filter((t) => t && !/^S66_/.test(t) && SHARED.indexOf(t) === -1);
    assert.deepEqual(bad, [], "no Proposal or General design in a " + n + "-slide Solution Deck");
    assert.equal(tagOf(drawn[1]), "S66_AGENDA_ROWS");
    const body = drawn.filter((d) => !/cover|agenda|closing|section/.test(d.type));
    assert.ok(body.filter((d) => /^S66_/.test(tagOf(d))).length >= body.length * 0.8, "most body slides use a Solution design");
    drawn.filter((d) => d.type === "section").forEach((d) => assert.ok(SHARED.indexOf(tagOf(d)) !== -1, "divider is a shared 66degrees divider"));
  });
});

test("the Solution agenda lists the sections with their one-line description (no Introduction / Thank you rows)", () => {
  const sb = loadAll(() => ({}));
  const ag = { type: "agenda" };
  const more = sb.solutionAgenda_(ag, [{ title: "Introduction", points: [] }, { title: "The problem", points: ["a", "b"], description: "Why manual failover breaks" }, { title: "What we built", points: ["Cluster", "Listener"] }, { title: "Thank you", points: [] }]);
  assert.equal(more, null);
  assert.equal(ag.lockTag, "S66_AGENDA_ROWS");
  assert.deepEqual(ag.items.map((x) => x.title), ["The problem", "What we built"]);
  assert.equal(ag.items[0].text, "Why manual failover breaks");
  assert.equal(ag.items[1].text, "Cluster · Listener");
  const big = { type: "agenda" };
  const rows = Array.from({ length: 13 }, (x, i) => ({ title: "Section " + (i + 1), points: [] }));
  const cont = sb.solutionAgenda_(big, rows);
  assert.equal(big.items.length, 10);
  assert.ok(cont && cont.continued && cont.items.length === 3 && cont.lockTag === "S66_AGENDA_ROWS");
});

test("the Solution voice: no emoji, hashtags, exclamation marks or shouting; acronyms and ticks stay", () => {
  const sb = loadAll(() => ({}));
  const v = sb.solutionVoiceText_;
  assert.equal(v("Great results! Use the CMEK controls!"), "Great results. Use the CMEK controls.");
  assert.equal(v("Fast, safe! and cheap"), "Fast, safe, and cheap");
  assert.equal(v("THE PROBLEM WITH MANUAL OPS"), "The problem with manual OPS");
  assert.equal(v("Run SQL on GKE with IAM"), "Run SQL on GKE with IAM");
  assert.equal(v("Ship it 🚀 #SuccessIsPredictable"), "Ship it");
  assert.equal(v("✓ Supported → next ★"), "✓ Supported → next ★");
  const sp = { type: "cards", design: "S66_ICON_CARD_GRID", notes: "Keep! this", items: [{ title: "THE AMAZING RESULTS", text: "Done!" }] };
  sb.solutionVoiceClean_(sp);
  assert.equal(sp.items[0].title, "The amazing results");
  assert.equal(sp.items[0].text, "Done.");
  assert.equal(sp.notes, "Keep! this", "speaker notes are left as written");
});

test("a reshaped slide never repeats its title as the takeaway band", () => {
  const sb = loadAll(() => ({}));
  const alts = sb.proposalAlternatives_({ type: "bullets", title: "Run book", statement: "Run book", deckLibrary: "solution", points: ["Prepare: check the replicas", "Fail over: promote the DR node", "Verify: clients reconnect"] });
  assert.ok(alts.length >= 1);
  alts.forEach((a) => assert.notEqual(String(a.takeaway || "").toLowerCase(), "run book"));
});

test("the Solution outline tells one story in the tone (fewer sections share the parts)", () => {
  const sb = loadAll(() => ({}));
  const rules = sb.solutionOutlineRules_({ solutionTone: "offering" });
  assert.match(rules, /TONE OF THE CONTENT: Offering/i);
  assert.match(rules, /why organizations need it/);
  assert.match(rules, /neighbouring parts share a section/);
});
