/**
 * Brand kit, Gemini client, Drive/source helpers, storage and color utilities.
 * Shared by Code.gs, Rebrand.gs and EngineRenderer.gs.
 */

// Fallback brand = the 2026 template values (spec Part 5). When the reference library loads,
// libraryBrandProfile() (Reference.gs) supplies the same values from the library itself.
// 66degrees Brand Guidelines (2026): 4 main colors + 4 neutral tones. Nothing else is used on slides.
var BRAND_COLORS = {
  white: '#FFFDF9',      // 66° White - natural paper; primary background
  nightBlue: '#040A1B',  // Night Blue - the brand's alternative to black: all text, dark slides
  sharkGrey: '#B3C5D0',  // Shark Grey - support color
  blue: '#0052FF',       // 66° Blue - accent, used sparingly (numbers, highlights, bands)
  neutral1: '#F3F2F0',   // Cool Gray 1XGC - panels and cards
  neutral2: '#ECECEC',   // Cool Gray 2XGC - callouts, secondary panels
  neutral3: '#E2E4E7',   // Cool Gray 3XGC
  neutral4: '#DBDDE1'    // Cool Gray 4XGC - lines and outlines
};

var BRAND_ICON_STYLES = ['night-blue', 'white', 'accent-blue'];
var BRAND_ICON_COLOR_BY_STYLE = {
  'night-blue': '#040A1B',
  night_blue: '#040A1B',
  white: '#FFFDF9',
  'accent-blue': '#0052FF',
  accent_blue: '#0052FF'
};

function validateBrandIconManifest_(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest missing'] };
  if (manifest.brand !== '66degrees') errors.push('brand must be 66degrees');
  const styles = manifest.styles || [];
  BRAND_ICON_STYLES.forEach(function (s) {
    if (styles.indexOf(s) === -1) errors.push('missing style ' + s);
  });
  const icons = manifest.icons || [];
  if (!icons.length) errors.push('no icons listed');
  icons.forEach(function (ic) {
    if (!ic.id) errors.push('icon missing id');
    if (!Array.isArray(ic.tags) || !ic.tags.length) errors.push((ic.id || '?') + ' missing tags');
    if (!ic.files || typeof ic.files !== 'object') {
      errors.push((ic.id || '?') + ' missing files');
      return;
    }
    ['night_blue', 'white', 'accent_blue'].forEach(function (k) {
      const p = ic.files[k];
      if (!p) errors.push(ic.id + ' missing ' + k);
      else if (String(p).indexOf('assets/icons/') !== 0) errors.push(ic.id + ' ' + k + ' path must be under assets/icons/');
    });
  });
  return { ok: errors.length === 0, errors: errors };
}

function brandIconColorForStyle_(style) {
  return BRAND_ICON_COLOR_BY_STYLE[style] || '';
}

function svgUsesBrandColor_(svg, hex) {
  return String(svg || '').toUpperCase().indexOf(String(hex || '').toUpperCase()) !== -1;
}

function isUsableIconSvg_(svg) {
  const s = String(svg || '');
  return /<svg[\s>]/i.test(s) && /viewBox=/i.test(s) && /stroke=/i.test(s) && /<\/svg>/i.test(s);
}

var DEFAULT_BRAND = {
  name: '66degrees',
  palette: ['#FFFDF9', '#040A1B', '#B3C5D0', '#0052FF', '#F3F2F0', '#ECECEC', '#E2E4E7', '#DBDDE1'],
  roles: {
    background: '#FFFDF9',       // 66° White
    dark_background: '#040A1B',  // Night Blue
    text: '#040A1B',             // Night Blue (never pure black)
    text_on_dark: '#FFFDF9',
    accent: '#0052FF',           // 66° Blue
    muted: '#B3C5D0',            // Shark Grey
    panel: '#F3F2F0'             // neutral tone
  },
  fonts: {
    heading: { name: 'Saans', slides: 'Plus Jakarta Sans' },
    body: { name: 'Saans', slides: 'Plus Jakarta Sans' },
    mono: { name: 'MD IO', slides: 'IBM Plex Mono' }
  },
  rules: [
    'Tone: clear, straightforward and professional. Make complex topics easy to grasp. No jargon, no hype.',
    'Use active voice and give the reader value on every slide.',
    'Be confident but never overpromise; keep claims realistic and specific.',
    'Headlines in sentence case. Never set headlines in ALL CAPS.',
    'Short mono eyebrow labels above titles may be uppercase (e.g. THE CHALLENGE).',
    'Keep slide text free of design instructions: no color codes, font names or layout notes in titles or body text.'
  ]
};

// Licensed brand fonts are not available in Google Slides; use these Google Fonts stand-ins.
const FONT_SUBSTITUTES = {
  'saans': 'Plus Jakarta Sans',
  'md io': 'IBM Plex Mono',
  'mdio': 'IBM Plex Mono'
};

