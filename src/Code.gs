/**
 * 66degrees AI Presentation Generator
 *
 * CREATE:  Gemini writes the content -> Beautiful.ai designs the slides -> editable PPTX is exported
 *          -> converted to Google Slides -> Gemini reviews every slide and the 66degrees brand pass is applied
 *          -> slides are added to the user's open deck.
 * REBRAND: the brand pass (with Gemini review) is applied to the open deck.
 *
 * Script properties required: VERTEX_PROJECT_ID, SCITE_API_KEY (optional), BEAUTIFUL_AI_KEY (optional)
 * Advanced service required: Slides API (v1). Drive file access uses DriveApp (no runtime Drive API enablement).
 *
 * Files: Code.gs (this), Brand.gs (brand kit, Gemini, storage), Rebrand.gs (brand pass),
 *        Engine.gs (layout engine), EngineRenderer.gs (draws engine slides), Generator.html (dialog),
 *        Reference.gs (66degrees 2026 template reference library: tokens, facts, reference selection, icons)
 *
 * Reference library setup (one-time):
 *   1. Upload 66d_reference_library.json to Drive and paste its file ID into CONFIG.refLibraryFileId.
 *   2. Upload the 2026 template .pptx to Drive, open it with Google Slides (File → Save as Google Slides)
 *      and paste the Google Slides file ID into CONFIG.referenceDeckId.
 *   3. First install/authorization runs ensureInitialSetup_() (loads the library if present; harvest stays internal).
 */

var CONFIG = {
  brandFolderId: '1x8kqT9Xz1iM5gg_EVpvutSWGjlyxh0sy',   // "66degrees AI Presentation Generator - TEST"

  model: 'gemini-2.5-flash',     // pinned to the model with a free-tier quota; the 3.x models are paid-only on this key
  preferProModel: false,
  imageModel: 'auto',
  maxGeneratedIconsPerRun: 3,

  beautifulApiBase: 'https://www.beautiful.ai/api/v1',
  beautifulThemeId: '',          // empty = Beautiful.ai picks its default theme (richer templates, more images than 'minimal')

  sciteApiBase: 'https://api.scite.ai',
  sciteMaxPapers: 8,             // top N papers pulled per deck; Gemini uses these as the factual basis

  // Hero image generation — DISABLED by default. When enabled, images go through Vertex AI OAuth
  // (VERTEX_PROJECT_ID). There is no Gemini API-key path.
  imageGeneration: false,
  imageProvider: 'gemini',       // 'gemini' = gemini-2.5-flash-image (Nano Banana), 'imagen' = Vertex AI Imagen 4
  imagesPerDeck: 3,              // hero images to generate per deck (cover, one strategic slide, closing background)

  // 66degrees 2026 template = PRIMARY design/brand/fact reference (Reference.gs)
  useReferenceLibrary: true,
  useBeautifulAi: false,
  roundedBoxes: true,            // Brand rule: boxes with ~3pt rounded corners (ShapeKit.gs); false = square boxes         // Create mode: false = slides drawn directly in the 66degrees template designs (Beautiful.ai key kept for later)
  refLibraryFileId: '1aZqCYJOykBfvuM58efdNzW5IPkQbjrqL',          // Drive file ID of 66d_reference_library.json
  referenceDeckId: '1aJPCylMP1AVjsMIZFUYCf_lE0cHCD3ElE2QlYOSZYOA',   // Google Slides copy of "66degrees Presentation Template - 2026"
  iconOrder: ['library', 'drive', 'material'],   // library = template icon set (slide 114, vector)

  reviewWithGemini: true,        // Gemini looks at every slide image during the brand pass
  headlineShrink: 0.92,          // Google Slides drops Beautiful.ai's tight letter spacing; shrink big text slightly
  maxSourceChars: 60000,
  assetIndexMaxAgeHours: 24
};

/* =========================
   MENU, DIALOG, CARD
========================= */

function onOpen() {
  buildProductionMenu_();
}

function onInstall() {
  buildProductionMenu_();
  try { ensureInitialSetup_(); } catch (e) { Logger.log('Initial setup: ' + e.message); }
}

function buildProductionMenu_() {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Open 66° Deck Agent', 'showGenerator')
    .addSeparator()
    .addItem('Refresh brand kit', 'refreshBrandKit')
    .addItem('Refresh brand assets', 'refreshBrandAssets')
    .addToUi();
}

function showGenerator() {
  try { ensureInitialSetup_(); } catch (e) { Logger.log('Initial setup: ' + e.message); }
  const html = HtmlService.createHtmlOutputFromFile('Generator')
    .setTitle(' ')
    .setWidth(540);
  SlidesApp.getUi().showSidebar(html);
}

function showGeneratorSidebar() {
  showGenerator();
}

function onHomepage() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('66° Deck Agent'))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(
          'Open a Google Slides presentation and launch 66° Deck Agent from the add-on menu. Generated slides are added to this same presentation.'
        )
      )
    )
    .build();
}

function onFileScopeGranted(e) {
  try { ensureInitialSetup_(); } catch (err) { Logger.log('Initial setup: ' + err.message); }
  return onHomepage();
}

var INITIAL_SETUP_PROP = 'INITIAL_SETUP_AT';

function ensureInitialSetup_(force) {
  const props = PropertiesService.getScriptProperties();
  const already = String(props.getProperty(INITIAL_SETUP_PROP) || '').trim();
  if (already && !force) {
    return { ok: true, skipped: true, initializedAt: already };
  }
  return runInitialSetup_(props);
}

function runInitialSetup_(props) {
  props = props || PropertiesService.getScriptProperties();
  const result = {
    ok: true,
    skipped: false,
    initializedAt: new Date().toISOString(),
    hasLibrary: false,
    hasHarvest: false,
    log: []
  };
  try {
    const lib = loadReferenceLibrary(false);
    result.hasLibrary = !!(lib && lib.slides && lib.slides.length);
    result.log.push(result.hasLibrary ? 'reference-library' : 'reference-library-missing');
  } catch (e) {
    result.log.push('reference-library-skipped');
  }
  try {
    const rt = loadReferenceRuntime(false);
    result.hasHarvest = !!(rt && ((rt.icons && Object.keys(rt.icons).length) || (rt.slides && Object.keys(rt.slides).length)));
    result.log.push(result.hasHarvest ? 'reference-runtime' : 'reference-runtime-missing');
  } catch (e) {
    result.log.push('reference-runtime-skipped');
  }
  try {
    getBrandProfile('', false);
    result.log.push('brand-profile');
  } catch (e) {
    result.log.push('brand-profile-skipped');
  }
  try { props.setProperty(INITIAL_SETUP_PROP, result.initializedAt); } catch (e) {}
  return result;
}

