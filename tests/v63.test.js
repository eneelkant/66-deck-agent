"use strict";

// V.1_63 (Proposal deck 35, ZoomInfo, 61 slides): the dark streak slide is the one transition slide of every deck and is
// never the background of a content slide; the agenda banner spans the slide and lists the numbered sections only; a
// slide no proposal design could draw as written is drawn in the design of the shape its content really has (two sides,
// rows, two teams, actions, figures) instead of "Label: a; b; c" bullets; points stay sentences; a design used again in
// a long deck stays away from its last place; ordinary words in the request are not names; an empty first slide goes.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));
const { plan: deck35 } = require("./fixtures/proposal-deck35-shapes.js");

function load(seed) {
  let sd = seed || 7;
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
const render = (g, sp) => g.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));

test("version label is V.1_63 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[3-9]|[7-9]\d)'/);
});

test("transition: the dark streaks in every deck type; a workstream is the same slide without a number", () => {
  const g = load();
  for (let i = 0; i < 200; i++) {
    assert.equal(g.proposalStyles_({}).dividerTag, "P66_SECTION_DARK");
    assert.equal(g.proposalStyles_({}, "solution").dividerTag, "P66_SECTION_DARK");
  }
  const ws = [{ type: "section", level: 2, title: "Cloud FinOps workstream", number: "05" }, { type: "section", title: "Governance", number: "05" }];
  g.applyProposalFrame_(ws, { presentationType: "Proposal Deck", proposal: { client: null, logoId: "", sectionStyle: "light" } });
  assert.deepEqual(ws.map((s) => s.lockTag), ["P66_SECTION_DARK", "P66_SECTION_DARK"]);
  assert.equal(ws[0].number, undefined);
  const w = render(g, Object.assign({}, ws[0], { reference: { tag: "P66_SECTION_DARK" } }));
  assert.equal(w.bgImage, "section-bg");
  assert.ok(!texts(w).some((t) => /^\d\d$/.test(t)), "no number on a workstream: " + texts(w).join(" | "));
  const gen = render(g, { type: "section", title: "Our approach", number: "02", sectionStyle: "light" });
  assert.equal(gen.bgImage, "section-bg", "a General deck has the same transition");
  assert.ok(!gen.els.some((e) => e.asset === "watermark-66"));
  const no = gen.els.find((e) => e.t === "text" && e.text === "02");
  assert.ok(no && no.size <= 18);
});

test("the streak picture is never the full background of a content slide; a photo strip stays", () => {
  const g = load();
  const pts = ["Shared catalog of governed data", "One semantic layer for every team", "Automated quality checks"];
  const dark = render(g, { deckLibrary: "proposal", type: "cards", title: "Target business outcomes", lead: "Lead.", items: [1, 2, 3, 4].map((i) => ({ title: "Outcome " + i, points: pts })), reference: { tag: "P66_PARADIGM_DARK" } });
  assert.equal(dark.drawnWith, "P66_PARADIGM_DARK");
  assert.equal(dark.bgImage, undefined);
  assert.equal(dark.bg, g.ENGINE.TOKENS.ink);
  const strip = render(g, { deckLibrary: "proposal", type: "comparison", title: "Two options", left: { label: "Option A", points: ["One thing here that matters", "Two things"] }, right: { label: "Option B", points: ["Three", "Four things here"] }, reference: { tag: "P66_TWO_PANELS" } });
  assert.equal(strip.bgImage, "section-bg");
});

test("agenda: the banner picture has the band's own shape (it fills the band), numbered sections only", () => {
  const g = load();
  const b = Buffer.from(vm.runInContext("NAVY_BAND_JPG_", g), "base64");
  let i = 2, w = 0, h = 0;
  while (i < b.length) { const mk = b[i + 1], len = b.readUInt16BE(i + 2); if (mk >= 0xc0 && mk <= 0xc3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; } i += 2 + len; }
  assert.ok(Math.abs(w / h - 720 / 112) < 0.05, w + "x" + h);
  const ctx = { presentationType: "Proposal Deck", log: [], proposal: { client: null, logoId: "", sectionStyle: "dark", dividerTag: "P66_SECTION_DARK", agendaWide: "P66_AGENDA_TWO_COLUMNS" } };
  const names = ["Context", "Context", "Context", "Architecture", "Architecture", "Architecture", "Delivery", "Delivery", "Delivery"];
  const p = { slides: [{ type: "cover", title: "x" }, { type: "agenda", title: "Agenda", items: [] }].concat(names.map((n, k) => ({ type: "cards", title: "Slide " + k, section: n }))).concat([{ type: "closing", title: "Thank You!" }]) };
  g.proposalStructure_(p, ctx, 3);
  assert.equal(JSON.stringify(p.slides[1].items.map((r) => r.title)), JSON.stringify(["Context", "Architecture", "Delivery"]));
  const rows = Array.from({ length: 8 }, (_, k) => ({ title: "Section " + (k + 1), points: ["Topic a", "Topic b"] }));
  const two = render(g, { deckLibrary: "proposal", type: "agenda", title: "Agenda", items: rows, reference: { tag: "P66_AGENDA_TWO_COLUMNS" } });
  assert.ok(texts(two).includes("01") && texts(two).includes("08"), texts(two).join(" | "));
});

