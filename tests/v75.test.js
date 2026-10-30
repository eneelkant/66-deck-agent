"use strict";

// V.1_75 - the last fix round for General, Proposal and Solution decks: the issues of the V.1_74 test decks (deck 46,
// tests/fixtures/deck46-slide-log.json), fixed by kind for every deck type
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const LOG = JSON.parse(read("tests/fixtures/deck46-slide-log.json"));
const spec = (cat, n) => JSON.parse(LOG.find((r) => r.deck_category.startsWith(cat) && String(r.slide_no) === String(n)).spec_json);
const draw = (sp) => G.ENGINE.render({ slides: [sp] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));

const PRO = "Create a 40-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 40-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const ctxFor = (prompt, extra) => { const c = Object.assign({ log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }, extra || {}); c.brief = G.briefFromText_(prompt, 40); return c; };

test("version label is V.1_75 or later; the deck 46 log is V.1_74", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[5-9]|[8-9]\d)'/);
  assert.equal(LOG.length, 117);
  assert.ok(LOG.every((r) => r.agent_version === "V.1_74"));
});

// ---------------- A. broken

test("A1. General: an SLA named in another slide's title is not the KPI slide; target figures ask for a KPI slide", () => {
  assert.equal(G.onceTopicOfEntry_({ title: "Multi-region failover for 99.9% pipeline SLA", type: "diagram" }), "");
  assert.equal(G.onceTopicOfEntry_({ title: "Performance SLAs for peak holiday traffic", type: "cards" }), "kpi");
  assert.equal(G.onceTopicOfEntry_({ title: "Core modernization key performance indicators", type: "stats" }), "kpi");
  assert.match(read("src/Code.gs"), /briefTargets_\(ctx\)\.length >= 2 && askedOnce\.indexOf\('kpi'\) === -1\) askedOnce\.push\('kpi'\)/);
});

test("A2. Proposal 14: the notes keep the line that says which figures were left out and why", () => {
  const sp = spec("P", 14);
  sp.notes = "Composite deployments realized a 205% three-year ROI.\nFigures left out (not in the request, the attached files, the approved facts or the research): 205%, 5,200 hrs.";
  const o = draw(sp);
  assert.match(o.notes, /Figures left out \(not in the request[^)]*\): 205%, 5,200 hrs\./);
  assert.doesNotMatch(o.notes, /205% three-year ROI/, "a notes sentence with a figure the slide does not show still goes");
});

test("A3. Proposal 37: a section divider's title is never the deck's pricing slide - the engagement models are the pricing slide", () => {
  const code = read("src/Code.gs");
  assert.match(code, /ctx\.outlineTitles = \(plan\.slides \|\| \[\]\)\.filter\(function \(o\) \{ return o && String\(o\.type \|\| ''\)\.toLowerCase\(\) !== 'section'; \}\)/);
  assert.match(code, /ctx\.outlineTitles = \(\(st\.outline && st\.outline\.slides\) \|\| \[\]\)\.filter\(function \(o\) \{ return o && String\(o\.type \|\| ''\)\.toLowerCase\(\) !== 'section'; \}\)/);
  const ctx = ctxFor(PRO); ctx.brief.families = ["pricing"];
  ctx.outlineTitles = LOG.filter((r) => r.deck_category.startsWith("P") && r.slide_type !== "section").map((r) => r.title);
  const sp = spec("P", 37);
  assert.equal(G.contractKind_(sp, ctx), "pricing");
  const slides = [sp];
  G.conformSlides_(slides, ctx);
  assert.match(slides[0].title, /^Pricing options: /);
  assert.equal(slides[0].takeaway, "Pricing is confirmed after the scoping workshop.");
});

test("A4. General 29: a risk's mitigation the design cannot show is written into its text, not sent to the notes", () => {
  const o = draw(spec("G", 29));
  const t = texts(o).join(" | ");
  assert.match(t, /Mitigation: run automated discovery scripts/);
  assert.ok(!(o.qa.issues || []).includes("lost-content"), o.qa.issues.join(","));
  assert.ok((o.qa.fixed || []).includes("fix-in-text"));
});

test("A5. General 30: a support table's column headings name levels, never \"Tool | What it does\"", () => {
  same(G.tableHeaders_("Platform operating and support model"), ["Level", "What happens"]);
  same(G.tableHeaders_("Incident severity and escalation"), ["Level", "What happens"]);
  same(G.tableHeaders_("Key risks"), ["Risk", "How to manage it"]);
  same(G.tableHeaders_("Tools we use"), ["Tool", "What it does"]);
});

