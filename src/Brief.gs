/* =========================
   V.1_70 - THE BRIEF: the request is the source of truth
   1. Before the outline, the request (and the attached files) is read once into a fixed brief: the client, the slide
      count, the topics asked for in order, the figures asked for in order, the prices given (or none).
      Gemini reads it (the research model, temperature 0); the code keeps only what is really in the request, and reads
      the request itself when Gemini cannot (requestFigures_, onceTopicsIn_).
   2. The brief goes into every Gemini call that writes slides (briefPromptBlock_), and with the parts of a long deck.
   3. The figure check (guardFigures_) runs on the written slides: a figure stays only when it is in the brief, the
      request, the attached files, the approved 66degrees facts or the research (then its source goes in the notes).
      Everything else is left out of the slide and listed in the notes. 100% uptime / availability / SLA never stays.
========================= */

var BRIEF_TARGET_WORDS_ = /\b(target|goal|kpi|reduc|lower|fewer|faster|increase|improv|cut|under|below|within|less than|uptime|availability|recovery|rto|rpo|pass rate|accuracy|by)\b/i;

// The brief of one request. Never fails: without Gemini the code reads the request itself.
function buildBrief_(userPrompt, sources, ctx, slideCount) {
  var prompt = String(userPrompt || '').trim();
  var files = String((sources && sources.text) || '');
  var base = briefFromText_(prompt, slideCount);
  if (!prompt) return base;
  var g = null;
  try {
    var model = typeof runModels_ === 'function' ? runModels_().check : '';
    g = withModel_(model, function () { return callGeminiJSON([{ text: briefPrompt_(prompt, files, slideCount) }], ctx && ctx.apiKey, 0,
      typeof BRIEF_SCHEMA_ !== 'undefined' ? { schema: BRIEF_SCHEMA_ } : undefined); });   // V.1_72: the brief's shape is fixed
  } catch (e) {
    if (ctx && ctx.log) ctx.log.push('Brief: read by the code (Gemini: ' + String((e && e.message) || e).slice(0, 80) + ').');
  }
  var brief = mergeBrief_(base, g, prompt, files);
  if (ctx && ctx.log) {
    ctx.log.push('Brief: ' + brief.figures.length + ' figure(s) from the request' + (brief.figures.length ? ' (' + brief.figures.map(function (f) { return f.value; }).join(', ') + ')' : '') +
      ', ' + brief.topics.length + ' topic(s), prices ' + (brief.prices.length ? 'given' : 'not given') + '.');
  }
  return brief;
}

function briefPrompt_(prompt, files, slideCount) {
  return [
    'Read this request for a presentation and return its fixed brief. Copy, never add: only what the request says.',
    'REQUEST: "' + prompt + '"',
    files ? 'ATTACHED FILES (first part): ' + files.slice(0, 3000) : '',
    'Return ONLY JSON:',
    '{"client":{"name":"","domain":""},',
    ' "slideCount":' + (slideCount || 0) + ',',
    ' "topics":["each topic the request asks the deck to include, in the request\'s order, 1-6 words, e.g. \\"scope\\", \\"RACI\\", \\"next steps\\""],',
    ' "figures":[{"value":"the figure exactly as written, e.g. \\"99.95%\\", \\"<15 min\\", \\"3x\\"","measure":"what it measures, 1-5 words, e.g. \\"uptime\\"","kind":"target or fact"}],',
    ' "prices":["each price or amount of money the request gives, exactly as written; empty when none"],',
    ' "facts":["other fixed facts the request gives: weeks, regions, products, systems, things excluded; short phrases"]}',
    'Figures: in the order the request writes them. "kind" is "target" for a goal (faster, lower, fewer, uptime, recovery time),',
    '"fact" for a current number (profiles, stores, records). A figure that is not written in the request is not a figure.'
  ].filter(Boolean).join('\n');
}

// What the code alone reads from the request (also the fallback when Gemini is not reachable)
function briefFromText_(prompt, slideCount) {
  var figs = (typeof requestFigures_ === 'function' ? requestFigures_(prompt) : []).map(function (f, i) {
    return { value: f.value, measure: f.label, kind: 'target', key: f.key, label: f.label, labelCap: f.labelCap, at: f.at, order: i };
  });
  var fam = typeof onceTopicsIn_ === 'function' ? onceTopicsIn_(prompt) : [];
  return { client: { name: '', domain: (String(prompt).match(/\b([a-z0-9-]+\.(?:com|io|ai|org|net|co|in|co\.uk))\b/i) || [])[1] || '' },
    slideCount: slideCount || 0, topics: [], families: fam, figures: figs, prices: briefPricesIn_(prompt), facts: [], source: 'code' };
}

function briefPricesIn_(text) {
  var m = String(text || '').match(/[$€£₹]\s?\d[\d,.]*\s?(?:k|m|mn|bn|million|billion)?\b(?:\s*(?:\/|per)\s*(?:month|year|hour|week|sprint))?|\b\d[\d,.]*\s?(?:k|m)?\s?(?:usd|eur|gbp|inr|dollars)\b/gi) || [];
  return m.map(function (x) { return x.trim(); });
}

