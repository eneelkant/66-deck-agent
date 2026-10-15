"use strict";

// V.1_51 (Airbus 30-slide proposal audit, deck 23) - Gemini plans the story first (storyline, one message and the points
// of each slide, written with Gemini Pro), then writes each part from that plan with a short list of designs per slide and
// what earlier slides already said; the whole deck appears in the presentation at once (built in a hidden working copy);
// Proposal Decks of 10+ slides use the same planned path; plus the deck 23 fixes: the rising curve only for a journey
// (never data sources), labels never overlap; columns with one text are sized to it; a roadmap with timings is a Gantt;
// one plan + one roadmap; product explainers by "BigQuery: ..." titles; one challenges topic; the team slide reads
// members; risk impacts in one sentence and actions without ".;"; no "future growth" filler; a headline figure once per
// deck; KPI labels with a direction.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ORDER = JSON.parse(read(".clasp.json")).filePushOrder.filter((f) => /\.gs$/.test(f));

// The whole add-on in one sandbox, with Slides / Drive / Gemini mocked
function loadAll(gemini, seed, clock) {
  let sd = seed || 1;
  const M = Object.create(Math); M.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const slides = [], drawn = [], props = {}, uprops = {}, files = {};
  let sid = 0; const mkSlide = () => { const id = "s" + (sid++); const o = { getObjectId: () => id, remove() { const j = slides.indexOf(o); if (j >= 0) slides.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; return o; };
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n",
    insertSlide(i, s) { const c = mkSlide(); slides.splice(i, 0, c); return c; }, getSlideById: (x) => slides.find((q) => q.getObjectId() === x) || null };
  // V.1_51: long proposal decks are drawn in a hidden working copy and inserted into the presentation at the end
  const works = {};
  const mkWork = (name) => { const ws = []; const id = "W" + Object.keys(works).length; let k = 0;
    const mk = () => { const s = { getObjectId: () => s._id, remove() { const j = ws.indexOf(s); if (j >= 0) ws.splice(j, 1); }, getPageElements: () => [], getBackground: () => ({ setSolidFill() {} }) }; s._id = id + "_" + (k++); return s; };
    const w = { name, getSlides: () => ws, getId: () => id, getPageWidth: () => 720, getPageHeight: () => 405, saveAndClose() {},
      appendSlide() { const s = mk(); ws.push(s); return s; }, getSlideById: (x) => ws.find((q) => q.getObjectId() === x) || null };
    ws.push(mk()); works[id] = w; return w; };
  const RealDate = Date;
  const FD = class extends RealDate { static now() { return RealDate.now() + (clock ? clock.off : 0); } };
  const sb = { console, Math: M, JSON, Date: clock ? FD : Date, Logger: { log() {} },
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
  sb.pres = pres;
  sb.works = works;
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

const SHORT = 1;
const engineCtx = () => { const sb = quiet(); return sb; };
const prompts = [];
function runDeck(n, opts) {
  opts = opts || {};
  const clock = opts.slowMs ? { off: 0 } : null;
  const sb = loadAll((t) => { prompts.push(t); if (clock && /THIS IS PART OF A LONG DECK/.test(t)) clock.off += opts.slowMs; return geminiMock(t); }, opts.seed || 3, clock);
  const sizes = [];
  let r = sb.generatePresentation({ mode: "create", presentationType: "Proposal Deck", slideCount: n, clientName: "HSBC", clientDomain: "hsbc.com", prompt: opts.prompt || PROMPT, runId: "R" + n });
  for (let k = 0; r && r.continue && k < 30; k++) { sizes.push(sb.pres.getSlides().length); if (clock) clock.off = 0; r = sb.continueDeckGeneration(r.runId); }
  sizes.push(sb.pres.getSlides().length);
  return { sb, sizes, r };
}

test("version label is V.1_51 or later", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(5[1-9])'/);
});

test("the whole deck appears at once: the presentation stays empty until every part is drawn, then gets all slides", () => {
  const { sb, sizes } = runDeck(30, { slowMs: 140000 });
  assert.ok(sizes.length >= 3, "the deck was built over several runs: " + sizes.join(","));
  assert.ok(sizes.slice(0, -1).every((x) => x === 0), "nothing in the presentation before the end: " + sizes.join(","));
  assert.equal(sizes[sizes.length - 1], 30);
  assert.equal(sb.drawn.length, 30);
  assert.equal(Object.keys(sb.works).length, 1, "one hidden working copy");
});

test("a single run also inserts the whole deck in one go; only one SlidesApp.create in Code.gs, inside the helpers", () => {
  const { sb, sizes } = runDeck(25);
  assert.deepEqual(sizes, [25]);
  const code = read("src/Code.gs");
  assert.equal((code.match(/SlidesApp\.create\(/g) || []).length, 1);
  assert.match(code, /function newWorkingPresentation_\(name\) \{\s*return SlidesApp\.create\(name\);/);
  assert.match(code, /target\.insertSlide\(target\.getSlides\(\)\.length, slides\[st\.assembled\]\)/);
});

test("Proposal Decks of 10-24 slides use the planned outline path with fewer sections and keep team, risks and KPIs", () => {
  prompts.length = 0;
  const { sb } = runDeck(15);
  assert.ok(prompts.some((t) => /Plan the OUTLINE/.test(t)), "outline planned");
  assert.ok(prompts.some((t) => /grouped into 3 sections/.test(t)), "3 sections for 15 slides");
  const d = sb.drawn;
  assert.equal(d.length, 15);
  assert.ok(d.some((s) => s.type === "team"), "team");
  assert.ok(d.some((s) => /risk/i.test(s.title)), "risks");
  assert.ok(d.some((s) => s.type === "stats"), "KPIs");
  assert.ok(!d.some((s) => s.type === "section" && s.level === 2), "no workstream dividers in a short deck");
  prompts.length = 0;
  runDeck(12);
  assert.ok(prompts.some((t) => /grouped into 2 sections/.test(t)), "2 sections for 12 slides");
});

test("the outline is planned with Gemini Pro (Script property OUTLINE_MODEL overrides, 'off' keeps the usual model)", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var seen = [];
    var before = CONFIG.model;
    var a = withModel_(outlineModel_(), function () { seen.push(CONFIG.model); return 1; });
    PropertiesService.getScriptProperties().setProperty('OUTLINE_MODEL', 'off');
    var b = outlineModel_();
    PropertiesService.getScriptProperties().setProperty('OUTLINE_MODEL', 'gemini-2.5-flash');
    var c = outlineModel_();
    return JSON.stringify({ seen: seen, after: CONFIG.model === before, off: b, c: c });
  })()`));
  assert.deepEqual(R.seen, ["gemini-2.5-pro"]);
  assert.equal(R.after, true, "the usual model is restored");
  assert.equal(R.off, "");
  assert.equal(R.c, "gemini-2.5-flash");
  assert.match(read("src/Code.gs"), /withModel_\(libOutline \? outlineModel_\(\) : ''/);
});

test("each part is written from the storyline, with what earlier slides said, a short design list per slide, in a compact prompt", () => {
  prompts.length = 0;
  runDeck(30);
  const parts = prompts.filter((t) => /THIS IS PART OF A LONG DECK/.test(t));
  assert.ok(parts.length >= 3);
  parts.forEach((t) => {
    assert.match(t, /THE STORYLINE OF THE WHOLE DECK/);
    assert.match(t, /designs to choose from/);
    assert.match(t, /THE DESIGNS \(write "design"/);
    assert.ok(t.length < 22000, "prompt size " + t.length);   // V.1_50: about 46,000
  });
  assert.ok(parts.slice(1).every((t) => /ALREADY SAID ON EARLIER SLIDES/.test(t)), "later parts know what was said");
  assert.ok(parts.slice(1).some((t) => /Designs already used on earlier slides/.test(t)));
});

test("design shortlist: only proposal designs that fit the topic; the curve and pyramid never for data sources", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var a = proposalShortlist_({ type: 'process', title: 'Data sources for the models', brief: 'seven data sources' }, {});
    var b = proposalShortlist_({ type: 'process', title: 'The adoption journey', brief: 'from pilot to network' }, {});
    return JSON.stringify({ a: a.map(function (x) { return x.tag || x; }), b: b.map(function (x) { return x.tag || x; }) });
  })()`));
  assert.ok(R.a.length > 0 && R.a.length <= 8);
  assert.ok(!R.a.some((t) => /P66_CURVE|P66_PYRAMID/.test(t)), R.a.join(","));
  assert.ok(R.b.some((t) => /P66_CURVE/.test(t)), R.b.join(","));
});

