/**
 * 66° Deck Agent — Proposal Deck kit (V.1_37, batch 1)
 *
 * A Proposal Deck is built ONLY from proposal designs:
 *  - strict proposal cover: client logo top-left (66degrees wordmark when no client is named), dotted block top-right,
 *    title + subtitle, blue date band with the 66° tile (the same frame as every 66degrees proposal)
 *  - from the agenda to the slide before Thank you: 66° bottom-left and the client logo bottom-right
 *  - section dividers: one style per deck, dark blue streaks (default) or light with the big 66° watermark
 *  - Thank you: the strict template, no client logo
 *  - no General template design is ever used in a Proposal Deck (and no proposal design in a General deck); content
 *    without a proposal design yet is drawn with the plain base layout
 *
 * The client is found by Gemini from the request (Option A: automatic; unclear or none = no client logo). The logo
 * comes from Drive first, then the company's official logo (Wikidata / Wikimedia Commons, no key needed), then the
 * company website icon; a found logo is saved in Drive ("66° Deck Agent – client logos") for the next deck.
 * An optional Brandfetch key (script property BRANDFETCH_API_KEY) is used first when it is set.
 */

var PROPOSAL_TYPE_ = 'Proposal Deck';
var CLIENT_LOGO_FOLDER_ = '66° Deck Agent – client logos';

function isProposalDeck_(ctx) { return !!ctx && ctx.presentationType === PROPOSAL_TYPE_; }

/* ---------- 1. Who is the client? (Gemini, Option A) ---------- */
function detectClient_(userPrompt, sources, ctx) {
  const text = [String(userPrompt || ''), String((sources && sources.text) || '').slice(0, 3000)].join('\n');
  if (!text.trim()) return null;
  let raw = null;
  try {
    raw = callGeminiJSON([{ text: [
      'A 66degrees ' + (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx) ? 'solution deck' : 'proposal deck') + ' is being written for this request. Who is the CLIENT the ' + (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx) ? 'deck is presented to (none for a general solution or offering overview)' : 'proposal is addressed to') + '?',
      'Rules:',
      '- The client is the organization that will receive and buy the proposal.',
      '- Never 66degrees, Google, Google Cloud, or a technology the client uses or moves from (Microsoft, AWS, Salesforce...),',
      '  and never a company mentioned only as an example, case study, competitor or partner.',
      '- If no client is named, or two or more could be the client, answer client "" and confident false.',
      '- "domain": the client\'s official website domain (e.g. apple.com), "" if unsure.',
      'REQUEST AND SOURCE:', text.slice(0, 5000),
      'Return ONLY JSON: {"client":"","domain":"","confident":true}'
    ].join('\n') }], ctx.apiKey, 0.1);
  } catch (e) {
    ctx.log.push('Client check (Gemini) failed: ' + e.message);
    const fp = clientFromPrompt_(userPrompt);
    return fp ? { name: fp, domain: '' } : null;
  }
  let name = String((raw && raw.client) || '').replace(/\s+/g, ' ').trim();
  const fromPrompt = clientFromPrompt_(userPrompt);
  if (/^(66 ?degrees|google( cloud)?)$/i.test(name)) name = '';
  // Gemini unsure or failed, but the request names the client plainly ("a proposal for Apple to ..."): that name is used
  if ((!name || raw.confident === false) && fromPrompt) { ctx.log.push('Client taken from the request: ' + fromPrompt + '.'); return { name: fromPrompt, domain: '' }; }
  if (!name || raw.confident === false) { if (name) ctx.log.push('Client check: "' + name + '" was not certain enough.'); return null; }
  const domain = String(raw.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return { name: name.slice(0, 60), domain: /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : '' };
}

// "proposal for Apple to ...", "deck for The Home Depot on ...": the capitalised name right after for/to
var NOT_CLIENT_ = /^(google|google cloud|66 ?degrees|gemini|vertex|ai|aws|azure|microsoft|the|a|an|our|your|their|my|enterprise|retail|customer|customers)$/i;
function clientFromPrompt_(prompt) {
  const p = String(prompt || '');
  const m = p.match(/\b(?:proposal|deck|presentation|pitch|sow|rfp response|engagement)\s+(?:for|to)\s+((?:The\s+)?[A-Z0-9][\w&.'’-]*(?:\s+(?:&\s+)?[A-Z0-9][\w&.'’-]*){0,3})/);
  if (!m) return '';
  const name = m[1].replace(/[’']s$/, '').replace(/[.,]$/, '').trim();
  return NOT_CLIENT_.test(name) ? '' : name;
}

/* ---------- 2. The client's logo ---------- */
function clientLogoFolder_() {
  const it = DriveApp.getFoldersByName(CLIENT_LOGO_FOLDER_);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CLIENT_LOGO_FOLDER_);
}
function safeQuery_(s) { return String(s || '').replace(/\\/g, '').replace(/'/g, "\\'"); }

// Drive: the client-logo folder first, then any image in Drive named "<client> ... logo"
function findDriveLogo_(name) {
  try {
    const q = "title contains '" + safeQuery_(name) + "' and mimeType contains 'image/' and trashed = false";
    const folder = DriveApp.getFoldersByName(CLIENT_LOGO_FOLDER_);
    if (folder.hasNext()) {
      const f = folder.next().searchFiles(q);
      if (f.hasNext()) return { id: f.next().getId(), source: 'Drive (client logos folder)' };
    }
    const files = DriveApp.searchFiles(q + " and title contains 'logo'");
    if (files.hasNext()) return { id: files.next().getId(), source: 'Drive' };
  } catch (e) {}
  return null;
}

var LOGO_TRAIL_ = [];   // what each logo source answered (shown in the result message when no logo was found)
function fetchImage_(url, minBytes, label) {
  try {
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'Api-User-Agent': '66DeckAgent/1.0 (Google Apps Script add-on)' } });
    if (r.getResponseCode() !== 200) { LOGO_TRAIL_.push((label || 'image') + ': HTTP ' + r.getResponseCode()); return null; }
    const blob = r.getBlob();
    const type = String(blob.getContentType() || '');
    if (!/^image\/(png|jpeg|jpg|gif|webp)/i.test(type)) { LOGO_TRAIL_.push((label || 'image') + ': not an image (' + type + ')'); return null; }
    // V.1_42b: a simple logo (one-colour mark such as a swoosh) is a small file: the size check is on pixels, not bytes
    const w = imageWidth_(blob);
    // (a 32 px website icon is still kept: it is better than no client logo at all; a full logo is looked for first)
    if (blob.getBytes().length < 200 || (w && w < 32) || (!w && blob.getBytes().length < (minBytes || 1500))) { LOGO_TRAIL_.push((label || 'image') + ': too small (' + (w || '?') + ' px)'); return null; }
    if (/webp/i.test(type)) { LOGO_TRAIL_.push((label || 'image') + ': WebP not supported by Slides'); return null; }
    return blob;
  } catch (e) { LOGO_TRAIL_.push((label || 'image') + ': ' + e.message); return null; }
}
// V.1_38: pixel width of a PNG / GIF / JPEG (0 when unknown) — tiny site icons are kept only as a last resort
function imageWidth_(blob) {
  try {
    const b = blob.getBytes();
    const u = function (i) { return b[i] & 0xff; };
    if (u(0) === 0x89 && u(1) === 0x50) return (u(16) << 24 | u(17) << 16 | u(18) << 8 | u(19)) >>> 0;
    if (u(0) === 0x47 && u(1) === 0x49) return u(6) | u(7) << 8;
    if (u(0) === 0xff && u(1) === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (u(i) !== 0xff) { i++; continue; }
        const m = u(i + 1);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return u(i + 7) << 8 | u(i + 8);
        i += 2 + (u(i + 2) << 8 | u(i + 3));
      }
    }
  } catch (e) {}
  return 0;
}
var LOGO_MIN_WIDTH_ = 96;

function fetchJson_(url, label) {
  try {
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Api-User-Agent': '66DeckAgent/1.0 (Google Apps Script add-on)' } });
    if (r.getResponseCode() !== 200) { LOGO_TRAIL_.push(label + ': HTTP ' + r.getResponseCode()); return null; }
    return JSON.parse(r.getContentText());
  } catch (e) { LOGO_TRAIL_.push(label + ': ' + e.message); return null; }
}

// Wikipedia: the page's lead image is the company logo for most companies (the infobox logo)
function wikipediaLogo_(name, retried) {
  const s = fetchJson_('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(name).replace(/ /g, '_')), 'Wikipedia');
  const desc = s ? String(s.description || '') + ' ' + String(s.extract || '').slice(0, 300) : '';
  const isCompany = s && s.type !== 'disambiguation' && /compan|corporat|retailer|brand|business|bank|firm|organi[sz]ation|group|chain|manufacturer|provider|airline|university/i.test(desc);
  if (!isCompany) {
    if (s) LOGO_TRAIL_.push('Wikipedia: "' + name + '" is ' + (s.type === 'disambiguation' ? 'several pages' : 'not a company page'));
    // V.1_38: "Apple" is the fruit -> search "Apple company" and use the first page ("Apple Inc."), once
    if (retried) return null;
    const q = fetchJson_('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=' + encodeURIComponent(name + ' company'), 'Wikipedia search');
    const hit = q && q.query && q.query.search && q.query.search[0] && q.query.search[0].title;
    if (!hit || hit === name) return null;
    LOGO_TRAIL_.push('Wikipedia search: ' + hit);
    return wikipediaLogo_(hit, true);
  }
  const img = (s.originalimage && s.originalimage.source) || (s.thumbnail && s.thumbnail.source);
  if (!img || !/logo|\.svg/i.test(img)) { LOGO_TRAIL_.push('Wikipedia: page image is not a logo'); return null; }
  // SVG originals: ask for a PNG thumbnail
  const png = /\.svg$/i.test(img) && s.thumbnail ? s.thumbnail.source.replace(/\/\d+px-/, '/800px-') : img;
  return fetchImage_(png, 800, 'Wikipedia logo');
}

// Wikidata: the company's item (its official website must match the domain when we know it) -> "logo image" (P154)
function wikidataLogo_(name, domain) {
  try {
    const s = fetchJson_('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=6&search=' +
      encodeURIComponent(name), 'Wikidata search');
    const ids = ((s && s.search) || []).map(function (x) { return x.id; });
    if (!ids.length) { if (s) LOGO_TRAIL_.push('Wikidata: no match'); return null; }
    const e = fetchJson_('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|descriptions&languages=en&ids=' +
      ids.join('|'), 'Wikidata');
    if (!e) return null;
    const val = function (ent, p) {
      const c = ent.claims && ent.claims[p];
      return c && c[0] && c[0].mainsnak && c[0].mainsnak.datavalue ? c[0].mainsnak.datavalue.value : null;
    };
    const host = function (u) { return String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); };
    let pick = null;
    ids.forEach(function (id) {
      const ent = e.entities && e.entities[id];
      if (!ent || pick) return;
      const logo = val(ent, 'P154'), site = host(val(ent, 'P856'));
      if (!logo) return;
      const desc = String((ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || '');
      const siteOk = domain ? (site && (site === domain || site.slice(-domain.length - 1) === '.' + domain || domain.slice(-site.length - 1) === '.' + site)) : false;
      const orgOk = /compan|corporat|organi[sz]ation|business|firm|agency|bank|group|retailer|manufacturer|provider|university|hospital|news|airline|brand|enterprise|association|institut|government|department/i.test(desc);
      if (siteOk || (!domain && orgOk) || (domain && !site && orgOk)) pick = logo;
    });
    if (!pick) { LOGO_TRAIL_.push('Wikidata: no logo for this company'); return null; }
    // Commons renders SVG logos as PNG thumbnails (transparent background)
    return fetchImage_('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(pick) + '?width=800', 800, 'Wikimedia logo');
  } catch (e) { LOGO_TRAIL_.push('Wikidata: ' + e.message); return null; }
}

// logo.dev (publishable token; script property LOGO_DEV_TOKEN overrides the built-in one). fallback=404 so an
// unknown company never gets a generated monogram instead of its real logo.
// V.1_38: no built-in token. logo.dev is used only if someone sets the script property LOGO_DEV_TOKEN; the client
// logos come from ClientLogoProvider.gs (Brandfetch with a key, Unavatar without one).
var LOGO_DEV_DEFAULT_TOKEN_ = '';
function logoDevLogo_(domain) {
  if (!domain) return null;
  let token = LOGO_DEV_DEFAULT_TOKEN_;
  try { token = PropertiesService.getScriptProperties().getProperty('LOGO_DEV_TOKEN') || token; } catch (e) {}
  if (!token) return null;
  return fetchImage_('https://img.logo.dev/' + encodeURIComponent(domain) + '?token=' + encodeURIComponent(token) +
    '&size=400&format=png&retina=true&fallback=404', 1200, 'logo.dev');
}
// The company's website from Wikidata when Gemini did not give one ("Apple" -> apple.com)
function wikidataDomain_(name) {
  const s = fetchJson_('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=6&search=' + encodeURIComponent(name), 'Wikidata search');
  const ids = ((s && s.search) || []).filter(function (x) { return /compan|corporat|retailer|business|bank|brand|group|organi[sz]ation|manufacturer|provider|airline|university|chain/i.test(String(x.description || '')); }).map(function (x) { return x.id; });
  if (!ids.length) return '';
  const e = fetchJson_('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' + ids[0], 'Wikidata');
  const c = e && e.entities && e.entities[ids[0]] && e.entities[ids[0]].claims && e.entities[ids[0]].claims.P856;
  const url = c && c[0] && c[0].mainsnak && c[0].mainsnak.datavalue ? c[0].mainsnak.datavalue.value : '';
  return String(url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

function brandfetchLogo_(domain) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('BRANDFETCH_API_KEY');
    if (!key || !domain) return null;
    const r = UrlFetchApp.fetch('https://api.brandfetch.io/v2/brands/' + encodeURIComponent(domain),
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + key } });
    if (r.getResponseCode() !== 200) return null;
    const b = JSON.parse(r.getContentText());
    const logos = (b.logos || []).filter(function (l) { return l.type === 'logo' && l.theme !== 'dark'; }).concat(b.logos || []);
    for (let i = 0; i < logos.length; i++) {
      const fmt = (logos[i].formats || []).filter(function (f) { return f.format === 'png'; })[0];
      if (fmt && fmt.src) { const blob = fetchImage_(fmt.src, 800); if (blob) return blob; }
    }
  } catch (e) {}
  return null;
}

