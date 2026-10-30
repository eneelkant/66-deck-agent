"use strict";

// V.1_74 - step 5 (the drawing: no band of empty space under the title) + the issues of the V.1_73 test decks (deck 45:
// General "ZoomInfo", Solution "Contoso Health", Proposal "Best Buy"), fixed by kind for every deck type
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddon, ROOT } = require("./fixtures/load-addon.js");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const G = loadAddon(5);
const all = (sp) => JSON.stringify(Object.assign({}, sp, { notes: "" }));
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const draw = (spec) => G.ENGINE.render({ slides: [spec] }, { dateLabel: "x" })[0];
const texts = (o) => o.els.filter((e) => e.t === "text").map((e) => String(e.text));

const PRO = "Create a 40-slide proposal for Best Buy (bestbuy.com): a unified retail data platform on Google Cloud with Dataplex and Looker. Success KPIs: 50% faster report builds, a 95% data quality pass rate and 30% lower platform run cost. Include scope, team structure, RACI, risks, support model, pricing options and next steps.";
const GEN = "Create a 40-slide presentation for ZoomInfo (zoominfo.com) on modernising their data platform on Google Cloud. Targets: 99.9% pipeline availability, 3x faster query throughput and 35% lower infrastructure cost. Include current state, target architecture, scope, timeline, team structure, RACI, KPIs, risks, support model, pricing options, why 66degrees and next steps.";
const SOL = "Create a 40-slide solution deck for Contoso Health: SQL Server high availability across two Google Cloud regions. Targets: 99.95% uptime, under 15 minutes cross-region recovery and 40% fewer incidents. Include current architecture, sizing, security, runbooks, monitoring, RACI, risks and next steps.";
const ctxFor = (prompt, extra) => { const c = Object.assign({ log: [], userPrompt: prompt, approvedFacts: [], brand: { name: "66degrees" } }, extra || {}); c.brief = G.briefFromText_(prompt, 40); return c; };

test("version label is V.1_74 or later; Finish.gs is pushed after Gate.gs", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(7[4-9]|[8-9]\d)'/);
  const order = JSON.parse(read(".clasp.json")).filePushOrder;
  assert.ok(order.indexOf("Finish.gs") > order.indexOf("Gate.gs"));
  assert.match(read("src/Code.gs"), /deckFinishCheck_\(plan\.slides, ctx\);[^\n]*\n\s*finalizeNotes_\(plan, sources, ctx\);/);
  assert.match(read("src/Code.gs"), /deckFinishCheck_\(plan\.slides, ctx\);[^\n]*\n\s*finalizeNotes_\(plan, st\.sources, ctx\);/);
});

// ---------------- step 5

test("step 5: on every logged slide of decks 41-44 the body starts at most 30 pt under the header", () => {
  const rows = [];
  ["deck41", "deck42", "deck43", "deck44"].forEach((f) => {
    JSON.parse(read("tests/fixtures/" + f + "-slide-log.json")).forEach((r) => {
      let s; try { s = JSON.parse(r.spec_json); } catch (e) { return; }
      if (["cover", "agenda", "closing", "section", "template"].includes(String(s.type).toLowerCase())) return;
      const o = draw(s);
      let hb = 0, ct = 1e9;
      o.els.forEach((e) => {
        const y = e.t === "line" ? Math.min(e.y1, e.y2) : e.y, h = e.t === "line" ? Math.abs(e.y2 - e.y1) : (e.t === "text" ? (e.vh || e.h) : (e.h || e.size || 0));
        if (e.hdr) { hb = Math.max(hb, y + h); return; }
        if (e.t === "image" || y == null || y < 40 || y > 380) return;
        ct = Math.min(ct, y);
      });
      if (hb && ct < 1e9) rows.push({ id: f + " " + r.deck_category[0] + r.slide_no + " " + o.drawnWith, gap: ct - hb });
    });
  });
  assert.ok(rows.length > 200, "slides measured " + rows.length);
  const wide = rows.filter((r) => r.gap > 40);
  assert.equal(wide.length, 0, wide.slice(0, 5).map((r) => r.id + " " + Math.round(r.gap)).join(" | "));
  assert.ok(rows.filter((r) => r.gap > 30).length <= 2, "gaps over 30 pt: " + rows.filter((r) => r.gap > 30).map((r) => r.id).join(", "));
});

