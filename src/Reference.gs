/**
 * 66degrees Reference Library — connects the "66degrees Presentation Template - 2026" (122 slides)
 * to the generator as the PRIMARY design, brand and fact reference.
 *
 * Data (see CONFIG in Code.gs):
 *   refLibraryFileId  -> 66d_reference_library.json (full model, uploaded to Drive)
 *   referenceDeckId   -> the template imported as native Google Slides (icons + thumbnails)
 *   Runtime file      -> 66d_reference_runtime.json, CREATED by harvestReferenceDeck() (objectIds + thumbnail ids)
 *
 * Everything here degrades gracefully: when the library can't be loaded, the pipeline runs exactly as before.
 */

var REF = {
  cacheKey: 'ref_lib_v1',
  runtimeCacheKey: 'ref_runtime_v1',
  runtimePropKey: 'REF_RUNTIME_FILE_ID',
  thumbFolderPropKey: 'REF_THUMB_FOLDER_ID',
  harvestStateKey: 'REF_HARVEST_STATE',
  scoreThreshold: 40,
  harvestBudgetMs: 270000,           // stay well inside the 6-minute Apps Script limit
  iconSlideNumber: 114,
  iconRowCounts: [23, 23, 23, 23, 23, 24, 23, 23, 23, 23, 23, 23]
};

// Item counts only discriminate layouts for these types (66D_MATCH_003)
const COUNT_TYPES = ['cards', 'process', 'timeline', 'stats', 'agenda', 'bullets'];
// Template slides built for one specific purpose: only chosen when the slide content is about that purpose
const SPECIAL_PURPOSE = {
  pricing_options_2: /pric|cost|fee|option|commercial|budget/i,
  pricing_table: /pric|cost|fee|commercial|budget/i,
  evolution_three_eras: /evolution|era|history|past|future|then|now/i,
  raid_register: /risk|issue|raid/i,
  status_report_rag: /status|rag|progress/i,
  gantt_table_weeks: /week|sprint|schedule|plan|gantt/i,
  workstream_week_matrix: /workstream|week|plan/i,
  okr_objective_tabs: /objective|okr|key result/i,
  check_matrix_3_options: /option|model|vs|versus|compare/i
};

// Generated types that the template has no direct reference for (see spec Part 6)
const NO_REFERENCE_TYPES = ['next_steps', 'quote'];

var TYPE_ALIASES = {
  intro: 'statement', key_message: 'statement', problem: 'cards', benefits: 'cards', kpi: 'stats', metrics: 'stats',
  steps: 'process', roadmap: 'timeline', list: 'bullets', thank_you: 'closing', title: 'cover', divider: 'section',
  case: 'case_study', checklist: 'next_steps', two_column: 'comparison'
};

/* =========================
   LOADING
========================= */

function loadReferenceLibrary(force) {
  if (!CONFIG.useReferenceLibrary || !CONFIG.refLibraryFileId) return null;
  if (!force) {
    const cached = readCache(REF.cacheKey);
    if (cached) return cached;
  }
  try {
    const full = JSON.parse(DriveApp.getFileById(CONFIG.refLibraryFileId).getBlob().getDataAsString());
    const lib = slimLibrary_(full);
    writeCache(REF.cacheKey, lib);
    return lib;
  } catch (e) {
    Logger.log('Reference library could not be loaded: ' + e.message);
    return null;
  }
}