function findClientLogo_(client, ctx) {
  if (!client || !client.name) return null;
  LOGO_TRAIL_ = [];
  let smallIcon = null;
  // V.1_38: know the company's website before asking ClientLogoProvider (Unavatar / Brandfetch need a domain).
  // Order: domain from the sidebar or Gemini, then Wikidata, then the plain .com of the name ("Home Depot" -> homedepot.com).
  if (!client.domain) { client.domain = wikidataDomain_(client.name) || ''; if (client.domain) LOGO_TRAIL_.push('domain from Wikidata: ' + client.domain); }
  const guessedDomain = client.domain ? '' : String(client.name).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '') + '.com';
  if (guessedDomain) LOGO_TRAIL_.push('domain guessed: ' + guessedDomain);
  // ClientLogoProvider (Drive, Brandfetch with a key, Unavatar) — on unless CLIENT_LOGO_LOOKUP=false. Never replaces 66° branding.
  if (typeof resolveClientLogo_ === 'function') {
    try {
      if (typeof resetClientLogoRunLimit_ === 'function') resetClientLogoRunLimit_();
      let resolved = resolveClientLogo_({
        companyName: client.name,
        domain: client.domain || guessedDomain,
        uploadedBlob: client.uploadedLogo || null,
        enabled: typeof clientLogoLookupEnabled_ === 'function' ? clientLogoLookupEnabled_() : true,
        driveLookupFn: function (name) {
          const d = findDriveLogo_(name);
          if (!d) return null;
          return { id: d.id, source: d.source };
        }
      });
      // Slides cannot place WebP pictures: such an answer is skipped and the other sources are tried
      if (resolved && resolved.kind === 'image' && resolved.blob && /webp/i.test(String(resolved.blob.getContentType() || '') + ' ' + String(resolved.mime || ''))) {
        LOGO_TRAIL_.push('ClientLogoProvider (' + resolved.source + '): WebP picture skipped');
        resolved = null;
      }
      if (resolved && resolved.kind === 'image' && (resolved.blob || resolved.id)) {
        if (guessedDomain && resolved.source !== 'user-upload' && !/drive|project/i.test(resolved.source || '')) client.domain = guessedDomain;
        if (resolved.id && !resolved.blob) return { id: resolved.id, blob: null, source: resolved.source };
        const w = resolved.blob ? imageWidth_(resolved.blob) : 0;
        if (resolved.blob && resolved.source !== 'user-upload' && w && w < LOGO_MIN_WIDTH_) {
          // a small site icon (Unavatar often answers 32-48 px): keep it, but first look for the full logo
          LOGO_TRAIL_.push('ClientLogoProvider (' + resolved.source + '): only a ' + w + ' px icon, looking for the full logo');
          smallIcon = { blob: resolved.blob, source: 'the company website icon (' + resolved.source + ')' };
        } else if (resolved.blob) {
          try {
            const ext = /jpe?g/i.test(resolved.blob.getContentType()) ? '.jpg' : '.png';
            const file = clientLogoFolder_().createFile(resolved.blob.setName(client.name + ' logo' + ext));
            return { id: file.getId(), blob: resolved.blob, source: resolved.source + ', saved to Drive' };
          } catch (e) {
            return { id: 'inline', blob: resolved.blob, source: resolved.source + ' (not saved to Drive: ' + e.message + ')' };
          }
        }
      }
      if (resolved && resolved.kind === 'wordmark') {
        LOGO_TRAIL_.push('ClientLogoProvider wordmark: ' + resolved.text);
        // V.1_38: no text-name logo — continue to the other sources for a real image.
      }
      if (resolved && resolved.trail) LOGO_TRAIL_ = LOGO_TRAIL_.concat(resolved.trail);
    } catch (e) {
      LOGO_TRAIL_.push('ClientLogoProvider: ' + e.message);
    }
  }
  const inDrive = findDriveLogo_(client.name);
  if (inDrive) return inDrive;
  LOGO_TRAIL_.push('Drive: none');
  let blob = logoDevLogo_(client.domain), source = 'logo.dev';
  if (!blob && !client.domain) {
    // last try: the plain .com of the name ("Home Depot" -> homedepot.com); logo.dev answers 404 when it is not a company
    blob = logoDevLogo_(guessedDomain);
    if (blob) client.domain = guessedDomain;
  }
  if (!blob) {
    // logo.dev name lookup ("Apple") when no domain worked (only with a LOGO_DEV_TOKEN)
    let token = LOGO_DEV_DEFAULT_TOKEN_;
    try { token = PropertiesService.getScriptProperties().getProperty('LOGO_DEV_TOKEN') || token; } catch (e) {}
    if (token) blob = fetchImage_('https://img.logo.dev/name/' + encodeURIComponent(client.name) + '?token=' + encodeURIComponent(token) + '&size=400&format=png&retina=true&fallback=404', 1200, 'logo.dev (name)');
  }
  if (!blob) { blob = brandfetchLogo_(client.domain); source = 'Brandfetch'; }
  if (!blob) { blob = wikidataLogo_(client.name, client.domain); source = 'the official logo on Wikimedia Commons'; }
  if (!blob) { blob = wikipediaLogo_(client.name); source = 'Wikipedia'; }
  if (!blob && smallIcon) { blob = smallIcon.blob; source = smallIcon.source; }
  const iconDomain = client.domain || guessedDomain;
  if (!blob && iconDomain) { blob = fetchImage_('https://www.google.com/s2/favicons?sz=256&domain=' + encodeURIComponent(iconDomain), 2500, 'Website icon'); source = 'the company website icon'; }
  if (!blob && !iconDomain) LOGO_TRAIL_.push('Website icon: no domain known');
  if (!blob) return null;
  try {
    const ext = /jpe?g/i.test(blob.getContentType()) ? '.jpg' : '.png';
    const file = clientLogoFolder_().createFile(blob.setName(client.name + ' logo' + ext));
    return { id: file.getId(), blob: blob, source: source + ', saved to Drive' };
  } catch (e) {
    // not saved, but still used in this deck
    return { id: 'inline', blob: blob, source: source + ' (not saved to Drive: ' + e.message + ')' };
  }
}

/* ---------- 3. The proposal frame on every slide ---------- */
// Once per deck: the client and its logo, and the section divider style (dark streaks by default, light 66° watermark
// in about one proposal in three). Kept in the long-deck run state so every part of a long deck matches.
function prepareProposal_(userPrompt, sources, ctx, opts) {
  // V.1_52: a Solution Deck has the same frame (client optional), drawn from its own designs
  const solution = typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx);
  if (!(isProposalDeck_(ctx) || solution) || ctx.proposal) return ctx.proposal || null;
  opts = opts || {};
  // V.1_63: every deck has one transition slide, the dark streaks (deck 35: grey watermark dividers mixed in)
  const p = proposalStyles_({ client: null, logoId: '', sectionStyle: 'dark' }, solution ? 'solution' : 'proposal');
  progressStage_(ctx, 'match', 'active', solution ? 'Finding the client' : 'Finding the client and its logo');
  // Explicit sidebar client name/domain take precedence (never inferred from email/uploads alone).
  let c = null;
  const explicitName = String(opts.clientName || ctx.clientName || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const explicitDomain = String(opts.clientDomain || ctx.clientDomain || '').trim();
  if (explicitName) {
    const norm = typeof normalizeClientDomain_ === 'function' ? normalizeClientDomain_(explicitDomain) : { ok: !!explicitDomain, domain: explicitDomain };
    c = { name: explicitName, domain: norm.ok ? norm.domain : '' };
    ctx.log.push('Client from sidebar: ' + c.name + (c.domain ? ' (' + c.domain + ')' : '') + '.');
  } else {
    c = detectClient_(userPrompt, sources, ctx);
  }
  if (c && solution) {
    // V.1_53: a Solution Deck never shows a client logo (the client is named in the text only), so no logo is looked up
    p.client = c.name;
    ctx.log.push('Client: ' + c.name + ' (a Solution Deck carries no client logo).');
  } else if (c) {
    p.client = c.name;
    const logo = findClientLogo_(c, ctx);
    if (logo) { p.logoId = logo.id; if (logo.blob) ctx.clientLogoBlob = logo.blob; ctx.log.push('Client: ' + c.name + ' (logo from ' + logo.source + ').'); }
    else ctx.log.push('Client: ' + c.name + ' (no logo found: ' + LOGO_TRAIL_.slice(0, 6).join('; ') + '. Add an image named "' + c.name + ' logo" to the "' + CLIENT_LOGO_FOLDER_ + '" folder in Drive and it is used next time).');
  } else {
    ctx.log.push('No client named — 66degrees logo used.');
  }
  ctx.proposal = p;
  return p;
}