const APPROVED_FACTS = [
  '66degrees is Google\'s Preferred Partner for Enterprise AI Transformation.',
  'Gemini Enterprise: Google\'s preferred Premium partner, delivering more than 25% of all Agentic AI work on Gemini Enterprise.',
  '350+ technical experts across AI/ML, application development, cloud engineering, data analytics, solution consulting and managed cloud operations.',
  '600+ Google/GCP certifications across AI, ML, cloud engineering, DevOps and Workspace administration.',
  '1000+ successful cloud, data and AI transformation projects delivered for enterprise brands.',
  // Template conflict: slide 8 says 575+, slide 10 says 600+. 600+ is recommended (slide 10 is the later revision) — confirm.
  'Global delivery footprint of 600+ experts across North America, UK/EMEA, Costa Rica, Brazil and India.',
  'Google Cloud Partner of the Year awards: 2026 (Artificial Intelligence, North America), 2025 (North America), 2024 (Expansion, North America).',
  'Credentials: Google Cloud Premier Partner; Google Cloud Diamond Services Partner; Google Workspace Diamond Co-sell & Services Partner; Managed Service Provider; Gen AI Service Partner.',
  'Specializations: Infrastructure, Cloud Migration, Data Analytics, Machine Learning, DevOps, Work Transformation Enterprise.',
  'Delivery approach: Technical Expertise, High Executive Touch, Solution Mindset, Flexible and Agile, End-to-End Capabilities.',
  'Service model: Modernize (data & infrastructure for AI) -> Build (AI platforms & applications) -> Manage & Scale (AI applications & platforms).',
  'Core values: Obsess Over our Clients; Commit to our Craft; Win Together; Be Resilient and Adaptable; Thrive through Challenge.',
  'Proof point (retail/e-commerce, data platform modernization): $3M+ annual savings moving the first wave of MSSQL databases to Cloud SQL.',
  'Proof point (manufacturing & distribution, analytics): $10M+ annual savings from cloud data migration and modern analytics; tools used by 11+ functions and ~20,000 employees.',
  'Proof point (commercial real estate, GenAI): estimating process reduced 50%+ with a GenAI chatbot over legacy SharePoint contracts.',
  'Proof point (retail, managed services): outages down 45%+, response times cut to 15 minutes with Cloud Evolve managed services.',
  'Proof point (EDW on GCP): 40% reduction in operating costs; 36% of data accuracy issues resolved through data unification.',
  'Proof point (app modernization): 500+ legacy apps migrated to GKE and 200+ SQL databases to Cloud SQL; $3M+ annual gross savings, plus $7M+ more via self-service automation tooling.',
  'Proof point (contact center QA with Gemini): call reviews up from 4% to 100%; CSAT up 5 points.',
  'Proof point (resort AI assistant): 50–70% of customer touchpoints automated; 20% boost in customer satisfaction; rolled out across 40+ resorts.',
  'Proof point (migration factory + managed SRE): $10M annual savings; 35% reduction in troubleshooting time.',
  'Proof point (AI managed services): 90% reduction in contract review time; 30% productivity improvement in service desk operations.'
];

var PRESENTATION_TYPES = [
  'Pitch',
  'Strategy',
  'Proposal',
  'Sales',
  'Case Study',
  'Report',
  'Custom'
];

var TYPE_GUIDANCE = {
  Pitch: 'Investor or client pitch: problem, solution, proof, offer and a clear next step.',
  Strategy: 'Current state, strategic options, recommended path, roadmap, priorities and KPIs.',
  Proposal: 'Client need, proposed approach, deliverables, commercial shape and why 66degrees.',
  Sales: 'Customer problem, the 66degrees solution, how we deliver, proof points, value, and a clear next step.',
  'Case Study': 'Challenge, approach, outcomes, proof points and what the result means for the audience.',
  Report: 'Findings, evidence, implications and recommended actions.',
  Custom: 'Follow the structure implied by the request.',
  // Legacy V.1_17 labels still accepted by normalizePresentationType_.
  'Business Presentation': 'Balanced business narrative: context, approach, outcomes and next steps.',
  'Marketing Presentation': 'Market insight, positioning, campaigns and channels, and measurable results.',
  'Strategy Presentation': 'Current state, strategic options, recommended path, roadmap, priorities and KPIs.',
  'Sales Presentation': 'Customer problem, the 66degrees solution, how we deliver, proof points, value, and a clear next step.',
  'Executive Presentation': 'Outcome-first and concise: headline numbers, decisions needed, short supporting points.'
};

var DEPARTMENTS = [
  'Sales',
  'Marketing',
  'Technology',
  'Finance',
  'Operations',
  'HR',
  'Leadership',
  'Other'
];

var DEPARTMENT_GUIDANCE = {
  Sales: 'Write for a sales audience: customer problem, qualification, offer, proof and a commercial next step.',
  Marketing: 'Write for marketing: audience, message, channels, campaigns and measurement.',
  Technology: 'Write for technical readers: architecture, delivery, risk, operations and outcomes.',
  Finance: 'Write for finance: cost, ROI, risk, controls and measurable impact.',
  Operations: 'Write for operations: process, capacity, delivery, reliability and improvement.',
  HR: 'Write for people/HR: talent, change, enablement, adoption and culture.',
  Leadership: 'Write for executives: the decision needed, headline outcomes and short supporting proof.',
  Other: 'Write for a mixed internal audience; keep language clear without assuming a function.'
};

