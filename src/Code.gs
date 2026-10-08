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
 *   3. First install/authorization runs ensureInitialSetup_() (loads the library if present).
 *   4. Run "Set up template (harvest)" once from the add-on menu (template icons + thumbnails; saved in the brand folder).
 *
 * Drive (66degrees shared drive):  66° Deck Agent Assets / 01_Brand_Assets   (CONFIG.brandFolderId)
 *   01_Logos · 02_Icons/icons (66degrees Icons, Google Icons, Favicons) · 03_Images (Design, Patterns) · 04_Fonts ·
 *   05_Brand_Guidelines · ★ 66degrees Presentation Template - 2026 (Google Slides, CONFIG.referenceDeckId) ·
 *   66d_reference_library.json (CONFIG.refLibraryFileId)
 * The working deck is whichever presentation the add-on is opened from (never hardcoded).
 */

var CONFIG = {
  brandFolderId: '1LbKMz0b-VRnOvNnTCCZHRuq0iejaX30Y',   // "66° Deck Agent Assets > 01_Brand_Assets" (66degrees shared drive)

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
  refLibraryFileId: '1UE7SKEtQ3_FNf7nxyCMxeymA3g2pFtsJ',          // Drive file ID of 66d_reference_library.json
  referenceDeckId: '1x8_o6cC5YebkpYLjnco4ke8Mf9nnKN44O3ecl_ueaFk',   // Google Slides copy of "66degrees Presentation Template - 2026"
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
    .addItem('Set up template (harvest)', 'harvestReferenceDeck')
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
  // The panel sends "Create" / "Rebrand"; older panels sent "create" / "rebrand"
  data.mode = String(data.mode || 'create').toLowerCase() === 'rebrand' ? 'rebrand' : 'create';
  const run = { runId: data.runId ? String(data.runId).slice(0, 60) : null, tempId: null, ctx: null };
  const t0 = Date.now();
  try {
    const res = generatePresentationRun_(data, run);
    if (res && typeof res === 'object') res.elapsedMs = Date.now() - t0;
    return res;
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
    try { if (run.runId) deleteRunState_(run.runId); } catch (e2) {}
    throw e;
  }
}

// Brand profile, assets, template library and harvest data for one Apps Script run
function loadRunContext_(ctx) {
  try { ensureInitialSetup_(); } catch (e) { ctx.log.push('Initial setup: ' + (e && e.message ? e.message : String(e))); }
  ctx.apiKey = getApiKey();
  try { ctx.brand = getBrandProfile(ctx.apiKey, false); }
  catch (e) { ctx.brand = JSON.parse(JSON.stringify(DEFAULT_BRAND)); ctx.log.push('Brand profile fallback: ' + sanitizeDriveError_(e)); }
  try { ctx.assets = getAssetIndex(false); }
  catch (e) { ctx.assets = emptyAssetIndex_(); ctx.log.push('Brand assets skipped: ' + sanitizeDriveError_(e)); }
  try { ctx.lib = loadReferenceLibrary(false); }
  catch (e) { ctx.lib = null; ctx.log.push('Reference library skipped: ' + sanitizeDriveError_(e)); }
  ctx.tokens = libraryTokens(ctx.lib);
  try { ctx.refRuntime = ctx.lib ? loadReferenceRuntime(false) : null; }
  catch (e) { ctx.refRuntime = null; ctx.log.push('Reference harvest skipped: ' + sanitizeDriveError_(e)); }
  if (ctx.lib && !ctx.refRuntime) ctx.iconIssue = 'harvest data not loaded: ' + (REF_RUNTIME_ERROR || 'unknown reason');
  if (!ctx.lib && CONFIG.useReferenceLibrary) ctx.log.push('Reference library not loaded — using built-in 66degrees template values.');
}