// Tags every slide spec of a Proposal Deck (idempotent): the engine then draws only proposal designs
function applyProposalFrame_(slides, ctx) {
  if (!ctx) return;
  // The library switch never depends on the client step: a Proposal Deck is a Proposal Deck even when the client or
  // its logo could not be found (or that step failed)
  const solutionDeck = typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx);      // V.1_52
  if (!ctx.proposal && (isProposalDeck_(ctx) || solutionDeck)) ctx.proposal = { client: null, logoId: '', sectionStyle: 'dark' };
  const p = ctx.proposal;
  if (!p) return;
  proposalStyles_(p, solutionDeck ? 'solution' : 'proposal');
  (slides || []).forEach(function (sp) {
    if (!sp) return;
    const t = String(sp.type || '').toLowerCase();
    sp.deckLibrary = p.lib === 'solution' ? 'solution' : 'proposal';
    sp.cobrand = !!p.logoId && p.lib !== 'solution' && t !== 'cover' && t !== 'closing';   // V.1_53: never a client logo in a Solution Deck
    if (t === 'cover') sp.clientLogo = !!p.logoId && p.lib !== 'solution';
    if (t === 'section') {
      sp.sectionStyle = p.sectionStyle;
      // V.1_42: one divider style per deck; a workstream inside a section (level 2) is the light divider, not numbered
      // V.1_63: a workstream inside a section is the same dark streak transition, without a number
      if (Number(sp.level) === 2) { sp.noNumber = true; delete sp.number; }
      sp.lockTag = PROPOSAL_DIVIDER_TAGS_.dark;
    }
    if (t === 'stats') proposalKpiLabels_(sp);
    if (p.client) restoreName_(sp, p.client);
  });
}

// V.1_51 (deck 23 slide 28): a KPI label says which way it goes ("Target: unscheduled maintenance" -> "Target: less
// unscheduled maintenance"), and "(up to)" moves from the label to the value ("Up to 35%")
const KPI_DIRECTION_RE_ = /\b(fewer|less|lower|reduc\w*|cut|decreas\w*|increas\w*|higher|more|faster|quicker|improv\w*|better|grow\w*|boost\w*|gain\w*|rais\w*|accura\w*|availab\w*|rate|uptime|adoption|satisfaction|savings?|saved|roi|return|reliab\w*|on-time|coverage|precision|recall|score)\b/i;
const KPI_NEGATIVE_RE_ = /\b(unscheduled|unplanned|downtime|delays?|costs?|errors?|defects?|failures?|incidents?|churn|fraud|losses?|waste|backlog|false positives?|turnaround|cycle time|time to|aog|disruptions?|outages?|removals?|complaints?|rework)\b/i;
function proposalKpiLabels_(sp) {
  (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) {
    if (!it || typeof it !== 'object') return;
    let label = String(it.label || '');
    const upTo = /\(\s*up to\s*\)/i.test(label);
    label = label.replace(/\s*\(\s*(up to|at least)\s*\)\s*/ig, ' ').replace(/\s+/g, ' ').trim();
    if (upTo && it.value && String(it.value).length <= 6 && !/^up to/i.test(String(it.value))) it.value = 'Up to ' + String(it.value).trim();
    const m = label.match(/^(target:\s*)(.+)$/i);
    if (m && !KPI_DIRECTION_RE_.test(m[2]) && KPI_NEGATIVE_RE_.test(m[2])) {
      const word = /\b(costs?|time|turnaround|cycle)\b/i.test(m[2]) ? 'lower ' : /s\b/i.test(m[2].split(/\s+/).pop()) ? 'fewer ' : 'less ';
      label = m[1] + word + m[2].charAt(0).toLowerCase() + m[2].slice(1);
    }
    it.label = label;
  });
}