var DEFAULT_VERTEX_LOCATION = 'us-central1';
var DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';

/* =========================
   DRIVE ACCESS (Apps Script built-ins only)
   Never call https://www.googleapis.com/drive via UrlFetchApp.
   That path attempts to enable the Drive API on the script's GCP project at
   runtime and fails for ordinary end users with:
   "Permission denied while enabling APIs: drive for GCP project …"
========================= */

function isDriveApiEnablementError_(err) {
  const msg = String(err && err.message ? err.message : err || '');
  return /Permission denied while enabling APIs:\s*drive/i.test(msg) ||
    (/enable(?:ing)? APIs/i.test(msg) && /\bdrive\b/i.test(msg));
}

function sanitizeDriveError_(err) {
  const msg = String(err && err.message ? err.message : err || 'Drive unavailable');
  if (isDriveApiEnablementError_(msg)) {
    return 'Google Drive access is unavailable in this Apps Script project (Drive REST API was not used). Try again, or use a PDF / Google Docs link instead of an Office upload.';
  }
  return msg;
}

function emptyAssetIndex_() {
  return { icons: {}, gcp: {}, images: [], logos: {}, patterns: {}, design: {}, doneFolders: [], savedAt: Date.now(), partial: true, filesSeen: 0 };
}

function driveFileById_(id) {
  return DriveApp.getFileById(id);
}

function trashDriveFileById_(id) {
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
}

function exportDriveFileAsText_(file) {
  const mime = file.getMimeType();
  if (/^text\//.test(mime) || mime === 'application/json' || mime === 'application/xml') {
    return file.getBlob().getDataAsString();
  }
  // Prefer SlidesApp for decks (already authorized via presentations scope).
  if (mime === 'application/vnd.google-apps.presentation') {
    try { return readDeckText(SlidesApp.openById(file.getId())); } catch (e0) {}
  }
  // DriveApp.getAs converts Google Docs/Sheets/Slides without Drive REST / API enablement.
  if (mime === 'application/vnd.google-apps.spreadsheet') {
    try { return file.getAs(MimeType.CSV).getDataAsString(); } catch (e1) {}
  }
  try { return file.getAs(MimeType.PLAIN_TEXT).getDataAsString(); } catch (e2) {}
  throw new Error('Could not read text from "' + file.getName() + '" (' + mime + ').');
}

function exportDriveFileAsPdfBytes_(file) {
  const mime = file.getMimeType();
  if (mime === 'application/pdf') return file.getBlob().getBytes();
  try { return file.getAs(MimeType.PDF).getBytes(); } catch (e) {
    throw new Error('Could not export "' + file.getName() + '" as PDF: ' + sanitizeDriveError_(e));
  }
}

function getScriptProperty_(key) {
  try { return PropertiesService.getScriptProperties().getProperty(key) || ''; }
  catch (e) { return ''; }
}

function getVertexConfig_() {
  return {
    projectId: String(getScriptProperty_('VERTEX_PROJECT_ID') || '').trim(),
    location: String(getScriptProperty_('VERTEX_LOCATION') || '').trim() || DEFAULT_VERTEX_LOCATION,
    model: String(getScriptProperty_('VERTEX_MODEL') || '').trim() || DEFAULT_VERTEX_MODEL
  };
}

function isVertexConfigured_() {
  return !!getVertexConfig_().projectId;
}

function requireVertexConfig_() {
  const config = getVertexConfig_();
  if (!config.projectId) {
    throw new Error(
      'VERTEX_PROJECT_ID is not configured. Link this Apps Script project to Google Cloud, enable the Vertex AI API, and set VERTEX_PROJECT_ID in Script properties.'
    );
  }
  return config;
}

function buildVertexEndpoint_(config, modelOverride) {
  config = config || getVertexConfig_();
  var projectId = encodeURIComponent(config.projectId);
  var location = String(config.location || DEFAULT_VERTEX_LOCATION);
  var model = encodeURIComponent(modelOverride || config.model || DEFAULT_VERTEX_MODEL);
  var locationPath = encodeURIComponent(location);
  var resource = '/v1/projects/' + projectId + '/locations/' + locationPath +
    '/publishers/google/models/' + model + ':generateContent';
  if (location.toLowerCase() === 'global') return 'https://aiplatform.googleapis.com' + resource;
  return 'https://' + location + '-aiplatform.googleapis.com' + resource;
}

function vertexAuthHeaders_() {
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
}

function generateContentUrl_(model) {
  return buildVertexEndpoint_(requireVertexConfig_(), model);
}

function generateContentHeaders_() {
  return vertexAuthHeaders_();
}