// Gemini's brief, kept only where the request backs it; the code's figures fill what Gemini missed
function mergeBrief_(base, g, prompt, files) {
  var brief = JSON.parse(JSON.stringify(base));
  if (!g || typeof g !== 'object') return brief;
  brief.source = 'gemini';
  var hay = (prompt + ' ' + files).replace(/(\d),(\d{3})/g, '$1$2');
  if (g.client && typeof g.client === 'object') {
    if (g.client.name && hay.toLowerCase().indexOf(String(g.client.name).toLowerCase()) !== -1) brief.client.name = String(g.client.name).trim();
    if (g.client.domain && hay.toLowerCase().indexOf(String(g.client.domain).toLowerCase()) !== -1) brief.client.domain = String(g.client.domain).trim();
  }
  if (Array.isArray(g.topics)) {
    brief.topics = g.topics.map(function (t) { return String(t || '').trim(); })
      .filter(function (t) { return t && t.split(/\s+/).length <= 8 && !/\d\s?(%|x\b)/i.test(t); }).slice(0, 20);
  }
  if (Array.isArray(g.facts)) brief.facts = g.facts.map(function (t) { return String(t || '').trim(); }).filter(Boolean).slice(0, 20);
  // a figure stays only when its number is written in the request (or the files)
  var gf = Array.isArray(g.figures) ? g.figures : [];
  var kept = [];
  gf.forEach(function (f) {
    if (!f || typeof f !== 'object') return;
    var v = String(f.value || '').trim();
    var d = (v.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/) || [])[0];
    if (!d || !new RegExp('(^|[^0-9.])' + d.replace('.', '\\.') + '(?![0-9])').test(hay)) return;
    var key = figKey_(v.replace(/^(under|below|less than|within)\s+/i, '<'));
    if (!key || kept.some(function (k) { return k.key === key && sharedWords_(k.measure, f.measure) > 0; })) return;
    var measure = String(f.measure || '').trim();
    var at = briefFigurePos_(prompt, d, measure);
    kept.push({ value: v, measure: measure, kind: /^fact$/i.test(String(f.kind || '')) ? 'fact' : 'target', key: key,
      label: measure, labelCap: measure.charAt(0).toUpperCase() + measure.slice(1), at: at });
  });
  // the code's figures Gemini left out
  base.figures.forEach(function (f) {
    if (!kept.some(function (k) { return k.key === f.key; })) kept.push(f);
  });
  kept.sort(function (a, b) { return (a.at == null ? 1e9 : a.at) - (b.at == null ? 1e9 : b.at); });
  brief.figures = kept.slice(0, 12).map(function (f, i) { f.order = i; return f; });
  // prices: only amounts written in the request
  if (Array.isArray(g.prices)) {
    g.prices.forEach(function (p) {
      var d = (String(p).replace(/,/g, '').match(/\d+(?:\.\d+)?/) || [])[0];
      if (d && hay.replace(/,/g, '').indexOf(d) !== -1 && brief.prices.indexOf(String(p).trim()) === -1) brief.prices.push(String(p).trim());
    });
  }
  return brief;
}

function briefFigurePos_(prompt, digits, measure) {
  var p = String(prompt).replace(/(\d),(\d{3})/g, '$1$2');
  var re = new RegExp('(^|[^0-9.])' + digits.replace('.', '\\.') + '(?![0-9])', 'g'), m, best = null;
  while ((m = re.exec(p))) {
    var near = p.slice(Math.max(0, m.index - 40), m.index + 60);
    if (best == null || (measure && sharedWords_(near, measure) > 0)) { best = m.index; if (measure && sharedWords_(near, measure) > 0) break; }
  }
  return best;
}

// The target figures of the brief (KPI tiles), in the request's order
function briefTargets_(ctx) {
  var b = ctx && ctx.brief;
  if (!b || !Array.isArray(b.figures)) return [];
  var t = b.figures.filter(function (f) { return f.kind !== 'fact'; });
  var out = [];
  t.forEach(function (f) {
    var label = String(f.label || f.measure || '').trim();
    var o = { value: f.value, key: f.key || figKey_(f.value), label: label, labelCap: label.charAt(0).toUpperCase() + label.slice(1), at: f.at };
    // V.1_74 (deck 45 Solution 5: "40% fewer - Fewer incidents" and "40% - Fewer incidents" as two tiles): one target
    // read twice from the request ("40% fewer incidents", "a 40% incident reduction") is one target - the same number
    // for the same measure
    var core = function (v) { var m = String(v || '').match(/[<>~]?\s*\$?\d[\d.,]*\s*(%|x|×|ms|min|h|s)?/i); return m ? m[0].replace(/\s+/g, '').toLowerCase() : ''; };
    var words = function (x) { return String(x || '').toLowerCase().replace(/\d[\d.,]*\s*%?/g, ' ').match(/[a-z]{4,}/g) || []; };
    var dup = out.filter(function (p) {
      if (!core(p.value) || core(p.value) !== core(o.value)) return false;
      var a = words(p.label + ' ' + p.value), c = words(o.label + ' ' + o.value);
      return !a.length || !c.length || a.some(function (w) { return c.some(function (x) { return x.slice(0, 5) === w.slice(0, 5); }); });
    })[0];
    if (!dup) out.push(o);
  });
  return out;
}

// The block every slide-writing prompt gets
function briefPromptBlock_(ctx) {
  var b = ctx && ctx.brief;
  if (!b) return '';
  var t = (b.figures || []).filter(function (f) { return f.kind !== 'fact'; });
  var f = (b.figures || []).filter(function (x) { return x.kind === 'fact'; });
  return [
    'FIXED BRIEF (read from the request - follow it exactly):',
    t.length ? '- Target figures, in this order (a KPI slide shows exactly these, in this order, each with how it is reached or measured): ' + t.map(function (x) { return x.value + ' ' + (x.measure || x.label || ''); }).join('; ') + '.' : '- The request gives no target figures: a KPI slide names the measures without inventing numbers.',
    f.length ? '- Figures the request gives as facts: ' + f.map(function (x) { return x.value + ' ' + (x.measure || x.label || ''); }).join('; ') + '.' : '',
    (b.topics || []).length ? '- Topics the request names (each gets its own slide, once): ' + b.topics.join('; ') + '.' : '',
    (b.prices || []).length ? '- Prices given: ' + b.prices.join('; ') + '. No other amounts.' : '- No prices are given: no amounts of money anywhere. Only the pricing slide itself may say that pricing is confirmed after the scoping workshop; no other slide mentions pricing.',   // V.1_71
    (b.facts || []).length ? '- Other fixed facts: ' + b.facts.join('; ') + '.' : '',
    'FIGURE RULE: every number on a slide is one of the figures above, an approved ' + ((ctx.brand && ctx.brand.name) || '66degrees') + ' fact, or a research finding',
    'with its source number [n] in the notes. Anything else is written without a number. Never 100% uptime, availability or SLA.',
    'Never "Industry benchmark" without its figure and source. Section names are topics, never figures or targets.',
    'The target figures appear on the KPI slide (and where a slide is about that target); never as a tile on a credentials or other slide. A research figure never replaces a target figure for the same measure.',
    'A RACI lists every party (66degrees and the client) with their role on each workstream. Speaker notes never name designs.'
  ].filter(Boolean).join('\n');
}

/* ---------- the figure check ---------- */

var FIG_TOKEN_RE_ = /(?:between\s+)?[+\-−~]?\b\d[\d,.]*\s?%?\s?(?:–|—|-|to|and)\s?\d[\d,.]*\s?%|[$€£₹]\s?\d[\d,.]*\s?(?:k|m|mn|bn|million|billion|thousand)?\b\+?|[+\-−~]?\b\d[\d,.]*\s?(?:%|percent\b|per cent\b|x\b|×|(?:million|billion|thousand)\b|[kmb]\+?(?=[\s,.;:)]|$))\+?|\b\d{1,3}(?:,\d{3})+\+?/gi;
var FIG_SKIP_KEYS_ = { notes: 1, reference: 1, design: 1, icon: 1, icons: 1, tag: 1, lockTag: 1, image: 1, logo: 1, deckLibrary: 1, resolvedIcons: 1,
  fact_tags: 1, number: 1, no: 1, type: 1, material: 1, agendaWide: 1, sectionStyle: 1, cobrand: 1, clientLogo: 1, url: 1, status: 1, kind: 1, _dropped: 1 };
