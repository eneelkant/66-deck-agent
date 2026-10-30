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
/* V.1_74 (deck 45 Proposal 30: three RACI headings drawn as "[object Object]"): a column or a cell written as an object
   ({"label": "66degrees"}, {"party": ..., "role": ...}) is its text - on every table, before anything reads it */
function cellText_(c) {
  if (c == null) return '';
  if (typeof c !== 'object') return String(c);
  if (Array.isArray(c)) return c.map(cellText_).filter(Boolean).join(', ');
  const k = ['text', 'title', 'label', 'name', 'party', 'header', 'heading', 'role', 'value'].filter(function (x) { return typeof c[x] === 'string' || typeof c[x] === 'number'; })[0];
  if (k) return String(c[k]);
  const first = Object.keys(c).map(function (x) { return c[x]; }).filter(function (v) { return typeof v === 'string' || typeof v === 'number'; })[0];
  return first == null ? '' : String(first);
}
function normalizeCells_(sp) {
  if (!sp || typeof sp !== 'object') return false;
  // (only a table - rows under column headings; the columns of a diagram or an architecture flow are objects with their
  //  own items and stay as they are)
  if (!Array.isArray(sp.rows) || !sp.rows.some(Array.isArray)) return false;
  let changed = false;
  if (Array.isArray(sp.columns) && sp.columns.some(function (c) { return c && typeof c === 'object' && !Array.isArray(c) && !Array.isArray(c.items) && !Array.isArray(c.points); })) {
    sp.columns = sp.columns.map(function (c) { return c && typeof c === 'object' && (Array.isArray(c.items) || Array.isArray(c.points)) ? c : cellText_(c); });
    changed = true;
  }
  if (Array.isArray(sp.rows)) sp.rows = sp.rows.map(function (r) {
    if (!Array.isArray(r) || !r.some(function (c) { return c && typeof c === 'object'; })) return r;
    changed = true;
    return r.map(cellText_);
  });
  return changed;
}
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
  // V.1_74 (deck 45 General 33: "Integrated team structure and governance" renamed "Pricing options: ..." because two
  // cards said "pods", while slide 37 was the pricing slide): a slide is a pricing slide by its content only when no
  // slide of the deck is titled for pricing, and never when its title says team, governance or structure
  const pricedByTitle = ctx && Array.isArray(ctx.outlineTitles) && ctx.outlineTitles.some(function (t) { return String(t || '') !== title && PRICING_TITLE_RE_.test(String(t || '')); });
  const teamTitle = /\b(team|governance|structure|committee|steering|operating model|raci|roles?)\b/i.test(title);
  if (PRICING_TITLE_RE_.test(title) || (!pricedByTitle && !teamTitle && asked.indexOf('pricing') !== -1 && items.length >= 2 &&
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
    // (V.1_73: a slide titled for mitigations shows them - a fix, a mitigation, points, or a text that says how)
    if (/mitigat|how we (handle|address|manage)/i.test(String(sp.title || '')) && items.some(function (it) { return it && !wordsIn_(it.fix || it.mitigation) && !(Array.isArray(it.points) && it.points.length) && !/\b(mitigat\w*|by |through|we will|we |enforce|deploy|configure|schedule|run |use )/i.test(itemText_(it)); })) gaps.push('a risk without its mitigation');
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

/* V.1_73 (deck 44 Proposal 35 "Consulted for scope and strategy inputs", Solution 37 rows as {label, left, right} with a
   sentence in each cell): a RACI is put in shape by the code - rows written as objects become table rows (the columns
   kept), and a cell that starts with its role keeps only the role ("Accountable / Responsible" stays); what a cell said
   after its role goes to the speaker notes */
var ROLE_START_RE_ = /^\s*((?:responsible|accountable|consulted|informed)(?:\s*(?:\/|&|,|and)\s*(?:responsible|accountable|consulted|informed))*)\b/i;
var RACI_CLAUSE_RE_ = /^\s*(?:and\s+|while\s+|whereas\s+)?([A-Za-z0-9][\w&.'\- ]{0,40}?)\s+(?:is|are|remains?|acts as)\s+(?:the\s+)?(responsible|accountable|consulted|informed)\b(.*)$/i;
/* V.1_74 (deck 45 General 34: one column "Role assignment and governance responsibility" with "66degrees is Responsible
   for ...; ZoomInfo is Accountable for ..., Consulted on ..." in every row): the parties named in such sentences become
   the columns, each cell the party's role on that workstream (its first role there); what follows goes to the notes */
function raciFromSentences_(sp) {
  const rows = (sp.rows || []).filter(Array.isArray);
  if (rows.length < 2) return false;
  const parties = [], table = [], extra = [];
  let hit = 0;
  rows.forEach(function (r) {
    const roles = {};
    r.slice(1).forEach(function (c) {
      String(c || '').split(/\s*;\s*|\.\s+(?=[A-Z0-9])/).forEach(function (cl) {
        const m = cl.match(RACI_CLAUSE_RE_);
        if (!m) return;
        const party = m[1].replace(/^(the|both)\s+/i, '').trim();
        if (!party || party.split(/\s+/).length > 4) return;
        const key = party.toLowerCase();
        if (!parties.some(function (p) { return p.toLowerCase() === key; })) parties.push(party);
        const name = parties.filter(function (p) { return p.toLowerCase() === key; })[0];
        if (!roles[name]) roles[name] = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
        extra.push(String(r[0] || '') + ': ' + cl.trim().replace(/[.;]+$/, '') + '.');
      });
    });
    if (Object.keys(roles).length) hit++;
    table.push({ head: String(r[0] || ''), roles: roles });
  });
  if (parties.length < 2 || hit < Math.ceil(rows.length * 0.6)) return false;
  const cols = Array.isArray(sp.columns) ? sp.columns.map(cellText_) : [];
  sp.columns = [cols[0] && !/role|responsib|assignment|governance/i.test(cols[0]) ? cols[0] : 'Workstream'].concat(parties);
  sp.rows = table.map(function (t) { return [t.head].concat(parties.map(function (p) { return t.roles[p] || ''; })); });
  sp.notes = String(sp.notes || '') + '\nRoles in detail: ' + extra.join(' ').slice(0, 1500);
  return true;
}
function normalizeRaci_(sp) {
  let changed = false;
  if (!Array.isArray(sp.rows)) return false;
  if (normalizeCells_(sp)) changed = true;
  const sentences = sp.rows.some(function (r) { return Array.isArray(r) && r.slice(1).some(function (c) { return /\b(is|are)\s+(the\s+)?(responsible|accountable|consulted|informed)\b/i.test(String(c || '')); }); });
  if (sentences && raciFromSentences_(sp)) { sp.type = 'table'; delete sp.design; sp.reference = null; return true; }
  const cols = Array.isArray(sp.columns) ? sp.columns.map(cellText_) : [];
  // rows as objects: {label|workstream|aspect, then one key per party (left / right / the column names)}
  if (sp.rows.some(function (r) { return r && typeof r === 'object' && !Array.isArray(r); })) {
    sp.rows = sp.rows.map(function (r) {
      if (Array.isArray(r) || !r || typeof r !== 'object') return r;
      const keys = Object.keys(r);
      const head = r.label || r.workstream || r.aspect || r.title || r.name || r.area || '';
      const rest = keys.filter(function (k) { return ['label', 'workstream', 'aspect', 'title', 'name', 'area', 'icon'].indexOf(k) === -1; });
      // the columns given name the parties in order; otherwise left / right / the other keys in their order
      const byCol = cols.slice(1).map(function (c) { const k = rest.filter(function (x) { return x.toLowerCase() === String(c).toLowerCase(); })[0]; return k ? r[k] : undefined; });
      const vals = byCol.some(function (v) { return v !== undefined; }) ? byCol : rest.map(function (k) { return r[k]; });
      return [String(head)].concat(vals.map(function (v) { return v == null ? '' : String(typeof v === 'object' ? (v.text || v.title || '') : v); }));
    });
    changed = true;
  }
  const extra = [];
  sp.rows = sp.rows.map(function (r) {
    if (!Array.isArray(r)) return r;
    return r.map(function (c, j) {
      if (!j || typeof c !== 'string') return c;
      const free = /deliverable|output|artifact|notes?|description|scope|outcome|milestone/i.test(String(cols[j] || ''));
      const m = !free && c.match(ROLE_START_RE_);
      if (!m || m[0].trim() === c.trim().replace(/\.$/, '')) return c;
      const role = m[1].replace(/\s*(\/|&|,|and)\s*/gi, ' / ').replace(/\b\w/g, function (x) { return x.toUpperCase(); }).replace(/\b(Responsible|Accountable|Consulted|Informed)\b/g, function (x) { return x; });
      const roleOut = role.charAt(0) + role.slice(1).replace(/ \/ (\w)/g, function (a, w) { return ' / ' + w.toLowerCase(); });
      const rest = c.slice(m[0].length).replace(/^[\s,:;.\-–]+/, '').trim();
      if (rest) extra.push(String(r[0] || '') + ' (' + String(cols[j] || '') + '): ' + rest);
      changed = true;
      return roleOut;
    });
  });
  // the first column (the workstreams) has its heading
  const w = Math.max.apply(null, sp.rows.filter(Array.isArray).map(function (r) { return r.length; }).concat([0]));
  if (w && cols.length === w - 1) { sp.columns = ['Workstream'].concat(cols); changed = true; }
  if (extra.length) sp.notes = String(sp.notes || '') + '\nRoles in detail: ' + extra.join(' ').slice(0, 1500);
  if (changed) { sp.type = 'table'; delete sp.design; sp.reference = null; }
  return changed;
}

/* V.1_73 (deck 44 Solution 38: "Risk: ...; Impact: ...; Mitigation: ...; Mitigation: ..." in one field, so the slide
   showed the risks and none of their mitigations): fields written as a record are read - the risk and its impact are the
   text, the mitigations are the fix */
function splitRiskRecords_(sp) {
  if (!Array.isArray(sp.items)) return false;
  let n = 0;
  sp.items.forEach(function (it) {
    if (!it || typeof it !== 'object') return;
    const src = String(it.fix || it.text || '');
    if (!/\bmitigation\s*:/i.test(src) || !/\b(risk|impact)\s*:/i.test(src)) return;
    const parts = src.split(/\s*[;·|]\s*|\s*\.\s+(?=(?:risk|impact|mitigation|owner|likelihood)\s*:)/i).map(function (x) { return x.trim(); }).filter(Boolean);
    const get = function (name) { return parts.filter(function (x) { return new RegExp('^' + name + '\\s*:', 'i').test(x); }).map(function (x) { x = x.replace(/^[a-z]+\s*:\s*/i, '').trim(); x = x.charAt(0).toUpperCase() + x.slice(1); return /[.!?]$/.test(x) ? x : x + '.'; }); };
    const mit = get('mitigation'), risk = get('risk'), impact = get('impact');
    if (!mit.length) return;
    it.fix = mit.join(' ');
    it.text = risk.concat(impact).join(' ');
    n++;
  });
  return n > 0;
}

// what a slide said before it is made the KPI slide (it goes to the notes)
function kpiSourceText_(sp) {
  const out = [];
  const walk = function (v) {
    if (v == null) return;
    if (typeof v === 'string') { if (/[a-z]{3}/i.test(v)) out.push(v.trim()); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') ['label', 'title', 'text', 'points', 'items'].forEach(function (k) { walk(v[k]); });
  };
  ['items', 'points', 'left', 'right', 'rows'].forEach(function (k) { walk(sp[k]); });
  return out.map(function (x) { return /[.!?]$/.test(x) ? x : x + '.'; }).join(' ');
}

// the contract pass over the written slides (returns the number of slides put in shape)
function conformSlides_(slides, ctx) {
  let n = 0;
  const ask = [];
  const state = (ctx && ctx.deckState) || (ctx ? (ctx.deckState = {}) : {});
  const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  (slides || []).forEach(function (sp, i) {
    if (sp && typeof sp === 'object' && splitRiskRecords_(sp)) n++;         // V.1_73: on every slide
    if (sp && typeof sp === 'object' && normalizeCells_(sp)) n++;           // V.1_74: no "[object Object]" in a table
    let kind = contractKind_(sp, ctx);
    // V.1_74 (deck 45 Proposal: "KPI measurement baselines and tracking mechanisms" was the deck's KPI slide in the
    // outline, Gemini wrote it as two lists - so the targets 95% and 50% were shown nowhere): the slide the outline gave
    // the KPI topic is the KPI slide when the request gives target figures and the deck has none yet
    const t0 = String((sp && sp.type) || '').toLowerCase();
    if (kind !== 'kpi' && sp && typeof sp === 'object' && targets.length >= 2 && !state.kpiSlide && ['section', 'agenda', 'cover', 'closing', 'template'].indexOf(t0) === -1 &&
        typeof onceTopicOf_ === 'function' && onceTopicOf_(sp.title) === 'kpi' && !/\b(slas?|slos?)\b/i.test(String(sp.title || ''))) {
      kind = 'kpi';
      const before = kpiSourceText_(sp);
      if (before) sp.notes = String(sp.notes || '') + '\nAlso on this topic: ' + before.slice(0, 1200);
    }
    if (kind === 'kpi') state.kpiSlide = String(sp.title || '').slice(0, 80) || true;
    if (!kind) return;
    if (kind === 'raci' && normalizeRaci_(sp)) n++;                          // V.1_73: by the code first
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
