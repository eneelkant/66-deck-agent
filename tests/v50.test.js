"use strict";

// V.1_50 (HSBC 30-slide proposal audit, deck 22) - the final Proposal Deck fixes: a workstream divider always has its
// slides; a statement never shows the same sentence twice and keeps the slide's message; a long-deck slide keeps the kind
// the outline planned (methodology steps, roadmap timeline); a requested roadmap is a Gantt (short and long decks); risks
// always show their mitigations; a stock image once per deck across all parts; no line breaks inside texts; a loop is a
// cycle (never layers); product explainers at most twice; "how we work" is the methodology topic; at most two before/after
// comparisons; sentence case for the cover subtitle and the governance box; "AI-powered" in notes; the deck always has
// the slides asked for.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

// The whole add-on in one sandbox, with Slides / Drive / Gemini mocked
function loadAll(gemini, seed) {
  let sd = seed || 1;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const slides = [], drawn = [], props = {}, uprops = {}, files = {};
  const mkSlide = () => ({ getObjectId: () => "s" + slides.length, remove() {}, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) });
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n",
    insertSlide(i, s) { const c = mkSlide(); slides.splice(i, 0, c); return c; }, getSlideById: (x) => slides.find((q) => q.getObjectId() === x) || null };
  // V.1_51: long proposal decks are drawn in a hidden working copy and inserted into the presentation at the end
  const works = {};
  const mkWork = (name) => { const ws = []; const id = "W" + Object.keys(works).length; let k = 0;
    const mk = () => { const s = { getObjectId: () => s._id, remove() { const j = ws.indexOf(s); if (j >= 0) ws.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; s._id = id + "_" + (k++); return s; };
    const w = { name, getSlides: () => ws, getId: () => id, getPageWidth: () => 720, getPageHeight: () => 405, saveAndClose() {},
      appendSlide() { const s = mk(); ws.push(s); return s; }, getSlideById: (x) => ws.find((q) => q.getObjectId() === x) || null };
    ws.push(mk()); works[id] = w; return w; };
  const sb = { console, Math: M, JSON, Date, Logger: { log() {} },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" }, create: (n) => mkWork(n),
      openById: (id) => { if (works[id]) return works[id]; throw new Error("no deck " + id); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty(k, v) { props[k] = v; } }),
      getUserProperties: () => ({ getProperty: (k) => uprops[k] || null, setProperty(k, v) { uprops[k] = v; }, deleteProperty(k) { delete uprops[k]; } }) },
    CacheService: { getUserCache: () => ({ get: () => null, put() {}, remove() {} }), getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "Oct 14, 2026", sleep() {}, newBlob: () => ({}), base64Decode: () => [], computeDigest: () => [], DigestAlgorithm: {} },
    Session: { getScriptTimeZone: () => "UTC", getActiveUser: () => ({ getEmail: () => "x" }) },
    DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), searchFiles: () => ({ hasNext: () => false }), getFolderById: () => { throw new Error("no folder"); },
      createFile: (n, j) => { const id = "F" + Object.keys(files).length; files[id] = j; return { getId: () => id, setContent(x) { files[id] = x; }, setTrashed() {} }; },
      getFileById: (id) => ({ setContent(x) { files[id] = x; }, setTrashed() {}, getBlob: () => ({ getDataAsString: () => files[id] }) }),
      createFolder: () => ({ createFile: () => ({ getId: () => "LOGO1" }) }) },
    UrlFetchApp: { fetch: () => { throw new Error("no net"); } } };
  vm.createContext(sb);
  ORDER.forEach((f) => vm.runInContext(read("src/" + f), sb, { filename: f }));
  Object.assign(sb, {
    loadRunContext_(ctx) { ctx.apiKey = "k"; ctx.brand = JSON.parse(JSON.stringify(sb.DEFAULT_BRAND)); ctx.assets = { design: {}, logos: {}, patterns: {}, icons: [] }; ctx.lib = null; ctx.tokens = null; },
    callGeminiJSON: (parts) => gemini(parts[0].text || ""),
    researchTopic_: () => ({ research: [] }),
    renderEngineSlide(slide, spec) { drawn.push(JSON.parse(JSON.stringify(spec))); },
    insertTemplateSlide_: () => false
  });
  sb.drawn = drawn;
  return sb;
}
const ev = (sb, code) => vm.runInContext(code, sb);