// Refreshes brand profile + reference library. The Drive asset scan is a separate menu item
// (Refresh brand assets) so neither run can hit the 6-minute Apps Script limit.
function refreshBrandKit() {
  const started = Date.now();
  const apiKey = getApiKey();
  clearStore('brand');
  clearReferenceCaches();
  ['model_candidates_text', 'model_candidates_text_pro', 'model_candidates_image', 'model_candidates_image_pro']
    .forEach(function (k) { PropertiesService.getScriptProperties().deleteProperty(k); });

  const lib = loadReferenceLibrary(true);
  const rt = lib ? loadReferenceRuntime(true) : null;
  Logger.log('Reference library loaded in ' + Math.round((Date.now() - started) / 1000) + 's');

  const brand = getBrandProfile(apiKey, true);      // skips the Gemini guideline read when the library is loaded
  Logger.log('Brand profile built in ' + Math.round((Date.now() - started) / 1000) + 's');

  const assets = getAssetIndex(false);              // uses the saved asset index; rebuild with "Refresh brand assets"
  const msg = 'Brand kit refreshed (' + Math.round((Date.now() - started) / 1000) + 's).\n\n' +
    'Brand source: ' + (brand.source === 'reference-library' ? '66degrees 2026 template (reference library)' : 'Drive brand guidelines') + '\n' +
    'Colors: ' + brand.palette.length + ' (' + brand.palette.slice(0, 6).join(', ') + ' …)\n' +
    'Fonts: ' + brand.fonts.heading.name + ' → ' + brand.fonts.heading.slides + ', ' + brand.fonts.mono.name + ' → ' + brand.fonts.mono.slides + '\n' +
    describeAssets(assets) + '\n' +
    'Beautiful.ai key: ' + (getBeautifulKey(true) ? 'found' : 'MISSING (add BEAUTIFUL_AI_KEY in Script properties)') + '\n' +
    'Scite.ai key: ' + (getSciteKey(true) ? 'found' : 'MISSING (add SCITE_API_KEY in Script properties)') + '\n' +
    'Reference library: ' + (lib ? lib.slides.length + ' template slides, ' + lib.icons.length + ' icons, ' + lib.companyFacts.length + ' facts' : 'NOT LOADED (check CONFIG.refLibraryFileId)') + '\n' +
    'Reference harvest: ' + (rt ? Object.keys(rt.icons || {}).length + ' icons, ' + Object.keys(rt.thumbs || {}).length + ' thumbnails' : 'not run yet') + '\n' +
    'Gemini models: ' + modelCandidates(apiKey, 'text').slice(0, 3).join(', ');
  try { SlidesApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

// Rescans the Drive brand folder for icons, logos, patterns and design images (time-guarded).
function refreshBrandAssets() {
  const started = Date.now();
  clearStore('assets');
  const assets = getAssetIndex(true);
  const msg = 'Brand assets rescanned (' + Math.round((Date.now() - started) / 1000) + 's).\n\n' + describeAssets(assets) +
    (assets.partial ? '\n\nThe scan stopped early to stay inside the time limit (' + assets.filesSeen + ' files checked). ' +
      'Run "Refresh brand assets" again to continue from where it stopped.' : '');
  try { SlidesApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

function describeAssets(assets) {
  if (!assets) return 'Brand assets: not scanned yet (run "Refresh brand assets")';
  return 'Brand icons: ' + Object.keys(assets.icons || {}).length +
    ', logos: ' + (((assets.logos || {}).dark ? 1 : 0) + ((assets.logos || {}).light ? 1 : 0)) +
    ', patterns: ' + Object.keys(assets.patterns || {}).length +
    ', design images: ' + Object.keys(assets.design || {}).length +
    (assets.partial ? ' (partial scan)' : '');
}

/* =========================
   MAIN ENTRY (called by Generator.html)
========================= */

function generationResult_(message, presentation, slideCount) {
  var pres = presentation;
  if (!pres) {
    try { pres = SlidesApp.getActivePresentation(); } catch (e) { pres = null; }
  }
  return {
    ok: String(message || '').indexOf('SUCCESS') === 0,
    cancelled: String(message || '').indexOf('CANCELLED') === 0,
    message: message,
    presentationId: pres ? pres.getId() : '',
    url: pres ? pres.getUrl() : '',
    slideCount: slideCount || 0
  };
}

function generatePresentation(data) {
  data = data || {};
  const run = { runId: data.runId ? String(data.runId).slice(0, 60) : null, tempId: null, ctx: null };
  try {
    return generatePresentationRun_(data, run);
  } catch (e) {
    const ctx = run.ctx || { runId: run.runId, progress: null };
    if (e && e.cancelled) {
      if (run.tempId) trashDriveFile(run.tempId);
      progressFinish_(ctx, 'cancelled', 'Stopped at your request.');
      return generationResult_(
        'CANCELLED: Stopped at your request. ' +
          (data.mode === 'rebrand' ? 'Slides that were already processed keep their new styling.' : 'Nothing was added to your deck.'),
        null,
        0
      );
    }
    progressFail_(ctx, e && e.message ? e.message : String(e));
    throw e;
  }
}

function generatePresentationRun_(data, run) {
  const started = Date.now();
  const mode = data.mode === 'rebrand' ? 'rebrand' : 'create';
  const ctx = { runId: run.runId, progress: null, blobCache: {}, generatedIcons: 0, log: [] };
  run.ctx = ctx;
  progressInit_(ctx, mode);
  try { ensureInitialSetup_(); } catch (e) { ctx.log.push('Initial setup: ' + (e && e.message ? e.message : String(e))); }

  ctx.apiKey = getApiKey();
  try { ctx.brand = getBrandProfile(ctx.apiKey, false); }
  catch (e) { ctx.brand = JSON.parse(JSON.stringify(DEFAULT_BRAND)); ctx.log.push('Brand profile fallback: ' + sanitizeDriveError_(e)); }
  try { ctx.assets = getAssetIndex(false); }
  catch (e) { ctx.assets = emptyAssetIndex_(); ctx.log.push('Brand assets skipped: ' + sanitizeDriveError_(e)); }
  try { ctx.lib = loadReferenceLibrary(false); }
  catch (e) { ctx.lib = null; ctx.log.push('Reference library skipped: ' + sanitizeDriveError_(e)); }
  ctx.tokens = libraryTokens(ctx.lib);                    // template design tokens (template values even without the library)
  try { ctx.refRuntime = ctx.lib ? loadReferenceRuntime(false) : null; }
  catch (e) { ctx.refRuntime = null; ctx.log.push('Reference harvest skipped: ' + sanitizeDriveError_(e)); }
  if (ctx.lib && !ctx.refRuntime) ctx.iconIssue = 'harvest data not loaded: ' + (REF_RUNTIME_ERROR || 'unknown reason');
  const target = SlidesApp.getActivePresentation();
  if (!ctx.lib && CONFIG.useReferenceLibrary) ctx.log.push('Reference library not loaded — using built-in 66degrees template values.');

  if (mode === 'rebrand') {
    const stats = rebrandPresentation(target.getId(), ctx, { specs: null });
    let rmsg = 'SUCCESS: Rebranded ' + stats.slides + ' slides with the 66degrees brand. ' + summarizeStats(stats);
    if (ctx.log.length) rmsg += '\n' + ctx.log.join('\n');
    progressFinish_(ctx, 'done', stats.slides + ' slides rebranded');
    Logger.log(rmsg);
    return generationResult_(rmsg, target, stats.slides);
  }

  // ---------- CREATE ----------
  const userPrompt = String(data.prompt || '').trim();
  const sources = { text: '', pdfs: [], images: [] };
  if (data.sourceUrl && String(data.sourceUrl).trim()) readSourceDocument(String(data.sourceUrl).trim(), sources);
  if (data.upload && data.upload.data) {
    readUploadedFile_(data.upload, sources);
    ctx.log.push('Source file used: ' + data.upload.name + '.');
  }
  if (!userPrompt && !sources.text && !sources.pdfs.length && !sources.images.length) {
    throw new Error('Please describe the presentation you want, or add a source link or file.');
  }
  const presentationType = normalizePresentationType_(data.presentationType || data.type);
  const department = normalizeDepartment_(data.department);
  const totalSlides = clampSlideCount_(data.slideCount != null && data.slideCount !== '' ? data.slideCount : data.slides);
  ctx.presentationType = presentationType;
  ctx.department = department;
  if (ctx.lib) ctx.lib = applyDepartmentFilter_(ctx.lib, department);
  const existing = target.getSlides();
  const blankDeck = isBlankDeck(existing);

  // 1a. Research: Scite.ai first (academic papers + citations). If Scite is unavailable or finds nothing,
  //     Gemini does the research instead (Google Search grounding, or its own knowledge as a last resort).
  //     Everything after this step is the same whichever source was used.
  progressStage_(ctx, 'research', 'active', 'Searching Scite for research on your topic');
  const topic = userPrompt || sources.text || 'business presentation';
  sources.research = [];
  let sciteProblem = '';
  try {
    if (!getSciteKey(true)) throw new Error('no Scite API key');
    sources.research = sciteResearch(topic, ctx) || [];
    if (!sources.research.length) sciteProblem = 'no results';
  } catch (e) {
    sciteProblem = e.message;
    sources.research = [];
  }
  if (sources.research.length) {
    sources.researchProvider = 'scite';
    ctx.log.push('Scite: pulled ' + sources.research.length + ' research sources.');
    progressStage_(ctx, 'research', 'done', sources.research.length + ' research papers found (Scite)');
  } else {
    ctx.log.push('Scite unavailable (' + sciteProblem + '): Gemini did the research.');
    progressStage_(ctx, 'research', 'active', 'Scite unavailable, Gemini is researching the topic');
    try {
      const gr = geminiResearch(topic, ctx);
      sources.research = gr.sources;
      sources.researchProvider = gr.provider;
      ctx.log.push(gr.provider === 'gemini_search'
        ? 'Gemini research: ' + gr.sources.length + ' web sources (Google Search).'
        : 'Gemini research: from Gemini\'s own knowledge (web search unavailable), figures marked to verify.');
      progressStage_(ctx, 'research', 'done', gr.sources.length + ' sources found (Gemini' + (gr.provider === 'gemini_search' ? ' + Google Search' : '') + ')');
    } catch (e) {
      sources.research = [];
      ctx.log.push('Research skipped (Scite: ' + sciteProblem + '; Gemini: ' + e.message + ').');
      progressStage_(ctx, 'research', 'done', 'Skipped: no research source reachable');
    }
  }
  checkCancel_(ctx);

  // 1b. Gemini writes the content plan grounded in Scite's research (one spec per slide, in order)
  progressStage_(ctx, 'write', 'active', 'Gemini is writing ' + totalSlides + ' slides');
  const plan = planContent(userPrompt, presentationType, totalSlides, sources, ctx);
  progressStage_(ctx, 'write', 'done', plan.slides.length + ' slides planned');
  progressSlides_(ctx, plan.slides.map(specTitle_));
  checkCancel_(ctx);

  // 1c. Match every planned slide to its 66degrees template reference (deterministic, no extra Gemini call)
  progressStage_(ctx, 'match', 'active', 'Choosing a 66degrees template layout for each slide');
  enforceQuoteRule(plan, userPrompt, sources);
  const refs = selectReferences(plan, ctx);
  if (ctx.lib) ctx.log.push('Template references: ' + refs.matched + ' slides matched' + (refs.fallback ? ', ' + refs.fallback + ' without a direct reference (flagged in notes)' : '') + '.');
  progressStage_(ctx, 'match', 'done', ctx.lib ? refs.matched + ' of ' + plan.slides.length + ' slides matched to the template' : 'Template library not loaded');
  checkCancel_(ctx);

  // 1c-2. The design must suit the content: every design of the slide's type is tried with the real content and the
  //       one that fits best wins (no overflow, boxes well filled). Gemini's own choice and variety break ties.
  const swaps = chooseDesignsByContent_(plan, ctx);
  if (swaps) ctx.log.push('Designs matched to content: ' + swaps + ' slide(s) moved to a design that suits their content better.');

  // 1d. Fit check: every text is measured in its design at the standard type sizes. Texts that would not fit are
  //     rewritten shorter, boxes that would look empty get fuller text (Gemini, to exact character limits).
  if (!CONFIG.useBeautifulAi) {
    progressStage_(ctx, 'fit', 'active', 'Measuring every text box');
    const fitRes = fitContentToDesigns_(plan, ctx, started);
    progressStage_(ctx, 'fit', 'done', fitRes.fixed ? fitRes.fixed + ' texts rewritten to fit' : 'Everything fits');
    if (fitRes.left) ctx.log.push('Fit check: ' + fitRes.left + ' text(s) still slightly long; the slide type was stepped down to fit.');
    checkCancel_(ctx);
  }

  // 2. Slides: drawn directly into the user's CURRENT presentation (default).
  // Beautiful.ai remains an optional path that still uses a working copy, then copies in.
  let stats, tempId = null, copied;
  if (!CONFIG.useBeautifulAi) {
    finalizeNotes_(plan, sources);
    stats = drawSlidesIntoActive_(target, plan.slides, ctx, blankDeck);
    copied = stats.redrawn || plan.slides.length;
  } else {
    // 2. Beautiful.ai designs the slides
    progressStage_(ctx, 'design', 'active', 'Beautiful.ai is designing ' + plan.slides.length + ' slides — usually 30–90 seconds');
    const baPrompt = buildBeautifulPrompt(plan);
    const baDeck = beautifulGenerate(baPrompt, plan.deck_title);
    checkCancel_(ctx);

    // 3. Editable PowerPoint export -> 4. Google Slides conversion
    const pptx = beautifulExportPptx(baDeck.presentationId);
    progressStage_(ctx, 'design', 'done', 'Design ready');
    progressStage_(ctx, 'import', 'active', 'Converting the design to Google Slides');
    tempId = convertPptxToSlides(pptx, (plan.deck_title || 'Generated deck') + ' (working copy)');
    run.tempId = tempId;

    // 4b. Beautiful.ai does not always return exactly the planned number of slides: match content specs to slides by title
    const specs = alignSpecsToSlides(tempId, plan.slides, ctx);
    progressSlides_(ctx, specs.map(function (sp, i) { return sp ? specTitle_(sp) : 'Slide ' + (i + 1); }));
    progressStage_(ctx, 'import', 'done', specs.length === plan.slides.length
      ? specs.length + ' slides imported'
      : 'Beautiful.ai returned ' + specs.length + ' of ' + plan.slides.length + ' slides');
    checkCancel_(ctx);

    // 5. Brand pass with Gemini review (on the working copy) — reports review + per-slide progress itself
    try {
      stats = rebrandPresentation(tempId, ctx, { specs: specs });
    } catch (e) {
      if (e && e.cancelled) throw e;
      throw new Error('Branding failed: ' + e.message + ' The unbranded working copy is in your Drive.');
    }
    checkCancel_(ctx);
  }
  checkCancel_(ctx);

  // 6. Default path already drew into the active presentation. Beautiful.ai still copies from its working deck.
  ctx.noCancel = true;
  if (CONFIG.useBeautifulAi) {
    progressStage_(ctx, 'insert', 'active', 'Adding the slides to your presentation');
    copied = copyIntoDeck(tempId, target, blankDeck);
    trashDriveFile(tempId);
    run.tempId = null;
    progressStage_(ctx, 'insert', 'done', copied + ' slides added');
  } else {
    progressStage_(ctx, 'insert', 'active', 'Slides are in this presentation');
    progressStage_(ctx, 'insert', 'done', copied + ' slides added to this presentation');
  }

  const secs = Math.round((Date.now() - started) / 1000);
  let msg = 'SUCCESS: ' + copied + ' branded slides added to this presentation (' + secs + 's). ' + summarizeStats(stats);
  if (ctx.roundIssue) msg += '\nRounded boxes: not available (' + ctx.roundIssue + '); square boxes were used.';
  if (ctx.iconAttempts && !ctx.libraryIconsPlaced) {
    msg += '\nTemplate icons: none placed' + (ctx.iconIssue ? ' (' + ctx.iconIssue + ')' : '') + '. Drive or fallback icons were used.';
  }
  if (plan.facts_note) msg += '\nNote: ' + plan.facts_note;
  if (ctx.log.length) msg += '\n' + ctx.log.join('\n');
  progressFinish_(ctx, 'done', copied + ' slides added in ' + secs + 's');
  Logger.log(msg);
  return generationResult_(msg, target, copied);
}

/* =========================
   LIVE PROGRESS (read by Generator.html every 2 seconds)
   Progress is kept in the user's CacheService under the run ID the dialog creates.
========================= */

const PROGRESS_STAGES = {
  create: [
    ['research', 'Research'],
    ['write', 'Writing the content'],
    ['match', 'Choosing a 66degrees template design for each slide'],
    ['fit', 'Fitting the text to each design'],
    ['brand', 'Drawing the slides'],
    ['insert', 'Adding slides to your deck']
  ],
  create_beautiful: [
    ['research', 'Research'],
    ['write', 'Writing the content'],
    ['match', 'Matching 66degrees template layouts'],
    ['design', 'Designing the slides'],
    ['import', 'Importing into Google Slides'],
    ['review', 'Reviewing every slide'],
    ['brand', 'Applying the 66degrees brand'],
    ['insert', 'Adding slides to your deck']
  ],
  rebrand: [
    ['review', 'Reviewing every slide'],
    ['brand', 'Applying the 66degrees brand']
  ]
};

function specTitle_(sp) {
  if (!sp) return '';
  if (String(sp.type || '').toLowerCase() === 'closing') return 'Thank You';
  return String(sp.title || sp.statement || sp.quote || sp.type || '').replace(/\s+/g, ' ').trim().slice(0, 70);
}

function progressInit_(ctx, mode) {
  if (!ctx || !ctx.runId) return;
  ctx.progress = {
    mode: mode,
    startedAt: Date.now(),
    stages: PROGRESS_STAGES[mode === 'create' && CONFIG.useBeautifulAi ? 'create_beautiful' : mode].map(function (s) { return { id: s[0], label: s[1], status: 'pending', detail: '' }; }),
    slides: [],
    state: 'running',
    message: ''
  };
  progressSave_(ctx);
}

function progressSave_(ctx) {
  if (!ctx || !ctx.runId || !ctx.progress) return;
  try {
    ctx.progress.savedAt = Date.now();
    CacheService.getUserCache().put('prog_' + ctx.runId, JSON.stringify(ctx.progress), 1800);
  } catch (e) {}
}

function progressStage_(ctx, id, status, detail) {
  if (!ctx || !ctx.progress) return;
  ctx.progress.stages.forEach(function (st) {
    if (st.id !== id) return;
    st.status = status;
    if (detail !== undefined) st.detail = detail;
  });
  progressSave_(ctx);
}

function progressSlides_(ctx, titles) {
  if (!ctx || !ctx.progress) return;
  ctx.progress.slides = titles.map(function (t, i) { return { n: i + 1, title: t || ('Slide ' + (i + 1)), status: 'pending' }; });
  progressSave_(ctx);
}

function progressSlide_(ctx, index, status) {
  if (!ctx || !ctx.progress || !ctx.progress.slides[index]) return;
  ctx.progress.slides[index].status = status;
  progressSave_(ctx);
}

function progressFinish_(ctx, state, message) {
  if (!ctx || !ctx.progress) return;
  ctx.progress.state = state;
  ctx.progress.message = message || '';
  if (state === 'done') {
    ctx.progress.stages.forEach(function (st) { if (st.status !== 'error') st.status = 'done'; });
    ctx.progress.slides.forEach(function (sl) { sl.status = 'done'; });
  }
  if (state === 'cancelled') {
    ctx.progress.stages.forEach(function (st) { if (st.status === 'active') { st.status = 'error'; st.detail = 'Stopped'; } });
  }
  progressSave_(ctx);
}

function progressFail_(ctx, message) {
  if (!ctx || !ctx.progress) return;
  let marked = false;
  ctx.progress.stages.forEach(function (st) {
    if (st.status === 'active' && !marked) { st.status = 'error'; st.detail = message; marked = true; }
  });
  if (!marked) {
    const next = ctx.progress.stages.filter(function (st) { return st.status === 'pending'; })[0];
    if (next) { next.status = 'error'; next.detail = message; }
  }
  ctx.progress.slides.forEach(function (sl) { if (sl.status === 'active') sl.status = 'error'; });
  ctx.progress.state = 'error';
  ctx.progress.message = message;
  progressSave_(ctx);
}

// Called by the dialog (polling)
function getProgress(runId) {
  if (!runId) return null;
  try {
    const v = CacheService.getUserCache().get('prog_' + String(runId).slice(0, 60));
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

// Called by the dialog's Cancel button: the run stops at its next checkpoint
function cancelRun(runId) {
  if (!runId) return false;
  CacheService.getUserCache().put('cancel_' + String(runId).slice(0, 60), '1', 1800);
  return true;
}

function checkCancel_(ctx) {
  if (!ctx || !ctx.runId || ctx.noCancel) return;
  let flag = null;
  try { flag = CacheService.getUserCache().get('cancel_' + ctx.runId); } catch (e) {}
  if (flag) {
    const err = new Error('Cancelled by user.');
    err.cancelled = true;
    throw err;
  }
}

// Returns one spec per slide of the converted deck (null where no planned slide matches).
// Uses the plan as-is when the slide counts agree; otherwise matches each slide to the planned slide whose title it contains.
function alignSpecsToSlides(presId, specs, ctx) {
  const slides = SlidesApp.openById(presId).getSlides();
  if (slides.length === specs.length) return specs;
  const words = function (t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
  };
  const slideText = function (slide) {
    const out = [];
    const walk = function (els) {
      els.forEach(function (el) {
        try {
          const t = el.getPageElementType();
          if (t === SlidesApp.PageElementType.GROUP) walk(el.asGroup().getChildren());
          else if (t === SlidesApp.PageElementType.SHAPE) {
            const sh = el.asShape();
            if (typeof hasTextFrame_ === 'function' && !hasTextFrame_(sh)) return;
            out.push(sh.getText().asString());
          }
        } catch (e) {}
      });
    };
    walk(slide.getPageElements());
    return out.join(' ').toLowerCase();
  };
  const texts = slides.map(slideText);
  const used = {};
  let matched = 0;
  const aligned = slides.map(function (slide, i) {
    let best = null;
    specs.forEach(function (sp, k) {
      if (used[k]) return;
      const w = words(sp.title || sp.statement || sp.quote);
      if (!w.length) return;
      let hit = 0;
      w.forEach(function (x) { if (texts[i].indexOf(x) !== -1) hit++; });
      const score = hit / w.length - Math.abs(k - i) * 0.02;
      if (score > 0.5 && (!best || score > best.score)) best = { k: k, score: score };
    });
    if (!best) return null;
    used[best.k] = true;
    matched++;
    return specs[best.k];
  });
  const missing = specs.filter(function (sp, k) { return !used[k]; }).map(function (sp) { return sp.title || sp.type; });
  ctx.log.push('Beautiful.ai returned ' + slides.length + ' of ' + specs.length + ' planned slides (' + matched + ' matched to the plan)' +
    (missing.length ? '. Not in the deck: ' + missing.join('; ') : '') + '.');
  return aligned;
}

function summarizeStats(s) {
  const parts = [];
  if (s.fonts) parts.push(s.fonts + ' font fixes');
  if (s.colors) parts.push(s.colors + ' color fixes');
  if (s.icons) parts.push(s.icons + ' icons replaced');
  if (s.removed) parts.push(s.removed + ' off-brand images removed');
  if (s.redrawn) parts.push(s.redrawn + ' slides drawn in the 66degrees template style');
  if (s.normalized) parts.push(s.normalized + ' slides normalized to the 66degrees template');
  if (s.libraryIcons) parts.push(s.libraryIcons + ' template icons placed');
  return parts.length ? parts.join(', ') + '.' : '';
}

/* =========================
   1. CONTENT PLAN (Gemini)
========================= */

function planContent(userPrompt, presentationType, n, sources, ctx) {
  const guidance = TYPE_GUIDANCE[presentationType] || TYPE_GUIDANCE['Custom'];
  const iconNames = Object.keys(ctx.assets.icons).sort();
  const libIconNames = ctx.lib ? ctx.lib.icons.map(function (i) { return i.name; }) : [];

  // Approved facts: the 2026 template (reference library) first, the built-in list as fallback
  const facts = libraryFacts(ctx.lib, [userPrompt, presentationType, ctx.department, String(sources.text || '').slice(0, 4000)].join(' '));
  const approvedFacts = facts.usable.length ? facts.usable : APPROVED_FACTS;

  const prompt = `
You are the senior presentation strategist for ${ctx.brand.name}. Write the content for the best possible presentation on the topic:
a clear story, one idea per slide, concrete and useful content.

REQUEST: "${userPrompt || 'Build the presentation from the attached source material.'}"
PRESENTATION TYPE: ${presentationType}
DEPARTMENT: ${ctx.department || 'Other'}
STRUCTURE: ${guidance} ${DEPARTMENT_GUIDANCE[ctx.department] || DEPARTMENT_GUIDANCE.Other} Shape the story around what the request is really asking for, the way a senior consultant would.
EXACT NUMBER OF SLIDES: ${n}

AUDIENCE: write for the selected ${ctx.department || 'Other'} department. Do not invent a job title or company unless the user states one. Never write "for the VP of ...".

STORY (MANDATORY):
- Slide 1 MUST be type "cover".
- Slide 2 MUST be type "agenda" when ${n} >= 5.
- Slide ${n} (the LAST slide) MUST be type "closing" with a short title and subtitle — this is non-negotiable, always include it.
- That leaves ${Math.max(n - 3, 1)} slides for the body. Build the story the request needs (for example: context, the problem, the approach,
  proof and impact, measures of success). Use real content-rich slides; every slide must earn its place.
- Add a "next_steps" slide ONLY when the request asks for next steps, actions, a call to action or a plan to start. Otherwise do not include one.
- Compress the body if needed to fit — do not skip the closing.
- The agenda lists ONLY the body slides, one item per body slide, in the same order (so ${Math.max(n - 3, 1)} items).
  Each agenda item title is EXACTLY that slide's title, word for word (the code enforces this). Its "text" is a one-line description.
  If the request asks for more topics than there are body slides, combine related topics on one slide rather than dropping any.
- Do not write "eyebrow" labels (the design has no label bar above the title).

WRITING (brand voice)
${ctx.brand.rules.map(function (r) { return '- ' + r; }).join('\n')}
- Titles: the key message in sentence case (only the first word and proper nouns capitalised, e.g. "Three barriers slow enterprise AI adoption"),
  max 58 characters (one line), never Title Case, never ALL CAPS. Body text: specific and concrete.
- One clear message per slide, and every slide covers a different topic: never repeat a topic, a capability list, a phase name or a number
  on two slides. The deck reads as one argument: context -> problem -> approach -> proof -> what it means for the audience.
- Variety like a designed deck: never two slides of the same type in a row, at most two "cards" slides in the whole deck, and use the
  visual types (stats, process, timeline, comparison, case_study, chart) wherever the content allows. Proof slides use real numbers.
- Every number must appear in the research sources, the approved facts or the user's material, exactly as written there.
  Never state how many companies use a Google product (e.g. "90% of the Fortune 100") unless a source says exactly that.
  Round figures for slides: "25%" not "24.69%".
- Slide titles fit on ONE line: max 58 characters.
- Agenda descriptions: one short line each, max 70 characters.
- No hype words: unprecedented, unparalleled, unmatched, world-class, cutting-edge, revolutionary, seamless, best-in-class, game-changing,
  transformative, groundbreaking, state-of-the-art.
- At most ONE chart slide per deck, and only with at least 3 real data points; never a chart whose "before" or baseline is 0 or assumed.
- A card "highlight" must add a new fact (a number or result), never repeat the card text.
- Charts only show real numbers: every value in a chart must come from the research sources, the approved facts or the user's material.
  Never invent "before" values or baselines. Without real before/after or trend data, use a "stats" slide instead of a chart.
  Chart series names and category labels are short (max 24 characters).
- Plain text only: no markdown, bullet characters, emojis or quotation marks.
- Never put color codes (like #0052FF), font names or formatting instructions in any slide text.
- KPI values ("value" fields) are short: the number with its unit, e.g. "40%", "3x", "$10M", "350+". Put words like "Up to" in the label.
- A KPI is a measurable result (adoption rate, hours saved, cost reduction, ROI, CSAT, error rate) - never a duration or timeframe
  such as "30-60 days". All KPIs on one slide are the same kind: all targets, or all research findings - never mixed.
- NEVER put fact IDs (66D_FACT_...), source numbers like [1] or [2], or any other reference marker in slide text.
  Fact IDs go only in "fact_tags"; research source numbers go only in "notes".
- Fill the design you choose: write the number of words the DESIGN MENU gives for it. The boxes run down to the bottom of the
  slide, so short text leaves them looking empty - write full, specific sentences (a number, a named capability, a concrete action),
  never generic filler, and never more than the upper word count (text must not overflow).
- Think like a presentation designer: every slide should look like a finished consulting slide, with a clear headline message and
  structured, rich content that fills the design.

FACTS
- Statements about ${ctx.brand.name} may ONLY use the APPROVED FACTS below (or the user's source material).
- Topic/market/client numbers must come from the request or source material. If you need a number you do not have,
  write it as a target ("Target: 30% faster") and add "Illustrative figure – validate before sharing." to that slide's notes.
- "facts_note": one short sentence naming illustrative figures, or "".

APPROVED FACTS${facts.usable.length ? ' (from the 66degrees 2026 template; the [tag] after each fact is its ID)' : ''}
${approvedFacts.map(function (f) { return '- ' + f; }).join('\n')}
${facts.verify.length ? '\nFACTS TO USE ONLY IF ESSENTIAL (read from badge/logo images) — if used, add "Verify before sharing." to that slide\'s notes:\n' + facts.verify.map(function (f) { return '- ' + f; }).join('\n') + '\n' : ''}
- For every slide, list the IDs of the facts you used in "fact_tags" (e.g. ["66D_FACT_COMPANY_003"]), or [].
- Never write bios, awards, clients or numbers about ${ctx.brand.name} that are not in the facts above.

LAYOUT FIT (the 66degrees template has reference layouts for these sizes — prefer them)
- cards: 3, 4, 5 or 6 items. process: 4 steps (5-6 also fine). timeline: 4-5 items. stats: 3-4 items.
- agenda: 5-7 items. table: at most 7 rows. bullets: at most 6 points. comparison: two columns of 3-6 points.
- quote: ONLY when the request or source material contains a real quotation with its speaker. Never invent a quote or an attribution; otherwise use "statement".
- next_steps: at most one, directly before the closing.

SLIDE TYPES (use exactly these field names)
- cover: title, subtitle
- agenda: title, items[{title, text}] (3-8)
- statement: title (short slide title, max ~60 characters), statement (the key message, max ~110 characters), text, points[{title, text}] (0-3)
- cards: title, lead, items[{title, text, icon, material, highlight}] (2-6). "highlight" = one short result line shown in blue at the
  bottom of the card (max 60 characters, e.g. "Up to 40% lower operating costs"); only when a research source or approved fact backs it, else omit.
- process: title, lead, items[{title, text}] (3-6 steps)
- timeline: title, items[{date, title, text}] (3-6)
- stats: title, items[{value, label, text}] (2-4), takeaway
- chart: title, chart{type:"column"|"bar"|"line", categories[], series[{name, values[]}], unit, unitLabel, highlight}, insight{title, text}
- comparison: title, left{label, title, points[]}, right{label, title, points[]}. Each point is ONE short line (6-14 words), never a paragraph.
- table: title, columns[] (2-5), rows[][] (2-7)
- case_study (one client): title, industry (e.g. "Energy | AI/ML"), challenge (2-3 sentences), solution [3-4 points of 15-25 words], results[{value, label}] (2-3), outcome (1-2 sentences)
- case_study (several clients, journey design 66D_LAYOUT_CASE_STUDY_002): title, cases[{phase, offering, industry, challenge, value_headline, value}] (3-4)
  Use approved client facts only; value_headline is the key result (e.g. "$3M+ in annual savings").
- bullets: title, points[] (3-6), callout{label, title, text}
- next_steps: title, items[{title, text, timing}] (3-5), cta
- quote: quote, attribution
- section: title, lead
- closing: title, subtitle
Every slide also has "notes" (2-4 sentences for the presenter).
Every body slide also has "design": the tag of the template design from the DESIGN MENU that best suits this slide's role and content.
  Choose it the way a presentation designer would: the key proof slide (case study, KPIs) gets the richest design; a methodology
  gets a process design; a journey gets the staircase; a from/to comparison gets the cross/tick design. Vary designs across the deck.

DESIGN MENU (66degrees 2026 template designs the engine can draw)
${ENGINE.designMenu()}
For "cards" items, "icon" must be a name from ${libIconNames.length ? 'LIBRARY_ICONS (preferred) or ' : ''}BRAND_ICONS and "material" the closest Google Material Icons name.
Use charts and stats wherever real or target numbers make the point clearer.

${libIconNames.length ? 'LIBRARY_ICONS: ' + libIconNames.join(', ') + '\n' : ''}BRAND_ICONS: ${iconNames.join(', ')}
${sources.research && sources.research.length ? '\n' + formatSciteForPrompt(sources.research, sources.researchProvider) + '\nRESEARCH RULES:\n- Every factual claim, statistic, trend or finding MUST come from the RESEARCH SOURCES above.\n- When you use a source, append its number in square brackets to the slide\'s "notes" field, e.g. "[1][3]".\n- Prefer quantitative findings (percentages, counts, growth rates) for stats/chart slides.\n- If a claim cannot be supported by the sources, mark it as "Illustrative figure – validate before sharing." in that slide\'s notes.' : ''}
${sources.text ? '\nUSER-PROVIDED SOURCE MATERIAL (secondary):\n' + sources.text.slice(0, CONFIG.maxSourceChars) : ''}
${sources.pdfs.length ? '\nA source PDF is attached: use it alongside the research sources.' : ''}
${(sources.images || []).length ? '\nA source image is attached: use what it shows (text, numbers, diagrams) as source material.' : ''}

OUTPUT: ONLY valid JSON: { "deck_title": "", "facts_note": "", "sources_used": [1,2,3], "slides": [ { "type": "cover", ..., "notes": "...", "fact_tags": [] }, ... exactly ${n} slides ] }
`;
  const parts = [{ text: prompt }];
  // Pictures of the template designs, so Gemini chooses by seeing them (lorem ipsum shows the layout only)
  const pics = designThumbnailParts_(ctx);
  if (pics.length) {
    parts.push({ text: 'PICTURES OF THE DESIGNS IN THE DESIGN MENU (from the 66degrees template; placeholder text shows the layout only):' });
    pics.forEach(function (pt) { parts.push(pt); });
  }
  sources.pdfs.forEach(function (b64) { parts.push({ inline_data: { mime_type: 'application/pdf', data: b64 } }); });
  (sources.images || []).forEach(function (im) { parts.push({ inline_data: { mime_type: im.mime, data: im.data } }); });

  const plan = callGeminiJSON(parts, ctx.apiKey, 0.5);
  if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) throw new Error('Gemini returned no slide content.');
  plan.slides = plan.slides.map(function (sp) { return ENGINE.cleanSpec(sp); });   // strip stray color codes
  plan.slides.forEach(function (sp) { removeHypeWords_(sp); });                // brand voice: no hype words, enforced in code
  plan.slides = plan.slides.map(function (sp) { return realChartOrStats_(sp); }); // charts only with real multi-point data
  plan.slides.forEach(function (sp) { dropRepeatedHighlights_(sp); sentenceCaseHeadings_(sp); });
  // Every stat on a slide must be found in the research, the approved facts or the user's material
  if (!sources.pdfs.length && !(sources.images || []).length) {
    const corpus = [JSON.stringify(sources.research || []), String(sources.text || ''), JSON.stringify(approvedFacts || [])].join(' ');
    const dropped = verifyStatNumbers_(plan.slides, corpus);
    if (dropped.length) ctx.log.push('Removed ' + dropped.length + ' figure(s) not found in the sources: ' + dropped.join(', ') + '.');
  }
  plan.slides.forEach(function (sp) { roundOddPrecision_(sp); });                  // "24.69%" -> "25%"
  plan.slides.forEach(function (sp) {                                            // brand rule: sentence-case titles
    if (sp.title && String(sp.type).toLowerCase() !== 'closing') sp.title = sentenceCase_(sp.title);
    if (sp.statement) sp.statement = sentenceCase_(sp.statement);
  });
  plan.slides = enforceDeckStructure_(plan.slides, n, plan.deck_title);          // cover, agenda, body, closing — exactly n
  syncAgendaToSlides_(plan.slides);                                             // agenda lists exactly the slides that exist
  if (!plan.deck_title) plan.deck_title = plan.slides[0].title || 'Presentation';
  return plan;
}

/* ---------- Deck structure and agenda sync (Create mode) ---------- */

// Guarantees: slide 1 cover, slide 2 agenda (n >= 5), last slide closing, exactly n slides.
// Extra body slides are trimmed (a next_steps slide is kept, directly before the closing).
function enforceDeckStructure_(slides, n, deckTitle) {
  const typeOf = function (sp) { return String((sp && sp.type) || '').toLowerCase(); };
  const cover = slides.filter(function (sp) { return typeOf(sp) === 'cover'; })[0] ||
    { type: 'cover', title: deckTitle || 'Presentation', subtitle: '' };
  const agenda = n >= 5 ? (slides.filter(function (sp) { return typeOf(sp) === 'agenda'; })[0] || { type: 'agenda', title: 'Agenda', items: [] }) : null;
  const closings = slides.filter(function (sp) { return typeOf(sp) === 'closing'; });
  const closing = closings[closings.length - 1] || { type: 'closing', title: 'Thank You!', subtitle: deckTitle || '' };
  let body = slides.filter(function (sp) { return ['cover', 'agenda', 'closing'].indexOf(typeOf(sp)) === -1; });
  const budget = Math.max(n - 2 - (agenda ? 1 : 0), 1);
  if (body.length > budget) {
    const next = body.filter(function (sp) { return typeOf(sp) === 'next_steps'; })[0];
    const rest = body.filter(function (sp) { return sp !== next; });
    body = next && budget >= 2 ? rest.slice(0, budget - 1).concat([next]) : rest.slice(0, budget);
    Logger.log('Plan had more body slides than fit in ' + n + ' slides; trimmed to ' + budget + '.');
  }
  return [cover].concat(agenda ? [agenda] : [], body, [closing]);
}

// Slide title shortened for an agenda row: text before a colon or dash, cut at a word boundary (max ~48 chars)
function shortTitle_(t) {
  let x = String(t || '').split(/:| — | – | - /)[0].trim();
  if (x.length > 48) x = x.slice(0, 48).replace(/\s+\S*$/, '');
  return x;
}

const COUNT_WORDS_ = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function itemCountOf_(sp) {
  const list = sp.items || sp.points || sp.results || sp.rows;
  return Array.isArray(list) ? list.length : 0;
}

// "Four headline KPI metrics" on a slide with 3 KPIs -> "Three headline KPI metrics"
function fixCountWord_(label, count) {
  const m = String(label).match(/^(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*/i);
  if (!m || !count) return label;
  const said = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : COUNT_WORDS_.indexOf(m[1].toLowerCase());
  if (said === count) return label;
  const word = /^\d+$/.test(m[1]) ? String(count) : (COUNT_WORDS_[count] || String(count));
  return word.charAt(0).toUpperCase() + word.slice(1) + ' ' + String(label).slice(m[0].length);
}

// The heading a slide actually shows (statement slides show their statement)
function slideHeading_(sp) {
  // The title shown at the top of the slide (statement slides now also show their title there)
  return String((sp.title || sp.statement) || '').trim();
}

// Rebuilds the agenda so it lists exactly the body slides that exist, in order.
// Strict rule: each agenda item is the slide's own heading, word for word; the description comes from the plan.
function syncAgendaToSlides_(slides) {
  const agenda = slides.filter(function (sp) { return String(sp.type || '').toLowerCase() === 'agenda'; })[0];
  if (!agenda) return;
  const body = slides.filter(function (sp) { return ['cover', 'agenda', 'closing'].indexOf(String(sp.type || '').toLowerCase()) === -1; });
  const given = Array.isArray(agenda.items) ? agenda.items.map(function (it) {
    return typeof it === 'string' ? { title: it, text: '' } : { title: it.title || '', text: it.text || '' };
  }) : [];
  const sameCount = given.length === body.length;
  agenda.items = body.map(function (sp, i) {
    // A count in the title must match what the slide shows ("Four KPIs" on a slide with three -> "Three KPIs")
    if (sp.title) sp.title = fixCountWord_(sp.title, itemCountOf_(sp));
    if (sp.statement) sp.statement = fixCountWord_(sp.statement, itemCountOf_(sp));
    const text = (sameCount && given[i].text) || sp.lead || sp.subtitle || '';
    return { title: slideHeading_(sp), text: text };
  });
}

/* =========================
   2-3. BEAUTIFUL.AI
========================= */

function getBeautifulKey(silent) {
  const key = PropertiesService.getScriptProperties().getProperty('BEAUTIFUL_AI_KEY');
  if (!key && !silent) throw new Error('BEAUTIFUL_AI_KEY is missing (Project Settings → Script properties).');
  return key;
}

// Deterministic, slide-by-slide brief so Beautiful.ai slide i matches content spec i
function buildBeautifulPrompt(plan) {
  const lines = [];
  const n = plan.slides.length;
  lines.push('Create a presentation titled "' + plan.deck_title + '" with EXACTLY ' + n + ' slides, in this exact order, using exactly the text given.');
  lines.push('Design rules (66degrees 2026 template): clean, flat and professional. Warm white #FFFDF9 backgrounds. Flat light neutral panel cards (#F3F2F0) with small rounded corners — no gradients, no drop shadows, no dark callout bars. One accent color: blue #0052FF. Titles top-left.');
  lines.push('VISUAL ELEMENTS: every slide needs one clear structural element — a card grid, numbered steps along a line, a native chart, a table, or large KPI numbers. Use simple single-weight line icons, not icons inside colored circles. Large blue numbers are the visual anchor on KPI slides.');
  lines.push('IMAGERY: avoid decorative photos. If an image is needed, use abstract dark technology imagery (light trails, networks). Avoid stock photos of people, hands on keyboards and generic offices.');
  lines.push('CHARTS: For any slide with categories and numeric values, use a NATIVE bar / column / line chart layout — never a chart screenshot or an icon-list substitute.');
  lines.push('DO NOT USE: logos, brand marks, product screenshots, or app UI of any real company (Google, AWS, Microsoft, etc.). Photos of identifiable people. Placeholder text ("Presenter Name", "Your Name Here"). Never leave half a slide empty — every slide fills its full width with content or a supporting visual.');
  lines.push('');
  plan.slides.forEach(function (s, i) {
    lines.push('Slide ' + (i + 1) + ' (' + describeType(s.type) + '):');
    lines.push(specToText(s));
    const brief = designBriefFor(s.reference);
    if (brief) lines.push('Design: ' + brief);
    lines.push('');
  });
  return lines.join('\n');
}

function describeType(t) {
  // Layout language of the 66degrees 2026 template (see the reference library slideTypeMapping)
  return ({
    cover: 'title slide: large title and subtitle on the left, white background, blue band along the bottom',
    agenda: 'agenda: numbered rows, each with a small square number badge, a bold topic and a one-line description',
    statement: 'one key message in a large callout, with at most three short supporting points',
    cards: 'equal flat panel cards in a grid, each with a blue number or a small line icon, a short heading and a description',
    process: 'numbered steps left to right along a thin line with blue numbered dots, a short title and a description under each step',
    timeline: 'horizontal timeline: a blue band with period markers and short milestone callouts above and below',
    stats: '3-4 KPI cards in a row, each with a large blue number, a label and a one-line description',
    chart: 'native chart (bar/column/line) in a light panel with a short insight next to it',
    comparison: 'two columns with blue header bars and matching bullet lists',
    table: 'table with a blue header row (white bold text) and light row separators',
    case_study: 'case study in three columns: challenge, how we helped, and an impact panel with 2-3 large blue numbers',
    bullets: 'grouped bullets under short blue headings inside one white card on a light panel background',
    next_steps: 'numbered next steps in a row of cards with short timing labels',
    quote: 'pull quote with attribution',
    section: 'section divider: dark background, white title on the left',
    closing: 'thank-you slide with a "Stay Connected" contact panel on the right'
  })[t] || 'content';
}

function specToText(s) {
  const out = [];
  const add = function (label, v) { if (v) out.push(label + ': ' + v); };
  add('Eyebrow', s.eyebrow);
  add('Title', s.title || s.statement);
  add('Subtitle', s.subtitle || s.lead);
  if (s.statement && s.title) add('Statement', s.statement);
  add('Text', s.text);
  (s.items || []).forEach(function (it, k) {
    out.push('- Item ' + (k + 1) + ': ' + [it.date, it.value, it.title || it.label, it.text, it.timing].filter(function (x) { return x; }).join(' | '));
  });
  (s.points || []).forEach(function (p) { out.push('- ' + (typeof p === 'string' ? p : [p.title, p.text].filter(Boolean).join(': '))); });
  if (s.chart) {
    out.push('Chart type: ' + (s.chart.type || 'column') + (s.chart.unitLabel ? ' (' + s.chart.unitLabel + ')' : ''));
    out.push('Categories: ' + (s.chart.categories || []).join(', '));
    (s.chart.series || []).forEach(function (se) { out.push('Series "' + se.name + '": ' + (se.values || []).join(', ')); });
  }
  if (s.insight) add('Key insight', [s.insight.title, s.insight.text].filter(Boolean).join(' — '));
  ['left', 'right'].forEach(function (k) {
    if (s[k]) out.push((k === 'left' ? 'Left' : 'Right') + ' column "' + (s[k].label || '') + ' – ' + (s[k].title || '') + '": ' + (s[k].points || []).join('; '));
  });
  if (s.columns) out.push('Table columns: ' + s.columns.join(' | '));
  (s.rows || []).forEach(function (r) { out.push('Row: ' + r.join(' | ')); });
  add('Challenge', s.challenge);
  add('Solution', s.solution);
  (s.results || []).forEach(function (r) { out.push('Result: ' + r.value + ' ' + r.label); });
  if (s.callout) add('Callout', [s.callout.title, s.callout.text].filter(Boolean).join(' — '));
  add('Call to action', s.cta);
  add('Quote', s.quote);
  add('Attribution', s.attribution);
  return out.join('\n');
}

function beautifulRequest(path, body) {
  const resp = UrlFetchApp.fetch(CONFIG.beautifulApiBase + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getBeautifulKey() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
    followRedirects: true
  });
  const code = resp.getResponseCode();
  let json = {};
  try { json = JSON.parse(resp.getContentText()); } catch (e) {}
  if (code === 401) throw new Error('Beautiful.ai rejected the API key (401). Check BEAUTIFUL_AI_KEY.');
  if (code === 403) throw new Error('Beautiful.ai API access is not enabled for this account (403).');
  if (code === 429) throw new Error('Beautiful.ai rate limit reached (429). Please try again in a minute.');
  if (code >= 300) throw new Error('Beautiful.ai error ' + code + ': ' + (json.message || resp.getContentText().slice(0, 200)));
  return json;
}

function beautifulGenerate(prompt, title) {
  const body = { prompt: prompt };
  if (CONFIG.beautifulThemeId) body.themeId = CONFIG.beautifulThemeId;
  let res = beautifulRequest('/generatePresentation', body);
  if (!res.presentationId) throw new Error('Beautiful.ai did not return a presentation.');
  if (res.status && res.status !== 'completed') {
    for (let i = 0; i < 12 && res.status !== 'completed'; i++) {   // wait up to ~60s if generation is asynchronous
      Utilities.sleep(5000);
      res = beautifulRequest('/getPresentation', { presentationId: res.presentationId });
    }
  }
  return res;
}

// NOTE: exportPresentation is not in Beautiful.ai's public docs (found by testing). If it changes, this step fails with a clear error.
function beautifulExportPptx(presentationId) {
  const res = beautifulRequest('/exportPresentation', { presentationId: presentationId, format: 'pptx', pptxMode: 'editable' });
  if (!res.downloadUrl) throw new Error('Beautiful.ai export did not return a download link.');
  const file = UrlFetchApp.fetch(res.downloadUrl, {
    headers: { Authorization: 'Bearer ' + getBeautifulKey() },
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (file.getResponseCode() !== 200) throw new Error('Could not download the Beautiful.ai export (HTTP ' + file.getResponseCode() + ').');
  return file.getBlob().setName('beautiful-export.pptx')
    .setContentType('application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

/* =========================
   4. PPTX -> GOOGLE SLIDES
   Office→Google conversion historically used Drive REST upload, which attempts to
   enable the Drive API on the script GCP project at runtime. That fails for
   ordinary end users. We never call drive.googleapis.com here.
========================= */

function convertPptxToSlides(blob, name) {
  // Optional Beautiful.ai / ShapeKit path only. DriveApp cannot convert PPTX→Slides.
  // Callers must treat failure as soft (ShapeKit falls back to square boxes).
  throw new Error(
    'PowerPoint→Google Slides conversion is unavailable without Drive REST API calls. ' +
    'Default Create draws directly into the open presentation and does not need this step.'
  );
}

function trashDriveFile(id) {
  trashDriveFileById_(id);
}

/* =========================
   6. COPY INTO THE USER'S DECK
========================= */

function copyIntoDeck(sourceId, target, blankDeck) {
  const src = SlidesApp.openById(sourceId);
  const factor = target.getPageWidth() / src.getPageWidth();
  const before = target.getSlides();
  const newIds = [];
  src.getSlides().forEach(function (s) {
    const copy = target.insertSlide(target.getSlides().length, s);
    newIds.push(copy.getObjectId());
  });
  if (blankDeck && before.length === 1) { try { before[0].remove(); } catch (e) {} }

  if (Math.abs(factor - 1) > 0.01) {
    // Google Slides usually resizes copied slides to the new page size itself. Only scale if it did not
    // (content still reaching past the page edge) — scaling twice shrinks everything to a corner.
    const targetId = target.getId();
    const targetW = target.getPageWidth();
    flushPresentation(target);
    if (copiedContentOverflows(targetId, newIds, targetW)) scaleSlides(targetId, newIds, factor);
  }
  return newIds.length;
}

function copiedContentOverflows(presId, pageIds, pageW) {
  const pres = Slides.Presentations.get(presId, { fields: 'slides(objectId,pageElements(objectId,size,transform))' });
  let maxRight = 0;
  (pres.slides || []).forEach(function (page) {
    if (pageIds.indexOf(page.objectId) === -1) return;
    (page.pageElements || []).forEach(function (el) {
      const t = el.transform || {}, sz = el.size || {};
      const w = ((sz.width && sz.width.magnitude) || 0) * (t.scaleX === undefined ? 1 : t.scaleX) / 12700;
      maxRight = Math.max(maxRight, (t.translateX || 0) / 12700 + Math.abs(w));
    });
  });
  return maxRight > pageW * 1.1;
}

// Scales every element (position, size) and every font size on the given slides
function scaleSlides(presId, pageIds, f) {
  const pres = Slides.Presentations.get(presId, { fields: 'slides(objectId,pageElements)' });
  const requests = [];
  (pres.slides || []).forEach(function (page) {
    if (pageIds.indexOf(page.objectId) === -1) return;
    (page.pageElements || []).forEach(function (el) {
      const t = el.transform || {};
      requests.push({
        updatePageElementTransform: {
          objectId: el.objectId,
          applyMode: 'ABSOLUTE',
          transform: {
            scaleX: (t.scaleX === undefined ? 1 : t.scaleX) * f,
            scaleY: (t.scaleY === undefined ? 1 : t.scaleY) * f,
            shearX: (t.shearX || 0) * f,
            shearY: (t.shearY || 0) * f,
            translateX: (t.translateX || 0) * f,
            translateY: (t.translateY || 0) * f,
            unit: t.unit || 'EMU'
          }
        }
      });
      forEachText(el, function (objectId, cellLocation, te) {
        const size = te.textRun.style && te.textRun.style.fontSize && te.textRun.style.fontSize.magnitude;
        if (!size) return;
        const req = {
          updateTextStyle: {
            objectId: objectId,
            style: { fontSize: { magnitude: Math.max(6, Math.round(size * f * 2) / 2), unit: 'PT' } },
            textRange: { type: 'FIXED_RANGE', startIndex: te.startIndex || 0, endIndex: te.endIndex },
            fields: 'fontSize'
          }
        };
        if (cellLocation) req.updateTextStyle.cellLocation = cellLocation;
        requests.push(req);
      });
    });
  });
  runBatches(presId, requests, { failed: 0 });
}

// Calls fn(objectId, cellLocation, textElement) for every text run in an element (recurses into groups and tables)
function forEachText(el, fn) {
  if (el.elementGroup) {
    (el.elementGroup.children || []).forEach(function (c) { forEachText(c, fn); });
    return;
  }
  const visit = function (objectId, cell, text) {
    (text && text.textElements || []).forEach(function (te) {
      if (te.textRun && te.textRun.content && te.textRun.content.replace(/\s/g, '') && te.endIndex !== undefined) fn(objectId, cell, te);
    });
  };
  if (el.shape && el.shape.text) visit(el.objectId, null, el.shape.text);
  if (el.table && el.table.tableRows) {
    el.table.tableRows.forEach(function (row, r) {
      (row.tableCells || []).forEach(function (cell, c) {
        const loc = cell.location || { rowIndex: r, columnIndex: c };
        if (cell.text) visit(el.objectId, { rowIndex: loc.rowIndex || 0, columnIndex: loc.columnIndex || 0 }, cell.text);
      });
    });
  }
}

/* =========================
   SCITE.AI RESEARCH LAYER
   Pulls real academic papers on the deck topic; Gemini uses them as the factual basis.
========================= */

function getSciteKey(silent) {
  const key = PropertiesService.getScriptProperties().getProperty('SCITE_API_KEY');
  if (!key && !silent) throw new Error('SCITE_API_KEY is missing (Project Settings → Script properties).');
  return key;
}

function sciteResearch(topic, ctx) {
  const key = getSciteKey();
  // Strip presentation directives so Scite searches the actual topic, not our formatting instructions.
  const term = String(topic || '')
    .replace(/^\s*\d+[\- ]slide[s]?\s+(analysis|overview|deck|presentation|report|brief|summary)?\s*(of|on|about|covering|for)?\s*/i, '')
    .replace(/\b(include|add|show|render|create)\s+(a|an|the)?\s*(bar\s+chart|line\s+chart|pie\s+chart|column\s+chart|table|graph|kpi|infographic|diagram)[^.]*\.?/gi, '')
    .replace(/\b(close|end|finish|start|begin)\s+with[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
  if (!term) return [];
  ctx.log.push('Scite query: "' + term + '"');
  // Scite's default sort is by relevancy; passing sort=relevancy explicitly returns HTTP 400.
  const url = CONFIG.sciteApiBase + '/api_partner/search'
    + '?term=' + encodeURIComponent(term)
    + '&limit=' + CONFIG.sciteMaxPapers;
  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    muteHttpExceptions: true,
    followRedirects: true
  });
  const code = resp.getResponseCode();
  if (code === 401) throw new Error('Scite.ai rejected the API key (401). Check SCITE_API_KEY.');
  if (code === 403) throw new Error('Scite.ai API access is not enabled for this account (403).');
  if (code === 429 && !ctx.sciteRetried) {                 // rate limit: wait briefly and try once more
    ctx.sciteRetried = true;
    Utilities.sleep(6000);
    return sciteResearch(topic, ctx);
  }
  if (code === 429) throw new Error('Scite.ai rate limit reached (429). Please try again in a minute.');
  if (code >= 300) throw new Error('Scite.ai error ' + code + ': ' + resp.getContentText().slice(0, 200));
  let json = {};
  try { json = JSON.parse(resp.getContentText()); } catch (e) { return []; }
  const hits = json.hits || [];
  const strip = function (s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };
  return hits.slice(0, CONFIG.sciteMaxPapers).map(function (h, i) {
    return {
      n: i + 1,
      title: strip(h.title),
      authors: (h.authors || []).slice(0, 3).map(function (a) { return a.authorName; }).join(', '),
      year: h.year || (h.date || '').slice(0, 4),
      journal: h.journal || h.shortJournal || '',
      doi: h.doi || '',
      abstract: strip(h.abstract).slice(0, 900),
      excerpts: (h.fulltextExcerpts || []).slice(0, 3).map(function (e) { return strip(e).slice(0, 320); }),
      tally: h.tally ? {
        supporting: h.tally.supporting || 0,
        contradicting: h.tally.contradicting || 0,
        mentioning: h.tally.mentioning || 0,
        citations: h.tally.citingPublications || 0
      } : null
    };
  });
}

function formatSciteForPrompt(papers, provider) {
  if (!papers || !papers.length) return '';
  const origin = provider === 'gemini_search' ? 'from Google Search via Gemini'
    : provider === 'gemini_knowledge' ? 'from Gemini background knowledge; every number from these must be marked "Illustrative figure – validate before sharing." in the notes'
    : 'from Scite.ai';
  const out = ['RESEARCH SOURCES (' + origin + ' — MANDATORY factual basis for this deck):'];
  papers.forEach(function (p) {
    out.push('');
    out.push('[' + p.n + '] ' + p.title);
    if (p.authors) out.push('    Authors: ' + p.authors + (p.year ? ' (' + p.year + ')' : ''));
    if (p.journal) out.push('    Journal: ' + p.journal);
    if (p.doi) out.push('    DOI: ' + p.doi);
    if (p.url) out.push('    URL: ' + p.url);
    if (p.tally) out.push('    Citations: ' + p.tally.citations + ' total, ' + p.tally.supporting + ' supporting, ' + p.tally.contradicting + ' contradicting');
    if (p.abstract) out.push('    Abstract: ' + p.abstract);
    if (p.excerpts && p.excerpts.length) {
      out.push('    Key excerpts:');
      p.excerpts.forEach(function (e) { out.push('      - ' + e); });
    }
  });
  return out.join('\n');
}

/* =========================
   RESEARCH FALLBACK: GEMINI
   Used when Scite.ai is unavailable (no key, error, rate limit) or finds nothing.
   1. Gemini with Google Search grounding: current web sources with real links.
   2. If search grounding is not available: Gemini's own knowledge, clearly flagged for verification.
   Returns { provider: 'gemini_search' | 'gemini_knowledge', sources: [...] } in the same shape as sciteResearch,
   so planning and everything after it works unchanged.
========================= */

function geminiResearch(topic, ctx) {
  const started = Date.now();
  const ask = [
    'You are a research analyst. Research this presentation topic and collect the most useful, recent and credible facts,',
    'statistics, trends and examples (industry reports, analyst firms, vendor research, reputable news, academic work).',
    'TOPIC: "' + String(topic).slice(0, 600) + '"',
    '',
    'Return ONLY JSON: {"sources":[{"title":"","publisher":"","year":"","url":"","summary":"2-3 sentences","findings":["one concrete fact or number per item", "..."]}]}',
    'Give 5-8 sources, each with 2-4 findings. Never invent numbers; if unsure, leave the finding out.'
  ].join('\n');

  // 1. Grounded with Google Search
  try {
    const res = callGeminiText_([{ text: ask }], ctx.apiKey, { tools: [{ google_search: {} }], temperature: 0.2, maxModels: 1, attempts: 1 });
    const parsed = parseJsonLoose_(res.text);
    const web = (res.grounding || []).filter(function (c) { return c.web && c.web.uri; }).map(function (c) { return c.web; });
    let list = (parsed && parsed.sources) || [];
    if (!list.length && web.length) list = web.map(function (w) { return { title: w.title, url: w.uri, findings: [] }; });
    if (list.length) {
      // Prefer the links Google Search actually returned over URLs written by the model
      list.forEach(function (src, i) { if (web[i] && !/^https?:/.test(String(src.url || ''))) src.url = web[i].uri; });
      return { provider: 'gemini_search', sources: toResearchSources_(list) };
    }
  } catch (e) {
    Logger.log('Gemini search research failed: ' + e.message);
    ctx.log.push('Gemini web search not available: ' + String(e.message).slice(0, 160));
  }

  // 2. Gemini's own knowledge (no live web access) - only if research has not already used up its time
  checkCancel_(ctx);
  if (Date.now() - started > 45000) throw new Error('web research took too long');
  const plain = callGeminiJSON([{ text: ask + '\nYou have no web access: use well-known published sources only, and leave url empty if unsure.' }], ctx.apiKey, 0.2);
  const list2 = (plain && plain.sources) || [];
  if (!list2.length) throw new Error('Gemini returned no research.');
  return { provider: 'gemini_knowledge', sources: toResearchSources_(list2) };
}

function toResearchSources_(list) {
  const clean = function (x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); };
  return list.slice(0, CONFIG.sciteMaxPapers || 8).map(function (src, i) {
    return {
      n: i + 1,
      title: clean(src.title).slice(0, 200),
      authors: '',
      year: clean(src.year).slice(0, 4),
      journal: clean(src.publisher),
      doi: '',
      url: clean(src.url),
      abstract: clean(src.summary).slice(0, 900),
      excerpts: (Array.isArray(src.findings) ? src.findings : []).slice(0, 4).map(function (f) { return clean(f).slice(0, 320); }),
      tally: null
    };
  }).filter(function (p) { return p.title || p.abstract || p.excerpts.length; });
}

// Plain-text Gemini call (needed for tools such as Google Search, which cannot be combined with JSON mode).
// Returns { text, grounding: [groundingChunks] }.
function callGeminiText_(parts, apiKey, opts) {
  opts = opts || {};
  requireVertexConfig_();
  const models = modelCandidates(apiKey, 'text').slice(0, opts.maxModels || 2);
  const body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: opts.temperature == null ? 0.3 : opts.temperature } };
  if (opts.tools) body.tools = opts.tools;
  let lastError = 'no response';
  for (let m = 0; m < models.length; m++) {
    for (let attempt = 0; attempt < (opts.attempts || 2); attempt++) {
      try {
        const json = callVertexGemini_(body, { model: models[m] }).result;
        const cand = json.candidates && json.candidates[0];
        const text = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
        if (text) return { text: text, grounding: (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [] };
        lastError = 'empty response';
      } catch (e) {
        lastError = e.message;
        if (/not enabled|VERTEX_PROJECT_ID is not configured|authentication failed/i.test(lastError)) throw e;
        if (isRetryable(0, lastError) && attempt + 1 < (opts.attempts || 2)) { Utilities.sleep(3000); continue; }
        break;
      }
    }
  }
  throw new Error(lastError);
}

function parseJsonLoose_(raw) {
  const t = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}

/* =========================
   SPEAKER NOTES
   Fact IDs and internal remarks are removed; research numbers become a readable "Sources:" line.
========================= */
function finalizeNotes_(plan, sources) {
  const research = (sources && sources.research) || [];
  plan.slides.forEach(function (sp) {
    let notes = String(sp.notes || '');
    const used = {};
    (notes.match(/\[(\d+(?:\s*[,;–-]\s*\d+)*)\]/g) || []).forEach(function (m) {
      m.replace(/\d+/g, function (d) { used[d] = true; return d; });
    });
    notes = notes
      .replace(/\s*[\[(]\s*66D_[A-Z0-9_]+(?:\s*[,;\]\[)(]+\s*66D_[A-Z0-9_]+)*\s*[\])]/g, '')
      .replace(/\s*66D_[A-Z]+_[A-Z0-9_]+/g, '')
      .replace(/\s*\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/g, '')
      .replace(/No reference slide in the 66degrees template[^.]*\.?/gi, '')
      .replace(/[ \t]{2,}/g, ' ').trim();
    const list = Object.keys(used).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      const src = research.filter(function (r) { return r.n === k; })[0];
      if (!src) return '';
      return '[' + k + '] ' + src.title + (src.journal ? ' (' + src.journal + (src.year ? ', ' + src.year : '') + ')' : (src.year ? ' (' + src.year + ')' : '')) + (src.url ? ' ' + src.url : (src.doi ? ' doi:' + src.doi : ''));
    }).filter(Boolean);
    if (list.length) notes += (notes ? '\n\n' : '') + 'Sources:\n' + list.join('\n');
    sp.notes = notes;
  });
}

/* =========================
   DRAWING THE SLIDES (Create mode without Beautiful.ai)
========================= */

// Empty working presentation (16:9) with one blank slide per planned slide
function createWorkingDeck_(title, count) {
  // Used only by the optional Beautiful.ai path. The default Create pipeline never calls this.
  const pres = SlidesApp.create((title || 'Generated deck') + ' (working copy)');
  const first = pres.getSlides()[0];
  for (let i = 0; i < count; i++) pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  if (first) first.remove();
  pres.saveAndClose();
  return pres.getId();
}

function drawSlidesIntoActive_(target, specs, ctx, blankDeck) {
  const stats = { slides: specs.length, fonts: 0, colors: 0, icons: 0, removed: 0, redrawn: 0, normalized: 0, failed: 0, libraryIcons: 0, issues: 0 };
  const pageW = target.getPageWidth(), pageH = target.getPageHeight();
  const dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');
  progressStage_(ctx, 'brand', 'active', 'Drawing ' + specs.length + ' slides in this presentation');

  const slidesToRender = [];
  if (blankDeck) {
    while (target.getSlides().length < specs.length) {
      target.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    }
    const all = target.getSlides();
    for (let i = 0; i < specs.length; i++) slidesToRender.push(all[i]);
  } else {
    for (let i = 0; i < specs.length; i++) {
      slidesToRender.push(target.appendSlide(SlidesApp.PredefinedLayout.BLANK));
    }
  }

  slidesToRender.forEach(function (slide, i) {
    checkCancel_(ctx);
    progressSlide_(ctx, i, 'active');
    try {
      renderEngineSlide(slide, specs[i], i + 1, ctx, pageW, pageH, dateLabel);
      stats.redrawn++;
    } catch (e) {
      stats.failed++;
      ctx.log.push('Slide ' + (i + 1) + ' could not be drawn: ' + e.message);
    }
    progressSlide_(ctx, i, 'done');
  });

  if (blankDeck) {
    const leftover = target.getSlides();
    for (let i = leftover.length - 1; i >= specs.length; i--) {
      try { leftover[i].remove(); } catch (e) {}
    }
  }

  stats.libraryIcons = ctx.libraryIconsPlaced || 0;
  progressStage_(ctx, 'brand', 'done', stats.redrawn + ' slides drawn in this presentation');
  return stats;
}

// Draws every planned slide with the layout engine into a working copy (Beautiful.ai / admin path only).
function drawSlidesFromPlan_(presId, specs, ctx) {
  const stats = { slides: specs.length, fonts: 0, colors: 0, icons: 0, removed: 0, redrawn: 0, normalized: 0, failed: 0, libraryIcons: 0, issues: 0 };
  const deck = SlidesApp.openById(presId);
  const pageW = deck.getPageWidth(), pageH = deck.getPageHeight();
  const dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');
  progressStage_(ctx, 'brand', 'active', 'Drawing ' + specs.length + ' slides in the 66degrees template');
  deck.getSlides().forEach(function (slide, i) {
    checkCancel_(ctx);
    progressSlide_(ctx, i, 'active');
    try {
      renderEngineSlide(slide, specs[i], i + 1, ctx, pageW, pageH, dateLabel);
      stats.redrawn++;
    } catch (e) {
      stats.failed++;
      ctx.log.push('Slide ' + (i + 1) + ' could not be drawn: ' + e.message);
    }
    progressSlide_(ctx, i, 'done');
  });
  deck.saveAndClose();
  stats.libraryIcons = ctx.libraryIconsPlaced || 0;
  progressStage_(ctx, 'brand', 'done', stats.redrawn + ' slides drawn');
  return stats;
}

/* =========================
   UPLOADED SOURCE FILE (dialog upload button)
   PDF and images go to Gemini as they are; text, CSV and JSON are read directly;
   Word, Excel and PowerPoint files are converted by Google Drive, read as text, and the copy is deleted.
========================= */
function readUploadedFile_(upload, sources) {
  const name = String(upload.name || 'file');
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] ? name.match(/\.([a-z0-9]+)$/i)[1].toLowerCase() : '';
  const bytes = Utilities.base64Decode(String(upload.data));
  if (bytes.length > 20 * 1024 * 1024) throw new Error('The uploaded file is larger than 20 MB.');
  const mime = String(upload.mimeType || '');
  const addText = function (text) {
    sources.text += (sources.text ? '\n\n' : '') + 'UPLOADED FILE "' + name + '":\n' + String(text).slice(0, CONFIG.maxSourceChars);
  };

  if (ext === 'pdf' || mime === 'application/pdf') { sources.pdfs.push(String(upload.data)); return; }
  if (/^(png|jpe?g|webp|gif)$/.test(ext) || /^image\//.test(mime)) {
    sources.images.push({ mime: mime || ('image/' + (ext === 'jpg' ? 'jpeg' : ext)), data: String(upload.data) });
    return;
  }
  if (/^(txt|md|csv|tsv|json|xml|html?|rtf)$/.test(ext) || /^text\//.test(mime)) {
    addText(Utilities.newBlob(bytes).getDataAsString());
    return;
  }
  if (/^(doc|docx|odt|xls|xlsx|ods|ppt|pptx|odp)$/.test(ext)) {
    // Office→Google conversion previously used Drive REST upload/export, which
    // triggers "Permission denied while enabling APIs: drive" for end users.
    // Accept PDF / text / CSV / images / Google Workspace links instead.
    throw new Error(
      'Uploaded .' + ext + ' files are not converted via the Drive REST API. ' +
      'Please upload a PDF, CSV, text or image, or paste a Google Docs / Sheets / Slides link.'
    );
  }
  throw new Error('This file type is not supported (' + name + '). Use PDF, CSV, text, an image, or a Google Docs/Sheets/Slides link.');
}

// Kept for admin/Beautiful.ai callers that previously converted Office blobs.
// Intentionally does not call drive.googleapis.com.
function convertUploadToGoogle_(blob, name, targetMime) {
  throw new Error(
    'convertUploadToGoogle_ is disabled: Drive REST conversion is not used (avoids runtime Drive API enablement).'
  );
}

/* =========================
   FIT CHECK (Create mode)
   Every planned slide is laid out in its chosen design at the standard type sizes (ENGINE.measure).
   Texts that would be cut are rewritten shorter; body boxes under half full get fuller text. Exact character limits.
========================= */
function fitContentToDesigns_(plan, ctx, started) {
  const res = { fixed: 0, left: 0 };
  for (let round = 0; round < 2; round++) {
    if (Date.now() - started > 230000) break;                     // stay well inside the 6-minute limit
    const issues = [];
    plan.slides.forEach(function (sp, i) {
      const t = String(sp.type || '').toLowerCase();
      // Titles stay on one line; agenda descriptions stay on one line
      if (['cover', 'closing', 'agenda'].indexOf(t) === -1 && sp.title && !ENGINE.titleFits(sp.title)) {
        issues.push({ slide: i, path: ['title'], current: sp.title, action: 'shorten', min_chars: 32, max_chars: ENGINE.titleMaxChars(sp.title) });
      }
      if (t === 'agenda' && Array.isArray(sp.items)) sp.items.forEach(function (it, k) {
        if (it && typeof it === 'object' && it.text && !ENGINE.agendaTextFits(it.text)) {
          issues.push({ slide: i, path: ['items', k, 'text'], current: it.text, action: 'shorten', min_chars: 30, max_chars: ENGINE.agendaTextMaxChars(it.text) });
        }
      });
      if (['cover', 'closing', 'section'].indexOf(t) !== -1) return;
      const m = ENGINE.measure(sp, { tokens: ctx.tokens || null });
      m.overflow.forEach(function (o) {
        const path = findTextPath_(sp, o.text);
        if (path) issues.push({ slide: i, path: path, current: o.text, action: 'shorten', min_chars: Math.floor(o.maxChars * 0.7), max_chars: o.maxChars });
      });
      if (round === 0) m.underfill.forEach(function (u) {
        const path = findTextPath_(sp, u.text);
        if (path) issues.push({ slide: i, path: path, current: u.text, action: 'expand',
          min_chars: Math.min(u.minChars, u.text.length + 120), max_chars: Math.min(u.maxChars, u.text.length + 180, 300) });
      });
    });
    if (!issues.length) break;
    const list = issues.slice(0, 40).map(function (it, k) {
      return { id: k, slide_title: slideHeading_(plan.slides[it.slide]), action: it.action, min_chars: it.min_chars, max_chars: it.max_chars, text: it.current };
    });
    const prompt = [
      'You are editing text on 66degrees consulting slides so that every text fits its box exactly.',
      'For each item, rewrite "text" so its length (characters, spaces included) is between min_chars and max_chars.',
      '- action "shorten": keep the key message, numbers and names; cut filler words.',
      '- action "expand": add ONE or TWO short, specific sentences (how it works, why it matters, a concrete example). Never repeat',
      '  the slide title or its words, never pad with filler, never add new numbers, clients, awards or claims about 66degrees.',
      '- Plain text, one piece of text per item, no quotation marks, no reference markers like [1], no hype words.',
      'Return ONLY JSON: {"fixes":[{"id":0,"text":"..."}]}',
      '',
      'ITEMS:',
      JSON.stringify(list)
    ].join('\n');
    let out = null;
    try { out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.3); } catch (e) { ctx.log.push('Fit check skipped: ' + e.message); break; }
    ((out && out.fixes) || []).forEach(function (f) {
      const it = issues[f.id];
      if (!it || !f.text) return;
      const txt = ENGINE.cleanText(String(f.text));
      if (it.action === 'shorten' && txt.length > it.max_chars * 1.05) return;   // still too long: keep trying next round
      setByPath_(plan.slides[it.slide], it.path, it.path[0] === 'title' ? sentenceCase_(txt.replace(/[.]$/, '')) : txt);
      res.fixed++;
    });
    checkCancel_(ctx);
  }
  // what still does not fit is handled by the engine (one notch smaller type for that slide)
  plan.slides.forEach(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (['cover', 'closing', 'section'].indexOf(t) !== -1) return;
    res.left += ENGINE.measure(sp, { tokens: ctx.tokens || null }).overflow.length;
  });
  syncAgendaToSlides_(plan.slides);
  return res;
}

// Path of the string field whose (cleaned) value is exactly `text`, e.g. ['items', 2, 'text']; null if none
function findTextPath_(obj, text) {
  const skip = { reference: 1, notes: 1, fact_tags: 1, design: 1, type: 1, title: 1, statement: 1 };
  let found = null;
  (function walk(o, path) {
    if (found || o == null) return;
    if (typeof o === 'string') { if (ENGINE.cleanText(o) === text) found = path.slice(); return; }
    if (Array.isArray(o)) { o.forEach(function (v, i) { walk(v, path.concat([i])); }); return; }
    if (typeof o === 'object') Object.keys(o).forEach(function (k) { if (!(path.length === 0 && skip[k])) walk(o[k], path.concat([k])); });
  })(obj, []);
  return found;
}

function setByPath_(obj, path, value) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
  o[path[path.length - 1]] = value;
}

// "Driving Business Value With AI" -> "Driving business value with AI". Acronyms, numbers and known names keep their case.
function sentenceCase_(t) {
  const str = String(t || '').trim();
  const words = str.split(/\s+/);
  const plain = words.filter(function (w) { return /^[A-Za-z][a-z]/.test(w); });          // ordinary words (not acronyms/numbers)
  const caps = plain.filter(function (w) { return /^[A-Z]/.test(w); }).length;
  if (plain.length < 3 || caps < plain.length * 0.6) return str;      // already sentence case
  const keep = /^(AI|ML|ROI|KPIs?|CIO|CFO|CEO|CTO|IT|API|GCP|AWS|SAP|LLMs?|MLOps|LLMOps|GenAI|Google|Gemini|Workspace|BigQuery|Vertex|Looker|Cloud|66degrees|Microsoft|Azure|Salesforce|SharePoint|CSAT|NPS|SaaS|B2B|US|UK|EU|Q[1-4])$/;
  let first = true;
  return words.map(function (w) {
    const bare = w.replace(/[^A-Za-z0-9]/g, '');
    let out = w;
    if (!first && !keep.test(bare) && !/[0-9]/.test(bare) && !/^[A-Z]{2,}$/.test(bare)) out = w.toLowerCase();
    first = /[:.!?]$/.test(w) ? false : false;
    return out;
  }).join(' ').replace(/^./, function (c) { return c.toUpperCase(); })
    .replace(PRODUCT_NAMES_RE_, function (m) { return PRODUCT_NAMES_[m.toLowerCase()] || m; });
}

// Product and proper names that keep their capitals inside sentence-case titles
const PRODUCT_NAMES_ = {};
['Gemini Enterprise', 'Gemini for Google Workspace', 'Google Workspace', 'Google Cloud', 'Google Cloud Platform', 'Vertex AI',
 'Admin Console', 'Agentspace', 'NotebookLM', 'Looker Studio', 'Cloud SQL', 'Microsoft 365'].forEach(function (n) { PRODUCT_NAMES_[n.toLowerCase()] = n; });
const PRODUCT_NAMES_RE_ = new RegExp('\\b(' + Object.keys(PRODUCT_NAMES_).sort(function (a, b) { return b.length - a.length; })
  .map(function (n) { return n.replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi');

// Template thumbnails of the designs in the design menu (saved by the harvest), as Gemini image parts
function designThumbnailParts_(ctx) {
  const parts = [];
  if (!ctx.refRuntime || !ctx.refRuntime.thumbs || typeof ENGINE === 'undefined') return parts;
  const started = Date.now();
  Object.keys(ENGINE.VARIANTS).forEach(function (type) {
    ENGINE.VARIANTS[type].forEach(function (v) {
      if (parts.length >= 40 || Date.now() - started > 15000) return;
      const blob = referenceThumbnailBlob(v.tag, ctx);
      if (!blob) return;
      parts.push({ text: 'Design ' + v.tag + ' (' + type + '):' });
      parts.push({ inline_data: { mime_type: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes()) } });
    });
  });
  return parts;
}

/* =========================
   DESIGN BY CONTENT
   For every slide whose type has several template designs, each design is laid out with the real content.
   Score: overflow is heavily penalised, half-empty boxes are penalised, Gemini's choice and variety get a bonus.
========================= */
function chooseDesignsByContent_(plan, ctx) {
  if (typeof ENGINE === 'undefined' || !ENGINE.variantsFor) return 0;
  let swaps = 0;
  const used = {};
  let prevTag = null;
  plan.slides.forEach(function (sp) {
    const type = normalizeType_(sp.type);
    const designs = drawableDesigns_(type, itemCount_(sp), sp);
    const current = sp.reference && sp.reference.tag;
    if (designs.length < 2) { prevTag = current; if (current) used[current] = (used[current] || 0) + 1; return; }
    let best = null;
    designs.forEach(function (d) {
      const trial = Object.assign({}, sp, { reference: Object.assign({}, sp.reference || {}, { tag: d.tag }) });
      const m = ENGINE.measure(trial, { tokens: ctx.tokens || null });
      let score = 100;
      score -= 35 * m.overflow.length;                               // text that would not fit
      score -= 80 * Math.max(0, 0.5 - m.fill);                      // half-empty boxes
      if (sp.design && String(sp.design).trim() === d.tag) score += 12;   // Gemini's choice
      if (d.tag === prevTag) score -= 15;                           // not the same design twice in a row
      score -= 25 * (used[d.tag] || 0);                             // a design is used once per deck when there is another that fits
      if (!best || score > best.score) best = { tag: d.tag, score: score };
    });
    if (best && best.tag !== current) {
      sp.reference = referenceForTag_(ctx.lib, best.tag);
      swaps++;
    }
    prevTag = sp.reference ? sp.reference.tag : null;
    if (prevTag) used[prevTag] = (used[prevTag] || 0) + 1;
  });
  return swaps;
}

// Brand voice: hype words are replaced with plain ones in every slide text (titles included)
const HYPE_WORDS_ = {
  'unprecedented': 'significant', 'unparalleled': 'strong', 'unmatched': 'strong', 'world-class': 'proven',
  'cutting-edge': 'modern', 'revolutionary': 'major', 'seamless': 'smooth', 'seamlessly': 'smoothly',
  'best-in-class': 'leading', 'game-changing': 'major', 'groundbreaking': 'new', 'state-of-the-art': 'modern',
  'transformative': 'meaningful'
};
function removeHypeWords_(obj) {
  const re = new RegExp('\\b(' + Object.keys(HYPE_WORDS_).map(function (w) { return w.replace(/-/g, '\\-'); }).join('|') + ')\\b', 'gi');
  const fix = function (str) {
    return str.replace(re, function (m) {
      const r = HYPE_WORDS_[m.toLowerCase()];
      return m.charAt(0) === m.charAt(0).toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
    });
  };
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'notes' || k === 'design' || k === 'type') return;
      if (typeof o[k] === 'string') o[k] = fix(o[k]); else walk(o[k]);
    });
  })(obj);
}