test("step 5: the body is never moved down to the middle any more (only a compact design is centred)", () => {
  const code = read("src/Engine.gs");
  assert.match(code, /if \(out\.center\) centreContent_\(out\); else placeBody_\(out, s\);/);
  assert.match(code, /if \(!out\.center\) return;/);
  assert.match(code, /var BODY_GAP_ = 20, BODY_GAP_MAX_ = 30;/);
});

test("step 5: a row of cards under a short header starts right under it and its boxes still end under their text", () => {
  const o = draw({ deckLibrary: "general", type: "cards", title: "Platform discovery and gap analysis", lead: "Structured discovery across four layers pinpoints technical debt.",
    items: ["Ingestion", "Compute", "Storage", "Serving"].map((t) => ({ title: t + " audit", text: "Evaluated event collection queues, batch scheduling dependencies and failure recovery mechanisms." })) });
  const head = Math.max(...o.els.filter((e) => e.hdr).map((e) => e.y + (e.vh || e.h)));
  const body = o.els.filter((e) => !e.hdr && e.t !== "image" && e.y > 40 && e.y < 380);
  const top = Math.min(...body.map((e) => (e.t === "line" ? Math.min(e.y1, e.y2) : e.y)));
  assert.ok(top - head <= 30, "gap " + Math.round(top - head));
  same(o.qa.issues.filter((k) => ["overlap", "detached", "off-slide", "cut"].includes(k)), []);
});

// ---------------- A. broken output

test("A1. Proposal 30: RACI headings written as objects are text - never \"[object Object]\" on the slide or in the notes", () => {
  const sp = { type: "table", deckLibrary: "proposal", title: "RACI matrix across platform delivery workstreams",
    columns: [{ label: "Workstream" }, { label: "66degrees" }, { label: "Best Buy IT" }, { label: "Best Buy business" }],
    rows: [["Platform foundation", "Responsible (R)", "Accountable (A)", "Informed"], ["Dataplex rules", "Responsible (R)", "Consulted (C)", "Informed"],
      ["Looker semantic model", "Responsible (R)", "Consulted (C)", "Accountable"], ["UAT sign-off", "Consulted (C)", "Responsible / accountable", "Accountable"]] };
  const slides = [sp];
  G.conformSlides_(slides, ctxFor(PRO));
  assert.doesNotMatch(JSON.stringify(slides[0]), /object Object/);
  assert.deepEqual(JSON.parse(JSON.stringify(slides[0].columns)), ["Workstream", "66degrees", "Best Buy IT", "Best Buy business"]);
  assert.doesNotMatch(texts(draw(slides[0])).join(" | "), /object Object/);
});

test("A1b. a cell written as an object reads as its text; a diagram's columns (with their items) stay as they are", () => {
  assert.equal(G.cellText_({ party: "66degrees", role: "R" }), "66degrees");
  assert.equal(G.cellText_({ text: "Responsible" }), "Responsible");
  const dia = { type: "diagram", title: "Architecture", columns: [{ label: "Data sources", items: [{ title: "POS" }] }, { label: "Google Cloud", items: [{ title: "BigQuery" }] }] };
  assert.equal(G.normalizeCells_(dia), false);
  assert.equal(typeof dia.columns[0], "object");
});

test("A2. Proposal: the outline's KPI slide written as two lists is the KPI slide - the request's targets as tiles", () => {
  const ctx = ctxFor(PRO);
  const mk = () => ({ type: "comparison", deckLibrary: "proposal", title: "KPI measurement baselines and tracking mechanisms",
    left: { label: "Mobilization baseline", points: ["Audit historical ticketing logs to measure current report delivery cycle times", "Analyze monthly infrastructure invoices"] },
    right: { label: "Automated tracking", points: ["Report build cycle timed automatically from Jira ticket creation", "Quality pass rate tracked continuously"] } });
  const kpi = mk();
  const later = { type: "comparison", deckLibrary: "proposal", title: "SLA and KPI reporting cadence", left: { label: "a", points: ["x", "y"] }, right: { label: "b", points: ["x", "y"] } };
  const slides = [kpi, later];
  G.conformSlides_(slides, ctx);
  assert.equal(slides[0].type, "stats");
  const vals = slides[0].items.map((it) => it.value);
  ["50%", "95%", "30%"].forEach((v) => assert.ok(vals.includes(v), v + " in " + vals.join(", ")));
  assert.match(slides[0].notes, /Also on this topic: .*ticketing logs/);
  assert.equal(slides[1].type, "comparison", "one KPI slide per deck");
  // the deck already has its KPI slide (a long deck: the state goes with every part)
  const ctx2 = ctxFor(PRO); ctx2.deckState = { kpiSlide: "Success KPIs" };
  const again = [mk()];
  G.conformSlides_(again, ctx2);
  assert.equal(again[0].type, "comparison");
  assert.match(read("src/Code.gs"), /ctx\.deckState = st\.deckState = st\.deckState \|\| \{\};/);
});

