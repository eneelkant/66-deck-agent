/**
 * Draws one slide from the layout engine (Engine.gs, 66degrees 2026 template standard) into Google Slides.
 * Engine coordinates are on a 720 x 405 pt canvas and are scaled to the page size.
 * Design tokens come from the reference library (ctx.tokens); icons come from the template icon set first.
 *
 * Safety contract:
 *   - every insertShape goes through insertShapeSafe_ / normalizeShapeType_
 *   - every insertTextBox goes through insertTextBoxSafe_
 *   - width/height are always finite and > 0
 *   - getText() is only called on objects that actually have a text frame
 *   - unknown / AI-generated shape names never reach insertShape without normalizeShapeType_
 */

var MIN_SIZE_ = 1;

/**
 * Official SlidesApp.ShapeType names we are willing to pass to insertShape.
 * ROUNDED_RECTANGLE is intentionally absent — that identifier is not a valid
 * Apps Script enum value (the real name is ROUND_RECTANGLE).
 */
var VALID_SHAPE_TYPE_KEYS = {
  RECTANGLE: true,
  ROUND_RECTANGLE: true,
  ELLIPSE: true,
  DIAMOND: true,
  TRIANGLE: true,
  RIGHT_TRIANGLE: true,
  CHEVRON: true,
  HOME_PLATE: true,
  LEFT_ARROW: true,
  RIGHT_ARROW: true,
  UP_ARROW: true,
  DOWN_ARROW: true,
  LEFT_RIGHT_ARROW: true,
  UP_DOWN_ARROW: true,
  PARALLELOGRAM: true,
  TRAPEZOID: true,
  PENTAGON: true,
  HEXAGON: true,
  FLOW_CHART_PROCESS: true,
  FLOW_CHART_DECISION: true,
  FLOW_CHART_TERMINATOR: true
};

var SHAPE_TYPE_ALIASES = {
  rect: 'RECTANGLE',
  rectangle: 'RECTANGLE',
  square: 'RECTANGLE',
  box: 'RECTANGLE',
  ellipse: 'ELLIPSE',
  oval: 'ELLIPSE',
  circle: 'ELLIPSE',
  roundrect: 'ROUND_RECTANGLE',
  round_rect: 'ROUND_RECTANGLE',
  round_rectangle: 'ROUND_RECTANGLE',
  roundedrect: 'ROUND_RECTANGLE',
  rounded_rect: 'ROUND_RECTANGLE',
  rounded_rectangle: 'ROUND_RECTANGLE',
  roundedrectangle: 'ROUND_RECTANGLE',
  diamond: 'DIAMOND',
  rhombus: 'DIAMOND',
  decision: 'DIAMOND',
  triangle: 'TRIANGLE',
  chevron: 'CHEVRON',
  home_plate: 'HOME_PLATE',
  homeplate: 'HOME_PLATE',
  arrow: 'RIGHT_ARROW',
  right_arrow: 'RIGHT_ARROW',
  left_arrow: 'LEFT_ARROW',
  up_arrow: 'UP_ARROW',
  down_arrow: 'DOWN_ARROW',
  process: 'ROUND_RECTANGLE',
  start: 'ELLIPSE',
  end: 'ELLIPSE'
};

