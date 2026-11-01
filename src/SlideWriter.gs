/* =========================
   V.1_79 - Gemini's way (the answers Gemini gave about decks 49/50):
   1. The outline is checked by the code first: one KPI slide when the request gives targets or asks for KPIs.
   2. Every slide is written by its own Gemini call (the calls of a part run in parallel, so a part takes as long as one
      call). A slide of a known kind (KPI, RACI) is written with its own response schema: every field it needs is
      required, every cell filled.
   3. Each slide gets only its own rules (KPI targets to the KPI slide, pricing rules to the pricing slide, risk rules to
      the risk slide); the risk mitigation is the field "mitigation_strategy" (it never shows as "Fix:").
   4. Every statistic carries "source_quote": 10-20 words copied from the research. A quote found in the research keeps
      its figure on the slide.
   5. Figures as digits, targets exactly as the request gives them, no invented people or client facts.
   6. Sequence labels (Phase A, B, C / Wave 1, 2, 3) are written by the code.
   A slide whose call fails is written the way it was before (one call for the part), so a deck never stops.
========================= */

/* ---------- sentences without cutting decimals or abbreviations ---------- */

// The sentences of a text; joined back ('' join) they give the text exactly. A full stop inside a number ("147.6",
// "1.84") or after an abbreviation ("U.S.", "e.g.", "vs.") never ends a sentence (V.1_79, deck 50: "$147.6B" became
// "6B" and "In the U.S., physicians average 1.84 hours" became "S. 84 hours").
var ABBREV_END_RE_ = /(?:^|[\s(])(?:[A-Za-z]\.){1,3}$|(?:^|[\s(])(?:e\.g|i\.e|vs|etc|approx|incl|Inc|Ltd|Corp|Co|Dr|Mr|Ms|Mrs|St|No|Fig|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$/;
function splitSentences_(x, trim) {
  var s = String(x == null ? '' : x);
  if (!s) return trim ? [] : [''];
  var out = [], start = 0, re = /[.!?]+(\s+|$)/g, m;
  while ((m = re.exec(s))) {
    var endPunct = m.index + m[0].length - m[1].length;            // just after the punctuation
    var head = s.slice(start, endPunct);
    var next = s.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if (m[1] && (ABBREV_END_RE_.test(head) || /^[a-z]/.test(next))) { if (!m[0].length) re.lastIndex++; continue; }
    out.push(s.slice(start, m.index + m[0].length));
    start = m.index + m[0].length;
    if (!m[0].length) re.lastIndex++;
    if (start >= s.length) break;
  }
  if (start < s.length) out.push(s.slice(start));
  return trim ? out.map(function (x2) { return x2.trim(); }).filter(Boolean) : out;
}

/* ---------- 3 + 5. the rules every slide call gets ---------- */

var GEMINI_RULES_ = [
  'RULES FOR THIS SLIDE (always):',
  '- Write every figure as digits with its unit or symbol, e.g. "$120M", "25%", "2.5x", "15%", "30 seconds", "$147.6B": never in words',
  '  ("twenty-five percent", "fifteen percent", "one hundred twenty million dollars").',
  '- State every target exactly as the request gives it (the same number, direction and unit): never extrapolate, tighten or change',
  '  a target ("under 1%" stays "under 1%", never "under 0.9%").',
  '- Rely only on the request, the research sources, the approved facts and the attached material: never invent names of people or',
  '  executives, client figures (employees, projects, sites, stores), client programmes or other clients of 66degrees.',
  '- Every statistic taken from a research source gets "source_quote": 10-20 words copied exactly, word for word, from the source',
  '  text it comes from (never paraphrased or summarised). A target from the request quotes the request.',
  '- Write the steps, phases and waves of a sequence in order; never skip or repeat a label (the code numbers them).',
  '- A risk is {"title": the risk, "text": its impact, "mitigation_strategy": what the team does about it}. Never write the words',
  '  "Fix:" or "Mitigation:" in any text.',
  '- Every table cell has a value: each row has a value for every column.',
  '- An item\'s text never repeats the item\'s title; a title is a complete phrase that never ends with a comma.'
].join('\n');

/* ---------- 2. response schemas for the slide kinds the code knows ---------- */

function strS_(min) { return min ? { type: 'string', minLength: min } : { type: 'string' }; }
function slideSchema_(o, ctx) {
  const kind = typeof onceTopicOfEntry_ === 'function' ? onceTopicOfEntry_(o) : '';
  let slide = null;
  if (kind === 'kpi') {
    slide = {
      type: 'object',
      properties: {
        type: strS_(1), title: strS_(1), lead: strS_(), design: strS_(), notes: strS_(1), takeaway: strS_(),
        items: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object',
          properties: { value: strS_(1), label: strS_(1), text: strS_(1), source_quote: strS_(1), icon: strS_() },
          required: ['value', 'label', 'text', 'source_quote'] } }
      },
      required: ['type', 'title', 'items', 'notes']
    };
  } else if (kind === 'raci') {
    slide = {
      type: 'object',
      properties: {
        type: strS_(1), title: strS_(1), lead: strS_(), design: strS_(), notes: strS_(1),
        columns: { type: 'array', minItems: 3, maxItems: 6, items: strS_(1) },
        rows: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'array', minItems: 3, maxItems: 6, items: strS_(1) } }
      },
      required: ['type', 'title', 'columns', 'rows', 'notes']
    };
  }
  return slide ? wrapSlideSchema_(slide) : null;
}
function wrapSlideSchema_(slide) {
  return { type: 'object', properties: { deck_title: strS_(), slides: { type: 'array', minItems: 1, maxItems: 1, items: slide } }, required: ['slides'] };
}
// a table with every cell filled (asked again for a table that came back with empty cells)
function tableSchema_(nCols) {
  return wrapSlideSchema_({
    type: 'object',
    properties: {
      type: strS_(1), title: strS_(1), lead: strS_(), design: strS_(), notes: strS_(1),
      columns: { type: 'array', minItems: nCols, maxItems: nCols, items: strS_(1) },
      rows: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'array', minItems: nCols, maxItems: nCols, items: strS_(1) } }
    },
    required: ['type', 'title', 'columns', 'rows', 'notes']
  });
}

