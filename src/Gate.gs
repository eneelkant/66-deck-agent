/* =========================
   V.1_73 - STEP 4: the checker blocks a bad slide
   Every slide is drawn once before it goes into the deck. A slide the checker still finds a real problem on - nothing
   under the title, text cut short, content or figures left out, a text half outside its box, a shape off the slide,
   texts on top of each other, only headings shown - is not kept as it is:
   1. it is written again once, to fit its design (Gemini, with a response schema; all such slides of a part in one call;
      no new figures); the new text is used only when the slide then passes;
   2. a slide that still fails is drawn with a safe layout of its library that shows its content whole (cards or a list
      of the same content).
   A deck has a budget for this (slides and time), so it always finishes inside the Apps Script time limit. Never stops
   a deck: a slide the gate cannot help is drawn as before (and reported by the checker as before).
========================= */

var GATE_BLOCK_ = ['empty', 'cut', 'lost-content', 'lost-figures', 'detached', 'off-slide', 'overlap', 'headings-only'];
var GATE_SKIP_TYPES_ = { cover: 1, agenda: 1, closing: 1, section: 1, template: 1, case_study: 1 };
var GATE_MAX_REWRITE_ = 8;           // slides written again per part (one Gemini call)
var GATE_TIME_MS_ = 210000;          // no rewrite after this long into a part

function gateIssues_(sp, ctx) {
  try {
    const o = ENGINE.render({ slides: [sp] }, { dateLabel: '', tokens: (ctx && ctx.tokens) || null })[0];
    return ((o && o.qa && o.qa.issues) || []).filter(function (k) { return GATE_BLOCK_.indexOf(k) !== -1; });
  } catch (e) { return []; }
}

var GATE_WORDS_ = { empty: 'nothing shows under the title', cut: 'a text is cut short', 'lost-content': 'part of the content does not show',
  'lost-figures': 'the figures do not show', detached: 'a text runs out of its box', 'off-slide': 'a shape runs off the slide',
  overlap: 'texts sit on top of each other', 'headings-only': 'only the headings show, not what they say' };

// the shape of a rewritten slide: the same fields it had (items, points, rows), shorter or complete
var GATE_SCHEMA_ = {
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
          items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, text: { type: 'STRING' }, label: { type: 'STRING' } } } },
          points: { type: 'ARRAY', items: { type: 'STRING' } },
          rows: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } }
        },
        required: ['id']
      }
    }
  },
  required: ['slides']
};

// Gemini's rewrite applied to a copy: texts replace texts in the same places; values, icons and designs stay
function gateApply_(sp, ans) {
  const t = JSON.parse(JSON.stringify(sp));
  if (ans.title && String(ans.title).trim()) t.title = String(ans.title).trim();
  if (typeof ans.lead === 'string' && (t.lead || ans.lead.trim())) t.lead = ans.lead.trim();
  if (Array.isArray(ans.items) && Array.isArray(t.items) && ans.items.length === t.items.length) {
    t.items = t.items.map(function (it, k) {
      const a = ans.items[k] || {};
      if (!it || typeof it !== 'object') return typeof it === 'string' && a.text ? String(a.text) : it;
      const o = Object.assign({}, it);
      if (a.title && String(a.title).trim()) { if ('title' in o || !('label' in o)) o.title = String(a.title).trim(); }
      if (typeof a.label === 'string' && a.label.trim() && 'label' in o) o.label = a.label.trim();
      if (typeof a.text === 'string' && a.text.trim()) { o.text = a.text.trim(); delete o.points; }
      return o;
    });
  }
  if (Array.isArray(ans.points) && Array.isArray(t.points) && ans.points.length >= Math.min(2, t.points.length)) t.points = ans.points.map(String).filter(Boolean);
  if (Array.isArray(ans.rows) && Array.isArray(t.rows) && ans.rows.length === t.rows.length &&
      ans.rows.every(function (r, k) { return Array.isArray(r) && Array.isArray(t.rows[k]) && r.length === t.rows[k].length; })) t.rows = ans.rows.map(function (r) { return r.map(String); });
  return t;
}