const S1='Understanding the challenge',S2='Our approach and solution',S3='Data, security, and implementation',S4='Roadmap, governance, and outcomes';
const OUTLINE={deck_title:'AI-powered fraud detection for HSBC retail banking',subtitle:'A Proposal from 66degrees',closing_subtitle:'Partnering for a secure future with AI',
 sections:[
  {title:S1,description:'Why fraud detection must change',slides:[
    {type:'cards',title:"HSBC's current fraud detection challenges"},{type:'cards',title:'The evolving financial crime landscape'},{type:'cards',title:"HSBC's strategic objectives for AI adoption"},
    {type:'comparison',title:'Combining fraud & AML for better outcomes'},{type:'comparison',title:'AI-powered detection vs. traditional rules'},{type:'table',title:'Scope: what is in and what is out'}]},
  {title:S2,description:'How the solution works',slides:[
    {type:'process',title:'Our proven methodology for successful delivery'},{type:'bullets',title:'Co-creation and agile delivery principles'},{type:'diagram',title:'High-level solution architecture overview'},
    {type:'cards',title:'Google Cloud Platform capabilities for fraud'},{type:'process',title:'Real-time transaction monitoring workflow'},{type:'cards',title:'Google Cloud scalability and performance'},
    {type:'diagram',title:'Gemini and Vertex AI: the intelligent core of detection'}]},
  {title:S3,description:'Data, security and the plan',slides:[
    {type:'process',title:'Building a robust data foundation for AI'},{type:'cards',title:"Google Cloud's enterprise-grade security"},{type:'process',title:'Delivery plan: key phases and activities'},
    {type:'workstream',title:'Technical implementation'},{type:'workstream',title:'Change management & adoption'}]},
  {title:S4,description:'Who, how we measure, what improves',slides:[
    {type:'team',title:'Expert team and project governance'},{type:'process',title:'Mitigating AI implementation risks'},{type:'stats',title:'Measuring success: key performance indicators'},
    {type:'process',title:'Achieving long-term value and continuous improvement'},{type:'comparison',title:"Tangible benefits: AI's impact on operations and customers"}]}]};