// Keeps only what the pipeline needs at run time (keeps the cached copy small)
function slimLibrary_(full) {
  const pick = function (o, keys) { const r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
  return {
    schemaVersion: full.schemaVersion,
    deck: pick(full.deck || {}, ['name', 'totalSlides']),
    slides: (full.slides || []).map(function (s) {
      return pick(s, ['tag', 'slideNumber', 'title', 'category', 'subtype', 'layoutPattern', 'background', 'uiComponents',
        'usefulFor', 'priority', 'reusable', 'referenceOnly', 'mapsToGeneratedTypes', 'contentStatus']);
    }),
    uiComponents: (full.uiComponents || []).map(function (u) { return pick(u, ['tag', 'name', 'visualRules', 'contentRules']); }),
    icons: (full.icons || []).map(function (i) { return pick(i, ['tag', 'name', 'family', 'gridRow', 'gridCol', 'keywords']); }),
    brand: {
      colors: ((full.brand || {}).colors || []).map(function (c) { return pick(c, ['tag', 'name', 'hex', 'role', 'official']); }),
      fonts: ((full.brand || {}).fonts || []).map(function (f) { return pick(f, ['tag', 'family', 'role']); }),
      rules: ((full.brand || {}).rules || []).map(function (r) { return pick(r, ['tag', 'rule']); })
    },
    companyFacts: (full.companyFacts || []).map(function (f) { return pick(f, ['tag', 'category', 'name', 'statement', 'evidence', 'keywords', 'sourceSlides']); }),
    leadership: (full.leadership || []).map(function (l) { return pick(l, ['tag', 'name', 'title', 'sourceSlide']); }),
    slideTypeMapping: full.slideTypeMapping || [],
    proposedAdditionalTypeMapping: full.proposedAdditionalTypeMapping || []
  };
}

var REF_RUNTIME_ERROR = '';   // why the harvest data could not be loaded (shown in the dialog message)
function loadReferenceRuntime(force) {
  const id = PropertiesService.getScriptProperties().getProperty(REF.runtimePropKey);
  if (!id) { REF_RUNTIME_ERROR = 'no harvest saved yet (Script property ' + REF.runtimePropKey + ' is empty)'; return null; }
  if (!force) {
    const cached = readCache(REF.runtimeCacheKey);
    if (cached) return cached;
  }
  try {
    const rt = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
    writeCache(REF.runtimeCacheKey, rt);
    return rt;
  } catch (e) {
    Logger.log('Reference runtime could not be loaded: ' + e.message);
    REF_RUNTIME_ERROR = 'harvest file could not be read: ' + e.message;
    return null;
  }
}

function clearReferenceCaches() {
  clearCache(REF.cacheKey);
  clearCache(REF.runtimeCacheKey);
}

/* =========================
   BRAND PROFILE + DESIGN TOKENS
========================= */

// Brand values in the existing DEFAULT_BRAND shape, taken from the template
function libraryBrandProfile(lib, base) {
  const profile = JSON.parse(JSON.stringify(base || DEFAULT_BRAND));
  if (!lib) return profile;
  const isHex = function (h) { return typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h); };
  const palette = [];
  (lib.brand.colors || []).forEach(function (c) {
    if (isHex(c.hex) && palette.indexOf(c.hex.toUpperCase()) === -1) palette.push(c.hex.toUpperCase());
  });
  profile.palette = DEFAULT_BRAND.palette.slice();           // Brand Guidelines colors only
  profile.roles = JSON.parse(JSON.stringify(DEFAULT_BRAND.roles));
  Object.keys(profile.roles).forEach(function (k) {
    if (profile.palette.indexOf(profile.roles[k]) === -1) profile.palette.push(profile.roles[k]);
  });
  const primary = (lib.brand.fonts || []).filter(function (f) { return f.role === 'primary'; })[0];
  const secondary = (lib.brand.fonts || []).filter(function (f) { return f.role === 'secondary'; })[0];
  if (primary) {
    profile.fonts.heading.slides = primary.family;
    profile.fonts.body.slides = primary.family;
  }
  if (secondary) profile.fonts.mono.slides = secondary.family;
  profile.rules = (profile.rules && profile.rules.length ? profile.rules : DEFAULT_BRAND.rules).concat([
    'Only statements supported by the approved facts may be made about 66degrees.'
  ]).filter(function (r, i, all) { return all.indexOf(r) === i; });
  profile.source = 'reference-library';
  return profile;
}

// Design tokens for Rebrand.gs (IPAY) and Engine.gs (T), from the template palette
function libraryTokens(lib) {
  // Brand Guidelines 2026 colors only (they override the template's own colors, e.g. #FFFFFF, #000000, #333333, #F2F7FB)
  const C = BRAND_COLORS;
  return {
    white: C.white, bgLight: C.neutral1, ink: C.nightBlue, title: C.nightBlue, body: C.nightBlue, blue: C.blue,
    navy: C.blue, slate: C.sharkGrey, slateLight: C.sharkGrey, panelAlt: C.neutral2, cardLine: C.neutral4,
    tileBlue: C.neutral1, tileGrey: C.neutral2, boxFill: C.neutral1, boxLine: C.neutral4, connector: C.blue,
    // sequences (process steps, timeline tabs, chart series) use only brand colors
    ramp: [C.blue, C.blue, C.blue, C.blue, C.blue, C.blue],
    tints: [C.blue, C.blue, C.blue, C.sharkGrey, C.neutral2],
    barMuted: C.sharkGrey, green: C.blue, orange: C.sharkGrey, red: C.nightBlue, badge: C.nightBlue,
    depth: C.blue
  };
}

// Every color the brand pass may leave untouched
function libraryKeepColors(lib, tokens) {
  // Only the Brand Guidelines colors are kept; every other fill is snapped to the nearest brand color
  return Object.keys(BRAND_COLORS).map(function (k) { return BRAND_COLORS[k].toUpperCase(); });
}

/* =========================
   COMPANY FACTS
========================= */

const CORE_FACT_TAGS = ['66D_FACT_COMPANY_001', '66D_FACT_COMPANY_002', '66D_FACT_COMPANY_003', '66D_FACT_COMPANY_004',
  '66D_FACT_COMPANY_005', '66D_FACT_COMPANY_008', '66D_FACT_COMPANY_011', '66D_FACT_COMPANY_013'];

