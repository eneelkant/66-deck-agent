/* =========================
   V.1_72 - STEP 3: every slide of a known kind has the shape its designs need
   The slide kinds that broke most (KPIs, RACI, team, risks, pricing, next steps) each have a contract: the fields and the
   number of items its designs draw. After the content is written, every slide of such a kind is checked against its
   contract:
   - KPI and pricing slides are put in shape by the code (the brief gives the KPI figures; pricing says it is pricing);
   - a RACI, team, risks or next-steps slide that is not in shape is written again by Gemini, all of them in one call,
     with a response schema (Brand.gs callGeminiJSON opts.schema), so the answer cannot come back in another shape;
   - an answer is used only when it passes the contract; otherwise the slide stays as it was (the checks after it run
     as before). This never stops a deck.
   The schema of the brief (Brief.gs) is here too.
========================= */

var ROLE_WORD_RE_ = /^\s*(responsible|accountable|consulted|informed|r|a|c|i)(\s*[\/&,]\s*(responsible|accountable|consulted|informed|r|a|c|i))*\s*(\([raci\/ ]+\))?\s*\.?\s*$/i;
var PRICING_TITLE_RE_ = /\b(pric\w*|commercial|investment options?|fees?|cost options?)\b/i;
var ENGAGEMENT_RE_ = /\b(engagement models?|fixed[- ](scope|price|fee)|time and materials|t&m|milestone[- ]based|staff aug\w*|pods?\b|retainer|managed services?|velocity engineering|direct hire|subscription|outcome[- ]based)\b/i;

function wordsIn_(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
function itemText_(it) { return typeof it === 'string' ? it : String((it && (it.text || it.description || it.fix)) || ''); }

// the contract kind of a slide ('' = none)
function contractKind_(sp, ctx) {
  if (!sp || typeof sp !== 'object') return '';
  const t = String(sp.type || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'section', 'template', 'case_study'].indexOf(t) !== -1) return '';
  const title = String(sp.title || '');
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  if (/\braci\b|responsibility matrix|who does what/i.test(title)) return 'raci';
  if ((typeof isKpiSlide_ === 'function' && isKpiSlide_(sp)) ||
      (/\b(kpis?|success (measures|metrics|criteria)|key performance|measur(es|ing) of success|target (figures|metrics))\b/i.test(title) && items.length >= 2)) return 'kpi';
  if (/\bnext steps?\b|getting started|first steps?\b|launch the (engagement|partnership|project)/i.test(title)) return 'next';
  if (/\brisks?\b/i.test(title) && !/\brisk[- ]based\b/i.test(title)) return 'risks';
  const asked = ctx && ctx.brief && Array.isArray(ctx.brief.families) ? ctx.brief.families : [];
  if (PRICING_TITLE_RE_.test(title) || (asked.indexOf('pricing') !== -1 && items.length >= 2 &&
      items.filter(function (it) { return ENGAGEMENT_RE_.test(String((it && (it.title || it.label)) || '') + ' ' + itemText_(it)); }).length >= 2)) return 'pricing';
  if (t === 'team' || /team structure|joint team|delivery team|team and governance|operating model/i.test(title)) return 'team';
  return '';
}

