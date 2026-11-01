/* =========================
   V.1_78 - the quality layer: rules that keep every deck right, whatever words Gemini picks
   (the issues of decks 45-49 came back in new wordings each run - checks of exact phrases could not keep up)
   1. Figures: a figure is never changed - targets keep their exact value (99.95% stays 99.95%)
   2. Rules per slide kind: each part of a deck gets the rules of the slide kinds it has (pricing, KPI, RACI ...)
   3. Positive rules: what to write, not lists of forbidden words
   4. Dictionaries in code: Google Cloud and partner product names as their makers write them; words of other languages
   5. The final check: the rules no later step may undo (pricing line, KPI figures, RACI roles), run last
   6. The meaning review: one short Gemini pass per part for what code cannot judge (promises no design can keep,
      claims of rank, words of another language, broken sentences); a change is used only when it keeps every figure
      and name of the text
   Never stops a deck.
========================= */

/* ---------- 2 + 3. rules per slide kind, written as what to do ---------- */

var WRITING_RULES_ = [
  'WRITING RULES (every slide):',
  '- Describe what the design does and how: "replicates every write to a second region", "is designed to recover within the target",',
  '  "protects against data loss", "keeps downtime to a minimum". A result is stated only as a target from the request or a',
  '  figure from a source.',
  '- Write Google Cloud and partner products exactly as their makers write them (BigQuery, Cloud SQL, Memorystore for Redis,',
  '  Google Cloud Managed Service for Prometheus, Google Kubernetes Engine, AlloyDB, Looker, Vertex AI).',
  '- Write every word in English, in full words (no abbreviations such as "rep", "mgmt", "config").',
  '- State a position or rank ("leading", "first", "#1") only when a source in the notes says it; otherwise describe the fact.',
  '- Every sentence is complete; every heading is a complete phrase.'
].join('\n');

var KIND_RULES_ = {
  pricing: 'PRICING SLIDE: name each engagement model with what it includes and when it fits. Without prices in the request, no column or text for amounts or charges; the lead ends with "Pricing is confirmed after the scoping workshop."',
  kpi: 'KPI SLIDE: one tile per target figure of the request, in its order, each with its exact figure as "value" (never rounded) and how it is reached or measured as "text".',
  raci: 'RACI SLIDE: a table - first column the workstream, then one column per party (66degrees, the client\'s teams); each cell is a role only: Responsible, Accountable, Consulted or Informed (or two joined with "/").',
  risks: 'RISKS SLIDE: each risk as a title, its impact as "text" and the mitigation as "mitigation_strategy" (what the team does about it; never the words "Fix:" or "Mitigation:" in any text).',
  team: 'TEAM SLIDE: the roles or teams of both organisations, each with what it does and decides.',
  next: 'NEXT STEPS SLIDE: 3-4 concrete first actions in order, each with what it involves and who leads it.',
  support: 'SUPPORT SLIDE: the support levels or severities, each with what is covered and how it is handled; response times only as the request gives them.'
};

// the rules block for the slides of one part (or a whole short deck)
function kindRulesBlock_(ctx, batch) {
  const kinds = {};
  const list = batch && Array.isArray(batch.slides) ? batch.slides : null;
  if (list) list.forEach(function (o) {
    const f = typeof onceTopicOfEntry_ === 'function' ? onceTopicOfEntry_(o) : '';
    if (KIND_RULES_[f]) kinds[f] = true;
  });
  else Object.keys(KIND_RULES_).forEach(function (k) { kinds[k] = true; });
  const lines = [WRITING_RULES_];
  Object.keys(kinds).forEach(function (k) { lines.push(KIND_RULES_[k]); });
  return lines.join('\n');
}

/* ---------- 4. dictionaries ---------- */