test("deck 23 slide 18: the curve refuses labels that would overlap; slide 23: one-text columns are sized to the text", () => {
  const g = engine();
  const src = ["Flight data recorders", "Maintenance logs", "Engine health monitoring", "Parts inventory", "Weather data", "Airline schedules", "Supplier quality reports"];
  const curveSrc = { type: "process", title: "The adoption journey", items: src.map((t) => ({ title: t, text: "Daily feeds into BigQuery for the maintenance models and the dashboards." })) };
  assert.equal(can(g, curveSrc, "P66_CURVE"), false);
  const adopt = { type: "process", title: "The adoption journey", items: ["Pilot one fleet", "Engineer trust", "Two hubs live", "Planning in the loop", "Network rollout"].map((t) => ({ title: t })), text: "Each stage starts when the previous one meets its target." };
  assert.equal(can(g, adopt, "P66_CURVE"), true);
  assert.equal(vm.runInContext('DESIGN_TOPICS_.P66_CURVE.test("Comprehensive data foundation for AI Seven data sources feed the models")', g), false);
  assert.equal(vm.runInContext('HARD_TOPIC_GATES_.P66_CURVE', g), true);
  assert.equal(vm.runInContext('DESIGN_TOPICS_.P66_PYRAMID.test("High-level solution architecture overview")', g), false);
  const cols = { type: "process", title: "Securing data", reference: { tag: "P66_PARADIGM_COLUMNS" }, takeaway: "One security model",
    items: ["Encryption", "Access control", "Data residency", "Monitoring", "Compliance"].map((t) => ({ title: t, points: ["One short sentence about " + t.toLowerCase() + " on Google Cloud."] })) };
  const sl = lay(g, cols);
  const boxes = sl.els.filter((e) => e.t === "roundrect" && e.fill === "#FFFDF9" || (e.t === "roundrect" && e.line && e.h > 60));
  assert.ok(boxes.length >= 5);
  assert.ok(Math.max(...boxes.map((b) => b.h)) < 150, "boxes sized to their text: " + boxes.map((b) => Math.round(b.h)).join(","));
});