/* ---------- 2. the calls of a part, in parallel ---------- */

function perSlideWriting_(ctx) {
  if (typeof CONFIG !== 'undefined' && CONFIG.perSlideWriting === false) return false;
  return typeof UrlFetchApp !== 'undefined' && typeof UrlFetchApp.fetchAll === 'function';
}
// The JSON answer of a Vertex AI response body (null when there is none)
function parseGeminiBody_(body) {
  let result = null;
  try { result = JSON.parse(body); } catch (e) { return null; }
  const cand = result && result.candidates && result.candidates[0];
  if (!cand || !cand.content || !cand.content.parts) return null;
  const raw = cand.content.parts.map(function (p) { return p.text || ''; }).join('').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return { json: JSON.parse(raw), usage: result.usageMetadata }; } catch (e) {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a !== -1 && b > a) { try { return { json: JSON.parse(raw.slice(a, b + 1)), usage: result.usageMetadata }; } catch (e2) {} }
  }
  return null;
}
// jobs: [{parts, temperature, schema}] -> answers (null where none came back). All calls go out at once; a call that
// fails is made again on its own (with its retries and its fallback models), once.
function callGeminiParallel_(jobs, ctx, budgetMs) {
  const out = jobs.map(function () { return null; });
  if (!jobs.length) return out;
  const t0 = Date.now();
  let model = '', endpoint = '', headers = null;
  try {
    const cfg = requireVertexConfig_();
    model = (typeof contentModel_ === 'function' && contentModel_()) || modelCandidates(ctx.apiKey, 'text')[0];
    endpoint = buildVertexEndpoint_(cfg, model);
    headers = vertexAuthHeaders_();
  } catch (e) { if (ctx && ctx.log) ctx.log.push('Parallel writing not available (' + e.message + '): slides written one by one.'); }
  if (endpoint && headers) {
    const tc = typeof geminiThinkingConfig_ === 'function' ? geminiThinkingConfig_(model) : null;
    const reqs = jobs.map(function (j) {
      const gc = { responseMimeType: 'application/json', temperature: j.temperature == null ? 0.2 : j.temperature };
      if (j.schema) gc.responseSchema = j.schema;
      if (tc) gc.thinkingConfig = tc;
      return { url: endpoint, method: 'post', contentType: 'application/json', headers: headers, muteHttpExceptions: true,
        payload: JSON.stringify({ contents: [{ role: 'user', parts: j.parts }], generationConfig: gc }) };
    });
    let resps = [];
    try { resps = UrlFetchApp.fetchAll(reqs); } catch (e) { if (ctx && ctx.log) ctx.log.push('Parallel call failed (' + e.message + '): slides written one by one.'); resps = []; }
    resps.forEach(function (r, i) {
      try {
        const code = r.getResponseCode();
        if (code < 200 || code >= 300) return;
        const p = parseGeminiBody_(r.getContentText());
        if (!p) return;
        out[i] = p.json;
        try { if (typeof recordModelUsage_ === 'function') recordModelUsage_(model, p.usage); } catch (eU) {}
      } catch (e) {}
    });
    if (typeof noteGeminiModel_ === 'function' && out.some(Boolean)) { try { noteGeminiModel_(model, false); } catch (eN) {} }
  }
  // a call that failed: once more on its own (callGeminiJSON retries, tries the next model and drops a refused schema)
  let again = 0;
  jobs.forEach(function (j, i) {
    if (out[i] || Date.now() - t0 > (budgetMs || 200000)) return;
    try {
      out[i] = withContentModel_(ctx, function () { return callGeminiJSON(j.parts, ctx.apiKey, j.temperature, j.schema ? { schema: j.schema } : undefined); });
      again++;
    } catch (e) { if (ctx && ctx.log) ctx.log.push('A slide call failed (' + String(e.message).slice(0, 100) + ').'); }
  });
  if (again && ctx && ctx.log) ctx.log.push(again + ' slide call(s) made again on their own.');
  return out;
}

