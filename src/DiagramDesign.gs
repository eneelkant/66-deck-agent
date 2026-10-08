/**
 * Diagram design pipeline: every flowchart / diagram the add-on makes or rebuilds follows the diagram-design
 * skill (vendor/diagram-design, MIT, Cathryn Lavery; rules bundled in DiagramDesignKit.gs).
 *
 *   1. READ     uploads become parts Vertex AI can see: images, PDF pages, and the pictures + text inside a .pptx
 *   2. SELECT   Vertex AI picks the diagram type with diagram-design's selection table and complexity budget
 *               (and splits a dense picture into an overview + detail diagrams)
 *   3. SPECIFY  Vertex AI describes each diagram (zones, lanes, layers, steps, arrows, 1-2 focal elements)
 *               following the chosen type's layout conventions and anti-patterns
 *   4. DRAW     this file lays the spec out as editable Slides shapes in the 66degrees style:
 *               4pt grid, hairline borders, orthogonal arrows, shape carries meaning, accent on 1-2 elements only
 */

var DD_TYPES_ = ['flowchart', 'process', 'data-flow', 'state', 'dependency', 'timeline', 'swimlane',
  'architecture', 'high-level', 'nested', 'layers', 'tree', 'org-chart', 'loop'];
var DD_NODE_KINDS_ = ['start', 'end', 'step', 'decision', 'data', 'store', 'actor', 'service', 'agent', 'external', 'hub'];
var DD_MAX_IMAGES_ = 3;          // pictures read per run (each takes two Vertex AI calls)
var DD_MAX_NODES_ = 12;          // per slide: diagram-design's budget is 9; a 16:9 slide holds a few more short labels

/* =========================
   1. READ - uploads into parts Vertex AI can see
========================= */

function ddExt_(name) {
  const m = String(name || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

/** Pictures and text inside a .pptx (a zip), per slide, without Drive conversion. */
function extractPptxParts_(upload) {
  const bytes = Utilities.base64Decode(String(upload.data || ''));
  const files = Utilities.unzip(Utilities.newBlob(bytes, 'application/zip', 'deck.zip'));
  const byName = {};
  files.forEach(function (b) { byName[String(b.getName()).replace(/^\/+/, '')] = b; });
  const slideNames = Object.keys(byName).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); })
    .sort(function (a, b) { return Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]); });
  const mimeOf = function (n) {
    const e = ddExt_(n);
    return e === 'png' ? 'image/png' : (e === 'jpg' || e === 'jpeg') ? 'image/jpeg' : e === 'gif' ? 'image/gif' : e === 'webp' ? 'image/webp' : '';
  };
  return slideNames.map(function (sn) {
    const no = Number(sn.match(/(\d+)\.xml$/)[1]);
    const xml = byName[sn].getDataAsString();
    const text = (xml.match(/<a:t>([^<]*)<\/a:t>/g) || []).map(function (t) {
      return t.replace(/<\/?a:t>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    }).join(' ').replace(/\s+/g, ' ').trim();
    const rels = byName['ppt/slides/_rels/slide' + no + '.xml.rels'];
    const images = [];
    if (rels) {
      (rels.getDataAsString().match(/Target="[^"]+"/g) || []).forEach(function (t) {
        const target = t.slice(8, -1);
        if (!/media\//.test(target)) return;
        const path = 'ppt/' + target.replace(/^(\.\.\/)+/, '');
        const blob = byName[path];
        const mime = mimeOf(path);
        if (!blob || !mime) return;                                  // EMF / WMF / video are skipped
        const raw = blob.getBytes();
        images.push({ mime: mime, data: Utilities.base64Encode(raw), size: raw.length, name: path.split('/').pop() });
      });
    }
    // logos and icons are small next to the main picture: keep the pictures that carry the slide (largest first, max two)
    images.sort(function (a, b) { return b.size - a.size; });
    const keep = images.filter(function (im, i) { return i === 0 || (im.size > 40000 && im.size > images[0].size * 0.3); }).slice(0, 2);
    return { slide: no, text: text, images: keep };
  });
}

/** One upload -> list of things to read: {label, image?, pdf?, text?}. Structured diagram files are parsed directly. */
function diagramUploadParts_(upload) {
  const name = String(upload && upload.name || 'file');
  const ext = ddExt_(name);
  const mime = String(upload && upload.mimeType || '').toLowerCase();
  if (/^(ppt|pptx)$/.test(ext) || /presentationml/.test(mime)) {
    if (ext === 'ppt') return { kind: 'unsupported', name: name, items: [], reason: 'Old .ppt files cannot be opened: save it as .pptx or PDF.' };
    const slides = extractPptxParts_(upload);
    const items = [];
    slides.forEach(function (s) {
      if (s.images.length) s.images.forEach(function (im) { items.push({ label: name + ' slide ' + s.slide, image: im, text: s.text }); });
      else if (s.text) items.push({ label: name + ' slide ' + s.slide, text: s.text });
    });
    return { kind: 'pptx', name: name, items: items, slides: slides };
  }
  if (ext === 'pdf' || mime === 'application/pdf') return { kind: 'pdf', name: name, items: [{ label: name, pdf: String(upload.data) }] };
  if (/^(png|jpe?g|webp|gif)$/.test(ext) || /^image\/(png|jpe?g|webp|gif)/.test(mime)) {
    return { kind: 'image', name: name, items: [{ label: name, image: { mime: mime || ('image/' + (ext === 'jpg' ? 'jpeg' : ext)), data: String(upload.data) } }] };
  }
  const cat = typeof detectUploadCategory_ === 'function' ? detectUploadCategory_(upload) : 'other';
  if (cat === 'structured-diagram') return { kind: 'structured', name: name, items: [] };
  if (cat === 'document') return { kind: 'text', name: name, items: [{ label: name, text: peekUploadText_(upload).slice(0, 20000) }] };
  return { kind: 'unsupported', name: name, items: [], reason: name + ' is not a picture, PDF, PowerPoint or diagram file.' };
}