// Box headings (card titles, labels, column headers) also in sentence case
function sentenceCaseHeadings_(sp) {
  const fix = function (o, k) { if (o && typeof o[k] === 'string') o[k] = sentenceCase_(o[k]); };
  (sp.items || []).forEach(function (it) { if (it && typeof it === 'object') { fix(it, 'title'); fix(it, 'label'); } });
  (sp.points || []).forEach(function (p) { if (p && typeof p === 'object') fix(p, 'title'); });
  ['left', 'right'].forEach(function (k) { if (sp[k]) { fix(sp[k], 'label'); fix(sp[k], 'title'); } });
  if (sp.insight) fix(sp.insight, 'title');
  if (sp.callout) fix(sp.callout, 'title');
}

// A card highlight that only repeats the card text is removed (it would show the same fact twice)
function dropRepeatedHighlights_(sp) {
  const words = function (t) { return String(t || '').toLowerCase().match(/[a-z0-9%]{3,}/g) || []; };
  (sp.items || []).forEach(function (it) {
    if (!it || !it.highlight) return;
    const h = words(it.highlight), b = words(it.text);
    if (!h.length) return;
    const shared = h.filter(function (w) { return b.indexOf(w) !== -1; }).length;
    if (shared / h.length >= 0.6) delete it.highlight;
  });
}