/* ---------- 2. a part of a long deck, one slide per call ---------- */

// The same prompt the part would get, written for one slide (its own rules, its own design pictures), then the answers
// are put together and go through every check the part's single answer went through
function planContentPerSlide_(userPrompt, presentationType, n, sources, ctx, opts) {
  const batch = opts.batch;
  const titles = batch.slides.map(function (o) { return o.title; });
  const jobs = batch.slides.map(function (o, k) {
    const one = Object.assign({}, batch, {
      slides: [o],
      otherTitles: titles.filter(function (t, j) { return j !== k; }).concat(batch.otherTitles || [])
    });
    const pr = planContent(userPrompt, presentationType, 1, sources, ctx, Object.assign({}, opts, { batch: one, promptOnly: true }));
    return { parts: pr.parts, temperature: pr.temperature, schema: slideSchema_(o, ctx) };
  });
  const answers = callGeminiParallel_(jobs, ctx);
  let deckTitle = '';
  const slides = answers.map(function (a, k) {
    if (a && a.deck_title && !deckTitle) deckTitle = a.deck_title;
    const sp = a && Array.isArray(a.slides) ? a.slides[0] : (a && (a.type || a.title) ? a : null);
    if (!sp || typeof sp !== 'object') return null;
    if (!sp.type) sp.type = batch.slides[k].type;
    if (!sp.title) sp.title = batch.slides[k].title;
    return sp;
  });
  // a table that came back with empty cells is asked again on its own, with every cell required
  const repairs = [];
  slides.forEach(function (sp, k) {
    if (!sp || !emptyCells_(sp)) return;
    const nc = Math.max(2, Math.min(6, (Array.isArray(sp.columns) ? sp.columns.length : 0) || 3));
    const parts = jobs[k].parts.slice();
    parts.push({ text: 'Your table for this slide had empty cells. Write it again with exactly ' + nc + ' columns (' +
      (Array.isArray(sp.columns) ? sp.columns.join(' | ') : '') + ') and a value in every cell of every row.' });
    repairs.push({ k: k, job: { parts: parts, temperature: jobs[k].temperature, schema: tableSchema_(nc) } });
  });
  if (repairs.length) {
    const fixed = callGeminiParallel_(repairs.map(function (r) { return r.job; }), ctx, 120000);
    repairs.forEach(function (r, i) {
      const a = fixed[i], sp = a && Array.isArray(a.slides) ? a.slides[0] : null;
      if (sp && !emptyCells_(sp)) { slides[r.k] = Object.assign(slides[r.k], { columns: sp.columns, rows: sp.rows }); }
    });
    if (ctx && ctx.log) ctx.log.push(repairs.length + ' table(s) with empty cells written again.');
  }
  const got = slides.filter(Boolean);
  if (!got.length) throw new Error('Gemini returned no slide content.');
  if (got.length < slides.length && ctx && ctx.log) ctx.log.push((slides.length - got.length) + ' slide(s) of this part came back empty.');
  const raw = { deck_title: deckTitle || batch.deckTitle || '', slides: got };
  prepareWrittenSlides_(raw.slides, ctx, sources, userPrompt);
  return planContent(userPrompt, presentationType, n, sources, ctx, Object.assign({}, opts, { rawPlan: raw }));
}

// true when a table has a row with an empty cell (or rows of different lengths)
function emptyCells_(sp) {
  if (!sp || !Array.isArray(sp.rows) || !sp.rows.length || !Array.isArray(sp.rows[0])) return false;
  if (Array.isArray(sp.prices) || Array.isArray(sp.risks)) return false;
  const w = Array.isArray(sp.columns) && sp.columns.length ? sp.columns.length : Math.max.apply(null, sp.rows.map(function (r) { return Array.isArray(r) ? r.length : 0; }));
  return sp.rows.some(function (r) {
    if (!Array.isArray(r)) return false;
    for (let j = 0; j < w; j++) if (!String(r[j] == null ? '' : (typeof r[j] === 'object' ? (r[j].text || r[j].title || '') : r[j])).trim()) return true;
    return false;
  });
}

/* ---------- 3 + 4. the answer before the usual checks ---------- */