const it=(t,x,extra)=>Object.assign({title:t,text:x},extra||{});
function content(o){
  const T=o.title, ty=o.type;
  if(/methodology/i.test(T)) return {type:'statement',title:T,lead:'A structured methodology ensures successful project delivery and measurable impact for HSBC.',statement:'A structured methodology ensures successful project delivery and measurable impact for HSBC.'};
  if(/risks/i.test(T)) return {type:'process',title:T,lead:'We address risks early.',design:'P66_NUMBERED_ROWS',items:[it('Inaccurate data inputs','Model predictions will be unreliable.',{points:['Data profiling in month one','Owners sign off each source']}),it('Biased model outcomes','Unfair decisions and regulatory exposure.',{points:['Bias testing before go-live','Explainability reviews']}),it('Poor system integration','Delayed deployment and resistance.',{points:['Integration checkpoint every week']})]};
  if(/delivery plan/i.test(T)) return {type:'process',title:T,lead:'A phased plan.',design:'P66_PHASE_COLUMNS',items:[it('Phase 1: Discovery & foundation','Workshops, current systems, Google Cloud setup.'),it('Phase 2: Data & features','Pipelines into BigQuery and AI-ready features.'),it('Phase 3: Models','Train and validate models on Vertex AI.'),it('Phase 4: Pilot','Controlled pilot in retail banking.')]};
  if(/intelligent core/i.test(T)) return {type:'diagram',title:T,lead:'This integrated loop ensures continuous learning and adaptive fraud detection.',design:'P66_ISO_CALLOUTS',items:[it('Data preparation','BigQuery gathers and prepares datasets.'),it('Model training','Vertex AI trains fraud models.'),it('Model deployment','Models serve real-time scores.'),it('Risk scoring','Gemini adds context to each score.')]};
  if(/continuous improvement/i.test(T)) return {type:'process',title:T,lead:'Our approach keeps the models current.',design:'P66_CHEVRON_PHASES',items:[it('Monitor performance','Continuously track AI\nmodel effectiveness,\ndetection rates and\noperational metrics.'),it('Adapt models','Retrain and refine\nmodels with new data.'),it('Integrate new data','Add data sources\nand features.'),it('Ensure compliance','Update governance\nand model controls.')]};
  if(/co-creation/i.test(T)) return {type:'bullets',title:T,points:['Prioritizing solutions that address your challenges.','Delivering value in short cycles.','Maintaining open communication.','Leveraging proven methods and accelerators.']};
  if(/architecture/i.test(T)) return {type:'diagram',title:T,design:'P66_ARCH_FLOW',columns:[{label:'HSBC data sources',items:[{title:'Transaction data',text:'Card and account events'},{title:'Customer data',text:'Profiles'}]},{label:'Google Cloud',items:[{title:'BigQuery',text:'Data'},{title:'Vertex AI',text:'Models'}]},{label:'HSBC operations',items:[{title:'Case management',text:'Alerts'},{title:'Fraud analysts',text:'Feedback'}]}],links:['Streaming','Alerts']};
  if(/expert team/i.test(T)) return {type:'team',title:T,lead:'We combine expertise with clear governance.',teams:[{name:'66degrees team',roles:[{title:'Project lead',text:'Delivery'},{title:'Data scientists',text:'Models'}]},{name:'HSBC team',roles:[{title:'Business sponsor',text:'Alignment'},{title:'Fraud SMEs',text:'Validation'}]}],governance:{title:'Joint Steering Committee',text:'Strategic oversight and decisions.'}};
  if(/key performance/i.test(T)) return {type:'stats',title:T,items:[{value:'2-4x',label:'Target: more true alerts'},{value:'75%',label:'Target: faster investigations'},{value:'80%',label:'Target: shorter lookback'}]};
  if(ty==='comparison') return {type:'comparison',title:T,left:{label:'Current state',points:['High false positives','Lengthy investigations','Reactive detection']},right:{label:'With AI',points:['Fewer false positives','Faster investigations','Proactive detection']}};
  if(ty==='table') return {type:'table',title:T,columns:['Area','In scope','Out of scope'],rows:[['Business unit','Retail Banking','Commercial Banking'],['Functions','Fraud detection','KYC onboarding'],['Geography','UK pilot','Global rollout']]};
  if(ty==='process') return {type:'process',title:T,lead:'How it works.',items:[it('Ingest','Transactions are streamed in real time into Google Cloud.'),it('Enrich','Profiles and history are added from BigQuery.'),it('Score','Vertex AI models give each transaction a risk score.'),it('Alert','High-risk transactions go to the fraud teams.')]};
  if(ty==='stats') return {type:'stats',title:T,items:[{value:'20%',label:'a'},{value:'30%',label:'b'},{value:'15%',label:'c'}]};
  return {type:'cards',title:T,lead:'Lead for '+T+'.',items:[it('First point','A sentence that explains the first point in about twelve words here.'),it('Second point','A sentence that explains the second point in about twelve words here.'),it('Third point','A sentence that explains the third point in about twelve words here.')]};
}
function geminiMock(t){
   if(/Who is the CLIENT/.test(t)) return {client:'HSBC',domain:'hsbc.com',confident:true};
   if(/Plan the OUTLINE/.test(t)){return JSON.parse(JSON.stringify(OUTLINE));}
   if(/Write exactly \d+ NEW slides/.test(t)){
     // deck 20 behaviour: Gemini gives back fewer slides than asked (only the risk slide)
     return SHORT ? {slides:[{type:'comparison',title:'Key delivery risks and how we mitigate them',brief:'risks',section:4}]} :
       {slides:Array.from({length:+t.match(/Write exactly (\d+)/)[1]},(x,i)=>({type:'cards',title:'New topic number '+(i+1),brief:'x',section:2}))};}
   if(/THIS IS PART OF A LONG DECK/.test(t)){
     const lines=t.split('\n').filter(l=>/^\d+\. type "/.test(l));
     return {slides:lines.map(l=>{const m=l.match(/type "([^"]*)" \| title "([^"]*)"/);return Object.assign(content({type:m[1],title:m[2]}),{notes:'Notes.'});})};}
   if(/look empty/.test(t)){const list=JSON.parse(t.split('\n').pop());return {fixes:list.map(x=>({id:x.id,add:x.kind==='roadmap'?[{periods:['Month 1','Month 2','Month 3','Month 4','Month 5','Month 6'],lanes:[{name:'Discovery and foundation',bars:[{start:1,end:2,label:'Workshops and setup'}]},{name:'Data and features',bars:[{start:2,end:4,label:'BigQuery pipelines'}]},{name:'Models and pilot',bars:[{start:4,end:6,label:'Vertex AI pilot'}]}]}]:x.kind==='kpivalues'?x.kpis.map(k=>/\d/.test(k.value)?k.value:'+15%'):x.kind==='governance'?[{title:'Joint steering committee',text:'Sponsors from both sides meet monthly to review progress and decide priorities.'}]:x.kind==='lanes'?[{name:'Data platform',bars:[{start:2,end:6,label:'BigQuery pipelines'}]},{name:'Forecasting models',bars:[{start:4,end:8,label:'Vertex AI Forecast'}]},{name:'Change and adoption',bars:[{start:6,end:9,label:'Planner training'}]}].slice(0,x.add):x.kind==='kpis'?[{value:'25%',label:'Target: forecast accuracy',text:'Improve accuracy of the weekly forecast.'},{value:'10%',label:'Target: lower stock-outs',text:'Fewer missed sales in top products.'},{value:'2 days',label:'Target: planning cycle',text:'From a week to two days.'}].slice(0,x.add):Array.from({length:x.add},(y,k)=>({title:'Added point '+k,text:'A sentence that adds the missing content to this slide in about fifteen words.'}))}))};}
   if(/name risks without saying how they are handled/.test(t)){const list=JSON.parse(t.split('\n').pop());return {slides:list.map(x=>({id:x.id,risks:[{risk:'Data quality gaps',impact:'Forecasts miss demand shifts when source data is incomplete.',mitigations:['Profile and cleanse data in month one','Data owners sign off each source']},{risk:'Low planner adoption',impact:'Planners keep spreadsheets and ignore model recommendations.',mitigations:['Champions in each region','Training before go-live']},{risk:'Integration delays',impact:'The pilot slips if planning systems cannot be reached early.',mitigations:['Agree system access in week one','Weekly integration checkpoint']}]}))};}
   if(/show an architecture/.test(t)){const list=JSON.parse(t.split('\n').pop());return {slides:list.map(x=>({id:x.id,columns:[{label:'Data sources',items:[{title:'Sales and POS',text:'Daily sales by store'},{title:'Inventory systems',text:'Stock by warehouse'},{title:'Supplier data',text:'Lead times and capacity'}]},{label:'Google Cloud platform',items:[{title:'BigQuery',text:'Unified planning data'},{title:'Vertex AI Forecast',text:'Demand forecasts'}]},{label:'Planning teams',items:[{title:'Gemini summaries',text:'Plain-language insights'},{title:'Planning dashboards',text:'Looker for planners'}]}],links:['Daily loads','Forecasts and insights'],takeaway:'One platform from raw data to planning decisions'}))};}
   return {};}

// ---- designs
function engine() {
  const g = { console, Math, JSON, String, Array, Object, Number, Date };
  vm.createContext(g);
  vm.runInContext(read("src/Engine.gs") + ";this.ENGINE=ENGINE;", g);
  fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^Proposal(Assets|Designs_\d_\w+)\.gs$/.test(f)).sort().forEach((f) => vm.runInContext(read("src/" + f), g));
  vm.runInContext(read("src/Reference.gs"), g);
  return g;
}
const lay = (g, sp) => g.ENGINE.render({ slides: [Object.assign({ deckLibrary: "proposal" }, sp)] }, { dateLabel: "x" })[0];
const can = (g, sp, tag) => g.ENGINE.canDraw(Object.assign({ deckLibrary: "proposal" }, sp, { reference: { tag } }));
const maxBottom = (sl) => Math.max(...sl.els.filter((e) => e.y > 70 && e.t !== "image" && e.t !== "line").map((e) => e.y + (e.h || e.size || 0)));