// product names as their makers write them (only names that are never ordinary words)
var PRODUCT_DICT_ = ['BigQuery', 'BigLake', 'Bigtable', 'Dataflow', 'Dataproc', 'Dataplex', 'Dataform', 'Datastream', 'AlloyDB', 'Memorystore',
  'Firestore', 'Apigee', 'Looker', 'Looker Studio', 'LookML', 'Kubernetes', 'Terraform', 'Prometheus', 'Grafana', 'Redis', 'PostgreSQL', 'MySQL',
  'OpenTelemetry', 'Kafka', 'Eventarc', 'Cloud SQL', 'Cloud Run', 'Cloud Spanner', 'Cloud Storage', 'Cloud Armor', 'Cloud Build',
  'Cloud Deploy', 'Cloud Composer', 'Cloud Monitoring', 'Cloud Logging', 'Cloud Trace', 'Cloud KMS', 'Cloud DNS', 'Cloud NAT',
  'Cloud Interconnect', 'Cloud Functions', 'Cloud Load Balancing', 'Artifact Registry', 'Secret Manager', 'Pub/Sub', 'Vertex AI',
  'Vertex AI Search', 'Vertex AI Feature Store', 'Vertex AI Pipelines', 'Gemini', 'Gemini Enterprise', 'Google Kubernetes Engine',
  'Database Migration Service', 'Security Command Center', 'VPC Service Controls', 'Analytics Hub', 'Config Sync', 'Binary Authorization',
  'PagerDuty', 'ServiceNow', 'GitHub', 'GitLab', 'Jira', 'SQL Server', 'Oracle', 'Databricks', 'Salesforce',
  'Avro', 'KEDA', 'FNOL', 'gRPC', 'mTLS', 'HL7', 'FHIR', 'OAuth', 'Vertex AI Search', 'Looker Studio'];   // V.1_79 (deck 50: "avro", "Keda", "fnol", "GRPC", "MTLS")
var PRODUCT_RE_ = null;
function productCase_(t) {
  if (typeof t !== 'string' || !t) return t;
  if (!PRODUCT_RE_) {
    const names = PRODUCT_DICT_.slice().sort(function (a, b) { return b.length - a.length; });
    PRODUCT_RE_ = new RegExp('(^|[^A-Za-z0-9/@.-])(' + names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }).join('|') + ')(?![A-Za-z0-9-])', 'gi');
  }
  return t.replace(PRODUCT_RE_, function (m, pre, name, off, str) {
    const right = PRODUCT_DICT_.filter(function (n) { return n.toLowerCase() === name.toLowerCase(); })[0] || name;
    // a name of two words or more is put right only when it starts with its capital ("Cloud monitoring" -> "Cloud
    // Monitoring"); in lower case it may be ordinary words ("cloud storage costs")
    // (V.1_79, deck 50 General 2 slide 11: "vertex AI Search" - the rest of the name in its capitals: the name)
    if (/\s/.test(right) && !/^[A-Z]/.test(name) && name.slice(name.indexOf(' ')) !== right.slice(right.indexOf(' '))) return m;
    // (code, paths and addresses stay as written: "/api/redis", "redis://", "kubernetes.io")
    const after = str.charAt(off + m.length);
    if (after === '.' && /[a-z]/.test(str.charAt(off + m.length + 1))) return m;
    if (after === ':' && str.charAt(off + m.length + 1) === '/') return m;
    return pre + right;
  });
}

// words of another language that are never English, with their English word
var FOREIGN_DICT_ = { mencapai: 'achieve', meningkatkan: 'improve', mengurangi: 'reduce', mempercepat: 'accelerate', untuk: 'for', dengan: 'with',
  yang: 'that', lebih: 'more', cepat: 'faster', dalam: 'in', adalah: 'is', alcanzar: 'achieve', lograr: 'achieve', mejorar: 'improve',
  reducir: 'reduce', aumentar: 'increase', mediante: 'through', atteindre: 'achieve', améliorer: 'improve', réduire: 'reduce', avec: 'with',
  erreichen: 'achieve', verbessern: 'improve', reduzieren: 'reduce', durch: 'through', und: 'and', mehr: 'more', através: 'through',
  melhorar: 'improve', alcançar: 'achieve', cuatro: 'four', tres: 'three', cinco: 'five', seis: 'six', quatre: 'four', trois: 'three',
  vier: 'four', drei: 'three', quatro: 'four', etapas: 'stages', pasos: 'steps' };