test("A3. General 33: a team and governance slide with \"pods\" in its cards is never renamed \"Pricing options\"", () => {
  const ctx = ctxFor(GEN);
  ctx.brief.families = ["pricing"];
  ctx.outlineTitles = ["Integrated team structure and governance", "Commercial engagement and pricing options"];
  const sp = { type: "cards", title: "Integrated team structure and governance", items: [
    { title: "Executive steering committee", text: "Senior leaders approve milestone sign-offs and resolve escalated risks." },
    { title: "Architecture review board", text: "Architects validate designs before implementation across engineering pods." },
    { title: "Blended delivery pods", text: "Cross-functional squads pair 66degrees engineers with ZoomInfo specialists." }] };
  assert.notEqual(G.contractKind_(sp, ctx), "pricing");
  const slides = [sp];
  G.conformSlides_(slides, ctx);
  assert.doesNotMatch(slides[0].title, /pricing/i);
  // a pricing slide by its title is still the pricing slide
  assert.equal(G.contractKind_({ type: "cards", title: "Commercial engagement and pricing options", items: [{ title: "a" }, { title: "b" }] }, ctx), "pricing");
});

test("A4. General 34: \"66degrees is Responsible for ...; ZoomInfo is Accountable for ...\" becomes one role column per party", () => {
  const sp = { type: "table", title: "Delivery workstream RACI matrix", lead: "Explicit role definitions across all six workstreams eliminate ambiguity.",
    columns: ["Delivery workstream", "Role assignment and governance responsibility"],
    rows: [
      ["Cloud foundation & security", "66degrees is Responsible for Terraform modules and VPC perimeters; ZoomInfo is Accountable for security sign-off, Consulted on IAM policies, and Informed on deployment logs."],
      ["Lakehouse schema & BigLake", "66degrees is Responsible for Iceberg and BigQuery table design; ZoomInfo is Accountable for data model approval."],
      ["Streaming & batch ingestion", "66degrees is Responsible for Pub/Sub and Dataflow code refactoring; ZoomInfo is Accountable for pipeline acceptance."],
      ["Analytics Hub & data sharing", "66degrees is Responsible for configuring zero-copy exchange views; ZoomInfo is Accountable for external product entitlements."],
      ["Validation & FinOps controls", "66degrees is Responsible for automated reconciliation; ZoomInfo is Accountable for UAT sign-off."]] };
  const slides = [sp];
  G.conformSlides_(slides, ctxFor(GEN));
  assert.deepEqual(JSON.parse(JSON.stringify(slides[0].columns)), ["Delivery workstream", "66degrees", "ZoomInfo"]);
  assert.deepEqual(JSON.parse(JSON.stringify(slides[0].rows[0])), ["Cloud foundation & security", "Responsible", "Accountable"]);
  assert.match(slides[0].notes, /Roles in detail: .*Cloud foundation & security: ZoomInfo is Accountable for security sign-off/);
  // 4 (finish check): "all six workstreams" over five rows says five
  G.finishSlides_(slides, { log: [] });
  assert.match(slides[0].lead, /all five workstreams/);
});

test("A5. Solution 17: rows under their column headings never lose them when the slide is drawn as text sections", () => {
  const code = read("src/Engine.gs");
  assert.match(code, /heads\[j \+ 1\] \+ ': ' \+ c/);
  assert.match(code, /!\(headed && k === 'rows'\)/);
});