// Returns { usable: [statement strings], verify: [statement strings], tags: [] } for the planning prompt
function libraryFacts(lib, text, max) {
  max = max || 22;
  const out = { usable: [], verify: [], tags: [] };
  if (!lib) return out;
  const words = tokenize_(text);
  const scored = [];
  (lib.companyFacts || []).forEach(function (f) {
    if (f.evidence === 'conflict') return;
    let score = CORE_FACT_TAGS.indexOf(f.tag) !== -1 ? 100 : 0;
    const hay = tokenize_([f.name, (f.keywords || []).join(' '), f.category].join(' '));
    words.forEach(function (w) { if (hay.indexOf(w) !== -1) score += 3; });
    if (f.category === 'client_list' && !/client|customer|logo|who we work/i.test(text)) score = -1;
    if (f.category === 'third_party_statistic' && !/market|cloud|mainframe|tco|moderniz/i.test(text)) score = -1;
    if (score < 0) return;
    if (score === 0 && f.category === 'case_study') score = 1;     // proof points are always useful
    scored.push({ f: f, score: score });
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  scored.slice(0, max).forEach(function (x) {
    const f = x.f;
    const line = f.statement + ' [' + f.tag + ']';
    if (f.evidence === 'image_read') out.verify.push(line);
    else out.usable.push(line);
    out.tags.push(f.tag);
  });
  return out;
}

/* =========================
   REFERENCE SELECTION (spec Part 8, rules 66D_MATCH_001-012)
========================= */

function normalizeType_(t) {
  t = String(t || '').toLowerCase();
  return TYPE_ALIASES[t] || t;
}

function itemCount_(spec) {
  const arrLen = function (a) { return Array.isArray(a) ? a.length : 0; };
  return arrLen(spec.items) || arrLen(spec.points) || arrLen(spec.results) || arrLen(spec.rows) ||
    ((spec.left || spec.right) ? 2 : 0) || arrLen(spec.chart && spec.chart.categories);
}

function specText_(spec) {
  const parts = [spec.title, spec.eyebrow, spec.lead, spec.statement, spec.text];
  (spec.items || []).forEach(function (it) { parts.push(typeof it === 'string' ? it : [it.title, it.text, it.label].join(' ')); });
  (spec.points || []).forEach(function (p) { parts.push(typeof p === 'string' ? p : [p.title, p.text].join(' ')); });
  return parts.filter(Boolean).join(' ');
}

function tokenize_(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length > 2 && ['the', 'and', 'for', 'with', 'our', 'your', 'from', 'that', 'this', 'are'].indexOf(w) === -1; });
}

function cardStyleFor_(slide) {
  const ui = (slide && slide.uiComponents) || [];
  if (ui.indexOf('66D_UI_CARD_004') !== -1) return 'rule';
  if (ui.indexOf('66D_UI_CARD_003') !== -1 || ui.indexOf('66D_UI_CARD_005') !== -1) return 'elevated';
  return 'panel';
}

function referenceObject_(slide, score, fallback) {
  return {
    tag: slide ? slide.tag : 'NONE',
    slideNumber: slide ? slide.slideNumber : null,
    subtype: slide ? slide.subtype : null,
    layoutPattern: slide ? slide.layoutPattern : '',
    uiComponents: slide ? (slide.uiComponents || []) : [],
    background: slide && slide.background ? slide.background.type : 'light',
    cardStyle: cardStyleFor_(slide),
    score: score || 0,
    fallback: !!fallback
  };
}

// Picks the best template slide for one content spec. usage = { lastTag, counts{} } (variety tracking)
function selectReferenceForSpec(lib, spec, usage) {
  usage = usage || { lastTag: null, counts: {} };
  const type = normalizeType_(spec.type);
  if (!lib) return null;
  if (NO_REFERENCE_TYPES.indexOf(type) !== -1) return referenceObject_(null, 0, true);
  const map = (lib.slideTypeMapping || []).filter(function (m) { return m.generatedType === type; })[0];
  if (!map || !/^66D_/.test(map.primaryReference)) return referenceObject_(null, 0, true);

  const bySlideTag = {};
  lib.slides.forEach(function (s) { bySlideTag[s.tag] = s; });

  // Types the engine can draw in several template designs: rotate through the designs that fit the
  // item count, continuing from where the previous deck stopped, and never repeat the previous slide's design.
  const designs = drawableDesigns_(type, itemCount_(spec), spec);
  if (designs.length) {
    const rot = loadRotation_(usage);
    const last = usage.lastByType ? usage.lastByType[type] : null;
    // Gemini's choice (spec.design) wins when that design suits the item count; otherwise rotate
    const wanted = spec.design ? designs.map(function (d) { return d.tag; }).indexOf(String(spec.design).trim()) : -1;
    let k = wanted !== -1 ? wanted : ((rot[type] == null ? -1 : rot[type]) + 1) % designs.length;
    // content written for a special design (e.g. several client cases) always gets that design
    const special = designs.map(function (d) { return !!d.needs; }).indexOf(true);
    if (special !== -1) k = special;
    if (wanted === -1 && special === -1 && designs.length > 1 && designs[k].tag === last) k = (k + 1) % designs.length;
    const chosen = designs[k];
    rot[type] = k;
    usage.rotationDirty = true;
    usage.lastByType = usage.lastByType || {};
    usage.lastByType[type] = chosen.tag;
    usage.lastTag = chosen.tag;
    usage.counts[chosen.tag] = (usage.counts[chosen.tag] || 0) + 1;
    const ref = referenceObject_(bySlideTag[chosen.tag] || null, 60, false);
    ref.tag = chosen.tag;
    return ref;
  }

  const candidates = [map.primaryReference].concat(map.secondaryReferences || []);
  const n = itemCount_(spec);
  const words = tokenize_(specText_(spec));
  let best = null;

  candidates.forEach(function (tag, idx) {
    const s = bySlideTag[tag];
    if (!s || s.referenceOnly || s.reusable === false) return;                      // 66D_MATCH_001
    let score = idx === 0 ? 50 : 40;                                                 // 66D_MATCH_002
    const m = String(s.subtype || '').match(/_(\d+)(?:_[a-z]+)?$/);
    if (COUNT_TYPES.indexOf(type) !== -1 && m && n >= 3 && Number(m[1]) === n) score += 20;   // 66D_MATCH_003
    const special = SPECIAL_PURPOSE[s.subtype];                                      // pricing, OKRs… only on request
    if (special && !special.test(specText_(spec))) score -= 40;
    let kw = 0;
    const useful = tokenize_((s.usefulFor || []).join(' ') + ' ' + (s.category || ''));
    words.forEach(function (w) { if (useful.indexOf(w) !== -1) kw += 2; });
    score += Math.min(kw, 15);                                                       // 66D_MATCH_004
    if (usage.department) {
      tokenize_(usage.department).forEach(function (w) {
        if (useful.indexOf(w) !== -1) score += 8;
      });
    }
    score += s.priority === 'PRIMARY' ? 10 : (s.priority === 'SECONDARY' ? 5 : 0);   // 66D_MATCH_005
    if (usage.lastTag === tag) score -= 15;                                          // 66D_MATCH_006
    score -= 5 * (usage.counts[tag] || 0);
    if (/dark/.test((s.background || {}).type || '') && usage.darkCount >= 1 && ['section', 'cover', 'closing'].indexOf(type) === -1) score -= 10;
    if (!best || score > best.score) best = { slide: s, score: score };
  });

  if (!best || best.score < REF.scoreThreshold) return referenceObject_(null, best ? best.score : 0, true);   // 66D_MATCH_011
  usage.lastTag = best.slide.tag;
  usage.counts[best.slide.tag] = (usage.counts[best.slide.tag] || 0) + 1;
  if (/dark/.test((best.slide.background || {}).type || '')) usage.darkCount = (usage.darkCount || 0) + 1;
  return referenceObject_(best.slide, best.score, false);
}

