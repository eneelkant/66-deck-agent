"use strict";

// V.1_37 (proposal batch 1): Proposal Deck library switch, strict proposal cover with the client logo, 66° + client
// logo in the corners from the agenda to the slide before Thank you, one section divider style per deck (dark streaks
// or light with the 66° watermark), client found by Gemini (Option A), logo from Drive / official logo / website icon.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function load(extra) {
  const sandbox = Object.assign({ console, Logger: { log() {} }, Math, JSON, Date, CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 },
    progressStage_() {}, checkCancel_() {} }, extra || {});
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Reference.gs", "src/ProposalKit.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  if (extra) Object.assign(sandbox, extra);
  return sandbox;
}
const render = (g, s) => g.ENGINE.render({ slides: [s] }, { dateLabel: "x" })[0];
const logos = (out) => out.els.filter((e) => e.t === "image" && e.asset === "client-logo");

test("libraries never mix: a Proposal Deck ignores General designs, a General deck keeps them", () => {
  const g = load();
  const cards = { type: "cards", title: "Risks", items: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }, { title: "D", text: "d" }], reference: { tag: "66D_LAYOUT_CARDS_024" } };
  const general = render(g, cards);
  const proposal = render(g, Object.assign({}, cards, { deckLibrary: "proposal" }));
  assert.ok(general.els.some((e) => e.t === "icon" && e.fallback === "!"), "General deck: the chosen template design");
  assert.ok(!proposal.els.some((e) => e.t === "icon" && e.fallback === "!"), "Proposal Deck: never a General design");
  const P = g.ENGINE.PROPOSAL_TAGS;
  assert.deepEqual(Array.from(g.drawableDesigns_("cards", 4, Object.assign({}, cards, { deckLibrary: "proposal" }))).filter((v) => !P[v.tag]), []);
  // the rotating cover / closing variants are General: a proposal always gets the strict cover
  const cov = render(g, { type: "cover", deckLibrary: "proposal", title: "T", reference: { tag: "ENGINE_COVER_PANEL" } });
  assert.ok(cov.els.some((e) => e.t === "roundrect" || e.asset === "mark-white"), "strict cover with the 66° tile");
  assert.ok(!cov.els.some((e) => e.w === 236 && e.h === g.ENGINE.H), "not the blue-panel cover variant");
});

test("strict proposal cover: client logo top-left, 66degrees wordmark when no client", () => {
  const g = load();
  const withClient = render(g, { type: "cover", deckLibrary: "proposal", clientLogo: true, title: "Proposal" });
  const l = logos(withClient)[0];
  assert.ok(l && l.fit === "contain" && l.align === "left" && l.x < 40 && l.y < 30);
  assert.ok(!withClient.els.some((e) => e.asset === "logo-dark"));
  const noClient = render(g, { type: "cover", deckLibrary: "proposal", title: "Proposal" });
  assert.ok(noClient.els.some((e) => e.asset === "logo-dark"));
  assert.equal(logos(noClient).length, 0);
  ["cover-pattern", "band-pattern", "mark-white"].forEach((a) => assert.ok(withClient.els.some((e) => e.asset === a), a));
});

test("corners: 66° bottom-left and client logo bottom-right from agenda to before Thank you; never on cover or Thank you", () => {
  const g = load();
  const cards = render(g, { type: "cards", deckLibrary: "proposal", cobrand: true, title: "x", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }, { title: "e", text: "f" }] });
  const l = logos(cards)[0], m = cards.els.find((e) => e.asset === "mark-dark");
  assert.ok(l && m);
  assert.equal(l.align, "right");
  assert.ok(Math.abs((l.x + l.w) - (g.ENGINE.W - m.x)) < 0.5, "mirrors the 66° mark");
  assert.ok(Math.abs((l.y + l.h / 2) - (m.y + m.h / 2)) < 0.5 && l.h >= m.h && l.h <= 20, "same line, square logos up to 20pt");
  const agenda = render(g, { type: "agenda", deckLibrary: "proposal", cobrand: true, title: "Agenda", items: [{ title: "Introduction", no: 1 }, { title: "Thank you", no: 2 }] });
  assert.ok(logos(agenda)[0].tile, "on the blue band: light tile");
  assert.ok(agenda.els.find((e) => e.asset === "band-pattern").x + 94 <= logos(agenda)[0].x, "band pattern moves out of the way");
  const dark = render(g, { type: "section", deckLibrary: "proposal", cobrand: true, sectionStyle: "dark", title: "Approach" });
  assert.ok(logos(dark)[0].tile);
  assert.equal(logos(render(g, { type: "closing", deckLibrary: "proposal", cobrand: true, title: "Thank You!" })).length, 0);
  assert.equal(logos(render(g, { type: "cover", deckLibrary: "proposal", cobrand: true, title: "x" })).length, 0);
});

