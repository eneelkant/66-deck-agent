/**
 * Diagram intelligence — normalize uploaded / extracted diagrams into a brand-safe IR
 * and render that IR as editable Google Slides shapes via the Engine element model.
 *
 * Diagram types, reading and layout follow diagram-design (vendor/diagram-design, MIT): see DiagramDesign.gs.
 * The HTML/SVG rendering layer of that project is not used; diagrams are drawn as editable Slides shapes.
 */

var DIAGRAM_TYPES = [
  'flowchart', 'architecture', 'process', 'timeline', 'swimlane', 'sequence',
  'state', 'tree', 'org-chart', 'data-flow', 'dependency', 'database-schema', 'comparison',
  'layers', 'loop', 'nested', 'high-level'
];

var DIAGRAM_BRAND = {
  nightBlue: '#040A1B',
  white: '#FFFDF9',
  accent: '#0052FF',
  shark: '#B3C5D0',
  panel: '#F3F2F0'
};

/* =========================
   SOURCE DETECTION
========================= */

function detectUploadCategory_(upload) {
  const name = String(upload && upload.name || 'file');
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] ? name.match(/\.([a-z0-9]+)$/i)[1].toLowerCase() : '';
  const mime = String(upload && upload.mimeType || '').toLowerCase();
  if (ext === 'mmd' || ext === 'mermaid') return 'structured-diagram';
  if (ext === 'drawio' || ext === 'dio' || /draw\.io|diagrams\.net/i.test(mime)) return 'structured-diagram';
  if (ext === 'excalidraw' || /excalidraw/i.test(mime)) return 'structured-diagram';
  if (ext === 'svg' || mime === 'image/svg+xml') return 'structured-diagram';
  if (/^(png|jpe?g|webp|gif)$/.test(ext) || /^image\//.test(mime)) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'document';
  if (/^(txt|md|csv|tsv|json|xml|html?|rtf)$/.test(ext) || /^text\//.test(mime)) {
    const text = peekUploadText_(upload);
    if (looksLikeMermaid_(text) || looksLikeDrawioXml_(text) || looksLikeExcalidraw_(text)) return 'structured-diagram';
    return 'document';
  }
  if (/^(xls|xlsx|ods|csv)$/.test(ext)) return 'spreadsheet';
  if (/^(ppt|pptx|odp)$/.test(ext)) return 'presentation';
  return 'other';
}

function peekUploadText_(upload) {
  try {
    const bytes = Utilities.base64Decode(String(upload.data || ''));
    return Utilities.newBlob(bytes).getDataAsString().slice(0, 200000);
  } catch (e) {
    return '';
  }
}

function looksLikeMermaid_(text) {
  return /^\s*(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|journey|gantt|mindmap)\b/im.test(String(text || ''));
}

function looksLikeDrawioXml_(text) {
  const t = String(text || '');
  return /<mxfile[\s>]|<mxGraphModel[\s>]|draw\.io/i.test(t);
}

function looksLikeExcalidraw_(text) {
  const t = String(text || '').trim();
  if (!t || t.charAt(0) !== '{') return false;
  try {
    const j = JSON.parse(t);
    return !!(j && (j.type === 'excalidraw' || Array.isArray(j.elements)));
  } catch (e) {
    return /"type"\s*:\s*"excalidraw"|excalidraw/i.test(t);
  }
}

/* =========================
   IR VALIDATION
========================= */

function emptyDiagramIr_(type, direction) {
  return {
    type: DIAGRAM_TYPES.indexOf(type) !== -1 ? type : 'flowchart',
    direction: String(direction || 'LR').toUpperCase() === 'TB' ? 'TB' : 'LR',
    nodes: [],
    edges: [],
    groups: [],
    iconRequests: [],
    confidence: 1,
    source: 'unknown',
    warnings: []
  };
}

function validateDiagramIr_(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object') return { ok: false, errors: ['diagram IR missing'] };
  const type = String(ir.type || '').toLowerCase();
  if (DIAGRAM_TYPES.indexOf(type) === -1) errors.push('unsupported diagram type: ' + type);
  const dir = String(ir.direction || 'LR').toUpperCase();
  if (dir !== 'LR' && dir !== 'TB') errors.push('direction must be LR or TB');
  const nodes = Array.isArray(ir.nodes) ? ir.nodes : [];
  const edges = Array.isArray(ir.edges) ? ir.edges : [];
  if (!nodes.length) errors.push('diagram has no nodes');
  if (nodes.length > 24) errors.push('too many nodes (max 24)');
  const ids = {};
  nodes.forEach(function (n, i) {
    if (!n || !n.id) errors.push('node ' + i + ' missing id');
    else if (ids[n.id]) errors.push('duplicate node id ' + n.id);
    else ids[n.id] = true;
    if (n.width != null && !(Number(n.width) > 0)) errors.push('node ' + n.id + ' invalid width');
    if (n.height != null && !(Number(n.height) > 0)) errors.push('node ' + n.id + ' invalid height');
    ['x', 'y', 'width', 'height'].forEach(function (k) {
      if (n[k] != null && !isFinite(Number(n[k]))) errors.push('node ' + n.id + ' non-finite ' + k);
    });
  });
  edges.forEach(function (e, i) {
    if (!e || !e.from || !e.to) {
      errors.push('edge ' + i + ' missing from/to');
      return;
    }
    if (!ids[e.from] || !ids[e.to]) errors.push('edge ' + i + ' references missing node');
  });
  return { ok: errors.length === 0, errors: errors };
}