// Risk mitigations to the field the designs read; every "Fix:" label goes; each statistic's quote is checked against
// the research (a quote found there keeps its figure: the quote joins the figure check's sources)
function prepareWrittenSlides_(slides, ctx, sources, userPrompt) {
  const corpus = quoteCorpus_(sources, userPrompt, ctx);
  let kept = 0, dropped = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    mapMitigations_(sp);
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (Object.prototype.hasOwnProperty.call(o, 'source_quote')) {
        const q = String(o.source_quote || '');
        if (q && quoteFound_(q, corpus) && quoteHasFigure_(q, o)) {
          ctx.sourceQuotes = (ctx.sourceQuotes || []).concat([q]);
          kept++;
        } else if (q) dropped++;
        delete o.source_quote;
      }
      Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') walk(o[k]); });
    })(sp);
  });
  if ((kept || dropped) && ctx && ctx.log) ctx.log.push('Source quotes: ' + kept + ' found in the research' + (dropped ? ', ' + dropped + ' not found (their figures are checked as usual)' : '') + '.');
  return kept;
}
function quoteNorm_(t) { return String(t || '').toLowerCase().replace(/(\d),(\d{3})/g, '$1$2').replace(/[^a-z0-9%$.]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function quoteCorpus_(sources, userPrompt, ctx) {
  const parts = [String(userPrompt || ''), String((sources && sources.text) || ''), JSON.stringify((ctx && ctx.approvedFacts) || [])];
  ((sources && sources.research) || []).forEach(function (r) {
    if (!r || typeof r !== 'object') { parts.push(String(r || '')); return; }
    Object.keys(r).forEach(function (k) { if (typeof r[k] === 'string') parts.push(r[k]); });
  });
  return quoteNorm_(parts.join(' \n '));
}
// the quote is in the sources: the whole quote, or (a source text cut by the search) its longest run of 8+ words
function quoteFound_(q, corpus) {
  const n = quoteNorm_(q);
  if (!n || n.split(' ').length < 5) return false;
  if (corpus.indexOf(n) !== -1) return true;
  const w = n.split(' ');
  for (let len = w.length - 1; len >= 8; len--) {
    for (let a = 0; a + len <= w.length; a++) if (corpus.indexOf(w.slice(a, a + len).join(' ')) !== -1) return true;
  }
  return false;
}
// the quote holds the item's figure (the number itself, units aside)
function quoteHasFigure_(q, it) {
  const v = String((it && (it.value || it.metric)) || '');
  const nums = (v.match(/\d[\d.,]*/g) || []).map(function (x) { return x.replace(/,/g, '').replace(/\.$/, ''); });
  if (!nums.length) return true;
  const qn = String(q).replace(/,/g, '');
  return nums.every(function (x) { return qn.indexOf(x) !== -1; });
}
function mapMitigations_(sp) {
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (typeof o.mitigation_strategy === 'string' && o.mitigation_strategy.trim()) {
      if (!String(o.fix || '').trim()) o.fix = o.mitigation_strategy.trim();
      delete o.mitigation_strategy;
    } else if (Object.prototype.hasOwnProperty.call(o, 'mitigation_strategy')) delete o.mitigation_strategy;
    Object.keys(o).forEach(function (k) {
      if (typeof o[k] === 'string') o[k] = o[k].replace(/^\s*(fix|mitigation strategy)\s*:\s*/i, '').replace(/([.;]\s+)fix:\s*/gi, '$1');
      else if (o[k] && typeof o[k] === 'object') walk(o[k]);
    });
  })(sp);
}

/* ---------- 1. the outline: one KPI slide when the request gives targets or asks for KPIs ---------- */

