// V.1_58 quality gate: every design drawn with short, medium and long content at 2-6 items; reports texts on top of each other, cut texts, headings-only slides and empty space
const fs=require('fs'),vm=require('vm'),path=require('path');
function load(REPO){
  const g={console,Math,JSON,String,Array,Object,Number,Date,RegExp};vm.createContext(g);
  const rd=f=>fs.readFileSync(path.join(REPO,'src',f),'utf8');
  vm.runInContext(rd('Engine.gs')+';this.ENGINE=ENGINE;',g);
  fs.readdirSync(path.join(REPO,'src')).filter(f=>/^(Proposal|Solution)(Designs.*|Assets)\.gs$/.test(f)).sort().forEach(f=>vm.runInContext(rd(f),g,{filename:f}));
  vm.runInContext(rd('Reference.gs'),g);
  return g;
}
const W8=['Consolidate store and loyalty data in BigQuery','Vertex AI models predict demand for every item','Order suggestions reach the screens buyers use','A steering group reviews results every two weeks','Shrink is measured against a sixty day baseline','Stores join in waves after each checkpoint'];
const EXTRA=' so teams act on one trusted view and every change is measured against the agreed baseline before the next wave starts';
const T=['Unified data foundation','Demand forecasting models','Store ordering workflow','Governance and change','Pilot measurement plan','Scale to all regions'];
function txt(i,len){const b=W8[i%6];return len===0?b+'.':len===1?b+' with clear owners and weekly checks.':b+EXTRA+'.';}
function spec(type,n,lib,tag,len){
  const items=T.slice(0,n).map((t,i)=>({title:t,text:txt(i,len),value:['-30%','40%','<10%','85%','2x','12'][i],label:t,tag:'Cloud Run',icon:'chart',points:[W8[i%6],W8[(i+1)%6]]}));
  return {deckLibrary:lib,type,title:'Pilot plan for demand forecasting at Northwind',lead:'One sentence that explains why this slide matters to the reader.',takeaway:'The plan cuts waste in the first quarter.',text:txt(0,len),center:'Plan',
    items,points:T.slice(0,n).map((t,i)=>txt(i,len)),stats:items,periods:['Month 1','Month 2','Month 3','Month 4','Month 5','Month 6'],
    lanes:T.slice(0,Math.max(3,Math.min(n,5))).map((t,i)=>({name:t,bars:[{start:i+1,end:Math.min(6,i+2),label:'Build '+t.toLowerCase()}]})),
    columns:['Area','Today','Target'],rows:T.slice(0,n).map((t,i)=>[t,txt(i,len),'In place by month '+(i+2)]),
    left:{title:'Today',points:T.slice(0,n).map((t,i)=>txt(i,len))},right:{title:'Target',points:T.slice(0,n).map((t,i)=>txt(i+1,len))},
    groups:T.slice(0,Math.min(n,4)).map((t,i)=>({label:t,items:[{title:'BigQuery',text:'Tables'},{title:'Dataflow',text:'Pipelines'}],points:[W8[i]]})),
    layers:T.slice(0,n).map((t,i)=>({name:t,items:['Pub/Sub topics','BigQuery tables']})),
    teams:[{name:'Client team',roles:[{title:'Product owner',text:'Owns the backlog'},{title:'Data engineer',text:'Builds pipelines'}]},{name:'66degrees team',roles:[{title:'Engagement lead',text:'Runs delivery'},{title:'ML engineer',text:'Builds models'}]}],
    chart:{type:'bar',categories:T.slice(0,n),series:[{name:'Share',values:[67,59,49,46,16,30].slice(0,n)}],unit:'%'},
    reference:{tag}};
}
function textEls(o){return o.els.filter(e=>e.t==='text'&&String(e.text||'').trim());}
function gap(o,textOnly){const iv=[];o.els.forEach(e=>{if(e.t==='image')return;if((e.w||0)>=700||(e.h||0)>=380)return;if(textOnly&&e.t!=='text'&&e.t!=='icon')return;const y0=e.t==='line'?Math.min(e.y1,e.y2):e.y;const y1=e.t==='line'?Math.max(e.y1,e.y2):e.y+(e.t==='text'?(e.vh||e.h):(e.h||0));if(y1<90||y0>362)return;iv.push([Math.max(90,y0),Math.min(362,y1)]);});iv.sort((a,b)=>a[0]-b[0]);let cur=90,mx=0;iv.forEach(([a,b])=>{if(a>cur)mx=Math.max(mx,a-cur);cur=Math.max(cur,b);});mx=Math.max(mx,362-cur);return mx/(362-90);}
function coverage(o){let m=-1;o.els.forEach(e=>{if(e.t==='image')return;const y0=e.t==='line'?Math.min(e.y1,e.y2):e.y;if(y0<60||y0>362)return;const y=e.t==='line'?Math.max(e.y1,e.y2):e.y+(e.t==='text'?(e.vh||e.h):(e.h||0));m=Math.max(m,Math.min(y,362));});return m<0?0:(m-68)/(362-68);}
function check(g,sp,tag){
  let o;try{o=g.ENGINE.render({slides:[sp]},{dateLabel:'x'})[0];}catch(e){return {err:e.message};}
  const ts=textEls(o);
  const ov=g.ENGINE.textOverlaps?g.ENGINE.textOverlaps(o):[];
  const cut=ts.filter(e=>/…$/.test(e.text)).map(e=>e.text);
  const body=ts.filter(e=>e.y>60&&String(e.text).split(/\s+/).length>=5);
  return {o,drawnWith:o.drawnWith,ov:ov.length,ovs:ov.slice(0,1),cut:cut.length,cuts:cut.slice(0,1),empty:body.length===0,cov:coverage(o),gap:gap(o),tgap:gap(o,true)};
}
function catalog(g){return vm.runInContext('(function(){var r=[];var V=ENGINE.VARIANTS;Object.keys(V).forEach(function(t){V[t].forEach(function(v){r.push([t,v.tag])})});return r})()',g);}
function survey(REPO,opts){opts=opts||{};const g=load(REPO);const rows=[];
  catalog(g).forEach(([type,tag])=>{const lib=/^S66/.test(tag)?'solution':/^P66/.test(tag)?'proposal':'general';
    for(const n of [2,3,4,5,6])for(const len of [0,1,2]){const sp=spec(type,n,lib,tag,len);const r=check(g,sp,tag);if(r.err)continue;r.tag=tag;r.type=type;r.n=n;r.len=len;r.own=r.drawnWith===tag;rows.push(r);}});
  // base layouts
  ['bullets','cards','process','timeline','stats','comparison','table','diagram','architecture','team','chart','statement'].forEach(type=>{for(const lib of ['general','proposal','solution'])for(const n of [3,4,5])for(const len of [0,1,2]){const sp=spec(type,n,lib,null,len);delete sp.reference;const r=check(g,sp);if(r.err)continue;r.tag='base:'+type+':'+lib;r.type=type;r.n=n;r.len=len;r.own=true;rows.push(r);}});
  return rows;}