const PROMPT="Create a proposal deck for HSBC: AI-powered fraud detection and transaction monitoring for its retail banking business, built on Google Cloud (BigQuery, Vertex AI, Gemini). Cover: understanding HSBC's needs, our approach and solution architecture, data foundation and security, delivery plan and roadmap, team and governance, risks, KPIs.";
const quiet = () => loadAll(() => ({}));
function longDeck(n, seed) {
  const sb = loadAll((t) => geminiMock(t), seed || 3);
  let r = sb.generatePresentation({ mode: "create", presentationType: "Proposal Deck", slideCount: n, clientName: "HSBC", clientDomain: "hsbc.com", prompt: PROMPT, runId: "RUN" + n });
  for (let k = 0; r && r.continue && k < 30; k++) r = sb.continueDeckGeneration(r.runId);
  return sb.drawn;
}

test("HSBC long deck: exactly 30 slides; no empty workstream dividers; no slide that only repeats one sentence", () => {
  const d = longDeck(30);
  assert.equal(d.length, 30);
  d.forEach((s, i) => {
    if (s.type === "section" && s.level === 2) {
      const next = d.slice(i + 1, i + 3);
      assert.ok(next.length === 2 && next.every((x) => x.type !== "section"), "workstream " + s.title + " has its slides");
    }
  });
  assert.ok(!d.some((s) => s.type === "statement" && (s.text || s.lead) && String(s.text || s.lead) === String(s.statement)));
  const meth = d.find((s) => /methodology/i.test(s.title));
  assert.ok(meth && meth.type !== "statement" && (meth.items || []).length >= 3, "the methodology shows its steps");
});

