/**
 * 66degrees Slide Engine — 66degrees Presentation Template 2026 standard
 * Turns content specs into exact slide elements that follow the 2026 template (reference library tags in comments):
 * top-left SemiBold titles, flat #F3F2F0 panel cards with mono numerals, blue-header tables, KPI cards with IBM Plex Mono
 * numbers, blue-ramp process tiles, blue/slate two-column panels, template cover / agenda / section / closing, 66° footer mark.
 * Design tokens can be replaced at run time (render(deck, { tokens })) from the reference library.
 * Pure JavaScript: runs in Apps Script (EngineRenderer.gs) and in Node for previews.
 * Canvas: 720 x 405 pt.
 */

var ENGINE = (function () {

  /* ---------------- iPAY design tokens ---------------- */
  var T = {
    // 66degrees Brand Guidelines 2026 (replaced at run time by the same values from Reference.gs libraryTokens)
    white: '#FFFDF9',        // 66° White (natural paper)
    bgLight: '#F3F2F0',      // neutral tone - panels and cards
    ink: '#040A1B',          // Night Blue - all text
    title: '#040A1B',
    body: '#040A1B',
    blue: '#0052FF',         // 66° Blue - accent only
    navy: '#0052FF',
    slate: '#B3C5D0',        // Shark Grey
    slateLight: '#B3C5D0',
    panelAlt: '#ECECEC',     // neutral tone - callouts
    cardLine: '#DBDDE1',     // neutral tone - lines
    tileBlue: '#F3F2F0',
    tileGrey: '#ECECEC',
    boxFill: '#F3F2F0',
    boxLine: '#DBDDE1',
    connector: '#0052FF',
    ramp: ['#0052FF', '#0052FF', '#0052FF', '#0052FF', '#0052FF', '#0052FF'],
    tints: ['#0052FF', '#0052FF', '#0052FF', '#B3C5D0', '#ECECEC'],
    barMuted: '#B3C5D0',
    green: '#0052FF', orange: '#B3C5D0', red: '#040A1B',
    badge: '#040A1B',
    depth: '#0052FF'
  };
  var BRAND = { bg: T.white, ink: T.ink, blue: T.blue, white: T.white };

  var W = 720, H = 405;
  var X0 = 32;                 // left edge of titles, eyebrows and content (one edge on every slide)
  var CX = 32, CW = W - 64;    // content area
  var INSET = 7.2;
  var LINE = { sans: 1.26, mono: 1.3 };
  var SPACING = 1.1;
  var BOTTOM = 362;            // content must end above the footer mark

  // Template type scale for text inside boxes (pt): body 10, box headings 11, on every slide. Text that would not
  // fit is rewritten shorter by the fit check (Code.gs); the type never goes below 10pt.
  var TYPE_STEPS = [{ body: 10, heading: 11 }];
  var TSZ = { body: 10, heading: 11 };
  var AUDIT = null;            // measurement of every text box while a slide is laid out (see measure())

  /* ---------------- Glyph widths ---------------- */
  var WIDTHS = {"sans400":{"b":[170,282,395,790,646,974,734,245,295,295,479,606,270,498,286,429,732,371,600,609,630,616,597,543,628,597,286,306,606,606,606,499,929,652,693,781,742,612,581,821,736,256,383,654,531,836,736,878,643,878,641,646,512,700,652,984,597,623,584,315,429,315,606,598,352,572,667,600,667,615,393,662,573,229,229,548,229,908,573,655,667,667,338,509,388,573,517,797,487,536,449,317,300,317,606],"x":{"–":568,"—":898,"’":270,"‘":270,"“":420,"”":420,"•":536,"é":615,"°":482,"…":686,"×":606,"→":714}},"sans500":{"b":[173,312,429,832,646,998,754,267,323,323,499,624,299,532,317,455,724,382,599,610,638,616,599,548,629,599,317,337,624,624,624,527,928,672,692,779,741,606,583,817,735,264,386,662,535,855,738,878,645,878,648,646,522,706,667,996,618,635,580,349,455,349,624,620,362,575,669,603,669,614,397,659,580,237,237,558,237,913,580,654,669,669,350,511,396,580,533,826,511,553,460,344,332,344,624],"x":{"–":597,"—":927,"’":299,"‘":299,"“":467,"”":467,"•":577,"é":614,"°":500,"…":717,"×":624,"→":736}},"sans600":{"b":[175,341,464,873,647,1022,774,289,351,351,520,642,328,566,347,481,716,392,598,611,646,615,601,554,631,601,347,367,642,642,642,555,928,692,692,777,741,601,584,813,734,272,390,671,539,874,739,878,646,878,654,647,532,712,682,1008,640,648,576,382,481,382,642,641,372,578,670,606,670,613,402,655,586,245,245,567,245,919,586,653,670,670,362,512,405,586,550,855,535,569,471,371,363,371,642],"x":{"–":626,"—":956,"’":328,"‘":328,"“":513,"”":513,"•":617,"é":613,"°":517,"…":747,"×":642,"→":757}},"sans700":{"b":[178,371,498,915,647,1046,793,311,379,379,540,660,357,600,378,506,708,403,597,611,654,615,602,559,632,602,378,398,660,660,660,583,927,712,691,774,740,595,586,808,733,279,393,679,543,893,741,878,648,878,661,647,542,718,697,1020,661,660,571,416,506,416,660,663,381,580,672,608,672,612,406,652,593,252,252,577,252,924,593,652,672,672,374,514,413,593,566,883,558,586,481,398,395,398,660],"x":{"–":655,"—":985,"’":357,"‘":357,"“":560,"”":560,"•":658,"é":612,"°":535,"…":778,"×":660,"→":779}},"mono400":{"b":[600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600],"x":{"–":600,"—":600,"’":600,"‘":600,"“":600,"”":600,"•":600,"é":600,"°":600,"…":600,"×":600,"→":600,"✓":600}},"mono500":{"b":[600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600],"x":{"–":600,"—":600,"’":600,"‘":600,"“":600,"”":600,"•":600,"é":600,"°":600,"…":600,"×":600,"→":600,"✓":600}}};

  function glyphTable(font, weight) {
    if (font === 'mono') return WIDTHS[weight >= 500 ? 'mono500' : 'mono400'];
    if (weight >= 700) return WIDTHS.sans700;
    if (weight >= 600) return WIDTHS.sans600;
    if (weight >= 500) return WIDTHS.sans500;
    return WIDTHS.sans400;
  }
  function textWidth(text, font, weight, size) {
    var t = glyphTable(font, weight), sum = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      sum += (c >= 32 && c <= 126) ? t.b[c - 32] : (t.x[text.charAt(i)] || 600);
    }
    return sum * size / 1000;
  }
  function wrap(text, maxW, font, weight, size) {
    maxW = maxW * 0.94;                              // safety margin: Google Slides sets Plus Jakarta Sans wider than the metrics
    var lines = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(function (w) { return w.length; });
      if (!words.length) { lines.push(''); return; }
      var line = '';
      words.forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (textWidth(test, font, weight, size) <= maxW) { line = test; return; }
        if (line) lines.push(line);
        while (textWidth(word, font, weight, size) > maxW && word.length > 1) {
          var k = word.length - 1;
          while (k > 1 && textWidth(word.slice(0, k), font, weight, size) > maxW) k--;
          lines.push(word.slice(0, k));
          word = word.slice(k);
        }
        line = word;
      });
      lines.push(line);
    });
    return lines;
  }
  function lineHeight(font, size) { return size * LINE[font] * SPACING; }
  function fit(text, w, h, spec) {
    var font = spec.font || 'sans', weight = Math.min(spec.weight || 400, 500), maxLines = spec.maxLines || 99;
    for (var size = spec.max; size >= spec.min; size -= 0.5) {
      var lines = wrap(text, w, font, weight, size);
      var height = lines.length * lineHeight(font, size);
      // a single line always fits its box; otherwise allow a 2pt tolerance for rounding
      if (lines.length <= maxLines && (lines.length === 1 || height <= h + 2)) return { size: size, lines: lines, height: height, text: text };
    }
    var sz = spec.min;
    var cap = Math.max(1, Math.min(maxLines, Math.floor((h + 2) / lineHeight(font, sz))));
    var all = wrap(text, w, font, weight, sz);
    var kept = all.slice(0, cap);
    if (all.length > cap) {
      var joined = kept.join(' ');
      var endAt = Math.max(joined.lastIndexOf('. '), joined.lastIndexOf('; '));
      if (endAt > joined.length * 0.5) {
        kept = wrap(joined.slice(0, endAt + 1), w, font, weight, sz);      // last complete sentence
      } else {
        var last = kept[cap - 1];
        while (last.length && textWidth(last + '…', font, weight, sz) > w) last = last.slice(0, -1);
        kept[cap - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
      }
    }
    return { size: sz, lines: kept, height: kept.length * lineHeight(font, sz), text: kept.join('\n'), truncated: true };
  }

  // Fit-check record: does the text fit its box, and how full is the box? maxChars = what really fits (by words).
  function auditText(raw, str, w, h, spec, f) {
    var font = spec.font || 'sans', weight = spec.weight || 400, size = f.size;
    var lh = lineHeight(font, size);
    var linesCap = Math.max(1, Math.floor((h + 2) / lh));
    if (spec.maxLines) linesCap = Math.min(linesCap, spec.maxLines);
    var words = str.split(/\s+/), lo = 0, hi = words.length;
    while (lo < hi) {                                   // longest word prefix that fits at this size
      var mid = Math.ceil((lo + hi) / 2);
      if (wrap(words.slice(0, mid).join(' '), w, font, weight, size).length <= linesCap) lo = mid; else hi = mid - 1;
    }
    var fitChars = words.slice(0, lo).join(' ').length;
    var fullChars = Math.max(fitChars, Math.floor(linesCap * w / (size * 0.52)));
    var off = spec.auditOffset || 0;                     // text box = fixed lead-in + the measured field
    AUDIT.push({
      text: spec.auditText != null ? spec.auditText : raw, truncated: !!f.truncated,
      maxChars: Math.max(10, (f.truncated ? fitChars : fullChars) - off),
      fill: f.height / Math.max(h, 1), lines: linesCap,
      body: weight === 400 && font !== 'mono' && linesCap >= 4 && !spec.noFill
    });
  }

  /* ---------------- Element builders ---------------- */
  function text(els, x, y, w, h, str, spec) {
    str = String(str == null ? '' : str).trim();
    if (!str) return { height: 0, size: spec.max, width: 0 };
    var raw = str;
    if (spec.caps) str = str.toUpperCase();
    // Brand Guidelines: Regular for body, Medium for titles, headings, labels and numbers; never SemiBold or Bold
    if ((spec.weight || 400) > 500) spec = Object.assign({}, spec, { weight: 500 });
    var f = fit(str, w, h, spec);
    if (AUDIT) auditText(raw, str, w, h, spec, f);
    var fixedBox = spec.valign && spec.valign !== 'top';
    var el = {
      t: 'text', x: x - INSET, y: y - INSET, w: w + INSET * 2, h: (fixedBox ? h : Math.max(f.height, h)) + INSET * 2,
      text: f.text, font: spec.font || 'sans', weight: spec.weight || 400, size: f.size,
      color: spec.color || T.body, align: spec.align || 'left', valign: spec.valign || 'top', spacing: SPACING,
      vh: (fixedBox ? h : f.height) + INSET * 2,         // visible height (for balancing the slide)
      rot: spec.rot || 0
    };
    // styled runs inside one text box (e.g. a blue headline that continues into a normal sentence)
    if (spec.runs) el.runs = spec.runs.filter(function (r) { return r.start < f.text.length; })
      .map(function (r) { return { start: r.start, end: Math.min(r.end, f.text.length), color: r.color, weight: r.weight }; });
    els.push(el);
    var widest = 0;
    f.lines.forEach(function (l) { widest = Math.max(widest, textWidth(l, spec.font || 'sans', spec.weight || 400, f.size)); });
    return { height: f.height, size: f.size, lines: f.lines.length, width: widest };
  }
  function posSize(w, h) {
    var ww = Number(w), hh = Number(h);
    if (!isFinite(ww) || ww < 1) ww = 1;
    if (!isFinite(hh) || hh < 1) hh = 1;
    return { w: ww, h: hh };
  }
  function splitSpace(total, count, gap) {
    var n = Math.max(1, Math.round(Number(count) || 1));
    var g = Number(gap);
    if (!isFinite(g) || g < 0) g = 0;
    var t = Number(total);
    if (!isFinite(t)) t = 1;
    var inner = t - g * (n - 1);
    if (!isFinite(inner) || inner < 1) inner = 1;
    return Math.max(1, inner / n);
  }
  function innerSize(outer, pad) {
    var o = Number(outer), p = Number(pad);
    if (!isFinite(o)) o = 1;
    if (!isFinite(p)) p = 0;
    return Math.max(1, o - p);
  }
  function rect(els, x, y, w, h, fill, line) {
    var d = posSize(w, h);
    var e = { t: 'rect', x: x, y: y, w: d.w, h: d.h, fill: fill };
    if (line) e.line = line;
    els.push(e);
  }
  function roundrect(els, x, y, w, h, fill, line) {
    var d = posSize(w, h);
    els.push({ t: 'roundrect', x: x, y: y, w: d.w, h: d.h, fill: fill, line: line || null });
  }
  function ellipse(els, x, y, w, h, fill) {
    var d = posSize(w, h);
    els.push({ t: 'ellipse', x: x, y: y, w: d.w, h: d.h, fill: fill });
  }
  function line(els, x1, y1, x2, y2, color, width) { els.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, color: color, width: width || 0.75 }); }
  function image(els, asset, x, y, w, h) { els.push({ t: 'image', asset: asset, x: x, y: y, w: w, h: h }); }
  function icon(els, item, x, y, size, onDark, fallback) {
    if (!item || (!item.icon && !item.material)) return;
    els.push({ t: 'icon', name: item.icon || '', material: item.material || '', x: x, y: y, size: size, dark: !!onDark, fallback: fallback || '' });
  }
  function arr(a, max) { return (Array.isArray(a) ? a : []).slice(0, max); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function isLight(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length !== 6) return false;
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
  }
  // Column header: "label — title" only when it fits on one line, otherwise the label alone (never cut off)
  function headerText(side, w) {
    return side.label || side.title || '';      // one short heading per column, never "label — title"
  }
  function onFill(fill) { return isLight(fill) ? T.ink : T.white; }   // readable text color on a fill
  function cardStyleOf(s) { return (s && s.reference && s.reference.cardStyle) || 'panel'; }
  function str(v) { return v == null ? '' : (typeof v === 'string' ? v : (v.title || v.text || '')); }

  function footerMark(els, dark) {
    if (dark) image(els, 'mark-white', 22.3, 367.6, 28.2, 18.8);
    else image(els, 'mark-dark', 22.3, 376.8, 24.3, 16.2);
  }

  // Template content header (66D_PATTERN_001/002): optional mono eyebrow pill, SemiBold 20pt title top-left,
  // 10pt subtitle. Returns content top.
  function header(els, s, opts) {
    // Every content slide: title at the same place (y 24), subtitle below. No eyebrow / grey label bar (strict rule).
    var ty = 24, tw = (opts && opts.maxW) || HEADER_MAX_W || (W - 2 * X0);
    if (AUDIT && s.title && wrap(String(s.title), tw * 0.94, 'sans', 500, 20).length > 1) {
      var per = tw / Math.max(1, textWidth(String(s.title), 'sans', 500, 20) / String(s.title).length);
      AUDIT.push({ text: String(s.title), truncated: true, maxChars: Math.max(28, Math.floor(per * 0.9)), fill: 1, lines: 2, body: false, isTitle: true });
    }
    var t = text(els, X0, ty, tw, 50, s.title || '', { weight: 600, max: 20, min: 15, maxLines: 2, color: T.title || T.ink });
    var y = ty + t.height + 5;
    var lead = s.lead || s.subtitle;
    if (lead) {
      var l = text(els, X0, y, Math.min(tw, W - 2 * X0 - 40), 30, lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.body });
      y += l.height;
    }
    return Math.max(y + 16, 68);
  }

  // Box height follows the content: tall enough for the text plus padding, at least 60% of the free space, never more.
  // Boxes with only 2-3 lines are reported to the fit check, which writes fuller text, so boxes are not left empty.
  function boxH(need, avail) {
    var a = Number(avail), n = Number(need);
    if (!isFinite(a) || a < 1) a = 1;
    if (!isFinite(n) || n < 1) n = 1;
    return Math.min(a, Math.max(n, a * 0.7));                     // V.1_34: boxes reach further down (no empty bottom third)
  }
  var boxH_ = boxH;
  // Cuts a text at the last whole word that fits on one line (no ellipsis; trailing joining words are dropped)
  function oneLine(str, w, size, weight) {
    str = String(str || '');
    if (wrap(str, w, 'sans', weight || 400, size).length <= 1) return str;
    var words = str.split(/\s+/), out = '';
    for (var i = 0; i < words.length; i++) {
      var next = out ? out + ' ' + words[i] : words[i];
      if (wrap(next, w, 'sans', weight || 400, size).length > 1) break;
      out = next;
    }
    return out.replace(/[,;:\-–]+$/, '').replace(/\s+(and|or|with|to|for|of|the|a|an|in|on|by)$/i, '');
  }
  // Limits used by the fit check in Code.gs: titles on one line, agenda descriptions on one line (6% safety margin
  // because Google Slides sets Plus Jakarta Sans a little wider than the measuring table)
  var TITLE_W = (W - 2 * X0) * 0.94, AGENDA_DESC_W = (520 - (X0 + 42)) * 0.94;
  function maxCharsFor(str, w, size, weight) {
    var per = w / Math.max(1, (textWidth(String(str), 'sans', weight || 400, size) / Math.max(1, String(str).length)));
    return Math.max(25, Math.floor(per * 0.95));
  }
  function textH(str, w, size, weight, font) {
    if (!str) return 0;
    if ((weight || 400) > 500) weight = 500;
    return wrap(String(str), w, font || 'sans', weight || 400, size).length * lineHeight(font || 'sans', size);
  }
  function linesBlock(list, w, size, weight, maxLines) {
    var mx = 1;
    if ((weight || 400) > 500) weight = 500;
    list.forEach(function (t) { if (t) mx = Math.max(mx, Math.min(maxLines || 9, wrap(String(t), w, 'sans', weight || 400, size).length)); });
    return mx * lineHeight('sans', size);
  }

  // Template card (reference cardStyle):
  //   panel    66D_UI_CARD_001 — flat #F3F2F0, no border (default); optional IBM Plex Mono numeral left of the heading
  //   elevated 66D_UI_CARD_003 — white card with a thin light border (for #F3F2F0 slide backgrounds)
  //   rule     66D_UI_CARD_004 — flat panel with a 3.5pt blue bar on the left
  function card(els, x, y, w, h, heading, body, item, style, num) {
    style = style || 'panel';
    if (style === 'elevated') rect(els, x, y, w, h, T.white, { color: T.cardLine, width: 0.75 });
    else rect(els, x, y, w, h, T.bgLight);
    if (style === 'rule') rect(els, x, y, 3.5, h, T.blue);
    var iconSize = item && (item.icon || item.material) ? 16 : 0;
    var numW = (!iconSize && num) ? 34 : 0;
    var padL = style === 'rule' ? 16 : 14;
    var hw = w - padL - 12 - numW - (iconSize ? iconSize + 8 : 0);
    // Template cards are top-aligned (66D_UI_CARD_001): heading row at the same height in every card of a row
    var topPad = 12;
    if (numW) text(els, x + padL, y + topPad - 3, numW, 26, num, { font: 'mono', weight: 600, max: 20, min: 16, maxLines: 1, color: T.blue });
    var ht = text(els, x + padL + numW, y + topPad + (numW ? 2 : 0), hw, 36, heading, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
    if (iconSize) icon(els, item, x + w - 12 - iconSize, y + topPad, iconSize, false);
    var by = y + topPad + Math.max(ht.height + (numW ? 2 : 0), numW ? 22 : 0) + 6;
    text(els, x + padL, by, w - padL - 12, Math.max(y + h - by - 12, 20), body, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
  }

  function measureCard(w, h, heading, body) {
    var ht = fit(String(heading || ''), w - 60, 36, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 }).height;
    var bt = fit(String(body || ''), w - 26, h, { weight: 400, max: 10, min: 10 }).height;
    return 12 + Math.max(ht, 22) + 6 + bt + 16;
  }

  // Card body + optional highlight pinned to the bottom of the card (template slide 17: a divider, then a blue
  // SemiBold result line such as "Up to 40% reduction in operating costs"). Fills tall cards with something useful.
  // Extra height a card needs for its highlight line (divider + up to 3 lines), 0 when no card has one
  function hlNeed(items, w, size) {
    if (!(items || []).some(function (i) { return i && i.highlight; })) return 0;
    return Math.min(linesBlock(items.map(function (i) { return i && i.highlight; }), w, size, 500, 3), 3 * lineHeight('sans', size)) + 20;
  }
  function cardBody(els, x, y, w, h, it, size, items) {
    var hl = it && it.highlight ? String(it.highlight).trim() : '';
    var used = 0;
    if (hl) {
      // same highlight height in every card of the slide, so the dividers line up
      var hh = Math.min(linesBlock((items || [it]).map(function (i) { return i && i.highlight; }), w, size, 600, 3), 3 * lineHeight('sans', size));
      var hy = y + h - hh;
      line(els, x, hy - 10, x + w, hy - 10, T.cardLine, 0.75);
      text(els, x, hy, w, hh, hl, { weight: 600, max: size, min: size, maxLines: 3, color: T.blue });
      used = hh + 20;
    }
    text(els, x, y, w, Math.max(h - used, lineHeight('sans', size)), it.text, { weight: 400, max: size, min: size, color: T.body });
  }

  /* ---------------- Layouts ---------------- */
  var L = {};

  // 66D_LAYOUT_COVER_001 (template slide 1)
  L.cover = function (s, ctx) {
    var els = [];
    image(els, 'logo-dark', 19, 20.1, 68.8, 16.2);
    image(els, 'cover-pattern', 560, 10, 92, 72);          // dot/dash texture top-right (skipped if the asset is missing)
    // Title SemiBold 28pt, left-middle; subtitle Medium 12pt below — no accent bar (template)
    var t = text(els, 25.2, 104, 500, 116, s.title, { weight: 600, max: 28, min: 22, maxLines: 3, color: T.title || T.ink, valign: 'bottom' });
    text(els, 25.2, 226, 440, 40, s.subtitle || s.lead, { weight: 500, max: 12, min: 10, maxLines: 2, color: T.body });
    // Footer band, date and 66° badge
    rect(els, 0, 349, W, 56, T.blue);
    image(els, 'band-pattern', 626, 349, 94, 56);
    text(els, 29.5, 368, 220, 16, '>> ' + (ctx.dateLabel || ''), { font: 'mono', weight: 400, max: TSZ.body, min: TSZ.body, color: T.white, maxLines: 1 });
    roundrect(els, 534.7, 318.8, 86.2, 86.2, T.badge, { color: T.white, width: 3 });
    image(els, 'mark-white', 550.3, 343.5, 55, 36.7);
    return { bg: T.white, els: els, noFooter: true };
  };

  // 66D_LAYOUT_AGENDA_002 (template slide 4): numbered rows with square badges, bold topic, one-line description
  // 66D_LAYOUT_AGENDA_002 (template slide 4): numbered rows with square badges. Each topic is the full slide title
  // (never shortened); its description sits under it.
  L.agenda = function (s, ctx) {
    var els = [];
    text(els, X0, 24, 520, 30, s.title || 'Agenda', { weight: 600, max: 20, min: 16, maxLines: 1, color: T.title || T.ink });
    var items = agendaItems(s);
    var n = Math.max(items.length, 1);
    if (n > 8) {
      // Long deck: two columns of numbered topics (the full slide titles), no descriptions, no graphic
      var rows = Math.ceil(n / 2), colGap = 18, colW2 = (W - 2 * X0 - colGap + 8) / 2, top2 = 66, rowH2 = (340 - top2) / rows;
      var tw2 = colW2 - 38;
      // One line per topic: the size steps down (never below 10pt) until every title fits on one line
      var fitsAt = function (sz) { return items.every(function (it) { return wrap(String(it.title), tw2, 'sans', 500, sz).length <= 1; }); };
      var tS = TSZ.heading;
      while (tS > 10 && !fitsAt(tS)) tS -= 0.5;
      var one = fitsAt(tS);
      items.forEach(function (it, i) {
        var col = i < rows ? 0 : 1, r = i < rows ? i : i - rows;
        var x = X0 - 4 + col * (colW2 + colGap), y = top2 + r * rowH2, bh = Math.min(20, rowH2 - 6);
        rect(els, x, y + (rowH2 - 4 - bh) / 2, 30, bh, T.slate);
        text(els, x, y + (rowH2 - 4 - bh) / 2 + (bh - 14) / 2, 30, 14, pad2(it.no || i + 1), { font: 'mono', weight: 500, max: 10, min: 10, align: 'center', maxLines: 1, color: onFill(T.slate) });
        text(els, x + 36, y - 1, tw2, rowH2 - 1, it.title, { weight: 500, max: tS, min: tS, maxLines: one ? 1 : 2, valign: 'middle', color: T.ink });
        if (r < rows - 1 && i < n - 1) line(els, x, y + rowH2 - 1, x + colW2, y + rowH2 - 1, T.cardLine, 0.5);
      });
      agendaBand(els);
      return { bg: T.white, els: els, noFooter: true };
    }
    var top = 76, listEnd = 520, rowH = Math.min(42, (334 - top) / n);
    var tx = X0 + 42, tw = listEnd - tx;
    // Topics are the full slide titles and are never cut: if one does not fit on a line, every topic gets two lines
    // and the descriptions are left out only when there is no room for them.
    var titles = items.map(function (it) { return it.title; });
    var tSize = uniformSize(titles, tw, 16, { weight: 700, max: TSZ.heading, min: 10.5, maxLines: 1 });
    var twoLine = titles.some(function (t) { return wrap(String(t), tw, 'sans', 700, tSize).length > 1; });
    if (twoLine) tSize = TSZ.heading;
    var tLines = twoLine ? 2 : 1;
    var hasText = items.some(function (it) { return it.text; }) && rowH >= tLines * lineHeight('sans', tSize) + 16;
    var dSize = Math.max(10, Math.min(TSZ.body, tSize) - 0.5);      // description always a step below its topic
    items.forEach(function (it, i) {
      var y = top + i * rowH, badgeH = 23;
      rect(els, X0 - 4, y, 32, badgeH, T.slate);
      text(els, X0 - 4, y + 4.5, 32, 14, pad2(it.no || i + 1), { font: 'mono', weight: 500, max: 10, min: 10, align: 'center', maxLines: 1, color: onFill(T.slate) });
      var th = lineHeight('sans', tSize) * (twoLine && wrap(String(it.title), tw, 'sans', 700, tSize).length > 1 ? 2 : 1);
      var ty = hasText || th > badgeH ? y : y + (badgeH - th) / 2;
      text(els, tx, ty, tw, th, it.title, { weight: 700, max: tSize, min: tSize, maxLines: tLines, color: T.ink });
      var dS = wrap(String(it.text || ''), tw * 0.94, 'sans', 400, dSize).length > 1 ? 10 : dSize;   // one line: 10pt before any cut
      if (hasText && it.text) text(els, tx, ty + th + 1, tw, lineHeight('sans', dSize), oneLine(it.text, tw * 0.94, dS), { weight: 400, max: dS, min: dS, maxLines: 1, color: T.body });
      if (i < n - 1) line(els, X0 - 4, y + rowH - 4, listEnd, y + rowH - 4, T.cardLine, 0.5);
    });
    if (n <= 8) image(els, 'cube', 556, 190, 136, 150);   // isometric pyramid, template position (skipped if missing)
    agendaBand(els);
    return { bg: T.white, els: els, noFooter: true };
  };

  // 66D_LAYOUT_SECTION_001 (template slides 2, 6, 91): dark streak background, SemiBold white title left-middle, short underline.
  // No section number unless the spec carries one.
  L.section = function (s, ctx) {
    var els = [];
    if (s.number) text(els, 32.4, 118, 80, 36, s.number, { weight: 600, max: 28, min: 24, maxLines: 1, color: T.white });
    var t = text(els, 32.4, 164, 420, 80, s.title, { weight: 600, max: 28, min: 20, maxLines: 2, color: T.white });
    var ly = 164 + Math.max(t.height, lineHeight('sans', t.size || 28)) + 14;
    line(els, 33.4, ly, 33.4 + 120, ly, T.white, 1);
    if (s.lead) text(els, 32.4, ly + 14, 420, 60, s.lead, { weight: 400, max: TSZ.body + 2, min: TSZ.body, maxLines: 3, color: T.white });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true };
  };

  // 66D_LAYOUT_CARDS_* — card style from the slide's template reference (panel on white / white cards on panel / rule cards)
  // 66D_LAYOUT_CARDS_007 (template slide 42): grid of panel cards with mono numbers (or icons), one heading size and
  // one body size per slide, card height from the content.
  L.cards = function (s, ctx) {
    var els = [];
    var items = arr(s.items, 6);
    var n = Math.max(items.length, 1);
    var style = cardStyleOf(s);
    var numbered = !items.some(function (it) { return it && (it.icon || it.material); });
    var top = header(els, s);
    var cols = n <= 3 ? n : (n === 4 ? 2 : 3), rows = Math.ceil(n / cols);
    var gap = 12, cw = (CW - gap * (cols - 1)) / cols;
    var avail = (BOTTOM - top - gap * (rows - 1)) / rows;
    var padL = style === 'rule' ? 18 : 16, numW = numbered ? 38 : 0, iconW = numbered ? 0 : 26;
    var hw = cw - padL - 14 - numW - iconW, bw = cw - padL - 14;
    var hSize = uniformSize(items.map(function (it) { return it.title; }), hw, 36, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var headBlock = Math.max(linesBlock(items.map(function (it) { return it.title; }), hw, hSize, 600, 2), numbered ? 24 : 18);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), bw, avail - headBlock - 44, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 16 + headBlock + 10 + textH(it.text, bw, bSize) + 18 + hlNeed(items, bw, bSize)); });
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var c = i % cols, r = Math.floor(i / cols), x = CX + c * (cw + gap), y = top + r * (ch + gap);
      if (style === 'elevated') rect(els, x, y, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      else rect(els, x, y, cw, ch, T.bgLight);
      if (style === 'rule') rect(els, x, y, 3.5, ch, T.blue);
      if (numbered) text(els, x + padL, y + 13, numW, 26, pad2(i + 1), { font: 'mono', weight: 600, max: 20, min: 16, maxLines: 1, color: T.blue });
      else icon(els, it, x + cw - 14 - 18, y + 16, 18, false);
      text(els, x + padL + numW, y + 16 + (numbered ? 3 : 0), hw, headBlock, it.title, { weight: 600, max: hSize, min: hSize, maxLines: 2, color: T.ink });
      cardBody(els, x + padL, y + 16 + headBlock + 10, bw, ch - headBlock - 44, it, bSize, items);
    });
    return { bg: style === 'elevated' ? T.bgLight : T.white, els: els };
  };

  // 66D_LAYOUT_COMPANY_OVERVIEW_001 / 66D_LAYOUT_STATS_001 (template slides 7, 35): KPI cards with IBM Plex Mono numbers.
  // Cards fill the content area down to the takeaway bar, so the slide never looks half empty.
  // 66D_LAYOUT_COMPANY_OVERVIEW_001 (template slide 7): row of white KPI cards with IBM Plex Mono numbers and a blue
  // bottom rule; takeaway bar under the cards. Card height from the content.
  L.stats = function (s, ctx) {
    var els = [];
    var items = arr(s.items, 4);
    var n = Math.max(items.length, 1);
    var top = header(els, s);
    var takeH = s.takeaway ? 44 : 0, takeGap = s.takeaway ? 14 : 0;
    var gap = 12, tw = (CW - gap * (n - 1)) / n, iw = tw - 28;
    var avail = BOTTOM - top - takeH - takeGap;
    var vSize = uniformSize(items.map(function (it) { return it.value; }), iw, 52, { font: 'mono', weight: 600, max: n <= 3 ? 40 : 34, min: 16, maxLines: 1 });
    var lSize = uniformSize(items.map(function (it) { return it.label; }), iw, 34, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var lBlock = linesBlock(items.map(function (it) { return it.label; }), iw, lSize, 600, 2);
    var vH = lineHeight('mono', vSize);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, avail - vH - lBlock - 60, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 16 + vH + 10 + lBlock + 8 + textH(it.text, iw, bSize) + 22); });
    var th = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (tw + gap);
      rect(els, x, top, tw, th, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, x, top + th - 3, tw, 3, T.blue);
      text(els, x + 14, top + 16, iw, vH, it.value, { font: 'mono', weight: 600, max: vSize, min: vSize, maxLines: 1, color: T.blue });
      text(els, x + 14, top + 16 + vH + 10, iw, lBlock, it.label, { weight: 600, max: lSize, min: lSize, maxLines: 2, color: T.ink });
      var by = top + 16 + vH + 10 + lBlock + 8;
      text(els, x + 14, by, iw, top + th - by - 14, it.text, { weight: 400, max: bSize, min: bSize, color: T.body });
    });
    if (s.takeaway) {
      var ty = top + th + takeGap;
      rect(els, CX, ty, CW, takeH, T.bgLight);
      rect(els, CX, ty, 4, takeH, T.blue);
      text(els, CX + 18, ty, CW - 34, takeH, s.takeaway, { weight: 500, max: 11, min: 10, maxLines: 2, color: T.ink, valign: 'middle' });
    }
    return { bg: T.white, els: els };
  };

  // Tables (V.1_36): every column and every row the spec has is drawn - nothing is cut. Column widths come from the
  // header (always on one line) and the content; number columns are right-aligned; a first-column group label that
  // spans several rows (merged cells, or a blank cell under a label) is shown once across its rows. When the rows do not
  // fit even at the smallest size, tableLayout_ reports how many fit and the caller continues the table on a new slide.
  var TABLE_MAX_COLS = 8;
  function tableCells_(s) {
    var cellText = function (c) { return c == null ? '' : (typeof c === 'object' ? String(c.title || c.label || c.name || c.header || c.text || c.value || '') : String(c)); };
    var cols = arr(s.columns, TABLE_MAX_COLS).map(cellText);
    var rows = (Array.isArray(s.rows) ? s.rows : []).map(function (r) {
      if (r && !Array.isArray(r) && typeof r === 'object') r = Object.keys(r).map(function (k) { return r[k]; });
      var out = (Array.isArray(r) ? r : [r]).slice(0, Math.max(cols.length, 1)).map(cellText);
      while (out.length < cols.length) out.push('');
      return out;
    });
    if (!cols.length && rows.length) cols = rows[0].map(function () { return ''; });
    return { cols: cols, rows: rows };
  }
  function isNumberCell_(v) { var t = String(v || '').trim(); return !!t && /\d/.test(t) && !/[A-Za-z]{2,}/.test(t.replace(/\b(INR|USD|EUR|GBP|k|m|bn|hrs?|pts?)\b/gi, '')); }
  function tableLayout_(s, availH) {
    var c = tableCells_(s), cols = c.cols, rows = c.rows, nc = cols.length;
    var pad = 7, hSize = 10, minW = 34;
    // a first column that groups rows: a label followed by blank cells (merged cells in the source)
    var grouped = rows.length > 2 && !!rows[0][0] && rows.some(function (r, i) { return i > 0 && !String(r[0]).trim(); }) && nc > 1;
    var numeric = cols.map(function (h, j) {
      var vals = rows.map(function (r) { return r[j]; }).filter(function (v) { return String(v || '').trim(); });
      return vals.length > 0 && vals.filter(isNumberCell_).length >= vals.length * 0.8;
    });
    // natural widths: the header on one line, the longest cell on one line (capped), numbers never wrap
    var headW = cols.map(function (h) { return textWidth(String(h), 'sans', 500, hSize) + pad * 2 + 18; });   // + the text box inset: the header never shrinks or cuts
    var cellW = cols.map(function (h, j) {
      var mx = 0;
      rows.forEach(function (r) { mx = Math.max(mx, textWidth(String(r[j] || ''), 'sans', j === 0 ? 500 : 400, 10) + pad * 2 + 18); });
      return mx;
    });
    var want = cols.map(function (h, j) { return Math.max(minW, headW[j], numeric[j] ? cellW[j] : Math.min(cellW[j], 260)); });
    var floor = cols.map(function (h, j) { return Math.max(minW, headW[j], numeric[j] ? cellW[j] : Math.min(cellW[j], 90)); });
    var total = want.reduce(function (a, b) { return a + b; }, 0), widths;
    if (total <= CW) {
      // spare room goes to the text columns (numbers keep their width)
      var textCols = cols.map(function (h, j) { return !numeric[j]; });
      var tw0 = want.reduce(function (a, w, j) { return a + (textCols[j] ? w : 0); }, 0) || total;
      widths = want.map(function (w, j) { return w + (textCols[j] || tw0 === total ? (CW - total) * w / tw0 : 0); });
    } else {
      // too wide: text columns shrink towards their floor (they wrap), numbers and headers keep theirs
      var fixed = 0, flex = 0;
      want.forEach(function (w, j) { if (numeric[j] || w <= floor[j]) fixed += w; else flex += w - floor[j]; });
      var room = CW - fixed - cols.reduce(function (a, h, j) { return a + (numeric[j] || want[j] <= floor[j] ? 0 : floor[j]); }, 0);
      widths = want.map(function (w, j) { return numeric[j] || w <= floor[j] ? w : floor[j] + Math.max(0, room) * (w - floor[j]) / (flex || 1); });
      var sum = widths.reduce(function (a, b) { return a + b; }, 0);
      if (sum > CW) widths = widths.map(function (w) { return w * CW / sum; });   // last resort: everything scales
    }
    var hdrH = 24, size, rowHs, fit = rows.length;
    var minSize = s.compact ? 8 : 9;
    for (size = 10; size >= minSize; size -= 0.5) {
      rowHs = rows.map(function (r) {
        var h = 0;
        r.forEach(function (v, j) {
          if (grouped && j === 0) return;                    // the group label spans its rows
          h = Math.max(h, wrap(String(v || ''), widths[j] - pad * 2, 'sans', j === 0 ? 500 : 400, size).length * lineHeight('sans', size) + 8);
        });
        return Math.max(h, size + (s.compact ? 6 : 10));
      });
      if (grouped) {
        // a group's rows must hold its (wrapped) label
        for (var i = 0; i < rows.length; ) {
          var k = i + 1; while (k < rows.length && !String(rows[k][0]).trim()) k++;
          var need = wrap(String(rows[i][0]), widths[0] - pad * 2, 'sans', 500, size).length * lineHeight('sans', size) + 10;
          var have = 0; for (var q = i; q < k; q++) have += rowHs[q];
          if (have < need) for (q = i; q < k; q++) rowHs[q] += (need - have) / (k - i);
          i = k;
        }
      }
      if (hdrH + rowHs.reduce(function (a, b) { return a + b; }, 0) <= availH) break;
    }
    size = Math.max(size, minSize);
    var acc = hdrH;
    fit = 0;
    for (var r = 0; r < rows.length; r++) { if (acc + rowHs[r] > availH + 0.5) break; acc += rowHs[r]; fit++; }
    return { cols: cols, rows: rows, widths: widths, numeric: numeric, grouped: grouped, size: size, hdrH: hdrH, rowHs: rowHs, fit: Math.max(1, fit), pad: pad };
  }

  L.table = function (s, ctx) {
    var els = [];
    var top = header(els, s);
    var availH = BOTTOM - top;
    var T0 = tableLayout_(s, availH);
    var cols = T0.cols, rows = T0.rows.slice(0, T0.fit), widths = T0.widths, rowHs = T0.rowHs.slice(0, T0.fit), pad = T0.pad, size = T0.size;
    // rows share the free space (table at least ~70% of the area), so the slide is not half empty
    var used = T0.hdrH + rowHs.reduce(function (a, b) { return a + b; }, 0);
    if (rows.length && used < availH * 0.7) {
      var extra = (availH * 0.7 - used) / rows.length;
      rowHs = rowHs.map(function (h) { return h + extra; });
    }
    var x = CX, y = top;
    cols.forEach(function (c, j) {
      rect(els, x + 1, y, widths[j] - 2, T0.hdrH, T.blue);
      text(els, x + pad, y, widths[j] - pad * 2, T0.hdrH, c, { weight: 500, max: 10, min: 9, maxLines: 1, valign: 'middle', align: T0.numeric[j] ? 'right' : 'left', color: T.white });
      x += widths[j];
    });
    y += T0.hdrH;
    var firstColW = widths[0];
    rows.forEach(function (r, i) {
      x = CX;
      var groupStart = T0.grouped && String(r[0]).trim();
      if (T0.grouped && groupStart) {
        var k = i + 1, gh = rowHs[i];
        while (k < rows.length && !String(rows[k][0]).trim()) { gh += rowHs[k]; k++; }
        text(els, CX + pad, y, firstColW - pad * 2, gh, r[0], { weight: 500, max: size, min: 9, valign: 'middle', color: T.ink });
      }
      r.forEach(function (v, j) {
        if (!(T0.grouped && j === 0)) {
          text(els, x + pad, y, widths[j] - pad * 2, rowHs[i], v, { weight: j === 0 ? 500 : 400, max: size, min: 9, valign: 'middle', align: T0.numeric[j] ? 'right' : 'left', color: j === 0 ? T.ink : T.body });
        }
        x += widths[j];
      });
      y += rowHs[i];
      var lastOfGroup = !T0.grouped || i === rows.length - 1 || String(rows[i + 1][0]).trim();
      // inside a group the line starts after the group column; between groups it runs the full width
      line(els, lastOfGroup ? CX : CX + firstColW, y, CX + CW, y, T.cardLine, lastOfGroup ? 0.75 : 0.5);
    });
    return { bg: T.white, els: els };
  };
  // How many body rows of this table fit on one slide (the rest continue on the next slide)
  function tableRowsThatFit(spec) {
    var s1 = cleanSpec(spec || {});
    var els = [];
    var top = header(els, s1);
    return tableLayout_(s1, BOTTOM - top).fit;
  }

  L.process = function (s, ctx) {
    var els = [];
    var steps = arr(s.items, 6);
    var n = Math.max(steps.length, 1);
    var top = header(els, s, { eyebrow: true });
    var gap = 14, tw = (CW - gap * (n - 1)) / n;
    var colors = n >= 6 ? T.ramp : T.ramp.slice(0, n);
    var boxTop = top + 32 + 44;
    // Measure the tallest step's body text and size all boxes to that (with padding).
    var need = 0;
    steps.forEach(function (st) {
      var h = fit(String(st.text || ''), tw - 14, 200, { weight: 400, max: 10, min: 10 }).height;
      need = Math.max(need, h);
    });
    var bSize0 = uniformSize(steps.map(function (st) { return st.text; }), tw - 18, BOTTOM - boxTop - 26, { weight: 400, max: TSZ.body, min: TSZ.body });
    var needB = 0;
    steps.forEach(function (st) { needB = Math.max(needB, textH(st.text, tw - 18, bSize0) + 24); });
    var boxH = boxH_(needB, BOTTOM - boxTop - 6);
    steps.forEach(function (st, i) {
      var x = CX + i * (tw + gap);
      var fill = colors[Math.min(i, colors.length - 1)];
      rect(els, x, top, tw, 32, fill);
      text(els, x, top + 8, tw, 16, String(i + 1), { font: 'mono', weight: 600, max: TSZ.heading, min: TSZ.heading, align: 'center', maxLines: 1, color: isLight(fill) ? T.ink : T.white });
      if (i < n - 1) line(els, x + tw, top + 16, x + tw + gap, top + 16, T.connector, 1.5);
      text(els, x, top + 38, tw, 34, st.title, { weight: 700, max: 10.5, min: 10, maxLines: 2, align: 'center', color: T.ink });
      rect(els, x, boxTop, tw, boxH, T.boxFill, { color: T.boxLine, width: 0.75 });
      text(els, x + 9, boxTop + 10, tw - 18, boxH - 20, st.text, { weight: 400, max: bSize0, min: bSize0, color: T.body });
    });
    if (s.note) text(els, X0, boxTop + boxH + 12, CW, 20, s.note, { weight: 400, max: 10, min: 10, maxLines: 1, color: T.red });
    return { bg: T.white, els: els };
  };

  // 66D_LAYOUT_TIMELINE_001: horizontal blue band with markers, date labels in mono above, callout panels below
  // that stretch down to the footer so the slide is always filled.
  L.timeline = function (s, ctx) {
    var els = [];
    var ms = arr(s.items, 6);
    var n = Math.max(ms.length, 1);
    var top = header(els, s) + 4;
    var gap = 12, colW = (CW - gap * (n - 1)) / n;
    var ly = top + 26;                                   // band y
    rect(els, CX, ly, CW, 6, T.blue);
    var cardTop = ly + 24;
    var tlSize = uniformSize(ms.map(function (m) { return m.title; }), colW - 30, 36, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var tbSize = uniformSize(ms.map(function (m) { return m.text; }), colW - 24, BOTTOM - cardTop - 90, { weight: 400, max: TSZ.body, min: TSZ.body });
    var needT = 0;
    ms.forEach(function (m) { needT = Math.max(needT, 42 + 2 * lineHeight('sans', tlSize) + textH(m.text, colW - 24, tbSize) + 16); });
    var cardH = boxH(needT, BOTTOM - cardTop);
    ms.forEach(function (m, i) {
      var x = CX + (colW + gap) * i;
      text(els, x, top, colW - 8, 14, m.date || m.label || '', { font: 'mono', weight: 500, max: 10, min: 10, color: T.blue, maxLines: 1 });
      rect(els, x, ly - 4, 14, 14, T.white, { color: T.blue, width: 2 });
      line(els, x + 7, ly + 10, x + 7, cardTop, T.blue, 1);
      rect(els, x, cardTop, colW, cardH, T.bgLight);
      rect(els, x, cardTop, colW, 3, T.blue);
      text(els, x + 12, cardTop + 14, colW - 24, 14, (i < 9 ? '0' : '') + (i + 1), { font: 'mono', weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.blue });
      text(els, x + 12, cardTop + 34, colW - 24, 2 * lineHeight('sans', tlSize), m.title, { weight: 700, max: tlSize, min: tlSize, maxLines: 2, color: T.ink });
      var by = cardTop + 42 + 2 * lineHeight('sans', tlSize);   // two title lines reserved in every column
      text(els, x + 12, by, colW - 24, cardTop + cardH - by - 12, m.text, { weight: 400, max: tbSize, min: tbSize, color: T.body });
    });
    return { bg: T.white, els: els };
  };

  function bulletList(els, x, y, w, h, points, spec) {
    points = arr(points, 8).map(str).filter(function (p) { return p; });
    if (!points.length) return 0;
    var size = spec.max, gap = spec.gap || 8;
    for (; size >= spec.min; size -= 0.5) {
      var total = 0;
      points.forEach(function (p) { total += wrap(p, w - 16, 'sans', 400, size).length * lineHeight('sans', size) + gap; });
      if (total - gap <= h) break;
    }
    size = Math.max(size, spec.min);
    var cy = y, need = 0;
    points.forEach(function (p) { need += textH(p, w - 16, size) + gap; });
    need -= gap;
    // The list as a whole must fit: if it runs past its area, every bullet is reported as too long (fit check)
    if (AUDIT && need > h + 2) {
      var share = h / need;
      points.forEach(function (p) {
        AUDIT.push({ text: p, truncated: true, maxChars: Math.max(30, Math.floor(p.length * share * 0.9)), fill: 1, lines: 1, body: false });
      });
    }
    if (AUDIT && need < h * 0.55 && h > 80) {
      var grow = Math.min(1.9, (h * 0.75) / Math.max(need, 1));
      points.forEach(function (p) {
        AUDIT.push({ text: p, truncated: false, maxChars: Math.floor(p.length * grow / 0.85), fill: need / h, lines: 4, body: true });
      });
    }
    var savedAudit = AUDIT;
    AUDIT = null;                                   // single bullets are not measured on their own
    points.forEach(function (p) {
      if (cy - y > h + 2) return;                   // nothing is drawn below the area
      ellipse(els, x + 1, cy + lineHeight('sans', size) / 2 - 2.5, 5, 5, spec.bullet || T.ink);
      var ci = p.indexOf(': '), lead = ci > 2 && ci < 48 ? ci + 1 : 0;
      var r = text(els, x + 16, cy, w - 16, Math.max(lineHeight('sans', size), y + h - cy), p, { weight: 400, max: size, min: size, color: spec.color || T.body,
        runs: lead ? [{ start: 0, end: lead, color: T.ink, weight: 500 }] : null });
      cy += r.height + gap;
    });
    AUDIT = savedAudit;
    return cy - y;
  }

  function panel(els, x, y, w, h, headerFill, label, points, body) {
    rect(els, x, y, w, 43, headerFill);
    text(els, x + 10, y + 12, w - 20, 22, label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: 'center', color: onFill(headerFill), valign: 'middle' });
    rect(els, x, y + 43, w, h - 43, T.white, { color: T.cardLine, width: 0.75 });
    var cy = y + 56;
    var pts = arr(points, 8).map(str).filter(function (p) { return p; });
    if (body) {
      // Reserve room for the bullets below; body uses whatever is left up to a generous cap so nothing gets truncated.
      var pointsSpace = pts.length ? Math.min(160, pts.length * 24) : 0;
      var bodyH = Math.max(40, y + h - cy - 10 - pointsSpace);
      var nl = String(body).indexOf('\n');
      var b = text(els, x + 12, cy, w - 24, bodyH, body, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 10, color: T.body,
        runs: nl > 0 ? [{ start: 0, end: nl, color: T.ink, weight: 500 }] : null });
      cy += b.height + 8;
    }
    bulletList(els, x + 12, cy, w - 24, y + h - cy - 10, pts, { max: TSZ.body, min: TSZ.body, gap: 10 });
  }

  L.comparison = function (s, ctx) {
    var els = [];
    var top = header(els, s) + 6;
    var gap = 17, pw = (CW - gap) / 2, avail = BOTTOM - top;
    var left = s.left || {}, right = s.right || {};
    // Measure both panels' content and size to the taller — no more stretching to fill the page.
    function panelHeight(p) {
      var body = p.text ? fit(String(p.text), pw - 24, 200, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4 }).height + 8 : 0;
      var pts = arr(p.points, 8).map(str).filter(function (x) { return x; });
      var bh = 0;
      pts.forEach(function (pt) { bh += fit(pt, pw - 40, 60, { weight: 400, max: TSZ.body, min: TSZ.body }).height + 6; });
      return 43 + 20 + body + bh + 16;
    }
    var ph = boxH(Math.max(panelHeight(left), panelHeight(right)), avail);
    panel(els, CX, top, pw, ph, T.blue, headerText(left, pw - 20), left.points, left.text);
    panel(els, CX + pw + gap, top, pw, ph, T.ink, headerText(right, pw - 20), right.points, right.text);
    return { bg: T.bgLight, els: els };
  };

  L.next_steps = function (s, ctx) {
    var els = [];
    var items = arr(s.items, 10);
    var top = header(els, s) + 4;
    var cols = items.length > 5 ? 2 : 1, perCol = Math.ceil(items.length / cols);
    var bottom = s.cta ? BOTTOM - 44 : BOTTOM;
    var colW = (CW - (cols - 1) * 16) / cols;
    var rowGap = 8;
    var rowH = Math.min(96, (bottom - top + rowGap) / Math.max(perCol, 1));   // rows fill the content area
    items.forEach(function (it, i) {
      var c = Math.floor(i / perCol), r = i % perCol;
      var x = CX + c * (colW + 16), y = top + r * rowH, h = rowH - rowGap;
      rect(els, x, y, colW, h, T.bgLight);
      rect(els, x, y, 40, h, T.blue);
      text(els, x, y + h / 2 - 8, 40, 16, String(i + 1), { font: 'mono', weight: 600, max: TSZ.heading, min: TSZ.heading, align: 'center', maxLines: 1, color: T.white });
      var rightW = it.timing ? 110 : 0;
      var tx = x + 54, tw = colW - 54 - rightW - 12;
      var tt = fit(String(it.title || ''), tw, 20, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1 });
      var bt = it.text ? fit(String(it.text), tw, Math.max(h - tt.height - 16, 12), { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3 }) : { height: 0 };
      var ty = y + Math.max(8, (h - tt.height - 4 - bt.height) / 2);
      var t1 = text(els, tx, ty, tw, 20, it.title, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      text(els, tx, ty + t1.height + 4, tw, h - (ty - y) - t1.height - 8, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.body });
      if (it.timing) text(els, x + colW - rightW - 10, y + h / 2 - 7, rightW, 14, it.timing, { font: 'mono', weight: 500, max: 10, min: 10, align: 'right', maxLines: 1, color: T.blue });
    });
    if (s.cta) {
      var cy = BOTTOM - 36;
      rect(els, CX, cy, CW, 34, T.blue);
      text(els, CX + 16, cy + 9, CW - 32, 16, s.cta, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    }
    return { bg: T.white, els: els };
  };

  L.bullets = function (s, ctx) {
    var els = [];
    var top = header(els, s) + 4;
    var side = s.callout && (s.callout.title || s.callout.text);
    // No points: the side panel would sit alone on the right with an empty left half. The callout becomes the
    // slide's statement instead (full width, nothing empty).
    if (!asList(s.points).length) {
      if (!side) return { bg: T.white, els: els };
      var so = L.statement({ title: s.title, statement: s.callout.title || s.callout.label || s.title, text: s.callout.text || '', notes: s.notes }, ctx); so.noBalance = true; return so;
    }
    var lw = side ? 400 : CW;
    var listH;
    if (side) listH = bulletList(els, CX, top, lw, BOTTOM - top, s.points, { max: TSZ.body + 0.5, min: TSZ.body + 0.5, gap: 12 });
    else {
      var bpts = asList(s.points), bsz = TSZ.body + 2, avail = BOTTOM - top - 10;
      var textTot = bpts.reduce(function (t, p) { return t + textH(p, lw - 16, bsz); }, 0);
      var bgap = Math.max(12, Math.min(30, (avail * 0.85 - textTot) / Math.max(bpts.length - 1, 1)));
      var used = textTot + bgap * (bpts.length - 1);
      listH = bulletList(els, CX, top + Math.max(0, (avail - used) / 3), lw, avail, bpts, { max: bsz, min: bsz, gap: bgap });
    }
    if (side) {
      var px = CX + 424, pw = CW - 424;
      var ptext = String(s.callout.text || '');
      var need = 43 + 14 + textH(ptext, pw - 24, TSZ.body) + 18;
      panel(els, px, top, pw, Math.min(BOTTOM - top, Math.max(need, listH, 120)), T.blue, s.callout.title || s.callout.label || 'Why it matters', [], ptext);
    }
    return { bg: T.white, els: els };
  };

  L.statement = function (s, ctx) {
    var els = [];
    var points = arr(s.points, 3);
    var leftW = points.length ? 360 : CW;
    var hasTitle = s.title && s.statement && String(s.title).trim() !== String(s.statement).trim();
    var top = hasTitle ? header(els, { title: s.title }) : 44;
    var avail = BOTTOM - top;
    var stText = s.statement || s.title || '';
    var tx = s.text ? fit(String(s.text), leftW - 18, 120, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 7 }) : { height: 0, size: TSZ.body };
    var st = fit(String(stText), leftW - 18, avail - (s.text ? tx.height + 26 : 0) - 8, { weight: 500, max: 20, min: 15, maxLines: 4 });
    // Statement block centred vertically in the content area
    var blockH = st.height + (s.text ? 24 + tx.height : 0);
    var y = top + Math.max(0, (avail - blockH) / 2);
    rect(els, CX, y + 4, 5, Math.min(st.height - 4, 90), T.blue);
    text(els, CX + 18, y, leftW - 18, st.height + 4, stText, { weight: 500, max: st.size, min: st.size, maxLines: 5, color: T.ink });
    if (s.text) text(els, CX + 18, y + st.height + 24, leftW - 18, tx.height + 4, s.text, { weight: 400, max: tx.size, min: tx.size, maxLines: 7, color: T.body });
    if (points.length) {
      var px = CX + leftW + 24, pw = CW - leftW - 24, gap = 12, pTop = top, pAvail = BOTTOM - pTop;
      var hSize = uniformSize(points.map(function (p) { return p.title || p; }), pw - 28, 34, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
      var ch = (pAvail - gap * (points.length - 1)) / points.length;
      var hBlk = linesBlock(points.map(function (p) { return p.title || p; }), pw - 28, hSize, 500, 2);
      var bSize = uniformSize(points.map(function (p) { return p.text || ''; }), pw - 28, ch - hBlk - 30, { weight: 400, max: TSZ.body, min: TSZ.body });
      points.forEach(function (p, i) {
        var yy = pTop + i * (ch + gap);
        rect(els, px, yy, pw, ch, T.white, { color: T.cardLine, width: 0.75 });
        var h = text(els, px + 14, yy + 12, pw - 28, 34, p.title || p, { weight: 500, max: hSize, min: hSize, maxLines: 2, color: T.ink });
        text(els, px + 14, yy + 18 + h.height, pw - 28, ch - h.height - 28, p.text || '', { weight: 400, max: bSize, min: bSize, color: T.body });
      });
    }
    return { bg: T.bgLight, els: els };
  };

  // Axis maximum with 4 round gridline steps (1, 2 or 5 x 10^k), so labels read 10% / 20% / 30% / 40%, never 6.3%
  function niceMax(v, unit) {
    if (v <= 0) return 4;
    var raw = v / 4, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    var top = step * 4;
    if (unit === '%' && v <= 110 && top > 100) top = 100;     // data up to 100% (plus headroom) -> axis 0-100%
    return top;
  }
  function fmt(v, unit) {
    var s = Math.abs(v) >= 1000 ? (Math.round(v / 100) / 10) + 'k' : (Math.round(v * 10) / 10).toString();
    if (!unit) return s;
    return unit === '%' ? s + '%' : (unit === '$' ? '$' + s : s + unit);
  }

  L.chart = function (s, ctx) {
    var els = [];
    var ch = s.chart || {};
    var cats = arr(ch.categories, 8);
    var series = arr(ch.series, 2).map(function (se) { return { name: se.name || '', values: arr(se.values, 8).map(Number) }; });
    // No real data: never an empty plot with a lonely insight panel - the insight becomes the slide's statement
    var hasData = cats.length >= 2 && series.some(function (se) { return se.values.some(function (v) { return isFinite(v) && v > 0; }); });
    if (!hasData) {
      if (s.insight && (s.insight.title || s.insight.text)) { var si = L.statement({ title: s.title, statement: s.insight.title || s.title, text: s.insight.text || '', notes: s.notes }, ctx); si.noBalance = true; return si; }
      return { bg: T.white, els: els };
    }
    var top = header(els, s);                       // chart always starts below the title, however long it is
    var hasInsight = !!(s.insight && (s.insight.title || s.insight.text));
    var cx = CX, cw = hasInsight ? 420 : CW;
    var y = top;
    // Unit label and legend each on their own line (never on top of the axis)
    if (ch.unitLabel) { text(els, cx, y, cw, 14, ch.unitLabel, { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink }); y += 18; }
    if (series.length > 1) {
      var lx = cx;
      series.forEach(function (se, k) {
        rect(els, lx, y + 3, 9, 9, k ? T.barMuted : T.blue);
        var lw = Math.min(textWidth(se.name, 'sans', 400, 10) + 4, (cw - 30) / 2);
        text(els, lx + 14, y, lw, 14, se.name, { weight: 400, max: 10, min: 10, maxLines: 1, color: T.ink });
        lx += 14 + lw + 22;
      });
      y += 20;
    }
    var axisW = 40, plotTop = y + 14, plotBottom = BOTTOM - 30, plotH = plotBottom - plotTop;
    var maxV = 0;
    series.forEach(function (se) { se.values.forEach(function (v) { if (v > maxV) maxV = v; }); });
    maxV = niceMax(maxV * 1.08, (s.chart && s.chart.unit) || '');
    for (var g = 1; g <= 4; g++) {
      var gy = plotBottom - plotH * g / 4;
      line(els, cx + axisW, gy, cx + cw, gy, T.cardLine, 0.75);
      text(els, cx, gy - 7, axisW - 6, 14, fmt(maxV * g / 4, ch.unit), { font: 'mono', weight: 400, max: 10, min: 10, maxLines: 1, color: T.ink, align: 'right' });
    }
    var n = Math.max(cats.length, 1), slotW = (cw - axisW) / n, x0 = cx + axisW;
    var hi = (ch.highlight === 0 || ch.highlight) ? Number(ch.highlight) : -1;
    if (ch.type === 'line') {
      series.forEach(function (se, k) {
        var color = k ? T.barMuted : T.blue, prev = null;
        se.values.forEach(function (v, i) {
          var px = x0 + slotW * (i + 0.5), py = plotBottom - plotH * v / maxV;
          if (prev) line(els, prev[0], prev[1], px, py, color, 2);
          prev = [px, py];
        });
        se.values.forEach(function (v, i) {
          var px = x0 + slotW * (i + 0.5), py = plotBottom - plotH * v / maxV;
          ellipse(els, px - 3.5, py - 3.5, 7, 7, color);
          if (k === 0) text(els, px - 30, py - 20, 60, 14, fmt(v, ch.unit), { font: 'mono', weight: 500, max: 10, min: 10, align: 'center', maxLines: 1, color: T.ink });
        });
      });
    } else {
      var groupW = Math.min(slotW * 0.6, 130 * Math.max(series.length, 1)), bw = groupW / Math.max(series.length, 1);
      series.forEach(function (se, k) {
        se.values.forEach(function (v, i) {
          var bh = Math.max(1, plotH * v / maxV);
          var bx = x0 + slotW * i + (slotW - groupW) / 2 + k * bw;
          var color = series.length > 1 ? (k ? T.barMuted : T.blue) : (hi >= 0 ? (i === hi ? T.blue : T.barMuted) : T.blue);
          els.push({ t: 'rect', x: bx, y: plotBottom - bh, w: bw - (series.length > 1 ? 3 : 0), h: bh, fill: color, square: true });
          text(els, bx - 14, plotBottom - bh - 17, bw + 28, 14, fmt(v, ch.unit), { font: 'mono', weight: 500, max: 10, min: 10, align: 'center', maxLines: 1, color: T.ink });
        });
      });
    }
    line(els, x0 - 4, plotBottom, cx + cw, plotBottom, T.ink, 1);
    cats.forEach(function (c, i) { text(els, x0 + slotW * i + 2, plotBottom + 6, slotW - 4, 26, c, { weight: 500, max: 10, min: 10, align: 'center', maxLines: 2, color: T.ink }); });
    if (hasInsight) {
      // Insight panel sized to its text (no half-empty panel), aligned with the top of the chart
      var px = CX + 444, pw = CW - 444, avail = BOTTOM - top;
      var need = 16 + textH(s.insight.title, pw - 30, TSZ.heading, 500) + 10 + textH(s.insight.text, pw - 30, TSZ.body) + 22;
      card(els, px, top, pw, Math.min(avail, Math.max(need, avail * 0.45)), s.insight.title, s.insight.text, null, 'panel');
    }
    return { bg: T.white, els: els };
  };

  // 66D_LAYOUT_CASE_STUDY_005 (template slide 79): challenge | solution | impact panel with IBM Plex Mono results
  function asList(v) {
    if (Array.isArray(v)) return v.map(str).filter(function (x) { return x; });
    return v ? [String(v)] : [];
  }
  // 66D_LAYOUT_CASE_STUDY_005 (template slide 79): Business Challenge | How 66degrees Helped (numbered) | Business Impact panel
  // 66D_LAYOUT_CASE_STUDY_005 (template slide 79), visual version: Business Challenge card with icon, "How 66degrees
  // helped" card with numbered blue badges, and a solid blue Business Impact panel with the key numbers in white.
  L.case_study = function (s, ctx) {
    if (Array.isArray(s.cases) && s.cases.length >= 2) {
      var j = V['66D_LAYOUT_CASE_STUDY_002'](s);
      if (j) return j;
    }
    var els = [];
    var top = header(els, s);
    var gap = 14, avail = BOTTOM - top;
    var pw = 190, cw = (CW - pw - 2 * gap) / 2;
    var chal = asList(s.challenge), sol = asList(s.solution).slice(0, 5);
    // Challenge card
    rect(els, CX, top, cw, avail, T.bgLight);
    icon(els, { icon: 'warning risk', material: '' }, CX + 16, top + 16, 20, false);
    text(els, CX + 44, top + 16, cw - 60, 20, s.challenge_label || 'Business challenge', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
    if (s.industry || s.client) {
      text(els, CX + 16, top + 44, cw - 32, 14, String(s.industry || s.client), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.blue });
    }
    var cTop = top + (s.industry || s.client ? 66 : 50);
    var cSize = uniformSize([chal.join('\n\n')], cw - 32, BOTTOM - cTop - 14, { weight: 400, max: TSZ.body, min: TSZ.body });
    // How 66degrees helped
    var hx = CX + cw + gap;
    rect(els, hx, top, cw, avail, T.white, { color: T.cardLine, width: 0.75 });
    rect(els, hx, top, cw, 3, T.blue);
    icon(els, { icon: 'idea solution', material: '' }, hx + 16, top + 16, 20, false);
    text(els, hx + 44, top + 16, cw - 60, 20, s.solution_label || 'How 66degrees helped', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
    var sTop = top + 50, sAvail = BOTTOM - sTop - 12, n = Math.max(sol.length, 1);
    var sSize = uniformSize(sol, cw - 64, sAvail / n - 10, { weight: 400, max: TSZ.body, min: TSZ.body });
    sSize = cSize = Math.min(sSize, cSize);   // one text size across the slide
    var rowH = sAvail / n;
    sol.forEach(function (t, i) {
      var y = sTop + i * rowH;
      ellipse(els, hx + 16, y + 1, 20, 20, T.blue);
      text(els, hx + 16, y + 4, 20, 14, String(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white });
      text(els, hx + 46, y, cw - 64, rowH - 6, t, { weight: 400, max: sSize, min: sSize, color: T.body });
    });
    text(els, CX + 16, cTop, cw - 32, BOTTOM - cTop - 14, chal.join('\n\n'), { weight: 400, max: cSize, min: cSize, color: T.body });
    // Business impact
    var px = CX + CW - pw;
    rect(els, px, top, pw, avail, T.blue);
    text(els, px + 16, top + 16, pw - 32, 20, 'Business impact', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    var res = arr(s.results, 3), rn = Math.max(res.length, 1), rH = (avail - 50) / rn;
    res.forEach(function (r, i) {
      var y = top + 46 + i * rH;
      if (i > 0) line(els, px + 16, y - 6, px + pw - 16, y - 6, T.tints[2], 0.75);
      var vS = fit(String(r.value || ''), (pw - 32) * 0.88, 44, { font: 'mono', weight: 500, max: 30, min: 14, maxLines: 1 }).size;
      var v = text(els, px + 16, y, pw - 32, 44, r.value, { font: 'mono', weight: 600, max: vS, min: vS, maxLines: 1, color: T.white });
      text(els, px + 16, y + v.height + 6, pw - 32, rH - v.height - 16, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.white });
    });
    return { bg: T.white, els: els };
  };

  L.quote = function (s, ctx) {
    var els = [];
    rect(els, CX, 110, 5, 150, T.blue);
    var q = text(els, CX + 22, 110, 560, 170, s.quote || s.title, { weight: 600, max: 24, min: 15, maxLines: 6, color: T.ink });
    if (s.attribution) text(els, CX + 22, 120 + q.height, 400, 14, s.attribution, { font: 'mono', weight: 500, max: 10, min: 10, color: T.blue, maxLines: 1 });
    return { bg: T.bgLight, els: els };
  };

  L.closing = function (s, ctx) {
    var els = [];
    // Always "Thank You!" - the deck's headline moves to the subtitle
    image(els, 'logo-dark', 42, 42, 82, 19.4);
    text(els, 42, 130, 380, 80, 'Thank You!', { weight: 500, max: 56, min: 42, maxLines: 1, color: T.ink, valign: 'bottom' });
    rect(els, 44, 218, 96, 3, T.blue);
    var sub = s.subtitle || s.lead || s.title || '';
    if (sub && sub.toLowerCase().indexOf('thank') === -1) {
      text(els, 44, 232, 380, 60, sub, { weight: 400, max: 13, min: 11, maxLines: 3, color: T.ink });
    }
    // Stay Connected card
    roundrect(els, 448, 42, 252, 170, T.bgLight, null);
    text(els, 464, 62, 220, 24, 'Stay Connected', { weight: 500, max: 16, min: 14, maxLines: 1, color: T.ink });
    rect(els, 464, 92, 48, 2, T.blue);
    var rows = [['web', 'www.66degrees.com'], ['at', '@66degrees'], ['mail', 'hello@66degrees.com']];
    rows.forEach(function (c, i) {
      var y = 118 + i * 28, ix = 468, iy = y + 2, sz = 14;
      contactIcon(els, c[0], ix, iy, sz);
      text(els, 494, y, 200, 18, c[1], { weight: 400, max: 11, min: 11, maxLines: 1, color: T.ink });
    });
    // Blue footer band + strip pattern + 66° mark
    rect(els, 0, 349, 480, 56, T.blue);
    image(els, 'strip-pattern', 482, 349, 238, 56);
    image(els, 'mark-white', 22.3, 368, 28.2, 18.8);
    return { bg: T.white, els: els, noFooter: true };
  };

  /* ---------------- Cover and closing variations (rotated between decks) ----------------
   * Built only from the template's own parts: the 66° Blue band, the band / strip / cover patterns, the logo, the
   * white 66° mark and the isometric cube. Light backgrounds only (they never count as dark slides). */
  var COVER_VARIANTS_ = {};
  // Blue panel on the left with the white 66° mark and the date; the title on the right
  COVER_VARIANTS_.ENGINE_COVER_PANEL = function (s, ctx) {
    var els = [], pw = 236;
    rect(els, 0, 0, pw, H, T.blue);
    els[els.length - 1].square = true;
    image(els, 'mark-white', 28, 30, 55, 36.7);
    image(els, 'band-pattern', 0, H - 56, 94, 56);
    text(els, 28, 300, pw - 50, 16, '>> ' + (ctx.dateLabel || ''), { font: 'mono', weight: 400, max: TSZ.body, min: TSZ.body, color: T.white, maxLines: 1 });
    image(els, 'logo-dark', W - 32 - 68.8, 28, 68.8, 16.2);
    text(els, pw + 40, 110, W - pw - 80, 116, s.title, { weight: 600, max: 28, min: 22, maxLines: 3, color: T.title || T.ink, valign: 'bottom' });
    rect(els, pw + 42, 236, 72, 3, T.blue);
    text(els, pw + 40, 250, W - pw - 90, 40, s.subtitle || s.lead, { weight: 500, max: 12, min: 10, maxLines: 2, color: T.body });
    image(els, 'cover-pattern', W - 124, H - 96, 92, 72);
    return { bg: T.white, els: els, noFooter: true };
  };
  // Title block with the isometric cube on the right and a slim blue band with the date at the bottom
  COVER_VARIANTS_.ENGINE_COVER_CUBE = function (s, ctx) {
    var els = [];
    image(els, 'logo-dark', 32, 28, 68.8, 16.2);
    text(els, 32, 92, 430, 128, s.title, { weight: 600, max: 28, min: 22, maxLines: 3, color: T.title || T.ink, valign: 'bottom' });
    rect(els, 34, 230, 96, 3, T.blue);
    text(els, 32, 244, 410, 40, s.subtitle || s.lead, { weight: 500, max: 12, min: 10, maxLines: 2, color: T.body });
    image(els, 'cube', 500, 96, 170, 188);
    rect(els, 0, H - 40, W, 40, T.blue);
    els[els.length - 1].square = true;
    image(els, 'strip-pattern', W - 238, H - 40, 238, 40);
    text(els, 32, H - 28, 220, 16, '>> ' + (ctx.dateLabel || ''), { font: 'mono', weight: 400, max: TSZ.body, min: TSZ.body, color: T.white, maxLines: 1 });
    return { bg: T.white, els: els, noFooter: true };
  };

  // The Thank-you slide always uses the template design (L.closing): strict brand rule, no variations.

  // Contact icons drawn from simple shapes in 66° Blue: they always look right (no lookup in the icon sheet)
  function contactIcon(els, kind, x, y, sz) {
    var c = T.blue, bg = T.bgLight;
    if (kind === 'web') {            // globe: circle, meridian, equator
      els.push({ t: 'ellipse', x: x, y: y, w: sz, h: sz, fill: bg, line: { color: c, width: 1.1 }, square: true });
      els.push({ t: 'ellipse', x: x + sz * 0.3, y: y, w: sz * 0.4, h: sz, fill: bg, line: { color: c, width: 1 }, square: true });
      line(els, x, y + sz / 2, x + sz, y + sz / 2, c, 1);
    } else if (kind === 'mail') {    // envelope: box and flap
      els.push({ t: 'rect', x: x, y: y + sz * 0.15, w: sz, h: sz * 0.7, fill: bg, line: { color: c, width: 1.1 }, square: true });
      line(els, x, y + sz * 0.15, x + sz / 2, y + sz * 0.52, c, 1);
      line(els, x + sz / 2, y + sz * 0.52, x + sz, y + sz * 0.15, c, 1);
    } else {                         // @ sign in the mono brand font
      text(els, x - 2, y - 3, sz + 4, sz + 2, '@', { font: 'mono', weight: 500, max: 13, min: 13, maxLines: 1, align: 'center', color: c, noFill: true });
    }
  }


  /* ================================================================================================
   * TEMPLATE DESIGN VARIANTS
   * Each slide type can be drawn in several designs taken from the 2026 template (slide numbers in
   * the comments match the reference visual index). Reference.gs picks the design for each slide
   * (spec.reference.tag) and rotates designs between decks. A variant returns null when the content
   * does not suit it; the slide is then drawn with the type's default layout.
   * ================================================================================================ */
  var V = {};
  Object.keys(COVER_VARIANTS_).forEach(function (k) { V[k] = function (s, ctx) { return COVER_VARIANTS_[k](s, ctx || {}); }; });

  function shape(els, kind, x, y, w, h, fill, ln) { els.push({ t: 'shape', shape: kind, x: x, y: y, w: w, h: h, fill: fill, line: ln || null }); }
  function ring(els, x, y, d, fill, color, width) { els.push({ t: 'ellipse', x: x, y: y, w: d, h: d, fill: fill, line: { color: color, width: width } }); }
  function dashedLine(els, x1, y1, x2, y2, color, width, dash, gap) {
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    if (len < 1) return;
    var ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    for (var d = 0; d < len; d += dash + gap) {
      var e = Math.min(d + dash, len);
      line(els, x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e, color, width);
    }
  }
  function maxLen(items, f) { var m = 0; items.forEach(function (it) { m = Math.max(m, String(f(it) || '').length); }); return m; }
  // Icon for items that have none: the renderer picks a template icon from these words
  function autoIcon(it) {
    if (it && (it.icon || it.material)) return it;
    // No icon planned: the renderer picks a template icon from the item's own words (title first, then text)
    var words = [it && (it.title || it.label), it && it.text].filter(Boolean).join(' ').toLowerCase();
    return { icon: words.slice(0, 160), material: '' };
  }
  function items_(s, max) { return arr(s.items, max).filter(function (it) { return it; }); }
  function uniformSize(list, w, h, spec) {
    var size = spec.max;
    if ((spec.weight || 400) > 500) spec = Object.assign({}, spec, { weight: 500 });
    list.forEach(function (t) { if (t) size = Math.min(size, fit(String(t), w, h, spec).size); });
    return size;
  }

  /* ---------------- Agenda ---------------- */
  function agendaItems(s) {
    return arr(s.items, 20).map(function (it) {      // up to 20: Introduction, the topics, Thank you
      return typeof it === 'string' ? { title: it, text: '' } : { title: it.title || it.text || '', text: it.title ? (it.text || '') : '', no: Number(it.no) || 0 };
    }).filter(function (it) { return it.title; });
  }
  function agendaBand(els) {
    rect(els, 0, 349, W, 56, T.blue);
    image(els, 'band-pattern', 626, 349, 94, 56);
    image(els, 'mark-white', 22.3, 368, 28.2, 18.8);
  }

  // Template slide 3 (66D_LAYOUT_AGENDA_001): bulleted list left, isometric graphic right, blue band
  V['66D_LAYOUT_AGENDA_001'] = function (s) {
    var items = agendaItems(s), n = items.length;
    if (n < 2 || n > 9) return null;
    var els = [];
    text(els, X0, 24, 520, 30, s.title || 'Agenda', { weight: 600, max: 20, min: 16, maxLines: 1, color: T.title || T.ink });
    var top = 80, listW = 480, rowH = Math.min(44, (332 - top) / n);
    var tSize = uniformSize(items.map(function (it) { return it.title; }), listW - 20, 18, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1 });
    var dSize = uniformSize(items.map(function (it) { return it.text; }), listW - 20, 14, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 1 });
    items.forEach(function (it, i) {
      var y = top + i * rowH;
      ellipse(els, X0 + 2, y + lineHeight('sans', tSize) / 2 - 2.5, 5, 5, T.ink);
      var t = text(els, X0 + 18, y, listW - 20, 18, it.title, { weight: 600, max: tSize, min: tSize, maxLines: 1, color: T.ink });
      if (it.text && rowH >= 30) text(els, X0 + 18, y + t.height + 2, listW - 20, 14, it.text, { weight: 400, max: dSize, min: dSize, maxLines: 1, color: T.body });
    });
    image(els, 'cube', 556, 190, 136, 150);
    agendaBand(els);
    return { bg: T.white, els: els, noFooter: true };
  };

  // Agenda as numbered tiles (3 or 4 columns): a second design for long decks, so the agenda changes between decks
  V.ENGINE_AGENDA_TILES = function (s) {
    var items = agendaItems(s), n = items.length;
    if (n < 6 || n > 16) return null;
    var els = [];
    text(els, X0, 24, 520, 30, s.title || 'Agenda', { weight: 600, max: 20, min: 16, maxLines: 1, color: T.title || T.ink });
    var cols = n > 12 ? 4 : n > 8 ? 4 : 3, rows = Math.ceil(n / cols), gap = 10;
    var top = 66, cw = (W - 2 * X0 - gap * (cols - 1)) / cols, ch = Math.min(84, (338 - top - gap * (rows - 1)) / rows);
    var tw = cw - 24;
    var fitsAt = function (sz) { return items.every(function (it) { return wrap(String(it.title), tw, 'sans', 500, sz).length <= 2; }); };
    var tS = TSZ.heading;
    while (tS > 10 && !fitsAt(tS)) tS -= 0.5;
    items.forEach(function (it, i) {
      var c = i % cols, r = Math.floor(i / cols), x = X0 + c * (cw + gap), y = top + r * (ch + gap);
      rect(els, x, y, cw, ch, T.bgLight);
      text(els, x + 12, y + 8, 40, 16, pad2(it.no || i + 1), { font: 'mono', weight: 500, max: 11, min: 10, maxLines: 1, color: T.blue });
      text(els, x + 12, y + 26, tw, ch - 32, it.title, { weight: 500, max: tS, min: tS, maxLines: 2, color: T.ink });
    });
    agendaBand(els);
    return { bg: T.white, els: els, noFooter: true };
  };

  // Template slide 5 (66D_LAYOUT_AGENDA_003): dashed "66" ring left, dotted arc with blue nodes, topic pills
  V['66D_LAYOUT_AGENDA_003'] = function (s) {
    var items = agendaItems(s), n = items.length;
    if (n < 3 || n > 5 || maxLen(items, function (it) { return it.title; }) > 46) return null;
    var els = [];
    text(els, X0, 24, 520, 30, s.title || 'Agenda', { weight: 600, max: 20, min: 16, maxLines: 1, color: T.title || T.ink });
    // Dashed ring graphic (three rings of short tangential dashes)
    var cx = 170, cy = 208;
    [[72, 26], [56, 20], [40, 14]].forEach(function (rg) {
      for (var k = 0; k < rg[1]; k++) {
        var a = (k / rg[1]) * Math.PI * 2 + rg[0] * 0.01, len = 11;
        var px = cx + rg[0] * Math.cos(a), py = cy + rg[0] * Math.sin(a);
        var tx = -Math.sin(a) * len / 2, ty = Math.cos(a) * len / 2;
        line(els, px - tx, py - ty, px + tx, py + ty, T.ink, 4.5);
      }
    });
    // Dotted arc and nodes
    var R = 128, a0 = -1.0, a1 = 1.0;
    for (var k = 0; k < 40; k += 2) {
      var aa = a0 + (a1 - a0) * k / 40, ab = a0 + (a1 - a0) * (k + 1) / 40;
      line(els, cx + R * Math.cos(aa), cy + R * Math.sin(aa), cx + R * Math.cos(ab), cy + R * Math.sin(ab), T.ink, 0.75);
    }
    var pillW = 290, pillH = n > 5 ? 32 : 36;
    var tSize = uniformSize(items.map(function (it) { return it.title; }), pillW - 48, pillH - 6, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    items.forEach(function (it, i) {
      var a = n === 1 ? 0 : a0 + 0.1 + (a1 - a0 - 0.2) * i / (n - 1);
      var nx = cx + R * Math.cos(a), ny = cy + R * Math.sin(a);
      var px = Math.min(nx + 40 + (1 - Math.abs(a)) * 20, W - 26 - pillW), py = ny - pillH / 2;
      dashedLine(els, nx + 6, ny, px, ny, T.slate, 0.75, 2, 2);
      ring(els, nx - 6, ny - 6, 12, T.white, T.blue, 1.5);
      ellipse(els, nx - 3, ny - 3, 6, 6, T.blue);
      roundrect(els, px, py, pillW, pillH, T.bgLight, { color: T.cardLine, width: 0.75 });
      text(els, px + 10, py + 8, 26, 14, pad2(it.no || i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, color: T.blue });
      text(els, px + 38, py, pillW - 48, pillH, it.title, { weight: 700, max: tSize, min: tSize, maxLines: 2, color: T.ink, valign: 'middle' });
    });
    agendaBand(els);
    return { bg: T.white, els: els, noFooter: true };
  };

  /* ---------------- Cards ---------------- */
  // Template slide 11 (66D_LAYOUT_CARDS_001): panel cards with a large mono number left, heading, divider, body.
  // Five items: 3 + 2 with the isometric graphic in the sixth slot.
  V['66D_LAYOUT_CARDS_001'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s);
    var cols = n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 12;
    var cw = (CW - gap * (cols - 1)) / cols, avail = (BOTTOM - top - gap * (rows - 1)) / rows;
    var numW = 44, iw = cw - numW - 26;
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 32, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = Math.max(linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2), 18);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, avail - hBlock - 50, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 16 + hBlock + 16 + textH(it.text, iw, bSize) + 18 + hlNeed(items, iw, bSize)); });
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var c = i % cols, r = Math.floor(i / cols), x = CX + c * (cw + gap), y = top + r * (ch + gap);
      rect(els, x, y, cw, ch, T.bgLight);
      text(els, x + 12, y + 10, numW, 28, pad2(i + 1), { font: 'mono', weight: 600, max: 22, min: 18, maxLines: 1, color: T.blue });
      text(els, x + 12 + numW, y + 16, iw, hBlock, it.title, { weight: 600, max: hSize, min: hSize, maxLines: 2, color: T.ink });
      var dy = y + 16 + hBlock + 7;
      line(els, x + 12 + numW, dy, x + cw - 14, dy, T.cardLine, 0.75);
      cardBody(els, x + 12 + numW, dy + 9, iw, y + ch - dy - 20, it, bSize, items);
    });
    if (n === 5) image(els, 'cube', CX + 2 * (cw + gap) + cw / 2 - 60, top + ch + gap + ch / 2 - 62, 120, 124);
    return { bg: T.white, els: els };
  };

  // Template slide 17 (66D_LAYOUT_CARDS_003): eyebrow + panel cards with a line icon top-left, 2-line heading, body
  V['66D_LAYOUT_CARDS_003'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2) return null;
    var els = [];
    var top = header(els, s);
    var gap = 14, cw = (CW - gap * (n - 1)) / n, avail = BOTTOM - top, iw = cw - 32;
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 34, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, avail - hBlock - 80, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 52 + hBlock + 10 + textH(it.text, iw, bSize) + 20 + hlNeed(items, iw, bSize)); });
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.bgLight);
      icon(els, autoIcon(it), x + 16, top + 18, 20, false);
      text(els, x + 16, top + 52, iw, hBlock, it.title, { weight: 600, max: hSize, min: hSize, maxLines: 2, color: T.ink });
      cardBody(els, x + 16, top + 52 + hBlock + 10, iw, ch - hBlock - 72, it, bSize, items);
    });
    return { bg: T.white, els: els };
  };

  // Template slide 41 (66D_LAYOUT_CARDS_006): panel background, white cards in one row: icon, blue heading, divider, body
  V['66D_LAYOUT_CARDS_006'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 3 || (n === 5 && maxLen(items, function (it) { return it.text; }) > 200)) return null;
    var els = [];
    var top = header(els, s);
    var gap = 10, cw = (CW - gap * (n - 1)) / n, avail = BOTTOM - top, iw = cw - 28;
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 700, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, avail - hBlock - 90, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 54 + hBlock + 18 + textH(it.text, iw, bSize) + 20 + hlNeed(items, iw, bSize)); });
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      icon(els, autoIcon(it), x + 14, top + 18, 18, false);
      text(els, x + 14, top + 50, iw, hBlock, it.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, color: T.blue });
      var dy = top + 50 + hBlock + 8;
      line(els, x + 14, dy, x + cw - 14, dy, T.cardLine, 0.75);
      cardBody(els, x + 14, dy + 10, iw, top + ch - dy - 20, it, bSize, items);
    });
    return { bg: T.bgLight, els: els };
  };

  // Template slide 52 (66D_LAYOUT_CARDS_013): white container on panel, outlined cards with an icon circle and number
  V['66D_LAYOUT_CARDS_013'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2) return null;
    var els = [];
    var top = header(els, s);
    var pad = 14, gap = 14, cw = (CW - 2 * pad + 8 - gap * (n - 1)) / n, availC = BOTTOM - top - 2 * pad, iw = cw - 28;
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 30, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, availC - hBlock - 110, { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 84 + hBlock + 18 + textH(it.text, iw, bSize) + 20 + hlNeed(items, iw, bSize)); });
    var ch = boxH(need, availC);
    rect(els, CX - 4, top, CW + 8, ch + 2 * pad, T.white);
    items.forEach(function (it, i) {
      var x = CX - 4 + pad + i * (cw + gap), y = top + pad;
      rect(els, x, y, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      // Icon centred in a light circle; the number sits in a small circle on its lower-right edge (never on the icon)
      var d = 60, ccx = x + cw / 2 - d / 2 - 6, ccy = y + 10, nd = 28;
      ellipse(els, ccx, ccy, d, d, T.bgLight);
      icon(els, autoIcon(it), ccx + d / 2 - 13, ccy + d / 2 - 13, 26, false);
      ring(els, ccx + d + 6, ccy + d - nd, nd, T.white, T.blue, 1.5);
      text(els, ccx + d + 6, ccy + d - nd + nd / 2 - 7, nd, 14, pad2(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, align: 'center', color: T.blue, noFill: true });
      text(els, x + 14, y + 84, iw, hBlock, it.title, { weight: 600, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.blue });
      var dy = y + 84 + hBlock + 8;
      line(els, x + 14, dy, x + cw - 14, dy, T.cardLine, 0.75);
      cardBody(els, x + 14, dy + 10, iw, y + ch - dy - 20, it, bSize, items);
    });
    return { bg: T.bgLight, els: els };
  };

  /* ---------------- Process ---------------- */
  // Template slide 26 (66D_LAYOUT_PROCESS_001): panel band with an arrow line, numbered dots and phase names;
  // below each phase: line icon and description
  V['66D_LAYOUT_PROCESS_001'] = function (s) {
    var steps = items_(s, 5), n = steps.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s, { eyebrow: true });
    var bandH = 58, colW = CW / n;
    rect(els, 0, top, W, bandH, T.bgLight);
    var ly = top + 34;
    line(els, CX, ly, CX + CW, ly, T.blue, 1);
    line(els, CX + CW - 6, ly - 4, CX + CW, ly, T.blue, 1);
    line(els, CX + CW - 6, ly + 4, CX + CW, ly, T.blue, 1);
    var nSize = uniformSize(steps.map(function (st) { return String(st.title || '').toUpperCase(); }), colW - 30, 14, { weight: 600, max: 10.5, min: 10, maxLines: 1 });
    // One text size and one start height for every column, so icons and text line up
    var area = BOTTOM - (top + bandH);
    var bSize = uniformSize(steps.map(function (st) { return st.text; }), colW - 16, area - 80, { weight: 400, max: TSZ.body, min: TSZ.body });
    var bMax = 0;
    steps.forEach(function (st) { bMax = Math.max(bMax, fit(String(st.text || ''), colW - 16, area - 80, { weight: 400, max: bSize, min: bSize }).height); });
    var by0 = top + bandH + Math.max(18, (area - (44 + 14 + bMax)) / 2);
    steps.forEach(function (st, i) {
      var x = CX + i * colW;
      ellipse(els, x - 2, ly - 8, 16, 16, T.blue);
      text(els, x - 2, ly - 5.5, 16, 11, String(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white });
      text(els, x + 18, top + 12, colW - 26, 14, st.title, { weight: 600, max: nSize, min: nSize, maxLines: 1, color: T.ink });
      icon(els, autoIcon(st), x + colW / 2 - 22, by0, 44, false);
      text(els, x + 8, by0 + 58, colW - 16, bMax, st.text, { weight: 400, max: bSize, min: bSize, align: 'center', color: T.body });
    });
    return { bg: T.white, els: els };
  };

  // Template slide 73 (66D_LAYOUT_PROCESS_002): panel background, tall white step cards with a round number badge,
  // heading, tinted label pill and centred description
  V['66D_LAYOUT_PROCESS_002'] = function (s) {
    var steps = items_(s, 6), n = steps.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s, { eyebrow: true }) + 4;
    var gap = 10, cw = (CW - gap * (n - 1)) / n, ch = BOTTOM - top;
    var hSize = uniformSize(steps.map(function (st) { return st.title; }), cw - 16, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hasPill = steps.some(function (st) { return st.timing || st.label; });
    var pbSize = uniformSize(steps.map(function (st) { return st.text; }), cw - 16, ch - 120, { weight: 400, max: TSZ.body, min: TSZ.body });
    var needP = 0;
    steps.forEach(function (st) { needP = Math.max(needP, 46 + 2 * lineHeight('sans', hSize) + 8 + (hasPill ? 26 : 0) + textH(st.text, cw - 16, pbSize) + 20); });
    ch = boxH(needP, ch);
    steps.forEach(function (st, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      ellipse(els, x + cw / 2 - 12, top + 14, 24, 24, T.blue);
      text(els, x + cw / 2 - 12, top + 19, 24, 14, String(i + 1), { font: 'mono', weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', color: T.white });
      var ht = text(els, x + 8, top + 46, cw - 16, 30, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
      var py = top + 46 + Math.max(ht.height, 2 * lineHeight('sans', hSize)) + 8;
      var pill = st.timing || st.label || '';
      if (pill) {
        rect(els, x + 10, py, cw - 20, 18, T.tints[4]);
        text(els, x + 10, py + 2, cw - 20, 12, pill, { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.ink });
        py += 26;
      }
      text(els, x + 8, py + 2, cw - 16, top + ch - py - 14, st.text, { weight: 400, max: pbSize, min: pbSize, align: 'center', color: T.body });
    });
    return { bg: T.bgLight, els: els };
  };

  // Template slide 74 (66D_LAYOUT_PROCESS_003): blue chevron arrows with the phase names above white text cards
  V['66D_LAYOUT_PROCESS_003'] = function (s) {
    var steps = items_(s, 5), n = steps.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s, { eyebrow: true }) + 4;
    var gap = 8, cw = (CW - gap * (n - 1)) / n, arrowH = 34;
    var hSize = uniformSize(steps.map(function (st) { return st.title; }), cw - 44, 26, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var c3Avail = BOTTOM - (top + arrowH + 12);
    var c3Size = uniformSize(steps.map(function (st) { return st.text; }), cw - 24, c3Avail - 26, { weight: 400, max: TSZ.body, min: TSZ.body });
    var c3Need = 0;
    steps.forEach(function (st) { c3Need = Math.max(c3Need, textH(st.text, cw - 24, c3Size) + 30); });
    var c3H = boxH(c3Need, c3Avail);
    steps.forEach(function (st, i) {
      var x = CX + i * (cw + gap);
      shape(els, i === 0 ? 'HOME_PLATE' : 'CHEVRON', x, top, cw, arrowH, T.ramp[Math.min(i, 4)]);
      text(els, x + (i === 0 ? 10 : 20), top, cw - 44, arrowH, st.title, { weight: 500, max: hSize, min: hSize, maxLines: 2, align: 'center', color: onFill(T.ramp[Math.min(i, 4)]), valign: 'middle' });
      var cy = top + arrowH + 12;
      rect(els, x, cy, cw, c3H, T.white);
      text(els, x + 12, cy + 14, cw - 24, c3H - 26, st.text, { weight: 400, max: c3Size, min: c3Size, color: T.body });
    });
    return { bg: T.bgLight, els: els };
  };

  // Template slide 94 (66D_LAYOUT_PROCESS_004): ascending blue steps with numbers and icons; phase text under each step
  V['66D_LAYOUT_PROCESS_004'] = function (s) {
    var steps = items_(s, 5), n = steps.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s, { eyebrow: true });
    var colW = CW / n, stepH = 24, rise = Math.min(n <= 3 ? 58 : 40, (BOTTOM - top - 150) / Math.max(n - 1, 1));
    var baseY = top + 26 + rise * (n - 1);
    var colors = [T.tints[2], T.tints[1], T.blue, T.ramp[1], T.ramp[2]];
    var hSize = uniformSize(steps.map(function (st) { return st.title; }), colW - 20, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    steps.forEach(function (st, i) {
      var x = CX + i * colW, y = baseY - rise * i;
      var fill = colors[Math.min(i + (5 - n), 4)];
      rect(els, x, y + stepH, colW, 6, T.depth);                           // step depth
      rect(els, x, y, colW, stepH, fill);
      rect(els, x, y, 26, stepH, T.depth);
      text(els, x, y + 5, 26, 14, pad2(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white });
      ring(els, x + colW / 2 - 13, y - 13, 26, T.white, fill, 1.5);
      icon(els, autoIcon(st), x + colW / 2 - 7, y - 7, 14, false);
      var ty = y + stepH + 14;
      var ht = text(els, x + 10, ty, colW - 20, 30, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
      var tby = ty + Math.max(ht.height, 2 * lineHeight('sans', hSize)) + 6;     // room for a two-line title, never overlapping
      text(els, x + 10, tby, colW - 20, BOTTOM - tby, st.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
      if (i < n - 1) dashedLine(els, x + colW, y + stepH + 10, x + colW, BOTTOM, T.cardLine, 0.75, 3, 3);
    });
    return { bg: T.white, els: els };
  };

  // Template slide 99 (66D_LAYOUT_PROCESS_005): chain of ringed circles with icons; labels alternate above and below
  V['66D_LAYOUT_PROCESS_005'] = function (s) {
    var steps = items_(s, 5), n = steps.length;
    if (n < 3 || maxLen(steps, function (st) { return st.text; }) > 170) return null;
    var els = [];
    var top = header(els, s, { eyebrow: true });
    var colW = CW / n, d = Math.min(78, colW - 30), cy = top + (BOTTOM - top) / 2;
    var textW = Math.min(colW * 2 - 16, 230);   // captions on the same side are two columns apart: never wider than that
    var hSize = TSZ.heading;
    steps.forEach(function (st, i) {
      var ccx = CX + colW * i + colW / 2;
      ring(els, ccx - d / 2 - 6, cy - d / 2 - 6, d + 12, T.white, T.blue, 3);
      ellipse(els, ccx - d / 2 + 6, cy - d / 2 + 6, d - 12, d - 12, T.bgLight);
      icon(els, autoIcon(st), ccx - 13, cy - 13, 26, false, pad2(i + 1));
      if (i < n - 1) line(els, ccx + d / 2 + 6, cy, ccx + colW - d / 2 - 6, cy, T.cardLine, 1);
      // Caption centred on its ring; at the slide edges it is narrowed (never shifted into the next caption)
      // Room up to half way to the next caption on the same side (two columns away), or to the slide edge
      var reachL = i >= 2 ? colW - 6 : textW, reachR = i <= n - 3 ? colW - 6 : textW;
      var tl = Math.max(CX, ccx - reachL), tr = Math.min(CX + CW, ccx + reachR);
      var tw = Math.min(tr - tl, textW), tx = Math.max(tl, Math.min(ccx - tw / 2, tr - tw));
      if (i % 2 === 0) {
        var areaTop = top, areaH = cy - d / 2 - 14 - top;
        var bt = fit(String(st.text || ''), tw, areaH - 20, { weight: 400, max: TSZ.body, min: TSZ.body });
        var ht = lineHeight('sans', hSize) * (wrap(String(st.title || ''), tw, 'sans', 500, hSize).length > 1 ? 2 : 1) + 4;
        var y0 = areaTop + areaH - bt.height - ht;
        text(els, tx, y0, tw, ht, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
        text(els, tx, y0 + ht, tw, bt.height, st.text, { weight: 400, max: bt.size, min: bt.size, align: 'center', color: T.body });
      } else {
        var y1 = cy + d / 2 + 14;
        var h1 = text(els, tx, y1, tw, 32, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
        text(els, tx, y1 + h1.height + 4, tw, BOTTOM - y1 - h1.height - 4, st.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
      }
    });
    return { bg: T.white, els: els, center: true };
  };

  /* ---------------- Timeline ---------------- */
  // Template slide 23 (66D_LAYOUT_TIMELINE_001): full-width blue band with period labels; callouts above and below
  V['66D_LAYOUT_TIMELINE_001'] = function (s) {
    var ms = items_(s, 7), n = ms.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s);
    var colW = CW / n, bandH = 18, bandY = top + (BOTTOM - top) / 2 - bandH / 2;
    line(els, CX, bandY - 10, CX + CW, bandY - 10, T.blue, 0.75);
    line(els, CX + CW - 5, bandY - 13, CX + CW, bandY - 10, T.blue, 0.75);
    line(els, CX + CW - 5, bandY - 7, CX + CW, bandY - 10, T.blue, 0.75);
    rect(els, CX, bandY, CW, bandH, T.blue);
    line(els, CX, bandY + bandH + 10, CX + CW, bandY + bandH + 10, T.navy, 0.75);
    var cw = Math.min(colW * 1.8, 200);
    var hSize = uniformSize(ms.map(function (m) { return m.title; }), cw - 16, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    ms.forEach(function (m, i) {
      var ccx = CX + colW * i + colW / 2;
      text(els, ccx - colW / 2 + 2, bandY + 3, colW - 4, 12, m.date || m.label || '', { font: 'mono', weight: 500, max: 10, min: 9, maxLines: 1, align: 'center', color: T.white });
      var x = Math.max(CX, Math.min(ccx - cw / 2, CX + CW - cw));
      var above = i % 2 === 0;
      var room = above ? (bandY - 24 - top) : (BOTTOM - (bandY + bandH + 24));
      var tf = fit(String(m.title || ''), cw - 16, 30, { weight: 700, max: hSize, min: hSize, maxLines: 2 });
      var bf = fit(String(m.text || ''), cw - 16, room - tf.height - 26, { weight: 400, max: 10, min: 10 });
      var bh = Math.min(room, tf.height + bf.height + 26);
      var y = above ? bandY - 24 - bh : bandY + bandH + 24;
      rect(els, x, y, cw, bh, T.panelAlt);
      text(els, x + 8, y + 10, cw - 16, tf.height, m.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
      text(els, x + 8, y + 14 + tf.height, cw - 16, bf.height, m.text, { weight: 400, max: bf.size, min: bf.size, align: 'center', color: T.body });
      if (above) line(els, ccx, y + bh, ccx, bandY - 10, T.blue, 0.75);
      else line(els, ccx, bandY + bandH + 10, ccx, y, T.navy, 0.75);
    });
    return { bg: T.white, els: els };
  };

  // Template slide 97 (66D_LAYOUT_TIMELINE_004): period tabs in a dark-to-light blue ramp joined by a dashed line,
  // numbered dots, outlined cards below with an icon, heading and text
  V['66D_LAYOUT_TIMELINE_004'] = function (s) {
    var ms = items_(s, 5), n = ms.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s) + 4;
    var colW = CW / n, tabW = Math.min(colW - 30, 110), tabH = 34;
    var fills = [T.blue, T.blue, T.blue, T.blue, T.blue];
    var hSize = uniformSize(ms.map(function (m) { return m.title; }), colW - 40, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var t4Avail = BOTTOM - (top + tabH + 20);
    var t4Size = uniformSize(ms.map(function (m) { return m.text; }), colW - 40, t4Avail - 90, { weight: 400, max: TSZ.body, min: TSZ.body });
    var t4Need = 0;
    ms.forEach(function (m) { t4Need = Math.max(t4Need, 52 + 2 * lineHeight('sans', hSize) + textH(m.text, colW - 40, t4Size) + 18); });
    var t4H = boxH(t4Need, t4Avail);
    ms.forEach(function (m, i) {
      var ccx = CX + colW * i + colW / 2, x = ccx - tabW / 2;
      var fill = fills[Math.min(i, 4)];
      rect(els, x - 7, top - 5, tabW, tabH, T.tileGrey);
      rect(els, x, top, tabW, tabH, fill);
      text(els, x + 4, top, tabW - 8, tabH, m.date || m.label || '', { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', valign: 'middle', color: isLight(fill) ? T.ink : T.white });
      if (i < n - 1) dashedLine(els, x + tabW + 2, top + tabH / 2, ccx + colW - tabW / 2 - 9, top + tabH / 2, T.ink, 1, 4, 3);
      ellipse(els, ccx - 8, top + tabH - 8, 16, 16, fill);
      text(els, ccx - 8, top + tabH - 5.5, 16, 11, String(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: isLight(fill) ? T.ink : T.white });
      var cy = top + tabH + 20, cx0 = CX + colW * i + 8, cwid = colW - 16;
      roundrect(els, cx0, cy, cwid, t4H, T.white, { color: T.cardLine, width: 0.75 });
      icon(els, autoIcon(m), ccx - 11, cy + 14, 22, false);
      var ht = text(els, cx0 + 12, cy + 46, cwid - 24, 30, m.title, { weight: 700, max: hSize, min: hSize, maxLines: 2, align: 'center', color: T.ink });
      var by = cy + 46 + Math.max(ht.height, 2 * lineHeight('sans', hSize)) + 6;
      text(els, cx0 + 12, by, cwid - 24, cy + t4H - by - 12, m.text, { weight: 400, max: t4Size, min: t4Size, align: 'center', color: T.body });
    });
    return { bg: T.white, els: els };
  };

  /* ---------------- Stats ---------------- */
  // Template slide 35 (66D_LAYOUT_STATS_001): big centred numbers in white tiles, then a results table
  // (metric | what it means) built from the same items
  V['66D_LAYOUT_STATS_001'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2 || !items.some(function (it) { return it.text; })) return null;
    var els = [];
    var top = header(els, s);
    var gap = 10, tw = (CW - gap * (n - 1)) / n, tileH = 86;
    var vSize = uniformSize(items.map(function (it) { return it.value; }), tw - 20, 40, { font: 'mono', weight: 600, max: 30, min: 16, maxLines: 1 });
    var lSize = uniformSize(items.map(function (it) { return it.label; }), tw - 24, 28, { weight: 500, max: 11, min: 10, maxLines: 2 });
    items.forEach(function (it, i) {
      var x = CX + i * (tw + gap);
      rect(els, x, top, tw, tileH, T.white, { color: T.cardLine, width: 0.75 });
      text(els, x + 10, top + 10, tw - 20, 38, it.value, { font: 'mono', weight: 600, max: vSize, min: vSize, maxLines: 1, align: 'center', color: T.blue });
      // The tile shows its row number, the number and its label; the table explains each number once (by row number)
      text(els, x + 8, top + 6, 24, 12, pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.slate });
      text(els, x + 12, top + 50, tw - 24, 30, it.label, { weight: 500, max: lSize, min: lSize, maxLines: 2, align: 'center', color: T.ink });
    });
    var ty = top + tileH + 14, c0 = 40, c1 = c0, rowsAvail = BOTTOM - ty - 22;
    rect(els, CX, ty, c0 - 2, 20, T.blue);
    rect(els, CX + c1, ty, CW - c1, 20, T.blue);
    text(els, CX + 6, ty + 3.5, c0 - 12, 13, '#', { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    text(els, CX + c1 + 8, ty + 3.5, CW - c1 - 16, 13, 'Why it matters', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    var rSize = uniformSize(items.map(function (it) { return it.text; }), CW - c1 - 16, rowsAvail / n - 8, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3 });
    var rowH = Math.min(rowsAvail / n, Math.max(26, linesBlock(items.map(function (it) { return it.text; }), CW - c1 - 16, rSize, 400, 3) + 12, rowsAvail * 0.75 / n));
    items.forEach(function (it, i) {
      var y = ty + 22 + i * rowH;
      text(els, CX + 6, y, c0 - 12, rowH, pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.blue, valign: 'middle' });
      text(els, CX + c1 + 8, y, CW - c1 - 16, rowH, it.text, { weight: 400, max: rSize, min: rSize, maxLines: 3, color: T.body, valign: 'middle' });
      line(els, CX, y + rowH, CX + CW, y + rowH, T.cardLine, 0.75);
    });
    return { bg: T.bgLight, els: els };
  };

  // Template slide 22 (66D_LAYOUT_CHART_002, stats column): narrative on the left, stacked stats with captions right
  V['66D_LAYOUT_CHART_002'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2) return null;
    var els = [];
    var top = header(els, s);
    var lw = 236, avail = BOTTOM - top;
    var story = s.takeaway || s.lead || '';
    // Left: the statement, centred vertically against the stats, with a blue rule
    var st = fit(String(story || ''), lw - 22, avail - 20, { weight: 500, max: 17, min: 13 });
    var sy = top + Math.max(0, (avail - st.height) / 2);
    rect(els, CX, sy + 2, 4, st.height - 4, T.blue);
    text(els, CX + 20, sy, lw - 22, st.height, story, { weight: 500, max: st.size, min: st.size, color: T.ink });
    // Right: one row per stat - number | bold label + explanation
    var px = CX + lw + 28, pw = CW - lw - 28, rowH = avail / n, numW = 112, tx = px + numW + 14, tw = pw - numW - 14;
    var vSize = uniformSize(items.map(function (it) { return it.value; }), numW, 40, { font: 'mono', weight: 600, max: 28, min: 16, maxLines: 1 });
    items.forEach(function (it, i) {
      var y = top + i * rowH;
      line(els, px, y, px + pw, y, T.cardLine, 0.75);
      text(els, px, y, numW, rowH, it.value, { font: 'mono', weight: 600, max: vSize, min: vSize, maxLines: 1, color: T.blue, valign: 'middle', noFill: true });
      var lh = it.label ? lineHeight('sans', TSZ.heading) + 3 : 0;
      var bh = Math.min(textH(it.text, tw, TSZ.body), rowH - lh - 14);
      var by = y + (rowH - lh - bh) / 2;
      if (it.label) text(els, tx, by, tw, lh, it.label, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      text(els, tx, by + lh, tw, rowH - lh - 14, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true });
    });
    line(els, px, top + avail, px + pw, top + avail, T.cardLine, 0.75);
    return { bg: T.white, els: els };
  };

  /* ---------------- Case study ---------------- */
  // Template slide 80 (66D_LAYOUT_CASE_STUDY_006): industry pill, challenge and solution side by side, "The outcome"
  // pill with results below; a blue impact band on the right (the template's photo is replaced by the key numbers)
  V['66D_LAYOUT_CASE_STUDY_006'] = function (s) {
    var res = arr(s.results, 3);
    if (!res.length) return null;
    var els = [];
    var bandW = 196, bx = W - bandW, lw = bx - CX - 28, colW = (lw - 22) / 2;
    var top = header(els, s, { maxW: bx - X0 - 24 });
    rect(els, bx, 0, bandW, H, T.blue);
    var rowH = (H - 70) / res.length;
    res.forEach(function (r, i) {
      var y = 44 + i * rowH;
      if (i > 0) line(els, bx + 20, y - 8, W - 20, y - 8, T.tints[2], 0.75);
      var v = text(els, bx + 20, y, bandW - 40, 40, r.value, { font: 'mono', weight: 600, max: 30, min: 18, maxLines: 1, color: T.white });
      text(els, bx + 20, y + v.height + 6, bandW - 40, rowH - v.height - 22, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.white });
    });
    var chal = asList(s.challenge).join(' '), sol = asList(s.solution).join(' ');
    var y0 = top;
    if (s.industry || s.client) {
      // The label fits whole: if "INDUSTRY | OFFERING" is too long for the column, only the industry is shown
      var pill = String(s.industry || s.client);                  // sentence case (brand rule: never ALL CAPS)
      var maxPw = Math.min(380, W - 2 * X0 - 200);
      if (textWidth(pill, 'mono', 500, 10) + 26 > maxPw) pill = pill.split('|')[0].trim();
      while (pill.length > 3 && textWidth(pill, 'mono', 500, 10) + 26 > maxPw) pill = pill.replace(/\s*\S+$/, '');
      var pwid = Math.min(maxPw, textWidth(pill, 'mono', 500, 10) + 26);
      rect(els, CX, y0, pwid, 20, T.blue);
      text(els, CX + 9, y0 + 4, pwid - 18, 12, pill, { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
      y0 += 28;
    }
    var bSize = uniformSize([chal, sol], colW, BOTTOM - y0 - 120, { weight: 400, max: TSZ.body, min: TSZ.body });
    [[s.challenge_label || 'Business challenge', chal], [s.solution_label || 'Solution delivered', sol]].forEach(function (c, i) {
      var x = CX + i * (colW + 22);
      text(els, x, y0, colW, 16, c[0], { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      text(els, x, y0 + 22, colW, BOTTOM - y0 - 120, c[1], { weight: 400, max: bSize, min: bSize, color: T.body });
    });
    var outcome0 = s.outcome || res.map(function (r) { return r.label; }).slice(0, 2).join('. ');
    var oh = textH(outcome0, lw, 11.5);
    var used = Math.max(textH(chal, colW, bSize), textH(sol, colW, bSize));
    var oy = Math.max(y0 + 22 + used + 20, BOTTOM - oh - 30);
    rect(els, CX, oy, 116, 20, T.blue);
    text(els, CX + 9, oy + 4, 100, 12, 'The outcome', { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    var outcome = outcome0;
    text(els, CX, oy + 26, lw, BOTTOM - oy - 26, outcome, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.body });
    return { bg: T.white, els: els };
  };

  // Template slide 16 (66D_LAYOUT_CASE_STUDY_002): client journey. Panel band with a blue line, numbered dots,
  // phase name and offering; under each phase: industry, business challenge and "business value unlocked"
  // (blue headline number + text on a blue rule). spec.cases = [{ phase, offering, industry, challenge, value_headline, value }]
  V['66D_LAYOUT_CASE_STUDY_002'] = function (s) {
    var cases = arr(s.cases, 4).filter(function (c) { return c && (c.challenge || c.value || c.value_headline); });
    var n = cases.length;
    if (n < 2) return null;
    var els = [];
    var top = header(els, s) - 4;
    var colW = CW / n, iw = colW - 18, bandH = 60, ly = top + 28;
    // Phase band: blue line through numbered dots, phase name above the line, offering below it
    rect(els, 0, top, W, bandH, T.bgLight);
    line(els, 0, ly, W, ly, T.blue, 1);
    var pSize = uniformSize(cases.map(function (c) { return c.phase; }), iw - 20, 22, { weight: 600, max: 16, min: 12, maxLines: 1 });
    cases.forEach(function (c, i) {
      var x = CX + i * colW;
      ellipse(els, x - 4, ly - 10, 20, 20, T.blue);
      text(els, x - 4, ly - 5.5, 20, 12, String(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white, noFill: true });
      text(els, x + 24, ly - 26, iw - 20, 22, c.phase || '', { weight: 600, max: pSize, min: pSize, maxLines: 1, color: T.ink });
      text(els, x + 24, ly + 7, iw - 16, 32, c.offering || '', { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink, noFill: true });
    });
    // Columns: industry, business challenge, business value unlocked (blocks aligned across all columns)
    var y0 = top + bandH + 12;
    var inds = cases.map(function (c) { return c.industry ? 'Industry: ' + c.industry : ''; });
    var iBlock = linesBlock(inds, iw, TSZ.heading, 600, 2);
    var lh = lineHeight('sans', TSZ.body);
    var chH = 0;
    cases.forEach(function (c) { chH = Math.max(chH, textH(c.challenge, iw, TSZ.body)); });
    var cy = y0 + iBlock + 10;
    var vy = cy + 18 + Math.min(chH, 4 * lh) + 14;
    cases.forEach(function (c, i) {
      var x = CX + i * colW;
      if (inds[i]) text(els, x, y0, iw, iBlock, inds[i], { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      text(els, x, cy, iw, 16, 'Business challenge', { weight: 600, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      text(els, x, cy + 18, iw, vy - cy - 32, c.challenge, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true });
      var headline = String(c.value_headline || '').trim(), rest = String(c.value || '').trim();
      var sep = /[.!?:]$/.test(headline) ? ' ' : '. ';
      var body = headline ? headline + (rest ? sep + rest.charAt(0).toUpperCase() + rest.slice(1) : '') : rest;
      var vText = fit(body, iw - 12, BOTTOM - vy - 18, { weight: 400, max: TSZ.body, min: TSZ.body });
      rect(els, x - 8, vy, 1.5, 18 + vText.height + 2, T.blue);
      text(els, x + 4, vy, iw, 16, 'Business value unlocked', { weight: 600, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      text(els, x + 4, vy + 18, iw - 12, BOTTOM - vy - 18, body, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true,
        auditText: rest, auditOffset: headline ? headline.length + sep.length : 0,
        runs: headline ? [{ start: 0, end: headline.length, color: T.blue, weight: 600 }] : null });
    });
    return { bg: T.white, els: els };
  };

  /* ---------------- Comparison ---------------- */
  // Template slide 65 (66D_LAYOUT_COMPARISON_006): two white cards with blue header bars; left rows ticked, right rows
  // with arrows (the "from -> to" or "without -> with" comparison)
  V['66D_LAYOUT_COMPARISON_006'] = function (s) {
    var left = s.left || {}, right = s.right || {};
    var lp = arr(left.points, 7).map(str).filter(Boolean), rp = arr(right.points, 7).map(str).filter(Boolean);
    if (!lp.length || !rp.length) return null;
    var els = [];
    var top = header(els, s);
    var gap = 22, pw = (CW - gap) / 2, avail = BOTTOM - top, hh = 26;
    var nRows = Math.max(lp.length, rp.length);
    var pSize = uniformSize(lp.concat(rp), pw - 52, (avail - hh - 24) / nRows - 10, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3 });
    var rowH = Math.min((avail - hh - 24) / nRows, linesBlock(lp.concat(rp), pw - 52, pSize, 400, 3) + 16);
    var ph = boxH(hh + 14 + rowH * nRows + 10, avail);
    [[left, lp, 'cross'], [right, rp, 'check']].forEach(function (c, k) {
      var x = CX + k * (pw + gap);
      rect(els, x, top, pw, ph, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, x, top, pw, hh, T.blue);
      text(els, x + 12, top, pw - 24, hh, headerText(c[0], pw - 24), { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      c[1].forEach(function (pt, i) {
        var y = top + hh + 14 + i * rowH, my = y + lineHeight('sans', pSize) / 2;
        if (c[2] === 'check') {
          line(els, x + 18, my, x + 22, my + 4, T.green, 1.5);
          line(els, x + 22, my + 4, x + 29, my - 4, T.green, 1.5);
        } else {
          line(els, x + 19, my - 4, x + 27, my + 4, T.red, 1.5);
          line(els, x + 19, my + 4, x + 27, my - 4, T.red, 1.5);
        }
        text(els, x + 40, y, pw - 52, rowH, pt, { weight: 400, max: pSize, min: pSize, maxLines: 3, color: T.body });
      });
    });
    return { bg: T.bgLight, els: els };
  };

  // Designs Reference.gs may choose from, per slide type, with the item counts each one handles.
  // The first entry of each type is its default layout (L[type]).

  /* ================= TEMPLATE DESIGNS: CARDS (batch 1, template slides 25-72) ================= */

  // Cell rectangles for a grid of n items in `cols` columns; rows share the height (each at least the content need)
  function gridCells(n, cols, x0, y0, w, availH, gapX, gapY, need) {
    var rows = Math.ceil(n / cols), cw = (w - gapX * (cols - 1)) / cols;
    var rowAvail = (availH - gapY * (rows - 1)) / rows;
    var ch = boxH(need, rowAvail);
    var cells = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      var inRow = Math.min(cols, n - r * cols);
      var off = (cols - inRow) * (cw + gapX) / 2;                      // a short last row is centred
      cells.push({ x: x0 + off + c * (cw + gapX), y: y0 + r * (ch + gapY), w: cw, h: ch });
    }
    return cells;
  }
  // Content need of one card: heading block + gap + body + padding
  function cardNeed(items, iw, hBlock, extra) {
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, (extra || 0) + hBlock + 14 + textH(it.text, iw, TSZ.body) + 26 + hlNeed(items, iw, TSZ.body)); });
    return need;
  }
  function headBlock(items, iw, maxLines) {
    return linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, maxLines || 2);
  }
  // Dark image band across the top (template slides 57-61): the section photo shows in the band, title in white
  function bandHeader(els, s) {
    var bandH = 92;
    if (AUDIT && s.title && wrap(String(s.title), W - 2 * X0, 'sans', 500, 20).length > 1) {
      AUDIT.push({ text: String(s.title), truncated: true, maxChars: 58, fill: 1, lines: 1, body: false, isTitle: true });
    }
    var t = text(els, X0, 24, HEADER_MAX_W || (W - 2 * X0), 28, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    if (s.lead || s.subtitle) text(els, X0, 24 + t.height + 4, W - 2 * X0 - 60, 28, s.lead || s.subtitle, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.white });
    rect(els, 0, bandH, W, H - bandH, T.bgLight);
    return bandH + 18;
  }

  // Slide 25 (CARDS_004): 4 x 2 grid, cards alternate white and Shark Grey, icon top-right
  V['66D_LAYOUT_CARDS_004'] = function (s) {
    var items = items_(s, 8), n = items.length;
    if (n < 6) return null;
    var els = [];
    var top = header(els, s);
    var cols = 4, iw = (CW - 3 * 8) / cols - 36;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 8, 8, cardNeed(items, iw + 12, hBlock, 16));
    items.forEach(function (it, i) {
      var c = cells[i], r = Math.floor(i / cols);
      var fill = (i + r) % 2 === 0 ? T.white : T.slate;
      rect(els, c.x, c.y, c.w, c.h, fill, fill === T.white ? { color: T.cardLine, width: 0.75 } : null);
      icon(els, autoIcon(it), c.x + c.w - 26, c.y + 12, 14, false);
      text(els, c.x + 12, c.y + 12, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      text(els, c.x + 12, c.y + 18 + hBlock, c.w - 24, c.h - hBlock - 28, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
    });
    return { bg: T.white, els: els };
  };

  // Slide 40 (CARDS_005): grey backdrop holding a 2 x 2 of white cards with a "+" where they meet, feature card right
  V['66D_LAYOUT_CARDS_005'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 4) return null;
    var els = [];
    var top = header(els, s);
    var feat = n === 5 ? items[4] : null, grid = items.slice(0, 4);
    var fw = feat ? 190 : 0, gw = CW - fw - (feat ? 10 : 0);
    var iw = gw / 2 - 40;
    var hBlock = headBlock(grid, iw, 2);
    var need = cardNeed(grid, iw, hBlock, 18);
    var avail = BOTTOM - top;
    var ch = boxH(need, (avail - 24 - 8) / 2), cw = (gw - 24 - 8) / 2;
    rect(els, CX, top, gw, 2 * ch + 8 + 24, T.bgLight);
    grid.forEach(function (it, i) {
      var x = CX + 12 + (i % 2) * (cw + 8), y = top + 12 + Math.floor(i / 2) * (ch + 8);
      rect(els, x, y, cw, ch, T.white);
      text(els, x + 16, y + 16, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.blue });
      text(els, x + 16, y + 22 + hBlock, cw - 32, ch - hBlock - 34, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    });
    var px = CX + 12 + cw + 4, py = top + 12 + ch + 4;                   // the "+" where the four cards meet
    line(els, px - 6, py, px + 6, py, T.slate, 1);
    line(els, px, py - 6, px, py + 6, T.slate, 1);
    if (feat) {
      var fx = CX + gw + 10, fh = 2 * ch + 8 + 24;
      rect(els, fx, top, fw, fh, T.panelAlt);
      text(els, fx + 18, top + 28, fw - 36, 40, feat.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 3, color: T.blue });
      text(els, fx + 18, top + 72, fw - 36, fh - 90, feat.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    }
    return { bg: T.white, els: els };
  };

  // Slide 43 (CARDS_008): 3 x 2 panel cards, heading with a line-art icon at the right, divider, body
  V['66D_LAYOUT_CARDS_008'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 4) return null;
    var els = [];
    var top = header(els, s);
    var cols = n === 4 ? 2 : 3, cw0 = (CW - 10 * (cols - 1)) / cols, iw = cw0 - 60;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 10, 10, cardNeed(items, cw0 - 28, hBlock, 26));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.bgLight);
      text(els, c.x + 14, c.y + 14, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      ring(els, c.x + c.w - 40, c.y + 10, 26, T.bgLight, T.slate, 0.75);
      icon(els, autoIcon(it), c.x + c.w - 34, c.y + 16, 14, false);
      var dy = c.y + 20 + Math.max(hBlock, 22);
      line(els, c.x + 14, dy, c.x + c.w - 14, dy, T.cardLine, 0.75);
      cardBody(els, c.x + 14, dy + 10, c.w - 28, c.y + c.h - dy - 20, it, TSZ.body, items);
    });
    return { bg: T.white, els: els };
  };

  // Slide 44 (CARDS_009): as slide 43 with a short intro and bullet points in every card (items[].points)
  V['66D_LAYOUT_CARDS_009'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 3 || !items.every(function (it) { return Array.isArray(it.points) && it.points.length >= 2; })) return null;
    var els = [];
    var top = header(els, s);
    var cols = 3, cw0 = (CW - 20) / cols, iw = cw0 - 60;
    var hBlock = headBlock(items, iw, 2);
    var need = 0;
    items.forEach(function (it) {
      var ph = 0;
      arr(it.points, 5).forEach(function (p) { ph += textH(str(p), cw0 - 44, TSZ.body) + 4; });
      need = Math.max(need, 40 + hBlock + textH(it.text, cw0 - 28, TSZ.body) + ph + 20);
    });
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 10, 10, need);
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.bgLight);
      text(els, c.x + 14, c.y + 12, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      icon(els, autoIcon(it), c.x + c.w - 32, c.y + 12, 16, false);
      var y = c.y + 18 + hBlock;
      if (it.text) { var tt = text(els, c.x + 14, y, c.w - 28, 40, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.body }); y += tt.height + 6; }
      bulletList(els, c.x + 14, y, c.w - 28, c.y + c.h - y - 10, arr(it.points, 5).map(str), { max: TSZ.body, min: TSZ.body, gap: 3 });
    });
    return { bg: T.white, els: els };
  };

  // Slide 45 (CARDS_010): two panel cards with a mono eyebrow pill, a heading, then "Challenge" and "Benefit" paragraphs
  V['66D_LAYOUT_CARDS_010'] = function (s) {
    var items = items_(s, 2);
    if (items.length !== 2 || !items.every(function (it) { return it.challenge && it.benefit; })) return null;
    var els = [];
    var top = header(els, s);
    var cw = (CW - 12) / 2, iw = cw - 36;
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 70 + textH(it.title, iw, TSZ.heading) + textH(it.challenge, iw, TSZ.body) + textH(it.benefit, iw, TSZ.body) + 60); });
    var ch = boxH(need, BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + 12), y = top;
      rect(els, x, y, cw, ch, T.bgLight);
      var lab = String(it.label || it.eyebrow || '').slice(0, 34);
      if (lab) text(els, x + 18, y + 20, cw - 36, 13, lab, { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.blue });
      var yy = y + (lab ? 50 : 20);
      var h = text(els, x + 18, yy, iw, 34, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      yy += h.height + 12;
      [['Challenge', it.challenge], ['Benefit', it.benefit]].forEach(function (pair) {
        text(els, x + 18, yy, iw, 14, pair[0], { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
        var b = text(els, x + 18, yy + 15, iw, 90, pair[1], { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 6, color: T.body });
        yy += 15 + b.height + 12;
      });
    });
    return { bg: T.white, els: els };
  };

  // Slide 46 (CARDS_011): two tall panels with a heading and a longer paragraph
  V['66D_LAYOUT_CARDS_011'] = function (s) {
    var items = items_(s, 2);
    if (items.length !== 2) return null;
    var els = [];
    var top = header(els, s);
    var cw = (CW - 14) / 2, iw = cw - 44;
    var hBlock = headBlock(items, iw, 2);
    var ch = boxH(cardNeed(items, iw, hBlock, 30), BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + 14);
      rect(els, x, top, cw, ch, T.bgLight);
      text(els, x + 22, top + 26, iw, hBlock, it.title, { weight: 500, max: TSZ.heading + 1, min: TSZ.heading, maxLines: 2, color: T.ink });
      cardBody(els, x + 22, top + 36 + hBlock, iw, ch - hBlock - 56, it, TSZ.body, items);
    });
    return { bg: T.white, els: els };
  };

  // Slide 54 (CARDS_014): panel background, dark image strip on the right, three white cards with icon and blue title
  V['66D_LAYOUT_CARDS_014'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    rect(els, 0, 0, 512, H, T.bgLight);                            // panel over the left of the photo background
    var top = header(els, s, { maxW: 470 });
    var cw = 150, gap = 10, iw = cw - 28;
    var hBlock = headBlock(items, iw, 2);
    var ch = boxH(cardNeed(items, iw, hBlock, 40), BOTTOM - top - 10);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = top + 10;
      rect(els, x, y, cw, ch, T.white);
      icon(els, autoIcon(it), x + 14, y + 14, 16, false);
      text(els, x + 14, y + 42, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.blue });
      cardBody(els, x + 14, y + 50 + hBlock, iw, ch - hBlock - 62, it, TSZ.body, items);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 58 (CARDS_016): dark image band with the title, four white cards with a blue number, title, divider, body
  V['66D_LAYOUT_CARDS_016'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 3) return null;
    var els = [];
    var top = bandHeader(els, s);
    var gap = 10, cw = (CW - gap * (n - 1)) / n, iw = cw - 28;
    var hBlock = headBlock(items, iw, 2);
    var ch = boxH(cardNeed(items, iw, hBlock, 50), BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white);
      text(els, x + 14, top + 12, iw, 22, pad2(i + 1), { font: 'mono', weight: 500, max: 16, min: 16, maxLines: 1, color: T.blue });
      text(els, x + 14, top + 38, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      var dy = top + 44 + hBlock;
      line(els, x + 14, dy, x + cw - 14, dy, T.cardLine, 0.75);
      cardBody(els, x + 14, dy + 10, iw, top + ch - dy - 20, it, TSZ.body, items);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 61 (CARDS_017): dark image band, rule cards (blue left bar, icon, bold title, body) staggered 3 + 2
  V['66D_LAYOUT_CARDS_017'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 4) return null;
    var els = [];
    var top = bandHeader(els, s);
    var cols = n === 4 ? 2 : 3, cw0 = (CW - 12 * (cols - 1)) / cols, iw = cw0 - 30;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 12, 10, cardNeed(items, iw, hBlock, 36));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.white);
      rect(els, c.x, c.y, 3.5, c.h, T.blue);
      icon(els, autoIcon(it), c.x + 16, c.y + 10, 14, false);
      text(els, c.x + 16, c.y + 30, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      cardBody(els, c.x + 16, c.y + 36 + hBlock, iw, c.h - hBlock - 46, it, TSZ.body, items);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 63 (CARDS_019): four tall panel cards, blue title, icon top-right, divider, body
  V['66D_LAYOUT_CARDS_019'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s);
    var gap = 8, cw = (CW - gap * (n - 1)) / n, iw = cw - 52;
    var hBlock = headBlock(items, iw, 3);
    var ch = boxH(cardNeed(items, cw - 28, hBlock, 30), BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.bgLight);
      text(els, x + 14, top + 16, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 3, color: T.blue });
      icon(els, autoIcon(it), x + cw - 30, top + 16, 16, false);
      var dy = top + 24 + hBlock;
      line(els, x + 14, dy, x + cw - 14, dy, T.cardLine, 0.75);
      cardBody(els, x + 14, dy + 12, cw - 28, top + ch - dy - 24, it, TSZ.body, items);
    });
    return { bg: T.white, els: els };
  };

  // Slide 64 (CARDS_020): 4 x 2 grid of outlined cards, bold title, icon top-right, body
  V['66D_LAYOUT_CARDS_020'] = function (s) {
    var items = items_(s, 8), n = items.length;
    if (n < 6) return null;
    var els = [];
    var top = header(els, s);
    var cols = 4, cw0 = (CW - 24) / cols, iw = cw0 - 44;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 8, 8, cardNeed(items, cw0 - 24, hBlock, 16));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.white, { color: T.cardLine, width: 0.75 });
      text(els, c.x + 12, c.y + 12, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      ring(els, c.x + c.w - 30, c.y + 9, 20, T.bgLight, T.bgLight, 0.5);
      icon(els, autoIcon(it), c.x + c.w - 26, c.y + 13, 12, false);
      cardBody(els, c.x + 12, c.y + 18 + hBlock, c.w - 24, c.h - hBlock - 28, it, TSZ.body, items);
    });
    return { bg: T.white, els: els };
  };

  // Slide 67 (CARDS_021): 3 x 2 outlined cards, each with a blue header tab carrying the title
  V['66D_LAYOUT_CARDS_021'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 4) return null;
    var els = [];
    var top = header(els, s);
    var cols = n === 4 ? 2 : 3, cw0 = (CW - 14 * (cols - 1)) / cols;
    var tabH = 22 + (items.some(function (it) { return wrap(String(it.title), cw0 - 24, 'sans', 500, TSZ.heading).length > 1; }) ? 13 : 0);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 14, 12, cardNeed(items, cw0 - 24, tabH, 4));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, c.x, c.y, c.w, tabH, T.blue);
      text(els, c.x + 12, c.y + 2, c.w - 24, tabH - 4, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
      cardBody(els, c.x + 12, c.y + tabH + 10, c.w - 24, c.h - tabH - 20, it, TSZ.body, items);
    });
    return { bg: T.white, els: els };
  };

  // Slide 71 (CARDS_023): panel background, four white rule cards (2 x 2) and a full-width slate footer bar (takeaway)
  V['66D_LAYOUT_CARDS_023'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n !== 4) return null;
    var els = [];
    var top = header(els, s);
    var foot = s.takeaway || s.callout && (s.callout.text || s.callout.title) || '';
    var footH = foot ? 26 : 0;
    var cw0 = (CW - 14) / 2, iw = cw0 - 60;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, 2, CX, top, CW, BOTTOM - top - (foot ? footH + 10 : 0), 14, 10, cardNeed(items, cw0 - 32, hBlock, 16));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.white);
      rect(els, c.x, c.y, 3.5, c.h, T.blue);
      text(els, c.x + 18, c.y + 12, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      icon(els, autoIcon(it), c.x + c.w - 30, c.y + 12, 16, false);
      cardBody(els, c.x + 18, c.y + 18 + hBlock, c.w - 34, c.h - hBlock - 28, it, TSZ.body, items);
    });
    if (foot) {
      var fy = cells[3].y + cells[3].h + 10;
      rect(els, CX, fy, CW, footH, T.slate);
      text(els, CX + 12, fy, CW - 24, footH, foot, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    }
    return { bg: T.bgLight, els: els };
  };

  // Slide 72 (CARDS_024): eyebrow pill, 2 x 2 white cards with a blue "!" badge, bold title, body (problems, risks)
  V['66D_LAYOUT_CARDS_024'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2) return null;
    var els = [];
    image(els, 'band-pattern', 626, 10, 82, 40);
    var top = header(els, s, { maxW: 580 }) + 6;
    var cols = n <= 2 ? n : 2, cw0 = (CW - 14) / cols, iw = cw0 - 58;
    var hBlock = headBlock(items, iw, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, 14, 12, cardNeed(items, cw0 - 34, hBlock, 18));
    items.forEach(function (it, i) {
      var c = cells[i];
      rect(els, c.x, c.y, c.w, c.h, T.white, { color: T.cardLine, width: 0.75 });
      ellipse(els, c.x + 14, c.y + 14, 18, 18, T.blue);
      // V.1_35: the badge carries the card's own icon (white on blue); "!" only when no icon can be found
      icon(els, autoIcon(it), c.x + 17, c.y + 17, 12, true, '!');
      text(els, c.x + 42, c.y + 14, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      cardBody(els, c.x + 14, c.y + 22 + Math.max(hBlock, 18), c.w - 28, c.h - hBlock - 34, it, TSZ.body, items);
    });
    return { bg: T.bgLight, els: els };
  };


  /* ================= TEMPLATE DESIGNS: DIAGRAMS (batch 2, template slides 81, 89, 92-104) ================= */

  // Ring segment / pie wedge (drawn from the arc kit in Google Slides). sweep must be one of 30, 36, 45, 60, 72, 90, 120, 180.
  function arc(els, kind, cx, cy, r, sweep, start, fill) { els.push({ t: 'arc', kind: kind, cx: cx, cy: cy, r: r, sweep: sweep, start: start, fill: fill }); }
  // Box turned by `rot` degrees around its centre
  function rbox(els, cx, cy, w, h, rot, fill) { els.push({ t: 'rect', x: cx - w / 2, y: cy - h / 2, w: w, h: h, fill: fill, rot: rot }); }
  var DIA_FILLS = function () { return [T.blue, T.ink, T.slate, T.blue, T.ink, T.slate, T.blue, T.ink]; };
  // Title + short text block, aligned left / right / centre; returns its height
  function caption(els, x, y, w, it, align, maxLines) {
    var h = text(els, x, y, w, 34, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: align, color: T.ink });
    var b = it.text ? text(els, x, y + h.height + 2, w, 60, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: maxLines || 3, align: align, color: T.body }) : { height: 0 };
    return h.height + 2 + b.height;
  }
  function capH(it, w, maxLines) {
    return lineHeight('sans', TSZ.heading) * Math.min(2, wrap(String(it.title || ''), w, 'sans', 500, TSZ.heading).length) + 2 +
      (it.text ? Math.min(maxLines || 3, wrap(String(it.text), w, 'sans', 400, TSZ.body).length) * lineHeight('sans', TSZ.body) : 0);
  }

  // Slide 92 (DIAGRAM_001): hub and spoke. Centre label with icon, numbered blue circles in a ring, captions outside
  V['66D_LAYOUT_DIAGRAM_001'] = function (s) {
    var items = items_(s, 8), n = items.length;
    if (n < 5) return null;
    var els = [];
    var top = header(els, s);
    var cx = W / 2, cy = top + (BOTTOM - top) / 2, R = Math.min(96, (BOTTOM - top) / 2 - 26), d = 36, capW = 170;
    ellipse(els, cx - R - 34, cy - R - 34, 2 * R + 68, 2 * R + 68, T.bgLight);
    ellipse(els, cx - 46, cy - 46, 92, 92, T.white);
    icon(els, autoIcon({ title: s.center || s.title }), cx - 10, cy - 34, 20, false);
    text(els, cx - 44, cy - 10, 88, 40, s.center || '', { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', color: T.ink });
    // Circles start half a step past 12 o'clock, so captions split evenly into a left and a right column
    var cols = { left: [], right: [] };
    items.forEach(function (it, i) {
      var a = -Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      ellipse(els, x - d / 2, y - d / 2, d, d, T.blue);
      text(els, x - d / 2, y - 7, d, 14, pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white, noFill: true });
      var c = Math.cos(a);
      var side = c > 0.01 ? 'right' : c < -0.01 ? 'left' : (cols.left.length < cols.right.length ? 'left' : 'right');
      cols[side].push({ it: it, y: y, i: i });
    });
    // Each column: captions in circle order, kept apart (no overlaps) and inside the content area
    ['left', 'right'].forEach(function (side) {
      var list = cols[side].sort(function (a, b) { return a.y - b.y; });
      var cw2 = side === 'right' ? CX + CW - (cx + R + 44) : (cx - R - 44) - CX;
      cw2 = Math.min(capW, cw2);
      var hs = list.map(function (e) { return capH(e.it, cw2, 2); });
      var ys = list.map(function (e, k) { return e.y - hs[k] / 2; });
      for (var k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + hs[k - 1] + 8);
      var over = ys.length ? ys[ys.length - 1] + hs[hs.length - 1] - BOTTOM : 0;
      if (over > 0) ys = ys.map(function (v) { return v - over; });
      for (k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k], top + (k ? ys[k - 1] - top + hs[k - 1] + 8 : 0));
      list.forEach(function (e, k) {
        if (side === 'right') caption(els, cx + R + 44, ys[k], cw2, e.it, 'left', 3);
        else caption(els, cx - R - 44 - cw2, ys[k], cw2, e.it, 'right', 3);
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 93 (DIAGRAM_002): three numbered diagonal bars on the right, the three points as text rows on the left
  V['66D_LAYOUT_DIAGRAM_002'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    rect(els, CX, top, CW, BOTTOM - top, T.white, { color: T.cardLine, width: 0.75 });
    var lw = 300, rowH = (BOTTOM - top - 30) / 3, fills = DIA_FILLS();
    items.forEach(function (it, i) {
      caption(els, CX + 22, top + 18 + i * rowH, lw, it, 'left', 3);
      var bx = 470 + i * 64, by = top + 120 + i * 30;
      rbox(els, bx, by, 250, 46, -45, fills[i]);
      var ex = bx + 92 * Math.cos(-Math.PI / 4), ey = by + 92 * Math.sin(-Math.PI / 4);
      ellipse(els, ex - 17, ey - 17, 34, 34, T.white);
      text(els, ex - 17, ey - 7, 34, 14, pad2(i + 1), { font: 'mono', weight: 500, max: 11, min: 11, maxLines: 1, align: 'center', color: fills[i] === T.slate ? T.ink : fills[i], noFill: true });
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 95 (DIAGRAM_003): three-tier pyramid in the centre, numbered connectors to the three groups (right, left, right)
  V['66D_LAYOUT_DIAGRAM_003'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    rect(els, CX, top, CW, BOTTOM - top, T.white, { color: T.cardLine, width: 0.75 });
    var cx = W / 2, th = Math.min(62, (BOTTOM - top - 50) / 3), widths = [96, 176, 256], fills = [T.blue, T.ink, T.slate];
    var py = top + (BOTTOM - top - 3 * th - 12) / 2;
    items.forEach(function (it, i) {
      var y = py + i * (th + 6), w = widths[i];
      rect(els, cx - w / 2, y, w, th, fills[i]);
      var side = i === 1 ? -1 : 1;                                   // tier 1 right, tier 2 left, tier 3 right
      var ex = cx + side * (w / 2), lx = cx + side * (w / 2 + 28);   // number badge just beyond the tier: more room for the caption
      line(els, ex, y + th / 2, lx, y + th / 2, T.cardLine, 0.75);
      rect(els, lx - 9, y + th / 2 - 9, 18, 18, T.slate);
      text(els, lx - 9, y + th / 2 - 7, 18, 14, String(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.ink, noFill: true });
      var capW = Math.min(210, side > 0 ? CX + CW - 8 - (lx + 16) : (lx - 16) - (CX + 8));
      var tx = side > 0 ? lx + 16 : lx - 16 - capW;
      var lines = asList(it.points).slice(0, 5);
      var body = lines.length ? lines.map(function (p) { return '• ' + p; }).join('\n') : it.text;
      var capIt = { title: it.title, text: body }, chh = capH(capIt, capW, 5);
      caption(els, tx, Math.min(Math.max(top + 10, y + th / 2 - 16), BOTTOM - 6 - chh), capW, capIt, side > 0 ? 'left' : 'right', 5);
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 96 (DIAGRAM_004): two light side panels and a raised grey centre panel; icon, title, text, number badge
  V['66D_LAYOUT_DIAGRAM_004'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    var sw = 190, cw = 220, gap = 10, x0 = (W - (2 * sw + cw + 2 * gap)) / 2, iw = sw - 32;
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 52 + 2 * lineHeight('sans', TSZ.heading) + textH(it.text, iw, TSZ.body) + 62); });
    var h = boxH(need, BOTTOM - top - 20);
    var order = [0, 1, 2], xs = [x0, x0 + sw + gap, x0 + sw + cw + 2 * gap];
    order.forEach(function (k, pos) {
      var it = items[k], center = pos === 1, w = center ? cw : sw, x = xs[pos];
      var y = center ? top : top + 14, hh = center ? h + 20 : h - 8;
      rect(els, x, y, w, hh, center ? T.slate : T.bgLight);
      icon(els, autoIcon(it), x + w / 2 - 11, y + 20, 22, false);
      var tt = text(els, x + 16, y + 52, w - 32, 34, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: 'center', color: T.ink });
      var tth = Math.max(tt.height, 2 * lineHeight('sans', TSZ.heading));
      text(els, x + 16, y + 58 + tth, w - 32, hh - 58 - tth - 46, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.ink });
      ellipse(els, x + w / 2 - 13, y + hh - 34, 26, 26, T.blue);
      text(els, x + w / 2 - 13, y + hh - 28, 26, 14, pad2(k + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white, noFill: true });
    });
    return { bg: T.white, els: els };
  };

  // Slide 98 (DIAGRAM_005): wave of blue circles (alternating up and down) with icons; captions above and below
  V['66D_LAYOUT_DIAGRAM_005'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 4) return null;
    var els = [];
    var top = header(els, s);
    var colW = CW / n, d = Math.min(78, colW - 22), cy = top + (BOTTOM - top) / 2, off = 26, capW = Math.min(colW * 1.25, 170);
    var pts = items.map(function (it, i) { return { x: CX + colW * i + colW / 2, y: cy + (i % 2 ? off : -off) }; });
    pts.forEach(function (p, i) { if (i < n - 1) line(els, p.x, p.y, pts[i + 1].x, pts[i + 1].y, T.blue, 16); });
    items.forEach(function (it, i) {
      var p = pts[i];
      ellipse(els, p.x - d / 2, p.y - d / 2, d, d, T.blue);
      ellipse(els, p.x - d / 2 + 9, p.y - d / 2 + 9, d - 18, d - 18, T.white);
      icon(els, autoIcon(it), p.x - 12, p.y - 12, 24, false, pad2(i + 1));
      var ch = capH(it, capW, 3), tx = Math.max(CX, Math.min(p.x - capW / 2, CX + CW - capW));
      if (i % 2 === 0) caption(els, tx, p.y - d / 2 - 12 - ch, capW, it, 'center', 3);
      else caption(els, tx, p.y + d / 2 + 12, capW, it, 'center', 3);
    });
    return { bg: T.white, els: els, center: true };
  };

  // Slide 101 (DIAGRAM_006): intro on the left, half donut split into segments with icons, captions on the right
  V['66D_LAYOUT_DIAGRAM_006'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 4) return null;
    var sweep = 180 / n;
    if ([30, 36, 45, 60].indexOf(sweep) === -1) return null;
    var els = [];
    // The intro sits on the left: the lead is shown there OR under the title, never twice
    var intro = s.text || s.lead || '';
    var top = header(els, (!s.text && s.lead) ? Object.assign({}, s, { lead: '', subtitle: '' }) : s);
    var cx = 300, cy = top + (BOTTOM - top) / 2, r = Math.min(118, (BOTTOM - top) / 2 - 6), fills = DIA_FILLS();
    if (intro) text(els, CX, cy - 60, 170, 130, intro, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, valign: 'middle' });
    ellipse(els, cx - r * 0.64, cy - r * 0.64, r * 1.28, r * 1.28, T.bgLight);
    text(els, cx - 40, cy - 14, 64, 28, s.center || '', { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', color: T.ink });
    var capX = cx + r + 40, capW = CX + CW - capX, rowH = (BOTTOM - top) / n;
    items.forEach(function (it, i) {
      var start = -90 + i * sweep, mid = (start + sweep / 2) * Math.PI / 180;
      arc(els, 'ring', cx, cy, r, sweep, start, fills[i % 3]);
      icon(els, autoIcon(it), cx + r * 0.82 * Math.cos(mid) - 9, cy + r * 0.82 * Math.sin(mid) - 9, 18, fills[i % 3] !== T.slate, pad2(i + 1));
      var ty = top + i * rowH + (rowH - capH(it, capW, 3)) / 2;
      line(els, cx + (r + 6) * Math.cos(mid), cy + (r + 6) * Math.sin(mid), capX - 8, ty + 7, T.cardLine, 0.75);
      caption(els, capX, ty, capW, it, 'left', 3);
    });
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 102 (DIAGRAM_007): radial fan. Wedges grow around a half circle, captions placed around the fan
  V['66D_LAYOUT_DIAGRAM_007'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    var sweep = 180 / n;
    if ([36, 45, 60].indexOf(sweep) === -1) return null;
    var els = [];
    var top = header(els, s);
    var cx = W / 2, cy = BOTTOM - 28, fills = DIA_FILLS(), capW = 170;
    items.forEach(function (it, i) {
      var r = 92 + i * 12, start = 180 + i * sweep, mid = (start + sweep / 2) * Math.PI / 180;
      arc(els, 'pie', cx, cy, r, sweep, start, fills[i % 3]);
      icon(els, autoIcon(it), cx + r * 0.7 * Math.cos(mid) - 9, cy + r * 0.7 * Math.sin(mid) - 9, 18, fills[i % 3] !== T.slate, pad2(i + 1));
      var lx = cx + (r + 26) * Math.cos(mid), ly = cy + (r + 26) * Math.sin(mid), ch = capH(it, capW, 3);
      var align = Math.cos(mid) < -0.3 ? 'right' : Math.cos(mid) > 0.3 ? 'left' : 'center';
      var tx = align === 'right' ? lx - capW : align === 'left' ? lx : lx - capW / 2;
      caption(els, Math.max(CX, Math.min(tx, CX + CW - capW)), Math.max(top, ly - ch / 2 - (align === 'center' ? ch / 2 : 0)), capW, it, align, 3);
    });
    ellipse(els, cx - 46, cy - 46, 92, 92, T.white);
    rect(els, cx - 50, cy, 100, 30, T.white);
    text(els, cx - 42, cy - 34, 84, 30, s.center || '', { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', color: T.ink });
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 103 (DIAGRAM_008): tree. A trunk with circles (icons) that grow towards the base, captions left and right
  V['66D_LAYOUT_DIAGRAM_008'] = function (s) {
    var items = items_(s, 6), n = items.length;
    if (n < 4 || n % 2) return null;                 // pairs left and right: an odd count leaves one caption alone (V.1_35)
    var els = [];
    var top = header(els, s);
    var cx = W / 2, rows = Math.ceil(n / 2), rowH = (BOTTOM - top - 30) / rows, capW = 190;
    rect(els, cx - 3, top + 22, 6, BOTTOM - top - 22, T.slate);
    ellipse(els, cx - 15, top, 30, 30, T.bgLight);
    icon(els, autoIcon({ title: s.center || s.title }), cx - 8, top + 7, 16, false);
    items.forEach(function (it, i) {
      var r = Math.floor(i / 2), left = i % 2 === 0, d = Math.min(rowH - 6, 30 + r * 12);
      var y = top + 34 + r * rowH + (rowH - d) / 2, x = left ? cx - d - 4 : cx + 4;
      ellipse(els, x, y, d, d, r === rows - 1 ? T.blue : (r % 2 ? T.ink : T.blue));
      icon(els, autoIcon(it), x + d / 2 - 9, y + d / 2 - 9, 18, true, pad2(i + 1));
      var ch = capH(it, capW, 3), ty = y + d / 2 - ch / 2;
      if (left) caption(els, x - 16 - capW, ty, capW, it, 'right', 3);
      else caption(els, x + d + 16, ty, capW, it, 'left', 3);
    });
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 104 (DIAGRAM_009): three bars forming a triangle (a cycle), icons on the bars, three callouts
  V['66D_LAYOUT_DIAGRAM_009'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    var t = 40, fills = [T.blue, T.ink, T.slate], cx = W / 2;
    var ch2f = capH(items[2], 260, 3), L = Math.min(190, (BOTTOM - top) * 0.78), cy;
    for (; L >= 100; L -= 6) {
      cy = Math.min(top + (BOTTOM - top) / 2 + 12, BOTTOM - ch2f - 16 - t / 2 - L / (2 * Math.sqrt(3)));
      if (cy - L / Math.sqrt(3) - t / 2 >= top + 6) break;          // apex still below the title
    }
    var A = { x: cx, y: cy - L / Math.sqrt(3) }, B = { x: cx + L / 2, y: cy + L / (2 * Math.sqrt(3)) }, C = { x: cx - L / 2, y: cy + L / (2 * Math.sqrt(3)) };
    var sides = [[C, A, -60], [A, B, 60], [B, C, 0]];               // left side, right side, base
    sides.forEach(function (sd, i) {
      var mx = (sd[0].x + sd[1].x) / 2, my = (sd[0].y + sd[1].y) / 2;
      var nx = mx - cx, ny = my - cy, nl = Math.sqrt(nx * nx + ny * ny) || 1;   // push the bar outwards a little
      rbox(els, mx + nx / nl * 6, my + ny / nl * 6, L + t * 0.6, t, sd[2], fills[i]);
      icon(els, autoIcon(items[i]), mx + nx / nl * 6 - 10, my + ny / nl * 6 - 10, 20, fills[i] !== T.slate, pad2(i + 1));
    });
    var capW = 190;
    var ch0 = capH(items[0], capW, 4), ch1 = capH(items[1], capW, 4), ch2 = capH(items[2], 260, 3);
    caption(els, CX, top + 8, capW, items[0], 'left', 4);
    line(els, CX + capW + 4, top + 16, (C.x + A.x) / 2 - 30, (C.y + A.y) / 2, T.cardLine, 0.75);
    caption(els, CX + CW - capW, cy - ch1 / 2 - 20, capW, items[1], 'left', 4);
    line(els, CX + CW - capW - 6, cy - 20, (A.x + B.x) / 2 + 30, (A.y + B.y) / 2, T.cardLine, 0.75);
    caption(els, cx - 130, B.y + t / 2 + 14, 260, items[2], 'center', 3);
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 81 (SERVICES_003): story on the left (heading, paragraph, points), donut in four quadrants with labels on the right
  V['66D_LAYOUT_SERVICES_003'] = function (s) {
    var items = items_(s, 4);
    if (items.length !== 4) return null;
    var els = [];
    var top = header(els, s);
    // Story on the left only when the slide has one; otherwise the donut and its labels sit in the middle of the slide
    var story = !!(s.statement || s.subtitle || s.text || asList(s.points).length);
    var lw = story ? 220 : 0, y = top + 10;
    if (s.statement || s.subtitle) { var h1 = text(els, CX, y, lw, 40, s.statement || s.subtitle, { weight: 500, max: TSZ.heading + 2, min: TSZ.heading, maxLines: 3, color: T.ink }); y += h1.height + 10; }
    if (s.text) { var h2 = text(els, CX, y, lw, 90, s.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 6, color: T.body }); y += h2.height + 10; }
    if (story && s.points) bulletList(els, CX, y, lw, BOTTOM - y, asList(s.points).slice(0, 4), { max: TSZ.body, min: TSZ.body, gap: 6 });
    var x0 = CX + (story ? lw + 24 : 0), x1 = CX + CW, gap = 14;
    var r = Math.min(story ? 82 : 100, (BOTTOM - top) / 2 - 16);
    var cx = (x0 + x1) / 2, cy = top + (BOTTOM - top) / 2;
    var capW = Math.min(story ? 140 : 190, (x1 - x0) / 2 - r - gap);
    var fills = [T.blue, T.ink, T.slate, T.ink];                 // every quarter visible: no near-white quarter
    items.forEach(function (it, i) { arc(els, 'ring', cx, cy, r, 90, -90 + i * 90, fills[i]); });
    ellipse(els, cx - r * 0.42, cy - r * 0.42, r * 0.84, r * 0.84, T.white);
    text(els, cx - r * 0.38, cy - 14, r * 0.76, 28, s.center || '', { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', color: T.ink });
    var rightX = cx + r + gap, leftX = cx - r - gap - capW;
    [[rightX, cy - r, 'left'], [rightX, cy + r * 0.25, 'left'], [leftX, cy + r * 0.25, 'right'], [leftX, cy - r, 'right']]
      .forEach(function (pos, i) { caption(els, pos[0], pos[1], capW, items[i], pos[2], 5); });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 89 (SERVICES_004): connector tree from the top to two rows of four white cards (icon, title, body)
  V['66D_LAYOUT_SERVICES_004'] = function (s) {
    var items = items_(s, 8), n = items.length;
    if (n < 6) return null;
    var els = [];
    var top = header(els, s) + 26;
    var cols = Math.ceil(n / 2), gap = 10, cw = (CW - gap * (cols - 1)) / cols, iw = cw - 24;
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw - 24, TSZ.heading, 500, 2);
    var cells = gridCells(n, cols, CX, top, CW, BOTTOM - top, gap, 12, cardNeed(items, iw, hBlock, 14));
    var busY = top - 14;
    line(els, W / 2, top - 30, W / 2, busY, T.blue, 1.25);
    line(els, cells[0].x + cw / 2, busY, cells[cols - 1].x + cw / 2, busY, T.blue, 1.25);
    items.forEach(function (it, i) {
      var c = cells[i];
      if (i < cols) line(els, c.x + cw / 2, busY, c.x + cw / 2, c.y, T.blue, 1.25);
      rect(els, c.x, c.y, c.w, c.h, T.white);
      rect(els, c.x + 10, c.y + 10, 18, 18, T.blue);
      icon(els, autoIcon(it), c.x + 13, c.y + 13, 12, true);
      text(els, c.x + 34, c.y + 10, iw - 24, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      cardBody(els, c.x + 12, c.y + 16 + Math.max(hBlock, 18), iw, c.h - hBlock - 26, it, TSZ.body, items);
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 100 (PROCESS_006): intro on the left, five numbered steps climbing to the right, a caption beside each step
  V['66D_LAYOUT_PROCESS_006'] = function (s) {
    var steps = items_(s, 5), n = steps.length;
    if (n < 4) return null;
    var els = [];
    // The intro sits on the left: the lead is shown there OR under the title, never twice
    var intro = s.text || s.lead || '';
    var top = header(els, (!s.text && s.lead) ? Object.assign({}, s, { lead: '', subtitle: '' }) : s);
    var x0 = intro ? 220 : CX, stepW = 92, stepH = Math.min(36, (BOTTOM - top) / n - 6), dx = 44;
    if (intro) text(els, CX, top + 10, 170, BOTTOM - top - 20, intro, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    var fills = [T.slate, T.slate, T.blue, T.blue, T.ink];
    steps.forEach(function (st, i) {
      var y = BOTTOM - (i + 1) * (stepH + 6), x = x0 + i * dx;
      rect(els, x, y, stepW, stepH, fills[Math.round(i * 4 / Math.max(n - 1, 1))]);
      text(els, x, y + stepH / 2 - 9, stepW - 10, 18, pad2(i + 1), { font: 'mono', weight: 500, max: 14, min: 14, maxLines: 1, align: 'right', color: fills[Math.round(i * 4 / Math.max(n - 1, 1))] === T.slate ? T.ink : T.white, noFill: true });
      var cxp = x + stepW + 12, capW = Math.min(230, CX + CW - cxp);
      caption(els, cxp, y + stepH / 2 - 14, capW, st, 'left', 2);
    });
    return { bg: T.white, els: els, noBalance: true };
  };

  L.diagram = function (s, ctx) {
    var n = items_(s, 8).length;
    var order = n === 3 ? ['66D_LAYOUT_DIAGRAM_004', '66D_LAYOUT_DIAGRAM_009'] : n === 4 ? ['66D_LAYOUT_DIAGRAM_006', '66D_LAYOUT_DIAGRAM_005'] :
      n === 5 ? ['66D_LAYOUT_DIAGRAM_006', '66D_LAYOUT_DIAGRAM_005'] : ['66D_LAYOUT_DIAGRAM_001', '66D_LAYOUT_DIAGRAM_008'];
    for (var k = 0; k < order.length; k++) { var o = V[order[k]](s); if (o) return o; }
    return L.cards(s, ctx);
  };


  /* ================= TEMPLATE DESIGNS: LISTS, COMPARISONS, STATEMENTS, TABLES, CASES, COMPANY (batch 3) ================= */

  function itemPts(it) { return arr(it.points, 6).map(str).filter(function (p) { return p; }); }
  function ptsH(points, w) { var h = 0; points.forEach(function (p) { h += textH(p, w - 16, TSZ.body) + 5; }); return h; }

  // Slide 24 (BULLETS_001): numbered menu (first item highlighted as a blue pill) and a panel explaining the focus item
  V['66D_LAYOUT_BULLETS_001'] = function (s) {
    var pts = arr(s.points, 6).map(str).filter(Boolean);
    if (pts.length < 3 || !s.callout) return null;
    var els = [];
    var top = header(els, s);
    // "Label: explanation" points show their explanation under the label, and the menu fills the slide height
    // (V.1_35: a menu of bare labels left half the slide empty)
    var rows = pts.map(function (p) { var k = p.indexOf(': '); return k > 0 && k < 48 ? { label: p.slice(0, k), text: p.slice(k + 2) } : { label: p, text: '' }; });
    var withText = rows.filter(function (r) { return r.text; }).length >= Math.ceil(rows.length / 2);
    var lw = withText ? 300 : 250, gapR = 8;
    var rowH = withText ? Math.min(70, (BOTTOM - top - 6) / pts.length) : Math.min(34, (BOTTOM - top) / pts.length);
    rows.forEach(function (r, i) {
      var y = top + 6 + i * rowH, on = i === 0, bh = rowH - gapR;
      rect(els, CX, y, lw, bh, on ? T.blue : T.white);
      var oy = withText ? y + 10 : y + bh / 2 - 9;
      ellipse(els, CX + 8, oy, 18, 18, on ? T.white : T.blue);
      text(els, CX + 8, oy + 2, 18, 14, String(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: on ? T.blue : T.white, noFill: true });
      if (withText) {
        var lh = text(els, CX + 34, y + 6, lw - 44, 22, r.label, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: on ? T.white : T.ink });
        if (r.text) text(els, CX + 34, y + 6 + Math.max(lh.height, 18), lw - 44, bh - 8 - Math.max(lh.height, 18), r.text, { weight: 400, max: TSZ.body, min: 9, maxLines: 3, color: on ? T.white : T.body });
      } else {
        text(els, CX + 34, y, lw - 42, bh, r.label, { weight: on ? 500 : 400, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: on ? T.white : T.ink });
      }
    });
    var px = CX + lw + 24, pw = CW - lw - 24;
    var c = s.callout, cy0 = top + 34;
    var needP = 34 + linesBlock([c.title || c.label || ''], pw - 48, TSZ.heading + 2, 500, 2) + 10 + textH(c.text || '', pw - 48, TSZ.body) + 30;
    var ph = Math.min(BOTTOM - top - 10, Math.max(needP, pts.length * rowH - gapR, 120));
    rect(els, px, top + 6, pw, ph, T.white, { color: T.blue, width: 0.75 });
    rect(els, px + pw / 2 - 30, top + 2, 60, 8, T.blue);
    var ht = text(els, px + 24, cy0, pw - 48, 40, c.title || c.label || '', { weight: 500, max: TSZ.heading + 2, min: TSZ.heading, maxLines: 2, color: T.ink });
    text(els, px + 24, cy0 + ht.height + 10, pw - 48, ph - ht.height - 70, c.text || '', { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    return { bg: T.bgLight, els: els };
  };

  // Slide 47 (BULLETS_002): two white numbered cards with a heading, divider and bullet points; dark photo strip right
  V['66D_LAYOUT_BULLETS_002'] = function (s) {
    var items = items_(s, 2);
    if (items.length !== 2 || !items.every(function (it) { return itemPts(it).length >= 2; })) return null;
    var els = [];
    rect(els, 0, 0, 640, H, T.bgLight);
    var top = header(els, s, { maxW: 560 });
    var cw = 268, gap = 14, need = 0;
    items.forEach(function (it) { need = Math.max(need, 70 + ptsH(itemPts(it), cw - 40) + 20); });
    var ch = boxH(need, BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white);
      text(els, x + 20, top + 16, 30, 26, String(i + 1), { font: 'mono', weight: 500, max: 20, min: 20, maxLines: 1, color: T.blue });
      text(els, x + 50, top + 20, cw - 70, 34, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      line(els, x + 20, top + 56, x + cw - 20, top + 56, T.cardLine, 0.75);
      bulletList(els, x + 20, top + 68, cw - 40, ch - 80, itemPts(it), { max: TSZ.body, min: TSZ.body, gap: 6 });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 48 (BULLETS_003): one white card holding groups: blue heading + bullet points
  V['66D_LAYOUT_BULLETS_003'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 2 || !items.every(function (it) { return itemPts(it).length >= 1; })) return null;
    var els = [];
    var top = header(els, s);
    var w = CW - 40, need = 24;
    items.forEach(function (it) { need += lineHeight('sans', TSZ.heading) + 6 + ptsH(itemPts(it), w) + 10; });
    var h = boxH(need, BOTTOM - top);
    rect(els, CX, top, CW, h, T.white);
    var y = top + 16;
    items.forEach(function (it) {
      var t = text(els, CX + 20, y, w, 16, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.blue });
      y += t.height + 6;
      y += bulletList(els, CX + 20, y, w, BOTTOM - y, itemPts(it), { max: TSZ.body, min: TSZ.body, gap: 4 }) + 12;
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 55 (BULLETS_004): up to 10 items in two columns, blue square number, bold title, one-line description
  V['66D_LAYOUT_BULLETS_004'] = function (s) {
    var items = items_(s, 10), n = items.length;
    if (n < 6) return null;
    var els = [];
    var top = header(els, s);
    var rows = Math.ceil(n / 2), colW = (CW - 30) / 2, rowH = Math.min(52, (BOTTOM - top) / rows);
    items.forEach(function (it, i) {
      var col = i < rows ? 0 : 1, r = col ? i - rows : i, x = CX + col * (colW + 30), y = top + r * rowH;
      rect(els, x, y + 2, 20, 20, T.blue);
      text(els, x, y + 5, 20, 14, String(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.white, noFill: true });
      text(els, x + 30, y, colW - 30, 16, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      text(els, x + 30, y + 16, colW - 30, rowH - 20, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.body });
    });
    return { bg: T.white, els: els };
  };

  // Slide 57 (BULLETS_005): full dark photo, white title, three rows: blue icon square + outlined box with bold lead-in
  V['66D_LAYOUT_BULLETS_005'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 3) return null;
    var els = [];
    text(els, X0, 24, HEADER_MAX_W || (W - 2 * X0), 28, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    var top = 60;
    if (s.lead) { var l = text(els, X0, 56, 420, 30, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.white }); top = 56 + l.height + 18; }
    var bw = 420, rowH = Math.min(70, (BOTTOM - top) / n);
    var y0 = top + Math.max(0, (BOTTOM - top - n * rowH) / 2);
    items.forEach(function (it, i) {
      var y = y0 + i * rowH;
      rect(els, X0, y, 34, rowH - 12, T.blue);
      icon(els, autoIcon(it), X0 + 9, y + (rowH - 12) / 2 - 8, 16, true);
      rect(els, X0 + 34, y, bw, rowH - 12, T.ink, { color: T.blue, width: 0.75 });
      var body = (it.title ? it.title + ': ' : '') + (it.text || '');
      text(els, X0 + 46, y, bw - 24, rowH - 12, body, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: T.white,
        runs: it.title ? [{ start: 0, end: it.title.length + 1, color: T.white, weight: 500 }] : null });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  };

  // Slide 59 (BULLETS_006): dark photo band, a white text card on the left, four rule items on the right
  V['66D_LAYOUT_BULLETS_006'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 3 || !s.text) return null;
    var els = [];
    var top = bandHeader(els, s);
    var lw = 250, rowH = (BOTTOM - top) / n;
    rect(els, CX, top, lw, BOTTOM - top, T.white);
    text(els, CX + 16, top + 16, lw - 32, BOTTOM - top - 32, s.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    items.forEach(function (it, i) {
      var x = CX + lw + 14, y = top + i * rowH, w = CW - lw - 14;
      rect(els, x, y, w, rowH - 8, T.white);
      rect(els, x, y, 3, rowH - 8, T.ink);
      text(els, x + 14, y + 6, w - 28, 16, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.blue });
      text(els, x + 14, y + 21, w - 28, rowH - 28, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.body });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 66 (BULLETS_007): three panel columns, blue centred heading with a blue rule, bullet points
  V['66D_LAYOUT_BULLETS_007'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3 || !items.every(function (it) { return itemPts(it).length >= 2; })) return null;
    var els = [];
    var top = header(els, s);
    var gap = 8, cw = (CW - 2 * gap) / 3, need = 0;
    items.forEach(function (it) { need = Math.max(need, 46 + ptsH(itemPts(it), cw - 32) + 16); });
    var ch = boxH(need, BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.bgLight);
      text(els, x + 12, top + 10, cw - 24, 18, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', color: T.blue });
      line(els, x, top + 32, x + cw, top + 32, T.blue, 1.5);
      bulletList(els, x + 16, top + 44, cw - 32, ch - 54, itemPts(it), { max: TSZ.body, min: TSZ.body, gap: 8 });
    });
    return { bg: T.white, els: els };
  };

  // Slide 34 (COMPARISON_001): check matrix. Rows of features, a column per option with ticks and crosses
  V['66D_LAYOUT_COMPARISON_001'] = function (s) {
    var opts = arr(s.options, 4).map(function (o) { return str(o); }), rows = arr(s.rows, 10);
    if (opts.length < 2 || rows.length < 3) return null;
    var els = [];
    var top = header(els, s);
    var sideW = s.points ? 190 : 0, labW = 200, colW = Math.min(110, (CW - sideW - labW - 20) / opts.length);
    var hdrH = 30, rowH = Math.min(34, (BOTTOM - top - hdrH) / rows.length);
    opts.forEach(function (o, j) {
      var x = CX + labW + j * colW;
      rect(els, x + 2, top, colW - 4, hdrH, T.blue);
      text(els, x + 4, top, colW - 8, hdrH, o, { weight: 500, max: 10, min: 10, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
    });
    rows.forEach(function (r, i) {
      var y = top + hdrH + i * rowH, label = r.label || r.title || r[0] || '';
      var vals = r.values || (Array.isArray(r) ? r.slice(1) : []);
      text(els, CX, y, labW - 10, rowH, String(label), { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.ink });
      opts.forEach(function (o, j) {
        var yes = vals[j] === true || /^(yes|y|true|✓|x?✔)$/i.test(String(vals[j]).trim());
        var cx0 = CX + labW + j * colW + colW / 2;
        ring(els, cx0 - 7, y + rowH / 2 - 7, 14, T.white, yes ? T.blue : T.ink, 1);
        text(els, cx0 - 7, y + rowH / 2 - 6.5, 14, 12, yes ? '✓' : '×', { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: yes ? T.blue : T.ink, noFill: true });
      });
      line(els, CX, y + rowH, CX + labW + opts.length * colW, y + rowH, T.cardLine, 0.5);
    });
    if (s.points) {
      var px = CX + CW - sideW;
      var tblH = hdrH + rows.length * rowH;
      rect(els, px, top, sideW, tblH, T.bgLight);
      bulletList(els, px + 14, top + 16, sideW - 28, tblH - 30, asList(s.points).slice(0, 8), { max: TSZ.body, min: TSZ.body, gap: 8 });
    }
    return { bg: T.white, els: els };
  };

  // Slide 36 (COMPARISON_002): comparison table. Capability | the old way (Night Blue text) | the new way (blue text)
  V['66D_LAYOUT_COMPARISON_002'] = function (s) {
    var rows = arr(s.rows, 8);
    if (rows.length < 3) return null;
    var els = [];
    var top = header(els, s);
    var heads = [s.rowLabel || 'Capability', (s.left && (s.left.label || s.left.title)) || 'Today', (s.right && (s.right.label || s.right.title)) || 'With the new approach'];
    var widths = [CW * 0.26, CW * 0.37, CW * 0.37], hdrH = 26, gap = 6;
    var cell = function (r) { return Array.isArray(r) ? r : [r.label || r.capability || '', r.left || r.before || '', r.right || r.after || '']; };
    var rh = 0;
    rows.forEach(function (r) { var c = cell(r); rh = Math.max(rh, Math.max(textH(c[1], widths[1] - 20, TSZ.body), textH(c[2], widths[2] - 20, TSZ.body)) + 14); });
    rh = Math.min(Math.max(rh, 24, (BOTTOM - top - hdrH) * 0.75 / rows.length - 4), (BOTTOM - top - hdrH) / rows.length - 4);
    var x = CX;
    heads.forEach(function (h0, j) {
      rect(els, x + (j ? gap / 2 : 0), top, widths[j] - gap / 2, hdrH, T.blue);
      text(els, x + 10, top, widths[j] - 20, hdrH, h0, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.white });
      x += widths[j];
    });
    rows.forEach(function (r, i) {
      var c = cell(r), y = top + hdrH + 4 + i * (rh + 4), xx = CX;
      [T.ink, T.ink, T.blue].forEach(function (col, j) {
        rect(els, xx + (j ? gap / 2 : 0), y, widths[j] - gap / 2, rh, T.white, { color: T.cardLine, width: 0.75 });
        text(els, xx + 10, y, widths[j] - 20, rh, String(c[j] || ''), { weight: j === 0 ? 500 : 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: col });
        xx += widths[j];
      });
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 51 (COMPARISON_004): three eras side by side; the last one (today) in a solid blue card
  V['66D_LAYOUT_COMPARISON_004'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    var gap = 4, cw = (CW - 2 * gap) / 3, need = 0;
    items.forEach(function (it) { need = Math.max(need, 30 + capH(it, cw - 32, 8) + 30); });
    var ch = boxH(need, BOTTOM - top - 20), y = top + (BOTTOM - top - ch) / 2;
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), last = i === 2;
      rect(els, x, y, cw, ch, last ? T.blue : T.white, last ? null : { color: T.cardLine, width: 0.75 });
      var t = text(els, x + 16, y + 16, cw - 32, 34, (it.label ? it.label + ': ' : '') + it.title, { weight: 500, max: TSZ.heading + 1, min: TSZ.heading, maxLines: 2, color: last ? T.white : T.ink });
      text(els, x + 16, y + 22 + t.height, cw - 32, ch - t.height - 38, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: last ? T.white : T.blue });
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 20 (STATEMENT_001): large 66 mark on the left, the statement in a grey callout card, photo strip on the right
  V['66D_LAYOUT_STATEMENT_001'] = function (s) {
    if (arr(s.points, 3).length) return null;
    var stText = s.statement || s.title || '';
    if (!stText) return null;
    var els = [];
    var panelW = 500;                                     // white area; the photo strip fills the rest
    rect(els, 0, 0, panelW, H, T.white);
    els[els.length - 1].square = true;
    if (s.title && s.title !== stText) header(els, { title: s.title }, { maxW: panelW - 2 * X0 });
    var cx0 = 168, cw = panelW - cx0 - 24;                // the card ends 24pt before the photo strip
    var st = fit(String(stText), cw - 40, 96, { weight: 500, max: 17, min: 13, maxLines: 4 });
    var tx = s.text ? fit(String(s.text), cw - 40, 120, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 7 }) : { height: 0 };
    var chh = 40 + st.height + (s.text ? 12 + tx.height : 0);
    var cy0 = Math.max(96, (H - chh) / 2 + 10);
    rect(els, cx0, cy0, cw, chh, T.slate);
    text(els, cx0 + 20, cy0 + 18, cw - 40, st.height + 4, stText, { weight: 500, max: st.size, min: st.size, maxLines: 4, color: T.ink });
    if (s.text) text(els, cx0 + 20, cy0 + 30 + st.height, cw - 40, tx.height + 4, s.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 7, color: T.ink });
    // 66 mark: as tall as the card (max 84pt), centred on it, left of the card
    var mh = Math.min(84, chh), mw = mh * 1.5;
    image(els, 'mark-dark', cx0 - 20 - mw, cy0 + (chh - mh) / 2, mw, mh);
    return { bg: T.ink, bgImage: 'section-bg', els: els, noFooter: false, noBalance: true, dark: true };
  };

  // Statement in a full-width blue band under the title, the points as cards in a row below (a second look for
  // statements with points, so statement slides do not all look the same)
  V.ENGINE_STATEMENT_BAND = function (s) {
    var pts = arr(s.points, 3).filter(Boolean);
    var stText = s.statement || '';
    if (pts.length < 2 || !stText) return null;
    var els = [];
    var top = header(els, { title: s.title || stText });
    var st = fit(String(stText), CW - 48, 70, { weight: 500, max: 18, min: 14, maxLines: 3 });
    var bandH = st.height + 36;
    var cardsNeed = 0;
    pts.forEach(function (p) { var it0 = typeof p === 'string' ? { text: p } : p; cardsNeed = Math.max(cardsNeed, 28 + (it0.title ? 40 : 0) + textH(it0.text, (CW - 24) / pts.length - 32, TSZ.body)); });
    top += Math.max(0, (BOTTOM - top - bandH - 14 - Math.max(cardsNeed, 110)) / 3);   // the block sits in the middle of the free space
    rect(els, CX, top, CW, bandH, T.blue);
    text(els, CX + 24, top + 18, CW - 48, st.height + 4, stText, { weight: 500, max: st.size, min: st.size, maxLines: 3, color: T.white });
    var y = top + bandH + 14, n = pts.length, gap = 12, cw = (CW - gap * (n - 1)) / n;
    var items = pts.map(function (p) { return typeof p === 'string' ? { title: '', text: p } : p; });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 28 + (it.title ? textH(it.title, cw - 32, TSZ.heading, 500) + 6 : 0) + textH(it.text, cw - 32, TSZ.body)); });
    var ch = boxH(need, BOTTOM - y);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, y, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      var ty = y + 14;
      if (it.title) { var t1 = text(els, x + 16, ty, cw - 32, 34, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink }); ty += t1.height + 6; }
      text(els, x + 16, ty, cw - 32, y + ch - ty - 12, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 105 (STATEMENT_002): the photo covers the slide; the title and statement in white
  V['66D_LAYOUT_STATEMENT_002'] = function (s) {
    if (arr(s.points, 3).length) return null;
    var stText = s.statement || '';
    if (!stText) return null;
    var els = [];
    text(els, X0, 24, HEADER_MAX_W || (W - 2 * X0), 28, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    var stFit = fit(String(stText), 380, 130, { weight: 500, max: 26, min: 18, maxLines: 4 });
    var stH = Math.max(stFit.height, wrap(String(stText), 380, 'sans', 500, stFit.size).length * lineHeight('sans', stFit.size)) + 6;
    text(els, X0, 110, 420, stH, stText, { weight: 500, max: stFit.size, min: stFit.size, maxLines: 4, color: T.white });
    line(els, X0 + 1, 110 + stH + 12, X0 + 121, 110 + stH + 12, T.white, 1);
    if (s.text) text(els, X0, 110 + stH + 26, 420, 90, s.text, { weight: 400, max: TSZ.body + 1, min: TSZ.body, maxLines: 5, color: T.white });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  };

  // Slide 38 (CHART_003): bar chart panel on the left, a data table panel on the right
  V['66D_LAYOUT_CHART_003'] = function (s) {
    var ch = s.chart || {}, cats = arr(ch.categories, 6), se = (ch.series || [])[0], rows = arr(s.rows, 6);
    if (!se || cats.length < 3 || rows.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var pw = (CW - 14) / 2, ph = BOTTOM - top;
    rect(els, CX, top, pw, ph, T.bgLight);
    var vals = arr(se.values, cats.length).map(Number), maxV = niceMax(Math.max.apply(null, vals) * 1.08, ch.unit || '');
    var gx = CX + 40, gy = top + 22, gw = pw - 60, gh = ph - 60;
    for (var k = 0; k <= 4; k++) {
      var yy = gy + gh - gh * k / 4;
      line(els, gx, yy, gx + gw, yy, T.cardLine, 0.5);
      text(els, CX + 4, yy - 7, 32, 14, fmt(maxV * k / 4, ch.unit), { font: 'mono', weight: 400, max: 10, min: 10, maxLines: 1, align: 'right', color: T.body });
    }
    var bw = gw / cats.length;
    cats.forEach(function (c, i) {
      var v = vals[i] || 0, bh = gh * v / maxV, bx = gx + i * bw + bw * 0.25;
      rect(els, bx, gy + gh - bh, bw * 0.5, bh, T.blue, null);
      els[els.length - 1].square = true;
      text(els, bx - 6, gy + gh - bh - 16, bw * 0.5 + 12, 14, fmt(v, ch.unit), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.ink });
      text(els, gx + i * bw, gy + gh + 4, bw, 24, String(c), { weight: 400, max: 10, min: 10, maxLines: 2, align: 'center', color: T.body });
    });
    var tx = CX + pw + 14;
    rect(els, tx, top, pw, ph, T.bgLight);
    var cols = arr(s.columns, 4).map(function (c) { return typeof c === 'object' ? (c.title || c.label || '') : String(c); });
    var nc = Math.max(cols.length, (Array.isArray(rows[0]) ? rows[0].length : 2));
    var cw2 = (pw - 28) / nc, rh = Math.min(30, (ph - 60) / rows.length);
    var y0 = top + 20;
    for (var j = 0; j < nc; j++) {
      rect(els, tx + 14 + j * cw2, y0, cw2 - 2, 24, T.blue);
      text(els, tx + 18 + j * cw2, y0, cw2 - 10, 24, cols[j] || '', { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.white });
    }
    rows.forEach(function (r, i) {
      var cells = Array.isArray(r) ? r : Object.keys(r).map(function (k2) { return r[k2]; });
      var y = y0 + 26 + i * rh;
      rect(els, tx + 14, y, pw - 28, rh - 2, i % 2 ? T.bgLight : T.white);
      els[els.length - 1].square = true;
      for (var j2 = 0; j2 < nc; j2++) text(els, tx + 18 + j2 * cw2, y, cw2 - 10, rh - 2, String(cells[j2] == null ? '' : cells[j2]), { weight: j2 ? 400 : 500, max: 10, min: 10, maxLines: 2, valign: 'middle', color: j2 ? T.body : T.blue });
    });
    return { bg: T.white, els: els };
  };

  // Slide 31 (TABLE_003): two-column table in a white card, blue header, bold first column, alternating rows
  V['66D_LAYOUT_TABLE_003'] = function (s) {
    var rows = arr(s.rows, 8), cols = arr(s.columns, 2).map(function (c) { return typeof c === 'object' ? (c.title || c.label || '') : String(c); });
    if (rows.length < 2 || (rows[0] && Array.isArray(rows[0]) && rows[0].length !== 2)) return null;
    if ((s.rows || []).length > 8 || (s.columns || []).length > 2 || s.fromSource) return null;    // V.1_36: never drop data
    var els = [];
    var top = header(els, s);
    var c1 = 160, ph = BOTTOM - top;
    rect(els, CX, top, CW, ph, T.white, { color: T.cardLine, width: 0.75 });
    var x0 = CX + 12, w = CW - 24, y = top + 12, hdr = 24;
    rect(els, x0, y, c1 - 2, hdr, T.blue);
    rect(els, x0 + c1, y, w - c1, hdr, T.blue);
    text(els, x0 + 8, y, c1 - 16, hdr, cols[0] || '', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.white });
    text(els, x0 + c1 + 8, y, w - c1 - 16, hdr, cols[1] || '', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.white });
    var cell = function (r) { return Array.isArray(r) ? r : [r.label || r.title || '', r.text || r.value || '']; };
    var rh = 0;
    rows.forEach(function (r) { rh = Math.max(rh, textH(String(cell(r)[1]), w - c1 - 16, TSZ.body) + 12); });
    rh = Math.max(rh, (ph - 50) * 0.75 / rows.length);
    rh = Math.min(rh, (ph - 50) / rows.length);
    rows.forEach(function (r, i) {
      var c = cell(r), yy = y + hdr + 2 + i * rh;
      if (i % 2) { rect(els, x0, yy, w, rh, T.bgLight); els[els.length - 1].square = true; }
      text(els, x0 + 8, yy, c1 - 16, rh, String(c[0]), { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, valign: 'middle', color: T.ink });
      text(els, x0 + c1 + 8, yy, w - c1 - 16, rh, String(c[1]), { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: T.body });
      line(els, x0, yy + rh, x0 + w, yy + rh, T.cardLine, 0.5);
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 32 (TABLE_004): 3-4 columns in a white container, blue header tabs, centred cells, blue first column
  V['66D_LAYOUT_TABLE_004'] = function (s) {
    var rows = arr(s.rows, 7), cols = arr(s.columns, 4).map(function (c) { return typeof c === 'object' ? (c.title || c.label || '') : String(c); });
    if (rows.length < 2 || cols.length < 3) return null;
    // V.1_36: never drop data - a table with more rows / columns, or with grouped (merged) rows, uses the full table design
    if ((s.rows || []).length > 7 || (s.columns || []).length > 4 || s.fromSource) return null;
    var els = [];
    var top = header(els, s);
    var ph = BOTTOM - top;
    rect(els, CX, top, CW, ph, T.white);
    var nc = cols.length, x0 = CX + 16, w = CW - 32, cw = w / nc, hdr = 26, y = top + 14;
    cols.forEach(function (c, j) {
      rect(els, x0 + j * cw + 2, y, cw - 4, hdr, T.blue);
      text(els, x0 + j * cw + 6, y, cw - 12, hdr, c, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    });
    var rh = Math.min((ph - 50) / rows.length, 52);
    rows.forEach(function (r, i) {
      var cells = Array.isArray(r) ? r : Object.keys(r).map(function (k) { return r[k]; });
      var yy = y + hdr + 4 + i * rh;
      for (var j = 0; j < nc; j++) {
        rect(els, x0 + j * cw + 2, yy, cw - 4, rh - 4, T.white, { color: T.cardLine, width: 0.75 });
        text(els, x0 + j * cw + 8, yy, cw - 16, rh - 4, String(cells[j] == null ? '' : cells[j]), { weight: j ? 400 : 500, max: TSZ.body, min: TSZ.body, maxLines: 3, align: 'center', valign: 'middle', color: j ? T.body : T.blue });
      }
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 13 (CASE_STUDY_001): multi-client impact table. Client | context | how we helped | impact, phase bar on the left
  V['66D_LAYOUT_CASE_STUDY_001'] = function (s) {
    var cases = arr(s.cases, 6).filter(function (c) { return c && c.challenge; });
    if (cases.length < 3) return null;
    var els = [];
    var top = header(els, s);
    var bar = 20, widths = [108, 160, 196, CW - bar - 108 - 160 - 196], heads = ['Client', 'Context', 'How we helped', 'Impact delivered'];
    var x = CX + bar, hdr = 20;
    heads.forEach(function (h0, j) { text(els, x + 6, top, widths[j] - 12, hdr, h0, { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.ink }); x += widths[j]; });
    var rh = (BOTTOM - top - hdr) / cases.length;
    var phases = cases.map(function (c) { return c.phase || ''; });
    cases.forEach(function (c, i) {
      var y = top + hdr + i * rh, xx = CX + bar;
      if (i === 0 || phases[i] !== phases[i - 1]) {
        var span = 1; while (i + span < cases.length && phases[i + span] === phases[i]) span++;
        rect(els, CX, y + 2, bar - 4, span * rh - 4, T.blue);
        if (phases[i]) {
          var bh2 = span * rh - 4;
          text(els, CX + (bar - 4) / 2 - bh2 / 2, y + 2 + bh2 / 2 - 8, bh2, 16, phases[i].slice(0, 24), { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white, rot: -90 });
        }
      }
      line(els, CX + bar, y, CX + CW, y, T.cardLine, 0.5);
      var cells = [(c.client || c.offering || '') + (c.industry ? '\n' + c.industry : ''), c.challenge, c.solution || c.offering || '', [c.value_headline, c.value].filter(Boolean).join('. ')];
      cells.forEach(function (v, j) {
        text(els, xx + 6, y + 4, widths[j] - 12, rh - 8, String(v || ''), { weight: j === 0 ? 500 : 400, max: TSZ.body, min: 10, maxLines: 4, color: j === 3 ? T.blue : T.body });
        xx += widths[j];
      });
    });
    return { bg: T.white, els: els };
  };

  // Slide 19 (CASE_STUDY_003): three client columns: dark header with the client, challenge, solution, outcome, phase bar
  V['66D_LAYOUT_CASE_STUDY_003'] = function (s) {
    var cases = arr(s.cases, 3).filter(function (c) { return c && c.challenge; });
    if (cases.length !== 3) return null;
    var els = [];
    var top = header(els, s);
    var gap = 10, cw = (CW - 2 * gap) / 3, headH = 44;
    cases.forEach(function (c, i) {
      var x = CX + i * (cw + gap), y = top;
      rect(els, x, y, cw, headH, T.ink);
      text(els, x + 10, y, cw - 20, headH, (c.client || c.industry || c.offering || ''), { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, valign: 'middle', color: T.white });
      var by = y + headH, bh = BOTTOM - by - 22;
      rect(els, x, by, cw, bh, T.bgLight);
      var yy = by + 10;
      [['The challenge', c.challenge], ['The solution', c.solution || c.offering]].forEach(function (pr) {
        if (!pr[1]) return;
        text(els, x + 10, yy, cw - 20, 14, pr[0], { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
        var t = text(els, x + 10, yy + 15, cw - 20, 70, pr[1], { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 5, color: T.body });
        yy += 15 + t.height + 8;
      });
      var res = [c.value_headline, c.value].filter(Boolean).join('. ');
      if (res) text(els, x + 10, Math.max(yy, by + bh - 56), cw - 20, 50, res, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.blue });
      shape(els, 'HOME_PLATE', x, BOTTOM - 18, cw, 16, T.blue);
      text(els, x, BOTTOM - 18, cw - 10, 16, c.phase || '', { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    });
    return { bg: T.white, els: els };
  };

  // Slide 70 (CASE_STUDY_004): success story on a dark photo. Breadcrumb, challenge and solution columns, blue results column
  V['66D_LAYOUT_CASE_STUDY_004'] = function (s) {
    var chal = asList(s.challenge).join(' '), sol = asList(s.solution), res = arr(s.results, 4);
    if (!chal || !sol.length || !res.length) return null;
    var els = [];
    var crumb = ['Success story', s.industry || s.client].filter(Boolean).join('  |  ');
    text(els, X0, 14, 500, 14, crumb, { weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    text(els, X0, 34, HEADER_MAX_W || (W - 2 * X0), 28, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    var top = 76, gap = 10, cw = (CW - 2 * gap) / 3;
    var solH = sol.slice(0, 5).reduce(function (t, p) { return t + textH(p, cw - 40, TSZ.body) + 6; }, 0);
    var resH = res.reduce(function (t, r) { return t + 34 + textH(r.label, cw - 24, TSZ.body); }, 0);
    var h = Math.min(BOTTOM - top, Math.max(textH(chal, cw - 24, TSZ.body) + 48, solH + 50, resH + 50, (BOTTOM - top) * 0.75));
    rect(els, CX, top, cw, h, T.ink, { color: T.white, width: 0.75 });
    text(els, CX + 12, top + 12, cw - 24, 14, s.challenge_label || 'The challenge', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    text(els, CX + 12, top + 32, cw - 24, h - 44, chal, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.white });
    var x2 = CX + cw + gap;
    rect(els, x2, top, cw, h, T.ink, { color: T.white, width: 0.75 });
    text(els, x2 + 12, top + 12, cw - 24, 14, s.solution_label || 'What we did', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    bulletList(els, x2 + 12, top + 34, cw - 24, h - 46, sol.slice(0, 5), { max: TSZ.body, min: TSZ.body, gap: 6, color: T.white, bullet: T.white });
    var x3 = x2 + cw + gap;
    rect(els, x3, top, cw, h, T.blue);
    text(els, x3 + 12, top + 12, cw - 24, 14, 'Business impact', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    var ry = top + 36, rH = (h - 46) / res.length;
    res.forEach(function (r) {
      text(els, x3 + 12, ry, cw - 24, 30, r.value, { font: 'mono', weight: 500, max: 22, min: 14, maxLines: 1, color: T.white });
      text(els, x3 + 12, ry + 30, cw - 24, rH - 34, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.white });
      ry += rH;
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  };

  // Slide 18 (SERVICES_001): three pillars. Header card (number, name, description), offerings, services, phase bar
  V['66D_LAYOUT_SERVICES_001'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3 || !items.every(function (it) { return itemPts(it).length >= 2; })) return null;
    var els = [];
    var top = header(els, s);
    var labW = 70, gap = 8, cw = (CW - labW - 2 * gap) / 3;
    var headH = 0;
    items.forEach(function (it) { headH = Math.max(headH, 36 + textH(it.text, cw - 24, TSZ.body) + 14); });
    headH = Math.min(headH, 100);
    text(els, CX, top + headH + 14, labW - 8, 30, s.pointsLabel || 'What we offer', { weight: 500, max: 10, min: 10, maxLines: 2, color: T.ink });
    items.forEach(function (it, i) {
      var x = CX + labW + i * (cw + gap);
      rect(els, x, top, cw, headH, T.slate);
      text(els, x + 12, top + 8, 26, 30, String(i + 1), { font: 'mono', weight: 500, max: 22, min: 22, maxLines: 1, color: T.blue });
      text(els, x + 40, top + 10, cw - 52, 30, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      text(els, x + 12, top + 42, cw - 24, headH - 48, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.ink });
      var by = top + headH, bh = BOTTOM - by - 22;
      rect(els, x, by, cw, bh, T.bgLight);
      els[els.length - 1].square = true;
      bulletList(els, x + 12, by + 14, cw - 24, bh - 20, itemPts(it), { max: TSZ.body, min: TSZ.body, gap: 5 });
      shape(els, 'HOME_PLATE', x, BOTTOM - 18, cw, 16, T.blue);
      text(els, x, BOTTOM - 18, cw - 10, 16, it.label || it.title.split(' ')[0], { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    });
    return { bg: T.white, els: els };
  };

  // Slide 8 / 10 (COMPANY_OVERVIEW_002 light, _004 dark): credential cards with check icons, footprint statement and points
  function approachGrid(s, dark) {
    var items = items_(s, 5), n = items.length;
    if (n < 4 || !s.statement) return null;
    var els = [];
    if (dark) text(els, X0, 24, HEADER_MAX_W || (W - 2 * X0), 28, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    var top = dark ? 70 : header(els, s);
    var lw = 400, cols = 3, gap = 8, cw0 = (lw - 2 * gap) / cols;
    var cells = gridCells(n, cols, CX, top, lw, BOTTOM - top, gap, gap, 0);
    var cellH = (BOTTOM - top - gap) / 2;
    items.forEach(function (it, i) {
      var c = cells[i];
      c.h = cellH;
      c.y = top + Math.floor(i / cols) * (cellH + gap);
      rect(els, c.x, c.y, c.w, c.h, dark ? T.ink : T.bgLight, dark ? { color: T.slate, width: 0.5 } : null);
      ring(els, c.x + 12, c.y + 12, 16, dark ? T.ink : T.bgLight, dark ? T.white : T.ink, 1);
      text(els, c.x + 12, c.y + 13.5, 16, 12, '✓', { font: 'mono', weight: 500, max: 9, min: 9, maxLines: 1, align: 'center', color: dark ? T.white : T.ink, noFill: true });
      var tt = text(els, c.x + 12, c.y + 34, c.w - 24, 28, it.title, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, color: dark ? T.white : T.ink });
      text(els, c.x + 12, c.y + 38 + tt.height, c.w - 24, c.h - 46 - tt.height, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: dark ? T.white : T.body });
    });
    var rx = CX + lw + 30, rw = CW - lw - 30;
    var st = text(els, rx, top + 40, rw, 90, s.statement, { weight: 500, max: 18, min: 13, maxLines: 4, color: dark ? T.white : T.ink });
    if (s.points) {
      var pts = asList(s.points).slice(0, 6), py = top + 60 + st.height;
      pts.forEach(function (p, k) {
        text(els, rx, py + k * 18, rw, 18, '+  ' + p, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 1, color: dark ? T.white : T.ink });
      });
    }
    return { bg: dark ? T.ink : T.white, els: els, dark: !!dark, noBalance: true };
  }
  V['66D_LAYOUT_COMPANY_OVERVIEW_002'] = function (s) { return approachGrid(s, false); };
  V['66D_LAYOUT_COMPANY_OVERVIEW_004'] = function (s) { return approachGrid(s, true); };

  // Slide 9 (COMPANY_OVERVIEW_003): credentials on Night Blue: four dark KPI cards with a blue rule, numbers in white
  V['66D_LAYOUT_COMPANY_OVERVIEW_003'] = function (s) {
    var items = items_(s, 4), n = items.length;
    if (n < 3 || !items.every(function (it) { return /\d/.test(String(it.value || '')); })) return null;
    var els = [];
    text(els, X0, 24, 470, 56, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 2, color: T.white });
    var top = 104, gap = 10, cw = (CW - gap * (n - 1)) / n, need = 0;
    items.forEach(function (it) { need = Math.max(need, 50 + lineHeight('sans', TSZ.heading) * 2 + textH(it.text, cw - 28, TSZ.body) + 26); });
    var ch = boxH(need, BOTTOM - top - (s.takeaway ? 40 : 0));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.ink, { color: T.slate, width: 0.5 });
      rect(els, x, top + ch - 3, cw, 3, T.blue);
      text(els, x + 14, top + 12, cw - 28, 36, it.value, { font: 'mono', weight: 500, max: 26, min: 16, maxLines: 1, color: T.white });
      var l = text(els, x + 14, top + 50, cw - 28, 30, it.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.white });
      text(els, x + 14, top + 56 + l.height, cw - 28, ch - l.height - 70, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.white });
    });
    if (s.takeaway) text(els, CX, top + ch + 16, CW, 30, s.takeaway, { weight: 500, max: TSZ.heading, min: TSZ.body, maxLines: 2, color: T.white });
    return { bg: T.ink, els: els, dark: true, noBalance: true };
  };


  /* ================= TEMPLATE DESIGNS: REMAINING (batch 4: photo cards, stack, project, pricing, team, OKR) ================= */

  function strs(a, max) { return arr(a, max || 8).map(str).filter(Boolean); }

  // Slide 49 (CARDS_012): white container over a dark photo strip, panel cards with a blue bottom bar, staggered 2-3-2
  V['66D_LAYOUT_CARDS_012'] = function (s) {
    var items = items_(s, 7), n = items.length;
    if (n < 5) return null;
    var els = [];
    rect(els, 0, 0, 640, H, T.white);
    var top = header(els, s, { maxW: 560 });
    var rowsSpec = n === 7 ? [2, 3, 2] : n === 6 ? [3, 3] : [2, 3];
    var cw = 150, gap = 10, rows = rowsSpec.length, rowH = (BOTTOM - top - gap * (rows - 1)) / rows, k = 0;
    rowsSpec.forEach(function (cnt, r) {
      var rowW = cnt * cw + (cnt - 1) * gap, x0 = CX + (560 - rowW) / 2;
      for (var c = 0; c < cnt && k < n; c++, k++) {
        var it = items[k], x = x0 + c * (cw + gap), y = top + r * (rowH + gap);
        rect(els, x, y, cw, rowH - 3, T.bgLight);
        rect(els, x, y + rowH - 3, cw, 3, T.blue);
        var t = text(els, x + 10, y + 8, cw - 28, 28, it.title, { weight: 500, max: TSZ.body + 0.5, min: TSZ.body, maxLines: 2, color: T.ink });
        text(els, x + 10, y + 14 + t.height, cw - 20, rowH - t.height - 24, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
      }
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 56 (CARDS_015): panel with a dark photo strip right; three white cards: icon, blue title, divider, body
  V['66D_LAYOUT_CARDS_015'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3) return null;
    var els = [];
    rect(els, 0, 0, 560, H, T.bgLight);
    var top = header(els, s, { maxW: 500 });
    var cw = 160, gap = 10, iw = cw - 32, hBlock = headBlock(items, iw, 2);
    var ch = boxH(cardNeed(items, iw, hBlock, 64), BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      ellipse(els, x + 16, top + 18, 26, 26, T.bgLight);
      icon(els, autoIcon(it), x + 21, top + 23, 16, false);
      text(els, x + 16, top + 56, iw, hBlock, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.blue });
      line(els, x + 16, top + 62 + hBlock, x + cw - 16, top + 62 + hBlock, T.cardLine, 0.75);
      cardBody(els, x + 16, top + 72 + hBlock, iw, ch - hBlock - 84, it, TSZ.body, items);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 69 (CARDS_022): three outlined cards with a blue top rule, a large blue keyword, sub-heading, text, blue notes
  V['66D_LAYOUT_CARDS_022'] = function (s) {
    var items = items_(s, 3);
    if (items.length !== 3 || !items.every(function (it) { return it.label; })) return null;
    var els = [];
    rect(els, 0, 0, 640, H, T.white);
    var top = header(els, s, { maxW: 560 });
    var cw = 180, gap = 10, iw = cw - 28, need = 0;
    items.forEach(function (it) { need = Math.max(need, 70 + textH(it.text, iw, TSZ.body) + (it.highlight ? textH(it.highlight, iw, TSZ.body) + 24 : 0) + 20); });
    var ch = boxH(need, BOTTOM - top);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, x, top, cw, 3, T.blue);
      text(els, x + 14, top + 12, iw, 26, it.label, { weight: 400, max: 18, min: 14, maxLines: 1, color: T.blue });
      var t = text(els, x + 14, top + 42, iw, 30, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      var b = text(els, x + 14, top + 48 + t.height, iw, ch - t.height - 100, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
      if (it.highlight) text(els, x + 14, top + 60 + t.height + b.height, iw, ch - t.height - b.height - 70, it.highlight, { weight: 500, max: TSZ.body, min: TSZ.body, color: T.blue });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  // Slide 21 (CHART_001): narrative and sources on the left; stacked bars (e.g. cost today vs after) with a legend table
  V['66D_LAYOUT_CHART_001'] = function (s) {
    var ch = s.chart || {}, cats = arr(ch.categories, 3), series = arr(ch.series, 6).filter(function (se) { return se && Array.isArray(se.values); });
    if (String(ch.type || '').toLowerCase() !== 'stacked' || cats.length < 2 || series.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var lw = 190;
    var y = top;
    if (s.statement || s.lead) { var h0 = text(els, CX, y, lw, 60, s.statement || s.lead, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 4, color: T.ink }); y += h0.height + 10; }
    if (s.text) { var h1 = text(els, CX, y, lw, 130, s.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 9, color: T.body }); y += h1.height + 10; }
    if (s.points) {
      text(els, CX, y, lw, 14, 'Sources', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      bulletList(els, CX, y + 16, lw, BOTTOM - y - 16, strs(s.points, 4), { max: TSZ.body, min: TSZ.body, gap: 3 });
    }
    var px = CX + lw + 18, pw = CW - lw - 18, ph = BOTTOM - top;
    rect(els, px, top, pw, ph, T.bgLight);
    if (ch.title || s.insight) text(els, px + 14, top + 10, pw - 28, 16, ch.title || (s.insight && s.insight.title) || '', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
    var totals = cats.map(function (c, i) { return series.reduce(function (t, se) { return t + (Number(se.values[i]) || 0); }, 0); });
    var maxT = Math.max.apply(null, totals) || 1, gx = px + 36, gy = top + 40, gh = ph - 74, bw = 50, chartW = 190;
    var fills = [T.blue, T.ink, T.slate, T.panelAlt, T.blue, T.ink];
    cats.forEach(function (c, i) {
      var x = gx + i * (chartW / cats.length) + 10, yy = gy + gh;
      series.forEach(function (se, k) {
        var v = Number(se.values[i]) || 0, h = gh * v / maxT;
        if (h <= 0) return;
        yy -= h;
        rect(els, x, yy, bw, h - 1, fills[k % fills.length]);
        els[els.length - 1].square = true;
        if (h > 14) text(els, x, yy, bw, h, fmt(v, ch.unit), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: fills[k % fills.length] === T.slate || fills[k % fills.length] === T.panelAlt ? T.ink : T.white, noFill: true });
      });
      text(els, x - 10, yy - 16, bw + 20, 14, fmt(totals[i], ch.unit), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.ink });
      text(els, x - 14, gy + gh + 4, bw + 28, 24, String(c), { weight: 400, max: 10, min: 10, maxLines: 2, align: 'center', color: T.body });
    });
    var lx = gx + chartW + 20, lw2 = px + pw - 14 - lx, rows = arr(s.rows, 6);
    var rowH = Math.min(36, (ph - 50) / series.length);
    series.forEach(function (se, k) {
      var yy2 = top + 40 + k * rowH;
      rect(els, lx, yy2 + 2, 10, 10, fills[k % fills.length]);
      els[els.length - 1].square = true;
      var r = rows[k];
      var label = se.name || '', note = r ? (Array.isArray(r) ? r[1] : (r.text || r.value || '')) : '';
      text(els, lx + 16, yy2, lw2 - 16, 14, label, { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
      if (note) text(els, lx + 16, yy2 + 13, lw2 - 16, rowH - 14, String(note), { weight: 400, max: 10, min: 10, maxLines: 2, color: T.body });
    });
    return { bg: T.white, els: els };
  };

  // Slide 53 (PRODUCT_001): layered stack. Bordered layers joined by "+" markers, optional row of parts, a closing pill
  V['66D_LAYOUT_PRODUCT_001'] = function (s) {
    var layers = arr(s.layers, 4).filter(function (l) { return l && (l.title || l.text); });
    if (layers.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var w = CW - 60, x = CX + 30, chips = strs(s.parts || (s.items || []).map(function (it) { return it.title; }), 8);
    rect(els, CX, top, CW, BOTTOM - top, T.white, { color: T.cardLine, width: 0.75 });
    var foot = s.takeaway || '';
    var avail = BOTTOM - top - 24 - (chips.length ? 46 : 0) - (foot ? 40 : 0);
    var lh = Math.min(64, (avail - (layers.length - 1) * 16) / layers.length), y = top + 12;
    layers.forEach(function (l, i) {
      rect(els, x, y, w, lh, T.white, { color: T.cardLine, width: 1 });
      var t = text(els, x + 20, y + 6, w - 40, 22, l.title, { weight: 500, max: TSZ.heading + 2, min: TSZ.heading, maxLines: 1, align: 'center', color: i === 0 ? T.ink : T.blue });
      text(els, x + 20, y + 8 + t.height, w - 40, lh - t.height - 12, l.text || '', { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.body });
      y += lh;
      if (i < layers.length - 1) {
        ellipse(els, x + w / 2 - 8, y + 0, 16, 16, T.blue);
        text(els, x + w / 2 - 8, y + 1, 16, 14, '+', { weight: 500, max: 11, min: 11, maxLines: 1, align: 'center', color: T.white, noFill: true });
        y += 16;
      }
    });
    if (chips.length) {
      y += 10;
      var cwid = Math.min(110, (w - 8 * (chips.length - 1)) / chips.length), cx0 = x + (w - (chips.length * cwid + (chips.length - 1) * 8)) / 2;
      chips.forEach(function (c, i) {
        line(els, cx0 + i * (cwid + 8) + cwid / 2, y - 10, cx0 + i * (cwid + 8) + cwid / 2, y, T.cardLine, 0.75);
        rect(els, cx0 + i * (cwid + 8), y, cwid, 26, T.bgLight);
        text(els, cx0 + i * (cwid + 8) + 4, y, cwid - 8, 26, c, { weight: 500, max: 10, min: 10, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
      });
      y += 36;
    }
    if (foot) {
      var pw = Math.min(w - 40, textWidth(foot, 'sans', 500, TSZ.body) + 60);
      rect(els, x + w / 2 - pw / 2, y + 4, pw, 24, T.blue);
      text(els, x + w / 2 - pw / 2 + 10, y + 4, pw - 20, 24, foot, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    }
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 28 (TIMELINE_002): Gantt. Task names on the left, period columns, a blue bar from start to end period
  V['66D_LAYOUT_TIMELINE_002'] = function (s) {
    var periods = strs(s.periods, 16), tasks = arr(s.tasks, 10).filter(function (t) { return t && t.name; });
    if (periods.length < 3 || tasks.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var nameW = 150, gx = CX + nameW, colW = (CW - nameW) / periods.length, hdr = 26, rowH = Math.min(30, (BOTTOM - top - hdr) / tasks.length);
    rect(els, CX, top, nameW - 2, hdr, T.bgLight);
    text(els, CX + 6, top, nameW - 12, hdr, s.taskLabel || 'Workstream', { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.ink });
    periods.forEach(function (p, j) {
      rect(els, gx + j * colW + 1, top, colW - 2, hdr, T.bgLight);
      text(els, gx + j * colW + 1, top, colW - 2, hdr, p, { weight: 500, max: 10, min: 10, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
    });
    tasks.forEach(function (t, i) {
      var y = top + hdr + 2 + i * rowH;
      line(els, CX, y + rowH, CX + CW, y + rowH, T.cardLine, 0.5);
      text(els, CX + 6, y, nameW - 12, rowH, t.name, { weight: 400, max: 10, min: 10, maxLines: 2, valign: 'middle', color: T.ink });
      var a = Math.max(1, Math.min(periods.length, Number(t.start) || 1)), b = Math.max(a, Math.min(periods.length, Number(t.end) || a));
      rect(els, gx + (a - 1) * colW + 2, y + rowH * 0.25, (b - a + 1) * colW - 4, rowH * 0.5, T.blue);
    });
    for (var j = 0; j <= periods.length; j++) line(els, gx + j * colW, top + hdr, gx + j * colW, top + hdr + 2 + tasks.length * rowH, T.cardLine, 0.5);
    return { bg: T.white, els: els };
  };

  // Slide 68 (TIMELINE_003): workstream x period matrix. Blue row headers, grey period headers, short notes per cell
  V['66D_LAYOUT_TIMELINE_003'] = function (s) {
    var periods = strs(s.periods, 5), streams = arr(s.workstreams, 4).filter(function (w) { return w && w.name && Array.isArray(w.cells); });
    if (periods.length < 3 || streams.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var rowLab = 84, colW = (CW - rowLab) / periods.length, hdr = 22, rowH = (BOTTOM - top - hdr) / streams.length, fills = [T.slate, T.blue, T.ink, T.blue];
    periods.forEach(function (p, j) {
      rect(els, CX + rowLab + j * colW + 1, top, colW - 2, hdr, T.slate);
      text(els, CX + rowLab + j * colW + 1, top, colW - 2, hdr, p, { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    });
    streams.forEach(function (w, i) {
      var y = top + hdr + 2 + i * rowH;
      rect(els, CX, y, rowLab - 2, rowH - 2, fills[i % fills.length]);
      text(els, CX + 4, y, rowLab - 10, rowH - 2, w.name, { weight: 500, max: 10, min: 10, maxLines: 3, align: 'center', valign: 'middle', color: fills[i % fills.length] === T.slate ? T.ink : T.white });
      periods.forEach(function (p, j) {
        var x = CX + rowLab + j * colW;
        rect(els, x + 1, y, colW - 2, rowH - 2, T.white, { color: T.cardLine, width: 0.5 });
        var cell = w.cells[j];
        var pts = Array.isArray(cell) ? cell.map(str) : (cell ? [str(cell)] : []);
        bulletList(els, x + 6, y + 6, colW - 12, rowH - 12, pts.slice(0, 4), { max: TSZ.body, min: TSZ.body, gap: 3 });
      });
    });
    return { bg: T.white, els: els };
  };

  // Slide 37 (SERVICES_002): service rows (blue label square, "How we help", "What we deliver") and, with tasks, a delivery Gantt
  V['66D_LAYOUT_SERVICES_002'] = function (s) {
    var items = items_(s, 3), n = items.length;
    if (n < 2 || !items.every(function (it) { return it.text && itemPts(it).length >= 2; })) return null;
    var els = [];
    var top = header(els, s);
    var tasks = arr(s.tasks, 5), periods = strs(s.periods, 10), gantt = tasks.length >= 2 && periods.length >= 3;
    var lw = gantt ? 380 : CW, rowH = (BOTTOM - top - 20) / n, labW = 70, howW = (lw - labW - 20) / 2;
    text(els, CX + labW + 10, top, howW, 14, 'How we help', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
    text(els, CX + labW + 20 + howW, top, howW, 14, 'What we deliver', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
    items.forEach(function (it, i) {
      var y = top + 20 + i * rowH;
      rect(els, CX, y, labW, rowH - 10, T.blue);
      text(els, CX + 4, y, labW - 8, rowH - 10, it.title, { weight: 500, max: 10, min: 10, maxLines: 4, align: 'center', valign: 'middle', color: T.white });
      rect(els, CX + labW + 4, y, lw - labW - 4, rowH - 10, T.bgLight);
      text(els, CX + labW + 14, y + 8, howW - 8, rowH - 26, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
      bulletList(els, CX + labW + 20 + howW, y + 8, howW - 6, rowH - 26, itemPts(it).slice(0, 4), { max: TSZ.body, min: TSZ.body, gap: 3 });
    });
    if (gantt) {
      var gx = CX + lw + 14, gw = CW - lw - 14, nameW = 100, colW = (gw - nameW - 16) / periods.length, rh = Math.min(40, (BOTTOM - top - 50) / tasks.length);
      rect(els, gx, top, gw, BOTTOM - top, T.bgLight);
      text(els, gx + 8, top + 8, gw - 16, 14, s.ganttTitle || 'How we deliver', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      periods.forEach(function (p, j) { text(els, gx + 8 + nameW + j * colW, top + 28, colW, 12, p, { font: 'mono', weight: 400, max: 10, min: 10, maxLines: 1, align: 'center', color: T.body }); });
      tasks.forEach(function (t, i) {
        var y = top + 46 + i * rh;
        text(els, gx + 8, y, nameW - 6, rh - 4, str(t.name || t), { weight: 400, max: 10, min: 10, maxLines: 3, color: T.ink });
        var a = Math.max(1, Math.min(periods.length, Number(t.start) || 1)), b = Math.max(a, Math.min(periods.length, Number(t.end) || a));
        rect(els, gx + 8 + nameW + (a - 1) * colW + 1, y + rh / 2 - 6, (b - a + 1) * colW - 2, 12, T.blue);
        line(els, gx + 8, y + rh - 2, gx + gw - 8, y + rh - 2, T.cardLine, 0.5);
      });
    }
    return { bg: T.white, els: els };
  };

  // Slide 29 (TABLE_001): RAID register. # | description | type | status | impact | owner, mitigation row under each
  V['66D_LAYOUT_TABLE_001'] = function (s) {
    var risks = arr(s.risks, 5).filter(function (r) { return r && r.description; });
    if (risks.length < 2) return null;
    var els = [];
    var top = header(els, s);
    var cols = [['#', 26], ['Description', 230], ['Type', 70], ['Status', 70], ['Impact', 70], ['Likelihood', 80], ['Owner', CW - 546]];
    var x = CX, hdr = 22;
    cols.forEach(function (c) { rect(els, x + 1, top, c[1] - 2, hdr, T.blue); text(els, x + 4, top, c[1] - 8, hdr, c[0], { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.white }); x += c[1]; });
    var rowH = (BOTTOM - top - hdr - 4) / risks.length, mitH = risks.some(function (r) { return r.mitigation; }) ? Math.min(30, rowH * 0.4) : 0;
    risks.forEach(function (r, i) {
      var y = top + hdr + 2 + i * rowH, xx = CX;
      var vals = [String(i + 1), r.description, r.type || '', r.status || '', r.impact || '', r.likelihood || '', r.owner || ''];
      cols.forEach(function (c, j) {
        rect(els, xx + 1, y, c[1] - 2, rowH - mitH - 2, T.white, { color: T.cardLine, width: 0.5 });
        text(els, xx + 5, y + 2, c[1] - 10, rowH - mitH - 6, vals[j], { weight: j === 1 ? 400 : 500, max: 10, min: 10, maxLines: 4, valign: 'middle', color: T.ink });
        xx += c[1];
      });
      if (mitH) {
        rect(els, CX + 27, y + rowH - mitH - 2, CW - 28, mitH, T.bgLight);
        text(els, CX + 32, y + rowH - mitH - 2, CW - 40, mitH, (r.mitigation ? 'Mitigation: ' + r.mitigation : ''), { weight: 400, max: 10, min: 10, maxLines: 2, valign: 'middle', color: T.body,
          runs: r.mitigation ? [{ start: 0, end: 11, color: T.ink, weight: 500 }] : null });
      }
    });
    return { bg: T.white, els: els };
  };

  // Slide 30 (TABLE_002): status summary. Status bar (scope, schedule, budget, resources, overall), attention, milestones,
  // accomplishments, deliverables. On track = blue, at risk = Shark Grey, off track = Night Blue, always with the words
  V['66D_LAYOUT_TABLE_002'] = function (s) {
    var rag = s.rag;
    if (!rag || typeof rag !== 'object') return null;
    var els = [];
    var top = header(els, s);
    var keys = ['scope', 'schedule', 'budget', 'resources', 'overall'], cw = CW / keys.length;
    var look = function (v) {
      v = String(v || '').toLowerCase();
      return /red|off/.test(v) ? [T.ink, T.white, 'Off track'] : /amber|yellow|risk/.test(v) ? [T.slate, T.ink, 'At risk'] : [T.blue, T.white, 'On track'];
    };
    keys.forEach(function (k, j) {
      var lk = look(rag[k]), x = CX + j * cw;
      rect(els, x + 1, top, cw - 2, 16, T.bgLight);
      text(els, x + 1, top, cw - 2, 16, k.charAt(0).toUpperCase() + k.slice(1), { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
      rect(els, x + 1, top + 17, cw - 2, 18, lk[0]);
      text(els, x + 1, top + 17, cw - 2, 18, lk[2], { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: lk[1] });
    });
    var y0 = top + 46, colW = (CW - 14) / 2, h = BOTTOM - y0;
    var block = function (x, y, w, hh, title, list) {
      text(els, x, y, w, 14, title, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      rect(els, x, y + 16, w, hh - 18, T.bgLight);
      bulletList(els, x + 8, y + 22, w - 16, hh - 28, strs(list, 5), { max: TSZ.body, min: TSZ.body, gap: 3 });
    };
    block(CX, y0, colW, h * 0.5 - 4, 'Items for leadership attention', s.attention);
    block(CX, y0 + h * 0.5 + 4, colW, h * 0.5 - 4, 'Accomplishments since the last report', s.accomplishments);
    block(CX + colW + 14, y0, colW, h * 0.32 - 4, 'Upcoming dates and milestones', s.milestones);
    var dels = arr(s.deliverables, 6), dy = y0 + h * 0.32 + 4, dh = h * 0.68 - 4;
    text(els, CX + colW + 14, dy, colW, 14, 'Deliverables status', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
    var dx = CX + colW + 14, rH = Math.min(22, (dh - 40) / Math.max(dels.length, 1));
    [['Deliverable', colW - 150], ['% complete', 70], ['Target date', 80]].reduce(function (xx, c) {
      rect(els, xx + 1, dy + 16, c[1] - 2, 18, T.blue);
      text(els, xx + 4, dy + 16, c[1] - 8, 18, c[0], { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.white });
      return xx + c[1];
    }, dx);
    dels.forEach(function (d, i) {
      var yy = dy + 36 + i * rH, vals = [d.name || str(d), d.complete != null ? String(d.complete) : '', d.date || ''], xx = dx;
      [colW - 150, 70, 80].forEach(function (w, j) { text(els, xx + 4, yy, w - 8, rH, vals[j], { weight: 400, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.ink }); xx += w; });
      line(els, dx, yy + rH, dx + colW, yy + rH, T.cardLine, 0.5);
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 33 (TABLE_005): pricing table in a white container (option with detail | monthly price)
  V['66D_LAYOUT_TABLE_005'] = function (s) {
    var prices = arr(s.prices, 6).filter(function (p) { return p && p.option && p.price; });
    if (prices.length < 2) return null;
    var els = [];
    var top = header(els, s);
    rect(els, CX, top, CW, BOTTOM - top, T.white);
    var tw = 460, x = CX + (CW - tw) / 2, c1 = 270, hdr = 26, y = top + 18;
    rect(els, x, y, c1 - 2, hdr, T.blue); rect(els, x + c1, y, tw - c1, hdr, T.blue);
    text(els, x + 12, y, c1 - 24, hdr, s.optionLabel || 'Option', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.white });
    text(els, x + c1 + 12, y, tw - c1 - 24, hdr, s.priceLabel || 'Monthly charge', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, valign: 'middle', color: T.white });
    var rh = Math.min(48, (BOTTOM - y - hdr - 20) / prices.length);
    prices.forEach(function (p, i) {
      var yy = y + hdr + i * rh;
      rect(els, x, yy, tw, rh, T.white, { color: T.cardLine, width: 0.5 });
      els[els.length - 1].square = true;
      var t = text(els, x + 12, yy + (p.detail ? 6 : 0), c1 - 24, p.detail ? 16 : rh, p.option, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, valign: p.detail ? 'top' : 'middle', color: T.ink });
      if (p.detail) text(els, x + 12, yy + 22, c1 - 24, rh - 24, p.detail, { weight: 400, max: 10, min: 10, maxLines: 1, color: T.body });
      text(els, x + c1 + 12, yy, tw - c1 - 24, rh, p.price, { font: 'mono', weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, valign: 'middle', color: T.ink });
      line(els, x + c1, yy, x + c1, yy + rh, T.cardLine, 0.5);
    });
    return { bg: T.bgLight, els: els };
  };

  // Slide 50 (COMPARISON_003): two pricing options side by side: size and monthly price, then the team structure
  V['66D_LAYOUT_COMPARISON_003'] = function (s) {
    var opts = arr(s.pricingOptions, 2).filter(function (o) { return o && o.price; });
    if (opts.length !== 2) return null;
    var els = [];
    var top = header(els, s);
    rect(els, CX, top, CW, BOTTOM - top, T.white);
    var cw = (CW - 60) / 2;
    opts.forEach(function (o, i) {
      var x = CX + 20 + i * (cw + 20), y = top + 16;
      text(els, x, y, cw, 18, o.name || ('Option ' + (i + 1)), { weight: 500, max: TSZ.heading + 1, min: TSZ.heading, maxLines: 1, color: T.ink });
      y += 22;
      rect(els, x, y, cw * 0.55 - 2, 22, T.blue); rect(els, x + cw * 0.55, y, cw * 0.45, 22, T.blue);
      text(els, x + 8, y, cw * 0.55 - 16, 22, s.sizeLabel || 'Size', { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.white });
      text(els, x + cw * 0.55 + 8, y, cw * 0.45 - 16, 22, s.priceLabel || 'Monthly charge', { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: T.white });
      y += 22;
      rect(els, x, y, cw, 44, T.white, { color: T.cardLine, width: 0.75 });
      text(els, x + 8, y + 6, cw * 0.55 - 16, 32, [o.size, o.detail].filter(Boolean).join('\n'), { weight: 400, max: TSZ.body, min: 10, maxLines: 2, color: T.ink });
      text(els, x + cw * 0.55 + 8, y, cw * 0.45 - 16, 44, o.price, { font: 'mono', weight: 500, max: TSZ.heading + 2, min: TSZ.heading, maxLines: 1, valign: 'middle', align: 'center', color: T.ink });
      y += 52;
      var team = strs(o.team, 6);
      if (team.length) {
        rect(els, x, y, cw, BOTTOM - y - 10, T.bgLight);
        text(els, x + 12, y + 10, cw - 24, 14, s.teamLabel || 'Team structure', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.blue });
        bulletList(els, x + 12, y + 30, cw - 24, BOTTOM - y - 50, team, { max: TSZ.body, min: TSZ.body, gap: 3 });
      }
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  };

  // Slide 83 (TEAM_001): client team and 66degrees team: tab label, description, key stakeholders and specialists as role cards
  V['66D_LAYOUT_TEAM_001'] = function (s) {
    var teams = arr(s.teams, 2).filter(function (t) { return t && t.name; });
    if (teams.length !== 2) return null;
    var els = [];
    var top = header(els, s) + 10;
    var cw = (CW - 16) / 2;
    teams.forEach(function (t, i) {
      var x = CX + i * (cw + 16), y = top;
      rect(els, x, y, cw, BOTTOM - y, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, x + cw / 2 - 60, y - 10, 120, 20, T.white, { color: T.cardLine, width: 0.75 });
      text(els, x + cw / 2 - 58, y - 10, 116, 20, t.name, { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
      var d = text(els, x + 14, y + 18, cw - 28, 44, t.text || '', { weight: 400, max: 10, min: 10, maxLines: 4, color: T.body });
      var yy = y + 24 + d.height;
      [['Key stakeholders', t.stakeholders], ['Specialist resources', t.specialists]].forEach(function (grp) {
        var people = arr(grp[1], 6);
        if (!people.length) return;
        text(els, x + 14, yy, cw - 28, 14, grp[0], { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
        yy += 16;
        var per = 3, pw = (cw - 28 - 6 * (per - 1)) / per, ph = 40;
        people.forEach(function (p, k) {
          var px = x + 14 + (k % per) * (pw + 6), py = yy + Math.floor(k / per) * (ph + 6);
          rect(els, px, py, pw, ph, T.bgLight);
          var nm = typeof p === 'object' ? (p.name || p.role || '') : String(p), rl = typeof p === 'object' ? (p.name ? p.role || '' : '') : '';
          text(els, px + 4, py + (rl ? 4 : 0), pw - 8, rl ? 16 : ph, nm, { weight: 500, max: 10, min: 10, maxLines: rl ? 1 : 2, align: 'center', valign: rl ? 'top' : 'middle', color: T.ink });
          if (rl) text(els, px + 4, py + 20, pw - 8, 16, rl, { weight: 400, max: 10, min: 10, maxLines: 1, align: 'center', color: T.body });
        });
        yy += Math.ceil(people.length / per) * (ph + 6) + 8;
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  };

  // Slide 90 (TEAM_004): organisation chart, three levels (1 -> up to 3 -> up to 6), grey boxes with a blue left accent
  V['66D_LAYOUT_TEAM_004'] = function (s) {
    var root = s.org;
    if (!root || !root.name || !Array.isArray(root.reports) || root.reports.length < 2) return null;
    var els = [];
    var top = header(els, s) + 10;
    var kidsN = arr(root.reports, 3).length, maxGk = Math.max.apply(null, arr(root.reports, 3).map(function (k) { return arr(k.reports, 2).length || 1; }));
    var bw = Math.min(150, CW / kidsN / maxGk - 12), bh = 38, lv = [top, top + 90, top + 180];
    var box = function (p, cx, y) {
      rect(els, cx - bw / 2, y, bw, bh, T.bgLight);
      rect(els, cx - bw / 2, y, 3, bh, T.blue);
      text(els, cx - bw / 2 + 10, y + 4, bw - 14, 16, p.name || '', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
      text(els, cx - bw / 2 + 10, y + 19, bw - 14, 16, p.role || '', { weight: 400, max: 10, min: 10, maxLines: 1, color: T.body });
    };
    var kids = arr(root.reports, 3), cx0 = W / 2;
    box(root, cx0, lv[0]);
    var span = CW / kids.length;
    line(els, cx0, lv[0] + bh, cx0, lv[0] + bh + 20, T.cardLine, 1);
    kids.forEach(function (k, i) {
      var cx = CX + span * i + span / 2;
      line(els, cx, lv[0] + bh + 20, cx, lv[1], T.cardLine, 1);
      if (i < kids.length - 1) line(els, cx, lv[0] + bh + 20, CX + span * (i + 1) + span / 2, lv[0] + bh + 20, T.cardLine, 1);
      box(k, cx, lv[1]);
      var gk = arr(k.reports, 2);
      if (!gk.length) return;
      line(els, cx, lv[1] + bh, cx, lv[1] + bh + 20, T.cardLine, 1);
      var sub = Math.min(span / gk.length, bw + 12);
      gk.forEach(function (g, j) {
        var gx = cx - sub * (gk.length - 1) / 2 + j * sub;
        line(els, gx, lv[1] + bh + 20, gx, lv[2], T.cardLine, 1);
        if (j < gk.length - 1) line(els, gx, lv[1] + bh + 20, gx + sub, lv[1] + bh + 20, T.cardLine, 1);
        box(g, gx, lv[2]);
      });
    });
    return { bg: T.white, els: els };
  };

  // Slides 75-78 (OTHER_001): OKR. Dark photo band with the objective, tabs for the objectives (the current one blue),
  // then rows of epics with their measures and targets
  V['66D_LAYOUT_OTHER_001'] = function (s) {
    var tabs = strs(s.tabs, 4), epics = arr(s.epics, 3).filter(function (e) { return e && e.name; });
    if (tabs.length < 2 || epics.length < 1) return null;
    var els = [];
    var top = bandHeader(els, s) - 30;
    var tw = (CW - 9 * (tabs.length - 1)) / tabs.length;
    tabs.forEach(function (t, i) {
      rect(els, CX + i * (tw + 9), 74, tw, 18, i === (s.activeTab || 0) ? T.blue : T.slate);
      text(els, CX + i * (tw + 9) + 6, 74, tw - 12, 18, t, { weight: 500, max: 10, min: 10, maxLines: 1, valign: 'middle', color: i === (s.activeTab || 0) ? T.white : T.ink });
    });
    top = 104;
    var rowH = (BOTTOM - top) / epics.length, labW = 26, colW = (CW - labW - 20) / 2;
    epics.forEach(function (e, i) {
      var y = top + i * rowH;
      text(els, CX + 13 - (rowH - 10) / 2, y + rowH / 2 - 8, rowH - 10, 16, e.name, { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.ink, rot: -90 });
      [['Measures', e.measures], ['Target / output', e.targets]].forEach(function (c, j) {
        var x = CX + labW + j * (colW + 20);
        text(els, x, y + 4, colW, 14, c[0], { weight: 500, max: 10, min: 10, maxLines: 1, color: T.ink });
        line(els, x, y + 20, x + colW, y + 20, T.cardLine, 0.75);
        var val = c[1];
        if (Array.isArray(val)) bulletList(els, x, y + 26, colW, rowH - 32, strs(val, 6), { max: TSZ.body, min: TSZ.body, gap: 2 });
        else text(els, x, y + 26, colW, rowH - 32, str(val), { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
      });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  };

  /* ================= TEAM / LEADERSHIP (template slides 84-88) =================
     People come ONLY from the request or the source material (spec.people[{name, title, location, text}]).
     No photos are generated: every person gets a neutral tile with their initials, in the template's photo position. */
  function people_(s, max) {
    return arr(s.people, max).filter(Boolean).map(function (p) { return typeof p === 'string' ? { name: p } : p; })
      .filter(function (p) { return p.name || p.title; });
  }
  function initials_(name) {
    var w = String(name || '').replace(/[^A-Za-z\s'-]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '·';
    return (w[0].charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }
  function avatar_(els, x, y, size, name, fill) {
    rect(els, x, y, size, size, fill || T.bgLight, { color: T.cardLine, width: 0.75 });
    text(els, x, y, size, size, initials_(name), { font: 'mono', weight: 500, max: Math.max(10, Math.min(24, Math.round(size * 0.3))), min: 9,
      maxLines: 1, align: 'center', valign: 'middle', color: T.blue, noFill: true });
  }
  // Slides 84 / 87 (LEADERSHIP_002 / 004): panel, 3 or 4 white cards: initials tile, blue name, title, location, short text
  function leaderCards_(s, want) {
    var ppl = people_(s, want);
    if (ppl.length !== want) return null;
    var els = [];
    var top = header(els, s);
    var gap = 14, cw = (CW - gap * (want - 1)) / want, av = Math.min(64, cw - 28);
    var need = 0;
    ppl.forEach(function (p) {
      var h = av + 30 + 16 + (p.title ? 26 : 0) + (p.location ? 16 : 0) + (p.text ? 54 : 0);
      need = Math.max(need, h);
    });
    var ch = boxH(need, BOTTOM - top);
    ppl.forEach(function (p, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
      avatar_(els, x + 14, top + 14, av, p.name);
      var y = top + 14 + av + 12;
      var t1 = text(els, x + 14, y, cw - 28, 18, p.name || '', { weight: 500, max: 12, min: 10, maxLines: 1, color: T.blue });
      y += t1.height + 2;
      if (p.title) { var t2 = text(els, x + 14, y, cw - 28, 26, p.title, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink }); y += t2.height + 2; }
      if (p.location) { var t3 = text(els, x + 14, y, cw - 28, 14, p.location, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.body }); y += t3.height + 4; }
      if (p.text) text(els, x + 14, y + 4, cw - 28, top + ch - y - 16, p.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true });
    });
    return { bg: T.bgLight, els: els };
  }
  V['66D_LAYOUT_LEADERSHIP_004'] = function (s) { return leaderCards_(s, 3); };
  V['66D_LAYOUT_LEADERSHIP_002'] = function (s) { return leaderCards_(s, 4); };
  // Rows of bordered tiles with name and title under each: slide 85 (5 in a row), 86 (5 + 4), 88 (2 rows of 6)
  function peopleRows_(s, rowsSpec, bg, tileMax) {
    var total = rowsSpec.reduce(function (a, b) { return a + b; }, 0);
    var ppl = people_(s, total);
    var minN = rowsSpec.length > 1 ? total - rowsSpec[rowsSpec.length - 1] + 1 : Math.min(total, s.__minPeople || total);
    if (ppl.length < minN || ppl.length > total) return null;
    var els = [];
    var top = header(els, s);
    var rows = rowsSpec.length, maxCols = Math.max.apply(null, rowsSpec), gap = 14;
    var colW = (CW - gap * (maxCols - 1)) / maxCols;
    var labelH = 38, rowH = (BOTTOM - top - gap * (rows - 1)) / rows;
    var tile = Math.min(tileMax, colW - 10, rowH - labelH - 6);
    var k = 0;
    rowsSpec.forEach(function (cnt, r) {
      var inRow = Math.min(cnt, ppl.length - k);
      if (inRow <= 0) return;
      var rowW = inRow * colW + (inRow - 1) * gap, x0 = CX + (CW - rowW) / 2, y = top + r * (rowH + gap);
      for (var c = 0; c < inRow; c++, k++) {
        var p = ppl[k], x = x0 + c * (colW + gap);
        avatar_(els, x + (colW - tile) / 2, y, tile, p.name, bg === T.white ? T.bgLight : T.white);
        var t1 = text(els, x, y + tile + 6, colW, 16, p.name || '', { weight: 500, max: TSZ.body + 0.5, min: TSZ.body, maxLines: 1, align: 'center', color: T.ink });
        if (p.title) text(els, x, y + tile + 8 + t1.height, colW, 26, p.title, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.body, noFill: true });
      }
    });
    return { bg: bg, els: els, center: true };
  }
  // One row of large tiles: 2 to 5 people (a second look for small groups next to the white cards)
  V['66D_LAYOUT_LEADERSHIP_003'] = function (s) {
    var n = people_(s, 5).length;
    if (n < 2 || n > 5 || arr(s.people, 99).length > 5) return null;
    return peopleRows_(Object.assign({}, s, { __minPeople: 2 }), [n], T.white, 110);
  };
  // List rows: initials tile, name in blue, title and location, and the person's short text on the right (2-6 people)
  V.ENGINE_TEAM_LIST = function (s) {
    var ppl = people_(s, 6);
    if (ppl.length < 2 || arr(s.people, 99).length > 6) return null;
    var els = [];
    var top = header(els, s);
    var n = ppl.length, gap = 8, rowH = Math.min(70, (BOTTOM - top - gap * (n - 1)) / n), av = Math.min(46, rowH - 12);
    var nameW = 230;
    ppl.forEach(function (p, i) {
      var y = top + i * (rowH + gap);
      rect(els, CX, y, CW, rowH, T.white, { color: T.cardLine, width: 0.75 });
      rect(els, CX, y, 4, rowH, T.blue);
      avatar_(els, CX + 16, y + (rowH - av) / 2, av, p.name);
      var tx = CX + 16 + av + 14;
      var t1 = text(els, tx, y + 8, nameW - av - 30, 18, p.name || '', { weight: 500, max: 12, min: 10, maxLines: 1, color: T.blue });
      text(els, tx, y + 10 + t1.height, nameW - av - 30, rowH - t1.height - 14, [p.title, p.location].filter(Boolean).join(', '),
        { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink });
      if (p.text) text(els, CX + nameW + 16, y + 8, CW - nameW - 32, rowH - 16, p.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: T.body });
    });
    return { bg: T.bgLight, els: els };
  };
  V['66D_LAYOUT_TEAM_002'] = function (s) { return peopleRows_(s, [5, 4], T.white, 74); };
  V['66D_LAYOUT_TEAM_003'] = function (s) { return peopleRows_(s, [6, 6], T.bgLight, 66); };
  L.team = function (s, ctx) {
    var n = people_(s, 12).length;
    var tag = n <= 3 ? '66D_LAYOUT_LEADERSHIP_004' : n === 4 ? '66D_LAYOUT_LEADERSHIP_002' : n === 5 ? '66D_LAYOUT_LEADERSHIP_003'
      : n <= 9 ? '66D_LAYOUT_TEAM_002' : '66D_LAYOUT_TEAM_003';
    var out = V[tag](s, ctx);
    if (!out && n === 2) out = peopleRows_(s, [2], T.white, 110);
    if (!out && n === 1) out = peopleRows_(s, [1], T.white, 120);
    return out || L.cards(Object.assign({}, s, { items: people_(s, 12).map(function (p) { return { title: p.name, text: [p.title, p.location].filter(Boolean).join(', ') }; }), reference: null }), ctx);
  };
  // Real template slides (client logos, leadership, industries) are COPIED from the template by Code.gs.
  // This layout is only drawn when that copy is not possible: the title and lead, nothing invented.
  L.template = function (s) {
    var els = [];
    header(els, s);
    return { bg: T.white, els: els };
  };

  var VARIANTS = {
    agenda: [
      { tag: '66D_LAYOUT_AGENDA_002', min: 1, max: 8, desc: 'numbered rows with square badges; the classic agenda' },
      { tag: '66D_LAYOUT_AGENDA_001', min: 2, max: 9, desc: 'clean bulleted list with descriptions' },
      { tag: '66D_LAYOUT_AGENDA_003', min: 3, max: 5, desc: 'ring graphic with topic pills on an arc; most visual, only for 3-5 short topics' },
      { tag: 'ENGINE_AGENDA_COLUMNS', min: 9, max: 16, desc: 'two columns of numbered topics; a long deck' },
      { tag: 'ENGINE_AGENDA_TILES', min: 6, max: 16, desc: 'numbered tiles in 3-4 columns; a long deck' }],
    cover: [
      { tag: '66D_LAYOUT_COVER_001', min: 0, max: 99, desc: 'template cover: title left, blue band with the date and the 66 badge' },
      { tag: 'ENGINE_COVER_PANEL', min: 0, max: 99, desc: 'blue panel on the left with the 66 mark and date, title on the right' },
      { tag: 'ENGINE_COVER_CUBE', min: 0, max: 99, desc: 'title with the isometric cube on the right, slim blue band with the date' }],

    cards: [
      { tag: '66D_LAYOUT_CARDS_007', min: 2, max: 6, desc: 'grid of panel cards with numbers or icons; general purpose', words: '35-55' },
      { tag: '66D_LAYOUT_CARDS_001', min: 3, max: 6, desc: 'big numbered panels with a divider; values, principles, pillars', words: '30-50' },
      { tag: '66D_LAYOUT_CARDS_003', min: 2, max: 4, desc: 'wide icon cards; benefits or outcomes with more text per card', words: '45-70' },
      { tag: '66D_LAYOUT_CARDS_006', min: 3, max: 5, desc: 'tall white icon cards on a light background; capabilities or services', words: '30-50' },
      { tag: '66D_LAYOUT_CARDS_013', min: 2, max: 4, desc: 'numbered cards with an icon circle; key initiatives or offerings', words: '35-55' },
      { tag: '66D_LAYOUT_CARDS_004', min: 6, max: 8, desc: '4 x 2 grid alternating white and grey cards with icons; many short capabilities or assets', words: '15-25' },
      { tag: '66D_LAYOUT_CARDS_005', min: 4, max: 5, desc: '2 x 2 white cards on a grey backdrop with a plus where they meet; 5th item = tall feature card on the right', words: '20-35' },
      { tag: '66D_LAYOUT_CARDS_008', min: 4, max: 6, desc: '3 x 2 panel cards, heading with a line-art icon, divider, body; services or themes', words: '20-35' },
      { tag: '66D_LAYOUT_CARDS_009', min: 3, max: 6, needs: 'itemPoints', desc: 'panel cards each with a short intro and 3-5 bullet points (items[].points)', words: 'intro 8-15, points 4-8 each' },
      { tag: '66D_LAYOUT_CARDS_010', min: 2, max: 2, needs: 'itemChallenge', desc: 'two panel cards each with a label, heading, "Challenge" and "Benefit" (items[].label/challenge/benefit)', words: 'challenge 20-35, benefit 20-35' },
      { tag: '66D_LAYOUT_CARDS_011', min: 2, max: 2, desc: 'two large panels, heading and a longer paragraph each; two big ideas side by side', words: '45-70' },
      { tag: '66D_LAYOUT_CARDS_014', min: 3, max: 3, desc: 'three white icon cards on a panel with a dark photo strip on the right; a visual opener', words: '15-25' },
      { tag: '66D_LAYOUT_CARDS_016', min: 3, max: 4, desc: 'dark photo band with the title, numbered white cards below; benefits or priorities', words: '25-40' },
      { tag: '66D_LAYOUT_CARDS_017', min: 4, max: 5, desc: 'dark photo band with the title, rule cards with icons staggered 3 + 2', words: '20-30' },
      { tag: '66D_LAYOUT_CARDS_019', min: 3, max: 4, desc: 'tall panel cards, blue title, icon top-right, divider, body', words: '30-45' },
      { tag: '66D_LAYOUT_CARDS_020', min: 6, max: 8, desc: '4 x 2 grid of outlined cards with icons; a broad set of capabilities', words: '15-25' },
      { tag: '66D_LAYOUT_CARDS_021', min: 4, max: 6, desc: 'outlined cards with a blue header tab carrying the title', words: '20-35' },
      { tag: '66D_LAYOUT_CARDS_023', min: 4, max: 4, desc: '2 x 2 white rule cards with icons and a grey footer bar for the takeaway', words: '25-40' },
      { tag: '66D_LAYOUT_CARDS_024', min: 2, max: 4, desc: 'white cards with a blue "!" badge; problems, risks or pain points', words: '20-35' },
      { tag: '66D_LAYOUT_SERVICES_004', min: 6, max: 8, desc: 'connector tree from the top to two rows of cards with icons; accelerators, offerings or a portfolio', words: '15-25' },
      { tag: '66D_LAYOUT_BULLETS_002', min: 2, max: 2, needs: 'itemPoints', desc: 'two white numbered cards with 3-5 bullet points each (items[].points), dark photo strip on the right', words: 'points 5-10 each' },
      { tag: '66D_LAYOUT_BULLETS_003', min: 2, max: 4, needs: 'itemPoints', desc: 'one card with groups: blue heading + bullet points (items[].points); detailed requirements or scope', words: 'points 10-20 each' },
      { tag: '66D_LAYOUT_BULLETS_004', min: 6, max: 10, desc: 'numbered list in two columns, bold title and a one-line description; many short items', words: '8-14' },
      { tag: '66D_LAYOUT_BULLETS_005', min: 3, max: 4, desc: 'dark photo slide with icon rows; a strong, visual list of commitments or principles', words: '12-22' },
      { tag: '66D_LAYOUT_BULLETS_006', min: 3, max: 4, needs: 'text', desc: 'dark photo band, a text card on the left (text, 40-70 words) and rule items on the right', words: '10-20' },
      { tag: '66D_LAYOUT_BULLETS_007', min: 3, max: 3, needs: 'itemPoints', desc: 'three columns with a blue heading and bullet points (items[].points)', words: 'points 5-12 each' },
      { tag: '66D_LAYOUT_SERVICES_001', min: 3, max: 3, needs: 'itemPoints', desc: 'three pillars: numbered header card with description, then the offerings as bullets (items[].points), phase bar', words: 'text 12-20, points 2-5 words each' },
      { tag: '66D_LAYOUT_COMPANY_OVERVIEW_002', min: 4, max: 5, needs: 'statement', desc: 'credential cards with check marks and a footprint statement with points on the right (light)', words: '12-22' },
      { tag: '66D_LAYOUT_COMPANY_OVERVIEW_004', min: 4, max: 5, needs: 'statement', desc: 'as COMPANY_OVERVIEW_002 on a dark background; a strong "why us" slide', words: '12-22' },
      { tag: '66D_LAYOUT_CARDS_012', min: 5, max: 7, desc: 'staggered panel cards (2-3-2) in a white container with a dark photo strip; a broad set of short ideas', words: '12-22' },
      { tag: '66D_LAYOUT_CARDS_015', min: 3, max: 3, desc: 'three white cards with an icon, blue title and divider, dark photo strip on the right', words: '18-30' },
      { tag: '66D_LAYOUT_CARDS_022', min: 3, max: 3, needs: 'itemLabel', desc: 'three outlined cards with a large blue keyword (items[].label), a heading, text and a blue note (highlight)', words: '25-40' },
      { tag: '66D_LAYOUT_SERVICES_002', min: 2, max: 3, needs: 'itemPoints', desc: 'service rows: label, "How we help" (text) and "What we deliver" (points); add tasks[] + periods[] for a delivery Gantt', words: 'text 20-35, points 3-6 words' },
      { tag: '66D_LAYOUT_TEAM_001', min: 0, max: 99, needs: 'teams', desc: 'client team and 66degrees team side by side with stakeholders and specialists (teams[])', words: 'text 20-35' },
      { tag: '66D_LAYOUT_TEAM_004', min: 0, max: 99, needs: 'org', desc: 'organisation chart, three levels (org{name, role, reports[...]})', words: 'names and roles' },
      { tag: '66D_LAYOUT_OTHER_001', min: 0, max: 99, needs: 'tabs', desc: 'OKR slide: objective tabs, epics with measures and targets (tabs[], epics[])', words: 'measures 15-30' }],
    process: [
      { tag: '66D_LAYOUT_PROCESS_001', min: 3, max: 5, desc: 'arrow line with numbered phases and a large icon per phase; methodology', words: '25-45' },
      { tag: '66D_LAYOUT_PROCESS_002', min: 3, max: 6, desc: 'tall step cards with number badges (label pill = the step timing); delivery steps', words: '30-50' },
      { tag: '66D_LAYOUT_PROCESS_003', min: 3, max: 5, desc: 'blue chevron arrows above text cards; a flow or engagement lifecycle with a full paragraph per step', words: '35-55' },
      { tag: '66D_LAYOUT_PROCESS_004', min: 3, max: 5, desc: 'ascending staircase; a maturity journey or transformation path', words: '25-45' },
      { tag: '66D_LAYOUT_PROCESS_005', min: 3, max: 5, desc: 'chain of ringed icon circles; a continuous cycle or connected capabilities with one short sentence each', words: '22-40' },
      { tag: '66D_LAYOUT_PROCESS_006', min: 4, max: 5, desc: 'intro text on the left, numbered steps climbing to the right with a caption beside each; a maturity path', words: '12-22' }],
    timeline: [
      { tag: '66D_LAYOUT_TIMELINE_001', min: 3, max: 7, desc: 'blue period band with callouts above and below; a longer timeline', words: '22-40' },
      { tag: '66D_LAYOUT_TIMELINE_004', min: 3, max: 5, desc: 'period tabs in a blue ramp with cards below; phases, years or quarters', words: '30-50' },
      { tag: 'ENGINE_TIMELINE_PANELS', min: 2, max: 6, desc: 'band with markers and numbered panels; a phased roadmap', words: '30-50' },
      { tag: '66D_LAYOUT_COMPARISON_004', min: 3, max: 3, desc: 'three eras side by side, the last (today) in a solid blue card; items[{label, title, text}]', words: '20-35' },
      { tag: '66D_LAYOUT_TIMELINE_002', min: 0, max: 99, needs: 'tasks', desc: 'Gantt: periods[] as columns, tasks[{name, start, end}] as blue bars (project plan)', words: 'task names 2-6' },
      { tag: '66D_LAYOUT_TIMELINE_003', min: 0, max: 99, needs: 'workstreams', desc: 'workstream x period matrix: periods[] (3-5), workstreams[{name, cells[[points per period]]}]', words: '3-6 per point' }],
    stats: [
      { tag: '66D_LAYOUT_COMPANY_OVERVIEW_001', min: 2, max: 4, desc: 'KPI cards with big numbers, label and explanation, takeaway bar', words: '25-45' },
      { tag: '66D_LAYOUT_STATS_001', min: 2, max: 4, desc: 'numbered number tiles plus a table (measure | why it matters)', words: '22-40' },
      { tag: '66D_LAYOUT_CHART_002', min: 2, max: 4, desc: 'narrative on the left (takeaway) with stacked stats on the right; research findings', words: '20-35' },
      { tag: '66D_LAYOUT_COMPANY_OVERVIEW_003', min: 3, max: 4, desc: 'credentials on a dark background: dark KPI cards with white numbers and a blue rule', words: '15-25' }],
    case_study: [
      { tag: '66D_LAYOUT_CASE_STUDY_002', min: 0, max: 99, needs: 'cases', desc: 'client journey: 3-4 client examples side by side, each with phase, offering, industry, challenge and value unlocked (use when you have several client examples); fields: cases[{phase, offering, industry, challenge, value_headline, value}]', words: 'challenge 14-18, value_headline 3-6, value 10-14' },
      { tag: '66D_LAYOUT_CASE_STUDY_005', min: 0, max: 99, desc: 'Business challenge | How 66degrees helped (numbered steps) | Business impact panel', words: 'challenge 40-60, solution 3-4 points of 15-25' },
      { tag: '66D_LAYOUT_CASE_STUDY_006', min: 0, max: 99, desc: 'industry pill, challenge and solution side by side, outcome, blue impact band with the numbers', words: 'challenge 40-60, solution 50-70, outcome 20-35' },
      { tag: '66D_LAYOUT_CASE_STUDY_001', min: 0, max: 99, needs: 'cases', desc: 'impact table for 3-6 clients: client | context | how we helped | impact, grouped by phase; cases[{phase, client, industry, challenge, solution, value_headline, value}]', words: 'cells 10-20' },
      { tag: '66D_LAYOUT_CASE_STUDY_003', min: 0, max: 99, needs: 'cases', desc: 'three client columns: client header, challenge, solution, outcome, phase bar; cases[] (exactly 3)', words: 'challenge 20-30, solution 20-30' },
      { tag: '66D_LAYOUT_CASE_STUDY_004', min: 0, max: 99, desc: 'success story on a dark photo: challenge, what we did (bullets), blue results column (one client)', words: 'challenge 30-50, solution 3-5 points' }],
    statement: [
      { tag: 'ENGINE_STATEMENT_POINTS', min: 0, max: 99, desc: 'statement on the left with up to 3 point cards on the right', words: 'statement 12-20' },
      { tag: 'ENGINE_STATEMENT_BAND', min: 0, max: 99, desc: 'statement in a blue band, 2-3 point cards in a row below', words: 'statement 12-22, points 12-25' },
      { tag: '66D_LAYOUT_STATEMENT_001', min: 0, max: 99, needs: 'noPoints', desc: 'big 66 mark, the statement in a grey callout card, photo strip on the right (no points)', words: 'statement 10-18, text 20-35' },
      { tag: '66D_LAYOUT_STATEMENT_002', min: 0, max: 99, needs: 'noPoints', desc: 'full photo slide with the statement in large white type (no points); a powerful pause', words: 'statement 8-16, text 15-30' }],
    bullets: [
      { tag: 'ENGINE_BULLETS', min: 0, max: 99, desc: 'bullet list with an optional blue side panel (callout)', words: '12-22 per point' },
      { tag: '66D_LAYOUT_BULLETS_001', min: 0, max: 99, needs: 'callout', desc: 'numbered menu of 3-6 short topics (first highlighted) and a panel explaining the focus topic (callout)', words: 'points 2-5, callout 30-50' }],
    table: [
      { tag: 'ENGINE_TABLE', min: 0, max: 99, desc: 'blue-header table, 3-5 columns', words: '3-12 per cell' },
      { tag: '66D_LAYOUT_TABLE_003', min: 0, max: 99, desc: 'two-column table in a white card (label | description)', words: 'description 12-25' },
      { tag: '66D_LAYOUT_TABLE_004', min: 0, max: 99, desc: '3-4 column table with blue header tabs and centred cells', words: '3-12 per cell' },
      { tag: '66D_LAYOUT_TABLE_001', min: 0, max: 99, needs: 'risks', desc: 'RAID register: risks[{description, type, status, impact, likelihood, owner, mitigation}]', words: 'description 10-20' },
      { tag: '66D_LAYOUT_TABLE_002', min: 0, max: 99, needs: 'rag', desc: 'status report: rag{scope, schedule, budget, resources, overall: green/amber/red}, attention[], accomplishments[], milestones[], deliverables[{name, complete, date}]', words: 'points 6-14' },
      { tag: '66D_LAYOUT_TABLE_005', min: 0, max: 99, needs: 'prices', desc: 'pricing table: prices[{option, detail, price}]', words: 'short' }],
    chart: [
      { tag: 'ENGINE_CHART', min: 0, max: 99, desc: 'bar or line chart with an insight panel', words: 'insight 20-35' },
      { tag: '66D_LAYOUT_CHART_003', min: 0, max: 99, needs: 'rows', desc: 'bar chart panel next to a data table panel (chart + columns/rows)', words: 'cells 1-4' },
      { tag: '66D_LAYOUT_CHART_001', min: 0, max: 99, needs: 'stacked', desc: 'narrative and sources on the left, stacked bars (e.g. cost today vs after) with a legend (chart.type "stacked")', words: 'text 40-70' }],
    team: [
      { tag: '66D_LAYOUT_LEADERSHIP_004', min: 3, max: 3, desc: 'three white cards: initials tile, name in blue, title, location, one-line text; a small leadership group', words: 'text 8-16' },
      { tag: '66D_LAYOUT_LEADERSHIP_002', min: 4, max: 4, desc: 'four white cards: initials tile, name in blue, title, location; leadership team', words: 'text 6-12' },
      { tag: '66D_LAYOUT_LEADERSHIP_003', min: 2, max: 5, desc: 'one row of large bordered tiles with name and title; leadership team', words: 'titles 2-6' },
      { tag: 'ENGINE_TEAM_LIST', min: 2, max: 6, desc: 'one row per person: initials tile, name, title and location, short text on the right', words: 'text 10-20' },
      { tag: '66D_LAYOUT_TEAM_002', min: 6, max: 9, desc: 'tiles staggered 5 + 4 with name and title; key contributors', words: 'titles 2-6' },
      { tag: '66D_LAYOUT_TEAM_003', min: 10, max: 12, desc: 'two rows of six tiles with name and title; a project team', words: 'titles 2-6' }],
    diagram: [
      { tag: '66D_LAYOUT_DIAGRAM_001', min: 5, max: 8, desc: 'hub and spoke: a centre label with numbered circles around it and captions outside; capabilities around one platform', words: '8-16' },
      { tag: '66D_LAYOUT_DIAGRAM_002', min: 3, max: 3, desc: 'three numbered diagonal bars with three text rows; three pillars or levers', words: '20-35' },
      { tag: '66D_LAYOUT_DIAGRAM_003', min: 3, max: 3, desc: 'three-tier pyramid with numbered callouts (items may have points[]); levels, maturity or priorities', words: '15-30' },
      { tag: '66D_LAYOUT_DIAGRAM_004', min: 3, max: 3, desc: 'three panels with the centre one raised; the middle option or core idea stands out', words: '25-40' },
      { tag: '66D_LAYOUT_DIAGRAM_005', min: 4, max: 5, desc: 'wave of icon circles with captions above and below; a flow or connected capabilities', words: '10-20' },
      { tag: '66D_LAYOUT_DIAGRAM_006', min: 4, max: 6, desc: 'half donut in segments with icons, intro text on the left (text), captions on the right; parts of a whole', words: '10-18' },
      { tag: '66D_LAYOUT_DIAGRAM_007', min: 3, max: 5, desc: 'radial fan of growing wedges with captions around; building blocks that add up', words: '10-18' },
      { tag: '66D_LAYOUT_DIAGRAM_008', min: 4, max: 6, desc: 'tree with circles growing towards the base, captions left and right; roots and outcomes', words: '10-20' },
      { tag: '66D_LAYOUT_DIAGRAM_009', min: 3, max: 3, desc: 'three bars forming a triangle (a cycle) with three callouts; a reinforcing loop', words: '15-30' },
      { tag: '66D_LAYOUT_SERVICES_003', min: 4, max: 4, desc: 'story on the left (statement, text, points) and a four-part donut with labels; a continuous service cycle', words: 'labels 2-4, text 30-50' },
      { tag: '66D_LAYOUT_PRODUCT_001', min: 0, max: 99, needs: 'layers', desc: 'layered platform stack joined by plus markers, a row of parts and a closing pill (layers[], parts[], takeaway)', words: 'layer text 8-16' }],
    comparison: [
      { tag: '66D_LAYOUT_COMPARISON_005', min: 0, max: 99, desc: 'two panels with blue and slate headers and bullet points (3-6 points per side, ONE line each)', words: '6-14 per point' },
      { tag: '66D_LAYOUT_COMPARISON_006', min: 0, max: 99, desc: 'two cards: crosses on the left (current state / without), ticks on the right (future / with); left = the weaker option', words: '6-14 per point' },
      { tag: '66D_LAYOUT_COMPARISON_001', min: 0, max: 99, needs: 'options', desc: 'check matrix: options[] as columns, rows[{label, values[true/false per option]}], optional points[] on the right', words: 'labels 3-8' },
      { tag: '66D_LAYOUT_COMPARISON_002', min: 0, max: 99, needs: 'rows', desc: 'comparison table: rows[{label, left, right}] under left.label / right.label headers', words: '6-14 per cell' },
      { tag: '66D_LAYOUT_COMPARISON_003', min: 0, max: 99, needs: 'pricingOptions', desc: 'two pricing options: pricingOptions[{name, size, detail, price, team[]}]', words: 'short' }]
  };

  var ALIASES = { intro: 'statement', key_message: 'statement', problem: 'cards', benefits: 'cards', kpi: 'stats', metrics: 'stats',
    steps: 'process', roadmap: 'timeline', list: 'bullets', thank_you: 'closing', title: 'cover', divider: 'section',
    case: 'case_study', checklist: 'next_steps', two_column: 'comparison',
    architecture: 'diagram', flowchart: 'diagram', cycle: 'diagram',
    'org-chart': 'diagram', 'data-flow': 'diagram', dependency: 'diagram', 'database-schema': 'diagram',
    swimlane: 'diagram', sequence: 'diagram', state: 'diagram', tree: 'diagram',
    leadership: 'team', people: 'team', contributors: 'team',
    clients: 'template', logos: 'template', client_logos: 'template', industries: 'template' };

  // Removes color codes (e.g. "#0052FF") and stray whitespace that a model may copy from design rules into slide text
  function cleanText(v) {
    return String(v)
      .replace(/#[0-9A-Fa-f]{6}/g, '')                                              // color codes
      .replace(/\s*[\[(]\s*66D_[A-Z0-9_]+(?:\s*[,;\]\[)(]+\s*66D_[A-Z0-9_]+)*\s*[\])]/g, '')   // [66D_FACT_COMPANY_013]
      .replace(/\s*\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\](?:\s*\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\])*/g, '')  // research markers [1][4]
      .replace(/\s*66D_[A-Z]+_[A-Z0-9_]+/g, '')                                       // bare tags
      .replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/^\s+|\s+$/g, '');
  }
  function cleanSpec(v) {
    if (typeof v === 'string') return cleanText(v);
    if (Array.isArray(v)) return v.map(cleanSpec);
    if (v && typeof v === 'object') {
      var out = {};
      // reference: design data; notes / fact_tags: speaker-notes material handled by Code.gs (citations kept there)
      Object.keys(v).forEach(function (k) { out[k] = (k === 'reference' || k === 'notes' || k === 'fact_tags') ? v[k] : cleanSpec(v[k]); });
      return out;
    }
    return v;
  }

  function variantOf(type, tag) {
    return (VARIANTS[type] || []).some(function (v) { return v.tag === tag; });
  }
  // Design menu text for the content planner (Code.gs)
  function designMenu() {
    return Object.keys(VARIANTS).map(function (type) {
      return type + ':\n' + VARIANTS[type].map(function (v) {
        return '  - ' + v.tag + ' (' + (v.max < 99 ? v.min + '-' + v.max + ' items, ' : '') + v.desc + (v.words ? '; ' + v.words + ' words' + (/^\d/.test(v.words) ? ' each' : '') : '') + ')';
      }).join('\n');
    }).join('\n');
  }

  // Elements below the title area (images excluded): 0 means the design drew no content
  function contentCount_(out) {
    return ((out && out.els) || []).filter(function (e) {
      var y = e.t === 'line' ? Math.min(e.y1, e.y2) : e.y;
      return e.t !== 'image' && y >= 64;
    }).length;
  }
  // Dark designs on the stripes picture: titles are kept to the left part of the slide, where the picture is dark
  var HEADER_MAX_W = 0;
  function layoutSlide(s, type, lctx) {
    var mark = AUDIT ? AUDIT.length : 0;
    var out = layoutSlideOnce_(s, type, lctx);
    if (out && out.bgImage === 'section-bg' && ['cover', 'section', 'closing', 'agenda', 'template'].indexOf(type) === -1 && !HEADER_MAX_W) {
      if (AUDIT) AUDIT.length = mark;
      HEADER_MAX_W = 470;
      try { out = layoutSlideOnce_(s, type, lctx); } finally { HEADER_MAX_W = 0; }
    }
    return out;
  }
  function layoutSlideOnce_(s, type, lctx) {
    var tag = s.reference && s.reference.tag;
    var out = (tag && V[tag] && variantOf(type, tag)) ? V[tag](s, lctx) : null;
    if (out && contentCount_(out) === 0) out = null;
    out = out || L[type](s, lctx);
    // Never an empty slide: content the chosen type cannot show is drawn as cards (items) or bullets (points)
    if (['cover', 'agenda', 'closing', 'section', 'statement', 'quote', 'template'].indexOf(type) === -1 && contentCount_(out) === 0) {
      var alt = null;
      // 1. a design of this type made for the slide's special content (risks -> RAID register, prices, RAG status...)
      (VARIANTS[type] || []).forEach(function (v) {
        if (alt || !v.needs || !V[v.tag]) return;
        try { var o2 = V[v.tag](s, lctx); if (o2 && contentCount_(o2) > 0) alt = o2; } catch (e) {}
      });
      if (alt) return alt;
      // 2. otherwise the content as cards (items, layers, risks) or bullets (points)
      var its = arr(s.items, 8).concat(arr(s.layers, 4)).concat(arr(s.risks, 6).map(function (r) {
        return r && { title: r.description || r.title || '', text: r.mitigation || r.text || '' };
      })).filter(function (x) { return x && (x.title || x.text || typeof x === 'string'); });
      if (its.length >= 2) alt = L.cards(Object.assign({}, s, { items: its, reference: null }), lctx);
      else if (arr(s.points, 6).length) alt = L.bullets(Object.assign({}, s, { reference: null }), lctx);
      if (alt && contentCount_(alt) > 0) out = alt;
    }
    if (['cover', 'agenda', 'closing', 'section', 'statement', 'chart', 'quote'].indexOf(type) === -1 && !out.noBalance &&
        tag !== '66D_LAYOUT_CHART_002' && tag !== '66D_LAYOUT_CASE_STUDY_006') balance(out);
    return out;
  }

  // When the content is shorter than the space, the whole content block moves down so it sits in the middle of the
  // area between the title and the footer (no big empty band at the bottom of the slide).
  function balance(out) {
    var CONTENT_TOP = 64, minY = Infinity, maxY = -Infinity;
    out.els.forEach(function (e) {
      var y = e.t === 'line' ? Math.min(e.y1, e.y2) : e.y;
      var h = e.t === 'line' ? Math.abs(e.y2 - e.y1) : (e.t === 'text' ? (e.vh || e.h) : (e.h || e.size || 0));
      if (e.t === 'image' || y < CONTENT_TOP) return;
      minY = Math.min(minY, y); maxY = Math.max(maxY, y + h);
    });
    if (minY === Infinity) return;
    var free = BOTTOM - maxY;
    if (free < 24) return;
    // Content that fills most of the area gets a small nudge; a compact design (rings, short rows) is centred
    // A third of the free space above the content, two thirds below (no wide band under the intro, no empty bottom
    // half); compact designs such as the ring chain are centred
    var dy = out.center ? free / 2 : Math.min(free / 2, 40);       // short content sits in the middle of the free area
    out.els.forEach(function (e) {
      var y = e.t === 'line' ? Math.min(e.y1, e.y2) : e.y;
      if (e.t === 'image' || y < CONTENT_TOP) return;
      if (e.t === 'line') { e.y1 += dy; e.y2 += dy; } else e.y += dy;
    });
  }

  // Visual family of a drawn slide, e.g. "light|grey|lbar|icons": two designs with the same family look alike to
  // the audience (grey icon cards, a dark band on top, numbered tiles...) even when they are different template slides.
  function lookOf_(lay, type) {
    var els = lay.els || [];
    var big = els.filter(function (e) { return (e.t === 'rect' || e.t === 'roundrect') && e.w >= 60 && e.h >= 40 && e.y >= 40; });
    var fills = {};
    big.forEach(function (e) {
      var f = e.fill === T.bgLight ? 'grey' : e.fill === T.white ? (e.line ? 'outline' : 'white') : e.fill === T.blue ? 'blue' : e.fill === T.ink ? 'ink' : 'other';
      fills[f] = (fills[f] || 0) + 1;
    });
    var main = Object.keys(fills).sort(function (a, b) { return fills[b] - fills[a]; })[0] || 'none';
    var has = function (f) { return els.some(f); };
    var accent = has(function (e) { return e.t === 'arc' || e.t === 'shape'; }) ? 'shape'
      : has(function (e) { return e.t === 'rect' && e.h >= 18 && e.h <= 46 && e.w >= 60 && (e.fill === T.blue || e.fill === T.ink) && e.y >= 60; }) ? 'hdr'
      : has(function (e) { return e.t === 'rect' && e.w <= 6 && e.h >= 24 && e.y >= 40; }) ? 'lbar'
      : has(function (e) { return e.t === 'rect' && e.h <= 4 && e.w >= 40 && e.y >= 40; }) ? 'tbar'
      : els.filter(function (e) { return e.t === 'ellipse'; }).length >= 3 ? 'dots' : 'plain';
    var icons = has(function (e) { return e.t === 'icon'; }) ? 'icons' : 'noicons';
    return [(lay.dark || lay.bgImage) ? 'dark' : 'light', main, accent, icons].join('|');
  }

  // Fit check for one planned slide at the standard type sizes: which texts do not fit, which boxes are mostly empty.
  // How far down the content area a layout reaches (1 = to the footer). A design that leaves the bottom third empty for this
  // content scores low, so the chooser prefers a design that fills the slide (no half-empty slides).
  function coverageOf_(out) {
    var top = 68, maxY = -Infinity;
    (out.els || []).forEach(function (e) {
      if (!e || e.t === 'image') return;
      var y = e.t === 'line' ? Math.max(e.y1, e.y2) : (e.y || 0) + (e.t === 'text' ? (e.vh || e.h || 0) : (e.h || e.size || 0));
      var y0 = e.t === 'line' ? Math.min(e.y1, e.y2) : (e.y || 0);
      if (y0 < 60 || y0 > BOTTOM) return;
      maxY = Math.max(maxY, Math.min(y, BOTTOM));
    });
    if (maxY === -Infinity) return 0;
    return Math.max(0, Math.min(1, (maxY - top) / Math.max(1, BOTTOM - top)));
  }

  function measure(spec, ctx) {
    ctx = ctx || {};
    if (ctx.tokens) Object.keys(ctx.tokens).forEach(function (k) { var v = ctx.tokens[k]; T[k] = Array.isArray(v) ? v.slice() : v; });
    var s = cleanSpec(spec || {});
    var type = ALIASES[String(s.type || 'bullets').toLowerCase()] || String(s.type || 'bullets').toLowerCase();
    if (!L[type]) type = 'bullets';
    TSZ.body = TYPE_STEPS[0].body; TSZ.heading = TYPE_STEPS[0].heading;
    AUDIT = [];
    var lay = null;
    try { lay = layoutSlide(s, type, {}); } catch (e) {}
    var res = AUDIT;
    AUDIT = null;
    var boxes = res.filter(function (a) { return a.body; });
    var fill = boxes.length ? boxes.reduce(function (t, a) { return t + Math.min(a.fill, 1); }, 0) / boxes.length : 0.8;
    return {
      look: lay ? lookOf_(lay, type) : type,                            // visual family (designs that look alike share it)
      dark: !!(lay && (lay.dark || lay.bgImage)),                       // photo or dark design (for the deck rhythm)
      content: lay ? contentCount_(lay) : 0,                            // 0 = the design shows nothing under the title
      fill: fill,
      coverage: lay ? coverageOf_(lay) : 0,                             // share of the content area the design actually uses
      overflow: res.filter(function (a) { return a.truncated; }).map(function (a) { return { text: a.text, maxChars: a.maxChars, isTitle: !!a.isTitle }; }),
      underfill: res.filter(function (a) { return !a.truncated && a.body && a.fill < 0.6; })
        .map(function (a) { return { text: a.text, minChars: Math.floor(a.maxChars * 0.55), maxChars: Math.floor(a.maxChars * 0.85) }; })
    };
  }

  function render(deck, ctx) {
    ctx = ctx || {};
    var slides = [], sectionNo = 0;
    if (ctx.tokens) {
      Object.keys(ctx.tokens).forEach(function (k) {
        var v = ctx.tokens[k];
        T[k] = Array.isArray(v) ? v.slice() : v;
      });
      if (T.ramp && T.ramp.length < 6) T.ramp = T.ramp.concat([T.ramp[T.ramp.length - 1]]);
    }
    (deck.slides || []).forEach(function (s0, i) {
      var s = cleanSpec(s0 || {});
      var type = String(s.type || 'bullets').toLowerCase();
      type = ALIASES[type] || type;
      if (!L[type]) type = 'bullets';
      if (type === 'section') sectionNo++;
      var lctx = { dateLabel: ctx.dateLabel, sectionNo: ctx.sectionNo || sectionNo };
      // Template design chosen for this slide (Reference.gs); falls back to the type's default layout.
      // Standard type sizes first; one notch smaller only if something would not fit.
      var out = null;
      for (var k = 0; k < TYPE_STEPS.length; k++) {
        TSZ.body = TYPE_STEPS[k].body; TSZ.heading = TYPE_STEPS[k].heading;
        AUDIT = [];
        out = layoutSlide(s, type, lctx);
        var over = AUDIT.some(function (a) { return a.truncated; });
        AUDIT = null;
        if (!over) break;
      }
      TSZ.body = TYPE_STEPS[0].body; TSZ.heading = TYPE_STEPS[0].heading;
      if (s.diagram && typeof applyDiagramIrToEngineOutput_ === 'function') {
        out = applyDiagramIrToEngineOutput_(out, s, ctx.tokens || null);
      }
      if (!out.noFooter) footerMark(out.els, out.dark);
      out.type = type;
      out.notes = s.notes || '';
      slides.push(out);
    });
    return slides;
  }

  return {
    titleFits: function (t) { return wrap(String(t), TITLE_W, 'sans', 500, 20).length <= 1; },
    titleMaxChars: function (t) { return maxCharsFor(t, TITLE_W, 20, 500); },
    agendaTextFits: function (t) { return wrap(String(t), AGENDA_DESC_W, 'sans', 400, 11).length <= 1; },
    agendaTextMaxChars: function (t) { return maxCharsFor(t, AGENDA_DESC_W, 11, 400); },
    // true when the slide's chosen template design can be drawn with this content (otherwise the type's default is used)
    canDraw: function (spec) {
      var s1 = cleanSpec(spec || {}), tag = s1.reference && s1.reference.tag;
      if (!tag || !V[tag]) return true;
      TSZ.body = TYPE_STEPS[0].body; TSZ.heading = TYPE_STEPS[0].heading;
      try { return !!V[tag](s1, {}); } catch (e) { return false; }
    },
    render: render, measure: measure, variantsFor: function (type) { return (VARIANTS[type] || []).slice(); }, cleanSpec: cleanSpec, cleanText: cleanText, designMenu: designMenu, layouts: Object.keys(L), VARIANTS: VARIANTS, BRAND: BRAND, TOKENS: T, W: W, H: H, INSET: INSET,
    textWidth: textWidth, wrap: wrap, fit: fit, tableRowsThatFit: tableRowsThatFit, posSize: posSize, splitSpace: splitSpace, innerSize: innerSize, boxH: boxH };
})();