// A chart needs at least 3 real data points and no zero baseline. Otherwise the slide becomes a stats slide with the
// real numbers (so no slide shows a made-up "before 0%" bar).
function realChartOrStats_(sp) {
  if (String(sp.type || '').toLowerCase() !== 'chart' || !sp.chart) return sp;
  const ch = sp.chart, cats = ch.categories || [], series = (ch.series || []).filter(function (se) { return se && Array.isArray(se.values); });
  const nonZero = series.filter(function (se) { return se.values.some(function (v) { return Number(v) !== 0; }); });
  const hasZeroBaseline = series.some(function (se) { return se.values.some(function (v) { return Number(v) === 0; }); });
  const points = nonZero.reduce(function (t, se) { return t + se.values.filter(function (v) { return Number(v) !== 0; }).length; }, 0);
  if (points >= 3 && !hasZeroBaseline && cats.length >= 2) return sp;
  const unit = ch.unit || '';
  const fmtV = function (v) { const n = Math.round(Number(v) * 10) / 10; return unit === '%' ? n + '%' : unit === '$' ? '$' + n : n + (unit || ''); };
  const items = [];
  nonZero.forEach(function (se) {
    se.values.forEach(function (v, i) {
      if (Number(v) === 0 || items.length >= 4) return;
      const label = [cats[i], nonZero.length > 1 ? se.name : ''].filter(Boolean).join(' · ') || se.name || ch.unitLabel || '';
      items.push({ value: fmtV(v), label: label, text: '' });
    });
  });
  if (!items.length) return sp;
  const ins = sp.insight || {};
  if (items.length === 1) items[0].text = ins.text || '';
  return { type: 'stats', title: sp.title, items: items, takeaway: [ins.title, items.length > 1 ? ins.text : ''].filter(Boolean).join(': '),
    notes: sp.notes, fact_tags: sp.fact_tags, reference: null };
}

