/**
 * IconProvider — semantic icon selection with brand color adaptation.
 *
 * Capability reference: better-icons (search / get / recommend / similar),
 * implemented via Iconify HTTP API + local 66° assets. No MCP/Node runtime
 * is required inside Apps Script.
 */

var ICON_BRAND_COLORS = {
  night_blue: '#040A1B',
  white: '#FFFDF9',
  accent_blue: '#0052FF',
  shark_grey: '#B3C5D0'
};

var ICONIFY_API_BASE = 'https://api.iconify.design';
var ICON_PREFERRED_COLLECTIONS = ['lucide', 'tabler', 'heroicons', 'ph'];
var ICON_PROVIDER_CACHE_PROP = 'ICON_PROVIDER_CACHE_V1';

/* =========================
   SEMANTIC LOCAL MAP
========================= */

var LOCAL_ICON_SEMANTICS_ = {
  'cloud storage': { id: 'cloud', tags: ['cloud', 'storage'], iconId: 'lucide:cloud' },
  cloud: { id: 'cloud', tags: ['cloud'], iconId: 'lucide:cloud' },
  upload: { id: 'cloud-upload', tags: ['upload', 'cloud'], iconId: 'lucide:cloud-upload' },
  security: { id: 'shield', tags: ['security'], iconId: 'lucide:shield' },
  shield: { id: 'shield', tags: ['security'], iconId: 'lucide:shield' },
  lock: { id: 'lock', tags: ['security', 'lock'], iconId: 'lucide:lock' },
  analytics: { id: 'chart', tags: ['analytics', 'chart'], iconId: 'lucide:bar-chart-3' },
  chart: { id: 'chart', tags: ['chart'], iconId: 'lucide:bar-chart-3' },
  ai: { id: 'brain', tags: ['ai', 'brain'], iconId: 'lucide:brain' },
  brain: { id: 'brain', tags: ['ai'], iconId: 'lucide:brain' },
  automation: { id: 'gear', tags: ['automation', 'settings'], iconId: 'lucide:settings' },
  settings: { id: 'gear', tags: ['settings'], iconId: 'lucide:settings' },
  cost: { id: 'dollar', tags: ['cost', 'finance'], iconId: 'lucide:dollar-sign' },
  growth: { id: 'growth', tags: ['growth'], iconId: 'lucide:trending-up' },
  team: { id: 'team', tags: ['team', 'people'], iconId: 'lucide:users' },
  people: { id: 'team', tags: ['people'], iconId: 'lucide:users' },
  time: { id: 'clock', tags: ['time'], iconId: 'lucide:clock' },
  idea: { id: 'lightbulb', tags: ['idea'], iconId: 'lucide:lightbulb' },
  innovation: { id: 'lightbulb', tags: ['innovation'], iconId: 'lucide:lightbulb' }
};

/* =========================
   SVG SAFETY / COLOR
========================= */

function sanitizeIconSvg_(svg) {
  var s = String(svg || '');
  if (!s) return '';
  // Strip executable / remote content.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  s = s.replace(/xlink:href\s*=\s*("|')\s*https?:/gi, 'xlink:href=$1');
  s = s.replace(/href\s*=\s*("|')\s*https?:[^"']*("|')/gi, '');
  if (!/<svg[\s>]/i.test(s) || !/<\/svg>/i.test(s) || !/viewBox=/i.test(s)) return '';
  return s;
}

function normalizeBrandIconColor_(color, onDark) {
  const c = String(color || '').toUpperCase();
  if (c === '#040A1B' || c === '#FFFDF9' || c === '#0052FF' || c === '#B3C5D0') return c;
  if (onDark) return ICON_BRAND_COLORS.white;
  if (/accent|highlight|pointer|active/i.test(String(color || ''))) return ICON_BRAND_COLORS.accent_blue;
  return ICON_BRAND_COLORS.night_blue;
}

function recolorIconSvg_(svg, hex) {
  var s = String(svg || '');
  const color = normalizeBrandIconColor_(hex, false);
  // Replace common stroke/fill color literals while preserving none/currentColor structure when needed.
  s = s.replace(/stroke="[^"]*"/gi, 'stroke="' + color + '"');
  s = s.replace(/fill="(?!none)[^"]*"/gi, 'fill="' + color + '"');
  if (/stroke=/i.test(s) && !/fill=/i.test(s)) {
    // keep fill none for monoline icons
    s = s.replace(/<svg\b/i, '<svg fill="none"');
  }
  if (!/stroke=/i.test(s) && /fill=/i.test(s)) {
    // solid-ish icons: ensure fill is brand color
    s = s.replace(/fill="none"/gi, 'fill="' + color + '"');
  }
  return sanitizeIconSvg_(s);
}

