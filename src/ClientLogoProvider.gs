/**
 * Optional client/company logo retrieval.
 *
 * Independent of diagram classification and Flowchart mode. Complements ProposalKit
 * (Drive assets, logo.dev) with a guarded provider chain. Never replaces 66degrees branding.
 *
 * Provider status (verified 2026-03):
 *  - Lookup is ON by default for Proposal Decks (V.1_38); CLIENT_LOGO_LOOKUP=false switches it off.
 *  - Brandfetch Brand API: used when a Bearer API key is set (script property BRANDFETCH_API_KEY).
 *  - Unavatar (unavatar.io): no key needed (anonymous ~25 req/day/IP; UNAVATAR_API_KEY raises it). ON by default
 *    (CLIENT_LOGO_UNAVATAR=false switches it off). Brandfetch is tried first when a key is available.
 *  - Clearbit logo.clearbit.com: sunset December 2025 — permanently disabled.
 *
 * Fallback order: uploaded → Drive/project asset → Brandfetch (with key) → Unavatar →
 * text wordmark → none. Failures are nonfatal.
 */

var CLIENT_LOGO_PROVIDERS_ = {
  brandfetch: {
    id: 'brandfetch',
    host: 'api.brandfetch.io',
    enabledByDefault: false,
    needsKey: true,
    keyProperty: 'BRANDFETCH_API_KEY'
  },
  unavatar: {
    id: 'unavatar',
    host: 'unavatar.io',
    enabledByDefault: false,
    needsKey: false,
    keyProperty: 'UNAVATAR_API_KEY'
  },
  clearbit: {
    id: 'clearbit',
    host: 'logo.clearbit.com',
    enabledByDefault: false,
    permanentlyDisabled: true,
    reason: 'Clearbit Logo API sunset December 2025 (HubSpot changelog).'
  }
};

var CLIENT_LOGO_ALLOW_HOSTS_ = {
  'api.brandfetch.io': true,
  'cdn.brandfetch.io': true,
  'asset.brandfetch.io': true,
  'unavatar.io': true
};

var CLIENT_LOGO_MAX_BYTES_ = 800 * 1024;
var CLIENT_LOGO_TIMEOUT_MS_ = 8000;
var CLIENT_LOGO_CACHE_SEC_ = 6 * 60 * 60;       // 6h positive cache
var CLIENT_LOGO_NEG_CACHE_SEC_ = 30 * 60;       // 30m negative cache
var CLIENT_LOGO_RUN_LIMIT_ = 3;

var CLIENT_LOGO_RUN_COUNT_ = 0;

function clientLogoLookupEnabled_() {
  try {
    const v = PropertiesService.getScriptProperties().getProperty('CLIENT_LOGO_LOOKUP');
    if (v == null || v === '') return true;                     // V.1_38: on unless switched off
    return String(v).toLowerCase() === 'true' || String(v) === '1';
  } catch (e) {
    return true;
  }
}

function clientLogoProviderOptIn_(id) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (id === 'unavatar') {
      const v = props.getProperty('CLIENT_LOGO_UNAVATAR');
      if (v == null || v === '') return true;                   // V.1_38: on unless switched off
      return String(v).toLowerCase() === 'true' || String(v) === '1';
    }
    if (id === 'brandfetch') return true; // gated by CLIENT_LOGO_LOOKUP + key
  } catch (e) {}
  return false;
}

/**
 * Strict domain validation. Rejects schemes, paths, credentials, ports, IPs,
 * localhost, and private/internal hosts.
 */