test("deck 23 slide 21: a roadmap with timings becomes a Gantt (M1-M12 when long); other timings still get Gemini lanes", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var a = { type: 'timeline', items: [{ title: 'Discovery', timing: 'Months 1-2' }, { title: 'Data foundation', timing: 'Months 2-4' }, { title: 'Pilot', timing: 'Months 4-7' }, { title: 'Scale', timing: 'Months 7-12' }] };
    var ok = ganttFromTimedItems_(a);
    var q = { type: 'timeline', items: [{ title: 'Pilot', text: 'Q1-Q2: pilot' }, { title: 'Expand', text: 'Q3' }, { title: 'Run', text: 'Q4' }] };
    ganttFromTimedItems_(q);
    var w = { type: 'timeline', items: [{ title: 'A', date: 'Weeks 1-6' }, { title: 'B', date: 'Weeks 6-14' }, { title: 'C', date: 'Weeks 14-24' }] };
    ganttFromTimedItems_(w);
    var none = { type: 'timeline', items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
    return JSON.stringify({ ok: ok, a: a, q: q, w: w, none: ganttFromTimedItems_(none) });
  })()`));
  assert.equal(R.ok, true);
  assert.equal(R.a.periods.length, 12);
  assert.equal(R.a.periods[9], "M10");
  assert.deepEqual(R.a.lanes.map((l) => [l.name, l.bars[0].start, l.bars[0].end]), [["Discovery", 1, 2], ["Data foundation", 2, 4], ["Pilot", 4, 7], ["Scale", 7, 12]]);
  assert.equal(R.a.design, "P66_GANTT");
  assert.deepEqual(R.q.periods, ["Q1", "Q2", "Q3", "Q4"]);
  assert.deepEqual(R.w.periods, ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"]);
  assert.equal(R.none, false);
});

const D23 = [["cards", "The expanding aviation services market"], ["cards", "Airbus's strategic maintenance imperatives"], ["cards", "The business case for predictive maintenance"],
  ["cards", "Overcoming current maintenance challenges"], ["cards", "AI and generative AI transform MRO"], ["cards", "Addressing Airbus's operational maintenance pain points"],
  ["process", "Predictive maintenance framework"], ["diagram", "AI-powered predictive maintenance architecture"], ["cards", "Google Cloud: the optimal platform choice"],
  ["cards", "BigQuery: unifying diverse fleet data"], ["cards", "Vertex AI: building intelligent predictive models"], ["cards", "Gemini: augmenting maintenance team capabilities"],
  ["cards", "Comprehensive data foundation for AI"], ["cards", "Robust data governance and compliance"], ["process", "Phased implementation approach"],
  ["timeline", "Strategic project roadmap and milestones"], ["cards", "Ensuring smooth adoption: change management"], ["team", "Expert team and collaborative governance"],
  ["table", "Proactive risk management and mitigation"], ["stats", "Measuring success: key performance indicators"], ["cards", "Sustained innovation and future growth"]].map(([type, title]) => ({ type, title }));
const AIRBUS = "Create a proposal deck for Airbus: AI predictive maintenance on Google Cloud. Cover: needs, approach, architecture, data, delivery plan and roadmap, team and governance, risks, KPIs.";

test("deck 23 outline: product explainers at most twice, one challenges topic pair, one plan + the roadmap, no 'future growth' filler", () => {
  const sb = quiet();
  sb.__d = D23; sb.__p = AIRBUS;
  const out = JSON.parse(ev(sb, "JSON.stringify(outlineChecks_(this.__d, this.__p, 30))"));
  const kept = D23.filter((x, i) => out.indexOf(i) === -1).map((x) => x.title);
  const has = (re) => kept.filter((t) => re.test(t)).length;
  assert.equal(has(/^(Google Cloud|BigQuery|Vertex AI|Gemini):/), 2, kept.join(" | "));
  assert.equal(has(/business case|challenges|pain points/i), 2);
  assert.ok(!kept.includes("Phased implementation approach"));
  assert.ok(kept.includes("Predictive maintenance framework") && kept.includes("Strategic project roadmap and milestones"));
  assert.ok(!kept.includes("Sustained innovation and future growth"));
  // the slide titled "roadmap" wins over an earlier phased plan
  sb.__r = [{ type: "timeline", title: "Phased delivery over four quarters" }, { type: "timeline", title: "Strategic project roadmap and milestones" }];
  assert.deepEqual(JSON.parse(ev(sb, "JSON.stringify(outlineChecks_(this.__r, 'a roadmap', 30))")), [0]);
});

test("deck 23 slide 25: team lanes from members when roles is empty; a Proposal team slide always gets its governance box", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var sp = { type: 'team', title: 'Expert team and collaborative governance', teams: [{ name: 'Airbus team', roles: [], members: ['Program sponsor, Project manager, Maintenance engineers'] }, { name: '66degrees team', roles: [], stakeholders: ['Engagement lead'], specialists: ['Data engineers'] }] };
    proposalTeamShape_(sp);
    return JSON.stringify(sp.teams.map(function (t) { return t.roles; }));
  })()`));
  assert.deepEqual(R, [["Program sponsor", "Project manager", "Maintenance engineers"], ["Engagement lead", "Data engineers"]]);
  const g = engine();
  assert.equal(can(g, { type: "team", title: "Team", teams: [{ name: "A", roles: [], members: ["x", "y"] }, { name: "B", roles: [], members: ["z"] }] }, "P66_TEAM_STRUCTURE"), true);
  assert.match(read("src/Code.gs"), /!sp\.governance && \(proposalFill \|\| \/governance/);
});