// The client's name keeps its own capitals everywhere ("a proposal for the home depot" -> "The Home Depot")
const NAME_COMMON_WORDS_ = /^(water|global|united|first|national|general|american|british|european|international|smart|green|north|south|east|west|central|metro|health|energy|power|bank|capital|digital|cloud|home|food|retail|grand|great|royal|state|federal|pacific|atlantic|mountain|river|coast|island|valley|urban|modern|premier|prime|direct|alliance|summit|pioneer|frontier|liberty|heritage|harbor|harbour|bridge|union|trust|mutual|standard|universal|advanced|applied|integrated|precision|quality|secure|rapid|clear|bright|silver|golden|diamond|crystal|pinnacle|apex|vertex|delta|alpha|omega|summit|cold|fresh|total|super|ultra|mega|micro|meta|best|better|express|logistics|freight|systems|solutions|services|group|partners|holdings|industries|technologies|energy|foods|motors|airlines|health|medical|pharma|insurance|financial|media|labs)$/i;
function restoreName_(o, name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const re = new RegExp('\\b' + words.map(function (w) { return w.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'); }).join('\\s+') + '\\b', 'gi');
  // V.1_54 (deck 25: "existing harbourline systems"): the first word of a longer name keeps its capital on its own too
  const first = words.length > 1 && words[0].length >= 5 && /^[A-Z][a-z]+$/.test(words[0]) && !NAME_COMMON_WORDS_.test(words[0]) ? new RegExp('\\b' + words[0] + '\\b', 'gi') : null;
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    Object.keys(v).forEach(function (k) {
      if (k === 'reference' || k === 'notes') return;
      if (typeof v[k] === 'string') { v[k] = v[k].replace(re, name); if (first) v[k] = v[k].replace(first, words[0]); }
      else if (typeof v[k] === 'object') walk(v[k]);
    });
  })(o);
}

/* ---------- 4. Built-in image: the big light 66° watermark (light section dividers) ---------- */
var WATERMARK_66_PNG_ = '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';
function inlineAssetBlob_(asset) {
  if (asset === 'watermark-66') return Utilities.newBlob(Utilities.base64Decode(WATERMARK_66_PNG_), 'image/png', 'watermark-66.png');
  // V.1_42: navy background (navy section divider) and navy header band (proposal agendas), ProposalAssets.gs
  if (asset === 'navy-bg' && typeof NAVY_BG_JPG_ !== 'undefined') return Utilities.newBlob(Utilities.base64Decode(NAVY_BG_JPG_), 'image/jpeg', 'navy-bg.jpg');
  if (asset === 'navy-band' && typeof NAVY_BAND_JPG_ !== 'undefined') return Utilities.newBlob(Utilities.base64Decode(NAVY_BAND_JPG_), 'image/jpeg', 'navy-band.jpg');
  return null;
}


/* =========================================================================================================
   5. Proposal Deck structure (V.1_42)
   - Section dividers: one style per deck - dark streaks with the section number (about 3 decks in 4) or navy with the
     section's topics (about 1 in 4). A workstream inside a section is the light divider (title only, no number).
   - Agenda: up to 7 items -> spiral; more -> dark two columns (about 3 in 4) or the dark table of contents (about 1 in 4,
     up to 11 items). An agenda too long for one slide continues on "Agenda (continued)".
   - Decks of 12+ slides are written in 3-4 sections (Gemini names each body slide's section; the code adds the dividers).
   The choices are made once per deck and kept in ctx.proposal (long decks keep them from run to run).
   ========================================================================================================= */
var PROPOSAL_DIVIDER_TAGS_ = { dark: 'P66_SECTION_DARK', navy: 'P66_SECTION_NAVY', light: 'P66_SECTION_LIGHT' };
function proposalStyles_(p, lib) {
  if (!p) return p;
  // V.1_52: a Solution Deck uses the two dividers every 66degrees solution deck has: dark streaks, or the light watermark
  // V.1_63: the transition slide is always the dark streaks (slide 4 of deck 35), in every deck type
  if (lib === 'solution' && !p.lib) p.lib = 'solution';
  p.dividerTag = PROPOSAL_DIVIDER_TAGS_.dark;
  p.sectionStyle = 'dark';
  if (!p.agendaWide) p.agendaWide = Math.random() < 0.25 ? 'P66_AGENDA_CONTENTS' : 'P66_AGENDA_TWO_COLUMNS';
  return p;
}

// Number of section dividers a single-run Proposal Deck of n slides is written with (0 = no sections)
function proposalSectionCount_(n) {
  n = Number(n) || 0;
  return n >= 17 ? 4 : n >= 12 ? 3 : 0;
}

function proposalTypeOf_(sp) { return String((sp && sp.type) || '').toLowerCase(); }
function proposalFrame_(sp) { return ['cover', 'agenda', 'closing'].indexOf(proposalTypeOf_(sp)) !== -1; }
function proposalShort_(t, max) {
  let x = String(t || '').split(/:| — | – | - /)[0].replace(/\s+/g, ' ').trim();
  if (x.length > (max || 48)) x = x.slice(0, max || 48).replace(/\s+\S*$/, '');
  return x;
}
function proposalSectionName_(t) {
  const x = proposalShort_(t, 40);
  return typeof sentenceCase_ === 'function' ? sentenceCase_(x, 1) : x;
}

// Body slides grouped by their "section" field into exactly k consecutive groups (merging the smallest or splitting
// the largest when Gemini gave a different number). Returns [{ title, slides[] }].
function proposalGroups_(body, k) {
  let groups = [];
  let last = '';
  body.forEach(function (sp) {
    let name = proposalSectionName_(sp.section || '');
    if (!name) name = last;
    if (groups.length && name.toLowerCase() === last.toLowerCase()) groups[groups.length - 1].slides.push(sp);
    else groups.push({ title: name, slides: [sp] });
    last = name || last;
  });
  // a leading group without a name takes the next group's name
  if (groups.length > 1 && !groups[0].title) { groups[1].slides = groups[0].slides.concat(groups[1].slides); groups.shift(); }
  while (groups.length > k && groups.length > 1) {
    let i = 0;
    groups.forEach(function (g, j) { if (g.slides.length < groups[i].slides.length) i = j; });
    const left = i > 0 ? groups[i - 1] : null, right = i < groups.length - 1 ? groups[i + 1] : null;
    const into = !left ? right : !right ? left : (left.slides.length <= right.slides.length ? left : right);
    if (into === left) left.slides = left.slides.concat(groups[i].slides);
    else right.slides = groups[i].slides.concat(right.slides);
    groups.splice(i, 1);
  }
  while (groups.length < k) {
    let i = -1;
    groups.forEach(function (g, j) { if (g.slides.length >= 2 && (i === -1 || g.slides.length > groups[i].slides.length)) i = j; });
    if (i === -1) break;
    const g = groups[i], half = Math.ceil(g.slides.length / 2);
    const second = { title: proposalSectionName_(g.slides[half].title), slides: g.slides.slice(half) };
    g.slides = g.slides.slice(0, half);
    groups.splice(i + 1, 0, second);
  }
  groups.forEach(function (g) { if (!g.title) g.title = proposalSectionName_(g.slides[0].title); });
  return groups;
}

// Fills the agenda slide from rows [{ title, points[] }] (Introduction ... Thank you) and locks its design.
// Returns the extra "Agenda (continued)" slide when the agenda does not fit on one slide, else null.
function proposalAgenda_(agenda, rows, p) {
  proposalStyles_(p);
  agenda.agendaWide = p.agendaWide;                    // kept on the slide so a later re-sync keeps the same design
  rows = rows.map(function (r) { return { title: proposalShort_(r.title, 60), points: (r.points || []).map(function (x) { return proposalShort_(x, 56); }).filter(Boolean) }; })
    .filter(function (r) { return r.title; });
  agenda.title = 'Agenda';                             // V.1_42b: always "Agenda" (never Gemini's long agenda title)
  if (rows.length <= 6) {                              // V.1_66: the spiral for up to 6 sections, in every deck type
    agenda.items = rows.map(function (r) { return { title: r.title }; });
    agenda.lockTag = 'P66_AGENDA_SPIRAL';
    return null;
  }
  const CAP = 26;                                       // lines that fit in the two columns
  let tag = p.agendaWide;
  if (tag === 'P66_AGENDA_CONTENTS' && rows.length > 11) tag = 'P66_AGENDA_TWO_COLUMNS';
  if (tag === 'P66_AGENDA_CONTENTS') {
    agenda.items = rows.map(function (r) { return { title: r.title }; });
    agenda.lockTag = tag;
    return null;
  }
  // two columns: sections with their topics; topics are cut back (fewest first) until everything fits
  let per = 6;
  const lines = function () { return rows.reduce(function (a, r) { return a + 1 + Math.min(per, r.points.length); }, 0); };
  while (per > 0 && lines() > CAP) per--;
  const take = function (list) { return list.map(function (r) { return { title: r.title, points: r.points.slice(0, per) }; }); };
  agenda.lockTag = tag;
  if (rows.length <= CAP - 2) { agenda.items = take(rows); return null; }
  // more sections than one slide holds: the rest continues on a second agenda slide
  const cut = CAP - 2;
  agenda.items = take(rows.slice(0, cut));
  return { type: 'agenda', title: agenda.title, continued: true, items: take(rows.slice(cut)), lockTag: tag };
}

// Single-run Proposal Deck: adds the section dividers (when the deck was written in sections) and builds the agenda.
// plan.slides = cover, agenda, body..., closing (from planContent). k = the number of dividers planned for this deck.
function proposalStructure_(plan, ctx, k) {
  if (ctx && !ctx.proposal && isProposalDeck_(ctx)) ctx.proposal = { client: null, logoId: '', sectionStyle: 'dark' };
  const p = ctx && ctx.proposal;
  if (!p || !plan || !Array.isArray(plan.slides)) return plan;
  proposalStyles_(p);
  const slides = plan.slides;
  const cover = slides.filter(function (sp) { return proposalTypeOf_(sp) === 'cover'; })[0];
  const agenda = slides.filter(function (sp) { return proposalTypeOf_(sp) === 'agenda'; })[0];
  const closing = slides.filter(function (sp) { return proposalTypeOf_(sp) === 'closing'; })[0];
  const body = slides.filter(function (sp) { return !proposalFrame_(sp) && proposalTypeOf_(sp) !== 'section'; });
  const heading = function (sp) { return String(sp.title || sp.statement || '').trim(); };
  let rows;
  let out = body;
  if (k > 0 && body.length >= 2 * k) {
    const groups = proposalGroups_(body, k);
    out = [];
    groups.forEach(function (g, i) {
      out.push({ type: 'section', title: g.title, number: (i + 1 < 10 ? '0' : '') + (i + 1), lead: '',
        points: g.slides.map(heading).filter(Boolean).slice(0, 5), notes: '' });
      g.slides.forEach(function (sp) { out.push(sp); });
    });
    rows = groups.map(function (g) { return { title: g.title, points: g.slides.map(heading) }; });
    if (ctx.log && groups.length !== k) ctx.log.push('Proposal sections: ' + groups.length + ' of ' + k + ' planned.');
  } else {
    rows = body.map(function (sp) { return { title: heading(sp), points: [] }; });
  }
  body.forEach(function (sp) { delete sp.section; });
  let extra = null;
  if (agenda) {
    // V.1_63 (deck 35): the agenda lists the sections only (no "Introduction" / "Thank you" rows)
    extra = proposalAgenda_(agenda, rows, p);
  }
  plan.slides = [].concat(cover ? [cover] : [], agenda ? [agenda] : [], extra ? [extra] : [], out, closing ? [closing] : []);
  return plan;
}

// Rebuilds the proposal agenda (and the dividers' topic lists) from the slides as they are now: titles can change after
// the structure step (the fit step shortens texts). A continued agenda slide is refreshed, never added here.
function proposalAgendaSync_(slides) {
  const agendas = slides.filter(function (sp) { return proposalTypeOf_(sp) === 'agenda'; });
  const agenda = agendas.filter(function (sp) { return !sp.continued; })[0];
  if (!agenda) return;
  const heading = function (sp) { return String(sp.title || sp.statement || '').trim(); };
  const rows = [];
  let current = null, hasSections = false;
  slides.forEach(function (sp) {
    const t = proposalTypeOf_(sp);
    if (proposalFrame_(sp)) return;
    if (t === 'section' && Number(sp.level) !== 2) {
      hasSections = true;
      current = { title: heading(sp), points: [], divider: sp };
      rows.push(current);
      return;
    }
    if (t === 'section') return;
    if (current) current.points.push(heading(sp));
    else rows.push({ title: heading(sp), points: [] });
  });
  if (hasSections) rows.forEach(function (r) { if (r.divider) r.divider.points = r.points.filter(Boolean).slice(0, 5); });
  const all = rows.map(function (r) { return { title: r.title, points: hasSections ? r.points : [] }; });   // V.1_63: sections only
  const more = proposalAgenda_(agenda, all, { agendaWide: agenda.agendaWide });
  const cont = agendas.filter(function (sp) { return sp.continued; })[0];
  if (cont) cont.items = more ? more.items : [];
}

/* ---------- 6. Every content slide of a Proposal Deck in a proposal design (V.1_42b) ----------
   When no proposal design can draw a slide as Gemini wrote it (plain stats, bullets with a callout, a chart, a quote,
   a team written as stakeholders...), the same content is reshaped into a type that a proposal design can draw:
   "Label: text" bullets become cards, a small chart becomes KPI tiles, a quote becomes a statement, items move to
   cards / process / diagram. The slide keeps its title, lead, notes and section. */
function proposalPointItems_(points) {
  return (Array.isArray(points) ? points : []).map(function (p) {
    if (p && typeof p === 'object') return { title: String(p.title || p.label || '').trim(), text: String(p.text || '').trim() };
    const m = String(p || '').match(/^(.{3,60}?):\s+(.+)$/);
    return m ? { title: m[1].trim(), text: m[2].trim() } : { title: '', text: String(p || '').trim() };
  }).filter(function (it) { return it.title || it.text; });
}
function proposalAlternatives_(sp) {
  const t = proposalTypeOf_(sp);
  const base = function (type, extra) {
    const o = Object.assign({}, sp, { type: type, reference: null }, extra || {});
    delete o.design;
    return o;
  };
  const out = [];
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  const pts = proposalPointItems_(sp.points);
  // V.1_58 (deck 31): the shape the content really has comes first
  const strOf = function (x) { return typeof x === 'string' ? x : (x && (x.title || x.name || x.label || x.text)) || ''; };
  const listOf = function (o) { return ((o && (o.points || o.items || o.parts || o.bullets || o.components)) || []).map(strOf).map(function (x) { return String(x).trim(); }).filter(Boolean); };
  // layers written as items ("Layer 4: ML and streaming" with its parts) -> the layer stack, top layer first
  const layerItems = items.filter(function (it) { return it && typeof it === 'object' && /^\s*(layer|tier|level)\s*\d/i.test(String(it.title || it.label || '')) && listOf(it).length >= 2; });
  if (sp.deckLibrary === 'solution' && layerItems.length >= 3 && layerItems.length === items.length) {
    const num = function (it) { return Number((/\d+/.exec(String(it.title || it.label)) || [0])[0]); };
    const ordered = layerItems.slice().sort(function (a, b) { return num(b) - num(a); });
    out.push(base('diagram', { layers: ordered.map(function (it) { return { label: String(it.title || it.label).replace(/^\s*(layer|tier|level)\s*\d+\s*[:·.\-–—]\s*/i, '').replace(/^./, function (c) { return c.toUpperCase(); }), items: listOf(it).slice(0, 6) }; }), items: [] }));
  }
  if (sp.deckLibrary === 'solution' && Array.isArray(sp.layers) && sp.layers.length >= 3) out.push(base('diagram', {}));
  // a primary / DR region pair written as two columns -> the region topology
  const isRegion = /\b(dr|disaster recovery|regions?|failover|multi-region|active-passive|primary and)\b/i.test(String(sp.title || ''));
  const sides = sp.left && sp.right ? [sp.left, sp.right] : (items.length === 2 ? items : null);
  if (sp.deckLibrary === 'solution' && isRegion && sides) {
    const zones = function (o) {
      const raw = (o && (o.items || o.zones || o.points)) || [];
      return raw.slice(0, 3).map(function (z) { return typeof z === 'string' ? { title: z, text: '' } : { title: String(z.title || z.name || z.label || ''), text: String(z.text || z.description || '') }; }).filter(function (z) { return z.title; });
    };
    const regs = sides.map(function (o) { return { label: String((o && (o.title || o.label || o.name)) || ''), zones: zones(o), detail: String((o && (o.detail || o.footer)) || '') }; });
    if (regs.every(function (r) { return r.label && r.zones.length; })) out.push(base('diagram', { regions: regs, left: null, right: null, items: [], note: String(sp.takeaway || '') }));
  }
  // a step written as fields (goal, input, action...) keeps every field as its text: "Goal: ... · Action: ..."
  if (items.length >= 2 && items.every(function (it) { return it && typeof it === 'object' && !String(it.text || '').trim() && !(Array.isArray(it.points) && it.points.length); })) {
    // (V.1_71, deck 42 Solution 23: "· Status: Amber" written into the text): a status, colour or icon is never text
    const SKIPK = { title: 1, label: 1, name: 1, icon: 1, material: 1, value: 1, tag: 1, number: 1, step: 1, points: 0, status: 1, rag: 1, color: 1, colour: 1, tone: 1, highlight: 1 };
    const withText = items.map(function (it) {
      const parts = [];
      Object.keys(it).forEach(function (k) {
        if (SKIPK[k]) return;
        const v = it[k];
        if (typeof v === 'string' && v.trim()) parts.push(k === 'text' ? v.trim() : k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') + ': ' + v.trim());
      });
      return Object.assign({}, it, { text: parts.join(' · ') });
    });
    if (withText.every(function (it) { return it.text; })) {
      out.push(base('process', { items: withText }));
      out.push(base('cards', { items: withText }));
    }
  }
  const callout = sp.callout ? String(sp.callout.text || sp.callout.title || '').trim() : '';
  let take = String(sp.takeaway || callout || sp.statement || '').trim();
  if (take.toLowerCase() === String(sp.title || '').trim().toLowerCase()) take = '';   // V.1_52: never the title again as the takeaway
  if (pts.length >= 3 && pts.every(function (it) { return it.title; })) {
    out.push(base('cards', { items: pts.slice(0, 8), points: [], takeaway: take }));
    out.push(base('process', { items: pts.slice(0, 6), points: [], takeaway: take }));
  }
  if (t === 'chart' && sp.chart && Array.isArray(sp.chart.categories) && sp.chart.series && sp.chart.series[0]) {
    const unit = String(sp.chart.unit || '');
    const vals = sp.chart.series[0].values || [];
    const st = sp.chart.categories.slice(0, 4).map(function (c, i) { return { value: String(vals[i] != null ? vals[i] : '') + unit, label: String(c) }; })
      .filter(function (x) { return x.value !== unit; });
    if (st.length >= 3) out.push(base('stats', { items: st, takeaway: sp.insight ? String(sp.insight.text || sp.insight.title || '') : take, chart: null }));
  }
  // risks with their mitigation -> the risk table (Risk | Mitigation, or Risk | Impact | Mitigation when the mitigations are points)
  if (/\b(risks?|mitigat\w*)\b/i.test(String(sp.title || '')) && items.length >= 2 && t !== 'table' &&
      items.every(function (it) { return it && typeof it === 'object' && (it.title || it.label) && (it.text || (it.points || []).length); })) {
    const withPts = items.some(function (it) { return (it.points || []).length; });
    out.push(base('table', withPts
      ? { columns: ['Risk', 'Impact', 'Mitigation'], rows: items.slice(0, 7).map(function (it) { return [String(it.title || it.label), String(it.text || ''), (it.points || []).map(String).join('; ')]; }), items: [] }
      : { columns: ['Risk', 'Mitigation'], rows: items.slice(0, 7).map(function (it) { return [String(it.title || it.label), String(it.text)]; }), items: [] }));
  }
  // V.1_47: a roadmap the Gantt cannot draw (too few lanes) becomes its phases: one step per bar, in time order
  if (t === 'timeline' && Array.isArray(sp.lanes) && Array.isArray(sp.periods)) {
    const per = sp.periods.map(String);
    const bars = [];
    sp.lanes.forEach(function (l) { ((l && l.bars) || []).forEach(function (b) { if (b && (b.label || (l && l.name))) bars.push({ l: l, b: b }); }); });
    bars.sort(function (a, b) { return (a.b.start || 0) - (b.b.start || 0); });
    const steps = bars.slice(0, 6).map(function (x) {
      const from = per[(x.b.start || 1) - 1] || '', to = per[(x.b.end || x.b.start || 1) - 1] || '';
      return { title: String(x.b.label || x.l.name), text: String(x.l.name || '') + (from ? ' · ' + from + (to && to !== from ? ' to ' + to : '') : '') };
    });
    if (steps.length >= 3) out.push(base('process', { items: steps, lanes: null, periods: null }));
  }
  if (t === 'quote' && sp.quote) out.push(base('statement', { statement: String(sp.quote), text: String(sp.attribution || '') }));
  if (Array.isArray(sp.teams) && sp.teams.length === 2 && t !== 'team') out.push(base('team'));
  if (sp.org && t !== 'team') out.push(base('team'));
  if (items.length >= 2) {
    const its = items.map(function (it) {
      if (typeof it === 'string') return { title: '', text: it };
      // V.1_48: a step written as points ({title, points[]}) keeps them as its text, so other designs can show it
      const pts = Array.isArray(it.points) ? it.points.map(function (p) { return typeof p === 'string' ? p : (p && (p.text || p.title)) || ''; }).filter(Boolean) : [];
      const fromPts = pts.length ? pts.map(function (p) { return /[.!?]$/.test(p) ? p : p + '.'; }).join(' ') : '';
      // a stats item keeps its figure in its heading ("65% · Fewer lost sales"), never loses it
      const title = it.value && /\d/.test(String(it.value)) ? String(it.value) + ' · ' + String(it.label || it.title || '') : (it.title || it.label || it.name || '');
      return Object.assign({}, it, { title: title, text: it.text || fromPts || '' });
    });
    if (t !== 'cards') out.push(base('cards', { items: its }));
    if (t !== 'process') out.push(base('process', { items: its }));
    if (t !== 'diagram') out.push(base('diagram', { items: its }));
  }
  // (V.1_50: the statement is the slide's message (its title); the lead is the line under it, never the same sentence twice)
  if (t !== 'statement' && (sp.statement || sp.lead || sp.title)) {
    const stm = String(sp.statement || sp.title || sp.lead), sub = String(sp.text || callout || (sp.lead && sp.lead !== stm ? sp.lead : '') || '');
    out.push(base('statement', { statement: stm, text: sub !== stm ? sub : '' }));
  }
  return out;
}
// V.1_50: a loop is drawn as a cycle (deck 22: "an integrated loop" on a stack of layers, "continuous improvement" on
// numbered bars). A slide whose title or lead says loop / cycle / lifecycle / continuous improvement, with 4-6 steps,
// becomes the cycle design when it is free and can show the steps.
const CYCLE_WORDS_RE_ = /\b(loop|cycle|lifecycle|life cycle|continuous(ly)? (improvement|optimi[sz]ation|learning|improve)|flywheel|iterative|feedback loop)\b/i;
function proposalCycle_(sp, used) {
  if (!sp || sp.deckLibrary !== 'proposal' || sp.lockTag || (used && used.P66_CYCLE)) return false;
  const t = proposalTypeOf_(sp);
  if (['process', 'diagram', 'cards'].indexOf(t) === -1) return false;
  if (!CYCLE_WORDS_RE_.test(String(sp.title || '') + ' ' + String(sp.lead || ''))) return false;
  if (/\b(risks?|kpis?|team|architecture)\b/i.test(String(sp.title || ''))) return false;
  const items = (Array.isArray(sp.items) ? sp.items : []).filter(function (it) { return it && typeof it === 'object' && (it.title || it.label); });
  if (items.length < 4 || items.length > 6) return false;
  const trial = Object.assign({}, sp, { type: 'diagram', items: items.map(function (it) {
    const pts = Array.isArray(it.points) ? it.points.map(String) : [];
    return { title: String(it.title || it.label), text: String(it.text || pts.join(' ')), icon: it.icon };
  }), center: sp.center || (typeof centerLabel_ === 'function' ? centerLabel_(sp.title) : ''), reference: { tag: 'P66_CYCLE' } });
  if (typeof ENGINE !== 'undefined' && ENGINE.canDraw && !ENGINE.canDraw(trial)) return false;
  Object.keys(sp).forEach(function (k) { delete sp[k]; });
  Object.assign(sp, trial, { design: 'P66_CYCLE', reference: null });
  return true;
}
// used = designs already placed in this deck (a design is shown once): they do not count as available
function proposalDrawable_(sp, used) {
  if (typeof ENGINE === 'undefined' || typeof drawableDesigns_ !== 'function') return [];
  const type = typeof normalizeType_ === 'function' ? normalizeType_(sp.type) : proposalTypeOf_(sp);
  const lib = sp.deckLibrary === 'solution' ? 'solution' : 'proposal';              // V.1_52
  const inLib = function (tag) { return ENGINE.inLibrary ? ENGINE.inLibrary(tag, lib) : !!(ENGINE.PROPOSAL_TAGS || {})[tag]; };
  return drawableDesigns_(type, itemCount_(sp), sp).filter(function (d) {
    return inLib(d.tag) && !(used && used[d.tag]) && (!ENGINE.canDraw || ENGINE.canDraw(Object.assign({}, sp, { reference: { tag: d.tag } })));
  });
}
// V.1_58 (deck 31: the Ulta roadmap was six cards reading "Phase 1 ... · Month 1 to Month 2"): a phased roadmap written as
// steps with their months becomes the Gantt roadmap (phases as bars, gates and checkpoints as milestones)
const ROADMAP_TITLE_RE_ = /\b(roadmap|phased|phases|timeline|plan|rollout|delivery plan|schedule)\b/i;
function roadmapAsGantt_(sp) {
  if (!sp || sp.deckLibrary !== 'proposal' || sp.lockTag || !ROADMAP_TITLE_RE_.test(String(sp.title || ''))) return false;
  const t = proposalTypeOf_(sp);
  if (['process', 'timeline', 'cards'].indexOf(t) === -1 || (Array.isArray(sp.lanes) && sp.lanes.length)) return false;
  const items = (Array.isArray(sp.items) ? sp.items : []).filter(function (it) { return it && typeof it === 'object'; });
  if (items.length < 3 || items.length > 10) return false;
  let unit = '';
  const parsed = items.map(function (it) {
    const all = [it.timing, it.duration, it.when, it.text, it.label, it.subtitle].filter(Boolean).join(' · ');
    const m = /\b(month|week|quarter|q|sprint)\s*(\d{1,2})(?:\s*(?:to|-|–|through)\s*(?:(?:month|week|quarter|q|sprint)\s*)?(\d{1,2}))?/i.exec(all);
    if (!m) return null;
    const u = /^q/i.test(m[1]) ? 'Quarter' : m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    if (unit && unit !== u) return null;
    unit = u;
    const phase = (/\bphase\s*\d[^·.;]*/i.exec(all) || [''])[0].trim();
    const gate = /\b(gate|checkpoint|milestone|sign-?off|go-live|handoff)\b/i.test(String(it.title || '') + ' ' + phase);
    return { start: Number(m[2]), end: Number(m[3] || m[2]), label: String(it.title || it.label || '').trim(), phase: phase, gate: gate };
  });
  if (parsed.some(function (x) { return !x || !x.label; })) return false;
  const maxP = Math.max.apply(null, parsed.map(function (x) { return x.end; }));
  if (maxP < 3 || maxP > 12) return false;
  const lanes = [];
  parsed.filter(function (x) { return !x.gate; }).forEach(function (x) {
    lanes.push({ name: x.phase ? x.phase.replace(/\s*[·:]\s*$/, '') : x.label, bars: [{ start: x.start, end: x.end, label: x.phase ? x.label : '' }] });
  });
  const gates = parsed.filter(function (x) { return x.gate; });
  if (gates.length) lanes.push({ name: 'Value checkpoints', bars: gates.map(function (x) { return { start: x.end, milestone: true, label: x.label }; }) });
  if (lanes.length < 3 || lanes.length > 8) return false;
  const periods = []; for (let k = 1; k <= maxP; k++) periods.push(unit + ' ' + k);
  const trial = Object.assign({}, sp, { type: 'timeline', periods: periods, lanes: lanes, items: [], reference: { tag: 'P66_GANTT' } });
  delete trial.design;
  if (typeof ENGINE === 'undefined' || !ENGINE.canDraw || !ENGINE.canDraw(trial)) return false;
  Object.keys(sp).forEach(function (k) { delete sp[k]; });
  Object.assign(sp, trial, { design: 'P66_GANTT', reference: null });
  return true;
}
function proposalCoerce_(sp, ctx, used) {
  if (!sp || (sp.deckLibrary !== 'proposal' && sp.deckLibrary !== 'solution') || sp.lockTag) return false;
  if (!(used && used.P66_GANTT) && roadmapAsGantt_(sp)) {
    if (typeof referenceForTag_ === 'function') { try { sp.reference = referenceForTag_(ctx && ctx.lib, 'P66_GANTT'); } catch (e) {} }
    if (ctx && ctx.log) ctx.log.push('Proposal design: "' + String(sp.title || '').slice(0, 50) + '" drawn as a Gantt roadmap (its steps carry their months).');
    return true;
  }
  const t = proposalTypeOf_(sp);
  if (['cover', 'agenda', 'closing', 'section', 'template'].indexOf(t) !== -1) return false;
  // V.1_63 (deck 35 slide 6: "<33% · Industry benchmark..." written small in card headings): items that each carry a figure
  // are figures - the slide becomes KPI tiles (big numbers) when a figures design can show them
  if (t !== 'stats' && t !== 'chart' && Array.isArray(sp.items) && sp.items.length >= 2 && sp.items.length <= 4 &&
      sp.items.every(function (it) { return it && typeof it === 'object' && /\d/.test(String(it.value || '')) && String(it.value).length <= 12; })) {
    const st = Object.assign({}, sp, { type: 'stats', reference: null, items: sp.items.map(function (it) {
      return { value: String(it.value), label: String(it.label || it.title || ''), text: String(it.text || (Array.isArray(it.points) ? it.points.join(' ') : '') || '') };
    }) });
    delete st.design;
    if (proposalDrawable_(st).length) {
      Object.keys(sp).forEach(function (k) { delete sp[k]; });
      Object.assign(sp, st);
      if (ctx && ctx.log) ctx.log.push('Proposal design: "' + String(sp.title || '').slice(0, 50) + '" shown as figures (each item has a number).');
      return true;
    }
  }
  if (proposalDrawable_(sp, used).length) return false;
  // V.1_48: figures stay figures: a KPI / stats slide whose only design is taken uses it again (deck 21: the KPI targets
  // lost their numbers on a layer stack); the same for a risk slide that the risk rows can show
  const numeric = (Array.isArray(sp.items) ? sp.items : []).filter(function (it) { return it && /\d/.test(String(it.value || '')); }).length;
  if (t === 'stats' && numeric >= 2 && proposalDrawable_(sp).length) return false;
  if (/\b(risks?|mitigat\w*)\b/i.test(String(sp.title || '')) && (sp.items || []).some(function (it) { return it && (it.points || []).length; }) &&
      proposalDrawable_(sp).some(function (d) { return d.tag === 'P66_IMPACT_MITIGATION'; })) return false;
  const alts = proposalAlternatives_(sp);
  // V.1_48: a slide with several points is never reduced to one statement (it would lose them): a design already used
  // that shows all the points is better
  const many = (Array.isArray(sp.items) ? sp.items.filter(Boolean).length : 0) >= 2 || (Array.isArray(sp.points) ? sp.points.length : 0) >= 2 ||
    ((sp.left && (sp.left.points || []).length) || 0) + ((sp.right && (sp.right.points || []).length) || 0) >= 2 || (Array.isArray(sp.rows) && sp.rows.length >= 2) ||   // V.1_50: two columns of points too
    (typeof solutionTextCount_ === 'function' && solutionTextCount_(sp) >= 2);   // V.1_56 / V.1_57: points in other fields too (deck 29 security slide, Sprouts team slide)
  for (let i = 0; i < alts.length; i++) {
    if (many && proposalTypeOf_(alts[i]) === 'statement') continue;
    if (!proposalDrawable_(alts[i], used).length) continue;
    Object.keys(sp).forEach(function (k) { delete sp[k]; });
    Object.assign(sp, alts[i]);
    if (ctx && ctx.log) ctx.log.push((sp.deckLibrary === 'solution' ? 'Solution' : 'Proposal') + ' design: "' + String(sp.title || '').slice(0, 50) + '" shown as ' + sp.type + ' (a design of its library for its content).');
    return true;
  }
  // V.1_53: a Solution slide no Solution design can show becomes text sections or a bullet list (never a General layout)
  // (V.1_57: a Proposal slide too - the Sprouts team slide kept only its title)
  if (!proposalDrawable_(sp).length && typeof solutionRescue_ === 'function') {
    const before = sp.type;
    if (solutionRescue_(sp) && proposalDrawable_(sp).length) {
      if (ctx && ctx.log) ctx.log.push((sp.deckLibrary === 'solution' ? 'Solution' : 'Proposal') + ' design: "' + String(sp.title || '').slice(0, 50) + '" shown as text (no Solution design could show it as ' + before + ').');
      return true;
    }
  }
  // nothing new fits: a proposal design already used is drawn again (never the plain layout when one can draw it)
  if (!proposalDrawable_(sp).length && proposalReshape_(sp, ctx, used)) return true;
  if (!proposalDrawable_(sp).length && ctx && ctx.log) ctx.log.push('No ' + (sp.deckLibrary === 'solution' ? 'solution' : 'proposal') + ' design for "' + String(sp.title || '').slice(0, 50) + '": plain ' + t + ' layout used.');
  return false;
}

/* ---------- V.1_63: the shape the content really has (deck 35: 14 slides came out as "Label: a; b; c" bullets) ----------
   A slide no proposal design could draw as written is read for its real shape and drawn in a proposal design of that
   shape - also one used earlier in the deck (a long deck runs out of fresh designs) - before any plain layout:
     two sides (legacy / target, in scope / out of scope, internal / external)  -> two panels, pros / cons, or a table
     rows compared on aspects                                                   -> a table (aspect | left | right)
     two groups of roles (client team / 66degrees team, RACI)                    -> the team structure
     a list of actions or sentences                                             -> numbered rows or step boxes
   Every word of the slide stays: a candidate is only taken when its design shows all of it without cutting a text. */
function proposalSentences_(o) {
  if (o == null) return [];
  if (typeof o === 'string' || typeof o === 'number') return String(o).trim() ? [String(o).trim()] : [];
  if (Array.isArray(o)) return o.reduce(function (a, x) { return a.concat(proposalSentences_(x)); }, []);
  if (typeof o !== 'object') return [];
  const head = String(o.title || o.label || o.name || o.role || '').trim(), body = String(o.text || o.description || o.detail || '').trim();
  if (head && body) return [head + ': ' + body];
  if (head || body) return [head || body];
  return [];
}
function proposalSide_(o) {
  if (!o) return null;
  if (typeof o === 'string') return { label: '', points: [o] };
  const label = String(o.label || o.title || o.name || o.heading || '').trim();
  let pts = [];
  ['points', 'bullets', 'items', 'details', 'actions', 'roles', 'members', 'controls', 'steps'].some(function (k) { pts = proposalSentences_(o[k]); return pts.length > 0; });
  const text = String(o.text || o.description || o.detail || '').trim();
  if (!pts.length && text) pts = text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(function (x) { return x.trim(); }).filter(Boolean);
  else if (text) pts = [text].concat(pts);
  // any other text the side carries ("audience", "needs" ...) is kept as a point
  Object.keys(o).forEach(function (k) {
    if (/^(label|title|name|heading|text|description|detail|points|bullets|items|details|actions|roles|members|controls|steps|icon|material|value|tag)$/.test(k)) return;
    if (typeof o[k] === 'string' && o[k].trim()) pts.push(k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') + ': ' + o[k].trim());
  });
  return label && pts.length ? { label: label, points: pts } : null;
}
function proposalReshapes_(sp) {
  const out = [];
  const keep = { title: sp.title, lead: sp.lead, notes: sp.notes, section: sp.section, deckLibrary: sp.deckLibrary, cobrand: sp.cobrand, takeaway: sp.takeaway };
  const mk = function (type, extra) { return Object.assign({}, keep, { type: type, reference: null }, extra); };
  const items = (Array.isArray(sp.items) ? sp.items : []).filter(function (it) { return it && typeof it === 'object'; });
  const title = String(sp.title || '');
  // two sides
  let sides = null;
  if (sp.left && sp.right) sides = [proposalSide_(sp.left), proposalSide_(sp.right)];
  else if (items.length === 2) sides = items.map(proposalSide_);
  else if (Array.isArray(sp.teams) && sp.teams.length === 2) sides = sp.teams.map(proposalSide_);
  const teamLike = /\b(team|raci|roles?|responsib\w*|stakeholders?|governance structure|who does what)\b/i.test(title);
  if (sides && sides[0] && sides[1]) {
    if (teamLike) out.push(mk('team', { teams: sides.map(function (x) { return { name: x.label, roles: x.points }; }), governance: sp.governance || null, items: [] }));
    out.push(mk('comparison', { left: { label: sides[0].label, points: sides[0].points }, right: { label: sides[1].label, points: sides[1].points }, items: [] }));
    // the two sides as two cards (a from -> to shift), when the two-panel design was just used
    out.push(mk('cards', { items: sides.map(function (x) { return { title: x.label, text: x.points.map(function (q) { return /[.!?]$/.test(q) ? q : q + '.'; }).join(' ') }; }) }));
  }
  // rows compared on aspects
  const rows = (Array.isArray(sp.rows) ? sp.rows : []).filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r) && (r.label || r.aspect) && (r.left || r.before) && (r.right || r.after); });
  if (rows.length >= 2) {
    let cc = (Array.isArray(sp.columns) ? sp.columns : []).map(function (c) { return typeof c === 'string' ? c : (c && (c.title || c.label)) || ''; }).filter(Boolean);
    if (cc.length === 3) cc = cc.slice(1);
    if (cc.length !== 2) { const vs = title.split(/\s+(?:vs\.?|versus)\s+/i); cc = vs.length === 2 ? vs.map(function (x) { x = x.trim(); return x.charAt(0).toUpperCase() + x.slice(1); }) : ['Today', 'Proposed']; }
    out.push(mk('table', { columns: ['Aspect'].concat(cc), rows: rows.map(function (r) { return [String(r.label || r.aspect), String(r.left || r.before), String(r.right || r.after)]; }), items: [] }));
    out.push(mk('comparison', { left: { label: cc[0], points: rows.map(function (r) { return String(r.label || r.aspect) + ': ' + String(r.left || r.before); }) },
      right: { label: cc[1], points: rows.map(function (r) { return String(r.label || r.aspect) + ': ' + String(r.right || r.after); }) }, items: [] }));
  }
  // a list of actions or sentences: one row / step each (the takeaway stays the takeaway, never a step)
  const pts = proposalSentences_(sp.points).filter(function (p) { return p.toLowerCase() !== title.trim().toLowerCase(); });
  if (pts.length >= 3 && pts.length <= 6) {
    const its = pts.map(function (p) { const m = /^(.{3,60}?):\s+(.+)$/.exec(p); return m ? { title: m[1], text: m[2] } : { title: p, text: '' }; });
    out.push(mk('process', { items: its, points: [] }));
    out.push(mk('cards', { items: its, points: [] }));
  }
  // groups with points (3-6): cards whose text is the points
  if (items.length >= 3 && items.length <= 6 && items.every(function (it) { return proposalSide_(it); })) {
    const its = items.map(function (it) { const x = proposalSide_(it); return { title: x.label, text: x.points.map(function (q) { return /[.!?]$/.test(q) ? q : q + '.'; }).join(' '), icon: it.icon }; });
    out.push(mk('cards', { items: its }));
    out.push(mk('process', { items: its }));
  }
  return out;
}
// Every word of the slide is shown: the words of the candidate's texts that the design draws
// (strict: no text longer than its box at the largest type size; otherwise the fit step and the smaller type sizes of the
//  renderer make it fit, as for every other slide)
function proposalShowsAll_(cand, strict) {
  if (typeof ENGINE === 'undefined' || !ENGINE.measure) return true;
  let m = null;
  try { m = ENGINE.measure(cand, {}); } catch (e) { return false; }
  return !!m && m.content > 0 && (!strict || !(m.overflow || []).length) && String(m.drawnWith || '').indexOf('base:') !== 0;
}
function proposalReshape_(sp, ctx, used) {
  if (!sp || sp.deckLibrary !== 'proposal') return false;
  const cands = proposalReshapes_(sp);
  // passes: a fresh design that fits as written, any design that fits, a fresh design, any design (in the first passes a
  // design placed in the last 8 slides is left out, so the same look does not come back right away)
  const near = function (tag) { const w = ctx && ctx.designAt; return !!(w && w.lastAt && w.lastAt[tag] && w.at - w.lastAt[tag] < 8); };
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      // fresh designs first, then one used earlier in the deck (least used first)
      const designs = proposalDrawable_(c, pass % 2 === 0 ? used : null).filter(function (d) { return pass >= 2 || !near(d.tag); })
        .sort(function (a, b) { return ((used && used[a.tag]) || 0) - ((used && used[b.tag]) || 0); });
      for (let j = 0; j < designs.length; j++) {
        const trial = Object.assign({}, c, { reference: { tag: designs[j].tag } });
        if (!proposalShowsAll_(trial, pass < 2)) continue;
        Object.keys(sp).forEach(function (k) { delete sp[k]; });
        Object.assign(sp, c, { design: designs[j].tag });
        if (ctx && ctx.log) ctx.log.push('Proposal design: "' + String(sp.title || '').slice(0, 50) + '" shown as ' + sp.type + ' (' + designs[j].tag + ') instead of plain text.');
        return true;
      }
    }
  }
  return false;
}