function shapeTypeKeyFromValue_(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/^ShapeType\./i, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

function resolveShapeTypeKey_(value) {
  var raw = shapeTypeKeyFromValue_(value);
  if (!raw) return 'RECTANGLE';
  var alias = SHAPE_TYPE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  var compact = raw.toUpperCase();
  if (VALID_SHAPE_TYPE_KEYS[compact]) return compact;
  return 'RECTANGLE';
}

function normalizeShapeType_(value) {
  var key = resolveShapeTypeKey_(value);
  var enumObj = (typeof SlidesApp !== 'undefined' && SlidesApp && SlidesApp.ShapeType) ? SlidesApp.ShapeType : {};
  var resolved = enumObj[key];
  if (resolved == null) resolved = enumObj.RECTANGLE;
  if (resolved == null) return 'RECTANGLE';
  return resolved;
}

function finiteNumber_(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function safeSize_(value, fallback) {
  var n = finiteNumber_(value, fallback == null ? MIN_SIZE_ : fallback);
  return n < MIN_SIZE_ ? MIN_SIZE_ : n;
}

function safeBox_(x, y, w, h) {
  return {
    x: finiteNumber_(x, 0),
    y: finiteNumber_(y, 0),
    w: safeSize_(w, MIN_SIZE_),
    h: safeSize_(h, MIN_SIZE_)
  };
}

function insertShapeSafe_(slide, typeValue, x, y, w, h) {
  var box = safeBox_(x, y, w, h);
  return slide.insertShape(normalizeShapeType_(typeValue), box.x, box.y, box.w, box.h);
}

function insertTextBoxSafe_(slide, text, x, y, w, h) {
  var box = safeBox_(x, y, w, h);
  return slide.insertTextBox(text == null ? '' : String(text), box.x, box.y, box.w, box.h);
}

function hasTextFrame_(shape) {
  if (!shape || typeof shape.getText !== 'function') return false;
  try {
    var tr = shape.getText();
    return !!(tr && typeof tr.setText === 'function');
  } catch (e) {
    return false;
  }
}

function writeTextSafe_(shape, text) {
  if (!hasTextFrame_(shape)) return false;
  try {
    shape.getText().setText(text == null ? '' : String(text));
    return true;
  } catch (e) {
    return false;
  }
}

function applyTextStyleSafe_(textRange, fn) {
  if (!textRange || typeof textRange.getTextStyle !== 'function') return;
  try {
    fn(textRange.getTextStyle());
  } catch (e) {}
}

function overlayTextIfNeeded_(slide, shape, e, box) {
  if (!e || e.text == null || e.text === '') return;
  let target = shape;
  if (hasTextFrame_(shape)) writeTextSafe_(shape, e.text);
  else target = insertTextBoxSafe_(slide, e.text, box.x, box.y, box.w, box.h);
  // Text inside diagram boxes (flowcharts): brand font, size, colour and centring
  if (e.textStyle && target) {
    const st = e.textStyle, scale = e.w > 0 ? box.w / e.w : 1;
    try {
      const tr = target.getText();
      applyTextStyleSafe_(tr, function (ts) {
        ts.setFontFamily(st.font || 'Plus Jakarta Sans');
        ts.setFontSize(Math.max(6, (st.size || 11) * scale));
        ts.setForegroundColor(st.color || '#040A1B');
        ts.setBold(false);
      });
      tr.getParagraphStyle().setParagraphAlignment(st.align === 'left' ? SlidesApp.ParagraphAlignment.START : SlidesApp.ParagraphAlignment.CENTER);
      if (typeof target.setContentAlignment === 'function') target.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
    } catch (err) {}
  }
}

function layoutDiagramPositions(diagram, area) {
  diagram = diagram || {};
  area = area || {};
  var nodes = diagram.nodes || [];
  var box = safeBox_(area.x, area.y, area.w, area.h);
  var n = Math.max(nodes.length, 1);
  var dir = String(diagram.direction || 'LR').toUpperCase();
  var gap = 12;
  var positions = {};
  var cols, rows, cellW, cellH;
  if (dir === 'TB') {
    cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    rows = Math.max(1, Math.ceil(n / cols));
  } else {
    rows = Math.max(1, n > 8 ? 2 : 1);
    cols = Math.max(1, Math.ceil(n / rows));
  }
  cellW = Math.max(MIN_SIZE_, (box.w - gap * (cols - 1)) / cols);
  cellH = Math.max(MIN_SIZE_, (box.h - gap * (rows - 1)) / rows);
  nodes.forEach(function (node, i) {
    var id = node && node.id != null ? node.id : i;
    var r = dir === 'TB' ? Math.floor(i / cols) : Math.floor(i / cols);
    var c = i % cols;
    positions[id] = {
      x: box.x + c * (cellW + gap),
      y: box.y + r * (cellH + gap),
      w: cellW,
      h: cellH
    };
  });
  return positions;
}

function getActivePresentationSafe_() {
  if (typeof SlidesApp === 'undefined' || !SlidesApp.getActivePresentation) {
    throw new Error('No active Google Slides presentation.');
  }
  var pres = SlidesApp.getActivePresentation();
  if (!pres) throw new Error('No active Google Slides presentation.');
  return pres;
}

function renderEngineSlide(slide, spec, number, ctx, pageW, pageH, dateLabel) {
  const out = ENGINE.render({ slides: [spec] }, { dateLabel: dateLabel, sectionNo: spec.number || null, tokens: ctx.tokens || null })[0];
  const s = safeSize_(pageW, ENGINE.W) / ENGINE.W;

  slide.getPageElements().forEach(function (el) { try { el.remove(); } catch (e) {} });
  ctx.slideIcons = {};
  const bgId = out.bgImage ? engineAssetId(out.bgImage, ctx) : null;
  if (bgId) {
    try { slide.getBackground().setPictureFill(getBlobCached(bgId, ctx)); } catch (e) { slide.getBackground().setSolidFill(out.bg); }
  } else {
    slide.getBackground().setSolidFill(out.bg);
  }

  const ALIGN = { left: SlidesApp.ParagraphAlignment.START, center: SlidesApp.ParagraphAlignment.CENTER, right: SlidesApp.ParagraphAlignment.END };
  const VALIGN = { top: SlidesApp.ContentAlignment.TOP, middle: SlidesApp.ContentAlignment.MIDDLE, bottom: SlidesApp.ContentAlignment.BOTTOM };
  const sans = ctx.brand.fonts.heading.slides, mono = ctx.brand.fonts.mono.slides;

  out.els.forEach(function (e) {
    try {
      if (e.t === 'rect' || e.t === 'ellipse' || e.t === 'roundrect') {
        // Brand rule: every box has small rounded corners (~3pt). Thin rules, bars and full-bleed bands stay square.
        const box = safeBox_(e.x * s, e.y * s, e.w * s, e.h * s);
        const isBox = e.t !== 'ellipse' && !e.square && Math.min(box.w, box.h) >= 14 && e.x > 1 && e.x + e.w < ENGINE.W - 1;
        let sh = isBox ? insertRoundedBox_(slide, box.x, box.y, box.w, box.h, ctx, s) : null;
        if (!sh) {
          const type = e.t === 'ellipse' ? 'ELLIPSE' : 'RECTANGLE';
          sh = insertShapeSafe_(slide, type, box.x, box.y, box.w, box.h);
        }
        if (e.rot) { try { sh.setRotation(((finiteNumber_(e.rot, 0) % 360) + 360) % 360); } catch (err) {} }
        sh.getFill().setSolidFill(e.fill);
        if (e.line) {
          sh.getBorder().setWeight(Math.max(0.5, finiteNumber_(e.line.width, 1) * s));
          sh.getBorder().getLineFill().setSolidFill(e.line.color);
        } else {
          sh.getBorder().setTransparent();
        }
        overlayTextIfNeeded_(slide, sh, e, box);
      } else if (e.t === 'arc') {
        if (typeof insertArc_ === 'function') {
          insertArc_(slide, e.kind, finiteNumber_(e.cx, 0) * s, finiteNumber_(e.cy, 0) * s, finiteNumber_(e.r, 1) * s, e.sweep, e.start || 0, e.fill, ctx);
        }
      } else if (e.t === 'shape') {
        const box = safeBox_(e.x * s, e.y * s, e.w * s, e.h * s);
        const sh = insertShapeSafe_(slide, e.shape, box.x, box.y, box.w, box.h);
        if (e.rot) { try { sh.setRotation(((finiteNumber_(e.rot, 0) % 360) + 360) % 360); } catch (err) {} }
        sh.getFill().setSolidFill(e.fill);
        if (e.line) {
          sh.getBorder().setWeight(Math.max(0.5, finiteNumber_(e.line.width, 1) * s));
          sh.getBorder().getLineFill().setSolidFill(e.line.color);
        } else {
          sh.getBorder().setTransparent();
        }
        overlayTextIfNeeded_(slide, sh, e, box);
      } else if (e.t === 'line') {
        const x1 = finiteNumber_(e.x1 * s, 0);
        const y1 = finiteNumber_(e.y1 * s, 0);
        const x2 = finiteNumber_(e.x2 * s, x1 + MIN_SIZE_);
        const y2 = finiteNumber_(e.y2 * s, y1);
        const ln = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y1, x2 === x1 && y2 === y1 ? x2 + MIN_SIZE_ : x2, y2);
        ln.setWeight(Math.max(0.5, finiteNumber_(e.width, 1) * s));
        ln.getLineFill().setSolidFill(e.color);
        if (e.arrow) { try { ln.setEndArrow(SlidesApp.ArrowStyle.FILL_ARROW); } catch (err) {} }   // flowchart connectors
      } else if (e.t === 'image') {
        const id = engineAssetId(e.asset, ctx);
        if (id) {
          const box = safeBox_(e.x * s, e.y * s, e.w * s, e.h * s);
          slide.insertImage(getBlobCached(id, ctx), box.x, box.y, box.w, box.h);
        }
      } else if (e.t === 'icon') {
        drawEngineIcon(slide, e, s, ctx);
      } else if (e.t === 'text') {
        // Autofit off BEFORE the text goes in: otherwise Slides shrinks the font (e.g. 11pt -> 10pt) and keeps it
        const box = insertTextBoxSafe_(slide, '', e.x * s, e.y * s, e.w * s, e.h * s);
        if (e.rot) { try { box.setRotation(((finiteNumber_(e.rot, 0) % 360) + 360) % 360); } catch (err) {} }
        try { box.getAutofit().disableAutofit(); } catch (err) {}
        if (!hasTextFrame_(box)) return;
        const tr = box.getText();
        tr.setText(e.text == null ? '' : String(e.text));
        const family = e.font === 'mono' ? mono : sans;
        applyTextStyleSafe_(tr, function (ts) {
          ts.setFontFamily(family)
            .setFontFamilyAndWeight(family, e.weight || 400)
            .setFontSize(Math.round(finiteNumber_(e.size, 11) * s * 2) / 2)
            .setForegroundColor(e.color);
        });
        (e.runs || []).forEach(function (r) {
          try {
            const rs = tr.getRange(r.start, Math.min(r.end, tr.asString().length - 1)).getTextStyle();
            if (r.color) rs.setForegroundColor(r.color);
            if (r.weight) rs.setFontFamilyAndWeight(family, r.weight);
          } catch (err) {}
        });
        try {
          const ps = tr.getParagraphStyle();
          ps.setParagraphAlignment(ALIGN[e.align] || ALIGN.left);
          ps.setLineSpacing(Math.round((e.spacing || 1.1) * 100));
          ps.setSpaceAbove(0);
          ps.setSpaceBelow(0);
        } catch (err) {}
        try { box.setContentAlignment(VALIGN[e.valign] || VALIGN.top); } catch (err) {}
        try { box.getAutofit().disableAutofit(); } catch (err) {}
      }
    } catch (err) {
      Logger.log('Engine element failed (' + e.t + '): ' + err.message);
    }
  });

  if (spec.notes) setSpeakerNotesSafe_(slide, spec.notes);
}

function setSpeakerNotesSafe_(slide, notes) {
  try {
    const notesShape = slide.getNotesPage().getSpeakerNotesShape();
    writeTextSafe_(notesShape, notes);
  } catch (e) {}
}

// Engine asset key -> Drive file id (design images in 01_Brand_Assets/03_Images/Design)
function engineAssetId(asset, ctx) {
  const d = (ctx.assets && ctx.assets.design) || {};
  const logos = (ctx.assets && ctx.assets.logos) || {};
  const map = {
    'logo-dark': d['ds-logo-dark'] || logos.dark,
    'mark-dark': d['ds-mark-dark'],
    'mark-white': d['ds-mark-white'],
    'cube': d['ds-cube'],
    'cover-pattern': d['ds-cover-pattern'],
    'band-pattern': d['ds-band-pattern'],
    'strip-pattern': d['ds-strip-pattern'],
    'section-bg': d['ds-section-bg']
  };
  return map[asset] || ((ctx.assets && ctx.assets.patterns) || {})[asset] || null;
}

// Icon order (CONFIG.iconOrder): template icon library (vector) -> Drive brand icon -> Material Icons
function drawEngineIcon(slide, e, s, ctx) {
  const size = safeSize_(finiteNumber_(e.size, 16) * s, MIN_SIZE_);
  // Semantic IconProvider path (local / better-icons / fallback) before legacy lookup.
  if (typeof resolveIconRequest_ === 'function' && typeof insertResolvedIcon_ === 'function') {
    try {
      const concept = e.concept || e.name || e.material || '';
      const pre = (ctx && ctx.currentSpec && ctx.currentSpec.resolvedIcons &&
        (ctx.currentSpec.resolvedIcons[concept] || ctx.currentSpec.resolvedIcons[e.nodeId])) || null;
      const resolved = pre && pre.svg ? pre : resolveIconRequest_({
        concept: concept,
        brandColor: e.color || (e.dark ? '#FFFDF9' : '#0052FF'),
        onDark: !!e.dark,
        size: Math.max(16, Math.round(size)),
        style: 'outline'
      }, ctx);
      if (resolved && insertResolvedIcon_(slide, resolved, e.x * s, e.y * s, size, ctx)) {
        ctx.providerIconsPlaced = (ctx.providerIconsPlaced || 0) + 1;
        return;
      }
    } catch (err) {
      Logger.log('IconProvider draw skipped: ' + err.message);
    }
  }
  const order = (typeof CONFIG !== 'undefined' && CONFIG.iconOrder) ? CONFIG.iconOrder : ['library', 'drive', 'material'];
  for (let k = 0; k < order.length; k++) {
    const step = order[k];
    if (step === 'library' && ctx.lib) {
      const tags = [];
      [e.name].concat(e.alt || []).forEach(function (n) { const t = libraryIconByName(ctx.lib, n); if (t && tags.indexOf(t) === -1) tags.push(t); });
      const used = ctx.slideIcons || (ctx.slideIcons = {});
      const guess = pickLibraryIcon(ctx.lib, [e.name, e.material].filter(Boolean).join(' '), used);
      if (guess && tags.indexOf(guess) === -1) tags.push(guess);
      GENERIC_ICON_WORDS_.forEach(function (w) {
        const g = pickLibraryIcon(ctx.lib, w, used);
        if (g && tags.indexOf(g) === -1) tags.push(g);
      });
      for (let j = 0; j < tags.length; j++) {
        if (used[tags[j]]) continue;
        if (insertLibraryIcon(slide, tags[j], e.x * s, e.y * s, size, e.dark, ctx, e.color || null)) {
          ctx.libraryIconsPlaced = (ctx.libraryIconsPlaced || 0) + 1;
          used[tags[j]] = true;
          return;
        }
      }
    } else if (step === 'drive' && e.name && !/^lib:/i.test(e.name)) {
      const match = findBrandIcon(e.name, ctx.assets.icons, {});
      const id = match && (e.dark ? (match.entry.white || match.entry.blue) : (match.entry.blue || match.entry.white));
      if (id) {
        slide.insertImage(getBlobCached(id, ctx), e.x * s, e.y * s, size, size);
        return;
      }
    } else if (step === 'material' && anyLibraryIcon_(slide, e, s, size, ctx)) {
      return;
    } else if (step === 'material' && e.fallback) {
      const bw = size * 2.2;
      const tb = insertTextBoxSafe_(slide, String(e.fallback), e.x * s + size / 2 - bw / 2, e.y * s, bw, size);
      try { tb.getAutofit().disableAutofit(); } catch (err) {}
      try { tb.setLeft(e.x * s + size / 2 - bw / 2); } catch (err) {}
      if (hasTextFrame_(tb)) {
        const tr = tb.getText();
        applyTextStyleSafe_(tr, function (ts) {
          ts.setFontFamily(ctx.brand.fonts.mono.slides).setFontSize(Math.max(9, Math.min(14, Math.round(size * 0.45)))).setForegroundColor(e.dark ? ENGINE.TOKENS.white : ENGINE.TOKENS.blue);
        });
        try { tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER); } catch (err) {}
        try { tb.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE); } catch (err) {}
      }
      return;
    } else if (step === 'material') {
      const ringEl = insertShapeSafe_(slide, 'ELLIPSE', e.x * s + size * 0.2, e.y * s + size * 0.2, size * 0.6, size * 0.6);
      ringEl.getFill().setTransparent();
      ringEl.getBorder().setWeight(Math.max(1, size * 0.08));
      ringEl.getBorder().getLineFill().setSolidFill(e.color || (e.dark ? ENGINE.TOKENS.white : ENGINE.TOKENS.blue));
      Logger.log('No template or Drive icon for "' + e.name + '"; drew a ring.');
      return;
    }
  }
}