test("deck 35 shapes: no proposal slide falls back to a plain layout (two sides, scope, rows, teams, actions, figures)", () => {
  for (const seed of [3, 7, 11, 19]) {
    const g = load(seed);
    const p = { slides: deck35() };
    const ctx = { log: [], lib: null, tokens: null, deckSize: 60, presentationType: "Proposal Deck" };
    g.chooseDesignsByContent_(p, ctx);
    const plain = p.slides.map((sp) => [sp.title, g.ENGINE.measure(sp, {}).drawnWith]).filter((x) => /^base:/.test(x[1]));
    assert.equal(plain.length, 0, "seed " + seed + ": " + JSON.stringify(plain));
    assert.ok(!ctx.log.some((l) => /plain \w+ layout used/.test(l)), ctx.log.join("\n"));
  }
});

test("the shape the content has: two sides -> comparison, team words -> team, rows -> table, actions -> rows, figures -> KPIs", () => {
  const g = load();
  const shapes = (sp) => JSON.parse(JSON.stringify(g.proposalReshapes_(Object.assign({ deckLibrary: "proposal" }, sp)).map((c) => c.type)));
  assert.equal(shapes({ type: "bullets", title: "Scope: what is in and what is out", items: [{ title: "In scope", points: ["A"] }, { title: "Out of scope", points: ["B"] }] })[0], "comparison");
  assert.equal(shapes({ type: "bullets", title: "RACI responsibility matrix", items: [{ title: "Our pod", points: ["A"] }, { title: "Client", points: ["B"] }] })[0], "team");
  assert.equal(shapes({ type: "comparison", title: "Internal BI versus external APIs", rows: [{ label: "Latency", left: "Seconds", right: "Sub-second" }, { label: "Access", left: "RBAC", right: "API keys" }] })[0], "table");
  const act = g.proposalReshapes_({ deckLibrary: "proposal", type: "bullets", title: "Week one actions", points: ["Week one actions", "Run the kickoff.", "Set up access.", "Start discovery."] })[0];
  assert.equal(act.type, "process");
  assert.equal(act.items.length, 3, "the title repeated as a point is not a step");
  const sp = { deckLibrary: "proposal", type: "cards", title: "The surge of unstructured data", items: [{ value: "<33%", title: "Historical share", text: "Less than a third." }, { value: "2x", title: "Growth", text: "Doubles." }, { value: "67%", title: "Investment", text: "Two thirds." }] };
  g.proposalCoerce_(sp, { log: [] }, {});
  assert.equal(sp.type, "stats");
  assert.equal(sp.items[0].value, "<33%");
});

test("points stay sentences: no 'a; b; c' text and no '.;' anywhere", () => {
  const g = load();
  const o = render(g, { type: "bullets", title: "Siloed reporting", items: [{ title: "Legacy approach", points: ["Queues delay analysis by weeks", "Silos conflict across sales and finance."] }, { title: "Target state", points: ["Self-service discovery", "Negotiated KPIs"] }] });
  const t = texts(o).join(" | ");
  assert.doesNotMatch(t, /;\s/);
  assert.doesNotMatch(t, /\.;/);
  assert.match(t, /Queues delay analysis by weeks\. Silos conflict/);
});

test("a design used again in a long deck is kept away from its last place", () => {
  const g = load(5);
  // 30 slides of the same kind (more than there are designs for it): each repeat is at least 8 slides from the last one
  const slides = Array.from({ length: 30 }, (_, i) => ({ deckLibrary: "proposal", type: "cards", title: "Capabilities " + i, lead: "Lead line for the slide.",
    items: [1, 2, 3, 4].map((k) => ({ title: "Capability " + k, text: "One or two sentences that explain this capability and why it matters to the teams." })) }));
  g.chooseDesignsByContent_({ slides }, { log: [], lib: null, tokens: null, deckSize: 30, presentationType: "Proposal Deck" });
  // (about six designs can draw this content: they come round in turn, never one right after itself or two slides later)
  const last = {}, gaps = [];
  slides.forEach((sp, i) => { const t = sp.reference && sp.reference.tag; if (!t) return; if (last[t] != null) gaps.push(i - last[t]); last[t] = i; });
  // (V.1_73: at most 3 dark slides in a deck, so 30 slides of cards rotate through the 3 light designs: a design comes
  //  back after 3 slides at the earliest, never right after itself or two slides later)
  assert.ok(Math.min.apply(null, gaps) >= 3, gaps.join(","));
  assert.ok(gaps.reduce((a, b) => a + b, 0) / gaps.length >= 3, gaps.join(","));
});

test("ordinary business words in the request are not names; real names keep their capitals", () => {
  const g = load();
  g.setRunNames_("Create a proposal for ZoomInfo on Enterprise Data and Analytics modernization with Project Darwin.");
  assert.equal(g.keepNames_(g.sentenceCase_("Enterprise Data and Analytics Proposal for ZoomInfo", 1)), "Enterprise data and analytics proposal for ZoomInfo");
  assert.equal(g.keepNames_("project darwin"), "Project Darwin");
});

test("an empty first slide of a new presentation goes even when the run's own list missed it; nothing else is removed", () => {
  const src = read("src/Code.gs");
  assert.match(src, /st\.startCount === 1 && st\.firstId && all\.length > 1 && all\[0\]\.getObjectId\(\) === st\.firstId && isBlankDeck\(\[all\[0\]\]\)/);
});
