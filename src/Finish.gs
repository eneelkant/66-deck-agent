/* =========================
   V.1_74 - the last text checks on the finished slides (after the gate, before the notes and the drawing)
   Every deck type, every slide; each check changes only what it is about and never stops a deck:
   1. titles: never a full stop at the end, never figures hung on with a dash ("... platforms - 38% productivity, 205%
      ROI over three years." -> the title, the figures to the lead when it has none)  (deck 45 Proposal 16)
   2. headings in sentence case, without a full stop (deck 45 Proposal 29 "Joint Executive Steering Committee",
      Proposal 39 "Finalize pricing, scope, and RACI to secure kickoff.")
   3. a step that only counts the steps ("Four immediate steps to start mobilization.") goes  (deck 45 Proposal 39)
   4. a count in the title or lead says what the slide shows ("all six workstreams" over five rows)  (deck 45 General 34)
   5. product names as Google Cloud writes them ("BigQuery Compute Engine" is not a product)  (deck 45 General 11)
   6. no absolute promise ("ensure zero data loss")  (deck 45 Solution 19)
   7. an item that only repeats another item of the slide goes to the notes  (deck 45 Solution 32)
========================= */

var COUNT_WORDS_ = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
var COUNTED_NOUNS_RE_ = '(workstreams?|steps?|phases?|stages?|pillars?|levers?|layers?|domains?|priorities|actions?|risks?|capabilities|mechanisms?|gates?|tiers?|principles?|decisions?|options?|controls?|components?|areas?|tracks?|waves?|workloads?|patterns?|practices?|rules?)';
var STEP_COUNT_RE_ = /^\s*(?:the\s+|these\s+|our\s+)?(?:two|three|four|five|six|seven|\d+)\s+(?:immediate\s+|next\s+|key\s+|first\s+|concrete\s+|practical\s+)?(?:steps|actions|priorities|moves)\b/i;

// names written wrongly -> as the product is called (only whole names; the brand rule keeps their capitals)
var PRODUCT_FIXES_ = [
  [/\bBigQuery Compute Engine\b/g, 'BigQuery compute'],
  [/\bBig Query\b/g, 'BigQuery'],
  [/\bGoogle Big ?Lake\b/g, 'BigLake'],
  [/\bData ?Plex\b/g, 'Dataplex'],
  [/\bData Flow\b/g, 'Dataflow'],
  [/\bPub Sub\b/g, 'Pub/Sub'],
  [/\bCloud Pub\/Sub\b/g, 'Pub/Sub'],
  [/\bGoogle Kubernetes Engine \(GKE\) Engine\b/g, 'Google Kubernetes Engine (GKE)'],
  [/\bVertex Gemini\b/g, 'Gemini on Vertex AI']
];
// promises nobody can make -> what the design does
var ABSOLUTE_FIXES_ = [
  [/\b(ensures?|guarantees?|delivers?|achieves?|provides?)\s+zero\s+data\s+loss\b/gi, function (m, v) { return (/s$/i.test(v) ? 'protects' : 'protect') + ' against data loss'; }],
  [/\b(ensures?|guarantees?|delivers?|achieves?|provides?)\s+zero\s+downtime\b/gi, function (m, v) { return (/s$/i.test(v) ? 'keeps' : 'keep') + ' downtime to a minimum'; }],
  [/\bguarantee(s)?\s+(100\s?%|full|complete|total)\s+(availability|uptime|accuracy)\b/gi, function (m, s1, q, w) { return 'target' + (s1 || '') + ' high ' + w; }],
  [/\b(eliminates?|removes?)\s+all\s+(risk|risks|downtime|errors?)\b/gi, function (m, v, w) { return (/s$/i.test(v) ? 'reduces' : 'reduce') + ' ' + w; }]
];

function finishFrame_(sp) {
  return !sp || typeof sp !== 'object' || ['cover', 'agenda', 'closing', 'section', 'template'].indexOf(String(sp.type || '').toLowerCase()) !== -1;
}

// every text field of a slide (not notes or design fields), changed in place by f(text) -> text
function finishTexts_(sp, f) {
  const SKIP = { notes: 1, reference: 1, design: 1, lockTag: 1, icon: 1, icons: 1, image: 1, logo: 1, resolvedIcons: 1, type: 1, deckLibrary: 1, material: 1, url: 1, status: 1, kind: 1, value: 1, fact_tags: 1 };
  const walk = function (o) {
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = f(o[i]); else walk(o[i]); } return; }
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (SKIP[k]) return;
      if (typeof o[k] === 'string') o[k] = f(o[k]);
      else walk(o[k]);
    });
  };
  walk(sp);
}

// 1. the title
function finishTitle_(sp) {
  let t = String(sp.title || '').trim();
  if (!t) return false;
  const before = t;
  const m = t.match(/^(.{12,}?)\s+[-–—]\s+(.*\d.*)$/);
  if (m && m[1].split(/\s+/).length >= 3) {
    t = m[1];
    const rest = m[2].replace(/\.\s*$/, '').trim();
    if (!/\d/.test(String(sp.lead || sp.subtitle || ''))) {
      const lead = rest.charAt(0).toUpperCase() + rest.slice(1) + '.';
      sp.lead = String(sp.lead || '').trim() ? lead + ' ' + String(sp.lead).trim() : lead;
    } else sp.notes = String(sp.notes || '') + '\nTitle figures: ' + rest + '.';
  }
  if (/[^.]\.$/.test(t) && t.split(/[.!?]\s/).length === 1) t = t.slice(0, -1);
  if (t !== before) { sp.title = t; return true; }
  return false;
}