test("deck 23 slide 26: risk impacts are one sentence and mitigations are joined without '.;'", () => {
  const sb = loadAll(() => ({}));
  const R = JSON.parse(ev(sb, `(function () {
    var ctx = { presentationType: 'Proposal Deck', apiKey: 'k', log: [], brand: { name: '66degrees' } };
    var a = [{ type: 'cards', title: 'Key risks and mitigation', items: [
      { title: 'Data quality gaps', text: 'Incomplete sensor data weakens predictions. Engineers lose trust. Planning suffers.', mitigation: 'Profile data in month one.; Owners sign off each source.' },
      { title: 'Low adoption', text: 'Engineers ignore alerts. Value is delayed.', points: ['Champions at each hub.', 'Training before go-live;'] },
      { title: 'Integration delays', text: 'The pilot slips.', points: ['Agree access in week one.'] }] }];
    riskSlidesWithMitigations_(a, ctx);
    var t = [{ type: 'table', title: 'Risks and mitigations', items: [1, 2, 3, 4].map(function (k) { return { title: 'Risk ' + k, text: 'Impact one. Impact two.', mitigation: 'Act one.; Act two.' }; }) }];
    riskSlidesWithMitigations_(t, ctx);
    return JSON.stringify({ a: a[0], t: t[0] });
  })()`));
  assert.equal(R.a.design, "P66_IMPACT_MITIGATION");
  assert.equal(R.a.items[0].text, "Incomplete sensor data weakens predictions.");
  assert.deepEqual(R.a.items[0].points, ["Profile data in month one", "Owners sign off each source"]);
  assert.deepEqual(R.a.items[1].points, ["Champions at each hub", "Training before go-live"]);
  assert.deepEqual(R.t.rows[0], ["Risk 1", "Impact one.", "Act one; Act two"]);
  assert.ok(!JSON.stringify(R).includes(".;"));
});