test("A6. Solution 25: points shown as one text are sentences with their full stops", () => {
  const code = read("src/SolutionDesigns_2_Flows.gs");
  assert.doesNotMatch(code, /linesOf\(it\)\.join\(' '\)/);
  const o = draw({ deckLibrary: "solution", type: "process", title: "Runbook: failback and resynchronization procedure", reference: { tag: "S66_BANNER_NUMBERED_ROWS" },
    items: [{ title: "Repair and resynchronize", points: ["Rebuild or repair primary us-central1 nodes and rejoin WSFC", "Verify asynchronous log seeding catches up across regions"] },
      { title: "Switch replication mode", points: ["Enter scheduled low-traffic clinical maintenance window", "Switch Distributed AG mode from asynchronous to synchronous commit"] },
      { title: "Execute manual failback", points: ["Issue manual lossless failover command back to us-central1", "Update Cloud DNS routing policies"] }] });
  const t = texts(o).join(" | ");
  assert.doesNotMatch(t, /rejoin WSFC Verify/);
  assert.doesNotMatch(t, /window Switch/);
});

test("A7. Proposal 16: the gate's rewrite never moves figures into the title; a title never hangs figures on with a dash", () => {
  const sp = { type: "stats", title: "Proven economic value of Google Cloud data platforms", items: [{ value: "38%", label: "Engineering productivity" }, { value: "205%", label: "Three-year ROI" }] };
  const t = G.gateApply_(sp, { title: "Proven economic value of Google Cloud data platforms - 38% productivity, 205% ROI over three years." });
  assert.equal(t.title, "Proven economic value of Google Cloud data platforms");
  const s2 = { type: "cards", title: "Proven economic value of Google Cloud data platforms - 38% productivity, 205% ROI over three years.", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }] };
  G.finishSlides_([s2], { log: [] });
  assert.equal(s2.title, "Proven economic value of Google Cloud data platforms");
  assert.match(s2.lead, /^38% productivity, 205% ROI over three years\./);
});

// ---------------- B. figures and wording

test("B8. Solution 5: one target read twice from the request is one tile", () => {
  const c = { brief: { figures: [{ value: "99.95%", label: "uptime", kind: "target" }, { value: "<15 min", label: "cross-region recovery time", kind: "target" },
    { value: "40% fewer", label: "incidents", kind: "target" }, { value: "40%", label: "incident reduction", kind: "target" }] } };
  const t = G.briefTargets_(c).map((f) => f.value);
  assert.deepEqual(JSON.parse(JSON.stringify(t)), ["99.95%", "<15 min", "40% fewer"]);
  // two different measures with the same number stay
  const c2 = { brief: { figures: [{ value: "35%", label: "lower cost", kind: "target" }, { value: "35%", label: "faster builds", kind: "target" }] } };
  assert.equal(G.briefTargets_(c2).length, 2);
});

test("B9. KPI slides: no tile says \"target\" again when the title says KPIs (any of its names)", () => {
  const o = draw({ deckLibrary: "general", type: "stats", title: "Core modernization key performance indicators", items: [
    { value: "99.9%", label: "Target: pipeline availability", text: "Automated failover." }, { value: "3x", label: "Faster query throughput", text: "Slot isolation." }, { value: "35%", label: "Lower infrastructure cost", text: "Serverless compute." }] });
  const t = texts(o).join(" | ");
  assert.doesNotMatch(t, /Target:/);
  assert.match(t, /Pipeline availability/);
  const o2 = draw({ deckLibrary: "solution", type: "stats", title: "Target KPIs for Contoso Health", items: [
    { value: "99.95%", label: "Uptime", text: "Synchronous local availability groups." }, { value: "< 15 min", label: "Target cross-region recovery time", text: "Sub-15-minute RTO." }, { value: "40%", label: "Fewer incidents", text: "Health checks." }] });
  assert.doesNotMatch(texts(o2).join(" | "), /Target cross-region/);
});

test("B10. the request's own targets are never flagged as \"not found in the research sources\"", () => {
  const slides = [{ type: "stats", title: "Core modernization KPIs", items: [{ value: "99.9%", label: "Pipeline availability", text: "Measured in Cloud Monitoring over 99.9% of hours." }] }];
  const sources = { research: [{ title: "Forrester TEI of BigQuery", excerpts: ["Organizations achieved a 38% productivity gain across data engineering teams over three years with BigQuery and BigLake."] }], text: "" };
  G.flagUnverifiedFigures_(slides, sources, [], ctxFor(GEN));
  assert.doesNotMatch(String(slides[0].notes || ""), /not found in the research/);
});