function normalizeDiagramIr_(raw) {
  const ir = emptyDiagramIr_(raw && raw.type, raw && raw.direction);
  ir.source = String(raw && raw.source || 'normalized');
  ir.confidence = Math.max(0, Math.min(1, Number(raw && raw.confidence != null ? raw.confidence : 1) || 0));
  ir.warnings = Array.isArray(raw && raw.warnings) ? raw.warnings.slice() : [];
  const nodes = Array.isArray(raw && raw.nodes) ? raw.nodes : [];
  const seen = {};
  nodes.slice(0, 24).forEach(function (n, i) {
    if (!n) return;
    const id = String(n.id || ('n' + (i + 1))).replace(/\s+/g, '_').slice(0, 40);
    if (seen[id]) return;
    seen[id] = true;
    ir.nodes.push({
      id: id,
      type: String(n.type || 'process').toLowerCase(),
      label: String(n.label || n.text || id).replace(/\s+/g, ' ').trim().slice(0, 80),
      x: isFinite(Number(n.x)) ? Number(n.x) : i * 140,
      y: isFinite(Number(n.y)) ? Number(n.y) : 0,
      width: Math.max(48, Number(n.width) || 120),
      height: Math.max(28, Number(n.height) || 48),
      emphasize: !!n.emphasize,
      iconConcept: n.iconConcept ? String(n.iconConcept).slice(0, 60) : '',
      sub: n.sub ? String(n.sub).replace(/\s+/g, ' ').trim().slice(0, 40) : '',
      kind: n.kind ? String(n.kind).toLowerCase() : '',
      group: n.group ? String(n.group) : ''
    });
  });
  const edges = Array.isArray(raw && raw.edges) ? raw.edges : [];
  edges.forEach(function (e) {
    if (!e || !seen[e.from] || !seen[e.to]) return;
    ir.edges.push({
      from: String(e.from),
      to: String(e.to),
      label: String(e.label || '').slice(0, 40),
      emphasize: !!e.emphasize,
      dashed: !!e.dashed
    });
  });
  ir.groups = Array.isArray(raw && raw.groups) ? raw.groups.slice(0, 12) : [];
  ir.iconRequests = Array.isArray(raw && raw.iconRequests) ? raw.iconRequests.slice(0, 16) : [];
  ir.nodes.forEach(function (n) {
    if (n.iconConcept) {
      ir.iconRequests.push({ concept: n.iconConcept, nodeId: n.id, style: 'outline' });
    }
  });
  return brandTransformDiagramIr_(ir);
}

function brandTransformDiagramIr_(ir) {
  ir.brand = {
    text: DIAGRAM_BRAND.nightBlue,
    background: DIAGRAM_BRAND.white,
    accent: DIAGRAM_BRAND.accent,
    support: DIAGRAM_BRAND.shark,
    panel: DIAGRAM_BRAND.panel
  };
  // Accent is reserved for emphasized nodes / key paths only (diagram-design principle).
  ir.nodes.forEach(function (n, i) {
    n.fill = n.emphasize ? DIAGRAM_BRAND.accent : DIAGRAM_BRAND.panel;
    n.stroke = n.emphasize ? DIAGRAM_BRAND.accent : DIAGRAM_BRAND.shark;
    n.textColor = n.emphasize ? DIAGRAM_BRAND.white : DIAGRAM_BRAND.nightBlue;
  });
  ir.edges.forEach(function (e) {
    e.color = e.emphasize ? DIAGRAM_BRAND.accent : DIAGRAM_BRAND.nightBlue;
    e.width = e.emphasize ? 1.75 : 1.25;
  });
  return ir;
}

/* =========================
   PARSERS
========================= */

function parseMermaidToIr_(text) {
  const src = String(text || '');
  const ir = emptyDiagramIr_('flowchart', /TB|TD/i.test(src) ? 'TB' : 'LR');
  ir.source = 'mermaid';
  const nodeRe = /([A-Za-z][\w-]*)\s*(?:\["([^"]+)"\]|\('([^']+)'\)|\[([^\]]+)\]|\(([^)]+)\))/g;
  let m;
  const order = [];
  while ((m = nodeRe.exec(src))) {
    const id = m[1];
    const label = m[2] || m[3] || m[4] || m[5] || id;
    if (order.indexOf(id) === -1) {
      order.push(id);
      ir.nodes.push({ id: id, type: /\{/.test(m[0]) ? 'decision' : 'process', label: label, x: 0, y: 0, width: 120, height: 48 });
    }
  }
  // Allow optional node decorations between ids and the arrow: A[Label] -->|yes| B(Label)
  const edgeRe = /([A-Za-z][\w-]*)\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|"[^"]*"|'[^']*')?\s*(-->|---|-.->|==>|-->>)\s*(?:\|([^|]+)\|)?\s*([A-Za-z][\w-]*)/g;
  while ((m = edgeRe.exec(src))) {
    if (order.indexOf(m[1]) === -1) {
      order.push(m[1]);
      ir.nodes.push({ id: m[1], type: 'process', label: m[1], x: 0, y: 0, width: 120, height: 48 });
    }
    if (order.indexOf(m[4]) === -1) {
      order.push(m[4]);
      ir.nodes.push({ id: m[4], type: 'process', label: m[4], x: 0, y: 0, width: 120, height: 48 });
    }
    ir.edges.push({ from: m[1], to: m[4], label: String(m[3] || '').trim() });
  }
  if (!ir.nodes.length) {
    ir.warnings.push('mermaid parse produced no nodes');
    ir.confidence = 0;
  }
  return normalizeDiagramIr_(ir);
}

