"use strict";

// V.1_64: every slide of every deck type passes the deck check before it is drawn (nothing under the title, content
// missing, only headings, a plain layout in a Proposal or Solution deck, points run together, cut or overlapping text,
// the transition picture behind content); a slide that fails is drawn again with the design that shows it best. Every
// slide drawn - with its content, design and check result - goes to the slide log (deck_agent.deck_slides), and any
// logged slide can be replayed here: the files in tests/fixtures/reported/ must all come out clean.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const cp = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("version label is V.1_64 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[4-9]|[7-9]\d)'/);
});

test("every reported slide comes out clean with the current code", () => {
  const sb = loadAddon(5);
  const dir = path.join(ROOT, "tests/fixtures/reported");
  const files = fs.readdirSync(dir).filter((f) => /\.json$/.test(f));
  assert.ok(files.length >= 10);
  files.forEach((f) => {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const res = replay(sb, r.spec);
    assert.equal(res.issues.length, 0, f + ": " + res.issues.join(",") + " (" + res.design + ")");
    assert.doesNotMatch(res.design, /^base:/, f);
  });
});

test("the check corrects a slide: a Proposal slide whose design gives way is not left as a plain layout", () => {
  const sb = loadAddon(5);
  const spec = { deckLibrary: "proposal", type: "bullets", title: "Siloed reporting versus consumable data products", lead: "Lead.",
    items: [{ title: "Legacy approach", points: ["Queues delay analysis by weeks", "Silos conflict across teams"] }, { title: "Target state", points: ["Self-service discovery", "Negotiated KPIs"] }],
    reference: { tag: "P66_KEY_INPUTS" } };
  const res = replay(sb, spec);
  assert.equal(res.issues.length, 0, res.issues.join(","));
  assert.doesNotMatch(res.design, /^base:/);
});