// Stats whose number cannot be found in the sources are removed (a slide keeps at least two stats)
function verifyStatNumbers_(slides, corpus) {
  const dropped = [];
  const text = String(corpus || '');
  if (text.length < 200) return dropped;                      // nothing to check against
  const numsIn = function (v) { return (String(v).match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return x.replace(',', '.'); }); };
  const found = function (num) {
    const re = new RegExp('(^|[^0-9.])' + num.replace('.', '[.,]') + '(?![0-9])');
    return re.test(text);
  };
  slides.forEach(function (sp) {
    if (String(sp.type || '').toLowerCase() !== 'stats' || !Array.isArray(sp.items)) return;
    const ok = sp.items.filter(function (it) {
      const nums = numsIn(it && it.value);
      return !nums.length || nums.every(found);
    });
    if (ok.length >= 2 && ok.length < sp.items.length) {
      sp.items.forEach(function (it) { if (ok.indexOf(it) === -1) dropped.push(String(it.value) + ' ' + String(it.label || '')); });
      sp.items = ok;
    } else if (ok.length < sp.items.length) {
      sp.notes = String(sp.notes || '') + '\nCheck before sharing: some figures on this slide were not found in the research sources.';
    }
  });
  return dropped;
}

// Figures with more than one decimal are rounded for slides: "24.69%" -> "25%", "$3.456M" -> "$3.5M"
function roundOddPrecision_(obj) {
  const fix = function (str) {
    return str.replace(/(\d+)\.(\d{2,})(\s?%)/g, function (m, a, b, pct) { return Math.round(parseFloat(a + '.' + b)) + pct; })
              .replace(/(\$\d+)\.(\d{2,})([KMB])/g, function (m, a, b, u) { return '$' + (Math.round(parseFloat(a.slice(1) + '.' + b) * 10) / 10) + u; });
  };
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'notes' || k === 'design' || k === 'type' || k === 'chart') return;
      if (typeof o[k] === 'string') o[k] = fix(o[k]); else walk(o[k]);
    });
  })(obj);
}