function describeVertexHttpError_(code, body, result) {
  const msg = String((result && result.error && result.error.message) || body || '');
  const hay = msg + ' ' + String(body || '');
  if (/SERVICE_DISABLED|has not been used|API has not been used|is not enabled|aiplatform\.googleapis\.com is disabled/i.test(hay)) {
    return 'Vertex AI API is not enabled for the linked Google Cloud project.';
  }
  if (code === 401 || code === 403) {
    return 'Vertex AI authentication failed (HTTP ' + code + '). Grant Vertex AI User on the linked Cloud project and re-authorize the add-on.';
  }
  if (code === 429) {
    return 'Vertex AI quota exceeded (HTTP 429).';
  }
  return 'Vertex AI HTTP ' + code + ': ' + msg.slice(0, 300);
}

function callVertexGemini_(requestBody, opts) {
  opts = opts || {};
  const config = requireVertexConfig_();
  const model = opts.model || config.model;
  const endpoint = buildVertexEndpoint_(config, model);
  var response;
  try {
    response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: vertexAuthHeaders_(),
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });
  } catch (e) {
    throw new Error('Vertex AI request failed: ' + e.message);
  }
  const code = response.getResponseCode();
  const body = response.getContentText();
  var result = {};
  try { result = JSON.parse(body); } catch (e1) { result = {}; }
  if (code < 200 || code >= 300 || result.error) {
    throw new Error(describeVertexHttpError_(code, body, result));
  }
  return { code: code, result: result, model: model };
}

function getApiKey() {
  requireVertexConfig_();
  return 'vertex';
}

// Ordered list of Vertex publisher models to try.
function modelCandidates(apiKey, kind) {
  const props = PropertiesService.getScriptProperties();
  const cacheKey = 'model_candidates_' + kind + (CONFIG.preferProModel ? '_pro' : '');
  let list = null;
  try { list = JSON.parse(props.getProperty(cacheKey) || 'null'); } catch (e) {}

  if (!list || !list.length) {
    const vc = getVertexConfig_();
    const fallback = kind === 'image' ? ['gemini-2.5-flash-image'] : [vc.model || DEFAULT_VERTEX_MODEL, 'gemini-2.5-flash'];
    list = fallback.filter(function (n, i) { return fallback.indexOf(n) === i; });
    try { props.setProperty(cacheKey, JSON.stringify(list)); } catch (e2) {}
  }

  const wanted = kind === 'image' ? CONFIG.imageModel : CONFIG.model;
  if (wanted && wanted !== 'auto') list = [wanted].concat(list.filter(function (n) { return n !== wanted; }));
  return list;
}

function resolveModel(apiKey, kind) {
  return modelCandidates(apiKey, kind)[0];
}

function isRetryable(code, message) {
  return code === 429 || code === 500 || code === 502 || code === 503 || code === 504 ||
    /high demand|overloaded|unavailable|try again|resource.?exhausted|deadline/i.test(message || '');
}

function callGeminiJSON(parts, apiKey, temperature) {
  requireVertexConfig_();
  const models = modelCandidates(apiKey, 'text').slice(0, 4);
  const payload = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: temperature === undefined ? 0.4 : temperature }
  };
  const waits = [2000, 6000];
  const started = Date.now();
  let lastError = 'Vertex AI did not respond.';

  for (let m = 0; m < models.length; m++) {
    for (let attempt = 0; attempt <= waits.length; attempt++) {
      if (Date.now() - started > 150000) break;

      let result = null;
      try {
        result = callVertexGemini_(payload, { model: models[m] }).result;
      } catch (e) {
        lastError = e.message;
        if (/not enabled|VERTEX_PROJECT_ID is not configured|authentication failed/i.test(lastError)) throw e;
        if (isRetryable(0, lastError) && attempt < waits.length) { Utilities.sleep(waits[attempt]); continue; }
        if (/not found|not supported/i.test(lastError)) break;
        if (attempt < waits.length) { Utilities.sleep(waits[attempt]); continue; }
        break;
      }

      const cand = result && result.candidates && result.candidates[0];
      if (!cand || !cand.content || !cand.content.parts) {
        lastError = 'Vertex AI returned no content' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.';
        if (attempt < waits.length) { Utilities.sleep(waits[attempt]); continue; }
        break;
      }

      const raw = cand.content.parts
        .map(function (p) { return p.text || ''; })
        .join('')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      try {
        return JSON.parse(raw);
      } catch (e) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) {
          try { return JSON.parse(raw.slice(start, end + 1)); } catch (e2) {}
        }
        lastError = 'Vertex AI returned invalid JSON.';
        if (attempt < waits.length) continue;
        break;
      }
    }
  }
  throw new Error('Vertex AI is busy right now (' + lastError + ') Tried: ' + models.join(', ') + '. Please try again in a minute.');
}

