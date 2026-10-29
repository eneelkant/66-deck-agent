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
  FLOW_CHART_TERMINATOR: true,
  FLOW_CHART_INPUT_OUTPUT: true,
  FLOW_CHART_MAGNETIC_DISK: true
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
      // diagram boxes: the detail line under the label is smaller
      if (st.subSize && String(e.text).indexOf('\n') !== -1) {
        const cut = String(e.text).indexOf('\n') + 1;
        try { tr.getRange(cut, String(e.text).length).getTextStyle().setFontSize(Math.max(6, st.subSize * scale)); } catch (err2) {}
      }
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

// V.1_64: the deck check's findings in words
const QA_LABELS_ = { empty: 'nothing under the title', 'lost-content': 'part of its content missing', 'headings-only': 'only headings shown',
  'plain-layout': 'a plain layout', 'joined-points': 'points run together', cut: 'a text cut short', overlap: 'texts on top of each other',
  'streak-content': 'the transition picture behind content', detached: 'a text half outside its box', 'off-slide': 'a shape outside the slide',
  hollow: 'a box much taller than its text', 'record-text': 'a text written as fields', 'dot-heading': 'a heading joined with a dot', 'repeat-title': 'the title written twice',
  font: 'another typeface', 'fit-reverted': 'box fitting undone' };
