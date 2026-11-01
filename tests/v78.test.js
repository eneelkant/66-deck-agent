"use strict";

// V.1_78 - one release for the V.1_77 test decks (deck 49: General, Proposal, Solution and the Frontdoor rebrand;
// tests/fixtures/deck49-slide-log.json): the quality pass (Quality.gs), the Create fixes and the rebrand fixes
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const LOG = JSON.parse(read("tests/fixtures/deck49-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => e.text);
const SOL = "Create a 40-slide solution deck for Fabrikam Insurance: migrating the claims platform to GKE and Cloud SQL. Targets: 99.95% availability, 40% lower infrastructure cost and 30% faster claims processing. Include current architecture, target architecture, security, RACI, risks and next steps.";
const ctxFor = (p) => { const c = { log: [], userPrompt: p, approvedFacts: [], brand: { name: "66degrees" } }; c.brief = G.briefFromText_(p, 40); return c; };

// ---------------- release

test("version label is V.1_78 or later; Quality.gs is pushed after Finish.gs and runs after the finish check", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[8-9]|[8-9]\d)'/);
  const order = JSON.parse(read(".clasp.json")).filePushOrder;
  assert.ok(order.indexOf("Quality.gs") > order.indexOf("Finish.gs"));
  assert.match(read("src/Code.gs"), /deckFinishCheck_\(plan\.slides, ctx\);[^\n]*\n\s*deckQuality_\(plan\.slides, ctx, started\);/);
  assert.match(read("src/Code.gs"), /deckFinishCheck_\(plan\.slides, ctx\);[^\n]*\n\s*deckQuality_\(plan\.slides, ctx, b0\);/);
  assert.match(read("src/Code.gs"), /kindRulesBlock_\(ctx, batch\)/);
  assert.doesNotMatch(read("src/Quality.gs"), /AIza[0-9A-Za-z_-]{20,}/, "no key in the source");
});

// ---------------- Part A: the quality pass

test("A1. dictionaries: product names, English only, full words (URLs untouched)", () => {
  assert.equal(G.productCase_("we use bigquery daily; see https://cloud.google.com/bigquery"), "we use BigQuery daily; see https://cloud.google.com/bigquery");
  assert.equal(G.englishOnly_("Targets mencapai 99.9% uptime"), "Targets achieve 99.9% uptime");
  assert.equal(G.fullWords_("Cross-region rep and infra mgmt"), "Cross-region replication and infrastructure management");
});

test("A2. a meaning-review fix is used only when it keeps every figure and name", () => {
  assert.equal(G.reviewFixOk_("Achieve 99.95% uptime for Contoso", "Reach 99.95% uptime for Contoso"), true);
  assert.equal(G.reviewFixOk_("Achieve 99.95% uptime", "Achieve 99.9% uptime"), false, "figure changed");
  assert.equal(G.reviewFixOk_("Migrate with Cloud SQL Enterprise Plus", "Migrate with a managed database"), false, "name dropped");
  assert.equal(G.reviewFixOk_("Same text", "Same text"), false);
});

test("A3. per-kind rules and positive writing rules go into the content prompt", () => {
  const block = G.kindRulesBlock_({ brief: {} }, { slides: [{ title: "Pricing options", topic: "pricing" }] });
  assert.match(block, /WRITING RULES/);
});

test("A4. final lock: Solution 6 shows the brief's targets as figures", () => {
  const out = [spec("Solution", 6)];
  G.finalKpi_(out, ctxFor(SOL));
  assert.equal(out[0].type, "stats");
  assert.equal(out[0].items.map((i) => i.value).join("|"), "99.95%|40%|30%");
});

test("A5. final lock: Solution 35 RACI has party columns with role letters, never a sentence", () => {
  const out = [spec("Solution", 35)];
  G.finalLock_(out, ctxFor(SOL));
  const sp = out[0];
  assert.equal(sp.type, "table");
  assert.equal(sp.columns[0], "Workstream");
  sp.rows.forEach((r) => r.slice(1).forEach((c) => assert.ok(String(c).split(/\s+/).length <= 4, c)));
  assert.ok(sp.rows.some((r) => /Accountable \/ Responsible/.test(r.join("|"))));
});