var FIG_HEAD_KEYS_ = { title: 1, label: 1, highlight: 1, subtitle: 1, name: 1, heading: 1, header: 1, caption: 1 };

function figCorpus_(ctx, sources) {
  var b = (ctx && ctx.brief) || {};
  var own = [String((ctx && ctx.userPrompt) || ''), String((sources && sources.text) || ''), JSON.stringify(b.figures || []), JSON.stringify(b.prices || []),
    JSON.stringify(b.facts || []), JSON.stringify((ctx && ctx.approvedFacts) || [])].join(' ');
  var research = (sources && sources.research) || [];
  var norm = function (t) { return String(t).replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2'); };
  return { own: norm(own), research: research.map(function (r) { return { n: r.n, text: norm(JSON.stringify(r)) }; }) };
}

// Is this figure backed? 'own' (brief, request, files, approved facts), a research source number, or false
function figBacked_(token, corpus) {
  // V.1_71: a range ("between 10% and 30%", "38%–45%") is backed when each of its figures is
  var rg = String(token).match(/(\d[\d,.]*)\s?%?\s?(?:–|—|-|to|and)\s?(\d[\d,.]*)\s?%/);
  if (rg) {
    var a = figBacked_(rg[1] + '%', corpus), b = figBacked_(rg[2] + '%', corpus);
    return a && b ? (a !== 'own' ? a : b) : false;
  }
  var t = String(token).replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2');
  var d = (t.match(/\d+(?:\.\d+)?/) || [])[0];
  if (!d) return 'own';
  var num = '(^|[^0-9.])' + d.replace('.', '\\.') + '(?![0-9.]?[0-9])';
  var re = /%|percent|per cent/i.test(t) ? new RegExp(num + '\\s?(%|percent|per cent)', 'i')
    : /x\b|×/i.test(t) ? new RegExp(num + '\\s?(x\\b|×|times)', 'i')
    : new RegExp(num);
  if (re.test(corpus.own)) return 'own';
  for (var i = 0; i < corpus.research.length; i++) if (re.test(corpus.research[i].text)) return corpus.research[i].n != null ? String(corpus.research[i].n) : 'research';
  return false;
}

// V.1_71 (deck 42 Solution 22: "rebuild above 30% fragmentation"): a technical setting (a threshold, a limit, a port,
// a size) is part of how the solution works, not a claim about results - it is not checked like a result
var FIG_TECH_RE_ = /\b(fragment\w*|threshold\w*|utili[sz]ation|cpu|vcpu|memory|ram|disk|iops|quota\w*|limit\w*|ttl|trace flags?|ports?|retention|sampl\w*|percentile|p9\d|fill factor|buffer|cache hit|heap|headroom|reserved|allocation|capacity of|max(imum)? degree)\b/i;
function figTechnical_(s, tok) {
  var str = String(s), a = Math.max(0, tok.at - 35), z = tok.at + String(tok.text).length + 35;
  return FIG_TECH_RE_.test(str.slice(a, z)) && !/\b(reduc|fewer|faster|lower|higher|increase|improv|sav|gain|roi|uplift|growth)\w*/i.test(str.slice(a, z));
}
function figTokens_(s) {
  var out = [], m;
  FIG_TOKEN_RE_.lastIndex = 0;
  while ((m = FIG_TOKEN_RE_.exec(String(s)))) out.push({ text: m[0], at: m.index });
  return out;
}

// 100% uptime / availability / SLA (or "100% ..." near those words): never kept
function hundredSla_(s, tok) {
  if (!/^100\s?%/.test(String(tok.text).replace(/^[+\-−~]/, ''))) return false;
  // the words that make it a service-level claim follow the figure closely ("100% monthly uptime SLA", "100% multi-zone
  // Compute Engine SLA"); "routing 100% of contact center logs" is not one
  var after = String(s).slice(tok.at, tok.at + String(tok.text).length + 40);
  return /\b(sla|uptime|availability)\b/i.test(after);
}

// A text without the figures that are not backed. kind: 'head' (a heading: the figure and its connector go) or
// 'text' (sentences: a sentence carrying the figure goes when another sentence is left; otherwise the figure goes)
function figStrip_(s, bad, kind) {
  var str = String(s);
  if (!bad.length) return str;
  if (kind === 'text') {
    var sentences = str.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    if (sentences.length > 1) {
      var keep = sentences.filter(function (x) { return !bad.some(function (b) { return x.indexOf(b) !== -1; }); });
      if (keep.length) return keep.join(' ');
    }
  }
  bad.forEach(function (b) {
    var e = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    str = str
      .replace(new RegExp('\\b(?:up to|by|of|around|about|nearly|over|more than|at least|almost|roughly)\\s+' + e + '(?:\\s+(?:of|in))?\\s*', 'gi'), ' ')
      .replace(new RegExp(e + '\\s*(?:·|-|–|—|:)?\\s*', 'g'), ' ');
  });
  str = str.replace(/\b(?:industry\s+)?benchmarks?\s*:\s*/gi, '').replace(/^\s*[·:–—-]\s*/, '').replace(/\s*[·]\s*$/, '')
    .replace(/\(\s*\)/g, '').replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s{2,}/g, ' ').trim();
  if (str) str = str.charAt(0).toUpperCase() + str.slice(1);
  return str;
}

