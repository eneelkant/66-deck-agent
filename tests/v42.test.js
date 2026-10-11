"use strict";

// V.1_42: the Proposal Deck design library (65 designs: agenda, section dividers and content designs) is wired into the
// agent. Proposal designs only in a Proposal Deck, only proposal designs in the planner's menu, the deck structure
// (sections, one divider style per deck, spiral agenda up to 7 items, two columns / table of contents above), the
// built-in navy pictures and the push order.
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
    progressStage_() {}, checkCancel_() {}, Utilities: { formatDate: () => "Oct 11, 2026" }, Session: { getScriptTimeZone: () => "UTC" } }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs"].concat(DESIGN_FILES.map((f) => "src/" + f)).concat(["src/Reference.gs", "src/ProposalKit.gs", "src/Code.gs"])
    .forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  return sandbox;
}
const render = (g, s) => g.ENGINE.render({ slides: [s] }, { dateLabel: "x" })[0];
const tags = (g) => Object.keys(g.ENGINE.VARIANTS).reduce((a, t) => a.concat(g.ENGINE.VARIANTS[t].filter((v) => /^P66_/.test(v.tag)).map((v) => v.tag)), []);

test("push order: the proposal files load right after the engine", () => {
  const order = JSON.parse(read(".clasp.json")).filePushOrder;
  const e = order.indexOf("EngineRenderer.gs");
  assert.ok(e !== -1);
  DESIGN_FILES.forEach((f) => assert.ok(order.indexOf(f) > e && order.indexOf(f) < order.indexOf("Code.gs"), f));
  assert.ok(DESIGN_FILES.includes("ProposalAssets.gs") && DESIGN_FILES.length === 6);
});

test("library: 65 proposal designs, each tag once; none draws in a General deck", () => {
  const g = load();
  const all = tags(g);
  assert.equal(all.length, 65);
  assert.equal(new Set(all).size, all.length);
  ["P66_AGENDA_SPIRAL", "P66_AGENDA_TWO_COLUMNS", "P66_AGENDA_CONTENTS", "P66_SECTION_DARK", "P66_SECTION_NAVY", "P66_SECTION_LIGHT"].forEach((t) => assert.ok(all.includes(t), t));
  const s = { type: "process", title: "Plan", items: [{ title: "Discover", text: "a" }, { title: "Pilot", text: "b" }, { title: "Scale", text: "c" }], reference: { tag: "P66_CHEVRON_PHASES" } };
  assert.equal(g.ENGINE.canDraw(s), false, "General deck");
  assert.equal(g.ENGINE.canDraw(Object.assign({ deckLibrary: "proposal" }, s)), true, "Proposal Deck");
});

