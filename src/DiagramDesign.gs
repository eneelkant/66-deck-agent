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
    item.slides ? '- "slides": EXACTLY ' + item.slides + ' diagram' + (item.slides > 1 ? 's' : '') + ' (the user chose this number). ' +
      (item.slides > 1 ? 'The first is the overview; each other one zooms into a DIFFERENT part of it (never redraw the overview or repeat another slide).' : 'Fit the whole picture on one slide: keep the main blocks, merge the rest.')
      : '- "slides": the diagrams to draw. One item when it fits the budget (max ' + DD_MAX_NODES_ + ' boxes per slide). Over budget: an overview + 1 detail diagram (max 2), the detail zooms into one part and never repeats the overview.',
    '  Each item: a short title, its type, and its focus (which part it covers).',
    'Return ONLY JSON: {"is_diagram":true,"shows":"","type":"","elements":0,"slides":[{"title":"","type":"","focus":""}]}'
  ].filter(function (l) { return l !== ''; }).join('\n');
  const raw = callGeminiJSON([{ text: prompt }].concat(ddInputParts_(item)), ctx.apiKey, 0.1) || {};
  const slides = (Array.isArray(raw.slides) ? raw.slides : []).slice(0, item.slides || 2).map(function (s) {
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
    '- Use the words in the input. Copy labels exactly as written (keep symbols such as &, /, Q&A). Never invent components, steps or arrows the input does not show or imply.',
    '- Each diagram covers its own focus. A box appears on another slide only when that slide zooms into it.',
    '- Max ' + DD_MAX_NODES_ + ' nodes per diagram; merge boxes that always travel together; drop decoration.',
    '- "label": 1-4 words, sentence case (first word capitalised, the rest lower case except names and acronyms), no full stop.',
    '- "sub": optional detail line, max 36 characters, or "".',
    '- "kind": start | end | step | decision | data | store | actor | service | agent | external | hub.',
    '  Shape carries type: start/end ovals, decision diamonds (a question label, max 3 exits, every exit labelled), store = database.',
    '- "focal": true on 1-2 nodes at most (the primary integration point, key decision or happy-path end). Never more.',
    '- "groups": the zones / lanes / layers the type uses, in reading order.',
    '  architecture / high-level / nested: up to 4 zones, optionally one group with kind "hub" (the centre of a hub-and-spoke picture).',
    '  swimlane, process, data-flow with actors: kind "lane", max 5, each lane an actor / role / team holding 2+ boxes.',
    '  A lane or zone name never repeats the label of a box inside it. layers: kind "layer", top to bottom, max 6.',
    '  Supporting controls or tools that feed several steps (governance, CI/CD, security...): kind "service", no group; they are drawn in a row under the main flow.',
    '  loop: 5-8 stations clockwise from the top plus exactly one node with kind "hub" in the centre.',
    '  Every node in a zone / lane / layer names it in "group".',
    '- "edges": arrows in the direction of flow. "style": "solid", or "dashed" for optional / return / write-back flows. "label": 1-2 words or "".',
    '  A two-way relationship is ONE edge with "both": true (never two opposite edges). Give a label only when it adds meaning; never repeat the same label on many arrows.',
    '- "direction": "LR" (default for slides) or "TB" for trees and org charts.',
    '- "title": the slide title, the key message in sentence case, max 58 characters. "lead": one sentence, max 110 characters, or "".',
    'Return ONLY JSON: {"diagrams":[{"title":"","lead":"","type":"","direction":"LR","groups":[{"id":"g1","label":"","kind":"zone"}],' +
      '"nodes":[{"id":"n1","label":"","sub":"","kind":"step","group":"g1","focal":false}],"edges":[{"from":"n1","to":"n2","label":"","style":"solid","both":false}]}]}'
  ].filter(function (l) { return l !== ''; }).join('\n');
  const raw = callGeminiJSON([{ text: prompt }].concat(ddInputParts_(item)), ctx.apiKey, 0.15) || {};
  const list = Array.isArray(raw.diagrams) ? raw.diagrams : (raw.nodes ? [raw] : []);
  const forced = opts.wantedType && DD_TYPES_.indexOf(opts.wantedType) !== -1 ? opts.wantedType : '';
  return list.slice(0, item.slides || 3).map(function (d, i) {
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
      sub: sc(String(n && n.sub || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '')).slice(0, 40),
      type: kind === 'start' || kind === 'end' ? 'terminator' : kind === 'step' || kind === 'service' || kind === 'agent' || kind === 'actor' || kind === 'external' ? 'process' : kind,
      kind: kind,
      group: n && gids[n.group] ? String(n.group) : '',
      emphasize: isFocal
    };
  });
  // diagram-design: deletion
  const normL = function (v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  groups.slice().forEach(function (g) {
    const inside = nodes.filter(function (n) { return n.group === g.id; });
    // a group that is empty, named like its only box, or a zone wrapped around a single box is dropped
    if (!inside.length || (inside.length === 1 && (normL(inside[0].label) === normL(g.label) || g.kind === 'zone' || g.kind === 'hub'))) {
      inside.forEach(function (n) { n.group = ''; });
      groups.splice(groups.indexOf(g), 1);
    } else if (inside.some(function (n) { return normL(n.label) === normL(g.label); })) {
      g.label = '';                                            // the box already says it
    }
  });
  // two opposite arrows become one two-way arrow; the same label on many arrows is shown once
  const edgesIn = (Array.isArray(d.edges) ? d.edges : []).slice(0, 24).map(function (e) {
    return { from: String(e && e.from), to: String(e && e.to), label: sc(String(e && e.label || '').replace(/\.$/, '')).slice(0, 24),
      dashed: /dash/i.test(String(e && e.style || '')), both: !!(e && e.both) };
  });
  const edges = [];
  edgesIn.forEach(function (e) {
    if (e.from === e.to) return;
    const same = edges.filter(function (x) { return x.from === e.from && x.to === e.to; })[0];
    if (same) { if (!same.label) same.label = e.label; return; }
    // (a decision's exits and loops stay separate arrows: they carry Yes / No)
    const isDecision = function (id) { return nodes.some(function (n) { return n.id === id && n.kind === 'decision'; }); };
    const back = isDecision(e.from) || isDecision(e.to) ? null : edges.filter(function (x) { return x.from === e.to && x.to === e.from; })[0];
    if (back) {
      back.both = true;
      if (!back.label) back.label = e.label;
      else if (e.label && e.label !== back.label && (back.label + ' / ' + e.label).length <= 24) back.label += ' / ' + e.label;
      back.dashed = back.dashed && e.dashed;
      return;
    }
    edges.push(e);
  });
  const seenLabel = {};
  edges.forEach(function (e) {
    if (!e.label) return;
    const k = e.label.toLowerCase();
    if (seenLabel[k]) e.label = '';
    seenLabel[k] = true;
  });
  const raw = {
    type: type, direction: String(d.direction || (type === 'tree' || type === 'org-chart' ? 'TB' : 'LR')).toUpperCase() === 'TB' ? 'TB' : 'LR',
    nodes: nodes,
    edges: edges.slice(0, 20),
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
  // the slide meter (Flowchart tab): N slides in total, shared across the pictures in order
  const want = Math.max(0, Math.min(10, Number(opts.slides) || 0));
  const maxPics = want ? Math.min(want, 10) : DD_MAX_IMAGES_;
  const nPics = Math.min(maxPics, items.filter(function (it) { return it.image || it.pdf; }).length);
  let pictures = 0, given = 0;
  items.forEach(function (item) {
    if (typeof checkCancel_ === 'function') checkCancel_(ctx);
    if ((item.image || item.pdf) && ++pictures > maxPics) { res.log.push('Skipped ' + item.label + ': ' + (want ? 'the slide count (' + want + ') is used up.' : 'only ' + DD_MAX_IMAGES_ + ' pictures are read per run.')); return; }
    if (want) {
      const isPic = !!(item.image || item.pdf);
      const share = isPic && nPics ? Math.floor(want / nPics) + ((pictures - 1) < want % nPics ? 1 : 0) : want - given;
      if (share <= 0) return;
      item = Object.assign({}, item, { slides: share });
      given += share;
    }
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
      if (item.slides && irs.length < item.slides) res.log.push(item.label + ': ' + irs.length + ' of ' + item.slides + ' slides could be drawn without repeating.');
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

/** Lines a label needs at a size in a box this wide (Plus Jakarta Sans averages ~0.55em per character). */
function ddLines_(text, w, size) {
  const per = Math.max(4, Math.floor((w - 14) / (size * 0.56)));
  let lines = 0;
  String(text || '').split('\n').forEach(function (part) {
    let line = 0;
    part.split(/\s+/).forEach(function (word) {
      const len = word.length;
      if (!line) { line = len; lines++; if (len > per) lines += Math.ceil(len / per) - 1; }
      else if (line + 1 + len <= per) line += 1 + len;
      else { line = len; lines++; }
    });
  });
  return lines;
}

/** The text that fits the box: size 10 -> 8, and the detail line is left off before anything spills. */
function ddFitText_(n, b) {
  const kind = ddKind_(n);
  const w = kind === 'decision' ? b.w * 0.62 : kind === 'data' ? b.w * 0.74 : kind === 'start' || kind === 'end' ? b.w - 12 : b.w;
  const h = kind === 'decision' ? b.h * 0.62 : b.h;
  for (let size = 10; size >= 8; size--) {
    const subSize = Math.max(7, size - 2);
    const need = ddLines_(n.label, w, size) * size * 1.2 + (n.sub ? ddLines_(n.sub, w, subSize) * subSize * 1.2 : 0) + 6;
    if (need <= h) return { size: size, sub: n.sub || '' };
  }
  for (let size = 10; size >= 8; size--) {
    if (ddLines_(n.label, w, size) * size * 1.2 + 6 <= h) return { size: size, sub: '' };
  }
  return { size: 8, sub: '' };
}

function ddKind_(n) { return n.kind || (n.type === 'terminator' ? 'start' : n.type); }

/** One node as a shape with its label (and detail line, when it fits) inside. */
function ddNodeEl_(n, b, onPanel) {
  const focal = !!n.emphasize;
  const fill = focal ? DD_COLORS_.accent : (n.kind === 'hub' ? DD_COLORS_.ink : (onPanel ? DD_COLORS_.paper : DD_COLORS_.panel));
  const color = focal || n.kind === 'hub' ? DD_COLORS_.paper : DD_COLORS_.ink;
  const fit = ddFitText_(n, b);
  const text = n.label + (fit.sub ? '\n' + fit.sub : '');
  const ts = { size: fit.size, color: color, align: 'center', valign: 'middle', subSize: fit.sub ? Math.max(7, fit.size - 2) : 0 };
  const line = { color: focal ? DD_COLORS_.accent : (n.kind === 'hub' ? DD_COLORS_.ink : DD_COLORS_.rule), width: 0.75 };
  const shapeOf = { start: 'FLOW_CHART_TERMINATOR', end: 'FLOW_CHART_TERMINATOR', decision: 'FLOW_CHART_DECISION', data: 'FLOW_CHART_INPUT_OUTPUT', store: 'FLOW_CHART_MAGNETIC_DISK' };
  const k = ddKind_(n);
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
 * Connectors, following diagram-design's mandatory connector rules:
 * orthogonal only, perpendicular exits, one port per arrow on a side (aligned with the far end so straight runs stay
 * straight), never through a box that is not an end, a two-way relationship is one double-headed arrow,
 * labels beside the stroke and clear of boxes, lines and other labels (a label with no free space is left off).
 * boxes: id -> {x,y,w,h}. Returns line + label elements.
 */
function ddEdgeEls_(edges, boxes, opts) {
  opts = opts || {};
  const els = [];
  const ids = Object.keys(boxes);
  const all = [];
  edges.forEach(function (e) {
    const a = boxes[e.from], b = boxes[e.to];
    if (!a || !b || e.from === e.to) return;
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    const dx = bcx - acx, dy = bcy - acy;
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    let sa, sb;
    // the supporting row under a flow connects up into the steps (out of the top, into the bottom)
    const rowLink = !!(opts.upward && (opts.upward[e.from] || opts.upward[e.to])) && Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h) >= 16;
    if (opts.vertical || (overlapX > 8 && Math.abs(dy) > 4) || rowLink) { sa = dy > 0 ? 'bottom' : 'top'; sb = dy > 0 ? 'top' : 'bottom'; }
    else if (overlapY > 8 || Math.abs(dx) >= Math.abs(dy)) { sa = dx > 0 ? 'right' : 'left'; sb = dx > 0 ? 'left' : 'right'; }
    else { sa = dx > 0 ? 'right' : 'left'; sb = dy > 0 ? 'top' : 'bottom'; }
    all.push({ e: e, a: a, b: b, sa: sa, sb: sb });
  });
  const drawn = [];
  const st = function (e) { return { color: e.emphasize ? DD_COLORS_.accent : DD_COLORS_.ink, width: e.dashed ? 0.75 : 1, dash: !!e.dashed }; };
  const put = function (g, s, arrow, startArrow) {
    els.push({ t: 'line', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, color: s.color, width: s.width, dash: s.dash, arrow: !!arrow, startArrow: !!startArrow });
    drawn.push(g);
  };
  const labelJobs = [];

  // 1. buses: 3+ arrows into (or out of) one side from boxes all on the far side share one trunk and one arrow head
  const inBus = {};
  const busOf = function (keyFn, end) {
    const groups = {};
    all.forEach(function (p, i) {
      if (inBus[i] || opts.vertical) return;
      const side = end === 'b' ? p.sb : p.sa;
      if (side !== 'left' && side !== 'right') return;
      const box = end === 'b' ? p.b : p.a, other = end === 'b' ? p.a : p.b;
      const far = side === 'left' ? other.x + other.w <= box.x - 16 : other.x >= box.x + box.w + 16;
      if (!far) return;
      (groups[keyFn(p) + '|' + side] = groups[keyFn(p) + '|' + side] || []).push(i);
    });
    Object.keys(groups).forEach(function (k) {
      const list = groups[k];
      if (list.length < 3) return;
      const side = k.split('|').pop();
      const hub = end === 'b' ? all[list[0]].b : all[list[0]].a;
      const hy = hub.y + hub.h / 2, hx = side === 'left' ? hub.x : hub.x + hub.w;
      const edgesX = list.map(function (i) { const o = end === 'b' ? all[i].a : all[i].b; return side === 'left' ? o.x + o.w : o.x; });
      const near = side === 'left' ? Math.max.apply(null, edgesX) : Math.min.apply(null, edgesX);
      const tx = dd4_((near + hx) / 2);
      // a bus only when no spur would pass behind another box
      const hitsOther = list.some(function (i) {
        const o = end === 'b' ? all[i].a : all[i].b;
        const oy = o.y + o.h / 2, ox = side === 'left' ? o.x + o.w : o.x;
        const g = { x1: Math.min(ox, tx), x2: Math.max(ox, tx), y1: oy, y2: oy };
        return ids.some(function (k) { const q = boxes[k]; return q !== o && q !== hub && g.x1 < q.x + q.w - 1 && g.x2 > q.x + 1 && oy > q.y + 1 && oy < q.y + q.h - 1; });
      });
      if (hitsOther) return;
      const style = st({ emphasize: false, dashed: list.every(function (i) { return all[i].e.dashed; }) });
      const anyBoth = list.some(function (i) { return all[i].e.both; });
      let ys = [hy];
      list.forEach(function (i) {
        inBus[i] = true;
        const o = end === 'b' ? all[i].a : all[i].b;
        const oy = o.y + o.h / 2, ox = side === 'left' ? o.x + o.w : o.x;
        ys.push(oy);
        // spur: other box <-> trunk; the head sits on the spur for fan-out (into each target), or for a two-way fan-in
        put({ x1: end === 'b' ? ox : tx, y1: oy, x2: end === 'b' ? tx : ox, y2: oy }, style, end === 'a', end === 'b' && !!all[i].e.both);
      });
      put({ x1: tx, y1: Math.min.apply(null, ys), x2: tx, y2: Math.max.apply(null, ys) }, style, false, false);
      // the one arrow between the trunk and the shared box
      const last = end === 'b' ? { x1: tx, y1: hy, x2: hx, y2: hy } : { x1: hx, y1: hy, x2: tx, y2: hy };
      put(last, style, end === 'b', end === 'a' && anyBoth && list.every(function (i) { return all[i].e.both; }));
      const lab = list.map(function (i) { return all[i].e.label; }).filter(Boolean)[0];
      if (lab) labelJobs.push({ label: lab, segs: [last].concat(list.length ? [] : []) });
    });
  };
  busOf(function (p) { return p.e.to; }, 'b');
  busOf(function (p) { return p.e.from; }, 'a');

  // 2. ports for the rest: aimed at the far end's centre (straight runs stay straight), >= 10pt apart on one side
  const assignPorts = function (list) {
    const sides = {};
    list.forEach(function (p) {
      (sides[p.e.from + '|' + p.sa] = sides[p.e.from + '|' + p.sa] || []).push({ p: p, end: 'a' });
      (sides[p.e.to + '|' + p.sb] = sides[p.e.to + '|' + p.sb] || []).push({ p: p, end: 'b' });
    });
    Object.keys(sides).forEach(function (k) {
      const side = k.split('|').pop(), horiz = side === 'left' || side === 'right';
      const lst = sides[k];
      const box = lst[0].end === 'a' ? lst[0].p.a : lst[0].p.b;
      const lo = (horiz ? box.y : box.x) + 6, hi = (horiz ? box.y + box.h : box.x + box.w) - 6;
      lst.forEach(function (g) {
        const other = g.end === 'a' ? g.p.b : g.p.a;
        let want = horiz ? other.y + other.h / 2 : other.x + other.w / 2;
        if (opts.vertical && g.end === 'a') want = box.x + box.w / 2;                // trees: one stem under the parent
        g.want = Math.max(lo, Math.min(hi, want));
      });
      lst.sort(function (u, v) { return u.want - v.want; });
      const gap = opts.vertical && lst[0].end === 'a' ? 0 : 10;
      if (gap && lst.length > 1 && (lst.length - 1) * gap > hi - lo) {
        lst.forEach(function (g, i) { g.want = lo + (hi - lo) * i / (lst.length - 1); });
      } else if (gap) {
        for (let i = 1; i < lst.length; i++) lst[i].want = Math.max(lst[i].want, lst[i - 1].want + gap);
        const over = lst[lst.length - 1].want - hi;
        if (over > 0) lst.forEach(function (g) { g.want -= over; });
        for (let i = lst.length - 2; i >= 0; i--) lst[i].want = Math.min(lst[i].want, lst[i + 1].want - gap);
      }
      lst.forEach(function (g) {
        const pt = horiz ? { x: side === 'right' ? box.x + box.w : box.x, y: g.want } : { x: g.want, y: side === 'bottom' ? box.y + box.h : box.y };
        if (g.end === 'a') g.p.A = pt; else g.p.B = pt;
      });
    });
  };
  const segHitsBox = function (g, q) {
    const x0 = Math.min(g.x1, g.x2), x1 = Math.max(g.x1, g.x2), y0 = Math.min(g.y1, g.y2), y1 = Math.max(g.y1, g.y2);
    return x0 < q.x + q.w - 1 && x1 > q.x + 1 && y0 < q.y + q.h - 1 && y1 > q.y + 1;
  };
  const crosses = function (g, h) {
    const gv = g.x1 === g.x2, hv = h.x1 === h.x2;
    if (gv === hv) {
      if (gv && Math.abs(g.x1 - h.x1) < 2) return Math.min(Math.max(g.y1, g.y2), Math.max(h.y1, h.y2)) - Math.max(Math.min(g.y1, g.y2), Math.min(h.y1, h.y2)) > 2;
      if (!gv && Math.abs(g.y1 - h.y1) < 2) return Math.min(Math.max(g.x1, g.x2), Math.max(h.x1, h.x2)) - Math.max(Math.min(g.x1, g.x2), Math.min(h.x1, h.x2)) > 2;
      return false;
    }
    const v = gv ? g : h, w = gv ? h : g;
    return v.x1 > Math.min(w.x1, w.x2) + 1 && v.x1 < Math.max(w.x1, w.x2) - 1 && w.y1 > Math.min(v.y1, v.y2) + 1 && w.y1 < Math.max(v.y1, v.y2) - 1;
  };
  const toSegs = function (pts) {
    const out = [];
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - pts[i - 1].x) > 0.4 || Math.abs(pts[i].y - pts[i - 1].y) > 0.4) out.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y });
    return out;
  };
  const route = function (p, pi, against) {
    const A = p.A, B = p.B, a = p.a, b = p.b;
    const horizA = p.sa === 'left' || p.sa === 'right', horizB = p.sb === 'left' || p.sb === 'right';
    const others = ids.map(function (k) { return boxes[k]; }).filter(function (q) { return q !== a && q !== b; });
    const ends = [a, b];                                    // a path may not double back through its own boxes either
    const cands = [];
    const offs = [0, 12, -12, 24, -24, 36, -36];
    if (horizA && horizB) {
      if (Math.abs(A.y - B.y) < 1) cands.push([A, { x: B.x, y: A.y }]);          // snapped: exactly horizontal
      offs.forEach(function (o) { const xm = dd4_((A.x + B.x) / 2) + o; cands.push([A, { x: xm, y: A.y }, { x: xm, y: B.y }, B]); });
    } else if (!horizA && !horizB) {
      if (Math.abs(A.x - B.x) < 1) cands.push([A, { x: A.x, y: B.y }]);          // snapped: exactly vertical
      offs.forEach(function (o) { const ym = dd4_((A.y + B.y) / 2) + o; cands.push([A, { x: A.x, y: ym }, { x: B.x, y: ym }, B]); });
    } else {
      cands.push([A, { x: B.x, y: A.y }, B]);
    }
    if (opts.vertical) {
      // trees: children hang off one shared stem and bar under the parent (strokes are meant to coincide)
      const ym = dd4_(a.y + a.h + (b.y - a.y - a.h) / 2);
      return { segs: toSegs(Math.abs(A.x - B.x) < 1 ? [A, { x: A.x, y: B.y }] : [A, { x: A.x, y: ym }, { x: B.x, y: ym }, B]), detour: false, score: 0 };
    }
    const nDirect = cands.length;
    // detours: out of the top / bottom, along a channel above / below every box in between, in through the top / bottom
    const lo = Math.min(a.x, b.x), hi = Math.max(a.x + a.w, b.x + b.w);
    const between = others.concat([a, b]).filter(function (q) { return q.x < hi && q.x + q.w > lo; });
    const top0 = Math.min.apply(null, between.map(function (q) { return q.y; })) - 12;
    const bottom0 = Math.max.apply(null, between.map(function (q) { return q.y + q.h; })) + 12;
    const dir = b.x > a.x ? 1 : -1;
    [0, 1, 2].forEach(function (k) {
      // several detours into one box get their own entry point and their own channel (no shared strokes)
      const ax = a.x + a.w / 2 + dir * (8 + 10 * k), bx = b.x + b.w / 2 - dir * (8 + 10 * k);
      const bottom = bottom0 + 8 * k, top = top0 - 8 * k;
      cands.push([{ x: ax, y: a.y + a.h }, { x: ax, y: bottom }, { x: bx, y: bottom }, { x: bx, y: b.y + b.h }]);
      cands.push([{ x: ax, y: a.y }, { x: ax, y: top }, { x: bx, y: top }, { x: bx, y: b.y }]);
    });
    let best = null;
    cands.forEach(function (pts, ci) {
      const segs = toSegs(pts);
      let boxHits = 0, cross = 0, len = 0;
      segs.forEach(function (g) {
        others.forEach(function (q) { if (segHitsBox(g, q)) boxHits++; });
        ends.forEach(function (q) { if (segHitsBox(g, q)) boxHits++; });
        against.forEach(function (h) { if (crosses(g, h)) cross++; });
        len += Math.abs(g.x2 - g.x1) + Math.abs(g.y2 - g.y1);
      });
      // every arrow leaves and enters perpendicular to the box edge, with a visible run before the head
      const first = segs[0], last = segs[segs.length - 1];
      const horizSeg = function (g) { return Math.abs(g.y1 - g.y2) < 0.5; };
      const sideA = ci >= nDirect ? 'v' : (horizA ? 'h' : 'v'), sideB = ci >= nDirect ? 'v' : (horizB ? 'h' : 'v');
      let bad = 0;
      if (first && (horizSeg(first) ? 'h' : 'v') !== sideA) bad++;
      if (last && (horizSeg(last) ? 'h' : 'v') !== sideB) bad++;
      if (last && Math.abs(last.x2 - last.x1) + Math.abs(last.y2 - last.y1) < 8) bad++;
      const score = boxHits * 1000 + bad * 500 + cross * 40 + len * 0.05 + segs.length * 6 + ci * 0.5 + (ci >= nDirect ? 30 : 0);
      if (!best || score < best.score) best = { score: score, segs: segs, detour: ci >= nDirect };
    });
    return best;
  };
  // first pass finds the arrows that must go around; their side ports are freed and the rest re-aimed (straight stays straight)
  const rest = all.filter(function (p, i) { return !inBus[i]; });
  assignPorts(rest);
  const firstPass = [];
  rest.forEach(function (p, pi) { const r = route(p, pi, drawn.concat(firstPass)); p.detour = r.detour; r.segs.forEach(function (g) { firstPass.push(g); }); });
  assignPorts(rest.filter(function (p) { return !p.detour; }));
  rest.forEach(function (p, pi) {
    const best = route(p, pi, drawn);
    const s = st(p.e);
    best.segs.forEach(function (g, i) { put(g, s, i === best.segs.length - 1, !!p.e.both && i === 0); });
    if (p.e.label) labelJobs.push({ label: p.e.label, segs: best.segs });
  });

  // 3. labels: beside the longest free run, clear of boxes, lines and other labels; no free space = no label
  const placed = [];
  const hitAny = function (r) {
    const inBox = ids.some(function (k) { const q = boxes[k]; return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; });
    const inObstacle = (opts.obstacles || []).some(function (q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; });
    const onLine = drawn.some(function (l) {
      const x0 = Math.min(l.x1, l.x2), x1 = Math.max(l.x1, l.x2), y0 = Math.min(l.y1, l.y2), y1 = Math.max(l.y1, l.y2);
      return x0 < r.x + r.w && r.x < x1 + 0.01 && y0 < r.y + r.h && r.y < y1 + 0.01;
    });
    const inLabel = placed.some(function (q) { return r.x < q.x + q.w + 2 && q.x < r.x + r.w + 2 && r.y < q.y + q.h + 2 && q.y < r.y + r.h + 2; });
    return inBox || inObstacle || onLine || inLabel;
  };
  labelJobs.forEach(function (job) {
    const w = Math.max(24, job.label.length * 4.8 + 6), h = 12;
    const cands = [];
    job.segs.slice().sort(function (u, v) { return (Math.abs(v.x2 - v.x1) + Math.abs(v.y2 - v.y1)) - (Math.abs(u.x2 - u.x1) + Math.abs(u.y2 - u.y1)); }).forEach(function (g) {
      const len = Math.abs(g.x2 - g.x1) + Math.abs(g.y2 - g.y1), mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2;
      if (g.y1 === g.y2) {
        const lo = Math.min(g.x1, g.x2), hi = Math.max(g.x1, g.x2);
        if (len >= w + 8) { cands.push({ x: mx - w / 2, y: my - h - 3, align: 'center' }); cands.push({ x: mx - w / 2, y: my + 3, align: 'center' }); }
        if (len >= w * 0.5) {
          cands.push({ x: lo + 4, y: my - h - 3, align: 'left' }); cands.push({ x: hi - 4 - w, y: my - h - 3, align: 'right' });
          cands.push({ x: lo + 4, y: my + 3, align: 'left' }); cands.push({ x: hi - 4 - w, y: my + 3, align: 'right' });
        }
      } else if (len >= h + 6) {
        cands.push({ x: mx + 4, y: my - h / 2, align: 'left' }); cands.push({ x: mx - 4 - w, y: my - h / 2, align: 'right' });
        cands.push({ x: mx + 4, y: Math.min(g.y1, g.y2) + 3, align: 'left' }); cands.push({ x: mx - 4 - w, y: Math.max(g.y1, g.y2) - h - 3, align: 'right' });
      }
    });
    const pick = cands.filter(function (c) { return !hitAny({ x: c.x, y: c.y, w: w, h: h }); })[0];
    if (!pick) return;
    placed.push({ x: pick.x, y: pick.y, w: w, h: h });
    els.push({ t: 'text', text: job.label, x: pick.x - 7.2, y: pick.y - 1 - 7.2, w: w + 14.4, h: h + 2 + 14.4, size: 8, weight: 500, font: 'sans',
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
  if (!groups.some(function (g) { return g.kind === 'hub'; })) {
    const hubNode = ir.nodes.filter(function (n) { return n.kind === 'hub'; })[0];
    if (hubNode) {
      Object.keys(members).forEach(function (k) { members[k] = members[k].filter(function (n) { return n !== hubNode; }); });
      groups.push({ id: '__hub', label: '', kind: 'hub', loose: true });
      members.__hub = [hubNode];
    }
  }
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
    // zones that feed the hub sit left of it, zones it feeds sit right; the two sides are kept within one zone of each other
    others.forEach(function (g) { (score[g.id] < 0 ? left : score[g.id] > 0 ? right : (left.length <= right.length ? left : right)).push(g); });
    while (left.length > right.length + 1) right.unshift(left.pop());
    while (right.length > left.length + 1) left.push(right.shift());
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
    // zones stacked in one column share its height by how many boxes they hold
    const wts = col.map(function (g) { return members[g.id].length + 0.8; });
    const wsumCol = wts.reduce(function (a, b) { return a + b; }, 0);
    let yCursor = area.y;
    col.forEach(function (g, gi) {
      const ns = members[g.id];
      const perRow = g === hub && ns.length > 3 ? Math.min(3, Math.ceil(ns.length / 2)) : (cw - pad * 2 > 260 && ns.length > 3 ? 2 : 1);
      const rows = Math.ceil(ns.length / perRow);
      const head = g.loose ? 0 : labelH + 4;
      const ngap = rows > 3 ? 8 : nodeGap;
      // a zone is never shorter than its boxes need (they never spill out of the panel)
      const need = head + rows * 32 + (rows - 1) * ngap + pad;
      const zh = Math.max(need, (area.h - gap * (col.length - 1)) * wts[gi] / wsumCol);
      const z = { x: x, y: dd4_(yCursor), w: cw, h: dd4_(zh) };
      yCursor += zh + gap;
      const inner = { x: z.x + pad, y: z.y + head, w: z.w - pad * 2, h: z.h - head - pad };
      const nh = Math.max(32, Math.min(48, dd4_((inner.h - ngap * (rows - 1)) / rows)));
      const nw = dd4_(Math.min(200, (inner.w - ngap * (perRow - 1)) / perRow));
      const blockH = rows * nh + (rows - 1) * ngap;
      const y0 = inner.y + Math.max(0, (inner.h - blockH) / 2);
      ns.forEach(function (n, i) {
        const r = Math.floor(i / perRow), c = i % perRow;
        const inRow = Math.min(perRow, ns.length - r * perRow);
        const rowW = inRow * nw + (inRow - 1) * ngap;
        boxes[n.id] = { x: dd4_(inner.x + (inner.w - rowW) / 2 + c * (nw + ngap)), y: dd4_(y0 + r * (nh + ngap)), w: nw, h: nh };
      });
      // the panel hugs its boxes (no half-empty zones)
      const top = Math.min.apply(null, ns.map(function (n) { return boxes[n.id].y; }));
      const bottom = Math.max.apply(null, ns.map(function (n) { return boxes[n.id].y + boxes[n.id].h; }));
      const zz = { x: z.x, y: top - labelH - 8, w: z.w, h: 0 };
      zz.h = bottom + pad - zz.y;
      if (!g.loose) zones.push({ box: zz, label: g.label, kind: g.kind });
    });
    x += cw + gap;
  });
  // centre the whole picture vertically in the area
  const tops = Object.keys(boxes).map(function (k) { return boxes[k].y; }).concat(zones.map(function (z) { return z.box.y; }));
  const bots = Object.keys(boxes).map(function (k) { return boxes[k].y + boxes[k].h; }).concat(zones.map(function (z) { return z.box.y + z.box.h; }));
  const y0 = Math.min.apply(null, tops), y1 = Math.max.apply(null, bots);
  const shift = dd4_(area.y + Math.max(0, (area.h - (y1 - y0)) / 2) - y0);
  Object.keys(boxes).forEach(function (k) { boxes[k].y += shift; });
  zones.forEach(function (z) { z.box.y += shift; });
  return { boxes: boxes, zones: zones, obstacles: zones.filter(function (z) { return z.label; }).map(function (z) { return { x: z.box.x, y: z.box.y, w: Math.min(z.box.w, z.label.length * 4.6 + 12), h: 18 }; }) };
}

/* ----- swimlane (and process / data-flow with lanes): lanes as rows, or as columns when the steps would be too narrow ----- */
function ddSwimlaneLayout_(ir, area) {
  const lanes = ir.groups.slice(0, 5);
  const laneIds = lanes.map(function (g) { return g.id; });
  const lay = flowchartLayers_(ir);
  const col = {};
  lay.layers.forEach(function (layer, li) { layer.forEach(function (id) { col[id] = li; }); });
  const taken = {}, laneOf = {};
  ir.nodes.forEach(function (n) {
    const lane = Math.max(0, laneIds.indexOf(n.group));
    let c = col[n.id] || 0;
    while (taken[lane + ':' + c]) c++;                              // two steps in one lane and step: the later one moves on
    taken[lane + ':' + c] = true;
    col[n.id] = c;
    laneOf[n.id] = lane;
  });
  const nSteps = Math.max.apply(null, ir.nodes.map(function (n) { return col[n.id]; })) + 1;
  const boxes = {}, els = [];
  const labelW = 88, gap = 20;
  const rowsLayout = (area.w - labelW - gap * (nSteps - 1)) / nSteps >= 84;
  if (rowsLayout) {
    const laneH = dd4_(Math.min(84, area.h / Math.max(1, lanes.length)));
    const top = dd4_(area.y + (area.h - laneH * lanes.length) / 2);
    const colW = (area.w - labelW - gap * (nSteps - 1)) / nSteps;
    const nw = dd4_(Math.min(140, colW)), nh = dd4_(Math.min(48, laneH - 16));
    ir.nodes.forEach(function (n) {
      const cx = area.x + labelW + col[n.id] * (colW + gap) + colW / 2, cy = top + laneOf[n.id] * laneH + laneH / 2;
      const dh = n.kind === 'decision' ? dd4_(Math.min(laneH - 8, nh * 1.4)) : nh;
      boxes[n.id] = { x: dd4_(cx - nw / 2), y: dd4_(cy - dh / 2), w: nw, h: dh };
    });
    lanes.forEach(function (g, i) {
      const y = top + i * laneH;
      els.push({ t: 'rect', x: area.x, y: y, w: area.w, h: laneH, fill: i % 2 ? DD_COLORS_.paper : DD_COLORS_.panel, line: null, zone: true });
      els.push({ t: 'text', text: g.label, x: area.x + 4 - 7.2, y: y - 7.2, w: labelW - 12 + 14.4, h: laneH + 14.4, size: 8, weight: 500, font: 'sans',
        color: DD_COLORS_.ink, align: 'left', valign: 'middle', spacing: 1 });
    });
  } else {
    // lanes as columns, steps run down the slide
    const headH = 20;
    const laneW = area.w / Math.max(1, lanes.length);
    const rowH = (area.h - headH) / nSteps;
    const nw = dd4_(Math.min(160, laneW - 24)), nh = dd4_(Math.max(28, Math.min(44, rowH - 10)));
    ir.nodes.forEach(function (n) {
      const cx = area.x + laneOf[n.id] * laneW + laneW / 2, cy = area.y + headH + col[n.id] * rowH + rowH / 2;
      boxes[n.id] = { x: dd4_(cx - nw / 2), y: dd4_(cy - nh / 2), w: nw, h: nh };
    });
    lanes.forEach(function (g, i) {
      const x = area.x + i * laneW;
      els.push({ t: 'rect', x: dd4_(x), y: area.y, w: dd4_(laneW) - 4, h: area.h, fill: i % 2 ? DD_COLORS_.paper : DD_COLORS_.panel, line: null, zone: true });
      els.push({ t: 'text', text: g.label, x: x + 6 - 7.2, y: area.y + 2 - 7.2, w: laneW - 12 + 14.4, h: 16 + 14.4, size: 8, weight: 500, font: 'sans',
        color: DD_COLORS_.ink, align: 'left', valign: 'top', spacing: 1 });
    });
  }
  return { boxes: boxes, under: els };
}

/* ----- flowchart family: the main flow in steps, supporting boxes (controls, tools) in a row underneath ----- */
function ddFlowLayout_(ir, area) {
  const inc = {}, out = {};
  ir.nodes.forEach(function (n) { inc[n.id] = 0; out[n.id] = []; });
  ir.edges.forEach(function (e) { if (inc[e.to] != null && out[e.from]) { inc[e.to]++; out[e.from].push(e.to); } });
  const depthMemo = {};
  const depth = function (id, seen) {
    if (depthMemo[id] != null) return depthMemo[id];
    if (seen[id]) return 0;
    seen[id] = true;
    const d = out[id].reduce(function (m, t) { return Math.max(m, 1 + depth(t, seen)); }, 0);
    seen[id] = false;
    return (depthMemo[id] = d);
  };
  const hasStart = ir.nodes.some(function (n) { return n.kind === 'start'; });
  const sources = ir.nodes.filter(function (n) { return inc[n.id] === 0 && n.kind !== 'start' && out[n.id].length; });
  let side = [];
  if (hasStart) side = sources.slice();
  else if (sources.length > 1) {
    const main = sources.slice().sort(function (a, b) { return depth(b.id, {}) - depth(a.id, {}); })[0];
    side = sources.filter(function (n) { return n !== main && (n.kind === 'service' || depth(n.id, {}) <= 1); });
  }
  if (!side.length || ir.nodes.length - side.length < 2) {
    const F = layoutFlowchart_(ir, area);
    return { boxes: F.pos };
  }
  const isSide = {};
  side.forEach(function (n) { isSide[n.id] = true; });
  const mainIr = { nodes: ir.nodes.filter(function (n) { return !isSide[n.id]; }), edges: ir.edges.filter(function (e) { return !isSide[e.from] && !isSide[e.to]; }), groups: [] };
  const F = layoutFlowchart_(mainIr, { x: area.x, y: area.y, w: area.w, h: area.h * 0.62 });
  const boxes = F.pos;
  const ref = boxes[mainIr.nodes[0].id] || { w: 120, h: 44 };
  const gap = 12;
  let sw = Math.min(160, Math.max(ref.w, 96));
  if (side.length * sw + gap * (side.length - 1) > area.w) sw = (area.w - gap * (side.length - 1)) / side.length;
  const sh = 44;
  const row = side.map(function (n) {
    const ts = out[n.id].filter(function (t) { return boxes[t]; });
    const want = ts.length ? ts.reduce(function (s, t) { return s + boxes[t].x + boxes[t].w / 2; }, 0) / ts.length : area.x + area.w / 2;
    return { n: n, x: want - sw / 2 };
  }).sort(function (a, b) { return a.x - b.x; });
  row.forEach(function (r, i) { if (i) r.x = Math.max(r.x, row[i - 1].x + sw + gap); });
  const overR = row[row.length - 1].x + sw - (area.x + area.w);
  if (overR > 0) row.forEach(function (r) { r.x -= overR; });
  for (let i = row.length - 2; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - sw - gap);
  const overL = area.x - row[0].x;
  if (overL > 0) row.forEach(function (r) { r.x += overL; });
  const mainBottom = Math.max.apply(null, mainIr.nodes.map(function (n) { return boxes[n.id].y + boxes[n.id].h; }));
  const y = dd4_(Math.min(area.y + area.h - sh, mainBottom + 56));
  row.forEach(function (r) { boxes[r.n.id] = { x: dd4_(r.x), y: y, w: dd4_(sw), h: sh }; });
  return { boxes: ddFit_(boxes, area), upward: isSide };
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
  else if (ir.edges.length) L = ddFlowLayout_(ir, area);           // flowchart family
  else if (ir.groups.length) L = ddZonesLayout_(ir, area);
  else L = ddLayersLayout_({ nodes: ir.nodes.map(function (n) { return Object.assign({}, n, { group: 'all' }); }), edges: [], groups: [{ id: 'all', label: '', kind: 'layer' }] }, area);
  const els = [];
  (L.under || []).forEach(function (e) { els.push(e); });
  (L.zones || []).forEach(function (z) { ddZoneEls_(z.box, z.label, z.kind).forEach(function (e) { els.push(e); }); });
  if (!L.noEdges) ddEdgeEls_(L.edges || ir.edges, L.boxes, { vertical: L.vertical, obstacles: L.obstacles, upward: L.upward }).forEach(function (e) { els.push(e); });
  (L.over || []).forEach(function (e) { els.push(e); });
  const inZone = function (id) { const n = ir.nodes.filter(function (x) { return x.id === id; })[0]; return !!(n && n.group) || !!L.under; };
  const nodeEls = ir.nodes.filter(function (n) { return L.boxes[n.id]; }).map(function (n) { return ddNodeEl_(n, L.boxes[n.id], inZone(n.id)); });
  // one label size for the plain boxes; diamonds and slanted data shapes may go smaller on their own
  const special = function (e) { return e.shape === 'FLOW_CHART_DECISION' || e.shape === 'FLOW_CHART_INPUT_OUTPUT'; };
  const size = Math.min.apply(null, nodeEls.filter(function (e) { return !special(e); }).map(function (e) { return e.textStyle.size; }).concat([10]));
  nodeEls.forEach(function (e) {
    e.textStyle.size = special(e) ? Math.min(e.textStyle.size, size) : size;
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