// The check on every written slide. Returns the number of figures left out.
function guardFigures_(slides, ctx, sources) {
  var corpus = figCorpus_(ctx, sources);
  var total = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    var t = String(sp.type || '').toLowerCase();
    if (['template', 'case_study', 'closing'].indexOf(t) !== -1) return;
    var removed = [], cited = {}, toCheck = [];
    var pricingSlide = /\b(pric\w*|commercial|investment|engagement models?|cost options|fees?)\b/i.test(String(sp.title || ''));
    var PRICE_LINE = /pricing is confirmed after the scoping workshop/i;
    var check = function (s) {
      var bad = [];
      figTokens_(s).forEach(function (tok) {
        if (hundredSla_(s, tok)) { bad.push(tok.text); return; }
        if (figTechnical_(s, tok)) return;
        var ok = figBacked_(tok.text, corpus);
        if (!ok) bad.push(tok.text);
        else if (ok !== 'own' && ok !== 'research') cited[ok] = true;
      });
      return bad;
    };
    var clean = function (s, kind) {
      if (typeof s !== 'string') return s;
      // (deck 41 Proposal 6: "Industry benchmark: annual quality cost" with no figure left) a heading is only called a
      // benchmark when it shows its figure
      if (kind === 'head' && /^\s*(?:industry\s+)?benchmarks?\s*:/i.test(s) && !figTokens_(s).length) {
        s = s.replace(/^\s*(?:industry\s+)?benchmarks?\s*:\s*/i, ''); s = s.charAt(0).toUpperCase() + s.slice(1);
      }
      s = s.replace(/([.!?])\s+(Amber|Green|Red|Grey|Gray)\.?\s*$/, '$1');        // (Solution 4: a status word left at the end)
      // V.1_71 (deck 42 Proposal 11): the pricing line belongs on the pricing slide only
      if (!pricingSlide && PRICE_LINE.test(s)) {
        var left = (s.match(/[^.!?]+[.!?]*(\s+|$)/g) || [s]).filter(function (sn) { return !PRICE_LINE.test(sn); }).join('').trim();
        s = left;
        if (!s) return s;
      }
      var bad = check(s);
      if (!bad.length) return s;
      var out = figStrip_(s, bad, kind);
      // V.1_71 (deck 42 Solution 22: "reorganize between and 30%"): a text the check would break stays whole, with a note
      // (V.1_72, deck 43 Solution 6: "Contoso Health baseline: of historical outages"): a colon or an article left before "of"
      if (/\b(between|from|than|by|of|with|and|to)\s*([.,;:)]|$)|\bbetween\s+and\b|\b(and|to)\s+(and|to)\b|^\s*(and|or|to|by|of)\b|:\s+(of|and|to|by|from|in)\b|\b(a|an|the)\s+(of|in|and)\b/i.test(out) || (kind === 'text' && out.split(/\s+/).length < 3 && s.split(/\s+/).length >= 5)) {
        bad.forEach(function (b) { if (toCheck.indexOf(b.trim()) === -1) toCheck.push(b.trim()); });
        return s;
      }
      bad.forEach(function (b) { if (removed.indexOf(b.trim()) === -1) removed.push(b.trim()); });
      return out;
    };
    // V.1_71 (deck 42 Proposal 11: "03 Pricing is confirmed after the scoping workshop" as a step of a Looker slide)
    if (!pricingSlide && Array.isArray(sp.items) && sp.items.length > 2) {
      var noPrice = sp.items.filter(function (it) { return !(it && typeof it === 'object' && PRICE_LINE.test(String(it.title || it.label || ''))); });
      if (noPrice.length >= 2 && noPrice.length < sp.items.length) sp.items = noPrice;
    }
    var targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
    var kpiSlide = typeof isKpiSlide_ === 'function' && isKpiSlide_(sp);
    var lab = function (it) { return String((it && (it.label || it.title)) || '').replace(/^\s*target\s*:\s*/i, ''); };
    var sameMeasure = function (label, value) {
      var k = typeof figKey_ === 'function' ? figKey_(value) : String(value);
      return targets.filter(function (f) { return f.key !== k && typeof sharedWords_ === 'function' && sharedWords_(label, f.label) >= 2; })[0];
    };
    // V.1_71 (deck 42 Proposal 19: a research "26% lower IT infrastructure run costs" beside the requested 30% lower
    // platform run cost): the request's target wins - a research figure for the same measure goes
    if (sp.value != null && String(sp.value).trim() && sameMeasure(String(sp.label || ''), String(sp.value))) {
      removed.push(String(sp.value).trim() + ' (the request gives ' + sameMeasure(String(sp.label || ''), String(sp.value)).value + ')');
      delete sp.value; delete sp.label; delete sp.text; delete sp.note;
    }
    if (Array.isArray(sp.items) && sp.items.some(function (it) { return it && typeof it === 'object' && String(it.value || '').trim(); })) {
      var kept2 = sp.items.filter(function (it) {
        if (!it || typeof it !== 'object' || !String(it.value || '').trim()) return true;
        var v2 = String(it.value).trim();
        var tgt = !kpiSlide && sameMeasure(lab(it), v2);
        if (tgt) { removed.push(v2 + ' (the request gives ' + tgt.value + ')'); return false; }
        // V.1_71 (deck 42 General 27: "99.9% Target: pipeline availability" among the 66degrees credentials): a target
        // tile sits on the KPI slide, not on another slide
        if (!kpiSlide && /^\s*target\b|\(target\)\s*$/i.test(String(it.label || it.title || ''))) { removed.push(v2 + ' (a target, shown on the KPI slide)'); return false; }
        // V.1_71 (deck 42 Proposal 22: "<2s", "15-min" as KPI values): a time used as a target comes from the request or a source
        var tm = v2.match(/(\d+(?:\.\d+)?)\s?-?\s?(ms|s|sec|secs|seconds|min|mins|minutes|h|hr|hrs|hours|days?)\b/i);
        if (tm) {
          var unit = /^ms/i.test(tm[2]) ? 'ms|milliseconds?' : /^(s|sec)/i.test(tm[2]) ? 's|secs?|seconds?' : /^min/i.test(tm[2]) ? 'min|mins|minutes?' : /^(h|hr)/i.test(tm[2]) ? 'h|hrs?|hours?' : 'days?';
          var tre = new RegExp('(^|[^0-9.])' + tm[1].replace('.', '\\.') + '\\s?-?\\s?(' + unit + ')\\b', 'i');
          if (!tre.test(corpus.own) && !corpus.research.some(function (r) { return tre.test(r.text); })) { removed.push(v2 + ' (a time not given in the request or a source)'); return false; }
        }
        return true;
      });
      if (kept2.length < sp.items.length && kept2.length >= 2) sp.items = kept2;
      else if (kept2.length < sp.items.length) {
        sp.items = kept2.concat(sp.items.filter(function (it) { return kept2.indexOf(it) === -1; }).map(function (it) { return { title: lab(it).replace(/^./, function (c) { return c.toUpperCase(); }), text: String(it.text || '') }; }));
        if (t === 'stats') { sp.type = 'cards'; sp.items = sp.items.map(function (it) { return it.value ? { title: String(it.value) + ' ' + lab(it).replace(/^./, function (c) { return c.toLowerCase(); }), text: String(it.text || '') } : it; }); delete sp.design; sp.reference = null; }
      }
    }
    // KPI / stats tiles: a tile whose figure is not backed goes (the slide keeps at least two)
    if (Array.isArray(sp.items) && sp.items.some(function (it) { return it && typeof it === 'object' && String(it.value || '').trim(); })) {
      var keepIt = sp.items.filter(function (it) {
        if (!it || typeof it !== 'object' || !String(it.value || '').trim()) return true;
        var v = String(it.value).trim();
        var claim = v + ' ' + String(it.label || it.title || '') + ' ' + String(it.text || '').split(/[.!?]/)[0];
        var bad = hundredSla_(claim, { text: v, at: 0 }) || figTokens_(v).some(function (tok) { return !figBacked_(tok.text, corpus); });
        if (bad) { removed.push(v); return false; }
        return true;
      });
      if (keepIt.length < sp.items.length) {
        if (keepIt.filter(function (it) { return it && String(it.value || '').trim(); }).length >= 2 || t !== 'stats') sp.items = keepIt;
        else {
          // too few figures left: the slide shows its measures as cards, without numbers
          sp.type = 'cards';
          // (a figure that is backed stays, in front of its heading)
          sp.items = sp.items.map(function (it) {
            var head = String((it && (it.label || it.title)) || '').replace(/^\s*target\s*:\s*/i, '');
            var keepV = it && keepIt.indexOf(it) !== -1 && String(it.value || '').trim() ? String(it.value).trim() + ' ' : '';
            head = keepV ? keepV + head.replace(/^./, function (c) { return c.toLowerCase(); }) : head.replace(/^./, function (c) { return c.toUpperCase(); });
            return { title: head, text: String((it && it.text) || '') };
          })
            .filter(function (it) { return it.title; });
          delete sp.design; sp.reference = null;
        }
      }
    }
    // a chart whose values are not backed is not drawn as a chart
    if (sp.chart && Array.isArray(sp.chart.series)) {
      var vals = [].concat.apply([], sp.chart.series.map(function (se) { return (se && Array.isArray(se.values)) ? se.values : []; })).filter(function (v) { return v !== '' && v != null && isFinite(Number(v)); });
      var badV = vals.filter(function (v) { return !figBacked_(String(v), corpus); });
      if (vals.length && badV.length > vals.length / 2) {
        var cats = Array.isArray(sp.chart.categories) ? sp.chart.categories.map(String) : [];
        removed.push('chart values (' + badV.slice(0, 4).join(', ') + ')');
        sp.type = 'cards';
        sp.items = cats.slice(0, 6).map(function (c) { return { title: c, text: '' }; });
        if (sp.insight && !sp.takeaway) sp.takeaway = String(sp.insight.text || sp.insight.title || '');
        delete sp.chart; delete sp.insight; delete sp.design; sp.reference = null;
      }
    }
    var walk = function (v, key) {
      if (typeof v === 'string') return clean(v, FIG_HEAD_KEYS_[key] ? 'head' : 'text');
      if (Array.isArray(v)) {
        if (key === 'points' && v.length > 2 && v.every(function (x) { return typeof x === 'string'; })) {
          // a list point carrying a figure that is not backed goes (the list keeps at least two)
          var kept = v.filter(function (x) { var b = check(x); if (b.length) { b.forEach(function (z) { if (removed.indexOf(z.trim()) === -1) removed.push(z.trim()); }); return false; } return true; });
          if (kept.length >= 2) return kept.map(function (x) { return clean(x, 'text'); });
        }
        if (key === 'rows') return v.map(function (r) { return Array.isArray(r) ? r.map(function (c) { var o = clean(c, 'head'); return typeof c === 'string' && o !== c && String(o).split(/\s+/).length <= 4 ? 'To be confirmed' : o; }) : walk(r, ''); });
        return v.map(function (x) { return walk(x, key); });
      }
      if (v && typeof v === 'object') {
        Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k] && k !== 'value') v[k] = walk(v[k], k); });
        return v;
      }
      return v;
    };
    // a callout or insight whose heading is a figure without a source says nothing without it: it goes whole
    ['callout', 'insight', 'headline'].forEach(function (k) {
      var o = sp[k];
      if (o && typeof o === 'object' && typeof o.title === 'string' && check(o.title).length) {
        check(o.title).concat(check(String(o.text || ''))).forEach(function (b) { if (removed.indexOf(b.trim()) === -1) removed.push(b.trim()); });
        delete sp[k];
      }
    });
    Object.keys(sp).forEach(function (k) { if (!FIG_SKIP_KEYS_[k] && k !== 'chart' && k !== 'value') sp[k] = walk(sp[k], k); });
    // headings emptied by this keep a short form of their text
    if (Array.isArray(sp.items)) sp.items.forEach(function (it) {
      if (it && typeof it === 'object' && it.title !== undefined && !String(it.title).trim() && it.text) it.title = String(it.text).split(/\s+/).slice(0, 4).join(' ');
    });
    // research figures that stay: their source number goes in the notes, so the Sources list names it
    var cites = Object.keys(cited).filter(function (n) { return /^\d+$/.test(n) && String(sp.notes || '').indexOf('[' + n + ']') === -1; });   // (V.1_72: never an empty list)
    // (V.1_75, deck 46 Proposal 4: "Figures on this slide:." - the clean-up of reference markers took "[5]" away): the
    //  sources are named in words, on their own line
    if (cites.length) sp.notes = String(sp.notes || '') + '\nFigures on this slide: from source' + (cites.length > 1 ? 's ' : ' ') + cites.join(', ') + ' in the Sources list ' + cites.map(function (n) { return '[' + n + ']'; }).join(' ') + '.';   // (the markers name the sources in the list, then go)
    if (toCheck.length && !/Check before sharing: figures without a source/.test(String(sp.notes || ''))) sp.notes = String(sp.notes || '') + '\nCheck before sharing: figures without a source kept so the sentence reads (' + toCheck.slice(0, 4).join(', ') + ').';
    if (removed.length) {
      total += removed.length;
      sp.notes = String(sp.notes || '') + '\nFigures left out (not in the request, the attached files, the approved facts or the research): ' + removed.slice(0, 6).join(', ') + '.';
    }
  });
  if (total && ctx && ctx.log) ctx.log.push('Figure check: ' + total + ' figure(s) without a source left out of the slides (listed in the notes).');
  return total;
}