function getCurrentPresentation_() {
  try { return SlidesApp.getActivePresentation(); }
  catch (e) { return null; }
}

function getGeneratorBootstrap() {
  const p = getCurrentPresentation_();
  return {
    presentationId: p ? p.getId() : '',
    url: p ? p.getUrl() : '',
    title: p ? p.getName() : '',
    stages: getPipelineStages(),
    presentationTypes: PRESENTATION_TYPES.slice(),
    departments: DEPARTMENTS.slice(),
    minSlides: 3,
    maxSlides: 20,
    hasVertexConfig: isVertexConfigured_()
  };
}

function runDeckGeneration(data) {
  return generatePresentation(data);
}

function getPipelineStages() {
  return PROGRESS_STAGES.create.map(function (s) { return s[0]; });
}

function clampSlideCount_(n) {
  if (n == null || n === '') n = 8;
  n = Number(n);
  if (!isFinite(n) || isNaN(n)) n = 8;
  return Math.max(3, Math.min(20, Math.round(n)));
}

function normalizePresentationType_(raw) {
  const key = String(raw || '').trim();
  if (PRESENTATION_TYPES.indexOf(key) !== -1) return key;
  const aliases = {
    'business presentation': 'Pitch',
    business: 'Pitch',
    'marketing presentation': 'Custom',
    marketing: 'Custom',
    'strategy presentation': 'Strategy',
    strategy: 'Strategy',
    'sales presentation': 'Sales',
    sales: 'Sales',
    'executive presentation': 'Pitch',
    executive: 'Pitch',
    pitch: 'Pitch',
    proposal: 'Proposal',
    'case study': 'Case Study',
    casestudy: 'Case Study',
    report: 'Report',
    custom: 'Custom'
  };
  const mapped = aliases[key.toLowerCase()];
  if (mapped) return mapped;
  for (var i = 0; i < PRESENTATION_TYPES.length; i++) {
    if (PRESENTATION_TYPES[i].toLowerCase() === key.toLowerCase()) return PRESENTATION_TYPES[i];
  }
  return 'Custom';
}