function renderEngineSlide(slide, spec, number, ctx, pageW, pageH, dateLabel) {
  const out = ENGINE.render({ slides: [spec] }, { dateLabel: dateLabel, sectionNo: spec.number || null, tokens: ctx.tokens || null })[0];
  try { if (typeof recordSlide_ === 'function') recordSlide_(spec, out, number); } catch (e) {}   // V.1_64: the slide log
  // V.1_64: the deck check in the result: a slide it corrected is counted, a slide it could not correct is named
  try {
    const qa = out.qa || {};
    if ((qa.fixed || []).length) ctx.qaFixed = (ctx.qaFixed || 0) + 1;
    if ((qa.issues || []).length && ctx.log && (ctx.qaNamed = (ctx.qaNamed || 0) + 1) <= 6) {
      ctx.log.push('Deck check: slide ' + number + ' "' + String(spec.title || '').slice(0, 50) + '" still has: ' + qa.issues.map(function (k) { return QA_LABELS_[k] || k; }).join(', ') + '.');
    }
  } catch (e) {}
  const s = safeSize_(pageW, ENGINE.W) / ENGINE.W;

  slide.getPageElements().forEach(function (el) { try { el.remove(); } catch (e) {} });
  ctx.slideIcons = {};
  ctx.slideIconFamilies = {};                                             // V.1_48: one icon of a kind per slide
  // V.1_42: built-in pictures (navy background of the proposal divider) first, then the Drive design assets
  const bgInline = out.bgImage && typeof inlineAssetBlob_ === 'function' ? inlineAssetBlob_(out.bgImage) : null;
  const bgId = out.bgImage && !bgInline ? engineAssetId(out.bgImage, ctx) : null;
  // V.1_44: the photo (dark streaks, navy) is a normal picture behind everything, not the slide background, so it can
  // be selected, replaced (Replace image) or deleted in Slides. The background underneath is the design's solid colour.
  // V.1_45 / V.1_46: a design that shows the photo only in a strip, panel or band gets a picture of exactly that size:
  // a stock image from the brand folder (about 95 slides in 100) or the streak photo cut to it. The slide underneath
  // is pale, so deleting the picture leaves a clean slide. A full-slide photo (dividers) stays the full streak photo.
  const region = out.bgImage === 'section-bg' && typeof photoRegion_ === 'function' ? photoRegion_(out.els, ENGINE.W, ENGINE.H) : null;
  const partial = !!region && !(region[0] <= 1 && region[1] <= 1 && region[2] >= ENGINE.W - 1 && region[3] >= ENGINE.H - 1);
  let stock = null, cut = null;
  if (partial) {
    // V.1_53: a Solution Deck keeps the 66degrees streak photo in every strip (like the solution decks it is built from)
    // V.1_67 (deck 39 Solution 6, 7, 13, 29): the dark streak picture belongs to the transition slides only. A strip, band
    // or panel on a content slide shows a stock photo (every deck type); without one it stays the design's solid Night Blue
    try { stock = typeof pickStockImage_ === 'function' ? pickStockImage_(region, spec, ctx) : null; } catch (e) { stock = null; }
  }
  slide.getBackground().setSolidFill(partial && (stock || cut) ? ENGINE.TOKENS.white : out.bg);
  const photo = partial ? (stock || null) : (bgInline || (bgId ? getBlobCached(bgId, ctx) : null));   // V.1_67: no streak picture behind a strip
  if (photo) {
    try {
      const box = (stock || cut) ? safeBox_(region[0] * s, region[1] * s, (region[2] - region[0]) * s, (region[3] - region[1]) * s)
        : { x: 0, y: 0, w: safeSize_(pageW, ENGINE.W), h: safeSize_(pageH, ENGINE.H) };
      const bgPic = slide.insertImage(photo);
      // exactly the box (insertImage keeps the picture's own shape and would leave bands of background around it)
      bgPic.setLeft(box.x).setTop(box.y).setWidth(box.w).setHeight(box.h);
      // a stock image is cropped to fill the box at its own proportions (never stretched)
      if (stock) { try { bgPic.replace(stock, true); bgPic.setLeft(box.x).setTop(box.y).setWidth(box.w).setHeight(box.h); } catch (err) {} }
      try { bgPic.sendToBack(); } catch (err) {}
      try { bgPic.setDescription(stock ? 'Stock image (replace, crop or delete)' : 'Background photo (replace or delete)'); } catch (err) {}
      // text or the white 66° mark on the photo stays readable on a stock image: a dark veil over the image only
      if (stock && out.els.some(function (e) {
        const cx = (e.t === 'line' ? e.x1 : e.x + (e.w || e.size || 0) / 2), cy = (e.t === 'line' ? e.y1 : e.y + (e.h || e.size || 0) / 2);
        return (e.t === 'text' || (e.t === 'image' && e.asset === 'mark-white')) && cx >= region[0] && cx <= region[2] && cy >= region[1] && cy <= region[3];
      })) {
        const veil = insertShapeSafe_(slide, 'RECTANGLE', box.x, box.y, box.w, box.h);
        veil.getFill().setSolidFill(ENGINE.TOKENS.ink, 0.55);
        veil.getBorder().setTransparent();
      }
    } catch (e) {
      Logger.log('Background photo not placed: ' + e.message);
    }
  }

  const ALIGN = { left: SlidesApp.ParagraphAlignment.START, center: SlidesApp.ParagraphAlignment.CENTER, right: SlidesApp.ParagraphAlignment.END };
  const VALIGN = { top: SlidesApp.ContentAlignment.TOP, middle: SlidesApp.ContentAlignment.MIDDLE, bottom: SlidesApp.ContentAlignment.BOTTOM };
  // V.1_59: a rebrand uses Plus Jakarta Sans only (dates, numbers and labels too)
  // V.1_67 (deck 39: "<1 ms", "10 Gbps", "01" in IBM Plex Mono): Plus Jakarta Sans is the only typeface on every slide;
  // figures and step numbers use its Medium weight (the brand file's second font is not used by the add-on)
  const sans = ctx.brand.fonts.heading.slides, mono = sans;

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
        if (e.dash) { try { ln.setDashStyle(SlidesApp.DashStyle.DASH); } catch (err) {} }          // optional / return flows
        if (e.startArrow) { try { ln.setStartArrow(SlidesApp.ArrowStyle.FILL_ARROW); } catch (err) {} }   // two-way relationship
      } else if (e.t === 'image') {
        const inline = typeof inlineAssetBlob_ === 'function' ? inlineAssetBlob_(e.asset) : null;
        const id = inline ? null : engineAssetId(e.asset, ctx);
        if (inline || id) {
          const box = safeBox_(e.x * s, e.y * s, e.w * s, e.h * s);
          const blob = inline || (e.asset === 'client-logo' && ctx.clientLogoBlob) || getBlobCached(id, ctx);
          if (e.fit === 'contain') insertContainedImage_(slide, blob, box, e, s, ctx);
          else slide.insertImage(blob, box.x, box.y, box.w, box.h);
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
        // V.1_65: a bullet list is one text box with Slides' own bullets; Slides spaces the lines itself (no gaps between
        // bullets when a line wraps differently from the estimate)
        if (e.list) {
          try { tr.getListStyle().applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE); } catch (err) {}
          try {
            const lps = tr.getParagraphStyle();
            lps.setSpaceBelow(finiteNumber_(e.list.gap, 6) * s);
            lps.setIndentStart(finiteNumber_(e.list.indent, 16) * s);
            lps.setIndentFirstLine(0);
          } catch (err) {}
        }
        try { box.setContentAlignment(VALIGN[e.valign] || VALIGN.top); } catch (err) {}
        try { box.getAutofit().disableAutofit(); } catch (err) {}
      }
    } catch (err) {
      Logger.log('Engine element failed (' + e.t + '): ' + err.message);
    }
  });

  if (spec.notes) setSpeakerNotesSafe_(slide, spec.notes);
  // V.1_68: the checker on the real slide - what Google Slides holds after drawing, not the plan of it
  try {
    const real = checkDrawnSlide_(slide, pageW, pageH, ctx);
    if (real.issues.length || real.fixed.length) {
      out.qa = out.qa || { issues: [], fixed: [] };
      real.issues.forEach(function (k) { if (out.qa.issues.indexOf(k) === -1) out.qa.issues.push(k); });
      real.fixed.forEach(function (k) { if (out.qa.fixed.indexOf(k) === -1) out.qa.fixed.push(k); });
      if (typeof USAGE_ !== 'undefined' && USAGE_.slides && USAGE_.slides.length) {
        const row = USAGE_.slides[USAGE_.slides.length - 1];
        row.issues = out.qa.issues.join(','); row.fixed = out.qa.fixed.join(',');
      }
      if (real.issues.length && ctx.log && (ctx.qaNamed = (ctx.qaNamed || 0) + 1) <= 8) {
        ctx.log.push('Deck check: slide ' + number + ' "' + String(spec.title || '').slice(0, 50) + '" has: ' + real.issues.map(function (k) { return QA_LABELS_[k] || k; }).join(', ') + '.');
      }
    }
  } catch (eReal) { Logger.log('Real-slide check skipped: ' + eReal.message); }
}

