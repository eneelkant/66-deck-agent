/* =========================================================================================================
   66° Deck Agent — Solution Deck design library (V.1_53), part 3: architecture and technical detail
   From the 66degrees solution decks (Paradigm, SQL AG customer deck, SQL Server playbook, ADF, Managed Services 2026,
   HCA Control Tower): architecture with numbered groups and notes, architecture of icon nodes with labelled arrows,
   two regions with their zones, a stack of layers, problem / solution with the code, a table with note panels, a
   priority table (P1-P4), issue rows with their fixes, two ways compared row by row, needs mapped to the solution,
   a chart with insight blocks. Solution Deck only (ENGINE.addSolutionDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addSolutionDesign;
  var LINE = T.cardLine || '#DBDDE1', SLATE = T.slate || '#B3C5D0';
  var TINT = '#E6EEFF';                 // pale 66° blue (tinted panels, chips)
  var MUTED = '#6B7486';                // secondary text (crosses, labels)

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
    if (typeof it === 'string') return { title: clean(it), text: '', points: [], icon: '' };
    it = it || {};
    var pts = K.arr(it.points || it.bullets, 8).map(K.str).map(clean).filter(Boolean);
    return {
      title: clean(it.title || it.name || it.label), text: clean(it.text || it.description), points: pts,
      icon: it.icon || '', material: it.material || '', label: clean(it.label && it.title ? it.label : ''),
      tag: clean(it.tag || it.owner || it.chip), timing: clean(it.timing || it.duration || it.when || it.date),
      price: clean(it.price || it.cost), funding: clean(it.funding), value: clean(it.value), subtitle: clean(it.subtitle)
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
  // a line icon (blue on light, white on dark); the icon follows the item's words when none was planned
  function icon(els, it, x, y, size, onDark) {
    var src = (it.icon || it.material) ? it : { icon: (it.title + ' ' + it.text).toLowerCase().slice(0, 160), title: it.title };
    K.icon(els, src, x, y, size, !!onDark);
  }
  function badge(els, it, x, y, d, fill) {
    K.ellipse(els, x, y, d, d, fill || T.blue);
    var sz = Math.round(d * 0.56);
    icon(els, it, x + (d - sz) / 2, y + (d - sz) / 2, sz, true);
  }
  function chip(els, x, y, str, fill, color, maxW) {
    var w = Math.min(maxW || 200, K.textWidth(str, 'sans', 400, 9) + 14);
    K.roundrect(els, x, y, w, 16, fill || T.bgLight);
    K.text(els, x + 4, y, w - 8, 16, str, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: 'center', valign: 'middle', color: color || T.ink });
    return w;
  }
  // a photo slide: the light page covers everything except the photo strip / band / half (PhotoStrips.gs cuts the photo)
  function photoOut(els) { return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true }; }
  // the slide title on a photo band along the top (white on the photo)
  function bandTitle(els, s, bandH) {
    var t = K.text(els, X0, 22, W - 2 * X0 - 40, bandH - 30, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white, valign: 'middle' });
    return t;
  }
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

  // tables as Gemini writes them: columns ["", ...] and rows [[...], ...]
  function cellText(c) { return clean(c && typeof c === 'object' ? (c.text || c.value || c.title || '') : c); }
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
  function colWidths(tb, total, minW) {
    var len = tb.cols.map(function (c, j) { return Math.max(String(c).length, maxOf(tb.rows, function (r) { return Math.min(80, String(r[j]).length); })) + (j === 0 ? 6 : 0); });
    var sum = len.reduce(function (a, b) { return a + b; }, 0) || 1;
    var w = len.map(function (l) { return Math.max(minW, total * l / sum); });
    var k = total / w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (x) { return x * k; });
  }
  // a small arrow head at (x, y) pointing right / left / down
  function arrowHead(els, x, y, dir, color) {
    var a = 4;
    if (dir === 'left') { K.line(els, x, y, x + a, y - a, color, 1); K.line(els, x, y, x + a, y + a, color, 1); }
    else if (dir === 'down') { K.line(els, x, y, x - a, y - a, color, 1); K.line(els, x, y, x + a, y - a, color, 1); }
    else { K.line(els, x, y, x - a, y - a, color, 1); K.line(els, x, y, x - a, y + a, color, 1); }
  }
  function nodeItems(list, max) {
    return K.arr(list, max + 1).map(function (it) {
      if (typeof it === 'string') return { title: clean(it), text: '', icon: '' };
      it = it || {};
      return { title: clean(it.title || it.name || it.label), text: clean(it.text || it.description || it.subtitle), icon: it.icon || '', material: it.material || '' };
    }).filter(function (it) { return it.title; });
  }

  /* ---------- 1. Architecture with numbered groups and numbered notes — Paradigm p13 ---------- */
  add('S66_ARCH_NUMBERED', 'diagram', { min: 0, max: 99, needs: 'groups[{label,items[{title,text,icon}]}] (3-6 groups, 1-4 items each), callouts[] (3-7 numbered notes, one per group)',
    desc: 'a cloud architecture: numbered groups of product boxes (icon, product name, what it does) on a pale platform panel, and numbered notes down the left that explain each group (the reference architecture, how the parts fit)', words: 'item text 2-6; notes 8-20' }, function (s) {
    var groups = K.arr(s.groups, 7).map(function (g) { g = g || {}; return { label: clean(g.label || g.title || g.name), items: nodeItems(g.items || g.products || g.nodes, 4) }; })
      .filter(function (g) { return g.label && g.items.length; });
    var n = groups.length;
    if (n < 3 || n > 6 || groups.some(function (g) { return g.items.length > 4; })) return null;
    var notes = K.arr(s.callouts || s.steps, 8).map(function (x) { return clean(typeof x === 'object' ? (x && (x.text || x.title)) : x); }).filter(real);
    if (notes.length > 7) return null;
    // V.1_57 (deck 30: the notes repeated "Tier 1:", "Tier 2:" next to the same numbered groups): the number is shown
    // once, so a note starts with what it adds; a note that only names its group's products is left out
    notes = notes.map(function (t, i) {
      var g = groups[i];
      t = t.replace(/^(tier|layer|group|zone|stage|step)\s*\d+\s*[:.\-–—]\s*/i, '');
      if (g && g.label && t.toLowerCase().indexOf(g.label.toLowerCase().replace(/^(tier|layer|group)\s*\d+\s*[:.\-–—]\s*/i, '') + ':') === 0) t = t.slice(t.indexOf(':') + 1).trim();
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    });
    var addsSomething = function (t, i) {
      var g = groups[i];
      if (!g) return true;
      var words = t.toLowerCase().match(/[a-z0-9][a-z0-9\-\/]+/g) || [];
      var known = (g.label + ' ' + g.items.map(function (it) { return it.title + ' ' + (it.text || ''); }).join(' ')).toLowerCase();
      return words.filter(function (w) { return w.length > 3 && known.indexOf(w) === -1; }).length >= 2;
    };
    // the notes are numbered like the groups: when most of them only repeat their group, none are shown
    if (notes.filter(addsSomething).length < Math.ceil(notes.length / 2)) notes = [];
    var els = [];
    var top = K.header(els, s) + 2;
    var nw = notes.length ? 186 : 0, gx = notes.length ? 14 : 0;
    var px = CX + nw + gx, pw = CW - nw - gx, ph = BOTTOM - top;
    // numbered notes down the left
    if (notes.length) {
      var gapN = Math.min(10, (ph - notes.reduce(function (a, t) { return a + th(t, nw - 22, 9, 400); }, 0)) / Math.max(1, notes.length - 1));
      if (gapN < 3) return null;
      var y = top;
      notes.forEach(function (t, i) {
        K.text(els, CX, y, 16, 12, String(i + 1), { font: 'mono', weight: 500, max: 9, min: 9, maxLines: 1, color: T.blue });
        var r = K.text(els, CX + 18, y, nw - 22, 40, t, { weight: 400, max: 9, min: 9, color: T.ink });
        y += r.height + gapN;
      });
    }
    K.rect(els, px, top, pw, ph, T.bgLight);
    var cols = n <= 3 ? n : Math.ceil(n / 2), rows = n <= 3 ? 1 : 2, gap = 10, pad = 10;
    var gw = (pw - 2 * pad - gap * (cols - 1)) / cols, gh = (ph - 2 * pad - gap * (rows - 1)) / rows;
    var rowH = 30;
    var needMax = maxOf(groups, function (g) { return 28 + g.items.length * (rowH + 6); });
    if (needMax > gh) return null;
    groups.forEach(function (g, k) {
      var x = px + pad + (k % cols) * (gw + gap), y = top + pad + Math.floor(k / cols) * (gh + gap);
      K.rect(els, x, y, gw, gh, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x + 8, y + 8, 16, 16, T.blue);
      K.text(els, x + 8, y + 8, 16, 16, String(k + 1), { font: 'mono', weight: 500, max: 9, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      K.text(els, x + 30, y + 8, gw - 38, 16, g.label, { weight: 500, max: 9.5, min: 8.5, maxLines: 1, valign: 'middle', color: T.ink });
      var iy = y + 30;
      g.items.forEach(function (it) {
        K.rect(els, x + 8, iy, gw - 16, rowH, T.white, { color: LINE, width: 0.5 });
        icon(els, it, x + 13, iy + 7, 16);
        K.text(els, x + 34, iy + (it.text ? 3 : 8), gw - 46, 13, it.title, { weight: 500, max: 9, min: 8, maxLines: 1, color: T.ink });
        if (it.text) K.text(els, x + 34, iy + 15, gw - 46, 12, it.text, { weight: 400, max: 8, min: 7.5, maxLines: 1, color: MUTED });
        iy += rowH + 6;
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 2. Architecture of icon nodes with labelled arrows — Paradigm p? ("C1 architecture") ---------- */
  add('S66_ARCH_ICON_GRAPH', 'diagram', { min: 0, max: 99, needs: 'columns[{label,items[{title,text,icon}]}] (3-4 columns, 1-4 items each), links[] (a label on each arrow)',
    desc: 'an architecture read left to right: 3-4 labelled groups of icon nodes (sources, ingestion, processing, users), joined by arrows with a short label on each (a data flow, a reference architecture, the request path)', words: 'node 1-4; text 2-6; link 1-3' }, function (s) {
    var cols = K.arr(s.columns || s.groups, 5).filter(function (c) { return c && typeof c === 'object'; })
      .map(function (c) { return { label: clean(c.label || c.title || c.name), items: nodeItems(c.items || c.nodes || c.products, 4) }; })
      .filter(function (c) { return c.label && c.items.length; });
    var n = cols.length;
    if (n < 3 || n > 4 || cols.some(function (c) { return c.items.length > 4; })) return null;
    var links = K.arr(s.links || s.arrows, n).map(function (l) { return clean(typeof l === 'object' ? (l && (l.label || l.text)) : l); });
    var els = [];
    var top = K.header(els, s) + 4;
    var take = clean(s.takeaway), takeH = take ? 24 : 0;
    var aw = n === 4 ? 44 : 60, cw = (CW - aw * (n - 1)) / n, avail = BOTTOM - top - takeH;
    var stacked = cw < 170;                                             // narrow columns: the icon sits above the words
    var tw = stacked ? cw - 28 : cw - 16 - 36;
    var maxItems = maxOf(cols, function (c) { return c.items.length; });
    var gapY = 8, labH = 22;
    var nodeNeed = maxOf(cols, function (c) { return maxOf(c.items, function (it) {
      return (stacked ? 8 + 18 + 4 : 8) + th(it.title, tw, 9.5, 500) + (it.text ? th(it.text, tw, 8.5, 400) + 2 : 0) + 8; }); });
    var nodeH = Math.max(stacked ? 0 : 40, nodeNeed);
    var need = labH + maxItems * nodeH + (maxItems - 1) * gapY + 16;
    if (need > avail) return null;
    nodeH = Math.min(nodeH * 1.3, (avail - labH - 16 - (maxItems - 1) * gapY) / maxItems);
    var colH = labH + maxItems * nodeH + (maxItems - 1) * gapY + 16;
    var y0 = top + (avail - colH) / 2;
    cols.forEach(function (c, i) {
      var x = CX + i * (cw + aw);
      K.rect(els, x, y0, cw, colH, T.bgLight);
      K.text(els, x + 8, y0 + 6, cw - 16, 14, c.label, { weight: 500, max: 9.5, min: 8.5, maxLines: 1, align: 'center', color: T.blue });
      var listH = c.items.length * nodeH + (c.items.length - 1) * gapY, ny = y0 + labH + (colH - labH - 8 - listH) / 2;
      c.items.forEach(function (it) {
        K.rect(els, x + 8, ny, cw - 16, nodeH, T.white, { color: LINE, width: 0.75 });
        var tH = th(it.title, tw, 9.5, 500) + (it.text ? th(it.text, tw, 8.5, 400) + 2 : 0);
        if (stacked) {
          var sy = ny + (nodeH - (18 + 4 + tH)) / 2;
          icon(els, it, x + cw / 2 - 9, sy, 18);
          var r1 = K.text(els, x + 14, sy + 22, tw, th(it.title, tw, 9.5, 500), it.title, { weight: 500, max: 9.5, min: 9.5, align: 'center', color: T.ink });
          if (it.text) K.text(els, x + 14, sy + 22 + r1.height + 2, tw, th(it.text, tw, 8.5, 400), it.text, { weight: 400, max: 8.5, min: 8.5, align: 'center', color: MUTED });
        } else {
          icon(els, it, x + 16, ny + (nodeH - 18) / 2, 18);
          var ty = ny + (nodeH - tH) / 2;
          var r = K.text(els, x + 42, ty, tw, th(it.title, tw, 9.5, 500), it.title, { weight: 500, max: 9.5, min: 9.5, color: T.ink });
          if (it.text) K.text(els, x + 42, ty + r.height + 2, tw, th(it.text, tw, 8.5, 400), it.text, { weight: 400, max: 8.5, min: 8.5, color: MUTED });
        }
        ny += nodeH + gapY;
      });
      if (i < n - 1) {
        var ax1 = x + cw + 4, ax2 = x + cw + aw - 4, ay = y0 + colH / 2;
        K.line(els, ax1, ay, ax2, ay, T.blue, 1.25);
        arrowHead(els, ax2, ay, 'right', T.blue);
        if (links[i]) K.text(els, ax1 - 2, ay - 30, aw - 8, 26, links[i], { weight: 400, max: 8.5, min: 8, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
      }
    });
    if (take) K.text(els, CX, BOTTOM - 16, CW, 16, take, { weight: 400, max: 9.5, min: 9, maxLines: 1, align: 'center', color: MUTED });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 3. Two regions with zones and the link between them — SQL AG p6/p7 ---------- */
  add('S66_REGION_TOPOLOGY', 'diagram', { min: 0, max: 99, needs: 'regions[{label,zones[{title,text}],detail}] (2), link, note',
    desc: 'two region panels side by side (a header bar each: primary in blue, the second in slate), 2-3 zone boxes inside each with a short detail line, the link between the regions on an arrow, and a note bar underneath (multi-region HA / DR, primary and secondary sites, hub and spoke)', words: 'zone 1-3; detail 4-12; note 20-45' }, function (s) {
    var regs = K.arr(s.regions || s.sites, 3).filter(function (r) { return r && typeof r === 'object'; })
      .map(function (r) { return { label: clean(r.label || r.title || r.name), zones: nodeItems(r.zones || r.items, 3), detail: clean(r.detail || r.text || r.footer) }; })
      .filter(function (r) { return r.label && r.zones.length; });
    if (regs.length !== 2) return null;
    var link = clean(s.link || s.connection), note = clean(s.note || s.takeaway);
    var els = [];
    var top = K.header(els, s) + 4;
    var noteH = note ? Math.max(34, th(note, CW - 34, 9, 400) + 16) : 0;
    var lw = link ? 92 : 30, pw = (CW - lw) / 2, avail = BOTTOM - top - (noteH ? noteH + 12 : 0);
    var zoneH = 52, barH = 24, pad = 10;
    var detailH = maxOf(regs, function (r) { return r.detail ? th(r.detail, pw - 2 * pad, 9, 400) + 8 : 0; });
    var ph = barH + pad + zoneH + 10 + detailH + pad;
    if (ph > avail) return null;
    ph = Math.min(avail, Math.max(ph, avail * 0.8));
    zoneH = ph - barH - 2 * pad - 10 - detailH;
    regs.forEach(function (r, k) {
      var x = CX + k * (pw + lw);
      K.rect(els, x, top, pw, ph, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, top, pw, barH, k === 0 ? T.blue : '#7E93A6');
      K.text(els, x + 8, top, pw - 16, barH, r.label, { weight: 500, max: 9.5, min: 8.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var nz = r.zones.length, zg = 8, zw = (pw - 2 * pad - zg * (nz - 1)) / nz;
      r.zones.forEach(function (z, j) {
        var zx = x + pad + j * (zw + zg), zy = top + barH + pad;
        K.rect(els, zx, zy, zw, zoneH, j === 0 && k === 0 ? '#C7D3DD' : T.bgLight);
        var tH = th(z.title, zw - 12, 10, 500) + (z.text ? th(z.text, zw - 12, 8.5, 400) + 4 : 0);
        var ty = zy + Math.max(6, (zoneH - tH) / 2);
        var tr = K.text(els, zx + 6, ty, zw - 12, 14, z.title, { weight: 500, max: 10, min: 9, maxLines: 2, align: 'center', color: T.ink });
        if (z.text) K.text(els, zx + 6, ty + tr.height + 4, zw - 12, 12, z.text, { weight: 400, max: 8.5, min: 8, maxLines: 3, align: 'center', color: MUTED });
      });
      if (r.detail) K.text(els, x + pad, top + ph - pad - detailH + 4, pw - 2 * pad, detailH, r.detail, { weight: 400, max: 9, min: 8.5, align: 'center', color: T.ink });
    });
    var ax1 = CX + pw + 4, ax2 = CX + pw + lw - 4, ay = top + barH + pad + zoneH / 2;
    K.dashedLine(els, ax1, ay, ax2, ay, T.ink, 1, 4, 3);
    arrowHead(els, ax2, ay, 'right', T.ink);
    if (link) K.text(els, ax1, ay - 30, lw - 8, 26, link, { weight: 500, max: 8.5, min: 8, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
    if (note) {
      var ny = BOTTOM - noteH;
      K.rect(els, CX, ny, CW, noteH, T.white, { color: LINE, width: 0.75 });
      K.rect(els, CX, ny, 4, noteH, T.blue);
      K.text(els, CX + 16, ny + 8, CW - 28, noteH - 16, note, { weight: 400, max: 9, min: 8.5, valign: 'middle', color: T.ink });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 4. Stacked layers of boxes with their labels on the right — ADF tech foundation ---------- */
  add('S66_LAYER_STACK', 'diagram', { min: 0, max: 99, needs: 'layers[{label,items[]}] (3-6 layers, 2-6 short items each)',
    desc: 'a stack of 3-6 horizontal layers (top layer first), each a band of small boxes naming its parts, with the layer name on the right (a platform stack, deployment layers, security layers, the scaffolding of a solution)', words: 'item 1-4; label 1-4' }, function (s) {
    var layers = K.arr(s.layers || s.tiers, 7).filter(function (l) { return l && typeof l === 'object'; }).map(function (l) {
      return { label: clean(l.label || l.title || l.name), items: K.arr(l.items || l.parts || l.points, 7).map(function (x) { return clean(typeof x === 'object' ? (x && (x.title || x.text)) : x); }).filter(real) };
    }).filter(function (l) { return l.label && l.items.length; });
    var n = layers.length;
    if (n < 3 || n > 6 || layers.some(function (l) { return l.items.length < 2 || l.items.length > 6; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var lw = 150, gap = 8, bw = CW - lw - 12, avail = BOTTOM - top;
    var h = (avail - gap * (n - 1)) / n;
    if (h < 34) return null;
    h = Math.min(h, 62);
    var y0 = top + (avail - (h * n + gap * (n - 1))) / 2;
    // V.1_55 (deck 26 slide 23 was blank): every box is measured before anything is drawn
    var fits = layers.every(function (l) { var m = l.items.length, iw0 = (bw - 16 - 6 * (m - 1)) / m; return l.items.every(function (t) { return th(t, iw0 - 8, 9, 400) <= h - 14; }); });
    if (!fits) return null;
    layers.forEach(function (l, i) {
      var y = y0 + i * (h + gap), m = l.items.length, ig = 6;
      K.rect(els, CX, y, bw, h, i % 2 ? T.bgLight : '#E9EEF3', { color: LINE, width: 0.5 });
      var iw = (bw - 16 - ig * (m - 1)) / m;
      l.items.forEach(function (t, j) {
        var x = CX + 8 + j * (iw + ig);
        K.rect(els, x, y + 7, iw, h - 14, T.white, { color: LINE, width: 0.5 });
        K.text(els, x + 4, y + 7, iw - 8, h - 14, t, { weight: 400, max: 9, min: 8, align: 'center', valign: 'middle', color: T.ink });
      });
      K.rect(els, CX + bw + 12, y, lw, h, T.blue);
      K.text(els, CX + bw + 20, y, lw - 16, h, l.label, { weight: 500, max: 10, min: 9, maxLines: 3, align: 'center', valign: 'middle', color: T.white });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 5. Problem, solution and the code that does it — SQL Server playbook p7 / p12 ---------- */
  add('S66_CODE_PROBLEM_SOLUTION', 'comparison', { min: 0, max: 99, needs: 'code (the commands, 2-12 lines), problem{title,points[]}, solution{title,text}, note',
    desc: 'the problem before (box with a blue rule and bullets) and the solution (box with a short explanation) on the left, the exact commands or settings in a dark code block on the right, an optional note underneath (a new setting, a configuration change, a fix with its script)', words: 'points 5-12; text 25-50' }, function (s) {
    var code = (Array.isArray(s.code) ? s.code.join('\n') : String(s.code || s.script || '')).replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l, i, a) { return l || (i > 0 && i < a.length - 1); });
    if (code.length < 2 || code.length > 14) return null;
    var pb = s.problem && typeof s.problem === 'object' ? s.problem : {}, so = s.solution && typeof s.solution === 'object' ? s.solution : {};
    var prob = { title: clean(pb.title || pb.label || 'The problem'), points: K.arr(pb.points || pb.items, 6).map(K.str).map(clean).filter(real) };
    var sol = { title: clean(so.title || so.label || 'The solution'), text: clean(so.text || (so.points || []).join(' ')) };
    if (prob.points.length < 2 || !real(sol.text)) return null;
    var note = clean(s.note || s.takeaway);
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 14, lw = CW * 0.5 - gap / 2, rw = CW - lw - gap, pad = 12, iw = lw - 2 * pad - 4;
    var noteH = note ? th(note, CW, 8.5, 400) + 8 : 0, avail = BOTTOM - top - noteH;
    var pH = pad + lh(TSZ.heading) + 6 + ptsH(prob.points, iw, TSZ.body, 4) + pad;
    var sH = pad + lh(TSZ.heading) + 6 + th(sol.text, iw, TSZ.body) + pad;
    if (pH + sH + 10 > avail) return null;
    var lineH = 13, codeH = code.length * lineH + 24;
    if (codeH > avail) return null;
    K.rect(els, CX, top, lw, pH, T.white, { color: LINE, width: 0.75 });
    K.rect(els, CX, top, 4, pH, T.blue);
    heading(els, CX + pad + 4, top + pad, iw, prob.title, T.ink, 1);
    bullets(els, CX + pad + 4, top + pad + lh(TSZ.heading) + 6, iw, pH - 2 * pad - lh(TSZ.heading) - 6, prob.points, 4);
    var sy = top + pH + 10, sh = Math.max(sH, avail - pH - 10);
    K.rect(els, CX, sy, lw, sh, T.white, { color: LINE, width: 0.75 });
    K.rect(els, CX, sy, 4, sh, T.blue);
    heading(els, CX + pad + 4, sy + pad, iw, sol.title, T.blue, 1);
    body(els, CX + pad + 4, sy + pad + lh(TSZ.heading) + 6, iw, sh - 2 * pad - lh(TSZ.heading) - 6, sol.text);
    var rx = CX + lw + gap, ch = Math.min(avail, Math.max(codeH, avail * 0.6));
    K.rect(els, rx, top, rw, ch, '#0B1328');
    var maxChars = Math.floor((rw - 24) / (8.5 * 0.6));
    if (code.some(function (l) { return l.length > maxChars * 1.6; })) return null;
    code.forEach(function (l, i) {
      K.text(els, rx + 12, top + 12 + i * lineH, rw - 24, lineH, l, { font: 'mono', weight: 400, max: 8.5, min: 7, maxLines: 1, color: /^\s*(--|#|\/\/)/.test(l) ? '#7F8BA6' : '#9CC0FF' });
    });
    if (note) K.text(els, CX, BOTTOM - noteH + 4, CW, noteH, note, { weight: 400, max: 8.5, min: 8, color: MUTED });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 6. A table with notes or tips underneath — SQL Server playbook p8 (storage strategy) ---------- */
  add('S66_TABLE_NOTES', 'table', { min: 2, max: 6, needs: 'columns[], rows[[...]] (2-6 rows, 2-6 columns), tips[{title,points[]}] (1-2 note panels)',
    desc: 'a blue-header table (settings, sizes, options) and 1-2 note panels under it with a heading and short points (why, what to watch, the backup strategy)', words: 'cells 1-8; points 4-12' }, function (s) {
    var tb = tableOf(s, 6, 6);
    var panels = K.arr(s.tips || s.callouts, 3).filter(function (p) { return p && typeof p === 'object'; })
      .map(function (p) { return { title: clean(p.title || p.label), points: K.arr(p.points || p.items, 5).map(K.str).map(clean).filter(real) }; })
      .filter(function (p) { return p.title && p.points.length; });
    if (!tb || !panels.length || panels.length > 2) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var ws = colWidths(tb, CW, 70), headH = 22, pad = 6;
    var rowH = tb.rows.map(function (r) { return Math.max(20, maxOf(r, function (c, j) { return th(c, ws[j] - 2 * pad, 9, j === 0 ? 500 : 400); }) + 8); });
    var tH = headH + rowH.reduce(function (a, b) { return a + b; }, 0);
    var gap = 12, pw = (CW - gap * (panels.length - 1)) / panels.length;
    var pH = maxOf(panels, function (p) { return 10 + lh(TSZ.heading) + 6 + ptsH(p.points, pw - 24, 9, 3) + 10; });
    if (tH + 14 + pH > BOTTOM - top) return null;
    var xs = [CX]; ws.forEach(function (w, j) { xs.push(xs[j] + w); });
    tb.cols.forEach(function (c, j) {
      K.rect(els, xs[j] + 1, top, ws[j] - 2, headH, T.blue);
      K.text(els, xs[j] + pad, top, ws[j] - 2 * pad, headH, c, { weight: 500, max: 9, min: 8, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
    });
    var y = top + headH;
    tb.rows.forEach(function (r, i) {
      r.forEach(function (c, j) { K.text(els, xs[j] + pad, y, ws[j] - 2 * pad, rowH[i], c, { weight: j === 0 ? 500 : 400, max: 9, min: 8, maxLines: 3, align: j ? 'center' : 'left', valign: 'middle', color: j === 0 ? T.blue : T.ink }); });
      K.line(els, CX, y + rowH[i], CX + CW, y + rowH[i], LINE, 0.75);
      y += rowH[i];
    });
    var py = y + 14, ph = Math.min(BOTTOM - py, Math.max(pH, (BOTTOM - py) * 0.75));
    panels.forEach(function (p, k) {
      var x = CX + k * (pw + gap);
      K.rect(els, x, py, pw, ph, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, py, 4, ph, k ? '#7E93A6' : T.blue);
      heading(els, x + 14, py + 10, pw - 24, p.title, T.ink, 1);
      K.bulletList(els, x + 14, py + 10 + lh(TSZ.heading) + 6, pw - 24, ph - 26 - lh(TSZ.heading), p.points, { max: 9, min: 9, gap: 3, color: T.ink, bullet: T.ink });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 7. Priority table (P1-P4): what it means, response, resolution — Managed Services p? (SLO breakdown) ---------- */
  add('S66_PRIORITY_TABLE', 'table', { min: 3, max: 5, needs: 'rows[{level,points[],response,resolution}] (3-5)',
    desc: 'a priority table: the level (P1-P4) on the left, 2-4 short points on what it means, the response time and the resolution goal (support SLOs, incident priorities, service levels; only times the request gives)', words: 'points 4-12; times 1-6' }, function (s) {
    var rows = K.arr(s.rows || s.items, 6).filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r); }).map(function (r) {
      return { level: clean(r.level || r.priority || r.title || r.label), points: K.arr(r.points || r.meaning, 5).map(K.str).map(clean).filter(real), response: clean(r.response), resolution: clean(r.resolution || r.goal) };
    }).filter(function (r) { return r.level && r.points.length && (r.response || r.resolution); });
    var n = rows.length;
    if (n < 3 || n > 5) return null;
    var cols = K.arr(s.columns, 4).map(cellText);
    if (cols.length !== 4) cols = ['Priority', 'What it means', 'Response', 'Resolution goal'];
    var els = [];
    var top = K.header(els, s) + 2;
    var w0 = 70, w2 = 120, w3 = 120, w1 = CW - w0 - w2 - w3, headH = 22, pad = 8;
    var rowH = rows.map(function (r) { return Math.max(34, ptsH(r.points, w1 - 2 * pad, 8.5, 2) + 12, th(r.response, w2 - 2 * pad, 9, 500) + 12); });
    var total = headH + rowH.reduce(function (a, b) { return a + b; }, 0) + 4 * n;
    if (total > BOTTOM - top) return null;
    var k = Math.min(1.5, (BOTTOM - top - headH - 4 * n) / (total - headH - 4 * n));
    var xs = [CX, CX + w0, CX + w0 + w1, CX + w0 + w1 + w2], ws = [w0, w1, w2, w3];
    cols.forEach(function (c, j) {
      K.rect(els, xs[j] + 1, top, ws[j] - 2, headH, T.blue);
      K.text(els, xs[j] + pad, top, ws[j] - 2 * pad, headH, c, { weight: 500, max: 9, min: 8, maxLines: 1, valign: 'middle', color: T.white });
    });
    var y = top + headH + 4;
    rows.forEach(function (r, i) {
      var h = rowH[i] * k;
      K.rect(els, CX, y, CW, h, T.white, { color: LINE, width: 0.5 });
      K.text(els, xs[0] + pad, y, w0 - 2 * pad, h, r.level, { weight: 500, max: 11, min: 10, maxLines: 1, valign: 'middle', color: T.ink });
      K.bulletList(els, xs[1] + pad, y + 6, w1 - 2 * pad, h - 12, r.points, { max: 8.5, min: 8, gap: 2, color: T.ink, bullet: T.ink });
      K.text(els, xs[2] + pad, y, w2 - 2 * pad, h, r.response, { weight: 500, max: 9, min: 8.5, maxLines: 3, valign: 'middle', color: T.ink });
      K.text(els, xs[3] + pad, y, w3 - 2 * pad, h, r.resolution, { weight: 500, max: 9, min: 8.5, maxLines: 3, valign: 'middle', color: T.ink });
      y += h + 4;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 8. Issue rows: status mark, the issue, the fix on the right — SQL playbook p15 (day-2 runbooks) ---------- */
  add('S66_ISSUE_ROWS', 'cards', { min: 3, max: 7, needs: 'items[{title,fix,status}] (3-7)',
    desc: '3-7 rows, each a white bar: a round status mark (amber for a warning, grey for minor), the issue on the left and the fix or runbook on the right in blue (known issues and their fixes, day-2 runbooks, risks with their mitigation)', words: 'issue 4-10; fix 6-18' }, function (s) {
    // V.1_55 (deck 26: roadmap phases drawn as issues): the rows are issues with fixes - an explicit fix field, or a slide about
    // risks, issues or runbooks whose item text is the fix
    var issueSlide = /\b(risks?|issues?|runbooks?|run book|troubleshoot\w*|problems?|fix\w*|incidents?|failures?|known)\b/i.test(String(s.title || '') + ' ' + String(s.lead || ''));
    var rows = K.items(s, 8).map(function (it) {
      it = it || {};
      return { title: clean(it.title || it.issue || it.risk), fix: clean(it.fix || it.action || it.mitigation || it.resolution || (issueSlide ? it.text : '')), status: clean(it.status || it.level || it.severity || it.priority).toLowerCase(), icon: it.icon || '', material: it.material || '' };
    }).filter(function (r) { return r.title && real(r.fix); });
    var n = rows.length;
    if (n < 3 || n > 7) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var take = clean(s.takeaway), takeH = take ? 20 : 0;
    var gap = 7, lw = CW * 0.42, rw = CW - lw - 52, avail = BOTTOM - top - takeH;
    // V.1_54 (deck 25): a fix is one or two short sentences; a long paragraph keeps its first sentence
    rows.forEach(function (r) { if (th(r.fix, rw, 9, 400) > 3 * lh(9) + 1) r.fix = (r.fix.match(/^.+?[.;](?=\s|$)/) || [r.fix])[0].replace(/;$/, ''); });
    if (rows.some(function (r) { return th(r.fix, rw, 9, 400) > 3 * lh(9) + 1; })) return null;
    var hs = rows.map(function (r) { return Math.max(30, Math.max(th(r.title, lw - 12, 9.5, 500), th(r.fix, rw, 9, 400)) + 14); });
    var total = hs.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1);
    if (total > avail) return null;
    var k = Math.min(2, avail * 0.97 / total), y = top;                 // V.1_58: the rows fill the slide
    // V.1_58 (deck 31 slide 17: "i" and "!" marks on runbooks that have no status): a status mark only when the rows
    // carry a status or severity; otherwise each row has the icon of its subject. The fix reads in body colour.
    var hasStatus = rows.some(function (r) { return r.status; });
    rows.forEach(function (r, i) {
      var h = hs[i] * k, warn = !/low|minor|info|grey|gray|ok/.test(r.status);
      K.roundrect(els, CX, y, CW, h, T.white, { color: LINE, width: 0.75 });
      if (hasStatus) {
        K.ellipse(els, CX + 12, y + h / 2 - 8, 16, 16, warn ? '#F2A33A' : '#9AA6B2');
        K.text(els, CX + 12, y + h / 2 - 8, 16, 16, warn ? '!' : 'i', { weight: 500, max: 9, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      } else {
        K.ellipse(els, CX + 8, y + h / 2 - 12, 24, 24, TINT);
        K.icon(els, (r.icon || r.material) ? { icon: r.icon, material: r.material } : { icon: (r.title + ' ' + r.fix).toLowerCase().slice(0, 160), title: r.title }, CX + 13, y + h / 2 - 7, 14, false);
      }
      K.text(els, CX + 38, y, lw - 12, h, r.title, { weight: 500, max: 9.5, min: 9, valign: 'middle', color: T.ink });
      K.text(els, CX + 38 + lw, y, rw, h, r.fix, { weight: 400, max: 9, min: 8.5, valign: 'middle', color: T.ink });
      y += h + gap;
    });
    if (take) K.text(els, CX, BOTTOM - 14, CW, 14, take, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: 'center', color: MUTED });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 9. Two ways compared row by row in labelled boxes — Managed Services p? (traditional vs agentic) ---------- */
  add('S66_TWO_MODE_COMPARE', 'comparison', { min: 3, max: 6, needs: 'rows[{label,left,right}] (3-6), columns[2] (the two ways)',
    desc: 'two ways compared row by row: the aspect on the left, the old way in a grey box and the new way in a blue box on each row, the two ways named above the columns (traditional vs new, today vs with the solution)', words: 'label 1-3; boxes 2-8' }, function (s) {
    var rows = K.arr(s.rows, 7).filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r); })
      .map(function (r) { return { label: clean(r.label || r.aspect || r.title), left: clean(r.left || r.before || r.old), right: clean(r.right || r.after || r.new) }; })
      .filter(function (r) { return r.label && r.left && r.right; });
    var n = rows.length;
    var cols = K.arr(s.columns || s.modes, 3).map(cellText).filter(Boolean);
    // V.1_57 (deck 30: "Manual crane inspections vs predicted alerts" lost its two columns): the two ways come from
    // the column names, else from the "A vs B" title, else today / proposed
    if (cols.length === 3) cols = cols.slice(1);
    if (cols.length !== 2) {
      var vs = String(s.title || '').split(/\s+(?:vs\.?|versus)\s+/i);
      cols = vs.length === 2 ? vs.map(function (x) { var t = x.trim(); return t.charAt(0).toUpperCase() + t.slice(1); }) : ['Today', 'Proposed'];
    }
    if (n < 3 || n > 6 || cols.length !== 2) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var lw = 120, gap = 10, bw = Math.min(200, (CW - lw - 3 * gap) / 2), x0 = CX + (CW - (lw + gap + 2 * bw + gap)) / 2;
    var headH = 30, avail = BOTTOM - top - headH - 6;
    var bh = maxOf(rows, function (r) { return Math.max(th(r.left, bw - 16, 9.5, 400), th(r.right, bw - 16, 9.5, 400)) + 16; });
    var rg = 8;
    // V.1_57: five rows with a lead line: tighter boxes and gaps before the design gives up
    if (bh * n + rg * (n - 1) > avail) { bh -= 6; rg = 5; }
    if (bh * n + rg * (n - 1) > avail) return null;
    bh = Math.min(48, Math.max(bh, (avail - rg * (n - 1)) / n * 0.8));
    var bx1 = x0 + lw + gap, bx2 = bx1 + bw + gap;
    K.text(els, bx1, top, bw, headH, cols[0], { weight: 500, max: 10, min: 9, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
    K.text(els, bx2, top, bw, headH, cols[1], { weight: 500, max: 10, min: 9, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
    var y = top + headH + 6;
    rows.forEach(function (r) {
      K.text(els, x0, y, lw, bh, r.label, { weight: 500, max: 10, min: 9, maxLines: 2, align: 'right', valign: 'middle', color: T.ink });
      K.rect(els, bx1, y, bw, bh, '#B9C9D6');
      K.text(els, bx1 + 8, y, bw - 16, bh, r.left, { weight: 400, max: 9.5, min: 9, align: 'center', valign: 'middle', color: T.ink });
      K.rect(els, bx2, y, bw, bh, T.blue);
      K.text(els, bx2 + 8, y, bw - 16, bh, r.right, { weight: 400, max: 9.5, min: 9, align: 'center', valign: 'middle', color: T.white });
      y += bh + rg;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 10. Need -> solution -> pillar mapping table — Managed Services p? (mapping customer needs) ---------- */
  add('S66_NEED_MAPPING', 'table', { min: 4, max: 10, needs: 'rows[{need,solution,tags[]}] (4-10), columns[3]',
    desc: 'a mapping table: each customer need (with an icon) on a light cell, how it is delivered on a blue cell, and 1-2 tags for the service pillar on a dark cell (needs mapped to the solution, requirements to capabilities)', words: 'need 2-5; solution 6-16; tags 1-2' }, function (s) {
    var rows = K.arr(s.rows || s.items, 11).filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r); }).map(function (r) {
      return { need: clean(r.need || r.title || r.label), solution: clean(r.solution || r.text || r.delivery), tags: K.arr(r.tags || r.pillars, 2).map(K.str).map(clean).filter(Boolean), icon: r.icon || '' };
    }).filter(function (r) { return r.need && r.solution; });
    var n = rows.length;
    if (n < 4 || n > 10) return null;
    var cols = K.arr(s.columns, 3).map(cellText);
    if (cols.length !== 3) cols = ['Need', 'How we deliver it', 'Pillar'];
    var els = [];
    var top = K.header(els, s) + 2;
    var w0 = 190, w2 = 150, w1 = CW - w0 - w2 - 8, headH = 22, avail = BOTTOM - top - headH - 4;
    var rh = maxOf(rows, function (r) { return Math.max(th(r.need, w0 - 36, 9, 500), th(r.solution, w1 - 16, 8.5, 400)) + 8; });
    if (rh * n + 2 * (n - 1) > avail) return null;
    rh = Math.min(34, Math.max(rh, (avail - 2 * (n - 1)) / n));
    var x1 = CX + w0 + 4, x2 = x1 + w1 + 4;
    [[CX, w0, cols[0], T.blue], [x1, w1, cols[1], '#3D1E8F'], [x2, w2, cols[2], T.ink]].forEach(function (h) {
      K.rect(els, h[0], top, h[1], headH, h[3]);
      K.text(els, h[0] + 6, top, h[1] - 12, headH, h[2], { weight: 500, max: 9, min: 8, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    });
    var y = top + headH + 4;
    rows.forEach(function (r) {
      K.rect(els, CX, y, w0, rh, T.bgLight);
      icon(els, { icon: r.icon, title: r.need, text: r.solution }, CX + 8, y + (rh - 14) / 2, 14);
      K.text(els, CX + 28, y, w0 - 34, rh, r.need, { weight: 500, max: 9, min: 8.5, maxLines: 2, valign: 'middle', color: T.ink });
      K.rect(els, x1, y, w1, rh, '#3D1E8F');
      K.text(els, x1 + 8, y, w1 - 16, rh, r.solution, { weight: 400, max: 8.5, min: 8, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
      K.rect(els, x2, y, w2, rh, T.ink);
      var tx = x2 + 8;
      r.tags.forEach(function (t) { var w = chip(els, tx, y + (rh - 16) / 2, t, T.blue, T.white, (w2 - 20) / Math.max(1, r.tags.length)); tx += w + 4; });
      y += rh + 2;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. A chart with insight blocks underneath — HCA Control Tower p? (operational shocks) ---------- */
  add('S66_CHART_INSIGHT', 'chart', { min: 0, max: 99, needs: 'chart{categories[],series[{name,values[]}]}, text, items[{title,text}] (2-3)',
    desc: 'a short explanation on the left and a line chart of real data on the right, with 2-3 insight blocks underneath (the first one tinted): what the data shows and what it means (a trend with its signals, before and after)', words: 'text 20-40; blocks 15-30' }, function (s) {
    var ch = s.chart && typeof s.chart === 'object' ? s.chart : null;
    if (!ch) return null;
    var cats = K.arr(ch.categories || ch.labels, 25).map(K.str);
    var series = K.arr(ch.series, 4).filter(function (x) { return x && Array.isArray(x.values) && x.values.length === cats.length && x.values.every(function (v) { return isFinite(Number(v)); }); });
    if (cats.length < 3 || !series.length) return null;
    var items = itemsOf(s, 3);
    if (items.length < 2 || items.length > 3 || items.some(function (it) { return !linesOf(it).length; })) return null;
    var txt = clean(s.text || s.statement);
    var els = [];
    var top = K.header(els, s) + 2;
    var bH = maxOf(items, function (it) { return 12 + lh(TSZ.heading) + 6 + ptsH(linesOf(it), (CW - 24) / items.length - 24, 9, 3) + 12; });
    var chartH = BOTTOM - top - bH - 14;
    if (chartH < 110) return null;
    var tw = txt ? CW * 0.34 : 0, cx = CX + tw + (txt ? 16 : 0), cw = CW - tw - (txt ? 16 : 0);
    if (txt) { if (th(txt, tw, TSZ.body) > chartH) return null; body(els, CX, top + 10, tw, chartH - 10, txt); }
    var all = []; series.forEach(function (x) { x.values.forEach(function (v) { all.push(Number(v)); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi === lo) hi = lo + 1;
    var px0 = cx + 30, py0 = top + (series.length > 1 ? 16 : 6), pw = cw - 36, ph = chartH - (series.length > 1 ? 30 : 20);
    K.line(els, px0, py0 + ph, px0 + pw, py0 + ph, SLATE, 0.75);
    K.line(els, px0, py0, px0, py0 + ph, SLATE, 0.75);
    K.text(els, cx, py0 - 4, 28, 10, String(hi), { weight: 400, max: 7.5, min: 7, maxLines: 1, align: 'right', color: MUTED });
    K.text(els, cx, py0 + ph - 8, 28, 10, String(lo), { weight: 400, max: 7.5, min: 7, maxLines: 1, align: 'right', color: MUTED });
    var colors = [T.blue, '#7E93A6', '#3D1E8F', '#F2A33A'];
    series.forEach(function (x, si) {
      var pts = x.values.map(function (v, i) { return [px0 + pw * i / (cats.length - 1), py0 + ph - ph * (Number(v) - lo) / (hi - lo)]; });
      for (var i = 1; i < pts.length; i++) K.line(els, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], colors[si], 1.5);
      if (series.length > 1) {
        K.rect(els, cx + 30 + si * 110, top, 10, 3, colors[si]);
        K.text(els, cx + 44 + si * 110, top - 4, 92, 10, clean(x.name), { weight: 400, max: 7.5, min: 7, maxLines: 1, color: T.ink });
      }
    });
    var step = Math.max(1, Math.ceil(cats.length / 6));
    cats.forEach(function (c, i) { if (i % step === 0 || i === cats.length - 1) K.text(els, px0 + pw * i / (cats.length - 1) - 24, py0 + ph + 3, 48, 10, c, { weight: 400, max: 7.5, min: 7, maxLines: 1, align: 'center', color: MUTED }); });
    var gap = 12, bw = (CW - gap * (items.length - 1)) / items.length, by = BOTTOM - bH;
    items.forEach(function (it, i) {
      var x = CX + i * (bw + gap);
      K.rect(els, x, by, bw, bH, i === 0 ? '#DCE4EE' : T.bgLight);
      heading(els, x + 12, by + 12, bw - 24, it.title, i === 0 ? T.blue : T.ink, 2);
      K.bulletList(els, x + 12, by + 12 + lh(TSZ.heading) + 6, bw - 24, bH - 30 - lh(TSZ.heading), linesOf(it), { max: 9, min: 9, gap: 3, color: T.ink, bullet: T.ink });
    });
    return { bg: T.white, els: els, noBalance: true };
  });
})();