// 3. a step that only counts the steps
function finishCountSteps_(sp) {
  if (!Array.isArray(sp.items) || sp.items.length < 4) return false;
  const keep = sp.items.filter(function (it) { return !(it && typeof it === 'object' && STEP_COUNT_RE_.test(String(it.title || it.label || ''))); });
  if (keep.length === sp.items.length || keep.length < 3) return false;
  sp.items = keep;
  return true;
}

// 4. "all six workstreams" over five rows: the count follows the slide
function finishCounts_(sp) {
  const n = Array.isArray(sp.rows) && sp.rows.filter(Array.isArray).length >= 2 ? sp.rows.filter(Array.isArray).length
    : Array.isArray(sp.items) ? sp.items.filter(Boolean).length : 0;
  if (n < 3 || n > 12) return false;
  const re = new RegExp('\\b(all\\s+)?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})\\s+(' + COUNTED_NOUNS_RE_.slice(1, -1) + ')\\b', 'gi');
  let changed = false;
  ['title', 'lead', 'subtitle'].forEach(function (k) {
    if (typeof sp[k] !== 'string') return;
    sp[k] = sp[k].replace(re, function (m0, all, num, noun, off, str) {
      // (a figure such as "two regions", "three-year" or a hyphenated count is not a count of the slide's items)
      if (/-$/.test(str.slice(0, off)) || /^-/.test(str.slice(off + m0.length))) return m0;
      const v = /^\d+$/.test(num) ? Number(num) : COUNT_WORDS_.indexOf(num.toLowerCase());
      if (v < 2 || v === n) return m0;
      // only when the slide has exactly one list of that many things (its rows or its items)
      changed = true;
      const w = /^\d+$/.test(num) ? String(n) : (/^[A-Z]/.test(num) ? COUNT_WORDS_[n].charAt(0).toUpperCase() + COUNT_WORDS_[n].slice(1) : COUNT_WORDS_[n]);
      return (all || '') + w + ' ' + noun;
    });
  });
  return changed;
}

// 7. an item that only says again what another item of the slide says
function finishRepeats_(sp) {
  if (!Array.isArray(sp.items) || sp.items.length < 4) return false;
  const words = function (it) {
    const parts = typeof it === 'string' ? [it] : [it && it.title, it && it.text, Array.isArray(it && it.points) ? it.points.join(' ') : ''];
    return (parts.join(' ').toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || []).filter(function (w) { return ['with', 'that', 'this', 'from', 'into', 'their', 'across', 'current', 'provide'].indexOf(w) === -1; });
  };
  const W = sp.items.map(words);
  const drop = [];
  W.forEach(function (a, i) {
    if (a.length < 4 || drop.indexOf(i) !== -1) return;
    W.forEach(function (b, j) {
      if (i === j || drop.indexOf(i) !== -1 || drop.indexOf(j) !== -1 || b.length < a.length) return;
      const set = {}; b.forEach(function (w) { set[w.slice(0, 6)] = 1; });
      const shared = a.filter(function (w) { return set[w.slice(0, 6)]; }).length;
      if (shared / a.length >= 0.7) drop.push(i);
    });
  });
  if (!drop.length || sp.items.length - drop.length < 3) return false;
  const gone = sp.items.filter(function (x, i) { return drop.indexOf(i) !== -1; });
  sp.items = sp.items.filter(function (x, i) { return drop.indexOf(i) === -1; });
  sp.notes = String(sp.notes || '') + '\nAlso on this topic: ' + gone.map(function (it) { return typeof it === 'string' ? it : [it.title, it.text, Array.isArray(it.points) ? it.points.join('; ') : ''].filter(Boolean).join(': '); }).join(' ').slice(0, 600);
  return true;
}

function finishSlides_(slides, ctx) {
  let n = 0;
  (slides || []).forEach(function (sp) {
    if (finishFrame_(sp)) return;
    const was = JSON.stringify(sp);
    finishTitle_(sp);
    if (typeof sentenceCaseHeadings_ === 'function') sentenceCaseHeadings_(sp);
    finishCountSteps_(sp);
    finishCounts_(sp);
    finishTexts_(sp, function (x) {
      let y = x;
      PRODUCT_FIXES_.forEach(function (p) { y = y.replace(p[0], p[1]); });
      ABSOLUTE_FIXES_.forEach(function (p) { y = y.replace(p[0], p[1]); });
      return y;
    });
    finishRepeats_(sp);
    if (JSON.stringify(sp) !== was) n++;
  });
  if (n && ctx && ctx.log) ctx.log.push('Finish check: ' + n + ' slide(s) tidied (titles, headings, counts, names, claims).');
  return n;
}