function parseDrawioToIr_(text) {
  const src = String(text || '');
  const ir = emptyDiagramIr_('flowchart', 'LR');
  ir.source = 'drawio';
  const cellRe = /<mxCell\b([^>]*)\/?>/g;
  let m;
  const nodes = {};
  const edges = [];
  while ((m = cellRe.exec(src))) {
    const attrs = m[1];
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    const value = ((attrs.match(/\bvalue="([^"]*)"/) || [])[1] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#xa;/gi, ' ').trim();
    const isEdge = /\bedge="1"/.test(attrs);
    const source = (attrs.match(/\bsource="([^"]+)"/) || [])[1];
    const target = (attrs.match(/\btarget="([^"]+)"/) || [])[1];
    const vertex = /\bvertex="1"/.test(attrs);
    if (!id) continue;
    if (isEdge && source && target) {
      edges.push({ from: source, to: target, label: value });
    } else if (vertex && value) {
      const geo = src.slice(m.index, m.index + 400);
      const x = Number((geo.match(/\bx="([\d.]+)"/) || [])[1] || 0);
      const y = Number((geo.match(/\by="([\d.]+)"/) || [])[1] || 0);
      const w = Number((geo.match(/\bwidth="([\d.]+)"/) || [])[1] || 120);
      const h = Number((geo.match(/\bheight="([\d.]+)"/) || [])[1] || 48);
      nodes[id] = { id: id, type: 'process', label: value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), x: x, y: y, width: w, height: h };
    }
  }
  Object.keys(nodes).forEach(function (k) { ir.nodes.push(nodes[k]); });
  edges.forEach(function (e) {
    if (nodes[e.from] && nodes[e.to]) ir.edges.push(e);
  });
  if (!ir.nodes.length) {
    ir.warnings.push('drawio parse produced no nodes');
    ir.confidence = 0;
  }
  return normalizeDiagramIr_(ir);
}