/* =========================================================================================================
   V.1_51 — How Gemini writes a Proposal Deck
   Before: every part of the deck was written by one prompt of ~46,000 characters (222 rules, all 65 designs), each slide
   seeing only the titles of the others. Gemini kept some rules and dropped others, repeated points across slides and
   picked designs from text it had never seen. Now:
   1. The outline is a storyline (Gemini Pro): each section says what it proves, each slide has its own message and the
      points only it covers.
   2. Each slide is written from that plan with a short prompt (~30 rules) and a shortlist of the 3-8 designs that suit it,
      each with "use for / never for".
   3. A record of what earlier slides already said (headings, figures, designs) goes with every part: nothing is repeated.
   The code still checks and enforces everything afterwards (count, designs, risks, KPIs, team, sentence case...).
   ========================================================================================================= */

// "Use for / never for" for every Proposal design: Gemini picks from what each design is FOR, not from its look alone
const PROPOSAL_DESIGN_GUIDE_ = {
  P66_KEY_INPUTS: 'use for: open questions or inputs we need from the client, grouped. never for: findings or benefits',
  P66_TEXT_SCREENSHOT: 'use for: one product feature next to a screenshot the user supplied. never without a supplied screenshot',
  P66_CARDS_2X2: 'use for: exactly four parallel ideas of equal weight (objectives, pain points, principles) with a short side note',
  P66_CARD_GRID: 'use for: 4-8 parallel items explained in one or two lines (components, requirements, workstreams)',
  P66_CATEGORY_LEGEND: 'use for: a framework of 4-5 named categories with definitions. never for: steps in time or data sources',
  P66_COLUMNS_PHOTO: 'use for: 3-4 short question-style themes (what / how / who) with 2-5 bullets each',
  P66_DELIVERABLE_ROWS: 'use for: one workstream or phase and the deliverable it hands over. never for: general benefits',
  P66_DIAGONAL_OPTIONS: 'use for: three options or maturity levels that grow (good / better / best). never for: a list of features',
  P66_GOV_COLUMNS: 'use for: a governance model (3 bodies, what each decides, how often it meets)',
  P66_ICON_COLUMNS: 'use for: 3-6 parallel capabilities, challenges or benefits, each a heading and one or two sentences',
  P66_ICON_GRID: 'use for: 6-10 named tools, apps or use cases, each one line',
  P66_ILLUSTRATION_TEXT: 'use for: how two teams or roles work together, with a short paragraph and 2-4 labelled points',
  P66_LOGO_WALL: 'use for: why 66degrees, ONLY when the request asks for it',
  P66_PACKAGES: 'use for: 2-4 commercial packages with a price each, ONLY with prices from the request',
  P66_PARADIGM_DARK: 'use for: the opening statement of a section with 3-4 short supporting cards (one dark slide per deck at most)',
  P66_PERSONAS: 'use for: 3-5 user groups or personas and what each needs',
  P66_PILLARS: 'use for: three pillars of the solution, each with the product names that deliver it',
  P66_STORIES: 'use for: several client results, ONLY when the request asks for client proof',
  P66_TIERS: 'use for: 2-4 service or support tiers / levels (L0, L1, L2) and their benefits',
  P66_TWO_CARDS_PHOTO: 'use for: a from -> to shift (today -> with AI) in two cards',
  P66_CASE_STUDY: 'use for: one client result, ONLY when the request asks for a case study',
  P66_RADAR: 'use for: a maturity or readiness score on 5-6 dimensions with real scores',
  P66_CHECKLIST_DECISIONS: 'use for: a go-live checklist next to the decisions still open',
  P66_CHECK_MATRIX: 'use for: comparing 2-4 options against 4-11 capabilities (tick / cross)',
  P66_IMPACT_MITIGATION: 'use for: THE risk slide: each risk (2-3) with a one-line impact and 2-3 mitigation actions',
  P66_PROS_CONS: 'use for: the pros and cons of one option',
  P66_TWO_PANELS: 'use for: a two-sided comparison (current state vs future state), 3-5 short points per side; at most twice per deck',
  P66_ARCH_FLOW: 'use for: THE solution architecture: sources -> Google Cloud platform -> users, with labelled arrows',
  P66_CYCLE: 'use for: a loop that repeats (continuous improvement, model retraining, feedback cycle), 4-6 stages',
  P66_DELIVERY_FLOW: 'use for: how messages or data move between named systems and actors',
  P66_HUB: 'use for: one platform at the centre with 5-8 capabilities or connected systems around it',
  P66_ISO_CALLOUTS: 'use for: 3-4 technology layers that build on each other (data -> models -> apps). never for: steps, loops, lists, risks or KPIs',
  P66_PUZZLE: 'use for: 4 or 6 short labels that fit together into one whole (labels only). never for: anything that needs sentences',
  P66_PYRAMID: 'use for: a true hierarchy of 3-4 levels (maturity, priority). never for: data sources, steps, risks or KPIs',
  P66_NEXT_STEPS: 'use for: next steps, ONLY when the request asks for them',
  P66_CHEVRON_PHASES: 'use for: the methodology or delivery steps in order (3-6), each a short title and 1-2 sentences',
  P66_CURVE: 'use for: an adoption or maturity journey that rises over time (5-8 stages, 2-4 words each). never for: a list of data sources or components',
  P66_NUMBERED_ROWS: 'use for: 3-6 principles, requirements or recommendations, each a heading and one line',
  P66_PARADIGM_COLUMNS: 'use for: 4-6 stages of a method with 2-4 short bullets each and one theme across all of them',
  P66_PHASE_COLUMNS: 'use for: the delivery phases ("Phase 1: ...") with 2-4 activities each. ONLY for the delivery plan',
  P66_STEP_FLOW: 'use for: how something works, step by step (3-5 steps, each a heading and one sentence)',
  P66_EXEC_KEYWORDS: 'use for: an executive summary with three key words and a number or fact under each',
  P66_EXEC_TWO_COL: 'use for: an executive overview: summary paragraph, the ask and the key message',
  P66_PHASE_DETAIL: 'use for: one delivery phase in detail (description and deliverable)',
  P66_PITCH: 'use for: an elevator pitch in three keywords',
  P66_STATEMENT_BOX: 'use for: ONE opening or closing statement of a section. never for: a slide that has steps or points to show',
  P66_BADGES: 'use for: Google partner status, ONLY when the request asks for credentials',
  P66_CREDENTIALS: 'use for: 66degrees in numbers, ONLY when the request asks for credentials',
  P66_INVESTMENT: 'use for: one headline number (total investment or total value) with 2-4 supporting numbers',
  P66_KPI_TILES: 'use for: 3-4 numbers: the KPI targets (label "Target: ...") or market figures from the research',
  P66_ICON_TABLE: 'use for: three themes above a small table of details',
  P66_PRICING: 'use for: a rate card, ONLY with prices from the request',
  P66_TABLE: 'use for: structured facts in rows and 2-5 columns (scope in / out, data sources and their role, risks with impact and mitigation)',
  P66_ORG_TREE: 'use for: a governance or team structure with levels (steering committee -> leads -> teams)',
  P66_TEAM_PHOTOS: 'use for: the named team, ONLY when the request names the people',
  P66_TEAM_ROLES: 'use for: 4-6 roles of the delivery team with what each does',
  P66_TEAM_STRUCTURE: 'use for: THE team slide: the client team and the 66degrees team as two lanes of roles, with the governance body on top',
  P66_GANTT: 'use for: THE roadmap: periods (months or quarters) across, 3-6 workstreams down, bars for the activities',
  P66_PHASE_MATRIX: 'use for: a dense plan: 3-5 periods across, 2-4 workstreams down, short points in each cell'
};