function generateIconImage(description, dark, ctx) {
  if (ctx.generatedIcons >= CONFIG.maxGeneratedIconsPerRun) return null;
  ctx.generatedIcons++;

  const stroke = dark ? ctx.brand.roles.text_on_dark : ctx.brand.roles.accent;
  const bg = dark ? ctx.brand.roles.dark_background : ctx.brand.roles.background;
  const prompt = 'A single minimal line icon representing: ' + description + '. ' +
    'Outline style with uniform medium stroke weight and rounded line ends, like a professional corporate icon set. ' +
    'Stroke color ' + stroke + ' only, on a flat solid ' + bg + ' background. Centered, square 1:1, generous padding, ' +
    'no text, no shading, no gradients, no 3D.';

  try {
    const fetched = callVertexGemini_({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] }
    }, { model: resolveModel(ctx.apiKey, 'image') });
    const result = fetched.result;
    const parts = (result.candidates && result.candidates[0] && result.candidates[0].content &&
      result.candidates[0].content.parts) || [];
    for (let i = 0; i < parts.length; i++) {
      const inline = parts[i].inlineData || parts[i].inline_data;
      if (inline && inline.data) {
        const mime = inline.mimeType || inline.mime_type || 'image/png';
        return Utilities.newBlob(Utilities.base64Decode(inline.data), mime, 'icon.png');
      }
    }
  } catch (e) {
    Logger.log('Icon generation failed: ' + e.message);
  }
  return null;
}

function readSourceDocument(url, sources) {
  const m = url.match(/[-\w]{25,}/);
  if (!m) throw new Error('Could not read a Google Drive file ID from the source link.');
  const id = m[0];
  let file;
  try { file = driveFileById_(id); } catch (e) {
    throw new Error('Cannot open the source document. ' + sanitizeDriveError_(e));
  }
  const mime = file.getMimeType();

  if (mime === 'application/pdf') {
    const blob = file.getBlob();
    if (blob.getBytes().length > 18 * 1024 * 1024) throw new Error('The source PDF is larger than 18 MB.');
    sources.pdfs.push(Utilities.base64Encode(blob.getBytes()));
    return;
  }

  let text = '';
  try {
    text = exportDriveFileAsText_(file);
  } catch (e) {
    throw new Error('Could not read the source document. Use a Google Doc, Google Slides, Google Sheet, PDF or text file. ' + sanitizeDriveError_(e));
  }

  sources.text += (sources.text ? '\n\n' : '') + 'SOURCE DOCUMENT "' + file.getName() + '":\n' + text.slice(0, CONFIG.maxSourceChars);
}

function readDeckText(pres) {
  const out = [];
  pres.getSlides().forEach(function (slide, i) {
    const lines = [];
    const walk = function (elements) {
      elements.forEach(function (el) {
        try {
          const t = el.getPageElementType();
          if (t === SlidesApp.PageElementType.GROUP) walk(el.asGroup().getChildren());
          else if (t === SlidesApp.PageElementType.SHAPE) {
            const sh = el.asShape();
            if (typeof hasTextFrame_ === 'function' && !hasTextFrame_(sh)) return;
            const s = sh.getText().asString().trim();
            if (s) lines.push(s);
          } else if (t === SlidesApp.PageElementType.TABLE) {
            const tb = el.asTable();
            for (let r = 0; r < tb.getNumRows(); r++) {
              const row = [];
              for (let c = 0; c < tb.getNumColumns(); c++) {
                try { row.push(tb.getCell(r, c).getText().asString().trim()); } catch (e) {}
              }
              lines.push(row.join(' | '));
            }
          }
        } catch (e) {}
      });
    };
    walk(slide.getPageElements());
    let notes = '';
    try { notes = slide.getNotesPage().getSpeakerNotesShape().getText().asString().trim(); } catch (e) {}
    out.push('--- Slide ' + (i + 1) + ' ---\n' + lines.join('\n') + (notes ? '\n[Notes] ' + notes : ''));
  });
  return out.join('\n\n').slice(0, CONFIG.maxSourceChars);
}

function isBlankDeck(slides) {
  if (slides.length !== 1) return false;
  const els = slides[0].getPageElements();
  for (let i = 0; i < els.length; i++) {
    try {
      if (els[i].getPageElementType() !== SlidesApp.PageElementType.SHAPE) return false;
      const sh = els[i].asShape();
      if (typeof hasTextFrame_ === 'function' && !hasTextFrame_(sh)) continue;
      if (sh.getText().asString().trim()) return false;
    } catch (e) {}
  }
  return true;
}

function getBrandProfile(apiKey, forceRefresh) {
  // The 2026 template (reference library) is the primary source for colors, fonts and rules.
  const lib = loadReferenceLibrary(false);
  let profile = forceRefresh ? null : readStore('brand');
  if (!profile) {
    profile = JSON.parse(JSON.stringify(DEFAULT_BRAND));
    try {
      // With the library loaded, the (slow) Gemini read of the guideline PDFs is skipped: only font names come from Drive.
      profile = buildBrandProfileFromFolder(lib ? null : apiKey);
    } catch (e) {
      Logger.log('Brand profile extraction failed, using defaults: ' + e.message);
    }
    writeStore('brand', profile);
  }
  return lib ? libraryBrandProfile(lib, profile) : profile;
}

