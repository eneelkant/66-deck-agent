"use strict";

// V.1_48 (Unilever 30-slide proposal audit, deck 21): no markdown asterisks; a risk slide shows each risk with its impact
// and mitigation; a KPI slide keeps its numbers (never on a layer stack); no unrequested 66degrees credentials; a figure is
// shown once (also in text); phases only on a plan; steps written as points can move to other designs; the team slide
// shows the two team lanes and its governance; diagram labels in sentence case; a cover title with the message; a roadmap
// request gets a timeline; one point is a sentence; a wider photo strip; one icon of a kind per slide; the log says why a
// strip kept the pattern.
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
  const pres = { getSlides: () => slides, appendSlide() { const s = mkSlide(); slides.push(s); return s; }, getPageWidth: () => 720, getPageHeight: () => 405, getSelection: () => null, getId: () => "P", getUrl: () => "u", getName: () => "n" };
  const sb = { console, Math: M, JSON, Date, Logger: { log() {} },
    SlidesApp: { getActivePresentation: () => pres, PredefinedLayout: { BLANK: "BLANK" } },
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

const S1="Understanding Unilever's needs",S2='Our approach & solution overview',S3='Technical foundation & implementation',S4='Partnership, impact & future';
const OUTLINE={deck_title:'Proposal deck for Unilever',subtitle:'AI-driven demand sensing & inventory planning for personal care brands',closing_subtitle:'Partnering for a smarter supply chain future',
 sections:[
  {title:S1,description:'Why demand sensing matters now',slides:[
    {type:'cards',title:"Unilever's supply chain imperative"},{type:'table',title:'Current demand sensing challenges'},{type:'cards',title:'Impact of inventory inefficiencies'},
    {type:'stats',title:'The AI opportunity in CPG supply chains'},{type:'process',title:"Unilever's strategic Google Cloud partnership"},{type:'cards',title:'Key objectives for personal care brands'},
    {type:'cards',title:"Understanding Unilever's needs"}]},
  {title:S2,description:'How we work and what we build',slides:[
    {type:'process',title:'Approach to AI transformation'},{type:'diagram',title:'Solution vision: intelligent demand & inventory'},{type:'cards',title:'Leveraging Google Cloud for predictive power'},
    {type:'comparison',title:'Key benefits: enhanced accuracy & efficiency'}]},
  {title:S3,description:'Architecture, data and delivery',slides:[
    {type:'diagram',title:'Solution architecture on Google Cloud'},{type:'table',title:'Robust data foundation with BigQuery'},{type:'process',title:'Advanced AI/ML with Vertex AI'},
    {type:'process',title:'Generative AI for actionable insights (Gemini)'},{type:'process',title:'Phased delivery plan overview'},{type:'table',title:'Key considerations for successful deployment'},
    {type:'cards',title:'Data governance & quality framework'}]},
  {title:S4,description:'Team, risks and results',slides:[
    {type:'team',title:'Expert team & collaborative governance'},{type:'cards',title:'Anticipated risks and mitigation strategies'},{type:'stats',title:'Measuring success: key performance indicators'},
    {type:'cards',title:"Partnering for Unilever's future growth"},{type:'process',title:'Empowering teams: change management & adoption'}]}]};
const it=(t,x,extra)=>Object.assign({title:t,text:x},extra||{});
const pts=(t,p)=>({title:t,points:p});
function content(o){
  const T=o.title, ty=o.type;
  if(/supply chain imperative/i.test(T)) return {type:'cards',title:T,lead:"Unilever's strategy emphasizes an agile and resilient supply chain.",design:'P66_PILLARS',items:[it('Dynamic markets','Rapidly shortening demand cycles require quicker adaptation.',{icon:'idea'}),it('Consumer expectations','On-shelf availability is paramount for brand trust.',{icon:'innovation'}),it('Strategic mandate','Agility and resilience are core to the digital transformation.',{icon:'strategy'})]};
  if(/impact of inventory/i.test(T)) return {type:'cards',title:T,lead:'Misaligned inventory levels cost money.',items:[it('Supply chain errors','AI-driven forecasting can reduce supply chain errors by 20% to 50%. Machine learning finds complex patterns in large datasets.'),it('Lost sales from stockouts','Up to a 65% reduction in lost sales can be achieved. This ensures customers always find desired products.'),it('Excess inventory costs','Autonomous planning can cut overall inventory by up to 20%. This frees up capital.')]};
  if(/AI opportunity/i.test(T)) return {type:'stats',title:T,lead:'AI is a critical enabler in CPG.',design:'P66_KPI_TILES',items:[{value:'70%',label:'Organizations adopting AI forecasting',text:'By 2030.'},{value:'Up to 65%',label:'Reduction in lost sales',text:'From stockouts.'},{value:'$160B+',label:'Additional annual EBITDA',text:'Globally in CPG.'}],takeaway:'AI offers CPG companies a clear path to growth.'};
  if(/key benefits/i.test(T)) return {type:'comparison',title:T,left:{label:'Traditional planning',points:['Reliance on historical data','Manual adjustments','Higher risk of stockouts','Suboptimal allocation']},right:{label:'AI-driven planning',points:['Dynamic pattern detection','Reduced supply chain errors by 20% to 50%','Up to 65% reduction in lost sales from stockouts','Up to 20% reduction in inventory levels']}};
  if(/architecture/i.test(T)) return {type:'diagram',title:T,design:'P66_ARCH_FLOW',columns:[{label:'Unilever Data Sources',items:[{title:'Operational Data',text:'ERP, CRM, POS systems'},{title:'Marketing Campaigns',text:'Promotions'}]},{label:'Google Cloud Platform',items:[{title:'BigQuery',text:'Unified data'},{title:'Vertex AI',text:'Models'}]},{label:'Users And Outcomes',items:[{title:'Looker Studio',text:'Dashboards'},{title:'Feedback Loop',text:'Model improvement'}]}],links:['Data Ingestion','Actionable Insights']};
  if(/vertex ai/i.test(T)) return {type:'process',title:T,lead:'Vertex AI provides a unified platform for building, deploying, and managing machine learning models.',design:'P66_PHASE_COLUMNS',items:[pts('Unified ML platform',['Centralize the ML workflow from data to deployment.']),pts('Custom model training',['AutoML or custom training for demand models.']),pts('Feature engineering',['Turn sales, promotions and external data into features.']),pts('MLOps capabilities',['Automate deployment, monitoring and retraining.'])]};
  if(ty==='timeline') return {type:'timeline',title:T,lead:'A phased roadmap.',design:'P66_GANTT',periods:['Q1','Q2','Q3','Q4'],lanes:[{name:'Data foundation',bars:[{start:1,end:2,label:'BigQuery setup'}]},{name:'Demand models',bars:[{start:2,end:3,label:'Vertex AI pilot'}]},{name:'Scale and adoption',bars:[{start:3,end:4,label:'Roll-out'}]}]};
  if(/phased delivery|change management/i.test(T)) return {type:'process',title:T,lead:'Our structured approach.',design:'P66_PARADIGM_COLUMNS',items:[pts('Stage one',['Establish data connectivity and set up BigQuery.']),pts('Stage two',['Develop initial Vertex AI demand sensing models.']),pts('Stage three',['Integrate validated models into planning systems.']),pts('Stage four',['Deploy Gemini for scenario analysis and scale.'])]};
  if(/expert team/i.test(T)) return {type:'cards',title:T,lead:'We bring deep Google Cloud and AI expertise.',items:[it('Unilever team','Project sponsor, Supply chain lead, IT lead, Data scientists'),it('66degrees team','Program manager, AI/ML architects, Data engineers, Change management specialist')]};
  if(/risks/i.test(T)) return {type:'cards',title:T,lead:'Proactive identification of potential risks.',items:[pts('Technical',['Potential challenges related to data integration or model performance.']),pts('Operational',['Risks associated with workflow disruption or system dependencies.']),pts('Adoption',['Challenges in user acceptance or change management.'])]};
  if(/key performance/i.test(T)) return {type:'stats',title:T,lead:'These metrics will guide our efforts.',items:[{value:'Up to 65%',label:'Reduction in lost sales from stockouts',text:'By minimizing stockouts.'},{value:'Target',label:'Target: inventory holding costs',text:'Optimize inventory levels.'},{value:'Target',label:'Target: forecast accuracy',text:'Enhance the precision of predictions.'}]};
  if(/partnering for/i.test(T)) return {type:'bullets',title:T,points:["**Strategic partnership**: Aligning as Google's Preferred Partner for Enterprise AI Transformation.",'**End-to-end capabilities**: Expertise across data foundation and AI/ML.','**Solution mindset**: Co-creating tailored solutions.','**Proven expertise**: 350+ technical experts, 600+ Google/GCP certifications.']};
  if(ty==='table') return {type:'table',title:T,columns:['Area','Detail'],rows:[['Lagging indicators','Reliance on history limits responsiveness.'],['Manual processes','Slow data collection introduces delays.'],['Limited data scope','External factors are missing.']]};
  if(ty==='stats') return {type:'stats',title:T,items:[{value:'20%',label:'a'},{value:'30%',label:'b'},{value:'15%',label:'c'}]};
  if(ty==='process') return {type:'process',title:T,lead:'How it works.',items:[it('Define','Clarify business goals and scope through workshops with the planners.'),it('Design','Craft technical solutions, data flows and integration points.'),it('Plan','Outline the steps, resources and timeline for delivery.'),it('Value checkpoint','Measure the impact and agree the roadmap with sponsors.')]};
  if(ty==='timeline') return {type:'timeline',title:T,lead:'A phased roadmap.',design:'P66_GANTT',periods:['Q1','Q2','Q3','Q4'],lanes:[{name:'Data foundation',bars:[{start:1,end:2,label:'BigQuery setup'}]},{name:'Demand models',bars:[{start:2,end:3,label:'Vertex AI pilot'}]},{name:'Scale and adoption',bars:[{start:3,end:4,label:'Roll-out'}]}]};
  if(ty==='diagram') return {type:'diagram',title:T,lead:'Lead.',items:[it('Demand sensing','Predict consumer trends and shifts with AI models.'),it('Inventory planning','Streamline stock levels across personal care lines.'),it('Business agility','Adapt quickly to market shifts with better data.')]};
  return {type:'cards',title:T,lead:'Lead for '+T+'.',items:[it('First point','A sentence that explains the first point in about twelve words here.'),it('Second point','A sentence that explains the second point in about twelve words here.'),it('Third point','A sentence that explains the third point in about twelve words here.'),it('Fourth point','A sentence that explains the fourth point in about twelve words here.')]};
}
function geminiMock(t){
   if(/Who is the CLIENT/.test(t)) return {client:'Unilever',domain:'unilever.com',confident:true};
   if(/Plan the OUTLINE/.test(t)){return JSON.parse(JSON.stringify(OUTLINE));}
   if(/Write exactly \d+ NEW slides/.test(t)){
     // deck 20 behaviour: Gemini gives back fewer slides than asked (only the risk slide)
     return SHORT ? {slides:[{type:'comparison',title:'Key delivery risks and how we mitigate them',brief:'risks',section:4}]} :
       {slides:Array.from({length:+t.match(/Write exactly (\d+)/)[1]},(x,i)=>({type:'cards',title:'New topic number '+(i+1),brief:'x',section:2}))};}
   if(/THIS IS PART OF A LONG DECK/.test(t)){
     const lines=t.split('\n').filter(l=>/^\d+\. type "/.test(l));
     return {slides:lines.map(l=>{const m=l.match(/type "([^"]*)" \| title "([^"]*)"/);return Object.assign(content({type:m[1],title:m[2]}),{notes:'Notes.'});})};}
   if(/look empty/.test(t)){const list=JSON.parse(t.split('\n').pop());return {fixes:list.map(x=>({id:x.id,add:x.kind==='kpivalues'?x.kpis.map(k=>/\d/.test(k.value)?k.value:'+15%'):x.kind==='governance'?[{title:'Joint steering committee',text:'Sponsors from both sides meet monthly to review progress and decide priorities.'}]:x.kind==='lanes'?[{name:'Data platform',bars:[{start:2,end:6,label:'BigQuery pipelines'}]},{name:'Forecasting models',bars:[{start:4,end:8,label:'Vertex AI Forecast'}]},{name:'Change and adoption',bars:[{start:6,end:9,label:'Planner training'}]}].slice(0,x.add):x.kind==='kpis'?[{value:'25%',label:'Target: forecast accuracy',text:'Improve accuracy of the weekly forecast.'},{value:'10%',label:'Target: lower stock-outs',text:'Fewer missed sales in top products.'},{value:'2 days',label:'Target: planning cycle',text:'From a week to two days.'}].slice(0,x.add):Array.from({length:x.add},(y,k)=>({title:'Added point '+k,text:'A sentence that adds the missing content to this slide in about fifteen words.'}))}))};}
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

const PROMPT = "Create a proposal deck for Unilever: AI-driven demand sensing and inventory planning for its personal care brands, built on Google Cloud (BigQuery, Vertex AI, Gemini). Cover: understanding Unilever's needs, our approach and solution architecture, data foundation, delivery plan and roadmap, team and governance, risks, KPIs.";
const quiet = () => loadAll(() => ({}));

test("markdown asterisks never reach a slide or its notes", () => {
  const sb = quiet();
  assert.deepEqual(JSON.parse(ev(sb, "JSON.stringify([ENGINE.cleanText('**Strategic partnership**: aligning'), ENGINE.cleanText('a *quick* win, 5 * 3'), ENGINE.cleanText('__x__ y')])")),
    ["Strategic partnership: aligning", "a quick win, 5 * 3", "x y"]);
});

test("a risk slide without mitigations gets them and is drawn as impact + mitigation rows", () => {
  const sb = loadAll((t) => geminiMock(t));
  const R = JSON.parse(ev(sb, `(function () {
    var ctx = { apiKey: 'k', brand: DEFAULT_BRAND, presentationType: 'Proposal Deck', log: [], userPrompt: 'x' };
    var risky = { type: 'cards', title: 'Anticipated risks and mitigation strategies', items: [{ title: 'Technical', points: ['Potential challenges related to data integration.'] }, { title: 'Operational', points: ['Workflow disruption.'] }, { title: 'Adoption', points: ['User acceptance.'] }] };
    var fine = { type: 'cards', title: 'Key risks', items: [{ title: 'Data gaps', text: 'Forecasts miss demand.', points: ['Profile data in month one'] }, { title: 'Adoption', text: 'Planners ignore models.', points: ['Champions in each region'] }] };
    riskSlidesWithMitigations_([risky, fine], ctx);
    return JSON.stringify({ risky: risky, fine: fine.type });
  })()`));
  assert.equal(R.risky.type, "comparison");
  assert.equal(R.risky.design, "P66_IMPACT_MITIGATION");
  assert.ok(R.risky.items.every((it) => it.title && it.text && it.points.length >= 2));
  assert.equal(R.fine, "cards", "a risk slide that already has mitigations is kept");
  const g = engine();
  const sl = lay(g, Object.assign({}, R.risky, { reference: { tag: "P66_IMPACT_MITIGATION" } }));
  assert.ok(sl.els.some((e) => e.t === "text" && /Profile and cleanse/.test(e.text)));
});

test("KPIs keep their numbers: tiles reused rather than a layer stack; targets written for KPIs without a number", () => {
  const sb = loadAll((t) => geminiMock(t));
  const R = JSON.parse(ev(sb, `(function () {
    var ctx = { apiKey: 'k', brand: DEFAULT_BRAND, presentationType: 'Proposal Deck', log: [], userPrompt: 'x', lib: null };
    var kpi = { type: 'stats', deckLibrary: 'proposal', title: 'Measuring success: key performance indicators', items: [{ value: '65%', label: 'Fewer lost sales' }, { value: '20%', label: 'Lower inventory' }, { value: '30%', label: 'Faster planning' }] };
    var coerced = proposalCoerce_(kpi, ctx, { P66_KPI_TILES: 1 });
    var plan = { slides: [{ type: 'stats', title: 'Measuring success: key performance indicators', items: [{ value: '65%', label: 'Fewer lost sales' }, { value: 'Target', label: 'Target: inventory holding costs' }, { value: '', label: 'Forecast accuracy' }] }] };
    plan.slides = plan.slides.map(statsNeedNumbers_);
    fillThinSlides_(plan, ctx);
    var tags = drawableDesigns_('diagram', 3, { deckLibrary: 'proposal', title: 'Measuring success: key performance indicators', design: 'P66_ISO_CALLOUTS', items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] }).map(function (d) { return d.tag; });
    return JSON.stringify({ coerced: coerced, type: kpi.type, filled: plan.slides[0], tags: tags });
  })()`));
  assert.equal(R.coerced, false);
  assert.equal(R.type, "stats");
  assert.equal(R.filled.type, "stats");
  assert.ok(R.filled.items.length === 3 && R.filled.items.every((it) => /\d/.test(it.value)), JSON.stringify(R.filled.items));
  assert.ok(!R.tags.includes("P66_ISO_CALLOUTS") && !R.tags.includes("P66_PYRAMID"));
});

test("no 66degrees credentials unless asked: 'Partnering for ...' leaves the outline; credential lines leave other slides", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var out = outlineChecks_([{ type: 'bullets', title: "Partnering for Unilever's future growth" }, { type: 'cards', title: "Unilever's strategic Google Cloud partnership" }], 'Proposal for Unilever: demand sensing', 30);
    var sl = [{ type: 'bullets', title: 'Why it works', points: ['Strategic fit with your cloud plans.', 'Proven expertise: 350+ technical experts, 600+ Google/GCP certifications.', "Google's Preferred Partner for Enterprise AI.", 'Co-created solutions.'] }];
    stripUnaskedCredentials_(sl, 'Proposal for Unilever: demand sensing');
    var kept = [{ type: 'bullets', title: 'Why 66degrees', points: ['350+ technical experts'] }];
    stripUnaskedCredentials_(kept, 'Include why 66degrees and our credentials');
    return JSON.stringify({ out: out, pts: sl[0].points, kept: kept[0].points.length });
  })()`));
  assert.deepEqual(R.out, [0]);
  assert.deepEqual(R.pts, ["Strategic fit with your cloud plans.", "Co-created solutions."]);
  assert.equal(R.kept, 1);
});

test("a figure is shown once, also in card and bullet text; KPI tiles keep theirs", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var sl = [{ type: 'cards', title: 'Impact', items: [{ title: 'Lost sales', text: 'Up to a 65% reduction in lost sales. Customers find products.' }, { title: 'Errors', text: 'AI reduces errors by 20% to 50%. ML finds patterns.' }] },
      { type: 'stats', title: 'AI opportunity', items: [{ value: '70%', label: 'a' }, { value: '65%', label: 'b' }, { value: '$160B+', label: 'c' }] },
      { type: 'comparison', title: 'Benefits', right: { label: 'New', points: ['Dynamic pattern detection', 'Up to 65% fewer lost sales', 'Faster planning', 'Up to 20% less inventory'] } }];
    dedupeFiguresInText_(sl, []);
    return JSON.stringify({ t0: sl[0].items[0].text, stats: sl[1].items.length, right: sl[2].right.points });
  })()`));
  assert.equal(R.t0, "Customers find products.");
  assert.equal(R.stats, 3);
  assert.ok(!R.right.some((p) => /65%/.test(p)), R.right.join(" | "));
});