// The slide types whose designs suit a planned slide (its own type first)
// V.1_54: the types a Solution slide may be drawn as (no timeline, team or workstream designs in that library)
const SOLUTION_TYPE_OPTIONS_ = { timeline: ['process', 'cards'], team: ['diagram', 'cards'], workstream: ['process', 'cards'], comparison: ['comparison', 'table', 'cards'],
  statement: ['statement', 'cards', 'bullets'], bullets: ['bullets', 'cards', 'statement'], quote: ['statement'], chart: ['chart', 'stats'], next_steps: ['statement', 'process'] };
const PROPOSAL_TYPE_OPTIONS_ = {
  cards: ['cards', 'diagram', 'process'], process: ['process', 'diagram', 'cards'], diagram: ['diagram', 'cards', 'process'],
  comparison: ['comparison', 'table'], stats: ['stats'], table: ['table', 'comparison'], timeline: ['timeline'], team: ['team'],
  bullets: ['cards', 'bullets', 'statement'], statement: ['statement', 'cards'], case_study: ['case_study'], chart: ['stats', 'chart']
};

// The 3-8 designs Gemini may choose from for one planned slide: drawn in a Proposal Deck, not used yet in this deck, and
// allowed for the slide's subject (the same topic rules the code enforces afterwards)
function proposalShortlist_(o, used, lib) {
  if (typeof ENGINE === 'undefined' || !ENGINE.VARIANTS) return [];
  // V.1_52: the Solution Deck shortlist comes from its own library (and puts the designs of its tone first)
  lib = lib === 'solution' ? 'solution' : 'proposal';
  const P = lib === 'solution' ? (ENGINE.SOLUTION_TAGS || {}) : (ENGINE.PROPOSAL_TAGS || {});
  const FRAME_ = { agenda: 1, section: 1, cover: 1, closing: 1 };
  const words = [o.title, o.message, o.brief].filter(Boolean).join(' ');
  const asked = /\b(credential|why 66degrees|why us|partner status|case stud|client result|success stor|next steps|pricing|price|rate card|package|screenshot)\b/i;
  const onlyIfAsked = { P66_LOGO_WALL: 1, P66_PACKAGES: 1, P66_STORIES: 1, P66_CASE_STUDY: 1, P66_NEXT_STEPS: 1, P66_BADGES: 1, P66_CREDENTIALS: 1, P66_PRICING: 1, P66_TEAM_PHOTOS: 1, P66_TEXT_SCREENSHOT: 1, S66_CLIENT_STORY: 1 };
  let types = PROPOSAL_TYPE_OPTIONS_[String(o.type || 'cards').toLowerCase()] || ['cards', 'diagram', 'process'];
  // V.1_54: a Solution Deck has no timeline or team designs: a roadmap is shown as phases, a team as how it is run
  if (lib === 'solution') types = (SOLUTION_TYPE_OPTIONS_[String(o.type || 'cards').toLowerCase()] || types);
  const out = [];
  types.forEach(function (type) {
    (ENGINE.VARIANTS[type] || []).forEach(function (v) {
      if (!P[v.tag] || FRAME_[type] || out.some(function (x) { return x.tag === v.tag; })) return;
      if (onlyIfAsked[v.tag] && !asked.test(String(o.request || '') + ' ' + words)) return;
      if (used && used[v.tag]) return;
      if (typeof DESIGN_TOPICS_ !== 'undefined' && DESIGN_TOPICS_[v.tag] && !DESIGN_TOPICS_[v.tag].test(words)) return;
      out.push({ tag: v.tag, type: type, v: v });
    });
  });
  // V.1_54: in a Solution Deck the designs the slide's words call for are offered first, even from a related type
  // ("deployment layers" -> layer stack, "architecture" -> the architecture designs)
  let wanted = [];
  if (lib === 'solution' && typeof solutionKeywordDesigns_ === 'function') {
    wanted = solutionKeywordDesigns_([o.title, o.message].filter(Boolean).join(' '));
    wanted.forEach(function (tag) {
      if (out.some(function (x) { return x.tag === tag; }) || (used && used[tag]) || !P[tag]) return;
      Object.keys(ENGINE.VARIANTS).some(function (type) {
        const v = (ENGINE.VARIANTS[type] || []).filter(function (x) { return x.tag === tag; })[0];
        if (v) out.push({ tag: tag, type: type, v: v });
        return !!v;
      });
    });
  }
  // V.1_52: in a Solution Deck the designs that suit the tone of its content come first (technical: tables and flows...)
  if (lib === 'solution' && o.tone && typeof SOLUTION_TONE_BIAS_ !== 'undefined' && SOLUTION_TONE_BIAS_[o.tone]) {
    const bias = SOLUTION_TONE_BIAS_[o.tone];
    out.sort(function (a, b) { return (bias.indexOf(a.tag) === -1 ? 1 : 0) - (bias.indexOf(b.tag) === -1 ? 1 : 0); });
  }
  if (wanted.length) out.sort(function (a, b) { return (wanted.indexOf(a.tag) === -1 ? 99 : wanted.indexOf(a.tag)) - (wanted.indexOf(b.tag) === -1 ? 99 : wanted.indexOf(b.tag)); });
  return out.slice(0, 8);
}
function proposalShortlistText_(list) {
  return list.map(function (x) {
    const v = x.v, count = v.max != null && v.max < 99 && v.min != null ? v.min + '-' + v.max + ' items; ' : '';
    return '    - ' + x.tag + ' (type "' + x.type + '"; ' + count + (PROPOSAL_DESIGN_GUIDE_[x.tag] || (typeof SOLUTION_DESIGN_GUIDE_ !== 'undefined' && SOLUTION_DESIGN_GUIDE_[x.tag]) || '') + '; layout: ' + String(v.desc || '').slice(0, 170) +
      (v.fields ? '; fields: ' + v.fields : '') + (v.words ? '; ' + v.words + ' words' : '') + ')';
  }).join('\n');
}