function isSafeIconResult_(result) {
  return !!(result && result.svg && sanitizeIconSvg_(result.svg));
}

/* =========================
   CACHE
========================= */

function iconCacheKey_(provider, iconId, color, size) {
  return [provider || 'x', iconId || '', String(color || '').toUpperCase(), String(size || 24)].join(':');
}

function readIconProviderCache_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(ICON_PROVIDER_CACHE_PROP);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeIconProviderCache_(cache) {
  try {
    // Keep the cache bounded.
    const keys = Object.keys(cache || {});
    if (keys.length > 80) {
      keys.slice(0, keys.length - 80).forEach(function (k) { delete cache[k]; });
    }
    PropertiesService.getScriptProperties().setProperty(ICON_PROVIDER_CACHE_PROP, JSON.stringify(cache));
  } catch (e) {}
}

function getCachedIcon_(provider, iconId, color, size) {
  const cache = readIconProviderCache_();
  const hit = cache[iconCacheKey_(provider, iconId, color, size)];
  if (!hit || !hit.svg) return null;
  const svg = sanitizeIconSvg_(hit.svg);
  if (!svg) return null;
  return {
    iconId: hit.iconId || iconId,
    source: hit.source || provider,
    collection: hit.collection || '',
    license: hit.license || '',
    svg: svg,
    color: hit.color || color,
    attribution: hit.attribution || null
  };
}

function putCachedIcon_(result, size) {
  if (!isSafeIconResult_(result)) return;
  const cache = readIconProviderCache_();
  cache[iconCacheKey_(result.source, result.iconId, result.color, size || 24)] = {
    iconId: result.iconId,
    source: result.source,
    collection: result.collection || '',
    license: result.license || '',
    svg: result.svg,
    color: result.color,
    attribution: result.attribution || null
  };
  writeIconProviderCache_(cache);
}

/* =========================
   LOCAL / MANIFEST PROVIDER
========================= */

function matchLocalIconConcept_(concept) {
  const key = String(concept || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!key) return null;
  if (LOCAL_ICON_SEMANTICS_[key]) return LOCAL_ICON_SEMANTICS_[key];
  const tokens = key.split(' ');
  let best = null;
  Object.keys(LOCAL_ICON_SEMANTICS_).forEach(function (k) {
    const entry = LOCAL_ICON_SEMANTICS_[k];
    const hay = [k].concat(entry.tags || []).join(' ');
    let score = 0;
    tokens.forEach(function (t) { if (hay.indexOf(t) !== -1) score += 1; });
    if (score && (!best || score > best.score)) best = { score: score, entry: entry };
  });
  return best && best.score > 0 ? best.entry : null;
}

function bundledIconSvgFor_(localId, color) {
  // Lightweight monoline geometry for offline use; mirrors assets/icons style.
  const paths = {
    cloud: 'M7.2 17H6A3.8 3.8 0 0 1 6 9.4 5.1 5.1 0 0 1 15.8 8.4 3.7 3.7 0 0 1 18.2 17H7.2Z',
    'cloud-upload': 'M12 16V8M9 11l3-3 3 3M7.2 19H6A3.8 3.8 0 0 1 6 11.4 5.1 5.1 0 0 1 15.8 10.4 3.7 3.7 0 0 1 18.2 19H7.2Z',
    shield: 'M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z',
    lock: 'M8 11V8a4 4 0 0 1 8 0v3M7 11h10v9H7V11Z',
    chart: 'M5 19V9M10 19V5M15 19v-7M20 19V8',
    brain: 'M9 7a3 3 0 0 1 6 0v1a3 3 0 0 1 2 2.5V14a3 3 0 0 1-2 2.8V19H9v-2.2A3 3 0 0 1 7 14v-3.5A3 3 0 0 1 9 8V7Z',
    gear: 'M12 8.5A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5ZM12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5',
    dollar: 'M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3',
    growth: 'M4 18h16M6 14l4-4 3 3 5-7',
    team: 'M9 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM4.5 19a4.5 4.5 0 0 1 9 0M10.5 19a4.5 4.5 0 0 1 9 0',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
    lightbulb: 'M9 18h6M10 21h4M8 10a4 4 0 1 1 8 0c0 1.7-.9 2.7-1.8 3.5-.7.6-1.2 1.2-1.2 2.5h-2c0-1.3-.5-1.9-1.2-2.5C8.9 12.7 8 11.7 8 10Z'
  };
  const d = paths[localId];
  if (!d) return '';
  const hex = normalizeBrandIconColor_(color, false);
  return sanitizeIconSvg_(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + hex +
      '" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="' + d + '"/></svg>'
  );
}