function generatePresentationRun_(data, run) {
  const started = Date.now();
  const mode = data.mode === 'rebrand' ? 'rebrand' : 'create';
  const ctx = { runId: run.runId, progress: null, blobCache: {}, generatedIcons: 0, log: [] };
  run.ctx = ctx;
  progressInit_(ctx, mode);
  loadRunContext_(ctx);
  const target = SlidesApp.getActivePresentation();

  if (mode === 'rebrand') {
    // Large decks are rebranded in parts (one part per Apps Script run); the panel asks for the next part
    return rebrandStep_(ctx, target, { mode: 'rebrand', runId: run.runId, startedAt: started, start: 0, stats: null, log: [] }, started);
  }

  // ---------- CREATE ----------
  const userPrompt = String(data.prompt || '').trim();
  const sources = { text: '', pdfs: [], images: [] };
  if (data.sourceUrl && String(data.sourceUrl).trim()) readSourceDocument(String(data.sourceUrl).trim(), sources);
  // Uploaded files: one (data.upload, older panel) or several (data.files, current panel). A file that cannot be read
  // is skipped with a note; the run only stops when nothing at all is left to build from.
  const uploads = [].concat(data.upload && data.upload.data ? [data.upload] : [], Array.isArray(data.files) ? data.files : [])
    .filter(function (f) { return f && f.data; }).slice(0, 10);
  const skippedFiles = [];
  uploads.forEach(function (f) {
    try {
      readUploadedFile_(f, sources);
      ctx.log.push('Source file used: ' + f.name + '.');
    } catch (e) {
      skippedFiles.push(String(f.name || 'file') + ' (' + e.message + ')');
    }
  });
  if (skippedFiles.length) ctx.log.push('Skipped file(s): ' + skippedFiles.join('; '));
  if (!userPrompt && !sources.text && !sources.pdfs.length && !sources.images.length) {
    throw new Error(skippedFiles.length
      ? 'None of the uploaded files could be read: ' + skippedFiles.join('; ') + '. Add a topic, a PDF, CSV, text or image, or a Google Docs/Sheets/Slides link.'
      : 'Please describe the presentation you want, or add a source link or file.');
  }
  const presentationType = normalizePresentationType_(data.presentationType || data.type);
  const department = normalizeDepartment_(data.department);
  let totalSlides = clampSlideCount_(data.slideCount != null && data.slideCount !== '' ? data.slideCount : data.slides);
  if (!run.runId && totalSlides > SINGLE_RUN_MAX_) totalSlides = SINGLE_RUN_MAX_;   // callers without a run id cannot continue
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

  // Long decks (more than one Apps Script run can build): outline first, then the slides in parts, run after run
  if (totalSlides > SINGLE_RUN_MAX_ && run.runId) {
    return startLongDeck_(ctx, target, { userPrompt: userPrompt, sources: sources, presentationType: presentationType,
      department: department, n: totalSlides, blankDeck: blankDeck }, started);
  }

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
  if (ctx.arcIssue) msg += '\nDiagram rings and pie segments: not drawn (' + ctx.arcIssue + ').';
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
// The current panel calls cancelDeckGeneration; older panels call cancelRun
function cancelDeckGeneration(runId) {
  try { if (runId) deleteRunState_(String(runId).slice(0, 60)); } catch (e) {}
  return cancelRun(runId);
}

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
          else if (t === SlidesApp.PageElementType.SHAPE) out.push(el.asShape().getText().asString());
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

function planContent(userPrompt, presentationType, n, sources, ctx, opts) {
  // opts.batch (long decks): write only these planned slides { slides:[{type, title, brief}], deckSize, deckTitle, otherTitles[] }
  const batch = opts && opts.batch ? opts.batch : null;
  const guidance = TYPE_GUIDANCE[presentationType] || TYPE_GUIDANCE['Custom'];
  const iconNames = Object.keys(ctx.assets.icons).sort();
  const libIconNames = ctx.lib ? ctx.lib.icons.map(function (i) { return i.name; }) : [];

  // Approved facts: the 2026 template (reference library) first, the built-in list as fallback
  const facts = libraryFacts(ctx.lib, [userPrompt, presentationType, String(sources.text || '').slice(0, 4000)].join(' '));
  const approvedFacts = facts.usable.length ? facts.usable : APPROVED_FACTS;

  let recentList = [];
  try { recentList = recentDesigns_(); } catch (e) {}
  ctx.userPrompt = userPrompt;
  ctx.approvedFacts = approvedFacts;
  const storyShape = pickStoryShape_();                                       // a different story shape on every run
  const storyBlock = batch ? `THIS IS PART OF A LONG DECK (${batch.deckSize} slides, titled "${batch.deckTitle || ''}"). The outline is fixed.
Write EXACTLY these ${n} body slides, in this order, with these types and titles (keep each title word for word):
${batch.slides.map(function (o, k) { return (k + 1) + '. type "' + o.type + '" | title "' + o.title + '"' + (o.brief ? ' | about: ' + o.brief : ''); }).join('\n')}
Other slides of the deck (already written or written later - never repeat their content): ${(batch.otherTitles || []).slice(0, 220).join(' | ')}
${(batch.usedNumbers || []).length ? 'Numbers already shown on earlier slides (never show them again): ' + batch.usedNumbers.slice(-80).join(', ') : ''}
No cover, agenda or closing slide in this part.
` : `STORY (MANDATORY):
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
`;
  const prompt = `
You are the senior presentation strategist for ${ctx.brand.name}. Write the content for the best possible presentation on the topic:
a clear story, one idea per slide, concrete and useful content.

REQUEST: "${userPrompt || 'Build the presentation from the attached source material.'}"
PRESENTATION TYPE: ${presentationType}
DEPARTMENT: ${ctx.department || 'Other'}
STRUCTURE: ${guidance} Shape the story around what the request is really asking for, the way a senior consultant would.
${batch ? 'SLIDES IN THIS PART: ' + n + ' (of a ' + batch.deckSize + '-slide deck)' : 'EXACT NUMBER OF SLIDES: ' + n}

AUDIENCE: do not assume or name an audience, job title or company unless the user states one. Never write "for the VP of ...".

${storyBlock}- Do not write "eyebrow" labels (the design has no label bar above the title).
- No filler summary slide ("The future of X is now", "In summary", "Key takeaways", "Looking ahead") unless the request asks
  for a summary: every body slide adds new content.
- At most ONE roadmap / timeline / phased-plan slide in the deck (quarters, phases, quick wins, "building momentum" are all the
  same topic): never a second slide about the phases or the early value of the plan.
- Follow the ORDER of the topics in the request: when the request lists topics (e.g. "why now, what good looks like, use cases,
  how we deliver, risks, KPIs, client result"), the body slides cover them in that order, each requested topic on its own slide.
- "How we deliver" / approach / methodology is a "process" slide with the delivery steps (not a list of services or accelerators).
- A KPI / measuring-success slide is type "stats" with 3-4 items whose "value" is a number (a target when no source gives one:
  label starts with "Target:"), never cards without numbers.
- Never more than ${n >= 30 ? Math.max(2, Math.round(n / 7)) : 2} "cards" slides in the deck: use diagram, process, comparison, table, stats instead.
- No 66degrees credentials / "why 66degrees" / "trusted partner" / services / accelerators slide unless the request asks for it.
- Every number on a slide is about that slide's topic: never a figure about another product or use (e.g. Google Workspace
  minutes saved in a customer service deck), and no closing "quantifiable impact" slide built from unrelated figures.
- A bullets slide always has a callout (the side panel); a statement slide always has 2-3 points next to it.
- One slide per topic: "how we deliver", "our framework", "our approach" and "implementation process" are ONE topic;
  "considerations", "critical success factors" and "key decisions" are ONE topic; "why now", "the landscape" and "the imperative" are ONE topic.
- A case study names the client in its title (e.g. "AES: AI quality reviews for every call") and in the field "client".
- When the request asks for a client result, case study, success story or proof, include ONE "case_study" slide built on the
  approved client fact whose work is closest to the topic (data platform, analytics, cost savings...). Never replace it with
  a credentials slide.

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
- Every slide covers a DIFFERENT topic. Never write two slides with the same points (e.g. two security slides): merge them into one.
- Vary the slide types. In one deck use "statement" at most once and "bullets" at most once; use any other type at most
  ${n >= 14 ? 3 : 2} times, and pick different designs from the DESIGN MENU when a type repeats.
- stats: every "value" is a real number from the sources (e.g. "40%", "$10M", "3x", "350+"). Never a word ("Significant",
  "Trillions") and never a range ("4% to 100%": write "100%" with the label "of calls reviewed, up from 4%").
- bullets: write each point as "Short label: explanation" (the label is shown in Medium). A bullets slide ALWAYS has 3-5 points
  ON THE SLIDE ("points"), never only a callout and never content that exists only in the notes.
- Use cases and capabilities: only what the research sources, approved facts or the user's material support. Never claim a
  product does something the sources do not say (e.g. "builds DCF models in Google Sheets").
- case_study (one client): "solution" is a list of 3-4 separate steps, never one paragraph.
- The client in a case study must fit the topic and the department: the same industry or the same kind of work
  (e.g. data platform, analytics or EDW cost savings for a finance deck). Never use an unrelated client result (e.g. contract
  review or a service desk for a finance planning deck). If the request does not ask for client proof and no approved
  client fact fits, leave the case study out.
- The agenda lists every body slide (the code fills it from the slide titles).
- Never use "section" divider slides: every body slide carries content.
- "comparison" at most once (twice in a deck of 14+ slides).
- Client results (e.g. "$10M annual savings", "90% faster contract review") appear ONLY on case_study slides that name the
  client. Never present a client's result as a general AI result.
- No claims about competitors or "other AI platforms" (error rates, weaknesses) unless a research source says exactly that.
- Items on one slide are about the same length (cards, stats, steps): similar word counts, so boxes look even.
- In cards, give EVERY item a "highlight" or none of them.
- Every body slide covers its own topic. Never split one topic over several slides (e.g. "rollout plan" + "phase 1" +
  "phases 2 and 3", or "today's model" + "the new model" + "comparing the models"): put it on ONE slide with a design that
  holds it (process, timeline, comparison), and use the other slides for different angles.
- KPIs are things the client will measure (e.g. containment rate, CSAT, time to insight), never market facts.
- case_study results are numbers ("$3M+", "40%"), never words.
- Never show the same numbers on two slides (e.g. the same three percentages as stats AND as a chart).
- Never repeat a framework on several slides (e.g. Modernize / Build / Manage on an approach slide AND an offerings slide):
  explain it once, then go deeper on something new.
- A chart shows ONE measure (all values of the same kind), and its title says what the data shows.
- Do not name competitors or their products (ChatGPT, OpenAI, Microsoft Copilot and similar). A comparison is always
  before/after or without/with, never "other platforms" or "other partners".
- stats: each "label" reads on its own next to the number ("Gemini users who work faster", never "of Gemini users work faster");
  each "value" is a clean number ("90%", "8M+", "105 min"), never words like "Nearly 90%".
- No "X is no longer Y; it is Z" or "not just X, but Y" sentences: state the point directly.
- Bullets: max ~22 words each. Statement: max ~110 characters, and its text must not repeat the cards next to it.
- Item titles never start with a number ("1. …"): the design numbers the items.
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
  write it as a target: the "value" is the number only (e.g. "30%" or "3-5 days") and the "label" starts with "Target:"
  (e.g. "Target: faster month-end close"); add "Illustrative figure – validate before sharing." to that slide's notes.
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
- cards: title, lead, items[{title, text, icon, material, highlight}] (2-10). Some card designs also use items[].points (3-5 short
  bullets), items[].label + challenge + benefit, or slide-level statement + points (see the DESIGN MENU). "highlight" = one short result line shown in blue at the
  bottom of the card (max 60 characters, e.g. "Up to 40% lower operating costs"); only when a research source or approved fact backs it, else omit.
- process: title, lead, items[{title, text}] (3-6 steps)
- timeline: title, items[{date, title, text}] (3-6)
- stats: title, items[{value, label, text}] (2-4), takeaway
- chart: title, chart{type:"column"|"bar"|"line", categories[], series[{name, values[]}], unit, unitLabel, highlight}, insight{title, text}
- comparison: title, left{label, title, points[]}, right{label, title, points[]}. Each point is ONE short line (6-14 words), never a paragraph.
  Or a comparison table: left{label}, right{label}, rows[{label, left, right}] (3-8). Or a check matrix: options[] (2-4 names),
  rows[{label, values[true|false for each option]}] (4-10), points[] (optional).
- diagram: title, lead, center (2-3 word label for the middle of the diagram), text (optional intro), items[{title, text, icon}] (3-8;
  text 8-20 words). Use a diagram for capabilities around a platform, parts of a whole, a cycle, levels or building blocks.
- table: title, columns[] (2-5 plain strings), rows[][] (2-7, plain strings)
- chart with a table (design 66D_LAYOUT_CHART_003): chart{...} plus columns[] and rows[][] with the same data
- case_study (one client): title (starts with the client name), client, industry (e.g. "Energy | AI/ML"), challenge (2-3 sentences), solution [3-4 points of 15-25 words], results[{value, label}] (2-3), outcome (1-2 sentences)
- case_study (several clients): title, cases[{phase, client, offering, industry, challenge, solution, value_headline, value}] (3-6)
  Use approved client facts only; value_headline is the key result (e.g. "$3M+ in annual savings").
- bullets: title, points[] (3-6, each "Label: explanation"), callout{label, title, text} (callout text 25-45 words)
- next_steps: title, items[{title, text, timing}] (3-5), cta
- team: title, lead, people[{name, title, location, text}] (3-12). ONLY when the request or the source material names the people:
  copy their names and titles exactly. Never invent people, names or titles.
- template: title, template ("clients" | "leadership" | "industries"). The real 66degrees template slide is copied as it is
  (real client logos, the real leadership team, industry expertise). ONLY when the request asks for clients or client logos,
  the 66degrees leadership team, or the industries 66degrees serves. At most one of each.
- quote: quote, attribution
- section: title, lead
- closing: title, subtitle
SPECIAL CONTENT (use ONLY when the request or the source material is about this; these fields pick special template designs):
- Project plan: type "timeline" with periods[] (week or month labels, 3-16) and tasks[{name, start, end}] (start/end = period numbers),
  or workstreams[{name, cells[[3-6 word points per period]]}] for a workstream matrix.
- Risks / RAID: type "table" with risks[{description, type, status, impact, likelihood, owner, mitigation}] (2-5).
- Status report: type "table" with rag{scope, schedule, budget, resources, overall: "green"|"amber"|"red"}, attention[], accomplishments[],
  milestones[], deliverables[{name, complete, date}].
- Pricing: type "table" with prices[{option, detail, price}], or type "comparison" with pricingOptions[{name, size, detail, price, team[]}] (2).
  Only prices from the request or the source material, never invented.
- Team: type "cards" with teams[{name, text, stakeholders[{name, role}], specialists[{name, role}]}] (2: the client team and the 66degrees team),
  or org{name, role, reports[{name, role, reports[...]}]} for an organisation chart (roles only when names are not given).
- OKRs: type "cards" with tabs[] (objective names, 2-4), activeTab (index), epics[{name, measures[], targets[]}] (1-3).
- Cost breakdown: type "chart" with chart{type:"stacked", categories[2-3], series[{name, values[]}], unit}, statement, text, points[] (sources).
- Platform stack: type "diagram" with layers[{title, text}] (2-4), parts[] (product or app names), takeaway.
Every slide also has "notes" (2-4 sentences for the presenter).
Every body slide also has "design": the tag of the template design from the DESIGN MENU that best suits this slide's role and content.
  Choose it the way a presentation designer would: the key proof slide (case study, KPIs) gets the richest design; a methodology
  gets a process design; a journey gets the staircase; a from/to comparison gets the cross/tick design; capabilities around one
  platform get the hub-and-spoke diagram; parts of a whole get the half donut. Never use the same design twice in a deck, and
  write the content in the shape the chosen design needs (its item count, fields and word counts).
- Make the deck visually rich: use at least ${Math.max(2, Math.round(n / 6))} different diagram designs among the body slides,
  spread through the deck. Dark or photo designs (dark photo bands, photo strips, statement photo slides): at most ${n >= 8 ? 2 : 1}
  in the whole deck, never two in a row.

STORY SHAPE FOR THIS DECK: ${storyShape} (use it unless it clearly does not suit the request; it changes on every run so
two decks on the same topic are built differently: different slide order, different slide types, different designs).

STORY SHAPES:
- Problem-led: why now -> what is broken -> what good looks like -> how to get there -> proof -> how to measure.
- Outcome-led: the result -> how it was achieved -> the building blocks -> proof -> what it takes.
- Roadmap-led: where you are -> the plan (ONE slide) -> what changes for each team -> risks and how we handle them -> proof.
- Capability-led: the platform -> its parts -> how they work together -> use cases -> proof.

DESIGN MENU (66degrees 2026 template designs the engine can draw)
${ENGINE.designMenu()}
${recentList.length ? 'RECENTLY USED DESIGNS (used in the last decks made with this tool; choose OTHER designs from the menu whenever one suits the content, so every deck looks fresh): ' + recentList.join(', ') : ''}
For "cards" items, "icon" must be a name from ${libIconNames.length ? 'LIBRARY_ICONS (preferred) or ' : ''}BRAND_ICONS and "material" the closest Google Material Icons name.
Use charts and stats wherever real or target numbers make the point clearer.

${libIconNames.length ? 'LIBRARY_ICONS: ' + libIconNames.join(', ') + '\n' : ''}BRAND_ICONS: ${iconNames.join(', ')}
${sources.research && sources.research.length ? '\n' + formatSciteForPrompt(sources.research, sources.researchProvider) + '\nRESEARCH RULES:\n- Every factual claim, statistic, trend or finding MUST come from the RESEARCH SOURCES above.\n- When you use a source, append its number in square brackets to the slide\'s "notes" field, e.g. "[1][3]".\n- Prefer quantitative findings (percentages, counts, growth rates) for stats/chart slides.\n- If a claim cannot be supported by the sources, mark it as "Illustrative figure – validate before sharing." in that slide\'s notes.' : ''}
${sources.text ? '\nUSER-PROVIDED SOURCE MATERIAL (secondary):\n' + sources.text.slice(0, CONFIG.maxSourceChars) : ''}
${sources.pdfs.length ? '\nA source PDF is attached: use it alongside the research sources.' : ''}
${(sources.images || []).length ? '\nA source image is attached: use what it shows (text, numbers, diagrams) as source material.' : ''}

OUTPUT: ONLY valid JSON: { "deck_title": "", "facts_note": "", "sources_used": [1,2,3], "slides": [ { "type": "${batch ? batch.slides[0].type : 'cover'}", ..., "notes": "...", "fact_tags": [] }, ... exactly ${n} slides ] }
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

  const plan = callGeminiJSON(parts, ctx.apiKey, 0.7);
  if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) throw new Error('Gemini returned no slide content.');
  plan.slides = plan.slides.map(function (sp) { return ENGINE.cleanSpec(sp); });   // strip stray color codes
  plan.slides = normalizeSpecialSlides_(plan.slides, userPrompt, sources, ctx);    // real template slides, real people only
  plan.slides.forEach(function (sp) { removeHypeWords_(sp); });                // brand voice: no hype words, enforced in code
  plan.slides = plan.slides.map(function (sp) { return realChartOrStats_(sp); }); // charts only with real multi-point data
  plan.slides.forEach(function (sp) { dropRepeatedHighlights_(sp); sentenceCaseHeadings_(sp); });
  // Every stat on a slide must be found in the research, the approved facts or the user's material
  if (!sources.pdfs.length && !(sources.images || []).length) {
    const corpus = [JSON.stringify(sources.research || []), String(sources.text || ''), JSON.stringify(approvedFacts || [])].join(' ');
    const dropped = verifyStatNumbers_(plan.slides, corpus);
    if (dropped.length) ctx.log.push('Removed ' + dropped.length + ' figure(s) not found in the sources: ' + dropped.join(', ') + '.');
  }
  plan.slides.forEach(function (sp) { roundOddPrecision_(sp); splitRangeValues_(sp); splitCaseSteps_(sp); lowerUnitWords_(sp); });
  plan.slides = plan.slides.map(bulletsNeedPoints_);                              // a bullets slide always shows its points
  plan.slides = plan.slides.map(statementNeedsPoints_);                           // a statement never stands alone on an empty slide
  plan.slides.forEach(function (sp) {                                            // a result is a number ("AI/Analytics" is not)
    if (Array.isArray(sp.results)) sp.results = sp.results.filter(function (r) { return r && /\d/.test(String(r.value || '')); });
  });
  dedupeStatValues_(plan.slides);                                                 // the same figure is shown once in a deck
  plan.slides = plan.slides.map(statsNeedNumbers_);                               // "Significant" is not a stat
  plan.slides.forEach(evenHighlights_);                                           // highlights on all cards or none
  if (batch) {
    // Long deck part: one slide per outline entry, with the outline's type and title (the agenda already lists them)
    const got = plan.slides.slice();
    const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    plan.slides = batch.slides.map(function (o, k) {
      const byTitle = got.filter(function (g) { return g && norm(g.title) === norm(o.title); })[0];
      const sp = byTitle || got[k] || { type: o.type, title: o.title, items: [] };
      sp.title = o.title;
      if (!sp.type) sp.type = o.type;
      return sp;
    });
    limitCardSlides_(plan.slides, n, Math.max(1, Math.round(n / 7)));
    plan.slides.forEach(function (sp) { nameCaseClient_(sp, ctx); });
    plan.slides.forEach(function (sp) { if (sp.title && String(sp.type).toLowerCase() !== 'template') sp.title = sentenceCase_(sp.title, 2); });
    if (!plan.deck_title) plan.deck_title = batch.deckTitle || '';
    return plan;
  }
  plan.slides = limitRepeatedTypes_(plan.slides);                                 // statement / bullets at most once
  replaceDuplicateSlides_(plan, ctx);                                             // no two slides with the same content
  orderSlidesToRequest_(plan, ctx);                                               // body slides in the order the request lists its topics
  limitCardSlides_(plan.slides, n);                                               // at most 2 "cards" slides (more in long decks)
  plan.slides.forEach(function (sp) { nameCaseClient_(sp, ctx); });               // a case study names its client                  // "24.69%" -> "25%" 
  plan.slides.forEach(function (sp) {                                            // brand rule: sentence-case titles
    const tt = String(sp.type).toLowerCase();
    if (sp.title && tt !== 'closing' && tt !== 'template') sp.title = sentenceCase_(sp.title, 2);
    if (sp.statement) sp.statement = sentenceCase_(sp.statement);
  });
  plan.slides = enforceDeckStructure_(plan.slides, n, plan.deck_title);          // cover, agenda, body, closing — exactly n
  syncAgendaToSlides_(plan.slides);                                             // agenda lists exactly the slides that exist
  if (!plan.deck_title) plan.deck_title = plan.slides[0].title || 'Presentation';
  return plan;
}

/* ---------- Special slides: real template slides and real people only ---------- */

// "template" slides (client logos, leadership, industries) are kept only when the request or source material asks for
// them, at most one of each, and get the real template slide's tag and title. "team" slides are kept only when the
// people's names really come from the request or the source material (never invented people).
function normalizeSpecialSlides_(slides, userPrompt, sources, ctx) {
  const asked = String(userPrompt || '') + ' ' + String((sources && sources.text) || '');
  const askedLc = asked.toLowerCase();
  const seen = {};
  const history = loadDesignUsage_();
  const out = [];
  slides.forEach(function (sp) {
    if (!sp) return;
    let t = String(sp.type || '').toLowerCase();
    if (t === 'leadership' && Array.isArray(sp.people) && sp.people.length) t = sp.type = 'team';
    if (['template', 'clients', 'logos', 'client_logos', 'industries', 'leadership'].indexOf(t) !== -1) {
      const key = templateSlideKey_(Object.assign({ template: t === 'template' ? sp.template : t }, sp)) || templateSlideKey_(sp);
      if (!key || seen[key] || !TEMPLATE_SLIDE_TRIGGERS_[key].test(asked)) {
        ctx.log.push('Left out a ' + (key || 'template') + ' slide the request did not ask for.');
        return;
      }
      seen[key] = true;
      // the least recently used version (the client logo slides rotate between decks)
      const tags = TEMPLATE_SLIDES_[key].slice().sort(function (a, b) { return recencyScore_(history, b) - recencyScore_(history, a); });
      const tag = tags[0];
      // saved with the deck's other designs (chooseDesignsByContent_), so one deck counts as one step in the history
      out.push({ type: 'template', template: key, tag: tag, title: sentenceCase_(templateSlideTitle_(ctx.lib, tag) || sp.title || '', 2),
        notes: sp.notes || '', fact_tags: sp.fact_tags || [], reference: { tag: tag, fallback: false } });
      return;
    }
    if (t === 'team') {
      const people = (Array.isArray(sp.people) ? sp.people : []).filter(function (p) { return p && (p.name || typeof p === 'string'); });
      const real = people.filter(function (p) {
        const name = String(typeof p === 'string' ? p : p.name).trim().toLowerCase();
        const last = name.split(/\s+/).pop();
        return name && (askedLc.indexOf(name) !== -1 || (last.length > 2 && askedLc.indexOf(last) !== -1));
      });
      if (people.length < 1 || real.length < Math.ceil(people.length * 0.8)) {
        ctx.log.push('Left out a team slide: the people\'s names were not in the request or the source material.');
        return;
      }
      sp.people = people.slice(0, 12);
    }
    out.push(sp);
  });
  return out;
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
   4. PPTX -> GOOGLE SLIDES (Drive API)
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
  const pres = SlidesApp.create((title || 'Generated deck') + ' (working copy)');
  const first = pres.getSlides()[0];
  for (let i = 0; i < count; i++) pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  if (first) first.remove();
  pres.saveAndClose();
  return pres.getId();
}

// Draws every planned slide with the layout engine in the design chosen for it; progress slide by slide
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
      // Real template slides (client logos, leadership, industries) are copied from the template as they are
      const sp = specs[i] || {};
      if (String(sp.type || '').toLowerCase() === 'template' && sp.tag && insertTemplateSlide_(slide, sp.tag, ctx)) {
        stats.redrawn++;
        progressSlide_(ctx, i, 'done');
        return;
      }
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
      if (t === 'template') return;
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
        if (o.isTitle && issues.some(function (it) { return it.slide === i && it.path[0] === 'title'; })) return;
        const path = o.isTitle ? ['title'] : findTextPath_(sp, o.text);
        if (path) issues.push({ slide: i, path: path, current: o.text, action: 'shorten', min_chars: Math.floor(o.maxChars * 0.7), max_chars: o.maxChars });
      });
      if (round === 0) m.underfill.forEach(function (u) {
        const path = findTextPath_(sp, u.text);
        if (!path) return;
        let maxC = Math.min(u.maxChars, u.text.length + 180, 300), minC = Math.min(u.minChars, u.text.length + 120);
        // Even boxes: a text grows to at most ~20% past its longest sibling (the other cards / stats / steps)
        const parent = path.length >= 3 ? path.slice(0, -2).reduce(function (o, k) { return o && o[k]; }, sp) : null;
        if (Array.isArray(parent)) {
          const key = path[path.length - 1];
          const longest = parent.reduce(function (mx, it) { return Math.max(mx, String((it && it[key]) || '').length); }, 0);
          maxC = Math.min(maxC, Math.max(u.text.length + 40, Math.round(longest * 1.2), Math.round(u.maxChars * 0.8)));
          minC = Math.min(minC, maxC - 20);
        }
        const isBullet = path.indexOf('points') !== -1;
        if (isBullet) { maxC = Math.min(maxC, u.text.length + 90); minC = Math.min(minC, u.text.length + 40); }
        if (minC <= u.text.length + 15) return;                                   // nothing worth adding
        issues.push({ slide: i, path: path, current: u.text, action: 'expand', bullet: isBullet, min_chars: minC, max_chars: maxC });
      });
    });
    if (!issues.length) break;
    const list = issues.slice(0, 40).map(function (it, k) {
      return { id: k, slide_title: slideHeading_(plan.slides[it.slide]), action: it.action, kind: it.bullet ? 'bullet' : (it.path[0] === 'title' ? 'slide title' : 'text'),
        min_chars: it.min_chars, max_chars: it.max_chars, text: it.current };
    });
    const prompt = [
      'You are editing text on 66degrees consulting slides so that every text fits its box exactly.',
      'For each item, rewrite "text" so its length (characters, spaces included) is between min_chars and max_chars.',
      '- action "shorten": keep the key message, numbers and names; cut filler words.',
      '- action "expand": add ONE or TWO short, specific sentences (how it works, why it matters, a concrete example). Never repeat',
      '  the slide title or its words, never pad with filler, never add new numbers, clients, awards or claims about 66degrees.',
      '- kind "bullet": keep it ONE sentence (make it fuller, do not add a second sentence). Keep a "Label: " start if it has one.',
      '- kind "slide title" and short headings: keep a complete, specific phrase (never vague words like "Data view" or "Capabilities").',
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
    if (['cover', 'closing', 'section', 'template'].indexOf(t) !== -1) return;
    res.left += ENGINE.measure(sp, { tokens: ctx.tokens || null }).overflow.length;
  });
  syncAgendaToSlides_(plan.slides);
  return res;
}

// Path of the string field whose (cleaned) value is exactly `text`, e.g. ['items', 2, 'text']; null if none
function findTextPath_(obj, text) {
  const skip = { reference: 1, notes: 1, fact_tags: 1, design: 1, type: 1, title: 1 };
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
function sentenceCase_(t, minWords) {
  const str = String(t || '').trim();
  const words = str.split(/\s+/);
  const plain = words.filter(function (w) { return /^[A-Za-z][a-z]/.test(w); });          // ordinary words (not acronyms/numbers)
  const caps = plain.filter(function (w) { return /^[A-Z]/.test(w); }).length;
  if (plain.length < (minWords || 3) || caps < plain.length * 0.6) return str;      // already sentence case
  const keep = /^(AI|ML|ROI|KPIs?|CIO|CFO|CEO|CTO|IT|API|GCP|AWS|SAP|LLMs?|MLOps|LLMOps|GenAI|Google|Gemini|Workspace|BigQuery|Vertex|Looker|Cloud|66degrees|Microsoft|Azure|Salesforce|SharePoint|CSAT|NPS|SaaS|B2B|US|UK|EU|Q[1-4])$/;
  let first = true;
  return words.map(function (w) {
    const bare = w.replace(/['’]s$/i, '').replace(/[^A-Za-z0-9]/g, '');
    let out = w;
    if (!first && !keep.test(bare) && !/[0-9]/.test(bare) && !/^[A-Z]{2,}$/.test(bare)) out = w.toLowerCase();
    first = /[:.!?]$/.test(w) ? false : false;
    return out;
  }).join(' ').replace(/^./, function (c) { return c.toUpperCase(); })
    .replace(PRODUCT_NAMES_RE_, function (m) { return PRODUCT_NAMES_[m.toLowerCase()] || m; });
}

// Product and proper names that keep their capitals inside sentence-case titles
const PRODUCT_NAMES_ = {};
['Gordon Food Service', 'Vail Resorts', 'WellSky', 'Wayfair', 'AutoZone', 'Altria', 'AES', 'Equifax', 'Google Cloud Partner',
 'Gemini Enterprise', 'Gemini for Google Workspace', 'Google Workspace', 'Google Cloud', 'Google Cloud Platform', 'Vertex AI',
 'Admin Console', 'Agentspace', 'NotebookLM', 'Looker Studio', 'Cloud SQL', 'Microsoft 365', 'Google Analytics 4', 'Google Analytics',
 'Google Ads', 'Campaign Manager 360', 'Campaign Manager', 'Display & Video 360', 'Search Ads 360', 'Google Marketing Platform',
 'BigQuery', 'Looker', 'Google', 'Gemini', 'GA4', 'GA360', 'Fortune 100', 'Fortune 500', 'Fortune 1000'].forEach(function (n) { PRODUCT_NAMES_[n.toLowerCase()] = n; });
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
  // Long decks are built in batches: the variety state carries over from batch to batch (ctx.chooserState)
  const st = ctx.chooserState || { used: {}, looksUsed: {}, prevTag: null, prevLook: null, prevDark: false, darkUsed: 0 };
  const used = st.used, looksUsed = st.looksUsed;
  let prevTag = st.prevTag, prevLook = st.prevLook;
  const history = st.history || loadDesignUsage_();                    // designs and looks used in earlier decks (all users)
  let prevDark = st.prevDark, darkUsed = st.darkUsed;
  const deckSize = ctx.deckSize || plan.slides.length;
  const darkMax = deckSize >= 30 ? Math.round(deckSize / 8) : deckSize >= 8 ? 2 : 1;   // dark / photo designs: 2 per deck (more in long decks)
  const FRAME = { cover: 1, agenda: 1, closing: 1 };
  const lookKey = function (type, tag, m) { return FRAME[type] ? type + ':' + tag : (m && m.look) || tag; };
  const trialOf = function (sp, tag) { return Object.assign({}, sp, { reference: Object.assign({}, sp.reference || {}, { tag: tag }) }); };
  plan.slides.forEach(function (sp) {
    const type = normalizeType_(sp.type);
    if (type === 'template' || String(sp.type || '').toLowerCase() === 'template') { if (sp.tag) used[sp.tag] = 1; return; }
    const designs = drawableDesigns_(type, itemCount_(sp), sp);
    const current = sp.reference && sp.reference.tag;
    if (designs.length < 2) {
      let m0 = null;
      try { m0 = ENGINE.measure(sp, { tokens: ctx.tokens || null }); } catch (e) {}
      prevTag = current;
      prevLook = lookKey(type, current, m0);
      if (current) used[current] = (used[current] || 0) + 1;
      if (prevLook) looksUsed[prevLook] = (looksUsed[prevLook] || 0) + 1;
      prevDark = !!(m0 && m0.dark);
      if (prevDark) darkUsed++;
      return;
    }
    const drawable = designs.filter(function (d) { return !ENGINE.canDraw || ENGINE.canDraw(trialOf(sp, d.tag)); });
    const pool = drawable.length ? drawable : designs;
    // Every design that can show this content is measured once
    const cands = pool.map(function (d) {
      let m = null;
      try { m = ENGINE.measure(trialOf(sp, d.tag), { tokens: ctx.tokens || null }); } catch (e) {}
      m = m || { content: 0, overflow: [{}], fill: 0, dark: false, look: d.tag };
      const fitsWell = m.content > 0 && !m.overflow.length && m.fill >= 0.5;
      return { d: d, m: m, fitsWell: fitsWell, look: lookKey(type, d.tag, m) };
    });
    let best = null;
    cands.forEach(function (c) {
      const d = c.d, m = c.m;
      // 1. Fit is a gate, not a ranking: every design that shows the content well competes on equal terms
      let score = 0;
      if (m.content === 0) score -= 1000;                             // would show nothing under the title
      if (!c.fitsWell) score -= 150 + 35 * m.overflow.length + 80 * Math.max(0, 0.5 - m.fill);
      if (d.needs) score += 30;                                       // made for this slide's special content (risks, prices...)
      if (sp.design && String(sp.design).trim() === d.tag) score += 8;   // Gemini's choice (a light preference only)
      // 2. Variety inside the deck: a design once, a look (family of similar designs) once, never twice in a row
      // (a design already used in this deck loses more than a design that needs its text rewritten: the fit step
      //  shortens or fills the text afterwards, so variety wins whenever another design can show the content)
      score -= 220 * (used[d.tag] || 0);
      score -= 70 * (looksUsed[c.look] || 0);
      if (d.tag === prevTag) score -= 60;
      if (c.look === prevLook) score -= 50;
      // 3. Variety between decks (every user): designs and looks used in the last decks lose, unused ones win
      score += recencyScore_(history, d.tag);
      score += lookRecencyScore_(history, c.look);
      // 4. Rhythm: at most 2 dark / photo slides, never back to back, never pushed forward on purpose
      if (m.dark && (prevDark || darkUsed >= darkMax)) score -= 120;
      // 5. Shuffle: the same request never gives the same deck twice
      score += Math.random() * 35;
      if (!best || score > best.score) best = { tag: d.tag, score: score, c: c };
    });
    if (best && best.tag !== current) {
      sp.reference = referenceForTag_(ctx.lib, best.tag);
      swaps++;
    }
    prevTag = sp.reference ? sp.reference.tag : null;
    prevLook = best ? best.c.look : prevTag;
    if (prevTag) used[prevTag] = (used[prevTag] || 0) + 1;
    if (prevLook) looksUsed[prevLook] = (looksUsed[prevLook] || 0) + 1;
    prevDark = !!(best && best.c.m.dark);
    if (prevDark) darkUsed++;
  });
  st.prevTag = prevTag; st.prevLook = prevLook; st.prevDark = prevDark; st.darkUsed = darkUsed;
  if (ctx.chooserState) { st.history = history; return swaps; }          // long deck: saved once, when the deck is finished
  saveDesignUsage_(Object.keys(used), Object.keys(looksUsed));
  return swaps;
}

/* =========================
   DESIGN HISTORY (shared by everyone who uses the add-on)
   { seq: number of decks made, used: { designTag: deck number when last used } }. Designs used in the last few decks
   score lower, designs never used score higher, so consecutive decks (from any user) look different.
========================= */
const DESIGN_USAGE_KEY_ = 'DESIGN_USAGE_V1';

function loadDesignUsage_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(DESIGN_USAGE_KEY_);
    const h = raw ? JSON.parse(raw) : null;
    if (h && h.used) return h;
  } catch (e) {}
  return { seq: 0, used: {} };
}

function saveDesignUsage_(tags, looks) {
  if ((!tags || !tags.length) && (!looks || !looks.length)) return;
  let lock = null;
  try {
    if (typeof LockService !== 'undefined') lock = LockService.getScriptLock();
  } catch (e) {}
  try { if (lock) lock.waitLock(5000); } catch (e) {}
  try {
    const h = loadDesignUsage_();                       // re-read inside the lock: another user may have just saved
    h.seq = (h.seq || 0) + 1;
    h.looks = h.looks || {};
    (tags || []).forEach(function (t) { h.used[t] = h.seq; });
    (looks || []).forEach(function (l) { h.looks[l] = h.seq; });
    // keep the property small: drop looks not seen in the last 30 decks
    Object.keys(h.looks).forEach(function (l) { if (h.seq - h.looks[l] > 30) delete h.looks[l]; });
    PropertiesService.getScriptProperties().setProperty(DESIGN_USAGE_KEY_, JSON.stringify(h));
  } catch (e) {
    Logger.log('Design history not saved: ' + e.message);
  } finally {
    try { if (lock) lock.releaseLock(); } catch (e) {}
  }
}

// Score for how recently a design was used (any user): last deck -60, two decks ago -35, three -15, never used +15
function recencyScore_(history, tag) {
  const last = history && history.used ? history.used[tag] : null;
  if (last == null) return 15;
  const age = (history.seq || 0) + 1 - last;
  return age <= 1 ? -60 : age === 2 ? -35 : age === 3 ? -15 : 0;
}

// The same for a look (a family of designs that look alike): last deck -30, two decks ago -15
function lookRecencyScore_(history, look) {
  const last = history && history.looks ? history.looks[look] : null;
  if (last == null) return 8;
  const age = (history.seq || 0) + 1 - last;
  return age <= 1 ? -30 : age === 2 ? -15 : 0;
}

function recentDesigns_() {
  const h = loadDesignUsage_();
  return Object.keys(h.used || {}).filter(function (t) { return (h.seq || 0) - h.used[t] < 2; });
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
function headingCase_(t) {
  const str = String(t || '').trim();
  const words = str.split(/\s+/);
  if (words.length < 2) return str.replace(/\.$/, '');
  const parts = str.split(/[\s-]+/).slice(1);
  const caps = parts.filter(function (w) { return /^[A-Z][a-z]/.test(w.replace(/^[^A-Za-z]+/, '')); }).length;
  if (caps < Math.max(1, parts.length * 0.5)) return str.replace(/\.$/, '');   // already sentence case
  const keep = /^(AI|ML|ROI|KPIs?|CIO|CFO|CEO|CTO|IT|API|GCP|AWS|SAP|LLMs?|MLOps|LLMOps|GenAI|CSAT|NPS|SaaS|B2B|US|UK|EU|GDPR|CCPA|Q[1-4]|66degrees)$/;
  return words.map(function (w, i) {
    return w.split('-').map(function (part, j) {
      if (i === 0 && j === 0) return part;                                 // the first word keeps its capital
      // "Engineers/IT" -> "engineers/IT": each side of a slash is checked on its own
      return part.split('/').map(function (piece, q) {
        if (i === 0 && j === 0 && q === 0) return piece;
        const bare = piece.replace(/['’]s$/i, '').replace(/[^A-Za-z0-9]/g, '');
        if (keep.test(bare) || /^[A-Z]{2,}/.test(bare) || /\d/.test(bare)) return piece;
        return /^[^a-z]*[A-Z][a-z]/.test(piece) ? piece.toLowerCase() : piece;
      }).join('/');
    }).join('-');
  }).join(' ').replace(PRODUCT_NAMES_RE_, function (m) { return PRODUCT_NAMES_[m.toLowerCase()] || m; }).replace(/\.$/, '');
}

function sentenceCaseHeadings_(sp) {
  const fix = function (o, k) {
    if (!o || typeof o[k] !== 'string') return;
    // The design numbers the items itself: "1. Agents…", "2) Build…", "Step 3: Scale…" lose the typed number
    const t = o[k].replace(/^\s*(?:step\s+)?\d{1,2}\s*[.):\-–]\s+/i, '');
    o[k] = headingCase_(t.charAt(0).toUpperCase() + t.slice(1));
  };
  (sp.steps || []).forEach(function (st) { if (st && typeof st === 'object') fix(st, 'title'); });
  (sp.cases || []).forEach(function (c) { if (c && typeof c === 'object') fix(c, 'phase'); });
  if (sp.chart) {
    if (Array.isArray(sp.chart.categories)) sp.chart.categories = sp.chart.categories.map(function (c) { return typeof c === 'string' ? headingCase_(c) : c; });
    fix(sp.chart, 'unitLabel');
    (sp.chart.series || []).forEach(function (se) { if (se) fix(se, 'name'); });
  }
  // "Deep Technical Expertise: Our 350+ experts…" -> "Deep technical expertise: Our 350+ experts…"
  if (Array.isArray(sp.points)) sp.points = sp.points.map(function (p) {
    if (typeof p !== 'string') return p;
    const m = p.match(/^(.{3,48}?):\s+(.+)$/);
    return m ? headingCase_(m[1]) + ': ' + m[2] : p;
  });
  const t = String(sp.type || '').toLowerCase();
  if ((t === 'cover' || t === 'closing') && sp.subtitle) sp.subtitle = sentenceCase_(sp.subtitle, 2);
  if (Array.isArray(sp.columns)) sp.columns = sp.columns.map(function (c) {
    if (c && typeof c === 'object') { const v = c.title || c.label || c.name || c.header || ''; return headingCase_(String(v)); }
    return typeof c === 'string' ? headingCase_(c) : c;
  });
  if (Array.isArray(sp.options)) sp.options = sp.options.map(function (o) { return typeof o === 'string' ? headingCase_(o) : o; });
  (sp.items || []).forEach(function (it) { if (it && typeof it === 'object') { fix(it, 'title'); fix(it, 'label'); } });
  (sp.points || []).forEach(function (p) { if (p && typeof p === 'object') fix(p, 'title'); });
  ['left', 'right'].forEach(function (k) { if (sp[k]) { fix(sp[k], 'label'); fix(sp[k], 'title'); } });
  if (sp.insight) fix(sp.insight, 'title');
  if (sp.callout) { fix(sp.callout, 'title'); fix(sp.callout, 'label'); }
  (sp.results || []).forEach(function (r) { if (r && typeof r === 'object') fix(r, 'label'); });
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
      if (it && (/^\s*(targets?|goal)\b/i.test(String(it.value || '')) || /^\s*targets?\b/i.test(String(it.label || '')))) return true;   // targets are goals, not findings
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

/* =========================
   CONTENT CLEAN-UPS (Create mode, after planning)
========================= */

// "4% to 100%" -> value "100%", label "... (up from 4%)": one number per value, so it fits its box
function splitRangeValues_(sp) {
  const fix = function (o) {
    if (!o || typeof o.value !== 'string') return;
    // "Target: 15-20%" -> value "15-20%", label "Target: improved forecast accuracy" (the big number stays a number)
    const tg = o.value.match(/^\s*(targets?|goal|aim|objective)\s*[:\-–]?\s*(.+?)\s*$/i);
    if (tg && /\d/.test(tg[2])) {
      o.value = tg[2];
      const lbl = String(o.label || '').trim();
      if (!/^target/i.test(lbl)) o.label = 'Target: ' + (/^[A-Z][a-z]/.test(lbl) ? lbl.charAt(0).toLowerCase() + lbl.slice(1) : lbl);
      if (o.value.length <= 9) return;                     // a short target range ("15-20%", "3-5 days") stays as it is
    }
    // "Up to 60%" -> value "60%", label "Improved forecast accuracy (up to)": the big number stays a number
    const up = o.value.match(/^\s*(up to|as much as|at least|as little as)\s+(.+?)\s*$/i);
    if (up && /\d/.test(up[2])) {
      o.value = up[2];
      const lb = String(o.label || '').trim();
      o.label = (lb ? lb.replace(/\.$/, '') + ' ' : '') + '(' + up[1].toLowerCase() + ')';     // "Improved forecast accuracy (up to)"
    }
    const q = o.value.match(/^\s*(nearly|almost|about|around|approximately|approx\.?|roughly|over|more than|above)\s+(.+?)\s*$/i);
    if (q) o.value = /^(over|more than|above)$/i.test(q[1]) ? q[2].replace(/\+?$/, '+') : '~' + q[2];
    const r = o.value.match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(%|x|pp)?\s*$/i);
    if (r) {
      const unit = r[3] || '';
      o.value = r[2] + unit;
      o.label = String(o.label || '').replace(/\.$/, '') + (o.label ? ' ' : '') + '(' + r[1] + '-' + r[2] + unit + ' range)';
      return;
    }
    const m = o.value.match(/^\s*(.+?)\s+(?:to|→|->)\s+(.+?)\s*$/i);
    if (!m || !/\d/.test(m[1]) || !/\d/.test(m[2])) return;
    o.value = m[2];
    o.label = String(o.label || '').replace(/\.$/, '') + (o.label ? ' ' : '') + '(up from ' + m[1] + ')';
  };
  (sp.items || []).forEach(fix);
  (sp.results || []).forEach(fix);
}

// One-client case study: a solution written as one paragraph becomes 2-4 numbered steps (one per sentence)
function splitCaseSteps_(sp) {
  if (String(sp.type || '').toLowerCase() !== 'case_study' || Array.isArray(sp.cases)) return;
  let sol = sp.solution;
  if (Array.isArray(sol) && sol.length === 1) sol = sol[0];
  if (typeof sol !== 'string') return;
  const parts = sol.split(/(?<=[.!?])\s+(?=[A-Z])/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length >= 2) sp.solution = parts.slice(0, 4);
}

// A stats slide needs real numbers. Items whose value has no digit are not stats: with fewer than 2 numeric items
// left, the slide becomes a cards slide (label = card title, text = card text).
function statsNeedNumbers_(sp) {
  if (String(sp.type || '').toLowerCase() !== 'stats' || !Array.isArray(sp.items)) return sp;
  const numeric = sp.items.filter(function (it) { return it && /\d/.test(String(it.value || '')); });
  if (numeric.length >= 2) { sp.items = numeric; return sp; }
  return { type: 'cards', title: sp.title, lead: sp.takeaway || sp.lead || '',
    items: sp.items.map(function (it) { return { title: it.label || it.value || '', text: it.text || '' }; }),
    notes: sp.notes, fact_tags: sp.fact_tags, reference: null };
}

// Variety: a second "statement" slide becomes a cards slide; a second "bullets" slide with "Label: text" points too
/* ---------- V.1_27: variety and content checks ---------- */

// Story shape for this run: one of four, never the one the previous deck used (any user)
const STORY_SHAPES_ = [
  'Problem-led (why now -> what is broken -> what good looks like -> how to get there -> proof -> how to measure)',
  'Outcome-led (the result -> how it was achieved -> the building blocks -> proof -> what it takes)',
  'Roadmap-led (where you are -> the plan on one slide -> what changes for each team -> risks -> proof)',
  'Capability-led (the platform -> its parts -> how they work together -> use cases -> proof)'
];
function pickStoryShape_() {
  let last = -1;
  const props = PropertiesService.getScriptProperties();
  try { last = parseInt(props.getProperty('STORY_SHAPE_LAST') || '-1', 10); } catch (e) {}
  const options = STORY_SHAPES_.map(function (x, i) { return i; }).filter(function (i) { return i !== last; });
  const k = options[Math.floor(Math.random() * options.length)];
  try { props.setProperty('STORY_SHAPE_LAST', String(k)); } catch (e) {}
  return STORY_SHAPES_[k];
}

// "2-5 Days" -> "2-5 days": unit words after a number are lower case (sentence case brand rule)
function lowerUnitWords_(sp) {
  const fix = function (v) {
    return typeof v === 'string'
      ? v.replace(/(\d\s*)(Days?|Hours?|Hrs?|Weeks?|Months?|Years?|Minutes?|Mins?|Seconds?|Secs?)\b/g, function (m, a, b) { return a + b.toLowerCase(); })
      : v;
  };
  ['items', 'results'].forEach(function (k) {
    if (Array.isArray(sp[k])) sp[k].forEach(function (it) { if (it && typeof it === 'object' && it.value) it.value = fix(it.value); });
  });
  if (Array.isArray(sp.cases)) sp.cases.forEach(function (c) { if (c && c.value_headline) c.value_headline = fix(c.value_headline); });
}

// A bullets slide always shows its points. When Gemini left the points out (and put the content in the notes or a
// callout), the points come from the slide's own notes; with nothing usable the slide becomes a statement slide.
function bulletsNeedPoints_(sp) {
  if (String((sp && sp.type) || '').toLowerCase() !== 'bullets') return sp;
  const pts = (Array.isArray(sp.points) ? sp.points : []).map(function (p) { return typeof p === 'string' ? p : (p && (p.title ? p.title + (p.text ? ': ' + p.text : '') : p.text)) || ''; })
    .map(function (p) { return String(p).trim(); }).filter(Boolean);
  if (pts.length >= 3) { sp.points = pts; return sp; }
  const notes = String(sp.notes || '').split(/\n\s*Sources?:/i)[0].replace(/\[\d+\]/g, '');
  const have = pts.join(' ').toLowerCase();
  const sents = notes.split(/(?<=[.!?])\s+/).map(function (x) { return x.trim().replace(/\s+/g, ' '); }).filter(function (x) {
    const w = x.split(' ').length;
    return w >= 6 && w <= 32 && !/illustrative|verify|validate|presenter|this slide/i.test(x) && have.indexOf(x.toLowerCase().slice(0, 30)) === -1;
  });
  const all = pts.concat(sents).slice(0, 5);
  if (all.length >= 3) { sp.points = all; return sp; }
  const c = sp.callout || {};
  return { type: 'statement', title: sp.title, statement: c.title || c.label || sp.title, text: [c.text].concat(all).filter(Boolean).join(' '),
    notes: sp.notes, fact_tags: sp.fact_tags || [], reference: null };
}

// A roadmap / phased plan slide (quarters, phases, months, waves)
function roadmapLike_(sp) {
  const t = String((sp && sp.type) || '').toLowerCase();
  if (['timeline', 'process', 'next_steps'].indexOf(t) === -1 && !/roadmap|phase|quarter|journey|momentum|quick wins?/i.test(String(sp.title || ''))) return false;
  const txt = JSON.stringify([sp.title, sp.periods, (sp.items || []).map(function (i) { return i && [i.date, i.label, i.title, i.timing]; })]).toLowerCase();
  return /\b(quarters?|q[1-4]|phases?|months?|weeks?|years?|waves?|sprints?|days? \d|\d+ days?|roadmap|quick wins?|early value)\b/.test(txt);
}

// A filler summary slide that only restates the deck
const FILLER_TITLE_RE_ = /\b(the future of .{2,40} is (now|here)|in summary|summary|conclusions?|key takeaways?|wrap[- ]?up|final thoughts|looking ahead|the road ahead|the path forward|bringing it all together)\b/i;
function fillerSlide_(sp, isLastBody) {
  const t = String((sp && sp.type) || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'template', 'team', 'case_study', 'next_steps'].indexOf(t) !== -1) return false;
  return FILLER_TITLE_RE_.test(String(sp.title || '') + ' ' + String(sp.statement || '')) || (isLastBody && t === 'statement');
}

// Topic family of a slide: two body slides in the same family say the same thing in different words
const TOPIC_FAMILIES_ = [
  ['credentials', /\b(trusted (partner|guide)|why (66degrees|us|partner)|partner with 66degrees|partner (of choice|for)|our expertise|technical expertise|credentials|who we are|about 66degrees|proven track record|track record|certifications?|leading the way|66degrees:)\b/i],
  ['services', /\b(end-to-end|lifecycle|our (services|offerings|capabilities)|how we (help|support)|support across|comprehensive support|accelerators?|purpose-built tools|offerings?|engagement model)\b/i],
  ['whynow', /\b(why now|why it matters now|rising|expectations?|the state of|the future of .{2,40} is|market (shift|trends?)|trends?|is changing|landscape|imperative|breakpoint|converging|demand for|at a crossroads|critical juncture)\b/i],
  ['value', /\b(benefits?|value of|business value|why (gemini|ai)|shift(ing)? from|from reactive|without .{2,30} with|before and after|old way|new way)\b/i],
  ['usecases', /\b(use cases?|applications? (of|for)|where .{2,30} (helps|delivers|adds value)|capabilities (across|for|in)|enhances .{2,40}(operations|service)|touchpoints|ways? .{2,20} helps?)\b/i],
  ['delivery', /\b(how we deliver|our (proven )?(framework|approach|methodology|process|method)|structured (approach|process|methodology)|implementation (process|plan|framework|approach|journey|steps)|implementing .{2,30}(framework|approach)|delivery (model|approach)|phased (approach|implementation)|step-by-step|comprehensive approach)\b/i],
  ['considerations', /\b(considerations|critical success factors|success factors|key decisions|decisions? (to make|for your)|common (challenges|pitfalls)|challenges to (address|overcome)|keys to success|what it takes)\b/i],
  ['riskgov', /\b(risks?|mitigat\w*|ai governance|responsible ai|guardrails?|ethic(s|al)|trust(worthy)? ai|hallucinations?)\b/i],
  ['security', /\b(security|secure|compliance|compliant|privacy|data protection|data governance|regulat\w*)\b/i],
  ['kpi', /\b(kpis?|measur(e|ing) (success|impact)|metrics?|tracking (success|progress)|success measures?|scorecard)\b/i],
  ['impact', /\b(quantif(y|ying|iable)|tangible (business )?(outcomes|impact|results)|business outcomes|roi\b|return on investment|value delivered)\b/i],
  ['roadmap', /\b(roadmap|phased|phases|quarters?|journey to|path to|quick wins?|early value|building momentum)\b/i]
];
function topicFamily_(sp, prompt) {
  const t = String(sp.title || '') + ' ' + String(sp.statement || '');
  // A roadmap slide (timeline) stays apart from "how we deliver" when the request asks for both
  if (String(sp.type || '').toLowerCase() === 'timeline' && roadmapLike_(sp)) {
    return /roadmap|phases|timeline|plan/i.test(String(prompt || '')) ? 'roadmap' : 'delivery';
  }
  for (let k = 0; k < TOPIC_FAMILIES_.length; k++) if (TOPIC_FAMILIES_[k][1].test(t)) return TOPIC_FAMILIES_[k][0];
  return null;
}
// How much a slide shows (the richer slide of a repeated topic is kept)
const TYPE_RICHNESS_ = { case_study: 9, stats: 8, chart: 8, comparison: 7, process: 6, timeline: 6, diagram: 6, table: 5, team: 5, cards: 4, bullets: 3, statement: 2, quote: 2 };
// Word stems (first 5 letters) of a slide's item headings: "assist" and "assistance" are the same idea
function headingStems_(sp) {
  const set = {};
  const add = function (t) { (String(t || '').toLowerCase().match(/[a-z]{4,}/g) || []).forEach(function (w) { set[w.slice(0, 5)] = true; }); };
  (sp.items || sp.steps || sp.layers || []).forEach(function (it) { if (it && typeof it === 'object') add(it.title || it.label); else add(it); });
  (sp.points || []).forEach(function (p) { add(typeof p === 'string' ? String(p).split(':')[0] : (p && p.title)); });
  return set;
}
// Topics the request lists ("…: why now, what good looks like, use cases, how we deliver, risks, KPIs, and a client result")
function requestedTopics_(prompt) {
  const p = String(prompt || '');
  const i = p.indexOf(':');
  const tail = i !== -1 ? p.slice(i + 1) : (p.match(/\b(?:cover|covering|include|including|about)\b(.+)$/i) || [])[1] || '';
  return tail.split(/,|;|\band\b|\n/i).map(function (x) { return x.replace(/^\s*(a|an|the)\s+/i, '').replace(/[.]+$/, '').trim(); })
    .filter(function (x) { return x && x.split(/\s+/).length <= 8 && x.length >= 3; }).slice(0, 14);
}

// Topic families the request asks for more than once (e.g. "risks" and "governance" both listed): kept that many times
function requestedFamilyCounts_(prompt) {
  const counts = {};
  requestedTopics_(prompt).forEach(function (t) { const f = topicFamily_({ title: t }); if (f) counts[f] = (counts[f] || 0) + 1; });
  return counts;
}

function wantsCredentials_(prompt) {
  return /66degrees|why us|about us|credential|our (team|experience|services|offerings)|accelerator|partner/i.test(String(prompt || ''));
}

// Approved client results, the most relevant to the request first (shared words with the request, its department and
// the source material). Used for case studies so a finance deck gets the data / finance client, not a legal-review one.
function rankCaseFacts_(ctx, facts) {
  const hay = tokenize_([ctx.userPrompt, ctx.department, ctx.presentationType].join(' '));
  const boost = /financ|fp&a|account|cost|data|analytic|platform|warehouse|report/i.test(String(ctx.userPrompt || '')) ? /data|analytic|warehouse|edw|cost|sql|platform|report/i : null;
  return facts.map(function (f, k) {
    const words = tokenize_(f);
    let sc = 0;
    hay.forEach(function (w) { if (words.indexOf(w) !== -1) sc += 2; });
    if (boost && boost.test(f)) sc += 3;
    return { f: f, sc: sc, k: k };
  }).sort(function (a, b) { return b.sc - a.sc || a.k - b.k; }).map(function (x) { return x.f; });
}

// Sentences of a slide's notes that can stand on the slide (no source lists, no reminders)
function noteSentences_(sp) {
  const notes = String((sp && sp.notes) || '').split(/\n\s*Sources?:/i)[0].replace(/\[\d+\]/g, '');
  return notes.split(/(?<=[.!?])\s+/).map(function (x) { return x.trim().replace(/\s+/g, ' '); }).filter(function (x) {
    const w = x.split(' ').length;
    return w >= 6 && w <= 32 && !/illustrative|verify|validate|presenter|this slide/i.test(x);
  });
}

// A statement slide with nothing next to the statement looks empty: its notes give it 2-3 point cards
function statementNeedsPoints_(sp) {
  if (String((sp && sp.type) || '').toLowerCase() !== 'statement') return sp;
  if (Array.isArray(sp.points) && sp.points.length >= 2) return sp;
  const said = (String(sp.statement || '') + ' ' + String(sp.text || '')).toLowerCase();
  const sents = noteSentences_(sp).filter(function (x) { return said.indexOf(x.toLowerCase().slice(0, 40)) === -1; }).slice(0, 3);
  if (sents.length < 2) return sp;
  sp.points = sents.map(function (x) {
    const words = x.replace(/[.!?]$/, '').split(' ');
    return { title: words.slice(0, 4).join(' ').replace(/[,;:]$/, ''), text: x };
  });
  return sp;
}

// Short centre label for a diagram made from a slide title: "Addressing risks in AI customer service" -> "Risks"
function centerLabel_(title) {
  let t = String(title || '').split(/[:—–-]/)[0].trim();
  t = t.replace(/^(addressing|managing|implementing|building|driving|delivering|unlocking|establishing|ensuring|measuring|mitigating|accelerating|transforming|achieving|our|the|key|core)\s+/i, '');
  t = t.split(/\s+(in|for|of|to|with|across|on|at|by|from|and)\s+/i)[0];
  const words = t.split(/\s+/).filter(Boolean).slice(0, 3);
  const out = words.join(' ');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : 'Overview';
}

// Request asks for client proof
const CASE_REQUEST_RE_ = /case stud|client (result|story|stories|example|success|proof|win)|customer (story|stories|success|example|result)|success stor|proof points?|reference (client|customer)|relevant client|similar client/i;

// Approved client results (case-study facts from the template library), for writing a case study slide
function caseStudyFacts_(ctx) {
  const lib = ctx.lib;
  const facts = ((lib && lib.companyFacts) || []).filter(function (f) { return f && f.category === 'case_study' && f.evidence !== 'conflict'; })
    .map(function (f) { return f.statement + ' [' + f.tag + ']'; });
  if (facts.length) return rankCaseFacts_(ctx, facts).slice(0, 20);
  return (ctx.approvedFacts || []).filter(function (f) { return /client|customer|saved|reduc|faster|\$\d|%/i.test(f); }).slice(0, 20);
}

// The body slides follow the order of the topics the request lists (one small Gemini call; skipped when the request
// lists no topics). Cover, agenda and closing keep their places.
function orderSlidesToRequest_(plan, ctx) {
  const topics = requestedTopics_(ctx.userPrompt);
  if (topics.length < 3 || !ctx.apiKey) return;
  const fixed = { cover: 1, agenda: 1, closing: 1 };
  const bodyIdx = plan.slides.map(function (sp, i) { return fixed[String(sp.type || '').toLowerCase()] ? -1 : i; }).filter(function (i) { return i !== -1; });
  if (bodyIdx.length < 3) return;
  try {
    const prompt = [
      'The request lists these topics in this order: ' + topics.map(function (t, k) { return (k + 1) + '. ' + t; }).join('  '),
      'These are the body slides of the presentation (id: title):',
      bodyIdx.map(function (i) { return i + ': ' + slideHeading_(plan.slides[i]); }).join('\n'),
      'Put the slides in the order that follows the request: the slides for topic 1 first, then topic 2, and so on. Slides that',
      'match no topic go next to the topic they support. Return every id exactly once.',
      'Return ONLY JSON: {"order":[id, ...]}'
    ].join('\n');
    const out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1);
    const order = ((out && out.order) || []).map(Number);
    const ok = order.length === bodyIdx.length && bodyIdx.every(function (i) { return order.indexOf(i) !== -1; });
    if (!ok) return;
    const body = order.map(function (i) { return plan.slides[i]; });
    let k = 0;
    plan.slides = plan.slides.map(function (sp, i) { return bodyIdx.indexOf(i) !== -1 ? body[k++] : sp; });
  } catch (e) {
    ctx.log.push('Slide order check skipped: ' + e.message);
  }
}

// At most 2 "cards" slides (one per 7 slides in long decks): the others become a diagram, a two-column table or bullets,
// so the deck is not a run of card grids. Cards with special content (teams, OKRs, bullet points per card) stay.
function limitCardSlides_(slides, n, maxOverride) {
  const max = maxOverride != null ? maxOverride : (n >= 30 ? Math.max(2, Math.round(n / 7)) : 2);
  let cards = 0, k = 0, hasBullets = slides.some(function (sp) { return String(sp.type || '').toLowerCase() === 'bullets'; });
  slides.forEach(function (sp, i) {
    if (String(sp.type || '').toLowerCase() !== 'cards') return;
    const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
    const special = sp.teams || sp.org || sp.tabs || sp.epics || items.some(function (it) { return it && (it.points || it.label || it.challenge); });
    if (special || ++cards <= max || items.length < 3) return;
    const base = { title: sp.title, lead: sp.lead || '', notes: sp.notes, fact_tags: sp.fact_tags || [], reference: null };
    const pick = (k++) % 3;
    if (pick === 2 && !hasBullets && items.length <= 6) {
      hasBullets = true;
      slides[i] = Object.assign(base, { type: 'bullets', points: items.map(function (it) { return (it.title ? it.title + ': ' : '') + (it.text || ''); }) });
    } else if (pick === 1 || items.length > 6) {
      slides[i] = Object.assign(base, { type: 'table', columns: ['Topic', 'What it means'], rows: items.map(function (it) { return [it.title || '', it.text || '']; }) });
    } else {
      slides[i] = Object.assign(base, { type: 'diagram', center: centerLabel_(sp.title),
        items: items.map(function (it) { return { title: it.title || '', text: it.text || '', icon: it.icon, material: it.material }; }) });
    }
  });
}

// A case study names its client: from the "client" field or from the approved fact it used (fact_tags)
function nameCaseClient_(sp, ctx) {
  if (String((sp && sp.type) || '').toLowerCase() !== 'case_study' || Array.isArray(sp.cases)) return;
  let client = String(sp.client || '').trim();
  if (!client && ctx.lib && Array.isArray(sp.fact_tags)) {
    (ctx.lib.companyFacts || []).forEach(function (f) {
      if (client || sp.fact_tags.indexOf(f.tag) === -1) return;
      const m = String(f.name || '').match(/client impact\s*[—-]\s*(.+)$/i) || String(f.statement || '').match(/^Client:\s*([^(.]+)/i);
      if (m) client = m[1].trim();
    });
  }
  if (!client || /^(a|an|the)\s/i.test(client)) return;
  sp.client = client;
  const title = String(sp.title || '');
  if (title.toLowerCase().indexOf(client.toLowerCase()) !== -1) return;
  const rest = title.replace(/^(client success|case study|success story|client result|customer story)\s*[:\-–—]\s*/i, '');
  const t = client + ': ' + rest.charAt(0).toLowerCase() + rest.slice(1);
  if (ENGINE.titleFits(t)) { sp.title = t; return; }
  // Too long with the client name: the key result becomes the title ("Gordon Food Service: 40% lower operating costs")
  const r = (sp.results || []).filter(function (x) { return x && x.value; })[0];
  const lab = String((r && r.label) || '').split(/[,.;(]/)[0].replace(/\s+(via|through|by|from|with|across|for|due to|thanks to)\s.*$/i, '').trim()
    .split(/\s+/).slice(0, 5).join(' ');
  const byResult = r ? client + ': ' + r.value + ' ' + lab.charAt(0).toLowerCase() + lab.slice(1) : '';
  if (byResult && ENGINE.titleFits(byResult)) { sp.title = byResult; return; }
  sp.title = client + ' case study';
}

function limitRepeatedTypes_(slides) {
  const seen = {};
  return slides.map(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    seen[t] = (seen[t] || 0) + 1;
    if (seen[t] < 2) return sp;
    if (t === 'statement' && Array.isArray(sp.points) && sp.points.length >= 2) {
      return { type: 'cards', title: sp.title || sp.statement, lead: sp.statement && sp.title ? sp.statement : (sp.text || ''),
        items: sp.points.map(function (p) { return typeof p === 'string' ? { title: p, text: '' } : { title: p.title || '', text: p.text || '' }; }),
        notes: sp.notes, fact_tags: sp.fact_tags, reference: null };
    }
    if (t === 'bullets' && Array.isArray(sp.points)) {
      const items = sp.points.map(function (p) {
        const m = String(p).match(/^(.{3,48}?):\s+(.+)$/);
        return m ? { title: m[1], text: m[2] } : null;
      });
      if (items.length >= 2 && items.every(Boolean)) {
        return { type: 'cards', title: sp.title, lead: sp.callout ? [sp.callout.title, sp.callout.text].filter(Boolean).join(': ') : '',
          items: items.slice(0, 6), notes: sp.notes, fact_tags: sp.fact_tags, reference: null };
      }
    }
    return sp;
  });
}

// Words of a slide (title and content, not notes/design data), for spotting two slides that say the same thing
function slideWords_(sp) {
  const out = [];
  (function walk(o, k) {
    if (o == null || k === 'notes' || k === 'reference' || k === 'design' || k === 'type' || k === 'fact_tags' || k === 'icon' || k === 'material') return;
    if (typeof o === 'string') { (o.toLowerCase().match(/[a-z0-9%$]{4,}/g) || []).forEach(function (w) { out.push(w); }); return; }
    if (Array.isArray(o)) { o.forEach(function (v) { walk(v, ''); }); return; }
    if (typeof o === 'object') Object.keys(o).forEach(function (kk) { walk(o[kk], kk); });
  })(sp, '');
  const set = {};
  out.forEach(function (w) { set[w] = true; });
  return set;
}
function overlap_(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (!ka.length || !kb.length) return 0;
  const shared = ka.filter(function (w) { return b[w]; }).length;
  return shared / Math.min(ka.length, kb.length);
}

// Two body slides with (nearly) the same content: the later one is replaced by a new slide on a topic the deck does
// not cover yet (one Gemini call). If that fails, the duplicate is removed.
function replaceDuplicateSlides_(plan, ctx) {
  const skip = { cover: 1, agenda: 1, closing: 1, template: 1, team: 1 };
  const dupIdx = [];
  const words = plan.slides.map(function (sp) { return skip[String(sp.type || '').toLowerCase()] ? null : slideWords_(sp); });
  for (let i = 0; i < plan.slides.length; i++) {
    if (!words[i]) continue;
    for (let j = 0; j < i; j++) {
      if (!words[j] || dupIdx.indexOf(j) !== -1) continue;
      if (overlap_(words[i], words[j]) >= 0.6 || sameNumbers_(plan.slides[i], plan.slides[j]) || sameFramework_(plan.slides[i], plan.slides[j])) { dupIdx.push(i); break; }
    }
  }
  // A "Next steps" slide only when the request asks for one (strict rule)
  const wantsNext = /next\s*steps?|call to action|\bcta\b|action plan/i.test(String(ctx.userPrompt || ''));
  if (!wantsNext) plan.slides.forEach(function (sp, i) {
    if ((String(sp.type || '').toLowerCase() === 'next_steps' || /^\s*(your\s+)?next\s+steps?\b/i.test(String(sp.title || ''))) && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  // Topics repeated in other words, or one topic split over several slides: Gemini lists them, they get new topics
  topicRepeats_(plan, ctx).forEach(function (i) { if (dupIdx.indexOf(i) === -1) dupIdx.push(i); });
  // The same topic in other words (checked in code): slides of one topic family, or slides whose item headings share most
  // word stems ("Agent assist / Self-service" twice). The richer slide is kept, the others get new topics.
  const families = {};
  plan.slides.forEach(function (sp, i) {
    const t = String(sp.type || '').toLowerCase();
    if (skip[t] || t === 'case_study' || dupIdx.indexOf(i) !== -1) return;
    const f = topicFamily_(sp, ctx.userPrompt);
    if (f && f !== 'roadmap') (families[f] = families[f] || []).push(i);
  });
  const askedFam = requestedFamilyCounts_(ctx.userPrompt);
  Object.keys(families).forEach(function (f) {
    const list = families[f];
    const allow = Math.max(1, askedFam[f] || 0);
    if (list.length <= allow) return;
    const keep = list.slice().sort(function (a, b) {
      return (TYPE_RICHNESS_[String(plan.slides[b].type).toLowerCase()] || 0) - (TYPE_RICHNESS_[String(plan.slides[a].type).toLowerCase()] || 0) || a - b;
    }).slice(0, allow);
    list.forEach(function (i) { if (keep.indexOf(i) === -1 && dupIdx.indexOf(i) === -1) dupIdx.push(i); });
  });
  const stems = plan.slides.map(function (sp) { return skip[String(sp.type || '').toLowerCase()] ? null : headingStems_(sp); });
  for (let i = 0; i < plan.slides.length; i++) {
    if (!stems[i] || Object.keys(stems[i]).length < 4 || dupIdx.indexOf(i) !== -1) continue;
    for (let j = 0; j < i; j++) {
      if (!stems[j] || dupIdx.indexOf(j) !== -1 || Object.keys(stems[j]).length < 4) continue;
      if (/case_study/i.test(String(plan.slides[i].type)) || /case_study/i.test(String(plan.slides[j].type))) continue;
      if (overlap_(stems[i], stems[j]) >= 0.45) {
        const ri = TYPE_RICHNESS_[String(plan.slides[i].type).toLowerCase()] || 0, rj = TYPE_RICHNESS_[String(plan.slides[j].type).toLowerCase()] || 0;
        const drop = ri > rj ? j : i;
        if (dupIdx.indexOf(drop) === -1) dupIdx.push(drop);
        break;
      }
    }
  }
  // 66degrees credentials / services / accelerators only when the request asks for them
  if (!wantsCredentials_(ctx.userPrompt)) {
    plan.slides.forEach(function (sp, i) {
      const f = topicFamily_(sp, ctx.userPrompt);
      if ((f === 'credentials' || f === 'services') && dupIdx.indexOf(i) === -1) dupIdx.push(i);
    });
  }
  // One roadmap per deck: a second slide about the phases / quarters / early value is a repeat (checked in code)
  let roadmapSeen = false;
  plan.slides.forEach(function (sp, i) {
    if (skip[String(sp.type || '').toLowerCase()] || !roadmapLike_(sp)) return;
    if (roadmapSeen && dupIdx.indexOf(i) === -1) dupIdx.push(i);
    if (dupIdx.indexOf(i) === -1) roadmapSeen = true;
  });
  // A filler summary slide ("The future of FP&A is now") is replaced unless the request asks for a summary
  const bodyIdx = plan.slides.map(function (sp, i) { return skip[String(sp.type || '').toLowerCase()] ? -1 : i; }).filter(function (i) { return i !== -1; });
  const lastBody = bodyIdx.length ? bodyIdx[bodyIdx.length - 1] : -1;
  if (!/summary|takeaway|conclusion|recap|wrap[- ]?up/i.test(String(ctx.userPrompt || ''))) plan.slides.forEach(function (sp, i) {
    if (fillerSlide_(sp, i === lastBody) && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  // Client proof asked for but missing: one slot becomes a case study (a replaced slide, else a credentials slide)
  const wantsCase = CASE_REQUEST_RE_.test(String(ctx.userPrompt || ''));
  const hasCase = plan.slides.some(function (sp, i) { return String(sp.type || '').toLowerCase() === 'case_study' && dupIdx.indexOf(i) === -1; });
  const caseFacts = wantsCase && !hasCase ? caseStudyFacts_(ctx) : [];
  let needCase = wantsCase && !hasCase && caseFacts.length > 0;
  if (needCase && !dupIdx.length) {
    const cred = bodyIdx.filter(function (i) { return /trusted|why 66degrees|why us|our expertise|credentials|partner of choice|about 66degrees|who we are/i.test(String(plan.slides[i].title || '')); });
    const fallback = bodyIdx.filter(function (i) { return ['team', 'template'].indexOf(String(plan.slides[i].type || '').toLowerCase()) === -1; });
    const slot = cred.length ? cred[0] : fallback[fallback.length - 1];
    if (slot != null) dupIdx.push(slot);
    else needCase = false;
  }
  // Empty dividers ("section") and comparisons over the limit are replaced too
  const compMax = plan.slides.length >= 14 ? 2 : 1;
  let comps = 0;
  plan.slides.forEach(function (sp, i) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'section' && dupIdx.indexOf(i) === -1) dupIdx.push(i);
    if (t === 'comparison' && ++comps > compMax && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  dupIdx.sort(function (a, b) { return a - b; });
  if (!dupIdx.length) return;
  const titles = plan.slides.filter(function (sp, i) { return dupIdx.indexOf(i) === -1 && !skip[String(sp.type || '').toLowerCase()]; })
    .map(function (sp) { return slideHeading_(sp); });
  const keptSlides = plan.slides.filter(function (sp, i) { return dupIdx.indexOf(i) === -1; });
  const keepsRoadmap = keptSlides.some(roadmapLike_);
  let fresh = [];
  try {
    const prompt = [
      'The request: ' + String(ctx.userPrompt || '').slice(0, 600),
      'A ' + ctx.brand.name + ' presentation titled "' + (plan.deck_title || '') + '" has these slides:',
      titles.map(function (t, k) { return (k + 1) + '. ' + t; }).join('\n'),
      '',
      'Write ' + dupIdx.length + ' NEW body slide(s) on topics the deck does not cover yet, in the same JSON slide format.',
      requestedTopics_(ctx.userPrompt).length ? 'The request asks for these topics, in this order: ' + requestedTopics_(ctx.userPrompt).join('; ') +
        '. FIRST write a slide for every requested topic that no slide above covers yet (e.g. "how we deliver" = a process slide with ' +
        'the delivery steps; "KPIs" = a stats slide with target numbers, labels starting "Target:").' : '',
      needCase ? 'The FIRST new slide MUST be a case study (type "case_study", one client) built ONLY on the approved client result below\n' +
        'whose work is closest to the request (the same kind of work: data platform, analytics, cost savings...). Fields: title (names the\n' +
        'client), industry, challenge (2-3 sentences), solution [3-4 points of 15-25 words], results[{value, label}] (2-3, numbers copied\n' +
        'exactly from the fact), outcome (1-2 sentences). Put the fact ID in fact_tags.\nAPPROVED CLIENT RESULTS:\n' +
        caseFacts.slice(0, 3).map(function (f) { return '- ' + f; }).join('\n') : '',
      'Allowed types' + (needCase ? ' for the other slides' : '') + ': process (title, lead, items[{title, text}] 3-5),',
      'stats (title, items[{value, label, text}] 3-4), comparison (title, left{label, points[]}, right{label, points[]}),',
      'diagram (title, lead, center, items[{title, text}] 4-6, 8-20 words each), cards (only if nothing else fits: title, lead, items[{title, text}] 3-4)' +
        (keepsRoadmap ? '.' : ', timeline (title, items[{label, title, text}] 3-5).'),
      'Each new slide takes a different angle that the request supports (how it works, risks and how to manage them, what changes',
      'for each team, decisions to make). No 66degrees credentials, services or accelerators slide. ' + (keepsRoadmap ? 'The deck already has its roadmap: never write another roadmap, phases, ' +
        'quarters, timeline, quick wins or "early value" slide. ' : '') + 'No summary or "future of" slide.',
      'Sentence-case titles, max 58 characters. No invented numbers, clients or quotes.',
      'Return ONLY JSON: {"slides":[...]}'
    ].filter(Boolean).join('\n');
    const out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.6);
    fresh = ((out && out.slides) || []).map(function (sp) { return ENGINE.cleanSpec(sp); });
  } catch (e) {
    ctx.log.push('Duplicate slide check: could not write a replacement (' + e.message + ').');
  }
  // A new slide is used only when it really is new (no second roadmap, no repeat of a kept slide)
  const keptWords = keptSlides.map(function (sp) { return slideWords_(sp); });
  let roadmapNow = keepsRoadmap;
  fresh = fresh.filter(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'case_study') {
      if (Array.isArray(sp.results)) sp.results = sp.results.filter(function (r) { return r && /\d/.test(String(r.value || '')); });
      splitCaseSteps_(sp);
      return !!(sp.challenge || (sp.results || []).length);
    }
    if (roadmapLike_(sp)) { if (roadmapNow) return false; roadmapNow = true; }
    const w = slideWords_(sp);
    return !keptWords.some(function (kw) { return overlap_(w, kw) >= 0.6; });
  });
  let k = 0;
  const kept = [];
  plan.slides.forEach(function (sp, i) {
    if (dupIdx.indexOf(i) === -1) { kept.push(sp); return; }
    if (fresh[k]) { removeHypeWords_(fresh[k]); sentenceCaseHeadings_(fresh[k]); kept.push(fresh[k]); }
    k++;
  });
  plan.slides = kept;
  ctx.log.push(dupIdx.length + ' slide(s) (repeated topics or numbers, a second roadmap, a filler summary, an unrequested next-steps slide, empty dividers or extra comparisons) were replaced with new topics' +
    (needCase ? ', including the client case study the request asked for' : '') + '.');
}

// Cards: a blue highlight line on every card or on none (2 of 3 looks unfinished)
function evenHighlights_(sp) {
  if (!Array.isArray(sp.items) || sp.items.length < 2) return;
  const withH = sp.items.filter(function (it) { return it && it.highlight; }).length;
  if (withH && withH < sp.items.length) sp.items.forEach(function (it) { if (it) delete it.highlight; });
}

// Numbers shown on a slide (with their unit), e.g. ["93%", "89%", "30%"]
function slideNumbers_(sp) {
  const out = {};
  (function walk(o, k) {
    if (o == null || k === 'notes' || k === 'reference' || k === 'fact_tags') return;
    if (typeof o === 'number') { out[String(o)] = true; return; }
    if (typeof o === 'string') { (o.match(/\d+(?:\.\d+)?\s?(?:%|x|pp|[KMB]\b)?/g) || []).forEach(function (n) { if (!/^\d{4}$/.test(n.trim())) out[n.replace(/\s/g, '')] = true; }); return; }
    if (Array.isArray(o)) { o.forEach(function (v) { walk(v, ''); }); return; }
    if (typeof o === 'object') Object.keys(o).forEach(function (kk) { walk(o[kk], kk); });
  })(sp, '');
  return Object.keys(out).filter(function (n) { return /[%xKMB]|pp/.test(n) || Number(n) >= 10; });
}
// Two slides whose main figures are the same (3+ shared numbers, or a chart / stats slide whose figures all appear before)
function sameNumbers_(a, b) {
  const bare = function (list) { return list.map(function (n) { return n.replace(/[^\d.]/g, ''); }).filter(function (n, i, all) { return n && all.indexOf(n) === i; }); };
  const na = bare(slideNumbers_(a)), nb = bare(slideNumbers_(b));
  if (na.length < 2) return false;
  const shared = na.filter(function (n) { return nb.indexOf(n) !== -1; }).length;
  const dataSlide = /^(chart|stats)$/i.test(String(a.type || ''));
  return shared >= 3 || (dataSlide && shared >= 2 && shared >= na.length * 0.66);
}
// Two slides built on the same set of item headings (e.g. Modernize / Build / Manage twice)
function headingWords_(sp) {
  const set = {};
  const add = function (t) { (String(t || '').toLowerCase().match(/[a-z]{4,}/g) || []).forEach(function (w) { set[w] = true; }); };
  (sp.items || sp.steps || []).forEach(function (it) { if (it && typeof it === 'object') add(it.title || it.label); });
  (sp.cases || []).forEach(function (c) { if (c) add(c.phase); });
  return set;
}
function sameFramework_(a, b) {
  if (/case_study/i.test(String(a.type || '')) || /case_study/i.test(String(b.type || ''))) return false;   // client proof stays
  const ha = headingWords_(a), hb = headingWords_(b);
  if (Object.keys(ha).length < 3 || Object.keys(hb).length < 3) return false;
  return overlap_(ha, hb) >= 0.6;
}

// The same figure (e.g. "40%") is shown once per deck: client proof (case studies, card highlights) keeps it, later
// stats and charts lose that item. A stats slide left with fewer than 2 numbers becomes cards (statsNeedNumbers_).
function dedupeStatValues_(slides) {
  const seen = {};
  const norm = function (v) { return String(v || '').replace(/\s/g, '').toLowerCase().replace(/\+$/, ''); };
  const nums = function (t) { return (String(t || '').match(/[$€£]?\d+(?:[.,]\d+)?\s?(?:%|x|pp|[kmb]\b|\+)?/gi) || []).map(norm); };
  slides.forEach(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'case_study') {
      (sp.results || []).forEach(function (r) { nums(r && r.value).forEach(function (n) { seen[n] = true; }); });
      (sp.cases || []).forEach(function (c) { nums(c && c.value_headline).forEach(function (n) { seen[n] = true; }); });
    }
    (sp.items || []).forEach(function (it) { if (it && it.highlight) nums(it.highlight).forEach(function (n) { seen[n] = true; }); });
  });
  slides.forEach(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (t !== 'stats' || !Array.isArray(sp.items)) return;
    sp.items = sp.items.filter(function (it) {
      const v = norm(it && it.value);
      if (v && seen[v]) return false;
      if (v) seen[v] = true;
      return true;
    });
  });
}

// Gemini reads the slide list and names slides that repeat a topic already covered or split one topic over several
// slides. Returns their indexes (the later slide of each repeat). Empty when the check is not possible.
function topicRepeats_(plan, ctx) {
  const skip = { cover: 1, agenda: 1, closing: 1, template: 1, team: 1 };
  const list = [];
  plan.slides.forEach(function (sp, i) {
    if (skip[String(sp.type || '').toLowerCase()]) return;
    const heads = (sp.items || sp.cases || []).map(function (it) { return it && (it.title || it.phase || it.label); }).filter(Boolean).slice(0, 6);
    list.push({ i: i, title: slideHeading_(sp), parts: heads.join('; ') });
  });
  if (list.length < 6 || !ctx.apiKey) return [];
  try {
    const prompt = [
      'These are the body slides of one presentation (index, title, item headings):',
      list.map(function (x) { return x.i + '. ' + x.title + (x.parts ? '  [' + x.parts + ']' : ''); }).join('\n'),
      '',
      'List the slides that should be removed because they repeat a topic another slide already covers, or because one topic',
      'is split over several slides (for example a plan slide followed by one slide per phase, or a "today" slide, a "future"',
      'slide and a comparison slide). Keep the strongest slide of each group; list only the others. If nothing repeats, return [].',
      'Return ONLY JSON: {"remove":[index, ...]}'
    ].join('\n');
    const out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1);
    const valid = list.map(function (x) { return x.i; });
    return ((out && out.remove) || []).map(Number).filter(function (i) { return valid.indexOf(i) !== -1; }).slice(0, Math.floor(list.length / 3));
  } catch (e) {
    ctx.log.push('Topic check skipped: ' + e.message);
    return [];
  }
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
    maxSlides: MAX_SLIDES_,
    hasVertexConfig: isVertexConfigured_()
  };
}

function runDeckGeneration(data) {
  return generatePresentation(data);
}

/* =========================
   LONG RUNS (V.1_27+): up to 200 slides
   One Apps Script run stops after 6 minutes, so a long deck (more than 20 slides) or a large rebrand is built in parts.
   Each run does as much as fits in ~4.5 minutes, saves where it stopped and returns { continue: true }; the panel then
   calls continueDeckGeneration(runId) for the next part, until the deck is finished.
========================= */
const MAX_SLIDES_ = 200;            // panel and server limit, Create and Rebrand
const SINGLE_RUN_MAX_ = 20;         // decks up to this size are made in one run (the full single-run pipeline)
const LONG_BATCH_ = 8;              // slides written, fitted and drawn together in a long deck
const REBRAND_CHUNK_ = 10;          // slides rebranded together
const RUN_BUDGET_MS_ = 270000;      // stop starting new parts after ~4.5 minutes

function continueDeckGeneration(runId) {
  const t0 = Date.now();
  runId = String(runId || '').slice(0, 60);
  const st = loadRunState_(runId);
  if (!st) throw new Error('This run is no longer available (it finished, was cancelled or expired). Please start again.');
  const ctx = { runId: runId, progress: null, blobCache: {}, generatedIcons: 0, log: st.log || [] };
  try {
    loadRunContext_(ctx);
    checkCancel_(ctx);
    const target = SlidesApp.getActivePresentation();
    const res = st.mode === 'rebrand' ? rebrandStep_(ctx, target, st, t0) : longDeckStep_(ctx, target, st, t0);
    if (res && typeof res === 'object') res.elapsedMs = Date.now() - (st.startedAt || t0);
    return res;
  } catch (e) {
    deleteRunState_(runId);
    if (e && e.cancelled) {
      return generationResult_('CANCELLED: Stopped at your request. ' + (st.mode === 'rebrand'
        ? 'Slides that were already processed keep their new styling.' : 'The slides already added stay in your deck.'), null, 0);
    }
    throw e;
  }
}

// Run state: small states in the user's properties, large ones (long decks with sources) in a Drive file that is
// deleted when the run ends
function saveRunState_(runId, st) {
  try { if (CacheService.getUserCache().get('cancel_' + runId)) { deleteRunState_(runId); return; } } catch (e) {}
  const json = JSON.stringify(st);
  const props = PropertiesService.getUserProperties();
  const key = 'RUNSTATE_' + runId;
  const old = props.getProperty(key);
  if (json.length < 8000) {
    if (old && /^file:/.test(old)) { try { DriveApp.getFileById(old.slice(5)).setTrashed(true); } catch (e) {} }
    props.setProperty(key, json);
    return;
  }
  let file = null;
  if (old && /^file:/.test(old)) { try { file = DriveApp.getFileById(old.slice(5)); file.setContent(json); } catch (e) { file = null; } }
  if (!file) {
    file = DriveApp.createFile('66deck-run-' + runId + '.json', json, 'application/json');
    props.setProperty(key, 'file:' + file.getId());
  }
}
function loadRunState_(runId) {
  const raw = PropertiesService.getUserProperties().getProperty('RUNSTATE_' + runId);
  if (!raw) return null;
  try {
    if (/^file:/.test(raw)) return JSON.parse(DriveApp.getFileById(raw.slice(5)).getBlob().getDataAsString());
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function deleteRunState_(runId) {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty('RUNSTATE_' + runId);
  if (raw && /^file:/.test(raw)) { try { DriveApp.getFileById(raw.slice(5)).setTrashed(true); } catch (e) {} }
  try { props.deleteProperty('RUNSTATE_' + runId); } catch (e) {}
}

function continueResult_(st, done, total, what) {
  return { ok: true, continue: true, runId: st.runId, done: done, total: total, slideCount: done,
    message: done + ' of ' + total + ' slides ' + what + ' — continuing' };
}

/* ---------- Long Create decks ---------- */

// The outline of a long deck: sections with one line per slide (type, title, what it covers). Fixed before any slide is
// written, so every slide has its own topic and the agenda is right from the start.
function planOutline_(userPrompt, presentationType, n, sources, ctx) {
  const body = n - 3;                                   // cover, agenda and closing are added by the code
  const sections = Math.max(4, Math.min(12, Math.round(body / 7)));
  const topics = requestedTopics_(userPrompt);
  const facts = libraryFacts(ctx.lib, [userPrompt, presentationType, String(sources.text || '').slice(0, 4000)].join(' '), 30);
  ctx.userPrompt = userPrompt;
  const caseFacts = caseStudyFacts_(ctx).slice(0, 3);          // the most relevant client results only
  const prompt = [
    'You are the senior presentation strategist for ' + ctx.brand.name + '. Plan the OUTLINE of a long presentation.',
    'REQUEST: "' + (userPrompt || 'Build the presentation from the attached source material.') + '"',
    'PRESENTATION TYPE: ' + presentationType + '   DEPARTMENT: ' + (ctx.department || 'Other'),
    'BODY SLIDES: exactly ' + body + ' (the code adds the cover, the agenda and the closing), grouped into ' + sections + ' sections.',
    topics.length ? 'The request lists these topics in this order - the sections follow this order: ' + topics.join('; ') + '.' : '',
    'RULES:',
    '- Every slide has its own topic: never two slides about the same thing in different words, never one topic split into "part 1/part 2".',
    '- Slide types: cards, process, timeline, stats, chart, comparison, diagram, table, case_study, bullets, statement, team.',
    '  Mix them like a designed deck: at most ' + Math.max(2, Math.round(n / 7)) + ' "cards" slides in total, at most ' + Math.max(1, Math.round(n / 15)) +
    ' "statement" slides, at most ' + Math.max(1, Math.round(n / 15)) + ' "bullets" slides, never the same type three times in a row. Use process for how things are done, diagram for parts of a whole,',
    '  comparison for before/after, stats only when real numbers exist (or targets for KPIs), timeline only for the one roadmap.',
    '- At most ONE roadmap / phased-plan slide. No filler summary slides ("the future of...", "in summary").',
    '- No 66degrees credentials / services / accelerators slides unless the request asks for them.',
    '- One slide per topic: "how we deliver / our framework / our approach / implementation process" is ONE topic, "considerations /',
    '  success factors / key decisions" is ONE topic, "why now / landscape / imperative" is ONE topic.',
    '- Every number appears on ONE slide only (never the same statistic on several slides).',
    '- case_study slides only for these approved client results (the most relevant to the request), one slide per client:',
    caseFacts.length ? caseFacts.map(function (f) { return '  - ' + f; }).join('\n') : '  (none available: no case_study slides)',
    '- Titles: the key message in sentence case, max 58 characters, all different. "brief": one line on what the slide covers.',
    '- Section titles: 2-6 words, sentence case.',
    facts.usable.length ? 'APPROVED FACTS (the only claims about ' + ctx.brand.name + '):\n' + facts.usable.map(function (f) { return '- ' + f; }).join('\n') : '',
    sources.research && sources.research.length ? formatSciteForPrompt(sources.research, sources.researchProvider) : '',
    sources.text ? 'USER SOURCE MATERIAL:\n' + String(sources.text).slice(0, 12000) : '',
    'Return ONLY JSON: {"deck_title":"","subtitle":"","closing_subtitle":"","sections":[{"title":"","slides":[{"type":"","title":"","brief":""}]}]}'
  ].filter(Boolean).join('\n');
  const parts = [{ text: prompt }];
  (sources.pdfs || []).forEach(function (b64) { parts.push({ inline_data: { mime_type: 'application/pdf', data: b64 } }); });
  (sources.images || []).forEach(function (im) { parts.push({ inline_data: { mime_type: im.mime, data: im.data } }); });
  const out = callGeminiJSON(parts, ctx.apiKey, 0.6);
  const allowed = { cards: 1, process: 1, timeline: 1, stats: 1, chart: 1, comparison: 1, diagram: 1, table: 1, case_study: 1, bullets: 1, statement: 1, team: 1 };
  const seen = {};
  const secs = [];
  const slides = [];
  ((out && out.sections) || []).forEach(function (sec) {
    const list = [];
    ((sec && sec.slides) || []).forEach(function (o) {
      if (!o || !o.title || slides.length >= body) return;
      const key = String(o.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen[key]) return;
      seen[key] = true;
      const t = String(o.type || '').toLowerCase();
      const sl = { type: allowed[t] ? t : 'cards', title: sentenceCase_(String(o.title).slice(0, 80), 2), brief: String(o.brief || '').slice(0, 200) };
      if (sl.type === 'team' && !/\b[A-Z][a-z]+ [A-Z][a-z]+/.test(String(userPrompt || '') + ' ' + String(sources.text || ''))) sl.type = 'cards';
      list.push(sl);
      slides.push(sl);
    });
    if (list.length) secs.push({ title: sentenceCase_(String(sec.title || 'Section ' + (secs.length + 1)), 2), count: list.length });
  });
  if (!slides.length) throw new Error('Gemini returned no outline for the long deck.');
  // The same checks as a short deck, on the outline: no unrequested credentials, one roadmap, no filler, each topic
  // family at most once per ~20 slides; removed entries are replaced by new topics in the same place
  const removed = outlineChecks_(slides, userPrompt, n);
  if (removed.length) {
    let fresh = [];
    try {
      const keepTitles = slides.filter(function (o, i) { return removed.indexOf(i) === -1; }).map(function (o) { return o.title; });
      const topPrompt = [
        'A long presentation for the request "' + String(userPrompt || '').slice(0, 400) + '" has these slides:',
        keepTitles.join(' | '),
        'Write ' + removed.length + ' NEW slides on topics none of these slides covers (requested topics first: ' + (topics.join('; ') || 'any') + ').',
        'No 66degrees credentials, services, accelerators, roadmap, summary or "future of" slides. Types: process, diagram, comparison,',
        'table, stats (real numbers only), cards. Titles in sentence case, max 58 characters.',
        'Return ONLY JSON: {"slides":[{"type":"","title":"","brief":""}]}'
      ].join('\n');
      const extra = callGeminiJSON([{ text: topPrompt }], ctx.apiKey, 0.6);
      fresh = ((extra && extra.slides) || []).filter(function (o) {
        if (!o || !o.title) return false;
        const key = String(o.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      }).map(function (o) {
        const t = String(o.type || '').toLowerCase();
        return { type: allowed[t] && t !== 'team' && t !== 'case_study' ? t : 'diagram', title: sentenceCase_(String(o.title).slice(0, 80), 2), brief: String(o.brief || '').slice(0, 200) };
      }).filter(function (o) { return !outlineChecks_([o], userPrompt, n, slides.filter(function (x, i) { return removed.indexOf(i) === -1; })).length; });
    } catch (e) { ctx.log.push('Outline top-up skipped: ' + e.message); }
    let k = 0;
    const kept = [];
    slides.forEach(function (o, i) {
      if (removed.indexOf(i) === -1) kept.push(o);
      else if (fresh[k]) kept.push(fresh[k++]);
    });
    // section counts follow the slides that stayed
    let pos = 0;
    secs.forEach(function (sc) { sc.count = Math.max(0, Math.min(sc.count, kept.length - pos)); pos += sc.count; });
    slides.length = 0;
    kept.forEach(function (o) { slides.push(o); });
    ctx.log.push('Outline: ' + removed.length + ' slide(s) replaced (unrequested credentials, repeated topics, a second roadmap or filler).');
  }
  if (slides.length < body) ctx.log.push('The outline has ' + slides.length + ' body slides (asked for ' + body + ').');
  const agendaItems = slides.length <= 16
    ? slides.map(function (o) { return { title: o.title, text: '' }; })
    : secs.filter(function (sc) { return sc.count > 0; }).slice(0, 16).map(function (sc) { return { title: sc.title, text: sc.count + ' slides' }; });
  return { deck_title: out.deck_title || slides[0].title, subtitle: out.subtitle || '', closing_subtitle: out.closing_subtitle || '',
    sections: secs, slides: slides, agendaItems: agendaItems };
}

// Indexes of outline entries to replace. `before` = entries already accepted (for checking new entries).
function outlineChecks_(slides, prompt, n, before) {
  const out = [];
  const perFamily = Math.max(1, Math.round((n - 3) / 20));
  const asked = requestedFamilyCounts_(prompt);
  const counts = {};
  let roadmaps = 0;
  const wantsCreds = wantsCredentials_(prompt);
  const wantsSummary = /summary|takeaway|conclusion|recap/i.test(String(prompt || ''));
  (before || []).forEach(function (o) {
    const f = topicFamily_(o, prompt);
    if (f) counts[f] = (counts[f] || 0) + 1;
    if (roadmapLike_(o)) roadmaps++;
  });
  slides.forEach(function (o, i) {
    const f = topicFamily_(o, prompt);
    if (!wantsCreds && (f === 'credentials' || f === 'services')) { out.push(i); return; }
    if (!wantsSummary && FILLER_TITLE_RE_.test(String(o.title || ''))) { out.push(i); return; }
    if (roadmapLike_(o) || f === 'roadmap') { if (roadmaps >= 1) { out.push(i); return; } roadmaps++; }
    if (f && f !== 'roadmap') {
      counts[f] = (counts[f] || 0) + 1;
      if (counts[f] > Math.max(perFamily, asked[f] || 0)) { out.push(i); return; }
    }
  });
  return out;
}

// Numbers shown on earlier parts of a long deck are not shown again (stats items with a used value are dropped)
function dedupeDeckNumbers_(slides, used) {
  const norm = function (v) { return String(v || '').replace(/\s/g, '').toLowerCase().replace(/\+$/, ''); };
  const seen = {};
  (used || []).forEach(function (u) { seen[norm(u)] = true; });
  slides.forEach(function (sp) {
    if (String(sp.type || '').toLowerCase() === 'stats' && Array.isArray(sp.items)) {
      sp.items = sp.items.filter(function (it) { const v = norm(it && it.value); return !(v && seen[v]); });
    }
  });
  slides.forEach(function (sp) {
    slideNumbers_(sp).forEach(function (x) { const v = norm(x); if (v && !seen[v]) { seen[v] = true; used.push(x); } });
    (sp.items || []).forEach(function (it) { const v = norm(it && it.value); if (v && !seen[v]) { seen[v] = true; used.push(String(it.value)); } });
  });
}

function startLongDeck_(ctx, target, p, started) {
  progressStage_(ctx, 'write', 'active', 'Gemini is planning the outline of ' + p.n + ' slides');
  const outline = planOutline_(p.userPrompt, p.presentationType, p.n, p.sources, ctx);
  const st = {
    mode: 'create-long', runId: ctx.runId, startedAt: started, userPrompt: p.userPrompt, presentationType: p.presentationType,
    department: p.department, n: p.n, sources: p.sources, outline: outline, next: 0, drawn: 0, phase: 'body', avgBatchMs: 0, usedNumbers: [],
    chooser: { used: {}, looksUsed: {}, prevTag: null, prevLook: null, prevDark: false, darkUsed: 0 }, log: ctx.log
  };
  if (JSON.stringify(st).length > 40 * 1024 * 1024) { st.sources.pdfs = []; ctx.log.push('Uploaded PDFs were used for the outline only (too large to keep between runs).'); }
  // Cover and agenda first (the agenda lists the slide titles, or the sections in a very long deck)
  prepareLongCtx_(ctx, st);
  const head = [
    { type: 'cover', title: outline.deck_title, subtitle: outline.subtitle },
    { type: 'agenda', title: 'Agenda', items: outline.agendaItems }
  ];
  const headPlan = { slides: head };
  selectReferences(headPlan, ctx);
  chooseDesignsByContent_(headPlan, ctx);
  drawSlidesIntoActive_(target, head, ctx, p.blankDeck);
  st.drawn = 2;
  saveRunState_(st.runId, st);
  return longDeckStep_(ctx, target, st, started);
}

function prepareLongCtx_(ctx, st) {
  ctx.userPrompt = st.userPrompt;
  ctx.presentationType = st.presentationType;
  ctx.department = st.department;
  ctx.deckSize = st.n;
  ctx.chooserState = st.chooser;
  if (ctx.lib) ctx.lib = applyDepartmentFilter_(ctx.lib, st.department);
}

function longDeckStep_(ctx, target, st, t0) {
  prepareLongCtx_(ctx, st);
  const all = st.outline.slides;
  let parts = 0;
  while (st.next < all.length) {
    const est = st.avgBatchMs || 150000;
    if (parts > 0 && Date.now() - t0 + est > RUN_BUDGET_MS_) break;
    checkCancel_(ctx);
    const b0 = Date.now();
    const part = all.slice(st.next, st.next + LONG_BATCH_);
    const others = all.filter(function (o, i) { return i < st.next || i >= st.next + part.length; }).map(function (o) { return o.title; });
    st.usedNumbers = st.usedNumbers || [];
    const plan = planContent(st.userPrompt, st.presentationType, part.length, st.sources, ctx,
      { batch: { slides: part, deckSize: st.n, deckTitle: st.outline.deck_title, otherTitles: others, usedNumbers: st.usedNumbers } });
    dedupeDeckNumbers_(plan.slides, st.usedNumbers);                    // a figure is shown once in the whole deck
    plan.slides = plan.slides.map(statsNeedNumbers_);
    if (st.usedNumbers.length > 200) st.usedNumbers = st.usedNumbers.slice(-200);
    selectReferences(plan, ctx);
    chooseDesignsByContent_(plan, ctx);
    fitContentToDesigns_(plan, ctx, b0);
    finalizeNotes_(plan, st.sources);
    drawSlidesIntoActive_(target, plan.slides, ctx, false);
    st.next += part.length;
    st.drawn += plan.slides.length;
    const ms = Date.now() - b0;
    st.avgBatchMs = st.avgBatchMs ? Math.round(st.avgBatchMs * 0.5 + ms * 0.5) : ms;
    parts++;
    st.log = ctx.log.slice(-40);
    saveRunState_(st.runId, st);
  }
  if (st.next < all.length) return continueResult_(st, st.drawn, st.n, 'added');
  // Closing: the template Thank-you slide (strict rule)
  checkCancel_(ctx);
  ctx.noCancel = true;
  drawSlidesIntoActive_(target, [{ type: 'closing', title: 'Thank You!', subtitle: st.outline.closing_subtitle || st.outline.deck_title || '' }], ctx, false);
  st.drawn++;
  saveDesignUsage_(Object.keys(st.chooser.used || {}), Object.keys(st.chooser.looksUsed || {}));
  deleteRunState_(st.runId);
  const secs = Math.round((Date.now() - (st.startedAt || t0)) / 1000);
  let msg = 'SUCCESS: ' + st.drawn + ' branded slides added to this presentation (' + secs + 's, built in parts).';
  if (ctx.log.length) msg += '\n' + ctx.log.slice(-20).join('\n');
  Logger.log(msg);
  return generationResult_(msg, target, st.drawn);
}

/* ---------- Rebrand in parts ---------- */
function rebrandStep_(ctx, target, st, t0) {
  const presId = target.getId();
  const total = Math.min(target.getSlides().length, MAX_SLIDES_);
  if (target.getSlides().length > MAX_SLIDES_) ctx.log.push('Only the first ' + MAX_SLIDES_ + ' slides were rebranded.');
  const sum = st.stats || { slides: 0, fonts: 0, colors: 0, icons: 0, removed: 0, redrawn: 0, normalized: 0, failed: 0, libraryIcons: 0, issues: 0 };
  let parts = 0;
  // Without a run id (menu callers) the whole deck is done in one run, as before
  const chunk = st.runId ? REBRAND_CHUNK_ : total;
  while (st.start < total) {
    if (parts > 0 && Date.now() - t0 + (st.avgMs || 100000) > RUN_BUDGET_MS_) break;
    checkCancel_(ctx);
    const p0 = Date.now();
    const end = Math.min(total, st.start + chunk);
    const stats = rebrandPresentation(presId, ctx, { specs: null, start: st.start, end: end });
    Object.keys(sum).forEach(function (k) { sum[k] += Number(stats[k] || 0); });
    st.start = end;
    const ms = Date.now() - p0;
    st.avgMs = st.avgMs ? Math.round(st.avgMs * 0.5 + ms * 0.5) : ms;
    parts++;
  }
  st.stats = sum;
  st.log = ctx.log.slice(-40);
  if (st.start < total) {
    saveRunState_(st.runId, st);
    return continueResult_(st, st.start, total, 'rebranded');
  }
  if (st.runId) deleteRunState_(st.runId);
  let rmsg = 'SUCCESS: Rebranded ' + sum.slides + ' slides with the 66degrees brand. ' + summarizeStats(sum);
  if (ctx.log.length) rmsg += '\n' + ctx.log.join('\n');
  progressFinish_(ctx, 'done', sum.slides + ' slides rebranded');
  Logger.log(rmsg);
  return generationResult_(rmsg, target, sum.slides);
}

function getPipelineStages() {
  return PROGRESS_STAGES.create.map(function (s) { return s[0]; });
}

function clampSlideCount_(n) {
  if (n == null || n === '') n = 8;
  n = Number(n);
  if (!isFinite(n) || isNaN(n)) n = 8;
  return Math.max(3, Math.min(MAX_SLIDES_, Math.round(n)));
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