function parseExcalidrawToIr_(text) {
  const ir = emptyDiagramIr_('flowchart', 'LR');
  ir.source = 'excalidraw';
  let data;
  try { data = JSON.parse(String(text || '')); } catch (e) {
    ir.warnings.push('excalidraw JSON invalid');
    ir.confidence = 0;
    return normalizeDiagramIr_(ir);
  }
  const elements = Array.isArray(data.elements) ? data.elements : [];
  const nodes = {};
  elements.forEach(function (el, i) {
    if (!el || el.isDeleted) return;
    if (el.type === 'text' && el.text) {
      const id = String(el.id || ('t' + i));
      nodes[id] = {
        id: id,
        type: 'process',
        label: String(el.text).replace(/\s+/g, ' ').trim().slice(0, 80),
        x: Number(el.x) || 0,
        y: Number(el.y) || 0,
        width: Math.max(48, Number(el.width) || 120),
        height: Math.max(28, Number(el.height) || 48)
      };
    } else if ((el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') && el.boundElements) {
      // Prefer labeled shapes via linked text ids when present in a later pass.
      const id = String(el.id || ('s' + i));
      if (!nodes[id]) {
        nodes[id] = {
          id: id,
          type: el.type === 'diamond' ? 'decision' : 'process',
          label: id,
          x: Number(el.x) || 0,
          y: Number(el.y) || 0,
          width: Math.max(48, Number(el.width) || 120),
          height: Math.max(28, Number(el.height) || 48)
        };
      }
    } else if (el.type === 'arrow' && el.startBinding && el.endBinding) {
      ir.edges.push({
        from: String(el.startBinding.elementId),
        to: String(el.endBinding.elementId),
        label: ''
      });
    }
  });
  // Attach text labels sitting on/near shapes.
  elements.forEach(function (el) {
    if (!el || el.type !== 'text' || !el.containerId || !nodes[el.containerId]) return;
    nodes[el.containerId].label = String(el.text || nodes[el.containerId].label).replace(/\s+/g, ' ').trim().slice(0, 80);
  });
  Object.keys(nodes).forEach(function (k) {
    if (nodes[k].label && nodes[k].label !== k) ir.nodes.push(nodes[k]);
  });
  if (!ir.nodes.length) {
    Object.keys(nodes).slice(0, 16).forEach(function (k) { ir.nodes.push(nodes[k]); });
  }
  ir.edges = ir.edges.filter(function (e) { return nodes[e.from] && nodes[e.to]; });
  if (!ir.nodes.length) {
    ir.warnings.push('excalidraw parse produced no nodes');
    ir.confidence = 0;
  }
  return normalizeDiagramIr_(ir);
}

function parseSvgToIr_(svgText) {
  const src = String(svgText || '');
  const ir = emptyDiagramIr_('flowchart', 'LR');
  ir.source = 'svg';
  const texts = [];
  const textRe = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = textRe.exec(src))) {
    const label = String(m[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (label) texts.push(label.slice(0, 80));
  }
  texts.slice(0, 16).forEach(function (label, i) {
    ir.nodes.push({ id: 'n' + (i + 1), type: 'process', label: label, x: (i % 4) * 140, y: Math.floor(i / 4) * 80, width: 120, height: 48 });
  });
  for (let i = 0; i < ir.nodes.length - 1; i++) {
    ir.edges.push({ from: ir.nodes[i].id, to: ir.nodes[i + 1].id, label: '' });
  }
  if (!ir.nodes.length) {
    ir.warnings.push('svg parse produced no text nodes');
    ir.confidence = 0;
  } else {
    ir.confidence = 0.6;
  }
  return normalizeDiagramIr_(ir);
}

/* =========================
   VISION EXTRACTION (Vertex)
========================= */

function extractDiagramIrFromImage_(image, ctx) {
  const fallback = emptyDiagramIr_('flowchart', 'LR');
  fallback.source = 'vision';
  fallback.confidence = 0;
  fallback.warnings = ['vision extraction unavailable'];
  if (!image || !image.data) return normalizeDiagramIr_(fallback);
  try {
    const prompt =
      'Analyze this image. If it contains a structured diagram (flowchart, architecture, process, etc.), ' +
      'return ONLY JSON with keys: type, direction (LR|TB), confidence (0-1), nodes[{id,type,label,emphasize,iconConcept}], ' +
      'edges[{from,to,label,emphasize}], groups[], warnings[]. ' +
      'If it is not a structured diagram, return {"type":"flowchart","confidence":0,"nodes":[],"edges":[],"warnings":["not a diagram"]}.';
    const parts = [
      { text: prompt },
      { inline_data: { mime_type: image.mime || 'image/png', data: image.data } }
    ];
    const raw = callGeminiJSON(parts, ctx && ctx.apiKey, 0.1);
    if (!raw || !Array.isArray(raw.nodes) || !raw.nodes.length || Number(raw.confidence) < 0.45) {
      fallback.warnings = (raw && raw.warnings) || ['low-confidence vision extraction'];
      fallback.confidence = Number(raw && raw.confidence) || 0;
      return normalizeDiagramIr_(fallback);
    }
    raw.source = 'vision';
    return normalizeDiagramIr_(raw);
  } catch (e) {
    fallback.warnings = ['vision extraction failed: ' + (e && e.message ? e.message : String(e))];
    return normalizeDiagramIr_(fallback);
  }
}

/* =========================
   UPLOAD → IR PIPELINE
========================= */

function ingestUploadedDiagram_(upload, sources, ctx) {
  sources.diagrams = sources.diagrams || [];
  sources.images = sources.images || [];
  const category = detectUploadCategory_(upload);
  const name = String(upload.name || 'file');
  if (category !== 'structured-diagram' && category !== 'image') {
    return { ok: false, category: category, reason: 'not a diagram source' };
  }

  let ir = null;
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] ? name.match(/\.([a-z0-9]+)$/i)[1].toLowerCase() : '';
  const mime = String(upload.mimeType || '').toLowerCase();

  if (category === 'structured-diagram') {
    const text = peekUploadText_(upload);
    if (ext === 'mmd' || ext === 'mermaid' || looksLikeMermaid_(text)) ir = parseMermaidToIr_(text);
    else if (ext === 'drawio' || ext === 'dio' || looksLikeDrawioXml_(text)) ir = parseDrawioToIr_(text);
    else if (ext === 'excalidraw' || looksLikeExcalidraw_(text)) ir = parseExcalidrawToIr_(text);
    else if (ext === 'svg' || mime === 'image/svg+xml') ir = parseSvgToIr_(text);
    else if (looksLikeMermaid_(text)) ir = parseMermaidToIr_(text);
  }

  // Pictures are read by Vertex AI following diagram-design (type selection, budget, overview + detail split)
  if ((!ir || !validateDiagramIr_(ir).ok) && category === 'image' && typeof diagramDesignRead_ === 'function' && typeof DIAGRAM_DESIGN_KIT !== 'undefined') {
    if (ctx) progressStage_(ctx, 'diagram', 'active', 'Reading the diagram (diagram-design)');
    const got = diagramDesignRead_(diagramUploadParts_(upload), {}, ctx || { log: [] });
    if (ctx) got.log.forEach(function (l) { ctx.log.push(l); });
    if (got.diagrams.length) {
      got.diagrams.forEach(function (d) { sources.diagrams.push({ name: name, category: category, ir: d }); });
      noteDiagramsForPlanner_(sources, got.diagrams, name);
      return { ok: true, category: category, ir: got.diagrams[0], irs: got.diagrams };
    }
    ir = null;
  } else if ((!ir || !validateDiagramIr_(ir).ok) && category === 'image') {
    if (ctx) progressStage_(ctx, 'diagram', 'active', 'Analyzing diagram');
    ir = extractDiagramIrFromImage_({ mime: mime || 'image/png', data: String(upload.data) }, ctx);
  }

  const check = validateDiagramIr_(ir);
  if (!check.ok) {
    sources.diagramFallbacks = sources.diagramFallbacks || [];
    if (category === 'image') {
      sources.images.push({ mime: mime || 'image/png', data: String(upload.data), name: name, role: 'diagram-fallback' });
    }
    sources.diagramFallbacks.push({ name: name, errors: check.errors, warnings: (ir && ir.warnings) || [] });
    if (ctx) ctx.log.push('Diagram fallback for ' + name + ': ' + check.errors.join('; '));
    return { ok: false, category: category, ir: ir, errors: check.errors, fallback: true };
  }

  sources.diagrams.push({ name: name, category: category, ir: ir });
  noteDiagramsForPlanner_(sources, [ir], name);
  if (ctx) ctx.log.push('Diagram reconstructed from ' + name + ' (' + ir.type + ', ' + ir.nodes.length + ' nodes).');
  return { ok: true, category: category, ir: ir };
}

/** The content writer is told which diagrams were uploaded, so the deck plans a slide for each. */
function noteDiagramsForPlanner_(sources, irs, name) {
  if (typeof sources.text !== 'string') return;
  irs.forEach(function (ir) {
    sources.text += (sources.text ? '\n\n' : '') + 'UPLOADED DIAGRAM "' + (ir.title || name) + '" (' + ir.type + '; gets its own diagram slide): ' +
      ir.nodes.map(function (n) { return n.label; }).join(', ') + '.';
  });
}