/* =========================
   2 + 3. SELECT and SPECIFY with Vertex AI, following diagram-design
========================= */

function ddKitText_(keys) {
  const K = DIAGRAM_DESIGN_KIT;
  return keys.map(function (k) { return K[k] || ''; }).join('\n\n');
}

function ddInputParts_(item) {
  const parts = [];
  if (item.image) parts.push({ inline_data: { mime_type: item.image.mime || 'image/png', data: item.image.data } });
  if (item.pdf) parts.push({ inline_data: { mime_type: 'application/pdf', data: item.pdf } });
  return parts;
}

/** Step 2: which diagram-design type, and how many slides (overview + detail) the content needs. */
function ddSelect_(item, opts, ctx) {
  const K = DIAGRAM_DESIGN_KIT;
  const forced = opts.wantedType && DD_TYPES_.indexOf(opts.wantedType) !== -1 ? opts.wantedType : '';
  const prompt = [
    'You are the diagram-design skill (rules below, from ' + K.source + ').',
    'Decide how the input should be drawn as diagram slide(s) for a ' + ((ctx.brand && ctx.brand.name) || '66degrees') + ' presentation (16:9 slide, editable shapes).',
    '', 'PHILOSOPHY:', K.philosophy, '', 'TYPE SELECTION:', K.selection, '', 'COMPLEXITY BUDGET:', K.budget, '',
    'TYPES THIS ADD-ON CAN DRAW (use one of these keys): ' + DD_TYPES_.join(', ') + '.',
    forced ? 'The user asked for type "' + forced + '": use it.' : '',
    item.image || item.pdf ? 'INPUT: the attached ' + (item.pdf ? 'PDF' : 'picture') + (item.label ? ' (' + item.label + ')' : '') + '.' : '',
    item.text ? 'TEXT FROM THE SOURCE: "' + String(item.text).slice(0, 4000) + '"' : '',
    opts.prompt ? 'USER REQUEST: "' + String(opts.prompt).slice(0, 3000) + '"' : '',
    '',
    'Answer:',
    '- "is_diagram": true when the input shows (or describes) a process, flow, system, hierarchy, cycle, layers or zones that a diagram can redraw.',
    '  false for photos, logos, charts of numbers, or plain documents with no structure.',
    '- "shows": one sentence on what the diagram is about.',
    '- "type": the best key from the list (dominant axis; follow the selection table).',
    '- "elements": how many distinct boxes / steps the full content has.',
    '- "slides": the diagrams to draw. One item when it fits the budget (max ' + DD_MAX_NODES_ + ' boxes per slide).',
    '  When it is over budget, split into an overview + 1-2 detail diagrams (max 3), each with its own type and a short focus.',
    'Return ONLY JSON: {"is_diagram":true,"shows":"","type":"","elements":0,"slides":[{"title":"","type":"","focus":""}]}'
  ].filter(function (l) { return l !== ''; }).join('\n');
  const raw = callGeminiJSON([{ text: prompt }].concat(ddInputParts_(item)), ctx.apiKey, 0.1) || {};
  const slides = (Array.isArray(raw.slides) ? raw.slides : []).slice(0, 3).map(function (s) {
    const t = forced || (DD_TYPES_.indexOf(String(s && s.type)) !== -1 ? String(s.type) : (DD_TYPES_.indexOf(String(raw.type)) !== -1 ? String(raw.type) : 'flowchart'));
    return { title: String(s && s.title || ''), type: t, focus: String(s && s.focus || '') };
  });
  if (!slides.length) slides.push({ title: '', type: forced || (DD_TYPES_.indexOf(String(raw.type)) !== -1 ? String(raw.type) : 'flowchart'), focus: '' });
  return { isDiagram: raw.is_diagram !== false, shows: String(raw.shows || ''), type: slides[0].type, elements: Number(raw.elements) || 0, slides: slides };
}