// does a slide meet its contract? (a list of what is missing; empty = in shape)
function contractGaps_(sp, kind, ctx) {
  const gaps = [];
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  // what an item says: its text, its mitigation and its points together
  const said = function (it) { return wordsIn_(itemText_(it)) + wordsIn_(it && (it.fix || it.mitigation)) + (Array.isArray(it && it.points) ? it.points.reduce(function (a, p) { return a + wordsIn_(typeof p === 'string' ? p : (p && (p.text || p.title))); }, 0) : 0); };
  // a table with its rows, a team with its lanes or org chart, a comparison with its two sides: already in a shape its designs draw
  const rowsN = Array.isArray(sp.rows) ? sp.rows.filter(function (r) { return r && typeof r === 'object'; }).length : 0;
  if (kind !== 'raci' && kind !== 'kpi' && kind !== 'pricing' && (rowsN >= 3 || (Array.isArray(sp.teams) && sp.teams.length >= 2) || sp.org ||
      (sp.left && sp.right && (sp.left.points || sp.left.items) && (sp.right.points || sp.right.items)))) return gaps;
  if (kind === 'kpi') {
    const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
    if (String(sp.type || '').toLowerCase() !== 'stats') gaps.push('not KPI tiles');
    if (items.length < 2 || items.length > 4) gaps.push('2-4 tiles');
    if (items.some(function (it) { return !(it && /\d/.test(String(it.value || ''))); })) gaps.push('a tile without its figure');
    if (targets.length >= 2 && items.map(function (it) { return figKey_(String((it && it.value) || '')); }).join('|') !== targets.slice(0, 4).map(function (f) { return f.key; }).join('|')) gaps.push('not the request\'s figures in order');
  } else if (kind === 'raci') {
    const rows = Array.isArray(sp.rows) ? sp.rows.filter(Array.isArray) : [];
    const cols = Array.isArray(sp.columns) ? sp.columns : [];
    if (String(sp.type || '').toLowerCase() !== 'table') gaps.push('not a table');
    if (cols.length < 3 || rows.length < 3) gaps.push('workstreams and at least two parties');
    // (a column of deliverables or notes beside the parties is fine - General 25 "Primary deliverable")
    const free = cols.map(function (c) { return /deliverable|output|artifact|notes?|description|scope|outcome|milestone/i.test(String(c || '')); });
    if (rows.some(function (r) { return r.slice(1).some(function (c, j) { return !free[j + 1] && String(c || '').trim() && !ROLE_WORD_RE_.test(String(c)); }); })) gaps.push('cells that are not roles');
  } else if (kind === 'team') {
    const teams = Array.isArray(sp.teams) ? sp.teams : [];
    const ok = teams.length >= 2 || (items.length >= 3 && items.length <= 6 && items.every(function (it) { return it && (it.title || it.label || it.name) && said(it) >= 8; }));
    if (!ok) gaps.push('3-5 roles or teams, each with what it does');
  } else if (kind === 'risks') {
    if (items.length < 2 || items.length > 6) gaps.push('2-6 risks');
    if (items.some(function (it) { return !(it && (it.title || it.label) && said(it) >= 8); })) gaps.push('a risk without its mitigation');
  } else if (kind === 'next') {
    if (items.length < 3 || items.length > 6) gaps.push('3-6 steps');
    if (items.some(function (it) { return !(it && (it.title || it.label) && said(it) >= 6); })) gaps.push('a step without what it involves');
  } else if (kind === 'pricing') {
    if (!PRICING_TITLE_RE_.test(String(sp.title || ''))) gaps.push('a title that says pricing');
  }
  return gaps;
}

// the shape Gemini must answer in (one schema for every slide it rewrites; each kind uses its own fields)
var CONTRACT_SCHEMA_ = {
  type: 'OBJECT',
  properties: {
    slides: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'INTEGER' },
          title: { type: 'STRING' },
          lead: { type: 'STRING' },
          columns: { type: 'ARRAY', items: { type: 'STRING' } },
          rows: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { title: { type: 'STRING' }, text: { type: 'STRING' }, fix: { type: 'STRING' }, owner: { type: 'STRING' } },
              required: ['title', 'text']
            }
          }
        },
        required: ['id', 'title']
      }
    }
  },
  required: ['slides']
};