var FOREIGN_RE_ = new RegExp('(^|[^\\p{L}])(' + Object.keys(FOREIGN_DICT_).join('|') + ')(?![\\p{L}])', 'giu');
// letters of other scripts inside an English text (Devanagari, CJK, Cyrillic, Arabic, Thai ...)
var OTHER_SCRIPT_RE_ = /[Ѐ-ӿ؀-ۿऀ-ॿ฀-๿぀-ヿ㐀-鿿가-힯]+/g;
function englishOnly_(t) {
  if (typeof t !== 'string' || !t) return t;
  return t.replace(FOREIGN_RE_, function (m, pre, w) { const e = FOREIGN_DICT_[w.toLowerCase()] || w; return pre + (/^[A-Z]/.test(w) ? e.charAt(0).toUpperCase() + e.slice(1) : e); })
    .replace(OTHER_SCRIPT_RE_, '').replace(/\s{2,}/g, ' ').replace(/[ \t]+([.,;:])(?=\s|$)/g, '$1');
}

// short forms Gemini leaves in labels
var ABBREV_DICT_ = { rep: 'replication', repl: 'replication', mgmt: 'management', mgr: 'manager', reqs: 'requests', perf: 'performance', env: 'environment', envs: 'environments', infra: 'infrastructure' };
var ABBREV_RE_ = new RegExp('\\b(' + Object.keys(ABBREV_DICT_).join('|') + ')\\b(?![./:-])', 'gi');
function fullWords_(t) {
  if (typeof t !== 'string' || !t) return t;
  return t.replace(ABBREV_RE_, function (w) { const e = ABBREV_DICT_[w.toLowerCase()]; return /^[A-Z]/.test(w) ? e.charAt(0).toUpperCase() + e.slice(1) : e; });
}

// every visible text of a slide, with its path (for the review and the dictionaries)
var QUALITY_SKIP_ = { notes: 1, reference: 1, design: 1, lockTag: 1, icon: 1, icons: 1, image: 1, logo: 1, resolvedIcons: 1, type: 1, deckLibrary: 1,
  material: 1, url: 1, status: 1, kind: 1, value: 1, fact_tags: 1, clientLogo: 1, cobrand: 1, shapeFixes: 1, number: 1, tag: 1, owner: 0 };
function slideTexts_(sp) {
  const out = [];
  const walk = function (v, path) {
    if (typeof v === 'string') { if (/[A-Za-z]{3}/.test(v)) out.push({ path: path, text: v }); return; }
    if (Array.isArray(v)) { v.forEach(function (x, i) { walk(x, path.concat([i])); }); return; }
    if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (!QUALITY_SKIP_[k]) walk(v[k], path.concat([k])); });
  };
  walk(sp, []);
  return out;
}
function setPath_(obj, path, value) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) { if (o == null) return; o = o[path[i]]; }
  if (o != null) o[path[path.length - 1]] = value;
}

function dictionaryPass_(slides) {
  let n = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object' || String(sp.type || '').toLowerCase() === 'template') return;
    slideTexts_(sp).forEach(function (t) {
      const y = fullWords_(englishOnly_(productCase_(t.text)));
      if (y !== t.text) { setPath_(sp, t.path, y); n++; }
    });
  });
  return n;
}

/* ---------- 1. figures ---------- */

// the figures of a text, as written ("99.95%", "$61.6B", "3x", "<15 min")
function figuresOf_(t) {
  return (String(t || '').match(/[<>~]?\s?[$€£₹]?\d[\d,]*(?:\.\d+)?\s?(?:%|x\b|×|[kmb]\b|ms\b|min\b|hours?\b|days?\b)?/gi) || [])
    .map(function (f) { return f.replace(/\s+/g, '').toLowerCase(); }).sort();
}

/* ---------- 5. the final check ---------- */