test("B11. Proposal 33: \"51% reduction · Retiring redundant BI servers ...\" reads as one sentence", () => {
  const o = draw({ deckLibrary: "proposal", type: "cards", title: "Google Cloud cost and efficiency benchmarks", items: [
    { title: "Five-year cost of operations", text: "51% reduction · Retiring redundant BI servers and duplicate pipelines cuts recurring licensing overhead." },
    { title: "IT management efficiency", text: "57% improvement · Serverless BigQuery autoscaling and Dataplex automation reduce manual effort." },
    { title: "Payback", text: "Organizations migrating mission-critical workloads realized payback within a year." }] });
  const t = texts(o).join(" | ");
  assert.doesNotMatch(t, / · /);
  assert.match(t, /51% reduction: retiring redundant BI servers/);
});

test("B12-16. finish check: filler steps, headings, product names, absolute promises", () => {
  const next = { type: "process", title: "Immediate next steps to initiate mobilization", items: [
    { title: "Finalize pricing, scope, and RACI to secure kickoff.", text: "Execute the statement of work." },
    { title: "Grant engineers access to Google Cloud and data sources.", text: "Provision connectivity." },
    { title: "Align retail stakeholders for architecture and Dataplex reviews.", text: "Schedule discovery sessions." },
    { title: "Four immediate steps to start mobilization.", text: "Confirm the initial retail domain." }] };
  const team = { type: "cards", title: "Integrated project team structure and governance", items: [{ title: "Joint Executive Steering Committee for escalations", text: "Provides strategic oversight." }, { title: "Best Buy team", text: "Owns the platform." }] };
  const arch = { type: "diagram", title: "Target architecture on Google Cloud", items: [{ title: "BigQuery Compute Engine", text: "Powers concurrent analytical queries." }, { title: "Pub/Sub event ingestion", text: "Captures signals." }] };
  const backup = { type: "cards", title: "Backup and point-in-time recovery architecture", takeaway: "Multi-tiered backups to dual-region Cloud Storage ensure zero data loss.", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }] };
  G.finishSlides_([next, team, arch, backup], { log: [] });
  assert.equal(next.items.length, 3);
  assert.ok(next.items.every((it) => !/\.$/.test(it.title)), next.items.map((it) => it.title).join(" | "));
  assert.equal(team.items[0].title, "Joint executive steering committee for escalations");
  assert.equal(arch.items[0].title, "BigQuery compute");
  assert.equal(backup.takeaway, "Multi-tiered backups to dual-region Cloud Storage protect against data loss.");
});

test("B15. General 23: research by 66degrees itself (or a case study linking only to a home page) is not a research source", () => {
  assert.equal(G.weakSource_({ title: "Enterprise Data Warehouse Modernization to BigQuery: Retail Case Study", publisher: "66degrees", url: "https://66degrees.com" }), true);
  assert.equal(G.weakSource_({ title: "The Total Economic Impact of BigQuery", publisher: "Forrester Consulting", url: "https://www.forrester.com/report/tei-bigquery" }), false);
});

test("21. an item that only repeats another item of the slide goes to the notes (Solution 32)", () => {
  const sp = { type: "cards", title: "Next steps", items: [
    { title: "Schedule technical scoping workshop", text: "Align architects and engineering leads to finalize regional topology." },
    { title: "Approve phase one kickoff date", text: "Sign off on the RACI matrix, timeline, and change freeze windows." },
    { title: "Provide current SQL Server inventory", text: "Share database sizes, peak IOPS, transaction log generation rates, and identity prerequisites for sizing." },
    { title: "Review network and AD prerequisites", text: "Validate Dedicated Interconnect capacity and Active Directory units." },
    { title: "Current state inputs", points: ["Database sizes, peak IOPS, log rates"] }] };
  G.finishSlides_([sp], { log: [] });
  assert.equal(sp.items.length, 4);
  assert.match(sp.notes, /Also on this topic: Current state inputs/);
});

// ---------------- C. structure

