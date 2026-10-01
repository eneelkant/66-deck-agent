/**
 * 66degrees brand system — colors, typography, spacing, and helpers.
 * Keep all palette / font literals here; other modules must call helpers.
 */

var Brand = (function () {
  var COLORS = {
    PRIMARY_BLUE: '#0052FF',
    INK: '#040A1B',
    PANEL: '#F2F7FB',
    PANEL_ALT: '#D1DBDF',
    TITLE: '#000000',
    BODY: '#333333',
    WHITE: '#FFFFFF',
    SUCCESS: '#0B7A45',
    WARNING: '#B35C00',
    DANGER: '#B42318'
  };

  var APPROVED_HEX = [
    COLORS.PRIMARY_BLUE,
    COLORS.INK,
    COLORS.PANEL,
    COLORS.PANEL_ALT,
    COLORS.TITLE,
    COLORS.BODY,
    COLORS.WHITE,
    COLORS.SUCCESS,
    COLORS.WARNING,
    COLORS.DANGER
  ];

  var FONTS = {
    TITLE: 'Plus Jakarta Sans',
    BODY: 'Plus Jakarta Sans',
    KPI: 'IBM Plex Mono',
    FALLBACK_TITLE: 'Arial',
    FALLBACK_BODY: 'Arial',
    FALLBACK_KPI: 'Courier New'
  };

  var TYPE = {
    TITLE_PT: 20,
    SUBTITLE_PT: 14,
    BODY_PT: 12,
    KPI_PT: 28,
    METRIC_LABEL_PT: 11,
    FOOTER_PT: 9,
    CARD_TITLE_PT: 14
  };

  var SPACE = {
    MARGIN_LEFT: 36,
    MARGIN_RIGHT: 36,
    MARGIN_TOP: 28,
    MARGIN_BOTTOM: 28,
    GAP: 12,
    CARD_RADIUS_HINT: 8,
    SLIDE_WIDTH: 720,
    SLIDE_HEIGHT: 405
  };

  function normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') {
      return COLORS.BODY;
    }
    var value = hex.trim().toUpperCase();
    if (value.charAt(0) !== '#') {
      value = '#' + value;
    }
    if (!/^#[0-9A-F]{6}$/.test(value)) {
      return COLORS.BODY;
    }
    return value;
  }

  function hexToRgb(hex) {
    var h = normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function colorDistance(a, b) {
    var A = hexToRgb(a);
    var B = hexToRgb(b);
    var dr = A.r - B.r;
    var dg = A.g - B.g;
    var db = A.b - B.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function snapToPalette(hex) {
    var target = normalizeHex(hex);
    var best = COLORS.BODY;
    var bestDist = Number.POSITIVE_INFINITY;
    for (var i = 0; i < APPROVED_HEX.length; i++) {
      var candidate = APPROVED_HEX[i];
      var dist = colorDistance(target, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return best;
  }

  function toRgbColor(hex) {
    var rgb = hexToRgb(snapToPalette(hex));
    return {
      red: rgb.r / 255,
      green: rgb.g / 255,
      blue: rgb.b / 255
    };
  }

  function applyFill(shape, hex) {
    shape.getFill().setSolidFill(snapToPalette(hex));
  }

  function applyTextStyle(textRange, options) {
    options = options || {};
    var style = textRange.getTextStyle();
    var fontFamily = options.fontFamily || FONTS.BODY;
    var fontSize = options.fontSize || TYPE.BODY_PT;
    var color = snapToPalette(options.color || COLORS.BODY);
    var bold = !!options.bold;

    try {
      style.setFontFamily(fontFamily);
    } catch (e) {
      style.setFontFamily(
        fontFamily === FONTS.KPI ? FONTS.FALLBACK_KPI : FONTS.FALLBACK_BODY
      );
    }
    style.setFontSize(fontSize);
    style.setForegroundColor(color);
    style.setBold(bold);
  }

  function setShapeText(shape, text, options) {
    var tr = shape.getText();
    tr.setText(text == null ? '' : String(text));
    applyTextStyle(tr, options);
    if (options && options.align) {
      tr.getParagraphStyle().setParagraphAlignment(options.align);
    }
    return tr;
  }

  function fitTextSize(shape, preferredPt, minPt) {
    preferredPt = preferredPt || TYPE.BODY_PT;
    minPt = minPt || 8;
    var text = shape.getText();
    var style = text.getTextStyle();
    var size = preferredPt;
    style.setFontSize(size);

    // Heuristic wrap/overflow control for Apps Script (no true measure API).
    var content = text.asString() || '';
    var box = shape.getWidth() * shape.getHeight();
    var density = content.length / Math.max(box, 1);
    if (density > 0.012) {
      size = Math.max(minPt, preferredPt - 4);
    } else if (density > 0.008) {
      size = Math.max(minPt, preferredPt - 2);
    }
    style.setFontSize(size);
    return size;
  }

  return {
    COLORS: COLORS,
    FONTS: FONTS,
    TYPE: TYPE,
    SPACE: SPACE,
    APPROVED_HEX: APPROVED_HEX,
    normalizeHex: normalizeHex,
    snapToPalette: snapToPalette,
    toRgbColor: toRgbColor,
    applyFill: applyFill,
    applyTextStyle: applyTextStyle,
    setShapeText: setShapeText,
    fitTextSize: fitTextSize
  };
})();