// One measure, two figures across the deck ("1.5 billion records daily", "1.6 billion records weekly"): the figure the
// request gives stays everywhere; with none given, the first one stays and the notes ask to check.
function sameMeasureFigures_(slides, ctx) {
  var MAG = /\b(\d+(?:\.\d+)?)\s?(million|billion|thousand|[mbk])\+?\s+(?:new\s+|daily\s+|weekly\s+|monthly\s+)?([a-z]{4,})/gi;
  var seen = {}, req = String((ctx && ctx.userPrompt) || '');
  var strings = [];
  var collect = function (v, sp) {
    if (typeof v === 'string') strings.push({ s: v, sp: sp });
    else if (Array.isArray(v)) v.forEach(function (x) { collect(x, sp); });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) collect(v[k], sp); });
  };
  (slides || []).forEach(function (sp) { if (sp) Object.keys(sp).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) collect(sp[k], sp); }); });
  strings.forEach(function (x) {
    var m; MAG.lastIndex = 0;
    while ((m = MAG.exec(x.s))) {
      var mag = m[2].toLowerCase().charAt(0), noun = m[3].toLowerCase().replace(/s$/, '');
      var k = mag + ':' + noun;
      (seen[k] = seen[k] || []).push({ num: m[1], sp: x.sp });
    }
  });
  var n = 0;
  var swap = function (v, from, to, mag, noun) {
    var re = new RegExp('(^|[^0-9.])' + from.replace('.', '\\.') + '(\\s?' + mag + '[a-z]*\\+?\\s+(?:new\\s+|daily\\s+|weekly\\s+|monthly\\s+)?' + noun + ')', 'gi');
    if (typeof v === 'string') return v.replace(re, function (all, pre, rest) { n++; return pre + to + rest; });
    if (Array.isArray(v)) return v.map(function (x) { return swap(x, from, to, mag, noun); });
    if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) v[k] = swap(v[k], from, to, mag, noun); }); return v; }
    return v;
  };
  Object.keys(seen).forEach(function (k) {
    var nums = {}; seen[k].forEach(function (e) { nums[e.num] = 1; });
    var list = Object.keys(nums);
    if (list.length < 2) return;
    var mag = k.split(':')[0], noun = k.split(':')[1];
    var given = list.filter(function (d) { return new RegExp('(^|[^0-9.])' + d.replace('.', '\\.') + '(?![0-9])').test(req); });
    var done = [];
    seen[k].forEach(function (e) {
      if (done.indexOf(e.sp) !== -1) return;
      done.push(e.sp);
      if (given.length === 1) {
        // the figure the request gives stays everywhere
        list.forEach(function (d) { if (d !== given[0]) Object.keys(e.sp).forEach(function (key) { if (!FIG_SKIP_KEYS_[key]) e.sp[key] = swap(e.sp[key], d, given[0], mag, noun); }); });
      } else if (!/Check before sharing: one measure/.test(String(e.sp.notes || ''))) {
        e.sp.notes = String(e.sp.notes || '') + '\nCheck before sharing: one measure with different figures in this deck (' + list.join(' and ') + ' ' + noun + 's).';
      }
    });
  });
  if (n && ctx && ctx.log) ctx.log.push('Figure check: ' + n + ' figure(s) made the same as the request gives for the same measure.');
  return n;
}