function diagramWords_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) {
    return w.length > 3 && ['with', 'from', 'into', 'that', 'this', 'your', 'their', 'over', 'what'].indexOf(w) === -1;
  });
}

/**
 * Every uploaded diagram gets a whole slide of its own: the slide whose topic matches it best (or an empty diagram
 * slide the writer planned) becomes that diagram, with the diagram's title. opts.force: place it even without a match
 * (short decks always; long decks on their last batch).
 */
function attachDiagramsToPlan_(plan, sources, ctx, opts) {
  opts = opts || {};
  const diagrams = (sources && sources.diagrams) || [];
  if (!plan || !Array.isArray(plan.slides) || !diagrams.length) return 0;
  const force = opts.force !== false;
  let attached = 0;
  const skip = ['cover', 'closing', 'agenda', 'section', 'team', 'quote'];
  diagrams.forEach(function (entry, di) {
    if (entry.attached) return;
    const ir = entry.ir;
    const want = diagramWords_((ir.title || '') + ' ' + ir.nodes.map(function (n) { return n.label; }).join(' '));
    let target = null, best = 0;
    plan.slides.forEach(function (sl) {
      const t = String(sl.type || '').toLowerCase();
      if (sl.diagram || skip.indexOf(t) !== -1) return;
      if ((t === 'diagram' || t === 'flowchart' || t === 'architecture' || t === 'process') && best < 100) { target = sl; best = 100; return; }
      const have = diagramWords_([sl.title, sl.lead, sl.subtitle].concat((sl.items || []).map(function (it) { return (it && (it.title || it.text)) || ''; })).join(' '));
      const score = want.filter(function (w, i) { return want.indexOf(w) === i && have.indexOf(w) !== -1; }).length;
      if (score > best) { best = score; target = sl; }
    });
    if (best < 2 && !force) return;
    if (!target || best < 2) {
      // no match: the first content slide after the agenda
      target = plan.slides.filter(function (sl) { return !sl.diagram && skip.indexOf(String(sl.type || '').toLowerCase()) === -1; })[0] || null;
    }
    if (!target) return;
    target.type = 'diagram';
    target.diagram = ir;
    target.visual = { type: ir.type, source: entry.name || 'uploaded-diagram', iconRequests: (ir.iconRequests || []).slice() };
    if (ir.title) target.title = ir.title;
    if (!target.title) target.title = 'Solution overview';
    target.lead = ir.lead || '';
    target.items = ir.nodes.slice(0, 8).map(function (n) { return { title: n.label, text: n.sub || n.label }; });
    entry.attached = true;
    attached += 1;
    if (ctx) ctx.log.push('Diagram ' + (di + 1) + ' (' + ir.type + ') drawn on slide "' + target.title + '".');
  });
  return attached;
}

/* =========================
   IR → ENGINE ELEMENTS
========================= */

function diagramNodeShape_(nodeType) {
  const t = String(nodeType || 'process').toLowerCase();
  if (t === 'decision') return 'FLOW_CHART_DECISION';
  if (t === 'terminator' || t === 'start' || t === 'end') return 'FLOW_CHART_TERMINATOR';
  if (t === 'data' || t === 'io') return 'FLOW_CHART_DATA';
  return 'FLOW_CHART_PROCESS';
}

function layoutDiagramIrPositions_(ir, area) {
  const box = {
    x: Number(area && area.x) || 40,
    y: Number(area && area.y) || 70,
    w: Math.max(80, Number(area && area.w) || 640),
    h: Math.max(80, Number(area && area.h) || 280)
  };
  const nodes = ir.nodes || [];
  const hasCoords = nodes.every(function (n) { return isFinite(n.x) && isFinite(n.y); });
  // Prefer authored coordinates when they span a useful area; otherwise auto-grid.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(function (n) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.width || 120));
    maxY = Math.max(maxY, n.y + (n.height || 48));
  });
  const spanW = maxX - minX;
  const spanH = maxY - minY;
  if (hasCoords && spanW > 40 && spanH > 20) {
    const sx = box.w / Math.max(spanW, 1);
    const sy = box.h / Math.max(spanH, 1);
    const scale = Math.min(sx, sy, 1);
    const positions = {};
    nodes.forEach(function (n) {
      positions[n.id] = {
        x: box.x + (n.x - minX) * scale,
        y: box.y + (n.y - minY) * scale,
        w: Math.max(56, Math.min(160, (n.width || 120) * scale)),
        h: Math.max(32, Math.min(72, (n.height || 48) * scale))
      };
    });
    return positions;
  }
  if (typeof layoutDiagramPositions === 'function') {
    return layoutDiagramPositions(ir, box);
  }
  // Local fallback grid
  const positions = {};
  const n = Math.max(nodes.length, 1);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const gap = 12;
  const cellW = Math.max(56, (box.w - gap * (cols - 1)) / cols);
  const cellH = Math.max(32, (box.h - gap * (rows - 1)) / rows);
  nodes.forEach(function (node, i) {
    positions[node.id] = {
      x: box.x + (i % cols) * (cellW + gap),
      y: box.y + Math.floor(i / cols) * (cellH + gap),
      w: cellW,
      h: cellH
    };
  });
  return positions;
}