// Reference object for one specific design tag (used when the design is re-chosen to suit the content)
function referenceForTag_(lib, tag) {
  const slide = lib ? (lib.slides || []).filter(function (x) { return x.tag === tag; })[0] : null;
  const ref = referenceObject_(slide || null, 60, false);
  ref.tag = tag;
  return ref;
}

// Template designs the layout engine can draw for a type (Engine.gs VARIANTS), filtered by item count
function drawableDesigns_(type, n, spec) {
  const all = ((typeof ENGINE !== 'undefined' && ENGINE.VARIANTS && ENGINE.VARIANTS[type]) || []).filter(function (v) {
    // designs that need extra fields (e.g. the client journey needs spec.cases) are only offered when the slide has them
    return !v.needs || (spec && Array.isArray(spec[v.needs]) && spec[v.needs].length >= 2);
  });
  const fits = all.filter(function (v) { return !n || (n >= v.min && n <= v.max); });
  return fits.length ? fits : all.slice(0, 1);
}

// Design rotation between decks (per user): { type: index of the design used last }
function loadRotation_(usage) {
  if (!usage.rotation) {
    let rot = {};
    try { rot = JSON.parse(PropertiesService.getUserProperties().getProperty('REF_DESIGN_ROTATION') || '{}'); } catch (e) { rot = {}; }
    usage.rotation = rot;
  }
  return usage.rotation;
}

function saveRotation_(usage) {
  if (!usage || !usage.rotation || !usage.rotationDirty) return;
  try { PropertiesService.getUserProperties().setProperty('REF_DESIGN_ROTATION', JSON.stringify(usage.rotation)); } catch (e) {}
  usage.rotationDirty = false;
}

// Adds spec.reference to every planned slide (Create mode). Returns { matched, fallback }.
function selectReferences(plan, ctx) {
  const res = { matched: 0, fallback: 0 };
  if (!ctx.lib || !plan || !plan.slides) return res;
  const usage = { lastTag: null, counts: {}, darkCount: 0, department: ctx.department || '' };
  plan.slides.forEach(function (spec) {
    const ref = selectReferenceForSpec(ctx.lib, spec, usage);
    spec.reference = ref;
    if (!ref) return;
    if (ref.fallback) {
      res.fallback++;          // reported in the dialog message only; speaker notes stay clean
    } else {
      res.matched++;
    }
  });
  saveRotation_(usage);
  return res;
}