function buildBrandProfileFromFolder(apiKey) {
  const profile = JSON.parse(JSON.stringify(DEFAULT_BRAND));
  const root = DriveApp.getFolderById(CONFIG.brandFolderId);

  // Font names from the fonts folder (e.g. "Saans - Displaay Type Foundry.zip" -> "Saans")
  const fontsFolder = findSubfolder(root, /font/i, 3);
  const fontNames = [];
  if (fontsFolder) {
    const files = fontsFolder.getFiles();
    while (files.hasNext()) {
      const n = files.next().getName().replace(/\.(zip|otf|ttf|woff2?)$/i, '');
      const base = n.split(' - ')[0].replace(/[-_](regular|medium|semibold|bold|light|italic).*$/i, '').trim();
      if (base && fontNames.indexOf(base) === -1) fontNames.push(base);
    }
  }
  const monoName = fontNames.filter(function (n) { return /mono|md ?io|code/i.test(n); })[0];
  const sansName = fontNames.filter(function (n) { return !/mono|md ?io|code/i.test(n); })[0];
  if (sansName) {
    profile.fonts.heading = { name: sansName, slides: substituteFont(sansName, profile.fonts.heading.slides) };
    profile.fonts.body = { name: sansName, slides: substituteFont(sansName, profile.fonts.body.slides) };
  }
  if (monoName) profile.fonts.mono = { name: monoName, slides: substituteFont(monoName, profile.fonts.mono.slides) };

  // Guidelines documents -> Gemini -> colors, roles, rules
  if (!apiKey) return profile;
  const guideFolder = findSubfolder(root, /guideline/i, 3);
  if (!guideFolder) return profile;

  const parts = [];
  const files = guideFolder.getFiles();
  while (files.hasNext() && parts.length < 3) {
    const f = files.next();
    const mime = f.getMimeType();
    try {
      let bytes = null;
      try {
        if (mime === 'application/pdf' ||
            mime === 'application/vnd.google-apps.document' ||
            mime === 'application/vnd.google-apps.presentation') {
          bytes = exportDriveFileAsPdfBytes_(f);
        }
      } catch (ePdf) {
        Logger.log('Guideline export skipped for ' + f.getName() + ': ' + ePdf.message);
      }
      if (bytes && bytes.length < 18 * 1024 * 1024) {
        parts.push({ inline_data: { mime_type: 'application/pdf', data: Utilities.base64Encode(bytes) } });
      }
    } catch (e) {}
  }
  if (!parts.length) return profile;

  parts.unshift({
    text: 'Read these brand guidelines and return ONLY JSON:\n' +
      '{ "brand_name": "", "colors": [{"name": "", "hex": "#RRGGBB"}], ' +
      '"roles": {"background": "#", "dark_background": "#", "text": "#", "text_on_dark": "#", "accent": "#", "muted": "#", "panel": "#"}, ' +
      '"fonts": {"heading": null, "body": null, "mono": null}, "rules": [] }\n' +
      'colors: every brand color with its exact HEX (main colors first, then neutrals). ' +
      'roles: which brand HEX to use for each role in a presentation. ' +
      'fonts: typeface names only if stated, else null. ' +
      'rules: up to 8 short, practical rules for writing and designing slides that follow from the guidelines. ' +
      'Use null for anything not stated. Do not invent values.'
  });

  const g = callGeminiJSON(parts, apiKey, 0.1);
  const isHex = function (h) { return typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h.trim()); };

  if (g && Array.isArray(g.colors)) {
    const palette = g.colors.map(function (c) { return c && c.hex; }).filter(isHex).map(function (h) { return h.trim().toUpperCase(); });
    if (palette.length >= 3) profile.palette = palette.filter(function (h, i) { return palette.indexOf(h) === i; });
  }
  if (g && g.roles) {
    Object.keys(profile.roles).forEach(function (k) { if (isHex(g.roles[k])) profile.roles[k] = g.roles[k].trim().toUpperCase(); });
  }
  if (g && g.fonts) {
    ['heading', 'body', 'mono'].forEach(function (k) {
      if (g.fonts[k] && typeof g.fonts[k] === 'string' && !fontNames.length) {
        profile.fonts[k] = { name: g.fonts[k], slides: substituteFont(g.fonts[k], profile.fonts[k].slides) };
      }
    });
  }
  if (g && Array.isArray(g.rules) && g.rules.length >= 3) {
    const extra = g.rules.filter(function (r) { return typeof r === 'string' && r.trim(); }).slice(0, 8);
    // Keep the voice rules from DEFAULT_BRAND, add what the folder's guidelines say
    profile.rules = DEFAULT_BRAND.rules.concat(extra);
  }
  if (g && g.brand_name) profile.name = String(g.brand_name);
  if (!/66degrees/i.test(profile.name)) profile.name = '66degrees';

  // Every role color must be in the palette so snapping keeps them
  Object.keys(profile.roles).forEach(function (k) {
    if (profile.palette.indexOf(profile.roles[k]) === -1) profile.palette.push(profile.roles[k]);
  });
  return profile;
}

function substituteFont(name, fallback) {
  const key = String(name || '').toLowerCase().trim();
  return FONT_SUBSTITUTES[key] || (key ? name : fallback);
}