function normalizeClientDomain_(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return { ok: false, reason: 'empty' };
  if (/\s/.test(s)) return { ok: false, reason: 'whitespace' };
  // Bare hostname only — reject schemes, paths, query, credentials, ports.
  if (/^(https?:|\/\/)/i.test(s)) return { ok: false, reason: 'scheme' };
  if (s.indexOf('/') !== -1) return { ok: false, reason: 'path' };
  if (s.indexOf('?') !== -1 || s.indexOf('#') !== -1) return { ok: false, reason: 'path' };
  if (s.indexOf('@') !== -1) return { ok: false, reason: 'credentials' };
  if (s.indexOf(':') !== -1) return { ok: false, reason: 'port' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return { ok: false, reason: 'ip-literal' };
  if (/^\[|:/.test(s) || s.indexOf(':') !== -1 && /^[0-9a-f:]+$/i.test(s)) return { ok: false, reason: 'ip-literal' };
  if (s === 'localhost' || /\.local$/.test(s) || /\.internal$/.test(s) || /\.localhost$/.test(s)) {
    return { ok: false, reason: 'localhost' };
  }
  if (/^(10\.|192\.168\.|127\.|0\.|169\.254\.)/.test(s)) return { ok: false, reason: 'private-host' };
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(s)) return { ok: false, reason: 'private-host' };
  s = s.replace(/^www\./, '');
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)) {
    return { ok: false, reason: 'malformed' };
  }
  if (s.length > 253) return { ok: false, reason: 'too-long' };
  return { ok: true, domain: s };
}

function clientLogoHostAllowed_(url) {
  try {
    const m = String(url || '').match(/^https:\/\/([^\/:?#]+)/i);
    if (!m) return false;
    const host = m[1].toLowerCase();
    return !!CLIENT_LOGO_ALLOW_HOSTS_[host];
  } catch (e) {
    return false;
  }
}

function clientLogoCacheGet_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const v = cache.get('clogo:' + key);
    if (v == null) return null;
    if (v === '__none__') return { miss: true };
    return { data: v };
  } catch (e) {
    return null;
  }
}

function clientLogoCachePut_(key, base64OrNull) {
  try {
    const cache = CacheService.getScriptCache();
    if (base64OrNull == null) cache.put('clogo:' + key, '__none__', CLIENT_LOGO_NEG_CACHE_SEC_);
    else cache.put('clogo:' + key, String(base64OrNull).slice(0, 90000), CLIENT_LOGO_CACHE_SEC_);
  } catch (e) {}
}

function clientLogoFetchImage_(url, label) {
  if (!/^https:\/\//i.test(String(url || ''))) {
    return { ok: false, reason: 'https-only' };
  }
  if (!clientLogoHostAllowed_(url)) {
    return { ok: false, reason: 'host-not-allowlisted' };
  }
  try {
    // followRedirects:false — validate any redirect target against the allowlist.
    const r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: false,
      validateHttpsCertificates: true,
      headers: { 'User-Agent': '66DeckAgent-ClientLogo/1.0' }
    });
    const code = r.getResponseCode();
    if (code >= 300 && code < 400) {
      const loc = r.getHeaders()['Location'] || r.getHeaders()['location'] || '';
      if (!loc || !clientLogoHostAllowed_(loc) || !/^https:\/\//i.test(loc)) {
        return { ok: false, reason: 'redirect-blocked' };
      }
      // Single hop only
      const r2 = UrlFetchApp.fetch(loc, {
        muteHttpExceptions: true,
        followRedirects: false,
        validateHttpsCertificates: true,
        headers: { 'User-Agent': '66DeckAgent-ClientLogo/1.0' }
      });
      return clientLogoValidateResponse_(r2, label);
    }
    return clientLogoValidateResponse_(r, label);
  } catch (e) {
    return { ok: false, reason: (e && e.message) ? e.message : 'fetch-failed' };
  }
}

function clientLogoValidateResponse_(r, label) {
  const code = r.getResponseCode();
  if (code !== 200) return { ok: false, reason: 'HTTP ' + code };
  const blob = r.getBlob();
  const type = String(blob.getContentType() || '').toLowerCase();
  if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(type)) {
    return { ok: false, reason: 'bad-mime:' + type };
  }
  // Reject SVG / HTML disguised as images
  if (/svg|html|xml|javascript/i.test(type)) return { ok: false, reason: 'active-content' };
  const bytes = blob.getBytes();
  if (!bytes || bytes.length < 64) return { ok: false, reason: 'too-small' };
  if (bytes.length > CLIENT_LOGO_MAX_BYTES_) return { ok: false, reason: 'too-large' };
  // Magic-byte sniff (PNG / JPEG / GIF / WEBP)
  const b0 = bytes[0] & 0xff, b1 = bytes[1] & 0xff, b2 = bytes[2] & 0xff, b3 = bytes[3] & 0xff;
  const isPng = b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47;
  const isJpg = b0 === 0xff && b1 === 0xd8;
  const isGif = b0 === 0x47 && b1 === 0x49 && b2 === 0x46;
  const isWebp = b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46;
  if (!(isPng || isJpg || isGif || isWebp)) return { ok: false, reason: 'bad-magic' };
  return { ok: true, blob: blob.setName((label || 'logo') + '.png'), mime: type, bytes: bytes.length };
}

