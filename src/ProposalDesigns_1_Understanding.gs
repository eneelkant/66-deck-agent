/* =========================================================================================================
   66° Deck Agent — Proposal Deck design library (V.1_42), part 1: understanding, plans and tables
   Key inputs, data table, phase matrix, executive overviews, text with screenshot, checklist and open decisions,
   category legend, impact and mitigation, comparison check matrix, icon table, governance columns, elevator pitch,
   opening statement box and numbered rows.
   Every design here draws only in a Proposal Deck (ENGINE.addProposalDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addProposalDesign;
  var LINE_C = T.cardLine || '#DBDDE1';

  function lh_(size) { return K.lineHeight('sans', size); }
  function strs_(a, max) { return K.arr(a, max).map(K.str).filter(Boolean); }
  // bullet list at a fixed size (dot colour optional)
  function bullets_(els, x, y, w, points, size, gap, dot) {
    var cy = y;
    points.forEach(function (p) {
      K.ellipse(els, x + 1, cy + lh_(size) / 2 - 2.25, 4.5, 4.5, dot || T.ink);
      var r = K.text(els, x + 14, cy, w - 14, K.textH(p, w - 14, size) + 1, p, { weight: 400, max: size, min: size, color: T.ink });
      cy += r.height + gap;
    });
    return cy - y - (points.length ? gap : 0);
  }
  function bulletsNeed_(points, w, size, gap) {
    if (!points.length) return 0;
    var t = 0;
    points.forEach(function (p) { t += K.textH(p, w - 14, size) + gap; });
    return t - gap;
  }
  function check_(els, cx, cy, color) {
    K.line(els, cx - 4.5, cy + 0.2, cx - 1.2, cy + 3.6, color, 1.6);
    K.line(els, cx - 1.6, cy + 3.6, cx + 5, cy - 3.8, color, 1.6);
  }

  /* ---------- shared data table: blue header, thin row lines, first column Medium ---------- */
  function tableLayout_(columns, rows, w, maxH) {
    var nc = columns.length;
    var nat = columns.map(function (c, j) {
      var m = K.textWidth(String(c), 'sans', 500, 10);
      rows.forEach(function (r) { m = Math.max(m, K.textWidth(String(r[j] || ''), 'sans', j === 0 ? 500 : 400, 10)); });
      return Math.min(Math.max(m + 18, j === 0 ? 100 : 90), j === 0 ? 190 : 340);
    });
    var tot = nat.reduce(function (a, b) { return a + b; }, 0);
    var widths = nat.map(function (n) { return n * w / tot; });
    var sizes = [10, 9.5, 9];
    for (var k = 0; k < sizes.length; k++) {
      var sz = sizes[k];
      var hh = Math.max(24, Math.max.apply(null, columns.map(function (c, j) { return K.textH(String(c), widths[j] - 16, 10, 500); })) + 12);
      var rh = rows.map(function (r) {
        return Math.max.apply(null, columns.map(function (c, j) { return K.textH(String(r[j] || ''), widths[j] - 16, sz, j === 0 ? 500 : 400) || lh_(sz); }));
      });
      var need = hh + rh.reduce(function (a, b) { return a + b + 12; }, 0);
      if (need <= maxH) {
        var pad = Math.min(11, 6 + (maxH - need) / (2 * rows.length) * 0.6);
        return { widths: widths, size: sz, hh: hh, rh: rh, pad: pad, h: hh + rh.reduce(function (a, b) { return a + b + 2 * pad; }, 0) };
      }
    }
    return null;
  }
  function drawTable_(els, x, y, lay, columns, rows) {
    var cx = x;
    columns.forEach(function (c, j) {
      var cw = lay.widths[j];
      K.rect(els, cx + (j ? 1 : 0), y, cw - (j ? 1 : 0), lay.hh, T.blue);
      K.text(els, cx + 9, y, cw - 18, lay.hh, String(c), { weight: 500, max: 10, min: 10, color: T.white, valign: 'middle' });
      cx += cw;
    });
    var cy = y + lay.hh, totalW = lay.widths.reduce(function (a, b) { return a + b; }, 0);
    rows.forEach(function (r, i) {
      var h = lay.rh[i] + 2 * lay.pad;
      var rx = x;
      columns.forEach(function (c, j) {
        var cw = lay.widths[j];
        if (j > 0) K.line(els, rx, cy, rx, cy + h, LINE_C, 0.75);
        K.text(els, rx + 9, cy, cw - 18, h, String(r[j] || ''), { weight: j === 0 ? 500 : 400, max: lay.size, min: lay.size, color: T.ink, valign: 'middle' });
        rx += cw;
      });
      cy += h;
      K.line(els, x, cy, x + totalW, cy, LINE_C, 0.75);
    });
    return cy - y;
  }
  function tableData_(s, minC, maxC, minR, maxR) {
    var columns = K.arr(s.columns, maxC + 1).map(K.str);
    var rows = K.arr(s.rows, maxR + 1).filter(Array.isArray).map(function (r) { return r.map(function (v) { return v == null ? '' : K.str(v); }); });
    if (columns.length < minC || columns.length > maxC || rows.length < minR || rows.length > maxR) return null;
    return { columns: columns, rows: rows };
  }

  /* ---------- 1. Key inputs — proposals pages 66, 112, 71, 75 ---------- */
  add('P66_KEY_INPUTS', 'bullets', { min: 2, max: 4, needs: 'groups',
    desc: 'key inputs / open questions: grey label blocks on the left (groups[{label, points[]}], 2-4 groups, 1-6 questions each) with their questions on the right, closing sentence in a blue arrow banner (banner)', words: '6-14 per question' }, function (s) {
    var groups = K.arr(s.groups, 5).map(function (g) { return { label: K.str(g && g.label || g && g.title), points: strs_(g && (g.points || g.questions), 7) }; })
      .filter(function (g) { return g.label && g.points.length; });
    if (groups.length < 2 || groups.length > 4) return null;
    if (groups.some(function (g) { return g.points.length > 6; })) return null;
    var els = [];
    var top = K.header(els, s);
    var banner = K.str(s.banner || s.takeaway);
    var bh = banner ? (K.textH(banner, 520, 11, 500) > lh_(11) * 1.5 ? 42 : 32) : 0;
    var avail = BOTTOM - top - (banner ? bh + 14 : 0);
    var labelW = 150, x2 = X0 + labelW, bw = CW - labelW - 32, size = 0, gap = 3.5, needs;
    [10, 9.5, 9].some(function (sz) {
      needs = groups.map(function (g) { return bulletsNeed_(g.points, bw, sz, gap); });
      var tot = needs.reduce(function (a, b) { return a + b + 18 + 4; }, -4);
      if (tot <= avail) { size = sz; return true; }
      return false;
    });
    if (!size) return null;
    var total = needs.reduce(function (a, b) { return a + b + 18 + 4; }, -4);
    var pad = Math.min(22, 9 + (avail - total) / (2 * groups.length) * 0.5);
    var y = top;
    groups.forEach(function (g, i) {
      var h = needs[i] + 2 * pad;
      K.rect(els, X0, y, labelW - 4, h, T.bgLight);
      K.text(els, X0 + 12, y, labelW - 28, h, g.label, { weight: 500, max: TSZ.heading, min: 10, maxLines: 3, color: T.blue, align: 'left', valign: 'middle' });
      bullets_(els, x2 + 16, y + pad, bw, g.points, size, gap);
      K.line(els, x2, y + h, X0 + CW, y + h, LINE_C, 0.75);
      if (i === 0) K.line(els, x2, y, X0 + CW, y, LINE_C, 0.75);
      y += h + (i < groups.length - 1 ? 4 : 0);
    });
    if (banner) {
      y += 14;
      K.rect(els, X0, y, CW - 100, bh, T.blue);
      K.shape(els, 'HOME_PLATE', X0 + CW - 130, y, 130, bh, T.blue);
      K.text(els, X0 + 24, y, CW - 90, bh, banner, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, color: T.white, align: 'center', valign: 'middle' });
    }
    return { bg: T.white, els: els };
  });

  /* ---------- 2. Data table — proposals pages 5, 14, 67, 70, 86, 103, 297 ---------- */
  add('P66_TABLE', 'table', { min: 2, max: 8, desc: 'data table: blue header row, thin row lines, first column is the row heading (columns[] 2-5, rows[][] 2-8)', words: '3-14 per cell' }, function (s) {
    var d = tableData_(s, 2, 5, 2, 8);
    if (!d) return null;
    var els = [];
    var top = K.header(els, s);
    var lay = tableLayout_(d.columns, d.rows, CW, BOTTOM - top);
    if (!lay) return null;
    drawTable_(els, X0, top, lay, d.columns, d.rows);
    return { bg: T.white, els: els };
  });

  /* ---------- 3. Phase matrix — proposals pages 237, 137, 231, 239 ---------- */
  add('P66_PHASE_MATRIX', 'timeline', { min: 2, max: 4, needs: 'workstreams',
    desc: 'dense plan matrix: periods across the top (periods[] 3-5, blue header), workstreams down the side (workstreams[{name, cells[[lines]]}] 2-4), 2-4 short lines per cell (a cell may be {title, points[]})', words: '2-6 per line' }, function (s) {
    var periods = strs_(s.periods || s.columns, 6);
    var ws = K.arr(s.workstreams, 5).map(function (w) {
      return { name: K.str(w && (w.name || w.title)), cells: K.arr(w && w.cells, 6).map(function (c) {
        if (Array.isArray(c)) return { title: '', points: strs_(c, 5) };
        if (c && typeof c === 'object') return { title: K.str(c.title), points: strs_(c.points, 5) };
        return { title: '', points: c ? [String(c)] : [] };
      }) };
    }).filter(function (w) { return w.name; });
    if (periods.length < 3 || periods.length > 5 || ws.length < 2 || ws.length > 4) return null;
    var els = [];
    var top = K.header(els, s);
    var labW = 104, gap = 3, n = periods.length;
    var cw = (CW - labW - gap * n) / n, hh = 22;
    var avail = BOTTOM - top - hh - gap;
    var size = 0, rowNeed;
    [9.5, 9].some(function (sz) {
      rowNeed = ws.map(function (w) {
        var m = K.textH(w.name, labW - 16, 10.5, 500);
        for (var j = 0; j < n; j++) {
          var c = w.cells[j] || { title: '', points: [] };
          var hgt = (c.title ? K.textH(c.title, cw - 14, sz, 500) + 3 : 0) + bulletsNeed_(c.points, cw - 12, sz, 2.5);
          m = Math.max(m, hgt);
        }
        return m;
      });
      if (rowNeed.reduce(function (a, b) { return a + b + 12 + gap; }, 0) <= avail) { size = sz; return true; }
      return false;
    });
    if (!size) return null;
    var total = rowNeed.reduce(function (a, b) { return a + b + 12 + gap; }, 0);
    var pad = Math.min(14, 6 + (avail - total) / (2 * ws.length) * 0.6);
    // header row
    periods.forEach(function (p, j) {
      var x = X0 + labW + gap + j * (cw + gap);
      K.rect(els, x, top, cw, hh, T.blue);
      K.text(els, x + 6, top, cw - 12, hh, p, { weight: 500, max: 10, min: 9, maxLines: 1, color: T.white, align: 'center', valign: 'middle' });
    });
    var y = top + hh + gap;
    ws.forEach(function (w, i) {
      var h = rowNeed[i] + 2 * pad;
      K.rect(els, X0, y, labW, h, T.slate);
      K.text(els, X0 + 8, y, labW - 16, h, w.name, { weight: 500, max: 10.5, min: 9, maxLines: 3, color: T.ink, align: 'center', valign: 'middle' });
      for (var j = 0; j < n; j++) {
        var x = X0 + labW + gap + j * (cw + gap), c = w.cells[j] || { title: '', points: [] };
        K.rect(els, x, y, cw, h, T.bgLight);
        var cy = y + pad;
        if (c.title) { var r = K.text(els, x + 7, cy, cw - 14, K.textH(c.title, cw - 14, size, 500) + 1, c.title, { weight: 500, max: size, min: size, color: T.ink }); cy += r.height + 3; }
        cy += 0;
        c.points.forEach(function (p) {
          K.ellipse(els, x + 8, cy + lh_(size) / 2 - 1.5, 3, 3, T.blue);
          var rr = K.text(els, x + 15, cy, cw - 20, K.textH(p, cw - 20, size) + 1, p, { weight: 400, max: size, min: size, color: T.ink });
          cy += rr.height + 2.5;
        });
      }
      y += h + gap;
    });
    return { bg: T.white, els: els };
  });

  /* ---------- 4. Executive overview, two columns — proposals pages 133, 134, 135 ---------- */
  add('P66_EXEC_TWO_COL', 'statement', { min: 3, max: 4,
    desc: 'executive overview: left = summary paragraph (text), the high-level ask (ask) and a framed key message (statement); right = 3-4 numbered blocks (items[{title, text}])', words: '15-30 per block, 40-70 summary' }, function (s) {
    var items = K.items(s, 5).filter(function (it) { return it.title; });
    if (items.length < 3 || items.length > 4) return null;
    var summary = K.str(s.text), ask = K.str(s.ask), st = K.str(s.statement);
    if (!summary && !ask) return null;
    var els = [];
    var top = K.header(els, s);
    var lw = 284, rx = X0 + lw + 22, rw = X0 + CW - rx;
    // right column: numbered blocks
    var rh = 22, bodyW = rw - 54, bg = 6, tsz = 0, needs;
    var avail = BOTTOM - top - rh - bg * (items.length - 1);
    [10, 9.5].some(function (sz) {
      needs = items.map(function (it) { return K.textH(it.title, bodyW, 11, 500) + 2 + K.textH(it.text, bodyW, sz); });
      if (needs.reduce(function (a, b) { return a + b + 14; }, 0) <= avail) { tsz = sz; return true; } return false;
    });
    if (!tsz) return null;
    var tot = needs.reduce(function (a, b) { return a + b + 14; }, 0);
    var pad = Math.min(12, 7 + (avail - tot) / (2 * items.length) * 0.5);
    K.text(els, rx, top, rw, 16, s.rightLabel || 'Bottom line up front', { weight: 500, max: 11, min: 11, maxLines: 1, color: T.blue });
    var y = top + rh;
    items.forEach(function (it, i) {
      var h = needs[i] + 2 * pad;
      K.rect(els, rx, y, rw, h, T.white, { color: LINE_C, width: 0.75 });
      K.rect(els, rx, y, 3, h, T.slate);
      K.ring(els, rx + 14, y + h / 2 - 11, 22, T.bgLight, T.slate, 0.75);
      K.text(els, rx + 14, y + h / 2 - 11, 22, 22, String(i + 1), { font: 'mono', weight: 500, max: 11, min: 11, maxLines: 1, color: T.blue, align: 'center', valign: 'middle' });
      var t = K.text(els, rx + 46, y + pad, bodyW, K.textH(it.title, bodyW, 11, 500) + 1, it.title, { weight: 500, max: 11, min: 11, color: T.ink });
      K.text(els, rx + 46, y + pad + t.height + 2, bodyW, K.textH(it.text, bodyW, tsz) + 1, it.text, { weight: 400, max: tsz, min: tsz, color: T.ink });
      y += h + bg;
    });
    var rightEnd = y - bg;
    // left column
    var ly = top;
    if (summary) { var a = K.text(els, X0, ly, lw, 120, summary, { weight: 400, max: 10, min: 10, maxLines: 9, color: T.ink }); ly += a.height + 14; }
    if (ask) {
      K.text(els, X0, ly, lw, 16, s.askLabel || 'The high-level ask', { weight: 500, max: 11, min: 11, maxLines: 1, color: T.blue });
      ly += 20;
      var b = K.text(els, X0, ly, lw, 100, ask, { weight: 400, max: 10, min: 10, maxLines: 7, color: T.ink });
      ly += b.height + 16;
    }
    if (st) {
      var sh = K.textH(st, lw - 44, 12, 500) + 32;
      var by = Math.max(ly, rightEnd - sh);
      if (by + sh > BOTTOM) return null;
      K.rect(els, X0, by, lw, sh, T.bgLight);
      K.rect(els, X0, by, 4, sh, T.blue);
      K.text(els, X0 + 22, by, lw - 40, sh, st, { weight: 500, max: 12, min: 11, color: T.ink, align: 'center', valign: 'middle' });
    } else if (ly > BOTTOM + 14) return null;
    return { bg: T.white, els: els };
  });

  /* ---------- 5. Text with a screenshot — proposals pages 248, 247, 51, 73 ---------- */
  add('P66_TEXT_SCREENSHOT', 'bullets', { min: 2, max: 4,
    desc: 'feature explained next to a product screenshot, ONLY when the user supplied the screenshot (screenshot: true): heading card (label = small caption, heading, icon) and 2-4 bullets (points[]) on the left, framed screenshot on the right (imageLabel names the screen)', words: '10-20 per bullet' }, function (s) {
    if (!s.screenshot) return null;                 // V.1_42: never an empty screenshot frame in a real deck
    var first = (K.items(s, 1)[0]) || {};
    var heading = K.str(s.heading || first.title), cap = K.str(s.label || first.label);
    var pts = strs_(s.points && s.points.length ? s.points : first.points, 5);
    if (pts.length < 2 || pts.length > 4 || !heading) return null;
    var els = [];
    var top = K.header(els, s);
    var lw = 236, y = top;
    // heading card
    var hh = 58;
    K.rect(els, X0, y, lw, hh, T.bgLight);
    K.ellipse(els, X0 + 12, y + hh / 2 - 17, 34, 34, T.blue);
    K.icon(els, { icon: s.icon || first.icon || heading }, X0 + 20, y + hh / 2 - 9, 18, true);
    if (cap) K.text(els, X0 + 56, y + 10, lw - 66, 14, cap, { weight: 400, max: 9, min: 9, maxLines: 1, color: T.ink });
    K.text(els, X0 + 56, y + (cap ? 23 : 0), lw - 66, cap ? 24 : hh, heading, { weight: 500, max: 15, min: 12, maxLines: 1, color: T.ink, valign: cap ? 'top' : 'middle' });
    y += hh + 6;
    var bh = BOTTOM - y, need = 0, size = 0;
    [11, 10.5, 10].some(function (sz) { need = bulletsNeed_(pts, lw - 32, sz, 9); if (need <= bh - 32) { size = sz; return true; } return false; });
    if (!size) return null;
    K.rect(els, X0, y, lw, bh, T.bgLight);
    bullets_(els, X0 + 16, y + Math.max(18, (bh - need) / 2 - 6), lw - 32, pts, size, 9);
    // screenshot frame
    var fx = X0 + lw + 18, fw = X0 + CW - fx, fy = top, fh = BOTTOM - top;
    K.roundrect(els, fx, fy, fw, fh, T.white, { color: LINE_C, width: 0.75 });
    K.rect(els, fx + 10, fy + 10, fw - 20, 20, T.bgLight);
    [0, 1, 2].forEach(function (k) { K.ellipse(els, fx + 18 + k * 10, fy + 17, 6, 6, T.slate); });
    K.rect(els, fx + 10, fy + 34, 92, fh - 44, T.bgLight);
    K.rect(els, fx + 106, fy + 34, fw - 116, fh - 44, '#F8F7F5', { color: LINE_C, width: 0.5 });
    var mx = fx + 106 + (fw - 116) / 2, my = fy + 34 + (fh - 44) / 2;
    K.text(els, mx - 120, my - 16, 240, 18, 'Screenshot', { weight: 500, max: 12, min: 12, maxLines: 1, color: T.ink, align: 'center' });
    if (s.imageLabel) K.text(els, mx - 130, my + 4, 260, 16, s.imageLabel, { weight: 400, max: 10, min: 9, maxLines: 1, color: T.ink, align: 'center' });
    [0, 1, 2, 3].forEach(function (k) { K.rect(els, fx + 20, fy + 48 + k * 16, 60 - (k % 2) * 16, 6, '#E3E2DF'); });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 6. Checklist and open decisions — proposals page 26 ---------- */
  add('P66_CHECKLIST_DECISIONS', 'comparison', { min: 2, max: 6,
    desc: 'cutover checklist and open decisions side by side: left{label, points[]} numbered steps (3-6), right{label, points[]} open decisions with an icon (2-5)', words: '8-20 per point' }, function (s) {
    var L = s.left || {}, R = s.right || {};
    var lp = strs_(L.points, 7), rp = strs_(R.points, 6);
    if (lp.length < 3 || lp.length > 6 || rp.length < 2 || rp.length > 5) return null;
    var els = [];
    var top = K.header(els, s);
    var gap = 16, lw = 360, rw = CW - lw - gap, rx = X0 + lw + gap, hh = 30;
    var avail = BOTTOM - top - hh - 28;
    var lsz = 0, rsz = 0, ln, rn;
    [10, 9.5, 9].some(function (sz) {
      ln = lp.map(function (p) { return K.textH(p, lw - 64, sz); });
      if (ln.reduce(function (a, b) { return a + b + 10; }, -10) <= avail) { lsz = sz; return true; } return false;
    });
    [10, 9.5, 9].some(function (sz) {
      rn = rp.map(function (p) { return Math.max(26, K.textH(p, rw - 66, sz)); });
      if (rn.reduce(function (a, b) { return a + b + 10; }, -10) <= avail) { rsz = sz; return true; } return false;
    });
    if (!lsz || !rsz) return null;
    var lt = ln.reduce(function (a, b) { return a + b; }, 0), rt = rn.reduce(function (a, b) { return a + b; }, 0);
    var lgap = Math.min(14, (avail - lt) / Math.max(1, lp.length - 1)), rgap = Math.min(16, (avail - rt) / Math.max(1, rp.length - 1));
    var bodyH = Math.max(lt + lgap * (lp.length - 1), rt + rgap * (rp.length - 1)) + 28;
    [[X0, lw, L.label || 'Checklist'], [rx, rw, R.label || 'Open decisions']].forEach(function (p) {
      K.rect(els, p[0], top, p[1], hh, T.blue);
      K.text(els, p[0] + 12, top, p[1] - 24, hh, p[2], { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, color: T.white, align: 'center', valign: 'middle' });
      K.rect(els, p[0], top + hh, p[1], bodyH, T.white, { color: LINE_C, width: 0.75 });
    });
    var y = top + hh + 14;
    lp.forEach(function (p, i) {
      K.text(els, X0 + 16, y, 26, lh_(lsz), K.pad2(i + 1), { font: 'mono', weight: 500, max: lsz, min: lsz, maxLines: 1, color: T.blue });
      K.text(els, X0 + 46, y, lw - 64, ln[i], p, { weight: 400, max: lsz, min: lsz, color: T.ink });
      if (i < lp.length - 1) K.line(els, X0 + 46, y + ln[i] + lgap / 2, X0 + lw - 16, y + ln[i] + lgap / 2, LINE_C, 0.5);
      y += ln[i] + lgap;
    });
    y = top + hh + 14;
    rp.forEach(function (p, i) {
      var h = rn[i];
      K.rect(els, rx + 14, y + h / 2 - 13, 26, 26, T.bgLight);
      K.icon(els, { icon: 'decision question' }, rx + 19, y + h / 2 - 8, 16, false);
      K.text(els, rx + 52, y, rw - 66, h, p, { weight: 400, max: rsz, min: rsz, color: T.ink, valign: 'middle' });
      y += h + rgap;
    });
    return { bg: T.white, els: els };
  });

  /* ---------- 7. Categories with a status legend — proposals page 18 ---------- */
  add('P66_CATEGORY_LEGEND', 'cards', { min: 4, max: 5,
    desc: 'framework categories: 4-5 columns, each a blue header (items[{title, text}]) over a short definition, with a legend of 3 statuses at the bottom (legend[{label, text}])', words: '15-30 per definition' }, function (s) {
    var items = K.items(s, 6).filter(function (it) { return it.title; });
    var legend = K.arr(s.legend, 4).filter(function (l) { return l && l.label; });
    if (items.length < 4 || items.length > 5 || legend.length < 2 || legend.length > 3) return null;
    var els = [];
    var top = K.header(els, s);
    var n = items.length, gap = 12, cw = (CW - gap * (n - 1)) / n;
    var hh = Math.max(36, Math.max.apply(null, items.map(function (it) { return K.textH(it.title, cw - 20, 11, 500); })) + 14);
    var need = Math.max.apply(null, items.map(function (it) { return K.textH(it.text, cw - 22, 10); }));
    var legH = 26, avail = BOTTOM - top - hh - legH - 28;
    if (need + 24 > avail) return null;
    var bh = Math.min(avail, Math.max(need + 28, avail * 0.45));
    items.forEach(function (it, i) {
      var x = X0 + i * (cw + gap);
      K.rect(els, x, top, cw, hh, T.blue);
      K.text(els, x + 10, top, cw - 20, hh, it.title, { weight: 500, max: 11, min: 10, maxLines: 2, color: T.white, align: 'center', valign: 'middle' });
      K.rect(els, x, top + hh, cw, bh, T.white, { color: LINE_C, width: 0.75 });
      K.text(els, x + 11, top + hh + 13, cw - 22, bh - 20, it.text, { weight: 400, max: 10, min: 10, color: T.ink });
    });
    var ly = top + hh + bh + 26, lw = CW / legend.length;
    var chipFill = [T.blue, T.slate, T.ink];
    legend.forEach(function (l, i) {
      var x = X0 + i * lw, f = chipFill[i] || T.ink;
      K.rect(els, x, ly, 60, legH, f);
      K.text(els, x + 4, ly, 52, legH, K.str(l.label), { weight: 500, max: 10, min: 9, maxLines: 1, color: K.onFill(f), align: 'center', valign: 'middle' });
      K.text(els, x + 72, ly - 4, lw - 84, legH + 8, K.str(l.text), { weight: 400, max: 10, min: 9, maxLines: 2, color: T.ink, valign: 'middle' });
    });
    return { bg: T.white, els: els };
  });

  /* ---------- 8. Impact and mitigation — proposals page 84 ---------- */
  add('P66_IMPACT_MITIGATION', 'comparison', { min: 2, max: 3,
    desc: 'impact and mitigation rows: each row a blue label arrow with an icon (items[{title, text = intro line above the row, points[] 2-5}]), 2-3 rows', words: '4-10 per point' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it.title && it.points && it.points.length; });
    if (items.length < 2 || items.length > 3) return null;
    var els = [];
    var top = K.header(els, s);
    var pw = 170, bx = X0 + pw + 30, bw = X0 + CW - bx - 16;
    var pts = items.map(function (it) { return strs_(it.points, 6); });
    var introH = 22, rowGap = 16, size = 0, needs;
    var avail = BOTTOM - top - (introH * items.length) - rowGap * (items.length - 1);
    [10, 9.5, 9].some(function (sz) {
      needs = pts.map(function (p) { return Math.max(56, bulletsNeed_(p, bw, sz, 5) + 28); });
      if (needs.reduce(function (a, b) { return a + b; }, 0) <= avail) { size = sz; return true; } return false;
    });
    if (!size) return null;
    var tot = needs.reduce(function (a, b) { return a + b; }, 0);
    var grow = Math.min(12, (avail - tot) / items.length * 0.5);
    var y = top;
    items.forEach(function (it, i) {
      if (it.text) K.text(els, X0, y, CW, 16, it.text, { weight: 400, max: 10, min: 10, maxLines: 1, color: T.blue });
      y += introH;
      var h = needs[i] + grow;
      K.rect(els, X0 + pw + 8, y, CW - pw - 8, h, T.bgLight);
      K.rect(els, X0, y, pw - 36, h, T.blue);
      K.shape(els, 'HOME_PLATE', X0 + pw - 70, y, 70, h, T.blue);
      K.ellipse(els, X0 + 18, y + h / 2 - 15, 30, 30, T.white);
      K.icon(els, { icon: it.icon || it.title }, X0 + 25, y + h / 2 - 8, 16, false);
      K.text(els, X0 + 58, y, pw - 70, h, it.title, { weight: 500, max: 12, min: 10.5, maxLines: 2, color: T.white, valign: 'middle' });
      var bn = bulletsNeed_(pts[i], bw, size, 5);
      bullets_(els, bx, y + (h - bn) / 2, bw, pts[i], size, 5);
      y += h + rowGap;
    });
    return { bg: T.white, els: els };
  });

  /* ---------- 9. Executive summary with keywords — proposals page 274 ---------- */
  add('P66_EXEC_KEYWORDS', 'statement', { min: 3, max: 3,
    desc: 'executive summary: framed findings box (statement = heading, text = paragraph) above 3 columns, each a big blue one-word keyword (items[{title = keyword, label = heading, text}])', words: '15-25 per column, 30-50 findings' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it.title; });
    if (items.length !== 3 || !s.text) return null;
    if (items.some(function (it) { return /\s/.test(String(it.title).trim()) || K.textWidth(String(it.title), 'sans', 500, 24) > 190; })) return null;
    var els = [];
    var top = K.header(els, s);
    var head = K.str(s.statement) || 'Key findings';
    var ph = K.textH(s.text, CW - 48, 10.5);
    var fh = ph + 54;
    K.roundrect(els, X0, top, CW, fh, T.white, { color: LINE_C, width: 0.75 });
    K.rect(els, X0, top + 14, 3, fh - 28, T.blue);
    K.text(els, X0 + 24, top + 16, CW - 48, 16, head, { weight: 500, max: 11, min: 11, maxLines: 1, color: T.blue });
    K.text(els, X0 + 24, top + 36, CW - 48, ph, s.text, { weight: 400, max: 10.5, min: 10.5, color: T.ink });
    var gap = 16, cw = (CW - 2 * gap) / 3, cy = top + fh + 16;
    var need = Math.max.apply(null, items.map(function (it) { return (it.label ? K.textH(it.label, cw - 32, 11, 500) + 4 : 0) + K.textH(it.text, cw - 32, 10); }));
    var ch = need + 74;
    if (cy + ch > BOTTOM) return null;
    ch = Math.min(BOTTOM - cy, Math.max(ch, (BOTTOM - cy) * 0.75));
    items.forEach(function (it, i) {
      var x = X0 + i * (cw + gap);
      K.roundrect(els, x, cy, cw, ch, T.white, { color: LINE_C, width: 0.75 });
      K.text(els, x + 16, cy + 14, cw - 32, 32, String(it.title).toLowerCase(), { weight: 500, max: 24, min: 20, maxLines: 1, color: T.blue });
      var y = cy + 58;
      if (it.label) { var l = K.text(els, x + 16, y, cw - 32, K.textH(it.label, cw - 32, 11, 500) + 1, it.label, { weight: 500, max: 11, min: 11, color: T.ink }); y += l.height + 4; }
      K.text(els, x + 16, y, cw - 32, K.textH(it.text, cw - 32, 10) + 1, it.text, { weight: 400, max: 10, min: 10, color: T.ink });
    });
    return { bg: T.bgLight, els: els };
  });

  /* ---------- 10. Comparison check matrix — proposals page 308 ---------- */
  add('P66_CHECK_MATRIX', 'comparison', { min: 4, max: 11,
    desc: 'option comparison: capabilities as rows (rows[{label, values[true/false]}] 4-11), options as blue column headers (options[] 2-4), check marks or dashes, notes on the right (points[] 3-6)', words: '6-16 per note' }, function (s) {
    var opts = strs_(s.options || s.columns, 5);
    var rows = K.arr(s.rows, 12).filter(function (r) { return r && !Array.isArray(r) && r.label; });
    var notes = strs_(s.points, 7);
    if (opts.length < 2 || opts.length > 4 || rows.length < 4 || rows.length > 11 || notes.length < 3 || notes.length > 6) return null;
    var els = [];
    var panelX = 474;
    K.rect(els, panelX, 0, W - panelX, H, T.bgLight);
    var top = K.header(els, s, { maxW: panelX - X0 - 20 });
    var labW = 150, mw = panelX - 24 - X0, ow = (mw - labW) / opts.length;
    var hh = Math.max(30, Math.max.apply(null, opts.map(function (o) { return K.textH(o, ow - 12, 10, 500); })) + 10);
    var rh = Math.min(28, (BOTTOM - top - hh) / rows.length);
    if (rh < 19) return null;
    top += Math.min(30, (BOTTOM - top - hh - rh * rows.length) / 3);
    opts.forEach(function (o, j) {
      var x = X0 + labW + j * ow;
      K.rect(els, x + 1, top, ow - 2, hh, T.blue);
      K.text(els, x + 6, top, ow - 12, hh, o, { weight: 500, max: 10, min: 9, maxLines: 2, color: T.white, align: 'center', valign: 'middle' });
    });
    var y = top + hh;
    rows.forEach(function (r) {
      K.text(els, X0 + 4, y, labW - 10, rh, K.str(r.label), { weight: 400, max: 10, min: 9, maxLines: 1, color: T.ink, valign: 'middle' });
      var vals = K.arr(r.values, opts.length);
      opts.forEach(function (o, j) {
        var cx = X0 + labW + j * ow + ow / 2, cy = y + rh / 2;
        if (vals[j] === true || vals[j] === 'yes' || vals[j] === 1) check_(els, cx, cy, T.blue);
        else K.line(els, cx - 4, cy, cx + 4, cy, T.slate, 1.4);
      });
      y += rh;
      K.line(els, X0, y, X0 + mw, y, LINE_C, 0.75);
    });
    var tableEnd = y;
    // notes panel
    var nx = panelX + 24, nw = W - nx - 32, size = 0, need = 0;
    [10, 9.5, 9].some(function (sz) { need = bulletsNeed_(notes, nw, sz, 10); if (need <= BOTTOM - 70) { size = sz; return true; } return false; });
    if (!size) return null;
    var ny = Math.max(50, (top + tableEnd) / 2 - need / 2);
    if (ny + need > BOTTOM) ny = BOTTOM - need;
    bullets_(els, nx, ny, nw, notes, size, 10, T.blue);
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. Icon headers over a table — proposals page 238 ---------- */
  add('P66_ICON_TABLE', 'table', { min: 2, max: 5, needs: 'items',
    desc: 'three icon headers (items[{title, text, icon}] 3) above a data table (columns[] 2-4, rows[][] 2-5)', words: '12-22 per header text, 3-10 per cell' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it.title; });
    var d = tableData_(s, 2, 4, 2, 5);
    if (items.length !== 3 || !d) return null;
    var els = [];
    var top = K.header(els, s);
    var gap = 16, cw = (CW - 2 * gap) / 3;
    var need = Math.max.apply(null, items.map(function (it) { return K.textH(it.text, cw - 28, 10); }));
    var ch = need + 60;
    var lay = tableLayout_(d.columns, d.rows, CW, BOTTOM - top - ch - 18);
    if (!lay) return null;
    items.forEach(function (it, i) {
      var x = X0 + i * (cw + gap);
      K.roundrect(els, x, top, cw, ch, T.bgLight);
      K.icon(els, { icon: it.icon || it.title }, x + 14, top + 12, 18, false);
      K.text(els, x + 14, top + 36, cw - 28, 16, it.title, { weight: 500, max: 11, min: 10, maxLines: 1, color: T.blue });
      K.text(els, x + 14, top + 54, cw - 28, need, it.text, { weight: 400, max: 10, min: 10, color: T.ink });
    });
    drawTable_(els, X0, top + ch + 18, lay, d.columns, d.rows);
    return { bg: T.white, els: els };
  });

  /* ---------- 12. Governance columns with mini tables — proposals page 232 ---------- */
  add('P66_GOV_COLUMNS', 'cards', { min: 3, max: 3,
    desc: 'governance model: 3 columns with blue headers, bullets (items[{title, points[] 2-4, rows[[label, value]] 2-3}]) and a small two-column table at the foot of each column', words: '8-16 per bullet' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it.title && it.points && it.points.length; });
    if (items.length !== 3) return null;
    var data = items.map(function (it) {
      return { title: it.title, points: strs_(it.points, 5), rows: K.arr(it.rows, 4).filter(Array.isArray).map(function (r) { return [K.str(r[0]), K.str(r[1])]; }) };
    });
    if (data.some(function (d) { return d.points.length > 4 || d.rows.length < 2 || d.rows.length > 3; })) return null;
    var els = [];
    var top = K.header(els, s);
    var gap = 14, cw = (CW - 2 * gap) / 3, hh = 30, rh = 22;
    var tH = Math.max.apply(null, data.map(function (d) { return d.rows.length; })) * rh;
    var avail = BOTTOM - top - hh - tH - 40;
    var size = 0, need = 0;
    [10, 9.5, 9].some(function (sz) {
      need = Math.max.apply(null, data.map(function (d) { return bulletsNeed_(d.points, cw - 28, sz, 7); }));
      if (need <= avail) { size = sz; return true; } return false;
    });
    if (!size) return null;
    var bodyH = Math.min(avail, need + 12) + tH + 40;
    data.forEach(function (d, i) {
      var x = X0 + i * (cw + gap);
      K.rect(els, x, top, cw, hh, T.blue);
      K.text(els, x + 12, top, cw - 24, hh, d.title, { weight: 500, max: 11, min: 10, maxLines: 1, color: T.white, valign: 'middle' });
      K.rect(els, x, top + hh, cw, bodyH, T.bgLight);
      bullets_(els, x + 14, top + hh + 14, cw - 28, d.points, size, 7);
      var ty = top + hh + bodyH - 14 - d.rows.length * rh;
      K.rect(els, x + 10, ty, cw - 20, d.rows.length * rh, T.white, { color: LINE_C, width: 0.75 });
      d.rows.forEach(function (r, k) {
        var ry = ty + k * rh;
        if (k) K.line(els, x + 10, ry, x + cw - 10, ry, LINE_C, 0.75);
        K.text(els, x + 18, ry, (cw - 36) * 0.58, rh, r[0], { weight: 400, max: 9.5, min: 9, maxLines: 1, color: T.ink, valign: 'middle' });
        K.text(els, x + 18 + (cw - 36) * 0.58, ry, (cw - 36) * 0.42, rh, r[1], { weight: 500, max: 9.5, min: 9, maxLines: 1, color: T.blue, align: 'right', valign: 'middle' });
      });
    });
    return { bg: T.white, els: els };
  });

  /* ---------- 13. Elevator pitch — proposals page 106 ---------- */
  add('P66_PITCH', 'statement', { min: 3, max: 3,
    desc: 'elevator pitch: three rules on the left (items[{label = "Keep it", title = one keyword}] 3) and the pitch paragraph in a framed box on the right (text, statement = box heading)', words: '45-80 pitch' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it.title; });
    if (items.length !== 3 || !s.text) return null;
    var els = [];
    var top = K.header(els, s);
    var py = top, ph = BOTTOM - top;
    K.roundrect(els, X0 - 8, py, CW + 16, ph, T.white);
    var bx = X0 + 260, bw = X0 + CW - 14 - bx;
    var head = K.str(s.statement || s.label);
    var tH = K.textH(s.text, bw - 56, 11.5);
    if (tH + (head ? 30 : 0) + 40 > ph - 28) return null;
    K.rect(els, bx, py + 14, bw, ph - 28, T.bgLight);
    var blockH = tH + (head ? 30 : 0), by = py + 14 + (ph - 28 - blockH) / 2;
    if (head) { K.text(els, bx + 28, by, bw - 56, 18, head, { weight: 500, max: 12, min: 11, maxLines: 1, color: T.blue, align: 'center' }); by += 30; }
    K.text(els, bx + 28, by, bw - 56, tH, s.text, { weight: 400, max: 11.5, min: 11.5, color: T.ink, align: 'center' });
    var rowH = 44, ry = py + (ph - rowH * 3) / 2;
    var lblW = Math.max.apply(null, items.map(function (it) { return K.textWidth(K.str(it.label) || 'Keep it', 'sans', 400, 14); })) + 10;
    items.forEach(function (it, i) {
      var y = ry + i * rowH;
      K.text(els, X0 + 16, y, lblW + 4, 30, K.str(it.label) || 'Keep it', { weight: 400, max: 14, min: 14, maxLines: 1, color: T.ink, valign: 'middle' });
      var kw = String(it.title).toLowerCase(), kwW = Math.min(150, K.textWidth(kw, 'sans', 500, 14) + 22);
      var kx = X0 + 16 + lblW + 6;
      K.rect(els, kx, y + 2, kwW, 26, T.bgLight);
      K.rect(els, kx, y + 2, 3, 26, T.blue);
      K.text(els, kx + 10, y, kwW - 12, 30, kw, { weight: 500, max: 14, min: 12, maxLines: 1, color: T.blue, valign: 'middle' });
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  });

  /* ---------- 14. Opening statement in a framed box — proposals page 164 ---------- */
  add('P66_STATEMENT_BOX', 'statement', { desc: 'opening statement: a big title (statement) and a blue subtitle (text) inside a large framed box on a light background', words: '6-14 statement, 6-12 subtitle' }, function (s) {
    var st = K.str(s.statement || s.title), sub = K.str(s.text || s.lead);
    // V.1_50: never the same sentence twice (deck 22 slide 11): a subtitle that repeats the statement makes way for the
    // slide title, or goes
    var same = function (a, b) { return String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    if (sub && same(sub, st)) sub = s.title && !same(s.title, st) ? K.str(s.title) : '';
    if (!st) return null;
    var els = [];
    var bx = 24, by = 52, bw = W - 48, bh = 278, tw = 480;
    var a = K.textH(st, tw, 26, 500);
    if (a > lh_(26) * 3 + 1) return null;
    var b = sub ? K.textH(sub, tw, 16, 500) : 0;
    if (b > lh_(16) * 2 + 1) return null;
    K.roundrect(els, bx, by, bw, bh, T.white);
    var y = by + (bh - a - (b ? b + 22 : 0)) / 2;
    K.rect(els, bx + 48, y + 4, 4, a - 8, T.blue);
    K.text(els, bx + 68, y, tw, a, st, { weight: 500, max: 26, min: 26, color: T.ink });
    if (sub) K.text(els, bx + 68, y + a + 22, tw, b, sub, { weight: 500, max: 16, min: 16, color: T.blue });
    return { bg: T.bgLight, els: els, noBalance: true };
  });

  /* ---------- 15. Numbered rows with a note — proposals pages 318, 16, 191, 307 ---------- */
  add('P66_NUMBERED_ROWS', 'process', { min: 3, max: 6,
    desc: 'numbered rows: blue number square, heading and one line (items[{title, text, note}] 3-6), short note on the right of each row (note may start with "Instead: ")', words: '8-18 per line, 6-14 per note' }, function (s) {
    var items = K.items(s, 7).filter(function (it) { return it.title; });
    var n = items.length;
    if (n < 3 || n > 6) return null;
    var els = [];
    var top = K.header(els, s);
    var hasNote = items.some(function (it) { return it.note; });
    // one column of full-width rows; six rows without notes go into two columns
    var cols = 1, colW = CW, cgap = 20;
    var gap = n > 4 ? 7 : 10, ts = 12;
    var noteW = hasNote ? 196 : 0;
    // a note may start with a short label ("Instead: ..."): the label sits in blue above the note
    function splitNote_(note) {
      note = String(note || ''); var ci = note.indexOf(': ');
      if (ci > 1 && ci < 20) { var rest = note.slice(ci + 2); return { label: note.slice(0, ci), text: rest.charAt(0).toUpperCase() + rest.slice(1) }; }
      return { label: '', text: note };
    }
    function noteLabW_(p) { return p.label ? K.textWidth(p.label, 'sans', 500, 9.5) / 0.94 + 8 : 0; }
    function noteH_(note) { var p = splitNote_(note); return K.textH(p.text, noteW - noteLabW_(p), 9.5); }
    // V.1_47: rows are measured a little narrower than drawn, so a line that wraps in Slides still fits in its row
    var SAFE = 14;
    function needsFor(tw, tsz) {
      return items.map(function (it) {
        var a = K.textH(it.title, tw - SAFE, tsz, 500) + 2 + K.textH(it.text, tw - SAFE, 10);
        var b = it.note ? noteH_(it.note) : 0;
        return Math.max(a, b, 30) + 16;
      });
    }
    var tw = colW - 58 - (hasNote ? noteW + 28 : 16);
    var needs = needsFor(tw, ts), rowsN = n;
    var avail = BOTTOM - top - gap * (n - 1);
    var tot = needs.reduce(function (x, y) { return x + y; }, 0);
    if (tot > avail) {
      if (hasNote || n < 5) return null;
      cols = 2; colW = (CW - cgap) / 2; rowsN = Math.ceil(n / 2); gap = 10; ts = 11;
      tw = colW - 58 - 12;
      needs = needsFor(tw, ts);
      avail = BOTTOM - top - gap * (rowsN - 1);
      var rowMax = [];
      for (var r = 0; r < rowsN; r++) rowMax.push(Math.max(needs[r], needs[r + rowsN] || 0));
      tot = rowMax.reduce(function (x, y) { return x + y; }, 0);
      if (tot > avail) return null;
      needs = items.map(function (it, i) { return rowMax[i % rowsN]; });
    }
    var rowsTot = 0;
    for (var q = 0; q < rowsN; q++) rowsTot += needs[q];
    var extra = Math.min(14, (avail - rowsTot) / rowsN * 0.6);
    var hs = needs.map(function (nd) { return nd + extra; });
    var y = top;
    items.forEach(function (it, i) {
      var col = cols === 2 ? Math.floor(i / rowsN) : 0, h = hs[i];
      if (cols === 2 && i === rowsN) y = top;
      var x = X0 + col * (colW + cgap), tx = x + 58;
      K.rect(els, x, y, colW, h, T.white, { color: LINE_C, width: 0.75 });
      var sq = Math.min(34, h - 14);
      K.rect(els, x + 10, y + (h - sq) / 2, sq, sq, T.blue);
      K.text(els, x + 10, y + (h - sq) / 2, sq, sq, K.pad2(i + 1), { font: 'mono', weight: 500, max: 12, min: 11, maxLines: 1, color: T.white, align: 'center', valign: 'middle' });
      var th = K.textH(it.title, tw - SAFE, ts, 500), bh2 = it.text ? K.textH(it.text, tw - SAFE, 10) : 0;
      var blockH = th + (it.text ? 2 + bh2 : 0);
      var cy = y + (h - blockH) / 2;
      K.text(els, tx, cy, tw, th + 1, it.title, { weight: 500, max: ts, min: ts, color: T.ink });
      if (it.text) K.text(els, tx, cy + th + 2, tw, bh2 + 1, it.text, { weight: 400, max: 10, min: 10, color: T.ink });
      if (it.note && cols === 1) {
        var nx = x + colW - noteW - 14;
        K.line(els, nx - 14, y + 10, nx - 14, y + h - 10, LINE_C, 0.75);
        var np = splitNote_(it.note), nh = noteH_(it.note), ny = y + (h - nh) / 2;
        var lw2 = noteLabW_(np);
        if (np.label) K.text(els, nx, ny, lw2, lh_(9.5), np.label, { weight: 500, max: 9.5, min: 9.5, maxLines: 1, color: T.blue });
        K.text(els, nx + lw2, ny, noteW - lw2, nh + 1, np.text, { weight: 400, max: 9.5, min: 9.5, color: T.ink });
      }
      y += h + gap;
    });
    return { bg: T.white, els: els };
  });
})();
