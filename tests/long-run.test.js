"use strict";

// V.1_28: decks up to 200 slides are built in parts (one Apps Script run per part); large rebrands too.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function sandbox() {
  const props = {}, uprops = {}, cache = {}, files = {};
  let fid = 0;
  const sb = {
    console, Math, JSON, Date,
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; }, getProperties: () => props, deleteProperty: (k) => { delete props[k]; } }),
      getUserProperties: () => ({ getProperty: (k) => uprops[k] || null, setProperty: (k, v) => { uprops[k] = v; }, deleteProperty: (k) => { delete uprops[k]; } })
    },
    CacheService: { getUserCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }), getScriptCache: () => ({ get: () => null, getAll: () => ({}), putAll() {}, removeAll() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: {
      createFile: (name, content) => { const id = "f" + (++fid); files[id] = { content, trashed: false }; return { getId: () => id }; },
      getFileById: (id) => ({ setContent: (c) => { files[id].content = c; }, setTrashed: (t) => { files[id].trashed = t; }, getBlob: () => ({ getDataAsString: () => files[id].content }) })
    },
    _uprops: uprops, _files: files, _cache: cache
  };
  vm.createContext(sb);
  ["src/Engine.gs", "src/Brand.gs", "src/Reference.gs", "src/Code.gs"].forEach((f) => vm.runInContext(read(f), sb, { filename: f }));
  return sb;
}

test("a 60-slide deck is planned once, built in parts and ends with the template Thank-you slide", () => {
  const sb = sandbox();
  vm.runInContext(`
    var DRAWN = [], CALLS = { outline: 0, batch: 0 };
    var deck = { slides: [], getId: function () { return 'p1'; }, getUrl: function () { return 'u'; }, getSlides: function () { return this.slides; } };
    SlidesApp = { getActivePresentation: function () { return deck; } };
    loadRunContext_ = function (ctx) { ctx.apiKey = 'vertex'; ctx.brand = { name: '66degrees', rules: [] }; ctx.assets = { icons: {} }; ctx.lib = null; ctx.tokens = null; };
    drawSlidesIntoActive_ = function (t, specs) { specs.forEach(function (s) { DRAWN.push(s.type + ':' + (s.title || '')); deck.slides.push({}); }); return { redrawn: specs.length }; };
    fitContentToDesigns_ = function () { return { fixed: 0, left: 0 }; };
    designThumbnailParts_ = function () { return []; };
    callGeminiJSON = function (parts) {
      var t = parts[0].text;
      if (/Plan the OUTLINE/.test(t)) {
        CALLS.outline++;
        var secs = [];
        for (var s = 0; s < 5; s++) { var list = []; for (var k = 0; k < 12; k++) list.push({ type: k % 3 ? 'process' : 'diagram', title: 'Topic ' + s + '-' + k + ' explained', brief: 'b' }); secs.push({ title: 'Section ' + s, slides: list }); }
        return { deck_title: 'Big deck', subtitle: 'Sub', closing_subtitle: 'Bye', sections: secs };
      }
      CALLS.batch++;
      var m = t.match(/type "([a-z_]+)" \\| title "([^"]+)"/g) || [];
      return { slides: m.map(function (x) { var mm = x.match(/type "([a-z_]+)" \\| title "([^"]+)"/); return { type: mm[1], title: mm[2], center: 'Hub', items: [{ title: 'Alpha step', text: 'Concrete text for the step.' }, { title: 'Beta step', text: 'Concrete text for the step.' }, { title: 'Gamma step', text: 'Concrete text for the step.' }, { title: 'Delta step', text: 'Concrete text for the step.' }] }; }) };
    };
    var ctx = { runId: 'r1', log: [] };
    loadRunContext_(ctx);
    var first = startLongDeck_(ctx, deck, { userPrompt: 'A long deck', sources: { text: '', pdfs: [], images: [], research: [] }, presentationType: 'Custom', department: 'Other', n: 60, blankDeck: true }, Date.now() - 1000000);
    var res = first, guard = 0;
    while (res && res.continue && guard++ < 50) res = continueDeckGeneration('r1');
    RESULT = { first: first, last: res, drawn: DRAWN, calls: CALLS };
  `, sb);
  const R = sb.RESULT;
  assert.equal(R.first.continue, true, "the first run stops after one part and asks for the next");
  assert.equal(R.calls.outline, 1, "the outline is planned once");
  assert.ok(R.last.ok && !R.last.continue, "the last run finishes the deck");
  const dividers = R.drawn.filter((d) => /^section:/.test(d)).length;
  assert.ok(dividers >= 4, "one divider slide per section");
  assert.ok(R.drawn.length >= 55 && R.drawn.length <= 60, "about the asked number of slides, dividers included");
  assert.match(R.drawn[2], /^section:/, "the first section starts with its divider");
  assert.match(R.drawn[0], /^cover:/);
  assert.match(R.drawn[1], /^agenda:/);
  assert.match(R.drawn[R.drawn.length - 1], /^closing:Thank You!/);
  assert.equal(Object.keys(sb._uprops).filter((k) => /^RUNSTATE_/.test(k)).length, 0, "the run state is removed at the end");
  assert.ok(Object.values(sb._files).every((f) => f.trashed), "the state file is deleted");
});

