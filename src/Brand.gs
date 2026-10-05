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

const PRESENTATION_TYPES = [
  'Business Presentation',
  'Marketing Presentation',
  'Strategy Presentation',
  'Sales Presentation',
  'Executive Presentation',
  'Custom'
];

const TYPE_GUIDANCE = {
  'Business Presentation': 'Balanced business narrative: context, approach, outcomes and next steps.',
  'Marketing Presentation': 'Market insight, positioning, campaigns and channels, and measurable results.',
  'Strategy Presentation': 'Current state, strategic options, recommended path, roadmap, priorities and KPIs.',
  'Sales Presentation': 'Customer problem, the 66degrees solution, how we deliver, proof points, value, and a clear next step.',
  'Executive Presentation': 'Outcome-first and concise: headline numbers, decisions needed, short supporting points.',
  'Custom': 'Follow the structure implied by the request.'
};

var DEFAULT_VERTEX_LOCATION = 'us-central1';
var DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';

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

function generateContentUrl_(model) {
  if (isVertexConfigured_()) return buildVertexEndpoint_(getVertexConfig_(), model);
  return 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
}

function generateContentHeaders_(apiKey) {
  if (isVertexConfigured_()) return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  return { 'x-goog-api-key': apiKey };
}

function getApiKey() {
  if (isVertexConfigured_()) {
    var existing = String(getScriptProperty_('GEMINI_API_KEY') || '').trim();
    return existing || 'vertex';
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing (Project Settings → Script properties), or set VERTEX_PROJECT_ID for Vertex AI OAuth.');
  return apiKey;
}

// Ordered list of models to try: CONFIG.model (if set) first, then the best available models on the API key.
function modelCandidates(apiKey, kind) {
  const props = PropertiesService.getScriptProperties();
  const cacheKey = 'model_candidates_' + kind + (CONFIG.preferProModel ? '_pro' : '');
  let list = null;
  try { list = JSON.parse(props.getProperty(cacheKey) || 'null'); } catch (e) {}

  if (!list || !list.length) {
    const fallback = kind === 'image' ? ['gemini-2.5-flash-image'] : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    if (isVertexConfigured_()) {
      const vc = getVertexConfig_();
      list = kind === 'image' ? fallback : [vc.model, 'gemini-2.5-flash'];
      list = list.filter(function (n, i) { return list.indexOf(n) === i; });
      try { props.setProperty(cacheKey, JSON.stringify(list)); } catch (e) {}
    } else try {
      const resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        { headers: generateContentHeaders_(apiKey), muteHttpExceptions: true });
      const models = (JSON.parse(resp.getContentText()).models || [])
        .filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1; })
        .map(function (m) { return m.name.replace(/^models\//, ''); })
        .filter(function (n) { return /^gemini-\d/.test(n) && !/tts|audio|live|embedding|thinking-exp|learnlm|robotics|computer-use/i.test(n); });

      const version = function (n) { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
      const stableFirst = function (x, y) {
        const dv = version(y) - version(x);
        if (dv) return dv;
        return (/preview|exp/i.test(x) ? 1 : 0) - (/preview|exp/i.test(y) ? 1 : 0);
      };
      if (kind === 'image') {
        list = models.filter(function (n) { return /image/i.test(n); }).sort(stableFirst);
      } else {
        const text = models.filter(function (n) { return !/image/i.test(n); });
        // Prefer the free-tier-friendly 2.5 line first; only reach for 3.x heavy models if the pinned model is 3.x.
        // gemini-2.5-flash-lite is deprecated for new users — use gemini-3.5-flash-lite instead.
        const wanted = CONFIG.model && CONFIG.model !== 'auto' ? CONFIG.model : '';
        const majorPin = wanted ? (wanted.match(/gemini-(\d+)/) || [])[1] : '';
        const flash25 = text.filter(function (n) { return /gemini-2\.5.*-flash/i.test(n) && !/lite/i.test(n); }).sort(stableFirst);
        const flash20 = text.filter(function (n) { return /gemini-2\.0.*-flash/i.test(n) && !/lite/i.test(n); }).sort(stableFirst);
        const lite35  = text.filter(function (n) { return /gemini-3\.5.*-flash-lite/i.test(n); }).sort(stableFirst);
        const flash3  = text.filter(function (n) { return /gemini-3\..*-flash/i.test(n) && !/lite/i.test(n); }).sort(stableFirst);
        const pro25   = text.filter(function (n) { return /gemini-2\.5.*-pro/i.test(n); }).sort(stableFirst);
        // Free-tier default: newest 2.5-flash, older 2.5 flash backup, 2.0-flash, then 3.5-flash-lite as last-ditch.
        list = flash25.slice(0, 2).concat(flash20.slice(0, 1), lite35.slice(0, 1));
        // Only add 3.x heavy Flash at the tail if the user pinned to one of them (they have paid billing).
        if (majorPin === '3') list = list.concat(flash3.slice(0, 2));
        if (CONFIG.preferProModel) list = pro25.slice(0, 1).concat(list);
      }
      list = list.filter(function (n, i) { return list.indexOf(n) === i; });
      if (!list.length) list = fallback;
      props.setProperty(cacheKey, JSON.stringify(list));
    } catch (e) {
      list = fallback;
    }
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
  const models = modelCandidates(apiKey, 'text').slice(0, 4);
  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: temperature === undefined ? 0.4 : temperature }
  });
  const waits = [2000, 6000];       // retries per model after the first attempt
  const started = Date.now();
  let lastError = 'Gemini did not respond.';

  for (let m = 0; m < models.length; m++) {
    for (let attempt = 0; attempt <= waits.length; attempt++) {
      if (Date.now() - started > 150000) break; // stay well inside the 6-minute Apps Script limit

      let code = 0, result = null, body = '';
      try {
        const response = UrlFetchApp.fetch(
          generateContentUrl_(models[m]),
          {
            method: 'post',
            contentType: 'application/json',
            headers: generateContentHeaders_(apiKey),
            payload: payload,
            muteHttpExceptions: true
          }
        );
        code = response.getResponseCode();
        body = response.getContentText();
        result = JSON.parse(body);
      } catch (e) {
        lastError = e.message;
        if (attempt < waits.length) { Utilities.sleep(waits[attempt]); continue; }
        break;
      }

      if (result && result.error) {
        lastError = result.error.message || ('HTTP ' + code);
        if (code === 404 || /not found|not supported/i.test(lastError)) break;          // try the next model
        if (isRetryable(code || result.error.code, lastError)) {
          if (attempt < waits.length) { Utilities.sleep(waits[attempt]); continue; }
          break;                                                                          // next model
        }
        throw new Error('Gemini (' + models[m] + '): ' + lastError);                    // real error, e.g. bad request
      }

      const cand = result && result.candidates && result.candidates[0];
      if (!cand || !cand.content || !cand.content.parts) {
        lastError = 'Gemini returned no content' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.';
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
        lastError = 'Gemini returned invalid JSON.';
        if (attempt < waits.length) continue;
        break;
      }
    }
  }
  throw new Error('Gemini is busy right now (' + lastError + ') Tried: ' + models.join(', ') + '. Please try again in a minute.');
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
    const response = UrlFetchApp.fetch(
      generateContentUrl_(resolveModel(ctx.apiKey, 'image')),
      {
        method: 'post',
        contentType: 'application/json',
        headers: generateContentHeaders_(ctx.apiKey),
        payload: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        }),
        muteHttpExceptions: true
      }
    );
    const result = JSON.parse(response.getContentText());
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
  try { file = DriveApp.getFileById(id); } catch (e) {
    throw new Error('Cannot open the source document. Check that you have access to it.');
  }
  const mime = file.getMimeType();

  const exportText = function (exportMime) {
    const resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=' + encodeURIComponent(exportMime),
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) throw new Error('Could not export the source document (HTTP ' + resp.getResponseCode() + ').');
    return resp.getContentText();
  };

  let text = '';
  if (mime === 'application/vnd.google-apps.document' || mime === 'application/vnd.google-apps.presentation') {
    text = exportText('text/plain');
  } else if (mime === 'application/vnd.google-apps.spreadsheet') {
    text = exportText('text/csv');
  } else if (mime === 'application/pdf') {
    const blob = file.getBlob();
    if (blob.getBytes().length > 18 * 1024 * 1024) throw new Error('The source PDF is larger than 18 MB.');
    sources.pdfs.push(Utilities.base64Encode(blob.getBytes()));
    return;
  } else if (/^text\//.test(mime)) {
    text = file.getBlob().getDataAsString();
  } else {
    throw new Error('Source type not supported (' + mime + '). Use a Google Doc, Google Slides, Google Sheet, PDF or text file.');
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
            const s = el.asShape().getText().asString().trim();
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
      if (els[i].asShape().getText().asString().trim()) return false;
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
      if (mime === 'application/pdf') {
        bytes = f.getBlob().getBytes();
      } else if (mime === 'application/vnd.google-apps.document' || mime === 'application/vnd.google-apps.presentation') {
        const resp = UrlFetchApp.fetch(
          'https://www.googleapis.com/drive/v3/files/' + f.getId() + '/export?mimeType=application%2Fpdf',
          { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
        );
        if (resp.getResponseCode() === 200) bytes = resp.getBlob().getBytes();
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
  const resume = forceRefresh && stored && stored.partial ? stored : null;
  const index = buildAssetIndex(resume);
  index.savedAt = Date.now();
  writeStore('assets', index);
  return index;
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