function outlineWantsKpi_(ctx, prompt) {
  const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  return targets.length >= 2 || /\bkpis?\b|key performance|success (metrics|measures)|measures? of success/i.test(String(prompt || ''));
}
// Returns 'added', 'kept' or ''. A KPI entry is the outline's stats slide about targets; when there is none, the body
// entry that is closest to it (targets, outcomes, value, measuring) becomes it, else one is added to the section that
// names KPIs (else the smallest section, before its pricing and next-step slides). Extra KPI entries keep their place
// with another angle.
function ensureKpiOutline_(outline, ctx, prompt) {
  const list = (outline && outline.slides) || [];
  if (!outlineWantsKpi_(ctx, prompt)) return '';
  const isKpi = function (o) { return o && o.type !== 'section' && (typeof onceTopicOfEntry_ === 'function' ? onceTopicOfEntry_(o) : '') === 'kpi'; };
  const kpis = list.filter(isKpi);
  if (kpis.length) {
    kpis.forEach(function (o, i) {
      if (i === 0) { o.type = 'stats'; return; }
      o.title = String(o.title).replace(/\b(kpis?|key performance indicators?|success metrics|targets?)\b/ig, 'outcomes').replace(/\s{2,}/g, ' ');
      if (o.type === 'stats') o.type = 'cards';
    });
    return 'kept';
  }
  const entry = { type: 'stats', title: 'Target KPIs and how they are measured', brief: 'The request\'s target figures, each with how it is reached and measured' };
  const close = list.filter(function (o) { return o && o.type !== 'section' && /\b(targets?|outcomes?|success|measur\w*|value realization|impact)\b/i.test(String(o.title || '')) && !/\b(pricing|risk|raci|next steps?)\b/i.test(String(o.title || '')); })[0];
  if (close) {
    close.type = 'stats';
    if (!/\b(kpis?|targets?|measur\w*)\b/i.test(String(close.title))) close.title = String(close.title).replace(/\s*$/, '') + ': target KPIs';
    close.brief = entry.brief;
    if (ctx && ctx.log) ctx.log.push('Outline: "' + close.title + '" is the KPI slide (the request gives targets).');
    return 'added';
  }
  const secs = [];
  list.forEach(function (o, i) { if (o && o.type === 'section') secs.push({ at: i, title: o.title, n: 0 }); else if (secs.length) secs[secs.length - 1].n++; });
  let pos = list.length, k = -1;
  if (secs.length) {
    k = secs.findIndex(function (s) { return /\bkpis?\b|targets?|measur|outcomes?|value/i.test(String(s.title || '')); });
    if (k === -1) k = secs.indexOf(secs.slice().sort(function (a, b) { return a.n - b.n; })[0]);
    const end = k + 1 < secs.length ? secs[k + 1].at : list.length;
    pos = end;
    for (let j = secs[k].at + 1; j < end; j++) { const f = typeof onceTopicOfEntry_ === 'function' ? onceTopicOfEntry_(list[j]) : ''; if (f === 'pricing' || f === 'next') { pos = j; break; } }
  }
  // the deck keeps its size: the entry takes the place of the last non-required slide of the longest section
  const required = { pricing: 1, raci: 1, risks: 1, next: 1, team: 1, scope: 1, why66: 1, support: 1 };
  let drop = -1, longest = secs.slice().sort(function (a, b) { return b.n - a.n; })[0];
  if (longest) {
    const s2 = secs.indexOf(longest), end2 = s2 + 1 < secs.length ? secs[s2 + 1].at : list.length;
    for (let j = end2 - 1; j > longest.at; j--) { const f = typeof onceTopicOfEntry_ === 'function' ? onceTopicOfEntry_(list[j]) : ''; if (!required[f]) { drop = j; break; } }
  }
  list.splice(pos, 0, entry);
  if (drop !== -1 && longest && longest.n > 2) {
    const at = drop >= pos ? drop + 1 : drop;
    const gone = list.splice(at, 1)[0];
    (outline.agendaItems || []).forEach(function (ag) { if (ag && Array.isArray(ag.points)) ag.points = ag.points.filter(function (p) { return p !== gone.title; }); });
  }
  if (k !== -1 && outline.agendaItems && outline.agendaItems[k] && Array.isArray(outline.agendaItems[k].points)) outline.agendaItems[k].points.push(entry.title);
  if (ctx && ctx.log) ctx.log.push('Outline: a KPI slide was added (the request gives targets).');
  return 'added';
}

// Commercial pricing (engagement models, fees), never a product's pricing ("BigQuery slot reservations vs on-demand
// query pricing" - deck 50 Solution 29 got the pricing line)
var TECH_PRICING_RE_ = /\b(query|on-demand|slots?|storage|consumption|compute|usage|cloud|bigquery|gke|license|licensing|egress|instance|node)\s+(pricing|price)\b|\bpricing (model )?(for|of) (bigquery|compute|storage|queries|slots|gke)\b|\bvs\.? on-demand\b/i;
function isCommercialPricing_(title) {
  const t = String(title || '');
  return /\bpric\w*|commercial|investment options|engagement (options|models)|fees?\b/i.test(t) && !TECH_PRICING_RE_.test(t);
}

/* ---------- 5 + 6. the last checks of the written slides (in the quality step) ---------- */

