"use strict";

// V.1_43: review of deck 17 (Nike proposal). Every content slide of a Proposal Deck is drawn in a proposal design
// (plain stats and bullets were drawn in the General layouts), the team structure written as stakeholders /
// specialists is drawn (the slide was empty), no slide is ever empty, one team slide, risks never on a pyramid,
// the agenda is titled "Agenda", headings in sentence case, and the client logo search accepts simple logos.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DESIGN_FILES = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort();
function load(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 11, 2026" }, Session: { getScriptTimeZone: () => "UTC" },
    loadDesignUsage_: () => ({ seq: 0, used: {} }), saveDesignUsage_() {} }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs"].concat(DESIGN_FILES.map((f) => "src/" + f)).concat(["src/Reference.gs", "src/ProposalKit.gs", "src/Code.gs"])
    .forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  Object.assign(sandbox, { loadDesignUsage_: () => ({ seq: 0, used: {} }), saveDesignUsage_() {} });
  return sandbox;
}
const render = (g, s) => g.ENGINE.render({ slides: [s] }, { dateLabel: "x" })[0];
const texts = (out) => out.els.filter((e) => e.t === "text").map((e) => e.text);
const ctxP = () => ({ presentationType: "Proposal Deck", log: [], lib: null, proposal: { client: "Nike", logoId: "", dividerTag: "P66_SECTION_DARK", agendaWide: "P66_AGENDA_TWO_COLUMNS" } });
const KPIS = { type: "stats", title: "The evolving customer service landscape", lead: "Customer experience is changing fast.",
  items: [{ value: "80%", label: "Personalized interactions", text: "By 2026, CDPs will activate 80% of personalized interactions." },
    { value: "78%", label: "More CDP spending", text: "Of companies plan to spend more on customer data platforms." },
    { value: "64%", label: "More GenAI spending", text: "Average increase in spending on GenAI infrastructure." },
    { value: "65%", label: "Higher satisfaction", text: "Of companies expect higher customer satisfaction from GenAI." }],
  takeaway: "Generative AI and data platforms are essential for modern customer service." };

test("KPI tiles draw plain KPIs (value, label, text) with the takeaway on the blue bar", () => {
  const g = load();
  const out = render(g, Object.assign({ deckLibrary: "proposal", reference: { tag: "P66_KPI_TILES" } }, KPIS));
  assert.ok(texts(out).includes("80%") && texts(out).some((t) => /CDPs will activate/.test(t)));
  assert.ok(texts(out).some((t) => /essential for modern/.test(t)));
  assert.equal(g.ENGINE.canDraw(Object.assign({ deckLibrary: "proposal", reference: { tag: "P66_KPI_TILES" } }, KPIS)), true);
});

test("every content slide in a proposal design: plain stats -> KPI tiles, bullets with a callout -> cards", () => {
  const g = load();
  const plan = { slides: [
    Object.assign({}, KPIS),
    { type: "bullets", title: "Executive pressure for AI in customer service", lead: "Leaders are pushing for AI.",
      points: ["Pressure to innovate: More than 75% of service leaders feel pressure to implement GenAI.", "Market growth: The AI customer service market keeps growing fast.",
        "Cost reduction: AI lowers the cost of customer service operations.", "Digital shift: Digital contacts will pass 40% within three years."],
      callout: { title: "Prioritizing AI for CX", text: "Service leaders own the AI roadmap." } }
  ] };
  const ctx = ctxP();
  g.chooseDesignsByContent_(plan, ctx);
  plan.slides.forEach((sp) => assert.ok(/^P66_/.test(sp.reference && sp.reference.tag), sp.title + ": " + (sp.reference && sp.reference.tag)));
  assert.equal(plan.slides[0].reference.tag, "P66_KPI_TILES");
  assert.equal(plan.slides[1].type, "cards");
  assert.equal(plan.slides[1].items[0].title, "Pressure to innovate");
});

test("team structure written as stakeholders / specialists is drawn with roles, never invented names", () => {
  const g = load();
  const s = { type: "team", deckLibrary: "proposal", title: "Collaborative team structure", reference: { tag: "P66_TEAM_STRUCTURE" },
    teams: [{ name: "Nike team", stakeholders: [{ name: "Jane Smith", role: "Project sponsor" }], specialists: [{ name: "Ann Park", role: "IT operations lead" }] },
      { name: "66degrees team", stakeholders: [{ name: "Bob Ray", role: "Engagement lead" }], specialists: [{ name: "Kim Yu", role: "Solution architect" }] }] };
  const out = render(g, s);
  assert.ok(texts(out).includes("Project sponsor") && texts(out).includes("Solution architect"));
  assert.ok(!texts(out).some((t) => /Jane Smith|Bob Ray/.test(t)));
  // a cards slide with teams is moved to the team designs
  const plan = { slides: [Object.assign({}, s, { type: "cards", reference: null })] };
  g.chooseDesignsByContent_(plan, ctxP());
  assert.equal(plan.slides[0].type, "team");
  assert.ok(/^P66_/.test(plan.slides[0].reference.tag));
});

