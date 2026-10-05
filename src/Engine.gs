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

  // Template type scale for text inside boxes (pt). Every body text is the same size, every box heading the same
  // size, on every slide. A slide that is too full steps down one notch at a time (never below 10pt body).
  var TYPE_STEPS = [{ body: 11, heading: 12 }, { body: 10.5, heading: 11.5 }, { body: 10, heading: 11 }];
  var TSZ = { body: 11, heading: 12 };
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
    var box = posSize(w, h);
    w = box.w; h = box.h;
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
      vh: (fixedBox ? h : f.height) + INSET * 2          // visible height (for balancing the slide)
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
  // Shared geometry: every (available / count - gap) style split stays finite and >= 1.
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
  function image(els, asset, x, y, w, h) {
    var d = posSize(w, h);
    els.push({ t: 'image', asset: asset, x: x, y: y, w: d.w, h: d.h });
  }
  function icon(els, item, x, y, size, onDark) {
    if (!item || (!item.icon && !item.material)) return;
    var sz = Number(size);
    if (!isFinite(sz) || sz < 1) sz = 1;
    els.push({ t: 'icon', name: item.icon || '', material: item.material || '', x: x, y: y, size: sz, dark: !!onDark });
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
    var full = [side.label, side.title].filter(Boolean).join(' — ');
    if (wrap(full, w, 'sans', 500, TSZ.heading).length <= 1) return full;
    return side.label || side.title || '';
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
    var ty = 24, tw = (opts && opts.maxW) || (W - 2 * X0);
    var t = text(els, X0, ty, tw, 50, s.title || '', { weight: 600, max: 20, min: 15, maxLines: 2, color: T.title || T.ink });
    var y = ty + t.height + 5;
    var lead = s.lead || s.subtitle;
    if (lead) {
      var l = text(els, X0, y, Math.min(tw, W - 2 * X0 - 40), 30, lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.body });
      y += l.height;
    }
    return Math.max(y + 16, 68);
  }

  // Box height follows the content: tall enough for the text plus padding, at least 70% of the free space (so there is
  // no wide empty band between the intro and the boxes), never more than the space.
  function boxH(need, avail) {
    var a = Number(avail), n = Number(need);
    if (!isFinite(a) || a < 1) a = 1;
    if (!isFinite(n) || n < 1) n = 1;
    return Math.min(a, Math.max(n, a * 0.7));
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
    var d = posSize(w, h); w = d.w; h = d.h;
    style = style || 'panel';
    if (style === 'elevated') rect(els, x, y, w, h, T.white, { color: T.cardLine, width: 0.75 });
    else rect(els, x, y, w, h, T.bgLight);
    if (style === 'rule') rect(els, x, y, 3.5, h, T.blue);
    var iconSize = item && (item.icon || item.material) ? 16 : 0;
    var numW = (!iconSize && num) ? 34 : 0;
    var padL = style === 'rule' ? 16 : 14;
    var hw = innerSize(w, padL + 12 + numW + (iconSize ? iconSize + 8 : 0));
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
    var top = 76, listEnd = 520, rowH = Math.min(42, splitSpace(334 - top, n, 0));
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
      text(els, X0 - 4, y + 4.5, 32, 14, pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, align: 'center', maxLines: 1, color: onFill(T.slate) });
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
    line(els, 33.4, 164 + t.height + 8, 33.4 + Math.min(Math.max(t.width + 6, 120), 200), 164 + t.height + 8, T.white, 1);
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
    var gap = 12, cw = splitSpace(CW, cols, gap);
    var avail = splitSpace(BOTTOM - top, rows, gap);
    var padL = style === 'rule' ? 18 : 16, numW = numbered ? 38 : 0, iconW = numbered ? 0 : 26;
    var hw = innerSize(cw, padL + 14 + numW + iconW), bw = innerSize(cw, padL + 14);
    var hSize = uniformSize(items.map(function (it) { return it.title; }), hw, 36, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var headBlock = Math.max(linesBlock(items.map(function (it) { return it.title; }), hw, hSize, 600, 2), numbered ? 24 : 18);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), bw, innerSize(avail, headBlock + 44), { weight: 400, max: TSZ.body, min: TSZ.body });
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
      cardBody(els, x + padL, y + 16 + headBlock + 10, bw, innerSize(ch, headBlock + 44), it, bSize, items);
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
    var gap = 12, tw = splitSpace(CW, n, gap), iw = innerSize(tw, 28);
    var avail = innerSize(BOTTOM - top, takeH + takeGap);
    var vSize = uniformSize(items.map(function (it) { return it.value; }), iw, 52, { font: 'mono', weight: 600, max: n <= 3 ? 40 : 34, min: 16, maxLines: 1 });
    var lSize = uniformSize(items.map(function (it) { return it.label; }), iw, 34, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var lBlock = linesBlock(items.map(function (it) { return it.label; }), iw, lSize, 600, 2);
    var vH = lineHeight('mono', vSize);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, innerSize(avail, vH + lBlock + 60), { weight: 400, max: TSZ.body, min: TSZ.body });
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

  L.table = function (s, ctx) {
    var els = [];
    var top = header(els, s);
    var cols = arr(s.columns, 5), rows = arr(s.rows, 8).map(function (r) { return arr(r, cols.length); });
    var weights = cols.map(function (c, j) {
      var mx = String(c).length;
      rows.forEach(function (r) { mx = Math.max(mx, String(r[j] || '').length); });
      return Math.min(Math.max(mx, 8), 60);
    });
    var sumW = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var widths = weights.map(function (w) { return Math.max(1, CW * w / sumW); });
    var pad = 7, size = 10, hdrH, rowHs, availH = Math.max(1, BOTTOM - top);
    for (; size >= 7.5; size -= 0.5) {
      hdrH = 24; rowHs = [];
      rows.forEach(function (r) {
        var h = 0;
        r.forEach(function (v, j) { h = Math.max(h, wrap(String(v || ''), widths[j] - pad * 2, 'sans', 400, size - 0.5).length * lineHeight('sans', size - 0.5) + 12); });
        rowHs.push(Math.max(h, 22));
      });
      if (hdrH + rowHs.reduce(function (a, b) { return a + b; }, 0) <= availH) break;
    }
    var x = CX, y = top;
    cols.forEach(function (c, j) {
      rect(els, x + 1, y, widths[j] - 2, hdrH, T.blue);
      text(els, x + pad, y + 6, widths[j] - pad * 2, hdrH - 10, c, { weight: 700, max: size, min: 7.5, maxLines: 1, color: T.white });
      x += widths[j];
    });
    y += hdrH;
    rows.forEach(function (r, i) {
      x = CX;
      r.forEach(function (v, j) {
        text(els, x + pad, y + 6, widths[j] - pad * 2, rowHs[i] - 10, v, { weight: j === 0 ? 600 : 400, max: size - 0.5, min: 7, color: T.body });
        x += widths[j];
      });
      y += rowHs[i];
      line(els, CX, y, CX + CW, y, T.cardLine, 0.75);
    });
    return { bg: T.white, els: els };
  };

  L.process = function (s, ctx) {
    var els = [];
    var steps = arr(s.items, 6);
    var n = Math.max(steps.length, 1);
    var top = header(els, s, { eyebrow: true });
    var gap = 14, tw = splitSpace(CW, n, gap);
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
    var gap = 12, colW = splitSpace(CW, n, gap);
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
    var savedAudit = AUDIT;
    AUDIT = null;                                   // single bullets are not measured on their own (never "expanded")
    points.forEach(function (p) {
      if (cy - y > h + 2) return;                   // nothing is drawn below the area
      ellipse(els, x + 1, cy + lineHeight('sans', size) / 2 - 2.5, 5, 5, spec.bullet || T.ink);
      var r = text(els, x + 16, cy, w - 16, Math.max(lineHeight('sans', size), y + h - cy), p, { weight: 400, max: size, min: size, color: spec.color || T.body });
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
      var b = text(els, x + 12, cy, w - 24, bodyH, body, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 10, color: T.body });
      cy += b.height + 8;
    }
    bulletList(els, x + 12, cy, w - 24, y + h - cy - 10, pts, { max: TSZ.body, min: TSZ.body, gap: 10 });
  }

  L.comparison = function (s, ctx) {
    var els = [];
    var top = header(els, s) + 6;
    var gap = 17, pw = splitSpace(CW, 2, gap), avail = Math.max(1, BOTTOM - top);
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
    panel(els, CX + pw + gap, top, pw, ph, T.slate, headerText(right, pw - 20), right.points, right.text);
    return { bg: T.bgLight, els: els };
  };

  L.next_steps = function (s, ctx) {
    var els = [];
    var items = arr(s.items, 10);
    var top = header(els, s) + 4;
    var cols = items.length > 5 ? 2 : 1, perCol = Math.ceil(items.length / cols);
    var bottom = s.cta ? BOTTOM - 44 : BOTTOM;
    var colW = splitSpace(CW, cols, 16);
    var rowGap = 8;
    var rowH = Math.min(96, splitSpace(bottom - top + rowGap, Math.max(perCol, 1), 0));   // rows fill the content area
    items.forEach(function (it, i) {
      var c = Math.floor(i / perCol), r = i % perCol;
      var x = CX + c * (colW + 16), y = top + r * rowH, h = innerSize(rowH, rowGap);
      rect(els, x, y, colW, h, T.bgLight);
      rect(els, x, y, 40, h, T.blue);
      text(els, x, y + h / 2 - 8, 40, 16, String(i + 1), { font: 'mono', weight: 600, max: TSZ.heading, min: TSZ.heading, align: 'center', maxLines: 1, color: T.white });
      var rightW = it.timing ? 110 : 0;
      var tx = x + 54, tw = innerSize(colW, 54 + rightW + 12);
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
    var lw = side ? 400 : CW;
    bulletList(els, CX, top, lw, BOTTOM - top, s.points, { max: TSZ.body + 1, min: TSZ.body + 1, gap: 14 });
    if (side) {
      var px = CX + 424, pw = CW - 424;
      panel(els, px, top, pw, BOTTOM - top, T.blue, s.callout.label || s.callout.title || 'Why it matters', [],
        [s.callout.label ? s.callout.title : '', s.callout.text].filter(Boolean).join('\n'));
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
    var tx = s.text ? fit(String(s.text), leftW - 18, 110, { weight: 400, max: TSZ.body + 1.5, min: TSZ.body, maxLines: 6 }) : { height: 0, size: TSZ.body };
    var st = fit(String(stText), leftW - 18, avail - (s.text ? tx.height + 20 : 0) - 8, { weight: 500, max: 22, min: 15, maxLines: 5 });
    // Statement block centred vertically in the content area
    var blockH = st.height + (s.text ? 18 + tx.height : 0);
    var y = top + Math.max(0, (avail - blockH) / 2);
    rect(els, CX, y + 4, 5, Math.min(st.height - 4, 90), T.blue);
    text(els, CX + 18, y, leftW - 18, st.height + 4, stText, { weight: 500, max: st.size, min: st.size, maxLines: 5, color: T.ink });
    if (s.text) text(els, CX + 18, y + st.height + 18, leftW - 18, tx.height + 4, s.text, { weight: 400, max: tx.size, min: tx.size, maxLines: 6, color: T.body });
    if (points.length) {
      var px = CX + leftW + 24, pw = innerSize(CW - leftW, 24), gap = 12, pTop = top, pAvail = Math.max(1, BOTTOM - pTop);
      var hSize = uniformSize(points.map(function (p) { return p.title || p; }), innerSize(pw, 28), 34, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
      var ch = splitSpace(pAvail, points.length, gap);
      var hBlk = linesBlock(points.map(function (p) { return p.title || p; }), innerSize(pw, 28), hSize, 500, 2);
      var bSize = uniformSize(points.map(function (p) { return p.text || ''; }), innerSize(pw, 28), innerSize(ch, hBlk + 30), { weight: 400, max: TSZ.body, min: TSZ.body });
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
  function niceMax(v) {
    if (v <= 0) return 4;
    var raw = v / 4, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
    return step * 4;
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
    var axisW = 40, plotTop = y + 14, plotBottom = BOTTOM - 30, plotH = Math.max(1, plotBottom - plotTop);
    var maxV = 0;
    series.forEach(function (se) { se.values.forEach(function (v) { if (v > maxV) maxV = v; }); });
    maxV = niceMax(maxV * 1.08);
    for (var g = 1; g <= 4; g++) {
      var gy = plotBottom - plotH * g / 4;
      line(els, cx + axisW, gy, cx + cw, gy, T.cardLine, 0.75);
      text(els, cx, gy - 7, axisW - 6, 14, fmt(maxV * g / 4, ch.unit), { font: 'mono', weight: 400, max: 10, min: 10, maxLines: 1, color: T.ink, align: 'right' });
    }
    var n = Math.max(cats.length, 1), slotW = splitSpace(innerSize(cw, axisW), n, 0), x0 = cx + axisW;
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
    var gap = 14, avail = Math.max(1, BOTTOM - top);
    var pw = 190, cw = splitSpace(innerSize(CW, pw), 2, gap);
    var chal = asList(s.challenge), sol = asList(s.solution).slice(0, 5);
    // Challenge card
    rect(els, CX, top, cw, avail, T.bgLight);
    icon(els, { icon: 'warning risk', material: '' }, CX + 16, top + 16, 20, false);
    text(els, CX + 44, top + 16, cw - 60, 20, s.challenge_label || 'Business Challenge', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
    if (s.industry || s.client) {
      text(els, CX + 16, top + 44, cw - 32, 14, String(s.industry || s.client), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, caps: true, color: T.blue });
    }
    var cTop = top + (s.industry || s.client ? 66 : 50);
    var cSize = uniformSize([chal.join('\n\n')], cw - 32, BOTTOM - cTop - 14, { weight: 400, max: TSZ.body, min: TSZ.body });
    // How 66degrees helped
    var hx = CX + cw + gap;
    rect(els, hx, top, cw, avail, T.white, { color: T.cardLine, width: 0.75 });
    rect(els, hx, top, cw, 3, T.blue);
    icon(els, { icon: 'idea solution', material: '' }, hx + 16, top + 16, 20, false);
    text(els, hx + 44, top + 16, cw - 60, 20, s.solution_label || 'How 66degrees Helped', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
    var sTop = top + 50, sAvail = Math.max(1, BOTTOM - sTop - 12), n = Math.max(sol.length, 1);
    var sSize = uniformSize(sol, innerSize(cw, 64), innerSize(splitSpace(sAvail, n, 0), 10), { weight: 400, max: TSZ.body, min: TSZ.body });
    sSize = cSize = Math.min(sSize, cSize);   // one text size across the slide
    var rowH = splitSpace(sAvail, n, 0);
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
    text(els, px + 16, top + 16, pw - 32, 20, 'Business Impact', { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.white });
    var res = arr(s.results, 3), rn = Math.max(res.length, 1), rH = splitSpace(innerSize(avail, 50), rn, 0);
    res.forEach(function (r, i) {
      var y = top + 46 + i * rH;
      if (i > 0) line(els, px + 16, y - 6, px + pw - 16, y - 6, T.tints[2], 0.75);
      var v = text(els, px + 16, y, pw - 32, 44, r.value, { font: 'mono', weight: 600, max: 30, min: 18, maxLines: 1, color: T.white });
      text(els, px + 16, y + v.height + 6, pw - 32, rH - v.height - 16, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.white });
    });
    return { bg: T.white, els: els };
  };

  L.quote = function (s, ctx) {
    var els = [];
    rect(els, CX, 110, 5, 150, T.blue);
    var q = text(els, CX + 22, 110, 560, 170, s.quote || s.title, { weight: 600, max: 24, min: 15, maxLines: 6, color: T.ink });
    if (s.attribution) text(els, CX + 22, 120 + q.height, 400, 14, s.attribution, { font: 'mono', weight: 500, max: 10, min: 10, caps: true, color: T.blue, maxLines: 1 });
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

  function shape(els, kind, x, y, w, h, fill, ln) { var d = posSize(w, h); els.push({ t: 'shape', shape: kind, x: x, y: y, w: d.w, h: d.h, fill: fill, line: ln || null }); }
  function ring(els, x, y, d, fill, color, width) {
    var dim = posSize(d, d);
    els.push({ t: 'ellipse', x: x, y: y, w: dim.w, h: dim.h, fill: fill, line: { color: color, width: width } });
  }
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
    return arr(s.items, 8).map(function (it) {
      return typeof it === 'string' ? { title: it, text: '' } : { title: it.title || it.text || '', text: it.title ? (it.text || '') : '' };
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
    var top = 80, listW = 480, rowH = Math.min(44, splitSpace(332 - top, n, 0));
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
      text(els, px + 10, py + 8, 26, 14, pad2(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, color: T.blue });
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
    var cw = splitSpace(CW, cols, gap), avail = splitSpace(BOTTOM - top, rows, gap);
    var numW = 44, iw = innerSize(cw, numW + 26);
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 32, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = Math.max(linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2), 18);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, innerSize(avail, hBlock + 50), { weight: 400, max: TSZ.body, min: TSZ.body });
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
    var gap = 14, cw = splitSpace(CW, n, gap), avail = Math.max(1, BOTTOM - top), iw = innerSize(cw, 32);
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 34, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, innerSize(avail, hBlock + 80), { weight: 400, max: TSZ.body, min: TSZ.body });
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 52 + hBlock + 10 + textH(it.text, iw, bSize) + 20 + hlNeed(items, iw, bSize)); });
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      rect(els, x, top, cw, ch, T.bgLight);
      icon(els, autoIcon(it), x + 16, top + 18, 20, false);
      text(els, x + 16, top + 52, iw, hBlock, it.title, { weight: 600, max: hSize, min: hSize, maxLines: 2, color: T.ink });
      cardBody(els, x + 16, top + 52 + hBlock + 10, iw, innerSize(ch, hBlock + 72), it, bSize, items);
    });
    return { bg: T.white, els: els };
  };

  // Template slide 41 (66D_LAYOUT_CARDS_006): panel background, white cards in one row: icon, blue heading, divider, body
  V['66D_LAYOUT_CARDS_006'] = function (s) {
    var items = items_(s, 5), n = items.length;
    if (n < 3 || (n === 5 && maxLen(items, function (it) { return it.text; }) > 200)) return null;
    var els = [];
    var top = header(els, s);
    var gap = 10, cw = splitSpace(CW, n, gap), avail = Math.max(1, BOTTOM - top), iw = innerSize(cw, 28);
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 700, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, innerSize(avail, hBlock + 90), { weight: 400, max: TSZ.body, min: TSZ.body });
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
    var pad = 14, gap = 14, cw = splitSpace(innerSize(CW, 2 * pad - 8), n, gap), availC = Math.max(1, BOTTOM - top - 2 * pad), iw = innerSize(cw, 28);
    var hSize = uniformSize(items.map(function (it) { return it.title; }), iw, 30, { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hBlock = linesBlock(items.map(function (it) { return it.title; }), iw, hSize, 600, 2);
    var bSize = uniformSize(items.map(function (it) { return it.text; }), iw, innerSize(availC, hBlock + 110), { weight: 400, max: TSZ.body, min: TSZ.body });
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
      ring(els, ccx + d - nd / 2 + 4, ccy + d - nd + 4, nd, T.white, T.blue, 1.5);
      text(els, ccx + d - nd / 2 + 4, ccy + d - nd + 4 + nd / 2 - 7, nd, 14, pad2(i + 1), { font: 'mono', weight: 600, max: 10, min: 10, maxLines: 1, align: 'center', color: T.blue, noFill: true });
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
    var bandH = 58, colW = splitSpace(CW, n, 0);
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
      text(els, x + 18, top + 12, colW - 26, 14, st.title, { weight: 600, max: nSize, min: nSize, maxLines: 1, caps: true, color: T.ink });
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
    var gap = 10, cw = splitSpace(CW, n, gap), ch = Math.max(1, BOTTOM - top);
    var hSize = uniformSize(steps.map(function (st) { return st.title; }), innerSize(cw, 16), 30, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 2 });
    var hasPill = steps.some(function (st) { return st.timing || st.label; });
    var pbSize = uniformSize(steps.map(function (st) { return st.text; }), innerSize(cw, 16), innerSize(ch, 120), { weight: 400, max: TSZ.body, min: TSZ.body });
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
    var gap = 8, cw = splitSpace(CW, n, gap), arrowH = 34;
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
    var colW = splitSpace(CW, n, 0), stepH = 24, rise = Math.min(n <= 3 ? 58 : 40, splitSpace(BOTTOM - top - 150, Math.max(n - 1, 1), 0));
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
      text(els, x + 10, ty + ht.height + 6, colW - 20, BOTTOM - (ty + ht.height + 6), st.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
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
    var colW = splitSpace(CW, n, 0), d = Math.min(78, innerSize(colW, 30)), cy = top + Math.max(1, BOTTOM - top) / 2;
    var textW = Math.min(colW * 1.7, 230);
    var hSize = uniformSize(steps.map(function (st) { return st.title; }), textW, 16, { weight: 700, max: TSZ.heading, min: TSZ.heading, maxLines: 1 });
    steps.forEach(function (st, i) {
      var ccx = CX + colW * i + colW / 2;
      var tint = T.tints[Math.min(i, 4)];
      ring(els, ccx - d / 2 - 6, cy - d / 2 - 6, d + 12, T.white, tint, 3);
      ellipse(els, ccx - d / 2 + 6, cy - d / 2 + 6, d - 12, d - 12, T.bgLight);
      icon(els, autoIcon(st), ccx - 13, cy - 13, 26, false);
      if (i < n - 1) line(els, ccx + d / 2 + 6, cy, ccx + colW - d / 2 - 6, cy, T.cardLine, 1);
      var tx = Math.max(CX, Math.min(ccx - textW / 2, CX + CW - textW));
      if (i % 2 === 0) {
        var areaTop = top, areaH = cy - d / 2 - 14 - top;
        var bt = fit(String(st.text || ''), textW, areaH - 20, { weight: 400, max: TSZ.body, min: TSZ.body });
        var ht = lineHeight('sans', hSize) + 4;
        var y0 = areaTop + areaH - bt.height - ht;
        text(els, tx, y0, textW, 16, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 1, align: 'center', color: T.ink });
        text(els, tx, y0 + ht, textW, bt.height, st.text, { weight: 400, max: bt.size, min: bt.size, align: 'center', color: T.body });
      } else {
        var y1 = cy + d / 2 + 14;
        var h1 = text(els, tx, y1, textW, 16, st.title, { weight: 700, max: hSize, min: hSize, maxLines: 1, align: 'center', color: T.ink });
        text(els, tx, y1 + h1.height + 4, textW, BOTTOM - y1 - h1.height - 4, st.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
      }
    });
    return { bg: T.white, els: els };
  };

  /* ---------------- Timeline ---------------- */
  // Template slide 23 (66D_LAYOUT_TIMELINE_001): full-width blue band with period labels; callouts above and below
  V['66D_LAYOUT_TIMELINE_001'] = function (s) {
    var ms = items_(s, 7), n = ms.length;
    if (n < 3) return null;
    var els = [];
    var top = header(els, s);
    var colW = splitSpace(CW, n, 0), bandH = 18, bandY = top + Math.max(1, BOTTOM - top) / 2 - bandH / 2;
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
    var colW = splitSpace(CW, n, 0), tabW = Math.min(innerSize(colW, 30), 110), tabH = 34;
    var fills = [T.blue, T.tints[1], T.tints[2], T.tints[3], T.tints[4]];
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
    var gap = 10, tw = splitSpace(CW, n, gap), tileH = 86;
    var vSize = uniformSize(items.map(function (it) { return it.value; }), tw - 20, 40, { font: 'mono', weight: 600, max: 30, min: 16, maxLines: 1 });
    var lSize = uniformSize(items.map(function (it) { return it.label; }), tw - 24, 28, { weight: 500, max: 11, min: 10, maxLines: 2 });
    items.forEach(function (it, i) {
      var x = CX + i * (tw + gap);
      rect(els, x, top, tw, tileH, T.white, { color: T.cardLine, width: 0.75 });
      text(els, x + 10, top + 10, tw - 20, 38, it.value, { font: 'mono', weight: 600, max: vSize, min: vSize, maxLines: 1, align: 'center', color: T.blue });
      text(els, x + 12, top + 50, tw - 24, 30, it.label, { weight: 500, max: lSize, min: lSize, maxLines: 2, align: 'center', color: T.ink });
    });
    var ty = top + tileH + 14, c1 = 190, rowsAvail = BOTTOM - ty - 22;
    rect(els, CX, ty, c1 - 2, 20, T.blue);
    rect(els, CX + c1, ty, CW - c1, 20, T.blue);
    text(els, CX + 8, ty + 3.5, c1 - 16, 13, 'Measure', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    text(els, CX + c1 + 8, ty + 3.5, CW - c1 - 16, 13, 'Why it matters', { weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
    var rSize = uniformSize(items.map(function (it) { return it.text; }), innerSize(CW, c1 + 16), innerSize(splitSpace(rowsAvail, n, 0), 8), { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3 });
    var rowH = Math.min(splitSpace(rowsAvail, n, 0), Math.max(26, linesBlock(items.map(function (it) { return it.text; }), innerSize(CW, c1 + 16), rSize, 400, 3) + 12, splitSpace(rowsAvail * 0.75, n, 0)));
    items.forEach(function (it, i) {
      var y = ty + 22 + i * rowH;
      text(els, CX + 8, y, c1 - 16, rowH, it.label || '', { weight: 500, max: 10.5, min: 10, maxLines: 2, color: T.ink, valign: 'middle' });
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
    var px = CX + lw + 28, pw = innerSize(CW, lw + 28), rowH = splitSpace(avail, n, 0), numW = 112, tx = px + numW + 14, tw = innerSize(pw, numW + 14);
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
    var bandW = 196, bx = W - bandW, lw = innerSize(bx - CX, 28), colW = splitSpace(lw, 2, 22);
    var top = header(els, s, { maxW: bx - X0 - 24 });
    rect(els, bx, 0, bandW, H, T.blue);
    var rowH = splitSpace(innerSize(H, 70), Math.max(res.length, 1), 0);
    res.forEach(function (r, i) {
      var y = 44 + i * rowH;
      if (i > 0) line(els, bx + 20, y - 8, W - 20, y - 8, T.tints[2], 0.75);
      var v = text(els, bx + 20, y, bandW - 40, 40, r.value, { font: 'mono', weight: 600, max: 30, min: 18, maxLines: 1, color: T.white });
      text(els, bx + 20, y + v.height + 6, bandW - 40, rowH - v.height - 22, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.white });
    });
    var chal = asList(s.challenge).join(' '), sol = asList(s.solution).join(' ');
    var y0 = top;
    if (s.industry || s.client) {
      var pill = String(s.industry || s.client).toUpperCase().slice(0, 40);
      var pwid = Math.min(340, textWidth(pill, 'mono', 500, 10) + 26);
      rect(els, CX, y0, pwid, 20, T.blue);
      text(els, CX + 9, y0 + 4, pwid - 18, 12, pill, { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
      y0 += 28;
    }
    var bSize = uniformSize([chal, sol], colW, BOTTOM - y0 - 120, { weight: 400, max: TSZ.body, min: TSZ.body });
    [[s.challenge_label || 'Business Challenge', chal], [s.solution_label || 'Solution Delivered', sol]].forEach(function (c, i) {
      var x = CX + i * (colW + 22);
      text(els, x, y0, colW, 16, c[0], { weight: 600, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      text(els, x, y0 + 22, colW, BOTTOM - y0 - 120, c[1], { weight: 400, max: bSize, min: bSize, color: T.body });
    });
    var outcome0 = s.outcome || res.map(function (r) { return r.label; }).slice(0, 2).join('. ');
    var oh = textH(outcome0, lw, 11.5);
    var used = Math.max(textH(chal, colW, bSize), textH(sol, colW, bSize));
    var oy = Math.max(y0 + 22 + used + 20, BOTTOM - oh - 30);
    rect(els, CX, oy, 116, 20, T.blue);
    text(els, CX + 9, oy + 4, 100, 12, 'THE OUTCOME', { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, color: T.white });
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
    var colW = splitSpace(CW, n, 0), iw = innerSize(colW, 18), bandH = 60, ly = top + 28;
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
      text(els, x, cy, iw, 16, 'Business Challenge', { weight: 600, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      text(els, x, cy + 18, iw, vy - cy - 32, c.challenge, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true });
      var headline = String(c.value_headline || '').trim(), rest = String(c.value || '').trim();
      var body = headline ? headline + (rest ? ' ' + rest : '') : rest;
      var vText = fit(body, iw - 12, BOTTOM - vy - 18, { weight: 400, max: TSZ.body, min: TSZ.body });
      rect(els, x - 8, vy, 1.5, 18 + vText.height + 2, T.blue);
      text(els, x + 4, vy, iw, 16, 'Business Value Unlocked', { weight: 600, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.ink });
      text(els, x + 4, vy + 18, iw - 12, BOTTOM - vy - 18, body, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body, noFill: true,
        auditText: rest, auditOffset: headline ? headline.length + 1 : 0,
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
    var gap = 22, pw = splitSpace(CW, 2, gap), avail = Math.max(1, BOTTOM - top), hh = 26;
    var nRows = Math.max(lp.length, rp.length);
    var pSize = uniformSize(lp.concat(rp), innerSize(pw, 52), innerSize(splitSpace(innerSize(avail, hh + 24), nRows, 0), 10), { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3 });
    var rowH = Math.min(splitSpace(innerSize(avail, hh + 24), nRows, 0), linesBlock(lp.concat(rp), innerSize(pw, 52), pSize, 400, 3) + 16);
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
  var VARIANTS = {
    agenda: [
      { tag: '66D_LAYOUT_AGENDA_002', min: 1, max: 8, desc: 'numbered rows with square badges; the classic agenda' },
      { tag: '66D_LAYOUT_AGENDA_001', min: 2, max: 9, desc: 'clean bulleted list with descriptions' },
      { tag: '66D_LAYOUT_AGENDA_003', min: 3, max: 5, desc: 'ring graphic with topic pills on an arc; most visual, only for 3-5 short topics' }],
    cards: [
      { tag: '66D_LAYOUT_CARDS_007', min: 2, max: 6, desc: 'grid of panel cards with numbers or icons; general purpose', words: '35-55' },
      { tag: '66D_LAYOUT_CARDS_001', min: 3, max: 6, desc: 'big numbered panels with a divider; values, principles, pillars', words: '30-50' },
      { tag: '66D_LAYOUT_CARDS_003', min: 2, max: 4, desc: 'wide icon cards; benefits or outcomes with more text per card', words: '45-70' },
      { tag: '66D_LAYOUT_CARDS_006', min: 3, max: 5, desc: 'tall white icon cards on a light background; capabilities or services', words: '30-50' },
      { tag: '66D_LAYOUT_CARDS_013', min: 2, max: 4, desc: 'numbered cards with an icon circle; key initiatives or offerings', words: '35-55' }],
    process: [
      { tag: '66D_LAYOUT_PROCESS_001', min: 3, max: 5, desc: 'arrow line with numbered phases and a large icon per phase; methodology', words: '25-45' },
      { tag: '66D_LAYOUT_PROCESS_002', min: 3, max: 6, desc: 'tall step cards with number badges (label pill = the step timing); delivery steps', words: '30-50' },
      { tag: '66D_LAYOUT_PROCESS_003', min: 3, max: 5, desc: 'blue chevron arrows above text cards; a flow or engagement lifecycle with a full paragraph per step', words: '35-55' },
      { tag: '66D_LAYOUT_PROCESS_004', min: 3, max: 5, desc: 'ascending staircase; a maturity journey or transformation path', words: '25-45' },
      { tag: '66D_LAYOUT_PROCESS_005', min: 3, max: 5, desc: 'chain of ringed icon circles; a continuous cycle or connected capabilities with one short sentence each', words: '22-40' }],
    timeline: [
      { tag: '66D_LAYOUT_TIMELINE_001', min: 3, max: 7, desc: 'blue period band with callouts above and below; a longer timeline', words: '22-40' },
      { tag: '66D_LAYOUT_TIMELINE_004', min: 3, max: 5, desc: 'period tabs in a blue ramp with cards below; phases, years or quarters', words: '30-50' },
      { tag: 'ENGINE_TIMELINE_PANELS', min: 2, max: 6, desc: 'band with markers and numbered panels; a phased roadmap', words: '30-50' }],
    stats: [
      { tag: '66D_LAYOUT_COMPANY_OVERVIEW_001', min: 2, max: 4, desc: 'KPI cards with big numbers, label and explanation, takeaway bar', words: '25-45' },
      { tag: '66D_LAYOUT_STATS_001', min: 2, max: 4, desc: 'centred number tiles plus a results table (metric | what it measures)', words: '22-40' },
      { tag: '66D_LAYOUT_CHART_002', min: 2, max: 4, desc: 'narrative on the left (takeaway) with stacked stats on the right; research findings', words: '20-35' }],
    case_study: [
      { tag: '66D_LAYOUT_CASE_STUDY_002', min: 0, max: 99, needs: 'cases', desc: 'client journey: 3-4 client examples side by side, each with phase, offering, industry, challenge and value unlocked (use when you have several client examples); fields: cases[{phase, offering, industry, challenge, value_headline, value}]', words: 'challenge 14-18, value_headline 3-6, value 10-14' },
      { tag: '66D_LAYOUT_CASE_STUDY_005', min: 0, max: 99, desc: 'Business challenge | How 66degrees helped (numbered steps) | Business impact panel', words: 'challenge 40-60, solution 3-4 points of 15-25' },
      { tag: '66D_LAYOUT_CASE_STUDY_006', min: 0, max: 99, desc: 'industry pill, challenge and solution side by side, outcome, blue impact band with the numbers', words: 'challenge 40-60, solution 50-70, outcome 20-35' }],
    comparison: [
      { tag: '66D_LAYOUT_COMPARISON_005', min: 0, max: 99, desc: 'two panels with blue and slate headers and bullet points (3-6 points per side, ONE line each)', words: '6-14 per point' },
      { tag: '66D_LAYOUT_COMPARISON_006', min: 0, max: 99, desc: 'two cards: crosses on the left (current state / without), ticks on the right (future / with); left = the weaker option', words: '6-14 per point' }]
  };

  var ALIASES = { intro: 'statement', key_message: 'statement', problem: 'cards', benefits: 'cards', kpi: 'stats', metrics: 'stats',
    steps: 'process', roadmap: 'timeline', list: 'bullets', thank_you: 'closing', title: 'cover', divider: 'section',
    case: 'case_study', checklist: 'next_steps', two_column: 'comparison' };

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

  function layoutSlide(s, type, lctx) {
    var tag = s.reference && s.reference.tag;
    var out = (tag && V[tag] && variantOf(type, tag)) ? V[tag](s, lctx) : null;
    out = out || L[type](s, lctx);
    if (['cover', 'agenda', 'closing', 'section', 'statement', 'chart', 'quote'].indexOf(type) === -1 &&
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
    var dy = Math.min(free / 2, 14);                 // a small nudge only: never a wide empty band above the content
    out.els.forEach(function (e) {
      var y = e.t === 'line' ? Math.min(e.y1, e.y2) : e.y;
      if (e.t === 'image' || y < CONTENT_TOP) return;
      if (e.t === 'line') { e.y1 += dy; e.y2 += dy; } else e.y += dy;
    });
  }

  // Fit check for one planned slide at the standard type sizes: which texts do not fit, which boxes are mostly empty.
  function measure(spec, ctx) {
    ctx = ctx || {};
    if (ctx.tokens) Object.keys(ctx.tokens).forEach(function (k) { var v = ctx.tokens[k]; T[k] = Array.isArray(v) ? v.slice() : v; });
    var s = cleanSpec(spec || {});
    var type = ALIASES[String(s.type || 'bullets').toLowerCase()] || String(s.type || 'bullets').toLowerCase();
    if (!L[type]) type = 'bullets';
    TSZ.body = TYPE_STEPS[0].body; TSZ.heading = TYPE_STEPS[0].heading;
    AUDIT = [];
    try { layoutSlide(s, type, {}); } catch (e) {}
    var res = AUDIT;
    AUDIT = null;
    var boxes = res.filter(function (a) { return a.body; });
    var fill = boxes.length ? boxes.reduce(function (t, a) { return t + Math.min(a.fill, 1); }, 0) / boxes.length : 0.8;
    return {
      fill: fill,
      overflow: res.filter(function (a) { return a.truncated; }).map(function (a) { return { text: a.text, maxChars: a.maxChars }; }),
      underfill: res.filter(function (a) { return !a.truncated && a.body && a.fill < 0.5; })
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
    render: render, measure: measure, variantsFor: function (type) { return (VARIANTS[type] || []).slice(); }, cleanSpec: cleanSpec, cleanText: cleanText, designMenu: designMenu, layouts: Object.keys(L), VARIANTS: VARIANTS, BRAND: BRAND, TOKENS: T, W: W, H: H, INSET: INSET,
    textWidth: textWidth, wrap: wrap, fit: fit, posSize: posSize, splitSpace: splitSpace, innerSize: innerSize, boxH: boxH };
})();