// a number written in words ("one hundred twenty", "twenty-five") as digits
var NUM_WORDS_ = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
var NUM_WORD_RE_ = '(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|and|point)[\\s-]*)+';
function wordsNumber_(w) {
  const toks = String(w).toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(function (t) { return t && t !== 'and'; });
  let total = 0, cur = 0, dec = '', inDec = false, any = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === 'point') { inDec = true; continue; }
    if (t === 'hundred') { cur = (cur || 1) * 100; any = true; continue; }
    if (!(t in NUM_WORDS_)) return null;
    if (inDec) { dec += String(NUM_WORDS_[t]); continue; }
    cur += NUM_WORDS_[t]; any = true;
  }
  if (!any) return null;
  total += cur;
  return dec ? total + '.' + dec : String(total);
}
function wordsToDigits_(s) {
  if (typeof s !== 'string' || !/[a-z]/i.test(s)) return s;
  const fmt = function (n, scale) { return n + (scale ? scale : ''); };
  let out = s.replace(new RegExp('\\b(' + NUM_WORD_RE_ + ')\\s*(million|billion|thousand)\\s+dollars?\\b', 'gi'), function (all, w, sc) {
    const n = wordsNumber_(w); if (n == null) return all;
    return '$' + fmt(n, { million: 'M', billion: 'B', thousand: 'K' }[sc.toLowerCase()]);
  });
  out = out.replace(new RegExp('\\b(' + NUM_WORD_RE_ + ')\\s*(per\\s?cent|percent|percentage points?)\\b', 'gi'), function (all, w, u) {
    const n = wordsNumber_(w); if (n == null) return all;
    return /points?/i.test(u) ? n + ' percentage points' : n + '%';
  });
  out = out.replace(new RegExp('\\b(' + NUM_WORD_RE_ + ')\\s*(million|billion)\\b', 'gi'), function (all, w, sc) {
    const n = wordsNumber_(w); if (n == null || Number(n) < 2) return all;
    return n + ' ' + sc.toLowerCase();
  });
  out = out.replace(/\b(\d+(?:\.\d+)?)\s?(?:per\s?cent|percent)\b/gi, '$1%');
  // "120 million dollar savings" -> "$120M savings"
  out = out.replace(/\b(\d+(?:\.\d+)?)\s(million|billion)\s(?:dollars?|USD)\b/gi, function (all, n, sc) { return '$' + n + (sc.toLowerCase() === 'million' ? 'M' : 'B'); });
  if (out !== s && /^[a-z$\d]/.test(out) && /^[A-Z]/.test(s)) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

// Sequence labels written by the code: "Phase A, Phase B, Phase D" -> A, B, C (the style of the first label kept)
var SEQ_WORDS_ = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
var SEQ_RE_ = /^(\s*)(phase|wave|stage|step|sprint|milestone|release)\s+([A-Z]|\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|I{1,3}|IV|V|VI{0,3})\b/i;
function sequenceLabels_(sp) {
  let n = 0;
  const lists = [];
  ['items', 'phases', 'steps', 'stages', 'waves', 'milestones', 'timeline'].forEach(function (k) { if (Array.isArray(sp[k])) lists.push(sp[k]); });
  lists.forEach(function (arr) {
    ['date', 'label', 'title', 'phase', 'name'].forEach(function (f) {
      const its = arr.filter(function (it) { return it && typeof it === 'object' && typeof it[f] === 'string'; });
      if (its.length < 2 || its.length !== arr.filter(function (it) { return it && typeof it === 'object'; }).length) return;
      const ms = its.map(function (it) { return SEQ_RE_.exec(it[f]); });
      if (ms.some(function (m) { return !m; })) return;
      const word = ms[0][2].toLowerCase();
      if (ms.some(function (m) { return m[2].toLowerCase() !== word; })) return;
      const first = ms[0][3];
      const style = /^\d+$/.test(first) ? 'num' : /^[A-Z]$/.test(first) && !/^(I|V)$/.test(first) ? 'letter' : /^[ivx]+$/i.test(first) ? 'roman' : 'word';
      const start = style === 'num' ? Number(first) : 1;
      const lab = function (k) {
        if (style === 'num') return String(start + k);
        if (style === 'letter') return String.fromCharCode(65 + k);
        if (style === 'roman') return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k] || String(k + 1);
        return SEQ_WORDS_[k] || String(k + 1);
      };
      its.forEach(function (it, k) {
        const m = ms[k], want = lab(k);
        if (m[3].toLowerCase() === want.toLowerCase()) return;
        it[f] = it[f].replace(SEQ_RE_, function (all, sp0, w) { return sp0 + w + ' ' + want; });
        n++;
      });
    });
  });
  return n;
}

// A target the request sets ("under 1%") is written the same way on the slides (deck 50 Proposal 2: "under 0.9%")
var BOUND_RE_ = /\b(under|below|less than|fewer than|at most|no more than|sub-)\s?(\d+(?:\.\d+)?)\s?(%|ms|milliseconds?|seconds?|minutes?|hours?|x)/gi;
function requestBounds_(prompt) {
  const out = [];
  String(prompt || '').replace(BOUND_RE_, function (all, dir, num, unit) { out.push({ num: num, unit: unitKey_(unit) }); return all; });
  return out;
}
function unitKey_(u) { u = String(u || '').toLowerCase(); return /^ms|millisec/.test(u) ? 'ms' : /^sec/.test(u) ? 's' : /^min/.test(u) ? 'min' : /^hour/.test(u) ? 'h' : u; }
function targetsExact_(slides, ctx) {
  const bounds = requestBounds_((ctx && ctx.userPrompt) || '');
  if (!bounds.length) return 0;
  let n = 0;
  const fix = function (s) {
    if (typeof s !== 'string') return s;
    return s.replace(BOUND_RE_, function (all, dir, num, unit) {
      const same = bounds.filter(function (b) { return b.unit === unitKey_(unit); });
      if (same.length !== 1 || same[0].num === num) return all;
      if (Number(num) >= Number(same[0].num)) return all;                     // (a looser figure is another statement)
      n++;
      return all.replace(num, same[0].num);
    });
  };
  (slides || []).forEach(function (sp) { walkStrings_(sp, fix, { reference: 1, design: 1, type: 1 }); });
  if (n && ctx && ctx.log) ctx.log.push(n + ' target(s) put back to the request\'s figure.');
  return n;
}
function walkStrings_(o, fn, skip) {
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = fn(o[i], ''); else walkStrings_(o[i], fn, skip); } return; }
  if (!o || typeof o !== 'object') return;
  Object.keys(o).forEach(function (k) {
    if (skip && skip[k]) return;
    if (typeof o[k] === 'string') o[k] = fn(o[k], k);
    else if (o[k] && typeof o[k] === 'object') walkStrings_(o[k], fn, skip);
  });
}