test("HSBC long deck: roadmap Gantt, risks with mitigations, cycle for continuous improvement, team with governance", () => {
  const d = longDeck(30);
  const road = d.find((s) => /delivery plan/i.test(s.title));
  assert.equal(road.reference.tag, "P66_GANTT");
  assert.ok(road.lanes.length >= 3);
  const risk = d.find((s) => /risks/i.test(s.title));
  assert.equal(risk.reference.tag, "P66_IMPACT_MITIGATION");
  assert.ok(risk.items.every((it) => it.points.length));
  assert.equal(d.find((s) => /continuous improvement/i.test(s.title)).reference.tag, "P66_CYCLE");
  const team = d.find((s) => /expert team/i.test(s.title));
  assert.equal(team.reference.tag, "P66_TEAM_STRUCTURE");
  assert.equal(team.governance.title, "Joint steering committee");
  assert.equal(d[0].subtitle, "A proposal from 66degrees");
});

test("HSBC long deck: one 'how we work' topic, product explainers at most twice, at most two before/after comparisons", () => {
  const d = longDeck(30);
  assert.ok(!d.some((s) => /co-creation/i.test(s.title)));
  assert.ok(d.filter((s) => /^(Google Cloud Platform capabilities|Google Cloud scalability|Gemini and Vertex AI)/i.test(s.title)).length <= 2);
  assert.ok(d.filter((s) => s.type === "comparison" && !/risk/i.test(s.title)).length <= 2);
});

test("the deck always has the slides asked for (21, 25, 40)", () => {
  [21, 25, 40].forEach((n) => assert.equal(longDeck(n).length, n));
});