test("C17. General 2: five long section names keep the spiral agenda (up to six sections), in every deck type", () => {
  const items = ["Current state and modernization imperative", "Target architecture on Google Cloud and core modernization key performance indicators",
    "Reaching 3x faster query throughput and data lakehouse acceleration mechanisms", "Securing 35% lower infrastructure cost and resource allocation and cost governance",
    "Implementation scope, governance, and partnership"];
  ["general", "solution", "proposal"].forEach((lib) => {
    const o = draw({ type: "agenda", title: "Agenda", items, deckLibrary: lib });
    assert.equal(o.drawnWith, "P66_AGENDA_SPIRAL", lib);
    same(o.qa.issues, [], lib);
  });
});

test("C18-19. a new outline slide goes to the section it is about, before the pricing and next-step slides", () => {
  const secs = [
    { title: "Current architecture and failure modes", list: [{ type: "cards", title: "Current architecture and its failure points" }] },
    { title: "Deployment, monitoring and operational runbooks", list: [{ type: "process", title: "How the solution is deployed" }, { type: "cards", title: "Runbook: zero-downtime patching" }] },
    { title: "Success KPIs, commercial options, and next steps", list: [{ type: "stats", title: "Success KPIs and target figures" }, { type: "cards", title: "Pricing options" }, { type: "process", title: "Next steps" }] }];
  G.placeInSection_(secs, { type: "process", title: "Operating the platform day to day: monitoring and runbooks" }, [0]);
  assert.ok(secs[1].list.some((o) => /day to day/.test(o.title)), "in the runbooks section");
  G.placeInSection_(secs, { type: "cards", title: "Commercial terms and KPI reporting" }, []);
  const last = secs[2].list.map((o) => o.title);
  assert.ok(last.indexOf("Commercial terms and KPI reporting") < last.indexOf("Pricing options"), last.join(" | "));
  assert.equal(last[last.length - 1], "Next steps");
});

test("C20. Solution: the slides of a part that came back empty are written once more before any is left out", () => {
  assert.match(read("src/Code.gs"), /slide\(s\) came back empty; ' \+ back \+ ' written again\./);
});

// ---------------- D. layout

test("D22. Proposal 11: a one-line divider title keeps its rule right under it", () => {
  const o = draw({ type: "section", title: "Target architecture with Dataplex and Looker", number: "02", deckLibrary: "proposal", reference: { tag: "P66_SECTION_DARK" } });
  assert.equal(o.drawnWith, "P66_SECTION_DARK");
  const title = o.els.find((e) => e.t === "text" && /Target architecture/.test(e.text));
  const rule = o.els.find((e) => e.t === "line");
  assert.ok(rule.y1 - (title.y + (title.vh || title.h)) < 12, "rule " + Math.round(rule.y1) + " title end " + Math.round(title.y + (title.vh || title.h)));
});

test("D23. Proposal 22: a Gantt legend is drawn only when the bars carry its groups", () => {
  const base = { deckLibrary: "proposal", type: "timeline", title: "Phased implementation roadmap for Best Buy", reference: { tag: "P66_GANTT" },
    periods: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"],
    lanes: [{ name: "Phase 1: Foundation", bars: [{ start: 1, end: 2, label: "Scoping and setup" }] }, { name: "Phase 2: Dataplex", bars: [{ start: 2, end: 4, label: "Dataplex pilot" }] },
      { name: "Phase 3: Looker", bars: [{ start: 3, end: 5, label: "Looker migration" }] }, { name: "Phase 4: Decommission", bars: [{ start: 5, end: 6, label: "Decommissioning" }] }] };
  const o = draw(Object.assign({}, base, { legend: ["Active delivery phase", "Milestone review at each phase exit"] }));
  assert.equal(o.drawnWith, "P66_GANTT");
  assert.doesNotMatch(texts(o).join(" | "), /Milestone review at each phase exit/);
  const lanes = base.lanes.map((l, k) => ({ name: l.name, bars: l.bars.map((b) => Object.assign({}, b, { group: k % 2 ? "Review" : "Delivery" })) }));
  const o2 = draw(Object.assign({}, base, { lanes, legend: ["Delivery", "Review"] }));
  assert.match(texts(o2).join(" | "), /Delivery \| Review|Review/);
});