// A person named on a slide who is not in the request, the files, the research or the approved facts is taken out
// (deck 50 Proposal 1 slide 6: "under Willem Uijen's vision")
var PERSON_RE_ = /\b(?:under|led by|with|per|from|by)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})(?:'s)?\s+(vision|leadership|direction|sponsorship|mandate|strategy)\b|\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}),\s+(?:the\s+)?(?:CEO|CIO|CTO|CFO|COO|CDO|CISO|Chief [A-Z][a-z]+(?: [A-Z][a-z]+)? Officer|SVP|EVP|VP|Head of)\b/g;
function inventedPeople_(slides, ctx, sources) {
  const corpus = quoteCorpus_(sources, (ctx && ctx.userPrompt) || '', ctx);
  let n = 0;
  const fix = function (s, k) {
    if (typeof s !== 'string' || k === 'notes') return s;
    return s.replace(PERSON_RE_, function (all, p1, what, p2) {
      const who = p1 || p2;
      if (!who || corpus.indexOf(quoteNorm_(who)) !== -1) return all;
      n++;
      return p1 ? 'in line with the client\'s ' + what : '';
    }).replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1');
  };
  (slides || []).forEach(function (sp) { walkStrings_(sp, fix, { reference: 1, design: 1, type: 1 }); });
  if (n && ctx && ctx.log) ctx.log.push(n + ' name(s) of people not in the request or sources taken out.');
  return n;
}

// "Google Cloud Cloud Healthcare API" -> "Google Cloud Healthcare API"; "the the" -> "the"
function repeatedWords_(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/\b([A-Za-z][A-Za-z'-]*)(\s+\1\b)+/g, function (all, w) { return /^(that|had|is|bye|no|very|so)$/i.test(w) ? all : w; });
}

// RACI cells: each role with its capital ("Responsible / Accountable"), never "Joint" or "(R)"
function raciCell_(c) {
  if (typeof c !== 'string') return c;
  const t = c.trim();
  if (!/^(joint\s+)?(responsible|accountable|consulted|informed)\b/i.test(t) && !/^(joint\s+)?[RACI](\s*\/\s*[RACI])*$/.test(t)) return c;
  const roles = (t.match(/responsible|accountable|consulted|informed|\b[RACI]\b/gi) || []).map(function (r) {
    r = r.toLowerCase();
    return { r: 'Responsible', a: 'Accountable', c: 'Consulted', i: 'Informed' }[r] || r.charAt(0).toUpperCase() + r.slice(1);
  });
  const seen = {};
  const list = roles.filter(function (r) { if (seen[r]) return false; seen[r] = 1; return true; });
  return list.length ? list.join(' / ') : c;
}
function raciCells_(sp) {
  if (!sp || !Array.isArray(sp.rows) || !/\braci\b|responsib|accountab/i.test(String(sp.title || '') + ' ' + JSON.stringify(sp.columns || []))) return 0;
  let n = 0;
  sp.rows = sp.rows.map(function (r) {
    if (!Array.isArray(r)) return r;
    return r.map(function (c, j) { if (!j) return c; const v = raciCell_(c); if (v !== c) n++; return v; });
  });
  return n;
}

// A heading in Title Case inside a design's fields ("Joint Executive Steering Committee") in sentence case
var HEAD_FIELDS_ = { title: 1, label: 1, name: 1, heading: 1, header: 1 };
function nestedHeadingsCase_(sp) {
  if (typeof sentenceCase_ !== 'function') return 0;
  let n = 0;
  (function walk(o, depth) {
    if (Array.isArray(o)) { o.forEach(function (x) { walk(x, depth + 1); }); return; }
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'notes') return;
      const v = o[k];
      if (typeof v === 'string' && HEAD_FIELDS_[k] && depth > 0) {
        const words = v.trim().split(/\s+/);
        const caps = words.filter(function (w) { return /^[A-Z][a-z]{2,}/.test(w); }).length;
        if (words.length >= 3 && words.length <= 8 && caps >= 3 && caps >= words.length - 1) {
          const c = sentenceCase_(v, 2);
          if (c !== v) { o[k] = c; n++; }
        }
      } else if (v && typeof v === 'object') walk(v, depth + (Array.isArray(v) ? 0 : 1));
    });
  })(sp, 0);
  return n;
}