function getAssetIndex(forceRefresh) {
  const stored = readStore('assets');
  if (!forceRefresh) {
    if (stored && stored.savedAt && !stored.partial && (Date.now() - stored.savedAt) < CONFIG.assetIndexMaxAgeHours * 3600 * 1000) return stored;
    // An older or partial index is still better than a slow rescan inside a generation run
    if (stored && stored.savedAt) return stored;
  }
  try {
    const resume = forceRefresh && stored && stored.partial ? stored : null;
    const index = buildAssetIndex(resume);
    index.savedAt = Date.now();
    writeStore('assets', index);
    return index;
  } catch (e) {
    // Brand-folder scans must never abort Create/Research (e.g. Drive enablement errors).
    Logger.log('Asset index unavailable: ' + e.message);
    if (stored) return stored;
    return emptyAssetIndex_();
  }
}

// Walks the Drive brand folder for icons, logos, patterns and design images.
// Time-guarded: stops after ~4.5 minutes and marks the index partial; the next "Refresh brand assets" resumes,
// skipping the folders already finished.
function buildAssetIndex(resume) {
  const started = Date.now();
  const budgetMs = 270000;
  const index = resume
    ? { icons: resume.icons || {}, gcp: resume.gcp || {}, images: resume.images || [], logos: resume.logos || {}, patterns: resume.patterns || {}, design: resume.design || {}, doneFolders: resume.doneFolders || [] }
    : { icons: {}, gcp: {}, images: [], logos: {}, patterns: {}, design: {}, doneFolders: [] };
  const priority = {};
  const root = DriveApp.getFolderById(CONFIG.brandFolderId);
  let filesSeen = 0, stopped = false;
  const skipFolder = /font|guideline|reference thumbnails/i;   // no images the generator uses

  const walk = function (folder, path, depth) {
    if (depth > 8 || stopped) return;
    const fid = folder.getId();
    if (index.doneFolders.indexOf(fid) !== -1) return;
    const p = path.toLowerCase();

    const files = folder.getFiles();
    while (files.hasNext()) {
      if (Date.now() - started > budgetMs) { stopped = true; return; }
      const f = files.next();
      filesSeen++;
      const mime = f.getMimeType();
      if (mime !== 'image/png' && mime !== 'image/jpeg') continue;
      const name = f.getName();

      if (/^ds-/i.test(name) || /\/design(\/|$)/.test(p)) {   // iPAY design images (03_Images/Design)
        index.design[normalizeName(name)] = f.getId();
        continue;
      }

      if (/pattern/.test(p) || /^pattern/i.test(name)) {
        index.patterns[normalizeName(name)] = f.getId();
        continue;
      }

      if (/logo/.test(p) && !/icon/.test(p)) {
        if (/white/i.test(name)) index.logos.light = index.logos.light || f.getId();
        else index.logos.dark = index.logos.dark || f.getId();
        continue;
      }
      if (/favicon|award|service cards|products & services|productcard/.test(p)) continue;

      if (/google cloud icons|user & device input/.test(p)) {
        const key = /google cloud icons/.test(p) ? normalizeName(folder.getName()) : normalizeName(name);
        if (key && !index.gcp[key]) index.gcp[key] = f.getId();
        continue;
      }

      if (/website/.test(p)) continue; // "2024 Website Icons" are duplicates; some white icons sit in non-white folders

      if (/icon/.test(p)) {
        const key = normalizeName(name);
        if (!key) continue;
        const variant = /white/.test(p) || /white/i.test(name) ? 'white' : 'blue';
        const rank = /website/.test(p) ? 1 : 2;
        const pk = key + '|' + variant;
        if (!priority[pk] || rank > priority[pk]) {
          index.icons[key] = index.icons[key] || {};
          index.icons[key][variant] = f.getId();
          priority[pk] = rank;
        }
        continue;
      }

      if (/image|photo|picture/.test(p)) {
        index.images.push({ name: name.replace(/\.[^.]+$/, ''), id: f.getId() });
      }
    }

    const subs = folder.getFolders();
    while (subs.hasNext() && !stopped) {
      const s = subs.next();
      if (skipFolder.test(s.getName())) continue;
      walk(s, path + '/' + s.getName(), depth + 1);
    }
    if (!stopped) index.doneFolders.push(fid);
  };

  walk(root, root.getName(), 0);
  index.partial = stopped;
  index.filesSeen = filesSeen;
  if (!stopped) delete index.doneFolders;
  Logger.log('Asset scan: ' + filesSeen + ' files in ' + Math.round((Date.now() - started) / 1000) + 's' + (stopped ? ' (partial)' : ''));
  return index;
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/^copy of\s+/, '')
    .replace(/\s+copy$/, '')
    .replace(/[_\s]+\d+$/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function findSubfolder(folder, pattern, depth) {
  if (depth < 0) return null;
  const subs = folder.getFolders();
  const queue = [];
  while (subs.hasNext()) {
    const s = subs.next();
    if (pattern.test(s.getName())) return s;
    queue.push(s);
  }
  for (let i = 0; i < queue.length; i++) {
    const found = findSubfolder(queue[i], pattern, depth - 1);
    if (found) return found;
  }
  return null;
}

function findBrandIcon(name, icons, used) {
  const key = normalizeName(name);
  if (icons[key] && !used[key]) return { name: key, entry: icons[key] };
  if (icons[key]) return { name: key, entry: icons[key] };

  // Fuzzy: best token overlap
  const tokens = key.split('-').filter(function (t) { return t.length > 1; });
  if (!tokens.length) return null;
  let best = null;
  Object.keys(icons).forEach(function (n) {
    if (used[n]) return;
    const nt = n.split('-');
    let common = 0;
    tokens.forEach(function (t) { if (nt.indexOf(t) !== -1) common++; });
    const score = common / Math.max(tokens.length, nt.length);
    if (score > 0 && (!best || score > best.score)) best = { name: n, score: score };
  });
  return best && best.score >= 0.5 ? { name: best.name, entry: icons[best.name] } : null;
}

function getBlobCached(id, ctx) {
  if (!ctx.blobCache[id]) ctx.blobCache[id] = DriveApp.getFileById(id).getBlob();
  return ctx.blobCache[id];
}

function normalizeMaterial(name) {
  return String(name || '').trim().toLowerCase().replace(/^material:/, '').replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function writeCache(key, obj) {
  try {
    const cache = CacheService.getScriptCache();
    clearCache(key);
    const json = JSON.stringify(obj);
    const size = 90000;
    const chunks = {};
    let n = 0;
    for (let i = 0; i < json.length; i += size) {
      chunks['cache_' + key + '_' + n] = json.slice(i, i + size);
      n++;
    }
    chunks['cache_' + key + '_n'] = String(n);
    cache.putAll(chunks, 21600);
  } catch (e) {
    Logger.log('Cache write failed: ' + e.message);
  }
}

function readCache(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('cache_' + key + '_n'));
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push('cache_' + key + '_' + i);
    const parts = cache.getAll(keys);
    let json = '';
    for (let i = 0; i < n; i++) {
      const part = parts['cache_' + key + '_' + i];
      if (part === undefined || part === null) return null;
      json += part;
    }
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function clearCache(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('cache_' + key + '_n')) || 0;
    const keys = ['cache_' + key + '_n'];
    for (let i = 0; i < n; i++) keys.push('cache_' + key + '_' + i);
    cache.removeAll(keys);
  } catch (e) {}
}