// the KPI slide of a deck that has target figures: its tiles carry the figures (written again from the brief when a
// tile lost its figure), whatever ran before
function finalKpi_(slides, ctx) {
  const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  if (targets.length < 2 || typeof conformKpi_ !== 'function') return 0;
  let n = 0;
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    const kind = typeof contractKind_ === 'function' ? contractKind_(sp, ctx) : '';
    const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
    // a slide of the request's targets as cards without figures (deck 49 Solution 6 "Claims platform migration
    // business targets": three cards named after the three targets, no figure on any of them)
    const named = items.length >= 2 && items.length <= 4 && /\btargets?\b|\bkpis?\b|success (measures|metrics)|key performance/i.test(String(sp.title || '')) &&
      targets.filter(function (f) { return items.some(function (it) { return sharedWords_(String(it.title || it.label || ''), f.label) >= Math.min(2, String(f.label).split(/\s+/).filter(function (w) { return w.length > 3; }).length || 1); }); }).length >= Math.min(2, targets.length);
    if (kind !== 'kpi' && !named) return;
    const missing = items.length < 2 || items.some(function (it) { return !it || !/\d/.test(String(it.value || '')); }) ||
      targets.slice(0, 4).some(function (f) { return !items.some(function (it) { return it && figKey_(String(it.value || '')) === f.key; }); });
    if (missing && conformKpi_(sp, ctx)) n++;
  });
  return n;
}

function finalLock_(slides, ctx) {
  let n = 0;
  try { n += finalKpi_(slides, ctx); } catch (e) {}
  (slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    const kind = typeof contractKind_ === 'function' ? contractKind_(sp, ctx) : '';
    try {
      if (kind === 'raci' && typeof normalizeRaci_ === 'function' && normalizeRaci_(sp)) n++;
      if (kind === 'pricing' && typeof conformPricing_ === 'function' && conformPricing_(sp, ctx)) n++;
    } catch (e) {}
  });
  return n;
}

/* ---------- 6. the meaning review ---------- */

var REVIEW_SCHEMA_ = {
  type: 'OBJECT',
  properties: { fixes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'INTEGER' }, text: { type: 'STRING' }, rule: { type: 'STRING' } }, required: ['id', 'text'] } } },
  required: ['fixes']
};
// a cheap first look: which texts may break a rule (the others are not sent)
var REVIEW_HINT_RE_ = /\b(guarantee\w*|zero[- ]?(data|message|record|downtime|loss|defects?|risk|impact|errors?|outage)|eliminat\w+|never (fail|lose|go down)|always (on|available)|100\s?%|#\s?1\b|best[- ]in[- ]class|industry[- ]leading|world[- ]class|unmatched|unrivall?ed|leading provider|number one|fail[- ]?proof|bullet[- ]?proof|risk[- ]free|seamless\w*|instant\w*|perfect\w*|no risk|no downtime|completely (secure|safe|eliminat)|no data loss|rpo\s*=\s*0|rto\s*=\s*0)\b/i;   // V.1_79b
function reviewCandidate_(t) {
  const x = String(t || '');
  return REVIEW_HINT_RE_.test(x) || /[^\x00-\x7F–—‘’“”…°×•®™é]/.test(x) ||
    (typeof isFragment_ === 'function' && isFragment_(x));
}
// a fix is used only when it keeps every figure and every name of the text and adds none
function reviewFixOk_(before, after) {
  const a = String(after || '').trim(), b = String(before || '');
  if (!a || a === b) return false;
  if (a.length < b.length * 0.5 || a.length > b.length * 1.6 + 20) return false;
  if (figuresOf_(a).join('|') !== figuresOf_(b).join('|')) return false;
  const names = (b.match(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)+\b|\b[A-Z]{2,}[a-z]?\b|\b\w*[a-z][A-Z]\w*\b/g) || []).filter(function (nm) { return !/^(The|A|An|This|These|Our|We)\b/.test(nm); });
  if (names.some(function (nm) { return a.indexOf(nm) === -1 && a.toLowerCase().indexOf(nm.toLowerCase()) === -1; })) return false;
  return true;
}
var REVIEW_TIME_MS_ = 250000;   // no review after this long into a part (the Apps Script limit is 6 minutes)