function diagramIrToEngineElements_(ir, area) {
  const els = [];
  const check = validateDiagramIr_(ir);
  if (!check.ok) return els;
  const positions = layoutDiagramIrPositions_(ir, area);
  const centers = {};
  ir.nodes.forEach(function (node) {
    const p = positions[node.id];
    if (!p || !(p.w > 0) || !(p.h > 0)) return;
    centers[node.id] = { x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w, h: p.h, x0: p.x, y0: p.y };
    els.push({
      t: 'shape',
      shape: diagramNodeShape_(node.type),
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      fill: node.fill || DIAGRAM_BRAND.panel,
      line: { color: node.stroke || DIAGRAM_BRAND.shark, width: 1 },
      text: node.label
    });
    if (node.iconConcept || (ir.iconRequests || []).some(function (r) { return r.nodeId === node.id; })) {
      const req = (ir.iconRequests || []).filter(function (r) { return r.nodeId === node.id; })[0];
      els.push({
        t: 'icon',
        name: (req && req.concept) || node.iconConcept || node.label,
        concept: (req && req.concept) || node.iconConcept || node.label,
        x: p.x + 8,
        y: p.y + 8,
        size: 16,
        color: node.emphasize ? DIAGRAM_BRAND.white : DIAGRAM_BRAND.accent,
        dark: !!node.emphasize
      });
    }
  });
  ir.edges.forEach(function (edge) {
    const a = centers[edge.from];
    const b = centers[edge.to];
    if (!a || !b) return;
    let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    // Nudge endpoints to node borders for clearer connectors.
    if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
      x1 = x2 > x1 ? a.x0 + a.w : a.x0;
      x2 = x2 > a.x ? b.x0 : b.x0 + b.w;
    } else {
      y1 = y2 > y1 ? a.y0 + a.h : a.y0;
      y2 = y2 > a.y ? b.y0 : b.y0 + b.h;
    }
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
    if (x1 === x2 && y1 === y2) x2 += 4;
    els.push({
      t: 'line',
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      color: edge.color || DIAGRAM_BRAND.nightBlue,
      width: edge.width || 1.25
    });
    if (edge.label) {
      els.push({
        t: 'text',
        text: edge.label,
        x: (x1 + x2) / 2 - 40,
        y: (y1 + y2) / 2 - 8,
        w: 80,
        h: 16,
        size: 9,
        color: DIAGRAM_BRAND.shark,
        align: 'center'
      });
    }
  });
  return els;
}

/* =========================
   FLOWCHART LAYOUT (aligned, layered)
   Steps are placed in columns by their order (longest path from the start), decisions branch into rows, and the
   whole chart is centred in the content area with even spacing. Long single chains wrap into rows that read like a
   snake. Arrows are elbow connectors (horizontal - vertical - horizontal) with an arrow head; loops go underneath.
========================= */

var FLOW_TYPES_ = ['flowchart', 'process', 'data-flow', 'swimlane', 'architecture', 'dependency', 'state', 'sequence', 'tree', 'org-chart'];

function flowchartLayers_(ir) {
  const nodes = ir.nodes || [], edges = ir.edges || [];
  const out = {}, inc = {};
  nodes.forEach(function (n) { out[n.id] = []; inc[n.id] = 0; });
  edges.forEach(function (e) { if (out[e.from] && out[e.to] != null) { out[e.from].push(e.to); } });
  // DFS from the starts marks back edges (loops), so ranks follow the forward flow only
  const state = {}, back = {};
  const starts = nodes.filter(function (n) { return !edges.some(function (e) { return e.to === n.id; }); }).map(function (n) { return n.id; });
  const visit = function (id) {
    state[id] = 1;
    out[id].forEach(function (t) {
      if (state[t] === 1) back[id + '>' + t] = true;
      else if (!state[t]) visit(t);
    });
    state[id] = 2;
  };
  (starts.length ? starts : [nodes[0] && nodes[0].id]).forEach(function (id) { if (id && !state[id]) visit(id); });
  nodes.forEach(function (n) { if (!state[n.id]) visit(n.id); });
  const rank = {};
  nodes.forEach(function (n) { rank[n.id] = 0; });
  // longest path on the forward edges (n passes is enough for <= 24 nodes)
  for (let k = 0; k < nodes.length; k++) {
    let moved = false;
    edges.forEach(function (e) {
      if (back[e.from + '>' + e.to] || rank[e.from] == null || rank[e.to] == null) return;
      if (rank[e.to] < rank[e.from] + 1) { rank[e.to] = rank[e.from] + 1; moved = true; }
    });
    if (!moved) break;
  }
  const layers = [];
  nodes.forEach(function (n) { (layers[rank[n.id]] = layers[rank[n.id]] || []).push(n.id); });
  const clean = layers.filter(function (l) { return l && l.length; });
  // order inside a layer: average position of the steps that lead into it (fewer crossing arrows)
  const pos = {};
  clean.forEach(function (layer, li) {
    if (li > 0) {
      layer.sort(function (a, b) {
        const avg = function (id) {
          const ps = edges.filter(function (e) { return e.to === id && pos[e.from] != null && !back[e.from + '>' + e.to]; }).map(function (e) { return pos[e.from]; });
          return ps.length ? ps.reduce(function (x, y) { return x + y; }, 0) / ps.length : 0;
        };
        return avg(a) - avg(b);
      });
    }
    layer.forEach(function (id, j) { pos[id] = j - (layer.length - 1) / 2; });
  });
  return { layers: clean, back: back };
}