// The short prompt that writes Proposal Deck slides from the storyline plan.
// a = { userPrompt, n, batch, ctx, sources, approvedFacts, facts, iconNames }
function proposalContentPrompt_(a) {
  const ctx = a.ctx, b = a.batch, sources = a.sources || {};
  const used = (ctx.chooserState && ctx.chooserState.used) || {};
  const client = String((ctx.proposal && ctx.proposal.client && ctx.proposal.client.name) || ctx.clientName || 'the client');
  const plan = b && Array.isArray(b.plan) ? b.plan : [];
  // V.1_51: each slide names its shortlist; every design is described once, in the catalogue after the slides
  const catalogue = [], inCat = {};
  const write = (b ? b.slides : []).map(function (o, k) {
    const sl = proposalShortlist_(Object.assign({ request: a.userPrompt }, o), used);
    sl.forEach(function (x) { if (!inCat[x.tag]) { inCat[x.tag] = true; catalogue.push(x); } });
    return [(k + 1) + '. type "' + o.type + '" | title "' + o.title + '"',
      o.message ? '   message (what this slide proves): ' + o.message : (o.brief ? '   about: ' + o.brief : ''),
      Array.isArray(o.points) && o.points.length ? '   points ONLY this slide covers: ' + o.points.join('; ') : '',
      sl.length ? '   designs to choose from: ' + sl.map(function (x) { return x.tag; }).join(', ') : ''].filter(Boolean).join('\n');
  }).join('\n');
  const ledger = (b && b.ledger || []).slice(-150);
  return [
    'You are a senior consultant at ' + ctx.brand.name + ' (a Google Cloud partner) writing a proposal for ' + client + '.',
    'REQUEST: "' + String(a.userPrompt || '').slice(0, 1500) + '"',
    plan.length ? 'THE STORYLINE OF THE WHOLE DECK (fixed; every slide advances it, no slide repeats another):\n' + plan.join('\n') : '',
    ledger.length ? 'ALREADY SAID ON EARLIER SLIDES (never say these again, in any words):\n- ' + ledger.join('\n- ') : '',
    Object.keys(used).length ? 'Designs already used on earlier slides of this deck (not offered again): ' + Object.keys(used).slice(0, 40).join(', ') : '',
    (b && (b.usedNumbers || []).length) ? 'FIGURES ALREADY SHOWN (never show them again): ' + b.usedNumbers.slice(-80).join(', ') : '',
    'THIS IS PART OF A LONG DECK (' + ((b && b.deckSize) || a.n) + ' slides in all). WRITE EXACTLY THESE ' + a.n + ' SLIDES, in this order, keeping each title word for word (the type is the planned kind of slide):',
    write,
    catalogue.length ? 'THE DESIGNS (write "design" and exactly the fields, item counts and words it needs):\n' + proposalShortlistText_(catalogue) : '',
    'RULES',
    '- Each slide proves its message with its own points: specific to ' + client + ' and the request, concrete (named systems, data, actions, numbers).',
    '- Never repeat a point, challenge, benefit, product explanation or figure that another slide of the storyline covers.',
    '- Choose ONE design per slide from its list and write exactly the fields, item counts and word counts that design needs.',
    '- Title: the planned title. "lead": one sentence (max 110 characters) under the title; never the same words as the title.',
    '- Sentence case everywhere (titles, headings, labels): only the first word, names and acronyms capitalised. Never ALL CAPS, never Title Case.',
    '- Item headings 2-5 words, never starting with a number; item texts 12-30 words, one or two specific sentences, similar length on one slide.',
    '- No filler sentences ("This ensures...", "This helps..."), no hype (revolutionary, game-changer, cutting-edge, seamless, unparalleled).',
    '- Numbers only from the research sources, the approved facts or the request. A number you need but do not have is a target:',
    '  value = the number, label starts with "Target: " (e.g. "Target: fewer unplanned removals"). KPI values are short ("40%", "3x", "2 days").',
    '- A KPI slide: 3-4 stats items, all targets. Risks: 2-3 risks, each {title: risk, text: one-line impact, points: [2-3 mitigation actions]}.',
    '- The team slide: teams [{name: "' + client + ' team", roles:[{title, text}]}, {name: "66degrees team", roles:[...]}] (roles, never names) and',
    '  governance {title, text}. The roadmap: periods [4-9 months or quarters] and lanes [3-6 {name, bars:[{start, end, label}]}].',
    '- The architecture: columns [{label, items:[{title, text}]}] (sources -> Google Cloud -> users) and links [arrow labels].',
    '- Only real Google Cloud product names; never invent products, clients, awards or claims about ' + ctx.brand.name + '.',
    '- No 66degrees credentials, case study, next steps or pricing unless the request asks for them.',
    '- Process / cards items carry an "icon": one concrete concept for that item (e.g. "shield", "database", "wrench"), each different on a slide.',
    '- Plain text only: no markdown, no asterisks, no line breaks inside a text, no reference markers like [1] in slide text.',
    // V.1_57 (deck 30 review)
    '- Current Google Cloud names: Pub/Sub, Dataflow, Dataproc, Cloud Run functions, Looker Studio (never "Cloud Pub/Sub", "Cloud Dataflow", IoT Core).',
    '- A figure from industry research is labelled as an industry figure on the slide ("Industry benchmark: ...", "Across grocers, ..."), never shown as the client\'s number.',
    '- A KPI value is a figure ("25%", "3x", "$2M"); a point in time ("Week 1", "Q3", "Day 30") is never a KPI. A roadmap shows every phase the plan names, Phase 1 first.',
    '- Titles state what the slide shows; never promise a result the research does not support ("cuts waste in half" only with that figure on the slide).',
    '- A KPI slide shows KPI tiles: every KPI has a figure; a target is not also labelled an industry benchmark; the notes use the same figures as the slide.',
    '- A risk always carries its mitigation ({title: risk, text: impact, points: [mitigations]}); a roadmap is lanes and bars with months, gates as milestones.',
    '- The team slide lists roles under each team (never a team name alone); a current vs future comparison fills both columns with points.',
    '- The notes match the slide (same products, numbers and design); a passive disaster recovery region runs no active services; two requested topics are never merged into one slide.',
    '- "notes": 2-3 sentences for the presenter, with research source numbers like [2] when used. "fact_tags": IDs of approved facts used, or [].',
    'APPROVED FACTS ABOUT ' + ctx.brand.name.toUpperCase() + ' (the only claims allowed about it):\n' + (a.approvedFacts || []).slice(0, 25).map(function (f) { return '- ' + f; }).join('\n'),
    (a.facts && a.facts.verify && a.facts.verify.length) ? 'Facts to use only if essential (add "Verify before sharing." to the notes): ' + a.facts.verify.slice(0, 6).join(' | ') : '',
    sources.research && sources.research.length && typeof formatSciteForPrompt === 'function' ? formatSciteForPrompt(sources.research, sources.researchProvider) : '',
    sources.text ? 'USER SOURCE MATERIAL:\n' + String(sources.text).slice(0, 8000) : '',
    a.iconNames && a.iconNames.length ? 'ICON NAMES you may use: ' + a.iconNames.slice(0, 80).join(', ') : '',
    'OUTPUT: ONLY JSON {"deck_title":"","facts_note":"","slides":[{"type":"","design":"","title":"","lead":"", ...fields of the design..., "notes":"","fact_tags":[]}]} with exactly ' + a.n + ' slides.'
  ].filter(Boolean).join('\n');
}