test("A6. General 36 pricing: an options table with no invented amounts, and the pricing line", () => {
  const out = [spec("General", 36)];
  G.finalLock_(out, ctxFor(SOL));
  const sp = out[0];
  assert.equal(sp.columns.join("|"), "Engagement model|What it includes");
  assert.match(sp.lead, /Pricing is confirmed after the scoping workshop/);
  assert.doesNotMatch(JSON.stringify(sp.rows), /\$\s?\d/);
});

test("A7. odd precision: 3+ decimals round to one, never up to 100%", () => {
  const o = { a: "99.999%", b: "12.3456%", c: "99.95%" };
  G.roundOddPrecision_(o);
  assert.deepEqual(JSON.parse(JSON.stringify(o)), { a: "99.999%", b: "12.3%", c: "99.95%" });
});

test("A8. credentials: 350+ technical experts, no '600+ footprint'", () => {
  assert.equal(G.footprintFix_("Our 600+ strong global footprint brings deep expertise."), "Our team of 350+ technical experts brings deep expertise.");
  assert.equal(G.capStart_("align on scope"), "Align on scope");
});

// ---------------- Part B: Create layouts

test("B1. proposal cover: the 66degrees wordmark stays top-left and the client logo stands beside it", () => {
  const o = draw({ type: "cover", deckLibrary: "proposal", clientLogo: true, title: "Proposal" });
  const mark = o.els.find((e) => e.asset === "logo-dark"), logo = o.els.find((e) => e.asset === "client-logo");
  assert.ok(mark && logo);
  assert.ok(logo.x > mark.x + mark.w, "beside the wordmark");
});

test("B2. points written as {title, text} show their text", () => {
  const o = draw({ type: "bullets", title: "How it works", points: [{ title: "Replication", text: "Writes go to both regions" }, { title: "Failover", text: "Traffic moves in minutes" }, { title: "Checks", text: "Health checks every 10 seconds" }] });
  assert.match(texts(o).join(" "), /Replication: writes go to both regions/i);
});

// ---------------- Part C: rebrand

test("C1. a rebranded cover keeps its label and facts as one line; dates and the title are not repeated", () => {
  const it = { texts: [
    { text: "PL/SQL to .NET Microservices Modernization", x: 60, y: 189 }, { text: "Phase 1 API Test Plan", x: 60, y: 297 },
    { text: "66DEGREES & FRONTDOOR", x: 60, y: 160 }, { text: "•", x: 230, y: 158 }, { text: "QA Strategy & Delivery", x: 240, y: 160 },
    { text: "52 PL/SQL Objects in Scope", x: 60, y: 366 }, { text: "Karate API Automation", x: 260, y: 366 }, { text: "September 2026", x: 60, y: 400 }] };
  const facts = G.coverFacts_({ title: "PL/SQL to .NET Microservices Modernization", subtitle: "Phase 1 API Test Plan" }, it);
  // (V.1_79: the client name keeps its capital and the facts break between facts, never inside one)
  // (V.1_80: in sentence case like the rest of the deck)
  assert.equal(facts, "66degrees & Frontdoor · QA strategy & delivery · 52 PL/SQL objects in scope\nKarate API automation");
  const o = draw({ type: "cover", title: "PL/SQL to .NET microservices modernization", subtitle: "Phase 1", facts: facts.split("\n") });
  facts.split("\n").forEach((ln) => assert.ok(texts(o).includes(ln), ln));
});