function layoutFlowchart_(ir, area) {
  const lay = flowchartLayers_(ir);
  const L = lay.layers.length, maxW = Math.max.apply(null, lay.layers.map(function (l) { return l.length; }).concat([1]));
  const byId = {};
  (ir.nodes || []).forEach(function (n) { byId[n.id] = n; });
  const pos = {};
  let dir = 'LR';
  if (L > 7 && maxW === 1) dir = 'SNAKE';            // a long single chain wraps into rows
  else if (L > 7 && L <= 12 && maxW <= 2) dir = 'TB2'; // long chain with a few branches: two bands
  const gapX = 26, gapY = 18;
  const place = function (id, cx, cy, w, h) {
    const n = byId[id] || {};
    const isDecision = /decision/i.test(n.type || '');
    const ww = isDecision ? Math.min(w, h * 2.4) : w, hh = isDecision ? h * 1.25 : h;
    pos[id] = { x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh, cx: cx, cy: cy };
  };
  if (dir === 'LR') {
    const colW = (area.w - gapX * (L - 1)) / L;
    const nodeW = Math.min(150, colW);
    const rowH = Math.min(78, (area.h - gapY * (maxW - 1)) / maxW);
    const nodeH = Math.max(34, Math.min(48, rowH - 6));
    const usedW = nodeW * L + gapX * (L - 1) + (colW - nodeW) * 0;
    const x0 = area.x + (area.w - (colW * L + gapX * (L - 1))) / 2;
    lay.layers.forEach(function (layer, i) {
      const cx = x0 + i * (colW + gapX) + colW / 2;
      layer.forEach(function (id, j) {
        const cy = area.y + area.h / 2 + (j - (layer.length - 1) / 2) * (rowH + gapY);
        place(id, cx, cy, nodeW, nodeH);
      });
    });
  } else {
    // rows of layers: SNAKE (one node per layer, alternate direction) or TB2 (two bands left to right)
    const perRow = dir === 'SNAKE' ? Math.min(6, Math.ceil(L / Math.ceil(L / 6))) : Math.ceil(L / 2);
    const rows = Math.ceil(L / perRow);
    const colW = (area.w - gapX * (perRow - 1)) / perRow;
    const nodeW = Math.min(140, colW);
    const bandH = Math.min(maxW > 1 ? 150 : 96, (area.h - gapY * 2 * (rows - 1)) / rows); // rows sit close together; the whole chart is centred below
    const subH = Math.min(70, bandH / maxW);
    const nodeH = Math.max(32, Math.min(46, subH - 8));
    lay.layers.forEach(function (layer, i) {
      const r = Math.floor(i / perRow);
      let c = i % perRow;
      if (dir === 'SNAKE' && r % 2 === 1) c = perRow - 1 - c;
      const cx = area.x + (area.w - (colW * perRow + gapX * (perRow - 1))) / 2 + c * (colW + gapX) + colW / 2;
      const bandCy = area.y + r * (bandH + gapY * 2) + bandH / 2;
      layer.forEach(function (id, j) { place(id, cx, bandCy + (j - (layer.length - 1) / 2) * subH, nodeW, nodeH); });
    });
  }
  // centre the finished chart vertically and horizontally in the area (alignment)
  const ids = Object.keys(pos);
  if (ids.length) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ids.forEach(function (id) { const p = pos[id]; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y + p.h); });
    const dx = area.x + (area.w - (maxX - minX)) / 2 - minX, dy = area.y + (area.h - (maxY - minY)) / 2 - minY;
    ids.forEach(function (id) { const p = pos[id]; p.x += dx; p.y += dy; p.cx += dx; p.cy += dy; });
  }
  return { pos: pos, dir: dir, back: lay.back };
}

