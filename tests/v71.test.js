"use strict";

// V.1_71 - step 2 (the outline) + the slide issues of the V.1_70 test decks (deck 42), for every deck type
//  A. the outline: a topic shown once is there once (one shared list for the step that adds a missing topic and the step
//     that removes a repeat); a slide added for a requested topic has a real title; sections are topics, never targets
//  B. the slides: the KPI slide keeps its figures; notes and design names never become slide text; no status words;
//     no word broken in a tag; the figure check never breaks a sentence and leaves technical settings alone; the pricing
//     line only on the pricing slide; the request's target beats a research figure; targets only on the KPI slide; a
//     time used as a target needs a source; figure cards get their texts; "·" and ";" phrases read as sentences; a RACI
//     keeps every party; what a design cannot show goes to the notes; one figure per 66degrees credential
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, replay, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const LOG = JSON.parse(read("tests/fixtures/deck42-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const texts = (o) => o.els.filter((e) => e.t === "text" || (e.text && typeof e.text === "string")).map((e) => String(e.text));
const all = (sp) => JSON.stringify(Object.assign({}, sp, { notes: "" }));
const NUMS = ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "cx", "cy", "r", "size"];

const SOL = "Create a 30-slide solution deck for Contoso Health: SQL Server high availability across two Google Cloud regions. Targets: 99.95% uptime, recovery under 15 minutes and 40% fewer incidents. Include the current architecture and its failure points, sizing and configuration, monitoring, deployment, security, runbooks, risks and next steps.";
const PRO = "Create a 30-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 30-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (prompt) => { const c = { log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }; c.brief = G.briefFromText_(prompt, 30); return c; };

test("version label is V.1_71 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[1-9]|[8-9]\d)'/);
});

test("A1. a topic shown once is recognised whatever its title (the repeats of deck 42)", () => {
  const of = (title, type, brief) => G.onceTopicOfEntry_({ title, type: type || "cards", brief: brief || "" });
  [["Risks", "Key risks and how we mitigate them", "risks"], ["Sizing and configuration", "Configuration and sizing", "sizing"],
    ["Success KPIs for Best Buy's platform transformation", "Performance SLAs for peak holiday traffic", "kpi"],
    ["Why 66degrees is the right modernization partner", "Proven engineering scale and expertise", "why66"],
    ["Strategic partnership differentiators", "Why 66degrees", "why66"]].forEach(([a, b, f]) => {
    assert.equal(of(a), f, a); assert.equal(of(b), f, b);
  });
  assert.equal(of("Three-tier operational support model and SLA tiers"), "support", "a support slide with SLA tiers is the support slide");
  assert.equal(of("Measuring what matters", "stats", "the target KPIs"), "kpi", "the brief counts when the title says nothing");
  assert.equal(of("Target architecture for enterprise scale"), "", "an architecture slide is no once-only topic");
  const code = read("src/Code.gs");
  assert.match(code, /const onceLast = \{\};/);
  assert.match(code, /V\.1_71: a topic the deck shows once is never added a second time from the backlog/);
});

test("A2. a slide added for a requested topic has a real title, never only the topic's name", () => {
  assert.equal(G.richTopicTitle_("risks"), "Key risks and how we mitigate them");
  assert.equal(G.richTopicTitle_("monitoring"), "Monitoring and alerting across the platform");
  assert.equal(G.richTopicTitle_("runbooks"), "Operational runbooks for the platform");
  assert.equal(G.richTopicTitle_("residency"), "Residency: approach and key decisions");
  assert.equal(G.richTopicTitle_("reference architecture"), "Reference architecture", "two words are already a title");
  assert.match(read("src/SolutionKit.gs"), /title = richTopicTitle_\(t\)/);
});

test("A3. sections are named after their topics, never after a target (General 2)", () => {
  const ctx = ctxFor(GEN);
  const secs = [
    { title: "Pipeline availability and baseline", list: [{ type: "comparison", title: "Current state across production pipelines" }, { type: "diagram", title: "Target architecture for enterprise scale" }] },
    { title: "Query throughput acceleration", list: [{ type: "bullets", title: "Modernization scope across data layers" }, { type: "timeline", title: "Modernization roadmap and timeline" }] },
    { title: "Team, governance and commercials", list: [{ type: "team", title: "Delivery team structure" }] }];
  const n = G.renameTargetSections_(secs, ctx);
  assert.equal(n, 2);
  assert.doesNotMatch(secs[0].title, /availability/i);
  assert.doesNotMatch(secs[1].title, /throughput/i);
  assert.equal(secs[2].title, "Team, governance and commercials", "a topic section keeps its name");
  assert.match(read("src/Code.gs"), /Section names are topics of the request/);
});