function brandfetchClientLogo_(domain) {
  let key = '';
  try { key = PropertiesService.getScriptProperties().getProperty('BRANDFETCH_API_KEY') || ''; } catch (e) {}
  if (!key) return { ok: false, reason: 'no-key' };
  const metaUrl = 'https://api.brandfetch.io/v2/brands/' + encodeURIComponent(domain);
  try {
    const r = UrlFetchApp.fetch(metaUrl, {
      muteHttpExceptions: true,
      followRedirects: false,
      headers: { Authorization: 'Bearer ' + key, 'User-Agent': '66DeckAgent-ClientLogo/1.0' }
    });
    if (r.getResponseCode() !== 200) return { ok: false, reason: 'HTTP ' + r.getResponseCode() };
    const body = JSON.parse(r.getContentText());
    const logos = (body.logos || []).filter(function (l) { return l.type === 'logo' && l.theme !== 'dark'; })
      .concat(body.logos || []);
    for (let i = 0; i < logos.length; i++) {
      const fmts = logos[i].formats || [];
      for (let j = 0; j < fmts.length; j++) {
        const f = fmts[j];
        if (!f || !f.src || String(f.format || '').toLowerCase() !== 'png') continue;
        if (!clientLogoHostAllowed_(f.src)) continue;
        const got = clientLogoFetchImage_(f.src, 'brandfetch');
        if (got.ok) return got;
      }
    }
    return { ok: false, reason: 'no-png' };
  } catch (e) {
    return { ok: false, reason: (e && e.message) ? e.message : 'brandfetch-error' };
  }
}

function unavatarClientLogo_(domain) {
  if (!clientLogoProviderOptIn_('unavatar')) return { ok: false, reason: 'disabled' };
  let url = 'https://unavatar.io/' + encodeURIComponent(domain) + '?fallback=false';
  try {
    const key = PropertiesService.getScriptProperties().getProperty('UNAVATAR_API_KEY');
    const headers = { 'User-Agent': '66DeckAgent-ClientLogo/1.0' };
    if (key) headers['x-api-key'] = key;
    const r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: false,
      headers: headers
    });
    // Unavatar may 302 to a provider CDN — only accept if still allowlisted (usually not).
    // Prefer the direct response body when 200.
    if (r.getResponseCode() === 200) return clientLogoValidateResponse_(r, 'unavatar');
    if (r.getResponseCode() >= 300 && r.getResponseCode() < 400) {
      const loc = r.getHeaders()['Location'] || r.getHeaders()['location'] || '';
      if (clientLogoHostAllowed_(loc)) return clientLogoFetchImage_(loc, 'unavatar');
      return { ok: false, reason: 'redirect-blocked' };
    }
    return { ok: false, reason: 'HTTP ' + r.getResponseCode() };
  } catch (e) {
    return { ok: false, reason: (e && e.message) ? e.message : 'unavatar-error' };
  }
}

function clearbitClientLogo_() {
  return { ok: false, reason: CLIENT_LOGO_PROVIDERS_.clearbit.reason };
}