test("C2. a rebranded closing keeps its own title and its Author / Target line; a created deck still says Thank You!", () => {
  const own = draw({ type: "closing", keepTitle: true, title: "Phase 1 strategy ready for review", subtitle: "Aligned for delivery", facts: "Author: R · Target: 28/09/2026 - 07/12/2026" });
  assert.ok(texts(own).includes("Phase 1 strategy ready for review"));
  assert.ok(!texts(own).includes("Thank You!"));
  assert.ok(texts(own).includes("Author: R · Target: 28/09/2026 - 07/12/2026"));
  assert.ok(texts(draw({ type: "closing", title: "Phase 1 ready" })).includes("Thank You!"));
  const facts = G.coverFacts_({ title: "Phase 1 Strategy Ready for Review", subtitle: "Aligned" }, { texts: [{ text: "Phase 1 Strategy Ready for Review", x: 0, y: 224 }, { text: "Author: R", x: 0, y: 352 }, { text: "Target: 28/09/2026 - 07/12/2026", x: 300, y: 352 }] }, true);
  assert.equal(facts, "Author: R · Target: 28/09/2026 - 07/12/2026");
  assert.match(read("src/Rebrand.gs"), /"title":<its own title, exactly as written>/);
});

test("C3. text clean-up keeps the space before .NET", () => {
  assert.match(read("src/Engine.gs"), /\.replace\(\/\[ \\t\]\+\(\[\.,;:\]\)\(\?=\\s\|\$\)\/g, '\$1'\)/);
  assert.equal("Move PL/SQL to .NET , then test .".replace(/[ \t]+([.,;:])(?=\s|$)/g, "$1"), "Move PL/SQL to .NET, then test.");
});

test("C4. casing: short Title Case labels and words after a figure follow the restyled slides", () => {
  const sc = (t) => G.rebrandCase_(G.rebrandSentence_(t));
  assert.equal(sc("API Request"), "API request");
  assert.equal(sc("DML Validation"), "DML validation");
  assert.equal(sc("100% Test execution"), "100% test execution");
  assert.equal(sc("UI & Front-End"), "UI & front-end");
  assert.equal(sc("Phase 1 Strategy Ready for Review"), "Phase 1 strategy ready for review");
  assert.equal(sc("1. Data Migration"), "1. Data migration");
  assert.equal(sc("Gemini Enterprise rollout"), "Gemini Enterprise rollout");
});

// a Slides API text box for the rebrand helpers (positions in points)
let seq = 0;
const box = (text, x, y, w, h, size, ls) => ({
  objectId: "t78_" + (++seq), size: { width: { magnitude: w * 12700 }, height: { magnitude: h * 12700 } },
  transform: { scaleX: 1, scaleY: 1, translateX: x * 12700, translateY: y * 12700 },
  shape: { shapeType: "TEXT_BOX", shapeProperties: {}, text: { textElements: [
    { paragraphMarker: { style: ls ? { lineSpacing: ls } : {} } },
    { textRun: { content: text + "\n", style: { fontSize: { magnitude: size } } } }] } } });
const sz = (te) => te.textRun.style.fontSize.magnitude, wt = () => 400;

test("C5. a paragraph at 160% line spacing that would run into the heading under it is set smaller (deck 49 slide 4)", () => {
  const t = "Compares data outcomes between legacy PL/SQL execution and modernized .NET microservice pathways. QA executes endpoints, captures JSON responses, and compares them 1:1 against live test database data using custom Cursor-generated SQL scripts.";
  const el = box(t, 60, 203.1, 406.5, 81.6, 12.75, 159.9);
  const f = G.fitFactor_(el, sz, wt, 311.7 - 203.1 - 3);
  assert.ok(f < 1, "shrinks: " + f);
  assert.equal(G.rebrandLines_(t, 406.5, 400, 12.75), 5, "measured at the box's own width");
  assert.equal(G.rebrandLines_("Manages communications calendar", 86.9, 400, 7), 2, "short labels keep the allowance (V.1_61)");
});

test("C6. the eyebrow above a title is found (it leaves the slide, its words go to the notes)", () => {
  const S = 960 / 720;
  const title = box("Purpose & Strategic Objectives", 60, 52, 600, 34, 27);
  const brow = box("DOCUMENT INTENT", 60, 30, 200, 14, 9);
  const body = box("Defines the quality assurance strategy", 60, 200, 400, 40, 12);
  const roles = G.detectRoles({ pageElements: [title, brow, body] }, {}, 960, 540, S, {});
  assert.equal(roles.title.el, title);
  assert.equal(roles.eyebrow.el, brow);
  assert.match(read("src/Rebrand.gs"), /'Slide label: ' \+ fixAllCaps\(r\.eyebrowText\)/);
});

