/**
 * Native Google Slides rendering primitives and slide composers.
 * Prefer editable shapes/connectors over flattened images.
 */

var EngineRenderer = (function () {
  function createBlankPresentation(title) {
    var presentation = SlidesApp.create(title || '66degrees Deck');
    var slides = presentation.getSlides();
    // Keep first slide; clear later during render.
    return presentation;
  }

  function clearPresentation(presentation) {
    var slides = presentation.getSlides();
    // Leave one slide; remove extras.
    for (var i = slides.length - 1; i > 0; i--) {
      slides[i].remove();
    }
    var first = presentation.getSlides()[0];
    first.getPageElements().forEach(function (el) {
      el.remove();
    });
    return first;
  }

  function addBackground(slide, hex) {
    slide.getBackground().setSolidFill(Brand.snapToPalette(hex || Brand.COLORS.WHITE));
  }

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
    if (value == null) {
      return '';
    }
    return String(value)
      .trim()
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_');
  }

  function resolveShapeTypeKey_(value) {
    var raw = shapeTypeKeyFromValue_(value);
    if (!raw) {
      return 'RECTANGLE';
    }
    var alias = SHAPE_TYPE_ALIASES[raw.toLowerCase()];
    if (alias) {
      return alias;
    }
    var compact = raw.toUpperCase();
    if (VALID_SHAPE_TYPE_KEYS[compact]) {
      return compact;
    }
    return 'RECTANGLE';
  }

  function normalizeShapeType_(value) {
    var key = resolveShapeTypeKey_(value);
    var enumObj = SlidesApp && SlidesApp.ShapeType ? SlidesApp.ShapeType : {};
    var resolved = enumObj[key];
    if (resolved == null) {
      resolved = enumObj.RECTANGLE;
    }
    if (resolved == null) {
      return 'RECTANGLE';
    }
    return resolved;
  }

  function insertShapeSafe_(slide, typeValue, x, y, w, h) {
    return slide.insertShape(normalizeShapeType_(typeValue), x, y, w, h);
  }

  function addRect(slide, x, y, w, h, fillHex) {
    var shape = insertShapeSafe_(slide, 'rect', x, y, w, h);
    shape.getBorder().setTransparent();
    Brand.applyFill(shape, fillHex || Brand.COLORS.PANEL);
    return shape;
  }

  function addRoundRect(slide, x, y, w, h, fillHex) {
    var shape = insertShapeSafe_(slide, 'roundrect', x, y, w, h);
    shape.getBorder().setTransparent();
    Brand.applyFill(shape, fillHex || Brand.COLORS.PANEL);
    return shape;
  }

  function addTextBox(slide, text, x, y, w, h, options) {
    var shape = slide.insertTextBox(String(text || ''), x, y, w, h);
    Brand.setShapeText(shape, text, options || {});
    Brand.fitTextSize(shape, (options && options.fontSize) || Brand.TYPE.BODY_PT, 8);
    return shape;
  }

  function addTitle(slide, text, y) {
    return addTextBox(
      slide,
      text,
      Brand.SPACE.MARGIN_LEFT,
      y == null ? Brand.SPACE.MARGIN_TOP : y,
      Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT,
      36,
      {
        fontFamily: Brand.FONTS.TITLE,
        fontSize: Brand.TYPE.TITLE_PT,
        color: Brand.COLORS.TITLE,
        bold: true
      }
    );
  }

  function addSubtitle(slide, text, y) {
    return addTextBox(
      slide,
      text,
      Brand.SPACE.MARGIN_LEFT,
      y,
      Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT,
      24,
      {
        fontFamily: Brand.FONTS.BODY,
        fontSize: Brand.TYPE.SUBTITLE_PT,
        color: Brand.COLORS.BODY
      }
    );
  }

  function addFooter(slide, text) {
    addRect(
      slide,
      0,
      Brand.SPACE.SLIDE_HEIGHT - 22,
      Brand.SPACE.SLIDE_WIDTH,
      22,
      Brand.COLORS.PANEL
    );
    return addTextBox(
      slide,
      text || '66degrees',
      Brand.SPACE.MARGIN_LEFT,
      Brand.SPACE.SLIDE_HEIGHT - 20,
      300,
      16,
      {
        fontFamily: Brand.FONTS.BODY,
        fontSize: Brand.TYPE.FOOTER_PT,
        color: Brand.COLORS.INK
      }
    );
  }

  function addAccentBar(slide) {
    return addRect(slide, 0, 0, Brand.SPACE.SLIDE_WIDTH, 6, Brand.COLORS.PRIMARY_BLUE);
  }

  function renderCard(slide, x, y, w, h, title, body) {
    var card = addRoundRect(slide, x, y, w, h, Brand.COLORS.PANEL);
    addRect(slide, x, y, 4, h, Brand.COLORS.PRIMARY_BLUE);
    addTextBox(slide, title, x + 14, y + 10, w - 24, 22, {
      fontFamily: Brand.FONTS.TITLE,
      fontSize: Brand.TYPE.CARD_TITLE_PT,
      color: Brand.COLORS.TITLE,
      bold: true
    });
    addTextBox(slide, body, x + 14, y + 36, w - 24, h - 48, {
      fontFamily: Brand.FONTS.BODY,
      fontSize: Brand.TYPE.BODY_PT,
      color: Brand.COLORS.BODY
    });
    return card;
  }

  function renderMetric(slide, x, y, w, h, value, label, trend) {
    var card = addRoundRect(slide, x, y, w, h, Brand.COLORS.PANEL);
    addTextBox(slide, value, x + 12, y + 16, w - 24, 40, {
      fontFamily: Brand.FONTS.KPI,
      fontSize: Brand.TYPE.KPI_PT,
      color: Brand.COLORS.PRIMARY_BLUE,
      bold: true
    });
    addTextBox(slide, label, x + 12, y + 60, w - 24, 20, {
      fontFamily: Brand.FONTS.BODY,
      fontSize: Brand.TYPE.METRIC_LABEL_PT,
      color: Brand.COLORS.BODY
    });
    if (trend) {
      var pill = addRoundRect(slide, x + 12, y + h - 32, Math.min(90, w - 24), 18, Brand.COLORS.PANEL_ALT);
      Brand.setShapeText(pill, trend, {
        fontFamily: Brand.FONTS.KPI,
        fontSize: 9,
        color: Brand.COLORS.INK,
        bold: true
      });
    }
    return card;
  }

  function renderProcessNodes(slide, steps, y) {
    steps = steps || [];
    if (!steps.length) {
      return;
    }
    var margin = Brand.SPACE.MARGIN_LEFT;
    var usable = Brand.SPACE.SLIDE_WIDTH - margin - Brand.SPACE.MARGIN_RIGHT;
    var gap = 16;
    var nodeW = Math.min(140, (usable - gap * (steps.length - 1)) / steps.length);
    var nodeH = 64;
    var totalW = steps.length * nodeW + (steps.length - 1) * gap;
    var startX = margin + Math.max(0, (usable - totalW) / 2);

    for (var i = 0; i < steps.length; i++) {
      var x = startX + i * (nodeW + gap);
      var node = addRoundRect(slide, x, y, nodeW, nodeH, Brand.COLORS.PANEL);
      Brand.setShapeText(node, steps[i], {
        fontFamily: Brand.FONTS.BODY,
        fontSize: 11,
        color: Brand.COLORS.TITLE,
        bold: true,
        align: SlidesApp.ParagraphAlignment.CENTER
      });
      if (i < steps.length - 1) {
        var line = slide.insertLine(
          SlidesApp.LineCategory.STRAIGHT,
          x + nodeW,
          y + nodeH / 2,
          x + nodeW + gap,
          y + nodeH / 2
        );
        line.getLineFill().setSolidFill(Brand.COLORS.PRIMARY_BLUE);
        line.setWeight(1.5);
      }
    }
  }

  function nodeShapeType(nodeType) {
    switch (String(nodeType || 'process').toLowerCase()) {
      case 'decision':
        return 'diamond';
      case 'start':
      case 'end':
        return 'ellipse';
      default:
        return 'roundrect';
    }
  }

  function layoutDiagramPositions(diagram, area) {
    var nodes = diagram.nodes || [];
    var direction = diagram.direction === 'TB' ? 'TB' : 'LR';
    var positions = {};
    var count = Math.max(nodes.length, 1);
    var gapX = 24;
    var gapY = 28;
    var nodeW = direction === 'LR' ? Math.min(130, (area.w - gapX * (count - 1)) / count) : 150;
    var nodeH = 48;

    if (direction === 'LR') {
      var totalW = count * nodeW + (count - 1) * gapX;
      var startX = area.x + Math.max(0, (area.w - totalW) / 2);
      var y = area.y + Math.max(0, (area.h - nodeH) / 2);
      for (var i = 0; i < nodes.length; i++) {
        positions[nodes[i].id] = {
          x: startX + i * (nodeW + gapX),
          y: y,
          w: nodeW,
          h: nodeH
        };
      }
    } else {
      var totalH = count * nodeH + (count - 1) * gapY;
      var startY = area.y + Math.max(0, (area.h - totalH) / 2);
      var x = area.x + Math.max(0, (area.w - nodeW) / 2);
      for (var j = 0; j < nodes.length; j++) {
        positions[nodes[j].id] = {
          x: x,
          y: startY + j * (nodeH + gapY),
          w: nodeW,
          h: nodeH
        };
      }
    }
    return positions;
  }

  function renderDiagram(slide, diagram, area) {
    if (!diagram || !diagram.nodes || !diagram.nodes.length) {
      return;
    }
    area = area || {
      x: Brand.SPACE.MARGIN_LEFT,
      y: 80,
      w: Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT,
      h: 260
    };

    var positions = layoutDiagramPositions(diagram, area);
    var shapeById = {};

    for (var i = 0; i < diagram.nodes.length; i++) {
      var node = diagram.nodes[i];
      var pos = positions[node.id];
      var shape = insertShapeSafe_(slide, nodeShapeType(node.type), pos.x, pos.y, pos.w, pos.h);
      shape.getBorder().setTransparent();
      var fill =
        node.type === 'decision'
          ? Brand.COLORS.PANEL_ALT
          : node.type === 'start' || node.type === 'end'
            ? Brand.COLORS.PRIMARY_BLUE
            : Brand.COLORS.PANEL;
      Brand.applyFill(shape, fill);
      Brand.setShapeText(shape, node.label, {
        fontFamily: Brand.FONTS.BODY,
        fontSize: 11,
        color:
          node.type === 'start' || node.type === 'end'
            ? Brand.COLORS.WHITE
            : Brand.COLORS.TITLE,
        bold: true,
        align: SlidesApp.ParagraphAlignment.CENTER
      });
      shapeById[node.id] = { shape: shape, pos: pos };
    }

    var edges = diagram.edges || [];
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      var from = shapeById[edge.from];
      var to = shapeById[edge.to];
      if (!from || !to) {
        continue;
      }
      var x1 = from.pos.x + from.pos.w;
      var y1 = from.pos.y + from.pos.h / 2;
      var x2 = to.pos.x;
      var y2 = to.pos.y + to.pos.h / 2;
      if (diagram.direction === 'TB') {
        x1 = from.pos.x + from.pos.w / 2;
        y1 = from.pos.y + from.pos.h;
        x2 = to.pos.x + to.pos.w / 2;
        y2 = to.pos.y;
      }
      var connector = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y1, x2, y2);
      connector.getLineFill().setSolidFill(Brand.COLORS.PRIMARY_BLUE);
      connector.setWeight(1.5);
      connector.setEndArrow(SlidesApp.ArrowStyle.FILL_ARROW);
      if (edge.label) {
        addTextBox(
          slide,
          edge.label,
          (x1 + x2) / 2 - 30,
          (y1 + y2) / 2 - 10,
          60,
          16,
          {
            fontFamily: Brand.FONTS.BODY,
            fontSize: 9,
            color: Brand.COLORS.INK
          }
        );
      }
    }
  }

  function renderTimeline(slide, items, y) {
    items = items || [];
    if (!items.length) {
      return;
    }
    var margin = Brand.SPACE.MARGIN_LEFT;
    var usable = Brand.SPACE.SLIDE_WIDTH - margin - Brand.SPACE.MARGIN_RIGHT;
    var line = slide.insertLine(
      SlidesApp.LineCategory.STRAIGHT,
      margin,
      y + 20,
      margin + usable,
      y + 20
    );
    line.getLineFill().setSolidFill(Brand.COLORS.PRIMARY_BLUE);
    line.setWeight(2);

    var step = usable / Math.max(items.length - 1, 1);
    for (var i = 0; i < items.length; i++) {
      var x = margin + i * step;
      var dot = insertShapeSafe_(slide, 'ellipse', x - 6, y + 14, 12, 12);
      Brand.applyFill(dot, Brand.COLORS.PRIMARY_BLUE);
      dot.getBorder().setTransparent();
      addTextBox(slide, items[i], x - 50, y + 36, 100, 48, {
        fontFamily: Brand.FONTS.BODY,
        fontSize: 10,
        color: Brand.COLORS.BODY,
        align: SlidesApp.ParagraphAlignment.CENTER
      });
    }
  }

  function renderComparison(slide, left, right, y) {
    var gap = Brand.SPACE.GAP;
    var usable = Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT;
    var colW = (usable - gap) / 2;
    renderCard(
      slide,
      Brand.SPACE.MARGIN_LEFT,
      y,
      colW,
      220,
      left.title || 'Option A',
      left.body || ''
    );
    renderCard(
      slide,
      Brand.SPACE.MARGIN_LEFT + colW + gap,
      y,
      colW,
      220,
      right.title || 'Option B',
      right.body || ''
    );
  }

  function renderTable(slide, columns, rows, x, y, w, h) {
    columns = columns || [];
    rows = rows || [];
    var colCount = Math.max(columns.length, 1);
    var rowCount = Math.max(rows.length + 1, 2);
    var table = slide.insertTable(rowCount, colCount, x, y, w, h);
    for (var c = 0; c < colCount; c++) {
      var cell = table.getCell(0, c);
      cell.getText().setText(String(columns[c] || ''));
      Brand.applyTextStyle(cell.getText(), {
        fontFamily: Brand.FONTS.TITLE,
        fontSize: 11,
        color: Brand.COLORS.WHITE,
        bold: true
      });
      cell.getFill().setSolidFill(Brand.COLORS.PRIMARY_BLUE);
    }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || [];
      for (var c2 = 0; c2 < colCount; c2++) {
        var bodyCell = table.getCell(r + 1, c2);
        bodyCell.getText().setText(String(row[c2] != null ? row[c2] : ''));
        Brand.applyTextStyle(bodyCell.getText(), {
          fontFamily: Brand.FONTS.BODY,
          fontSize: 10,
          color: Brand.COLORS.BODY
        });
        bodyCell
          .getFill()
          .setSolidFill(r % 2 === 0 ? Brand.COLORS.PANEL : Brand.COLORS.WHITE);
      }
    }
    return table;
  }

  function elementsToSteps(elements) {
    return (elements || [])
      .map(function (el) {
        return el.title || el.label || el.body || el.value;
      })
      .filter(Boolean);
  }

  function renderCover(slide, slideSpec, presentationTitle) {
    addBackground(slide, Brand.COLORS.INK);
    addRect(slide, 0, 0, 12, Brand.SPACE.SLIDE_HEIGHT, Brand.COLORS.PRIMARY_BLUE);
    addTextBox(slide, '66degrees', Brand.SPACE.MARGIN_LEFT, 48, 300, 24, {
      fontFamily: Brand.FONTS.TITLE,
      fontSize: 14,
      color: Brand.COLORS.PRIMARY_BLUE,
      bold: true
    });
    addTextBox(
      slide,
      slideSpec.title || presentationTitle,
      Brand.SPACE.MARGIN_LEFT,
      120,
      560,
      60,
      {
        fontFamily: Brand.FONTS.TITLE,
        fontSize: 28,
        color: Brand.COLORS.WHITE,
        bold: true
      }
    );
    if (slideSpec.subtitle) {
      addTextBox(slide, slideSpec.subtitle, Brand.SPACE.MARGIN_LEFT, 190, 520, 40, {
        fontFamily: Brand.FONTS.BODY,
        fontSize: 14,
        color: Brand.COLORS.PANEL_ALT
      });
    }
  }

  function renderClosing(slide, slideSpec) {
    addBackground(slide, Brand.COLORS.WHITE);
    addAccentBar(slide);
    addTitle(slide, slideSpec.title || 'Next steps');
    var items = elementsToSteps(slideSpec.elements);
    if (!items.length && slideSpec.body) {
      items = String(slideSpec.body).split(/\n|•/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
    }
    for (var i = 0; i < Math.min(items.length, 5); i++) {
      renderCard(
        slide,
        Brand.SPACE.MARGIN_LEFT,
        70 + i * 54,
        Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT,
        48,
        String(i + 1).padStart ? String(i + 1).padStart(2, '0') : String(i + 1),
        items[i]
      );
    }
    addFooter(slide, '66degrees · Let\'s build what\'s next');
  }

  function renderGenericContent(slide, slideSpec) {
    addBackground(slide, Brand.COLORS.WHITE);
    addAccentBar(slide);
    addTitle(slide, slideSpec.title);
    if (slideSpec.subtitle) {
      addSubtitle(slide, slideSpec.subtitle, 58);
    }
    var bodyY = slideSpec.subtitle ? 90 : 70;
    if (slideSpec.body) {
      addTextBox(
        slide,
        slideSpec.body,
        Brand.SPACE.MARGIN_LEFT,
        bodyY,
        Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT,
        250,
        {
          fontFamily: Brand.FONTS.BODY,
          fontSize: Brand.TYPE.BODY_PT,
          color: Brand.COLORS.BODY
        }
      );
    }
    addFooter(slide);
  }

  function renderSlide(slide, slideSpec, context) {
    context = context || {};
    var layoutId = slideSpec.layoutId || '';
    var category = slideSpec.category || 'content';

    if (category === 'cover' || layoutId === 'ref_cover_hero') {
      renderCover(slide, slideSpec, context.title);
      return;
    }
    if (category === 'closing' || layoutId === 'ref_closing') {
      renderClosing(slide, slideSpec);
      return;
    }

    addBackground(slide, Brand.COLORS.WHITE);
    addAccentBar(slide);
    addTitle(slide, slideSpec.title);
    if (slideSpec.subtitle) {
      addSubtitle(slide, slideSpec.subtitle, 58);
    }

    var contentY = slideSpec.subtitle ? 90 : 70;
    var usableW =
      Brand.SPACE.SLIDE_WIDTH - Brand.SPACE.MARGIN_LEFT - Brand.SPACE.MARGIN_RIGHT;

    if (category === 'section' || layoutId === 'ref_section_band') {
      addRect(slide, 0, 150, Brand.SPACE.SLIDE_WIDTH, 100, Brand.COLORS.PANEL);
      addTextBox(slide, slideSpec.body || slideSpec.subtitle || '', 48, 175, 620, 50, {
        fontFamily: Brand.FONTS.TITLE,
        fontSize: 18,
        color: Brand.COLORS.INK,
        bold: true
      });
      addFooter(slide);
      return;
    }

    if (category === 'kpi' || layoutId === 'ref_kpi_2x2') {
      var metrics = (slideSpec.elements || []).filter(function (el) {
        return el.type === 'KPI' || el.type === 'metric';
      });
      if (!metrics.length) {
        metrics = (slideSpec.elements || []).slice(0, 4);
      }
      while (metrics.length < 4) {
        metrics.push({ value: '—', label: 'Metric', trend: '' });
      }
      var cellW = (usableW - Brand.SPACE.GAP) / 2;
      var cellH = 110;
      for (var m = 0; m < 4; m++) {
        var col = m % 2;
        var row = Math.floor(m / 2);
        renderMetric(
          slide,
          Brand.SPACE.MARGIN_LEFT + col * (cellW + Brand.SPACE.GAP),
          contentY + row * (cellH + Brand.SPACE.GAP),
          cellW,
          cellH,
          metrics[m].value || metrics[m].title || '0',
          metrics[m].label || metrics[m].body || 'KPI',
          metrics[m].trend || ''
        );
      }
      addFooter(slide);
      return;
    }

    if (category === 'cards' || layoutId.indexOf('ref_cards') === 0) {
      var cards = slideSpec.elements || [];
      var n = Math.min(Math.max(cards.length, 3), 4);
      var gap = Brand.SPACE.GAP;
      var cardW = (usableW - gap * (n - 1)) / n;
      for (var c = 0; c < n; c++) {
        var card = cards[c] || { title: 'Point ' + (c + 1), body: '' };
        renderCard(
          slide,
          Brand.SPACE.MARGIN_LEFT + c * (cardW + gap),
          contentY,
          cardW,
          220,
          card.title || card.label || 'Card',
          card.body || ''
        );
      }
      addFooter(slide);
      return;
    }

    if (category === 'process' || layoutId === 'ref_process_h') {
      renderProcessNodes(slide, elementsToSteps(slideSpec.elements), contentY + 40);
      addFooter(slide);
      return;
    }

    if (
      category === 'flowchart' ||
      category === 'architecture' ||
      layoutId === 'ref_flowchart_lr' ||
      layoutId === 'ref_architecture'
    ) {
      if (slideSpec.diagram) {
        renderDiagram(slide, slideSpec.diagram, {
          x: Brand.SPACE.MARGIN_LEFT,
          y: contentY,
          w: usableW,
          h: 250
        });
      } else {
        renderProcessNodes(slide, elementsToSteps(slideSpec.elements), contentY + 40);
      }
      addFooter(slide);
      return;
    }

    if (category === 'comparison' || layoutId === 'ref_comparison_2') {
      var left = (slideSpec.elements && slideSpec.elements[0]) || {
        title: 'Current',
        body: slideSpec.body
      };
      var right = (slideSpec.elements && slideSpec.elements[1]) || {
        title: 'Proposed',
        body: ''
      };
      renderComparison(slide, left, right, contentY);
      addFooter(slide);
      return;
    }

    if (category === 'timeline' || layoutId === 'ref_timeline_h') {
      renderTimeline(slide, elementsToSteps(slideSpec.elements), contentY + 40);
      addFooter(slide);
      return;
    }

    if (category === 'table' || layoutId === 'ref_table') {
      var tableEl =
        (slideSpec.elements || []).filter(function (el) {
          return el.type === 'table';
        })[0] || {};
      renderTable(
        slide,
        tableEl.columns && tableEl.columns.length ? tableEl.columns : ['Item', 'Detail'],
        tableEl.rows && tableEl.rows.length
          ? tableEl.rows
          : (slideSpec.elements || []).slice(0, 5).map(function (el) {
              return [el.title || el.label || '', el.body || el.value || ''];
            }),
        Brand.SPACE.MARGIN_LEFT,
        contentY,
        usableW,
        220
      );
      addFooter(slide);
      return;
    }

    if (category === 'quote' || layoutId === 'ref_quote') {
      addRoundRect(
        slide,
        Brand.SPACE.MARGIN_LEFT,
        contentY,
        usableW,
        180,
        Brand.COLORS.PANEL
      );
      addTextBox(
        slide,
        '“' + (slideSpec.body || (slideSpec.elements[0] && slideSpec.elements[0].body) || '') + '”',
        Brand.SPACE.MARGIN_LEFT + 24,
        contentY + 30,
        usableW - 48,
        100,
        {
          fontFamily: Brand.FONTS.TITLE,
          fontSize: 16,
          color: Brand.COLORS.INK,
          bold: true
        }
      );
      addFooter(slide);
      return;
    }

    // Agenda / default content
    var bullets = elementsToSteps(slideSpec.elements);
    if (!bullets.length && slideSpec.body) {
      bullets = String(slideSpec.body)
        .split(/\n|•|-/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }
    for (var b = 0; b < Math.min(bullets.length, 6); b++) {
      addTextBox(
        slide,
        '•  ' + bullets[b],
        Brand.SPACE.MARGIN_LEFT,
        contentY + b * 28,
        usableW,
        24,
        {
          fontFamily: Brand.FONTS.BODY,
          fontSize: Brand.TYPE.BODY_PT,
          color: Brand.COLORS.BODY
        }
      );
    }
    addFooter(slide);
  }

  function renderPresentation(spec) {
    var title = (spec.metadata && spec.metadata.title) || '66degrees Presentation';
    var presentation = createBlankPresentation(title);
    var first = clearPresentation(presentation);

    for (var i = 0; i < spec.slides.length; i++) {
      var slide = i === 0 ? first : presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
      // Ensure blank canvas
      slide.getPageElements().forEach(function (el) {
        el.remove();
      });
      renderSlide(slide, spec.slides[i], { title: title });
      if (spec.slides[i].speakerNotes) {
        slide.getNotesPage().getSpeakerNotesShape().getText().setText(spec.slides[i].speakerNotes);
      }
    }

    return {
      presentationId: presentation.getId(),
      url: presentation.getUrl(),
      slideCount: spec.slides.length
    };
  }

  return {
    createBlankPresentation: createBlankPresentation,
    renderPresentation: renderPresentation,
    renderSlide: renderSlide,
    renderDiagram: renderDiagram,
    renderCard: renderCard,
    renderMetric: renderMetric,
    renderProcessNodes: renderProcessNodes,
    renderTimeline: renderTimeline,
    renderTable: renderTable,
    addTitle: addTitle,
    addFooter: addFooter,
    addAccentBar: addAccentBar,
    normalizeShapeType: normalizeShapeType_
  };
})();