/** Professional text wordmark — not a fabricated brand mark. */
function clientLogoWordmark_(companyName) {
  const name = String(companyName || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return null;
  return {
    kind: 'wordmark',
    text: name,
    source: 'text-wordmark',
    // Callers render as text; no image blob.
    blob: null
  };
}

/**
 * Resolve an optional client logo.
 * opts: { domain, companyName, uploadedBlob, driveLookupFn, enabled }
 * Returns { kind, blob?, text?, source, domain? } or null.
 */
function resolveClientLogo_(opts) {
  opts = opts || {};
  const trail = [];
  // 1. Explicit upload
  if (opts.uploadedBlob) {
    return { kind: 'image', blob: opts.uploadedBlob, source: 'user-upload', domain: opts.domain || '' };
  }
  // 2. Drive / project asset (caller-supplied lookup — never invent)
  if (typeof opts.driveLookupFn === 'function') {
    try {
      const drive = opts.driveLookupFn(opts.companyName || '', opts.domain || '');
      if (drive && (drive.blob || drive.id)) {
        return { kind: 'image', blob: drive.blob || null, id: drive.id || '', source: drive.source || 'project-asset', domain: opts.domain || '' };
      }
      trail.push('project-asset: none');
    } catch (e) {
      trail.push('project-asset: ' + e.message);
    }
  }

  const enabled = opts.enabled != null ? !!opts.enabled : clientLogoLookupEnabled_();
  if (!enabled) {
    const wm = clientLogoWordmark_(opts.companyName);
    if (wm) { wm.trail = trail.concat(['lookup-disabled']); return wm; }
    return null;
  }

  const norm = normalizeClientDomain_(opts.domain || '');
  if (!norm.ok) {
    trail.push('domain: ' + norm.reason);
    const wm = clientLogoWordmark_(opts.companyName);
    if (wm) { wm.trail = trail; return wm; }
    return null;
  }
  const domain = norm.domain;

  if (CLIENT_LOGO_RUN_COUNT_ >= CLIENT_LOGO_RUN_LIMIT_) {
    trail.push('run-limit');
    const wm = clientLogoWordmark_(opts.companyName);
    if (wm) { wm.trail = trail; return wm; }
    return null;
  }

  const cacheKey = 'bf:' + domain;
  const cached = clientLogoCacheGet_(cacheKey);
  if (cached && cached.miss) {
    trail.push('cache-negative');
  } else if (cached && cached.data) {
    try {
      const bytes = Utilities.base64Decode(cached.data);
      const blob = Utilities.newBlob(bytes, 'image/png', domain + '-logo.png');
      return { kind: 'image', blob: blob, source: 'cache', domain: domain };
    } catch (e) {}
  }

  // 3. Brandfetch (when key present)
  CLIENT_LOGO_RUN_COUNT_ += 1;
  let key = '';
  try { key = PropertiesService.getScriptProperties().getProperty('BRANDFETCH_API_KEY') || ''; } catch (e) {}
  if (key) {
    const bf = brandfetchClientLogo_(domain);
    if (bf.ok) {
      try { clientLogoCachePut_(cacheKey, Utilities.base64Encode(bf.blob.getBytes())); } catch (e) {}
      return { kind: 'image', blob: bf.blob, source: 'brandfetch', domain: domain };
    }
    trail.push('brandfetch: ' + bf.reason);
  } else {
    trail.push('brandfetch: no-key');
  }

  // 4. Unavatar (opt-in only)
  if (clientLogoProviderOptIn_('unavatar')) {
    CLIENT_LOGO_RUN_COUNT_ += 1;
    const ua = unavatarClientLogo_(domain);
    if (ua.ok) {
      try { clientLogoCachePut_(cacheKey, Utilities.base64Encode(ua.blob.getBytes())); } catch (e) {}
      return { kind: 'image', blob: ua.blob, source: 'unavatar', domain: domain };
    }
    trail.push('unavatar: ' + ua.reason);
  } else {
    trail.push('unavatar: disabled');
  }

  // 5. Clearbit — permanently disabled
  trail.push('clearbit: ' + CLIENT_LOGO_PROVIDERS_.clearbit.reason);

  clientLogoCachePut_(cacheKey, null);

  // 6. Text wordmark
  const wm = clientLogoWordmark_(opts.companyName);
  if (wm) { wm.trail = trail; wm.domain = domain; return wm; }

  // 7. None
  return { kind: 'none', source: 'none', trail: trail, domain: domain };
}

function resetClientLogoRunLimit_() {
  CLIENT_LOGO_RUN_COUNT_ = 0;
}

var ClientLogoProvider = {
  normalizeDomain: normalizeClientDomain_,
  lookupEnabled: clientLogoLookupEnabled_,
  resolve: resolveClientLogo_,
  providers: CLIENT_LOGO_PROVIDERS_,
  hostAllowed: clientLogoHostAllowed_,
  wordmark: clientLogoWordmark_,
  resetRunLimit: resetClientLogoRunLimit_,
  clearbitLogo: clearbitClientLogo_
};