test("never an empty slide: teams or an org chart no design can draw become cards", () => {
  const g = load();
  const out = render(g, { type: "cards", deckLibrary: "proposal", title: "Team", teams: [{ name: "Client team", roles: ["Sponsor"] }, { name: "66degrees team", roles: ["Lead"] }] });
  assert.ok(texts(out).includes("Client team") && texts(out).some((t) => /Sponsor/.test(t)));
});

test("risks: never on the pyramid (even when Gemini picks it); a risk list can become the Risk | Mitigation table", () => {
  const g = load();
  const risks = { type: "diagram", deckLibrary: "proposal", design: "P66_PYRAMID", title: "Mitigating implementation risks", lead: "How we handle them.",
    items: [{ title: "Data quality", text: "Clean the knowledge base first." }, { title: "Adoption", text: "Train agents early." }, { title: "Integration", text: "Use native connectors." }] };
  assert.ok(!g.drawableDesigns_("diagram", 3, risks).some((d) => d.tag === "P66_PYRAMID"));
  assert.ok(g.drawableDesigns_("diagram", 3, Object.assign({}, risks, { title: "The AI maturity pyramid" })).some((d) => d.tag === "P66_PYRAMID"));
  const alts = g.proposalAlternatives_(risks);
  const tbl = alts.find((a) => a.type === "table");
  assert.ok(tbl && tbl.columns.join("|") === "Risk|Mitigation" && tbl.rows.length === 3);
});

test("agenda is always titled Agenda", () => {
  const g = load();
  const a = { type: "agenda", title: "Agenda: enhancing customer service with AI" };
  g.proposalAgenda_(a, [{ title: "Introduction" }, { title: "Needs" }, { title: "Approach" }, { title: "Thank you" }], { agendaWide: "P66_AGENDA_TWO_COLUMNS" });
  assert.equal(a.title, "Agenda");
});

test("headings in sentence case: two-word Title Case headings, proposal fields, a lead label; names keep their capitals", () => {
  const g = load();
  g.setRunNames_("Proposal for Nike to bring Gemini and Agent Assist to its customer service.", ["Nike"]);
  assert.equal(g.headingCase_("Continuous Optimization"), "Continuous optimization");
  assert.equal(g.headingCase_("Real-time Coaching"), "Real-time coaching");
  assert.equal(g.headingCase_("Integration with Salesforce CRM"), "Integration with Salesforce CRM");
  assert.equal(g.headingCase_("Nike Customer Service"), "Nike customer service");
  assert.equal(g.headingCase_("Agent Assist Rollout"), "Agent Assist rollout");
  const sp = { type: "diagram", title: "x", lead: "Beyond Implementation: We focus on adoption.",
    columns: [{ label: "Data Sources", items: [{ title: "CRM" }] }], groups: [{ label: "Data And Access", points: ["a"] }],
    teams: [{ name: "Nike Team", roles: [{ title: "Project Sponsor" }] }], items: [{ title: "Strategic Oversight", text: "t" }] };
  g.sentenceCaseHeadings_(sp);
  assert.equal(sp.lead, "Beyond implementation: we focus on adoption.");
  assert.equal(sp.columns[0].label, "Data sources");
  assert.ok(Array.isArray(sp.columns[0].items), "column objects keep their items");
  assert.equal(sp.groups[0].label, "Data and access");
  assert.equal(sp.teams[0].roles[0].title, "Project sponsor");
  assert.equal(sp.items[0].title, "Strategic oversight");
});

test("one team slide per deck: team structure slides share a topic family", () => {
  const g = load();
  assert.equal(g.topicFamily_({ title: "Collaborative project team structure" }), "team");
  assert.equal(g.topicFamily_({ title: "Collaborative team structure" }), "team");
});

test("planner: proposal rules (menu designs only, one team slide, risks design, the client's section first)", () => {
  const code = read("src/Code.gs");
  assert.ok(/PROPOSAL RULES:/.test(code) && /Every body slide uses one design from the menu above/.test(code));
  assert.ok(/The first section is about the client/.test(code));
});

test("client logo: simple logos (small files) are kept by pixel size; WebP pictures are skipped", () => {
  const png = (w, bytes) => { const b = new Array(bytes).fill(0); [0x89, 0x50, 0x4e, 0x47].forEach((v, i) => (b[i] = v)); b[16] = (w >>> 24) & 255; b[17] = (w >>> 16) & 255; b[18] = (w >>> 8) & 255; b[19] = w & 255; return b; };
  const mk = (type, bytes) => ({ getResponseCode: () => 200, getBlob: () => ({ getContentType: () => type, getBytes: () => bytes }) });
  let resp = null;
  const g = load({ UrlFetchApp: { fetch: () => resp } });
  resp = mk("image/png", png(256, 900));
  assert.ok(g.fetchImage_("https://x/logo.png", 2500, "Website icon"), "a 256 px swoosh of 900 bytes is a logo");
  resp = mk("image/png", png(32, 900));
  assert.equal(g.fetchImage_("https://x/logo.png", 2500, "Website icon"), null, "a 32 px icon is too small");
  resp = mk("image/webp", png(256, 4000));
  assert.equal(g.fetchImage_("https://x/logo.webp", 800, "logo"), null);
});
