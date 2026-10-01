/**
 * PresentationSpec intermediate representation (IR) validation and repair.
 * Gemini must never talk directly to SlidesApp — only via a validated Spec.
 */

var Spec = (function () {
  var DEPARTMENTS = ['Sales', 'Delivery', 'Solutions', 'Executive', 'General'];
  var PRESENTATION_TYPES = [
    'Pitch',
    'Proposal',
    'Status Update',
    'Workshop',
    'Case Study',
    'Executive Brief',
    'General'
  ];

  var ELEMENT_TYPES = {
    text: true,
    richText: true,
    image: true,
    card: true,
    metric: true,
    KPI: true,
    chart: true,
    table: true,
    process: true,
    flowchart: true,
    decision: true,
    timeline: true,
    comparison: true,
    architecture: true,
    quote: true,
    icon: true,
    connector: true
  };

  var SLIDE_CATEGORIES = {
    cover: true,
    section: true,
    agenda: true,
    content: true,
    kpi: true,
    cards: true,
    process: true,
    flowchart: true,
    comparison: true,
    timeline: true,
    architecture: true,
    quote: true,
    table: true,
    chart: true,
    closing: true
  };

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function asString(value, fallback) {
    if (value == null) {
      return fallback || '';
    }
    return String(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeParseJson(raw) {
    if (isObject(raw)) {
      return { ok: true, value: raw };
    }
    if (typeof raw !== 'string') {
      return { ok: false, error: 'IR payload must be an object or JSON string.' };
    }

    var text = raw.trim();
    // Strip common Markdown fences from model output.
    if (text.indexOf('```') === 0) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err1) {
      var repaired = repairJson(text);
      try {
        return { ok: true, value: JSON.parse(repaired), repaired: true };
      } catch (err2) {
        return {
          ok: false,
          error: 'Malformed JSON: ' + (err1.message || String(err1))
        };
      }
    }
  }

  function repairJson(text) {
    var out = text;
    // Remove trailing commas before } or ]
    out = out.replace(/,\s*([}\]])/g, '$1');
    // Quote bare keys: {foo: 1} -> {"foo": 1}
    out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
    // Replace single quotes with double quotes cautiously
    if (out.indexOf('"') === -1 && out.indexOf("'") !== -1) {
      out = out.replace(/'/g, '"');
    }
    return out;
  }

  function normalizeElement(el, index) {
    el = isObject(el) ? el : {};
    var type = asString(el.type, 'text');
    if (!ELEMENT_TYPES[type]) {
      type = 'text';
    }
    return {
      id: asString(el.id, 'el_' + (index + 1)),
      type: type,
      label: asString(el.label, ''),
      title: asString(el.title, ''),
      body: asString(el.body || el.text || el.content, ''),
      value: asString(el.value, ''),
      trend: asString(el.trend, ''),
      icon: asString(el.icon, ''),
      items: asArray(el.items).map(function (item) {
        return asString(item, '');
      }),
      columns: asArray(el.columns),
      rows: asArray(el.rows),
      style: isObject(el.style) ? el.style : {}
    };
  }

  function normalizeDiagram(diagram) {
    if (!isObject(diagram)) {
      return null;
    }
    var nodes = asArray(diagram.nodes).map(function (node, i) {
      node = isObject(node) ? node : {};
      return {
        id: asString(node.id, 'n' + (i + 1)),
        type: asString(node.type, 'process'),
        label: asString(node.label || node.text, 'Node ' + (i + 1)),
        group: asString(node.group, '')
      };
    });
    var edges = asArray(diagram.edges).map(function (edge, i) {
      edge = isObject(edge) ? edge : {};
      return {
        id: asString(edge.id, 'e' + (i + 1)),
        from: asString(edge.from, ''),
        to: asString(edge.to, ''),
        label: asString(edge.label, '')
      };
    }).filter(function (edge) {
      return edge.from && edge.to;
    });

    if (!nodes.length) {
      return null;
    }

    return {
      type: asString(diagram.type, 'flowchart'),
      direction: asString(diagram.direction, 'LR').toUpperCase() === 'TB' ? 'TB' : 'LR',
      nodes: nodes,
      edges: edges
    };
  }

  function normalizeSlide(slide, index) {
    slide = isObject(slide) ? slide : {};
    var category = asString(slide.category, 'content').toLowerCase();
    if (!SLIDE_CATEGORIES[category]) {
      category = 'content';
    }

    return {
      id: asString(slide.id, 'slide_' + (index + 1)),
      category: category,
      purpose: asString(slide.purpose, category),
      title: asString(slide.title, 'Untitled'),
      subtitle: asString(slide.subtitle, ''),
      body: asString(slide.body, ''),
      layoutId: asString(slide.layoutId, ''),
      visualType: asString(slide.visualType, category),
      elements: asArray(slide.elements).map(normalizeElement),
      diagram: normalizeDiagram(slide.diagram),
      chart: isObject(slide.chart) ? slide.chart : null,
      speakerNotes: asString(slide.speakerNotes, ''),
      brandOverrides: isObject(slide.brandOverrides) ? slide.brandOverrides : {}
    };
  }

  function normalizeSpec(rawSpec) {
    var parsed = safeParseJson(rawSpec);
    if (!parsed.ok) {
      return parsed;
    }

    var spec = parsed.value;
    if (!isObject(spec)) {
      return { ok: false, error: 'PresentationSpec root must be an object.' };
    }

    var metadata = isObject(spec.metadata) ? spec.metadata : {};
    var department = asString(spec.department || metadata.department, 'General');
    if (DEPARTMENTS.indexOf(department) === -1) {
      department = 'General';
    }

    var presentationType = asString(
      spec.presentationType || metadata.presentationType,
      'General'
    );
    if (PRESENTATION_TYPES.indexOf(presentationType) === -1) {
      presentationType = 'General';
    }

    var slides = asArray(spec.slides).map(normalizeSlide);
    if (!slides.length) {
      return { ok: false, error: 'PresentationSpec.slides must contain at least one slide.' };
    }
    if (slides.length > 20) {
      slides = slides.slice(0, 20);
    }

    var normalized = {
      metadata: {
        title: asString(metadata.title || spec.title, '66degrees Presentation'),
        subtitle: asString(metadata.subtitle || spec.subtitle, ''),
        audience: asString(metadata.audience, ''),
        createdBy: asString(metadata.createdBy, '66° Deck Agent')
      },
      department: department,
      presentationType: presentationType,
      theme: asString(spec.theme, '66degrees'),
      slides: slides
    };

    return {
      ok: true,
      value: normalized,
      repaired: !!parsed.repaired,
      warnings: parsed.repaired ? ['JSON was auto-repaired before validation.'] : []
    };
  }

  function validate(rawSpec) {
    return normalizeSpec(rawSpec);
  }

  return {
    DEPARTMENTS: DEPARTMENTS,
    PRESENTATION_TYPES: PRESENTATION_TYPES,
    ELEMENT_TYPES: ELEMENT_TYPES,
    SLIDE_CATEGORIES: SLIDE_CATEGORIES,
    safeParseJson: safeParseJson,
    validate: validate,
    normalizeSpec: normalizeSpec
  };
})();