// the safe layout: the slide's content as cards or a list, in a design of its library that shows it whole
function gateSafeLayout_(sp, ctx) {
  let flat = null;
  try { flat = ENGINE.flatten(sp); } catch (e) { return null; }
  // a figure stays with its words ("45% faster report builds") - the safe layout never drops a figure
  if (Array.isArray(flat.items)) flat.items = flat.items.map(function (it) {
    if (!it || typeof it !== 'object' || !String(it.value == null ? '' : it.value).trim()) return it;
    const head = String(it.label || it.title || '').replace(/^\s*target\s*:\s*/i, '');
    const v = String(it.value).trim();
    const o = Object.assign({}, it, { title: head.indexOf(v) === 0 ? head : v + (head ? ' ' + head.charAt(0).toLowerCase() + head.slice(1) : '') });
    delete o.value; delete o.label;
    return o;
  });
  const lib = sp.deckLibrary === 'proposal' || sp.deckLibrary === 'solution' ? sp.deckLibrary : 'general';
  const tries = [];
  ['cards', 'bullets', 'process'].forEach(function (type) {
    (ENGINE.variantsFor(type) || []).forEach(function (v) { if (v && v.tag && ENGINE.inLibrary(v.tag, lib)) tries.push({ type: type, tag: v.tag }); });
  });
  if (lib === 'general') tries.push({ type: 'cards', tag: null }, { type: 'bullets', tag: null });
  for (let i = 0; i < tries.length && i < 40; i++) {
    const trial = Object.assign({}, flat, { type: tries[i].type, reference: tries[i].tag ? { tag: tries[i].tag } : null });
    delete trial.design; delete trial.lockTag;
    if (!gateIssues_(trial, ctx).length) return trial;
  }
  return null;
}

// the gate on a set of slides (a short deck, or one part of a long deck); returns { rewritten, safe, left }
function gateSlides_(slides, ctx, started) {
  const res = { rewritten: 0, safe: 0, left: 0 };
  if (typeof ENGINE === 'undefined' || !ENGINE.render || !Array.isArray(slides)) return res;
  const bad = [];
  slides.forEach(function (sp, i) {
    if (!sp || typeof sp !== 'object' || GATE_SKIP_TYPES_[String(sp.type || '').toLowerCase()] || sp.diagram || sp.lockTag) return;
    const iss = gateIssues_(sp, ctx);
    if (iss.length) bad.push({ i: i, iss: iss });
  });
  if (!bad.length) return res;
  // 1. written again once (one call), when there is time
  const timeLeft = !started || Date.now() - started < GATE_TIME_MS_;
  if (timeLeft && ctx && ctx.apiKey) {
    const ask = bad.slice(0, GATE_MAX_REWRITE_).map(function (b) {
      const sp = slides[b.i];
      const cur = {};
      ['title', 'lead', 'items', 'points', 'rows', 'columns'].forEach(function (k) { if (sp[k] != null) cur[k] = sp[k]; });
      return { id: b.i, problems: b.iss.map(function (k) { return GATE_WORDS_[k] || k; }), current: cur };
    });
    const prompt = [
      'These slides of a ' + ((ctx.brand && ctx.brand.name) || '66degrees') + ' presentation do not fit their design. Write each one again so it fits:',
      '- keep the same number of items, points and rows, in the same order, about the same subjects;',
      '- make every text shorter where it is cut or runs out of its box (about two thirds of its length), and write the',
      '  missing description where only a heading shows (one sentence of 10-18 words);',
      '- keep every figure exactly as it is and add no new figures, names, clients or claims; sentence case, plain text.',
      'Return ONLY JSON: {"slides":[{"id":0,"title":"","lead":"","items":[{"title":"","text":"","label":""}],"points":[""],"rows":[[""]]}]}',
      JSON.stringify(ask)
    ].join('\n');
    let out = null;
    try {
      out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1, { schema: GATE_SCHEMA_ }); });
    } catch (e) { if (ctx.log) ctx.log.push('Slide gate: rewrite skipped (' + e.message + ').'); }
    ((out && out.slides) || []).forEach(function (ans) {
      const b = bad.filter(function (x) { return x.i === ans.id; })[0];
      if (!b || b.done) return;
      const trial = gateApply_(slides[b.i], ans);
      if (!gateIssues_(trial, ctx).length) { slides[b.i] = trial; b.done = true; res.rewritten++; }
    });
  }
  // 2. the safe layout for what still fails
  bad.forEach(function (b) {
    if (b.done) return;
    const safe = gateSafeLayout_(slides[b.i], ctx);
    if (safe) { slides[b.i] = safe; b.done = true; res.safe++; }
    else res.left++;
  });
  if (ctx && ctx.log && (res.rewritten || res.safe || res.left)) {
    ctx.log.push('Slide gate: ' + res.rewritten + ' slide(s) written again to fit, ' + res.safe + ' drawn with a safe layout' + (res.left ? ', ' + res.left + ' left as they were' : '') + '.');
  }
  return res;
}