test("light section divider: panel background, big 66° watermark bottom-right, clear of the footer row", () => {
  const g = load();
  const out = render(g, { type: "section", deckLibrary: "proposal", cobrand: true, sectionStyle: "light", number: "02", title: "Proposed solution and approach", lead: "How we deliver" });
  assert.equal(out.bg, g.ENGINE.TOKENS.bgLight);
  assert.ok(!out.dark);
  const wm = out.els.find((e) => e.asset === "watermark-66");
  assert.ok(wm && wm.x > 360 && wm.y + wm.h <= 350);
  assert.ok(g.inlineAssetBlob_ && /^iVBOR/.test(g.WATERMARK_66_PNG_), "watermark is a built-in PNG");
});

test("proposal frame: tags every slide once per deck; General decks are untouched", () => {
  const g = load();
  const slides = [{ type: "cover" }, { type: "agenda" }, { type: "section" }, { type: "cards" }, { type: "closing" }];
  g.applyProposalFrame_(slides, { proposal: { client: "Northwind", logoId: "f1", sectionStyle: "light" } });
  assert.deepEqual(slides.map((s) => s.deckLibrary), ["proposal", "proposal", "proposal", "proposal", "proposal"]);
  assert.deepEqual(slides.map((s) => !!s.cobrand), [false, true, true, true, false]);
  assert.equal(slides[0].clientLogo, true);
  assert.equal(slides[2].sectionStyle, "light");
  const gen = [{ type: "cards" }];
  g.applyProposalFrame_(gen, {});
  assert.equal(gen[0].deckLibrary, undefined);
  const noLogo = [{ type: "cover" }, { type: "cards" }];
  g.applyProposalFrame_(noLogo, { proposal: { client: null, logoId: "", sectionStyle: "dark" } });
  assert.equal(noLogo[0].clientLogo, false);
  assert.equal(noLogo[1].cobrand, false);
});

test("client detection (Option A): the buyer only; none or unclear = no client logo, said in the result", () => {
  let answer;
  const g = load({ callGeminiJSON: () => answer });
  answer = { client: "Expedia", domain: "https://www.expedia.com/", confident: true };
  assert.deepEqual(JSON.parse(JSON.stringify(g.detectClient_("Proposal for Expedia to move from Microsoft 365 to Google Workspace", {}, { log: [] }))), { name: "Expedia", domain: "expedia.com" });
  answer = { client: "Apple", domain: "apple.com", confident: false };
  assert.equal(g.detectClient_("Proposal for Apple and Beats", {}, { log: [] }), null);
  answer = { client: "Google Cloud", domain: "", confident: true };
  assert.equal(g.detectClient_("x", {}, { log: [] }), null);
  const ctx = { presentationType: "Proposal Deck", log: [], apiKey: "k" };
  answer = { client: "", domain: "", confident: false };
  g.prepareProposal_("Proposal to move a retailer's email", {}, ctx);
  assert.match(ctx.log.join("\n"), /No client named — 66degrees logo used\./);
  assert.ok(["dark", "light"].includes(ctx.proposal.sectionStyle));
});