test("B1. the KPI slide keeps its figures (Proposal 7)", () => {
  const res = replay(G, spec("Pro", 7));
  ["50%", "95%", "30%"].forEach((v) => assert.ok(texts(res.out).includes(v), v));
  assert.ok(!res.issues.includes("lost-figures"));
  assert.match(read("src/Engine.gs"), /'lost-figures': 120 \};/);
});

test("B2. notes and design names never become slide text (Proposal 4)", () => {
  const res = replay(G, spec("Pro", 4));
  const t = texts(res.out).join(" ");
  assert.doesNotMatch(t, /P66_|S66_|66D_|this executive overview uses/i);
  assert.match(t, /Marketing ROI lift/, "the slide shows its own cards");
});

test("B3. a status is never written as a word (Solution 23, 26)", () => {
  [23, 26].forEach((n) => {
    const t = texts(replay(G, spec("Sol", n)).out).join(" ");
    assert.doesNotMatch(t, /Status:|\bAmber\b|\bGrey\b/, "Solution " + n);
  });
  assert.match(read("src/ProposalKit.gs"), /status: 1, rag: 1, color: 1/);
});

test("B4. no word breaks inside a tag or a text box (Solution 22, your screenshot)", () => {
  const res = replay(G, spec("Sol", 22));
  assert.ok(!res.issues.includes("cut"), res.issues.join(","));
  const tags = res.out.els.filter((e) => e.t === "roundrect" && e.text);
  assert.equal(tags.length, 8);
  const E = G.ENGINE;
  tags.forEach((e) => String(e.text).split(/\s+/).forEach((w) => assert.ok(E.kit.textWidth(w, "sans", 400, e.textStyle.size) <= e.w - 16 + 1, w + " fits in its tag")));
  // a text box: the longest word fits, the type gets smaller rather than breaking it
  const els = [];
  const r = E.kit.text(els, 0, 0, 60, 40, "Configuration management", { weight: 400, max: 14, min: 9 });
  assert.ok(E.kit.textWidth("Configuration", "sans", 400, r.size) <= 60, "size " + r.size);
});

test("B5. the figure check never breaks a sentence and leaves technical settings alone (Solution 22)", () => {
  const ctx = ctxFor(SOL);
  const tech = { type: "table", title: "Database routine maintenance", rows: [["Dynamic index defragmentation", "Rebuild above 30% fragmentation and reorganize between 10% and 30% during off-peak hours"]], notes: "" };
  G.guardFigures_([tech], ctx, { research: [] });
  assert.equal(tech.rows[0][1], "Rebuild above 30% fragmentation and reorganize between 10% and 30% during off-peak hours");
  const claim = { type: "cards", title: "Automation results", items: [{ title: "Fewer incidents", text: "Terraform runbooks cut configuration incidents by 38% to 45% across both regions." }, { title: "b", text: "Second card text here." }], notes: "" };
  G.guardFigures_([claim], ctx, { research: [] });
  assert.doesNotMatch(all(claim), /38%|45%/);
  assert.doesNotMatch(claim.items[0].text, /\b(between|by|and|to)\s*[.,]|\bbetween and\b/);
});

test("B6. the pricing line only on the pricing slide (Proposal 11)", () => {
  const ctx = ctxFor(PRO);
  const p11 = spec("Pro", 11);
  G.guardFigures_([p11], ctx, { research: [] });
  assert.ok(!p11.items.some((i) => /pricing is confirmed/i.test(i.title)));
  const price = { type: "cards", title: "Flexible pricing options tailored to Best Buy", items: [{ title: "Fixed scope", text: "Milestones." }, { title: "Scoping workshop alignment", text: "Pricing is confirmed after the scoping workshop once volumes are baselined." }], notes: "" };
  G.guardFigures_([price], ctx, { research: [] });
  assert.match(all(price), /Pricing is confirmed after the scoping workshop/);
  assert.match(G.briefPromptBlock_(ctx), /Only the pricing slide itself may say that pricing is confirmed/);
});