function writeStore(key, obj) {
  const props = PropertiesService.getScriptProperties();
  clearStore(key);
  const json = JSON.stringify(obj);
  const size = 8500;
  const chunks = {};
  let n = 0;
  for (let i = 0; i < json.length; i += size) {
    chunks['store_' + key + '_' + n] = json.slice(i, i + size);
    n++;
  }
  chunks['store_' + key + '_n'] = String(n);
  props.setProperties(chunks, false);
}

function readStore(key) {
  try {
    const all = PropertiesService.getScriptProperties().getProperties();
    const n = Number(all['store_' + key + '_n']);
    if (!n) return null;
    let json = '';
    for (let i = 0; i < n; i++) {
      const part = all['store_' + key + '_' + i];
      if (part === undefined) return null;
      json += part;
    }
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function clearStore(key) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('store_' + key + '_') === 0) props.deleteProperty(k);
  });
}

function solidRgb(fill) {
  if (!fill || !fill.solidFill || !fill.solidFill.color || !fill.solidFill.color.rgbColor) return null;
  if (fill.propertyState && fill.propertyState !== 'RENDERED') return null;
  return fill.solidFill.color.rgbColor;
}

function rgbObjToHex(c) {
  const to = function (v) { return ('0' + Math.round((v || 0) * 255).toString(16)).slice(-2); };
  return ('#' + to(c.red) + to(c.green) + to(c.blue)).toUpperCase();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

function apiColor(hex) {
  const c = hexToRgb(hex);
  return { rgbColor: { red: c[0] / 255, green: c[1] / 255, blue: c[2] / 255 } };
}

function luminance(hex) {
  const c = hexToRgb(hex).map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function runBatches(presId, requests, stats) {
  const size = 400;
  for (let i = 0; i < requests.length; i += size) {
    const chunk = requests.slice(i, i + size);
    try {
      Slides.Presentations.batchUpdate({ requests: chunk }, presId);
    } catch (e) {
      // Retry in small groups, then one by one, so one bad request doesn't block the rest
      for (let j = 0; j < chunk.length; j += 25) {
        const small = chunk.slice(j, j + 25);
        try {
          Slides.Presentations.batchUpdate({ requests: small }, presId);
        } catch (e2) {
          small.forEach(function (req) {
            try { Slides.Presentations.batchUpdate({ requests: [req] }, presId); } catch (e3) { stats.failed++; }
          });
        }
      }
    }
  }
}

function flushPresentation(pres) {
  try { pres.saveAndClose(); } catch (e) {}
}