// What a written slide says, as short lines for the record of the deck (headings and short points, not whole texts)
function proposalLedgerOf_(sp) {
  const out = [];
  if (!sp) return out;
  const t = String(sp.type || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'section', 'template'].indexOf(t) !== -1) return out;
  const head = String(sp.title || '').trim();
  const add = function (x) { x = String(x || '').replace(/\s+/g, ' ').trim(); if (x && x.length <= 90) out.push(head ? head + ' — ' + x : x); };
  (sp.items || []).forEach(function (it) { if (it && typeof it === 'object') add(it.title || it.label || (it.value ? it.value + ' ' + (it.label || '') : '')); else add(it); });
  (sp.points || []).forEach(function (p) { add(typeof p === 'string' ? p.split(':')[0] : (p && p.title)); });
  ['left', 'right'].forEach(function (k) { if (sp[k]) (sp[k].points || []).forEach(function (p) { add(typeof p === 'string' ? p : (p && p.title)); }); });
  (sp.columns || []).forEach(function (c) { if (c && typeof c === 'object') (c.items || []).forEach(function (it) { add(it && (it.title || it)); }); });
  (sp.rows || []).forEach(function (r) { if (Array.isArray(r)) add(r[0]); });
  if (!out.length && head) out.push(head);
  return out.slice(0, 8);
}