test("workstream dividers: kept with two or more slides, dropped when empty or alone", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var ws = function (t) { return { type: 'section', level: 2, title: t }; }, c = function (t) { return { type: 'cards', title: t }; };
    var secs = [{ title: 'A', list: [c('a1'), ws('Tech'), c('t1'), c('t2'), ws('Change'), c('x1'), c('x2')] },
      { title: 'B', list: [c('b1'), ws('Empty 1'), ws('Empty 2')] }, { title: 'C', list: [ws('Alone'), c('c1'), c('c2')] }];
    var n = dropEmptyWorkstreams_(secs);
    return JSON.stringify({ n: n, a: secs[0].list.map(function (o) { return o.title; }), b: secs[1].list.length, c: secs[2].list.length });
  })()`));
  assert.equal(R.n, 3);
  assert.deepEqual(R.a, ["a1", "Tech", "t1", "t2", "Change", "x1", "x2"]);
  assert.equal(R.b, 1);
  assert.equal(R.c, 2);
});

test("statements never repeat a sentence; the statement fallback uses the slide's message", () => {
  const g = engine();
  const sl = lay(g, { type: "statement", title: "Methodology", statement: "A structured methodology ensures delivery.", lead: "A structured methodology ensures delivery.", reference: { tag: "P66_STATEMENT_BOX" } });
  const texts = sl.els.filter((e) => e.t === "text").map((e) => e.text);
  assert.equal(texts.filter((t) => t === "A structured methodology ensures delivery.").length, 1);
  const sb = quiet();
  const alt = JSON.parse(ev(sb, "JSON.stringify(proposalAlternatives_({ type: 'cards', title: 'Our methodology delivers results', lead: 'Four steps.', items: [] }).filter(function (a) { return a.type === 'statement'; })[0])"));
  assert.equal(alt.statement, "Our methodology delivers results");
  assert.equal(alt.text, "Four steps.");
});

test("a long-deck slide keeps the planned kind: a bare statement becomes the steps, a roadmap stays a timeline", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var a = { type: 'statement', title: 'Methodology', statement: 'One sentence.', points: ['Define: goals and scope', 'Design: the solution', 'Plan: the timeline'] };
    keepOutlineType_(a, { type: 'process' });
    var b = { type: 'process', title: 'Delivery plan', items: [{ title: 'Phase 1' }, { title: 'Phase 2' }, { title: 'Phase 3' }] };
    keepOutlineType_(b, { type: 'timeline' });
    var slides = [{ type: 'process', title: 'Delivery plan and phases', items: [{ title: 'Discover' }, { title: 'Build' }, { title: 'Pilot' }] }];
    var conv = roadmapAsTimeline_(slides, 'Cover: delivery plan and roadmap');
    var none = roadmapAsTimeline_([{ type: 'process', title: 'Delivery plan' }], 'Cover: delivery plan');
    return JSON.stringify({ a: a, b: b.type, bd: b.design, conv: conv, s: slides[0].type, none: none });
  })()`));
  assert.equal(R.a.type, "process");
  assert.deepEqual(R.a.items.map((i) => i.title), ["Define", "Design", "Plan"]);
  assert.equal(R.a.lead, "One sentence.");
  assert.equal(R.b, "timeline");
  assert.equal(R.bd, "P66_GANTT");
  assert.equal(R.conv, true);
  assert.equal(R.s, "timeline");
  assert.equal(R.none, false);
});