/** Step 3: the diagrams themselves, following each chosen type's conventions. */
function ddSpecify_(item, sel, opts, ctx) {
  const K = DIAGRAM_DESIGN_KIT;
  const types = sel.slides.map(function (s) { return s.type; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
  const rules = types.map(function (t) { return 'TYPE "' + t + '" (' + (K.typeNames[t] || t) + '):\n' + (K.types[t] || ''); }).join('\n\n');
  const prompt = [
    'You are the diagram-design skill (' + K.source + '). Describe the diagram(s) below so they can be drawn as editable shapes on 16:9 slides.',
    '', 'PHILOSOPHY:', K.philosophy, '', 'COMPLEXITY BUDGET:', K.budget, '', rules, '',
    item.image || item.pdf ? 'INPUT: the attached ' + (item.pdf ? 'PDF' : 'picture') + '. Read every label in it.' : '',
    item.text ? 'TEXT FROM THE SOURCE: "' + String(item.text).slice(0, 4000) + '"' : '',
    opts.prompt ? 'USER REQUEST: "' + String(opts.prompt).slice(0, 3000) + '"' : '',
    'WHAT IT SHOWS: ' + sel.shows,
    'DIAGRAMS TO DRAW (in this order): ' + JSON.stringify(sel.slides),
    '',
    'RULES:',
    '- Use the words in the input. Never invent components, steps or arrows the input does not show or imply.',
    '- Max ' + DD_MAX_NODES_ + ' nodes per diagram; merge boxes that always travel together; drop decoration.',
    '- "label": 1-4 words, sentence case (first word capitalised, the rest lower case except names and acronyms), no full stop.',
    '- "sub": optional detail line, max 36 characters, or "".',
    '- "kind": start | end | step | decision | data | store | actor | service | agent | external | hub.',
    '  Shape carries type: start/end ovals, decision diamonds (a question label, max 3 exits, every exit labelled), store = database.',
    '- "focal": true on 1-2 nodes at most (the primary integration point, key decision or happy-path end). Never more.',
    '- "groups": the zones / lanes / layers the type uses, in reading order.',
    '  architecture / high-level / nested: up to 4 zones, optionally one group with kind "hub" (the centre of a hub-and-spoke picture).',
    '  swimlane, process, data-flow with actors: kind "lane", max 5. layers: kind "layer", top to bottom, max 6.',
    '  loop: 5-8 stations clockwise from the top plus exactly one node with kind "hub" in the centre.',
    '  Every node in a zone / lane / layer names it in "group".',
    '- "edges": arrows in the direction of flow. "style": "solid", or "dashed" for optional / return / write-back flows. "label": short or "".',
    '- "direction": "LR" (default for slides) or "TB" for trees and org charts.',
    '- "title": the slide title, the key message in sentence case, max 58 characters. "lead": one sentence, max 110 characters, or "".',
    'Return ONLY JSON: {"diagrams":[{"title":"","lead":"","type":"","direction":"LR","groups":[{"id":"g1","label":"","kind":"zone"}],' +
      '"nodes":[{"id":"n1","label":"","sub":"","kind":"step","group":"g1","focal":false}],"edges":[{"from":"n1","to":"n2","label":"","style":"solid"}]}]}'
  ].filter(function (l) { return l !== ''; }).join('\n');
  const raw = callGeminiJSON([{ text: prompt }].concat(ddInputParts_(item)), ctx.apiKey, 0.15) || {};
  const list = Array.isArray(raw.diagrams) ? raw.diagrams : (raw.nodes ? [raw] : []);
  const forced = opts.wantedType && DD_TYPES_.indexOf(opts.wantedType) !== -1 ? opts.wantedType : '';
  return list.slice(0, 3).map(function (d, i) {
    if (forced && d) d.type = forced;                            // the type the user picked always wins
    return ddSpecToIr_(d, (sel.slides[i] || sel.slides[0]).type, item.label);
  })
    .filter(function (ir) { return ir && validateDiagramIr_(ir).ok; });
}

/** Spec from Vertex AI -> the add-on's diagram IR (kept compatible with Diagram.gs). */
function ddSpecToIr_(d, fallbackType, sourceLabel) {
  if (!d || !Array.isArray(d.nodes) || !d.nodes.length) return null;
  const type = DD_TYPES_.indexOf(String(d.type)) !== -1 ? String(d.type) : (fallbackType || 'flowchart');
  const sc = function (s) { return typeof sentenceCase_ === 'function' ? sentenceCase_(String(s || ''), 1) : String(s || ''); };
  const groups = (Array.isArray(d.groups) ? d.groups : []).slice(0, 6).map(function (g, i) {
    return { id: String(g && g.id || ('g' + (i + 1))), label: sc(String(g && g.label || '').replace(/\.$/, '')).slice(0, 40), kind: String(g && g.kind || 'zone').toLowerCase() };
  });
  const gids = {};
  groups.forEach(function (g) { gids[g.id] = true; });
  let focal = 0;
  const nodes = d.nodes.slice(0, 16).map(function (n, i) {
    let kind = String(n && n.kind || n && n.type || 'step').toLowerCase();
    if (DD_NODE_KINDS_.indexOf(kind) === -1) kind = /term/.test(kind) ? 'start' : 'step';
    const isFocal = !!(n && n.focal) && focal < 2;
    if (isFocal) focal++;
    return {
      id: String(n && n.id || ('n' + (i + 1))),
      label: sc(String(n && n.label || '').replace(/\.$/, '')).slice(0, 48),
      sub: String(n && n.sub || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      type: kind === 'start' || kind === 'end' ? 'terminator' : kind === 'step' || kind === 'service' || kind === 'agent' || kind === 'actor' || kind === 'external' ? 'process' : kind,
      kind: kind,
      group: n && gids[n.group] ? String(n.group) : '',
      emphasize: isFocal
    };
  });
  const raw = {
    type: type, direction: String(d.direction || (type === 'tree' || type === 'org-chart' ? 'TB' : 'LR')).toUpperCase() === 'TB' ? 'TB' : 'LR',
    nodes: nodes,
    edges: (Array.isArray(d.edges) ? d.edges : []).slice(0, 20).map(function (e) {
      return { from: String(e && e.from), to: String(e && e.to), label: String(e && e.label || '').slice(0, 24), dashed: /dash/i.test(String(e && e.style || '')) };
    }),
    groups: groups, source: 'diagram-design', confidence: 1
  };
  const ir = normalizeDiagramIr_(raw);
  ir.title = String(d.title || '').slice(0, 80);
  ir.lead = String(d.lead || '').slice(0, 140);
  ir.sourceLabel = sourceLabel || '';
  return ir;
}

/**
 * Full read of one upload or description: returns {diagrams:[ir], notDiagram:[{label, image}], log:[]}.
 * Pictures that are not diagrams come back in notDiagram (Create keeps them as images).
 */
function diagramDesignRead_(input, opts, ctx) {
  opts = opts || {};
  const res = { diagrams: [], notDiagram: [], log: [] };
  const started = Date.now();
  const items = (input.items || []).slice();
  if (!items.length && opts.prompt) items.push({ label: 'description', text: '' });
  let pictures = 0;
  items.forEach(function (item) {
    if (typeof checkCancel_ === 'function') checkCancel_(ctx);
    if ((item.image || item.pdf) && ++pictures > DD_MAX_IMAGES_) { res.log.push('Skipped ' + item.label + ': only ' + DD_MAX_IMAGES_ + ' pictures are read per run.'); return; }
    if (Date.now() - started > (opts.budgetMs || 200000)) { res.log.push('Skipped ' + item.label + ': time limit.'); return; }
    try {
      const sel = ddSelect_(item, opts, ctx);
      if (!sel.isDiagram) {
        res.log.push(item.label + ' is not a diagram' + (sel.shows ? ' (' + sel.shows + ')' : '') + '.');
        res.notDiagram.push(item);
        return;
      }
      const irs = ddSpecify_(item, sel, opts, ctx);
      if (!irs.length) { res.log.push('No diagram could be built from ' + item.label + '.'); res.notDiagram.push(item); return; }
      irs.forEach(function (ir) { res.diagrams.push(ir); });
      res.log.push(item.label + ': ' + irs.map(function (ir) { return ir.type + ' (' + ir.nodes.length + ' boxes)'; }).join(', ') + ' - diagram-design.');
    } catch (e) {
      if (e && e.cancelled) throw e;
      res.log.push('Diagram read failed for ' + item.label + ': ' + (e && e.message ? e.message : String(e)));
      res.notDiagram.push(item);
    }
  });
  return res;
}

/* =========================
   4. DRAW - diagram-design layout rules as editable Slides shapes (720 x 405 canvas)
========================= */

var DD_COLORS_ = { ink: '#040A1B', paper: '#FFFDF9', panel: '#F3F2F0', rule: '#B3C5D0', accent: '#0052FF', line: '#DBDDE1' };

function dd4_(v) { return Math.round(v / 4) * 4; }

function ddTextSize_(label, w) {
  const n = String(label || '').length;
  const perLine = Math.max(6, (w - 14) / 5.6);
  return n > perLine * 2 ? 8 : n > perLine ? 9 : w < 90 ? 9 : 10;
}

function ddKind_(n) { return n.kind || (n.type === 'terminator' ? 'start' : n.type); }

/** One node as a shape with its label (and detail line) inside. */
function ddNodeEl_(n, b, onPanel) {
  const focal = !!n.emphasize;
  const fill = focal ? DD_COLORS_.accent : (n.kind === 'hub' ? DD_COLORS_.ink : (onPanel ? DD_COLORS_.paper : DD_COLORS_.panel));
  const color = focal || n.kind === 'hub' ? DD_COLORS_.paper : DD_COLORS_.ink;
  const text = n.label + (n.sub ? '\n' + n.sub : '');
  const size = ddTextSize_(n.label, ddKind_(n) === 'decision' ? b.w * 0.6 : b.w);
  const ts = { size: size, color: color, align: 'center', valign: 'middle', subSize: n.sub ? Math.max(7, size - 2) : 0 };
  const line = { color: focal ? DD_COLORS_.accent : (n.kind === 'hub' ? DD_COLORS_.ink : DD_COLORS_.rule), width: 0.75 };
  const shapeOf = { start: 'FLOW_CHART_TERMINATOR', end: 'FLOW_CHART_TERMINATOR', decision: 'FLOW_CHART_DECISION', data: 'FLOW_CHART_DATA', store: 'FLOW_CHART_MAGNETIC_DISK' };
  const k = n.kind || (n.type === 'terminator' ? 'start' : n.type);
  if (shapeOf[k]) return { t: 'shape', shape: shapeOf[k], x: b.x, y: b.y, w: b.w, h: b.h, fill: fill, line: line, text: text, textStyle: ts, nodeId: n.id };
  return { t: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, fill: fill, line: line, text: text, textStyle: ts, nodeId: n.id };
}

function ddZoneEls_(z, label, kind) {
  const els = [{ t: 'rect', x: z.x, y: z.y, w: z.w, h: z.h, fill: kind === 'hub' ? '#EAF0FF' : DD_COLORS_.panel, line: kind === 'hub' ? { color: DD_COLORS_.accent, width: 0.75 } : null, zone: true }];
  if (label) els.push({ t: 'text', text: label, x: z.x + 4 - 7.2, y: z.y + 4 - 7.2, w: z.w - 8 + 14.4, h: 14 + 14.4, size: 8, weight: 500, font: 'sans',
    color: kind === 'hub' ? DD_COLORS_.accent : DD_COLORS_.ink, align: 'left', valign: 'top', spacing: 1 });
  return els;
}

/**
 * Orthogonal connectors (diagram-design: no diagonals, perpendicular exits, fanned ports, labels clear of the stroke).
 * boxes: id -> {x,y,w,h}. Returns line + label elements.
 */
function ddEdgeEls_(edges, boxes, opts) {
  opts = opts || {};
  const els = [];
  const ports = {};   // node|side -> count, to fan multiple arrows on one side
  const plan = [];
  edges.forEach(function (e) {
    const a = boxes[e.from], b = boxes[e.to];
    if (!a || !b || e.from === e.to) return;
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    const dx = bcx - acx, dy = bcy - acy;
    let sa, sb;
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (opts.vertical || (overlapX > 8 && Math.abs(dy) > 4)) { sa = dy > 0 ? 'bottom' : 'top'; sb = dy > 0 ? 'top' : 'bottom'; }
    else if (overlapY > 8 || Math.abs(dx) >= Math.abs(dy)) { sa = dx > 0 ? 'right' : 'left'; sb = dx > 0 ? 'left' : 'right'; }
    else { sa = dx > 0 ? 'right' : 'left'; sb = dy > 0 ? 'top' : 'bottom'; }     // L-path into the top / bottom edge
    const ka = e.from + '|' + sa, kb = e.to + '|' + sb;
    ports[ka] = (ports[ka] || 0) + 1;
    ports[kb] = (ports[kb] || 0) + 1;
    plan.push({ e: e, a: a, b: b, sa: sa, sb: sb, ka: ka, kb: kb, ia: ports[ka] - 1, ib: ports[kb] - 1 });
  });
  // ports on one side are ordered by where the other end sits, so arrows never cross on the way in or out
  const groupsBy = {};
  plan.forEach(function (p) { (groupsBy[p.ka] = groupsBy[p.ka] || []).push({ p: p, end: 'a' }); (groupsBy[p.kb] = groupsBy[p.kb] || []).push({ p: p, end: 'b' }); });
  Object.keys(groupsBy).forEach(function (k) {
    const side = k.split('|').pop(), horiz = side === 'left' || side === 'right';
    groupsBy[k].sort(function (u, v) {
      const ou = u.end === 'a' ? u.p.b : u.p.a, ov = v.end === 'a' ? v.p.b : v.p.a;
      return horiz ? (ou.y + ou.h / 2) - (ov.y + ov.h / 2) : (ou.x + ou.w / 2) - (ov.x + ov.w / 2);
    }).forEach(function (g, i) { if (g.end === 'a') g.p.ia = i; else g.p.ib = i; });
  });
  const portPoint = function (box, side, i, n, isSource) {
    // trees: every child hangs off one stem under the parent (shared bus); elsewhere ports fan out
    const t = n <= 1 || (opts.vertical && isSource) ? 0.5 : 0.25 + 0.5 * i / (n - 1);
    if (side === 'right') return { x: box.x + box.w, y: box.y + box.h * t };
    if (side === 'left') return { x: box.x, y: box.y + box.h * t };
    if (side === 'top') return { x: box.x + box.w * t, y: box.y };
    return { x: box.x + box.w * t, y: box.y + box.h };
  };
  const seg = function (x1, y1, x2, y2, st, arrow) {
    if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;
    els.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, color: st.color, width: st.width, arrow: !!arrow, dash: !!st.dash });
  };
  const placed = [], labelJobs = [];
  const hits = function (r) {
    const boxHit = Object.keys(boxes).some(function (k) { const q = boxes[k]; return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; });
    const obstacle = (opts.obstacles || []).some(function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; });
    return boxHit || obstacle || placed.some(function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; });
  };
  plan.forEach(function (p) {
    const st = { color: p.e.emphasize ? DD_COLORS_.accent : DD_COLORS_.ink, width: p.e.dashed ? 0.75 : 1, dash: !!p.e.dashed };
    const A = portPoint(p.a, p.sa, p.ia, ports[p.ka], true), B = portPoint(p.b, p.sb, p.ib, ports[p.kb], false);
    const horizA = p.sa === 'left' || p.sa === 'right', horizB = p.sb === 'left' || p.sb === 'right';
    const segs = [];
    const add = function (x1, y1, x2, y2, arrow) { seg(x1, y1, x2, y2, st, arrow); segs.push({ x1: x1, y1: y1, x2: x2, y2: y2 }); };
    if (horizA && horizB) {
      if (Math.abs(A.y - B.y) < 1) add(A.x, A.y, B.x, A.y, true);
      else {
        // several arrows into one side each get their own vertical run (no shared, overlapping strokes)
        const nIn = ports[p.kb], off = nIn > 1 ? (p.ib - (nIn - 1) / 2) * 8 * (B.y < A.y ? 1 : -1) * (B.x > A.x ? 1 : -1) : 0;
        const xm = dd4_((A.x + B.x) / 2) + off;
        add(A.x, A.y, xm, A.y); add(xm, A.y, xm, B.y); add(xm, B.y, B.x, B.y, true);
      }
    } else if (!horizA && !horizB) {
      if (Math.abs(A.x - B.x) < 1) add(A.x, A.y, A.x, B.y, true);
      else { const ym = dd4_((A.y + B.y) / 2); add(A.x, A.y, A.x, ym); add(A.x, ym, B.x, ym); add(B.x, ym, B.x, B.y, true); }
    } else {
      add(A.x, A.y, B.x, A.y); add(B.x, A.y, B.x, B.y, true);     // L-path: out of the side, turn once, into the top / bottom
    }
    if (p.e.label) labelJobs.push({ e: p.e, segs: segs, A: A, B: B });
  });
  const allSegs = [];
  els.forEach(function (l) { if (l.t === 'line') allSegs.push(l); });
  const crossesLine = function (r) {
    return allSegs.some(function (l) {
      const x0 = Math.min(l.x1, l.x2), x1 = Math.max(l.x1, l.x2), y0 = Math.min(l.y1, l.y2), y1 = Math.max(l.y1, l.y2);
      return x0 < r.x + r.w && r.x < x1 + 0.01 && y0 < r.y + r.h && r.y < y1 + 0.01;
    });
  };
  labelJobs.forEach(function (job) {
    const p = { e: job.e }, segs = job.segs, A = job.A, B = job.B;
    // label: on the longest free run, beside the stroke (never on it), clear of boxes and other labels
    const w = Math.max(24, p.e.label.length * 5.2 + 6), h = 12;
    const cands = [];
    segs.slice().sort(function (u, v) { return (Math.abs(v.x2 - v.x1) + Math.abs(v.y2 - v.y1)) - (Math.abs(u.x2 - u.x1) + Math.abs(u.y2 - u.y1)); }).forEach(function (g) {
      const len = Math.abs(g.x2 - g.x1) + Math.abs(g.y2 - g.y1), mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2;
      if (g.y1 === g.y2 && len >= w + 8) { cands.push({ x: mx - w / 2, y: my - h - 3, align: 'center' }); cands.push({ x: mx - w / 2, y: my + 3, align: 'center' }); }
      if (g.y1 === g.y2) {
        // longer than the run: anchored at its start or end, above the stroke (may extend over a zone panel, never a box)
        const lo = Math.min(g.x1, g.x2), hi = Math.max(g.x1, g.x2);
        cands.push({ x: lo + 2, y: my - h - 3, align: 'left', late: true }); cands.push({ x: hi - 2 - w, y: my - h - 3, align: 'right', late: true });
      }
      if (g.x1 === g.x2 && len >= h + 8) { cands.push({ x: mx + 4, y: my - h / 2, align: 'left' }); cands.push({ x: mx - 4 - w, y: my - h / 2, align: 'right' }); }
    });
    if (!cands.length) cands.push({ x: (A.x + B.x) / 2 - w / 2, y: Math.min(A.y, B.y) - h - 3, align: 'center' });
    const ordered = cands.filter(function (c) { return !c.late; }).concat(cands.filter(function (c) { return c.late; }));
    const pick = ordered.filter(function (c) { const r = { x: c.x, y: c.y, w: w, h: h }; return !hits(r) && !crossesLine(r); })[0] ||
      ordered.filter(function (c) { return !hits({ x: c.x, y: c.y, w: w, h: h }); })[0] || ordered[0];
    placed.push({ x: pick.x, y: pick.y, w: w, h: h });
    els.push({ t: 'text', text: p.e.label, x: pick.x - 7.2, y: pick.y - 1 - 7.2, w: w + 14.4, h: h + 2 + 14.4, size: 8, weight: 500, font: 'sans',
      color: DD_COLORS_.accent, align: pick.align, valign: 'middle', spacing: 1, edgeLabel: true });
  });
  return els;
}