module.exports={load,spec,check,survey,coverage,gap};
if(require.main===module){const rows=survey(process.env.REPO||require('path').resolve(__dirname,'..','..'));
  const own=rows.filter(r=>r.own);const by=(f)=>{const m={};own.filter(f).forEach(r=>{m[r.drawnWith||r.tag]=(m[r.drawnWith||r.tag]||0)+1});return m;};
  console.log('drawn',own.length,'all',rows.length);
  console.log('OVERLAP',JSON.stringify(by(r=>r.ov)));
  console.log('CUT(len<=1)',JSON.stringify(by(r=>r.cut&&r.len<=1)));
  console.log('EMPTY',JSON.stringify(by(r=>r.empty)));
  console.log('GAP(>25%)',JSON.stringify(by(r=>r.gap>(+process.env.GT||0.25)&&!/AGENDA|SECTION|COVER|CLOSING/.test(r.tag))));
  console.log('TEXTGAP(>35%)',JSON.stringify(by(r=>r.tgap>0.35&&!/AGENDA|SECTION|COVER|CLOSING/.test(r.tag))));
  if(process.env.V){own.filter(r=>r.ov).slice(0,15).forEach(r=>console.log('ov',r.tag,r.n,r.len,JSON.stringify(r.ovs).slice(0,200)));}
}