test("phases only on a plan: a product slide whose lead says 'deploying' gets no 'Phase 1:' labels", () => {
  const g = engine();
  const sp = { deckLibrary: "proposal", type: "process", title: "Advanced AI/ML with Vertex AI", lead: "Vertex AI provides a unified platform for building, deploying, and managing models.",
    items: ["Unified ML platform", "Custom training", "Feature engineering", "MLOps"].map((t) => ({ title: t, points: ["A point about " + t + "."] })) };
  const tags = vm.runInContext("drawableDesigns_('process', 4, " + JSON.stringify(sp) + ").map(function (d) { return d.tag; })", g);
  assert.ok(!tags.includes("P66_PHASE_COLUMNS"));
  const texts = lay(g, Object.assign({}, sp, { reference: { tag: "P66_PHASE_COLUMNS" } })).els.filter((e) => e.t === "text").map((e) => e.text).join(" | ");
  assert.doesNotMatch(texts, /Phase 1:/);
});

test("steps written as points can move to other designs (their points become the text); a stats item keeps its figure", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var a = proposalAlternatives_({ type: 'process', title: 'Change management', items: [{ title: 'Engage', points: ['Identify stakeholders'] }, { title: 'Train', points: ['Tailored training', 'Office hours'] }, { title: 'Support', points: ['Ongoing support'] }] });
    var cards = a.filter(function (x) { return x.type === 'cards'; })[0];
    var s = proposalAlternatives_({ type: 'stats', title: 'KPIs', items: [{ value: '65%', label: 'Fewer lost sales', text: 'x' }, { value: '20%', label: 'Less stock', text: 'y' }] }).filter(function (x) { return x.type === 'cards'; })[0];
    var st = { type: 'process', deckLibrary: 'proposal', title: 'Change management', items: [{ title: 'A', text: 'a b c d' }, { title: 'B', text: 'e f g h' }, { title: 'C', text: 'i j k l' }] };
    var used = {}; drawableDesigns_('process', 3, st).concat(drawableDesigns_('cards', 3, st)).concat(drawableDesigns_('diagram', 3, st)).forEach(function (d) { used[d.tag] = 1; });
    proposalCoerce_(st, { log: [] }, used);
    return JSON.stringify({ text: cards.items.map(function (i) { return i.text; }), stat: s.items[0].title, kept: st.type });
  })()`));
  assert.deepEqual(R.text, ["Identify stakeholders.", "Tailored training. Office hours.", "Ongoing support."]);
  assert.match(R.stat, /^65% · Fewer lost sales/);
  assert.notEqual(R.kept, "statement", "several points are never reduced to one statement");
});

test("team slide: two cards of roles become the two team lanes; a title with governance gets its governance box", () => {
  const sb = loadAll((t) => geminiMock(t));
  const R = JSON.parse(ev(sb, `(function () {
    var ctx = { apiKey: 'k', brand: DEFAULT_BRAND, presentationType: 'Proposal Deck', log: [], userPrompt: 'x', lib: null };
    var sp = { type: 'cards', title: 'Expert team & collaborative governance', items: [{ title: 'Unilever team', text: 'Project sponsor, Supply chain lead, IT lead, Data scientists' }, { title: '66degrees team', text: 'Program manager, AI/ML architects, Data engineers' }] };
    var team = proposalTeamShape_(sp);
    var plan = { slides: [sp] };
    fillThinSlides_(plan, ctx);
    var p2 = { slides: [JSON.parse(JSON.stringify(sp))] };
    p2.slides[0].deckLibrary = 'proposal';
    chooseDesignsByContent_(p2, ctx);
    return JSON.stringify({ team: team, sp: sp, tag: p2.slides[0].reference && p2.slides[0].reference.tag });
  })()`));
  assert.equal(R.team, true);
  assert.equal(R.sp.type, "team");
  assert.deepEqual(R.sp.teams[0].roles, ["Project sponsor", "Supply chain lead", "IT lead", "Data scientists"]);
  assert.equal(R.sp.governance.title, "Joint steering committee");
  assert.equal(R.tag, "P66_TEAM_STRUCTURE");
});

test("architecture labels and arrow labels in sentence case; a cover title with the message", () => {
  const sb = quiet();
  const R = JSON.parse(ev(sb, `(function () {
    var sp = { type: 'diagram', title: 'Architecture', columns: [{ label: 'Unilever Data Sources', items: [{ title: 'Operational Data', text: 'ERP' }, 'Marketing Campaigns'] }], links: ['Data Ingestion', { label: 'Actionable Insights' }] };
    sentenceCaseHeadings_(sp);
    return JSON.stringify({ c: sp.columns[0], l: sp.links, cv: coverTitle_('Proposal deck for Unilever', 'AI-driven demand sensing & inventory planning for personal care brands', { clientName: 'Unilever' }),
      keep: coverTitle_('Improving demand forecasting at Apple', 'Google Cloud', {}) });
  })()`));
  assert.equal(R.c.label, "Unilever data sources");
  assert.equal(R.c.items[0].title, "Operational data");
  assert.equal(R.c.items[1], "Marketing campaigns");
  assert.deepEqual([R.l[0], R.l[1].label], ["Data ingestion", "Actionable insights"]);
  assert.deepEqual(R.cv, { title: "AI-driven demand sensing & inventory planning for personal care brands", subtitle: "A proposal for Unilever" });
  assert.equal(R.keep.title, "Improving demand forecasting at Apple");
});

test("cards: one point is a sentence (no lone bullet); the pillars photo strip is 160pt wide", () => {
  const g = engine();
  const one = lay(g, { type: "cards", title: "Risks", items: ["Technical", "Operational", "Adoption"].map((t) => ({ title: t, icon: "gear", points: ["Potential challenges related to " + t + "."] })), reference: { tag: "P66_COLUMNS_PHOTO" } });
  assert.ok(!one.els.some((e) => e.t === "ellipse" && e.w < 6 && e.y > 120), "no bullet dots");
  const pil = lay(g, { type: "cards", title: "Imperative", items: ["Markets", "Consumers", "Mandate"].map((t) => ({ title: t, text: "Short text about " + t + "." })), reference: { tag: "P66_PILLARS" } });
  const strip = pil.els.find((e) => (e.t === "rect") && e.x <= 1 && e.y <= 1 && e.h >= 404);
  assert.ok(strip && 720 - strip.w >= 150, "strip " + (strip && 720 - strip.w));
});

test("one icon of a kind per slide: a second light bulb becomes the icon for the item's heading", () => {
  const sb = quiet();
  const placed = [];
  sb.resolveIconRequest_ = (r) => ({ ok: true, iconId: /idea|innovation|strategy/.test(r.concept) ? "mdi:lightbulb-" + r.concept : "lucide:" + r.concept.toLowerCase().split(" ")[0], svg: "<svg/>" });
  sb.insertResolvedIcon_ = (slide, r) => { placed.push(r.iconId); return true; };
  const R = ev(sb, `(function () {
    var ctx = { slideIconFamilies: {} };
    [{ name: 'idea', hint: 'Dynamic markets' }, { name: 'innovation', hint: 'Consumer expectations' }, { name: 'strategy', hint: 'Strategic mandate' }].forEach(function (e) {
      drawEngineIcon({}, Object.assign({ t: 'icon', x: 0, y: 0, size: 16 }, e), 1, ctx);
    });
    return iconFamily_({ iconId: 'mdi:lightbulb-on-outline' }) + '|' + iconFamily_({ iconId: 'lucide:lightbulb' });
  })()`);
  assert.equal(R, "bulb|bulb");
  assert.equal(placed.filter((p) => /lightbulb/.test(p)).length, 1, placed.join(", "));
});

test("long deck of 30 for Unilever: 30 slides; risks with mitigations; team lanes; no credentials slide; timeline; no asterisks", () => {
  const sb = loadAll((t) => geminiMock(t), 5);
  let r = sb.generatePresentation({ mode: "create", presentationType: "Proposal Deck", slideCount: 30, clientName: "Unilever", clientDomain: "unilever.com", prompt: PROMPT, runId: "RUN1" });
  for (let k = 0; r && r.continue && k < 20; k++) r = sb.continueDeckGeneration(r.runId);
  const d = sb.drawn;
  assert.equal(d.length, 30);
  assert.equal(d[0].title, "AI-driven demand sensing & inventory planning for personal care brands");
  const risk = d.find((s) => /risks/i.test(s.title));
  assert.equal(risk.reference.tag, "P66_IMPACT_MITIGATION");
  assert.equal(d.find((s) => /expert team/i.test(s.title)).reference.tag, "P66_TEAM_STRUCTURE");
  assert.ok(!d.some((s) => /^Partnering for/i.test(s.title)), "no credentials slide");
  assert.ok(d.some((s) => s.type === "timeline"), "the roadmap is a timeline");
  assert.ok(!d.some((s) => s.type !== "section" && s.title === "Understanding Unilever's needs"), "no slide named like its section");
  assert.ok(!JSON.stringify(d).includes("**"), "no markdown");
  const kpi = d.find((s) => /key performance/i.test(s.title));
  assert.equal(kpi.reference.tag, "P66_KPI_TILES");
  assert.ok(kpi.items.every((it) => /\d/.test(it.value)));
});

test("version label is V.1_48", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_ = '66° Deck Agent V\.1_48'/);
});