function normalizeDepartment_(raw) {
  const key = String(raw || '').trim();
  if (DEPARTMENTS.indexOf(key) !== -1) return key;
  const aliases = {
    tech: 'Technology',
    it: 'Technology',
    engineering: 'Technology',
    'human resources': 'HR',
    people: 'HR',
    exec: 'Leadership',
    executive: 'Leadership',
    general: 'Other'
  };
  const mapped = aliases[key.toLowerCase()];
  if (mapped) return mapped;
  for (var i = 0; i < DEPARTMENTS.length; i++) {
    if (DEPARTMENTS[i].toLowerCase() === key.toLowerCase()) return DEPARTMENTS[i];
  }
  return 'Other';
}

function filterLibrarySlidesByDepartment_(slides, department) {
  const dep = String(department || '').toLowerCase();
  if (!dep || dep === 'other' || dep === 'general') return slides || [];
  const matched = (slides || []).filter(function (s) {
    const useful = String(((s.usefulFor || []).join(' ')) + ' ' + (s.category || '')).toLowerCase();
    return useful.indexOf(dep) !== -1 || useful.indexOf('general') !== -1;
  });
  return matched.length ? matched : (slides || []);
}

function applyDepartmentFilter_(lib, department) {
  if (!lib || !lib.slides) return lib;
  const filtered = filterLibrarySlidesByDepartment_(lib.slides, department);
  if (!filtered.length || filtered.length < 8 || filtered.length === lib.slides.length) return lib;
  const copy = {};
  Object.keys(lib).forEach(function (k) { copy[k] = lib[k]; });
  copy.slides = filtered;
  return copy;
}

function getFilteredReferenceLibrary(department) {
  const lib = loadReferenceLibrary(false);
  if (!lib || !lib.slides) return [];
  return filterLibrarySlidesByDepartment_(lib.slides, normalizeDepartment_(department));
}