test("deck 23 slides 5 and 28: a headline figure already shown (even in a card heading) is not shown again", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var used = [];
    var a = [{ type: 'cards', title: 'x', items: [{ title: 'Target: $10B savings by 2044', text: 'Cost reductions.' }, { title: 'b', text: 'c' }] }];
    dedupeFiguresInText_(a, used); dedupeDeckNumbers_(a, used);
    var b = [{ type: 'stats', title: 'Value', value: '$10B', label: 'Potential savings', design: 'P66_INVESTMENT', items: [{ value: '35%', label: 'a' }, { value: '50%', label: 'b' }, { value: '15%', label: 'Target: c' }] }];
    dedupeDeckNumbers_(b, used);
    return JSON.stringify(b[0]);
  })()`));
  assert.equal(R.value, undefined);
  assert.equal(R.design, undefined);
  assert.equal(R.items.length, 3);
});

test("deck 23 slide 28: KPI labels say which way they go; '(up to)' moves to the value", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var k = { type: 'stats', items: [{ value: '35%', label: 'Increased technician capacity (up to)' }, { value: '15%', label: 'Target: unscheduled maintenance' },
      { value: '20%', label: 'Target: unplanned removals' }, { value: '2 days', label: 'Target: turnaround time' }, { value: '98%', label: 'Target: forecast accuracy' }] };
    proposalKpiLabels_(k);
    return JSON.stringify(k.items);
  })()`));
  assert.deepEqual(R.map((x) => x.value + " | " + x.label), ["Up to 35% | Increased technician capacity", "15% | Target: less unscheduled maintenance",
    "20% | Target: fewer unplanned removals", "2 days | Target: lower turnaround time", "98% | Target: forecast accuracy"]);
});

test("an outline longer than asked keeps every section's core slides; extra sections join a neighbour", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var mk = function (t, ty) { return { type: ty || 'cards', title: t, brief: '' }; };
    var secs = [
      { title: 'Needs', list: [mk("Client's current challenges"), mk('The market landscape'), mk('Strategic objectives'), mk('Before and after AI', 'comparison')] },
      { title: 'Approach', list: [mk('Our methodology', 'process'), mk('Solution architecture', 'diagram'), mk('Product capabilities'), mk('Data foundation', 'process')] },
      { title: 'Plan', list: [mk('Delivery roadmap', 'timeline'), mk('Change management')] },
      { title: 'Team', list: [mk('Team and governance', 'team'), mk('Key risks and mitigations', 'comparison'), mk('Key performance indicators', 'stats')] }];
    fitOutlineToBody_(secs, 3, 15, ${JSON.stringify(PROMPT)});
    return JSON.stringify(secs.map(function (s) { return s.list.map(function (o) { return o.title; }); }));
  })()`));
  const all = [].concat(...R);
  assert.equal(R.length, 3);
  assert.equal(all.length, 15 - 3 - 3);
  ["Team and governance", "Key risks and mitigations", "Key performance indicators", "Delivery roadmap", "Solution architecture"].forEach((t) => assert.ok(all.includes(t), t + " kept: " + all.join(" | ")));
});

test("the 'pilot' word alone no longer makes a slide a phased plan", () => {
  const g = engine();
  assert.equal(vm.runInContext('DESIGN_TOPICS_.P66_PHASE_COLUMNS.test("Success criteria for the pilot")', g), false);
  assert.equal(vm.runInContext('DESIGN_TOPICS_.P66_PHASE_COLUMNS.test("Pilot to scale rollout")', g), true);
});

test("a new presentation's empty first slide goes once the deck is inserted", () => {
  const sb = loadAll((t) => geminiMock(t), 3);
  sb.pres.appendSlide();
  const blank = sb.pres.getSlides()[0].getObjectId();
  let r = sb.generatePresentation({ mode: "create", presentationType: "Proposal Deck", slideCount: 20, clientName: "HSBC", clientDomain: "hsbc.com", prompt: PROMPT, runId: "B20" });
  for (let k = 0; r && r.continue && k < 20; k++) r = sb.continueDeckGeneration(r.runId);
  assert.equal(sb.pres.getSlides().length, 20);
  assert.ok(!sb.pres.getSlides().some((s) => s.getObjectId() === blank));
});