/* V.1_71 (deck 42 General 26 "600+ Google certifications", General 27 "375+ certifications"): a 66degrees credential has
   one figure in a deck - the one in the add-on's approved facts (Brand.gs APPROVED_FACTS); the reference library's older
   figure is replaced. No public source gives a different figure (checked 29 Oct 2026). */
var CREDENTIAL_NOUNS_ = { certifications: /certifications?/i, projects: /(transformation )?projects/i };
function credentialFigures_() {
  var out = {};
  var facts = typeof APPROVED_FACTS !== 'undefined' ? APPROVED_FACTS : [];
  facts.forEach(function (f) {
    Object.keys(CREDENTIAL_NOUNS_).forEach(function (k) {
      if (out[k]) return;
      var m = String(f).match(new RegExp('(\\d[\\d,]*\\+)\\s+(?:[A-Za-z/&,-]+\\s){0,6}?' + CREDENTIAL_NOUNS_[k].source, 'i'));
      if (m) out[k] = m[1];
    });
  });
  return out;
}
function canonicalCredentials_(slides, ctx) {
  var canon = credentialFigures_(), n = 0;
  if (!Object.keys(canon).length) return 0;
  var fixStr = function (x) {
    if (typeof x !== 'string') return x;
    Object.keys(canon).forEach(function (k) {
      var re = new RegExp('\\b(\\d[\\d,]*)\\+(\\s+(?:[A-Za-z/&,-]+\\s){0,6}?' + CREDENTIAL_NOUNS_[k].source + ')', 'gi');
      x = x.replace(re, function (all, num, rest) { if (num + '+' === canon[k]) return all; n++; return canon[k] + rest; });
    });
    return x;
  };
  var walk = function (v) {
    if (typeof v === 'string') return fixStr(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      // a tile: "375+" over "Google Cloud and workspace certifications"
      if (typeof v.value === 'string' && /^\s*\d[\d,]*\+\s*$/.test(v.value)) {
        Object.keys(canon).forEach(function (k) { if (CREDENTIAL_NOUNS_[k].test(String(v.label || v.title || '')) && v.value.trim() !== canon[k]) { v.value = canon[k]; n++; } });
      }
      Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k] && k !== 'value') v[k] = walk(v[k]); });
      return v;
    }
    return v;
  };
  (slides || []).forEach(function (sp) { if (sp && typeof sp === 'object') walk(sp); });
  if (n && ctx && ctx.log) ctx.log.push('66degrees credentials: ' + n + ' figure(s) set to the approved facts (' + Object.keys(canon).map(function (k) { return canon[k] + ' ' + k; }).join(', ') + ').');
  return n;
}

/* V.1_72 (deck 43 General 27: "12 Google Cloud Specializations", "the second largest pure-play Google Cloud services firm in
   North America"): a 66degrees credential on a slide is one of the approved facts. The number of specializations is the
   approved list's; a ranking claim ("second largest", "leading", "top 3") that the approved facts and the request do not
   make goes (the item goes when the slide keeps three or more). */