test("the check finds what it should and nothing on good slides (General, Proposal, Solution fixtures)", () => {
  const sb = loadAddon(5);
  const iss = (out, spec) => JSON.parse(JSON.stringify(sb.ENGINE.slideIssues(out, spec)));
  const spec = { type: "cards", title: "T", items: [{ title: "A", text: "Alpha beta gamma delta epsilon zeta" }, { title: "B", text: "Eta theta iota kappa lambda mu" }] };
  assert.ok(iss({ els: [] }, spec).includes("empty"));
  assert.ok(iss({ els: [{ t: "text", x: 30, y: 100, w: 600, h: 40, size: 10, text: "Alpha; beta; gamma; delta" }] }, spec).includes("joined-points"));
  assert.ok(iss({ els: [{ t: "text", x: 30, y: 100, w: 600, h: 40, size: 10, text: "A text cut short…" }] }, spec).includes("cut"));
  assert.ok(iss({ drawnWith: "base:bullets", els: [{ t: "text", x: 30, y: 100, w: 600, h: 40, size: 10, text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa" }] }, Object.assign({ deckLibrary: "solution" }, spec)).includes("plain-layout"));
  const fx = path.join(ROOT, "tests/fixtures/");
  const sets = [require(fx + "deck6-specs.js"), require(fx + "deck8-specs.js"),
    JSON.parse(read("tests/fixtures/solution-samples.json")).map((x) => Object.assign({ deckLibrary: "solution" }, x))];
  let n = 0;
  sets.forEach((list) => (Array.isArray(list) ? list : []).forEach((sp) => {
    const res = replay(sb, sp); n++;
    assert.equal(res.issues.length, 0, String(sp.title) + ": " + res.issues.join(","));
  }));
  assert.ok(n > 50);
});

test("frames and flowcharts are not checked (they have their own designs)", () => {
  const sb = loadAddon(5);
  ["cover", "agenda", "section", "closing"].forEach((t) => assert.equal(replay(sb, { type: t, title: "x" }).issues.length, 0, t));
  const d = require("./fixtures/deck6-specs.js")[0];
  assert.equal(replay(sb, d).fixed.length, 0);
});

test("the slide log: every drawn slide with its content, design and check; written with the usage rows", () => {
  const fetches = [];
  const store = {};
  const sb = { console, Math, JSON, Date, Logger: { log() {} },
    CacheService: { getUserCache: () => ({ get: (k) => (k in store ? store[k] : null), put: (k, v) => { store[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "VERTEX_PROJECT_ID" ? "d-marketing-ai-applications" : null) }) },
    ScriptApp: { getOAuthToken: () => "T" }, Session: { getEffectiveUser: () => ({ getEmail: () => "a.b@66degrees.com" }) },
    SlidesApp: { getActivePresentation: () => ({ getName: () => "Deck", getUrl: () => "u" }) },
    UrlFetchApp: { fetch(url, o) { fetches.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => "{}" }; } },
    AGENT_VERSION_: "66° Deck Agent V.1_64" };
  vm.createContext(sb);
  vm.runInContext(read("src/UsageLog.gs"), sb);
  sb.usageRun_({ runId: "r1", mode: "Create", category: "Proposal Deck" }, () => {
    for (let i = 1; i <= 30; i++) sb.recordSlide_({ type: "cards", deckLibrary: "proposal", title: "Slide " + i, items: [{ title: "A" }] }, { drawnWith: "P66_CARD_GRID", qa: { issues: i === 3 ? ["cut"] : [], fixed: i === 2 ? ["plain-layout"] : [], from: i === 2 ? "base:cards" : "" } }, i);
    return { ok: true, slideCount: 30 };
  });
  const slideCalls = fetches.filter((f) => /tables\/deck_slides\/insertAll$/.test(f.url));
  assert.equal(slideCalls.length, 2, "30 slides in batches of 25");
  const rows = [].concat(...slideCalls.map((f) => JSON.parse(f.o.payload).rows.map((r) => r.json)));
  assert.equal(rows.length, 30);
  const r2 = rows.find((r) => r.slide_no === 2), r3 = rows.find((r) => r.slide_no === 3);
  assert.equal(r2.fixed, "plain-layout"); assert.equal(r2.fixed_from, "base:cards");
  assert.equal(r3.issues, "cut");
  assert.equal(JSON.parse(r2.spec_json).title, "Slide 2");
  assert.equal(r2.deck_library, "proposal"); assert.equal(r2.design, "P66_CARD_GRID");
  assert.equal(r2.email, "a.b@66degrees.com"); assert.equal(r2.run_id, "r1"); assert.equal(r2.agent_version, "V.1_64");
  // rebrand: the check's findings per slide; redrawn slides are left to the engine
  sb.usageRun_({ runId: "r2", mode: "Rebrand" }, () => { sb.recordRebrandChecks_(['slide 2: "A" runs into "B"', 'slide 3: "C" cannot be read on its background'], 0, 4, { 0: true }); return { ok: true }; });
  const rb = [].concat(...fetches.filter((f) => /deck_slides/.test(f.url)).slice(2).map((f) => JSON.parse(f.o.payload).rows.map((r) => r.json)));
  assert.deepEqual(rb.map((r) => [r.slide_no, r.issues]), [[2, "overlap"], [3, "unreadable"], [4, ""]]);
});

test("every engine slide goes to the log and the result names a slide the check could not correct", () => {
  const src = read("src/EngineRenderer.gs");
  assert.match(src, /recordSlide_\(spec, out, number\)/);
  assert.match(src, /Deck check: slide ' \+ number/);
  assert.match(read("src/Code.gs"), /Deck check: ' \+ ctx\.qaFixed \+ ' slide\(s\) drawn again/);
  assert.match(read("src/Rebrand.gs"), /recordRebrandChecks_\(qa, start, end, redrawn\)/);
});

test("setup SQL for the slide log; the replay script turns logged slides into tests", () => {
  const sql = read("setup/slide_log_bigquery.sql");
  ["deck_agent.deck_slides", "v_slide_issues", "v_design_health", "spec_json", "PARTITION BY DATE(ts)"].forEach((s) => assert.ok(sql.includes(s), s));
  assert.doesNotMatch(sql, /[a-z]''[a-z]/i, "BigQuery strings do not escape a quote by doubling it");
  const tmp = path.join(require("os").tmpdir(), "replay-" + process.pid + ".json");
  const spec = JSON.parse(read("tests/fixtures/reported/deck35-s22.json")).spec;
  fs.writeFileSync(tmp, JSON.stringify([{ run_id: "run_x", slide_no: 7, issues: "plain-layout", spec_json: JSON.stringify(spec) }]));
  const out = cp.execFileSync(process.execPath, [path.join(ROOT, "scripts/replay-slides.js"), tmp], { encoding: "utf8" });
  assert.match(out, /slide 7 .*was: plain-layout\s+now: P66_\w+ \[clean\]/);
  assert.match(out, /1 slide\(s\) replayed, 0 still with a problem/);
});
