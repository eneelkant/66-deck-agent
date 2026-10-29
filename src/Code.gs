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

  // V.1_56: the models come from Script properties (see runModels_): Gemini 4 Argon writes, Gemini 3.8 Flash checks and
  // researches, Nano Banana 2 draws icons; Gemini 2.5 Flash stays the fallback. withModel_ sets a model for one call.
  get model() { return MODEL_OVERRIDE_ ? MODEL_OVERRIDE_ : runModels_().check; },
  set model(v) { MODEL_OVERRIDE_ = v || null; },
  preferProModel: false,
  get imageModel() { return runModels_().image; },
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
    .addSeparator()
    .addItem('Show last result', 'showLastResult')
    .addItem('Test AI models', 'testAiModels')
    .addToUi();
}

// V.1_56: the message of the last deck (the sidebar can lose it on a long run)
function showLastResult() {
  let last = null;
  try { last = JSON.parse(PropertiesService.getUserProperties().getProperty('LAST_RESULT_V1') || 'null'); } catch (e) {}
  const ui = SlidesApp.getUi();
  if (!last || !last.message) { ui.alert('66° Deck Agent', 'No result yet: make a deck first.', ui.ButtonSet.OK); return; }
  ui.alert('66° Deck Agent — last result (' + String(last.at || '').replace('T', ' ').slice(0, 16) + ' UTC)', last.message, ui.ButtonSet.OK);
}
// V.1_56: one tiny request to each model this add-on is set to use, from the menu
function testAiModels() {
  const ui = SlidesApp.getUi();
  ui.alert('66° Deck Agent — AI models', typeof testConfiguredModels_ === 'function' ? testConfiguredModels_() : 'Model test not available.', ui.ButtonSet.OK);
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
  // V.1_56: the last result is kept, so "Show last result" in the menu can show it when the sidebar did not
  try { PropertiesService.getUserProperties().setProperty('LAST_RESULT_V1', JSON.stringify({ at: new Date().toISOString(), message: String(message || '').slice(0, 8000) })); } catch (e) {}
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
    try { if (run.ctx && run.ctx.workId) trashDriveFile(run.ctx.workId); } catch (e4) {}   // V.1_51: no working copy left behind
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
  const sources = { text: '', pdfs: [], images: [], diagrams: [], diagramFallbacks: [] };
  if (data.sourceUrl && String(data.sourceUrl).trim()) readSourceDocument(String(data.sourceUrl).trim(), sources);
  // Uploaded files: one (data.upload, older panel) or several (data.files, current panel). A file that cannot be read
  // is skipped with a note; the run only stops when nothing at all is left to build from.
  const uploads = [].concat(data.upload && data.upload.data ? [data.upload] : [], Array.isArray(data.files) ? data.files : [])
    .filter(function (f) { return f && f.data; }).slice(0, 10);
  const skippedFiles = [];
  // Normal Create: raster images stay reference material. Diagram reconstruction is Flowchart-only
  // (or an explicit allowDiagramIngest opt-in). Structured Mermaid/draw.io/Excalidraw/SVG still ingest.
  uploads.forEach(function (f) {
    try {
      readUploadedFile_(f, sources, ctx, { allowDiagramIngest: false, mode: 'create' });
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
  // Proposal Deck: the client (Gemini or sidebar) and its logo, and the deck's section divider style - once per deck
  // (V.1_52: a Solution Deck too: its client is optional, and the tone of its content is picked from the request)
  if (isLibraryDeck_(ctx)) {
    if (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx) && typeof solutionTone_ === 'function') {
      ctx.solutionTone = solutionTone_(userPrompt, sources);
      ctx.log.push('Tone of the content: ' + solutionToneLabel_(ctx.solutionTone) + '.');
    }
    ctx.clientName = String(data.clientName || '').trim();
    ctx.clientDomain = String(data.clientDomain || '').trim();
    try { prepareProposal_(userPrompt, sources, ctx, { clientName: ctx.clientName, clientDomain: ctx.clientDomain }); }
    catch (e) { ctx.log.push('Client logo step skipped: ' + e.message); }
  }
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

  // V.1_70: the brief - what the request fixes (figures in order, topics, prices), read once and used by every step after
  ctx.userPrompt = userPrompt;
  try { ctx.brief = typeof buildBrief_ === 'function' ? buildBrief_(userPrompt, sources, ctx, totalSlides) : null; }
  catch (eB) { ctx.brief = typeof briefFromText_ === 'function' ? briefFromText_(userPrompt, totalSlides) : null; ctx.log.push('Brief: read by the code (' + eB.message + ').'); }

  // Long decks (more than one Apps Script run can build): outline first, then the slides in parts, run after run
  // (V.1_51: a Proposal Deck of 10+ slides is planned as a storyline first and written from it, like a long deck)
  // (V.1_52: a Solution Deck of 8+ slides the same way)
  if (run.runId && (totalSlides > SINGLE_RUN_MAX_ || (totalSlides >= (deckLibraryOf_(ctx) === 'solution' ? 8 : 10) && isLibraryDeck_(ctx)))) {
    return startLongDeck_(ctx, target, { userPrompt: userPrompt, sources: sources, presentationType: presentationType,
      department: department, n: totalSlides, blankDeck: blankDeck }, started);
  }

  // 1b. Gemini writes the content plan grounded in Scite's research (one spec per slide, in order)
  progressStage_(ctx, 'write', 'active', 'Gemini is writing ' + totalSlides + ' slides');
  // V.1_42: a Proposal Deck of 12+ slides is written in 3-4 sections; the dividers count in the slides asked for
  const proposalRun = typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx) && typeof proposalStructure_ === 'function';
  const sectionCount = proposalRun ? proposalSectionCount_(totalSlides) : 0;
  ctx.proposalSections = sectionCount;
  const plan = planContent(userPrompt, presentationType, totalSlides - sectionCount, sources, ctx);
  if (proposalRun) proposalStructure_(plan, ctx, sectionCount);
  deckFigureCheck_(plan.slides, ctx, sources);                                   // V.1_70: figures only from the request and sources
  deckShapeCheck_(plan.slides, ctx);                                            // V.1_72: each slide kind in its shape
  progressStage_(ctx, 'write', 'done', plan.slides.length + ' slides planned');
  progressSlides_(ctx, plan.slides.map(specTitle_));
  checkCancel_(ctx);

  // 1b-2. Attach only diagrams that were explicitly ingested (structured uploads). Raster images in
  // Create are references and never enter this path automatically.
  progressStage_(ctx, 'diagram', 'active', 'Checking for structured diagram uploads');
  try {
    const hasDiagrams = ((sources.diagrams || []).length > 0);
    const attached = hasDiagrams && typeof attachDiagramsToPlan_ === 'function' ? attachDiagramsToPlan_(plan, sources, ctx) : 0;
    if (attached) progressStage_(ctx, 'diagram', 'done', 'Structured diagram attached (' + attached + ')');
    else if (sources.diagramFallbacks && sources.diagramFallbacks.length) progressStage_(ctx, 'diagram', 'done', 'Kept original diagram source');
    else progressStage_(ctx, 'diagram', 'done', hasDiagrams ? 'Diagram not attached' : 'No structured diagram upload');
  } catch (e) {
    ctx.log.push('Diagram stage skipped: ' + (e && e.message ? e.message : String(e)));
    progressStage_(ctx, 'diagram', 'done', 'Diagram stage skipped');
  }
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
  try { fillThinSlides_(plan, ctx, { textsOnly: true }); } catch (eT) {}      // V.1_67: texts too short for the design chosen (pricing options)
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

  // 1e. Semantic icon selection (local → better-icons/Iconify → fallback). Never fails the deck.
  try {
    if (typeof resolveIconsForPlan_ === 'function') resolveIconsForPlan_(plan, ctx);
    else progressStage_(ctx, 'icons', 'done', 'Icon provider unavailable');
  } catch (e) {
    ctx.log.push('Icon stage skipped: ' + (e && e.message ? e.message : String(e)));
    progressStage_(ctx, 'icons', 'done', 'Icon stage skipped');
  }
  checkCancel_(ctx);

  // 2. Slides: drawn directly into the user's CURRENT presentation (default).
  let stats, tempId = null, copied;
  if (!CONFIG.useBeautifulAi) {
    deckFigureCheck_(plan.slides, ctx, sources);                                 // V.1_70: again after the fill and fit steps
    deckGate_(plan.slides, ctx, started);                                        // V.1_73: step 4 - no bad slide goes in
    finalizeNotes_(plan, sources, ctx);
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
  let msg = 'SUCCESS: ' + copied + ' branded slides added to this presentation (' + secs + 's). ' + summarizeStats(stats) +
    '\n' + AGENT_VERSION_ + ' · Presentation type: ' + (ctx.presentationType || 'General') + '.';
  const usedShort = modelsUsedLine_(mergeModelsUsed_({}));                       // V.1_56
  if (usedShort) msg += '\n' + usedShort;
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
    ['diagram', 'Analyzing diagram'],
    ['match', 'Choosing a 66degrees template design for each slide'],
    ['fit', 'Fitting the text to each design'],
    ['icons', 'Selecting icons'],
    ['brand', 'Drawing the slides'],
    ['insert', 'Adding slides to your deck']
  ],
  create_beautiful: [
    ['research', 'Research'],
    ['write', 'Writing the content'],
    ['diagram', 'Analyzing diagram'],
    ['match', 'Matching 66degrees template layouts'],
    ['design', 'Designing the slides'],
    ['import', 'Importing into Google Slides'],
    ['review', 'Reviewing every slide'],
    ['icons', 'Selecting icons'],
    ['brand', 'Applying the 66degrees brand'],
    ['insert', 'Adding slides to your deck']
  ],
  rebrand: [
    ['review', 'Reviewing every slide'],
    ['brand', 'Applying the 66degrees brand']
  ],
  flowchart: [
    ['flow_read', 'Reading your description or sketch'],
    ['flow_structure', 'Working out the steps and decisions'],
    ['flow_layout', 'Laying out boxes and arrows'],
    ['flow_insert', 'Adding the slide to your deck']
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
  const guidance = DECK_TYPE_GUIDANCE_[presentationType] || DECK_TYPE_GUIDANCE_.General;
  const iconNames = Object.keys(ctx.assets.icons).sort();
  const libIconNames = ctx.lib ? ctx.lib.icons.map(function (i) { return i.name; }) : [];

  // Approved facts: the 2026 template (reference library) first, the built-in list as fallback
  const facts = libraryFacts(ctx.lib, [userPrompt, presentationType, String(sources.text || '').slice(0, 4000)].join(' '));
  const approvedFacts = facts.usable.length ? facts.usable : APPROVED_FACTS;

  let recentList = [];
  try { recentList = recentDesigns_(); } catch (e) {}
  ctx.userPrompt = userPrompt;
  ctx.approvedFacts = approvedFacts;
  setRunNames_(userPrompt, [ctx.clientName, ctx.proposal && ctx.proposal.client && ctx.proposal.client.name]);   // V.1_39
  const storyShape = pickStoryShape_();                                       // a different story shape on every run
  const storyBlock = batch ? `THIS IS PART OF A LONG DECK (${batch.deckSize} slides, titled "${batch.deckTitle || ''}"). The outline is fixed.
Write EXACTLY these ${n} body slides, in this order, with these types and titles (keep each title word for word):
${batch.slides.map(function (o, k) { return (k + 1) + '. type "' + o.type + '" | title "' + o.title + '"' + (o.brief ? ' | about: ' + o.brief : ''); }).join('\n')}
Other slides of the deck (already written or written later - never repeat their content): ${(batch.otherTitles || []).slice(0, 220).join(' | ')}
${(batch.usedNumbers || []).length ? 'Numbers already shown on earlier slides (never show them again): ' + batch.usedNumbers.slice(-80).join(', ') : ''}
${ctx.chooserState && Object.keys(ctx.chooserState.used || {}).length ? 'Designs already used on earlier slides of this deck (a design is used once: pick other designs): ' + Object.keys(ctx.chooserState.used).join(', ') : ''}
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
  const proposalDeck = typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx);
  const solutionDeck = deckLibraryOf_(ctx) === 'solution';                // V.1_52
  const prompt = `
You are the senior presentation strategist for ${ctx.brand.name}. Write the content for the best possible presentation on the topic:
a clear story, one idea per slide, concrete and useful content.

REQUEST: "${userPrompt || 'Build the presentation from the attached source material.'}"
${typeof briefPromptBlock_ === 'function' ? briefPromptBlock_(ctx) : ''}
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
- When the request lists the parts of a topic in brackets (e.g. "a phased plan (discovery, pilot in one region, scale)"), that
  slide's items are exactly those parts, in that order, with nothing added.
- Every topic the request lists gets its own slide (goals, architecture, security approach, team structure included): an
  architecture is a "diagram" of the named components; a team structure is cards of roles (never invented names).
- At most ONE "current state / future state" (before / after) comparison and ONE slide of targets in the whole deck.
- Gemini, Agent Assist and Vertex AI Search are grounded in the client's own content (manuals, support articles, policies):
  never write that Gemini models are trained or fine-tuned on the client's data unless the request asks for model training.
- Write metric names in full in labels ("average handle time", "first contact resolution", "agent satisfaction"); CSAT and NPS may stay.
- Market figures only from analyst firms, Google or reputable research - never from a vendor's marketing blog, and never a
  wide range ("300-600%"): no figure is better than a weak one.
- A KPI / measuring-success slide is type "stats" with 3-4 items whose "value" is a number (a target when no source gives one:
  label starts with "Target:"), never cards without numbers.
- Never more than ${n >= 30 ? Math.max(2, Math.round(n / 7)) : 2} "cards" slides in the deck: use diagram, process, comparison, table, stats instead.
- No 66degrees credentials / "why 66degrees" / "trusted partner" / services / accelerators slide unless the request asks for it.
- Every number on a slide is about that slide's topic: never a figure about another product or use (e.g. Google Workspace
  minutes saved in a customer service deck), and no closing "quantifiable impact" slide built from unrelated figures.
- A bullets slide always has a callout (the side panel); a statement slide always has 2-3 points next to it.
- One slide per topic: "how we deliver", "our framework", "our approach" and "implementation process" are ONE topic;
  "considerations", "critical success factors" and "key decisions" are ONE topic; "why now", "the landscape" and "the imperative" are ONE topic.
- A case study's "industry" is only what the client fact says (or the kind of work, e.g. "Data platform"); never guess it.
- Stats labels are words only: never a second number inside the label (not "Planning 50%+ increase").
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
- Metric / KPI slides are "stats" slides: each metric has a plain name ("CPU and memory utilisation", "Cost per transaction",
  never "CPU/Memory" or "Transaction/User") and a target or benchmark value ("Target: 70%+").
- 66degrees is a Google Cloud partner: use Google Cloud terms and figures (committed use discounts, sustained use discounts,
  Compute Engine, Cloud Billing reports, Recommender / Active Assist, BigQuery). Never AWS or Azure terms such as
  "reserved instances", "Savings Plans" or "EC2" unless the request is about AWS or Azure.
- Domain facts are stated correctly: the FinOps lifecycle (FinOps Foundation) has three phases, Inform -> Optimize -> Operate,
  always in that order and never with extra phases such as "Enable".
- Stay on the deck's topic: no claims about AI platforms or other subjects the request is not about. Never put a figure or a
  range in a card or step heading ("Faster time-to-market (30-50% range)"): the number goes in the text or a stats slide.
- Never end a text with a filler sentence that restates the obvious ("This improves operational efficiency and team
  productivity."), and never add a second sentence starting "This phase...", "This includes...", "This ensures..." or
  "We help you...": one clear sentence per item is enough.
- No generic statements ("Cloud spending is a strategic investment that requires diligent optimization"): every statement
  and lead says something specific about the request's subject.
- A stat's label says exactly what the number counts and agrees with its text (never "1 in 4 organizations with 100%
  allocation" when the text says most organizations do not allocate). A stats slide shows market facts OR the client's
  targets ("Target: ..."), never both on one slide.
- Table headers name what the column holds ("Lever" | "How it cuts cost"), never "Topic" | "What it means".
- Every content slide has a "lead": one sentence (max 110 characters) with the slide's point.
- A title promising numbers ("quantifiable impact", "by the numbers") only when the slide shows real numbers.
- No unsupported side claims (security, AI, compliance) on a slide unless the request is about them.
- At most two step-by-step slides (process, cycle, framework, phases, lifecycle) in a deck of up to 20 slides, each about a
  different thing: never the same loop twice in other words.
- Process, timeline and cards items carry an "icon": one concrete concept that matches the item (e.g. "magnifying glass" for
  identify, "flask" for test, "rocket" for deploy, "dashboard" for monitor), never a generic light bulb.
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

DESIGN MENU (${proposalDeck ? '66degrees Proposal Deck designs the engine can draw' : solutionDeck ? '66degrees Solution Deck designs the engine can draw' : '66degrees 2026 template designs the engine can draw'})
${ENGINE.designMenu(proposalDeck ? 'proposal' : solutionDeck ? 'solution' : '')}
${solutionDeck ? 'SOLUTION DESIGNS: this is a Solution Deck, so only the designs above are used. For every body slide pick the design that suits its content, write its tag in "design" and fill exactly the fields that design needs.\n' + (typeof solutionToneCard_ === 'function' ? solutionToneCard_(ctx.solutionTone) : '') : ''}
${proposalDeck ? `PROPOSAL DESIGNS: this is a Proposal Deck, so only the designs above are used. For every body slide pick the design that
suits it in "design" and write the fields its description names (for example groups[...], stats[...], banner, org{...},
columns[...], periods[...], workstreams[...], left{...}/right{...}, challenge, value) next to the slide type's usual fields.
Use each design at most once and use many different designs: a proposal reads like a designed consulting document.
` : ''}${proposalDeck ? `PROPOSAL RULES:
- Every body slide has a "title": the slide's key message in sentence case, max 58 characters. The design shows it at the
  top of the slide; the "lead" is a separate sentence under it, never instead of it.
- Every body slide uses one design from the menu above and is written in that design's fields. Do not write slide types the
  menu has no design for (no "quote", no plain bar or line "chart"): show figures as stats (KPI tiles) instead.
- A team structure is ONE slide: type "team" with teams[{name, roles[{title, text}]}] (2: the client team and the 66degrees team,
  roles only, never invented names) and governance, or an org chart org{name, role, reports[...]}, or role blocks
  items[{title, text}]. Never a second team slide in other words.
- Risks are ONE slide: the risk / impact / mitigation design (comparison) or a risk table, never a pyramid, a stack of layers or a funnel.
- Team and governance are ONE slide (the team structure with its governance), never a second governance slide, unless the
  request lists governance as its own topic.
- An architecture slide (solution / data / technical architecture) is a diagram: P66_ARCH_FLOW with columns[...] and links[...]
  (sources -> platform -> users), or P66_HUB / P66_DELIVERY_FLOW. Never cards.
- A Gantt roadmap (P66_GANTT) has 3-6 lanes and its bars cover the whole plan; with fewer lanes use phases instead.
- Only the methodology and the roadmap are written as phases ("Phase 1: ..."); other process slides use plain step names.
- "deliverable" is what a phase or workstream hands over (a document, a model, a working pipeline), never a general statement.
- A KPI slide shows 3-4 target KPIs as stats (value = the target, label = "Target: " + what improves).
- Data sources, systems or tools are never a pyramid or a stack of levels (they are not a hierarchy): use cards or the architecture flow.
- Names in capitals only for acronyms (AI, KPI, ERP): phase and step names are in sentence case ("Define", not "DEFINE").
- Only real product names (BigQuery, Vertex AI, Gemini...); never invent product or feature names.
- Google Cloud SLAs only as Google publishes them (e.g. Compute Engine 99.99% across zones); never a 100% SLA, uptime or availability.
- Texts are plain sentences, never records such as "Scope: ... · Purpose: ..." or "Metric: ... Threshold: ...".
- Every slide says something new: a challenge, benefit or capability covered on one slide (e.g. "high false positives",
  "BigQuery scales to petabytes") is never explained again on another slide; the products are explained once.
- A loop or continuous-improvement cycle is P66_CYCLE (4-6 stages), never a stack of layers.
- Every risk has its mitigation: P66_IMPACT_MITIGATION items[{title: risk, text: impact, points: [2-3 mitigation actions]}].
` : ''}${proposalDeck && !batch && ctx.proposalSections ? `PROPOSAL SECTIONS: the body slides are grouped into exactly ${ctx.proposalSections} sections (the code adds a divider slide before
each section and lists the sections in the agenda). Give every body slide a "section" field: the name of its section,
2-4 words in sentence case (for example "Understanding your needs", "Our approach", "Delivery plan", "Why 66degrees").
The first section is about the client: its situation, goals and challenges (market figures only as support). Each section name
says what ITS slides are about (an architecture slide sits in the approach section, a team slide in the delivery or partnership
section). The slides of one section are next to each other, every section has at least two slides, and each section name is different.
` : ''}
${recentList.length ? 'RECENTLY USED DESIGNS (used in the last decks made with this tool; choose OTHER designs from the menu whenever one suits the content, so every deck looks fresh): ' + recentList.join(', ') : ''}
For "cards" items, "icon" must be a name from ${libIconNames.length ? 'LIBRARY_ICONS (preferred) or ' : ''}BRAND_ICONS and "material" the closest Google Material Icons name.
PRODUCT NAMES: use current Google Cloud names (Pub/Sub, Dataflow, Dataproc, Cloud Run functions, Looker Studio, Artifact Registry); never IoT Core (retired): devices publish to Pub/Sub through a gateway.
CONSISTENCY: the speaker notes describe the same products, numbers and design as the slide (never Cloud Run in the notes when the slide says Cloud Run functions); a passive or standby disaster recovery region runs no active services; two topics the request lists are never merged into one slide.
CHARTS AND KPIS: chart categories are 1-3 words and all different ("Credit unions", "Banks", never two labels starting the same way); a KPI label says exactly what the number measures ("Share of failures that are mechanical", not "Mechanical failure rate"); a study's period or sample size is never a KPI; every KPI has a figure.
SUPPORT PRIORITIES: one row or card per priority level (P1-P4 or Severity 1-4) with its response time; times not given in the request are marked as proposals in the notes.
FIGURES: a figure from industry research (analysts, studies, other companies) is labelled on the slide as an industry figure ("Industry benchmark: ...", "Across retailers, ..."), never shown as the client's own number. A pie or donut is only for numeric parts of one whole.
ICON RULES: the icon names the item's subject (a doctor for physicians, a document for drafts and notes, a check for sign-off, a chart for monitoring); every item on a slide has a different icon; a light bulb only for an item about ideas.
Use charts and stats wherever real or target numbers make the point clearer.

${libIconNames.length ? 'LIBRARY_ICONS: ' + libIconNames.join(', ') + '\n' : ''}BRAND_ICONS: ${iconNames.join(', ')}
${sources.research && sources.research.length ? '\n' + formatSciteForPrompt(sources.research, sources.researchProvider) + '\nRESEARCH RULES:\n- Every factual claim, statistic, trend or finding MUST come from the RESEARCH SOURCES above.\n- When you use a source, append its number in square brackets to the slide\'s "notes" field, e.g. "[1][3]".\n- Prefer quantitative findings (percentages, counts, growth rates) for stats/chart slides.\n- If a claim cannot be supported by the sources, mark it as "Illustrative figure – validate before sharing." in that slide\'s notes.' : ''}
${sources.text ? '\nUSER-PROVIDED SOURCE MATERIAL (secondary):\n' + sources.text.slice(0, CONFIG.maxSourceChars) : ''}
${sources.pdfs.length ? '\nA source PDF is attached: use it alongside the research sources.' : ''}
${(sources.images || []).length ? '\nA source image is attached: use what it shows (text, numbers, diagrams) as source material.' : ''}

OUTPUT: ONLY valid JSON: { "deck_title": "", "facts_note": "", "sources_used": [1,2,3], "slides": [ { "type": "${batch ? batch.slides[0].type : 'cover'}", ..., "notes": "...", "fact_tags": [] }, ... exactly ${n} slides ] }
`;
  // V.1_51: a Proposal Deck part is written from the storyline plan with the short prompt (core rules + the designs that suit
  // each slide); the long prompt stays for General decks and very short decks
  // (V.1_52: a Solution Deck part the same way, with its own designs and the tone of its content)
  const usePlanner = (proposalDeck || solutionDeck) && !!batch && typeof proposalContentPrompt_ === 'function';
  const plannerArgs = { userPrompt: userPrompt, n: n, batch: batch, ctx: ctx, sources: sources,
    approvedFacts: approvedFacts, facts: facts, iconNames: libIconNames.concat(iconNames) };
  const parts = [{ text: usePlanner ? (solutionDeck && typeof solutionContentPrompt_ === 'function' ? solutionContentPrompt_(plannerArgs) : proposalContentPrompt_(plannerArgs)) : prompt }];
  // Pictures of the template designs, so Gemini chooses by seeing them (lorem ipsum shows the layout only)
  const pics = (proposalDeck || solutionDeck) ? [] : designThumbnailParts_(ctx);   // (template pictures show General designs only)
  if (pics.length) {
    parts.push({ text: 'PICTURES OF THE DESIGNS IN THE DESIGN MENU (from the 66degrees template; placeholder text shows the layout only):' });
    pics.forEach(function (pt) { parts.push(pt); });
  }
  sources.pdfs.forEach(function (b64) { parts.push({ inline_data: { mime_type: 'application/pdf', data: b64 } }); });
  (sources.images || []).forEach(function (im) { parts.push({ inline_data: { mime_type: im.mime, data: im.data } }); });

  const plan = withContentModel_(ctx, function () { return callGeminiJSON(parts, ctx.apiKey, usePlanner ? 0.1 : 0.2); });   // V.1_70: 0.4 / 0.7 invented figures   // V.1_51 / V.1_56: written by the content model
  if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) throw new Error('Gemini returned no slide content.');
  plan.slides = plan.slides.map(function (sp) { return ENGINE.cleanSpec(sp); });   // strip stray color codes
  plan.slides = normalizeSpecialSlides_(plan.slides, userPrompt, sources, ctx);    // real template slides, real people only
  ensureTitles_(plan.slides, ctx);                                                // V.1_45: every content slide has a title
  plan.slides.forEach(function (sp) { removeHypeWords_(sp); tidyItemText_(sp); });   // brand voice: no hype words, no filler tails
  if (solutionDeck && typeof solutionVoiceClean_ === 'function') plan.slides.forEach(solutionVoiceClean_);   // V.1_52: no emoji, hashtags, ALL CAPS, "!!"
  if (solutionDeck && typeof solutionDisplayCase_ === 'function') {
    plan.slides.forEach(solutionTimelineAsProcess_);                               // V.1_54: a roadmap is phases with their timing
    plan.slides.forEach(function (sp) {                                           // V.1_54: never "proposal" on a Solution cover
      if (sp && String(sp.type || '').toLowerCase() === 'cover') ['title', 'subtitle'].forEach(function (k) {
        if (typeof sp[k] === 'string') sp[k] = sp[k].replace(/^a proposal for /i, 'A solution for ').replace(/\bsolution proposal\b/ig, 'solution').replace(/\s*\bproposal\b/ig, '').replace(/\s{2,}/g, ' ').trim();
      });
    });
    plan.slides.forEach(solutionDisplayCase_);                                     // V.1_53: labels, product names, no field-name lower case
    solutionResultsGuard_(plan.slides, userPrompt, sources, ctx);                  // V.1_53: results only from the request
    if (typeof solutionBodyTypes_ === 'function') {                                // V.1_55 (deck 26)
      if (!batch && solutionBodyTypes_(plan.slides, false)) ctx.log.push('A content slide typed as a frame was drawn with a Solution design.');
      plan.slides.forEach(function (sp) { solutionCleanFigures_(sp, userPrompt); });   // sources to the notes, no market sizes
      solutionGivenTimes_(plan.slides, userPrompt, sources);                     // proposed response times flagged in the notes
      solutionLeadNotBrief_(plan.slides, batch);                                  // the lead is never the plan's brief
      plan.slides.forEach(solutionThinBullets_);                                  // three-word bullets become items with their text
      if (typeof solutionFactsClean_ === 'function') plan.slides.forEach(function (sp) { solutionFactsClean_(sp, userPrompt, approvedFacts); });   // V.1_56: retired products, claims, filler
    }
  }
  plan.slides = plan.slides.map(function (sp) { return realChartOrStats_(sp); }); // charts only with real multi-point data
  try { addRunNames_(namesFromNotes_(plan.slides)); } catch (e) {}           // V.1_58: names from the research keep their capitals
  plan.slides.forEach(function (sp) { dropRepeatedHighlights_(sp); sentenceCaseHeadings_(sp); });
  // Every stat on a slide must be found in the research, the approved facts or the user's material
  if (!sources.pdfs.length && !(sources.images || []).length) {
    // V.1_58 (deck 31: "2,400 traction motors" removed although the request said it): the request's own figures count
    const corpus = [JSON.stringify(sources.research || []), String(sources.text || ''), JSON.stringify(approvedFacts || []), String(userPrompt || '')].join(' ');
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
  if (!batch) dedupeFiguresInText_(plan.slides, []);                             // V.1_48: also in card and bullet text (tiles win)
  plan.slides = plan.slides.map(statsNeedNumbers_);                               // "Significant" is not a stat
  plan.slides.forEach(evenHighlights_);                                           // highlights on all cards or none
  if (batch) {
    // Long deck part: one slide per outline entry, with the outline's type and title (the agenda already lists them)
    const got = plan.slides.slice();
    const pairs = matchOutline_(batch.slides, got);
    if (pairs.log.length && ctx && ctx.log) ctx.log.push(pairs.log.join(' '));
    plan.slides = batch.slides.map(function (o, k) {
      const sp = pairs.byOutline[k] || { type: String(o.type || '').toLowerCase() === 'stats' ? 'stats' : 'cards', title: o.title, lead: '', items: [], missing: true };
      // the outline's title is kept only when the slide Gemini wrote is about it; otherwise its own title stays
      if (!pairs.ownTitle[k]) sp.title = o.title;
      if (!sp.type) sp.type = o.type;
      if (solutionDeck && /^(agenda|cover|closing|section|divider|title|template)$/i.test(String(sp.type)) && String(o.type || '').toLowerCase() !== 'section') {
        sp.type = /^(agenda|cover|closing|section|divider|title|template)$/i.test(String(o.type || '')) ? 'cards' : o.type;   // V.1_55 (deck 26 slide 27): a body slide is never a frame
        delete sp.lockTag; sp.reference = null;
      }
      keepOutlineType_(sp, o);                                                    // V.1_50
      return sp;
    });
    if (!proposalDeck && !solutionDeck) limitCardSlides_(plan.slides, n, Math.max(1, Math.round(n / 7)));   // V.1_47: a Proposal Deck varies by its designs
    stripUnaskedCredentials_(plan.slides, userPrompt);                                  // V.1_48: no 66degrees credentials unless asked
    if (clientNumbersOnCasesOnly_(plan.slides, ctx)) plan.slides = plan.slides.map(statsNeedNumbers_);
    fillThinSlides_(plan, ctx);
    // V.1_66: a slide Gemini did not write and the fill step could not write either is left out (never an empty slide);
    // it keeps its place in the part until then (the part's section slides go between the written slides by position)
    plan.slides.forEach(function (sp) {
      if (!sp || !sp.missing) return;
      delete sp.missing;
      const ok = (Array.isArray(sp.items) && sp.items.filter(Boolean).length >= 2) || (Array.isArray(sp.points) && sp.points.length >= 2);
      if (!ok) { sp.leaveOut = true; if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '" left out: no content was written for it.'); }
    });
    architectureAsDiagram_(plan.slides, ctx);                                     // V.1_47: an architecture slide is a diagram
    riskSlidesWithMitigations_(plan.slides, ctx);                                 // V.1_48: every risk with its mitigation
    plan.slides.forEach(function (sp) { nameCaseClient_(sp, ctx); });
    plan.slides.forEach(function (sp) { if (sp.title && String(sp.type).toLowerCase() !== 'template') sp.title = sentenceCase_(sp.title, 2); });
    ensureTitles_(plan.slides, ctx);                                              // V.1_47: the same final checks as a short deck
    plan.slides.forEach(function (sp) { removeHypeWords_(sp); sentenceCaseHeadings_(sp); });
    flagUnverifiedFigures_(plan.slides, sources, approvedFacts);
    finalVoicePass_(plan.slides, ctx);
    if (!plan.deck_title) plan.deck_title = batch.deckTitle || '';
    return plan;
  }
  plan.slides = limitRepeatedTypes_(plan.slides);                                 // statement / bullets at most once
  replaceDuplicateSlides_(plan, ctx);                                             // no two slides with the same content
  orderSlidesToRequest_(plan, ctx);                                               // body slides in the order the request lists its topics
  if (!proposalDeck && !solutionDeck) limitCardSlides_(plan.slides, n);                            // at most 2 "cards" slides (more in long decks; a Proposal Deck varies by its designs)
  if (proposalDeck) roadmapAsTimeline_(plan.slides, userPrompt);                   // V.1_50: a requested roadmap is drawn as a Gantt
  stripUnaskedCredentials_(plan.slides, userPrompt);                              // V.1_48: no 66degrees credentials unless asked
  if (clientNumbersOnCasesOnly_(plan.slides, ctx)) plan.slides = plan.slides.map(statsNeedNumbers_);   // client results only on case studies
  fillThinSlides_(plan, ctx);                                                     // no slide that looks empty
  architectureAsDiagram_(plan.slides, ctx);                                       // V.1_47: an architecture slide is a diagram
  riskSlidesWithMitigations_(plan.slides, ctx);                                   // V.1_48: every risk with its mitigation
  flagUnverifiedFigures_(plan.slides, sources, approvedFacts);                   // V.1_47: product figures to check before sharing
  plan.slides.forEach(function (sp) { nameCaseClient_(sp, ctx); });               // a case study names its client
  plan.slides.forEach(function (sp) {                                            // brand rule: sentence-case titles
    const tt = String(sp.type).toLowerCase();
    if (sp.title && tt !== 'closing' && tt !== 'template') sp.title = sentenceCase_(sp.title, 2);
    if (sp.statement) sp.statement = sentenceCase_(sp.statement);
  });
  ensureTitles_(plan.slides, ctx);                                                // (slides written late too)
  finalVoicePass_(plan.slides, ctx);                                             // the same clean-up on slides written late
  plan.slides = enforceDeckStructure_(plan.slides, n, plan.deck_title);          // cover, agenda, body, closing — exactly n
  syncAgendaToSlides_(plan.slides);                                             // agenda lists exactly the slides that exist
  if (!proposalDeck && !solutionDeck) generalAgendaSections_(plan.slides, ctx);   // V.1_57 (decision 2): the agenda lists sections
  if (proposalDeck && plan.slides[0] && String(plan.slides[0].type).toLowerCase() === 'cover') {   // V.1_48: a cover title with the message
    const cv = coverTitle_(plan.slides[0].title, plan.slides[0].subtitle, ctx);
    plan.slides[0].title = cv.title; plan.slides[0].subtitle = cv.subtitle;
    if (cv.title !== plan.deck_title && /^\s*(?:an?\s+)?(?:proposal|presentation|deck)/i.test(String(plan.deck_title || ''))) plan.deck_title = cv.title;
  }
  if (!plan.deck_title) plan.deck_title = plan.slides[0].title || 'Presentation';
  return plan;
}

/* ---------- V.1_47: an architecture slide is drawn as an architecture diagram ----------
   A Proposal Deck slide about the solution / data / technical architecture that Gemini wrote as cards gets the fields of
   the architecture flow design (columns of systems with labelled arrows) in one Gemini call; the cards stay when no answer. */
const ARCH_TITLE_RE_ = /\b(architecture|data flow|system flow|how the (pieces|components|systems) (fit|connect|work) together|integration (map|landscape))\b/i;
function architectureAsDiagram_(slides, ctx) {
  const solution = typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx);          // V.1_54: a Solution architecture is drawn too
  if (!((typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx)) || solution) || !ctx.apiKey) return 0;
  const todo = [];
  (slides || []).forEach(function (sp, i) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template', 'case_study', 'team'].indexOf(t) !== -1) return;
    if (!ARCH_TITLE_RE_.test(String(sp.title || '') + ' ' + String(sp.lead || ''))) return;
    if ((Array.isArray(sp.columns) && sp.columns.length >= 2 && typeof sp.columns[0] === 'object') || (Array.isArray(sp.nodes) && sp.nodes.length >= 3)) return;
    if (solution && ((Array.isArray(sp.groups) && sp.groups.length >= 3) || (Array.isArray(sp.regions) && sp.regions.length === 2) || (Array.isArray(sp.layers) && sp.layers.length >= 3))) return;   // already a Solution diagram
    todo.push(i);
  });
  if (!todo.length) return 0;
  try {
    const list = todo.map(function (i, k) {
      const sp = slides[i];
      return { id: k, title: sp.title, lead: sp.lead || '', has: JSON.stringify(sp.items || sp.points || sp.layers || []).slice(0, 900) };
    });
    const prompt = [
      'These slides of a ' + ctx.brand.name + (solution ? ' solution deck' : ' proposal') + ' (request: "' + String(ctx.userPrompt || '').slice(0, 300) + '") show an architecture.',
      'Write each one as an architecture flow: 3 columns from left to right (e.g. "Data sources" -> "Google Cloud platform" -> "Users and outcomes"),',
      'each column {"label" (2-4 words), "items": [2-4 boxes, each {"title" (2-5 words, real product or system names), "text" (3-8 words)}]},',
      '"links": 2 arrow labels (2-4 words each, what flows between the columns), "takeaway": one short line (max 12 words).',
      'Use the products and systems the slide already names. Sentence case, plain text, no invented product names.',
      'Return ONLY JSON: {"slides":[{"id":0,"columns":[...],"links":[...],"takeaway":""}]}',
      JSON.stringify(list)
    ].join('\n');
    const out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.3); });   // V.1_56: client-facing text
    let n = 0;
    ((out && out.slides) || []).forEach(function (r) {
      const i = todo[r && r.id];
      if (i == null || !Array.isArray(r.columns)) return;
      const cols = r.columns.filter(function (c) { return c && (c.label || c.title) && Array.isArray(c.items) && c.items.length; }).slice(0, 4);
      if (cols.length < 2) return;
      const sp = slides[i];
      sp.type = 'diagram';
      sp.columns = cols;
      sp.links = Array.isArray(r.links) ? r.links.slice(0, 3) : [];
      if (r.takeaway) sp.takeaway = String(r.takeaway);
      sp.design = solution ? 'S66_ARCH_ICON_GRAPH' : 'P66_ARCH_FLOW';
      sp.reference = null;
      sentenceCaseHeadings_(sp);
      n++;
    });
    if (n) ctx.log.push(n + ' architecture slide(s) drawn as an architecture diagram.');
    return n;
  } catch (e) {
    ctx.log.push('Architecture diagram step skipped: ' + e.message);
    return 0;
  }
}

/* ---------- V.1_48: a risk slide shows each risk with its mitigation ----------
   Deck 21: "Anticipated risks and mitigation strategies" showed three risk categories in one vague line each and no
   mitigation. A risk slide without mitigations gets them written (one Gemini call for all such slides) and is drawn
   as impact + mitigation rows (or the risk table when that design is taken). */
const RISK_TITLE_RE_ = /\b(risks?|mitigat\w*|raid)\b/i;
function riskHasMitigations_(sp) {
  const t = String(sp.type || '').toLowerCase();
  if (t === 'table' && Array.isArray(sp.columns) && sp.columns.some(function (c) { return /mitigat|response|action|how we/i.test(String(c && (c.label || c.title) || c)); }) &&
      Array.isArray(sp.rows) && sp.rows.length >= 2) return true;
  if (Array.isArray(sp.risks) && sp.risks.length >= 2 && sp.risks.every(function (r) { return r && (r.mitigation || r.response); })) return true;
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  return items.length >= 2 && items.every(function (it) {
    // a mitigation is a field, or an action next to the risk's description (deck 21: one point that only described the risk)
    const pts = Array.isArray(it.points) ? it.points.map(String) : [];
    return it && typeof it === 'object' && (it.mitigation || it.response || (it.note && it.text) || (it.text && pts.length >= 1) ||
      /\b(mitigat\w*|we will|address(ed)? by|reduce[ds]? by|through|via)\b/i.test(String(it.text || '') + ' ' + pts.join(' ')));
  });
}
// V.1_51 (deck 23 slide 26): an impact is one sentence (three sentences kept the rows design from drawing), and the
// actions are joined without ".;" (each action loses its own end mark)
function riskImpact_(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  const first = s.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || '';
  return first.length > 150 ? first.slice(0, 150).replace(/\s+\S*$/, '') : first;
}
function riskAction_(t) { return String(t || '').replace(/\s+/g, ' ').trim().replace(/[\s.;,]+$/, ''); }
function riskSlidesWithMitigations_(slides, ctx) {
  const solution = typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx);          // V.1_54: Solution risks as issue rows
  if (!((typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx)) || solution) || !ctx.apiKey) return 0;
  const todo = [];
  (slides || []).forEach(function (sp, i) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template', 'case_study', 'team'].indexOf(t) !== -1) return;
    if (!RISK_TITLE_RE_.test(String(sp.title || ''))) return;
    if (solution && Array.isArray(sp.items) && sp.items.filter(function (it) { return it && it.fix; }).length >= 3) return;   // already issue rows
    if (riskHasMitigations_(sp) && solution) {
      // V.1_54: in a Solution Deck a risk with its mitigation is an issue row (the risk, and the fix on the right)
      const its = (Array.isArray(sp.items) ? sp.items : Array.isArray(sp.risks) ? sp.risks : []).filter(function (it) { return it && typeof it === 'object'; });
      const rows = its.map(function (it) {
        const fix = it.fix || it.mitigation || it.response || (Array.isArray(it.points) ? it.points.join('; ') : '') || it.text || '';
        return { title: String(it.title || it.label || it.risk || it.description || ''), fix: riskAction_(String(fix)), status: 'warning' };
      }).filter(function (r) { return r.title && r.fix; });
      if (rows.length >= 3 && rows.length <= 7) { ['left', 'right', 'rows', 'columns', 'points', 'risks'].forEach(function (k) { delete sp[k]; }); sp.type = 'cards'; sp.items = rows; sp.design = 'S66_ISSUE_ROWS'; sp.reference = null; }
      return;
    }
    if (riskHasMitigations_(sp)) {
      // V.1_50: the mitigations are shown, whatever field holds them (deck 22: they sat in the content but the numbered
      // rows design drew only the risks): risk + impact + mitigation rows
      const items = Array.isArray(sp.items) ? sp.items.filter(function (it) { return it && typeof it === 'object' && (it.title || it.label); }) : [];
      if (items.length >= 2 && items.length <= 3 && String(sp.type || '').toLowerCase() !== 'table') {
        sp.items = items.map(function (it) {
          let pts = (Array.isArray(it.points) ? it.points : []).map(String).filter(Boolean);
          const mit = it.mitigation || it.response || it.note;
          if (!pts.length && mit) pts = String(mit).replace(/^\s*(mitigation|instead|response)\s*:\s*/i, '').split(/;\s*|(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
          if (!pts.length && /\b(mitigat\w*|we will|through|via)\b/i.test(String(it.text || ''))) pts = [String(it.text)];
          return { title: String(it.title || it.label), text: pts.length && pts[0] === it.text ? '' : riskImpact_(it.text), points: pts.slice(0, 3).map(riskAction_), icon: it.icon };
        });
        if (sp.items.every(function (it) { return it.points.length; })) {
          ['left', 'right', 'rows', 'columns', 'points', 'risks'].forEach(function (k) { delete sp[k]; });
          sp.type = 'comparison';
          sp.design = 'P66_IMPACT_MITIGATION';
          sp.reference = null;
        }
      } else if (items.length > 3) {
        // more than three risks: the risk table (Risk | Impact | Mitigation)
        sp.type = 'table';
        sp.columns = ['Risk', 'Impact', 'Mitigation'];
        sp.rows = items.slice(0, 7).map(function (it) {
          const mit = it.mitigation || it.response || it.note;
          const acts = mit ? String(mit).replace(/^\s*(mitigation|instead|response)\s*:\s*/i, '').split(/;\s*|(?<=[.!?])\s+(?=[A-Z])/) : (it.points || []);
          return [String(it.title || it.label), riskImpact_(it.text), acts.map(riskAction_).filter(Boolean).join('; ')];
        });
        delete sp.items;
        sp.design = 'P66_TABLE';
        sp.reference = null;
      }
      return;
    }
    todo.push(i);
  });
  if (!todo.length) return 0;
  try {
    const list = todo.map(function (i, k) {
      const sp = slides[i];
      return { id: k, title: sp.title, lead: sp.lead || '', has: JSON.stringify(sp.items || sp.points || sp.rows || []).slice(0, 700) };
    });
    const prompt = [
      'These risk slides of a ' + ctx.brand.name + (solution ? ' solution deck' : ' proposal') + ' (request: "' + String(ctx.userPrompt || '').slice(0, 300) + '") name risks without saying how they are handled.',
      'For each slide write 3 concrete project risks: {"risk" (2-5 words, e.g. "Data quality gaps"), "impact" (one line, 8-14 words: what happens if it occurs),',
      '"mitigations": [2-3 short actions, 5-10 words each: what we do about it]}. Specific to the request, sentence case, plain text, no invented figures.',
      'Return ONLY JSON: {"slides":[{"id":0,"risks":[...]}]}',
      JSON.stringify(list)
    ].join('\n');
    const out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.3); });   // V.1_56: client-facing text
    let n = 0;
    ((out && out.slides) || []).forEach(function (r) {
      const i = todo[r && r.id];
      if (i == null || !Array.isArray(r.risks)) return;
      const rows = r.risks.filter(function (x) { return x && x.risk && Array.isArray(x.mitigations) && x.mitigations.length; }).slice(0, 3);
      if (rows.length < 2) return;
      const sp = slides[i];
      ['left', 'right', 'rows', 'columns', 'points', 'risks', 'stats', 'groups'].forEach(function (k) { delete sp[k]; });
      sp.type = 'comparison';
      sp.items = rows.map(function (x) { return { title: String(x.risk), text: riskImpact_(x.impact), points: x.mitigations.slice(0, 3).map(riskAction_).filter(Boolean) }; });
      if (solution) { sp.type = 'cards'; sp.items = sp.items.map(function (it) { return { title: it.title, fix: it.points.join('; '), status: 'warning' }; }); }
      sp.design = solution ? 'S66_ISSUE_ROWS' : 'P66_IMPACT_MITIGATION';
      sp.reference = null;
      sentenceCaseHeadings_(sp);
      n++;
    });
    if (n) ctx.log.push(n + ' risk slide(s): each risk now shows its impact and mitigation.');
    return n;
  } catch (e) {
    ctx.log.push('Risk mitigation step skipped: ' + e.message);
    return 0;
  }
}

// V.1_47: figures in card texts (product limits such as "100 million rows") that the sources do not contain get a note to
// check them before sharing (they are not removed: they may be right, but nobody has confirmed them)
function flagUnverifiedFigures_(slides, sources, approved) {
  const corpus = [JSON.stringify((sources && sources.research) || []), String((sources && sources.text) || ''), JSON.stringify(approved || [])].join(' ');
  if (corpus.length < 200) return 0;
  let n = 0;
  (slides || []).forEach(function (sp) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template', 'case_study'].indexOf(t) !== -1) return;
    const txt = JSON.stringify([sp.items, sp.points, sp.lead, sp.layers, sp.columns]);
    const nums = (txt.match(/\b\d+(?:[.,]\d+)?\s?(?:%|x|million|billion|hours?|days?|weeks?|rows|drivers|[kmb]\b)/gi) || []);
    const unknown = nums.filter(function (x) {
      const d = x.match(/\d+(?:[.,]\d+)?/)[0].replace(',', '.');
      return !new RegExp('(^|[^0-9.])' + d.replace('.', '[.,]') + '(?![0-9])').test(corpus);
    });
    if (unknown.length && !/Check before sharing: figures/.test(String(sp.notes || ''))) {
      sp.notes = String(sp.notes || '') + '\nCheck before sharing: figures not found in the research sources (' + unknown.slice(0, 4).join(', ') + ').';
      n++;
    }
  });
  return n;
}

// V.1_50: the request asks for a roadmap / timeline and no slide is one: the delivery plan slide becomes the timeline
// (the empty-slide check writes its periods and lanes from the phases)
function roadmapAsTimeline_(slides, prompt) {
  if (!/\b(roadmap|timeline|gantt)\b/i.test(String(prompt || ''))) return false;
  if ((slides || []).some(function (sp) { return sp && String(sp.type || '').toLowerCase() === 'timeline'; })) return false;
  const sp = (slides || []).filter(function (x) {
    const t = String((x && x.type) || '').toLowerCase();
    return x && ['process', 'cards', 'diagram'].indexOf(t) !== -1 && /\b(roadmap|timeline|delivery plan|phased|implementation plan|rollout|roll-out|plan\b)/i.test(String(x.title || ''));
  })[0];
  if (!sp) return false;
  sp.type = 'timeline';
  sp.design = 'P66_GANTT';
  sp.reference = null;
  return true;
}

/* ---------- V.1_51: a roadmap written as timed phases becomes a Gantt ----------
   "Months 1-3", "Weeks 2-6", "Q1-Q2", "Month 4": every phase with a readable timing becomes a lane with one bar over
   its periods (the timing is the bar label). Weeks beyond 12 are counted in months. Returns true when the slide got lanes. */
// more than 8 columns: "Month 10" does not fit its column ("Month..."), so the periods read "M1" ... "M12"
function shortPeriods_(per) {
  if (per.length <= 8) return per;
  return per.map(function (p) { const m = String(p).match(/^\s*(month|week|sprint)\s*(\d+)\s*$/i); return m ? m[1].charAt(0).toUpperCase() + m[2] : p; });
}
function ganttFromTimedItems_(sp) {
  const items = (Array.isArray(sp.items) ? sp.items : []).filter(Boolean);
  if (items.length < 3 || items.length > 6) return false;
  const RE = /\b(months?|weeks?|quarters?|q|sprints?)\s*(\d{1,2})(?:\s*(?:-|\u2013|\u2014|to|through)\s*(?:(?:months?|weeks?|quarters?|q|sprints?)\s*)?(\d{1,2}))?/i;
  const unitOf = function (u) { u = u.toLowerCase(); return u === 'q' || /^quarter/.test(u) ? 'Q' : /^week/.test(u) ? 'Week' : /^sprint/.test(u) ? 'Sprint' : 'Month'; };
  const rows = items.map(function (it) {
    const src = typeof it === 'string' ? it : [it.date, it.timing, it.period, it.label, it.title, it.text].filter(Boolean).join(' ');
    const m = String(src).match(RE);
    if (!m) return null;
    const a = parseInt(m[2], 10), b = m[3] ? parseInt(m[3], 10) : a;
    return { unit: unitOf(m[1]), start: Math.min(a, b), end: Math.max(a, b), timing: m[0].trim(),
      name: typeof it === 'string' ? it.replace(RE, '').replace(/^[\s:\-\u2013(]+|[\s:\-\u2013)]+$/g, '') : String(it.title || it.label || '') };
  });
  if (rows.some(function (r) { return !r || !r.name || r.start < 1; })) return false;
  let unit = rows[0].unit;
  if (rows.some(function (r) { return r.unit !== unit; })) return false;
  let max = Math.max.apply(null, rows.map(function (r) { return r.end; }));
  if (unit === 'Week' && max > 12) { rows.forEach(function (r) { r.start = Math.ceil(r.start / 4); r.end = Math.ceil(r.end / 4); }); unit = 'Month'; max = Math.ceil(max / 4); }
  if (max < 3 || max > 12) return false;
  sp.periods = shortPeriods_(Array.from({ length: max }, function (x, k) { return unit === 'Q' ? 'Q' + (k + 1) : unit + ' ' + (k + 1); }));
  sp.lanes = rows.map(function (r) { return { name: r.name.slice(0, 40), bars: [{ start: r.start, end: r.end, label: /^q/i.test(r.timing) ? r.timing.toUpperCase().replace(/\s+TO\s+/, ' to ') : r.timing.charAt(0).toUpperCase() + r.timing.slice(1).toLowerCase() }] }; });
  sp.design = 'P66_GANTT';
  sp.reference = null;
  return true;
}

/* ---------- V.1_50: a long-deck slide keeps the kind of slide the outline planned ----------
   Deck 22: the methodology slide came back as one sentence (drawn twice on a statement), and the roadmap the outline
   planned as a timeline came back as phases without dates. A planned roadmap stays a timeline (the empty-slide check
   writes its periods and lanes); a planned process / diagram / cards slide that came back as a bare statement or a few
   bullets gets its points as items (or empty items the empty-slide check fills). */
function keepOutlineType_(sp, o) {
  const want = String((o && o.type) || '').toLowerCase(), got = String((sp && sp.type) || '').toLowerCase();
  if (!sp || !want || want === got || want === 'section') return;
  if (want === 'timeline') {
    if (!/^(team|case_study)$/.test(got)) { sp.type = 'timeline'; if (String(sp.design || '').indexOf('GANTT') === -1) sp.design = 'P66_GANTT'; sp.reference = null; }
    return;
  }
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  if (['process', 'diagram', 'cards'].indexOf(want) !== -1 && ['statement', 'bullets', 'quote'].indexOf(got) !== -1 && items.length < 3) {
    const pts = (Array.isArray(sp.points) ? sp.points : []).map(function (p) {
      if (p && typeof p === 'object') return { title: String(p.title || p.label || ''), text: String(p.text || '') };
      const m = String(p || '').match(/^(.{3,48}?):\s+(.+)$/);
      return m ? { title: m[1], text: m[2] } : { title: '', text: String(p || '') };
    }).filter(function (x) { return x.title || x.text; });
    sp.type = want;
    sp.items = pts.length >= 3 && pts.every(function (x) { return x.title; }) ? pts : items;
    if (sp.statement && !sp.lead) sp.lead = String(sp.statement);
    ['statement', 'points', 'design', 'quote'].forEach(function (k) { delete sp[k]; });
    sp.reference = null;
  }
}

/* ---------- Slide titles (V.1_45) ----------
   A content slide without a title (Gemini sometimes leaves it out and writes only the lead) gets one: Gemini writes the
   missing titles in one call (the key message, max 58 characters); without an answer the lead is shortened to a title. */
const NO_TITLE_TYPES_ = { cover: 1, agenda: 1, closing: 1, section: 1, template: 1 };
function titleFromText_(sp) {
  const heads = (Array.isArray(sp.items) ? sp.items : []).map(function (it) { return it && typeof it === 'object' ? (it.title || it.label) : it; }).filter(Boolean);
  let t = String(sp.lead || sp.statement || sp.subtitle || sp.text || '').replace(/\s+/g, ' ').trim();
  if (!t && heads.length) t = heads.slice(0, 3).join(', ');
  t = t.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '');                      // first sentence
  if (t.length > 58) {
    const cut = t.slice(0, 58);
    const clause = cut.search(/,|;|:| – | — | - | (?:to|by|so|while|through|across|with|for) [^ ]*$/);
    t = (clause > 25 ? cut.slice(0, clause) : cut.replace(/\s+\S*$/, '')).replace(/[\s,;:–—-]+$/, '');
    t = t.replace(/\s+(?:and|or|of|the|a|an|to|for|with|in|on|by|our|your|their)$/i, '');
  }
  return t || 'Overview';
}
function ensureTitles_(slides, ctx) {
  const missing = (slides || []).filter(function (sp) {
    return sp && !NO_TITLE_TYPES_[String(sp.type || '').toLowerCase()] && !String(sp.title || '').trim();
  });
  if (!missing.length) return 0;
  let answer = null;
  try {
    const list = missing.map(function (sp, i) {
      const heads = (Array.isArray(sp.items) ? sp.items : []).map(function (it) { return it && typeof it === 'object' ? (it.title || it.label || '') : String(it || ''); }).filter(Boolean).slice(0, 6);
      return { id: i, type: sp.type, lead: String(sp.lead || sp.statement || '').slice(0, 220), parts: heads };
    });
    answer = callGeminiJSON([{ text: [
      'These presentation slides have no title. Write one title for each slide.',
      'A title is the slide\'s key message: specific, sentence case (only the first word and names capitalised), max 58 characters,',
      'no full stop, never a copy of the lead sentence, no hype words.',
      'Return ONLY JSON: {"titles":[{"id":0,"title":"..."}]}',
      'SLIDES:', JSON.stringify(list)
    ].join('\n') }], ctx.apiKey, 0.3);
  } catch (e) { answer = null; }
  const got = {};
  ((answer && answer.titles) || []).forEach(function (t) { if (t && t.title != null) got[t.id] = String(t.title); });
  missing.forEach(function (sp, i) {
    let t = String(got[i] || '').replace(/\s+/g, ' ').replace(/[.]+$/, '').trim();
    if (!t || t.length > 70) t = titleFromText_(sp);
    sp.title = sentenceCase_(t, 2);
  });
  if (ctx && ctx.log) ctx.log.push('Titles written for ' + missing.length + ' slide(s) that had none.');
  return missing.length;
}

/* ---------- Item text tidy-up (V.1_34) ----------
   - "Faster time-to-market (30-50% range)": a figure in brackets is not part of a heading
   - "40% ... reduction. This improves operational efficiency and team productivity.": the filler sentence goes
   - metric names written as "CPU/Memory" read "CPU and memory" on a metrics slide
   - a case study's industry tag is sentence case ("Food service", not "Food Service")
---------- */
const FILLER_TAIL_RE_ = /\s+This (?:improves|accelerates|ensures|helps|enables|allows|leads to|results in|reduces|drives|means|boosts|supports|minimi[sz]es|maximi[sz]es|approach|translates)\b[^.!?]*[.!?]?\s*$/i;
// V.1_35: a filler sentence anywhere after the first ("This phase ensures...", "This includes...", "We help you...") goes too
const FILLER_SENT_RE_ = /^(?:(?:this|these|it|which|such)\s+(?:\w+\s+){0,2}(?:improves|accelerates|ensures|helps|enables|allows|leads|results|reduces|drives|means|boosts|supports|minimi[sz]es|maximi[sz]es|translates|includes|involves|enhances|eliminates|provides|creates|underscores|highlights|demonstrates|delivers|fosters|empowers|guarantees|lays|sets|paves|positions|is (?:crucial|critical|essential|key|vital))\b|we (?:help|ensure|enable|work|partner|provide)\b|(?:ultimately|overall|in turn|as a result),)/i;
function dropFillerTail_(t) {
  const str = String(t || '');
  let out = FILLER_TAIL_RE_.test(str) ? str.replace(FILLER_TAIL_RE_, '').trim() : str;
  const sents = out.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [out];
  if (sents.length > 1) {
    const keep = sents.filter(function (x, i) { return i === 0 || !FILLER_SENT_RE_.test(x.trim()); });
    out = keep.join('').trim();
  }
  return out.split(/\s+/).length >= 3 ? out : str;                // never leave a stub
}
function tidyItemText_(sp) {
  if (!sp || typeof sp !== 'object') return sp;
  const t = String(sp.type || '').toLowerCase();
  if (t === 'template' || t === 'closing' || t === 'cover') return sp;
  const metricSlide = /\b(kpis?|metrics?|measure|scorecard)\b/i.test(String(sp.title || ''));
  const head = function (h) {
    let x = String(h || '').replace(/\s*\([^)]*\d[^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (metricSlide) x = x.replace(/^([A-Za-z]{2,})\s*\/\s*([A-Za-z]{2,})$/, function (m, a, b) { return a + ' and ' + (/^[A-Z]{2,}$/.test(b) ? b : b.toLowerCase()); });
    return x || String(h || '');
  };
  ['items', 'steps', 'layers'].forEach(function (k) {
    if (!Array.isArray(sp[k])) return;
    sp[k].forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      if (it.title) it.title = head(it.title);
      ['text', 'label', 'highlight'].forEach(function (f) { if (it[f]) it[f] = dropFillerTail_(it[f]); });
    });
  });
  if (Array.isArray(sp.results)) sp.results.forEach(function (r) { if (r && r.label) r.label = dropFillerTail_(r.label); });
  if (t === 'case_study') {
    if (sp.industry) sp.industry = sentenceCase_(String(sp.industry).replace(/\b[A-Z]{4,}\b/g, function (w) { return w.charAt(0) + w.slice(1).toLowerCase(); }), 1);
    // V.1_47: a food service distributor is not "Retail" (the industry follows the client, never a guess)
    if (sp.industry && /\bretail\b/i.test(sp.industry) && /food\s?service|food distribut/i.test(String(sp.client || '') + ' ' + String(sp.title || '') + ' ' + String(sp.challenge || ''))) sp.industry = 'Food service distribution';
    if (Array.isArray(sp.cases)) sp.cases.forEach(function (c) { if (c && c.industry) c.industry = sentenceCase_(String(c.industry), 1); });
  }
  return sp;
}

/* ---------- Final voice pass (V.1_35) ----------
   Runs on every slide after all the writing / replacing / filling steps, so slides written late (replacements, top-ups)
   get the same clean-up as the first draft:
   - filler sentences and bracketed figures in headings (tidyItemText_), hype words
   - Google Cloud names instead of other clouds' terms (unless the request is about AWS / Azure / multi-cloud)
   - DevOps / FinOps / MLOps / DevSecOps written the right way
   - "Our proven methodology" titles lose the sales words; "Quantifiable impact" without numbers loses "quantifiable"
   - every item on a slide has its own icon concept (no repeated light bulbs)
---------- */
const OTHER_CLOUD_TERMS_ = [
  [/\breserved instances?\s+(?:and|or|&)\s+savings plans?\b|\bsavings plans?\s+(?:and|or|&)\s+reserved instances?\b/gi, 'committed use discounts'],
  [/\breserved instances?\b|\bsavings plans?\b|\bRIs\b/gi, 'committed use discounts'],
  [/\b(?:AWS\s+)?cost explorer\b/gi, 'Cloud Billing reports'],
  [/\bAWS budgets\b/gi, 'Cloud Billing budgets'],
  [/\bspot instances?\b/gi, 'Spot VMs'],
  [/\b(?:AWS\s+)?trusted advisor\b/gi, 'Active Assist'],
  [/\b(?:AWS\s+)?compute optimizer\b/gi, 'Recommender'],
  [/\bEC2 instances?\b/g, 'Compute Engine VMs'],
  [/\bAmazon S3\b|\bS3 buckets?\b/g, 'Cloud Storage'],
  [/\bcost and usage reports?\b|\bCUR\b/gi, 'Cloud Billing export to BigQuery'],
  [/\bcost allocation tags\b/gi, 'labels']
];
function googleCloudTerms_(str) {
  let out = String(str || '');
  OTHER_CLOUD_TERMS_.forEach(function (p) {
    out = out.replace(p[0], function (m) {
      const r = p[1];
      return /^[A-Z]/.test(m) && /^[a-z]/.test(r) ? r.charAt(0).toUpperCase() + r.slice(1) : r;
    });
  });
  // "committed use discounts and committed use discounts" -> once
  return out.replace(/\b(committed use discounts)(?:\s*(?:,|and|or|&)\s*committed use discounts)+/gi, '$1')
    .replace(/\(CUDs?\)\s*\(CUDs?\)/g, '(CUDs)');
}
// V.1_57 (deck 30: "Cloud Pub/Sub", "Cloud Dataflow"): Google Cloud products by their current names
const CURRENT_PRODUCT_NAMES_ = [
  [/\bGoogle Cloud Pub\/Sub\b|\bCloud Pub\/Sub\b/g, 'Pub/Sub'],
  [/\bGoogle Cloud Dataflow\b|\bCloud Dataflow\b/g, 'Dataflow'],
  [/\bGoogle Cloud Dataproc\b|\bCloud Dataproc\b/g, 'Dataproc'],
  [/\b(?:Google )?Cloud Functions\b/g, 'Cloud Run functions'],
  [/\b(?:Google )?Data Studio\b/g, 'Looker Studio'],
  [/\b(?:Google )?Container Registry\b/g, 'Artifact Registry'],
  [/\bDuet AI(?: for Google Cloud)?\b/g, 'Gemini for Google Cloud'],
  [/\b(?:Google )?Cloud AI Platform\b|\bGoogle AI Platform\b/g, 'Vertex AI']
];
function currentProductNames_(str) {
  let out = String(str || '');
  CURRENT_PRODUCT_NAMES_.forEach(function (p) { out = out.replace(p[0], p[1]); });
  return out.replace(/\bCloud Run functions functions\b/g, 'Cloud Run functions');
}
const TERM_CASE_ = { devops: 'DevOps', devsecops: 'DevSecOps', finops: 'FinOps', mlops: 'MLOps', llmops: 'LLMOps', aiops: 'AIOps', gitops: 'GitOps', bigquery: 'BigQuery', looker: 'Looker' };
function termCase_(str) {
  return String(str || '').replace(/\b(devsecops|devops|finops|mlops|llmops|aiops|gitops|bigquery)\b/gi, function (m) { return TERM_CASE_[m.toLowerCase()] || m; });
}
function walkText_(o, fn) {
  if (!o || typeof o !== 'object') return;
  Object.keys(o).forEach(function (k) {
    if (k === 'reference' || k === 'notes' || k === 'design' || k === 'type' || k === 'tag' || k === 'icon' || k === 'material' || k === 'fact_tags' || k === 'code' || k === '_dropped') return;   // (V.1_54: code as written)
    if (typeof o[k] === 'string') o[k] = fn(o[k]); else walkText_(o[k], fn);
  });
}
// Generic icon concepts that end up as the same light bulb on every card
const WEAK_ICON_RE_ = /^\s*(idea|ideas|light ?bulb|lightbulb|bulb|innovation|insight|cloud|strategy|chess|pawn|star|check|tick|info|warning|alert|default|generic|icon)\s*$/i;
// The item's meaning -> one short icon concept the icon search finds (lucide / tabler names). Order matters: the first
// match that is still free on the slide is used, so four cards get four different icons.
const ICON_CONCEPTS_ = [
  [/\b(physician\w*|doctor\w*|clinician\w*|clinical)\b/i, 'stethoscope'],
  [/\b(nurs\w*|care team\w*)\b/i, 'clipboard'],
  [/\b(draft\w*|documentation|document\w*|notes?|charting)\b/i, 'file text'],
  [/\b(sign-?off|approv\w*)\b/i, 'circle check'],
  [/\b(consent|privacy|hipaa)\b/i, 'shield check'],
  [/\b(messag\w*|inbox|chat\w*)\b/i, 'message'],
  [/\b(hospital\w*|health system)\b/i, 'hospital'],
  [/\b(budget|overrun|overspend|spend(ing)?|bill(ing)?|invoice)\b/i, 'wallet'],
  [/\b(saving|savings|discount|commit(ted|ment)?|cud)\b/i, 'piggy bank'],
  [/\b(cost|price|pricing|financ\w*|dollar|money|roi)\b/i, 'cost'],
  [/\b(waste|idle|unused|orphan\w*|clean ?up|decommission\w*)\b/i, 'trash'],
  [/\b(tag|tags|tagging|label\w*|allocat\w*|chargeback|showback)\b/i, 'tag'],
  [/\b(forecast\w*|predict\w*|trend\w*|projection)\b/i, 'line chart'],
  [/\b(report\w*|dashboard\w*|visibility|transparen\w*|insight\w*)\b/i, 'dashboard'],
  [/\b(rightsiz\w*|resiz\w*|scal\w*|elastic\w*|capacity)\b/i, 'maximize'],
  [/\b(secur\w*|vulnerab\w*|threat\w*|attack\w*|protect\w*)\b/i, 'security'],
  [/\b(complian\w*|regulat\w*|audit\w*)\b/i, 'badge check'],
  [/\b(govern\w*|polic\w*|control\w*|guardrail\w*)\b/i, 'scale'],
  [/\b(risk\w*|threat|danger|exposure)\b/i, 'triangle alert'],
  [/\b(automat\w*|script\w*|scheduler?|bot)\b/i, 'automation'],
  [/\b(innovat\w*|launch\w*|new product\w*|speed|faster|time-to-market|agility)\b/i, 'rocket'],
  [/\b(operat\w*|efficien\w*|performance|productiv\w*)\b/i, 'gauge'],
  [/\b(monitor\w*|track\w*|observ\w*|alert\w*|anomal\w*)\b/i, 'activity'],
  [/\b(kpi|kpis|metric\w*|measur\w*|scorecard|benchmark\w*)\b/i, 'target'],
  [/\b(goal\w*|target\w*|objective\w*|priorit\w*|strateg\w*)\b/i, 'target'],
  [/\b(decision\w*|choice|option\w*|trade-?off\w*)\b/i, 'git branch'],
  [/\b(culture|accountab\w*|ownership|responsib\w*|collaborat\w*|shared)\b/i, 'handshake'],
  [/\b(team\w*|role\w*|people|staff|stakeholder\w*|cross-functional)\b/i, 'team'],
  [/\b(engineer\w*|developer\w*|devops|code|architect\w*|technical)\b/i, 'code'],
  [/\b(leader\w*|executive\w*|sponsor\w*)\b/i, 'flag'],
  [/\b(train\w*|skill\w*|upskill\w*|learn\w*|educat\w*)\b/i, 'graduation cap'],
  [/\b(data|database|warehouse|bigquery)\b/i, 'database'],
  [/\b(storage|backup|archive)\b/i, 'hard drive'],
  [/\b(network\w*|traffic|egress)\b/i, 'network'],
  [/\b(server\w*|compute|vm|vms|instance\w*|kubernetes|container\w*|workload\w*)\b/i, 'server'],
  [/\b(migrat\w*|modern\w*|move|transition)\b/i, 'arrow right left'],
  [/\b(time|schedul\w*|deadline\w*|delay\w*|timeline)\b/i, 'time'],
  [/\b(growth|grow\w*|revenue|increase\w*)\b/i, 'growth'],
  [/\b(process\w*|workflow\w*|pipeline\w*|step\w*)\b/i, 'workflow'],
  [/\b(customer\w*|client\w*|user\w*)\b/i, 'user'],
  [/\b(ai|ml|model\w*|gemini|machine learning)\b/i, 'ai'],
  [/\b(cloud|google cloud|platform)\b/i, 'cloud'],
  [/\b(idea\w*|creativ\w*|innovation)\b/i, 'idea']
];
// V.1_57 (deck 30 icons: a light bulb for physicians, the same database icon twice): words the icon search reads
// wrongly become the concept it draws well, and two names for the same picture count as one (never twice on a slide)
const ICON_SYNONYMS_ = [
  [/^(draft\w*|note|notes|documentation|document\w*|record\w*|chart ?note\w*|summary|summaries|report)$/i, 'file text'],
  [/^(sign-?off|signoff|approv\w*|accept\w*|verified|validate\w*|check ?mark|checkmark)$/i, 'circle check'],
  [/^(physician\w*|doctor\w*|clinician\w*|medical|clinic\w*|stethoscope)$/i, 'stethoscope'],
  [/^(nurse\w*|nursing|care ?team\w*|clipboard)$/i, 'clipboard'],
  [/^(patient\w*|member\w*)$/i, 'user'],
  [/^(hospital\w*|health ?system|facility|facilities)$/i, 'hospital'],
  [/^(storage|archive\w*|backup\w*|cold storage)$/i, 'archive'],
  [/^(bridge|support|help ?desk|service desk|call center|contact center|headset)$/i, 'headset'],
  [/^(monitor\w*|observab\w*|telemetry|activity)$/i, 'activity'],
  [/^(data|database|data ?warehouse|warehouse|bigquery|data ?lake|datastore|sql)$/i, 'database'],
  [/^(consent|privacy|hipaa|phi)$/i, 'shield check'],
  [/^(message\w*|messaging|chat|inbox|portal ?message\w*)$/i, 'message'],
  [/^(light ?bulb|lightbulb|bulb)$/i, 'idea']
];
function iconSynonym_(name) {
  const n = String(name || '').trim();
  for (let i = 0; i < ICON_SYNONYMS_.length; i++) if (ICON_SYNONYMS_[i][0].test(n)) return ICON_SYNONYMS_[i][1];
  return n;
}
function iconConceptFor_(text, taken) {
  for (var i = 0; i < ICON_CONCEPTS_.length; i++) {
    if (ICON_CONCEPTS_[i][0].test(text) && !taken[ICON_CONCEPTS_[i][1]]) return ICON_CONCEPTS_[i][1];
  }
  return '';
}
// Last resort icons: ones the add-on can always draw (bundled), never the light bulb first
const ICON_POOL_ = ['analytics', 'security', 'automation', 'team', 'growth', 'time', 'cloud', 'cost', 'lock', 'ai', 'chart', 'innovation'];
function distinctIcons_(sp) {
  ['items', 'steps', 'layers'].forEach(function (k) {
    if (!Array.isArray(sp[k])) return;
    const list = sp[k].filter(function (it) { return it && typeof it === 'object'; });
    if (!list.length) return;
    // a slide shows icons on every card or on none (V.1_37: three of six cards had none)
    const wantsIcons = list.some(function (it) { return it.icon || it.material; }) || ['cards', 'diagram'].indexOf(String(sp.type || '').toLowerCase()) !== -1;
    if (!wantsIcons) return;
    const taken = {};
    list.forEach(function (it) {
      let ic = iconSynonym_(String(it.icon || '').trim());
      if (ic === 'idea' && !/\b(idea\w*|innovat\w*|brainstorm\w*|creativ\w*)\b/i.test(String(it.title || '') + ' ' + String(it.text || ''))) ic = '';
      const head = String(it.title || it.label || '');
      if (!ic || WEAK_ICON_RE_.test(ic) || taken[ic.toLowerCase()] || ic.split(/\s+/).length > 3) {
        ic = iconConceptFor_(head, taken) || iconConceptFor_(head + ' ' + String(it.text || ''), taken) ||
          ICON_POOL_.filter(function (x) { return !taken[x]; })[0] || '';
      }
      if (ic) { it.icon = ic; taken[ic.toLowerCase()] = true; delete it.material; }
    });
  });
}
// V.1_57 (deck 30: a "Proof from 66degrees ..." box on a Solution slide nobody asked for): in a Solution Deck a side
// panel, callout or tip that cites a 66degrees result is left out unless the request asks for proof or case studies
const BRAND_PROOF_RE_ = /\b66\s?degrees\b[^.]*\d|\bproof from 66\s?degrees\b|\b66\s?degrees\b[^.]*\b(client|engagement|deployment|customer)s?\b[^.]*\b(reduc|decreas|increas|cut|improv|saved|lift)/i;
function dropBrandProof_(sp, ctx) {
  const prompt = String((ctx && ctx.userPrompt) || '');
  if (CASE_REQUEST_RE_.test(prompt) || /\b(credential|why 66\s?degrees|our experience|track record)\b/i.test(prompt)) return 0;
  let n = 0;
  const cites = function (v) { return BRAND_PROOF_RE_.test(typeof v === 'string' ? v : JSON.stringify(v || '')); };
  ['callout', 'proof', 'note', 'insight', 'evidence', 'sidebar', 'panel'].forEach(function (k) {
    if (sp[k] && cites(sp[k])) { delete sp[k]; n++; }
  });
  ['tips', 'callouts', 'proofs', 'notes_panel'].forEach(function (k) {
    if (!Array.isArray(sp[k])) return;
    const before = sp[k].length;
    sp[k] = sp[k].filter(function (x) { return !cites(x); });
    n += before - sp[k].length;
    if (!sp[k].length) delete sp[k];
  });
  ['points'].forEach(function (k) {
    if (!Array.isArray(sp[k]) || sp[k].length < 3) return;
    const keep = sp[k].filter(function (x) { return !cites(x); });
    if (keep.length >= 2 && keep.length < sp[k].length) { n += sp[k].length - keep.length; sp[k] = keep; }
  });
  if (n) { try { Logger.log('V.1_57: ' + n + ' 66degrees proof text(s) left out of "' + String(sp.title || '') + '" (not requested).'); } catch (e) {} }
  return n;
}
function finalVoicePass_(slides, ctx) {
  const prompt = String((ctx && ctx.userPrompt) || '');
  const solutionVoice = typeof deckLibraryOf_ === 'function' && deckLibraryOf_(ctx) === 'solution';
  const otherCloud = /\b(aws|amazon web services|azure|microsoft cloud|multi-?cloud|hybrid cloud|oracle cloud)\b/i.test(prompt);
  const trainsModels = /\b(train|training|fine-?tun\w*|custom model)\b/i.test(prompt);
  (slides || []).forEach(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'template' || t === 'closing') return;
    tidyItemText_(sp);
    removeHypeWords_(sp);
    if (!otherCloud) walkText_(sp, googleCloudTerms_);
    walkText_(sp, currentProductNames_);
    if (sp.notes) sp.notes = currentProductNames_(sp.notes);
    walkText_(sp, termCase_);
    if (sp.title && t !== 'cover') {
      sp.title = String(sp.title).replace(/^our\s+(?:proven|unique|tried-and-tested|trusted|comprehensive|holistic|signature)\s+/i, '')
        .replace(/^(?:our)\s+/i, '');
      sp.title = sp.title.charAt(0).toUpperCase() + sp.title.slice(1);
      // "Quantifiable impact" with no numbers on the slide is not quantified
      const hasNum = /\d/.test(JSON.stringify([sp.items || [], sp.points || [], sp.results || []]));
      if (!hasNum && /\b(quantifiable|quantified|measurable)\s+/i.test(sp.title)) {
        sp.title = sp.title.replace(/\b(quantifiable|quantified|measurable)\s+/i, '');
        sp.title = sp.title.charAt(0).toUpperCase() + sp.title.slice(1);
      }
    }
    dropTimeValues_(sp);
    // V.1_58 (deck 31: "Executive Sponsor (COO / VP Member Services)"): table headings and row labels in sentence case
    if (Array.isArray(sp.rows)) sp.rows.forEach(function (r) { if (Array.isArray(r) && typeof r[0] === 'string') r[0] = sentenceCase_(r[0], 2); else if (r && typeof r === 'object' && typeof r.label === 'string') r.label = sentenceCase_(r.label, 2); });
    if (Array.isArray(sp.columns)) sp.columns = sp.columns.map(function (c) { return typeof c === 'string' ? sentenceCase_(c, 2) : c; });
    if (solutionVoice || sp.deckLibrary === 'solution') dropBrandProof_(sp, ctx);
    if (t === 'stats') { splitRangeValues_(sp); statsOneKind_(sp); dropWideRanges_(sp); }
    if (!trainsModels) walkText_(sp, groundedNotTrained_);
    walkText_(sp, directStatement_);
    cleanClientMarks_(sp, ctx);
    if (t === 'stats') (sp.items || []).forEach(function (it) {
      if (!it) return;
      // "24.6%" -> "25%" on a slide (figures of 10 and more are shown whole)
      if (typeof it.value === 'string') it.value = it.value.replace(/^(\D*)(\d{2,})\.(\d)(\s?%?)$/, function (m, a, n, d, u) { return a + Math.round(parseFloat(n + '.' + d)) + u; });
      // "Maintain/Exceed NPS" -> "Maintain or exceed NPS"
      if (typeof it.label === 'string') it.label = slashWords_(it.label);
    });
    expandMetricNames_(sp);
    sentenceCaseHeadings_(sp);
    if (Array.isArray(sp.items)) sp.items.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      // no figures or ranges in brackets in a stat label ("Containment rate (70-85% range)")
      if (it.label && t === 'stats') it.label = String(it.label).replace(/\s*\([^)]*\d[^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
      // a timeline label that repeats the step title is cut to its short form ("Phase 4: Scale & optimize" -> "Phase 4")
      const lm = String(it.label || '').match(/^\s*((?:phase|stage|step|wave|sprint|month|week|quarter|q)\s*[\dIVX]+(?:\s*[-–]\s*\d+)?)\s*[:–—-]\s*\S/i);
      if (lm && it.title) it.label = lm[1].replace(/\s+/g, ' ');
    });
    if (t === 'table' && Array.isArray(sp.rows)) {
      sp.rows.forEach(function (r) {
        if (!Array.isArray(r)) return;
        // the first column holds row headings: sentence case ("Technical Prowess" -> "Technical prowess") (V.1_39)
        if (typeof r[0] === 'string' && r[0].split(/\s+/).length <= 6) r[0] = headingCase_(r[0]);
        for (var c = 1; c < r.length; c++) if (typeof r[c] === 'string') r[c] = dropFillerTail_(r[c]);
      });
      if (Array.isArray(sp.columns) && sp.columns.length === 2 && /^(topic|item|area)$/i.test(String(sp.columns[0])) && /^(what it means|description|details)$/i.test(String(sp.columns[1]))) sp.columns = tableHeaders_(sp.title);
    }
    distinctIcons_(sp);
  });
}
// V.1_39: a market figure given as a wide range ("300-600%+", "$0.60-$1.50") is a weak benchmark: it leaves the slide
// when two other figures stay; otherwise the presenter is asked to check it. Targets ("Target: ...") keep their ranges.
function dropWideRanges_(sp) {
  if (!Array.isArray(sp.items)) return;
  const wide = function (it) {
    if (!it || /^\s*targets?\b/i.test(String(it.label || ''))) return false;
    return /\d\s*[-–]\s*[$€£]?\d/.test(String(it.value || ''));
  };
  const bad = sp.items.filter(wide);
  if (!bad.length) return;
  if (sp.items.length - bad.length >= 2) { noteDrop_(sp, bad); sp.items = sp.items.filter(function (it) { return !wide(it); }); }
  else if (!/Check before sharing: wide ranges/.test(String(sp.notes || ''))) sp.notes = String(sp.notes || '') + '\nCheck before sharing: wide ranges on this slide are vendor benchmarks; use a single sourced figure.';
}
// V.1_39: Gemini is grounded in the client's content, not trained on it ("train Gemini models with Apple-specific data")
function groundedNotTrained_(str) {
  // V.1_40: "Develops, trains, and deploys Gemini and Vertex AI Search models" -> "Develops, configures, and deploys Gemini and Vertex AI Search"
  str = String(str || '').replace(/\b(train(?:s|ing)?|fine-?tun(?:es|ing)?)(,?\s+(?:and\s+)?(?:deploy|test|tun|optimi[sz]|evaluat)\w*[^.]{0,40}?\b(?:Gemini|Vertex AI))/gi, function (m, v, rest) {
    const c = /ing$/i.test(v) ? 'configuring' : /s$/i.test(v) ? 'configures' : 'configure';
    return (/^[A-Z]/.test(v) ? c.charAt(0).toUpperCase() + c.slice(1) : c) + rest;
  }).replace(/\b(Vertex AI Search)\s+models?\b/g, '$1');
  return String(str || '').replace(/\b(train|trains|training|trained|fine-?tun(?:e|es|ing|ed))\s+(?:the\s+)?(?:Gemini|AI|LLMs?|foundation|language)(?:\s+(?:AI|language))?(?:\s+models?)?\s+(?:with|on|using)\s+((?:[\w&'’-]+\s+){0,3}?)(?:data|datasets?|content|information)\b/gi,
    function (m, verb, what) {
      const v = verb.toLowerCase();
      const g = /^train(?:s)?$|^fine-?tunes?$/.test(v) ? (/s$/.test(v) ? 'grounds' : 'ground') : /ing$/.test(v) ? 'grounding' : 'grounded';
      const out = g + ' Gemini in ' + what + 'content';
      return /^[A-Z]/.test(m) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
    });
}
// V.1_40: "AI is no longer a future concept; it is an immediate necessity" -> "AI is an immediate necessity"
function directStatement_(str) {
  return String(str || '')
    .replace(/\b([A-Z][^.;:!?]{1,60}?)\s+(is|are)\s+no longer\s+[^.;:!?]{1,80}?[;,:—–-]\s*(?:it|they)\s+(?:is|are)\s+(?:now\s+)?/g, '$1 $2 ')
    .replace(/\bnot just\s+([^,.;]{1,60}?),\s*but\s+(?:also\s+)?/gi, '');
}
// "Maintain/Exceed" -> "Maintain or exceed"; acronym pairs ("AI/ML", "CI/CD") stay
function slashWords_(str) {
  return String(str || '').replace(/\b([A-Za-z][a-z]{2,})\/([A-Za-z][a-z]{2,})\b/g, function (m, a, b) { return a + ' or ' + b.toLowerCase(); });
}
// V.1_40: "(client)" written into a role's text goes; a role title says "(client)" -> the client's name
function cleanClientMarks_(sp, ctx) {
  const client = String((ctx && (ctx.clientName || (ctx.proposal && ctx.proposal.client && ctx.proposal.client.name))) || '');
  const fixText = function (x) { return String(x).replace(/\s*\((?:the\s+)?client\)\s*\.?\s*$/i, '').replace(/\s*\((?:the\s+)?client\)/gi, ''); };
  const fixHead = function (x) { return client ? String(x).replace(/\((?:the\s+)?client\)/gi, '(' + client + ')') : String(x); };
  (sp.items || []).forEach(function (it) {
    if (!it || typeof it !== 'object') return;
    if (typeof it.text === 'string') it.text = fixText(it.text);
    if (typeof it.title === 'string') it.title = fixHead(it.title);
  });
  if (Array.isArray(sp.rows)) sp.rows.forEach(function (r) {
    if (!Array.isArray(r)) return;
    if (typeof r[0] === 'string') r[0] = fixHead(r[0]);
    for (var c = 1; c < r.length; c++) if (typeof r[c] === 'string') r[c] = fixText(r[c]);
  });
}
// V.1_39: metric short forms written out in labels and headings ("Reduction in AHT", "Boost in agent sat")
const METRIC_NAMES_ = [
  [/\bAHT\b/g, 'average handle time'], [/\bFCR\b/g, 'first contact resolution'], [/\bASA\b/g, 'average speed of answer'],
  [/\bMTTR\b/g, 'mean time to resolve'], [/\b(agent|employee)\s+sat\b\.?/gi, '$1 satisfaction'], [/\b(customer|cust)\s+sat\b\.?/gi, 'customer satisfaction']
];
function expandMetricNames_(sp) {
  const fix = function (str) {
    let out = String(str || '');
    METRIC_NAMES_.forEach(function (m) { out = out.replace(m[0], m[1]); });
    return out.replace(/\bcust satisfaction\b/gi, 'customer satisfaction');
  };
  ['items', 'steps'].forEach(function (k) {
    (sp[k] || []).forEach(function (it) { if (it && typeof it === 'object') ['label', 'title'].forEach(function (f) { if (typeof it[f] === 'string') it[f] = fix(it[f]); }); });
  });
  if (typeof sp.title === 'string') sp.title = fix(sp.title);
}
// A stats slide shows market facts OR the client's targets, not both: the larger group stays (V.1_35)
function statsOneKind_(sp) {
  if (!Array.isArray(sp.items) || sp.items.length < 3) return;
  const isTarget = function (it) { return /^\s*target\b/i.test(String((it && it.label) || '')); };
  const targets = sp.items.filter(isTarget), facts = sp.items.filter(function (it) { return !isTarget(it); });
  if (!targets.length || !facts.length) return;
  if (facts.length >= 2) { noteDrop_(sp, targets); sp.items = facts; }
  else if (targets.length >= 2) { noteDrop_(sp, facts); sp.items = targets; }
}
// A credentials slide recognised by its content: headcounts, certification counts, partner awards (V.1_35)
function credentialsContent_(sp) {
  const txt = JSON.stringify([sp.title || '', sp.lead || '', sp.items || [], sp.points || [], sp.statement || '']);
  let hits = 0;
  if (/\b\d[\d,]*\+?\s*(?:experts|engineers|consultants|employees|people|certifications?|certified|projects|engagements|customers|clients|migrations|deployments)\b/i.test(txt)) hits++;
  if (/\b(?:preferred|premier|leading|top|elite)\s+(?:google(?:\s+cloud)?\s+)?partner\b|\bpartner of the year\b|\bspecializations?\b|\bawards?\b/i.test(txt)) hits++;
  if (/^\s*(?:partnering|partner(?:ship)?\s+(?:for|with|to)|why\s+(?:choose|work with|66degrees)|working with 66degrees|our (?:expertise|approach|impact))/i.test(String(sp.title || ''))) hits++;
  if (/\b66degrees\b/i.test(txt) && /\b(?:expertise|experience|track record|certifications?)\b/i.test(txt)) hits++;
  return hits >= 2;
}
// V.1_48: a title that sells 66degrees ("Partnering for Unilever's future growth", "Why 66degrees") is a credentials slide
// on its own in an outline (deck 21: it passed and was written with 350+ experts and 600+ certifications)
function credentialsTitle_(sp) {
  return /^\s*(?:partnering|partner(?:ship)?\s+(?:for|with|to)|why\s+(?:choose|work with|66degrees|us)|working with 66degrees|our (?:expertise|credentials|track record)|66degrees\b)/i.test(String(sp.title || '')) ||
    /\b(?:long-term|trusted|strategic) partner(?:ship)? (?:for|with) (?:your|the) (?:future|growth|success)\b/i.test(String(sp.title || ''));
}
// V.1_48: 66degrees credentials (experts, certifications, partner status) are left out of slides when the request does not
// ask for them; a slide that was only credentials gets its missing content from the empty-slide check
const CRED_LINE_RE_ = /\b\d[\d,]*\+?\s*(?:technical\s+)?(?:experts|engineers|consultants|employees|certifications?|certified|projects|engagements|customers|clients)\b|\b(?:preferred|premier|elite)\s+(?:google(?:\s+cloud)?\s+)?partner\b|\bpartner of the year\b|\bgoogle(?:'s)? preferred partner\b/i;
function stripUnaskedCredentials_(slides, prompt) {
  if (wantsCredentials_(prompt)) return 0;
  let n = 0;
  (slides || []).forEach(function (sp) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template', 'case_study'].indexOf(t) !== -1) return;
    const keep = function (x) { return !CRED_LINE_RE_.test(typeof x === 'string' ? x : JSON.stringify(x || '')); };
    if (Array.isArray(sp.points)) { const p = sp.points.filter(keep); if (p.length < sp.points.length) { n += sp.points.length - p.length; sp.points = p; } }
    if (Array.isArray(sp.items)) { const it = sp.items.filter(keep); if (it.length < sp.items.length) { n += sp.items.length - it.length; sp.items = it; } }
    ['lead', 'takeaway', 'statement', 'text'].forEach(function (k) {
      if (typeof sp[k] === 'string' && CRED_LINE_RE_.test(sp[k])) {
        const parts = sp[k].split(/(?<=[.!?])\s+/).filter(function (x) { return !CRED_LINE_RE_.test(x); });
        sp[k] = parts.join(' ');
        n++;
      }
    });
  });
  return n;
}
// Off the request's subject: an AI slide in a deck whose request never mentions AI (V.1_35)
function offTopicAi_(sp, prompt) {
  if (/\b(ai|artificial intelligence|gen ?ai|gemini|machine learning|ml|llms?|agents?|agentic)\b/i.test(String(prompt || ''))) return false;
  return /\b(AI|GenAI|artificial intelligence|machine learning|LLMs?)\b/.test(String(sp.title || ''));
}

// V.1_48: team lanes from the shapes Gemini writes for a team slide; true when the slide is a team slide afterwards
function proposalTeamShape_(sp) {
  if (!sp) return false;
  const split = function (v) {
    if (Array.isArray(v)) return v;
    return String(v || '').split(/\s*[,;•\n]\s*|\s+and\s+(?=[A-Z])/).map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(function (x) { return x && x.split(/\s+/).length <= 6; });
  };
  const teamTitle = /\b(teams?|governance|roles|staffing|who does what)\b/i.test(String(sp.title || ''));
  if (Array.isArray(sp.teams) && sp.teams.length) {
    // V.1_51 (deck 23 slide 25): roles: [] next to members / stakeholders fell back to two plain cards. The first list
    // that has entries is the roles; one string that lists several roles ("Sponsor, Project manager") is split
    const listOf = function (v) {
      const arr = Array.isArray(v) ? v : (v ? [v] : []);
      const out = [];
      arr.forEach(function (r) {
        if (typeof r === 'string') split(r).forEach(function (x) { out.push(x); });
        else if (r && typeof r === 'object' && (r.title || r.role || r.name)) out.push(r);
      });
      return out;
    };
    sp.teams.forEach(function (tm) {
      if (!tm || typeof tm !== 'object') return;
      const cands = [tm.roles, tm.members, tm.people, tm.points, listOf(tm.stakeholders).concat(listOf(tm.specialists)), tm.text];
      for (let k = 0; k < cands.length; k++) { const l = listOf(cands[k]); if (l.length) { tm.roles = l.slice(0, 8); break; } }
    });
    if (String(sp.type || '').toLowerCase() !== 'team' && teamTitle) sp.type = 'team';
    return String(sp.type || '').toLowerCase() === 'team';
  }
  // two cards named "... team" whose text lists roles -> two team lanes
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  const lanes = items.filter(function (it) { return it && typeof it === 'object' && /\bteam\b/i.test(String(it.title || it.label || '')); });
  if (teamTitle && lanes.length === 2 && items.length <= 3) {
    const teams = lanes.map(function (it) { return { name: String(it.title || it.label), roles: split((it.points && it.points.length) ? it.points : it.text) }; });
    if (teams.every(function (tm) { return tm.roles.length >= 2; })) {
      const rest = items.filter(function (it) { return lanes.indexOf(it) === -1; })[0];
      sp.type = 'team';
      sp.teams = teams;
      if (rest && !sp.governance) sp.governance = { title: String(rest.title || 'Governance'), text: String(rest.text || '') };
      delete sp.items;
      return true;
    }
  }
  return false;
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
      if (isLibraryDeck_(ctx)) {   // General template slides are never used in a Proposal or Solution Deck
        ctx.log.push('Left out a ' + (key || 'template') + ' slide: ' + (deckLibraryOf_(ctx) === 'solution' ? 'General template slides are not used in a Solution Deck.' : 'General template slides are not used in a Proposal Deck.'));
        return;
      }
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
    // V.1_48: a Proposal Deck team slide written as two cards ("Unilever team: Project sponsor, Supply chain lead, ...") or with
    // its roles as one line is turned into the two team lanes (deck 21 slide 25 fell back to two grey boxes)
    if (typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx) && proposalTeamShape_(sp)) t = 'team';
    if (t === 'team') {
      const people = (Array.isArray(sp.people) ? sp.people : []).filter(function (p) { return p && (p.name || typeof p === 'string'); });
      // V.1_42: a Proposal Deck shows the team as roles (org chart, role blocks, client and 66degrees lanes): no names needed
      const proposalTeam = !!ctx && typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx);
      if (proposalTeam && !people.length && (sp.org || Array.isArray(sp.teams) || (Array.isArray(sp.items) && sp.items.length >= 2))) { out.push(sp); return; }
      const real = people.filter(function (p) {
        const name = String(typeof p === 'string' ? p : p.name).trim().toLowerCase();
        const last = name.split(/\s+/).pop();
        return name && (askedLc.indexOf(name) !== -1 || (last.length > 2 && askedLc.indexOf(last) !== -1));
      });
      if (people.length < 1 || real.length < Math.ceil(people.length * 0.8)) {
        // a proposal keeps the roles, without the invented names
        const roles = proposalTeam ? people.map(function (p) { return typeof p === 'string' ? null : { title: String(p.title || p.role || '').trim(), text: String(p.text || '').trim() }; })
          .filter(function (r) { return r && r.title; }) : [];
        if (roles.length >= 2) {
          delete sp.people;
          sp.items = roles.slice(0, 6);
          ctx.log.push('Team slide shown as roles: the people\'s names were not in the request or the source material.');
          out.push(sp);
          return;
        }
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

const NOTE_COUNT_WORDS_ = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function itemCountOf_(sp) {
  const list = sp.items || sp.points || sp.results || sp.rows;
  return Array.isArray(list) ? list.length : 0;
}

// "Four headline KPI metrics" on a slide with 3 KPIs -> "Three headline KPI metrics"
function fixCountWord_(label, count) {
  const m = String(label).match(/^(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*/i);
  if (!m || !count) return label;
  const said = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NOTE_COUNT_WORDS_.indexOf(m[1].toLowerCase());
  if (said === count) return label;
  const word = /^\d+$/.test(m[1]) ? String(count) : (NOTE_COUNT_WORDS_[count] || String(count));
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
  // V.1_42: a Proposal Deck agenda lists its sections (or slides) in the proposal agenda designs
  if (agenda.lockTag && typeof proposalAgendaSync_ === 'function') { proposalAgendaSync_(slides); return; }
  const body = slides.filter(function (sp) { return ['cover', 'agenda', 'closing'].indexOf(String(sp.type || '').toLowerCase()) === -1; });
  const isFrame = function (it) { return /^(introduction|intro|welcome|thank you!?|thanks|closing|q&a|questions)$/i.test(String((it && (it.title || it)) || '').trim()); };
  const given = Array.isArray(agenda.items) ? agenda.items.filter(function (it) { return !isFrame(it); }).map(function (it) {
    return typeof it === 'string' ? { title: it, text: '' } : { title: it.title || '', text: it.text || '' };
  }) : [];
  const sameCount = given.length === body.length;
  // V.1_57 (decision 2): a General Deck agenda lists its 3-5 sections (set once by generalAgendaSections_), not every slide
  const groups = Array.isArray(agenda.sectionGroups) ? agenda.sectionGroups : null;
  if (groups && groups.reduce(function (a, g) { return a + (g.count || 0); }, 0) === body.length) {
    body.forEach(function (sp) {                                       // the count words are checked here too
      if (sp.title) sp.title = fixCountWord_(sp.title, itemCountOf_(sp));
      if (sp.statement) sp.statement = fixCountWord_(sp.statement, itemCountOf_(sp));
    });
    let at = 0;
    agenda.items = groups.map(function (g, k) {
      const own = body.slice(at, at + g.count); at += g.count;
      return { no: k + 1, title: g.title, text: own.map(function (sp) { return shortTitle_(slideHeading_(sp)); }).join(' · ').slice(0, 160) };
    });
    return;
  }
  const items = body.map(function (sp, i) {
    // A count in the title must match what the slide shows ("Four KPIs" on a slide with three -> "Three KPIs")
    if (sp.title) sp.title = fixCountWord_(sp.title, itemCountOf_(sp));
    if (sp.statement) sp.statement = fixCountWord_(sp.statement, itemCountOf_(sp));
    const text = (sameCount && given[i].text) || sp.lead || sp.subtitle || '';
    return { title: slideHeading_(sp), text: text };
  });
  // V.1_65: the agenda lists the content only, numbered 01, 02, 03... in order (no Introduction or Thank-you rows, every deck type)
  agenda.items = items.map(function (it, i) { it.no = i + 1; return it; });
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
    'statistics, trends and examples (analyst firms such as Gartner, Forrester, IDC and McKinsey, Google and Google Cloud,',
    'industry bodies, reputable news, academic work). Do NOT use marketing blogs of software vendors (contact-centre, CRM or AI',
    'vendors such as Intercom/Fin, Zendesk, Salesforce, Genesys, NICE, Five9) or any company blog: they sell a competing product.',
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

// V.1_39: vendor marketing (a competing product's blog) is not a source for a 66degrees deck ("300-600% ROI" from Fin AI)
const WEAK_SOURCE_RE_ = /\b(intercom|fin ai|fin\.ai|zendesk|freshworks|freshdesk|salesforce|servicenow|genesys|nice cxone|nice\.com|five9|talkdesk|sprinklr|ada\.cx|ada support|kore\.ai|yellow\.ai|liveperson|gorgias|hubspot|tidio|helpshift|ultimate\.ai|forethought|cognigy|uniphore|observe\.ai|balto|level ?ai|replicant|sierra ai|decagon|openai|chatgpt|copilot|amazon connect|aws|azure|ibm watson|wavetec|qminder)\b/i;
const TRUSTED_SOURCE_RE_ = /\b(google|gartner|forrester|idc|mckinsey|deloitte|bcg|bain|accenture|pwc|kpmg|ey\b|harvard|hbr|mit\b|stanford|reuters|bloomberg|financial times|wall street journal|wsj|economist|forbes|cx today|statista|pew)\b/i;
function weakSource_(src) {
  const who = [src.title, src.publisher, src.url].map(function (x) { return String(x || ''); }).join(' ');
  if (TRUSTED_SOURCE_RE_.test(String(src.publisher || '')) && !WEAK_SOURCE_RE_.test(String(src.publisher || ''))) return false;
  return WEAK_SOURCE_RE_.test(who) || (/\bblog\b/i.test(who) && !TRUSTED_SOURCE_RE_.test(who));
}
function toResearchSources_(list) {
  const clean = function (x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); };
  const good = (list || []).filter(function (src) { return src && !weakSource_(src); });
  return good.slice(0, CONFIG.sciteMaxPapers || 8).map(function (src, i) {
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
    const tc = geminiThinkingConfig_(models[m]);                                       // V.1_56
    if (tc) body.generationConfig.thinkingConfig = tc; else delete body.generationConfig.thinkingConfig;
    for (let attempt = 0; attempt < (opts.attempts || 2); attempt++) {
      try {
        const json = callVertexGemini_(body, { model: models[m] }).result;
        const cand = json.candidates && json.candidates[0];
        const text = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
        if (text) { noteGeminiModel_(models[m], m > 0); return { text: text, grounding: (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [] }; }
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
// Presenter notes written from the slide itself: its message, then what to walk through
function presenterNotes_(sp) {
  const t = String((sp && sp.type) || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'template', 'section'].indexOf(t) !== -1) return '';
  const msg = String(sp.lead || sp.statement || sp.takeaway || (sp.insight && sp.insight.text) || '').trim();
  const list = (sp.items || sp.steps || []).map(function (it) {
    if (!it || typeof it !== 'object') return String(it || '');
    return t === 'stats' ? [it.value, String(it.label || '').replace(/^\s*target:\s*/i, '')].filter(Boolean).join(' ') : String(it.title || it.label || '');
  }).concat((sp.points || []).map(function (p) { return typeof p === 'string' ? p.split(':')[0] : String((p && p.title) || ''); }))
    .concat(sp.left && sp.right ? [String(sp.left.label || sp.left.title || ''), String(sp.right.label || sp.right.title || '')] : [])
    .concat(Array.isArray(sp.rows) ? sp.rows.map(function (r) { return Array.isArray(r) ? String(r[0] || '') : String((r && r.label) || ''); }) : [])
    .map(function (x) { x = x.trim(); return /^[A-Z][a-z]/.test(x) ? keepNames_(x.charAt(0).toLowerCase() + x.slice(1)) : x; }).filter(Boolean).slice(0, 6);
  const head = String(sp.title || '').trim();
  const out = [];
  // (V.1_50: "AI-powered ..." stays "AI-powered", never "aI-powered": only a capital followed by a small letter is lowered)
  out.push(msg ? msg.replace(/([^.!?])$/, '$1.') : (head ? 'This slide covers ' + (/^[A-Z][a-z]/.test(head) ? keepNames_(head.charAt(0).toLowerCase() + head.slice(1)) : head) + '.' : ''));
  if (list.length) out.push('Walk through ' + (list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0]) + '.');
  return out.filter(Boolean).join(' ');
}
// V.1_57 (deck 30: seven slides had the "This slide covers ... Walk through ..." fallback): slides without presenter
// notes get them from one short Gemini call (the research / check model) that only uses what the slide shows;
// the fallback sentence stays for any slide the call leaves out
// V.1_58 (deck 31 slide 18: the notes still walked through a fourth KPI the code had removed): what the code removes
// from a slide is recorded on it, and finalizeNotes_ takes those figures out of the notes
function noteDrop_(sp, items) {
  if (!sp || !items || !items.length) return;
  if (!Array.isArray(sp._dropped)) sp._dropped = [];
  items.forEach(function (it) { if (it && typeof it === 'object') sp._dropped.push({ value: String(it.value == null ? '' : it.value).trim(), label: String(it.label || it.title || '').trim() }); });
}
function notesWithoutDropped_(sp) {
  let notes = String(sp.notes || '');
  const dropped = Array.isArray(sp._dropped) ? sp._dropped : [];
  delete sp._dropped;
  if (!notes) return notes;
  dropped.forEach(function (d) {
    const v = d.value.replace(/^[<>~≈]+/, '');
    if (!v || !/\d/.test(v)) return;
    const esc = v.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const re = new RegExp('(^|[^0-9.])' + esc + '(?![0-9])');
    notes = notes.split(/(?<=[.!?])\s+/).map(function (sent) {
      if (!re.test(sent)) return sent;
      const clauses = sent.split(/,\s+(?:and\s+)?|;\s+/);
      if (clauses.length < 2) return '';
      const kept = clauses.filter(function (c) { return !re.test(c); });
      if (!kept.length) return '';
      let out = kept.join(', ');
      if (!/[.!?]$/.test(out)) out += '.';
      return out.replace(/,\s*([^,]+)$/, kept.length > 2 ? ', and $1' : ' and $1');
    }).filter(Boolean).join(' ');
  });
  // "All four pilot metrics" on a slide that shows three
  const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  if (items.length >= 2 && items.length <= 10) {
    notes = notes.replace(/\b(all|these|the|our)\s+(two|three|four|five|six|seven|eight)\b/gi, function (m, a, w) {
      const k = NOTE_COUNT_WORDS_.indexOf(w.toLowerCase());
      if (k === items.length || !dropped.length) return m;
      const rep = NOTE_COUNT_WORDS_[items.length];
      return a + ' ' + (/^[A-Z]/.test(w) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep);
    });
  }
  return notes;
}
function notesBare_(n) {
  return !String(n || '').replace(/\s*\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/g, '')
    .replace(/Illustrative figure[^.]*\.|Verify before sharing\.|Check before sharing:[^.]*\./gi, '').trim();
}
function slideTextForNotes_(sp) {
  const bits = [];
  const add = function (v) { if (v != null && String(v).trim()) bits.push(String(v).trim()); };
  add(sp.lead); add(sp.statement); add(sp.takeaway); add(sp.text);
  (sp.items || sp.steps || []).forEach(function (it) {
    if (!it) return;
    if (typeof it !== 'object') { add(it); return; }
    add([it.value, it.title || it.label, it.text].filter(Boolean).join(' - '));
    (it.points || []).forEach(add);
  });
  (sp.points || []).forEach(function (p) { add(typeof p === 'string' ? p : p && (p.title || p.text)); });
  (Array.isArray(sp.rows) ? sp.rows : []).forEach(function (r) { add(Array.isArray(r) ? r.join(' | ') : r && [r.label, r.left, r.right].filter(Boolean).join(' | ')); });
  return bits.join('\n').slice(0, 1200);
}
function writeMissingNotes_(plan, ctx) {
  if (!ctx || typeof callGeminiJSON !== 'function') return 0;
  const skip = ['cover', 'agenda', 'closing', 'template', 'section'];
  const need = [];
  (plan.slides || []).forEach(function (sp, i) {
    if (!sp || skip.indexOf(String(sp.type || '').toLowerCase()) !== -1) return;
    if (notesBare_(sp.notes) && slideTextForNotes_(sp)) need.push(i);
  });
  if (!need.length) return 0;
  const list = need.slice(0, 14).map(function (i) {
    const sp = plan.slides[i];
    return 'SLIDE ' + i + ': ' + String(sp.title || '') + '\n' + slideTextForNotes_(sp);
  }).join('\n\n');
  const prompt = 'Write presenter notes for these slides. Return ONLY JSON: {"notes":[{"slide": <number>, "notes": "<2-4 sentences>"}]}.\n' +
    'Rules: speak as the presenter to the audience; say why the slide matters and how to walk through it; use ONLY what the slide shows ' +
    '(no new figures, products, names or claims; a figure is quoted exactly as on the slide); plain words, no hype, no markdown; ' +
    'never "This slide covers".\n\n' + list;
  let out = null;
  try { out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.3); } catch (e) { if (ctx.log) ctx.log.push('Presenter notes call skipped: ' + String(e && e.message).slice(0, 120)); return 0; }
  let done = 0;
  ((out && Array.isArray(out.notes)) ? out.notes : []).forEach(function (o) {
    const k = Number(o && o.slide), txt = String((o && o.notes) || '').replace(/\*\*/g, '').trim();
    if (need.indexOf(k) === -1 || txt.length < 40 || /this slide covers/i.test(txt)) return;
    const sp = plan.slides[k];
    // a figure the slide does not show is never added by the notes
    const shown = JSON.stringify(sp);
    const figs = txt.match(/\d[\d,.]*\s*%?/g) || [];
    if (figs.some(function (f) { return shown.indexOf(f.replace(/\s+$/, '')) === -1; })) return;
    sp.notes = (txt + (sp.notes ? ' ' + String(sp.notes).trim() : '')).trim();
    done++;
  });
  if (ctx.log && done) ctx.log.push('V.1_57: presenter notes written for ' + done + ' slide' + (done === 1 ? '' : 's') + ' that had none.');
  return done;
}
// V.1_58 (deck 31 slide 18: the note listed "30 min, 4 hours, 24 hours", the slide showed 15 minutes and two hours):
// the "times on this slide" note names only times the slide still shows
function recheckTimesNote_(sp) {
  const re = /\n?The times on this slide \(([^)]*)\) are proposals, not given in the request: confirm them before sharing\./;
  const m = re.exec(String(sp.notes || ''));
  if (!m) return;
  const copy = Object.assign({}, sp); delete copy.notes;
  const body = JSON.stringify(copy);
  const still = m[1].split(/,\s*/).filter(function (t) { const d = (t.match(/\d+(?:[.,]\d+)?/) || [''])[0]; return d && new RegExp('(^|[^0-9.])' + d.replace('.', '[.,]') + '(?![0-9])').test(body); });
  sp.notes = String(sp.notes).replace(re, still.length ? '\nThe times on this slide (' + still.join(', ') + ') are proposals, not given in the request: confirm them before sharing.' : '');
}
// V.1_58 (deck 31 slide 2: the agenda notes promised "client proof" and a "17-part story"): the agenda's notes say what
// the agenda shows
function agendaNotes_(sp) {
  const items = (Array.isArray(sp.items) ? sp.items : []).map(function (it) { return String((it && (it.title || it)) || '').trim(); })
    .filter(function (t) { return t && !/^(introduction|thank you)$/i.test(t); });
  if (items.length < 2) return;
  const low = items.map(function (t, i) { return i ? t.charAt(0).toLowerCase() + t.slice(1) : t; });
  sp.notes = 'Walk the audience through the ' + (NOTE_COUNT_WORDS_[items.length] || items.length) + ' parts of the presentation: ' +
    low.slice(0, -1).join(', ') + ' and ' + low[low.length - 1] + '.';
  if (typeof keepNames_ === 'function') sp.notes = keepNames_(sp.notes);
}
// V.1_73: step 4 - a slide the checker still finds a problem on is written again once, then drawn with a safe layout
// (Gate.gs); never stops a deck
function deckGate_(slides, ctx, started) {
  if (typeof gateSlides_ !== 'function') return null;
  try { return gateSlides_(slides, ctx, started); } catch (e) { if (ctx && ctx.log) ctx.log.push('Slide gate skipped: ' + e.message); return null; }
}
// V.1_72: step 3 - the slides of a known kind (KPIs, RACI, team, risks, pricing, next steps) in the shape their designs
// need (Contracts.gs); never stops a deck
function deckShapeCheck_(slides, ctx) {
  if (typeof conformSlides_ !== 'function') return 0;
  try { return conformSlides_(slides, ctx); } catch (e) { if (ctx && ctx.log) ctx.log.push('Slide shape step skipped: ' + e.message); return 0; }
}
// V.1_70: the figure check of Brief.gs on a set of slides (never stops a deck)
function deckFigureCheck_(slides, ctx, sources) {
  if (typeof guardFigures_ !== 'function') return 0;
  try {
    if (typeof canonicalCredentials_ === 'function') canonicalCredentials_(slides, ctx);   // V.1_71: one figure per 66degrees credential
    if (typeof approvedCredentialClaims_ === 'function') approvedCredentialClaims_(slides, ctx);   // V.1_72: credential claims as approved
    if (typeof foreignWords_ === 'function') foreignWords_(slides);                               // V.1_72: English words only
    const n = guardFigures_(slides, ctx, sources); sameMeasureFigures_(slides, ctx);
    if (typeof targetFiguresInText_ === 'function') targetFiguresInText_(slides, ctx);   // V.1_73
    if (typeof credentialCounts_ === 'function') credentialCounts_(slides, ctx);         // V.1_73
    if (typeof fragmentRepair_ === 'function') fragmentRepair_(slides, ctx);             // V.1_73: last - no broken text
    return n;
  }
  catch (e) { if (ctx && ctx.log) ctx.log.push('Figure check skipped: ' + e.message); return 0; }
}
function finalizeNotes_(plan, sources, ctx) {
  (plan.slides || []).forEach(function (sp) {
    if (!sp) return;
    if (sp._dropped) sp.notes = notesWithoutDropped_(sp);
    recheckTimesNote_(sp);
    if (String(sp.type || '').toLowerCase() === 'agenda') agendaNotes_(sp);
  });
  try { writeMissingNotes_(plan, ctx); } catch (e) {}
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
      // V.1_56: Google Search redirect links expire and say nothing: the title and publisher are kept, not the link
      const url = src.url && !/grounding-api-redirect|vertexaisearch\.cloud\.google\.com/i.test(src.url) ? ' ' + src.url : '';
      return '[' + k + '] ' + src.title + (src.journal ? ' (' + src.journal + (src.year ? ', ' + src.year : '') + ')' : (src.year ? ' (' + src.year + ')' : '')) + (url || (src.doi ? ' doi:' + src.doi : ''));
    }).filter(Boolean);
    // (V.1_56: a "Source: x.com" line Gemini wrote is left out when the Sources list follows)
    if (list.length) notes = notes.replace(/\s*\bSources?:\s*[^\n]*$/gim, '').trim();
    notes = notes.replace(/\s*https?:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/\S+/g, '');
    // V.1_39: every content slide has presenter notes (deck 15: six slides had none)
    if (!notes.replace(/Illustrative figure[^.]*\.|Verify before sharing\.|Check before sharing:[^.]*\./gi, '').trim()) notes = (presenterNotes_(sp) + (notes ? ' ' + notes : '')).trim();
    if (list.length) notes += (notes ? '\n\n' : '') + 'Sources:\n' + list.join('\n');
    sp.notes = notes.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*{2,}/g, '');     // V.1_48: no markdown asterisks in the notes either
  });
}

/* =========================
   DRAWING THE SLIDES (Create mode without Beautiful.ai)
========================= */

// Empty working presentation (16:9) with one blank slide per planned slide
function createWorkingDeck_(title, count) {
  const pres = newWorkingPresentation_((title || 'Generated deck') + ' (working copy)');
  const first = pres.getSlides()[0];
  for (let i = 0; i < count; i++) pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  if (first) first.remove();
  pres.saveAndClose();
  return pres.getId();
}

// The only place a new presentation is created: hidden working copies (Beautiful.ai import, V.1_51 long proposal decks)
function newWorkingPresentation_(name) {
  return SlidesApp.create(name);
}

// Draws every planned slide with the layout engine in the design chosen for it; progress slide by slide
// V.1_55: a slide that failed to draw is drawn again as its title, its lead and its text as a plain list
function safeSlideSpec_(sp) {
  if (!sp || typeof sp !== 'object') return null;
  const t = String(sp.type || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'section', 'template'].indexOf(t) !== -1) return null;
  const out = [];
  (function walk(v, k) {
    if (['title', 'lead', 'notes', 'reference', 'type', 'design', 'icon', 'material', 'deckLibrary', 'fact_tags', 'code', 'lockTag'].indexOf(k) !== -1) return;
    if (typeof v === 'string') { if (/[A-Za-z]{3}/.test(v) && out.length < 8) out.push(v.replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 20).join(' ')); return; }
    if (Array.isArray(v)) { v.forEach(function (x) { walk(x, ''); }); return; }
    if (v && typeof v === 'object') Object.keys(v).forEach(function (kk) { walk(v[kk], kk); });
  })(sp, '');
  if (!out.length) return null;
  return { type: 'bullets', title: sp.title || '', lead: sp.lead || '', points: out.slice(0, 6), notes: sp.notes || '', deckLibrary: sp.deckLibrary, section: sp.section };
}
function drawSlidesIntoActive_(target, specs, ctx, blankDeck) {
  if (typeof applyProposalFrame_ === 'function') applyProposalFrame_(specs, ctx);
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
  // V.1_66: the slide log numbers a slide by its place in the deck (it counted 1-8 again in every part of a long deck)
  let noBase = 0;
  try { noBase = blankDeck ? 0 : Math.max(0, target.getSlides().length - specs.length); } catch (eNo) { noBase = 0; }
  // V.1_67 (deck 39: the cover was logged as slide 2): the working copy of a long deck starts with its own empty slide
  try { if (ctx && ctx.workId && typeof target.getId === 'function' && target.getId() === ctx.workId) noBase = Math.max(0, noBase - 1); } catch (eW) {}

  // V.1_54 (deck 25 slide 19): every slide of a Proposal or Solution Deck carries its library when it is drawn, also a
  // slide added after the frame was applied (otherwise it was drawn with a General layout)
  if (isLibraryDeck_(ctx)) {
    const lib = deckLibraryOf_(ctx);
    specs.forEach(function (sp) { if (sp && String(sp.type || '').toLowerCase() !== 'template' && sp.deckLibrary !== lib) sp.deckLibrary = lib; });
    if (lib === 'solution') specs.forEach(function (sp) { if (sp) { sp.cobrand = false; sp.clientLogo = false; if (typeof solutionTimelineAsProcess_ === 'function') solutionTimelineAsProcess_(sp); } });
  }
  // V.1_53: some Solution slides are drawn dark (black, content in white), about one body slide in five
  if (typeof solutionDarkRhythm_ === 'function') solutionDarkRhythm_(specs, ctx);
  slidesToRender.forEach(function (slide, i) {
    checkCancel_(ctx);
    progressSlide_(ctx, i, 'active');
    try {
      ctx.currentSpec = specs[i];
      // Real template slides (client logos, leadership, industries) are copied from the template as they are
      const sp = specs[i] || {};
      if (String(sp.type || '').toLowerCase() === 'template' && sp.tag && insertTemplateSlide_(slide, sp.tag, ctx)) {
        stats.redrawn++;
        progressSlide_(ctx, i, 'done');
        return;
      }
      renderEngineSlide(slide, specs[i], noBase + i + 1, ctx, pageW, pageH, dateLabel);
      stats.redrawn++;
    } catch (e) {
      // V.1_55 (deck 26 slide 23 was left blank): the slide is drawn again as a plain list of its own text
      let saved = false;
      try {
        const safe = safeSlideSpec_(specs[i]);
        if (safe) { slide.getPageElements().forEach(function (el) { try { el.remove(); } catch (err) {} }); renderEngineSlide(slide, safe, noBase + i + 1, ctx, pageW, pageH, dateLabel); saved = true; stats.redrawn++; }
      } catch (e2) {}
      if (!saved) stats.failed++;
      ctx.log.push('Slide ' + (i + 1) + (saved ? ' was redrawn as a simple list (' : ' could not be drawn (') + e.message + ').');
    }
    progressSlide_(ctx, i, 'done');
  });
  ctx.currentSpec = null;

  if (blankDeck) {
    const leftover = target.getSlides();
    for (let i = leftover.length - 1; i >= specs.length; i--) {
      try { leftover[i].remove(); } catch (e) {}
    }
  }

  stats.libraryIcons = ctx.libraryIconsPlaced || 0;
  progressStage_(ctx, 'brand', 'done', stats.redrawn + ' slides drawn in this presentation');
  // V.1_64: slides the deck check drew again with a better design
  if (ctx.qaFixed) { ctx.log.push('Deck check: ' + ctx.qaFixed + ' slide(s) drawn again with a design that shows all of their content.'); ctx.qaFixed = 0; }
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
/**
 * Ingest an uploaded file into sources.
 * opts.allowDiagramIngest — when true (Flowchart / explicit opt-in), raster images may be
 * reconstructed into editable diagram IR. Normal Create passes false so PNG/JPG/WebP/GIF stay
 * visual references and never enter the flowchart pipeline by image alone.
 */
function readUploadedFile_(upload, sources, ctx, opts) {
  opts = opts || {};
  const allowDiagramIngest = !!opts.allowDiagramIngest;
  const name = String(upload.name || 'file');
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] ? name.match(/\.([a-z0-9]+)$/i)[1].toLowerCase() : '';
  const bytes = Utilities.base64Decode(String(upload.data));
  if (bytes.length > 20 * 1024 * 1024) throw new Error('The uploaded file is larger than 20 MB.');
  const mime = String(upload.mimeType || '');
  const addText = function (text) {
    sources.text += (sources.text ? '\n\n' : '') + 'UPLOADED FILE "' + name + '":\n' + String(text).slice(0, CONFIG.maxSourceChars);
  };

  // Structured diagram formats are an explicit diagram action (not inferred from a raster image).
  const category = typeof detectUploadCategory_ === 'function' ? detectUploadCategory_(upload) : '';
  if (category === 'structured-diagram' ||
      /^(mmd|mermaid|drawio|dio|excalidraw|svg)$/.test(ext) ||
      mime === 'image/svg+xml') {
    if (typeof ingestUploadedDiagram_ === 'function') {
      const result = ingestUploadedDiagram_(upload, sources, ctx);
      if (result && result.ok) return;
      // Keep textual diagram sources available to the planner when reconstruction fails.
      try { addText(Utilities.newBlob(bytes).getDataAsString()); } catch (e) {}
      if (result && result.fallback) return;
    }
  }

  if (ext === 'pdf' || mime === 'application/pdf') { sources.pdfs.push(String(upload.data)); return; }
  if (/^(png|jpe?g|webp|gif)$/.test(ext) || /^image\//.test(mime)) {
    // Raster images: reference material in Create. Diagram reconstruction only when explicitly allowed.
    if (allowDiagramIngest && typeof ingestUploadedDiagram_ === 'function') {
      try { ingestUploadedDiagram_(upload, sources, ctx); } catch (e) {
        if (ctx) ctx.log.push('Diagram image analysis skipped: ' + e.message);
      }
    } else if (ctx && !allowDiagramIngest) {
      ctx.log.push('Image kept as reference (Create does not auto-convert pictures to flowcharts): ' + name + '.');
    }
    if (!(sources.images || []).some(function (img) { return img && img.data === String(upload.data); })) {
      sources.images.push({
        mime: mime || ('image/' + (ext === 'jpg' ? 'jpeg' : ext)),
        data: String(upload.data),
        name: name,
        role: 'reference'
      });
    }
    return;
  }
  if (/^(txt|md|csv|tsv|json|xml|html?|rtf|mmd|mermaid)$/.test(ext) || /^text\//.test(mime)) {
    addText(Utilities.newBlob(bytes).getDataAsString());
    return;
  }
  if (ext === 'pptx' && typeof diagramUploadParts_ === 'function') {
    // PowerPoint: slide text always feeds the writer. Picture→diagram reconstruction is Flowchart-only.
    const parts = diagramUploadParts_(upload);
    const words = (parts.slides || []).map(function (sl) { return sl.text ? 'Slide ' + sl.slide + ': ' + sl.text : ''; }).filter(Boolean).join('\n');
    if (words) addText(words);
    const pics = parts.items.filter(function (it) { return it.image; });
    if (pics.length && allowDiagramIngest && typeof diagramDesignRead_ === 'function') {
      progressStage_(ctx, 'diagram', 'active', 'Reading the diagrams in ' + name + ' (diagram-design)');
      const got = diagramDesignRead_({ items: pics }, {}, ctx);
      got.log.forEach(function (l) { ctx.log.push(l); });
      sources.diagrams = sources.diagrams || [];
      got.diagrams.forEach(function (ir) { sources.diagrams.push({ name: name, category: 'presentation', ir: ir }); });
      if (got.diagrams.length && typeof noteDiagramsForPlanner_ === 'function') noteDiagramsForPlanner_(sources, got.diagrams, name);
      got.notDiagram.forEach(function (it) { if (it.image && sources.images.length < 6) sources.images.push({ mime: it.image.mime, data: it.image.data, role: 'reference' }); });
    } else if (pics.length) {
      pics.forEach(function (it) {
        if (it.image && sources.images.length < 6) {
          sources.images.push({ mime: it.image.mime, data: it.image.data, name: name, role: 'reference' });
        }
      });
      if (ctx) ctx.log.push('PowerPoint pictures kept as references (not converted to flowcharts in Create): ' + name + '.');
    }
    if (!words && !pics.length) throw new Error('Nothing could be read from ' + name + '.');
    return;
  }
  if (/^(doc|docx|odt|xls|xlsx|ods|ppt|pptx|odp)$/.test(ext)) {
    // Office→Google conversion previously used Drive REST upload/export, which
    // triggers "Permission denied while enabling APIs: drive" for end users.
    // Accept PDF / text / CSV / images / Google Workspace links instead.
    throw new Error(
      'Uploaded .' + ext + ' files are not converted via the Drive REST API. ' +
      'Please upload a PDF, PowerPoint (.pptx), CSV, text or image, or paste a Google Docs / Sheets / Slides link.'
    );
  }
  throw new Error('This file type is not supported (' + name + '). Use PDF, CSV, text, an image, Mermaid/draw.io/Excalidraw/SVG, or a Google Docs/Sheets/Slides link.');
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
  for (let round = 0; round < 3; round++) {                      // V.1_58: a third round for texts still too long (deck 31: 16 left)
    if (Date.now() - started > 230000) break;                     // stay well inside the 6-minute limit
    if (round === 2 && res.fixed === 0) break;
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
      // V.1_65 (deck 37: three short bullets in a tall box): a list of fewer than 5 points in a box with room gets new points
      if (round === 0) {
        const lists = {};
        m.underfill.forEach(function (u) {
          const path = findTextPath_(sp, u.text);
          if (!path || path.length < 2 || path[path.length - 2] !== 'points') return;
          const lp = path.slice(0, -1), arr0 = lp.reduce(function (o, k) { return o && o[k]; }, sp);
          if (!Array.isArray(arr0) || arr0.length >= 5 || lists[lp.join('.')]) return;
          lists[lp.join('.')] = true;
          issues.push({ slide: i, path: lp, current: arr0.map(String).join(' | '), action: 'add_points', add: Math.min(5 - arr0.length, 3), list: arr0.map(String) });
        });
      }
      if (round === 0) m.underfill.forEach(function (u) {
        const path = findTextPath_(sp, u.text);
        if (!path) return;
        if (path.length >= 2 && path[path.length - 2] === 'points' && issues.some(function (x) { return x.slide === i && x.action === 'add_points' && x.path.join('.') === path.slice(0, -1).join('.'); })) return;
        let maxC = Math.min(u.maxChars, u.text.length + 320, 420), minC = Math.min(u.minChars, u.text.length + 160);   // V.1_65: boxes are filled, not left two-thirds empty
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
      if (it.action === 'add_points') return { id: k, slide_title: slideHeading_(plan.slides[it.slide]), action: 'add_points', add: it.add, points: it.list };
      return { id: k, slide_title: slideHeading_(plan.slides[it.slide]), action: it.action, kind: it.bullet ? 'bullet' : (it.path[0] === 'title' ? 'slide title' : 'text'),
        min_chars: it.min_chars, max_chars: it.max_chars, text: it.current };
    });
    const prompt = [
      'You are editing text on 66degrees consulting slides so that every text fits its box exactly.',
      'For each item, rewrite "text" so its length (characters, spaces included) is between min_chars and max_chars.',
      '- action "shorten": keep the key message, numbers and names; cut filler words. A list keeps every one of its items (each item says less);',
      '  never drop an option or end on "and", "or" or a half phrase. Short labels (chart categories, column heads) stay different from each other.',
      '- action "expand": add ONE or TWO short, specific sentences (how it works, why it matters, a concrete example). Never repeat',
      '  the slide title or its words, never pad with filler, never add new numbers, clients, awards or claims about 66degrees.',
      '- kind "bullet": keep it ONE sentence (make it fuller, do not add a second sentence). Keep a "Label: " start if it has one.',
      '- kind "slide title" and short headings: keep a complete, specific phrase (never vague words like "Data view" or "Capabilities").',
      '- action "add_points": write "add" NEW points for the list in "points" - same style and length as the points there, each one',
      '  specific sentence about the slide\'s subject, never a repeat or rewording of a point already there, no new numbers or claims.',
      '- Plain text, one piece of text per item, no quotation marks, no reference markers like [1], no hype words.',
      'Return ONLY JSON: {"fixes":[{"id":0,"text":"..."},{"id":1,"points":["...","..."]}]}',
      '',
      'ITEMS:',
      JSON.stringify(list)
    ].join('\n');
    let out = null;
    try { out = callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.3); } catch (e) { ctx.log.push('Fit check skipped: ' + e.message); break; }
    ((out && out.fixes) || []).forEach(function (f) {
      const it = issues[f.id];
      if (it && it.action === 'add_points' && Array.isArray(f.points)) {
        const arr0 = it.path.reduce(function (o, k) { return o && o[k]; }, plan.slides[it.slide]);
        if (!Array.isArray(arr0)) return;
        const seen = {}; arr0.forEach(function (p) { seen[String(p).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = 1; });
        f.points.slice(0, it.add).forEach(function (p) {
          const t = ENGINE.cleanText(String(p || '')).trim(), k = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          if (t.length >= 12 && !seen[k]) { seen[k] = 1; arr0.push(t); res.fixed++; }
        });
        return;
      }
      if (!it || !f.text) return;
      const txt = ENGINE.cleanText(String(f.text));
      // still too long: kept when it is shorter than before (the next round takes it from there), else tried again
      if (it.action === 'shorten' && txt.length > it.max_chars * 1.05 && txt.length >= String(it.current || '').length) return;
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
/**
 * Flowchart tab: the slide specs of the small deck - introduction, the diagram slides, the template Thank-you slide.
 * Titles are real titles (never the "The diagram illustrates..." description), in sentence case and never cut mid-word.
 */
function flowchartDeckSpecs_(text, read, fileName) {
  const generic = /^\s*(please\s+)?(create|make|draw|redraw|build|generate|turn|convert|show)\b[^.]{0,40}\b(flow ?charts?|diagrams?|this|these|it|them|sketch|picture|image|slides?)\b\s*\.?\s*$/i;
  const diagrams = read.diagrams || [];
  const firstIr = diagrams[0] || { title: '', lead: '', nodes: [] };
  const clean = function (s, max) { return ddTrimText_(sentenceCase_(ddTextCase_(String(s || '').replace(/\s+/g, ' ').trim()), 2), max, false); };
  let topic = '';
  if (text && !generic.test(text) && text.split(/\s+/).length <= 12) topic = text.split(/[\n.→>]/)[0];
  else if (read.topics && read.topics[0]) topic = ddTitleFromSentence_(read.topics[0], 70, true);
  else if (read.shows && read.shows[0]) topic = ddTitleFromSentence_(read.shows[0], 70);
  if (!topic || topic.split(/\s+/).length < 2) topic = firstIr.title || 'Process overview';
  const coverTitle = clean(topic, 70);
  const n = diagrams.length;
  let coverSub = '';
  if (n > 1) {
    // "4 diagrams: a · b · c" with whole titles only - a title that does not fit is left out, never cut
    const head = n + ' diagrams: ';
    const titles = diagrams.map(function (ir) { return clean(ir.title, 70); }).filter(Boolean);
    const kept = [];
    titles.forEach(function (t, i) {
      const rest = titles.length - i - 1;
      if (kept.length === i && (head + kept.concat([t]).join(' · ') + (rest ? ' and ' + rest + ' more' : '')).length <= 150) kept.push(t);
    });
    const more = titles.length - kept.length;
    coverSub = kept.length ? head + kept.join(' · ') + (more ? ' and ' + more + ' more' : '') : n + ' diagrams';
  } else coverSub = firstIr.lead || clean(firstIr.title, 140);
  const specs = [{ type: 'cover', title: coverTitle, subtitle: coverSub,
    notes: 'Introduction to the diagrams that follow' + (fileName ? ' (from ' + fileName + ')' : '') + '.' }];
  diagrams.forEach(function (ir) {
    const fallback = text ? text.split(/[\n.→>]/)[0] : (ir.sourceLabel || 'Process overview');
    specs.push({
      type: 'diagram', title: clean(ir.title || fallback, 80), lead: ir.lead ? ddLead_(ir.lead, 150) : '', diagram: ir,
      items: (ir.nodes || []).slice(0, 8).map(function (nd) { return { title: nd.label, text: nd.sub || nd.label }; }),
      notes: 'Diagram (' + ir.type + ') built by the 66° Deck Agent with diagram-design' + (ir.sourceLabel && ir.sourceLabel !== 'description' ? ' from ' + ir.sourceLabel : '') +
        '. Every box and arrow is an editable shape.'
    });
  });
  specs.push({ type: 'closing', title: 'Thank You!', subtitle: coverTitle, notes: '' });   // the template Thank-you design (strict rule)
  return specs;
}

function sentenceCase_(t, minWords) {
  const str = typeof capsToSentence_ === 'function' ? capsToSentence_(String(t || '').trim()) : String(t || '').trim();   // V.1_47: "VALUE CHECKPOINT" -> "Value checkpoint"
  const words = str.split(/\s+/);
  const SMALL = /^(a|an|and|or|for|of|in|on|at|to|by|the|with|from|vs|via|as|is|are|your|our)$/i;
  const plain = words.filter(function (w) { return /^[A-Za-z][a-z]/.test(w) && !SMALL.test(w.replace(/[^A-Za-z]/g, '')); });   // ordinary words (not acronyms/numbers/small words)
  const caps = plain.filter(function (w) { return /^[A-Z]/.test(w); }).length;
  const hyphenCaps = words.some(function (w) { return /-[A-Z][a-z]/.test(w); });
  if (!hyphenCaps && (plain.length < (minWords || 3) || caps < plain.length * 0.6)) return keepNames_(lowerCommonWords_(str));      // already sentence case (V.1_39: "Future State" words still lowered)
  const keep = /^(AI|ML|ROI|KPIs?|CIO|CFO|CEO|CTO|IT|API|GCP|AWS|SAP|LLMs?|MLOps|LLMOps|GenAI|Google|Gemini|Workspace|BigQuery|Vertex|Looker|66degrees|Microsoft|Azure|Salesforce|SharePoint|CSAT|NPS|SaaS|B2B|US|UK|EU|Q[1-4])$/;
  let first = true;
  const cased = words.map(function (w) {
    const bare = w.replace(/['’]s$/i, '').replace(/[^A-Za-z0-9]/g, '');
    let out = w;
    // acronyms and their plurals (FDEs, APIs) and mixed-case names (DevSecOps, FinOps, BigQuery) keep their capitals
    const lowerable = function (b) { return !keep.test(b) && !/[0-9]/.test(b) && !/^[A-Z]{2,}s?$/.test(b) && !/[a-z][A-Z]/.test(b); };
    if (/-/.test(w)) {
      // "AI-Powered" -> "AI-powered", "Data-Driven" -> "Data-driven": each part of a hyphenated word on its own
      out = w.split('-').map(function (part, k) {
        const b = part.replace(/[^A-Za-z0-9]/g, '');
        return (k === 0 && first) || !lowerable(b) ? part : part.toLowerCase();
      }).join('-');
    } else if (!first && lowerable(bare)) out = w.toLowerCase();
    first = /:$/.test(w);                                                         // V.1_67: "Phase 4: Value checkpoint" (a capital after a colon)
    return out;
  }).join(' ').replace(/^./, function (c) { return c.toUpperCase(); });
  return keepNames_(cased);
}

// Product and proper names that keep their capitals inside sentence-case titles
const PRODUCT_NAMES_ = {};
// V.1_39: Google Cloud customer-service products ("Vertex AI search" was lowercased in deck 15)
['Salesforce', 'ServiceNow', 'Workday', 'Zendesk', 'Shopify', 'Oracle', 'Microsoft', 'SharePoint', 'Slack', 'Jira', 'Vertex AI Search', 'Vertex AI Agent Builder', 'Customer Engagement Suite', 'Conversational Agents', 'Agent Assist', 'Contact Center AI',
 'Contact Center AI Platform', 'Contact Center as a Service', 'Dialogflow CX', 'Dialogflow', 'Speech-to-Text', 'Text-to-Speech',
 'Cloud Storage', 'Pub/Sub', 'Dataflow', 'Dataplex', 'Cloud Spanner', 'AlloyDB', 'Google Kubernetes Engine', 'Apigee',
 'Security Command Center', 'Sensitive Data Protection', 'Cloud Armor', 'VPC Service Controls', 'Identity and Access Management',
 'Cloud KMS', 'Chronicle', 'Mandiant'].forEach(function (n) { PRODUCT_NAMES_[n.toLowerCase()] = n; });
['Google Cloud Storage', 'Cloud Storage', 'Cloud Run', 'Cloud Functions', 'Compute Engine', 'Google Kubernetes Engine', 'Kubernetes',
 'Cloud Billing', 'Active Assist', 'Recommender', 'FinOps Foundation', 'FinOps Hub', 'Gordon Food Service', 'Vail Resorts', 'WellSky', 'Wayfair', 'AutoZone', 'Altria', 'AES', 'Equifax', 'Google Cloud Partner',
 'Gemini Enterprise', 'Gemini for Google Workspace', 'Google Workspace', 'Google Cloud', 'Google Cloud Platform', 'Vertex AI',
 'Admin Console', 'Agentspace', 'NotebookLM', 'Looker Studio', 'Cloud SQL', 'Microsoft 365', 'Google Analytics 4', 'Google Analytics',
 'Google Ads', 'Campaign Manager 360', 'Campaign Manager', 'Display & Video 360', 'Search Ads 360', 'Google Marketing Platform',
 'BigQuery', 'Looker', 'Google', 'Gemini', 'GA4', 'GA360', 'Fortune 100', 'Fortune 500', 'Fortune 1000',
 // V.1_54: Google Cloud and infrastructure names a technical Solution Deck uses
 'SQL Server', 'Compute Engine', 'Google Compute Engine', 'Cloud Run', 'Cloud Functions', 'Cloud Monitoring', 'Cloud Logging', 'Cloud Build', 'Artifact Registry',
 'Secret Manager', 'Cloud KMS', 'Memorystore', 'Bigtable', 'Firestore', 'Dataproc', 'Cloud Composer', 'Datastream', 'Dataform', 'Vertex AI Pipelines',
 'Model Registry', 'Cloud NAT', 'Cloud DNS', 'Cloud Interconnect', 'Cloud Load Balancing', 'Cloud VPN', 'Identity-Aware Proxy', 'Anthos', 'Terraform',
 'Ansible', 'Kubernetes', 'Cloud Scheduler', 'Cloud Tasks', 'Eventarc', 'Analytics Hub', 'Cloud Spanner', 'Cloud Storage', 'Vertex AI Search'].forEach(function (n) { PRODUCT_NAMES_[n.toLowerCase()] = n; });
// V.1_67 (deck 39: "Cluster and always on", "North america's", "Persistent disk"): SQL Server, Windows and place names
['Always On Availability Groups', 'Always On', 'Availability Groups', 'Windows Server Failover Clustering', 'Windows Server', 'Active Directory',
 'Persistent Disk', 'Hyperdisk', 'Local SSD', 'Cloud Witness', 'Cloud Interconnect', 'Partner Interconnect', 'Dedicated Interconnect',
 'North America', 'South America', 'Latin America', 'Europe', 'Asia', 'Asia Pacific', 'Middle East', 'Africa', 'India', 'United States'].forEach(function (n) { PRODUCT_NAMES_[n.toLowerCase()] = n; });
const PRODUCT_NAMES_RE_ = new RegExp('\\b(' + Object.keys(PRODUCT_NAMES_).sort(function (a, b) { return b.length - a.length; })
  .map(function (n) { return n.replace(/[/]/g, '\\/').replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi');

// V.1_39: names written with capitals in the request ("Apple", "Genius Bar", "Customer Engagement Suite") keep them in
// every title and heading of this run. Words the request also writes in lower case are ordinary words, not names.
var RUN_NAMES_ = {};
var RUN_NAMES_RE_ = null;
function setRunNames_(prompt, extra) {
  RUN_NAMES_ = {};
  const p = String(prompt || '');
  const lower = {};
  (p.match(/\b[a-z][a-z'’-]+\b/g) || []).forEach(function (w) { lower[w] = true; });
  const SMALL = /^(a|an|and|or|for|of|in|on|at|to|by|the|with|from|vs|via|as|is|are|our|your|their|we|it|i|this|that|these|those|create|make|build|write|propose|cover|include|keep|use|add|show|today|please)$/i;
  // runs of capitalised words (and acronyms) that do not start a sentence
  const re = /([^.!?\n]\s+)((?:[A-Z][A-Za-z0-9&]*(?:['’]s)?|[A-Z]{2,}[a-z]?)(?:\s+(?:[A-Z][A-Za-z0-9&]*|[A-Z]{2,}|of|and|for)(?=\s|[,.;:)!?]|$))*)/g;
  let m;
  while ((m = re.exec(p))) {
    let name = m[2].replace(/['’]s$/, '').replace(/\s+(of|and|for)$/, '').trim();
    const words = name.split(/\s+/);
    while (words.length && SMALL.test(words[0])) words.shift();
    name = words.join(' ');
    if (!name || name.length < 3 || /^[A-Z]{2,5}$/.test(name)) continue;          // acronyms keep their capitals anyway
    if (words.length === 1 && lower[name.toLowerCase()]) continue;               // "Customers" at a line start, "Scale" ...
    // V.1_63 (deck 35: "Enterprise data and Analytics proposal"): ordinary business words written with capitals in the
    // request ("Data and Analytics", "Analytics") are not names
    if (words.every(function (w) { return /^(of|and|for|&)$/i.test(w) || COMMON_HEAD_WORDS_.test(w.toLowerCase()) || /^(enterprise|analytics|intelligence|engineering|platform|cloud|digital|modernization|modernisation)$/i.test(w); })) continue;
    RUN_NAMES_[name.toLowerCase()] = name;
  }
  (extra || []).forEach(function (n) { if (n && String(n).length >= 2) RUN_NAMES_[String(n).toLowerCase()] = String(n); });
  const keys = Object.keys(RUN_NAMES_).filter(function (k) { return !PRODUCT_NAMES_[k]; });
  RUN_NAMES_RE_ = keys.length ? new RegExp('\\b(' + keys.sort(function (a, b) { return b.length - a.length; })
    .map(function (n) { return n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi') : null;
}
// V.1_58 (deck 31: "Datasets in project darwin", "Activate darwin profiles"): names the research brought in (written with
// capitals in the slides' notes: "Project Darwin", "Ultamate Rewards") keep their capitals on the slides too
const NAME_STOP_ = /^(phase|month|week|day|step|stage|tier|layer|level|gate|wave|sprint|quarter|year|the|a|an|our|we|this|that|these|those|in|on|at|for|with|and|or|of|by|from|to|it|its|their|they|our|your|you|i|he|she|as|if|when|while|after|before|during|then|each|every|all|both|over|under|across|through|into|per|via|first|second|third|next|finally|today|now|here|there|walk|start|notice|note|see|let|across)$/i;
function namesFromNotes_(slides) {
  const notes = (slides || []).map(function (sp) { return String((sp && sp.notes) || '').replace(/\n\s*Sources?:[\s\S]*$/i, ''); }).join(' \n ');
  const out = {}, single = {}, lowerSeen = {};
  (notes.match(/\b[a-z][a-z]+\b/g) || []).forEach(function (w) { lowerSeen[w] = true; });
  notes.split(/(?<=[.!?:])\s+|\n/).forEach(function (sent) {
    const words = sent.trim().split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const clean = function (w) { return String(w || '').replace(/['’]s$/, '').replace(/[^A-Za-z0-9&/-]/g, ''); };
      let w = clean(words[i]);
      if (!/^[A-Z][a-z]+$/.test(w) || NAME_STOP_.test(w) || COMMON_HEAD_WORDS_.test(w.toLowerCase())) continue;
      if (/^\d/.test(clean(words[i + 1]))) continue;                       // "Phase 1", "Tier 2"
      const run = [w];
      let j = i + 1;
      while (j < words.length && /^[A-Z][A-Za-z]+$/.test(clean(words[j])) && !NAME_STOP_.test(clean(words[j]))) { run.push(clean(words[j])); j++; }
      // a capitalised word right before ("Project Darwin", "BigQuery Darwin")
      const prev = clean(words[i - 1]);
      if (/^[A-Z][a-z]+$/.test(prev) && i - 1 > 0 && !NAME_STOP_.test(prev)) run.unshift(prev);
      if (run.length >= 2 && run.length <= 4) out[run.join(' ')] = true;
      if (run.length === 1 || /^(Project|Program|Programme)$/.test(run[0])) single[w] = (single[w] || 0) + 1;
      i = j - 1;
    }
  });
  Object.keys(single).forEach(function (w) { if (single[w] >= 2 && !lowerSeen[w.toLowerCase()]) out[w] = true; });
  return Object.keys(out).filter(function (n) { return !PRODUCT_NAMES_[n.toLowerCase()]; });
}
function addRunNames_(names) {
  (names || []).forEach(function (n) { if (n && n.length >= 3) RUN_NAMES_[String(n).toLowerCase()] = String(n); });
  const keys = Object.keys(RUN_NAMES_).filter(function (k) { return !PRODUCT_NAMES_[k]; });
  RUN_NAMES_RE_ = keys.length ? new RegExp('\\b(' + keys.sort(function (a, b) { return b.length - a.length; })
    .map(function (n) { return n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi') : null;
}
function keepNames_(str) {
  let out = String(str || '').replace(PRODUCT_NAMES_RE_, function (m) { return PRODUCT_NAMES_[m.toLowerCase().replace(/\s+/g, ' ')] || m; });
  if (RUN_NAMES_RE_) out = out.replace(RUN_NAMES_RE_, function (m) { return RUN_NAMES_[m.toLowerCase().replace(/\s+/g, ' ')] || m; });
  return out;
}
// Ordinary heading words that are never names: lower case inside a heading even when the rest looks like sentence case
const COMMON_HEAD_WORDS_ = /^(state|future|current|approach|plan|strategy|leadership|prowess|track|record|delivery|value|impact|benefits?|challenges?|solutions?|results?|outcomes?|phase|process|team|data|security|model|service|support|experience|success|goals?|next|steps?|risks?|business|technical|proven|transformation|management|operations|performance|readiness|quality|integration|adoption|governance|costs?|growth|view|overview|roadmap|journey|capabilities|expertise|partner|partnership|framework|architecture|platform|insights?|efficiency|productivity|satisfaction|resolution|time|rate|scope|timeline|milestones?|deliverables?|objectives?|requirements?|recommendations?|decisions?|considerations?|summary|agents?|supervisors?|customers?|employees?|teams?|roles?|people|knowledge|search|analytics|automation|assistance|engagement|interactions?|channels?|stores?|retail|online|lead|leads|architect|architects|engineer|engineers|manager|managers|analyst|analysts|owner|owners|sponsor|sponsors|director|directors|consultant|consultants|specialist|specialists|developer|developers|designer|designers|scientist|scientists|officer|coordinator|administrator|advisor|executive|executives|head|champion|champions|member|members)$/;
function lowerCommonWords_(str) {
  const words = String(str || '').split(/(\s+)/);
  let start = true;
  return words.map(function (w) {
    if (/^\s+$/.test(w) || !w) return w;
    const wasStart = start;
    start = /[.!?:]["')\]]?$/.test(w);                                  // the next word starts a sentence (or follows a colon)
    if (wasStart) return w;                                            // a sentence's first word keeps its capital
    return w.split('-').map(function (part) {
      const bare = part.replace(/[^A-Za-z]/g, '');
      return /^[A-Z][a-z]+$/.test(bare) && COMMON_HEAD_WORDS_.test(bare.toLowerCase()) ? part.replace(bare, bare.toLowerCase()) : part;
    }).join('-');
  }).join('');
}

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
// V.1_70: dark content slides (question 2, option A): up to 3 per deck, never next to another dark slide or a dark divider
const DARK_CONTENT_MAX_ = 3;
function darkContentAllowed_(prevDark, nextDark, darkUsed, darkMax) {
  return !prevDark && !nextDark && darkUsed < Math.min(darkMax == null ? DARK_CONTENT_MAX_ : darkMax, DARK_CONTENT_MAX_);
}
function chooseDesignsByContent_(plan, ctx) {
  if (typeof applyProposalFrame_ === 'function') applyProposalFrame_(plan.slides, ctx);   // proposal designs only in a Proposal Deck
  if (typeof ENGINE === 'undefined' || !ENGINE.variantsFor) return 0;
  let swaps = 0;
  // Long decks are built in batches: the variety state carries over from batch to batch (ctx.chooserState)
  const st = ctx.chooserState || { used: {}, looksUsed: {}, prevTag: null, prevLook: null, prevDark: false, darkUsed: 0 };
  const used = st.used, looksUsed = st.looksUsed;
  let prevTag = st.prevTag, prevLook = st.prevLook;
  const history = st.history || loadDesignUsage_();                    // designs and looks used in earlier decks (all users)
  let prevDark = st.prevDark, darkUsed = st.darkUsed;
  const deckSize = ctx.deckSize || plan.slides.length;
  // V.1_70: dark content slides - at most 3 in a deck, never two dark slides in a row (a dark divider counts)
  const darkMax = Math.min(DARK_CONTENT_MAX_, deckSize >= 30 ? Math.round(deckSize / 8) : deckSize >= 8 ? 2 : 1);
  const FRAME = { cover: 1, agenda: 1, closing: 1 };
  const lookKey = function (type, tag, m) { return FRAME[type] ? type + ':' + tag : (m && m.look) || tag; };
  const trialOf = function (sp, tag) { return Object.assign({}, sp, { reference: Object.assign({}, sp.reference || {}, { tag: tag }) }); };
  const wanted = {};                                                   // designs Gemini chose, slide by slide
  plan.slides.forEach(function (sp) { if (sp && sp.design) wanted[String(sp.design).trim()] = true; });
  const lastAt = st.lastAt || (st.lastAt = {});                       // V.1_63: where each design was last placed
  let at = st.at || 0;
  plan.slides.forEach(function (sp, idx) {
    at++;
    let type = normalizeType_(sp.type);
    const nextSp = plan.slides[idx + 1];
    // V.1_70: the divider after this slide is dark; V.1_72 (deck 43 Solution 9 / Proposal 8): also when that divider is the
    // first slide of the next part of a long deck
    const nextDark = nextSp ? normalizeType_(nextSp.type) === 'section' : !!ctx.nextPartStartsDark;
    if (type === 'template' || String(sp.type || '').toLowerCase() === 'template') { if (sp.tag) used[sp.tag] = 1; return; }
    // V.1_42b: a Proposal Deck slide no proposal design can draw is reshaped into one that can (never the plain layout)
    if (typeof proposalCycle_ === 'function' && proposalCycle_(sp, used)) type = normalizeType_(sp.type);    // V.1_50: a loop is a cycle
    ctx.designAt = { lastAt: lastAt, at: at };                          // V.1_63: where designs were last placed (reshaping)
    if (typeof proposalCoerce_ === 'function' && proposalCoerce_(sp, ctx, used)) type = normalizeType_(sp.type);
    // V.1_42: frame slides of a Proposal Deck (agenda, section dividers) keep the design the deck structure gave them
    if (sp.lockTag) {
      sp.reference = referenceForTag_(ctx.lib, sp.lockTag);
      prevTag = sp.lockTag; prevLook = type + ':' + sp.lockTag; prevDark = type === 'section';   // V.1_70: a divider is dark
      return;
    }
    const designs = drawableDesigns_(type, itemCount_(sp), sp);
    let current = sp.reference && sp.reference.tag;
    // the only proposal design of a type (case study, next steps...) is used whenever it can show the content
    if (designs.length === 1 && current !== designs[0].tag && isLibSpec_(sp) &&
        (!ENGINE.canDraw || ENGINE.canDraw(trialOf(sp, designs[0].tag)))) {
      sp.reference = referenceForTag_(ctx.lib, designs[0].tag);
      current = designs[0].tag;
      swaps++;
    }
    if (designs.length < 2) {
      let m0 = null;
      try { m0 = ENGINE.measure(sp, { tokens: ctx.tokens || null }); } catch (e) {}
      prevTag = current;
      prevLook = lookKey(type, current, m0);
      if (current) { used[current] = (used[current] || 0) + 1; lastAt[current] = at; }
      if (prevLook) looksUsed[prevLook] = (looksUsed[prevLook] || 0) + 1;
      // V.1_73 (deck 44 Proposal 16: the one design that fits cards with points is dark, beside a dark divider): when the
      // dark rule does not allow a dark slide here, the points are written as text so a light design can show them
      if (m0 && m0.dark && type !== 'section' && !darkContentAllowed_(prevDark, nextDark, darkUsed, darkMax) && Array.isArray(sp.items)) {
        const flat = Object.assign({}, sp, { items: sp.items.map(function (it) { return it && typeof it === 'object' && Array.isArray(it.points) ? Object.assign({}, it, { text: [it.text].concat(it.points.map(function (p) { return typeof p === 'string' ? p : (p && (p.text || p.title)) || ''; })).filter(Boolean).map(function (x) { x = String(x).trim(); return /[.!?]$/.test(x) ? x : x + '.'; }).join(' '), points: undefined }) : it; }) });
        const light = drawableDesigns_(type, itemCount_(flat), flat).filter(function (d) {
          if (ENGINE.canDraw && !ENGINE.canDraw(trialOf(flat, d.tag))) return false;
          let mm = null; try { mm = ENGINE.measure(trialOf(flat, d.tag), { tokens: ctx.tokens || null }); } catch (e) {}
          return mm && !mm.dark && mm.content > 0 && !mm.overflow.length;
        })[0];
        if (light) {
          flat.items.forEach(function (it) { if (it && typeof it === 'object') delete it.points; });
          Object.assign(sp, flat); sp.reference = referenceForTag_(ctx.lib, light.tag); delete sp.design;
          m0 = { dark: false }; prevTag = light.tag; swaps++;
        }
      }
      prevDark = type === 'section' || !!(m0 && m0.dark);                     // V.1_70: a divider is dark (not counted)
      if (prevDark && type !== 'section') darkUsed++;
      return;
    }
    const drawable = designs.filter(function (d) { return !ENGINE.canDraw || ENGINE.canDraw(trialOf(sp, d.tag)); });
    let pool = drawable.length ? drawable : designs;
    // V.1_47: in a Proposal Deck a design is shown once in the whole deck (also across the parts of a long deck):
    // a design already used is only a candidate when no other proposal design can draw the slide
    if (isLibSpec_(sp)) {
      const fresh = pool.filter(function (d) { return !used[d.tag] && (!ENGINE.canDraw || ENGINE.canDraw(trialOf(sp, d.tag))); });
      if (fresh.length) pool = fresh;
    }
    // Every design that can show this content is measured once
    const cands = pool.map(function (d) {
      let m = null;
      try { m = ENGINE.measure(trialOf(sp, d.tag), { tokens: ctx.tokens || null }); } catch (e) {}
      m = m || { content: 0, overflow: [{}], fill: 0, dark: false, look: d.tag };
      // V.1_42: in a Proposal Deck the content was written for Gemini's design: when it shows it without overflow, short
      // texts are filled by the fit step afterwards, so it counts as a good fit
      const picked = isLibSpec_(sp) && sp.design && String(sp.design).trim() === d.tag;
      const fitsWell = m.content > 0 && !m.overflow.length && (m.fill >= 0.5 || picked);
      return { d: d, m: m, fitsWell: fitsWell, look: lookKey(type, d.tag, m) };
    });
    let best = null;
    // V.1_73: the dark rule is a rule - a dark design is not a candidate where a dark slide is not allowed (when a light
    // design can show the content at all)
    const darkOk = darkContentAllowed_(prevDark, nextDark, darkUsed, darkMax);
    const lightCands = cands.filter(function (c) { return !c.m.dark && c.m.content > 0; });
    const pickFrom = !darkOk && lightCands.length ? lightCands : cands;
    pickFrom.forEach(function (c) {
      const d = c.d, m = c.m;
      // 1. Fit is a gate, not a ranking: every design that shows the content well competes on equal terms
      let score = 0;
      if (m.content === 0) score -= 1000;                             // would show nothing under the title
      if (!c.fitsWell) score -= 150 + 35 * m.overflow.length + 80 * Math.max(0, 0.5 - m.fill);
      // a design that leaves the lower part of the slide empty for this content loses to one that fills it
      if (m.coverage != null && m.coverage < 0.7 && ['cover', 'agenda', 'closing', 'section', 'statement', 'quote'].indexOf(type) === -1) score -= 160 * (0.7 - m.coverage);
      if (d.needs) score += 30;                                       // made for this slide's special content (risks, prices...)
      // Gemini's choice: a light preference, stronger in a Proposal Deck (the content is written in that design's fields)
      if (sp.design && String(sp.design).trim() === d.tag) score += isLibSpec_(sp) ? (c.fitsWell ? 200 : 45) : 8;
      // 2. Variety inside the deck: a design once, a look (family of similar designs) once, never twice in a row
      // (a design already used in this deck loses more than a design that needs its text rewritten: the fit step
      //  shortens or fills the text afterwards, so variety wins whenever another design can show the content)
      score -= 360 * (used[d.tag] || 0);
      // V.1_42b: a design Gemini chose for another slide of the deck is left for that slide
      if (isLibSpec_(sp) && wanted[d.tag] && String(sp.design || '').trim() !== d.tag) score -= 100;                              // V.1_35: a design twice in one deck is a last resort
      // (Gemini's own proposal design that fits keeps its place: look families only separate the other candidates)
      const geminiPick = isLibSpec_(sp) && c.fitsWell && sp.design && String(sp.design).trim() === d.tag;
      if (!geminiPick) score -= 70 * (looksUsed[c.look] || 0);
      if (d.tag === prevTag) score -= 60;
      // V.1_63 (deck 35: the same four blue-header cards on slides 19, 37, 40 and 49): a design used again in a long deck
      // stays at least 8 slides away from its last place; designs that show icons are preferred for parallel items
      if (lastAt[d.tag] && at - lastAt[d.tag] < 8) score -= 140;
      if (lastAt[d.tag] && at - lastAt[d.tag] <= 2) score -= 300;      // V.1_73: never two slides later (fewer designs now dark is limited)
      if (m.icons > 0 && ['cards', 'process', 'diagram'].indexOf(type) !== -1) score += 30;
      if (c.look === prevLook && !geminiPick) score -= 50;
      // 3. Variety between decks (every user): designs and looks used in the last decks lose, unused ones win
      score += recencyScore_(history, d.tag);
      score += lookRecencyScore_(history, c.look);
      // 4. Rhythm: at most 2 dark / photo slides, never back to back, never pushed forward on purpose
      if (m.dark && !darkContentAllowed_(prevDark, nextDark, darkUsed, darkMax)) score -= 400;   // V.1_70: a rule, not a preference (was -120)
      // 5. Shuffle: the same request never gives the same deck twice
      score += Math.random() * 35;
      if (!best || score > best.score) best = { tag: d.tag, score: score, c: c };
    });
    // (V.1_42b: a Proposal Deck slide that only a design already used can draw keeps that proposal design: the
    //  reshaping above has tried every other proposal design first, and a plain layout would leave the library)
    if (best && best.tag !== current) {
      sp.reference = referenceForTag_(ctx.lib, best.tag);
      swaps++;
    }
    prevTag = sp.reference ? sp.reference.tag : null;
    if (prevTag) lastAt[prevTag] = at;
    prevLook = best ? best.c.look : prevTag;
    if (prevTag) used[prevTag] = (used[prevTag] || 0) + 1;
    if (prevLook) looksUsed[prevLook] = (looksUsed[prevLook] || 0) + 1;
    prevDark = !!(best && best.c.m.dark);
    if (prevDark) darkUsed++;
  });
  st.prevTag = prevTag; st.prevLook = prevLook; st.prevDark = prevDark; st.darkUsed = darkUsed; st.at = at;
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
  'transformative': 'meaningful',
  // V.1_47
  'revolutionizing': 'improving', 'revolutionising': 'improving', 'revolutionize': 'improve', 'revolutionise': 'improve',
  'revolutionized': 'improved', 'revolutionised': 'improved', 'game-changer': 'major step forward', 'game changer': 'major step forward',
  'game-changers': 'major steps forward', 'game changers': 'major steps forward', 'disruptive': 'new', 'next-generation': 'modern'
};
const HYPE_RE_ = new RegExp('\\b(' + Object.keys(HYPE_WORDS_).sort(function (a, b) { return b.length - a.length; })
  .map(function (w) { return w.replace(/-/g, '\\-').replace(/ /g, '[\\s-]'); }).join('|') + ')\\b', 'gi');
// One text without hype words ("Revolutionizing demand forecasting" -> "Improving demand forecasting")
function removeHypeText_(str) {
  return String(str == null ? '' : str).replace(HYPE_RE_, function (m) {
    const r = HYPE_WORDS_[m.toLowerCase()] || HYPE_WORDS_[m.toLowerCase().replace(/[\s-]/g, '-')] || HYPE_WORDS_[m.toLowerCase().replace(/[\s-]/g, ' ')] || m;
    // "a game-changer" -> "a major step forward"; "AI is a game-changer for ..." keeps its grammar
    return m.charAt(0) === m.charAt(0).toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  });
}
function removeHypeWords_(obj) {
  const fix = removeHypeText_;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'notes' || k === 'design' || k === 'type') return;
      if (typeof o[k] === 'string') o[k] = fix(o[k]); else walk(o[k]);
    });
  })(obj);
}

// Box headings (card titles, labels, column headers) also in sentence case
// V.1_47: a heading written in capitals ("DEFINE", "VALUE CHECKPOINT") is written in sentence case; acronyms keep theirs
// (acronyms that stay in capitals)
function capsKeep_() { return /^(AI|ML|ROI|KPIS?|CIO|CFO|CEO|CTO|COO|IT|API|APIS|GCP|AWS|SAP|LLMS?|MLOPS|LLMOPS|GENAI|CSAT|NPS|SAAS|B2B|B2C|US|UK|EU|GDPR|CCPA|HIPAA|SOC|ERP|CRM|ETL|ELT|SQL|BI|UX|UI|HR|FP&A|RAG|RAID|RACI|SLA|SLAS|POC|MVP|Q[1-4]|L[0-9])$/; }
function capsToSentence_(str) {
  const s0 = String(str || '');
  const CAPS_KEEP_ = capsKeep_();
  const letters = s0.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4 || s0 !== s0.toUpperCase()) return s0;
  const words = s0.split(/(\s+|\/|-)/);
  const hasWord = words.some(function (w) { const b = w.replace(/[^A-Za-z&]/g, ''); return b.length >= 4 && !CAPS_KEEP_.test(b); });
  if (!hasWord) return s0;                                              // "AI / ML", "KPI" stay as they are
  let first = true;
  return words.map(function (w) {
    const b = w.replace(/[^A-Za-z&]/g, '');
    if (!b) return w;
    let out;
    if (CAPS_KEEP_.test(b) || (b.length <= 3 && !/^(AND|OR|FOR|OF|IN|ON|AT|TO|BY|THE|A|AN|VS|VIA|AS|IS|ARE|OUR|NEW|KEY|WE)$/.test(b))) out = w;
    else out = w.toLowerCase();
    if (first) { out = out.charAt(0).toUpperCase() + out.slice(1); first = false; }
    return out;
  }).join('');
}
function headingCase_(t) {
  const str = typeof capsToSentence_ === 'function' ? capsToSentence_(String(t || '').trim()) : String(t || '').trim();
  const words = str.split(/\s+/);
  if (words.length < 2) return keepNames_(str.replace(/\.$/, ''));
  // V.1_39: small words and acronyms do not count ("Future State with AI" is Title Case, not sentence case)
  const SMALLW = /^(a|an|and|or|for|of|in|on|at|to|by|the|with|from|vs|via|as|is|are|your|our)$/i;
  const parts = str.split(/[\s-]+/).slice(1).filter(function (w) { const b = w.replace(/[^A-Za-z]/g, ''); return b && !SMALLW.test(b) && !/^[A-Z]{2,}s?$/.test(b); });
  const caps = parts.filter(function (w) { return /^[A-Z][a-z]/.test(w.replace(/^[^A-Za-z]+/, '')); }).length;
  // V.1_42b: a heading is sentence case whatever its length ("Continuous Optimization" -> "Continuous optimization");
  // names keep their capitals through keepNames_ (Google products, the client, names written with capitals in the request)
  if (!parts.length || caps === 0) return keepNames_(lowerCommonWords_(str.replace(/\.$/, '')));   // already sentence case
  const keep = /^(AI|ML|ROI|KPIs?|CIO|CFO|CEO|CTO|IT|API|GCP|AWS|SAP|LLMs?|MLOps|LLMOps|GenAI|CSAT|NPS|SaaS|B2B|US|UK|EU|GDPR|CCPA|Q[1-4]|66degrees)$/;
  const out = words.map(function (w, i) {
    return w.split('-').map(function (part, j) {
      if (i === 0 && j === 0) return part;                                 // the first word keeps its capital
      // "Engineers/IT" -> "engineers/IT": each side of a slash is checked on its own
      return part.split('/').map(function (piece, q) {
        if (i === 0 && j === 0 && q === 0) return piece;
        const bare = piece.replace(/['’]s$/i, '').replace(/[^A-Za-z0-9]/g, '');
        if (keep.test(bare) || /^[A-Z]{2,}/.test(bare) || /\d/.test(bare) || /[a-z][A-Z]/.test(bare)) return piece;   // DevOps, FinOps, BigQuery
        return /^[^a-z]*[A-Z][a-z]/.test(piece) ? piece.toLowerCase() : piece;
      }).join('/');
    }).join('-');
  }).join(' ');
  return keepNames_(out).replace(/\.$/, '');
}

function sentenceCaseHeadings_(sp) {
  const fix = function (o, k) {
    if (!o || typeof o[k] !== 'string') return;
    // The design numbers the items itself: "1. Agents…", "2) Build…", "Step 3: Scale…" lose the typed number
    const t = o[k].replace(/^\s*(?:step\s+)?\d{1,2}\s*[.):\-–]\s+/i, '');
    o[k] = headingCase_(t.charAt(0).toUpperCase() + t.slice(1)).replace(/([^.])\.$/, '$1');   // headings never end with a full stop
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
  if ((t === 'cover' || t === 'closing') && sp.subtitle) sp.subtitle = headingCase_(sentenceCase_(sp.subtitle, 2));   // V.1_50: short subtitles too
  if (Array.isArray(sp.columns)) sp.columns = sp.columns.map(function (c) {
    // V.1_42b: column objects of a proposal design (architecture flow) keep their items; only their label is cased
    if (c && typeof c === 'object' && t !== 'table') {
      fix(c, 'label'); fix(c, 'title');
      // V.1_48: the boxes of an architecture column too ("Operational Data" -> "Operational data")
      if (Array.isArray(c.items)) c.items = c.items.map(function (it) { if (it && typeof it === 'object') { fix(it, 'title'); return it; } return typeof it === 'string' ? headingCase_(it) : it; });
      return c;
    }
    if (c && typeof c === 'object') { const v = c.title || c.label || c.name || c.header || ''; return headingCase_(String(v)); }
    return typeof c === 'string' ? headingCase_(c) : c;
  });
  // proposal design fields: groups, stats, teams and their roles, org chart, flow nodes, workstreams, legend
  (sp.groups || []).forEach(function (g) { if (g && typeof g === 'object') { fix(g, 'label'); fix(g, 'title'); } });
  (sp.stats || []).forEach(function (x) { if (x && typeof x === 'object') fix(x, 'label'); });
  (sp.teams || []).forEach(function (tm) {
    if (!tm || typeof tm !== 'object') return;
    fix(tm, 'name');
    ['roles', 'stakeholders', 'specialists', 'members'].forEach(function (k) { (tm[k] || []).forEach(function (r) { if (r && typeof r === 'object') { fix(r, 'title'); fix(r, 'role'); } }); });
  });
  (function org(o) { if (!o || typeof o !== 'object') return; fix(o, 'name'); fix(o, 'role'); (o.reports || []).forEach(org); })(sp.org);
  (sp.nodes || []).forEach(function (nd) { if (nd && typeof nd === 'object') fix(nd, 'label'); });
  if (Array.isArray(sp.links)) sp.links = sp.links.map(function (l) { if (l && typeof l === 'object') { fix(l, 'label'); return l; } return typeof l === 'string' ? headingCase_(l) : l; });   // V.1_48: arrow labels
  (sp.workstreams || []).forEach(function (w) { if (w && typeof w === 'object') fix(w, 'name'); });
  (sp.legend || []).forEach(function (l) { if (l && typeof l === 'object') fix(l, 'label'); });
  if (sp.governance && typeof sp.governance === 'object') fix(sp.governance, 'title');        // V.1_50: "Joint steering committee"
  ['banner', 'heading'].forEach(function (k) { if (typeof sp[k] === 'string') fix(sp, k); });
  // a lead that starts with a Title Case label ("Beyond Implementation: we focus...") gets the label in sentence case
  if (typeof sp.lead === 'string') sp.lead = sp.lead.replace(/^([^:]{3,40}):\s+(.)/, function (m, lab, c) { return headingCase_(lab) + ': ' + c.toLowerCase(); });
  if (Array.isArray(sp.options)) sp.options = sp.options.map(function (o) { return typeof o === 'string' ? headingCase_(o) : o; });
  (sp.items || []).forEach(function (it) { if (it && typeof it === 'object') { fix(it, 'title'); fix(it, 'label'); } });
  (sp.points || []).forEach(function (p) { if (p && typeof p === 'object') fix(p, 'title'); });
  ['left', 'right'].forEach(function (k) { if (sp[k]) { fix(sp[k], 'label'); fix(sp[k], 'title'); } });
  if (sp.insight) fix(sp.insight, 'title');
  if (sp.callout) { fix(sp.callout, 'title'); fix(sp.callout, 'label'); }
  (sp.results || []).forEach(function (r) { if (r && typeof r === 'object') fix(r, 'label'); });
  if (sp.center) sp.center = sentenceCase_(String(sp.center), 1);
  if (['diagram', 'architecture', 'flowchart', 'cycle'].indexOf(t) !== -1 && !sp.center && Array.isArray(sp.items)) sp.center = centerLabel_(sp.title);
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
      noteDrop_(sp, sp.items.filter(function (it) { return ok.indexOf(it) === -1; }));
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
  // V.1_39: a KPI / targets slide keeps a short target range ("20-30%") as a target, never "30%" alone
  const kpiSlide = /\b(kpis?|key performance|targets?|success|measur\w*|metrics?|goals?|outcomes?)\b/i.test(String(sp.title || ''));
  const fix = function (o) {
    if (!o || typeof o.value !== 'string') return;
    o.value = o.value.replace(/\s*[.,;:]+\s*$/, '').trim();          // "20-30%." -> "20-30%" (V.1_39)
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
    if (r && kpiSlide && o.value.length <= 9) {
      const lb = String(o.label || '').trim();
      if (!/^target/i.test(lb)) o.label = 'Target: ' + (/^[A-Z][a-z]/.test(lb) ? lb.charAt(0).toLowerCase() + lb.slice(1) : lb);
      return;
    }
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
const KPI_TITLE_RE_ = /\b(kpis?|key performance|metrics?|measur\w* (success|impact|value)|success measures?|targets?|scorecard)\b/i;
// V.1_57 (deck 30: "Week 1" shown as a KPI next to "-25%"): a point in time is not a figure
const TIME_VALUE_RE_ = /^\s*(week|wk|day|month|quarter|sprint|phase|wave|stage|year|fy|h|q)\s*-?\s*\d{1,4}\s*$|^\s*q[1-4](\s*\d{2,4})?\s*$|^\s*(19|20)\d{2}\s*$/i;
function isFigureValue_(v) { const t = String(v == null ? '' : v); return /\d/.test(t) && !TIME_VALUE_RE_.test(t); }
// A KPI row (items / stats / kpis with values) loses its "Week 1" tiles when two real figures are left
// V.1_58 (deck 31: "15 mo · Study operational tracking window"): a study's time window or sample is context, not a KPI
const STUDY_META_RE_ = /\b(study|tracking|observation|analysis|sample|survey|research)\s+(window|period|size|length|duration|span)\b|\b(tracked|observed|studied)\s+(over|for|across)\b|\bwindow\b/i;
function dropTimeValues_(sp) {
  ['items', 'stats', 'kpis', 'metrics'].forEach(function (k) {
    const list = sp[k];
    if (!Array.isArray(list)) return;
    // V.1_58: a target that is an industry benchmark says so once ("Target: ... (industry benchmark)" contradicts itself)
    list.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      ['label', 'title'].forEach(function (f) {
        if (typeof it[f] === 'string' && /^\s*target:\s*/i.test(it[f]) && /\(industry (benchmark|figure|study)\)/i.test(it[f])) it[f] = it[f].replace(/^\s*target:\s*/i, 'Industry benchmark: ').replace(/\s*\(industry (benchmark|figure|study)\)/i, '');
      });
    });
    const figs = list.filter(function (it) { return it && typeof it === 'object' && it.value != null && /\d/.test(String(it.value)); });
    if (figs.length >= 3) {
      const meta = figs.filter(function (it) { return STUDY_META_RE_.test(String(it.label || it.title || '')); });
      if (meta.length && figs.length - meta.length >= 2) { noteDrop_(sp, meta); sp[k] = sp[k].filter(function (it) { return meta.indexOf(it) === -1; }); }
    }
    // a KPI without a figure next to KPIs with figures is left out ("Target: session basket size" with no number)
    const cur = sp[k];
    const noFig = cur.filter(function (it) { return it && typeof it === 'object' && 'value' in it && !String(it.value || '').trim() && /^\s*target\b/i.test(String(it.label || it.title || '')); });
    if (noFig.length && cur.length - noFig.length >= 2 && figs.length >= 2) { noteDrop_(sp, noFig); sp[k] = cur.filter(function (it) { return noFig.indexOf(it) === -1; }); }
    const list2 = sp[k];
    const withValue = list2.filter(function (it) { return it && typeof it === 'object' && it.value != null && String(it.value).trim(); });
    if (withValue.length < 2) return;
    const timeOnes = withValue.filter(function (it) { return TIME_VALUE_RE_.test(String(it.value)); });
    if (!timeOnes.length) return;
    if (withValue.length - timeOnes.length >= 2) {
      noteDrop_(sp, timeOnes);
      sp[k] = list2.filter(function (it) { return timeOnes.indexOf(it) === -1; });
      try { Logger.log('V.1_57: "' + timeOnes.map(function (it) { return it.value; }).join('", "') + '" is a point in time, not a figure; left out of "' + String(sp.title || '') + '".'); } catch (e) {}
    }
  });
}
function statsNeedNumbers_(sp) {
  if (String(sp.type || '').toLowerCase() !== 'stats' || !Array.isArray(sp.items)) return sp;
  const numeric = sp.items.filter(function (it) { return it && isFigureValue_(it.value); });
  if (numeric.length >= 2) { noteDrop_(sp, sp.items.filter(function (it) { return numeric.indexOf(it) === -1; })); sp.items = numeric; return sp; }
  // V.1_47: a KPI slide with no figure left stays a KPI slide: the empty-slide check writes target KPIs for it
  if (!numeric.length && !sp.items.some(function (it) { return it && (it.label || it.text); })) { sp.items = []; return sp; }
  // V.1_48: a KPI slide keeps its KPIs: those without a number get a target from the empty-slide check (never turned into cards)
  if (KPI_TITLE_RE_.test(String(sp.title || '')) && sp.items.filter(function (it) { return it && (it.label || it.title); }).length >= 2) return sp;
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
  if (Array.isArray(sp.groups) && sp.groups.length) return sp;     // V.1_42: grouped lists (proposal key inputs) are the content
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
    notes: sp.notes, fact_tags: sp.fact_tags || [], reference: null, section: sp.section };
}

// A roadmap / phased plan slide (quarters, phases, months, waves)
function roadmapLike_(sp) {
  const t = String((sp && sp.type) || '').toLowerCase();
  if (['timeline', 'process', 'next_steps'].indexOf(t) === -1 && !/roadmap|phase|quarter|journey|momentum|quick wins?/i.test(String(sp.title || ''))) return false;
  const txt = JSON.stringify([sp.title, sp.periods, (sp.items || []).map(function (i) { return i && [i.date, i.label, i.title, i.timing]; })]).toLowerCase();
  return /\b(quarters?|q[1-4]|phases?|months?|weeks?|years?|waves?|sprints?|days? \d|\d+ days?|roadmap|quick wins?|early value)\b/.test(txt);
}

// A filler summary slide that only restates the deck
const FILLER_TITLE_RE_ = /\b(the future of .{2,40} is (now|here)|in summary|summary|conclusions?|key takeaways?|wrap[- ]?up|final thoughts|looking ahead|the road ahead|the path forward|bringing it all together|future growth|sustained innovation|continued innovation|what'?s next|innovation and growth)\b/i;   // V.1_51: deck 23 slide 29
function fillerSlide_(sp, isLastBody) {
  const t = String((sp && sp.type) || '').toLowerCase();
  if (['cover', 'agenda', 'closing', 'template', 'team', 'case_study', 'next_steps'].indexOf(t) !== -1) return false;
  return FILLER_TITLE_RE_.test(String(sp.title || '') + ' ' + String(sp.statement || '')) || (isLastBody && t === 'statement');
}

// Topic family of a slide: two body slides in the same family say the same thing in different words
const TOPIC_FAMILIES_ = [
  ['credentials', /(\b66degrees\b|\btrusted\b.{0,30}\b(partner|guide|advisor)\b|\bwhy (us|partner)\b|\bpartner (of choice|for)\b|\bour\b.{0,20}\b(expertise|experience|credentials|certifications|track record|strengths|pillars|team)\b|\b(technical|deep|proven) expertise\b|\bcredentials\b|\bwho we are\b|\btrack record\b|\bcertifications?\b|\bleading the way\b|\bpillars of our\b)/i],
  ['services', /\b(end-to-end|lifecycle|our (services|offerings|capabilities)|our\b.{0,40}\b(services|offerings|solutions|capabilities)|how we (help|support)|support across|comprehensive support|accelerators?|purpose-built tools|offerings?|engagement model)\b/i],
  ['whynow', /\b(why now|why it matters now|rising|expectations?|the state of|the future of .{2,40} is|market (shift|trends?)|trends?|is changing|landscape|imperative|breakpoint|converging|demand for|at a crossroads|critical juncture)\b/i],
  // V.1_50: slides that explain the Google Cloud products again (deck 22: five slides re-explained BigQuery, Vertex AI, Gemini)
  // V.1_51 (deck 23 slides 13-16): "BigQuery: unifying fleet data", "Google Cloud: the optimal platform choice" count too
  ['products', /^(?![\s\S]*\b(backbone|data platform|data foundation|single source of truth|data architecture|data ingestion)\b)[\s\S]*?(?:^\s*(google cloud|gcp|bigquery|vertex ai|gemini|looker|dataflow|cloud run|document ai)\b[^:\n]{0,12}:|\b(why|choosing|optimal|right) .{0,20}\b(google cloud|platform choice)\b|\b(google cloud|gcp|bigquery|vertex ai|gemini)\b.{0,60}\b(capabilit\w*|scalab\w*|performance|power|core|leverag\w*|services|intelligen\w*|advantages?|strengths?)\b|\b(capabilit\w*|leverag\w*|powered by|the power of|why)\b.{0,40}\b(google cloud|gcp|bigquery|vertex ai|gemini)\b)/i],
  ['value', /\b(benefits?|value of|business value|why (gemini|ai)|shift(ing)? from|from reactive|without .{2,30} with|before and after|old way|new way)\b/i],
  ['usecases', /\b(use cases?|applications? (of|for)|where .{2,30} (helps|delivers|adds value)|capabilities (across|for|in)|enhances .{2,40}(operations|service)|touchpoints|ways? .{2,20} helps?)\b/i],
  ['delivery', /\b(how we deliver|our\b.{0,25}\b(framework|approach|methodology|process|method)|structured (approach|process|methodology)|implementation (process|plan|framework|approach|journey|steps)|methodology|co-creation|agile delivery|delivery principles|ways? of working|how we work|our (working )?principles|implementing .{2,30}(framework|approach)|delivery (model|approach|methodology|framework)|phased (approach|implementation)|step-by-step|(holistic|comprehensive|proven) approach|approach to (ai|the|your|digital|cloud|data)\b.{0,30}|transformation approach)\b|^(?![^\n]*\b(governance|security|compliance|risks?|data|kpis?|measur\w*|evaluation|responsible)\b)[^\n]{0,50}\b(framework|methodology|delivery approach|implementation approach)\s*$/im],   // V.1_51: deck 23 slide 11
  // V.1_47: the team and its governance are one topic ("Expert team drives..." and "Project governance and oversight")
  ['team', /\b(team structure|project team|delivery team|our team|proposed team|team approach|team model|staffing|roles and responsibilities|who does what|(expert|dedicated|core|joint|combined|blended|engagement) teams?|teams? (drives?|of experts)|project governance|governance (model|structure|cadence|framework and team)|steering (committee|group)|oversight|operating rhythm)\b|(?<!\b(ai|data|model|responsible)\s)\bgovernance\b(?!\s(of|for)\s(ai|data|models?)\b)(?=[\s\S]{0,40}\b(project|team|oversight|collaborat\w*|cadence|roles?|engagement)\b)/i],
  ['platform', /\b(data platform|data foundation|data ecosystem|backbone|unified data|integrated .{0,25}platform|data architecture|data ingestion|data stack|single source of truth)\b/i],
  ['adoption', /\b(adoption|change management|upskilling|skills? gaps?|resistance to change|people, process|building trust)\b/i],
  ['considerations', /\b(considerations|critical success factors|success factors|key decisions|decisions? (to make|for your)|common (challenges|pitfalls)|challenges to (address|overcome)|keys to success|what it takes)\b/i],
  ['riskgov', /\b(risks?|mitigat\w*|ai governance|responsible ai|guardrails?|ethic(s|al)|trust(worthy)? ai|hallucinations?|explainab\w*|model reliability|transparen\w*)\b/i],
  // V.1_51 (deck 23 slides 6, 7, 9): the client's challenges / pain points / business case are one topic (two in a long deck)
  ['challenges', /\b(challenges?|pain points?|obstacles?|business case|bottlenecks?|friction|problems? (we|to|with)|what'?s holding|why change|burning platform|current (state|limitations?))\b/i],
  ['security', /\b(security|secure|securing|compliance|compliant|privacy|data protection|data governance|regulat\w*)\b/i],
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
  // V.1_52: a tone instruction ("technical tone", "tone: executive", "in an offering tone") says how to write, it is never a topic
  const p = String(prompt || '').replace(/(?:\b(?:in|with|use|using)\s+an?\s+)?\b[a-z-]+\s+tone\b|\btone\s*[:=-]\s*[a-z-]+/gi, '');
  // V.1_39: an explicit list ("Cover: ...", "Topics: ...", "Include: ...") wins over the first colon of the request
  // ("using Google Cloud: Customer Engagement Suite, ..." is a product list, not the topics)
  const marked = p.match(/(?:^|[.\n]\s*)(?:please\s+)?(?:cover|covering|topics?|include|including|sections?|agenda)\s*:\s*([^\n]+)/i);
  let tail;
  if (marked) tail = marked[1];
  else {
    const i = p.indexOf(':');
    tail = i !== -1 ? p.slice(i + 1) : (p.match(/\b(?:cover|covering|include|including|about)\b(.+)$/i) || [])[1] || '';
  }
  tail = tail.replace(/^[\s.,;:]+/, '').split(/\.\s+(?=[A-Z])|\n/)[0];   // the list ends with its sentence
  // V.1_56 (deck 29): "Condition-based maintenance for 1,200 rail switches on Google Cloud: sensor readings, ..." - the
  // subject before a colon is not a topic, and a thousands separator ("1,200") never splits a topic
  const inner = tail.match(/^[^:]{8,140}:\s*(.+)$/);
  if (inner && (inner[1].match(/,/g) || []).length >= 2) tail = inner[1];
  tail = tail.replace(/(\d),(\d{3})\b/g, '$1$2');
  // commas inside brackets belong to one topic: "a phased plan (discovery, pilot in one region, scale)"
  tail = tail.replace(/\(([^)]*)\)/g, function (m, inner) { return '(' + inner.replace(/,\s*/g, ' / ').replace(/\band\b/g, '&') + ')'; });
  // V.1_56: "a primary and DR region design" is one topic: a lone modifier before "and" joins the next part
  const MOD_ = /^(?:a |an |the )?(primary|secondary|public|private|internal|external|current|future|manual|automated|batch|streaming|real-time|on-premises|cloud|hot|warm|cold)$/i;
  const raw = tail.split(/,|;|\n/).reduce(function (acc, chunk) {
    const bits = chunk.split(/\band\b/i);
    for (let b = 0; b < bits.length; b++) {
      if (b + 1 < bits.length && MOD_.test(bits[b].trim())) { bits[b + 1] = bits[b].trim() + ' and' + bits[b + 1]; continue; }
      acc.push(bits[b]);
    }
    return acc;
  }, []);
  return raw.map(function (x) { return x.replace(/^\s*(a|an|the)\s+/i, '').replace(/[.]+$/, '').trim(); })
    .filter(function (x) { return x && x.replace(/\([^)]*\)/g, '').trim().split(/\s+/).length <= 8 && x.length >= 3; }).slice(0, 14);
}
// V.1_39: the parts a requested topic lists in brackets ("phased plan (discovery / pilot in one region / scale)")
function topicParts_(topic) {
  const m = String(topic || '').match(/\(([^)]+)\)/);
  return m ? m[1].split(/\s*\/\s*|\s*&\s*/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
}
// Word stems of a text, without the words every slide shares
const TOPIC_STOP_ = /^(about|their|there|these|those|what|with|from|into|that|this|your|ours|clear|expected|work|works|working|which|where|when|current|approach|slide|deck|proposal|overview|details?|understanding|structure|level|high|overall|key)$/i;
// Words that name the same kind of slide ("KPIs", "targets", "outcomes" -> outcomes)
const TOPIC_GROUPS_ = [
  ['#outcome', /^(outco|resul|impac|benef|value|kpis|metri|measu|targe|succe|roi)/],
  ['#goal', /^(goals|objec|aims|ambit|prior|visio)/],
  ['#security', /^(secur|prote|priva|gover|encry|regul)/],
  ['#plan', /^(phase|roadm|timel|deliv|imple|rollo|plan|plann|miles|journ)/],
  ['#team', /^(team|teams|staff)/],
  ['#problem', /^(chall|pains|probl|issue|barri|gaps|needs)/],              // V.1_50: "the client's needs" = its challenges
  ['#solution', /^(solut|propo)/],
  ['#credentials', /^(66deg|partn|crede)/]
];
function topicStems_(t, dropNames) {
  const set = {};
  let str = String(t || '').replace(/\([^)]*\)/g, ' ');
  if (dropNames) {
    // proper nouns ("Apple's", "Google Cloud") say who, not what: left out when the topic has other words
    const plain = str.replace(/\b[A-Z][a-zA-Z]*(?:['’]s)?\b/g, ' ');
    if ((plain.toLowerCase().match(/[a-z0-9]{4,}/g) || []).some(function (w) { return !TOPIC_STOP_.test(w); })) str = plain;
  }
  (str.toLowerCase().match(/[a-z0-9]{4,}/g) || []).forEach(function (w) {
    if (TOPIC_STOP_.test(w)) return;
    const st = w.slice(0, 5);
    const g = TOPIC_GROUPS_.filter(function (x) { return x[1].test(st); })[0];
    set[g ? g[0] : st] = true;
  });
  return set;
}
// The slide (index) that covers a requested topic: most of the topic's stems in its title, lead or item headings
function slideForTopic_(slides, topic, skip) {
  const ts = Object.keys(topicStems_(topic, true));
  const parts = topicParts_(topic);
  if (!ts.length) return -1;
  let best = -1, bestScore = 0;
  (slides || []).forEach(function (sp, i) {
    if (!sp || (skip && skip[String(sp.type || '').toLowerCase()])) return;
    const heads = [sp.title, sp.lead, sp.statement].concat((sp.items || sp.steps || []).map(function (it) { return it && (it.title || it.label); }))
      .concat(sp.left ? [sp.left.label, sp.left.title] : []).concat(sp.right ? [sp.right.label, sp.right.title] : []).concat(sp.columns || [])
      .concat(sp.section ? [sp.section] : []);                       // V.1_42: a proposal section named after the topic covers it
    const ss = topicStems_(heads.filter(function (h) { return typeof h === 'string'; }).join(' '));
    let score = ts.filter(function (w) { return ss[w]; }).length / ts.length;
    // a topic with its parts listed ("discovery / pilot / scale") is also found by its parts
    if (parts.length >= 2) {
      const ph = parts.filter(function (pt) { return Object.keys(topicStems_(pt)).some(function (w) { return ss[w]; }); }).length / parts.length;
      score = (score + ph) / 2;                                // its parts count as much as its name
    }
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore >= 0.5 ? best : -1;
}
// Requested topics no slide covers yet, and covered topics whose listed parts are not on their slide
function missingTopics_(slides, prompt, skip) {
  const missing = [], rework = [];
  requestedTopics_(prompt).forEach(function (t) {
    const i = slideForTopic_(slides, t, skip);
    if (i === -1) { missing.push(t); return; }
    const parts = topicParts_(t);
    if (parts.length >= 2) {
      const sp = slides[i];
      const heads = topicStems_((sp.items || sp.steps || []).map(function (it) { return it && (it.title || it.label); }).join(' '));
      const ok = parts.every(function (pt) { return Object.keys(topicStems_(pt)).some(function (w) { return heads[w]; }); }) &&
        (sp.items || sp.steps || []).length <= parts.length + 1;
      if (!ok) rework.push({ i: i, topic: t });
    }
  });
  return { missing: missing, rework: rework };
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
    // (V.1_37: no heading cut from the first words of the sentence - "This shift mandates a" - the point is text only)
    return { title: '', text: x };
  });
  return sp;
}

// Short centre label for a diagram made from a slide title: "Addressing risks in AI customer service" -> "Risks"
function centerLabel_(title) {
  let t = String(title || '').split(/:|—|–|\s-\s/)[0].trim();          // a hyphenated word ("Cross-functional") is not a break
  // V.1_47: verbs and articles at the start go, repeatedly ("Achieve a unified view of ..." -> "Unified view")
  for (let k = 0; k < 3; k++) {
    t = t.replace(/^(addressing|managing|implementing|building|driving|delivering|unlocking|establishing|ensuring|measuring|mitigating|accelerating|transforming|achieving|achieve|enable|enabling|build|drive|deliver|create|creating|unlock|unify|unifying|improve|improving|empower|empowering|accelerate|transform|ensure|establish|introducing|introduce|our|the|a|an|key|core)\s+/i, '');
  }
  // V.1_57: a count word is not a label ("Five decisions leadership must make" -> "Decisions"), and the label
  // stops at a verb ("... leadership must make", "... teams need")
  t = t.replace(/^(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '');
  t = t.split(/\s+(in|for|of|to|with|across|on|at|by|from|and|that|which|we|our|must|should|need|needs|will|can|is|are|to)\s+/i)[0];
  t = t.split(/\s+(must|should|need|needs|will|can|is|are)$/i)[0];
  let words = t.split(/\s+/).filter(Boolean).slice(0, 3);
  // a plural noun first is the whole label ("Decisions leadership" -> "Decisions"): the next word starts another clause
  if (words.length >= 2 && /^[a-z]+s$/i.test(words[0]) && !/(ss|us|is)$/i.test(words[0])) words = words.slice(0, 1);
  const out = words.join(' ');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : 'Overview';
}

// A slide that walks through steps, phases or a cycle
function sequenceLike_(sp) {
  const t = String(sp.type || '').toLowerCase();
  if (t === 'process' || t === 'timeline') return true;
  return /\b(cycle|loop|lifecycle|life cycle|framework|phases?|phased|steps?|stages?|journey|roadmap|methodology|step-by-step|how it works)\b/i.test(String(sp.title || ''));
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

// Column names for a two-column table made from cards: what the rows are, and what the text says about them (V.1_35)
function tableHeaders_(title) {
  const t = String(title || '');
  const map = [
    [/\b(risks?|pitfalls?|challenges?|mistakes?|barriers?)\b/i, ['Risk', 'How to manage it']],
    [/\b(roles?|teams?|stakeholders?|responsibilit\w*|owners?)\b/i, ['Role', 'Responsibility']],
    [/\b(tools?|platforms?|capabilit\w*|services?|products?)\b/i, ['Tool', 'What it does']],
    [/\b(metrics?|kpis?|measures?)\b/i, ['Metric', 'What it shows']],
    [/\b(decisions?|choices?|options?)\b/i, ['Decision', 'What to weigh']],
    [/\b(phases?|steps?|stages?|methodology|process)\b/i, ['Stage', 'What happens']],
    [/\b(optimi[sz]\w*|levers?|tactics?|practices?|strateg\w*|savings?)\b/i, ['Lever', 'How it works']],
    [/\b(benefits?|outcomes?|impact|value)\b/i, ['Outcome', 'What changes']]
  ];
  for (var i = 0; i < map.length; i++) if (map[i][0].test(t)) return map[i][1].slice();
  return ['Area', 'What it involves'];
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
      slides[i] = Object.assign(base, { type: 'table', columns: tableHeaders_(sp.title), rows: items.map(function (it) { return [it.title || '', it.text || '']; }) });
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

// Slides that would look empty (one card, a statement with nothing next to it, two bullets, two KPIs) get their missing
// content in one Gemini call, written to the slide's own topic. Nothing is invented beyond the slide's subject.
// V.1_65: the shape Gemini wrote is checked before anything is filled or drawn (every deck type)
//  - speaker notes written as a list become one text; when the slide itself has no points, the list is its points
//  - a chart without real numbers becomes cards of its categories (deck 37 Proposal slide 36: only the two bar names were left)
//  - items or points that each state a target figure ("Target: 55% ...") become KPI tiles (deck 37 Solution slide 37)
//  - a long closing paragraph written as the last step becomes the slide's takeaway (deck 37 Proposal slide 38)
/* V.1_69: the figures a request asks for ("99.95% uptime", "recovery under 15 minutes", "40% fewer incidents", "3x faster
   queries"), in the order written. Money and plain counts ("420M profiles") are not KPI figures and are left out.  */
function requestFigures_(prompt) {
  const p = String(prompt || '').replace(/\s+/g, ' ');
  const out = [];
  const add = function (at, value, label) {
    label = String(label || '').replace(/^(?:a|an|the|of|in|on|for)\s+/i, '').replace(/[\s,;:.]+$/, '').trim();
    const key = figKey_(value);
    if (!key || out.some(function (f) { return f.key === key && sharedWords_(f.label, label) > 0; })) return;
    out.push({ at: at, value: value, key: key, label: label, labelCap: label.charAt(0).toUpperCase() + label.slice(1) });
  };
  const STOP = '(?=\\s*(?:[,;.)]|\\band\\b|\\bwith\\b|\\bby\\b|\\bwithin\\b|$))';
  // "99.95% uptime", "40% fewer incidents", "3x faster report builds"
  const reA = new RegExp('(?:^|[^\\d$€£.])(\\d+(?:\\.\\d+)?\\s?(?:%|x))\\s+((?:[A-Za-z][\\w-]*\\s?){1,6}?)' + STOP, 'gi');
  let m;
  while ((m = reA.exec(p))) add(m.index, m[1].replace(/\s+/g, ''), m[2]);
  // "recovery under 15 minutes", "RTO below 4 hours"
  const reB = /((?:[A-Za-z][\w-]*\s){1,4}?)(?:under|below|less than|within|in under|<)\s?(\d+(?:\.\d+)?)\s?(minutes?|mins?|hours?|hrs?|seconds?|secs?|ms|days?)\b/gi;
  while ((m = reB.exec(p))) {
    const unit = /^min/i.test(m[3]) ? 'min' : /^(hour|hr)/i.test(m[3]) ? 'hours' : /^(sec|s$)/i.test(m[3]) ? 'sec' : /^ms/i.test(m[3]) ? 'ms' : 'days';
    const lab = m[1].trim().split(/\s+/).filter(function (w) { return !/^(and|with|a|an|the|to|of|is|are|be|at)$/i.test(w); }).slice(-3).join(' ');
    if (lab) add(m.index, '<' + m[2] + ' ' + unit, lab);
  }
  // "cut platform run cost by 30%", "improve query speed by 3x"
  const reC = /((?:[A-Za-z][\w-]*\s){1,5}?)by\s(\d+(?:\.\d+)?\s?(?:%|x))(?![\w%])/gi;
  while ((m = reC.exec(p))) {
    const labC = m[1].trim().split(/\s+/).filter(function (w) { return !/^(and|with|a|an|the|to|of|is|are|be|we|want|wants|should|must|will)$/i.test(w); }).slice(-4).join(' ');
    if (labC) add(m.index, m[2].replace(/\s+/g, ''), labC);
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}
function figKey_(v) {
  let x = String(v || '').toLowerCase().replace(/target\s*:/, '').replace(/\b(under|below|less than|within)\b/g, '<').replace(/\s+/g, '');
  x = x.replace(/minutes?|mins?/, 'min').replace(/hours?|hrs?/, 'h').replace(/seconds?|secs?/, 's');
  return /\d/.test(x) ? x : '';
}
function sharedWords_(a, b) {
  const W = function (t) { return String(t || '').toLowerCase().match(/[a-z]{3,}/g) || []; };
  const B = {}; W(b).forEach(function (w) { B[w.replace(/s$/, '')] = 1; });
  return W(a).filter(function (w) { return B[w.replace(/s$/, '')]; }).length;
}
function isKpiSlide_(sp) {
  const items = Array.isArray(sp.items) ? sp.items : [];
  const valued = items.filter(function (it) { return it && typeof it === 'object' && String(it.value || '').trim(); }).length;
  if (String(sp.type || '').toLowerCase() !== 'stats' && valued < 2) return false;
  return /\b(kpis?|key performance|performance indicators?|success (?:measures?|metrics?|criteria)|measur(?:e|es|able)|targets?|outcomes? we commit)\b/i.test(String(sp.title || ''));
}
function slideHasFigure_(sp) {
  const parts = [];
  (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) { if (typeof it === 'string') parts.push(it); else if (it) parts.push(it.value, it.title, it.text, it.label, it.highlight); });
  (Array.isArray(sp.points) ? sp.points : []).forEach(function (x) { parts.push(typeof x === 'string' ? x : JSON.stringify(x)); });
  if (Array.isArray(sp.rows)) parts.push(JSON.stringify(sp.rows));
  if (sp.chart) parts.push(JSON.stringify(sp.chart));
  parts.push(sp.value, sp.takeaway);
  return /\d+(?:\.\d+)?\s?(?:%|x\b|[kmb]\b|\$)|\$\s?\d/i.test(parts.filter(Boolean).join(' '));
}
function normalizeShapes_(plan, ctx) {
  const words = function (t) { return String(t || '').split(/\s+/).filter(Boolean).length; };
  const FIG_RE = /^(?:target:\s*)?([+\-−~]?\$?\d[\d.,]*\s*(?:%|x|pp|pts?|points?|ms|s|[kKmMbB])?)(?=[\s,;:)]|$)\s*(.*)$/i;
  (plan.slides || []).forEach(function (sp) {
    if (!sp || typeof sp !== 'object') return;
    const t = String(sp.type || '').toLowerCase();
    if (['cover', 'agenda', 'closing', 'section', 'template'].indexOf(t) !== -1) return;
    const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
    const pts = Array.isArray(sp.points) ? sp.points.filter(Boolean) : [];
    // 1. notes as a list
    if (Array.isArray(sp.notes)) {
      const list = sp.notes.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
      const hasContent = items.length >= 2 || pts.length >= 2 || (sp.left && sp.right) || (Array.isArray(sp.rows) && sp.rows.length >= 2) || (sp.chart && Array.isArray(sp.chart.categories) && sp.chart.categories.length >= 3);
      if (!hasContent && list.length >= 2) { sp.points = list; sp.notes = ''; }
      else sp.notes = list.map(function (x) { return /[.!?]$/.test(x) ? x : x + '.'; }).join(' ');
    }
    // 2. a chart without numbers
    if (t === 'chart' && sp.chart) {
      const cats = Array.isArray(sp.chart.categories) ? sp.chart.categories.map(String) : [];
      const vals = sp.chart.series && sp.chart.series[0] && Array.isArray(sp.chart.series[0].values) ? sp.chart.series[0].values : [];
      const numeric = vals.filter(function (v) { return v !== '' && v != null && isFinite(Number(v)); }).length;
      if (cats.length >= 2 && (numeric < 2 || numeric < cats.length - 1)) {
        const pp = Array.isArray(sp.points) ? sp.points.map(String) : [];
        sp.type = 'cards';
        sp.items = cats.slice(0, 6).map(function (c, k) {
          const v = vals[k] != null && String(vals[k]).trim() && !isFinite(Number(vals[k])) ? String(vals[k]).trim() : '';
          return { title: c, text: v ? v.charAt(0).toUpperCase() + v.slice(1) + (/[.!?]$/.test(v) ? '' : '.') : '' };
        });
        if (cats.length === 2 && pp.length) { sp.items[1].text = [sp.items[1].text].concat(pp).filter(Boolean).join(' '); sp.points = []; }
        if (sp.insight && !sp.takeaway) sp.takeaway = String(sp.insight.text || sp.insight.title || '');
        delete sp.chart; delete sp.design; sp.reference = null; sp.pair = cats.length === 2;
        if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '": a chart without figures is shown as cards.');
      }
    }
    // 3. target figures written as text
    const tt = String(sp.type || '').toLowerCase();
    if (['cards', 'bullets', 'statement', 'process'].indexOf(tt) !== -1) {
      const src = (Array.isArray(sp.items) && sp.items.length ? sp.items : (Array.isArray(sp.points) ? sp.points : [])).filter(Boolean);
      if (src.length >= 2 && src.length <= 4) {
        const kpis = src.map(function (it) {
          const head = typeof it === 'object' ? String(it.title || it.label || '') : '';
          const body = typeof it === 'object' ? String(it.text || it.description || '') : String(it);
          const m = FIG_RE.exec(body.trim());
          if (!m || !/\d/.test(m[1]) || !/^target:/i.test(body.trim()) && !/target|kpi|metric/i.test(String(sp.title || '') + ' ' + head)) return null;
          const rest = m[2].replace(/^[\s·:–—-]+/, '');
          return { value: m[1].replace(/\s+/g, ''), label: 'Target: ' + (head || rest.split(/[·.;]/)[0]).replace(/^target:\s*/i, '').replace(/^./, function (c) { return c.toLowerCase(); }), text: head ? rest.charAt(0).toUpperCase() + rest.slice(1) : '' };
        });
        if (kpis.every(Boolean)) {
          sp.type = 'stats'; sp.items = kpis; sp.points = []; delete sp.design; sp.reference = null;
          if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '": target figures shown as KPI tiles.');
        }
      }
    }
    // 6. V.1_67 (deck 39 Solution 22): topics that each carry a list of details are drawn as topic rows / a topic grid with
    //    icons, decided here so the fit step measures that design and shortens the details when they are too long
    const grpT = Array.isArray(sp.items) ? sp.items.filter(function (it) { return it && typeof it === 'object' && (it.title || it.label) && Array.isArray(it.points) && it.points.length >= 2 && it.points.length <= 6; }) : [];
    if (String(sp.type || '').toLowerCase() === 'bullets' && grpT.length >= 3 && grpT.length <= 5 && grpT.length === sp.items.length) { sp.lockTag = 'S66_TOPIC_ROWS'; delete sp.design; }
    // 7. V.1_67 (deck 39 Proposal 23 "Scope": five bullets that were only headings): points of one to four words are
    //    headings without their content - they become items, so the fill step writes what each one covers
    if (['bullets', 'statement'].indexOf(String(sp.type || '').toLowerCase()) !== -1 && Array.isArray(sp.points) && sp.points.length >= 3 &&
        !(Array.isArray(sp.items) && sp.items.length) && sp.points.every(function (p) { return typeof p === 'string' && !/[.!?]$/.test(p.trim()) && p.trim().split(/\s+/).length <= (/scope|assumption|dependenc|deliverable|out of|in scope/i.test(String(sp.title || '')) ? 7 : 6); })) {   // V.1_68: "Out of scope (future phases)"; V.1_73: 6 words (deck 44 Proposal 32)
      sp.type = 'cards'; sp.items = sp.points.map(function (p) { return { title: String(p).trim(), text: '' }; }); sp.points = []; delete sp.design; sp.reference = null;
    }
    // 8. V.1_67 (deck 39 General 26: "$285K fixed fee", "$85K / month" in a deck whose request gave no price): an amount
    //    of money on a slide is kept only when the request or its sources give it; otherwise the options are shown without
    //    amounts and the slide says how pricing is settled
    {
      const req = (String((ctx && ctx.userPrompt) || '') + ' ' + String((ctx && ctx.sources && ctx.sources.text) || '')).replace(/,/g, '');
      const AMT = /(?:target\s*:\s*)?(?:[$€£₹]\s?\d[\d,.]*\s?(?:k|m|mn|bn|million|billion)?\b|\b\d[\d,.]*\s?(?:k|m)?\s?(?:usd|eur|gbp|inr|dollars)\b)(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|hour|hr|week|sprint))?/gi;
      const given = function (a) { const d = (String(a).match(/\d[\d,.]*/) || [''])[0].replace(/,/g, ''); return d && req.indexOf(d) !== -1; };
      let removed = 0;
      const strip = function (x) {
        if (typeof x !== 'string') return x;
        return x.replace(AMT, function (a) { if (given(a)) return a; removed++; return ''; })
          .replace(/\(\s*\)/g, '').replace(/\s+([,.;:])/g, '$1').replace(/(^|[\s(])(for|at|of|from|about|around|roughly)\s*([.,;]|$)/gi, '$1$3').replace(/\s{2,}/g, ' ').trim();
      };
      const walk = function (v) {
        if (typeof v === 'string') return strip(v);
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { if (k !== 'notes' && k !== 'reference') v[k] = walk(v[k]); }); return v; }
        return v;
      };
      ['items', 'rows', 'points', 'prices', 'options', 'tiers', 'packages'].forEach(function (k) { if (sp[k]) sp[k] = walk(sp[k]); });
      if (removed) {
        if (Array.isArray(sp.prices)) sp.prices = sp.prices.map(function (p) { if (p && typeof p === 'object') delete p.price; return p; });
        // a table column left empty by this goes
        if (Array.isArray(sp.rows) && Array.isArray(sp.columns)) {
          const R = sp.rows.filter(Array.isArray), drop = [];
          // a price column ("Illustrative investment") whose amounts were left out goes with what is left of it ("fixed fee")
          sp.columns.forEach(function (c, j) { if (j && R.length && (R.every(function (r) { return !String(r[j] || '').trim(); }) || (/pric|invest|cost|fee|budget|amount|rate/i.test(String(c && (c.label || c.title) || c)) && R.every(function (r) { return String(r[j] || '').trim().split(/\s+/).length <= 3; })))) drop.push(j); });
          if (drop.length) { sp.columns = sp.columns.filter(function (c, j) { return drop.indexOf(j) === -1; }); sp.rows = sp.rows.map(function (r) { return Array.isArray(r) ? r.filter(function (c, j) { return drop.indexOf(j) === -1; }) : r; }); }
        }
        if (!String(sp.takeaway || '').trim()) sp.takeaway = 'Pricing is confirmed after the scoping workshop.';
        if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '": ' + removed + ' price(s) not given in the request left out.');
      }
    }
    // 9. V.1_69 (deck 41 Solution 7, General 18, Proposal 19): the KPI tiles are the figures the request wrote, in its
    //    order - a 100% SLA Gemini put in place of "99.95% uptime", a figure written twice and a target the request never
    //    gave make way for them
    // V.1_70: the brief's target figures (Gemini read the request, the code checked it); the request read by the code otherwise
    const briefT = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
    const reqFigs = briefT.length >= 2 ? briefT : requestFigures_(ctx && ctx.userPrompt);
    if (reqFigs.length >= 2 && isKpiSlide_(sp)) {
      const cand = [];
      if (sp.value != null && String(sp.value).trim()) cand.push({ value: String(sp.value).trim(), label: String(sp.label || ''), text: String(sp.text || '') });
      if (sp.headline && typeof sp.headline === 'object' && String(sp.headline.value || '').trim()) cand.push({ value: String(sp.headline.value).trim(), label: String(sp.headline.label || sp.headline.title || ''), text: String(sp.headline.text || '') });
      (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) { if (it && typeof it === 'object' && String(it.value || '').trim()) cand.push({ value: String(it.value).trim(), label: String(it.label || it.title || ''), text: String(it.text || '') }); });
      const used = [];
      const tiles = reqFigs.slice(0, 6).map(function (f) {
        let best = -1, bestScore = -1;
        cand.forEach(function (c, k) {
          if (used.indexOf(k) !== -1 || figKey_(c.value) !== f.key) return;
          const sc = sharedWords_(c.label + ' ' + c.text, f.label);
          if (sc > bestScore) { best = k; bestScore = sc; }
        });
        // (V.1_70, deck 41 Proposal 7: "50%" over "50% faster report builds": the label does not say the figure again)
        const noVal = function (l) { return String(l || '').replace(new RegExp('^\\s*(target\\s*:\\s*)?' + String(f.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '$1').replace(/^(target:\s*)?(.)/i, function (m0, a, b) { return a ? a + b : b.toUpperCase(); }); };
        if (best >= 0) { used.push(best); const c = cand[best]; return { value: c.value, label: noVal(c.label) || f.labelCap, text: c.text }; }
        return { value: f.value, label: 'Target: ' + f.label, text: '' };
      });
      // room left (fewer than three figures asked): Gemini's own figures stay when they are new and not a 100% SLA
      cand.forEach(function (c, k) {
        if (tiles.length >= 3 || used.indexOf(k) !== -1) return;
        if (/^100\s?%$/.test(c.value) || tiles.some(function (t2) { return figKey_(t2.value) === figKey_(c.value); })) return;
        tiles.push(c);
      });
      const before = JSON.stringify((sp.items || []).map(function (it) { return it && it.value; }));
      if (JSON.stringify(tiles.map(function (t2) { return t2.value; })) !== before || sp.value != null || sp.headline) {
        sp.type = 'stats'; sp.items = tiles; sp.points = [];
        delete sp.value; delete sp.label; delete sp.text; delete sp.note; delete sp.headline;
        if (/INVESTMENT/.test(String(sp.design || '') + String(sp.lockTag || ''))) { delete sp.design; delete sp.lockTag; sp.reference = null; }
        if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '": KPI tiles are the figures the request gave (' + tiles.map(function (t2) { return t2.value; }).join(', ') + ').');
      }
    }
    // 10. V.1_69 (deck 41 General 5): facts that are not targets, with one target among them - "Target:" goes from the
    //     label and the figure says it is a target after it, so the slide does not read as a KPI slide by halves
    if (Array.isArray(sp.items) && sp.items.length >= 2 && !isKpiSlide_(sp)) {
      const tg = sp.items.filter(function (it) { return it && typeof it === 'object' && /^\s*target\s*:/i.test(String(it.label || '')); });
      if (tg.length && tg.length < sp.items.length) {
        tg.forEach(function (it) { it.label = String(it.label).replace(/^\s*target\s*:\s*/i, '').replace(/^./, function (c) { return c.toUpperCase(); }) + ' (target)'; });
        if (ctx && ctx.log) ctx.log.push('"' + String(sp.title || '').slice(0, 50) + '": "Target:" labels on a slide of facts read as "(target)".');
      }
    }
    // 11. V.1_69 (deck 41 Proposal 20): a slide called "benchmarks" with no figure on it is industry experience - the
    //     figures stayed in the notes - so it is not called a benchmark (the agenda and divider follow the new title)
    if (/\bbenchmarks?\b/i.test(String(sp.title || '')) && !slideHasFigure_(sp)) {
      const oldT = String(sp.title);
      sp.title = oldT.replace(/\b(industry\s+)?benchmarks?\s+(on|for|in|from)\s+/i, 'Industry experience with ')
        .replace(/\b(industry\s+)?benchmarks?\b/i, 'industry experience').replace(/^./, function (c) { return c.toUpperCase(); });
      (plan.slides || []).forEach(function (o) {
        if (!o || o === sp) return;
        ['points'].forEach(function (k) { if (Array.isArray(o[k])) o[k] = o[k].map(function (x) { return x === oldT ? sp.title : x; }); });
        if (Array.isArray(o.items)) o.items.forEach(function (it) { if (it && typeof it === 'object' && it.title === oldT) it.title = sp.title; });
      });
      if (ctx && ctx.log) ctx.log.push('"' + oldT.slice(0, 50) + '": no figure on the slide, so it is titled "' + sp.title + '".');
    }
    // 5. a caption, takeaway or callout that says the lead again (deck 37 Proposal slide 21) is dropped
    const lead = String(sp.lead || sp.subtitle || '');
    const bag = function (x) { return String(x || '').toLowerCase().match(/[a-z0-9%]{4,}/g) || []; };
    const same = function (a) {
      const A = bag(a), B = bag(lead); if (A.length < 4 || B.length < 4) return false;
      const setB = {}; B.forEach(function (w) { setB[w] = 1; });
      return A.filter(function (w) { return setB[w]; }).length / A.length >= 0.7;
    };
    if (lead) {
      ['caption', 'takeaway', 'callout', 'note'].forEach(function (k) { if (typeof sp[k] === 'string' && same(sp[k])) sp[k] = ''; });
      if (sp.insight && typeof sp.insight === 'object' && same(sp.insight.text)) sp.insight.text = '';
      if (sp.image && typeof sp.image === 'object' && same(sp.image.caption)) sp.image.caption = '';
    }
    // 4. a closing paragraph as the last step
    const its = Array.isArray(sp.items) ? sp.items : null;
    if (its && its.length >= 3 && ['process', 'next_steps', 'cards', 'bullets'].indexOf(String(sp.type || '').toLowerCase()) !== -1) {
      const textOf = function (it) { return typeof it === 'string' ? it : String((it && (it.text || it.description)) || ''); };
      const headOf = function (it) { return typeof it === 'string' ? '' : String((it && (it.title || it.label)) || ''); };
      const last = its[its.length - 1], others = its.slice(0, -1).map(function (it) { return words(textOf(it)) + words(headOf(it)); }).sort(function (a, b) { return a - b; });
      const med = others[Math.floor(others.length / 2)] || 1;
      if (!headOf(last) && words(textOf(last)) >= 25 && words(textOf(last)) > 1.8 * med) {
        its.pop();
        if (!String(sp.takeaway || '').trim()) sp.takeaway = textOf(last);
        else sp.notes = String(sp.notes || '') + ' ' + textOf(last);
      }
    }
  });
}
/* V.1_66 (deck 38 General slides 15-16: "RACI matrix…" over the timeline, "12-week timeline…" over the KPIs): the slides
   Gemini wrote for one part of a long deck are matched to the outline by what they are about, never by position alone.
   Gemini had written the team structure and the RACI as one table, so every later slide of that part took the title of
   the slide before it. Now:
   - each outline entry takes the written slide most like it (same title, else shared title words, the brief and the type);
   - position is used only when Gemini wrote exactly as many slides as asked and nothing better matches;
   - a slide whose content matches no outline entry is not given a title it does not show; an outline entry with no
     slide gets an empty slide of its type, which the fill step writes (fillThinSlides_).                              */
function matchOutline_(outline, got) {
  const words = function (t) { return (String(t || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(function (w) { return !/^(with|from|into|that|this|across|their|your|over|between|both|sides?|slides?|plan|deck)$/.test(w); }); };
  const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  const bag = function (sp) {
    if (!sp) return [];
    const t = []; (function walk(v, d) { if (d > 3 || v == null) return; if (typeof v === 'string') t.push(v); else if (Array.isArray(v)) v.forEach(function (x) { walk(x, d + 1); }); else if (typeof v === 'object') Object.keys(v).forEach(function (k) { if (!/^(notes|reference|icon|design|lockTag|fact_tags|resolvedIcons)$/.test(k)) walk(v[k], d + 1); }); })(sp, 0);
    return words(t.join(' '));
  };
  const sim = function (a, b) { if (!a.length || !b.length) return 0; const B = {}; b.forEach(function (w) { B[w] = 1; }); let n = 0; const seen = {}; a.forEach(function (w) { if (B[w] && !seen[w]) { seen[w] = 1; n++; } }); return n / Math.min(new Set(a).size, new Set(b).size); };
  const score = function (o, g) {
    if (!g) return 0;
    if (norm(g.title) === norm(o.title)) return 10;
    const tt = sim(words(o.title), words(g.title));
    const body = sim(words(o.title + ' ' + (o.brief || '')), bag(g));
    const typeOk = String(g.type || '').toLowerCase() === String(o.type || '').toLowerCase() ? 0.15 : 0;
    return tt * 1.2 + body * 0.8 + typeOk;
  };
  const n = outline.length, byOutline = new Array(n), ownTitle = new Array(n), used = {}, log = [];
  const cand = [];
  outline.forEach(function (o, k) { got.forEach(function (g, j) { if (g) cand.push({ k: k, j: j, s: score(o, g) }); }); });
  cand.sort(function (a, b) { return b.s - a.s || Math.abs(a.k - a.j) - Math.abs(b.k - b.j); });
  cand.forEach(function (c) {
    if (byOutline[c.k] || used[c.j] || c.s < 0.45) return;
    byOutline[c.k] = got[c.j]; used[c.j] = 1;
  });
  // position, only when Gemini wrote as many slides as asked and the slide at that place is free and not clearly another's
  if (got.length === n) outline.forEach(function (o, k) {
    if (!byOutline[k] && got[k] && !used[k]) { byOutline[k] = got[k]; used[k] = 1; }
  });
  outline.forEach(function (o, k) {
    const g = byOutline[k];
    if (!g) { log.push('"' + String(o.title).slice(0, 50) + '": Gemini did not write this slide; it is written again.'); return; }
    // the content is about something else than the outline title (title words not in it): its own title stays
    if (norm(g.title) !== norm(o.title) && g.title && sim(words(o.title), bag(g)) < 0.34 && sim(words(g.title), bag(g)) >= 0.5) {
      ownTitle[k] = true;
      log.push('"' + String(g.title).slice(0, 50) + '" keeps its own title (the outline said "' + String(o.title).slice(0, 50) + '").');
    }
  });
  return { byOutline: byOutline, ownTitle: ownTitle, log: log };
}
function fillThinSlides_(plan, ctx, opts) {
  const textsOnly = !!(opts && opts.textsOnly);                                // V.1_67: second pass after the designs are chosen
  if (!textsOnly) { try { normalizeShapes_(plan, ctx); } catch (e) { if (ctx && ctx.log) ctx.log.push('Shape check skipped: ' + e.message); } }
  const thin = [];
  const proposalFill = typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx);          // (V.1_52: not a Solution Deck)
  const libFill = isLibraryDeck_(ctx);
  const solutionFill = typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx);   // V.1_54
  plan.slides.forEach(function (sp, i) {
    const t = String(sp.type || '').toLowerCase();
    const items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
    const pts = Array.isArray(sp.points) ? sp.points.filter(Boolean) : [];
    // V.1_54 (deck 25 slide 19): a Solution slide whose items have headings but no text gets one sentence per item;
    // its figures are never filled with invented targets, and a roadmap stays phases (no Gantt)
    // V.1_65 (deck 37 Proposal slide 31: four cards with a heading each and nothing in them): in every deck type, items
    // that have a heading but no text get one or two sentences each
    {
      // V.1_66 (deck 38 Proposal slide 25: "fixed-price 12-week outcome" was all an option said): a text of under six
      // words counts as no text, so it gets its one or two sentences too (the short text is kept as the item's gist)
      const shortTxt = function (it) { const tx = String(it.text || it.description || '').trim(); return !/[A-Za-z]{3}/.test(tx) || tx.split(/\s+/).length < 6; };
      const bare = items.filter(function (it) { return typeof it === 'object' && (it.title || it.label) && !String(it.value || '').trim() && !(Array.isArray(it.points) && it.points.length) && !String(it.fix || '').trim() && shortTxt(it); });
      if (items.length >= 2 && bare.length >= Math.ceil(items.length / 2) && ['cards', 'diagram', 'process', 'bullets', 'statement', 'comparison'].indexOf(t) !== -1) { thin.push({ i: i, kind: 'itemtexts', want: items.length }); return; }
    }
    // V.1_70 (deck 41 Solution 5, General 5: two of three KPI tiles with a figure and no text): a tile with its figure
    // and no text gets one sentence on how the target is reached or measured (no new figures)
    // (only once every tile has its figure and the slide has its tiles: topping up and target values come first)
    // (V.1_71, deck 42 Proposal 19: figure tiles on a cards slide had no text): any slide whose items all carry figures
    if ((t === 'stats' || items.length >= 2) && items.length >= 2 && (items.length >= 3 || textsOnly || solutionFill || t !== 'stats') && items.every(function (it) { return it && typeof it === 'object' && /\d/.test(String(it.value || '')); }) &&
        items.some(function (it) { return String(it.text || '').trim().split(/\s+/).filter(Boolean).length < 6; })) {
      thin.push({ i: i, kind: 'kpitexts', want: items.length }); return;
    }
    if (textsOnly) return;
    if (solutionFill && (t === 'stats' || t === 'timeline')) return;
    if (['cards', 'diagram', 'process'].indexOf(t) !== -1 && !sp.teams && !sp.org && !sp.tabs && !sp.layers && !sp.pair && items.length < 3) thin.push({ i: i, kind: 'items', want: 3 - items.length });
    else if (t === 'statement' && pts.length < 2) thin.push({ i: i, kind: 'points', want: 3 - pts.length });
    else if (t === 'bullets' && pts.length < 3) thin.push({ i: i, kind: 'bullets', want: 4 - pts.length });
    else if (t === 'stats' && items.length < 3) thin.push({ i: i, kind: 'kpis', want: 3 - items.length });
    // V.1_48: KPIs without a number get a target value ("Target: forecast accuracy" -> "+15%")
    else if (t === 'stats' && items.some(function (it) { return it && !/\d/.test(String(it.value || '')); })) thin.push({ i: i, kind: 'kpivalues', want: items.length });
    // V.1_48: a team slide whose title promises governance shows it (one box above the two team lanes)
    // V.1_51: in a Proposal Deck the team slide always shows its governance box
    else if (t === 'team' && Array.isArray(sp.teams) && sp.teams.length === 2 && !sp.governance && (proposalFill || /governance|oversight|steering/i.test(String(sp.title || '')))) thin.push({ i: i, kind: 'governance', want: 1 });
    // V.1_50: a roadmap without periods and lanes (written as phases) gets them, so it is drawn as a Gantt
    // V.1_51 (deck 23 slide 21): in a Proposal Deck a roadmap whose phases have timings is a Gantt too (the timings give
    // the bars; when they cannot be read, Gemini writes the periods and lanes)
    else if (t === 'timeline' && !(Array.isArray(sp.lanes) && sp.lanes.length) && !(Array.isArray(sp.tasks) && sp.tasks.length) &&
      (libFill ? !ganttFromTimedItems_(sp) :
      !(Array.isArray(sp.items) && sp.items.length >= 3 && sp.items.every(function (it) { return it && (it.date || it.timing || it.period); })))) thin.push({ i: i, kind: 'roadmap', want: 1 });
    // V.1_47: a Gantt roadmap with 1-2 lanes leaves most of the slide empty: it gets more workstream lanes
    else if (t === 'timeline' && Array.isArray(sp.lanes) && sp.lanes.length < 3 && Array.isArray(sp.periods) && sp.periods.length >= 4) thin.push({ i: i, kind: 'lanes', want: 4 - sp.lanes.length });
  });
  if (!thin.length || !ctx.apiKey) return 0;
  const list = thin.slice(0, 12).map(function (x, k) {
    const sp = plan.slides[x.i];
    if (x.kind === 'roadmap') return { id: k, kind: 'roadmap', add: 1, title: slideHeading_(sp), has: (sp.items || sp.points || []).map(function (it) { return typeof it === 'string' ? it : [it.title || it.label || '', it.text || ''].filter(Boolean).join(': '); }) };
    if (x.kind === 'kpitexts') return { id: k, kind: 'kpitexts', title: slideHeading_(sp), has: sp.items.map(function (it) { return String((it && it.value) || '') + ' ' + String((it && (it.label || it.title)) || '').replace(/^\s*target\s*:\s*/i, ''); }) };
    if (x.kind === 'kpivalues') return { id: k, kind: 'kpivalues', title: slideHeading_(sp), kpis: sp.items.map(function (it) { return { label: String(it.label || it.title || ''), value: String(it.value || '') }; }) };
    if (x.kind === 'itemtexts') return { id: k, kind: 'itemtexts', add: x.want, title: slideHeading_(sp), has: sp.items.filter(Boolean).map(function (it) { return typeof it === 'string' ? it : [String(it.title || it.label || ''), String(it.text || '').trim()].filter(Boolean).join(': '); }) };
    if (x.kind === 'lanes') return { id: k, kind: 'lanes', add: x.want, title: slideHeading_(sp), periods: sp.periods, has: sp.lanes.map(function (l) { return l && (l.name || l.title) || ''; }) };
    return { id: k, kind: x.kind, add: x.want, title: slideHeading_(sp), statement: sp.statement || '', has: (sp.items || sp.points || []).map(function (it) { return typeof it === 'string' ? it : (it.title || it.label || it.value || ''); }) };
  });
  try {
    const prompt = [
      'These slides of a ' + ctx.brand.name + ' presentation (request: "' + String(ctx.userPrompt || '').slice(0, 300) + '") look empty. Add the missing parts.',
      '- kind "items": {"title" (2-5 words), "text" (15-30 words)} cards on the slide topic.',
      '- kind "points": {"title" (2-5 words), "text" (12-25 words)} points that support the statement.',
      '- kind "bullets": strings "Short label: explanation" (12-22 words).',
      '- kind "kpis": {"value" (a target number, e.g. "25%"), "label" ("Target: " + what improves, words only), "text" (15-25 words)}.',
      '- kind "kpitexts": "add" = one text per entry of "has", in the same order: 12-20 words on how that target is reached or measured, specific to the request; no figures.',
      (typeof briefTargets_ === 'function' && briefTargets_(ctx).length ? '- For "kpis" and "kpivalues" use ONLY these target figures from the request, in this order: ' + briefTargets_(ctx).map(function (f) { return f.value + ' ' + f.label; }).join('; ') + '. Never another value.' : '- For "kpis" and "kpivalues": the request gives no figures, so leave "value" empty rather than invent one.'),
      '- Never 100% uptime, availability or SLA; no other new figures anywhere.',
      '- kind "kpivalues": "add" = one value per entry of "kpis", in the same order: the value kept when it has a number, otherwise a realistic target (e.g. "+15%", "-20%", "2 days", "98%"); short, no words.',
      '- kind "itemtexts": "add" = one text per entry of "has", in the same order: 12-25 words on what that item is or does, specific to the request (no figures); when an entry already has a few words after its name ("Option A: fixed-price 12-week outcome"), the text says that in full.',
      '- kind "governance": one {"title" (2-5 words, e.g. "Joint steering committee"), "text" (8-16 words: who meets, how often, what they decide)}.',
      '- kind "roadmap": ONE object {"periods": [4-9 short labels, e.g. "Month 1" ... "Month 6" or "Q1" ... "Q4"], "lanes": [3-5 workstreams {"name" (2-4 words), "bars": [{"start", "end" (period numbers from 1), "label" (2-4 words)}] (1-3 bars)}]}, built from the phases in "has"; together the lanes cover the whole plan.',
      '- kind "lanes": roadmap workstreams {"name" (2-4 words), "bars": [{"start", "end" (period numbers from 1 to the number of "periods"), "label" (2-4 words)}] (1-3 bars)}; the lanes together cover the whole plan.',
      'Never repeat what the slide already has ("has"). No invented clients, awards or claims about ' + ctx.brand.name + '. Sentence case, plain text.',
      'Return ONLY JSON: {"fixes":[{"id":0,"add":[...]}]}',
      JSON.stringify(list)
    ].join('\n');
    const out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.1); });   // V.1_56: client-facing text (V.1_70: was 0.4)
    let n = 0;
    ((out && out.fixes) || []).forEach(function (f) {
      const x = thin[f.id];
      if (!x || !Array.isArray(f.add) || !f.add.length) return;
      const sp = plan.slides[x.i];
      const add = f.add.slice(0, x.want).map(function (a) { return typeof a === 'string' ? ENGINE.cleanText(a) : a; });
      if (x.kind === 'roadmap') {
        const r = add[0];
        const per = r && Array.isArray(r.periods) ? shortPeriods_(r.periods.map(String).filter(Boolean).slice(0, 12)) : [];
        if (per.length >= 3 && Array.isArray(r.lanes)) {
          const lanes = r.lanes.filter(function (l) { return l && (l.name || l.title) && Array.isArray(l.bars) && l.bars.length; }).slice(0, 6).map(function (l) {
            return { name: String(l.name || l.title), bars: l.bars.slice(0, 3).map(function (b) {
              const st = Math.max(1, Math.min(per.length, parseInt(b.start, 10) || 1)), en = Math.max(st, Math.min(per.length, parseInt(b.end, 10) || st));
              return { start: st, end: en, label: String(b.label || '') };
            }) };
          });
          if (lanes.length >= 3) { sp.periods = per; sp.lanes = lanes; sp.design = 'P66_GANTT'; sp.reference = null; }
        }
      } else if (x.kind === 'governance') {
        const g = add[0];
        if (g && typeof g === 'object' && g.title) sp.governance = { title: headingCase_(String(g.title)), text: String(g.text || '') };
      } else if (x.kind === 'kpivalues') {
        sp.items.forEach(function (it, j) {
          const v = add[j] != null ? String(typeof add[j] === 'object' ? (add[j].value || '') : add[j]).trim() : '';
          if (it && !/\d/.test(String(it.value || '')) && /\d/.test(v) && v.length <= 12) {
            it.value = v;
            if (!/^target/i.test(String(it.label || ''))) it.label = 'Target: ' + String(it.label || it.title || '').replace(/\s*\((up to|at least)\)\s*$/i, '').replace(/^[A-Z][a-z]/, function (m) { return m.toLowerCase(); });
          }
        });
        sp.items = sp.items.filter(function (it) { return it && /\d/.test(String(it.value || '')); });
      } else if (x.kind === 'lanes') {
        const np = sp.periods.length;
        const lanes = add.filter(function (l) { return l && (l.name || l.title) && Array.isArray(l.bars) && l.bars.length; }).map(function (l) {
          return { name: String(l.name || l.title), bars: l.bars.map(function (b) {
            const st = Math.max(1, Math.min(np, parseInt(b.start, 10) || 1)), en = Math.max(st, Math.min(np, parseInt(b.end, 10) || st));
            return { start: st, end: en, label: String(b.label || '') };
          }) };
        });
        sp.lanes = sp.lanes.concat(lanes);
      } else if (x.kind === 'kpitexts') {
        sp.items.forEach(function (it, j) {
          const v = add[j];
          const txt = typeof v === 'string' ? v : (v && (v.text || v.title)) || '';
          if (it && typeof it === 'object' && txt && String(it.text || '').trim().split(/\s+/).filter(Boolean).length < 6) it.text = String(txt);
        });
      } else if (x.kind === 'itemtexts') {
        let j = 0;
        sp.items.forEach(function (it) {
          if (!it || typeof it !== 'object') return;
          const v = add[j++];
          const txt = typeof v === 'string' ? v : (v && (v.text || v.title)) || '';
          const had = String(it.text || '').trim();
          if (txt && (!/[A-Za-z]{3}/.test(had + (Array.isArray(it.points) ? it.points.join(' ') : '')) || (had.split(/\s+/).length < 6 && !(Array.isArray(it.points) && it.points.length)))) { it.text = String(txt); delete it.points; }
        });
      } else if (x.kind === 'items' || x.kind === 'kpis') sp.items = (sp.items || []).filter(Boolean).concat(add);
      else {
        // V.1_63 (deck 35 slide 59: the title and the speaker summary came back as two more bullets): a point that repeats
        // the title, the lead, the takeaway or the notes, or a point already there, is not added
        const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
        const seen = {};
        [sp.title, sp.lead, sp.takeaway, sp.statement].concat(sp.points || []).forEach(function (t) { if (norm(t)) seen[norm(t)] = 1; });
        const notes = norm(sp.notes);
        sp.points = (sp.points || []).filter(Boolean).concat(add.filter(function (a) {
          const k = norm(typeof a === 'object' && a ? (a.text || a.title) : a);
          if (!k || seen[k] || (k.length > 40 && notes.indexOf(k) !== -1)) return false;
          seen[k] = 1; return true;
        }));
      }
      tidyItemText_(sp);
      sentenceCaseHeadings_(sp);
      n++;
    });
    if (n) ctx.log.push(n + ' slide(s) that would have looked empty got their missing content.');
    return n;
  } catch (e) {
    ctx.log.push('Empty-slide check skipped: ' + e.message);
    return 0;
  }
}

// Client results stay on case study slides: a stats figure that is a client's result (same number, same subject as an
// approved client fact) is removed from any other slide
function clientNumbersOnCasesOnly_(slides, ctx) {
  const facts = ((ctx.lib && ctx.lib.companyFacts) || []).filter(function (f) { return f && f.category === 'case_study'; }).map(function (f) { return String(f.statement || ''); });
  if (!facts.length) return 0;
  const norm = function (v) { return String(v || '').toLowerCase().replace(/\s/g, '').replace(/\+$/, ''); };
  let removed = 0;
  slides.forEach(function (sp) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'case_study' || t !== 'stats' || !Array.isArray(sp.items)) return;
    sp.items = sp.items.filter(function (it) {
      const v = norm(it && it.value);
      if (!v || !/\d/.test(v)) return true;
      const words = tokenize_(String((it && it.label) || '') + ' ' + String((it && it.text) || ''));
      const hit = facts.some(function (f) {
        if (norm(f).indexOf(v) === -1) return false;
        const fw = tokenize_(f);
        return words.filter(function (w) { return w.length > 3 && fw.indexOf(w) !== -1; }).length >= 1;
      });
      if (hit) removed++;
      return !hit;
    });
  });
  return removed;
}

// V.1_39: a "current state / future state" (before / after, today / with AI) comparison
function beforeAfterSlide_(sp) {
  if (String((sp && sp.type) || '').toLowerCase() !== 'comparison') return false;
  const l = String((sp.left && (sp.left.label || sp.left.title)) || ''), r = String((sp.right && (sp.right.label || sp.right.title)) || '');
  return /\b(current|today|before|as-is|now|without|old|traditional|manual)\b/i.test(l) && /\b(future|tomorrow|after|to-be|with|new|ai|target)\b/i.test(r);
}
// V.1_39: a stats slide of targets (most labels start "Target:")
function targetStatsSlide_(sp) {
  if (String((sp && sp.type) || '').toLowerCase() !== 'stats' || !Array.isArray(sp.items) || !sp.items.length) return false;
  const t = sp.items.filter(function (it) { return /^\s*targets?\b/i.test(String((it && it.label) || '')); }).length;
  return t >= Math.ceil(sp.items.length / 2) || /\b(kpis?|key performance|targets?|success measures?)\b/i.test(String(sp.title || ''));
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
  const wantsNext = /next\s*steps?|call to action|\bcta\b|action plan/i.test(String(ctx.userPrompt || '')) || (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx));   // V.1_54: a Solution Deck ends with its next step
  // V.1_40: slides removed by a strict rule (never shown: unrequested next steps, credentials, case studies, extra step
  // slides, dividers...) vs. repeats (kept when no new slide can replace them, so the deck keeps its slide count)
  const strictIdx = [];
  let mark = dupIdx.length;
  const markStrict = function () { dupIdx.slice(mark).forEach(function (i) { strictIdx.push(i); }); mark = dupIdx.length; };
  if (!wantsNext) plan.slides.forEach(function (sp, i) {
    if ((String(sp.type || '').toLowerCase() === 'next_steps' || /^\s*(your\s+)?next\s+steps?\b/i.test(String(sp.title || ''))) && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  markStrict();
  // Topics repeated in other words, or one topic split over several slides: Gemini lists them, they get new topics
  topicRepeats_(plan, ctx).forEach(function (i) { if (dupIdx.indexOf(i) === -1) dupIdx.push(i); });
  mark = dupIdx.length;
  // V.1_39: one "current state / future state" slide per deck (deck 15 had two with the same design)
  let beforeAfter = 0;
  plan.slides.forEach(function (sp, i) {
    if (dupIdx.indexOf(i) === -1 && beforeAfterSlide_(sp) && ++beforeAfter > 1) dupIdx.push(i);
  });
  // V.1_39: one slide of targets per deck (deck 15: agent targets on slide 9 and KPI targets on slide 15). The KPI slide stays.
  const targetIdx = [];
  // (also when the number check above already took the KPI slide for a repeat of the other one: the KPI slide is the one kept)
  plan.slides.forEach(function (sp, i) { if (targetStatsSlide_(sp)) targetIdx.push(i); });
  if (targetIdx.length > 1) {
    const kpi = targetIdx.filter(function (i) { return topicFamily_(plan.slides[i], ctx.userPrompt) === 'kpi' || /\b(kpis?|key performance|success|measur)/i.test(String(plan.slides[i].title || '')); })[0];
    const keepT = kpi != null ? kpi : targetIdx.filter(function (i) { return dupIdx.indexOf(i) === -1; })[0];
    if (keepT != null) {
      if (dupIdx.indexOf(keepT) !== -1) dupIdx.splice(dupIdx.indexOf(keepT), 1);
      targetIdx.forEach(function (i) { if (i !== keepT && dupIdx.indexOf(i) === -1) dupIdx.push(i); });
    }
  }
  markStrict();
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
  mark = dupIdx.length;
  // 66degrees credentials / services / accelerators only when the request asks for them
  if (!wantsCredentials_(ctx.userPrompt)) {
    plan.slides.forEach(function (sp, i) {
      const f = topicFamily_(sp, ctx.userPrompt);
      if ((f === 'credentials' || f === 'services' || credentialsContent_(sp)) && dupIdx.indexOf(i) === -1) dupIdx.push(i);
    });
  }
  // Slides off the request's subject (an AI slide in a cloud-cost deck) get a topic the request is about
  plan.slides.forEach(function (sp, i) {
    if (!skip[String(sp.type || '').toLowerCase()] && offTopicAi_(sp, ctx.userPrompt) && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  // Case studies only when the request asks for client proof: then one (two when it asks for "case studies"),
  // the most relevant first. Unrequested case studies are replaced by new topics.
  const caseAsk = CASE_REQUEST_RE_.test(String(ctx.userPrompt || ''));
  const caseMax = !caseAsk ? 0 : (/case studies|success stories|client stories|customer stories|several clients|examples/i.test(String(ctx.userPrompt || '')) ? 2 : 1);
  let casesKept = 0;
  plan.slides.forEach(function (sp, i) {
    if (String(sp.type || '').toLowerCase() !== 'case_study' || dupIdx.indexOf(i) !== -1) return;
    if (++casesKept > caseMax) dupIdx.push(i);
  });
  // Step-by-step slides (process, cycle, framework, phases, steps, lifecycle): at most 2 in a deck of up to 20
  // slides, 3 in a longer deck, so a deck is not five versions of the same loop
  const seqMax = (plan.slides.length > 20 ? 3 : 2) + Math.max(0, (requestedFamilyCounts_(ctx.userPrompt).delivery || 0) + (requestedFamilyCounts_(ctx.userPrompt).roadmap || 0) - 2);
  let seqKept = 0;
  plan.slides.forEach(function (sp, i) {
    if (skip[String(sp.type || '').toLowerCase()] || dupIdx.indexOf(i) !== -1 || !sequenceLike_(sp)) return;
    if (++seqKept > seqMax) dupIdx.push(i);
  });
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
  markStrict();
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
  mark = dupIdx.length;
  // Empty dividers ("section") and comparisons over the limit are replaced too
  const compMax = plan.slides.length >= 14 ? 2 : 1;
  let comps = 0;
  plan.slides.forEach(function (sp, i) {
    const t = String(sp.type || '').toLowerCase();
    if (t === 'section' && dupIdx.indexOf(i) === -1) dupIdx.push(i);
    if (t === 'comparison' && ++comps > compMax && dupIdx.indexOf(i) === -1) dupIdx.push(i);
  });
  markStrict();
  // V.1_39: every topic the request lists gets a slide; a topic whose parts are listed ("phased plan (discovery, pilot in
  // one region, scale)") is rewritten when its slide shows other parts. Slots: the repeats above, then slides that cover
  // no requested topic (the least rich first).
  // V.1_57 (General deck: the requested "90-day starter plan" was removed as a second roadmap): the first slide that covers
  // a topic the request lists is never removed by these checks (slides that must never show stay removed)
  if (typeof solutionProtectedSlides_ === 'function') {
    const keepReq = solutionProtectedSlides_(plan.slides, ctx.userPrompt);
    for (let q = dupIdx.length - 1; q >= 0; q--) {
      const i = dupIdx[q], t = String((plan.slides[i] && plan.slides[i].type) || '').toLowerCase();
      if (keepReq[i] && t !== 'section' && strictIdx.indexOf(i) === -1) dupIdx.splice(q, 1);
    }
  }
  const keptNow = plan.slides.map(function (sp, i) { return dupIdx.indexOf(i) === -1 ? sp : null; });
  const gaps = missingTopics_(keptNow, ctx.userPrompt, skip);
  // V.1_57: a topic counts as covered only when most of its own words are on one slide ("90-day pilot metrics" does not
  // cover "a 90-day starter plan")
  if (typeof solutionTopicCovered_ === 'function') requestedTopics_(ctx.userPrompt).forEach(function (t) {
    if (gaps.missing.indexOf(t) !== -1 || gaps.rework.some(function (r) { return r.topic === t; })) return;
    if (!/[a-z]{3}/i.test(t) || Object.keys(topicStems_(t, true)).length < 2) return;
    if (solutionTopicCovered_(keptNow.filter(Boolean).filter(function (sp) { return !skip[String(sp.type || '').toLowerCase()]; }), t)) return;
    // V.1_58 (deck 31: "Where generative AI helps" was written next to "Three member service workflows" - the same three
    // workflows twice): a slide that already covers the topic loosely is rewritten under the topic's name, in its own
    // slot, unless it is the slide of another requested topic
    const loose = slideForTopic_(keptNow, t, skip);
    const otherOwner = loose !== -1 && requestedTopics_(ctx.userPrompt).some(function (o) { return o !== t && slideForTopic_(keptNow, o, skip) === loose; });
    if (loose !== -1 && !otherOwner) gaps.rework.push({ i: loose, topic: t, retitle: true });
    else gaps.missing.push(t);
  });
  gaps.rework.forEach(function (r) { if (dupIdx.indexOf(r.i) === -1) dupIdx.push(r.i); });
  const topicJobs = gaps.rework.map(function (r) {
    const parts = topicParts_(r.topic);
    if (r.retitle || !parts.length) return r.topic.replace(/\s*\(([^)]*)\)/, ': $1') + ' (rewrite of the slide "' + slideHeading_(plan.slides[r.i]) + '": keep its content, name the topic in the title)';
    return r.topic.replace(/\s*\([^)]*\)/, '') + ': use exactly these parts, in this order, as the items: ' + parts.join(', ');
  }).concat(gaps.missing.map(function (t) { return t.replace(/\s*\(([^)]*)\)/, ': $1'); }));
  if (topicJobs.length > dupIdx.length) {
    const covering = {};
    requestedTopics_(ctx.userPrompt).forEach(function (t) { const i = slideForTopic_(keptNow, t, skip); if (i !== -1) covering[i] = true; });
    const spare = bodyIdx.filter(function (i) {
      const t = String(plan.slides[i].type || '').toLowerCase();
      return dupIdx.indexOf(i) === -1 && !covering[i] && t !== 'case_study' && t !== 'template' && t !== 'team';
    }).sort(function (a, b) {
      return (TYPE_RICHNESS_[String(plan.slides[a].type).toLowerCase()] || 0) - (TYPE_RICHNESS_[String(plan.slides[b].type).toLowerCase()] || 0) || b - a;
    });
    spare.slice(0, topicJobs.length - dupIdx.length).forEach(function (i) { dupIdx.push(i); });
  }
  if (topicJobs.length) ctx.log.push('Requested topics written as new slides: ' + topicJobs.map(function (j) { return j.split(':')[0]; }).join('; ') + '.');
  dupIdx.sort(function (a, b) { return a - b; });
  if (!dupIdx.length) return;
  const titles = plan.slides.filter(function (sp, i) { return dupIdx.indexOf(i) === -1 && !skip[String(sp.type || '').toLowerCase()]; })
    .map(function (sp) { return slideHeading_(sp); });
  const keptSlides = plan.slides.filter(function (sp, i) { return dupIdx.indexOf(i) === -1; });
  const keepsRoadmap = keptSlides.some(roadmapLike_);
  let fresh = [];
  let replacePrompt = '';
  try {
    const prompt = [
      'The request: ' + String(ctx.userPrompt || '').slice(0, 600),
      'A ' + ctx.brand.name + ' presentation titled "' + (plan.deck_title || '') + '" has these slides:',
      titles.map(function (t, k) { return (k + 1) + '. ' + t; }).join('\n'),
      '',
      'Write ' + (dupIdx.length + 3) + ' NEW body slide(s) on topics the deck does not cover yet, in the same JSON slide format (the best ' + dupIdx.length + ' are used).',
      topicJobs.length ? 'The first ' + Math.min(topicJobs.length, dupIdx.length) + ' new slides are the REQUIRED slides listed below, in that order.' : '',
      'Stay on the subject of the request; no AI, security or other side topics the request does not mention.',
      requestedTopics_(ctx.userPrompt).length ? 'The request asks for these topics, in this order: ' + requestedTopics_(ctx.userPrompt).join('; ') +
        '. FIRST write a slide for every requested topic that no slide above covers yet (e.g. "how we deliver" = a process slide with ' +
        'the delivery steps; "KPIs" = a stats slide with target numbers, labels starting "Target:").' : '',
      topicJobs.length ? 'THESE SLIDES ARE REQUIRED, one each, in this order (they come first among the new slides):\n' +
        topicJobs.map(function (j, k) { return (k + 1) + '. ' + j; }).join('\n') + '\n' +
        'How to write them: goals = cards with the client\'s goals as the request states them (no invented numbers); architecture = ' +
        'a "diagram" with center (the platform) and items[{title, text}] (4-6 components named as the request names them, each saying ' +
        'what it does and what it connects to); security or data approach = cards on how data is protected and governed (access, ' +
        'encryption, residency, monitoring), only what Google Cloud provides; team structure = cards whose items are roles ' +
        '(title "Engagement lead", "Solution architect"..., text = what the role does; a client role ends its TITLE with the client name in brackets, e.g. "Retail operations lead (Apple)", never "(client)" in the text), never names of people; ' +
        'a phased plan = a "process" slide whose items are exactly the phases listed.' : '',
      needCase ? 'The FIRST new slide MUST be a case study (type "case_study", one client) built ONLY on the approved client result below\n' +
        'whose work is closest to the request (the same kind of work: data platform, analytics, cost savings...). Fields: title (names the\n' +
        'client), industry, challenge (2-3 sentences), solution [3-4 points of 15-25 words], results[{value, label}] (2-3, numbers copied\n' +
        'exactly from the fact), outcome (1-2 sentences). Put the fact ID in fact_tags.\nAPPROVED CLIENT RESULTS:\n' +
        caseFacts.slice(0, 3).map(function (f) { return '- ' + f; }).join('\n') : '',
      'Allowed types' + (needCase ? ' for the other slides' : '') + ': process (title, lead, items[{title, text}] 3-5),',
      'stats (title, items[{value, label, text}] 3-4), comparison (title, left{label, points[]}, right{label, points[]}),',
      'diagram (title, lead, center, items[{title, text}] 4-6, 8-20 words each), cards (only if nothing else fits: title, lead, items[{title, text}] 3-4)' +
        (keepsRoadmap ? '.' : ', timeline (title, items[{label, title, text}] 3-5).'),
      (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx)
        ? 'Each new slide takes a different angle that the request supports (how it works, how it is built or run, what each team does differently). No risk, KPI, scope or assumptions slide unless the request asks. '
        : 'Each new slide takes a different angle that the request supports (how it works, risks and how to manage them, what changes for each team, decisions to make). ') +
      'No 66degrees credentials, services or accelerators slide. ' +
        (caseMax ? '' : 'No case study or client story slide. ') +
        (seqKept >= seqMax ? 'No process, steps, phases, cycle, lifecycle or framework slide: the deck already has its step-by-step slides. ' : '') + (keepsRoadmap ? 'The deck already has its roadmap: never write another roadmap, phases, ' +
        'quarters, timeline, quick wins or "early value" slide. ' : '') + 'No summary or "future of" slide.',
      'Sentence-case titles and headings (role names too: "Engagement lead"), max 58 characters. No invented numbers, clients or quotes.',
      'Gemini and Vertex AI Search are configured and grounded in the client\'s content: never write that anyone trains them or builds "Vertex AI Search models".',
      'Never write "X is no longer Y; it is Z" or "not just X, but Y": state the point directly. No outcome or target slide when the deck already has one.',
      'Return ONLY JSON: {"slides":[...]}'
    ].filter(Boolean).join('\n');
    const out = withContentModel_(ctx, function () { return callGeminiJSON([{ text: prompt }], ctx.apiKey, 0.2); });   // V.1_56: client-facing text (V.1_70: was 0.6)
    fresh = ((out && out.slides) || []).map(function (sp) { return ENGINE.cleanSpec(sp); });
    replacePrompt = prompt;
  } catch (e) {
    ctx.log.push('Duplicate slide check: could not write a replacement (' + e.message + ').');
  }
  // A new slide is used only when it really is new (no second roadmap, no repeat of a kept slide)
  const keptWords = keptSlides.map(function (sp) { return slideWords_(sp); });
  let roadmapNow = keepsRoadmap;
  let seqNow = keptSlides.filter(function (sp) { return !skip[String(sp.type || '').toLowerCase()] && sequenceLike_(sp); }).length;
  let casesNow = keptSlides.filter(function (sp) { return String(sp.type || '').toLowerCase() === 'case_study'; }).length;
  const required = Math.min(topicJobs.length, dupIdx.length);
  const acceptFresh = function (sp, fi) {
    const t = String(sp.type || '').toLowerCase();
    if (fi < required && t !== 'case_study') {                  // a slide the request asks for is kept (V.1_39)
      if (sequenceLike_(sp)) seqNow++;
      if (roadmapLike_(sp)) roadmapNow = true;
      keptWords.push(slideWords_(sp));
      return true;
    }
    if (t === 'case_study' && casesNow >= Math.max(caseMax, needCase ? 1 : 0)) return false;   // no unrequested client stories
    if (t !== 'case_study' && sequenceLike_(sp)) { if (seqNow >= seqMax) return false; seqNow++; }
    if (t === 'case_study') {
      casesNow++;
      if (Array.isArray(sp.results)) sp.results = sp.results.filter(function (r) { return r && /\d/.test(String(r.value || '')); });
      splitCaseSteps_(sp);
      return !!(sp.challenge || (sp.results || []).length);
    }
    if (roadmapLike_(sp)) { if (roadmapNow) return false; roadmapNow = true; }
    if (!wantsCredentials_(ctx.userPrompt) && (credentialsContent_(sp) || /^(credentials|services)$/.test(String(topicFamily_(sp, ctx.userPrompt))))) return false;
    if (offTopicAi_(sp, ctx.userPrompt)) return false;
    // V.1_40: a new slide never repeats the topic family of a kept slide ("Business outcomes" next to "Outcome targets")
    const fam = topicFamily_(sp, ctx.userPrompt);
    if (fam && fam !== 'roadmap' && keptSlides.some(function (k) { return topicFamily_(k, ctx.userPrompt) === fam; }) && !(askedFam[fam] > 1)) return false;
    if (targetStatsSlide_(sp) && keptSlides.some(targetStatsSlide_)) return false;
    if (beforeAfterSlide_(sp) && keptSlides.some(beforeAfterSlide_)) return false;
    const w = slideWords_(sp);
    if (keptWords.some(function (kw) { return overlap_(w, kw) >= 0.6; })) return false;
    keptWords.push(w);                                     // two new slides never repeat each other either
    return true;
  };
  fresh = fresh.filter(acceptFresh);
  // V.1_57 (General deck had 14 of 15 slides): too few usable new slides -> one more try for the missing ones, as cards,
  // tables or stats on angles the deck does not have yet (the deck keeps the slide count asked for)
  if (replacePrompt && fresh.length < dupIdx.length) {
    try {
      const short = dupIdx.length - fresh.length;
      const again = withContentModel_(ctx, function () { return callGeminiJSON([{ text: replacePrompt + '\nThese new slides are already written: ' +
        fresh.map(function (f) { return f.title; }).join(' | ') + '.\nNow write ' + (short + 2) + ' MORE slides, each of type cards, table or stats only, on angles none of the slides above covers.' }], ctx.apiKey, 0.7); });
      ((again && again.slides) || []).map(function (sp) { return ENGINE.cleanSpec(sp); }).forEach(function (sp) {
        if (fresh.length < dupIdx.length && acceptFresh(sp, required + fresh.length)) fresh.push(sp);
      });
    } catch (e) { ctx.log.push('Duplicate slide check: second try failed (' + e.message + ').'); }
  }
  let k = 0;
  const kept = [];
  const keptBack = [];
  plan.slides.forEach(function (sp, i) {
    if (dupIdx.indexOf(i) === -1) { kept.push(sp); return; }
    // every removed slide gets a new one (the deck keeps the slide count asked for)
    if (fresh[k]) {
      removeHypeWords_(fresh[k]); tidyItemText_(fresh[k]); sentenceCaseHeadings_(fresh[k]);
      if (sp.section && !fresh[k].section) fresh[k].section = sp.section;     // V.1_42: stays in the proposal section it replaces
      kept.push(fresh[k]);
    }
    else {
      // V.1_40: the deck keeps the slide count asked for (deck 16 had 19 of 20): a repeat stays rather than leaving a gap,
      // except slides that must never be shown (an unrequested next-steps slide, an empty divider)
      // the whole deck as it will be (kept slides, the new ones, slides already kept back) must still follow the limits
      const ty = String(sp.type || '').toLowerCase();
      const deckNow = keptSlides.concat(fresh).concat(keptBack);
      const seqIn = deckNow.filter(function (x) { return !skip[String(x.type || '').toLowerCase()] && sequenceLike_(x); }).length;
      const breaks = (sequenceLike_(sp) && seqIn >= seqMax) || (roadmapLike_(sp) && deckNow.some(roadmapLike_)) ||
        (ty === 'case_study' && deckNow.filter(function (x) { return String(x.type || '').toLowerCase() === 'case_study'; }).length >= caseMax) ||
        (beforeAfterSlide_(sp) && deckNow.some(beforeAfterSlide_)) || (targetStatsSlide_(sp) && deckNow.some(targetStatsSlide_)) ||
        ty === 'section' || ty === 'next_steps' || (!wantsNext && /^\s*(your\s+)?next\s+steps?\b/i.test(String(sp.title || ''))) ||
        (!wantsCredentials_(ctx.userPrompt) && (credentialsContent_(sp) || /^(credentials|services)$/.test(String(topicFamily_(sp, ctx.userPrompt))))) ||
        offTopicAi_(sp, ctx.userPrompt) || fillerSlide_(sp, false);
      if (strictIdx.indexOf(i) === -1 && !breaks) {
        keptBack.push(sp); kept.push(sp); ctx.log.push('No new topic was found for "' + String(sp.title || '').slice(0, 60) + '": it stays.'); }
      else ctx.log.push('No new topic was found for one removed slide.');
    }
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
    const before = sp.items.slice();
    sp.items = keepStatsShown_(before, sp.items.filter(function (it) {
      const v = norm(it && it.value);
      if (isTargetStat_(it)) return true;                              // a target is a goal, it may share a value with a finding
      if (v && seen[v]) return false;
      if (v) seen[v] = true;
      return true;
    }));
  });
}
// V.1_47: a KPI target ("Target: forecast accuracy") is a goal, not a finding
function isTargetStat_(it) {
  return !!it && (/^\s*(targets?|goal)\b/i.test(String(it.value || '')) || /^\s*(targets?|goal)\b/i.test(String(it.label || '')));
}
// V.1_47: removing repeated figures never empties a stats slide: with fewer than 2 left, the slide keeps its own figures (the empty-slide check adds targets to a slide with 2)
function keepStatsShown_(before, after) {
  return after.length >= 2 || after.length >= before.length ? after : before;
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
    presentationTypes: DECK_TYPES_.slice(),
    departments: DEPARTMENTS.slice(),
    minSlides: 3,
    maxSlides: MAX_SLIDES_,
    hasVertexConfig: isVertexConfigured_()
  };
}

// V.1_62: a run part with its token usage written to BigQuery (UsageLog.gs); without that file the part just runs
function withUsage_(info, fn) {
  return typeof usageRun_ === 'function' ? usageRun_(info, fn) : fn();
}
function runDeckGeneration(data) {
  data = data || {};
  // V.1_62: every run part writes its token usage to BigQuery (UsageLog.gs); the result is passed on unchanged
  let category = '';
  try { category = normalizePresentationType_(data.presentationType || data.type); } catch (e) {}
  return withUsage_({ runId: data.runId, mode: String(data.mode || '').toLowerCase() === 'rebrand' ? 'Rebrand' : 'Create', category: category || 'General' },
    function () { return generatePresentation(data); });
}

/* =========================
   LONG RUNS (V.1_27+): up to 200 slides
   One Apps Script run stops after 6 minutes, so a long deck (more than 20 slides) or a large rebrand is built in parts.
   Each run does as much as fits in ~4.5 minutes, saves where it stopped and returns { continue: true }; the panel then
   calls continueDeckGeneration(runId) for the next part, until the deck is finished.
========================= */
const AGENT_VERSION_ = '66° Deck Agent V.1_73';   // shown in every result message (which version made the deck)
const MAX_SLIDES_ = 200;            // panel and server limit, Create and Rebrand
const SINGLE_RUN_MAX_ = 20;         // decks up to this size are made in one run (the full single-run pipeline)
const LONG_BATCH_ = 8;              // slides written, fitted and drawn together in a long deck
const REBRAND_CHUNK_ = 10;          // slides rebranded together
const RUN_BUDGET_MS_ = 270000;      // stop starting new parts after ~4.5 minutes

function continueDeckGeneration(runId) {
  return withUsage_({ runId: String(runId || '').slice(0, 60) }, function () { return continueDeckGeneration_(runId); });   // V.1_62
}
function continueDeckGeneration_(runId) {
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
    try { if (st && st.workId) trashDriveFile(st.workId); } catch (e3) {}            // V.1_51: no working copy left behind
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
  if (st && typeof st === 'object') st.models = mergeModelsUsed_(st.models);   // V.1_56: models used, kept across the parts
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
    message: done + ' of ' + total + ' slides ' + what + ' — continuing' + (what === 'written' ? ' (all slides appear in the presentation together when the deck is ready)' : '') };
}

/* ---------- Long Create decks ---------- */

// The outline of a long deck: sections with one line per slide (type, title, what it covers). Fixed before any slide is
// written, so every slide has its own topic and the agenda is right from the start.
function planOutline_(userPrompt, presentationType, n, sources, ctx) {
  const proposalOutline = typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx);   // V.1_42: workstream dividers
  const libOutline = isLibraryDeck_(ctx);                                                  // V.1_52: Proposal or Solution Deck
  const solutionOutline = deckLibraryOf_(ctx) === 'solution';
  // (V.1_51: Proposal Decks of 10-24 slides also come here: fewer sections for a shorter deck)
  const sections = libOutline && n < 25 ? (n <= 13 ? 2 : n <= 18 ? 3 : 4) : Math.max(4, Math.min(12, Math.round((n - 3) / 8)));
  // V.1_57 (decision 1-A): a Proposal or Solution Deck under 18 slides has no divider slides (the agenda still shows the
  // sections), so every requested topic has room for its own slide
  const noDividers = libOutline && n < 18;
  if (noDividers && ctx && ctx.log) ctx.log.push('V.1_57: ' + n + '-slide deck: no section divider slides (under 18 slides), so every slot holds content.');
  const dividerSlots = function (k) { return noDividers ? 0 : k; };
  let body = n - 3 - dividerSlots(sections);            // cover, agenda, closing and one divider per section are added by the code
  const topics = requestedTopics_(userPrompt);
  const facts = libraryFacts(ctx.lib, [userPrompt, presentationType, String(sources.text || '').slice(0, 4000)].join(' '), 30);
  ctx.userPrompt = userPrompt;
  setRunNames_(userPrompt, [ctx.clientName, ctx.proposal && ctx.proposal.client && ctx.proposal.client.name]);   // V.1_39
  // V.1_47: client case studies only when the request asks for them (never an unrequested client story)
  const wantsCaseStudy = CASE_REQUEST_RE_.test(String(userPrompt || ''));
  const caseFacts = wantsCaseStudy ? caseStudyFacts_(ctx).slice(0, 3) : [];   // the most relevant client results only
  const prompt = [
    'You are the senior presentation strategist for ' + ctx.brand.name + '. Plan the OUTLINE of a long presentation.',
    'REQUEST: "' + (userPrompt || 'Build the presentation from the attached source material.') + '"',
    typeof briefPromptBlock_ === 'function' ? briefPromptBlock_(ctx) : '',                                        // V.1_70
    'PRESENTATION TYPE: ' + presentationType + '   DEPARTMENT: ' + (ctx.department || 'Other'),
    'BODY SLIDES: exactly ' + body + ' (the code adds the cover, the agenda, the closing and one divider per section), grouped into ' + sections +
    ' sections of similar size (each section ' + Math.max(3, Math.floor(body / sections) - 1) + '-' + (Math.ceil(body / sections) + 1) + ' slides).',
    'Each section has a "description": one line (max 70 characters) saying what the section shows, e.g. "Why manual FP&A can no longer keep up".',
    'Keep every slide in the section it belongs to (a data platform slide never sits in the results section).',
    topics.length ? 'The request lists these topics in this order - the sections follow this order: ' + topics.join('; ') + '.' : '',
    'Section names are topics of the request (e.g. "Current state and target architecture"), never a target or a figure (never "99.9% availability" or "Query throughput acceleration"). Each topic of the request gets exactly one slide.',   // V.1_71
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
    caseFacts.length ? caseFacts.map(function (f) { return '  - ' + f; }).join('\n') : '  (none: the request does not ask for client stories, so no case_study slides)',
    topics.length ? '- EVERY topic the request lists gets at least one slide whose title names it (e.g. "risks" -> a slide about the risks and how they are handled).' : '',
    '- Slides about the client\'s current situation, needs or challenges belong in the FIRST section, never in a later one.',
    '- An architecture slide is type "diagram" (it is drawn as an architecture diagram). Methodology / phases and the roadmap are two different slides at most; no other slide is written as phases.',
    '- Team and governance are ONE slide (the team with its governance), never two.',
    '- No hype words (revolutionize, game-changer, cutting-edge, unprecedented). Never invent product or feature names.',
    '- Titles: the key message in sentence case, max 58 characters, all different. "brief": one line on what the slide covers.',
    '- Section titles: 2-6 words, sentence case.',
    proposalOutline ? '- Proposal Deck: a section that holds two or more separate workstreams (e.g. a technical workstream and a change management ' +
      'workstream) may start each workstream with a slide of type "workstream" whose title is the workstream name (2-4 words). It counts as a body ' +
      'slide. At most 4 "workstream" slides in the deck, only where a section really has workstreams.' : '',
    facts.usable.length ? 'APPROVED FACTS (the only claims about ' + ctx.brand.name + '):\n' + facts.usable.map(function (f) { return '- ' + f; }).join('\n') : '',
    sources.research && sources.research.length ? formatSciteForPrompt(sources.research, sources.researchProvider) : '',
    sources.text ? 'USER SOURCE MATERIAL:\n' + String(sources.text).slice(0, 12000) : '',
    '- Stats slides: each label is words only (never a second number inside the label).',
    '- Client results (savings, percentages from the client facts) appear ONLY on case_study slides.',
    // V.1_51: a Proposal Deck outline is a storyline: what each section proves, and per slide its one message and the points
    // only it covers (the slides are later written from this plan, so nothing is repeated)
    proposalOutline ? [
      'THINK LIKE THE PARTNER WHO WILL PRESENT THIS PROPOSAL. First decide the argument, then the slides:',
      '- The sections tell ONE story for ' + (ctx.clientName || 'the client') + ': (1) what the client faces and needs, (2) what we propose and how it works,',
      '  (3) how we deliver it safely (data, security, plan, change), (4) who does it, the risks and how success is measured.',
      '- Each section has a "storyline": one sentence saying what the section proves to the client.',
      '- Each slide has a "message": the ONE thing it proves (max 110 characters), and "points": 2-4 short phrases (3-8 words) that ONLY this slide',
      '  covers. A point (a challenge, a benefit, a product capability, a figure) never appears on two slides.',
      '- The Google Cloud products are explained on at most two slides (the architecture and one more); never one slide per product.',
      '- The client\'s challenges are ONE slide (never "challenges" + "pain points" + "business case" saying the same things).',
      '- The delivery is at most two slides: the methodology OR the phased plan, and the roadmap (a timeline with periods). Never three plan slides.',
      '- No slide about "future growth", "sustained innovation" or "what\'s next" unless the request asks for it.',
      '- A loop (continuous improvement, retraining) is a process; data sources are a table or the architecture, never a journey.'
    ].join('\n') : '',
    solutionOutline && typeof solutionOutlineRules_ === 'function' ? solutionOutlineRules_(ctx) : '',
    libOutline
      ? 'Return ONLY JSON: {"deck_title":"","subtitle":"","closing_subtitle":"","sections":[{"title":"","description":"","storyline":"","slides":[{"type":"","title":"","message":"","points":[""],"brief":""}]}]}'
      : 'Return ONLY JSON: {"deck_title":"","subtitle":"","closing_subtitle":"","sections":[{"title":"","description":"","slides":[{"type":"","title":"","brief":""}]}]}'
  ].filter(Boolean).join('\n');
  const parts = [{ text: prompt }];
  (sources.pdfs || []).forEach(function (b64) { parts.push({ inline_data: { mime_type: 'application/pdf', data: b64 } }); });
  (sources.images || []).forEach(function (im) { parts.push({ inline_data: { mime_type: im.mime, data: im.data } }); });
  // V.1_51: the storyline is planned by the stronger model (one call per deck); the slides are written with the usual one
  const out = withModel_(libOutline ? outlineModel_() : '', function () { return callGeminiJSON(parts, ctx.apiKey, libOutline ? 0.2 : 0.3); });   // V.1_70: was 0.5 / 0.6
  const allowed = { cards: 1, process: 1, timeline: 1, stats: 1, chart: 1, comparison: 1, diagram: 1, table: 1, case_study: 1, bullets: 1, statement: 1, team: 1 };
  const seen = {};
  const secs = [];
  const keyOf = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  const entryOf = function (o, noTeamCase) {
    const t = String(o.type || '').toLowerCase();
    const sl = { type: allowed[t] && !(noTeamCase && (t === 'team' || t === 'case_study')) ? t : (noTeamCase ? 'diagram' : 'cards'),
      title: sentenceCase_(removeHypeText_(String(o.title).slice(0, 80)), 2), brief: removeHypeText_(String(o.brief || o.message || '').slice(0, 200)) };
    // V.1_51: the slide's plan: its one message and the points only it covers
    if (o.message) sl.message = removeHypeText_(String(o.message).slice(0, 160));
    if (Array.isArray(o.points)) sl.points = o.points.map(function (p) { return removeHypeText_(String(p || '').slice(0, 80)); }).filter(Boolean).slice(0, 4);
    // (a Proposal Deck shows its team as roles, no names needed: the team / governance slide is a team slide there)
    if (proposalOutline && sl.type !== 'case_study' && topicFamily_(sl, userPrompt) === 'team') sl.type = 'team';
    if (sl.type === 'team' && !libOutline && !/\b[A-Z][a-z]+ [A-Z][a-z]+/.test(String(userPrompt || '') + ' ' + String(sources.text || ''))) sl.type = 'cards';
    if (/\barchitecture\b/i.test(sl.title + ' ' + sl.brief) && ['cards', 'bullets', 'statement', 'process'].indexOf(sl.type) !== -1) sl.type = 'diagram';   // V.1_47
    return sl;
  };
  let total = 0;
  ((out && out.sections) || []).forEach(function (sec) {
    const list = [];
    ((sec && sec.slides) || []).forEach(function (o) {
      if (!o || !o.title || total >= body * 3) return;                  // V.1_51: fitted to the slide count below, across all sections
      const key = keyOf(o.title);
      if (seen[key]) return;
      const t = String(o.type || '').toLowerCase();
      if (t === 'case_study' && !wantsCaseStudy) return;                 // V.1_47: no unrequested client story
      if (key === keyOf(sec && sec.title)) return;                        // V.1_48: a slide named like its section repeats the divider
      seen[key] = true;
      // a workstream inside a section: the light divider (title only, no number)
      // V.1_69 (deck 41 Proposal 10, 13: unnumbered dark dividers inside a section): no workstream dividers - every
      // transition slide is a numbered section; a workstream Gemini names is not a slide of its own
      if (t === 'workstream') return;
      if (proposalOutline && t === 'workstream') {
        if (n < 25) return;                                               // V.1_51: a short deck has no workstream dividers
        if (secs.concat([{ list: list }]).reduce(function (a, x) { return a + x.list.filter(function (y) { return y.level === 2; }).length; }, 0) >= 4) return;
        list.push({ type: 'section', level: 2, title: sentenceCase_(String(o.title).slice(0, 60), 1), brief: '' });
        total++;
        return;
      }
      list.push(entryOf(o));
      total++;
    });
    if (list.length) secs.push({ title: sentenceCase_(String(sec.title || 'Section ' + (secs.length + 1)), 2), description: String(sec.description || '').slice(0, 90),
      storyline: String(sec.storyline || '').slice(0, 200), list: list });
  });
  if (!secs.length) throw new Error('Gemini returned no outline for the long deck.');
  // V.1_51: an outline longer than asked keeps every section (before, the first sections took all the room and the
  // roadmap, team, risks and KPIs at the end were lost); a short deck keeps the number of sections it can hold
  if (libOutline) fitOutlineToBody_(secs, sections, n, userPrompt, noDividers);
  dropEmptyWorkstreams_(secs);                                           // V.1_50: a workstream divider has its slides
  if (secs.length > 12) { secs.slice(12).forEach(function (sc) { secs[11].list = secs[11].list.concat(sc.list); }); secs.length = 12; }
  body = n - 3 - dividerSlots(secs.length);             // V.1_47: one divider per section Gemini actually wrote (exact slide count)
  const flat = function () { return secs.reduce(function (a, sc) { return a.concat(sc.list); }, []); };
  // The same checks as a short deck, on the outline: no unrequested credentials, one roadmap, no filler, each topic
  // family at most once per ~20 slides; removed entries are replaced by new topics in the same place
  const all0 = flat();
  const checkOpts = solutionOutline ? { solution: true, tone: ctx.solutionTone || 'executive' } : null;   // V.1_53
  const removedIdx = outlineChecks_(all0, userPrompt, n, null, checkOpts);
  const removedSet = removedIdx.map(function (i) { return all0[i]; });
  // where each removed entry was (its section), so its replacement takes its place
  const holes = [];
  secs.forEach(function (sc, k) {
    sc.list = sc.list.filter(function (o) {
      if (removedSet.indexOf(o) === -1) return true;
      holes.push(k);
      return false;
    });
  });
  // V.1_47: every topic the request lists is in the outline (a requested "risks" topic always gets its slide)
  // (a requested topic named by a section, e.g. "Understanding Unilever's needs", is covered by that section's slides)
  // (V.1_54, deck 25: in a Solution Deck a section title never covers a topic: every listed topic has its own slide)
  const asOutline = function () { return secs.reduce(function (a, sc) { return a.concat(sc.list.map(function (o) { return { type: o.type, title: o.title, lead: o.brief, section: solutionOutline ? '' : sc.title }; })); }, []); };
  // (a topic without its own words, e.g. "our approach", cannot be checked and is left to the outline)
  const checkable = function (list) { return list.filter(function (m) { return Object.keys(topicStems_(m, true)).length > 0; }); };
  let missing = checkable(missingTopics_(asOutline(), userPrompt, { section: 1 }).missing);
  if (solutionOutline && typeof solutionTopicCovered_ === 'function') missing = missing.filter(function (m) { return !solutionTopicCovered_(flat(), m); });   // V.1_54
  // room for the missing topics: the largest section gives up its last slide (never below 3 slides)
  let room = body - flat().length;
  while (room < missing.length) {
    const big = secs.slice().sort(function (a, b) { return b.list.length - a.list.length; })[0];
    if (!big || big.list.length <= 3) break;
    big.list.pop();
    room++;
  }
  // New slides: the requested topics first, then new topics until the outline has exactly `body` slides (two tries)
  for (let attempt = 0; attempt < 3 && flat().length < body; attempt++) {         // (V.1_50: three tries)
    const want = body - flat().length;
    let fresh = [];
    try {
      const topPrompt = [
        'A long presentation for the request "' + String(userPrompt || '').slice(0, 400) + '" has these slides:',
        flat().map(function (o) { return o.title; }).join(' | '),
        'Write exactly ' + want + ' NEW slides on topics none of these slides covers.',
        missing.length ? 'The first ' + Math.min(want, missing.length) + ' slide(s) MUST cover these requested topics (one each, the topic named in the title): ' + missing.slice(0, want).join('; ') + '.' : 'Requested topics first: ' + (topics.join('; ') || 'any') + '.',
        'No 66degrees credentials, services, accelerators, roadmap, summary or "future of" slides' + (wantsCaseStudy ? '' : ', no client case studies') + '. Types: process, diagram, comparison,',
        'table, stats (real numbers or targets), cards. Titles in sentence case, max 58 characters. Add "section": the number (1-' + secs.length + ') of the section it belongs to: ' +
          secs.map(function (sc, k) { return (k + 1) + ' ' + sc.title; }).join(', ') + '.',
        'Each slide also has "message" (what it proves, max 110 characters) and "points" (2-4 short phrases only it covers).',
        'Return ONLY JSON: {"slides":[{"type":"","title":"","message":"","points":[""],"brief":"","section":1}]}'
      ].join('\n');
      const extra = withContentModel_(ctx, function () { return callGeminiJSON([{ text: topPrompt }], ctx.apiKey, 0.2); });   // V.1_56 (V.1_70: was 0.6)
      const before = flat();
      fresh = ((extra && extra.slides) || []).filter(function (o) {
        if (!o || !o.title) return false;
        const key = keyOf(o.title);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      }).map(function (o) { const e = entryOf(o, true); e.sec = parseInt(o.section, 10); return e; })
        // a slide written for a requested topic is kept even when its topic family is already in the deck
        .filter(function (o) { return missing.some(function (m) { return slideForTopic_([{ type: o.type, title: o.title, lead: o.brief }], m) !== -1; }) ||
          !outlineChecks_([o], userPrompt, n, before, checkOpts).length; }).slice(0, want);
    } catch (e) { ctx.log.push('Outline top-up skipped: ' + e.message); }
    fresh.forEach(function (o) { placeInSection_(secs, o, holes); });
    missing = checkable(missingTopics_(asOutline(), userPrompt, { section: 1 }).missing);
    if (solutionOutline && typeof solutionTopicCovered_ === 'function') missing = missing.filter(function (m) { return !solutionTopicCovered_(flat(), m); });
  }
  // A requested topic Gemini still left out gets the standard slide of its family ("risks" -> key risks and how we
  // mitigate them): in a free place, or instead of the last slide of the largest section that no requested topic needs
  const reqTopics = requestedTopics_(userPrompt);
  missing.forEach(function (m) {
    const fam = topicFamily_({ title: m }, userPrompt);
    const std = OUTLINE_BACKLOG_.filter(function (b) { return fam && topicFamily_(b, userPrompt) === fam; })[0];
    const entry = solutionOutline && typeof solutionTopicEntry_ === 'function' && !(std && RISK_TITLE_RE_.test(std.title)) ? solutionTopicEntry_(m)   // V.1_54: its own slide, of the type its words call for
      : std ? Object.assign({}, std) : { type: 'cards', title: richTopicTitle_(m), brief: 'The requested topic: ' + m };
    // V.1_71: a requested topic the deck already shows once (in other words) is not added again
    const ofE = onceTopicOfEntry_(entry);
    if (ofE && flat().some(function (o) { return o && o.type !== 'section' && onceTopicOfEntry_(o) === ofE; })) return;
    if (seen[keyOf(entry.title)]) return;
    seen[keyOf(entry.title)] = true;
    if (flat().length < body) { placeInSection_(secs, entry, holes); return; }
    const order = secs.slice().sort(function (a, b) { return b.list.length - a.list.length; });
    for (let q = 0; q < order.length; q++) {
      const list = order[q].list;
      for (let j = list.length - 1; j >= 1; j--) {
        const o = list[j];
        if (['section', 'team', 'timeline', 'case_study'].indexOf(o.type) !== -1) continue;
        if (reqTopics.some(function (t) { return slideForTopic_([{ type: o.type, title: o.title, lead: o.brief }], t) !== -1; })) continue;
        list.splice(j, 1);
        placeInSection_(secs, entry, []);
        return;
      }
    }
  });
  // V.1_68 (deck 40 Proposal: two "Scope" slides): a topic a deck shows once keeps its first slide; the place of a later
  // one is filled below like any other free place (the deck keeps its slide count)
  {
    const onceSeen = {};
    // V.1_69 (deck 41 Proposal 25 "Joint team structure and RACI governance matrix"): when the request asks for both, a
    // slide that joins two once-only topics keeps the first one; the second gets its own slide (added below)
    const asked = onceTopicsIn_(userPrompt);
    secs.forEach(function (sc) {
      sc.list.forEach(function (o) {
        if (!o || o.type === 'section') return;
        const fams = onceTopicsOf_(o.title);
        // (V.1_72, deck 43 Solution 25 "Delivery team and RACI governance": a slide joining two once-only topics keeps one,
        //  also when the request does not ask for both)
        if (fams.length >= 2) {
          const parts = String(o.title).split(/\s+(?:and|&|with)\s+/i);
          const keepAsked = parts.filter(function (pt) { const f = onceTopicOf_(pt); return f && asked.indexOf(f) !== -1; })[0];
          o.title = sentenceCase_(keepAsked || parts[0], 1);
          ctx.log.push('Outline: "' + o.title + '" keeps one topic' + (fams.every(function (f) { return asked.indexOf(f) !== -1; }) ? '; the other gets its own slide.' : '.'));
        }
      });
    });
    secs.forEach(function (sc) {
      sc.list = sc.list.filter(function (o) {
        if (!o || o.type === 'section') return true;
        const f = onceTopicOfEntry_(o);
        if (!f) return true;
        onceSeen.__n = onceSeen.__n || {};   // (V.1_73: a second slide of a topic only on another angle - few shared words)
        if ((onceSeen.__n[f] || 0) >= onceLimit_(f, n) || ((onceSeen.__n[f] || 0) >= 1 && sharedWords_(String(o.title || ''), String(onceSeen[f] || '')) >= 2)) { ctx.log.push('Outline: "' + String(o.title).slice(0, 60) + '" left out (the deck already has "' + String(onceSeen[f]).slice(0, 50) + '").'); return false; }
        onceSeen.__n[f] = (onceSeen.__n[f] || 0) + 1;
        onceSeen[f] = o.title;
        return true;
      });
    });
  }
  // Last resort (Gemini gave too few): standard proposal topics the deck does not have yet, so the deck has the slides asked for
  // V.1_54: a Solution Deck fills with solution topics of its tone, never the Proposal list (risks, KPIs, scope...)
  const backlog = solutionOutline && typeof solutionBacklog_ === 'function' ? solutionBacklog_(ctx.solutionTone || 'executive', userPrompt) : null;
  if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, holes, backlog);
  if (removedIdx.length) ctx.log.push('Outline: ' + removedIdx.length + ' slide(s) replaced (unrequested credentials, repeated topics, a second roadmap or filler).');
  // a section left without slides would lose its divider: its place goes to one more body slide
  for (let k = secs.length - 1; k >= 0 && secs.length > 1; k--) {
    if (!secs[k].list.length) { secs.splice(k, 1); body += dividerSlots(1); }
  }
  if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, [], backlog);
  if (flat().length > body) {                           // never more than asked: the largest section gives back
    while (flat().length > body) { const big = secs.slice().sort(function (a, b) { return b.list.length - a.list.length; })[0]; big.list.pop(); }
  }
  // V.1_56 (decks 27-29): a Solution Deck always ends its body with the next step (a slide, not a line on the closing)
  const isNextStep = function (o) { return o && o.type !== 'section' && (/\bnext steps?\b|getting started|first step|kick-?off|the ask\b|decision needed/i.test(String(o.title || '')) ||
    (typeof solutionTopicCovered_ === 'function' && solutionTopicCovered_([o], 'next step'))); };
  if (solutionOutline && typeof solutionTopicEntry_ === 'function' && secs.length && !flat().some(isNextStep)) {
    const nextEntry = solutionTopicEntry_('next steps');
    const last = secs[secs.length - 1].list;
    if (flat().length >= body) {
      for (let j = last.length - 1; j >= 0; j--) {
        const o = last[j];
        if (o.type === 'section' || reqTopics.some(function (t) { return typeof solutionTopicCovered_ === 'function' && solutionTopicCovered_([o], t); })) continue;
        last.splice(j, 1);
        break;
      }
    }
    if (flat().length < body) { last.push(nextEntry); seen[keyOf(nextEntry.title)] = true; ctx.log.push('Outline: a next-steps slide was added at the end.'); }
  }
  // V.1_47: a slide that names an earlier section's subject sits in that section ("current forecasting needs" -> 01 Needs)
  moveSlidesToTheirSection_(secs);
  // V.1_53: a Solution Deck's sections have a similar number of slides (deck 24: 8 / 4 / 5 / 7)
  if (solutionOutline && typeof solutionBalanceSections_ === 'function') {
    const moved = solutionBalanceSections_(secs);
    if (moved) ctx.log.push('Outline: ' + moved + ' slide(s) moved to the next or previous section so the sections have a similar size.');
  }
  // V.1_50: workstream dividers left without their slides (deck 22: two empty ones back to back) go; their places get slides
  if (dropEmptyWorkstreams_(secs) || flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, [], backlog);
  // one next-step slide, the last body slide of the deck (the specific one, e.g. "Initiate a design workshop", wins)
  if (solutionOutline && secs.length) {
    const steps = [];
    secs.forEach(function (sc) { sc.list.forEach(function (o) { if (isNextStep(o)) steps.push(o); }); });
    if (steps.length) {
      const keepStep = steps.filter(function (o) { return !/^the next step$/i.test(String(o.title || '')); }).pop() || steps[steps.length - 1];
      secs.forEach(function (sc) { sc.list = sc.list.filter(function (o) { return steps.indexOf(o) === -1; }); });
      secs[secs.length - 1].list.push(keepStep);
      for (let k = secs.length - 1; k >= 0 && secs.length > 1; k--) { if (!secs[k].list.length) { secs.splice(k, 1); body += dividerSlots(1); } }
      if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, [], backlog);
      // the backlog adds at the end: the next step stays last
      const lastList = secs[secs.length - 1].list;
      const at = lastList.indexOf(keepStep);
      if (at !== -1 && at !== lastList.length - 1) { lastList.splice(at, 1); lastList.push(keepStep); }
    }
  }
  // V.1_69 (deck 41: Proposal without its requested next steps, Solution without its requested risks and one slide short):
  // the last word on the outline - every once-only topic the request names has its slide, and the deck has exactly the
  // number of body slides asked for
  {
    const have = {};
    flat().forEach(function (o) {
      if (!o || o.type === 'section') return;
      onceTopicsOf_(o.title).forEach(function (f) { have[f] = true; });
      const fe = onceTopicOfEntry_(o); if (fe) have[fe] = true;                // V.1_71: the brief counts too
      if (/\bnext steps?\b|getting started|first step|kick-?off|the ask\b|decision needed|workshop|launch the engagement/i.test(String(o.title || ''))) have.next = true;   // a next step in other words
    });
    const reqNames = requestedTopics_(userPrompt);
    const isRequested = function (o) { return reqNames.some(function (t) { return slideForTopic_([{ type: o.type, title: o.title, lead: o.brief }], t) !== -1; }); };
    onceTopicsIn_(userPrompt).forEach(function (f) {
      if (have[f]) return;
      const entry = Object.assign({}, ONCE_TOPIC_ENTRY_[f]);
      if (!entry.title) return;
      // room: a free place, else the last slide of the largest section that no requested topic needs
      if (flat().length >= body) {
        const order = secs.slice().sort(function (a, b) { return b.list.length - a.list.length; });
        let freed = false;
        for (let q = 0; q < order.length && !freed; q++) {
          const list = order[q].list;
          for (let j = list.length - 1; j >= 1 && !freed; j--) {
            const o = list[j];
            if (o.type === 'section' || onceTopicsOf_(o.title).length || isRequested(o)) continue;
            list.splice(j, 1); freed = true;
          }
        }
        if (!freed) return;
      }
      if (f === 'next') secs[secs.length - 1].list.push(entry); else placeInSection_(secs, entry, []);
      have[f] = true;
      ctx.log.push('Outline: "' + entry.title + '" added (asked for in the request).');
    });
    if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, [], backlog);
    if (flat().length < body) {
      // nothing left in the backlog: a requested topic's second angle keeps the slide count (never a repeat of a once-only topic)
      const pool = reqNames.filter(function (t) { return !onceTopicOf_(t); });
      for (let k = 0; flat().length < body && k < pool.length; k++) {
        const title = sentenceCase_(String(pool[k]).charAt(0).toUpperCase() + String(pool[k]).slice(1) + ' in practice', 1);
        if (seen[keyOf(title)]) continue;
        seen[keyOf(title)] = true;
        placeInSection_(secs, { type: 'cards', title: title, brief: 'How ' + pool[k] + ' works for this client, step by step' }, []);
      }
    }
    // V.1_71: the last check - a topic shown once is never there twice, whatever step added it; a place freed here is
    // filled from the backlog (never with a once-only topic the deck has) or with a requested topic's second angle
    const onceLast = {};
    secs.forEach(function (sc) {
      sc.list = sc.list.filter(function (o) {
        if (!o || o.type === 'section') return true;
        const f = onceTopicOfEntry_(o);
        if (!f) return true;
        onceLast.__n = onceLast.__n || {};
        if ((onceLast.__n[f] || 0) >= onceLimit_(f, n) || ((onceLast.__n[f] || 0) >= 1 && sharedWords_(String(o.title || ''), String(onceLast[f] || '')) >= 2)) { ctx.log.push('Outline: "' + String(o.title).slice(0, 60) + '" left out (the deck already has "' + String(onceLast[f]).slice(0, 50) + '").'); return false; }
        onceLast.__n[f] = (onceLast.__n[f] || 0) + 1;
        onceLast[f] = o.title;
        return true;
      });
    });
    // V.1_73 (deck 44 General 13 / 17, 14 / 18: two slides for each target): a target of the request has one slide of its
    // own (besides the KPI slide); a second one goes - its place is filled below with a topic the deck does not have
    {
      const tg = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
      const tCount = {};
      secs.forEach(function (sc) {
        sc.list = sc.list.filter(function (o) {
          if (!o || o.type === 'section' || onceTopicOfEntry_(o) === 'kpi') return true;
          const hit = tg.filter(function (f) { const lw = String(f.label || '').split(/\s+/).filter(function (w) { return w.length > 2; }); return lw.length && sharedWords_(String(o.title || ''), f.label) >= Math.min(2, lw.length); })[0];
          if (!hit) return true;
          tCount[hit.key] = (tCount[hit.key] || 0) + 1;
          if (tCount[hit.key] > 1) { ctx.log.push('Outline: "' + String(o.title).slice(0, 60) + '" left out (the target "' + hit.value + ' ' + hit.label + '" has its slide).'); return false; }
          return true;
        });
      });
    }
    if (flat().length < body) backlogFill_(secs, body, seen, keyOf, flat, userPrompt, [], backlog);
    if (flat().length < body) {
      const pool2 = reqNames.filter(function (t) { return !onceTopicOf_(t); });
      for (let k = 0; flat().length < body && k < pool2.length * 2; k++) {
        const t2 = pool2[k % pool2.length];
        const title2 = sentenceCase_(String(t2).charAt(0).toUpperCase() + String(t2).slice(1) + (k < pool2.length ? ' in practice' : ': decisions and trade-offs'), 1);
        if (seen[keyOf(title2)]) continue;
        seen[keyOf(title2)] = true;
        placeInSection_(secs, { type: 'cards', title: title2, brief: 'How ' + t2 + ' works for this client' }, []);
      }
    }
    if (flat().length !== body) ctx.log.push('Outline: ' + flat().length + ' body slides (asked for ' + body + ').');
  }
  // V.1_71 (deck 42 General: sections "Pipeline availability", "Query throughput", "Infrastructure cost"): a section is
  // named after the topics of its slides, never after a target of the request
  renameTargetSections_(secs, ctx);
  finalOutlineOrder_(secs, ctx);                                        // V.1_72
  secs.forEach(function (sc) { sc.count = sc.list.length; });
  const slides = flat();
  if (slides.length < body) ctx.log.push('The outline has ' + slides.length + ' body slides (asked for ' + body + ').');
  // One divider slide at the start of every section (template section design): the agenda lists the sections
  const withDividers = [];
  const agendaItems = [];
  let pos = 0, slideNo = 3;                              // slide 1 cover, slide 2 agenda
  secs.filter(function (sc) { return sc.count > 0; }).forEach(function (sc, k) {
    const num = (k + 1 < 10 ? '0' : '') + (k + 1);
    const own = slides.slice(pos, pos + sc.count);
    const topics = own.filter(function (o) { return o.type !== 'section'; }).map(function (o) { return o.title; });
    if (!noDividers) withDividers.push({ type: 'section', title: sc.title, number: num, lead: sc.description, points: topics.slice(0, 5) });
    const first = slideNo + (noDividers ? 0 : 0);
    slideNo += (noDividers ? 0 : 1) + sc.count;
    own.forEach(function (o) { withDividers.push(o); });
    pos += sc.count;
    agendaItems.push({ title: sc.title, text: String(sc.description || '') /* V.1_66: no "slides 3–9" ranges */, points: topics, description: String(sc.description || '') });
  });
  slides.slice(pos).forEach(function (o) { withDividers.push(o); });
  // V.1_65 (deck 37 Proposal slide 2): the agenda lists the sections only, in every deck type (no "Introduction" or
  // "Thank you" rows), numbered in order
  agendaItems.forEach(function (it, i) { it.no = i + 1; });
  // V.1_48: a request for a roadmap gets a timeline slide (periods), not only phases without dates
  if (!solutionOutline && /\b(roadmap|timeline|gantt)\b/i.test(String(userPrompt || '')) && !withDividers.some(function (o) { return o.type === 'timeline'; })) {   // (V.1_54: a Solution roadmap stays phases with timing)
    const r = withDividers.filter(function (o) { return o.type !== 'section' && /roadmap|timeline|delivery plan|phased|implementation plan|plan\b/i.test(o.title); })[0];
    if (r) { r.type = 'timeline'; r.brief = (r.brief ? r.brief + ' ' : '') + '(a roadmap over months or quarters, with 3-5 workstreams)'; }
  }
  const cov = coverTitle_(removeHypeText_(out.deck_title || slides[0].title), removeHypeText_(out.subtitle || ''), ctx);
  if (solutionOutline) {                                                   // V.1_54: a Solution Deck never calls itself a proposal
    cov.title = cov.title.replace(/\s*\bproposal\b/ig, '').replace(/\s{2,}/g, ' ').trim();
    cov.subtitle = cov.subtitle.replace(/^a proposal for /i, 'A solution for ').replace(/\bsolution proposal\b/ig, 'solution').replace(/\s*\bproposal\b/ig, '').replace(/\s{2,}/g, ' ').trim();
  }
  if (solutionOutline && typeof solutionClosingLine_ === 'function') out.closing_subtitle = solutionClosingLine_(out.closing_subtitle);   // V.1_56
  return { deck_title: cov.title, subtitle: sentenceCase_(cov.subtitle, 2),
    closing_subtitle: sentenceCase_(removeHypeText_(out.closing_subtitle || ''), 2), sections: secs.map(function (sc) { return { title: sc.title, description: sc.description, count: sc.count }; }),
    slides: withDividers, agendaItems: agendaItems,
    // V.1_51: the storyline every part is written from (section -> what it proves -> each slide's message)
    plan: libOutline ? storylinePlan_(secs) : [] };
}

// V.1_48: a cover title that only says what the document is ("Proposal deck for Unilever") takes the message from the
// subtitle; the subtitle then says who the proposal is for
function coverTitle_(title, subtitle, ctx) {
  title = String(title || '').trim(); subtitle = String(subtitle || '').trim();
  const generic = /^\s*(?:an?\s+)?(?:solution|proposal|presentation|deck|pitch)(?:\s+deck)?(?:\s+(?:for|to)\s+[^:–-]{1,40})?\s*$/i.test(title);   // (V.1_56: "Solution deck for Corvina")
  if (!generic || subtitle.split(/\s+/).length < 3) return { title: title, subtitle: subtitle };
  const client = String((ctx && (ctx.clientName || (ctx.proposal && ctx.proposal.client && ctx.proposal.client.name))) || (title.match(/\b(?:for|to)\s+(.+)$/i) || [])[1] || '').trim();
  const t = subtitle.charAt(0).toUpperCase() + subtitle.slice(1);
  return { title: client && t.toLowerCase().indexOf(client.toLowerCase()) === -1 && t.length < 60 ? t + ' for ' + client : t, subtitle: client ? 'A proposal for ' + client : 'Proposal' };
}

// Indexes of outline entries to replace. `before` = entries already accepted (for checking new entries).
function outlineChecks_(slides, prompt, n, before, opts) {
  const out = [];
  const perFamily = Math.max(1, Math.round((n - 3) / 20));
  const asked = requestedFamilyCounts_(prompt);
  const counts = {};
  let roadmaps = 0, roadmapAt = -1;
  const wantsCreds = wantsCredentials_(prompt);
  const wantsSummary = /summary|takeaway|conclusion|recap/i.test(String(prompt || ''));
  (before || []).forEach(function (o) {
    const f = topicFamily_(o, prompt);
    if (f) counts[f] = (counts[f] || 0) + 1;
    if (roadmapLike_(o)) roadmaps++;
  });
  slides.forEach(function (o, i) {
    // V.1_47: a team slide counts for the team family (a second team / governance slide in other words is replaced)
    if (String(o.type || '').toLowerCase() === 'team') {
      counts.team = (counts.team || 0) + 1;
      if (counts.team > Math.max(1, asked.team || 0)) out.push(i);
      return;
    }
    if (['case_study', 'section'].indexOf(String(o.type || '').toLowerCase()) !== -1) return;
    // V.1_50: before / after comparisons at most twice (deck 22: "AI vs traditional rules" and "Current state vs with AI")
    if (String(o.type || '').toLowerCase() === 'comparison' && !/\b(risks?|mitigat\w*|options?|pros|cons)\b/i.test(String(o.title || ''))) {
      counts.__cmp = (counts.__cmp || 0) + 1;
      if (counts.__cmp > Math.max(2, Math.floor(n / 12))) { out.push(i); return; }
    }
    const f = topicFamily_(o, prompt);
    if (!wantsCreds && (f === 'credentials' || f === 'services' || credentialsContent_(o) || credentialsTitle_(o))) { out.push(i); return; }
    if (offTopicAi_(o, prompt)) { out.push(i); return; }
    if (!wantsSummary && FILLER_TITLE_RE_.test(String(o.title || ''))) { out.push(i); return; }
    if (!(opts && opts.solution) && !/next\s*steps?|call to action|\bcta\b|action plan|getting started/i.test(String(prompt || '')) &&   // (V.1_54: a Solution Deck ends with its next step)
        (String(o.type || '').toLowerCase() === 'next_steps' || /^\s*(your\s+)?next\s+steps?\b|getting started|let'?s get started/i.test(String(o.title || '')))) { out.push(i); return; }
    // V.1_51 (deck 23): one roadmap; the slide titled "roadmap" wins over an earlier phased plan
    if (roadmapLike_(o) || f === 'roadmap') {
      if (roadmaps >= 1) {
        if (roadmapAt >= 0 && /\broadmap\b/i.test(String(o.title || '')) && !/\broadmap\b/i.test(String(slides[roadmapAt].title || '')) && out.indexOf(roadmapAt) === -1) { out.push(roadmapAt); roadmapAt = i; return; }
        out.push(i); return;
      }
      roadmaps++; roadmapAt = i;
    }
    if (f && f !== 'roadmap') {
      counts[f] = (counts[f] || 0) + 1;
      const cap = f === 'kpi' || f === 'credentials' ? 1 : f === 'products' ? Math.max(2, perFamily) : f === 'challenges' ? (n >= 20 ? 2 : 1) : perFamily;
      if (counts[f] > Math.max(cap, asked[f] || 0)) { out.push(i); return; }
    }
  });
  // V.1_53: a Solution Deck also loses near copies of a slide and topics nobody asked for (market size, adjacent opportunities)
  if (opts && opts.solution && typeof solutionOutlineChecks_ === 'function') {
    solutionOutlineChecks_(slides, prompt, opts.tone, before).forEach(function (i) { if (out.indexOf(i) === -1) out.push(i); });
  }
  // V.1_56 (deck 29): a slide for a topic the request lists is never removed by these checks
  if (opts && opts.solution && typeof solutionProtectedSlides_ === 'function') {
    const keep = solutionProtectedSlides_(slides, prompt);
    return out.filter(function (i) { return !keep[i]; });
  }
  return out;
}

// V.1_51: fits an outline to the deck size: extra sections join their smaller neighbour (each divider costs a slide), then
// the largest section gives back its last slide until the body fits, never a slide a requested topic needs, the team
// slide or the roadmap
function fitOutlineToBody_(secs, sections, n, prompt, noDividers) {
  while (secs.length > Math.max(1, sections)) {
    let k = 0;
    secs.forEach(function (sc, j) { if (sc.list.length < secs[k].list.length) k = j; });
    const into = k === 0 ? 1 : k - 1;
    if (into < k) secs[into].list = secs[into].list.concat(secs[k].list); else secs[into].list = secs[k].list.concat(secs[into].list);
    secs.splice(k, 1);
  }
  const body = n - 3 - (noDividers ? 0 : secs.length);   // V.1_57
  const reqTopics = requestedTopics_(prompt);
  const topicsOf = function (o) { return reqTopics.filter(function (t) { return slideForTopic_([{ type: o.type, title: o.title, lead: o.brief }], t) !== -1; }); };
  const core = function (o) { const f = topicFamily_(o, prompt); return o.type === 'team' || o.type === 'timeline' || o.type === 'stats' || f === 'riskgov' || f === 'kpi' || f === 'team' || f === 'roadmap'; };
  const all = function () { return secs.reduce(function (a, sc) { return a.concat(sc.list); }, []); };
  // which slides may go, in order: no requested topic; a topic another slide also covers; a requested topic that is not
  // one of the proposal's core slides (team, roadmap, risks, KPIs); anything
  const mayGo = [
    function (o) { return !core(o) && !topicsOf(o).length; },
    function (o, rest) { const ts = topicsOf(o); return !core(o) && ts.every(function (t) { return rest.some(function (r) { return r !== o && topicsOf(r).indexOf(t) !== -1; }); }); },
    function (o) { return !core(o); },
    function () { return true; }
  ];
  let guard = 0;
  while (all().length > body && guard++ < 200) {
    const rest = all();
    const order = secs.slice().sort(function (a, b) { return b.list.length - a.list.length; });
    let done = false;
    for (let pass = 0; pass < mayGo.length && !done; pass++) {
      for (let q = 0; q < order.length && !done; q++) {
        const list = order[q].list;
        if (list.length <= 1) continue;
        for (let j = list.length - 1; j >= 1; j--) {
          if (list[j].type === 'section' || !mayGo[pass](list[j], rest)) continue;
          list.splice(j, 1); done = true; break;
        }
      }
    }
    if (!done) break;
  }
}

// V.1_52: the design library of a deck: 'proposal', 'solution' or '' (General). A library deck is drawn only from its own
// designs and shares the planned path (storyline outline, short writing prompt, the deck frame, the whole deck at once).
function deckLibraryOf_(ctx) {
  if (typeof isProposalDeck_ === 'function' && isProposalDeck_(ctx)) return 'proposal';
  if (typeof isSolutionDeck_ === 'function' && isSolutionDeck_(ctx)) return 'solution';
  return '';
}
function isLibraryDeck_(ctx) { return !!deckLibraryOf_(ctx); }
function isLibSpec_(sp) { return !!sp && (sp.deckLibrary === 'proposal' || sp.deckLibrary === 'solution'); }

// V.1_51: the model for one call (CONFIG.model is what callGeminiJSON tries first; the usual model stays the fallback)
// V.1_56: on the global region (the only one that serves the new models) the outline is written by Gemini 4 Argon
function outlineModel_() {
  let m = modelsOnGlobal_() ? 'gemini-4-argon' : 'gemini-2.5-pro';
  try { const p = PropertiesService.getScriptProperties().getProperty('OUTLINE_MODEL'); if (p != null && String(p).trim()) m = String(p).trim(); } catch (e) {}
  return /^(off|none|false|0)$/i.test(m) ? '' : m;
}
var MODEL_OVERRIDE_ = null;
function withModel_(model, fn) {
  if (!model || typeof CONFIG === 'undefined') return fn();
  const prev = MODEL_OVERRIDE_;
  MODEL_OVERRIDE_ = model;
  try { return fn(); } finally { MODEL_OVERRIDE_ = prev; }
}

/* ---------- V.1_56: which model does which job ----------
   Script properties (all optional):
     OUTLINE_MODEL   the outline (sections, slide titles)              default gemini-4-argon
     CONTENT_MODEL   the slide text, diagrams, risks, thin-slide fills  default gemini-4-argon
     RESEARCH_MODEL  research, client, checks, titles, other tools      default gemini-3.8-flash
     IMAGE_MODEL     generated icons                                    default gemini-3.1-flash-image
     THINKING_LEVEL  reasoning of the Gemini 3.x / 4 models: LOW (default), MEDIUM, HIGH or off
   The new models are served on the global region only: with VERTEX_LOCATION other than "global" the defaults stay the
   Gemini 2.5 models. "off" in a property means the Gemini 2.5 default for that job. */
var FALLBACK_TEXT_MODEL_ = 'gemini-2.5-flash';
function modelsOnGlobal_() {
  try { return String(getVertexConfig_().location || '').toLowerCase() === 'global'; } catch (e) { return false; }
}
function modelProp_(key) {
  try { const v = PropertiesService.getScriptProperties().getProperty(key); return v == null ? '' : String(v).trim(); } catch (e) { return ''; }
}
function runModels_() {
  const g = modelsOnGlobal_();
  const pick = function (key, newDefault, oldDefault) {
    const v = modelProp_(key);
    if (/^(off|none|false|0|default)$/i.test(v)) return oldDefault;
    return v || (g ? newDefault : oldDefault);
  };
  return {
    check: pick('RESEARCH_MODEL', 'gemini-3.8-flash', FALLBACK_TEXT_MODEL_),
    content: pick('CONTENT_MODEL', 'gemini-4-argon', ''),
    image: pick('IMAGE_MODEL', 'gemini-3.1-flash-image', 'auto')
  };
}
function contentModel_() { return runModels_().content; }
// Gemini 3.x and 4 take a reasoning level (LOW keeps a deck inside the Apps Script time limit); Gemini 2.5 rejects it
function geminiThinkingConfig_(model) {
  if (!/^gemini-(3|4|[5-9])/i.test(String(model || ''))) return null;
  if (/image/i.test(String(model))) return null;
  const lvl = (modelProp_('THINKING_LEVEL') || 'LOW').toUpperCase();
  if (/^(OFF|NONE|FALSE|0|DEFAULT)$/.test(lvl)) return null;
  return { thinkingLevel: /^(LOW|MEDIUM|HIGH|MINIMAL)$/.test(lvl) ? lvl : 'LOW' };
}
// which model answered each call in this run (shown in the result message, kept across the parts of a long deck)
var GEMINI_USED_ = {};
function noteGeminiModel_(model, fallback) {
  const k = String(model || '?') + (fallback ? ' (fallback)' : '');
  GEMINI_USED_[k] = (GEMINI_USED_[k] || 0) + 1;
}
function mergeModelsUsed_(into) {
  const out = into && typeof into === 'object' ? into : {};
  Object.keys(GEMINI_USED_).forEach(function (k) { out[k] = (out[k] || 0) + GEMINI_USED_[k]; });
  GEMINI_USED_ = {};
  return out;
}
function modelsUsedLine_(used) {
  const keys = Object.keys(used || {});
  if (!keys.length) return '';
  return 'AI models used: ' + keys.sort(function (a, b) { return used[b] - used[a]; }).map(function (k) { return k + ' × ' + used[k]; }).join(', ') + '.';
}
// slide writing with the content model; if it fails (time, quota, region) the slide is written with the usual model
function withContentModel_(ctx, fn) {
  const m = contentModel_();
  if (!m) return fn();
  try { return withModel_(m, fn); } catch (e) {
    if (/not enabled|VERTEX_PROJECT_ID is not configured|authentication failed|cancel/i.test(String(e && e.message))) throw e;
    if (ctx && ctx.log) ctx.log.push(m + ' did not answer (' + String(e && e.message).slice(0, 120) + '): written with ' + CONFIG.model + '.');
    return fn();
  }
}
// V.1_51: the storyline as lines for the writing prompt: "Section: what it proves" then "  - title: message"
function storylinePlan_(secs) {
  const out = [];
  (secs || []).forEach(function (sc, k) {
    out.push((k + 1) + '. ' + sc.title + (sc.storyline ? ': ' + sc.storyline : (sc.description ? ': ' + sc.description : '')));
    sc.list.forEach(function (o) {
      if (o.type === 'section') { out.push('   [workstream] ' + o.title); return; }
      out.push('   - ' + o.title + (o.message ? ': ' + o.message : '') + (o.points && o.points.length ? ' (' + o.points.join('; ') + ')' : ''));
    });
  });
  return out.slice(0, 80);
}

// V.1_50: a workstream divider (light divider inside a section) needs at least two slides of its own after it, before the
// next workstream or the end of the section; otherwise it goes. One workstream alone in a section goes too (nothing to
// tell apart). Returns how many were removed.
function dropEmptyWorkstreams_(secs) {
  let removed = 0;
  (secs || []).forEach(function (sc) {
    const list = sc.list;
    const keep = list.map(function () { return true; });
    list.forEach(function (o, i) {
      if (!(o.type === 'section' && o.level === 2)) return;
      let n = 0;
      for (let j = i + 1; j < list.length && !(list[j].type === 'section' && list[j].level === 2); j++) n++;
      if (n < 2) keep[i] = false;
    });
    const ws = list.filter(function (o, i) { return keep[i] && o.type === 'section' && o.level === 2; });
    if (ws.length === 1) list.forEach(function (o, i) { if (o === ws[0]) keep[i] = false; });
    const before = list.length;
    sc.list = list.filter(function (o, i) { return keep[i]; });
    removed += before - sc.list.length;
  });
  return removed;
}

// V.1_47: standard proposal topics used only when Gemini gives the outline fewer slides than asked (the deck always has
// the number of slides the user asked for); a topic the deck already covers is skipped
const OUTLINE_BACKLOG_ = [
  { type: 'comparison', title: 'Key risks and how we mitigate them', brief: 'The main delivery risks, their impact and the mitigation for each' },
  { type: 'stats', title: 'How we will measure success', brief: 'Target KPIs for the engagement (targets, not results)' },
  { type: 'table', title: 'Scope: what is in and what is out', brief: 'What the engagement covers and what it does not' },
  { type: 'cards', title: 'Assumptions and dependencies', brief: 'What the plan assumes from the client and from the data' },
  { type: 'process', title: 'Testing and quality assurance', brief: 'How the solution is tested before it goes live' },
  { type: 'cards', title: 'Change management and adoption', brief: 'How the teams are brought along: training, champions, communication' },
  { type: 'cards', title: 'Data security and compliance', brief: 'How data is protected: access, privacy, regulation' },
  { type: 'process', title: 'Knowledge transfer and enablement', brief: 'How the client team takes over the solution' },
  { type: 'cards', title: 'Success criteria for the pilot', brief: 'What has to be true to move from the pilot to scale' },
  // V.1_50: more standard topics, so the deck always reaches the slides asked for
  { type: 'process', title: 'Integration with existing systems', brief: 'How the solution connects to the systems the client runs today' },
  { type: 'cards', title: 'Operating model after go-live', brief: 'Who runs, supports and improves the solution once it is live' },
  { type: 'cards', title: 'Responsible AI and model governance', brief: 'Fairness, explainability and model approval before and after go-live' },
  { type: 'process', title: 'Value tracking after launch', brief: 'How the benefits are measured month by month after launch' },
  { type: 'cards', title: 'Training plan for users', brief: 'Who is trained, on what, and when' }
];
// The slides that fill an outline up to `body`: first topics of a family the deck does not have, then any topic the deck
// has not used yet (V.1_50: the deck never comes out a slide short)
function backlogFill_(secs, body, seen, keyOf, flat, prompt, holes, backlog) {
  const fam = function (o) { return topicFamily_(o, prompt); };
  const fresh = function (strict) {
    return (backlog || OUTLINE_BACKLOG_).filter(function (b) {
      if (seen[keyOf(b.title)] || flat().some(function (o) { return keyOf(o.title) === keyOf(b.title); })) return false;
      // V.1_71: a topic the deck shows once is never added a second time from the backlog
      const of = onceTopicOfEntry_(b);
      if (of && flat().some(function (o) { return o && o.type !== 'section' && onceTopicOfEntry_(o) === of; })) return false;
      return !strict || !flat().some(function (o) { return fam(o) && fam(o) === fam(b); });
    });
  };
  [true, false].forEach(function (strict) {
    const list = fresh(strict);
    while (flat().length < body && list.length) { const b = Object.assign({}, list.shift()); seen[keyOf(b.title)] = true; placeInSection_(secs, b, holes || []); }
  });
}
// Puts a new outline slide into its section: the section Gemini named, else the place of a removed slide, else the section
// whose title shares the most words with it, else the shortest section
function placeInSection_(secs, o, holes) {
  let k = isFinite(o.sec) && o.sec >= 1 && o.sec <= secs.length ? o.sec - 1 : -1;
  if (k === -1 && holes && holes.length) k = holes.shift();
  if (k === -1) {
    const ts = Object.keys(topicStems_(o.title + ' ' + (o.brief || ''), true));
    let best = 0;
    secs.forEach(function (sc, j) {
      const ss = topicStems_(sc.title + ' ' + (sc.description || ''), true);
      const score = ts.filter(function (w) { return ss[w]; }).length;
      if (score > best) { best = score; k = j; }
    });
  }
  if (k === -1) k = secs.map(function (sc, j) { return j; }).sort(function (a, b) { return secs[a].list.length - secs[b].list.length; })[0];
  delete o.sec;
  secs[k].list.push(o);
}
// A slide that names the subject of an EARLIER section (all of that section's words, none of its own section's) moves
// to the end of that section: "Understanding Apple's current forecasting needs" belongs in "Understanding Apple's needs"
function moveSlidesToTheirSection_(secs) {
  const stems = secs.map(function (sc) { return Object.keys(topicStems_(sc.title, true)); });
  for (let k = 1; k < secs.length; k++) {
    secs[k].list = secs[k].list.filter(function (o) {
      if (o.type === 'section' || secs[k].list.length <= 2) return true;
      const own = topicStems_(o.title, true);
      if (stems[k].some(function (w) { return own[w]; })) return true;
      for (let j = 0; j < k; j++) {
        if (stems[j].length && stems[j].every(function (w) { return own[w]; })) { secs[j].list.push(o); return false; }
      }
      return true;
    });
  }
}

// V.1_48: a figure is shown once in the deck, also in card, bullet and comparison text (deck 21: "65%" and "20% to 50%"
// on four slides). Figures on KPI / stats tiles win; elsewhere the sentence or point that repeats a figure goes, as long
// as the box keeps some text. `used` = figures shown on earlier slides (long deck parts), updated in place.
const FIG_RE_ = /[$€£]?\d+(?:[.,]\d+)?\s?(?:%|x\b|[kmb]\b|\+)/gi;
function figNorm_(v) { return String(v || '').replace(/\s/g, '').toLowerCase().replace(/\+$/, ''); }
function figuresIn_(t) { return (String(t || '').match(FIG_RE_) || []).map(figNorm_); }
function dedupeFiguresInText_(slides, used) {
  used = used || [];
  const seen = {};
  used.forEach(function (u) { seen[figNorm_(u)] = true; });
  // tiles first: the figures of stats slides in this part belong to them
  (slides || []).forEach(function (sp) {
    if (sp && String(sp.type || '').toLowerCase() === 'stats') (sp.items || []).forEach(function (it) { figuresIn_(it && it.value).forEach(function (f) { seen[f] = 'tile'; }); });
  });
  let removed = 0;
  const repeats = function (t) { return figuresIn_(t).some(function (f) { return seen[f]; }); };
  const tileRepeat = function (t) { return figuresIn_(t).some(function (f) { return seen[f] === 'tile'; }) ? 1 : 0; };
  const trimText = function (t) {
    const parts = String(t || '').split(/(?<=[.!?])\s+(?=[A-Z])/);
    if (parts.length < 2) return t;
    const kept = parts.filter(function (x) { return !repeats(x); });
    if (!kept.length || kept.length === parts.length) return t;
    removed += parts.length - kept.length;
    return kept.join(' ');
  };
  const trimList = function (list) {
    if (!Array.isArray(list)) return list;
    const minKeep = Math.min(3, list.length);
    const txt = function (x) { return typeof x === 'string' ? x : JSON.stringify(x); };
    // a point that repeats a KPI tile goes first, then other repeats, from the end
    const cand = list.map(function (x, j) { return j; }).filter(function (j) { return repeats(txt(list[j])); })
      .sort(function (a, b) { return (tileRepeat(txt(list[b])) - tileRepeat(txt(list[a]))) || (b - a); });
    const drop = {};
    cand.slice(0, Math.max(0, list.length - minKeep)).forEach(function (j) { drop[j] = true; removed++; });
    return list.filter(function (x, j) { return !drop[j]; }).map(function (x) { return typeof x === 'string' ? trimText(x) : x; });
  };
  (slides || []).forEach(function (sp) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template', 'case_study', 'stats'].indexOf(t) !== -1) return;
    sp.points = trimList(sp.points);
    ['left', 'right'].forEach(function (k) { if (sp[k] && Array.isArray(sp[k].points)) sp[k].points = trimList(sp[k].points); });
    (sp.items || []).forEach(function (it) { if (it && typeof it === 'object' && it.text) it.text = trimText(it.text); });
    if (sp.lead) sp.lead = trimText(sp.lead);
    // what this slide still shows counts for the slides after it
    figuresIn_(JSON.stringify([sp.items, sp.points, sp.left, sp.right, sp.lead, sp.takeaway])).forEach(function (f) { if (!seen[f]) { seen[f] = true; used.push(f); } });
  });
  return removed;
}

// Numbers shown on earlier parts of a long deck are not shown again (stats items with a used value are dropped)
function dedupeDeckNumbers_(slides, used) {
  const norm = function (v) { return String(v || '').replace(/\s/g, '').toLowerCase().replace(/\+$/, ''); };
  const seen = {};
  (used || []).forEach(function (u) { seen[norm(u)] = true; });
  slides.forEach(function (sp) {
    if (String(sp.type || '').toLowerCase() === 'stats' && Array.isArray(sp.items)) {
      sp.items = keepStatsShown_(sp.items, sp.items.filter(function (it) { const v = norm(it && it.value); return isTargetStat_(it) || !(v && seen[v]); }));
    }
    // V.1_51 (deck 23 slides 5 and 28): the headline number of an investment / value slide is a figure too: shown before
    // (even in a card heading), it goes and the slide shows its tiles
    if (String(sp.type || '').toLowerCase() === 'stats' && sp.value && figuresIn_(sp.value).some(function (f) { return seen[f] || seen[norm(f)]; })) {
      ['value', 'label', 'note'].forEach(function (k) { delete sp[k]; });
      if (String(sp.design || '') === 'P66_INVESTMENT') { delete sp.design; sp.reference = null; }
    }
  });
  slides.forEach(function (sp) {
    if (sp && sp.value) figuresIn_(sp.value).forEach(function (f) { if (!seen[f]) { seen[f] = true; used.push(f); } });
    slideNumbers_(sp).forEach(function (x) { const v = norm(x); if (v && !seen[v]) { seen[v] = true; used.push(x); } });
    (sp.items || []).forEach(function (it) { const v = norm(it && it.value); if (v && !seen[v]) { seen[v] = true; used.push(String(it.value)); } });
  });
}

// V.1_47: the section divider lists its slides by the titles they finally show (the fit step may shorten a title);
// titles of slides drawn earlier are remembered between parts (st.finalTitles, by outline position)
function syncDividerPoints_(slides, part, all, st) {
  st.finalTitles = st.finalTitles || {};
  const start = st.next;
  let k = 0;
  part.forEach(function (o, j) {
    if (o.type === 'section') { k++; return; }
    const sp = slides[k++];
    if (sp && sp.title) st.finalTitles[start + j] = sp.title;
  });
  slides.forEach(function (sp) {
    if (!sp || String(sp.type || '').toLowerCase() !== 'section' || sp.level === 2 || !Array.isArray(sp.points)) return;
    const at = all.indexOf(part.filter(function (o) { return o.type === 'section' && o.title === sp.title; })[0]);
    if (at === -1) return;
    const pts = [];
    for (let i = at + 1; i < all.length && all[i].type !== 'section' || (i < all.length && all[i].level === 2); i++) {
      if (all[i].type === 'section') continue;
      pts.push(st.finalTitles[i] || all[i].title);
      if (pts.length >= 5) break;
    }
    if (pts.length) sp.points = pts;
  });
}

/* V.1_68 — the deck check for repeated topics (deck 40 Proposal: two "Scope: what is in and what is out" slides, 13 and
   23). A topic a deck shows once (scope, RACI, KPIs, pricing, risks, support model, team, why 66degrees, next steps) keeps
   its first slide; a later slide of the same topic is left out of the outline (planOutline_), and its place filled. */
// V.1_71 (deck 42: "Risks" and "Key risks and how we mitigate them", three "why 66degrees" slides, "Success KPIs" and
// "Performance SLAs", "Sizing and configuration" and "Configuration and sizing"): one list of the topics a deck shows
// once, used by every outline step (the check that adds a missing topic and the check that removes a repeat)
const ONCE_TOPICS_ = [
  ['scope', /\b(scope|in and out|what is in)\b/i], ['raci', /\braci\b|responsibility matrix/i],
  ['pricing', /\bpricing\b|commercial (options|models|structures?)|investment options|engagement (options|models)/i],
  ['risks', /\brisks\b|\bkey risks?\b|^risks?\b|risk (register|management|mitigation)|mitigation (plan|controls|strategies)/i],
  ['support', /support model|support (and|&) operat\w*|enterprise support|day[- ]?(two|2) (support|operations)|\bL1\b.*\bL3\b|managed support|support tiers|follow-the-sun support|incident escalation/i], ['team', /team structure|joint team|delivery team|operating structure|team and governance/i],   // V.1_73: support in any wording (deck 44 General 31 / 38)
  ['why66', /why 66\s?degrees|why us\b|partnership differentiators|engineering scale and expertise|our (credentials|expertise)|proven (delivery|engineering|expertise)/i],
  ['next', /next steps?/i], ['sizing', /\bsizing\b|configuration (and|&) (sizing|specifications)/i],
  ['timeline', /\b\d+[- ]week (timeline|plan|roadmap)|implementation timeline|delivery timeline/i],
  // V.1_73 (deck 44: testing three times, monitoring three times, security twice): at most once, twice in a deck of 35+
  ['qa', /\btesting\b|quality assurance|\bqa\b|test (strategy|plan)|validation testing/i], ['monitoring', /\bmonitor(ing)?\b|observability|\balerting\b/i],
  ['security', /\bsecur(e|ing|ity)\b|zero[- ]trust|firewall/i],
  // (last: "Support model and SLA tiers" is the support slide, "Risks to the KPIs" the risk slide)
  ['kpi', /\bkpis?\b|success (metrics|measures|criteria)|target (metrics|figures|kpis)|\bslas?\b|\bslos?\b|performance targets|measur(e|ing) success|key performance/i]
];
// V.1_73: how many slides a topic may have - once; testing, monitoring and security twice in a deck of 35 slides or more
function onceLimit_(f, n) { return (['qa', 'monitoring', 'security'].indexOf(f) !== -1 && Number(n) >= 35) ? 2 : 1; }
// the once-only topic of an outline entry: its title first, its brief when the title says nothing (a KPI slide titled
// "Measuring what matters" with the brief "target KPIs")
function onceTopicOfEntry_(o) {
  if (!o) return '';
  const byTitle = onceTopicOf_(o.title);
  if (byTitle) return byTitle;
  const t = String(o.type || '').toLowerCase();
  if (t === 'stats' && /\b(targets?|kpis?|slas?|measur)/i.test(String(o.title || '') + ' ' + String(o.brief || ''))) return 'kpi';
  return '';
}
// every once-only topic a title (or the request) names, in the order of the list
function onceTopicsOf_(title) {
  const t = String(title || '');
  return ONCE_TOPICS_.filter(function (x) { return x[1].test(t); }).map(function (x) { return x[0]; });
}
function onceTopicsIn_(prompt) {
  // the request names a topic in its own words ("a RACI matrix", "next steps", "three pricing options")
  const p = String(prompt || '');
  const extra = { team: /team structure|joint team/i, risks: /\brisks?\b/i, support: /support model|\bL1\b/i, kpi: /\bkpis?\b|success (kpis|metrics)|target figures/i, pricing: /pricing|pricing options/i, scope: /\bscope\b/i };
  return ONCE_TOPICS_.filter(function (x) { return x[1].test(p) || (extra[x[0]] && extra[x[0]].test(p)); }).map(function (x) { return x[0]; });
}
// the standard slide of a once-only topic the request names but the outline lost
const ONCE_TOPIC_ENTRY_ = {
  scope: { type: 'comparison', title: 'Scope: what is in and what is out', brief: 'What the engagement covers and what it does not' },
  raci: { type: 'table', title: 'RACI matrix across delivery workstreams', brief: 'Each workstream with who is Responsible, Accountable, Consulted and Informed on both sides' },
  kpi: { type: 'stats', title: 'Success KPIs and target figures', brief: 'The target figures the request gives, each with how it is measured' },
  pricing: { type: 'cards', title: 'Pricing options', brief: 'The commercial options the request names, without amounts unless given' },
  risks: { type: 'cards', title: 'Key risks and how we mitigate them', brief: 'Each delivery or technical risk with its mitigation' },
  support: { type: 'cards', title: 'Support model', brief: 'The support levels and what each one covers' },
  team: { type: 'team', title: 'Joint team structure', brief: 'Both teams, their roles and how they work together' },
  why66: { type: 'cards', title: 'Why 66degrees', brief: 'Approved 66degrees facts only' },
  next: { type: 'process', title: 'Next steps', brief: 'The first concrete actions, with owners' },
  timeline: { type: 'timeline', title: 'Implementation timeline', brief: 'The phases over the weeks the request gives' },
  sizing: { type: 'table', title: 'Configuration and sizing', brief: 'Components with their size and configuration' },
  qa: { type: 'process', title: 'Testing and quality assurance', brief: 'How the solution is tested before go-live' },        // V.1_73
  monitoring: { type: 'cards', title: 'Monitoring and alerting across the platform', brief: 'What is watched, the alerts and who acts on them' },
  security: { type: 'cards', title: 'Security controls and compliance', brief: 'Identity, network, encryption and audit controls' }
};
function onceTopicOf_(title) {
  for (let i = 0; i < ONCE_TOPICS_.length; i++) if (ONCE_TOPICS_[i][1].test(String(title || ''))) return ONCE_TOPICS_[i][0];
  return '';
}
// V.1_71 (deck 42 Solution: slides titled "Risks", "Security", "Monitoring", "Deployment", "Runbooks"): a slide added for a
// requested topic gets a real title, never only the topic's name
const RICH_TOPIC_TITLES_ = [
  [/^risks?$/i, 'Key risks and how we mitigate them'], [/^security$/i, 'Security controls and compliance'], [/^monitoring$/i, 'Monitoring and alerting across the platform'],
  [/^deployment$/i, 'How the solution is deployed'], [/^runbooks?$/i, 'Operational runbooks for the platform'], [/^(sizing|configuration)( and (sizing|configuration))?$/i, 'Configuration and sizing'],
  [/^scope$/i, 'Scope: what is in and what is out'], [/^next steps?$/i, 'Next steps'], [/^kpis?$/i, 'Success KPIs and target figures'], [/^pricing( options)?$/i, 'Pricing options'],
  [/^raci$/i, 'RACI matrix across delivery workstreams'], [/^support( model)?$/i, 'Support model'], [/^team( structure)?$/i, 'Joint team structure'], [/^timeline$/i, 'Implementation timeline'],
  [/^testing$/i, 'Testing and validation before go-live'], [/^governance$/i, 'Governance and decision rights'], [/^integration$/i, 'Integration with existing systems'],
  [/^architecture$/i, 'Target architecture and its components'], [/^current state$/i, 'Current state and its limits'], [/^migration$/i, 'Migration approach and cutover']
];
function richTopicTitle_(topic) {
  const t = String(topic || '').replace(/\s*\([^)]*\)/g, '').trim();
  for (let i = 0; i < RICH_TOPIC_TITLES_.length; i++) if (RICH_TOPIC_TITLES_[i][0].test(t)) return RICH_TOPIC_TITLES_[i][1];
  const T = t.charAt(0).toUpperCase() + t.slice(1);
  // (a two-word topic is already a title: "Reference architecture", "Support priorities"; a lone word gets its angle)
  return t.split(/\s+/).length <= 1 ? sentenceCase_(T + ': approach and key decisions', 1) : sentenceCase_(T, 1);
}
// V.1_72 (deck 43): the last word on the outline's order and names
// - a one-word slide title gets a real title (Solution 11 "Security"), whoever wrote it
// - a section never has the same name as one of its slides (General 9 / 10, 16 / 18): it takes its topics
// - next steps is the last body slide of the deck (Proposal: the RACI came after it)
function finalOutlineOrder_(secs, ctx) {
  if (!Array.isArray(secs) || !secs.length) return;
  const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  secs.forEach(function (sc) {
    sc.list.forEach(function (o) {
      if (o && o.type !== 'section' && String(o.title || '').trim().split(/\s+/).length <= 1) {
        const nt = richTopicTitle_(o.title);
        if (nt !== o.title) { ctx && ctx.log && ctx.log.push('Outline: "' + o.title + '" is titled "' + nt + '".'); o.title = nt; }
      }
    });
  });
  const req = requestedTopics_((ctx && ctx.userPrompt) || '');
  secs.forEach(function (sc) {
    const own = sc.list.filter(function (o) { return o && o.type !== 'section'; });
    if (!own.some(function (o) { return norm(o.title) === norm(sc.title); })) return;
    const covered = req.filter(function (t) { return !/\d/.test(t) && slideForTopic_(own.map(function (o) { return { type: o.type, title: o.title, lead: o.brief }; }), t) !== -1; });
    let names = covered.slice(0, 2);
    if (names.length < 2) names = names.concat(own.filter(function (o) { return norm(o.title) !== norm(sc.title); }).slice(0, 2 - names.length).map(function (o) { return shortTitle_(o.title); }));
    if (!names.length) return;
    const nt = sentenceCase_(names.map(function (x, i) { x = String(x); return i ? x.charAt(0).toLowerCase() + x.slice(1) : x.charAt(0).toUpperCase() + x.slice(1); }).join(' and '), 1);
    if (nt && norm(nt) !== norm(sc.title)) { ctx && ctx.log && ctx.log.push('Outline: section "' + sc.title + '" is renamed "' + nt + '" (a slide had the same name).'); sc.title = nt; }
  });
  const isNext = function (o) { return o && o.type !== 'section' && /\bnext steps?\b|getting started|first steps?\b|launch the (engagement|partnership|project)/i.test(String(o.title || '')); };
  let step = null;
  secs.forEach(function (sc) { sc.list.forEach(function (o) { if (!step && isNext(o)) step = o; }); });
  const from = step ? secs.filter(function (sc) { return sc.list.indexOf(step) !== -1; })[0] : null;
  // (never leaves a section empty: the deck keeps its dividers and its slide count)
  if (step && from && (from === secs[secs.length - 1] || from.list.filter(function (o) { return o.type !== 'section'; }).length > 1)) {
    from.list = from.list.filter(function (o) { return o !== step; });
    secs[secs.length - 1].list.push(step);
  }
}
// A section named after a target ("Query throughput acceleration" for "3x faster query throughput") takes the topics of
// its slides instead (the requested topics they cover, else its first two slide subjects)
function renameTargetSections_(secs, ctx) {
  const targets = typeof briefTargets_ === 'function' ? briefTargets_(ctx) : [];
  if (!targets.length || !Array.isArray(secs)) return 0;
  const targetLike = function (x) { return /\d\s?(%|x\b)/i.test(String(x)) || targets.some(function (f) { return sharedWords_(String(x), f.label) >= Math.min(2, String(f.label).split(/\s+/).length); }); };
  const req = requestedTopics_((ctx && ctx.userPrompt) || '').filter(function (t) { return !targetLike(t); });
  let n = 0;
  secs.forEach(function (sc) {
    const title = String(sc.title || '');
    const isTarget = /\d\s?(%|x\b)/i.test(title) || targets.some(function (f) { return sharedWords_(title, f.label) >= Math.min(2, String(f.label).split(/\s+/).length); });
    if (!isTarget) return;
    const own = sc.list.filter(function (o) { return o && o.type !== 'section'; });
    const covered = req.filter(function (t) { return slideForTopic_(own.map(function (o) { return { type: o.type, title: o.title, lead: o.brief }; }), t) !== -1; });
    const names = (covered.length ? covered.slice(0, 2) : own.slice(0, 2).map(function (o) { return shortTitle_(o.title); })).filter(function (x) { return !targetLike(x); });
    if (!names.length) return;
    const nt = sentenceCase_(names.map(function (x, i) { return i ? String(x).replace(/^./, function (c) { return c.toLowerCase(); }) : String(x).charAt(0).toUpperCase() + String(x).slice(1); }).join(' and '), 1);
    if (nt && nt !== title) { if (ctx && ctx.log) ctx.log.push('Outline: section "' + title + '" is named after its topics: "' + nt + '".'); sc.title = nt; n++; }
  });
  return n;
}
function startLongDeck_(ctx, target, p, started) {
  progressStage_(ctx, 'write', 'active', 'Gemini is planning the outline of ' + p.n + ' slides');
  const outline = planOutline_(p.userPrompt, p.presentationType, p.n, p.sources, ctx);
  const st = {
    mode: 'create-long', runId: ctx.runId, startedAt: started, userPrompt: p.userPrompt, presentationType: p.presentationType, proposal: ctx.proposal || null,
    department: p.department, n: p.n, sources: p.sources, brief: ctx.brief || null, outline: outline, next: 0, drawn: 0, phase: 'body', avgBatchMs: 0, usedNumbers: [],
    chooser: { used: {}, looksUsed: {}, prevTag: null, prevLook: null, prevDark: false, darkUsed: 0 }, log: ctx.log
  };
  if (JSON.stringify(st).length > 40 * 1024 * 1024) { st.sources.pdfs = []; ctx.log.push('Uploaded PDFs were used for the outline only (too large to keep between runs).'); }
  // Cover and agenda first (the agenda lists the slide titles, or the sections in a very long deck)
  prepareLongCtx_(ctx, st);
  const head = [
    { type: 'cover', title: sentenceCase_(outline.deck_title, 2), subtitle: headingCase_(String(outline.subtitle || '')) },   // V.1_50: "A Proposal from" -> "A proposal from"
    { type: 'agenda', title: 'Agenda', items: outline.agendaItems }
  ];
  // V.1_42: a Proposal Deck lists its sections with their topics (spiral, two columns or table of contents)
  const proposalHead = isLibraryDeck_(ctx) && typeof proposalAgenda_ === 'function';
  if (proposalHead) {
    if (!ctx.proposal) ctx.proposal = { client: null, logoId: '', sectionStyle: 'dark' };
    proposalStyles_(ctx.proposal, deckLibraryOf_(ctx));
    const rows = outline.agendaItems.map(function (it) { return { title: it.title, points: it.points || [], description: it.description || '' }; });
    // V.1_52: a Solution Deck lists its sections on its own agenda design
    const more = deckLibraryOf_(ctx) === 'solution' && typeof solutionAgenda_ === 'function' ? solutionAgenda_(head[1], rows) : proposalAgenda_(head[1], rows, ctx.proposal);
    if (more) head.push(more);
    st.proposal = ctx.proposal;
  }
  st.solutionTone = ctx.solutionTone || '';
  const headPlan = { slides: head };
  selectReferences(headPlan, ctx);
  chooseDesignsByContent_(headPlan, ctx);
  if (!proposalHead) head[1].reference = referenceForTag_(ctx.lib, '66D_LAYOUT_AGENDA_002');      // numbered rows (01, 02...) for the sections
  // V.1_51: the deck is built in a hidden working copy and appears in the user's presentation all at once at the end
  // (before, the first part appeared, then nothing for minutes, then the rest)
  if (workDeckFits_(target)) {
    const wp = newWorkingPresentation_(String(outline.deck_title || 'Proposal').slice(0, 80) + ' (66° Deck Agent working copy)');
    st.workId = wp.getId();
    st.workSkip = wp.getSlides()[0] ? wp.getSlides()[0].getObjectId() : '';
    st.blankIds = p.blankDeck ? target.getSlides().map(function (sl) { return sl.getObjectId(); }) : [];
    st.startCount = target.getSlides().length;                         // V.1_63: an empty first slide is removed at the end
    try { st.firstId = target.getSlides()[0].getObjectId(); } catch (e) { st.firstId = ''; }
    ctx.workId = st.workId;
    drawSlidesIntoActive_(wp, head, ctx, false);
  } else {
    drawSlidesIntoActive_(target, head, ctx, p.blankDeck);
  }
  st.drawn = head.length;
  saveRunState_(st.runId, st);
  return longDeckStep_(ctx, target, st, started);
}

// V.1_51: the working copy is used when the user's presentation has the standard 16:9 page (copied slides then need no
// scaling); otherwise the slides are drawn straight into the presentation as before
function workDeckFits_(target) {
  try { return Math.abs(target.getPageWidth() - 720) < 1 && Math.abs(target.getPageHeight() - 405) < 1; } catch (e) { return false; }
}
function longDrawTarget_(target, st) {
  if (!st.workId) return target;
  try { return SlidesApp.openById(st.workId); }
  catch (e) { throw new Error('The working copy of this deck is no longer available (' + e.message + '). Please start again.'); }
}
// V.1_51: every slide of the working copy goes into the user's presentation in one go, in order (a very long deck may
// need a second run: st.assembled remembers how far it got), then the working copy is deleted. Returns true when done.
function assembleWorkDeck_(target, st, t0, ctx) {
  const src = SlidesApp.openById(st.workId);
  const slides = src.getSlides().filter(function (sl) { return sl.getObjectId() !== st.workSkip; });
  st.assembled = st.assembled || 0;
  if (ctx) progressStage_(ctx, 'brand', 'active', 'Adding all ' + slides.length + ' slides to your presentation');
  while (st.assembled < slides.length) {
    if (st.assembled > 0 && Date.now() - t0 > RUN_BUDGET_MS_ + 30000) return false;
    target.insertSlide(target.getSlides().length, slides[st.assembled]);
    st.assembled++;
  }
  // the presentation was empty (one blank slide): that slide goes
  (st.blankIds || []).forEach(function (id) { try { const sl = target.getSlideById(id); if (sl) sl.remove(); } catch (e) {} });
  // V.1_63 (deck 35: an empty slide 1 before the cover): a presentation that had one slide, still empty, loses it
  try {
    const all = target.getSlides();
    if (st.startCount === 1 && st.firstId && all.length > 1 && all[0].getObjectId() === st.firstId && isBlankDeck([all[0]])) all[0].remove();
  } catch (e) {}
  try { trashDriveFile(st.workId); } catch (e) {}
  st.workId = null;
  return true;
}

function prepareLongCtx_(ctx, st) {
  ctx.userPrompt = st.userPrompt;
  if (st.brief) ctx.brief = st.brief;                                  // V.1_70: every part writes from the same brief
  if (st.workId) ctx.workId = st.workId;                              // V.1_67: every part knows the working copy (slide numbers)
  ctx.presentationType = st.presentationType;
  ctx.proposal = st.proposal || null;
  ctx.solutionTone = st.solutionTone || ctx.solutionTone || '';       // V.1_52: the same tone in every part
  ctx.department = st.department;
  ctx.deckSize = st.n;
  ctx.chooserState = st.chooser;
  ctx.stockUsed = st.stockUsed = st.stockUsed || {};                 // V.1_50: a stock image once per deck, across all parts
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
    const content = part.filter(function (o) { return o.type !== 'section'; });
    const others = all.filter(function (o, i) { return o.type !== 'section' && (i < st.next || i >= st.next + part.length); }).map(function (o) { return o.title; });
    st.usedNumbers = st.usedNumbers || [];
    const written = content.length ? planContent(st.userPrompt, st.presentationType, content.length, st.sources, ctx,
      { batch: { slides: content, deckSize: st.n, deckTitle: st.outline.deck_title, otherTitles: others, usedNumbers: st.usedNumbers,
        plan: st.outline.plan || [], ledger: st.ledger || [] } }) : { slides: [] };   // V.1_51: storyline + what earlier slides said
    let wk = 0;
    const plan = { slides: part.map(function (o) {
      if (o.type === 'section') return { type: 'section', title: o.title, number: o.number, lead: o.lead, level: o.level, points: o.points, notes: '' };
      return written.slides[wk++];
    }).filter(function (sp) { return sp && !sp.leaveOut; }) };
    deckFigureCheck_(plan.slides, ctx, st.sources);                      // V.1_70: figures only from the request and sources
    deckShapeCheck_(plan.slides, ctx);                                   // V.1_72: each slide kind in its shape
    // Diagram uploads (rebuilt once, on the first diagram slide of the deck) and branded icons, as in a short deck
    // each uploaded diagram takes the slide whose topic matches it; anything left is placed in the last part
    if (typeof attachDiagramsToPlan_ === 'function' && ((st.sources && st.sources.diagrams) || []).some(function (d) { return !d.attached; })) {
      try { attachDiagramsToPlan_(plan, st.sources, ctx, { force: st.next + part.length >= all.length }); } catch (e) { ctx.log.push('Diagram stage skipped: ' + e.message); }
    }
    if (typeof resolveIconsForPlan_ === 'function') { try { resolveIconsForPlan_(plan, ctx); } catch (e) { ctx.log.push('Icon stage skipped: ' + e.message); } }
    dedupeFiguresInText_(plan.slides, st.usedNumbers.slice());          // V.1_48: also in card and bullet text (tiles win)
    dedupeDeckNumbers_(plan.slides, st.usedNumbers);                    // a figure is shown once in the whole deck
    plan.slides = plan.slides.map(statsNeedNumbers_);
    // V.1_47: a slide the number check left thin (a KPI slide without figures) gets its content back before drawing
    fillThinSlides_(plan, ctx);
    if (st.usedNumbers.length > 200) st.usedNumbers = st.usedNumbers.slice(-200);
    selectReferences(plan, ctx);
    const after = all[st.next + part.length];
    ctx.nextPartStartsDark = !!after && after.type === 'section';      // V.1_72: the divider that opens the next part
    chooseDesignsByContent_(plan, ctx);
    ctx.nextPartStartsDark = false;
    try { fillThinSlides_(plan, ctx, { textsOnly: true }); } catch (eT) {}    // V.1_67: texts too short for the design chosen (pricing options)
    fitContentToDesigns_(plan, ctx, b0);
    syncDividerPoints_(plan.slides, part, all, st);                     // V.1_47: a divider lists the titles its slides show
    // V.1_51: the record of what the deck has said so far goes with the next parts
    if (typeof proposalLedgerOf_ === 'function') {
      st.ledger = (st.ledger || []).concat([].concat.apply([], plan.slides.map(proposalLedgerOf_))).slice(-200);
    }
    deckFigureCheck_(plan.slides, ctx, st.sources);                      // V.1_70: again after the fill and fit steps
    deckGate_(plan.slides, ctx, b0);                                     // V.1_73: step 4 - no bad slide goes in
    finalizeNotes_(plan, st.sources, ctx);
    ctx.nextPartStartsDark = !!all[st.next + part.length] && all[st.next + part.length].type === 'section';   // V.1_73: Solution dark rule
    drawSlidesIntoActive_(longDrawTarget_(target, st), plan.slides, ctx, false);   // V.1_51: into the working copy
    ctx.nextPartStartsDark = false;
    st.next += part.length;
    st.drawn += plan.slides.length;
    const ms = Date.now() - b0;
    st.avgBatchMs = st.avgBatchMs ? Math.round(st.avgBatchMs * 0.5 + ms * 0.5) : ms;
    parts++;
    st.log = ctx.log.slice(-40);
    saveRunState_(st.runId, st);
  }
  if (st.next < all.length) return continueResult_(st, st.drawn, st.n, st.workId ? 'written' : 'added');
  // (a run that has used most of its time adds the closing and the slides to the presentation in the next run)
  if (st.workId && st.phase !== 'assemble' && parts > 0 && Date.now() - t0 > RUN_BUDGET_MS_ - 60000) {
    saveRunState_(st.runId, st);
    return continueResult_(st, st.drawn, st.n, 'written');
  }
  // Closing: the template Thank-you slide (strict rule)
  if (st.phase !== 'assemble') {
    checkCancel_(ctx);
    ctx.noCancel = true;
    drawSlidesIntoActive_(longDrawTarget_(target, st), [{ type: 'closing', title: 'Thank You!', subtitle: sentenceCase_((/thank/i.test(String(st.outline.closing_subtitle || '')) ? '' : st.outline.closing_subtitle) || st.outline.subtitle || st.outline.deck_title || '', 2) }], ctx, false);
    st.drawn++;
    st.phase = 'assemble';
    saveRunState_(st.runId, st);
  }
  // V.1_51: the whole deck appears at once
  if (st.workId) {
    ctx.noCancel = true;
    if (!assembleWorkDeck_(target, st, t0, ctx)) { saveRunState_(st.runId, st); return continueResult_(st, st.drawn, st.n, 'written'); }
  }
  saveDesignUsage_(Object.keys(st.chooser.used || {}), Object.keys(st.chooser.looksUsed || {}));
  deleteRunState_(st.runId);
  const secs = Math.round((Date.now() - (st.startedAt || t0)) / 1000);
  let msg = 'SUCCESS: ' + st.drawn + ' branded slides added to this presentation (' + secs + 's, built in parts).';
  const usedLine = modelsUsedLine_(mergeModelsUsed_(st.models));                 // V.1_56
  msg += '\n' + AGENT_VERSION_ + (usedLine ? '\n' + usedLine : '');
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

/* =========================
   FLOWCHART TAB
   Diagram slides from a description and/or an upload (picture, PDF, PowerPoint, Mermaid, draw.io, Excalidraw, SVG).
   Everything goes through the diagram-design pipeline (DiagramDesign.gs): Vertex AI chooses the type with
   diagram-design's selection table and budget, splits dense pictures into overview + detail, and describes each
   diagram; the add-on draws it as editable shapes. The slides are always added right after the slide the user is on.
========================= */
function runFlowchartGeneration(data) {
  data = data || {};
  return withUsage_({ runId: data.runId, mode: 'Flowchart', category: 'Flowchart' }, function () { return runFlowchartGeneration_(data); });   // V.1_62
}
function runFlowchartGeneration_(data) {
  const t0 = Date.now();
  const ctx = { runId: data.runId ? String(data.runId).slice(0, 60) : null, progress: null, blobCache: {}, generatedIcons: 0, log: [] };
  try {
    loadRunContext_(ctx);
    progressInit_(ctx, 'flowchart');
    progressStage_(ctx, 'flow_read', 'active');
    const target = SlidesApp.getActivePresentation();
    const text = String(data.prompt || '').trim();
    const file = (Array.isArray(data.files) ? data.files : []).filter(function (f) { return f && f.data; })[0];
    if (!text && !file) throw new Error('Describe the steps, or upload a sketch or diagram file.');
    // Dedicated Flowchart tab: default/auto forces flowchart so the classifier cannot pick another family.
    // Explicit chip choices (process, swimlane, …) remain available.
    const wanted = data.diagramType && data.diagramType !== 'auto' ? String(data.diagramType) : 'flowchart';
    const slidesWanted = Math.max(1, Math.min(10, Math.round(Number(data.slides) || 1)));   // the panel's slide meter (1-10)

    // 1. Read: pictures (also the ones inside a .pptx), PDF pages, or a structured diagram file
    let items = [];
    if (file) {
      const parts = diagramUploadParts_(file);
      if (parts.kind === 'unsupported') throw new Error(parts.reason);
      if (parts.kind === 'structured') {
        const sources = { text: '', pdfs: [], images: [] };
        const got = ingestUploadedDiagram_(file, sources, ctx);
        if (got && got.ok) {
          items.push({ label: file.name, text: 'DIAGRAM READ FROM ' + file.name + ' (redraw it; keep every box and arrow): ' +
            JSON.stringify({ type: got.ir.type, nodes: got.ir.nodes.map(function (n) { return { id: n.id, type: n.type, label: n.label }; }), edges: got.ir.edges }) });
        } else if (!text) throw new Error('No diagram could be read from ' + file.name + '. Add a short description of the steps.');
      } else {
        items = parts.items.filter(function (it) { return it.image || it.pdf; });
        if (!items.length) {
          // a deck or text file without pictures: its words describe the diagram
          const words = parts.items.map(function (it) { return it.text || ''; }).join('\n').trim();
          if (words) items = [{ label: file.name, text: words }];
        }
        if (!items.length && !text) throw new Error('Nothing to draw was found in ' + file.name + '. Add a short description of the steps.');
      }
    }
    if (!items.length) items = [{ label: 'description', text: '' }];
    progressStage_(ctx, 'flow_read', 'done', file ? file.name : 'Description');
    checkCancel_(ctx);

    // 2-3. diagram-design: type, budget, overview + detail, and the diagram spec (Vertex AI)
    progressStage_(ctx, 'flow_structure', 'active');
    const read = diagramDesignRead_({ items: items }, { prompt: text, wantedType: wanted, slides: slidesWanted, budgetMs: 230000 }, ctx);
    if (read.diagrams.length > slidesWanted) read.diagrams = read.diagrams.slice(0, slidesWanted);
    read.log.forEach(function (l) { ctx.log.push(l); });
    if (!read.diagrams.length) {
      throw new Error((file ? 'No diagram could be built from ' + file.name : 'A diagram could not be built from that description') +
        '. ' + (read.log.slice(-1)[0] || 'Try describing the steps, one per line.'));
    }
    progressStage_(ctx, 'flow_structure', 'done', read.diagrams.length + ' diagram' + (read.diagrams.length > 1 ? 's' : ''));
    checkCancel_(ctx);
    progressStage_(ctx, 'flow_layout', 'active');

    // 4. New slides right after the slide the user is on, in order
    let index = target.getSlides().length;
    try {
      const page = target.getSelection().getCurrentPage();
      if (page) {
        const id = page.getObjectId();
        target.getSlides().forEach(function (sl, i) { if (sl.getObjectId() === id) index = i + 1; });
      }
    } catch (e) {}
    const first = index;
    progressStage_(ctx, 'flow_layout', 'done');
    progressStage_(ctx, 'flow_insert', 'active');
    const dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');
    // The run is a small deck: an introduction slide, the diagram slides, and the template Thank-you slide
    const specs = flowchartDeckSpecs_(text, read, file ? file.name : '');
    const n = read.diagrams.length;
    let firstSlide = null;
    specs.forEach(function (spec) {
      checkCancel_(ctx);
      const slide = target.insertSlide(index, SlidesApp.PredefinedLayout.BLANK);
      if (!firstSlide) firstSlide = slide;
      renderEngineSlide(slide, spec, index + 1, ctx, target.getPageWidth(), target.getPageHeight(), dateLabel);
      index++;
    });
    try { if (firstSlide) firstSlide.selectAsCurrentPage(); } catch (e) {}
    const total = specs.length;
    progressStage_(ctx, 'flow_insert', 'done', 'Slides ' + (first + 1) + '-' + (first + total));
    if (ctx.progress) { ctx.progress.state = 'done'; progressSave_(ctx); }

    const msg = 'SUCCESS: ' + total + ' slides added as slides ' + (first + 1) + '-' + (first + total) + ': an introduction, ' +
      (n > 1 ? n + ' diagram slides' : '1 diagram slide') + ' and the Thank-you slide' +
      ' (' + read.diagrams.map(function (ir) { return ir.type + ', ' + ir.nodes.length + ' boxes'; }).join('; ') + ').' +
      (n < slidesWanted ? ' ' + n + ' of the ' + slidesWanted + ' diagram slides asked for could be drawn without repeating content.' : '') +
      (ctx.log.length ? '\n' + ctx.log.join('\n') : '');
    const res = generationResult_(msg, target, total);
    res.elapsedMs = Date.now() - t0;
    return res;
  } catch (e) {
    if (e && e.cancelled) return generationResult_('CANCELLED: Stopped at your request. Nothing more was added.', null, 0);
    throw e;
  }
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

// V.1_35: the sidebar's "Presentation Type" list. (Brand.gs keeps the older PRESENTATION_TYPES list; it is no longer shown.)
var DECK_TYPES_ = ['Proposal Deck', 'HR Leadership, Internal', 'General', 'Delivery Deck', 'Solution Deck'];
var DECK_TYPE_GUIDANCE_ = {
  'Proposal Deck': 'Client proposal: the client\'s need and goals, the proposed approach, scope and deliverables, timeline and ' +
    'milestones, how success is measured, and the commercial shape if the request gives it. Written to the client ("you"). ' +
    'Never state problems in the client\'s current operations as facts from blogs or forums: frame them as "what we typically see" or ' +
    '"to confirm in discovery". No forecasts for years that have already passed ("by 2026" is not a forecast in 2026). Industry ' +
    'figures are labelled as benchmarks ("Industry benchmark: ..."), the client\'s goals as targets ("Target: ..."), never as promises. ' +
    'American English spelling throughout (modernize, optimize, organization).',
  'HR Leadership, Internal': 'Internal deck for HR and leadership: people, policy, organisation and culture topics; context, the ' +
    'change and why, what it means for teams and managers, decisions leadership needs to make, timeline and support. Internal ' +
    'audience: plain and direct, no sales tone, no client pitch, no 66degrees credentials, no market-size statistics.',
  'General': 'Follow the structure the request implies; a clear story from context to the main points to what it means.',
  'Delivery Deck': 'Project delivery update: objectives, scope, status against milestones (done / in progress / next), risks and ' +
    'issues with owners, decisions needed, and the plan for the next phase. Factual and specific; no sales tone.',
  'Solution Deck': 'Solution overview: the problem, the proposed solution and how it works (architecture or flow), the main ' +
    'capabilities and use cases, how it is implemented, and the value it brings. Google Cloud products named correctly.'
};
function normalizePresentationType_(raw) {
  const key = String(raw || '').trim();
  if (DECK_TYPES_.indexOf(key) !== -1) return key;
  const k = key.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // older labels (saved settings, earlier versions of the panel) map to the nearest new type
  if (/^(proposal|pitch|sales|customer pitch|business|executive|business presentation|executive presentation|sales presentation)( deck| presentation)?$/.test(k)) return 'Proposal Deck';
  if (/\bhr\b|human resources|leadership|internal( update)?$/.test(k)) return 'HR Leadership, Internal';
  if (/^(delivery|report|qbr|status|project update)( deck| presentation)?$/.test(k)) return 'Delivery Deck';
  if (/^(solution|case study|casestudy|workshop|technical)( deck| presentation)?$/.test(k)) return 'Solution Deck';
  return 'General';
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

/* ---------- V.1_57: the agenda of a General Deck lists its sections ----------
   The body slides, in order, are grouped into 3-5 consecutive sections with short names (one Gemini call with the
   checking model); without an answer the agenda keeps listing the slides. */
function generalAgendaSections_(slides, ctx) {
  const agenda = (slides || []).filter(function (sp) { return String(sp.type || '').toLowerCase() === 'agenda'; })[0];
  if (!agenda || agenda.lockTag) return false;
  const body = slides.filter(function (sp) { return ['cover', 'agenda', 'closing'].indexOf(String(sp.type || '').toLowerCase()) === -1; });
  if (body.length < 6) return false;
  const titles = body.map(function (sp, i) { return (i + 1) + '. ' + slideHeading_(sp); });
  let out = null;
  try {
    out = callGeminiJSON([{ text: [
      'These are the body slides of a presentation, in order (request: "' + String((ctx && ctx.userPrompt) || '').slice(0, 300) + '"):',
      titles.join('\n'),
      'Group them, in this order, into 3-5 consecutive sections for the agenda. Each section: "title" (2-6 words, sentence case, what the part is about, no numbers) and "count" (how many slides, in order).',
      'The counts add up to exactly ' + body.length + '. Return ONLY JSON: {"sections":[{"title":"","count":0}]}'
    ].join('\n') }], ctx && ctx.apiKey, 0.2);
  } catch (e) { if (ctx && ctx.log) ctx.log.push('Agenda sections skipped: ' + e.message); return false; }
  const groups = ((out && out.sections) || []).map(function (g) { return { title: sentenceCase_(String((g && g.title) || '').replace(/^\s*\d+[.)]?\s*/, '').trim(), 1), count: parseInt(g && g.count, 10) || 0 }; })
    .filter(function (g) { return g.title && g.count > 0; });
  if (groups.length < 2 || groups.length > 6 || groups.reduce(function (a, g) { return a + g.count; }, 0) !== body.length) return false;
  agenda.sectionGroups = groups;
  syncAgendaToSlides_(slides);
  return true;
}