function meaningReview_(slides, ctx, started) {
  const res = { asked: 0, fixed: 0 };
  if (!ctx || !ctx.apiKey || typeof callGeminiJSON !== 'function') return res;
  if (started && Date.now() - started > REVIEW_TIME_MS_) return res;
  const list = [];
  (slides || []).forEach(function (sp, i) {
    if (!sp || typeof sp !== 'object' || ['cover', 'agenda', 'closing', 'section', 'template'].indexOf(String(sp.type || '').toLowerCase()) !== -1) return;
    slideTexts_(sp).forEach(function (t) {
      if (list.length < 60 && reviewCandidate_(t.text)) list.push({ id: list.length, slide: i, path: t.path, text: t.text });
    });
  });
  if (!list.length) return res;
  res.asked = list.length;
  const client = (ctx.brief && ctx.brief.client && ctx.brief.client.name) || '';
  const prompt = [
    'You review slide texts of a ' + ((ctx.brand && ctx.brand.name) || '66degrees') + ' presentation' + (client ? ' for ' + client : '') + '.',
    'Return ONLY the texts that need a change, rewritten with the smallest change that follows these rules:',
    '1. A promise no design can keep (guarantees, zero data loss or downtime, eliminates all risk, never fails, 100%) says what',
    '   the design does instead: "is designed to", "protects against", "keeps ... to a minimum", "reduces".',
    '2. A claim of rank or superiority (#1, best-in-class, industry-leading, unmatched) is stated as the plain fact without the rank.',
    '3. A word that is not English is replaced by its English word.',
    '4. A sentence that is broken or ends mid-phrase is completed from its own words, or the broken part is removed.',
    'Keep every figure, product name, client name and technical term exactly as written. Add no figures, facts or claims.',
    'Keep about the same length and the same case style. Texts that follow the rules are not returned.',
    'Return ONLY JSON: {"fixes":[{"id":0,"text":"","rule":"1"}]}',
    JSON.stringify(list.map(function (x) { return { id: x.id, text: x.text }; }))
  ].join('\n');
  let out = null;
  try {
    out = (typeof withContentModel_ === 'function' ? withContentModel_ : function (c, fn) { return fn(); })(ctx, function () {
      return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1, { schema: REVIEW_SCHEMA_ });
    });
  } catch (e) { if (ctx.log) ctx.log.push('Meaning review skipped: ' + e.message); return res; }
  ((out && out.fixes) || []).forEach(function (f) {
    const x = list.filter(function (l) { return l.id === f.id; })[0];
    if (!x || !reviewFixOk_(x.text, f.text)) return;
    setPath_(slides[x.slide], x.path, String(f.text).trim());
    res.fixed++;
  });
  if (res.fixed && ctx.log) ctx.log.push('Meaning review: ' + res.fixed + ' text(s) rewritten (promises, ranks, other languages, broken sentences).');
  return res;
}

// the whole quality step, run last on a set of slides (a short deck, or one part of a long deck)
function qualitySlides_(slides, ctx, started) {
  const r = { dict: 0, lock: 0, review: null };
  try { r.dict = dictionaryPass_(slides); } catch (e) {}
  try { r.review = meaningReview_(slides, ctx, started); } catch (e) { if (ctx && ctx.log) ctx.log.push('Meaning review skipped: ' + e.message); }
  try { r.v79 = typeof v79Pass_ === 'function' ? v79Pass_(slides, ctx, ctx && ctx.qualitySources) : 0; } catch (e) { if (ctx && ctx.log) ctx.log.push('V.1_79 checks skipped: ' + e.message); }
  try { r.dict += dictionaryPass_(slides); } catch (e) {}
  try { r.lock = finalLock_(slides, ctx); } catch (e) {}
  return r;
}