var RANK_CLAIM_RE_ = /\b(the\s+)?(second|third|largest|biggest|leading|top[- ]?\d+|number one|no\.?\s?1|#\s?\d)\b[^.]{0,80}\b(partner|firm|provider|consultanc\w*|pure[- ]play|integrator|company)\b/i;
function approvedSpecializationCount_() {
  var facts = typeof APPROVED_FACTS !== 'undefined' ? APPROVED_FACTS : [];
  var f = facts.filter(function (x) { return /^\s*Specializations\s*:/i.test(String(x)); })[0];
  return f ? String(f).replace(/^\s*Specializations\s*:\s*/i, '').replace(/\.\s*$/, '').split(/\s*,\s*/).filter(Boolean).length : 0;
}
function approvedCredentialClaims_(slides, ctx) {
  var nSpec = approvedSpecializationCount_(), n = 0;
  var approvedText = (typeof APPROVED_FACTS !== 'undefined' ? APPROVED_FACTS.join(' ') : '') + ' ' + String((ctx && ctx.userPrompt) || '');
  var rankOk = RANK_CLAIM_RE_.test(approvedText);
  var fixStr = function (x) {
    if (typeof x !== 'string') return x;
    if (nSpec) x = x.replace(/\b(\d+)\+?(\s+(?:Google Cloud\s+)?specializations?)\b/gi, function (all, num, rest) { if (Number(num) === nSpec) return all; n++; return nSpec + rest; });
    if (!rankOk && RANK_CLAIM_RE_.test(x)) {
      var left = (x.match(/[^.!?]+[.!?]*(\s+|$)/g) || [x]).filter(function (sn) { return !RANK_CLAIM_RE_.test(sn); }).join('').trim();
      if (left !== x.trim()) { n++; x = left; }
    }
    return x;
  };
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    var walk = function (v) {
      if (typeof v === 'string') return fixStr(v);
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) v[k] = walk(v[k]); }); return v; }
      return v;
    };
    Object.keys(sp).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) sp[k] = walk(sp[k]); });
    // an item left without its text by this goes, when the slide keeps three or more
    if (Array.isArray(sp.items)) {
      var kept = sp.items.filter(function (it) { return !(it && typeof it === 'object' && (it.title || it.label) && it.text !== undefined && !String(it.text).trim()); });
      if (kept.length >= 3 && kept.length < sp.items.length) sp.items = kept;
    }
  });
  if (n && ctx && ctx.log) ctx.log.push('66degrees credentials: ' + n + ' claim(s) set to the approved facts.');
  return n;
}

/* V.1_72 (deck 43 General 29: "a structured cuatro-step mobilisation path"): a word of another language in an English deck */
var FOREIGN_WORDS_ = { cuatro: 'four', tres: 'three', cinco: 'five', seis: 'six', quatre: 'four', trois: 'three',
  vier: 'four', drei: 'three', quatro: 'four', etapas: 'stages', pasos: 'steps' };   // (only words that are never English)
function foreignWords_(slides) {
  var re = new RegExp('\\b(' + Object.keys(FOREIGN_WORDS_).join('|') + ')\\b', 'gi'), n = 0;
  var fix = function (x) { return typeof x === 'string' ? x.replace(re, function (w) { n++; var e = FOREIGN_WORDS_[w.toLowerCase()]; return w.charAt(0) === w.charAt(0).toUpperCase() ? e.charAt(0).toUpperCase() + e.slice(1) : e; }) : x; };
  var walk = function (v) {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k] && k !== 'notes') v[k] = walk(v[k]); }); return v; }
    return v;
  };
  (slides || []).forEach(function (sp) { if (sp && typeof sp === 'object') Object.keys(sp).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) sp[k] = walk(sp[k]); }); });
  return n;
}

/* V.1_73 (deck 44 Solution 6 "averages to per minute", "with over 57% exceeding in cost", Proposal 14 "in technical labor
   productivity gains", "saved by retiring legacy BI licenses", Proposal 32 "cuts development time by"): text left broken
   where a figure or an amount was taken out - by any step - is repaired: the broken sentence goes when the text has
   another one; an item whose only text is broken goes when the slide keeps two or more; otherwise the broken words at
   the end go ("cuts development time by" -> "cuts development time"). Runs last, on every slide. */
var FRAG_END_RE_ = /\b(by|of|to|from|than|at|with|and|or|the|per|over|under|about|around|nearly|almost|roughly|up to|between|exceeding|averaging|saving)\s*[.!?]?\s*$/i;
var FRAG_IN_RE_ = /\b(to|and|or)\s+per\b|\bbetween\s+(and|to)\b|\b(averages?|averaging|exceed(s|ing)?|totaling|valued at)\s+(to|per|in|of|and|by|for|from|with|on)\s|\b(saves?|saved)\s+(to|per|in|of|and|for|from|on)\s|\b(by|of|to|from|than|with)\s+(in|of|per|and|to)\s|\b[a-z]{3,}:\s+(of|and|to|by|per)\s|\(\s*\)|\s,\s*[,.]/i;
var FRAG_ART_RE_ = /\b(a|an|the)\s+(of|in|and|per)\s/;            // (lower case only: "zone A and zone B" is fine)
var FRAG_START_RE_ = /^(in|of|by|to|for|and|with|from|on|at|per|saved|or)\b/;     // (lower case: a text that lost its first word)
function isFragment_(t) {
  var x = String(t || '').trim();
  if (!x) return false;
  return FRAG_START_RE_.test(x) || FRAG_IN_RE_.test(x + ' ') || FRAG_ART_RE_.test(x + ' ') || FRAG_END_RE_.test(x);
}
function repairText_(t) {
  var x = String(t || '').trim();
  if (!isFragment_(x)) return { text: x, ok: true };
  var sentences = x.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  if (sentences.length > 1) {
    var keep = sentences.filter(function (sn) { return !isFragment_(sn); });
    if (keep.length) return { text: keep.join(' '), ok: true };
  }
  // one sentence: broken words at its end go; a sentence broken inside is not kept
  if (!FRAG_IN_RE_.test(x + ' ') && !FRAG_ART_RE_.test(x + ' ') && !FRAG_START_RE_.test(x)) {
    var y = x.replace(/[.!?]\s*$/, '');
    for (var k = 0; k < 3 && FRAG_END_RE_.test(y); k++) y = y.replace(FRAG_END_RE_, '').replace(/[\s,;:]+$/, '');
    if (y.split(/\s+/).length >= 4) return { text: y + (/[.!?]$/.test(x) ? '.' : ''), ok: true };
  }
  return { text: x, ok: false };
}
function fragmentRepair_(slides, ctx) {
  var n = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    var t = String(sp.type || '').toLowerCase();
    if (['cover', 'closing', 'template', 'agenda'].indexOf(t) !== -1) return;
    ['lead', 'subtitle', 'takeaway', 'statement', 'text', 'banner', 'note'].forEach(function (k) {
      if (typeof sp[k] !== 'string' || !isFragment_(sp[k])) return;
      var r = repairText_(sp[k]); n++;
      sp[k] = r.ok ? r.text : '';
    });
    ['callout', 'insight'].forEach(function (k) {
      var o = sp[k];
      if (o && typeof o === 'object' && typeof o.text === 'string' && isFragment_(o.text)) { var r = repairText_(o.text); o.text = r.ok ? r.text : ''; n++; }
    });
    if (Array.isArray(sp.points)) {
      var pts = sp.points.map(function (p) { if (typeof p !== 'string' || !isFragment_(p)) return p; var r = repairText_(p); n++; return r.ok ? r.text : null; });
      var keptP = pts.filter(function (p) { return p !== null; });
      sp.points = keptP.length >= 2 || keptP.length === pts.length ? keptP : sp.points;
    }
    if (Array.isArray(sp.items)) {
      var drop = [];
      sp.items.forEach(function (it, j) {
        if (!it || typeof it !== 'object') return;
        ['text', 'description', 'fix'].forEach(function (k) {
          if (typeof it[k] !== 'string' || !isFragment_(it[k])) return;
          var r = repairText_(it[k]); n++;
          if (r.ok) it[k] = r.text; else if (k === 'text' && !String(it.value || '').trim()) drop.push(j); else it[k] = '';
        });
        if (Array.isArray(it.points)) it.points = it.points.filter(function (p) { return !(typeof p === 'string' && isFragment_(p) && !repairText_(p).ok); }).map(function (p) { return typeof p === 'string' && isFragment_(p) ? repairText_(p).text : p; });
      });
      if (drop.length && sp.items.length - drop.length >= 2) sp.items = sp.items.filter(function (it, j) { return drop.indexOf(j) === -1; });
      else drop.forEach(function (j) { if (sp.items[j]) sp.items[j].text = ''; });
    }
    if (Array.isArray(sp.rows)) sp.rows = sp.rows.map(function (r) { return Array.isArray(r) ? r.map(function (c) { if (typeof c !== 'string' || !isFragment_(c)) return c; var rr = repairText_(c); n++; return rr.ok ? rr.text : 'To be confirmed'; }) : r; });
  });
  if (n && ctx && ctx.log) ctx.log.push('Text check: ' + n + ' broken text(s) repaired (a figure or amount had been taken out).');
  return n;
}