function resolveLocalIcon_(request) {
  const concept = request.concept || request.name || '';
  const local = matchLocalIconConcept_(concept);
  if (!local) return null;
  const color = normalizeBrandIconColor_(request.brandColor || request.color, !!request.onDark);
  const svg = bundledIconSvgFor_(local.id, color);
  if (!svg) return null;
  return {
    iconId: local.iconId || ('local:' + local.id),
    source: '66degrees-local',
    collection: '66degrees',
    license: 'proprietary-66degrees',
    svg: svg,
    color: color,
    localId: local.id,
    attribution: { provider: '66degrees', collection: 'bundled', iconId: local.iconId }
  };
}

/* =========================
   BETTER-ICONS / ICONIFY ADAPTER
========================= */

function iconifySearch_(query, limit) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) return [];
  const prefixes = ICON_PREFERRED_COLLECTIONS.join(',');
  const url = ICONIFY_API_BASE + '/search?query=' + q + '&limit=' + Math.max(1, Math.min(32, limit || 12)) + '&prefixes=' + encodeURIComponent(prefixes);
  const resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return [];
  let data = {};
  try { data = JSON.parse(resp.getContentText()); } catch (e) { return []; }
  return Array.isArray(data.icons) ? data.icons.slice(0, limit || 12) : [];
}

function iconifyGetSvg_(iconId, color, size) {
  const parts = String(iconId || '').split(':');
  if (parts.length !== 2) return '';
  const prefix = encodeURIComponent(parts[0]);
  const name = encodeURIComponent(parts[1]);
  const hex = normalizeBrandIconColor_(color, false).replace('#', '%23');
  const px = Math.max(16, Math.min(128, Number(size) || 24));
  const url = ICONIFY_API_BASE + '/' + prefix + '/' + name + '.svg?color=' + hex + '&width=' + px + '&height=' + px;
  const resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return '';
  return sanitizeIconSvg_(resp.getContentText());
}

function rankIconCandidates_(icons, style) {
  const preferred = style === 'solid' ? ['mdi', 'fa6-solid'] : ICON_PREFERRED_COLLECTIONS.slice();
  return (icons || []).slice().sort(function (a, b) {
    const pa = preferred.indexOf(String(a).split(':')[0]);
    const pb = preferred.indexOf(String(b).split(':')[0]);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return 0;
  });
}

function resolveBetterIcons_(request) {
  const concept = String(request.concept || request.name || '').trim();
  if (!concept) return null;
  const color = normalizeBrandIconColor_(request.brandColor || request.color, !!request.onDark);
  const size = Math.max(16, Math.min(128, Number(request.size) || 24));
  try {
    const found = rankIconCandidates_(iconifySearch_(concept, 12), request.style || 'outline');
    for (let i = 0; i < found.length; i++) {
      const iconId = found[i];
      const cached = getCachedIcon_('better-icons', iconId, color, size);
      if (cached) return cached;
      const svg = iconifyGetSvg_(iconId, color, size);
      if (!svg) continue;
      const result = {
        iconId: iconId,
        source: 'better-icons',
        collection: String(iconId).split(':')[0],
        license: 'collection-dependent',
        svg: recolorIconSvg_(svg, color) || svg,
        color: color,
        attribution: {
          provider: 'better-icons/iconify',
          collection: String(iconId).split(':')[0],
          iconId: iconId,
          api: ICONIFY_API_BASE
        }
      };
      putCachedIcon_(result, size);
      return result;
    }
  } catch (e) {
    Logger.log('better-icons adapter failed: ' + e.message);
  }
  return null;
}

/* =========================
   PUBLIC API
========================= */