var GENERIC_ICON_WORDS_ = ['idea', 'target', 'growth', 'team', 'check', 'chart', 'cloud', 'settings', 'search', 'star', 'rocket', 'shield'];

function anyLibraryIcon_(slide, e, s, size, ctx) {
  const rt = ctx.refRuntime;
  if (!ctx.lib || !rt || !rt.icons) return false;
  const used = ctx.slideIcons || (ctx.slideIcons = {});
  const tags = Object.keys(rt.icons).filter(function (t) { return !used[t]; }).sort();
  if (!tags.length) return false;
  let h = 0;
  String(e.name || e.fallback || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 100003; });
  for (let k = 0; k < Math.min(4, tags.length); k++) {
    const tag = tags[(h + k * 7) % tags.length];
    if (insertLibraryIcon(slide, tag, e.x * s, e.y * s, size, e.dark, ctx, e.color || null)) {
      used[tag] = true;
      ctx.libraryIconsPlaced = (ctx.libraryIconsPlaced || 0) + 1;
      return true;
    }
  }
  return false;
}

var EngineRenderer = {
  normalizeShapeType: normalizeShapeType_,
  insertShapeSafe: insertShapeSafe_,
  insertTextBoxSafe: insertTextBoxSafe_,
  safeBox: safeBox_,
  hasTextFrame: hasTextFrame_,
  writeTextSafe: writeTextSafe_,
  overlayTextIfNeeded: overlayTextIfNeeded_,
  layoutDiagramPositions: layoutDiagramPositions,
  renderEngineSlide: renderEngineSlide,
  getActivePresentation: getActivePresentationSafe_,
  setSpeakerNotesSafe: setSpeakerNotesSafe_
};