test("design menu: proposal designs with their fields for a Proposal Deck, none of them for a General deck", () => {
  const g = load();
  const p = g.ENGINE.designMenu("proposal"), gen = g.ENGINE.designMenu();
  assert.ok(/P66_KPI_TILES/.test(p) && /fields: stats\[/.test(p));
  assert.ok(!/66D_LAYOUT_/.test(p) && !/P66_AGENDA|P66_SECTION/.test(p), "frame slides are placed by the code");
  assert.ok(!/P66_/.test(gen) && /66D_LAYOUT_/.test(gen));
});

test("needs: only the special field is a requirement (items / points are counted by min-max)", () => {
  const g = load();
  const v = (tag) => Object.values(g.ENGINE.VARIANTS).flat().find((x) => x.tag === tag);
  assert.equal(v("P66_ICON_COLUMNS").needs, undefined);
  assert.equal(v("P66_KPI_TILES").needs, "stats");
  assert.equal(v("P66_TWO_PANELS").needs, "left");
  const two = g.drawableDesigns_("comparison", 2, { type: "comparison", deckLibrary: "proposal", title: "Options", left: { label: "A", points: ["x"] }, right: { label: "B", points: ["y"] } });
  assert.ok(two.some((d) => d.tag === "P66_TWO_PANELS"));
  assert.ok(!two.some((d) => /^66D_/.test(d.tag)), "libraries never mix");
});

test("structure: 15-slide proposal = 12 written slides + 3 numbered dividers, spiral agenda of the sections", () => {
  const g = load();
  const ctx = { presentationType: "Proposal Deck", log: [], proposal: { client: "Apple", logoId: "", sectionStyle: "dark", dividerTag: "P66_SECTION_DARK", agendaWide: "P66_AGENDA_TWO_COLUMNS" } };
  assert.equal(g.proposalSectionCount_(15), 3);
  assert.equal(g.proposalSectionCount_(11), 0);
  assert.equal(g.proposalSectionCount_(20), 4);
  const names = ["Understanding your needs", "Understanding your needs", "Understanding your needs", "Our approach", "Our approach", "Our approach", "Delivery and team", "Delivery and team", "Delivery and team"];
  const plan = { slides: [{ type: "cover", title: "x" }, { type: "agenda", title: "Agenda", items: [] }]
    .concat(names.map((n, i) => ({ type: "cards", title: "Slide " + (i + 1), section: n })))
    .concat([{ type: "closing", title: "Thank You!" }]) };
  g.proposalStructure_(plan, ctx, 3);
  assert.equal(plan.slides.length, 15);
  const secs = plan.slides.filter((s) => s.type === "section");
  assert.equal(JSON.stringify(secs.map((s) => s.number)), JSON.stringify(["01", "02", "03"]));
  assert.equal(JSON.stringify(secs[0].points), JSON.stringify(["Slide 1", "Slide 2", "Slide 3"]));
  const agenda = plan.slides[1];
  assert.equal(agenda.lockTag, "P66_AGENDA_SPIRAL");
  assert.equal(agenda.items.map((i) => i.title).join("|"), "Introduction|Understanding your needs|Our approach|Delivery and team|Thank you");
  assert.ok(plan.slides.every((s) => s.section === undefined));
  g.applyProposalFrame_(plan.slides, ctx);
  assert.ok(secs.every((s) => s.lockTag === "P66_SECTION_DARK" && s.deckLibrary === "proposal"));
});

test("structure: sections merged or split to the planned number; a workstream divider is light and not numbered", () => {
  const g = load();
  const mk = (sec) => sec.map((n, i) => ({ type: "cards", title: "S" + i, section: n }));
  assert.equal(g.proposalGroups_(mk(["A", "A", "B", "C", "C", "D", "D"]), 3).length, 3);
  assert.equal(g.proposalGroups_(mk(["A", "A", "A", "A", "B", "B"]), 3).length, 3);
  const ctx = { presentationType: "Proposal Deck", proposal: { client: null, logoId: "", dividerTag: "P66_SECTION_NAVY", agendaWide: "P66_AGENDA_TWO_COLUMNS" } };
  const ws = [{ type: "section", level: 2, title: "Technical workstream", number: "02" }, { type: "section", title: "Approach", number: "02" }];
  g.applyProposalFrame_(ws, ctx);
  assert.equal(ws[0].lockTag, "P66_SECTION_LIGHT");
  assert.equal(ws[0].number, undefined);
  assert.equal(ws[1].lockTag, "P66_SECTION_NAVY");
});

test("agenda: up to 7 items spiral; more -> two columns (topics cut to fit) or table of contents up to 11; continued slide when too long", () => {
  const g = load();
  const rows = (n, pts) => Array.from({ length: n }, (_, i) => ({ title: "Topic " + (i + 1), points: Array.from({ length: pts }, (_, k) => "Point " + k) }));
  let a = { type: "agenda", title: "Agenda" };
  assert.equal(g.proposalAgenda_(a, rows(7, 0), { agendaWide: "P66_AGENDA_TWO_COLUMNS" }), null);
  assert.equal(a.lockTag, "P66_AGENDA_SPIRAL");
  a = { type: "agenda", title: "Agenda" };
  g.proposalAgenda_(a, rows(9, 5), { agendaWide: "P66_AGENDA_TWO_COLUMNS" });
  assert.equal(a.lockTag, "P66_AGENDA_TWO_COLUMNS");
  assert.ok(a.items.reduce((t, r) => t + 1 + r.points.length, 0) <= 26);
  a = { type: "agenda", title: "Agenda" };
  g.proposalAgenda_(a, rows(10, 0), { agendaWide: "P66_AGENDA_CONTENTS" });
  assert.equal(a.lockTag, "P66_AGENDA_CONTENTS");
  a = { type: "agenda", title: "Agenda" };
  g.proposalAgenda_(a, rows(14, 0), { agendaWide: "P66_AGENDA_CONTENTS" });
  assert.equal(a.lockTag, "P66_AGENDA_TWO_COLUMNS", "table of contents holds 11 at most");
  a = { type: "agenda", title: "Agenda" };
  const more = g.proposalAgenda_(a, rows(30, 0), { agendaWide: "P66_AGENDA_TWO_COLUMNS" });
  assert.ok(more && more.continued && more.items.length === 6);
  const out = render(g, Object.assign({ deckLibrary: "proposal", reference: { tag: more.lockTag } }, more));
  assert.ok(out.els.some((e) => e.t === "text" && e.text === "Agenda (continued)"));
});

test("styles: dark streak dividers about 3 decks in 4, navy about 1 in 4; two columns about 3 in 4", () => {
  const g = load();
  let navy = 0, toc = 0;
  for (let i = 0; i < 2000; i++) {
    const p = g.proposalStyles_({});
    if (p.dividerTag === "P66_SECTION_NAVY") navy++;
    if (p.agendaWide === "P66_AGENDA_CONTENTS") toc++;
  }
  assert.ok(navy > 380 && navy < 620, String(navy));
  assert.ok(toc > 380 && toc < 620, String(toc));
});

test("dividers: dark numbered, navy with its topics on the built-in navy picture, light without number", () => {
  const g = load();
  const dark = render(g, { type: "section", deckLibrary: "proposal", cobrand: true, title: "Our approach", number: "02", reference: { tag: "P66_SECTION_DARK" } });
  assert.equal(dark.bgImage, "section-bg");
  assert.ok(dark.els.some((e) => e.t === "text" && e.text === "02"));
  const navy = render(g, { type: "section", deckLibrary: "proposal", cobrand: true, title: "Our approach", points: ["Migration strategy", "Process flow"], reference: { tag: "P66_SECTION_NAVY" } });
  assert.equal(navy.bgImage, "navy-bg");
  assert.ok(navy.els.some((e) => e.t === "text" && e.text === "Process flow"));
  assert.ok(navy.els.find((e) => e.asset === "client-logo").tile, "logo on a light tile");
  const light = render(g, { type: "section", deckLibrary: "proposal", title: "Technical workstream", reference: { tag: "P66_SECTION_LIGHT" } });
  assert.ok(!light.els.some((e) => e.t === "text" && /^\d\d$/.test(e.text)));
  assert.ok(light.els.some((e) => e.asset === "watermark-66"));
});

test("built-in pictures: navy background and band are JPEG in ProposalAssets.gs, used before Drive", () => {
  const assets = read("src/ProposalAssets.gs");
  ["NAVY_BG_JPG_", "NAVY_BAND_JPG_"].forEach((k) => {
    const m = assets.match(new RegExp("var " + k + " = '([^']+)'"));
    assert.ok(m, k);
    const buf = Buffer.from(m[1], "base64");
    assert.ok(buf[0] === 0xff && buf[1] === 0xd8 && buf.length < 80000, k);
  });
  const kit = read("src/ProposalKit.gs"), r = read("src/EngineRenderer.gs");
  assert.ok(/asset === 'navy-bg'/.test(kit) && /asset === 'navy-band'/.test(kit));
  assert.ok(/bgInline \|\| getBlobCached\(bgId, ctx\)/.test(r));
});

test("chooser: frame slides keep their design; the only proposal design of a type is used; Gemini's fitting design wins", () => {
  const g = load({ loadDesignUsage_: () => ({ seq: 0, used: {} }), saveDesignUsage_() {} });
  const ctx = { presentationType: "Proposal Deck", log: [], lib: null, proposal: { client: null, logoId: "", dividerTag: "P66_SECTION_DARK", agendaWide: "P66_AGENDA_TWO_COLUMNS" } };
  const plan = { slides: [
    { type: "section", title: "Our approach", number: "01" },
    { type: "case_study", title: "Retailer: one cloud foundation", client: "Retailer", challenge: "Stores ran on three data centres.", solution: ["Moved stores to Google Cloud", "Set up a landing zone", "Trained the team"], results: [{ value: "40%", label: "lower cost" }] },
    { type: "comparison", title: "Risk, impact and response", design: "P66_IMPACT_MITIGATION", lead: "Peak season",
      items: [{ label: "Risk", title: "Risk", points: ["Volumes double in launch week", "Advisors have less time"] }, { label: "Impact", title: "Impact", points: ["Handling time skewed", "Feedback arrives late"] }, { label: "Mitigation", title: "Mitigation", points: ["Start after launch", "Compare same weeks"] }] }
  ] };
  g.chooseDesignsByContent_(plan, ctx);
  assert.equal(plan.slides[0].reference.tag, "P66_SECTION_DARK");
  assert.equal(plan.slides[1].reference.tag, "P66_CASE_STUDY");
  if (g.ENGINE.canDraw(Object.assign({}, plan.slides[2], { reference: { tag: "P66_IMPACT_MITIGATION" } })))
    assert.equal(plan.slides[2].reference.tag, "P66_IMPACT_MITIGATION");
});

test("pipeline: grouped key inputs stay bullets; proposal team roles are kept without names; a section names the topic it covers", () => {
  const g = load();
  const ki = { type: "bullets", title: "Key inputs", groups: [{ label: "Data", points: ["Which knowledge bases?"] }, { label: "Success", points: ["Which rate?"] }], section: "Understanding your needs" };
  assert.equal(g.bulletsNeedPoints_(ki).type, "bullets");
  const conv = g.bulletsNeedPoints_({ type: "bullets", title: "x", points: [], section: "Our approach" });
  assert.equal(conv.section, "Our approach");
  const ctx = { presentationType: "Proposal Deck", log: [], lib: null };
  const out = g.normalizeSpecialSlides_([
    { type: "team", title: "Project governance", org: { name: "Steering committee", reports: [{ name: "PMO" }, { name: "Architecture" }] } },
    { type: "team", title: "Team approach", people: [{ name: "Jane Doe", title: "Engagement lead", text: "Leads" }, { name: "John Roe", title: "Solution architect", text: "Designs" }] }
  ], "Proposal for Apple", { text: "" }, ctx);
  assert.equal(out.length, 2);
  assert.ok(!out[1].people && out[1].items[0].title === "Engagement lead");
  assert.equal(g.slideForTopic_([{ type: "cards", title: "Migration strategy", section: "Delivery plan" }], "delivery plan"), 0);
});

test("text screenshot design never draws an empty screenshot frame", () => {
  const g = load();
  const s = { type: "bullets", deckLibrary: "proposal", title: "Agent Assist", heading: "Agent Assist", points: ["Suggests answers", "Summarises chats"], reference: { tag: "P66_TEXT_SCREENSHOT" } };
  assert.equal(g.ENGINE.canDraw(s), false);
  assert.equal(g.ENGINE.canDraw(Object.assign({ screenshot: true }, s)), true);
});

test("version label is V.1_42", () => {
  assert.ok(/AGENT_VERSION_ = '66° Deck Agent V\.1_42'/.test(read("src/Code.gs")));
});