var CONTRACT_ASK_ = {
  raci: 'a RACI table: "columns" = ["Workstream", then one column per party, e.g. "66degrees", "<client> IT", "<client> business"]; "rows" = 4-6 workstreams, each [workstream name, then one role per party: Responsible, Accountable, Consulted or Informed - nothing else in those cells]. No items.',
  team: 'a team slide: "items" = 3-4 roles or teams (both organisations), each {"title": the role or team (2-5 words), "text": what it does and decides (14-24 words)}.',
  risks: 'a risks slide: "items" = 3-4 risks, each {"title": the risk (2-6 words), "text": its impact (8-16 words), "fix": the mitigation (10-20 words)}.',
  next: 'a next-steps slide: "items" = 3-4 concrete first actions in order, each {"title": the action (2-6 words), "text": what it involves (10-20 words), "owner": who leads it (2-4 words)}.'
};

// KPI slide in shape by the code: the brief's figures in its order, each with the text of the tile it matches
function conformKpi_(sp, ctx) {
  const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  if (targets.length < 2) return false;
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  const used = [];
  const tiles = targets.slice(0, 4).map(function (f) {
    let best = -1, bestScore = 0;
    items.forEach(function (it, k) {
      if (used.indexOf(k) !== -1) return;
      const head = String(it.label || it.title || '').replace(/^\s*target\s*:\s*/i, '');
      const sameFig = it.value && figKey_(String(it.value)) === f.key;
      const sc = (sameFig ? 10 : 0) + sharedWords_(head + ' ' + itemText_(it), f.label);
      if (sc > bestScore) { best = k; bestScore = sc; }
    });
    const it = best >= 0 ? items[best] : null;
    if (best >= 0) used.push(best);
    const label = it ? String(it.label || it.title || '').replace(/^\s*target\s*:\s*/i, '').replace(new RegExp('^' + String(f.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '') : '';
    return { value: f.value, label: (label || f.labelCap).replace(/^./, function (c) { return c.toUpperCase(); }), text: it ? itemText_(it) : '' };
  });
  sp.type = 'stats'; sp.items = tiles; sp.points = [];
  ['value', 'label', 'text', 'note', 'headline', 'groups', 'banner', 'columns', 'rows'].forEach(function (k) { delete sp[k]; });
  delete sp.design; delete sp.lockTag; sp.reference = null;
  return true;
}

// pricing slide in shape by the code: its title says pricing; without prices given, it says how pricing is settled
function conformPricing_(sp, ctx) {
  let changed = false;
  if (!PRICING_TITLE_RE_.test(String(sp.title || ''))) {
    sp.title = sentenceCase_('Pricing options: ' + String(sp.title || 'engagement models').replace(/^./, function (c) { return c.toLowerCase(); }), 1);
    changed = true;
  }
  const noPrices = !(ctx && ctx.brief && Array.isArray(ctx.brief.prices) && ctx.brief.prices.length);
  if (noPrices && !/pricing is confirmed after the scoping workshop/i.test(JSON.stringify(Object.assign({}, sp, { notes: '' })))) {
    if (!String(sp.takeaway || '').trim()) { sp.takeaway = 'Pricing is confirmed after the scoping workshop.'; changed = true; }
  }
  return changed;
}

// apply Gemini's rewrite of one slide when it passes the contract
function applyContractAnswer_(sp, kind, ans, ctx) {
  if (!ans || typeof ans !== 'object') return false;
  const trial = JSON.parse(JSON.stringify(sp));
  if (ans.title && String(ans.title).trim()) trial.title = String(ans.title).trim();
  if (ans.lead && String(ans.lead).trim()) trial.lead = String(ans.lead).trim();
  if (kind === 'raci') {
    trial.type = 'table';
    trial.columns = (ans.columns || []).map(String);
    trial.rows = (ans.rows || []).filter(Array.isArray).map(function (r) { return r.map(function (c) { return String(c == null ? '' : c); }); });
    delete trial.items; delete trial.points;
  } else {
    trial.items = (ans.items || []).filter(function (it) { return it && it.title; }).map(function (it) {
      const o = { title: String(it.title), text: String(it.text || '') };
      if (kind === 'risks' && it.fix) o.fix = String(it.fix);
      if (kind === 'next' && it.owner) o.tag = String(it.owner);
      return o;
    });
    if (kind === 'team') { trial.type = 'cards'; delete trial.teams; }
    if (kind === 'next') trial.type = 'process';
    if (kind === 'risks') trial.type = 'cards';
    delete trial.points;
  }
  if (contractGaps_(trial, kind, ctx).length) return false;
  Object.keys(sp).forEach(function (k) { delete sp[k]; });
  Object.assign(sp, trial);
  delete sp.design; sp.reference = null;
  return true;
}

// the contract pass over the written slides (returns the number of slides put in shape)
function conformSlides_(slides, ctx) {
  let n = 0;
  const ask = [];
  (slides || []).forEach(function (sp, i) {
    const kind = contractKind_(sp, ctx);
    if (!kind) return;
    const gaps = contractGaps_(sp, kind, ctx);
    if (!gaps.length) return;
    if (kind === 'kpi') { if (conformKpi_(sp, ctx)) n++; return; }
    if (kind === 'pricing') { if (conformPricing_(sp, ctx)) n++; return; }
    ask.push({ id: i, kind: kind, gaps: gaps });
  });
  if (ask.length && ctx && ctx.apiKey) {
    const list = ask.slice(0, 8).map(function (a) {
      const sp = slides[a.id];
      return { id: a.id, kind: a.kind, write: CONTRACT_ASK_[a.kind], missing: a.gaps, current: Object.keys(sp).reduce(function (o, k) { if (['notes', 'reference', 'resolvedIcons', 'design', 'fact_tags'].indexOf(k) === -1) o[k] = sp[k]; return o; }, {}) };
    });
    const prompt = [
      'These slides of a ' + ((ctx.brand && ctx.brand.name) || '66degrees') + ' presentation (request: "' + String(ctx.userPrompt || '').slice(0, 400) + '") are not in the shape their kind needs.',
      'Write each one again in exactly the shape in "write", keeping its subject, its title (shortened only if needed) and what it already says.',
      typeof briefPromptBlock_ === 'function' ? briefPromptBlock_(ctx) : '',
      'No new figures, clients, awards or claims about 66degrees. Sentence case, plain text, no markdown.',
      'Return ONLY JSON: {"slides":[{"id":0,"title":"","lead":"","items":[{"title":"","text":"","fix":"","owner":""}],"columns":[""],"rows":[[""]]}]}',
      JSON.stringify(list)
    ].filter(Boolean).join('\n');
    let out = null;
    try {
      out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1, { schema: CONTRACT_SCHEMA_ }); });
    } catch (e) { if (ctx.log) ctx.log.push('Slide shape step skipped: ' + e.message); }
    ((out && out.slides) || []).forEach(function (ans) {
      const a = ask.filter(function (x) { return x.id === ans.id; })[0];
      if (a && applyContractAnswer_(slides[a.id], a.kind, ans, ctx)) n++;
    });
  }
  if (n && ctx && ctx.log) ctx.log.push('Slide shapes: ' + n + ' slide(s) put in the shape their kind needs (KPIs, RACI, team, risks, pricing, next steps).');
  return n;
}

// V.1_72: the brief's answer shape (Brief.gs buildBrief_)
var BRIEF_SCHEMA_ = {
  type: 'OBJECT',
  properties: {
    client: { type: 'OBJECT', properties: { name: { type: 'STRING' }, domain: { type: 'STRING' } } },
    slideCount: { type: 'INTEGER' },
    topics: { type: 'ARRAY', items: { type: 'STRING' } },
    figures: { type: 'ARRAY', items: { type: 'OBJECT', properties: { value: { type: 'STRING' }, measure: { type: 'STRING' }, kind: { type: 'STRING', enum: ['target', 'fact'] } }, required: ['value', 'measure', 'kind'] } },
    prices: { type: 'ARRAY', items: { type: 'STRING' } },
    facts: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['topics', 'figures', 'prices']
};
