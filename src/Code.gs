/**
 * 66° Deck Agent — entrypoints, menu, and generation pipeline orchestration.
 */

var PIPELINE_STAGES = [
  'input_validation',
  'source_analysis',
  'research',
  'content_planning',
  'ir_generation',
  'ir_validation',
  'reference_layout_selection',
  'diagram_planning',
  'slide_rendering',
  'brand_enforcement',
  'qa',
  'final_presentation'
];

function onOpen(e) {
  try {
    SlidesMenu_();
  } catch (err) {
    // Fallback if Slides UI unavailable in some contexts.
    console.error(err);
  }
}

function SlidesMenu_() {
  SlidesApp.getUi()
    .createMenu('66° Deck Agent')
    .addItem('Open Generator', 'showGeneratorSidebar')
    .addItem('About', 'showAbout')
    .addToUi();
}

function onHomepage(e) {
  return buildHomepageCard_();
}

function buildHomepageCard_() {
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('66° Deck Agent')
        .setSubtitle('On-brand Google Slides generation')
    )
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(
          'Open a Google Slides presentation and launch the Generator sidebar from the 66° Deck Agent menu.'
        )
      )
    )
    .build();
  return card;
}

function showGeneratorSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Generator')
    .setTitle('66° Deck Agent')
    .setWidth(540);
  SlidesApp.getUi().showSidebar(html);
}

function showAbout() {
  SlidesApp.getUi().alert(
    '66° Deck Agent',
    'Transforms prompts and source documents into on-brand, editable Google Slides presentations.',
    SlidesApp.getUi().ButtonSet.OK
  );
}

function getGeneratorBootstrap() {
  return {
    departments: Spec.DEPARTMENTS.slice(),
    presentationTypes: Spec.PRESENTATION_TYPES.slice(),
    stages: PIPELINE_STAGES.slice(),
    hasVertexConfig: !!Engine.isVertexConfigured_()
  };
}

/**
 * Main pipeline entry called from Generator.html.
 * request: { mode, department, presentationType, slideCount, prompt, sourceUrl }
 */
function runDeckGeneration(request) {
  var startedAt = Date.now();
  var progress = {
    stages: PIPELINE_STAGES.slice(),
    completed: [],
    currentStage: PIPELINE_STAGES[0],
    slideProgress: { current: 0, total: 0 },
    warnings: []
  };

  function mark(stage) {
    progress.currentStage = stage;
    if (progress.completed.indexOf(stage) === -1) {
      progress.completed.push(stage);
    }
  }

  try {
    // 1) Input validation
    mark('input_validation');
    var validatedRequest = Engine.validateInput(request);

    if (validatedRequest.mode === 'Rebrand') {
      mark('source_analysis');
      mark('research');
      mark('content_planning');
      mark('ir_generation');
      mark('ir_validation');
      mark('reference_layout_selection');
      mark('diagram_planning');
      mark('slide_rendering');
      var rebranded = Rebrand.rebrandPresentation(validatedRequest.sourceUrl);
      mark('brand_enforcement');
      mark('qa');
      var rebrandQa = Qa.validateRenderResult(rebranded);
      if (!rebrandQa.ok) {
        throw Engine.stageError('qa', rebrandQa.error);
      }
      mark('final_presentation');
      return successPayload_(rebranded, progress, startedAt, ['Rebrand mode applied 66degrees brand system.']);
    }

    // 2) Source / document analysis
    mark('source_analysis');
    var source = Engine.analyzeSourceDocument(validatedRequest.sourceUrl);
    if (source.note) {
      progress.warnings.push(source.note);
    }

    // 3) Research
    mark('research');
    var research = Engine.researchTopic(validatedRequest.prompt, source.text || '');

    // 4–6) Content planning + IR generation + validation
    mark('content_planning');
    mark('ir_generation');
    var ir = Engine.generatePresentationSpec(validatedRequest, source.text || '', research);
    mark('ir_validation');
    if (!ir.ok) {
      throw Engine.stageError('ir_validation', ir.error || 'Invalid PresentationSpec.');
    }
    if (ir.warnings && ir.warnings.length) {
      progress.warnings = progress.warnings.concat(ir.warnings);
    }
    var spec = ir.value;
    progress.slideProgress.total = spec.slides.length;

    // 7) Reference layout selection
    mark('reference_layout_selection');
    var selected = Reference.selectReferenceForSpec(
      spec,
      {},
      validatedRequest.department
    );
    spec = selected.spec;

    // 8) Diagram planning
    mark('diagram_planning');
    spec = Engine.planDiagrams(spec);

    // 9) Brand enforcement (pre-render normalize)
    mark('brand_enforcement');
    var branded = Qa.enforceBrandOnSpec(spec);
    if (!branded.ok) {
      throw Engine.stageError('brand_enforcement', branded.error);
    }
    spec = branded.spec;
    if (branded.issues && branded.issues.length) {
      progress.warnings = progress.warnings.concat(branded.issues);
    }

    // 10) Slide rendering
    mark('slide_rendering');
    var rendered = EngineRenderer.renderPresentation(spec);
    progress.slideProgress.current = rendered.slideCount;
    progress.slideProgress.total = rendered.slideCount;

    // 11) QA
    mark('qa');
    var qa = Qa.validateRenderResult(rendered);
    if (!qa.ok) {
      throw Engine.stageError('qa', qa.error);
    }

    // 12) Final
    mark('final_presentation');
    return successPayload_(rendered, progress, startedAt, progress.warnings);
  } catch (err) {
    return {
      ok: false,
      error: {
        message: err && err.message ? err.message : String(err),
        stage: (err && err.stage) || progress.currentStage || 'unknown'
      },
      progress: progress,
      elapsedMs: Date.now() - startedAt
    };
  }
}

function successPayload_(rendered, progress, startedAt, warnings) {
  return {
    ok: true,
    presentationId: rendered.presentationId,
    url: rendered.url,
    slideCount: rendered.slideCount,
    mode: rendered.mode || 'Create',
    progress: progress,
    warnings: warnings || [],
    elapsedMs: Date.now() - startedAt
  };
}

/**
 * Expose department-filtered reference library to the sidebar / tests.
 */
function getFilteredReferenceLibrary(department) {
  return Reference.getFilteredReferenceLibrary(department);
}

/**
 * Lightweight health check for local/CI validation harnesses that mock GAS.
 */
function getPipelineStages() {
  return PIPELINE_STAGES.slice();
}