function ddFit_(boxes, area) {
  // centre everything in the area (alignment), never enlarge
  const ids = Object.keys(boxes);
  if (!ids.length) return boxes;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ids.forEach(function (k) { const b = boxes[k]; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
  const dx = dd4_(area.x + (area.w - (x1 - x0)) / 2 - x0), dy = dd4_(area.y + (area.h - (y1 - y0)) / 2 - y0);
  ids.forEach(function (k) { boxes[k].x += dx; boxes[k].y += dy; });
  return boxes;
}

/* ----- zones: architecture, high-level, nested (hub-and-spoke when one group is the hub) ----- */
function ddZonesLayout_(ir, area) {
  const groups = ir.groups.length ? ir.groups.slice() : [{ id: '', label: '', kind: 'zone' }];
  const members = {};
  groups.forEach(function (g) { members[g.id] = []; });
  const loose = [];
  ir.nodes.forEach(function (n) { if (members[n.group]) members[n.group].push(n); else loose.push(n); });
  if (loose.length) { groups.push({ id: '__loose', label: '', kind: 'zone', loose: true }); members.__loose = loose; }
  const used = groups.filter(function (g) { return members[g.id].length; });
  let hub = used.filter(function (g) { return g.kind === 'hub'; })[0] || null;
  // column order: zones that send into others first (data flows left -> right)
  const zoneOf = {};
  used.forEach(function (g) { members[g.id].forEach(function (n) { zoneOf[n.id] = g.id; }); });
  const score = {};
  used.forEach(function (g) { score[g.id] = 0; });
  ir.edges.forEach(function (e) { const a = zoneOf[e.from], b = zoneOf[e.to]; if (a && b && a !== b) { score[a] -= 1; score[b] += 1; } });
  let cols;
  if (hub) {
    const others = used.filter(function (g) { return g !== hub; }).sort(function (a, b) { return score[a.id] - score[b.id]; });
    const left = [], right = [];
    others.forEach(function (g, i) { (score[g.id] <= 0 && left.length <= right.length) || (right.length > left.length) ? left.push(g) : right.push(g); });
    cols = [left, [hub], right].filter(function (c) { return c.length; });
  } else {
    cols = used.slice().sort(function (a, b) { return score[a.id] - score[b.id]; }).map(function (g) { return [g]; });
    if (cols.length > 4) { const merged = []; cols.forEach(function (c, i) { (merged[i % 4] = merged[i % 4] || []).push(c[0]); }); cols = merged; }
  }
  const labelled = function (cross) {
    return ir.edges.some(function (e) { return e.label && ((zoneOf[e.from] !== zoneOf[e.to]) === cross); });
  };
  const gap = labelled(true) ? 52 : 28, labelH = 20, pad = 12, nodeGap = labelled(false) ? 24 : 12;
  const weight = cols.map(function (c) { return c.some(function (g) { return g === hub; }) ? 1.5 : 1; });
  const wsum = weight.reduce(function (a, b) { return a + b; }, 0);
  const free = area.w - gap * (cols.length - 1);
  const boxes = {}, zones = [];
  let x = area.x;
  cols.forEach(function (col, ci) {
    const cw = dd4_(free * weight[ci] / wsum);
    const zh = (area.h - gap * (col.length - 1)) / col.length;
    col.forEach(function (g, gi) {
      const ns = members[g.id];
      const z = { x: x, y: dd4_(area.y + gi * (zh + gap)), w: cw, h: dd4_(zh) };
      const inner = { x: z.x + pad, y: z.y + labelH + 4, w: z.w - pad * 2, h: z.h - labelH - 4 - pad };
      const perRow = g === hub && ns.length > 3 ? Math.min(3, Math.ceil(ns.length / 2)) : (inner.w > 260 && ns.length > 3 ? 2 : 1);
      const rows = Math.ceil(ns.length / perRow);
      const nh = Math.max(28, Math.min(48, dd4_((inner.h - nodeGap * (rows - 1)) / rows)));
      const nw = dd4_(Math.min(200, (inner.w - nodeGap * (perRow - 1)) / perRow));
      const blockH = rows * nh + (rows - 1) * nodeGap;
      const y0 = inner.y + Math.max(0, (inner.h - blockH) / 2);
      ns.forEach(function (n, i) {
        const r = Math.floor(i / perRow), c = i % perRow;
        const inRow = Math.min(perRow, ns.length - r * perRow);
        const rowW = inRow * nw + (inRow - 1) * nodeGap;
        boxes[n.id] = { x: dd4_(inner.x + (inner.w - rowW) / 2 + c * (nw + nodeGap)), y: dd4_(y0 + r * (nh + nodeGap)), w: nw, h: nh };
      });
      // shrink the zone around its content (no half-empty boxes)
      const top = Math.min.apply(null, ns.map(function (n) { return boxes[n.id].y; }));
      const bottom = Math.max.apply(null, ns.map(function (n) { return boxes[n.id].y + boxes[n.id].h; }));
      const zz = { x: z.x, y: Math.max(z.y, top - labelH - 8), w: z.w, h: 0 };
      zz.h = Math.min(z.y + z.h, bottom + pad) - zz.y;
      if (!g.loose) zones.push({ box: zz, label: g.label, kind: g.kind });
    });
    x += cw + gap;
  });
  return { boxes: boxes, zones: zones, obstacles: zones.filter(function (z) { return z.label; }).map(function (z) { return { x: z.box.x, y: z.box.y, w: Math.min(z.box.w, z.label.length * 4.6 + 12), h: 18 }; }) };
}

/* ----- swimlane (and process / data-flow with lanes) ----- */
function ddSwimlaneLayout_(ir, area) {
  const lanes = ir.groups.slice(0, 5);
  const laneIds = lanes.map(function (g) { return g.id; });
  const lay = flowchartLayers_(ir);
  const col = {};
  lay.layers.forEach(function (layer, li) { layer.forEach(function (id) { col[id] = li; }); });
  // two steps in the same lane and column: push the later one right
  const taken = {};
  ir.nodes.forEach(function (n) {
    const lane = Math.max(0, laneIds.indexOf(n.group));
    let c = col[n.id] || 0;
    while (taken[lane + ':' + c]) c++;
    taken[lane + ':' + c] = true;
    col[n.id] = c;
    n._lane = lane;
  });
  const nCols = Math.max.apply(null, ir.nodes.map(function (n) { return col[n.id]; })) + 1;
  const labelW = 88, gapX = 20;
  const laneH = dd4_(Math.min(84, area.h / Math.max(1, lanes.length)));
  const top = dd4_(area.y + (area.h - laneH * lanes.length) / 2);
  const colW = (area.w - labelW - gapX * (nCols - 1)) / nCols;
  const nw = dd4_(Math.min(140, colW)), nh = dd4_(Math.min(44, laneH - 20));
  const boxes = {};
  ir.nodes.forEach(function (n) {
    const cx = area.x + labelW + col[n.id] * (colW + gapX) + colW / 2;
    const cy = top + n._lane * laneH + laneH / 2;
    const dh = n.kind === 'decision' ? dd4_(Math.min(laneH - 8, nh * 1.45)) : nh;
    boxes[n.id] = { x: dd4_(cx - nw / 2), y: dd4_(cy - dh / 2), w: nw, h: dh };
    delete n._lane;
  });
  const els = [];
  lanes.forEach(function (g, i) {
    const y = top + i * laneH;
    els.push({ t: 'rect', x: area.x, y: y, w: area.w, h: laneH, fill: i % 2 ? DD_COLORS_.paper : DD_COLORS_.panel, line: null, zone: true });
    els.push({ t: 'text', text: g.label, x: area.x + 4 - 7.2, y: y - 7.2, w: labelW - 12 + 14.4, h: laneH + 14.4, size: 8, weight: 500, font: 'sans',
      color: DD_COLORS_.ink, align: 'left', valign: 'middle', spacing: 1 });
  });
  return { boxes: boxes, under: els };
}

/* ----- layer stack ----- */
function ddLayersLayout_(ir, area) {
  let layers = ir.groups.filter(function (g) { return ir.nodes.some(function (n) { return n.group === g.id; }); });
  const byLayer = {};
  if (!layers.length) { layers = ir.nodes.map(function (n) { return { id: n.id, label: '', kind: 'layer', single: n }; }); }
  layers = layers.slice(0, 6);
  layers.forEach(function (g) { byLayer[g.id] = g.single ? [g.single] : ir.nodes.filter(function (n) { return n.group === g.id; }); });
  const gap = 8, labelW = layers.some(function (g) { return g.label; }) ? 120 : 0;
  const lh = dd4_(Math.min(64, (area.h - gap * (layers.length - 1)) / layers.length));
  const top = dd4_(area.y + (area.h - (lh * layers.length + gap * (layers.length - 1))) / 2);
  const boxes = {}, under = [];
  layers.forEach(function (g, i) {
    const y = top + i * (lh + gap);
    const ns = byLayer[g.id];
    if (labelW) {
      under.push({ t: 'rect', x: area.x, y: y, w: area.w, h: lh, fill: DD_COLORS_.panel, line: null, zone: true });
      under.push({ t: 'text', text: g.label, x: area.x + 8 - 7.2, y: y - 7.2, w: labelW - 12 + 14.4, h: lh + 14.4, size: 9, weight: 500, font: 'sans',
        color: DD_COLORS_.ink, align: 'left', valign: 'middle', spacing: 1 });
    }
    const innerX = area.x + labelW + 8, innerW = area.w - labelW - 16;
    const nw = dd4_(Math.min(g.single ? innerW : 160, (innerW - 12 * (ns.length - 1)) / ns.length));
    const rowW = ns.length * nw + (ns.length - 1) * 12;
    ns.forEach(function (n, j) { boxes[n.id] = { x: dd4_(innerX + (innerW - rowW) / 2 + j * (nw + 12)), y: y + 8, w: nw, h: lh - 16 }; });
  });
  return { boxes: boxes, under: under, noEdges: true };
}

/* ----- tree / org chart (root on top, children fan out below) ----- */
function ddTreeLayout_(ir, area) {
  const kids = {}, hasParent = {};
  ir.nodes.forEach(function (n) { kids[n.id] = []; });
  ir.edges.forEach(function (e) { if (kids[e.from] && kids[e.to] && !hasParent[e.to] && e.from !== e.to) { kids[e.from].push(e.to); hasParent[e.to] = true; } });
  const roots = ir.nodes.filter(function (n) { return !hasParent[n.id]; }).map(function (n) { return n.id; });
  const leaves = {}, depth = {};
  const count = function (id, d, seen) {
    if (seen[id]) return 0;
    seen[id] = true; depth[id] = d;
    const l = kids[id].reduce(function (s, k) { return s + count(k, d + 1, seen); }, 0);
    leaves[id] = Math.max(1, l);
    return leaves[id];
  };
  const seen = {};
  const total = roots.reduce(function (s, r) { return s + count(r, 0, seen); }, 0);
  const maxD = Math.max.apply(null, Object.keys(depth).map(function (k) { return depth[k]; }).concat([0]));
  const slot = area.w / Math.max(1, total);
  const nw = dd4_(Math.min(140, slot - 12)), rowH = Math.min(96, area.h / (maxD + 1)), nh = dd4_(Math.min(44, rowH - 28));
  const boxes = {};
  const place = function (id, x0) {
    const cx = x0 + leaves[id] * slot / 2;
    boxes[id] = { x: dd4_(cx - nw / 2), y: dd4_(area.y + depth[id] * rowH), w: nw, h: nh };
    let x = x0;
    kids[id].forEach(function (k) { if (depth[k] === depth[id] + 1 && !boxes[k]) { place(k, x); x += leaves[k] * slot; } });
  };
  let x = area.x;
  roots.forEach(function (r) { place(r, x); x += leaves[r] * slot; });
  return { boxes: ddFit_(boxes, area), vertical: true, edges: ir.edges.filter(function (e) { return hasParent[e.to]; }) };
}

/* ----- loop / flywheel (stations clockwise from the top, one hub in the centre) ----- */
function ddLoopLayout_(ir, area) {
  let hub = ir.nodes.filter(function (n) { return n.kind === 'hub'; })[0] || null;
  const stations = ir.nodes.filter(function (n) { return n !== hub; }).slice(0, 8);
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const nw = dd4_(Math.min(132, area.w / 5)), nh = 40;
  const rx = Math.min(area.w / 2 - nw / 2 - 8, 250), ry = area.h / 2 - nh / 2 - 4;
  const boxes = {};
  stations.forEach(function (n, i) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / stations.length;
    boxes[n.id] = { x: dd4_(cx + rx * Math.cos(a) - nw / 2), y: dd4_(cy + ry * Math.sin(a) - nh / 2), w: nw, h: nh };
  });
  if (hub) boxes[hub.id] = { x: dd4_(cx - 76), y: dd4_(cy - 26), w: 152, h: 52 };
  // ring arrows: centre-to-centre chords clipped to the box edges (the one place straight diagonals read as a cycle)
  const els = [];
  const clip = function (b, tx, ty) {
    const bx = b.x + b.w / 2, by = b.y + b.h / 2, dx = tx - bx, dy = ty - by;
    const s = Math.min(Math.abs((b.w / 2) / (dx || 1e-6)), Math.abs((b.h / 2) / (dy || 1e-6)));
    return { x: bx + dx * s, y: by + dy * s };
  };
  stations.forEach(function (n, i) {
    const m = stations[(i + 1) % stations.length];
    const a = boxes[n.id], b = boxes[m.id];
    const p = clip(a, b.x + b.w / 2, b.y + b.h / 2), q = clip(b, a.x + a.w / 2, a.y + a.h / 2);
    els.push({ t: 'line', x1: p.x, y1: p.y, x2: q.x, y2: q.y, color: DD_COLORS_.ink, width: 1, arrow: true });
  });
  if (hub) {
    stations.forEach(function (n) {
      if (!ir.edges.some(function (e) { return (e.from === n.id && e.to === hub.id) || (e.to === n.id && e.from === hub.id); })) return;
      const a = boxes[n.id], h = boxes[hub.id];
      const p = clip(a, h.x + h.w / 2, h.y + h.h / 2), q = clip(h, a.x + a.w / 2, a.y + a.h / 2);
      els.push({ t: 'line', x1: p.x, y1: p.y, x2: q.x, y2: q.y, color: DD_COLORS_.rule, width: 0.75, arrow: true, dash: true });
    });
  }
  return { boxes: boxes, over: els, noEdges: true };
}

/** Diagram IR -> engine elements in the area, by diagram-design type. */
function drawDiagramDesign_(ir, area) {
  const type = String(ir.type || 'flowchart');
  const lanes = ir.groups.filter(function (g) { return g.kind === 'lane'; });
  let L;
  if (type === 'loop') L = ddLoopLayout_(ir, area);
  else if (type === 'layers') L = ddLayersLayout_(ir, area);
  else if (type === 'tree' || type === 'org-chart') L = ddTreeLayout_(ir, area);
  else if (type === 'swimlane' || (lanes.length >= 2 && ir.edges.length)) L = ddSwimlaneLayout_(ir, area);
  else if ((type === 'architecture' || type === 'high-level' || type === 'nested') && ir.groups.length) L = ddZonesLayout_(ir, area);
  else if (ir.edges.length) {
    // flowchart family: the layered, centred layout (Diagram.gs)
    return flowchartToElements_(ir, area);
  } else if (ir.groups.length) L = ddZonesLayout_(ir, area);
  else L = ddLayersLayout_({ nodes: ir.nodes.map(function (n) { return Object.assign({}, n, { group: 'all' }); }), edges: [], groups: [{ id: 'all', label: '', kind: 'layer' }] }, area);
  const els = [];
  (L.under || []).forEach(function (e) { els.push(e); });
  (L.zones || []).forEach(function (z) { ddZoneEls_(z.box, z.label, z.kind).forEach(function (e) { els.push(e); }); });
  if (!L.noEdges) ddEdgeEls_(L.edges || ir.edges, L.boxes, { vertical: L.vertical, obstacles: L.obstacles }).forEach(function (e) { els.push(e); });
  (L.over || []).forEach(function (e) { els.push(e); });
  const inZone = function (id) { const n = ir.nodes.filter(function (x) { return x.id === id; })[0]; return !!(n && n.group) || !!L.under; };
  const nodeEls = ir.nodes.filter(function (n) { return L.boxes[n.id]; }).map(function (n) { return ddNodeEl_(n, L.boxes[n.id], inZone(n.id)); });
  const size = Math.min.apply(null, nodeEls.filter(function (e) { return e.shape !== 'FLOW_CHART_DECISION'; }).map(function (e) { return e.textStyle.size; }).concat([10]));
  nodeEls.forEach(function (e) {
    e.textStyle.size = e.shape === 'FLOW_CHART_DECISION' ? Math.min(e.textStyle.size, size) : size;
    if (e.textStyle.subSize) e.textStyle.subSize = Math.max(7, e.textStyle.size - 2);
    els.push(e);
  });
  // labels last so they sit above lines
  return els.filter(function (e) { return !e.edgeLabel; }).concat(els.filter(function (e) { return e.edgeLabel; }));
}

var DiagramDesign = {
  kit: function () { return DIAGRAM_DESIGN_KIT; },
  types: DD_TYPES_,
  extractPptx: extractPptxParts_,
  uploadParts: diagramUploadParts_,
  read: diagramDesignRead_,
  specToIr: ddSpecToIr_,
  draw: drawDiagramDesign_
};