test("A6. General 11: a marker, a tag or an invisible character between two words leaves a space", () => {
  assert.equal(G.ENGINE.cleanText("Standby orchestration[3]promotion"), "Standby orchestration promotion");
  assert.equal(G.ENGINE.cleanText("Standby orchestration​promotion"), "Standby orchestration promotion");
  assert.equal(G.ENGINE.cleanText("Standby orchestration(66D_FACT_COMPANY_011)promotion"), "Standby orchestration promotion");
  assert.equal(G.ENGINE.cleanText("BigQuery holds the data [2]."), "BigQuery holds the data.");
});

test("A7. General 24, Solution 4: rows of a checklist and bullets keep even spacing (only rows of boxes spread)", () => {
  [["G", 24], ["S", 4]].forEach(([c, n]) => {
    const o = draw(spec(c, n));
    const left = o.els.filter((e) => e.t === "text" && !e.hdr && e.x < 260 && e.y > 70).sort((a, b) => a.y - b.y);
    const gaps = left.slice(1).map((e, k) => Math.round(e.y - left[k].y)).filter((g) => g > 4);
    assert.ok(gaps.length >= 2, c + n + " rows " + gaps.join(","));
    const steps = gaps.filter((g) => g < 80);
    assert.ok(Math.max(...steps) - Math.min(...steps) <= 30, c + n + " uneven: " + gaps.join(","));
  });
  assert.match(read("src/Engine.gs"), /bands\.length >= 2 && bands\.length <= 4 && bands\.every\(boxed\)/);
});

test("A8. Solution: a dark-only design past the third dark slide is drawn with a light design; the chooser counts the rhythm's dark slides", () => {
  const ctx = { presentationType: G.SOLUTION_TYPE_ || "Solution Deck", log: [], proposal: { darkUsed: 3, sinceDark: 6 } };
  const sp = spec("S", 34);
  const specs = [{ type: "cards", title: "A", items: [{ title: "a", text: "b" }] }, sp, { type: "cards", title: "B", items: [{ title: "a", text: "b" }] }];
  if (!G.isSolutionDeck_(ctx)) ctx.presentationType = require("vm").runInContext("SOLUTION_TYPE_", G);
  G.solutionDarkRhythm_(specs, ctx);
  assert.notEqual(specs[1].reference && specs[1].reference.tag, "S66_U_JOURNEY");
  const o = draw(specs[1]);
  assert.ok(!o.dark, "drawn light with " + o.drawnWith);
  assert.match(read("src/Code.gs"), /darkUsed = Math\.max\(darkUsed \|\| 0, \(ctx\.proposal && typeof ctx\.proposal\.darkUsed === 'number'\) \? ctx\.proposal\.darkUsed : 0\);/);
});