function flowchartToElements_(ir, area) {
  const els = [];
  const L = layoutFlowchart_(ir, area);
  const P = L.pos;
  let maxBottom = -Infinity;
  Object.keys(P).forEach(function (id) { maxBottom = Math.max(maxBottom, P[id].y + P[id].h); });
  (ir.nodes || []).forEach(function (n) {
    const p = P[n.id];
    if (!p) return;
    if (typeof ddNodeEl_ === 'function') { els.push(ddNodeEl_(n, p, false)); return; }
    const t = String(n.type || 'process').toLowerCase();
    const label = String(n.label || '');
    const size = label.length > 34 ? 9 : label.length > 22 ? 10 : 11;
    const textStyle = { size: size, color: n.textColor || DIAGRAM_BRAND.nightBlue, align: 'center', valign: 'middle' };
    if (t === 'decision' || t === 'terminator' || t === 'start' || t === 'end' || t === 'data' || t === 'io') {
      els.push({ t: 'shape', shape: diagramNodeShape_(t), x: p.x, y: p.y, w: p.w, h: p.h, fill: n.fill || DIAGRAM_BRAND.panel,
        line: { color: n.stroke || DIAGRAM_BRAND.shark, width: 1 }, text: label, textStyle: textStyle });
    } else {
      els.push({ t: 'rect', x: p.x, y: p.y, w: p.w, h: p.h, fill: n.fill || DIAGRAM_BRAND.panel,
        line: { color: n.stroke || DIAGRAM_BRAND.shark, width: 1 }, text: label, textStyle: textStyle });
    }
  });
  const seg = function (x1, y1, x2, y2, color, width, arrow) {
    if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;
    els.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, color: color, width: width, arrow: !!arrow, dash: !!dashNow });
  };
  let dashNow = false;
  let loop = 0;
  (ir.edges || []).forEach(function (e) {
    const a = P[e.from], b = P[e.to];
    if (!a || !b) return;
    const color = e.color || DIAGRAM_BRAND.nightBlue, width = e.dashed ? 0.75 : (e.width || 1.25);
    dashNow = !!e.dashed;
    let lx, ly;
    if (L.back[e.from + '>' + e.to]) {
      // loop back: down from the step, along underneath the chart, up into the earlier step
      const yb = maxBottom + 14 + 8 * (loop++ % 3);
      seg(a.cx, a.y + a.h, a.cx, yb, color, width);
      seg(a.cx, yb, b.cx, yb, color, width);
      seg(b.cx, yb, b.cx, b.y + b.h, color, width, true);
      lx = (a.cx + b.cx) / 2; ly = yb - 14;
    } else if (Math.abs(a.cy - b.cy) < 2) {
      const right = b.cx > a.cx;
      seg(right ? a.x + a.w : a.x, a.cy, right ? b.x : b.x + b.w, b.cy, color, width, true);
      lx = (a.cx + b.cx) / 2; ly = a.cy - 15;
    } else if (Math.abs(a.cx - b.cx) < 2) {
      const down = b.cy > a.cy;
      seg(a.cx, down ? a.y + a.h : a.y, b.cx, down ? b.y : b.y + b.h, color, width, true);
      lx = a.cx + 4; ly = (a.cy + b.cy) / 2 - 7;
    } else if (L.dir !== 'LR' && Math.abs(b.cy - a.cy) > a.h) {
      // row change (snake / two bands): down from the step, across, down into the next
      const ym = (a.y + a.h + b.y) / 2;
      seg(a.cx, a.y + a.h, a.cx, ym, color, width);
      seg(a.cx, ym, b.cx, ym, color, width);
      seg(b.cx, ym, b.cx, b.y, color, width, true);
      lx = (a.cx + b.cx) / 2; ly = ym - 14;
    } else {
      // elbow: out of the right side, vertical in the gap between columns, into the left side
      const right = b.cx > a.cx;
      const x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w, xm = (x1 + x2) / 2;
      seg(x1, a.cy, xm, a.cy, color, width);
      seg(xm, a.cy, xm, b.cy, color, width);
      seg(xm, b.cy, x2, b.cy, color, width, true);
      // the label sits left of the vertical run, next to the turn into the target step, so it never sits on a line or a box
      const ty = b.cy + (b.cy < a.cy ? 9 : -9);
      if (e.label) els.push({ t: 'text', text: String(e.label).slice(0, 24), x: xm - 4 - 60 - 7.2, y: ty - 7 - 7.2, w: 60 + 14.4, h: 14 + 14.4,
        size: 9, weight: 500, font: 'sans', color: DIAGRAM_BRAND.accent, align: 'right', valign: 'middle', spacing: 1 });
      return;
    }
    if (e.label) els.push({ t: 'text', text: String(e.label).slice(0, 24), x: lx - 30 - 7.2, y: ly - 7.2, w: 60 + 14.4, h: 14 + 14.4, size: 9, weight: 500,
      font: 'sans', color: DIAGRAM_BRAND.accent, align: 'center', valign: 'middle', spacing: 1 });
  });
  return els;
}

function applyDiagramIrToEngineOutput_(out, spec, tokens) {
  if (!spec || !spec.diagram || !out) return out;
  const check = validateDiagramIr_(spec.diagram);
  if (!check.ok) {
    out.notes = (out.notes ? out.notes + '\n' : '') + 'Diagram IR invalid; template layout kept. ' + check.errors.join('; ');
    return out;
  }
  // The chart starts under the slide's own title and intro (found by their text, never a box label)
  const norm = function (v) { return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 24); };
  const want = [norm(spec.title), norm(spec.lead)].filter(Boolean);
  const head = (out.els || []).filter(function (e) {
    return e && e.t === 'text' && e.y != null && e.y < 120 && want.some(function (w) { return w && norm(e.text).indexOf(w.slice(0, 16)) === 0; });
  });
  let headBottom = 64;
  head.forEach(function (e) { headBottom = Math.max(headBottom, e.y + (e.vh || e.h || 0) + 6); });
  const area = { x: 40, y: headBottom, w: 640, h: Math.max(160, 352 - headBottom) };
  const ir = spec.diagram;
  const useFlow = (ir.edges || []).length > 0 && FLOW_TYPES_.indexOf(String(ir.type || 'flowchart')) !== -1;
  const body = typeof drawDiagramDesign_ === 'function' && (useFlow || ir.groups.length || ['layers', 'loop', 'tree', 'org-chart', 'nested', 'high-level', 'architecture'].indexOf(String(ir.type)) !== -1)
    ? drawDiagramDesign_(ir, area)
    : (useFlow ? flowchartToElements_(ir, area) : diagramIrToEngineElements_(ir, area));
  if (!body.length) return out;
  // Keep header/footer chrome from the template layout; replace body-ish elements.
  const chrome = (out.els || []).filter(function (e) {
    if (!e) return false;
    if (e.t === 'image' && /logo|mark|pattern/i.test(String(e.asset || ''))) return true;
    if (head.indexOf(e) !== -1) return true;
    if (e.t === 'rect' && e.y != null && e.h != null && e.y + e.h <= 56) return true;
    if (e.t === 'text' && e.y != null && e.y >= 370) return true;
    return false;
  });
  out.els = chrome.concat(body);
  out.fromDiagramIr = true;
  return out;
}

var DiagramIR = {
  types: DIAGRAM_TYPES,
  detectUploadCategory: detectUploadCategory_,
  validate: validateDiagramIr_,
  normalize: normalizeDiagramIr_,
  parseMermaid: parseMermaidToIr_,
  parseDrawio: parseDrawioToIr_,
  parseExcalidraw: parseExcalidrawToIr_,
  parseSvg: parseSvgToIr_,
  extractFromImage: extractDiagramIrFromImage_,
  ingestUpload: ingestUploadedDiagram_,
  attachToPlan: attachDiagramsToPlan_,
  toElements: diagramIrToEngineElements_,
  layoutFlowchart: layoutFlowchart_,
  flowchartToElements: flowchartToElements_,
  applyToEngineOutput: applyDiagramIrToEngineOutput_
};
