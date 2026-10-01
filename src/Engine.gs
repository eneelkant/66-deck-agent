/**
 * AI / planning engine: Gemini calls, source analysis, IR generation,
 * diagram planning, and deterministic fallback planning.
 */

var Engine = (function () {
  var GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  function getGeminiApiKey_() {
    try {
      return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    } catch (e) {
      return '';
    }
  }

  function stageError(stage, message, details) {
    var err = new Error('[' + stage + '] ' + message);
    err.stage = stage;
    err.details = details || null;
    return err;
  }

  function callGemini_(prompt, stage) {
    var apiKey = getGeminiApiKey_();
    if (!apiKey) {
      return { ok: false, missingKey: true, error: 'GEMINI_API_KEY is not configured.' };
    }

    var payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json'
      }
    };

    var response;
    try {
      response = UrlFetchApp.fetch(GEMINI_ENDPOINT + '?key=' + encodeURIComponent(apiKey), {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (e) {
      throw stageError(stage, 'Gemini request failed: ' + e.message);
    }

    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code === 401 || code === 403) {
      throw stageError(stage, 'Gemini authentication failed (HTTP ' + code + ').');
    }
    if (code === 429) {
      throw stageError(stage, 'Gemini quota exceeded (HTTP 429).');
    }
    if (code < 200 || code >= 300) {
      throw stageError(stage, 'Gemini HTTP ' + code + ': ' + body.slice(0, 300));
    }

    var parsed = JSON.parse(body);
    var text =
      parsed &&
      parsed.candidates &&
      parsed.candidates[0] &&
      parsed.candidates[0].content &&
      parsed.candidates[0].content.parts &&
      parsed.candidates[0].content.parts[0] &&
      parsed.candidates[0].content.parts[0].text;

    if (!text) {
      throw stageError(stage, 'Gemini returned an empty response.');
    }
    return { ok: true, text: text };
  }

  function validateInput(request) {
    request = request || {};
    var mode = String(request.mode || 'Create');
    var department = String(request.department || 'General');
    var presentationType = String(request.presentationType || 'General');
    var slideCount = Number(request.slideCount || 8);
    var prompt = String(request.prompt || '').trim();
    var sourceUrl = String(request.sourceUrl || '').trim();

    if (Spec.DEPARTMENTS.indexOf(department) === -1) {
      throw stageError('input_validation', 'Invalid department: ' + department);
    }
    if (isNaN(slideCount) || slideCount < 3 || slideCount > 20) {
      throw stageError('input_validation', 'Slide count must be between 3 and 20.');
    }
    if (mode === 'Create' && !prompt && !sourceUrl) {
      throw stageError(
        'input_validation',
        'Provide a prompt and/or source document URL.'
      );
    }
    if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) {
      throw stageError('input_validation', 'Source document URL must be HTTPS.');
    }

    return {
      mode: mode,
      department: department,
      presentationType: presentationType,
      slideCount: slideCount,
      prompt: prompt,
      sourceUrl: sourceUrl,
      cancelToken: request.cancelToken || null
    };
  }

  function analyzeSourceDocument(sourceUrl) {
    if (!sourceUrl) {
      return { ok: true, text: '', note: 'No source document provided.' };
    }

    try {
      var fileIdMatch = String(sourceUrl).match(/[-\w]{25,}/);
      if (!fileIdMatch) {
        return {
          ok: true,
          text: '',
          note: 'Could not extract a Drive file id from URL; continuing with prompt only.'
        };
      }
      var file = DriveApp.getFileById(fileIdMatch[0]);
      var blob = file.getBlob();
      var text = '';
      try {
        // Docs/text-like files
        text = blob.getDataAsString();
      } catch (e) {
        text = 'Source file: ' + file.getName();
      }
      // Keep prompt size bounded.
      if (text.length > 12000) {
        text = text.slice(0, 12000);
      }
      return { ok: true, text: text, name: file.getName() };
    } catch (err) {
      return {
        ok: true,
        text: '',
        note: 'Source document unavailable (' + err.message + '); continuing with prompt.'
      };
    }
  }

  function researchTopic(prompt, sourceText) {
    // Lightweight research stage: synthesize key themes without external browsing.
    var corpus = [prompt || '', sourceText || ''].join('\n').trim();
    var words = corpus.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    var stop = {
      the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, from: 1, into: 1, your: 1,
      a: 1, an: 1, of: 1, to: 1, in: 1, on: 1, is: 1, are: 1, be: 1, as: 1, by: 1
    };
    var freq = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w || w.length < 4 || stop[w]) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    var themes = Object.keys(freq)
      .sort(function (a, b) {
        return freq[b] - freq[a];
      })
      .slice(0, 8);

    return {
      themes: themes,
      summary:
        themes.length > 0
          ? 'Key themes: ' + themes.join(', ')
          : 'Theme extraction limited; using prompt narrative.'
    };
  }

  function buildFallbackSpec(request, research) {
    var count = request.slideCount;
    var title = request.prompt
      ? request.prompt.split(/[.?!]/)[0].slice(0, 80)
      : '66degrees ' + request.presentationType;
    var themes = (research && research.themes) || [];
    var sequence = [
      'cover',
      'agenda',
      'kpi',
      'cards',
      'process',
      'flowchart',
      'comparison',
      'timeline',
      'architecture',
      'quote',
      'table',
      'content',
      'section',
      'closing'
    ];

    var slides = [];
    for (var i = 0; i < count; i++) {
      var category;
      if (i === 0) category = 'cover';
      else if (i === count - 1) category = 'closing';
      else category = sequence[(i % (sequence.length - 2)) + 1];

      var theme = themes[i % Math.max(themes.length, 1)] || request.presentationType;
      var slide = {
        id: 'slide_' + (i + 1),
        category: category,
        purpose: category,
        title:
          category === 'cover'
            ? title
            : category === 'closing'
              ? 'Next steps'
              : theme.charAt(0).toUpperCase() + theme.slice(1),
        subtitle:
          category === 'cover'
            ? request.department + ' · ' + request.presentationType
            : '',
        body:
          category === 'cover'
            ? ''
            : 'Insights for ' + theme + ' tailored to ' + request.department + '.',
        visualType: category,
        elements: [],
        diagram: null,
        speakerNotes: ''
      };

      if (category === 'kpi') {
        slide.elements = [
          { type: 'KPI', value: '92%', label: 'Delivery confidence', trend: '+6%' },
          { type: 'KPI', value: '3.2x', label: 'Efficiency lift', trend: '+18%' },
          { type: 'KPI', value: '14', label: 'Active workstreams', trend: 'stable' },
          { type: 'KPI', value: '48h', label: 'Decision cycle', trend: '-30%' }
        ];
      } else if (category === 'cards') {
        slide.elements = [
          { type: 'card', title: 'Discover', body: 'Clarify outcomes, constraints, and success metrics.' },
          { type: 'card', title: 'Design', body: 'Shape the operating model and solution architecture.' },
          { type: 'card', title: 'Deliver', body: 'Execute with measurable milestones and clear owners.' }
        ];
      } else if (category === 'process') {
        slide.elements = [
          { type: 'process', title: 'Align' },
          { type: 'process', title: 'Build' },
          { type: 'process', title: 'Validate' },
          { type: 'process', title: 'Scale' }
        ];
      } else if (category === 'flowchart' || category === 'architecture') {
        slide.diagram = {
          type: category === 'architecture' ? 'architecture' : 'flowchart',
          direction: 'LR',
          nodes: [
            { id: 'n1', type: 'start', label: 'Input' },
            { id: 'n2', type: 'process', label: 'Analyze' },
            { id: 'n3', type: 'decision', label: 'Ready?' },
            { id: 'n4', type: 'process', label: 'Deliver' },
            { id: 'n5', type: 'end', label: 'Outcome' }
          ],
          edges: [
            { from: 'n1', to: 'n2' },
            { from: 'n2', to: 'n3' },
            { from: 'n3', to: 'n4', label: 'Yes' },
            { from: 'n4', to: 'n5' }
          ]
        };
      } else if (category === 'comparison') {
        slide.elements = [
          { type: 'comparison', title: 'Current state', body: 'Fragmented process, slow decisions, limited visibility.' },
          { type: 'comparison', title: 'Future state', body: 'Unified workflow, faster cycles, measurable outcomes.' }
        ];
      } else if (category === 'timeline') {
        slide.elements = [
          { type: 'timeline', title: 'Week 1 · Discovery' },
          { type: 'timeline', title: 'Week 3 · Prototype' },
          { type: 'timeline', title: 'Week 6 · Pilot' },
          { type: 'timeline', title: 'Week 10 · Scale' }
        ];
      } else if (category === 'table') {
        slide.elements = [
          {
            type: 'table',
            columns: ['Workstream', 'Owner', 'Status'],
            rows: [
              ['Experience', 'Solutions', 'On track'],
              ['Platform', 'Delivery', 'At risk'],
              ['Adoption', 'Sales', 'On track']
            ]
          }
        ];
      } else if (category === 'quote') {
        slide.body = 'The right operating rhythm turns ambition into repeatable delivery.';
      } else if (category === 'agenda' || category === 'content' || category === 'closing') {
        slide.elements = [
          { type: 'text', title: 'Context', body: 'Where we are starting from.' },
          { type: 'text', title: 'Approach', body: 'How 66degrees creates leverage.' },
          { type: 'text', title: 'Impact', body: 'What success looks like.' }
        ];
      }

      slides.push(slide);
    }

    return {
      metadata: {
        title: title,
        subtitle: request.department + ' ' + request.presentationType,
        audience: request.department,
        createdBy: '66° Deck Agent'
      },
      department: request.department,
      presentationType: request.presentationType,
      theme: '66degrees',
      slides: slides
    };
  }

  function planContentWithGemini(request, sourceText, research) {
    var prompt =
      'You are the 66degrees presentation planner. Return ONLY valid JSON for a PresentationSpec.\n' +
      'Schema:\n' +
      '{"metadata":{"title":"","subtitle":"","audience":""},"department":"","presentationType":"","theme":"66degrees","slides":[{"id":"","category":"cover|section|agenda|content|kpi|cards|process|flowchart|comparison|timeline|architecture|quote|table|chart|closing","purpose":"","title":"","subtitle":"","body":"","visualType":"","elements":[{"id":"","type":"text|card|KPI|metric|process|comparison|timeline|table|quote","title":"","body":"","value":"","trend":"","columns":[],"rows":[]}],"diagram":{"type":"flowchart","direction":"LR|TB","nodes":[{"id":"","type":"start|process|decision|end","label":""}],"edges":[{"from":"","to":"","label":""}]},"speakerNotes":""}]}\n' +
      'Rules:\n' +
      '- department must be one of: ' + Spec.DEPARTMENTS.join(', ') + '\n' +
      '- create exactly ' + request.slideCount + ' slides\n' +
      '- first slide category=cover, last slide category=closing\n' +
      '- vary visual categories; include at least one kpi/cards/process/flowchart when slide count >= 6\n' +
      '- keep titles short; body concise; no markdown fences\n' +
      'Department: ' + request.department + '\n' +
      'Presentation type: ' + request.presentationType + '\n' +
      'Prompt: ' + request.prompt + '\n' +
      'Research: ' + JSON.stringify(research) + '\n' +
      'Source excerpt: ' + String(sourceText || '').slice(0, 6000);

    var result = callGemini_(prompt, 'content_planning');
    if (!result.ok) {
      return { ok: false, missingKey: result.missingKey, error: result.error };
    }
    return { ok: true, raw: result.text };
  }

  function generatePresentationSpec(request, sourceText, research) {
    var planned = planContentWithGemini(request, sourceText, research);
    if (planned.ok) {
      var validated = Spec.validate(planned.raw);
      if (validated.ok) {
        return validated;
      }
      // One repair/retry path via deterministic fallback merge is safer than re-billing.
    }

    var fallback = buildFallbackSpec(request, research);
    var fallbackValidated = Spec.validate(fallback);
    if (!fallbackValidated.ok) {
      throw stageError('ir_generation', fallbackValidated.error || 'Failed to build PresentationSpec.');
    }
    fallbackValidated.warnings = (fallbackValidated.warnings || []).concat([
      planned.missingKey
        ? 'GEMINI_API_KEY missing; used deterministic planner.'
        : 'Gemini IR invalid or unavailable; used deterministic planner.'
    ]);
    return fallbackValidated;
  }

  function planDiagrams(spec) {
    for (var i = 0; i < spec.slides.length; i++) {
      var slide = spec.slides[i];
      if (
        (slide.category === 'flowchart' || slide.category === 'architecture') &&
        !slide.diagram
      ) {
        var labels = (slide.elements || [])
          .map(function (el) {
            return el.title || el.label || el.body;
          })
          .filter(Boolean)
          .slice(0, 5);
        if (labels.length < 2) {
          labels = ['Discover', 'Design', 'Deliver', 'Scale'];
        }
        var nodes = labels.map(function (label, idx) {
          var type = 'process';
          if (idx === 0) type = 'start';
          if (idx === labels.length - 1) type = 'end';
          if (label.indexOf('?') !== -1) type = 'decision';
          return { id: 'n' + (idx + 1), type: type, label: String(label).slice(0, 28) };
        });
        var edges = [];
        for (var e = 0; e < nodes.length - 1; e++) {
          edges.push({ from: nodes[e].id, to: nodes[e + 1].id });
        }
        slide.diagram = {
          type: slide.category === 'architecture' ? 'architecture' : 'flowchart',
          direction: 'LR',
          nodes: nodes,
          edges: edges
        };
      }
    }
    return spec;
  }

  return {
    validateInput: validateInput,
    analyzeSourceDocument: analyzeSourceDocument,
    researchTopic: researchTopic,
    generatePresentationSpec: generatePresentationSpec,
    planDiagrams: planDiagrams,
    buildFallbackSpec: buildFallbackSpec,
    stageError: stageError,
    getGeminiApiKey_: getGeminiApiKey_
  };
})();