test("A9. Solution 37 of 40: a slide Gemini wrote is used for a free outline entry before any slide is left out", () => {
  const outline = [{ type: "cards", title: "Quorum and witness design" }, { type: "process", title: "How the solution is deployed" }, { type: "stats", title: "Target KPIs" }];
  const got = [{ type: "cards", title: "Quorum and witness design", items: [] }, { type: "cards", title: "Packer golden images and Terraform modules", items: [{ title: "a" }] }];
  const r = G.matchOutline_(outline, got);
  assert.ok(r.byOutline[0] && r.byOutline[1], "the second slide Gemini wrote fills a free entry");
  assert.match(read("src/Code.gs"), /if \(solutionFill && \(t === 'stats' \|\| t === 'timeline'\) && sp\.missing && !items\.length\) \{ sp\.type = 'cards';/);
});

// ---------------- B. content and wording

test("B10. Solution 32-34: deployment and runbook slides go to the operations section", () => {
  const secs = [
    { title: "Current state and business requirements", list: [{ type: "cards", title: "Current architecture" }] },
    { title: "Operations, monitoring, and runbooks", list: [{ type: "cards", title: "Monitoring and alerting across the platform" }] },
    { title: "Delivery governance, risks, and next steps", list: [{ type: "cards", title: "Key risks and how we mitigate them" }] }];
  G.placeInSection_(secs, { type: "process", title: "How the solution is deployed", brief: "The deployment steps from code to production" }, [2]);
  G.placeInSection_(secs, { type: "cards", title: "Infrastructure as Code deployment pipeline" }, []);
  assert.equal(secs[1].list.length, 3, secs.map((s) => s.list.map((o) => o.title).join(" / ")).join(" || "));
});

test("B11. General 38: \"Core technical differentiators\" is the why-66degrees topic; Proposal: enablement at most twice", () => {
  assert.equal(G.onceTopicOfEntry_({ title: "Core technical differentiators", type: "cards" }), "why66");
  assert.equal(G.onceTopicOfEntry_({ title: "Knowledge transfer and enablement", type: "process" }), "enablement");
  assert.equal(G.onceTopicOfEntry_({ title: "Operational handover and runbook standardization", type: "process" }), "enablement");
  assert.equal(G.onceLimit_("enablement", 40), 2);
  assert.equal(G.onceLimit_("enablement", 20), 1);
});

test("B12. Proposal 37: words the notes capitalise are no names when the slides write them in lower case", () => {
  const names = G.namesFromNotes_([{ type: "process", title: "Flexible engagement models", lead: "Best Buy can select from outcome-based velocity engineering, staff augmentation, or a hybrid delivery model.",
    items: [{ title: "Staff Augmentation", text: "Embedded engineers." }], notes: "Velocity Engineering provides delivery, while Staff Augmentation embeds certified specialists." }]);
  assert.ok(!names.includes("Staff Augmentation"), names.join(", "));
  assert.ok(!names.includes("Velocity Engineering"), names.join(", "));
});

test("B13. Proposal 4: the figures note names its sources in words (never \"Figures on this slide:.\")", () => {
  assert.match(read("src/Brief.gs"), /'\\nFigures on this slide: from source' \+ \(cites\.length > 1 \? 's ' : ' '\) \+ cites\.join\(', '\) \+ ' in the Sources list '/);
  const sp = { type: "cards", title: "X", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }], notes: "Text.\nFigures on this slide:." };
  G.finishSlides_([sp], { log: [] });
  assert.equal(sp.notes, "Text.");
});

test("B14. absolute promises in any wording read as what the design does", () => {
  const sp = { type: "cards", title: "Data ingestion and validation workflow", lead: "A four-stage workflow that validates and routes data with zero message loss.",
    items: [{ title: "a", text: "Proactive technical controls eliminate data loss and DNS cache delays." }, { title: "b", text: "Rolling patches eliminate downtime for clinicians." }] };
  G.finishSlides_([sp], { log: [] });
  assert.match(sp.lead, /with protection against message loss\./);
  assert.match(sp.items[0].text, /guard against data loss/);
  assert.match(sp.items[1].text, /minimize downtime/);
});

// ---------------- C. layout

test("C15. General 26: a one-line divider title keeps its rule right under it", () => {
  const o = draw(spec("G", 26));
  const title = o.els.find((e) => e.t === "text" && /Governance, risk management/.test(e.text));
  const rule = o.els.find((e) => e.t === "line");
  assert.ok(rule.y1 - (title.y + (title.vh || title.h)) < 12, "rule " + Math.round(rule.y1) + " title end " + Math.round(title.y + (title.vh || title.h)));
});

test("C16. short slides: the item texts are written fuller, sized to the room (option a)", () => {
  const sp = spec("P", 25);
  const plan = { slides: [sp] };
  const real = { c: G.callGeminiJSON };
  let asked = null;
  G.callGeminiJSON = (parts) => { const t = parts[0].text; asked = JSON.parse(t.slice(t.indexOf("ITEMS:") + 6)); return { fixes: [] }; };
  G.fitContentToDesigns_(plan, { log: [], apiKey: "k", tokens: null }, Date.now());
  G.callGeminiJSON = real.c;
  assert.ok(asked && asked.filter((x) => x.action === "expand").length >= 3, JSON.stringify(asked).slice(0, 300));
  const ex = asked.filter((x) => x.action === "expand")[0];
  assert.ok(ex.min_chars > ex.text.length + 25 && ex.max_chars <= 320, JSON.stringify(ex));
});

// ---------------- the whole log

test("deck 46 replayed with V.1_75: no slide has more checker issues than it had, no slide is empty or cut", () => {
  let worse = [];
  LOG.forEach((r) => {
    let s; try { s = JSON.parse(r.spec_json); } catch (e) { return; }
    const o = draw(s);
    const now = (o.qa && o.qa.issues) || [];
    const before = String(r.issues || "").split(",").filter(Boolean);
    const bad = now.filter((k) => ["empty", "cut", "overlap", "off-slide", "detached", "lost-figures"].includes(k) && !before.includes(k));
    if (bad.length) worse.push(r.deck_category[0] + r.slide_no + " " + bad.join(","));
  });
  same(worse, []);
});