/* V.1_68 — the checker on the drawn slide (every deck type). It reads back every shape of the slide from Google Slides:
     off-slide   a shape or picture outside the page        -> moved back inside (corrected)
     font        a text in another typeface                 -> set to Plus Jakarta Sans (corrected)
     detached    a text box half across the edge of a filled box it mostly covers (reported)
   Returns { issues: [...], fixed: [...] }. Never throws, never removes anything. */
function checkDrawnSlide_(slide, pageW, pageH, ctx) {
  const res = { issues: [], fixed: [] };
  const add = function (list, k) { if (list.indexOf(k) === -1) list.push(k); };
  let els = [];
  try { els = slide.getPageElements(); } catch (e) { return res; }
  const font = (ctx && ctx.brand && ctx.brand.fonts && ctx.brand.fonts.heading && ctx.brand.fonts.heading.slides) || 'Plus Jakarta Sans';
  const boxes = [], texts = [];
  els.forEach(function (el) {
    let b;
    try { b = { x: el.getLeft(), y: el.getTop(), w: el.getWidth(), h: el.getHeight() }; } catch (e) { return; }
    if (!(b.w > 0 && b.h > 0)) return;
    try {
      if (b.w < pageW - 1 && b.h < pageH - 1 && (b.x < -2 || b.y < -2 || b.x + b.w > pageW + 2 || b.y + b.h > pageH + 2)) {
        const nx = Math.max(0, Math.min(b.x, pageW - b.w)), ny = Math.max(0, Math.min(b.y, pageH - b.h));
        el.setLeft(nx); el.setTop(ny); b.x = nx; b.y = ny;
        add(res.fixed, 'off-slide');
      }
    } catch (e) { add(res.issues, 'off-slide'); }
    let shape = null, txt = '';
    try { if (el.getPageElementType && el.getPageElementType() === SlidesApp.PageElementType.SHAPE) shape = el.asShape(); } catch (e) {}
    if (!shape) return;
    try { txt = shape.getText().asString().trim(); } catch (e) { txt = ''; }
    if (txt) {
      texts.push({ b: b, t: txt });
      try {
        let wrong = false;
        shape.getText().getRuns().forEach(function (r) { const f = r.getTextStyle().getFontFamily(); if (f && f !== font && r.asString().trim()) wrong = true; });
        if (wrong) { shape.getText().getTextStyle().setFontFamily(font); add(res.fixed, 'font'); }
      } catch (e) {}
    }
    try {
      const fill = shape.getFill();
      if (fill && fill.getType && fill.getType() === SlidesApp.FillType.SOLID && b.h >= 24 && b.w >= 40 && b.w < pageW - 2 && b.h < pageH - 2) boxes.push(b);
    } catch (e) {}
  });
  texts.forEach(function (T) {
    const tb = T.b;
    boxes.forEach(function (B) {
      if (B === tb) return;
      const ox = Math.min(tb.x + tb.w, B.x + B.w) - Math.max(tb.x, B.x);
      if (ox < Math.min(tb.w, B.w) * 0.6) return;
      const inner = 6;                                                            // text boxes carry an inner margin
      const top = tb.y + inner, bot = tb.y + tb.h - inner;
      const crossTop = top < B.y - 3 && bot > B.y + 8, crossBot = top < B.y + B.h - 8 && bot > B.y + B.h + 3;
      const onChip = boxes.some(function (C) { return C !== B && tb.x >= C.x - 2 && tb.x + tb.w <= C.x + C.w + 2 && tb.y >= C.y - 2 && tb.y + tb.h <= C.y + C.h + 2; });
      if ((crossTop || crossBot) && !onChip && tb.h < B.h * 1.5) add(res.issues, 'detached');
    });
  });
  return res;
}