/* V.1_73 (deck 44 Proposal 18: "Industry benchmark: 25% to 35% run cost reduction" beside the requested 30% lower platform
   run cost): in any text, a figure for the same measure as a target of the request, other than the target, goes (the
   sentence or list point that carries it) */
function targetFiguresInText_(slides, ctx) {
  var targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  if (!targets.length) return 0;
  var n = 0;
  var conflict = function (s) {
    var hit = false;
    figTokens_(s).forEach(function (tok) {
      var around = String(s).slice(Math.max(0, tok.at - 60), tok.at + String(tok.text).length + 60);
      targets.forEach(function (f) {
        var lw = String(f.label || '').split(/\s+/).filter(function (w) { return w.length > 2; });
        if (lw.length < 2 || sharedWords_(around, f.label) < 2) return;
        if (figKey_(tok.text) === f.key || String(tok.text).indexOf(String(f.value).replace(/\s+/g, '')) !== -1) return;
        if (/[%x×]/i.test(tok.text) !== /[%x×]/i.test(f.value)) return;
        hit = true;
      });
    });
    return hit;
  };
  var fix = function (x) {
    if (typeof x !== 'string' || !conflict(x)) return x;
    var parts = x.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    var keep = parts.filter(function (p) { return !conflict(p); });
    n++;
    return keep.length ? keep.join(' ') : null;
  };
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object' || (typeof isKpiSlide_ === 'function' && isKpiSlide_(sp))) return;
    ['lead', 'takeaway', 'statement', 'text'].forEach(function (k) { if (typeof sp[k] === 'string') { var r = fix(sp[k]); sp[k] = r === null ? '' : r; } });
    if (Array.isArray(sp.points)) { var p2 = sp.points.map(function (p) { return typeof p === 'string' ? fix(p) : p; }).filter(function (p) { return p !== null; }); if (p2.length >= 2 || !sp.points.length) sp.points = p2; }
    if (Array.isArray(sp.items)) sp.items.forEach(function (it) { if (it && typeof it === 'object' && typeof it.text === 'string') { var r = fix(it.text); if (r !== null) it.text = r; } });
  });
  if (n && ctx && ctx.log) ctx.log.push('Figure check: ' + n + ' figure(s) for the same measure as a target of the request left out.');
  return n;
}

/* V.1_73 (deck 44 General 35: "84 Partner Expertise designations"): a count of 66degrees credentials (specializations,
   designations, expertises, awards, certifications, experts, projects) is kept only when the approved facts or the
   request give that number */
var CRED_COUNT_RE_ = /\b(\d[\d,]*)\+?\s+(?:[A-Za-z/&-]+\s){0,3}?(specializations?|designations?|expertises?|partner expertise|awards?|certifications?|experts|engineers|consultants|projects|customers|clients|partner of the year)\b/gi;
function credentialCounts_(slides, ctx) {
  var approved = [(typeof APPROVED_FACTS !== 'undefined' ? APPROVED_FACTS.join(' ') : ''), JSON.stringify((ctx && ctx.approvedFacts) || []), String((ctx && ctx.userPrompt) || '')].join(' ').replace(/,/g, '');
  var n = 0;
  var fix = function (x) {
    if (typeof x !== 'string') return x;
    var bad = false;
    x.replace(CRED_COUNT_RE_, function (all, num) { if (approved.indexOf(String(num).replace(/,/g, '')) === -1) bad = true; return all; });
    if (!bad) return x;
    n++;
    var parts = x.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    var keep = parts.filter(function (p) { var b = false; p.replace(CRED_COUNT_RE_, function (all, num) { if (approved.indexOf(String(num).replace(/,/g, '')) === -1) b = true; return all; }); return !b; });
    if (keep.length) return keep.join(' ');
    // one sentence: only the count's phrase goes ("6 Specializations and 84 Partner Expertise designations" -> "6 Specializations")
    return x.replace(/\s*(,|and|plus|with)?\s*\b\d[\d,]*\+?\s+(?:[A-Za-z/&-]+\s){0,3}?(specializations?|designations?|expertises?|partner expertise|awards?)\b/gi, function (all, j, w) { return approved.indexOf(String(all.match(/\d[\d,]*/)[0]).replace(/,/g, '')) === -1 ? '' : all; }).replace(/\s{2,}/g, ' ').trim();
  };
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    var walk = function (v) {
      if (typeof v === 'string') return fix(v);
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { if (!FIG_SKIP_KEYS_[k] && k !== 'value') v[k] = walk(v[k]); }); return v; }
      return v;
    };
    Object.keys(sp).forEach(function (k) { if (!FIG_SKIP_KEYS_[k]) sp[k] = walk(sp[k]); });
  });
  if (n && ctx && ctx.log) ctx.log.push('66degrees credentials: ' + n + ' count(s) not in the approved facts left out.');
  return n;
}