test("C7. the content under a moved title moves up as one block; a slide with a side panel stays", () => {
  const S = 960 / 720;
  const title = box("In Scope", 60, 39, 900, 32.4, 27);
  // (V.1_80: short content sits nearer the middle, so the block here is a full slide of content)
  const a = box("API Parity Testing", 60, 174.6, 523, 21, 16.5), b = box("Compares data outcomes", 60, 203.1, 406, 260, 12.75);
  const roles = G.detectRoles({ pageElements: [title, a, b] }, {}, 960, 540, S, {});
  const reqs = [];
  const dy = G.liftContent_(reqs, { pageElements: [title, a, b] }, roles, {}, S, 960, 540);
  assert.ok(dy > 20 * S, "moved " + dy);   // (V.1_79: short content sits a little above the middle, not at the top)
  assert.equal(reqs.length, 2);
  reqs.forEach((q) => assert.equal(q.updatePageElementTransform.applyMode, "RELATIVE"));
  const side = box("Side panel", 700, 20, 200, 400, 12);
  const roles2 = G.detectRoles({ pageElements: [title, a, b, side] }, {}, 960, 540, S, {});
  assert.equal(G.liftContent_([], { pageElements: [title, a, b, side] }, roles2, {}, S, 960, 540), 0);
});

test("C8. icons: a low wide picture is an icon, every icon is swapped for a brand outline icon, empty icon tiles get one", () => {
  const strip = { objectId: "img78a", image: {}, size: { width: { magnitude: 127 * 12700 }, height: { magnitude: 18 * 12700 } }, transform: { scaleX: 1, scaleY: 1, translateX: 70 * 12700, translateY: 233 * 12700 } };
  const label = box("UI & Front-End", 70, 261, 167, 18, 12);
  const it = G.buildInventory({ objectId: "p78", pageElements: [strip, label] }, 0, 960, 540);
  assert.equal(it.icons.length, 1);
  assert.equal(it.icons[0].box.w, 18);
  assert.equal(G.iconLabel_(it, it.icons[0].box), "UI & Front-End");
  const code = read("src/Rebrand.gs");
  assert.doesNotMatch(code, /r\.icons = isCreate \? \(r\.icons \|\| \{\}\) : \{\};/, "a rebrand no longer keeps its own icons");
  assert.match(code, /r\.remove_images = r\.remove_images\.filter\(function \(id\) \{ return id !== ic\.id; \}\)/, "an icon is never removed");
  // two same-size tiles, one with an icon: the empty one gets an icon
  const tile = (id, x) => ({ objectId: id, size: { width: { magnitude: 30 * 12700 }, height: { magnitude: 30 * 12700 } }, transform: { scaleX: 1, scaleY: 1, translateX: x * 12700, translateY: 100 * 12700 },
    shape: { shapeType: "ROUND_RECTANGLE", shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: { red: 0.9, green: 0.95, blue: 1 } } } } } } });
  const t1 = tile("tile78a", 60), t2 = tile("tile78b", 500);
  const it2 = { icons: [{ id: "ic", x: 65, y: 105, w: 20, h: 20 }], texts: [{ id: "x", text: "Primary objective", x: 500, y: 140 }], bounds: { x: { x: 500, y: 140, w: 200, h: 18 } } };
  const empty = G.emptyIconTiles_({ pageElements: [t1, t2] }, it2, 1);
  assert.equal(empty.length, 1);
  assert.equal(empty[0].near, "Primary objective");
});

test("C9. the 66 mark: panels that reach over it end above it; footer clearance runs in a rebrand", () => {
  assert.match(read("src/Rebrand.gs"), /clearFooterText_\(slide, mk, pageH\); clearMarkArea_\(slide, mk, pageH, S\);/);
});

test("C10. the rebrand check measures overlap with the paragraph's line spacing", () => {
  assert.match(read("src/Rebrand.gs"), /lines \* rebrandLineH_\(size, ls\)/);
});