// "quote" only when the quotation is really in the request or source material; otherwise it becomes a statement
function enforceQuoteRule(plan, userPrompt, sources) {
  const haystack = (String(userPrompt || '') + ' ' + String((sources && sources.text) || '')).toLowerCase();
  (plan.slides || []).forEach(function (s) {
    if (String(s.type || '').toLowerCase() !== 'quote') return;
    const q = String(s.quote || '').toLowerCase().replace(/[“”"]/g, '').trim();
    const probe = q.slice(0, 40);
    if (probe && haystack.indexOf(probe) !== -1) return;
    s.type = 'statement';
    s.statement = s.quote || s.title || '';
    s.text = '';
    delete s.quote;
    delete s.attribution;
  });
}

/* =========================
   BEAUTIFUL.AI DESIGN BRIEFS
========================= */

function designBriefFor(reference) {
  if (!reference) return '';
  if (reference.fallback) return 'Clean, flat layout on white; one idea; accent color #0052FF only.';
  const style = {
    panel: 'flat light neutral panel cards (#F3F2F0) on a warm white background, small rounded corners, no shadows',
    elevated: 'white cards with a thin light border on a light neutral (#F3F2F0) background',
    rule: 'light panel cards with a thin blue bar on the left edge'
  }[reference.cardStyle] || '';
  let layout = String(reference.layoutPattern || '')
    .replace(/#[0-9A-Fa-f]{6}/g, '')
    .replace(/\([^)]*\)/g, '')                          // drop parenthesised details (sample labels, slide numbers)
    .replace(/'[^']*'/g, 'a short label')                 // never pass template wording as content
    .replace(/\s+([,;.:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (layout.length > 230) layout = layout.slice(0, 227).replace(/[\s,;]+\S*$/, '') + '…';
  return layout + (style ? ' Cards: ' + style + '.' : '');
}

/* =========================
   THUMBNAILS (from the harvested runtime)
========================= */

function referenceThumbnailBlob(tag, ctx) {
  const rt = ctx.refRuntime;
  const id = rt && rt.thumbs && rt.thumbs[tag];
  if (!id) return null;
  try { return getBlobCached(id, ctx); } catch (e) { return null; }
}

/* =========================
   ICONS (slide 114 of the template, copied as vectors)
========================= */

const ICON_SYNONYMS = {
  security: ['shield', 'lock'], secure: ['shield', 'lock'], compliance: ['shield', 'scales'], governance: ['scales', 'shield'],
  data: ['database', 'chart'], analytics: ['analytics', 'chart'], insight: ['analytics', 'idea'], insights: ['analytics', 'idea'],
  ai: ['ai', 'brain'], agent: ['robot', 'ai'], agents: ['robot', 'ai'], agentic: ['robot', 'ai'], genai: ['ai', 'brain'],
  model: ['brain', 'chip'], ml: ['brain', 'chip'], automation: ['gear', 'robot'], automate: ['gear', 'robot'],
  cost: ['dollar'], savings: ['dollar'], revenue: ['finance', 'dollar'], roi: ['finance', 'growth'], budget: ['dollar', 'cash'],
  speed: ['fast', 'power'], faster: ['fast', 'trend'], growth: ['growth', 'trend'], scale: ['growth', 'layers'],
  team: ['team'], people: ['team', 'users'], customer: ['user', 'heart'], customers: ['user', 'heart'], experience: ['user', 'heart'],
  time: ['clock', 'hourglass'], migration: ['cloud', 'upload'], migrate: ['cloud', 'upload'], cloud: ['cloud'],
  process: ['gear', 'workflow'], workflow: ['workflow', 'gear'], training: ['presentation', 'book'], learning: ['book', 'idea'],
  search: ['search'], chat: ['chat'], support: ['headset'], strategy: ['target', 'strategy'], goal: ['target'], goals: ['target'],
  innovation: ['idea', 'magic'], idea: ['idea'], integration: ['network', 'plug'], platform: ['layers', 'server'],
  infrastructure: ['server', 'cloud'], network: ['network'], document: ['document'], documents: ['document'],
  partner: ['handshake'], partnership: ['handshake'], award: ['award', 'trophy'], success: ['trophy', 'check'],
  risk: ['warning', 'shield'], quality: ['check', 'award'], mobile: ['smartphone'], global: ['globe'], world: ['globe'],
  plan: ['calendar', 'route'], roadmap: ['route', 'calendar'], meeting: ['meeting'], collaboration: ['team', 'chat'],
  code: ['code'], developer: ['code'], software: ['code', 'monitor'], monitor: ['monitor', 'view'], visibility: ['view', 'search'],
  language: ['globe'], website: ['globe', 'browser'], web: ['globe'], email: ['mail', 'at'], contact: ['mail', 'phone']
};

function libraryIconByName(lib, name) {
  if (!lib || !name) return null;
  const n = String(name).toLowerCase().replace(/^lib:/, '').trim();
  const hit = (lib.icons || []).filter(function (i) { return i.name === n || i.tag.toLowerCase() === n; })[0];
  return hit ? hit.tag : null;
}

// Best library icon for free text (item title, Gemini icon name, Material name). Returns tag or null.
function pickLibraryIcon(lib, text) {
  if (!lib || !text) return null;
  const direct = libraryIconByName(lib, text);
  if (direct) return direct;
  const words = tokenize_(String(text).replace(/[_-]/g, ' '));
  if (!words.length) return null;
  const wanted = {};
  words.forEach(function (w) {
    wanted[w] = (wanted[w] || 0) + 3;
    (ICON_SYNONYMS[w] || []).forEach(function (s) { wanted[s] = (wanted[s] || 0) + 2; });
  });
  const familyBoost = { AI_INNOVATION: 0.3, CLOUD_SECURITY: 0.25, SETTINGS_DATA: 0.2, ANALYTICS_SEARCH: 0.15 };
  let best = null;
  (lib.icons || []).forEach(function (ic) {
    const parts = ic.name.split('-');
    let score = 0;
    parts.forEach(function (p, k) { if (wanted[p]) score += wanted[p] * (k === 0 ? 1.2 : 1); });
    (ic.keywords || []).forEach(function (kw) { if (wanted[kw.toLowerCase()]) score += 0.5; });
    if (!score) return;
    if (parts.length === 1 && wanted[ic.name]) score += 2;           // the plain icon beats compound variants
    score += (familyBoost[ic.family] || 0) * 0.3 - parts.length * 0.3;
    if (!best || score > best.score) best = { tag: ic.tag, score: score };
  });
  return best && best.score >= 2 ? best.tag : null;
}

function openReferenceDeck_(ctx) {
  if (ctx.refDeck) return ctx.refDeck;
  if (!CONFIG.referenceDeckId) { ctx.iconIssue = ctx.iconIssue || 'CONFIG.referenceDeckId is empty'; return null; }
  if ((ctx.refDeckTries || 0) >= 3) return null;             // a few attempts per run, not one per icon
  ctx.refDeckTries = (ctx.refDeckTries || 0) + 1;
  try {
    ctx.refDeck = SlidesApp.openById(CONFIG.referenceDeckId);
  } catch (e) {
    ctx.iconIssue = ctx.iconIssue || ('reference deck not reachable: ' + e.message);
    Logger.log('Reference deck not reachable: ' + e.message);
  }
  return ctx.refDeck || null;
}

// Copies the icon's vector shapes from the reference deck into `slide`, recolors and sizes it. Returns true on success.
// Everything inserted is removed again if any step fails, so a failed copy never leaves invisible leftovers.
function insertLibraryIcon(slide, iconTag, left, top, size, onDark, ctx, color) {
  const rt = ctx.refRuntime;
  ctx.iconAttempts = (ctx.iconAttempts || 0) + 1;
  if (!rt || !rt.icons || !rt.iconSlideId) { ctx.iconIssue = ctx.iconIssue || 'harvest data not loaded (run Harvest reference deck again)'; return false; }
  if (!iconTag || !rt.icons[iconTag]) return false;
  const deck = openReferenceDeck_(ctx);
  if (!deck) return false;
  const inserted = [];   // PageElements on the target slide (for cleanup)
  try {
    const src = deck.getSlideById(rt.iconSlideId);
    if (!src) { ctx.iconIssue = ctx.iconIssue || 'icon slide not found in the reference deck (run Harvest reference deck again)'; return false; }
    rt.icons[iconTag].forEach(function (objectId) {
      const el = src.getPageElementById(objectId);
      if (!el) return;
      const type = el.getPageElementType();
      let copy = null;
      if (type === SlidesApp.PageElementType.GROUP) copy = slide.insertGroup(el.asGroup());
      else if (type === SlidesApp.PageElementType.SHAPE) copy = slide.insertShape(el.asShape());
      else if (type === SlidesApp.PageElementType.LINE) copy = slide.insertLine(el.asLine());
      else if (type === SlidesApp.PageElementType.IMAGE) copy = slide.insertImage(el.asImage());
      // insert* returns a Group/Shape/Line/Image object: look it up again as a generic PageElement
      if (copy) inserted.push(slide.getPageElementById(copy.getObjectId()));
    });
    if (!inserted.length) return false;
    const icon = inserted.length > 1 ? slide.group(inserted) : inserted[0];
    const iconEl = slide.getPageElementById(icon.getObjectId());
    if (inserted.length > 1) { inserted.length = 0; inserted.push(iconEl); }
    recolorElement_(iconEl, color || (onDark ? IPAY.white : IPAY.blue));
    const w = Math.max(0.01, Number(iconEl.getWidth()) || 0.01);
    const h = Math.max(0.01, Number(iconEl.getHeight()) || 0.01);
    const k = Math.max(0.01, Number(size) || 1) / Math.max(w, h);
    iconEl.setWidth(Math.max(1, w * k)).setHeight(Math.max(1, h * k));
    iconEl.setLeft(left + (size - w * k) / 2).setTop(top + (size - h * k) / 2);
    try { iconEl.setTitle('66D icon ' + iconTag); } catch (e) {}
    return true;
  } catch (e) {
    Logger.log('Library icon failed (' + iconTag + '): ' + e.message);
    ctx.iconIssue = ctx.iconIssue || ('copy failed: ' + e.message);
    inserted.forEach(function (el) { try { el.remove(); } catch (e2) {} });
    return false;
  }
}

// Recolors a generic PageElement (and, for groups, every child) to one solid color
function recolorElement_(el, hex) {
  const type = el.getPageElementType();
  if (type === SlidesApp.PageElementType.GROUP) {
    el.asGroup().getChildren().forEach(function (c) { recolorElement_(c, hex); });
  } else if (type === SlidesApp.PageElementType.SHAPE) {
    const sh = el.asShape();
    try { if (sh.getFill().getType() !== SlidesApp.FillType.NONE) sh.getFill().setSolidFill(hex); } catch (e) {}
    try { if (sh.getBorder().isVisible()) sh.getBorder().getLineFill().setSolidFill(hex); } catch (e) {}
  } else if (type === SlidesApp.PageElementType.LINE) {
    try { el.asLine().getLineFill().setSolidFill(hex); } catch (e) {}
  }
}

/* =========================
   POST-CHECK (deterministic brand validation, reported in the result message)
========================= */

function validateDeckAgainstReference(presId, refs, ctx) {
  const issues = [];
  let pres;
  try {
    pres = Slides.Presentations.get(presId, { fields: 'slides(objectId,pageElements)' });
  } catch (e) { return issues; }
  const allowedFonts = [ctx.brand.fonts.heading.slides, ctx.brand.fonts.mono.slides, 'Material Icons', 'Google Sans'];
  (pres.slides || []).forEach(function (page, i) {
    const found = { fonts: {}, small: 0 };
    flatten(page.pageElements, []).forEach(function (el) {
      forEachText(el, function (objectId, cell, te) {
        const st = te.textRun.style || {};
        const fam = (st.weightedFontFamily && st.weightedFontFamily.fontFamily) || st.fontFamily;
        if (fam && allowedFonts.indexOf(fam) === -1) found.fonts[fam] = true;
        const size = st.fontSize && st.fontSize.magnitude;
        if (size && size < 6.5) found.small++;
      });
    });
    const off = Object.keys(found.fonts);
    if (off.length) issues.push('Slide ' + (i + 1) + ': off-brand font ' + off.join(', '));
    if (found.small) issues.push('Slide ' + (i + 1) + ': ' + found.small + ' text run(s) below 7pt');
  });
  return issues;
}

/* =========================
   HARVEST (admin, one-time; resumable)
   Maps template slides and icons to their Google Slides objectIds and renders reference thumbnails.
========================= */

function harvestReferenceDeck() {
  const started = Date.now();
  const props = PropertiesService.getScriptProperties();
  const lib = loadReferenceLibrary(true);
  if (!lib) throw new Error('Reference library not found. Upload 66d_reference_library.json and set CONFIG.refLibraryFileId.');
  if (!CONFIG.referenceDeckId) throw new Error('Set CONFIG.referenceDeckId to the Google Slides copy of the 2026 template.');

  const deck = SlidesApp.openById(CONFIG.referenceDeckId);
  const slides = deck.getSlides();
  if (slides.length !== lib.slides.length) {
    throw new Error('The reference deck has ' + slides.length + ' slides but the library describes ' + lib.slides.length + '. Use an unmodified copy of the template.');
  }

  let state = null;
  try { state = JSON.parse(props.getProperty(REF.harvestStateKey) || 'null'); } catch (e) {}
  if (!state) state = { runtime: { deckId: CONFIG.referenceDeckId, slides: {}, icons: {}, thumbs: {}, iconSlideId: null }, nextThumb: 0 };
  const rt = state.runtime;

  // 1. Slide objectIds (fast)
  lib.slides.forEach(function (s, i) { rt.slides[s.tag] = slides[i].getObjectId(); });

  // 2. Icon objectIds on slide 114 (grid order)
  if (!Object.keys(rt.icons).length) {
    const iconSlide = slides[REF.iconSlideNumber - 1];
    rt.iconSlideId = iconSlide.getObjectId();
    Object.assign(rt.icons, harvestIcons_(iconSlide, lib, deck.getPageWidth()));
  }

  // 3. Thumbnails for reusable reference slides (resumable)
  const folderId = ensureThumbFolder_();
  const targets = lib.slides.filter(function (s) { return s.reusable !== false && !s.referenceOnly; });
  let done = true;
  for (let k = state.nextThumb; k < targets.length; k++) {
    if (Date.now() - started > REF.harvestBudgetMs) { state.nextThumb = k; done = false; break; }
    const s = targets[k];
    try {
      const thumb = Slides.Presentations.Pages.getThumbnail(CONFIG.referenceDeckId, rt.slides[s.tag], {
        'thumbnailProperties.thumbnailSize': 'MEDIUM', 'thumbnailProperties.mimeType': 'PNG'
      });
      const png = UrlFetchApp.fetch(thumb.contentUrl).getBlob().setName(s.tag + '.png');
      rt.thumbs[s.tag] = uploadDriveFile_(png, 'image/png', folderId, rt.thumbs[s.tag]);
    } catch (e) {
      Logger.log('Thumbnail failed for ' + s.tag + ': ' + e.message);
    }
    Utilities.sleep(700);    // respect the Slides API thumbnail quota
  }

  rt.harvestedAt = new Date().toISOString();
  rt.iconCount = Object.keys(rt.icons).length;
  if (done) {
    const json = Utilities.newBlob(JSON.stringify(rt), 'application/json', '66d_reference_runtime.json');
    const id = uploadDriveFile_(json, 'application/json', null, props.getProperty(REF.runtimePropKey));
    props.setProperty(REF.runtimePropKey, id);
    props.deleteProperty(REF.harvestStateKey);
    clearCache(REF.runtimeCacheKey);
  } else {
    props.setProperty(REF.harvestStateKey, JSON.stringify(state));
  }

  const msg = done
    ? 'Reference deck harvested: ' + Object.keys(rt.slides).length + ' slides, ' + rt.iconCount + ' icons, ' + Object.keys(rt.thumbs).length + ' thumbnails.'
    : 'Harvest paused at thumbnail ' + state.nextThumb + ' of ' + targets.length + ' (time limit). Run "Harvest reference deck" again to continue.';
  try { SlidesApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

// Buckets the icon elements of slide 114 into grid rows and assigns library tags in reading order
function harvestIcons_(slide, lib, pageW) {
  const els = slide.getPageElements().filter(function (el) {
    try {
      if (el.getWidth() > pageW * 0.2) return false;                                   // background / title
      if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
        const sh = el.asShape();
        if (typeof hasTextFrame_ === 'function' && !hasTextFrame_(sh)) return true;
        if (sh.getText().asString().trim()) return false;
      }
      return true;
    } catch (e) { return false; }
  }).map(function (el) {
    return { id: el.getObjectId(), cx: el.getLeft() + el.getWidth() / 2, cy: el.getTop() + el.getHeight() / 2, w: el.getWidth() };
  });
  if (!els.length) return {};
  const ys = els.map(function (e) { return e.cy; });
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const nRows = REF.iconRowCounts.length;
  const rows = [];
  for (let r = 0; r < nRows; r++) rows.push([]);
  els.forEach(function (e) {
    const r = Math.max(0, Math.min(nRows - 1, Math.round((e.cy - minY) / Math.max(maxY - minY, 1) * (nRows - 1))));
    rows[r].push(e);
  });
  const byRow = {};
  lib.icons.forEach(function (ic) { (byRow[ic.gridRow] = byRow[ic.gridRow] || []).push(ic); });
  const out = {};
  rows.forEach(function (row, r) {
    row.sort(function (a, b) { return a.cx - b.cx; });
    const medianW = row.length ? row.map(function (e) { return e.w; }).sort(function (a, b) { return a - b; })[Math.floor(row.length / 2)] : 0;
    // merge pieces of the same icon (split shapes)
    const merged = [];
    row.forEach(function (e) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(e.cx - last.cx) < medianW * 0.45) last.ids.push(e.id);
      else merged.push({ cx: e.cx, ids: [e.id] });
    });
    const icons = (byRow[r + 1] || []).sort(function (a, b) { return a.gridCol - b.gridCol; });
    if (merged.length !== icons.length) Logger.log('Icon row ' + (r + 1) + ': found ' + merged.length + ', expected ' + icons.length);
    icons.forEach(function (ic, k) { if (merged[k]) out[ic.tag] = merged[k].ids; });
  });
  return out;
}

function ensureThumbFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(REF.thumbFolderPropKey);
  if (existing) {
    try { DriveApp.getFolderById(existing); return existing; } catch (e) {}
  }
  // DriveApp only — never UrlFetchApp to drive.googleapis.com (runtime API enablement).
  const id = DriveApp.createFolder('66degrees Reference Thumbnails').getId();
  props.setProperty(REF.thumbFolderPropKey, id);
  return id;
}

// Creates (or replaces) a Drive file with DriveApp. No Drive REST / no runtime API enablement.
function uploadDriveFile_(blob, mime, parentId, existingId) {
  const named = blob.setName(blob.getName() || 'upload.bin');
  if (mime) {
    try { named.setContentType(mime); } catch (e) {}
  }
  if (existingId) {
    try { DriveApp.getFileById(existingId).setTrashed(true); } catch (e) {}
  }
  const folder = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
  return folder.createFile(named).getId();
}

/* =========================
   STATUS (menu)
========================= */

function referenceStatus() {
  const lib = loadReferenceLibrary(true);
  const rt = loadReferenceRuntime(true);
  const msg = 'Reference library: ' + (lib ? lib.slides.length + ' slides, ' + lib.icons.length + ' icons, ' + lib.companyFacts.length + ' facts' : 'NOT LOADED (check CONFIG.refLibraryFileId)') + '\n' +
    'Reference deck: ' + (CONFIG.referenceDeckId ? 'set' : 'NOT SET (CONFIG.referenceDeckId)') + '\n' +
    'Harvest: ' + (rt ? Object.keys(rt.slides || {}).length + ' slides, ' + Object.keys(rt.icons || {}).length + ' icons, ' + Object.keys(rt.thumbs || {}).length + ' thumbnails (' + rt.harvestedAt + ')' : 'not run yet — use "Harvest reference deck"');
  try { SlidesApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

/* =========================
   ICON CHECK (admin)
   Draws every harvested template icon with its name into a new presentation "66degrees icon check", so wrong
   matches (an icon name showing a different picture) can be spotted. Resumable: run again until it says done.
========================= */
function iconCheck() {
  const ui = SlidesApp.getUi();
  const lib = loadReferenceLibrary(false);
  const rt = loadReferenceRuntime(true);
  if (!lib || !rt || !rt.icons) { ui.alert('Icon check', 'Reference library or harvest data not found. Run Harvest reference deck first.', ui.ButtonSet.OK); return; }
  const props = PropertiesService.getScriptProperties();
  let state = {};
  try { state = JSON.parse(props.getProperty('ICON_CHECK_STATE') || '{}'); } catch (e) { state = {}; }
  let pres;
  if (state.id) { try { pres = SlidesApp.openById(state.id); } catch (e) { pres = null; } }
  if (!pres) { pres = SlidesApp.create('66degrees icon check'); state = { id: pres.getId(), next: 0 }; pres.getSlides()[0].remove(); }
  const ctx = { lib: lib, refRuntime: rt, log: [] };
  const icons = lib.icons.slice();
  const started = Date.now(), perSlide = 40, cols = 10;
  let slide = null;
  while (state.next < icons.length && Date.now() - started < 280000) {
    const i = state.next;
    if (i % perSlide === 0 || !slide) {
      slide = pres.getSlides()[Math.floor(i / perSlide)] || pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    }
    const k = i % perSlide, x = 14 + (k % cols) * 70, y = 12 + Math.floor(k / cols) * 98;
    const ic = icons[i];
    const ok = insertLibraryIcon(slide, ic.tag, x + 18, y, 30, false, ctx, IPAY.blue);
    const box = (typeof insertTextBoxSafe_ === 'function')
      ? insertTextBoxSafe_(slide, ic.name + (ok ? '' : ' (missing)'), x, y + 36, 66, 40)
      : slide.insertTextBox(ic.name + (ok ? '' : ' (missing)'), x, y + 36, 66, 40);
    if (typeof hasTextFrame_ !== 'function' || hasTextFrame_(box)) {
      box.getText().getTextStyle().setFontSize(7).setForegroundColor(ok ? '#040A1B' : '#0052FF');
      box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    }
    state.next++;
  }
  const done = state.next >= icons.length;
  if (done) props.deleteProperty('ICON_CHECK_STATE'); else props.setProperty('ICON_CHECK_STATE', JSON.stringify(state));
  ui.alert('Icon check', done
    ? 'Done: all ' + icons.length + ' icons are in the presentation "66degrees icon check" in your Drive. Each icon should match the name under it.'
    : state.next + ' of ' + icons.length + ' icons drawn. Run Icon check again to continue.', ui.ButtonSet.OK);
}