test("a large rebrand is done in parts of 10 slides", () => {
  const sb = sandbox();
  vm.runInContext(`
    var PARTS = [];
    var deck = { slides: new Array(35).fill({}), getId: function () { return 'p1'; }, getUrl: function () { return 'u'; }, getSlides: function () { return this.slides; } };
    SlidesApp = { getActivePresentation: function () { return deck; } };
    loadRunContext_ = function (ctx) { ctx.apiKey = 'vertex'; ctx.brand = { name: '66degrees', rules: [] }; ctx.assets = { icons: {} }; ctx.lib = null; };
    rebrandPresentation = function (id, ctx, o) { PARTS.push([o.start, o.end]); return { slides: o.end - o.start, fonts: 1 }; };
    var t0 = Date.now() - 1000000;   // the first run is already past its time budget: it must stop after one part
    var res = rebrandStep_({ runId: 'rb', log: [] }, deck, { mode: 'rebrand', runId: 'rb', startedAt: t0, start: 0 }, t0), g = 0;
    var first = res;
    while (res && res.continue && g++ < 20) res = continueDeckGeneration('rb');
    RESULT = { first: first, last: res, parts: PARTS };
  `, sb);
  const R = sb.RESULT;
  assert.equal(R.first.continue, true);
  assert.deepEqual(Array.from(R.parts[0]), [0, 10]);
  assert.deepEqual(Array.from(R.parts[R.parts.length - 1]), [30, 35]);
  assert.ok(R.last.ok);
  assert.match(R.last.message, /Rebranded 35 slides/);
});

test("rebrandPresentation and the Gemini review work on a slide range", () => {
  const src = read("src/Rebrand.gs");
  assert.match(src, /const inPart = function \(i\) \{ return i >= start && i < end; \};/);
  assert.match(src, /'SLIDE ' \+ \(i \+ offset\) \+ ' image:'/);
});

test("same topic in other words, credentials, order, card limit and client names are handled in code", () => {
  const sb = sandbox();
  vm.runInContext(`
    var it = function (t) { return { title: t, text: 'Some text about ' + t + '.' }; };
    var slides = [
      { type: 'cards', title: 'Gemini enhances customer service operations holistically', items: [it('Self-service automation'), it('Agent assistance'), it('Proactive engagement'), it('Sentiment analysis')] },
      { type: 'cards', title: 'Practical use cases for Gemini in customer service', items: [it('Intelligent agent assist'), it('Automated self-service'), it('Proactive issue resolution'), it('Personalized outreach')] },
      { type: 'table', title: 'Addressing generative AI risks in customer service', risks: [] },
      { type: 'cards', title: 'Establishing strong AI governance for customer service', items: [it('Ethics'), it('Privacy'), it('Monitoring')] },
      { type: 'cards', title: 'Your trusted partner for enterprise AI transformation', items: [it('Partner'), it('Leader'), it('Mindset')] }
    ];
    var famDup = [];
    slides.forEach(function (sp) { famDup.push(topicFamily_(sp)); });
    var st0 = headingStems_(slides[0]), st1 = headingStems_(slides[1]);
    var many = [];
    for (var i = 0; i < 6; i++) many.push({ type: 'cards', title: 'Cards slide ' + i, items: [it('One'), it('Two'), it('Three')] });
    limitCardSlides_(many, 14);
    var cs = { type: 'case_study', title: 'Client success: transforming call center interactions', fact_tags: ['66D_FACT_COMPANY_020'] };
    nameCaseClient_(cs, { lib: { companyFacts: [{ tag: '66D_FACT_COMPANY_020', name: 'Client impact — AES', statement: 'Client: AES (logo).' }] } });
    RESULT = { fam: famDup, overlap: overlap_(st0, st1), types: many.map(function (s) { return s.type; }),
      topics: requestedTopics_('Create a presentation on using Gemini to improve customer service operations: why now, what good looks like, use cases, how we deliver, risks, KPIs, and a relevant client result.'),
      caseTitle: cs.title };
  `, sb);
  const R = sb.RESULT;
  assert.equal(R.fam[0], "usecases");
  assert.equal(R.fam[1], "usecases");
  assert.equal(R.fam[2], "riskgov");
  assert.equal(R.fam[3], "riskgov");
  assert.equal(R.fam[4], "credentials");
  assert.ok(R.overlap >= 0.45, "agent assist / self-service slides share their item stems");
  assert.equal(R.types.filter((t) => t === "cards").length, 2, "at most 2 cards slides");
  assert.deepEqual(Array.from(R.topics), ["why now", "what good looks like", "use cases", "how we deliver", "risks", "KPIs", "relevant client result"]);
  assert.match(R.caseTitle, /^AES: /);
});

test("the panel continues long runs and allows 200 slides", () => {
  const html = read("src/Generator.html");
  assert.match(html, /\.continueDeckGeneration\(runId\)/);
  assert.match(html, /result && result\.continue/);
  const code = read("src/Code.gs");
  assert.match(code, /const MAX_SLIDES_ = 200;/);
  assert.match(code, /function continueDeckGeneration\(runId\)/);
});