// An item heading left as a single generic word after its figure went ("Bar", "Industry" - deck 50 Proposal 2 slide 14)
// takes its heading from its text
var GENERIC_HEAD_RE_ = /^(bar|industry|benchmark|study|figure|metric|value|statistic|data|research|source|survey|report|chart|item|point)s?$/i;
function genericItemTitles_(sp) {
  if (!sp || !Array.isArray(sp.items)) return 0;
  let n = 0;
  sp.items.forEach(function (it) {
    if (!it || typeof it !== 'object' || !GENERIC_HEAD_RE_.test(String(it.title || '').trim())) return;
    const tx = String(it.text || '').trim();
    if (!tx) return;
    const head = tx.replace(/^(the|a|an)\s+/i, '').split(/\s+(?:that|which|across|for|to|by|in|from|during|with|when|before|after)\s+|[,.;:]/)[0].split(/\s+/).slice(0, 6).join(' ');
    if (head.split(/\s+/).length < 2) return;
    it.title = head.charAt(0).toUpperCase() + head.slice(1);
    n++;
  });
  return n;
}

// 66degrees credentials written one way ("1,000+"), never "a 600+ strong global footprint of cloud experts"
function credentialsForm_(s) {
  if (typeof s !== 'string') return s;
  let out = s.replace(/\b1000\+/g, '1,000+').replace(/\b(over|more than)\s+1,?000\s+(successful\s+)?(transformation\s+)?projects/gi, function (all, w, a, b) { return '1,000+ ' + (a || '') + (b || '') + 'projects'; });
  out = out.replace(/\b(an?\s+|our\s+)?600\+\s*(?:strong\s+)?(?:global\s+)?(?:delivery\s+)?footprint\s+of\s+(?:cloud\s+)?(?:experts|engineers|specialists|practitioners)\b/gi, function (all, art) {
    const lead = String(art || '').trim().toLowerCase();
    return (lead === 'a' || lead === 'an' ? 'a team of ' : 'our team of ') + '350+ technical experts';
  });
  return out;
}

// A title or label never ends with a comma or a semicolon ("Integrating retailer POS velocity,")
function trailingPunct_(s, k) {
  if (typeof s !== 'string' || !HEAD_FIELDS_[k]) return s;
  return s.replace(/\s*[,;:]\s*$/, '');
}

// A name the sources always write with its capital keeps it on the slides ("Dove and hellmann's scale" - deck 50 Proposal
// 1 slide 6): words written capitalised in mid-sentence at least twice in the request, the research or the notes, and
// never in lower case there
function nameCaseFromSources_(slides, ctx, sources) {
  const parts = [String((ctx && ctx.userPrompt) || '')];
  ((sources && sources.research) || []).forEach(function (r) { if (r && typeof r === 'object') Object.keys(r).forEach(function (k) { if (typeof r[k] === 'string') parts.push(r[k]); }); });
  (slides || []).forEach(function (sp) { if (sp && typeof sp.notes === 'string') parts.push(sp.notes); });
  const text = parts.join(' \n ');
  const caps = {}, lower = {};
  text.replace(/([a-z,;] )([A-Z][a-z]{3,}(?:'s)?)\b/g, function (all, pre, w) { caps[w] = (caps[w] || 0) + 1; return all; });
  Object.keys(caps).forEach(function (w) { if (new RegExp('\\b' + w.toLowerCase().replace(/'/g, "'") + '\\b').test(text)) lower[w] = 1; });
  const names = Object.keys(caps).filter(function (w) { return caps[w] >= 2 && !lower[w]; }).slice(0, 200);
  if (!names.length) return 0;
  let n = 0;
  const res = names.map(function (w) { return { re: new RegExp('\\b' + w.toLowerCase() + '\\b', 'g'), w: w }; });
  (slides || []).forEach(function (sp) {
    walkStrings_(sp, function (str, k) {
      if (k === 'notes') return str;
      let out = str;
      res.forEach(function (r) { out = out.replace(r.re, function () { n++; return r.w; }); });
      return out;
    }, { reference: 1, design: 1, type: 1, lockTag: 1 });
  });
  return n;
}

// The last checks of V.1_79 on every finished slide (run in the quality step, before the final lock)
function v79Pass_(slides, ctx, sources) {
  let n = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    const t = String(sp.type || '').toLowerCase();
    if (t === 'template') return;
    mapMitigations_(sp);
    walkStrings_(sp, function (s, k) {
      if (k === 'notes') return s;
      let v = wordsToDigits_(s);
      v = repeatedWords_(v);
      v = credentialsForm_(v);
      v = trailingPunct_(v, k);
      if (v !== s) n++;
      return v;
    }, { reference: 1, design: 1, type: 1, lockTag: 1 });
    n += sequenceLabels_(sp);
    n += raciCells_(sp);
    n += genericItemTitles_(sp);
    if (['cover', 'closing', 'agenda'].indexOf(t) === -1) n += nestedHeadingsCase_(sp);
  });
  n += targetsExact_(slides, ctx);
  n += inventedPeople_(slides, ctx, sources || null);
  n += nameCaseFromSources_(slides, ctx, sources || null);
  return n;
}