test("risks: mitigations in a note or in points are shown; more than three risks become the risk table", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var ctx = { apiKey: 'k', brand: DEFAULT_BRAND, presentationType: 'Proposal Deck', log: [], userPrompt: 'x' };
    var a = { type: 'process', title: 'Key risks', items: [{ title: 'Data gaps', text: 'Forecasts miss demand.', note: 'Mitigation: profile data in month one' }, { title: 'Bias', text: 'Unfair outcomes.', note: 'Bias tests before go-live' }] };
    var b = { type: 'cards', title: 'Risks and mitigations', items: ['A', 'B', 'C', 'D'].map(function (x) { return { title: 'Risk ' + x, text: 'Impact ' + x, mitigation: 'Action ' + x }; }) };
    riskSlidesWithMitigations_([a, b], ctx);
    return JSON.stringify({ a: a, b: b });
  })()`));
  assert.equal(R.a.design, "P66_IMPACT_MITIGATION");
  assert.deepEqual(R.a.items[0].points, ["profile data in month one"]);
  assert.equal(R.b.type, "table");
  assert.deepEqual(R.b.columns, ["Risk", "Impact", "Mitigation"]);
  assert.deepEqual(R.b.rows[3], ["Risk D", "Impact D", "Action D"]);
});

test("a loop is a cycle (never layers); the cycle ring shrinks so its labels fit", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var sp = { type: 'process', deckLibrary: 'proposal', title: 'Achieving long-term value and continuous improvement', lead: 'Our approach keeps the models current.',
      items: [{ title: 'Monitor performance', text: 'Continuously track AI model effectiveness, detection rates and operational metrics.' }, { title: 'Adapt models', text: 'Retrain and refine models with new data.' },
        { title: 'Integrate new data', text: 'Add data sources and features.' }, { title: 'Ensure compliance', text: 'Update governance and model controls.' }] };
    var ok = proposalCycle_(sp, {});
    var iso = drawableDesigns_('diagram', 4, { deckLibrary: 'proposal', title: 'An integrated loop for detection', design: 'P66_ISO_CALLOUTS', items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }, { title: 'd' }] }).map(function (d) { return d.tag; });
    return JSON.stringify({ ok: ok, type: sp.type, design: sp.design, iso: iso });
  })()`));
  assert.equal(R.ok, true);
  assert.equal(R.type, "diagram");
  assert.equal(R.design, "P66_CYCLE");
  assert.ok(!R.iso.includes("P66_ISO_CALLOUTS"));
});

test("no line breaks inside texts; 'AI-powered' stays in the notes; sentence case for short subtitles", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `JSON.stringify([ENGINE.cleanText('Continuously track AI\\nmodel effectiveness,\\n detection rates'), presenterNotes_({ type: 'comparison', title: 'AI-powered detection vs. traditional rules' }),
    headingCase_('A Proposal from 66degrees'), headingCase_('Joint Steering Committee')])`));
  assert.equal(R[0], "Continuously track AI model effectiveness, detection rates");
  assert.match(R[1], /^This slide covers AI-powered detection/);
  assert.deepEqual(R.slice(2), ["A proposal from 66degrees", "Joint steering committee"]);
});

test("a stock image is used once per deck, across all parts of a long deck", () => {
  const sb = quiet();
  const R = ev(sb, `(function () {
    var st = { userPrompt: 'x', presentationType: 'Proposal Deck', department: 'Other', n: 30, chooser: { used: {} } };
    var ctx1 = {}; prepareLongCtx_(ctx1, st); ctx1.stockUsed['IMG1'] = 1;
    var saved = JSON.parse(JSON.stringify(st));
    var ctx2 = {}; prepareLongCtx_(ctx2, saved);
    return ctx2.stockUsed['IMG1'] === 1;
  })()`);
  assert.equal(R, true);
});

test("a comparison is never reduced to one statement when its design is taken", () => {
  const sb = quiet();
  const R = ev(sb, `(function () {
    var sp = { type: 'comparison', deckLibrary: 'proposal', title: 'AI-powered detection vs. traditional rules', left: { label: 'Current state', points: ['High false positives', 'Slow investigations'] }, right: { label: 'With AI', points: ['Fewer false positives', 'Faster investigations'] } };
    var used = {}; drawableDesigns_('comparison', 2, sp).forEach(function (d) { used[d.tag] = 1; });
    proposalCoerce_(sp, { log: [] }, used);
    return sp.type;
  })()`);
  assert.notEqual(R, "statement");
});

test("version label is V.1_50", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_ = '66° Deck Agent V\.1_(5[0-9])'/);
});