test("B7-B9. the request's target beats research, targets only on the KPI slide, times need a source", () => {
  // Proposal 19: research 26% lower run cost beside the requested 30%
  const p19 = spec("Pro", 19);
  G.guardFigures_([p19], ctxFor(PRO), { research: [{ n: 3, title: "IDC", findings: ["26% lower IT infrastructure run costs, 41% higher IT operational efficiency, 19% higher developer productivity, 222% three-year ROI"] }] });
  assert.equal(p19.value, undefined);
  same(p19.items.map((i) => i.value), ["41%", "19%", "222%"]);
  // General 27: a target tile among the credentials
  const g27 = spec("Gen", 27);
  G.guardFigures_([g27], ctxFor(GEN), { research: [] });
  assert.ok(!g27.items.some((i) => /target/i.test(String(i.label))), JSON.stringify(g27.items.map((i) => i.label)));
  // Proposal 22: "<2s" and "15-min" are not in the request; Solution 6: "< 15 min" is ("recovery under 15 minutes")
  const p22 = spec("Pro", 22);
  G.guardFigures_([p22], ctxFor(PRO), { research: [] });
  assert.ok(!/<2s|15-min/.test(all(p22)), all(p22));
  const s6 = spec("Sol", 6);
  G.guardFigures_([s6], ctxFor(SOL), { research: [] });
  same(s6.items.map((i) => i.value.replace(/\s/g, "")), ["99.95%", "<15min", "40%"]);
});

test("B10. figure cards get their texts (Proposal 19)", () => {
  const p19 = { type: "cards", title: "FinOps governance", items: [{ value: "41%", label: "Higher IT operational efficiency", text: "" }, { value: "19%", label: "Higher developer productivity", text: "" }, { value: "222%", label: "Three-year ROI", text: "" }] };
  const real = G.callGeminiJSON;
  let asked = "";
  G.callGeminiJSON = (parts) => { asked = parts[0].text; return { fixes: [{ id: 0, add: ["Automated operations free engineers from manual cluster work.", "Reusable models shorten every build cycle.", "Measured over three years of platform run cost and labour."] }] }; };
  G.fillThinSlides_({ slides: [p19] }, Object.assign(ctxFor(PRO), { apiKey: "x" }), { textsOnly: true });
  G.callGeminiJSON = real;
  assert.match(asked, /kind "kpitexts"/);
  assert.ok(p19.items.every((i) => i.text.length > 20));
});

test("B11. phrases joined with '·' or ';' read as sentences (Proposal 8, Solution 21)", () => {
  const t8 = texts(replay(G, spec("Pro", 8)).out).join(" ");
  assert.doesNotMatch(t8, / · /);
  const t21 = texts(replay(G, spec("Sol", 21)).out).join(" ");
  assert.doesNotMatch(t21, /; [A-Z]/);
});

test("B12. a RACI keeps every party's column (Proposal 25)", () => {
  const t = texts(replay(G, spec("Pro", 25)).out);
  ["66degrees delivery pod", "Best Buy data and IT", "Best Buy business leads"].forEach((c) => assert.ok(t.includes(c), c));
  assert.match(G.briefPromptBlock_(ctxFor(PRO)), /A RACI lists every party/);
});

test("B13. what a design cannot show goes to the speaker notes - nothing written is lost (Solution 4, 7, 9, 16, 21)", () => {
  [4, 7, 9, 16, 21].forEach((n) => {
    const res = replay(G, spec("Sol", n));
    assert.ok(!res.issues.includes("lost-content"), "Solution " + n + ": " + res.issues.join(","));
    if (res.fixed.includes("extra-to-notes")) assert.match(res.out.notesExtra, /Also on this topic/);
  });
  assert.match(read("src/EngineRenderer.gs"), /String\(spec\.notes \|\| ''\) \+ String\(out\.notesExtra \|\| ''\)/);
});

test("credentials: one figure per 66degrees credential, the approved one (General 26 / 27: 600+ and 375+)", () => {
  const g26 = spec("Gen", 26), g27 = spec("Gen", 27);
  G.canonicalCredentials_([g26, g27], { log: [] });
  const certs = g27.items.find((i) => /certification/i.test(i.label));
  assert.equal(certs.value, "600+");
  assert.ok(!all(g26).includes("375+") && !all(g27).includes("375+"));
  assert.ok(all(g27).includes("1000+"), "projects: 1000+ as approved");
});

test("release gate: all 90 deck-42 slides replay with nothing cut, detached, off the slide, lost or piled up", () => {
  assert.equal(LOG.length, 90);
  const bad = [];
  LOG.forEach((r) => {
    const res = replay(G, JSON.parse(r.spec_json));
    const iss = res.issues.filter((x) => ["empty", "overlap", "cut", "detached", "off-slide", "record-text", "dot-heading", "repeat-title", "lost-content"].indexOf(x) !== -1);
    const nan = res.out.els.some((e) => NUMS.some((k) => k in e && e[k] != null && !isFinite(Number(e[k]))));
    const meta = texts(res.out).some((t) => /\b(P66|S66|66D)_[A-Z0-9_]{3,}/.test(t));
    if (iss.length || nan || meta) bad.push(r.deck_category + " " + r.slide_no + ": " + iss.join(",") + (nan ? " NaN" : "") + (meta ? " design-name" : ""));
  });
  same(bad, []);
});