test("client logo: Drive first, then the official logo (no key), then the website icon; saved to Drive", () => {
  const src = read("src/ProposalKit.gs");
  const order = ["findDriveLogo_(client.name)", "brandfetchLogo_(client.domain)", "wikidataLogo_(client.name, client.domain)", "google.com/s2/favicons"].map((k) => src.indexOf(k));
  order.forEach((i) => assert.ok(i > 0));
  assert.deepEqual(order.slice().sort((a, b) => a - b), order);
  assert.match(src, /clientLogoFolder_\(\)\.createFile/);
  assert.match(src, /'P154'/, "Wikidata logo image property");
  assert.match(src, /BRANDFETCH_API_KEY/, "optional key, used only when set");
  const clasp = JSON.parse(read(".clasp.json"));
  assert.ok(clasp.filePushOrder.includes("ProposalKit.gs"));
  const code = read("src/Code.gs");
  assert.match(code, /General template slides are not used in a Proposal Deck/);
  assert.match(code, /proposal: ctx\.proposal \|\| null/, "long decks keep the client between runs");
});

test("V.1_37 review (Home Depot deck): library switch even when the client step failed; client name keeps its capitals", () => {
  const g = load();
  const ctx = { presentationType: "Proposal Deck", log: [] };          // prepareProposal_ never ran / failed
  const slides = [{ type: "cover", subtitle: "A proposal for the home depot" }, { type: "cards", title: "x", items: [{ title: "the home depot today", text: "t" }] }];
  g.applyProposalFrame_(slides, ctx);
  assert.equal(slides[1].deckLibrary, "proposal");
  ctx.proposal.client = "The Home Depot";
  g.applyProposalFrame_(slides, ctx);
  assert.equal(slides[0].subtitle, "A proposal for The Home Depot");
  assert.equal(slides[1].items[0].title, "The Home Depot today");
  const code = read("src/Code.gs");
  assert.match(code, /AGENT_VERSION_ \+ ' · Presentation type: '/, "the result message names the version and type");
  assert.match(code, /return \{ title: '', text: x \};/, "no headings cut from the first words of a sentence");
  assert.match(read("src/Engine.gs"), /capH\(it, capW, 3\) \+ 16 > rowH/, "half donut never overlaps captions");
});

test("Home Depot deck 2: base layouts cannot reach General designs in a Proposal Deck (diagram hub / ring chain)", () => {
  const g = load();
  const items = (n) => Array.from({ length: n }, (_, i) => ({ title: "Item " + i, text: "Some words about item " + i }));
  [5, 6].forEach((n) => {
    const general = render(g, { type: "diagram", title: "x", center: "AI", items: items(n) });
    const proposal = render(g, { type: "diagram", deckLibrary: "proposal", title: "x", center: "AI", items: items(n) });
    assert.ok(general.els.some((e) => e.t === "ellipse"), "General: hub / ring-chain circles");
    assert.ok(!proposal.els.some((e) => e.t === "ellipse"), "Proposal: no General diagram design");
  });
  // and General decks keep every template design once a proposal slide was drawn
  render(g, { type: "diagram", deckLibrary: "proposal", title: "x", items: items(6) });
  assert.ok(render(g, { type: "diagram", title: "x", center: "AI", items: items(6) }).els.some((e) => e.t === "ellipse"));
  const src = read("src/ProposalKit.gs");
  assert.match(src, /wikipediaLogo_\(client\.name\)/);
  assert.match(src, /no logo found: ' \+ LOGO_TRAIL_/, "the result message says what each logo source answered");
});

test("logo.dev is used first (after Drive), with fallback=404 so no made-up monogram; domain from Wikidata or name.com", () => {
  const src = read("src/ProposalKit.gs");
  const i = (k) => src.indexOf(k);
  assert.ok(i("findDriveLogo_(client.name)") < i("logoDevLogo_(client.domain)") && i("logoDevLogo_(client.domain)") < i("wikidataLogo_(client.name, client.domain)"));
  assert.match(src, /img\.logo\.dev\/' \+ encodeURIComponent\(domain\)/);
  assert.match(src, /fallback=404/);
  assert.match(src, /LOGO_DEV_TOKEN/);
  const fetched = [];
  const g = load({ UrlFetchApp: { fetch: (u) => { fetched.push(u); return { getResponseCode: () => 200, getBlob: () => ({ getContentType: () => "image/png", getBytes: () => new Array(5000), setName() { return this; } }) }; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } });
  assert.ok(g.logoDevLogo_("apple.com"));
  assert.match(fetched[0], /^https:\/\/img\.logo\.dev\/apple\.com\?token=pk_/);
});