function resolveIconRequest_(request, ctx) {
  request = request || {};
  const color = normalizeBrandIconColor_(request.brandColor || request.color, !!request.onDark || !!request.dark);
  const size = Math.max(16, Math.min(128, Number(request.size) || 24));
  const concept = String(request.concept || request.name || '').trim();
  if (!concept) {
    return { ok: false, error: 'missing concept', fallback: true };
  }

  // 1) Cache hit by concept-mapped local/better id if known
  const localMap = matchLocalIconConcept_(concept);
  if (localMap && localMap.iconId) {
    const cachedLocal = getCachedIcon_('better-icons', localMap.iconId, color, size) ||
      getCachedIcon_('66degrees-local', localMap.iconId, color, size);
    if (cachedLocal) return Object.assign({ ok: true }, cachedLocal);
  }

  // 2) Local 66° curated icons
  const local = resolveLocalIcon_({ concept: concept, brandColor: color, onDark: request.onDark || request.dark, size: size });
  if (local) {
    putCachedIcon_(local, size);
    return Object.assign({ ok: true }, local);
  }

  // 3) Existing Drive / library path metadata hint (actual insertion still handled by renderer)
  if (ctx && ctx.assets && typeof findBrandIcon === 'function') {
    const match = findBrandIcon(concept, ctx.assets.icons, {});
    if (match) {
      return {
        ok: true,
        iconId: 'drive:' + match.key,
        source: 'drive',
        collection: 'brand-folder',
        license: 'proprietary-66degrees',
        svg: '',
        color: color,
        driveMatch: match,
        attribution: { provider: 'drive', iconId: match.key }
      };
    }
  }

  // 4) better-icons / Iconify retrieval
  const remote = resolveBetterIcons_({ concept: concept, brandColor: color, size: size, style: request.style || 'outline' });
  if (remote) return Object.assign({ ok: true }, remote);

  // 5) Generic safe fallback (no fabricated remote IDs)
  const fallbackSvg = bundledIconSvgFor_('gear', color) || bundledIconSvgFor_('cloud', color);
  return {
    ok: false,
    fallback: true,
    iconId: 'local:fallback',
    source: 'fallback',
    collection: '66degrees',
    license: 'proprietary-66degrees',
    svg: fallbackSvg,
    color: color,
    error: 'icon not found for concept: ' + concept,
    attribution: { provider: 'fallback', iconId: 'local:fallback' }
  };
}

function insertResolvedIcon_(slide, result, left, top, size, ctx) {
  if (!result) return false;
  size = Math.max(8, Number(size) || 16);
  try {
    if (result.driveMatch && typeof getBlobCached === 'function') {
      const entry = result.driveMatch.entry || {};
      const id = result.color === ICON_BRAND_COLORS.white ? (entry.white || entry.blue) : (entry.blue || entry.white);
      if (id) {
        slide.insertImage(getBlobCached(id, ctx || {}), left, top, size, size);
        return true;
      }
    }
    if (result.svg) {
      const svg = sanitizeIconSvg_(result.svg);
      if (!svg) return false;
      const blob = Utilities.newBlob(svg, 'image/svg+xml', String(result.iconId || 'icon').replace(/[^\w.-]+/g, '_') + '.svg');
      slide.insertImage(blob, left, top, size, size);
      return true;
    }
  } catch (e) {
    Logger.log('insertResolvedIcon_ failed: ' + e.message);
  }
  return false;
}

function resolveIconsForPlan_(plan, ctx) {
  if (!plan || !Array.isArray(plan.slides)) return 0;
  let count = 0;
  if (ctx) progressStage_(ctx, 'icons', 'active', 'Selecting icons');
  plan.slides.forEach(function (slide) {
    const reqs = [];
    if (slide.visual && Array.isArray(slide.visual.iconRequests)) {
      slide.visual.iconRequests.forEach(function (r) { reqs.push(r); });
    }
    if (slide.diagram && Array.isArray(slide.diagram.iconRequests)) {
      slide.diagram.iconRequests.forEach(function (r) { reqs.push(r); });
    }
    if (!reqs.length && slide.diagram && Array.isArray(slide.diagram.nodes)) {
      slide.diagram.nodes.slice(0, 6).forEach(function (n) {
        if (n.iconConcept || n.label) reqs.push({ concept: n.iconConcept || n.label, nodeId: n.id, style: 'outline' });
      });
    }
    slide.resolvedIcons = slide.resolvedIcons || {};
    reqs.slice(0, 12).forEach(function (req) {
      const resolved = resolveIconRequest_({
        concept: req.concept,
        style: req.style || 'outline',
        brandColor: req.brandColor || ICON_BRAND_COLORS.accent_blue,
        size: req.size || 24,
        onDark: !!req.onDark
      }, ctx);
      const key = req.nodeId || req.concept;
      slide.resolvedIcons[key] = resolved;
      count += 1;
    });
  });
  if (ctx) progressStage_(ctx, 'icons', 'done', count ? count + ' icons resolved' : 'No icon requests');
  return count;
}

var IconProvider = {
  colors: ICON_BRAND_COLORS,
  resolve: resolveIconRequest_,
  insert: insertResolvedIcon_,
  sanitizeSvg: sanitizeIconSvg_,
  normalizeColor: normalizeBrandIconColor_,
  recolorSvg: recolorIconSvg_,
  resolveForPlan: resolveIconsForPlan_,
  searchBetterIcons: iconifySearch_,
  getBetterIconSvg: iconifyGetSvg_,
  matchLocal: matchLocalIconConcept_
};
