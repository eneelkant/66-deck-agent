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
      'A 66degrees proposal deck is being written for this request. Who is the CLIENT the proposal is addressed to?',
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
    ctx.log.push('Client check skipped: ' + e.message);
    return null;
  }
  const name = String((raw && raw.client) || '').replace(/\s+/g, ' ').trim();
  if (!name || raw.confident === false || /^(66 ?degrees|google( cloud)?)$/i.test(name)) return null;
  const domain = String(raw.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return { name: name.slice(0, 60), domain: /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : '' };
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
    if (blob.getBytes().length < (minBytes || 1500)) { LOGO_TRAIL_.push((label || 'image') + ': too small'); return null; }
    return blob;
  } catch (e) { LOGO_TRAIL_.push((label || 'image') + ': ' + e.message); return null; }
}
function fetchJson_(url, label) {
  try {
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Api-User-Agent': '66DeckAgent/1.0 (Google Apps Script add-on)' } });
    if (r.getResponseCode() !== 200) { LOGO_TRAIL_.push(label + ': HTTP ' + r.getResponseCode()); return null; }
    return JSON.parse(r.getContentText());
  } catch (e) { LOGO_TRAIL_.push(label + ': ' + e.message); return null; }
}

// Wikipedia: the page's lead image is the company logo for most companies (the infobox logo)
function wikipediaLogo_(name) {
  const s = fetchJson_('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(name).replace(/ /g, '_')), 'Wikipedia');
  if (!s || s.type === 'disambiguation') { if (s) LOGO_TRAIL_.push('Wikipedia: several pages with this name'); return null; }
  const desc = String(s.description || '') + ' ' + String(s.extract || '').slice(0, 300);
  if (!/compan|corporat|retailer|brand|business|bank|firm|organi[sz]ation|group|chain|manufacturer|provider|airline|university/i.test(desc)) { LOGO_TRAIL_.push('Wikipedia: page is not a company'); return null; }
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
var LOGO_DEV_DEFAULT_TOKEN_ = 'pk_fr2f38609959838aac17b3';
function logoDevLogo_(domain) {
  if (!domain) return null;
  let token = LOGO_DEV_DEFAULT_TOKEN_;
  try { token = PropertiesService.getScriptProperties().getProperty('LOGO_DEV_TOKEN') || token; } catch (e) {}
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
  const inDrive = findDriveLogo_(client.name);
  if (inDrive) return inDrive;
  LOGO_TRAIL_.push('Drive: none');
  if (!client.domain) { client.domain = wikidataDomain_(client.name) || ''; if (client.domain) LOGO_TRAIL_.push('domain from Wikidata: ' + client.domain); }
  let blob = logoDevLogo_(client.domain), source = 'logo.dev';
  if (!blob && !client.domain) {
    // last try: the plain .com of the name ("Home Depot" -> homedepot.com); logo.dev answers 404 when it is not a company
    const guess = String(client.name).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '') + '.com';
    blob = logoDevLogo_(guess);
    if (blob) client.domain = guess;
  }
  if (!blob) { blob = brandfetchLogo_(client.domain); source = 'Brandfetch'; }
  if (!blob) { blob = wikidataLogo_(client.name, client.domain); source = 'the official logo on Wikimedia Commons'; }
  if (!blob) { blob = wikipediaLogo_(client.name); source = 'Wikipedia'; }
  if (!blob && client.domain) { blob = fetchImage_('https://www.google.com/s2/favicons?sz=256&domain=' + encodeURIComponent(client.domain), 2500, 'Website icon'); source = 'the company website icon'; }
  if (!blob && !client.domain) LOGO_TRAIL_.push('Website icon: no domain known');
  if (!blob) return null;
  try {
    const ext = /jpe?g/i.test(blob.getContentType()) ? '.jpg' : '.png';
    const file = clientLogoFolder_().createFile(blob.setName(client.name + ' logo' + ext));
    return { id: file.getId(), source: source + ', saved to Drive' };
  } catch (e) {
    ctx.log.push('Client logo could not be saved to Drive: ' + e.message);
    return null;
  }
}

/* ---------- 3. The proposal frame on every slide ---------- */
// Once per deck: the client and its logo, and the section divider style (dark streaks by default, light 66° watermark
// in about one proposal in three). Kept in the long-deck run state so every part of a long deck matches.
function prepareProposal_(userPrompt, sources, ctx) {
  if (!isProposalDeck_(ctx) || ctx.proposal) return ctx.proposal || null;
  const p = { client: null, logoId: '', sectionStyle: Math.random() < 1 / 3 ? 'light' : 'dark' };
  progressStage_(ctx, 'match', 'active', 'Finding the client and its logo');
  const c = detectClient_(userPrompt, sources, ctx);
  if (c) {
    p.client = c.name;
    const logo = findClientLogo_(c, ctx);
    if (logo) { p.logoId = logo.id; ctx.log.push('Client: ' + c.name + ' (logo from ' + logo.source + ').'); }
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
  if (!ctx.proposal && isProposalDeck_(ctx)) ctx.proposal = { client: null, logoId: '', sectionStyle: 'dark' };
  const p = ctx.proposal;
  if (!p) return;
  (slides || []).forEach(function (sp) {
    if (!sp) return;
    const t = String(sp.type || '').toLowerCase();
    sp.deckLibrary = 'proposal';
    sp.cobrand = !!p.logoId && t !== 'cover' && t !== 'closing';
    if (t === 'cover') sp.clientLogo = !!p.logoId;
    if (t === 'section') sp.sectionStyle = p.sectionStyle;
    if (p.client) restoreName_(sp, p.client);
  });
}

// The client's name keeps its own capitals everywhere ("a proposal for the home depot" -> "The Home Depot")
function restoreName_(o, name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const re = new RegExp('\\b' + words.map(function (w) { return w.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'); }).join('\\s+') + '\\b', 'gi');
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    Object.keys(v).forEach(function (k) {
      if (k === 'reference' || k === 'notes') return;
      if (typeof v[k] === 'string') v[k] = v[k].replace(re, name);
      else if (typeof v[k] === 'object') walk(v[k]);
    });
  })(o);
}

/* ---------- 4. Built-in image: the big light 66° watermark (light section dividers) ---------- */
var WATERMARK_66_PNG_ = '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';
function inlineAssetBlob_(asset) {
  if (asset === 'watermark-66') return Utilities.newBlob(Utilities.base64Decode(WATERMARK_66_PNG_), 'image/png', 'watermark-66.png');
  return null;
}
