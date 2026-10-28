/* =========================================================================================================
   66° Deck Agent — Solution Deck design library (V.1_52), part 2: agenda, flows, plans, tables and figures
   Numbered agenda rows, why / what / how arrow columns, three steps with a feedback loop, step columns, labelled rows,
   phases with timing and funding bars, value over time with three milestones, three numbered rows under a photo band,
   a comparison matrix with status colours, a plain table, a scorecard, value tiers, a pillar with two figures.
   The Solution Deck also uses the two section dividers every 66degrees deck has (dark streaks, light watermark).
   Every design here draws only in a Solution Deck (ENGINE.addSolutionDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addSolutionDesign;
  var LINE = T.cardLine || '#DBDDE1', SLATE = T.slate || '#B3C5D0';
  var TINT = '#E6EEFF', MUTED = '#6B7486';
  var BLUES = ['#0052FF', '#0045D6', '#0038AD', '#002B85'];       // tints of the 66° blue (labelled rows)

  // the 66degrees section dividers are shared frames: the same in every deck type
  ENGINE.shareDesign('P66_SECTION_DARK', 'solution');
  ENGINE.shareDesign('P66_SECTION_LIGHT', 'solution');
  // V.1_66: the spiral agenda (up to 6 sections) in every deck type
  ENGINE.shareDesign('P66_AGENDA_SPIRAL', 'solution');
  ENGINE.shareDesign('P66_AGENDA_SPIRAL', 'general');
  // V.1_67: topic rows (a topic, its icon and its details) in every deck type
  ENGINE.shareDesign('S66_TOPIC_ROWS', 'proposal');
  ENGINE.shareDesign('S66_TOPIC_ROWS', 'general');

  /* ---------------- helpers ---------------- */
  function lh(size) { return K.lineHeight('sans', size); }
  function th(str, w, size, weight) { return str ? K.textH(String(str), w, size, weight || 400) : 0; }
  function maxOf(list, f) { var m = 0; list.forEach(function (x, i) { m = Math.max(m, f(x, i)); }); return m; }
  function ptsH(points, w, size, gap) {
    if (!points || !points.length) return 0;
    if (points.length === 1) return th(points[0], w, size);
    var t = 0;
    points.forEach(function (p) { t += th(p, w - 20, size) + gap; });   // 4pt spare: Slides wraps a little earlier than the measure
    return t - gap;
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function norm(it) {
    if (typeof it === 'string') return { title: clean(it), text: '', points: [] };
    it = it || {};
    return {
      title: clean(it.title || it.name || (it.value ? '' : it.label)), text: clean(it.text || it.description),
      points: K.arr(it.points || it.bullets, 8).map(K.str).map(clean).filter(Boolean),
      label: clean(it.label), tag: clean(it.tag || it.chip), timing: clean(it.timing || it.duration || it.when),
      funding: clean(it.funding), value: clean(it.value), next: clean(it.next || it.handoff), subtitle: clean(it.subtitle)
    };
  }
  function itemsOf(s, max) { return K.items(s, max + 1).map(norm).filter(function (it) { return it.title; }); }
  // V.1_53: a point or text with no real words (".", "-") counts as empty (deck 24: a card with a heading only)
  function real(t) { return /[A-Za-z0-9]{2,}/.test(String(t || '')); }
  function linesOf(it) { var p = it.points.filter(real); return p.length ? p : (real(it.text) ? [it.text] : []); }
  function heading(els, x, y, w, str, color, maxLines, align) {
    return K.text(els, x, y, w, 60, str, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: maxLines || 3, color: color || T.ink, align: align || 'left' });
  }
  function body(els, x, y, w, h, str, color, align) {
    return K.text(els, x, y, w, Math.max(h, lh(TSZ.body)), str, { weight: 400, max: TSZ.body, min: TSZ.body, color: color || T.ink, align: align || 'left' });
  }
  function bullets(els, x, y, w, h, points, gap, color) {
    var pts = K.arr(points, 12).map(K.str).filter(Boolean);
    if (pts.length === 1) return body(els, x, y, w, h, pts[0], color);
    return K.bulletList(els, x, y, w, Math.max(h, lh(TSZ.body)), pts, { max: TSZ.body, min: TSZ.body, gap: gap || 6, color: color || T.ink, bullet: color || T.ink });
  }
  function chip(els, x, y, str, fill, color, maxW, center) {
    var w = Math.min(maxW || 200, K.textWidth(str, 'sans', 400, 9) + 16);
    var xx = center ? x - w / 2 : x;
    K.roundrect(els, xx, y, w, 16, fill || T.bgLight);
    K.text(els, xx + 4, y, w - 8, 16, str, { weight: 400, max: 9, min: 7.5, maxLines: 1, align: 'center', valign: 'middle', color: color || T.ink });
    return w;
  }
  function photoOut(els) { return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true }; }
  function boxH(need, avail) { return Math.min(avail, Math.max(need, avail * 0.94)); }   // V.1_58: boxes reach the bottom (deck 31: empty lower third)
  // V.1_53: dark slides (black with the content in white), like the dark card slides of the solution decks
  var DARK_BG = '#050B1F', DARK_CARD = '#111A33', DARK_LINE = '#26324F', DARK_HEAD = '#7FA4FF', DARK_BODY = '#D8DEEA', DARK_MUTED = '#9AA6BF';
  function pal(s) {
    return s && s.dark ? { dark: true, bg: DARK_BG, card: DARK_CARD, panel: DARK_CARD, line: DARK_LINE, ink: T.white, body: DARK_BODY, head: DARK_HEAD, rule: DARK_LINE, muted: DARK_MUTED }
      : { dark: false, bg: T.white, card: T.white, panel: T.bgLight, line: LINE, ink: T.ink, body: T.ink, head: T.blue, rule: SLATE, muted: MUTED };
  }
  // the slide title and lead: the engine header on light slides, the same place in white on a dark slide
  function hdr(els, s, P, opts) {
    if (!P || !P.dark) return K.header(els, s, opts);
    var tw = (opts && opts.maxW) || (W - 2 * X0);
    var t = K.text(els, X0, 24, tw, 50, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white });
    var y = 24 + t.height + 5, lead = s.lead || s.subtitle;
    if (lead) { var l = K.text(els, X0, y, Math.min(tw, W - 2 * X0 - 40), 30, lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: DARK_BODY }); y += l.height; }
    return Math.max(y + 16, 68);
  }
  function done(els, P) { var o = { bg: P.bg, els: els, noBalance: true }; if (P.dark) o.dark = true; return o; }
  function cellText(c) { return clean(c && typeof c === 'object' ? (c.text || c.value || c.title || '') : c); }
  // table rows and columns as written by Gemini: columns ["", ...] and rows [[...], ...] (or rows of {cells})
  function tableOf(s, maxCols, maxRows) {
    var cols = K.arr(s.columns || s.headers, maxCols + 1).map(cellText);
    var rows = K.arr(s.rows, maxRows + 1).map(function (r) { return K.arr(Array.isArray(r) ? r : (r && r.cells) || [], maxCols + 1).map(cellText); })
      .filter(function (r) { return r.some(Boolean); });
    var n = cols.length || (rows[0] || []).length;
    if (n < 2 || n > maxCols || rows.length < 2 || rows.length > maxRows) return null;
    rows = rows.map(function (r) { while (r.length < n) r.push(''); return r.slice(0, n); });
    if (!cols.length) cols = rows[0].map(function () { return ''; });
    return { cols: cols, rows: rows, n: n };
  }
  // column widths: the first (labels) and the longer columns get more room
  function colWidths(tb, total, minW) {
    var len = tb.cols.map(function (c, j) { return Math.max(String(c).length, maxOf(tb.rows, function (r) { return Math.min(80, String(r[j]).length); })) + (j === 0 ? 6 : 0); });
    var sum = len.reduce(function (a, b) { return a + b; }, 0) || 1;
    var w = len.map(function (l) { return Math.max(minW, total * l / sum); });
    var k = total / w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (x) { return x * k; });
  }
  var GOOD_RE_ = /^(✓|yes\b|supported\b|automatic|auto\b|auto-|full$|fully supported|best fit|included|lowest\b|low\b|native\b|end-to-end|pass\b|enabled\b)/i;
  var BAD_RE_ = /^(✗|no\b|not supported|unsupported|manual\b|forbidden|none\b|high\b|lost\b|n\/a|fail\b|not included|risky)/i;
  function statusColor(t) { return GOOD_RE_.test(t) ? T.blue : BAD_RE_.test(t) ? MUTED : T.ink; }

  /* ---------- 1. Agenda: numbered rows with a one-line description — SQL AG p2, Paradigm p2, Accelerator TOC ---------- */
  add('S66_AGENDA_ROWS', 'agenda', { min: 2, max: 10, desc: 'solution agenda: numbered rows (grey number chip, section name, one-line description)' }, function (s) {
    var rows = K.arr(s.items, 11).map(function (it) {
      if (typeof it === 'string') return { title: clean(it), text: '' };
      var pts = K.arr(it && (it.points || it.topics), 4).map(K.str).map(clean).filter(Boolean);
      return { title: clean(it && (it.title || it.text)), text: clean(it && it.title ? (it.text || pts.join(' · ')) : pts.join(' · ')) };
    }).filter(function (r) { return r.title; });
    var n = rows.length;
    if (n < 2 || n > 10) return null;
    var els = [];
    var title = String(s.title || 'Agenda');
    if (s.continued) title = title.replace(/\s*\(continued\)\s*$/i, '') + ' (continued)';
    K.text(els, X0, 24, 500, 30, title, { weight: 500, max: 20, min: 18, maxLines: 1, color: T.ink });
    var top = 84, rh = Math.min(38, (BOTTOM - top) / n), tx = X0 + 40, tw = 250, dx = X0 + 312, dw = W - X0 - dx;
    rows.forEach(function (r, i) {
      var y = top + i * rh;
      K.roundrect(els, X0, y + rh / 2 - 10, 28, 20, T.bgLight);
      K.text(els, X0, y + rh / 2 - 10, 28, 20, K.pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
      K.text(els, tx, y, tw, rh, r.title, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, valign: 'middle', color: T.ink });
      if (r.text) K.text(els, dx, y, dw, rh, r.text, { weight: 400, max: 9.5, min: 9, maxLines: 2, valign: 'middle', color: MUTED });
      if (i < n - 1) K.line(els, X0, y + rh, W - X0, y + rh, LINE, 0.75);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 2. Why / what / how: arrow-shaped headers over columns — Managed Services p3/p16/p58/p61/p67 ---------- */
  add('S66_WHY_WHAT_HOW', 'process', { min: 2, max: 4, needs: 'items[{title,subtitle,points[]}] (2-4)',
    desc: '2-4 columns under blue arrow-shaped headers read left to right (why / what / how, or three service lines): optional blue subheading and bullets in each column', words: '8-20 per bullet' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 6; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 10, cw = (CW - gap * (n - 1)) / n, pad = 12, iw = cw - 2 * pad, barH = 26;
    var subB = items.some(function (it) { return it.subtitle; }) ? K.linesBlock(items.map(function (it) { return it.subtitle; }), iw, TSZ.heading, 500, 2) + 8 : 0;
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 7); });
    var need = barH + 10 + pad + subB + pB + pad, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.shape(els, 'HOME_PLATE', x, top, cw + (i < n - 1 ? 6 : 0), barH, T.blue);
      K.text(els, x + 10, top, cw - 30, barH, it.title, { weight: 500, max: TSZ.heading, min: 9.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var by = top + barH + 10;
      K.rect(els, x, by, cw, ch - barH - 10, T.white, { color: LINE, width: 0.75 });
      var yy = by + pad;
      if (it.subtitle) { heading(els, x + pad, yy, iw, it.subtitle, T.blue, 2); yy += subB; }
      bullets(els, x + pad, yy, iw, by + ch - barH - 10 - yy - pad, linesOf(it), 7);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 3. Three steps with a feedback loop — Managed Services p50/p52/p54/p56 ---------- */
  add('S66_STEP_LOOP_FLOW', 'process', { min: 3, max: 3, needs: 'items[{title,label,points[],next}] (3), loop[] (1-2 notes)',
    desc: 'three step boxes joined by arrows (a short label on each arrow: what is handed on), each with "Step n: title", a one-line role and 2-3 bullets; a dashed feedback loop runs back underneath with 1-2 short notes (an operating model, advise -> run -> improve)', words: '4-10 per bullet' }, function (s) {
    var items = itemsOf(s, 3);
    if (items.length !== 3) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 4; })) return null;
    var loops = K.arr(s.loop || s.loops || s.feedback, 2).map(K.str).map(clean).filter(Boolean);
    if (!loops.length) return null;                                       // V.1_53: without its feedback loop this is not an operating model
    var els = [];
    var top = K.header(els, s) + 6;
    var aw = 74, bw = (CW - 2 * aw) / 3, pad = 12, iw = bw - 2 * pad;
    var heads = items.map(function (it, i) { return 'Step ' + (i + 1) + ': ' + it.title; });
    var hB = K.linesBlock(heads, iw, TSZ.heading, 500, 2);
    var lB = items.some(function (it) { return it.label; }) ? K.linesBlock(items.map(function (it) { return it.label; }), iw, TSZ.body, 400, 2) + 6 : 0;
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 5); });
    var loopH = loops.length ? 62 : 0;
    var need = pad + hB + 6 + lB + 8 + pB + pad + 4, avail = BOTTOM - top - loopH;
    if (need > avail) return null;
    var bh = Math.min(avail, Math.max(need, avail * 0.62));
    items.forEach(function (it, i) {
      var x = CX + i * (bw + aw);
      K.roundrect(els, x, top, bw, bh, T.bgLight, { color: LINE, width: 0.75 });
      heading(els, x + pad, top + pad, iw, heads[i], T.ink, 2, 'center');
      var yy = top + pad + hB + 6;
      if (it.label) { K.text(els, x + pad, yy, iw, 30, it.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.blue }); yy += lB; }
      K.line(els, x + pad + 10, yy, x + bw - pad - 10, yy, SLATE, 0.75);
      bullets(els, x + pad, yy + 8, iw, top + bh - yy - 8 - pad, linesOf(it), 5);
      if (i < 2) {
        var ax = x + bw + 12, ay = top + bh / 2;
        K.shape(els, 'RIGHT_ARROW', ax + 10, ay - 9, aw - 44, 18, T.blue);
        if (it.next) K.text(els, ax - 4, ay - 40, aw - 16, 28, it.next, { weight: 500, max: 9, min: 8.5, maxLines: 2, align: 'center', valign: 'bottom', color: T.blue });
      }
    });
    if (loops.length) {
      var ly = top + bh + 22, x1 = CX + bw / 2, x3 = CX + 2 * (bw + aw) + bw / 2;
      K.dashedLine(els, x3, top + bh, x3, ly, T.ink, 0.75, 3, 3);
      K.dashedLine(els, x3, ly, x1, ly, T.ink, 0.75, 3, 3);
      K.dashedLine(els, x1, ly, x1, top + bh + 4, T.ink, 0.75, 3, 3);
      K.line(els, x1 - 4, top + bh + 10, x1, top + bh + 3, T.ink, 0.75);
      K.line(els, x1 + 4, top + bh + 10, x1, top + bh + 3, T.ink, 0.75);
      loops.forEach(function (t, k) {
        var cx = loops.length === 1 ? (x1 + x3) / 2 : x1 + (x3 - x1) * (k === 0 ? 0.3 : 0.72);
        var w = Math.min(190, K.textWidth(t, 'sans', 500, 9) + 20);
        K.rect(els, cx - w / 2, ly + 8, w, 22, TINT);
        K.text(els, cx - w / 2 + 6, ly + 8, w - 12, 22, t, { weight: 500, max: 9, min: 8.5, maxLines: 2, align: 'center', valign: 'middle', color: T.blue });
      });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 4. Step columns: numbered circles, chip, text — SQL AG p9 (failover process), Managed Services p20 ---------- */
  add('S66_STEP_COLUMNS', 'process', { min: 4, max: 6, needs: 'items[{title,tag,text}] (4-6)',
    desc: '4-6 tall step columns joined at the top: numbered blue circle, step name, a small chip (who or where it runs), one or two sentences (a run book, a cut-over, a transition)', words: '10-24' }, function (s) {
    var items = itemsOf(s, 6), n = items.length;
    if (n < 4 || n > 6) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var els = [], P = pal(s);
    var top = hdr(els, s, P) + 2;
    var take = clean(s.takeaway), takeH = take ? 22 : 0;
    var gap = 8, cw = (CW - gap * (n - 1)) / n, pad = 9, iw = cw - 2 * pad, d = 22;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 3);
    var hasTag = items.some(function (it) { return it.tag; });
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var need = pad + d + 10 + hB + 8 + (hasTag ? 24 : 0) + tB + pad, avail = BOTTOM - top - takeH;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    K.line(els, CX + cw / 2, top + pad + d / 2, CX + CW - cw / 2, top + pad + d / 2, P.rule, 1);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), cx = x + cw / 2;
      K.rect(els, x, top, cw, ch, P.card, { color: P.line, width: 0.75 });
      K.ellipse(els, cx - d / 2, top + pad, d, d, T.blue);
      K.text(els, cx - d / 2, top + pad, d, d, String(i + 1), { weight: 500, max: 10, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var yy = top + pad + d + 10;
      heading(els, x + pad, yy, iw, it.title, P.ink, 3, 'center');
      yy += hB + 8;
      if (hasTag) { if (it.tag) chip(els, cx, yy, it.tag, P.dark ? DARK_LINE : TINT, P.dark ? T.white : T.blue, iw, true); yy += 24; }
      var stxt = linesOf(it).join(' ');                                // V.1_58: long or labelled texts read left-aligned
      K.text(els, x + pad, yy, iw, top + ch - yy - pad, stxt.replace(/\s+·\s+/g, '\n'), { weight: 400, max: TSZ.body, min: TSZ.body, align: (/·/.test(stxt) || stxt.split(/\s+/).length > 14) ? 'left' : 'center', color: P.body });
    });
    if (take) K.text(els, CX, BOTTOM - 16, CW, 16, take, { weight: 400, max: 9.5, min: 9, maxLines: 1, align: 'center', color: P.muted });
    return done(els, P);
  });

  /* ---------- 5. Labelled rows: coloured label block + two bullet columns — SQL AG p13 (layers), p16 (phases),
     Accelerator p21 ---------- */
  add('S66_LABEL_ROWS', 'process', { min: 3, max: 4, needs: 'items[{label,title,timing,points[]}] (3-4)',
    desc: '3-4 full-width rows: a blue block on the left with a small label (Layer 1, Phase 2) and the name, the timing under the name, 2-6 short bullets in two columns (deployment layers, phases with their activities)', words: '4-12 per bullet' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 3 || n > 4) return null;
    if (items.some(function (it) { return linesOf(it).length < 2 || linesOf(it).length > 6; })) return null;
    // V.1_53: a timing is a duration ("5-10 min", "2 weeks"); one that every row repeats ("near real-time") is left out
    var tset = {}; items.forEach(function (it) { tset[it.timing.toLowerCase()] = 1; });
    items.forEach(function (it) { if (!/\d|ongoing/i.test(it.timing) || (n > 1 && Object.keys(tset).length === 1)) it.timing = ''; });
    var els = [];
    var top = K.header(els, s) + 2;
    var take = clean(s.takeaway), takeH = take ? 20 : 0;
    var gap = 6, bw = 140, pad = 10, colW = (CW - bw - 3 * pad) / 2;
    var rowNeed = items.map(function (it) {
      var pts = linesOf(it), half = Math.ceil(pts.length / 2);
      if (pts.length <= 3) return pad + ptsH(pts, 2 * colW + pad, TSZ.body, 5) + pad;
      return pad + Math.max(ptsH(pts.slice(0, half), colW, TSZ.body, 5), ptsH(pts.slice(half), colW, TSZ.body, 5)) + pad;
    });
    var blockNeed = items.map(function (it) { return 9 + th(it.title, bw - 16, TSZ.heading, 500) + (it.label ? 14 : 0) + (it.timing ? 15 : 0) + 9; });
    var hs = rowNeed.map(function (r, i) { return Math.max(r, blockNeed[i], 48); });
    var total = hs.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1), avail = BOTTOM - top - takeH;
    if (total > avail) return null;
    var k = Math.min(1.25, avail / total);
    var y = top;
    items.forEach(function (it, i) {
      var h = hs[i] * k, pts = linesOf(it), half = Math.ceil(pts.length / 2), fill = BLUES[i % BLUES.length];
      K.rect(els, CX, y, CW, h, T.white, { color: LINE, width: 0.75 });
      K.rect(els, CX, y, bw, h, fill);
      var hH = th(it.title, bw - 16, TSZ.heading, 500), tH = hH + (it.label ? 14 : 0) + (it.timing ? 15 : 0), ty = y + (h - tH) / 2;
      if (it.label) { K.text(els, CX + 8, ty, bw - 16, 12, it.label, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: 'center', color: T.white }); ty += 14; }
      heading(els, CX + 8, ty, bw - 16, it.title, T.white, 3, 'center');
      if (it.timing) K.text(els, CX + 8, ty + hH + 3, bw - 16, 12, it.timing, { font: 'mono', weight: 400, max: 8.5, min: 8, maxLines: 1, align: 'center', color: T.white });
      var bx = CX + bw + pad, by = y + pad;
      if (pts.length <= 3) bullets(els, bx, by, 2 * colW + pad, h - (by - y) - pad, pts, 5);   // a short list stays in one column
      else {
        bullets(els, bx, by, colW, h - (by - y) - pad, pts.slice(0, half), 5);
        bullets(els, bx + colW + pad, by, colW, h - (by - y) - pad, pts.slice(half), 5);
      }
      y += h + gap;
    });
    if (take) K.text(els, CX, BOTTOM - 14, CW, 14, take, { weight: 500, max: 9.5, min: 9, maxLines: 1, align: 'center', color: T.ink });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 6. Phases with timing and funding bars — GWS GE p4, Accelerator p4 ---------- */
  add('S66_PHASE_TIMELINE_BARS', 'process', { min: 3, max: 5, needs: 'items[{title,points[],timing,funding}] (3-5)',
    desc: '3-5 phases as pale arrow tabs (Phase 01...), each with its name and 1-3 bullets, then a row of blue bars with each phase\'s timing and an optional row with how it is funded (end-to-end services, engagement journey)', words: '2-6 per bullet' }, function (s) {
    var items = itemsOf(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    if (!items.every(function (it) { return it.timing; })) return null;
    if (items.some(function (it) { return linesOf(it).length > 4; })) return null;
    var hasFund = items.some(function (it) { return it.funding; });
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 8, cw = (CW - gap * (n - 1)) / n, pad = 8, iw = cw - 2 * pad, tabH = 24;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var label = clean(s.timelineLabel) || 'Timeline';
    var barsH = 16 + 8 + 22 + (hasFund ? 8 + 22 : 0);
    var need = tabH + 12 + hB + 8 + pB + 20 + barsH, avail = BOTTOM - top;
    if (need > avail) return null;
    var extra = Math.min(40, avail - need);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.shape(els, i === 0 ? 'HOME_PLATE' : 'CHEVRON', x, top, cw + (i < n - 1 ? 8 : 0), tabH, TINT);
      K.text(els, x + 12, top, cw - 24, tabH, 'Phase ' + K.pad2(i + 1), { weight: 500, max: 10, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
      var yy = top + tabH + 12;
      heading(els, x + pad, yy, iw, it.title, T.ink, 2);
      bullets(els, x + pad, yy + hB + 8, iw, pB + extra, linesOf(it), 4);
    });
    var ly = top + tabH + 12 + hB + 8 + pB + extra + 12;
    K.line(els, CX, ly, CX + CW, ly, LINE, 0.75);
    K.text(els, CX, ly + 6, CW, 16, label, { weight: 500, max: 10, min: 9, maxLines: 1, align: 'center', color: T.ink });
    var by = ly + 6 + 16 + 6;
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, by, cw, 22, T.blue);
      K.text(els, x + 4, by, cw - 8, 22, it.timing, { weight: 500, max: 9.5, min: 8.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      if (hasFund) {
        K.rect(els, x, by + 30, cw, 22, it.funding ? T.ink : T.bgLight);
        if (it.funding) K.text(els, x + 4, by + 30, cw - 8, 22, it.funding, { weight: 400, max: 9, min: 8, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      }
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 7. Value over time: axes, three numbered milestones, three columns — GWS GE p3, Accelerator p6 ---------- */
  add('S66_VALUE_CURVE', 'process', { min: 3, max: 3, needs: 'items[{label,title,points[]}] (3)',
    desc: 'a value-over-time chart with three numbered milestones on a rising dashed line (label each: Day 1, Early weeks, Ongoing) and three columns underneath with what each stage brings (adoption stages, value realisation)', words: '3-8 per bullet' }, function (s) {
    var items = itemsOf(s, 3);
    if (items.length !== 3) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 5; })) return null;
    // V.1_53: value over time needs its three stage labels, and a process (training, a pipeline) is never a value curve
    if (items.some(function (it) { return !it.label; }) || /\b(train\w*|pipeline|process|steps?|workflow|how .+ works)\b/i.test(String(s.title || ''))) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 14, cw = (CW - 2 * gap) / 3, iw = cw - 8;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var colH = hB + 8 + pB;
    var chartH = BOTTOM - top - colH - 22;
    if (chartH < 92) return null;
    chartH = Math.min(chartH, 150);
    var ax = CX + 18, ay0 = top + 14, ay1 = top + chartH, axr = CX + CW - 10;
    K.line(els, ax, ay1, ax, ay0, T.ink, 1);
    K.line(els, ax - 4, ay0 + 7, ax, ay0, T.ink, 1); K.line(els, ax + 4, ay0 + 7, ax, ay0, T.ink, 1);
    K.line(els, ax, ay1, axr, ay1, T.ink, 1);
    K.line(els, axr - 7, ay1 - 4, axr, ay1, T.ink, 1); K.line(els, axr - 7, ay1 + 4, axr, ay1, T.ink, 1);
    K.text(els, ax + 6, top - 2, 80, 14, clean(s.yLabel) || 'Value', { weight: 500, max: 9, min: 8.5, maxLines: 1, color: T.ink });
    K.text(els, axr - 80, ay1 + 3, 80, 14, clean(s.xLabel) || 'Time', { weight: 500, max: 9, min: 8.5, maxLines: 1, align: 'right', color: T.ink });
    var P = function (t) { return { x: ax + 12 + (axr - ax - 40) * t, y: ay1 - 10 - (ay1 - ay0 - 26) * Math.pow(t, 1.6) }; };
    var prev = P(0), seg = 30;
    for (var j = 1; j <= seg; j++) {
      var q = P(j / seg);
      if (j % 2) K.line(els, prev.x, prev.y, q.x, q.y, T.blue, 1.25);
      prev = q;
    }
    var ts = [0.16, 0.52, 0.86], fills = [SLATE, '#5C8DFF', T.blue];
    items.forEach(function (it, i) {
      var p = P(ts[i]), d = 18;
      K.ellipse(els, p.x - d / 2, p.y - d / 2, d, d, fills[i]);
      K.text(els, p.x - d / 2, p.y - d / 2, d, d, String(i + 1), { weight: 500, max: 9, min: 8, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      if (it.label) K.text(els, p.x - 70, p.y - d / 2 - 30, 140, 26, it.label, { weight: 500, max: 12, min: 10, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
    });
    var cy = ay1 + 18;
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, cy, cw, 2, fills[i]);
      heading(els, x + 4, cy + 8, iw, it.title, T.blue, 2);
      bullets(els, x + 4, cy + 8 + hB + 8, iw, BOTTOM - (cy + 8 + hB + 8), linesOf(it), 4);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 8. Three numbered rows under a photo band — SQL playbook p21 (three reasons), Accelerator p13 ---------- */
  add('S66_BANNER_NUMBERED_ROWS', 'process', { min: 2, max: 4, needs: 'items[{title,text}] (2-4)',
    desc: 'the slide title on a photo band across the top, then 2-4 white rows with a blue number square, a heading and one or two sentences (three reasons, key changes, the conclusion)', words: '15-35' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var bandH = 84, els = [];
    K.rect(els, 0, bandH, W, H - bandH, T.bgLight);
    K.text(els, X0, 22, W - 2 * X0 - 40, bandH - 30, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white, valign: 'middle' });
    var top = bandH + 16;
    var take = clean(s.takeaway), takeH = take ? 18 : 0;
    var pad = 12, nb = 22, tx = CX + pad + nb + 14, tw = CX + CW - pad - tx;
    var hs = items.map(function (it) { return pad + th(it.title, tw, TSZ.heading, 500) + 4 + th(linesOf(it).join(' '), tw, TSZ.body) + pad; });
    var gap = 8, total = hs.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1), avail = BOTTOM - top - takeH;
    if (total > avail) return null;
    var k = Math.min(1.3, avail / total), y = top;
    items.forEach(function (it, i) {
      var h = hs[i] * k;
      K.rect(els, CX + nb / 2 + 4, y, CW - nb / 2 - 4, h, T.white);
      K.rect(els, CX, y + pad, nb, nb, T.blue);
      K.text(els, CX, y + pad, nb, nb, K.pad2(i + 1), { font: 'mono', weight: 500, max: 9.5, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var hr = heading(els, tx, y + pad, tw, it.title, T.ink, 2);
      body(els, tx, y + pad + hr.height + 4, tw, h - 2 * pad - hr.height - 4, linesOf(it).join(' '));
      y += h + gap;
    });
    if (take) K.text(els, CX, BOTTOM - 14, CW, 14, take, { weight: 400, max: 9, min: 8.5, maxLines: 1, color: MUTED });
    return photoOut(els);
  });

  /* ---------- 9. Comparison matrix with status colours — SQL AG p5, SQL playbook p5/p13, Managed Services p65 ---------- */
  add('S66_COMPARE_STATUS_TABLE', 'table', { min: 3, max: 10, needs: 'columns[], rows[[...]] (3-10 rows, 3-5 columns), recommend',
    desc: 'a comparison matrix: blue header row, criteria down the first column, short answers in the cells coloured by status (yes / supported / automatic in blue, no / manual / not supported in grey); recommend: true tints the last column as the recommended option (options compared on criteria, a decision matrix)', words: '1-6 per cell' }, function (s) {
    var tb = tableOf(s, 5, 10);
    if (!tb || tb.n < 3) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var note = clean(s.takeaway), noteH = note ? 18 : 0;
    var ws = colWidths(tb, CW, 92), headH = 26, pad = 7;
    var rowH = tb.rows.map(function (r) { return Math.max(22, maxOf(r, function (c, j) { return th(c, ws[j] - 2 * pad, 9.5, j === 0 ? 500 : 400); }) + 10); });
    var total = headH + rowH.reduce(function (a, b) { return a + b; }, 0), avail = BOTTOM - top - noteH;
    if (total > avail) return null;
    var k = Math.min(2.6, avail * 0.97 / total);                  // V.1_58: rows share the free space (no empty lower third)
    var rec = s.recommend === true || /★|recommend/i.test(String(tb.cols[tb.n - 1]));
    var xs = [CX];
    ws.forEach(function (w, j) { xs.push(xs[j] + w); });
    var tableH = headH + rowH.reduce(function (a, b) { return a + b * k; }, 0);
    if (rec) K.rect(els, xs[tb.n - 1], top + headH, ws[tb.n - 1], tableH - headH, TINT);
    tb.cols.forEach(function (c, j) {
      K.rect(els, xs[j] + 1, top, ws[j] - 2, headH, T.blue);
      K.text(els, xs[j] + pad, top, ws[j] - 2 * pad, headH, c.replace(/\s*★\s*/, '') + (rec && j === tb.n - 1 && !/★/.test(c) ? '' : ''), { weight: 500, max: 9.5, min: 8.5, maxLines: 2, align: j ? 'center' : 'left', valign: 'middle', color: T.white });
    });
    var y = top + headH;
    tb.rows.forEach(function (r, i) {
      var h = rowH[i] * k;
      r.forEach(function (c, j) {
        K.text(els, xs[j] + pad, y, ws[j] - 2 * pad, h, c, { weight: j === 0 ? 500 : 400, max: 9.5, min: 8.5, maxLines: 3, align: j ? 'center' : 'left', valign: 'middle', color: j === 0 ? T.ink : statusColor(c) });
      });
      K.line(els, CX, y + h, CX + CW, y + h, LINE, 0.75);
      y += h;
    });
    if (note) K.text(els, CX, y + 4, CW, 14, note, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: 'center', color: T.blue });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 10. Plain table: blue header, labels down the first column — Accelerator p4, Showcase p6/p29,
     Managed Services p62/p63 ---------- */
  add('S66_PLAIN_TABLE', 'table', { min: 2, max: 8, needs: 'columns[], rows[[...]] (2-8 rows, 2-5 columns)',
    desc: 'a clean table: blue header row, the first column as row labels, hairlines between rows, short phrases in the cells (offerings with timeline and cost, metrics with definition and target, entities compared)', words: '2-16 per cell' }, function (s) {
    var tb = tableOf(s, 5, 8);
    if (!tb) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var ws = colWidths(tb, CW, 100), headH = 26, pad = 9;
    var rowH = tb.rows.map(function (r) { return Math.max(26, maxOf(r, function (c, j) { return th(c, ws[j] - 2 * pad, TSZ.body, j === 0 ? 500 : 400); }) + 14); });
    var total = headH + rowH.reduce(function (a, b) { return a + b; }, 0), avail = BOTTOM - top;
    if (total > avail) return null;
    var k = Math.min(2.6, avail * 0.97 / total);                  // V.1_58: rows share the free space
    var xs = [CX];
    ws.forEach(function (w, j) { xs.push(xs[j] + w); });
    K.rect(els, CX, top, CW, headH, T.blue);
    tb.cols.forEach(function (c, j) {
      K.text(els, xs[j] + pad, top, ws[j] - 2 * pad, headH, c, { weight: 500, max: TSZ.body, min: 9, maxLines: 2, valign: 'middle', color: T.white });
    });
    var y = top + headH;
    tb.rows.forEach(function (r, i) {
      var h = rowH[i] * k;
      r.forEach(function (c, j) {
        K.text(els, xs[j] + pad, y, ws[j] - 2 * pad, h, c, { weight: j === 0 ? 500 : 400, max: TSZ.body, min: 9, maxLines: 4, valign: 'middle', color: T.ink });
      });
      K.line(els, CX, y + h, CX + CW, y + h, LINE, 0.75);
      y += h;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. Scorecard: big result numbers over a results table — SQL AG p10 ---------- */
  add('S66_SCORECARD', 'stats', { min: 2, max: 4, needs: 'items[{value,label}] (2-4), columns[], rows[[...]] (2-8)',
    desc: '2-4 big result numbers in white tiles, then a compact results table underneath (tests passed, pilot results, validation evidence)', words: 'label 2-6; cells 1-8' }, function (s) {
    var tiles = K.items(s, 5).map(function (it) { return { value: clean(it && it.value), label: clean(it && (it.label || it.title)) }; })
      .filter(function (t) { return t.value && /\d/.test(t.value); });
    var tb = tableOf(s, 5, 8);
    if (tiles.length < 2 || tiles.length > 4 || !tb) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var n = tiles.length, gap = 12, tw = (CW - gap * (n - 1)) / n, tH = 66;
    tiles.forEach(function (t, i) {
      var x = CX + i * (tw + gap);
      K.rect(els, x, top, tw, tH, T.white, { color: LINE, width: 0.75 });
      K.text(els, x + 8, top + 8, tw - 16, 30, t.value, { font: 'mono', weight: 500, max: 24, min: 14, maxLines: 1, align: 'center', color: T.blue });
      K.text(els, x + 8, top + 40, tw - 16, 22, t.label, { weight: 400, max: 9.5, min: 8.5, maxLines: 2, align: 'center', color: T.ink });
    });
    var y0 = top + tH + 14, ws = colWidths(tb, CW, 80), headH = 20, pad = 6;
    var rowH = tb.rows.map(function (r) { return Math.max(17, maxOf(r, function (c, j) { return th(c, ws[j] - 2 * pad, 9, j === 0 ? 500 : 400); }) + 6); });
    var total = headH + rowH.reduce(function (a, b) { return a + b; }, 0);
    if (y0 + total > BOTTOM) return null;
    // V.1_58 (deck 31 slide 4: the lower 40% empty): the rows share the free space
    var kk = Math.min(3.5, (BOTTOM - y0 - headH) * 0.97 / Math.max(1, total - headH));
    if (kk > 1) rowH = rowH.map(function (h) { return h * kk; });
    var xs = [CX];
    ws.forEach(function (w, j) { xs.push(xs[j] + w); });
    K.rect(els, CX, y0, CW, headH, T.blue);
    tb.cols.forEach(function (c, j) { K.text(els, xs[j] + pad, y0, ws[j] - 2 * pad, headH, c, { weight: 500, max: 9, min: 8, maxLines: 1, valign: 'middle', color: T.white }); });
    var y = y0 + headH;
    tb.rows.forEach(function (r, i) {
      r.forEach(function (c, j) { K.text(els, xs[j] + pad, y, ws[j] - 2 * pad, rowH[i], c, { weight: j === 0 ? 500 : 400, max: 9, min: 8, maxLines: 2, valign: 'middle', color: j === 0 ? T.ink : statusColor(c) }); });
      K.line(els, CX, y + rowH[i], CX + CW, y + rowH[i], LINE, 0.5);
      y += rowH[i];
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- V.1_66: KPI tiles with their explanation (deck 38 Solution slide 18: the targets were drawn as text columns
     with "100% · Availability target" as the heading) ---------- */
  add('S66_KPI_TEXT_TILES', 'stats', { min: 2, max: 4, needs: 'items[{value,label,text}] (2-4), takeaway',
    desc: '2-4 tall white tiles, each a big blue figure, its label and one or two sentences, with the takeaway on a pale bar underneath (KPI targets, success measures, results with what they mean)', words: 'label 2-6; text 10-35' }, function (s) {
    var tiles = K.items(s, 5).map(function (it) { return { value: clean(it && it.value), label: clean(it && (it.label || it.title)), text: clean(it && (it.text || it.description)) }; })
      .filter(function (t) { return t.value && /\d/.test(t.value) && t.label; });
    var n = tiles.length;
    if (n < 2 || n > 4 || n !== K.items(s, 5).length) return null;
    var els = [];
    var top = K.header(els, s) + 4;
    var take = clean(s.takeaway), takeH = take ? th(take, CW - 24, 9.5, 400) + 14 : 0;
    var gap = 12, tw = (CW - gap * (n - 1)) / n, iw = tw - 28;
    var vSize = K.uniformSize(tiles.map(function (t) { return t.value; }), iw, 44, { font: 'mono', weight: 500, max: 30, min: 18, maxLines: 1 });
    var lB = maxOf(tiles, function (t) { return th(t.label, iw, 10.5, 500); });
    var tB = maxOf(tiles, function (t) { return th(t.text, iw, 9.5, 400); });
    var need = 16 + K.lineHeight('mono', vSize) + 8 + lB + (tB ? 8 + tB : 0) + 18;
    var room = BOTTOM - top - (take ? takeH + 10 : 0);
    if (need > room) return null;
    var tH = Math.min(room, need + 24);
    tiles.forEach(function (t, i) {
      var x = CX + i * (tw + gap), y = top;
      K.rect(els, x, y, tw, tH, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, y, tw, 3, T.blue);
      y += 16;
      K.text(els, x + 14, y, iw, K.lineHeight('mono', vSize), t.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, color: T.blue });
      y += K.lineHeight('mono', vSize) + 8;
      K.text(els, x + 14, y, iw, lB, t.label, { weight: 500, max: 10.5, min: 10.5, color: T.ink });
      y += lB + 8;
      if (t.text) K.text(els, x + 14, y, iw, tB, t.text, { weight: 400, max: 9.5, min: 9.5, color: T.ink });
    });
    if (take) {
      K.rect(els, CX, top + tH + 10, CW, takeH, TINT);
      K.text(els, CX + 12, top + tH + 10, CW - 24, takeH, take, { weight: 400, max: 9.5, min: 9.5, valign: 'middle', color: T.ink });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 12. Value tiers: context bar, three big values, next-step bar — HCA p6 ---------- */
  add('S66_TIER_VALUE', 'stats', { min: 3, max: 3, needs: 'context, items[{label,value,title,text}] (3), takeaway',
    desc: 'a one-line strategy bar, three tiers side by side (small tier label, big value, what it is, one or two sentences), and a recommended-next-step bar at the bottom (value by stage: quick win, targeted, strategic)', words: '15-30' }, function (s) {
    var items = K.items(s, 4).map(norm).filter(function (it) { return it.value && /\d/.test(it.value); });
    var ctxText = clean(s.context);
    if (items.length !== 3 || !ctxText) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var full = /^[^:]{2,24}:/.test(ctxText) ? ctxText : 'Strategy: ' + ctxText, lead = full.indexOf(':') + 1;
    var cH = th(full, CW - 28, TSZ.body) + 16;
    K.rect(els, CX, top, CW, cH, T.white, { color: LINE, width: 0.75 });
    K.text(els, CX + 14, top + 8, CW - 28, cH - 16, full, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink, runs: [{ start: 0, end: lead, color: T.ink, weight: 500 }] });
    var take = clean(s.takeaway), takeH = take ? th(take, CW - 40, TSZ.body) + 16 : 0;
    var y = top + cH + 12, gap = 12, cw = (CW - 2 * gap) / 3, pad = 14, iw = cw - 2 * pad;
    var tB = maxOf(items, function (it) { return th(linesOf(it).join(' '), iw, TSZ.body); });
    var titleB = maxOf(items, function (it) { return th(it.title, iw, TSZ.heading, 500); });
    var need = pad + 14 + 6 + 30 + 4 + titleB + 10 + 1 + 10 + tB + pad, avail = BOTTOM - y - (take ? takeH + 12 : 0);
    if (need > avail) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.8));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, y, cw, ch, T.white, { color: LINE, width: 0.75 });
      var yy = y + pad;
      K.text(els, x + pad, yy, iw, 14, it.label || ('Tier ' + (i + 1)), { weight: 400, max: 9, min: 8.5, maxLines: 1, color: MUTED });
      yy += 20;
      K.text(els, x + pad, yy, iw, 30, it.value, { font: 'mono', weight: 500, max: 22, min: 14, maxLines: 1, color: T.blue });
      yy += 34;
      var hr = heading(els, x + pad, yy, iw, it.title, T.ink, 2);
      yy += hr.height + 10;
      K.line(els, x + pad, yy, x + cw - pad, yy, LINE, 0.75);
      body(els, x + pad, yy + 10, iw, y + ch - yy - 10 - pad, linesOf(it).join(' '));
    });
    if (take) {
      var ty = y + ch + 12;
      K.rect(els, CX, ty, CW, takeH, T.bgLight);
      K.rect(els, CX, ty, 4, takeH, T.blue);
      var tl = /^[^:]{2,30}:/.test(take) ? take.indexOf(':') + 1 : 0;
      K.text(els, CX + 18, ty + 8, CW - 36, takeH - 16, take, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink, runs: tl ? [{ start: 0, end: tl, color: T.ink, weight: 500 }] : null });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 13. A pillar: label, text, two figures, what this means — Showcase p7-p9 ---------- */
  add('S66_PILLAR_IMAGE_STATS', 'stats', { min: 2, max: 2, needs: 'label, text, items[{value,label}] (2), takeaway',
    desc: 'one pillar of a strategy beside a photo strip: a small label (Pillar 01) over a blue bar with its name (field "bar"), one or two short paragraphs, two figure tiles, and a "what this means" panel at the bottom (one pillar or theme per slide, in a series)', words: 'text 30-60; takeaway 15-30' }, function (s) {
    var figs = K.items(s, 3).map(function (it) { return { value: clean(it && it.value), label: clean(it && (it.label || it.title)) }; })
      .filter(function (f) { return f.value && /\d/.test(f.value); });
    var para = clean(s.text);
    if (figs.length !== 2 || para.length < 30) return null;
    var px = 520, els = [];
    K.rect(els, 0, 0, px, H, T.white);
    var top = K.header(els, s, { maxW: px - 50 }) + 2;
    var w = px - CX - 24, y = top;
    var lab = clean(s.label), bar = clean(s.bar || s.heading);
    if (lab) { K.text(els, CX, y, 200, 12, lab, { font: 'mono', weight: 500, max: 8.5, min: 8, maxLines: 1, color: MUTED }); y += 14; }
    if (bar) {
      K.rect(els, CX, y, w, 22, T.blue);
      K.text(els, CX + 10, y, w - 20, 22, bar, { weight: 500, max: 10.5, min: 9.5, maxLines: 1, valign: 'middle', color: T.white });
      y += 30;
    }
    var take = s.takeaway && typeof s.takeaway === 'object' ? { title: clean(s.takeaway.title), text: clean(s.takeaway.text) } : { title: 'What this means', text: clean(s.takeaway) };
    var pH = th(para, w, TSZ.body), figH = 52, takeH = take.text ? 12 + lh(9.5) + 4 + th(take.text, w - 24, 9.5) + 10 : 0;
    var need = pH + 12 + figH + (takeH ? 14 + takeH : 0);
    if (y + need > BOTTOM) return null;
    body(els, CX, y, w, pH, para);
    var fy = y + pH + 12, fw = (w - 10) / 2;
    figs.forEach(function (f, i) {
      var x = CX + i * (fw + 10);
      K.rect(els, x, fy, fw, figH, i === 0 ? SLATE : T.bgLight);
      K.text(els, x + 10, fy + 6, fw - 20, 24, f.value, { font: 'mono', weight: 500, max: 18, min: 12, maxLines: 1, color: i === 0 ? T.ink : T.blue });
      K.text(els, x + 10, fy + 32, fw - 20, 16, f.label, { weight: 400, max: 8.5, min: 8, maxLines: 2, color: T.ink });
    });
    if (takeH) {
      var ty = BOTTOM - takeH;
      K.rect(els, CX, ty, w, takeH, TINT);
      K.text(els, CX + 12, ty + 10, w - 24, 14, take.title || 'What this means', { weight: 500, max: 9.5, min: 9, maxLines: 1, color: T.blue });
      K.text(els, CX + 12, ty + 12 + lh(9.5) + 2, w - 24, takeH - lh(9.5) - 22, take.text, { weight: 400, max: 9.5, min: 9, color: T.ink });
    }
    return photoOut(els);
  });
})();