function setSpeakerNotesSafe_(slide, notes) {
  try {
    const notesShape = slide.getNotesPage().getSpeakerNotesShape();
    writeTextSafe_(notesShape, notes);
  } catch (e) {}
}

// Engine asset key -> Drive file id (design images in 01_Brand_Assets/03_Images/Design)
// A logo inside its box at its own proportions (never stretched), aligned left / right; optional light tile behind it
function insertContainedImage_(slide, blob, box, e, s, ctx) {
  const img = slide.insertImage(blob);
  const nw = img.getWidth() || 1, nh = img.getHeight() || 1;
  const k = Math.min(box.w / nw, box.h / nh);
  const w = nw * k, h = nh * k;
  const x = e.align === 'right' ? box.x + box.w - w : e.align === 'center' ? box.x + (box.w - w) / 2 : box.x;
  const y = e.valign === 'top' ? box.y : e.valign === 'bottom' ? box.y + box.h - h : box.y + (box.h - h) / 2;
  if (e.tile) {
    const pad = 5 * s;
    let t = null;
    try { t = insertRoundedBox_(slide, x - pad, y - pad, w + 2 * pad, h + 2 * pad, ctx, s); } catch (err) {}
    if (!t) t = insertShapeSafe_(slide, 'RECTANGLE', x - pad, y - pad, w + 2 * pad, h + 2 * pad);
    try { t.getFill().setSolidFill(ENGINE.TOKENS.white); t.getBorder().setTransparent(); } catch (err) {}
  }
  img.setLeft(x).setTop(y).setWidth(w).setHeight(h);
  if (e.tile) { try { img.bringToFront(); } catch (err) {} }
  return img;
}

function engineAssetId(asset, ctx) {
  if (asset === 'client-logo') return (ctx.proposal && ctx.proposal.logoId) || null;
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
      const req = function (c) {
        return resolveIconRequest_({ concept: c, brandColor: e.color || (e.dark ? '#FFFDF9' : '#0052FF'), onDark: !!e.dark, size: Math.max(16, Math.round(size)), style: 'outline' }, ctx);
      };
      let resolved = pre && pre.svg ? pre : req(concept);
      // V.1_48: three light bulbs on one slide (deck 21 slide 4): an icon of a kind already on the slide is replaced by the
      // icon for the item's heading when that one is of another kind
      const fams = ctx.slideIconFamilies || (ctx.slideIconFamilies = {});
      let fam = iconFamily_(resolved);
      if (fam && fams[fam] && e.hint && e.hint !== concept) {
        try {
          const alt = req(e.hint);
          const af = iconFamily_(alt);
          if (alt && alt.ok !== false && af && !fams[af]) { resolved = alt; fam = af; }
        } catch (err) {}
      }
      if (resolved && insertResolvedIcon_(slide, resolved, e.x * s, e.y * s, size, ctx)) {
        if (fam) fams[fam] = true;
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
          ts.setFontFamily(ctx.sansOnly ? ctx.brand.fonts.heading.slides : ctx.brand.fonts.mono.slides).setFontSize(Math.max(9, Math.min(14, Math.round(size * 0.45)))).setForegroundColor(e.dark ? ENGINE.TOKENS.white : ENGINE.TOKENS.blue);
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

// V.1_48: the kind of an icon ("lucide:lightbulb", "mdi:lightbulb-on-outline", "tabler:bulb" -> "bulb")
function iconFamily_(r) {
  if (!r || r.ok === false) return '';
  const id = String(r.iconId || (r.driveMatch && r.driveMatch.key) || r.id || '').toLowerCase().replace(/^[a-z0-9-]+:/, '').replace(/^drive:/, '');
  if (!id) return '';
  const words = id.split(/[^a-z0-9]+/).filter(Boolean).map(function (w) { return /^(light)?bulb$|^idea$/.test(w) ? 'bulb' : w; });
  const strong = words.filter(function (w) { return /^(bulb|gear|cog|globe|chart|graph|users?|people|person|team|shield|lock|cloud|database|server|target|rocket|handshake|dollar|money|clock|calendar|document|file|brain|robot|search|magnifier|truck|box|cart|star|check)$/.test(w); })[0];
  return strong || words[0] || '';
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
