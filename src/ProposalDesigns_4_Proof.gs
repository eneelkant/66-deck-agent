/* =========================================================================================================
   66° Deck Agent — Proposal Deck design library (V.1_42), part 4: proof and commercials
   Credentials, partner badges, logo wall, customer stories, case study, team (photos grid, roles, structure),
   pricing table, package options, investment summary and next steps.
   Every design here draws only in a Proposal Deck (ENGINE.addProposalDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addProposalDesign;

  function lh_(size, font) { return K.lineHeight(font || 'sans', size); }
  function tH_(str, w, size, weight, font) { return str ? K.textH(String(str), w, size, weight || 400, font) : 0; }
  // tallest block of a list of strings at one size
  function maxH_(list, w, size, weight, font) {
    var m = 0;
    list.forEach(function (t) { m = Math.max(m, tH_(t, w, size, weight, font)); });
    return m;
  }
  function list_(v, max) { return K.asList(v).slice(0, max || 12); }
  // white check mark in a blue square
  function check_(els, x, y, d) {
    K.rect(els, x, y, d, d, T.blue);
    K.line(els, x + d * 0.24, y + d * 0.52, x + d * 0.42, y + d * 0.7, T.white, 1.4);
    K.line(els, x + d * 0.42, y + d * 0.7, x + d * 0.78, y + d * 0.3, T.white, 1.4);
  }
  function initials_(name) {
    var w = String(name || '').replace(/[^A-Za-z\s\-]/g, ' ').split(/[\s\-]+/).filter(Boolean);
    if (!w.length) return '';
    return (w[0].charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }
  // title (and lead) drawn in white on a dark slide; returns the y below it
  function darkHeader_(els, s, w) {
    var t = K.text(els, X0, 24, w, 60, s.title || '', { weight: 500, max: 20, min: 16, maxLines: 2, color: T.white });
    var y = 24 + t.height + 5;
    if (s.lead) y += K.text(els, X0, y, w, 30, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.white }).height;
    return y;
  }

  /* ---------- Credentials: dark, 4 big numbers, badge row — proposals pages 34, 271, 194 ---------- */
  add('P66_CREDENTIALS', 'stats', { min: 3, max: 4, needs: '',
    desc: 'dark 66degrees credentials slide: title "66degrees is Google\'s ... partner", 3-4 big numbers in outlined boxes (items[{value,label,text}]), a row of credential badges (points[] = badge names, up to 8), optional awards[] (up to 2 short award names, top right)',
    words: '8-16' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it && it.value; });
    if (items.length < 3 || items.length > 4) return null;
    var badges = list_(s.points, 8), awards = list_(s.awards, 2);
    var els = [];
    var tEnd = darkHeader_(els, s, awards.length ? 440 : 600);
    // awards: small white award cards top right
    var aw = 82, ah = 58;
    awards.forEach(function (a, i) {
      var x = 688 - (awards.length - i) * aw - (awards.length - 1 - i) * 10;
      K.roundrect(els, x, 22, aw, ah, T.white);
      K.rect(els, x, 22 + ah - 4, aw, 4, T.blue);
      K.text(els, x + 6, 26, aw - 12, ah - 12, a, { weight: 500, max: TSZ.body, min: 9, maxLines: 3, align: 'center', valign: 'middle', color: T.ink });
    });
    var n = items.length, gap = 12, bw = (CW - gap * (n - 1)) / n, iw = bw - 28;
    var vSize = K.uniformSize(items.map(function (it) { return it.value; }), iw, 44, { font: 'mono', weight: 500, max: 26, min: 18, maxLines: 1 });
    var vH = lh_(vSize, 'mono');
    var lB = maxH_(items.map(function (it) { return it.label; }), iw, TSZ.heading, 500);
    var bB = maxH_(items.map(function (it) { return it.text; }), iw, TSZ.body, 400);
    var need = 12 + vH + 4 + lB + (lB ? 4 : 0) + bB + 14;
    var badgeH = badges.length ? 92 : 0;
    var top = Math.max(tEnd + 16, awards.length ? 94 : 88);
    var bh = need;
    var room = BOTTOM - badgeH - (badges.length ? 14 : 0) - top;
    if (bh > room + 2) return null;
    bh = Math.min(room, Math.max(need, room * (badges.length ? 0.8 : 0.7)));
    items.forEach(function (it, i) {
      var x = CX + i * (bw + gap);
      K.rect(els, x, top, bw, bh, T.ink, { color: T.slate, width: 0.5 });
      K.rect(els, x, top + bh - 3, bw, 3, T.blue);
      var y = top + 12;
      K.text(els, x + 14, y, iw, vH, it.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, color: T.white });
      y += vH + 4;
      if (it.label) { K.text(els, x + 14, y, iw, lB, it.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.white }); y += lB + 4; }
      K.text(els, x + 14, y, iw, bB + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.white });
    });
    if (badges.length) {
      var by = BOTTOM - badgeH;
      K.text(els, X0, by, 600, 20, s.label || 'Our Google credentials and specializations', { weight: 500, max: 13, min: 12, maxLines: 1, color: T.white });
      var nb = badges.length, slot = CW / nb, d = 40;
      var lSize = K.uniformSize(badges, Math.min(slot, 100) - 6, 26, { weight: 400, max: 9.5, min: 9, maxLines: 2 });
      badges.forEach(function (b, i) {
        var cx = X0 + i * slot + slot / 2, cy = by + 24;
        K.ellipse(els, cx - d / 2, cy, d, d, T.white);
        K.ring(els, cx - d / 2 + 3, cy + 3, d - 6, T.white, T.cardLine, 0.5);
        K.icon(els, { icon: b + ' google cloud' }, cx - 10, cy + d / 2 - 10, 20, false);
        K.text(els, cx - Math.min(slot, 100) / 2 + 3, cy + d + 5, Math.min(slot, 100) - 6, 26, b, { weight: 400, max: lSize, min: lSize, maxLines: 2, align: 'center', color: T.white });
      });
    }
    return { bg: T.ink, bgImage: 'navy-bg', els: els, dark: true, noBalance: true };
  });

  /* ---------- Partner badges: status block + competencies — proposals page 227 ---------- */
  add('P66_BADGES', 'stats', { min: 1, max: 2, needs: 'groups',
    desc: 'Google partner status: big badge block on the left (statement = status such as "Diamond partner", text = specialization line, value + label = a big number such as active certifications) and 1-2 lists on the right as compact chips (groups[{label, points[]}], up to 10 points each)',
    words: '2-5' }, function (s) {
    var groups = K.arr(s.groups, 2).map(function (g) { return { label: K.str(g.label || g.title), points: list_(g.points, 10) }; })
      .filter(function (g) { return g.points.length; });
    if (!groups.length || !s.statement) return null;
    var els = [];
    var top = K.header(els, s);
    var avail = BOTTOM - top;
    // left badge block
    var lw = 210, lx = CX;
    K.rect(els, lx, top, lw, avail, T.bgLight);
    K.rect(els, lx, top, lw, 4, T.blue);
    var iw = lw - 36, y = top + 26;
    if (s.label2 || s.eyebrow) { K.text(els, lx + 18, y, iw, 16, s.label2 || s.eyebrow, { weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', color: T.ink }); y += 20; }
    var st = K.text(els, lx + 18, y, iw, 72, s.statement, { weight: 500, max: 26, min: 18, maxLines: 2, align: 'center', color: T.blue });
    y += st.height + 8;
    K.rect(els, lx + lw / 2 - 30, y, 60, 2, T.blue);
    y += 12;
    if (s.text) { y += K.text(els, lx + 18, y, iw, 40, s.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, align: 'center', color: T.ink }).height + 6; }
    if (s.value) {
      var vy = Math.max(y + 16, top + avail - 106);
      K.line(els, lx + 24, vy, lx + lw - 24, vy, T.cardLine, 0.75);
      K.text(els, lx + 18, vy + 14, iw, 50, s.value, { font: 'mono', weight: 500, max: 36, min: 22, maxLines: 1, align: 'center', color: T.ink });
      if (s.valueLabel || s.label) K.text(els, lx + 18, vy + 66, iw, 30, s.valueLabel || s.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.ink });
    }
    // right: chip lists
    var rx = lx + lw + 24, rw = 688 - rx, cg = 10, cw = (rw - cg) / 2;
    var rows = groups.reduce(function (a, g) { return a + Math.ceil(g.points.length / 2); }, 0);
    var headH = 30, gGap = 18;
    var rowH = Math.min(30, (avail - groups.length * headH - (groups.length - 1) * gGap) / rows);
    if (rowH < 22) return null;
    var cSize = K.uniformSize(groups.reduce(function (a, g) { return a.concat(g.points); }, []), cw - 30, rowH - 6, { weight: 400, max: TSZ.body, min: 9, maxLines: 1 });
    var used = groups.length * headH + rows * rowH + (groups.length - 1) * gGap;
    var gy = top + Math.max(0, (avail - used) / 2) * 0;
    gy = top;
    groups.forEach(function (g, gi) {
      K.text(els, rx, gy, rw, 18, g.label, { weight: 500, max: 13, min: 12, maxLines: 1, color: T.ink });
      K.line(els, rx, gy + 22, rx + rw, gy + 22, T.ink, 0.75);
      var cy = gy + headH;
      g.points.forEach(function (p, i) {
        var x = rx + (i % 2) * (cw + cg), yy = cy + Math.floor(i / 2) * rowH;
        K.roundrect(els, x, yy, cw, rowH - 6, T.bgLight);
        K.rect(els, x + 10, yy + (rowH - 6) / 2 - 3.5, 7, 7, gi === 0 ? T.blue : T.ink);
        K.text(els, x + 24, yy, cw - 30, rowH - 6, p, { weight: 400, max: cSize, min: cSize, maxLines: 1, valign: 'middle', color: T.ink });
      });
      gy = cy + Math.ceil(g.points.length / 2) * rowH + gGap;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Why 66degrees: check cards + client name wall — proposals pages 228, 35, 272 ---------- */
  add('P66_LOGO_WALL', 'cards', { min: 3, max: 4, needs: 'points',
    desc: 'why 66degrees: 3-4 reason cards with a check mark (items[{title,text}], text 12-22 words) on the left, a panel of client names set as wordmark tiles on the right (points[] = 4-14 client names, label = panel heading such as "Multi-year customer relationships")',
    words: '12-22' }, function (s) {
    var items = K.items(s, 4);
    var names = list_(s.points, 14);
    if (items.length < 3 || items.length > 4 || names.length < 4) return null;
    var els = [];
    var top = K.header(els, s);
    var avail = BOTTOM - top;
    var lw = 448, gap = 12, n = items.length, gridH;
    var nRows = Math.ceil(names.length / 2), panelNeed = 54 + nRows * 28 + (nRows - 1) * (nRows > 5 ? 5 : 8);
    if (n === 4) {
      // 2 x 2 cards: check + heading, rule, text
      var cw = (lw - gap) / 2, iw = cw - 32;
      var hB = Math.max(16, maxH_(items.map(function (it) { return it.title; }), iw - 26, TSZ.heading, 500));
      var bB = maxH_(items.map(function (it) { return it.text; }), iw, TSZ.body, 400);
      var need = 16 + hB + 10 + 1 + 10 + bB + 16;
      if (need > (avail - gap) / 2 + 2) return null;
      var ch = Math.min((avail - gap) / 2, Math.max(need, (avail - gap) / 2 * 0.85, (panelNeed - gap) / 2));
      gridH = ch * 2 + gap;
      items.forEach(function (it, i) {
        var x = CX + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap);
        K.rect(els, x, y, cw, ch, T.bgLight);
        check_(els, x + 16, y + 16, 16);
        var th0 = tH_(it.title, iw - 26, TSZ.heading, 500);
        K.text(els, x + 42, y + 16 + (th0 < 16 ? (16 - th0) / 2 : 0), iw - 26, hB, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.ink });
        var yy = y + 16 + hB + 10;
        K.line(els, x + 16, yy, x + cw - 16, yy, T.slate, 0.75);
        K.text(els, x + 16, yy + 10, iw, bB + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
      });
    } else {
      // 3 rows: check + heading on the left, text on the right of a thin rule
      var hw = 136, tx = 16 + 26 + hw + 16, tw3 = lw - tx - 18;
      var hB3 = maxH_(items.map(function (it) { return it.title; }), hw, TSZ.heading, 500);
      var bB3 = maxH_(items.map(function (it) { return it.text; }), tw3 - 6, TSZ.body, 400);
      var need3 = Math.max(hB3, bB3, 16) + 32, slotH = (avail - 2 * gap) / 3;
      if (need3 > slotH + 2) return null;
      var rh = Math.min(slotH, Math.max(need3, slotH * 0.8, (panelNeed - 2 * gap) / 3));
      gridH = rh * 3 + gap * 2;
      items.forEach(function (it, i) {
        var y = top + i * (rh + gap);
        K.rect(els, CX, y, lw, rh, T.bgLight);
        var hh = tH_(it.title, hw, TSZ.heading, 500), bh = tH_(it.text, tw3 - 6, TSZ.body);
        check_(els, CX + 16, y + rh / 2 - 8, 16);
        K.text(els, CX + 42, y + (rh - hh) / 2, hw, hh, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.ink });
        K.line(els, CX + tx - 8, y + 14, CX + tx - 8, y + rh - 14, T.slate, 0.75);
        K.text(els, CX + tx + 6, y + (rh - bh) / 2, tw3 - 6, bh + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
      });
    }
    // right panel
    var px = CX + lw + 16, pw = 688 - px;
    K.rect(els, px, top, pw, gridH, T.white, { color: T.cardLine, width: 0.75 });
    K.rect(els, px, top, pw, 30, T.blue);
    K.text(els, px + 10, top, pw - 20, 30, s.label || 'Multi-year customer relationships', { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    var rows = Math.ceil(names.length / 2), tg = rows > 5 ? 5 : 8;
    var tw = (pw - 24 - tg) / 2, areaH = gridH - 30 - 24;
    var th = Math.min(rows <= 4 ? 50 : 42, (areaH - tg * (rows - 1)) / rows);
    var nSpec = { weight: 500, max: 12, min: 9.5, maxLines: th >= 26 ? 2 : 1 };
    var nSize = K.uniformSize(names, tw - 10, th - 2, nSpec);
    if (names.some(function (nm) { return K.fit(nm, tw - 10, th - 2, nSpec).truncated; })) return null;
    var ty0 = top + 30 + 12 + (areaH - (rows * th + (rows - 1) * tg)) / 2;
    names.forEach(function (nm, i) {
      var x = px + 12 + (i % 2) * (tw + tg), y = ty0 + Math.floor(i / 2) * (th + tg);
      K.rect(els, x, y, tw, th, T.bgLight);
      K.text(els, x + 5, y, tw - 10, th, nm, { weight: 500, max: nSize, min: nSize, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Customer success stories: name tile + result, two columns — proposals pages 37, 217, 229 ---------- */
  add('P66_STORIES', 'cards', { min: 4, max: 8, needs: '',
    desc: 'customer success stories list: two columns of rows, each a client name tile and 1-3 lines of result (items[{client, label (optional: industry or since when), text}])',
    words: '15-30' }, function (s) {
    var items = K.items(s, 8).map(function (it) {
      return { client: K.str(it.client || it.title || it.name), label: it.client ? (it.label || it.title || '') : (it.label || ''), text: it.text || '' };
    }).filter(function (it) { return it.client && it.text; });
    var n = items.length;
    if (n < 4 || n > 8) return null;
    var els = [];
    var top = K.header(els, s);
    K.line(els, 0, top - 8, W, top - 8, T.cardLine, 0.75);
    var avail = BOTTOM - top, rows = Math.ceil(n / 2), gap = 24, colW = (CW - gap) / 2;
    var tileW = 104, tx = tileW + 16, iw = colW - tx;
    var nSize = K.uniformSize(items.map(function (it) { return it.client; }), tileW - 14, 34, { weight: 500, max: 13, min: 10, maxLines: 2 });
    var lB = items.some(function (it) { return it.label; }) ? lh_(TSZ.body) + 3 : 0;
    var bB = maxH_(items.map(function (it) { return it.text; }), iw, TSZ.body, 400);
    var rowNeed = Math.max(52, lB + bB + 8);
    var rowH = Math.min(avail / rows, Math.max(rowNeed + 18, 70, avail / rows * 0.72));
    if (rowNeed > avail / rows - 8) return null;
    var y0 = top + (avail - rows * rowH) / 2;
    items.forEach(function (it, i) {
      var c = i < rows ? 0 : 1, r = c ? i - rows : i;
      var x = CX + c * (colW + gap), y = y0 + r * rowH;
      var th = Math.min(rowH - 16, 72);
      K.rect(els, x, y + (rowH - th) / 2, tileW, th, T.white, { color: T.cardLine, width: 0.75 });
      K.text(els, x + 7, y + (rowH - th) / 2, tileW - 14, th, it.client, { weight: 500, max: nSize, min: nSize, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
      var need = (it.label ? lB : 0) + tH_(it.text, iw, TSZ.body);
      var ty = y + (rowH - need) / 2;
      if (it.label) { K.text(els, x + tx, ty, iw, lh_(TSZ.body), it.label, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.blue }); ty += lB; }
      K.text(els, x + tx, ty, iw, bB + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
      if (r < (c ? n - rows : rows) - 1) K.line(els, x, y + rowH, x + colW, y + rowH, T.cardLine, 0.5);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Case study: dark sidebar + challenge / solution / outcome — proposals pages 292, 304-306 ---------- */
  add('P66_CASE_STUDY', 'case_study', { min: 0, max: 99, needs: 'challenge',
    desc: 'case study: dark left sidebar with the client name, industry and the solution components (points[]), then three columns "The challenge" (challenge), "The solution" (solution: text or list) and "The outcome" (results[{value: short result heading, label: one line}] or outcome text)',
    words: '40-70' }, function (s) {
    var chal = list_(s.challenge, 4).join(' '), sol = list_(s.solution, 6);
    var results = K.arr(s.results, 4).filter(function (r) { return r && (r.value || r.label); });
    if (!chal || !sol.length || (!results.length && !s.outcome)) return null;
    var comps = list_(s.points, 9);
    var els = [];
    var sw = 196;
    K.rect(els, sw, 0, W - sw, H, T.white);
    // sidebar
    var sy = 56;
    if (s.client) sy += K.text(els, X0, sy, sw - 52, 56, s.client, { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white }).height + 4;
    if (s.industry) sy += K.text(els, X0, sy, sw - 52, 30, s.industry, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.white }).height;
    if (comps.length) {
      var cy = Math.max(sy + 28, 120);
      K.line(els, X0, cy - 12, sw - 24, cy - 12, T.slate, 0.5);
      K.text(els, X0, cy, sw - 52, 22, 'Solution components', { weight: 500, max: 13, min: 12, maxLines: 1, color: T.white });
      cy += 26;
      var ps = K.uniformSize(comps, sw - 66, 30, { weight: 400, max: TSZ.body, min: 9, maxLines: 2 });
      comps.forEach(function (p) {
        if (cy > 346) return;
        K.ellipse(els, X0 + 1, cy + 4.5, 5, 5, T.white);
        cy += K.text(els, X0 + 14, cy, sw - 66, 30, p, { weight: 400, max: ps, min: ps, maxLines: 2, color: T.white }).height + 4;
      });
    }
    // right: eyebrow, title, lead
    var rx = sw + 22, rw = 688 - rx;
    var eb = ['Success story', s.label, s.industry].filter(Boolean).join('  |  ');
    K.text(els, rx, 22, rw, 14, eb, { weight: 500, max: 9.5, min: 9, maxLines: 1, color: T.blue });
    var t = K.text(els, rx, 38, rw, 50, s.title || '', { weight: 500, max: 18, min: 15, maxLines: 2, color: T.ink });
    var y = 38 + t.height + 4;
    if (s.lead) y += K.text(els, rx, y, rw, 28, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink }).height;
    var top = y + 18;
    var gap = 18, colW = (rw - 2 * gap) / 3;
    var heads = [s.challengeLabel || 'The challenge', s.solutionLabel || 'The solution', s.outcomeLabel || 'The outcome'];
    var bodyTop = top + 26, bodyH = BOTTOM - bodyTop;
    heads.forEach(function (h, i) {
      var x = rx + i * (colW + gap);
      K.text(els, x, top, colW, 20, h, { weight: 500, max: 13, min: 12, maxLines: 1, color: T.ink });
    });
    // challenge
    var cf = K.text(els, rx, bodyTop, colW, bodyH, chal, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
    var colEnd = bodyTop + cf.height;
    // solution
    var sx = rx + colW + gap;
    if (sol.length === 1) colEnd = Math.max(colEnd, bodyTop + K.text(els, sx, bodyTop, colW, bodyH, sol[0], { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink }).height);
    else colEnd = Math.max(colEnd, bodyTop + K.bulletList(els, sx, bodyTop, colW, bodyH, sol, { max: TSZ.body, min: TSZ.body, gap: 6 }));
    // outcome
    var ox = rx + 2 * (colW + gap), oy = bodyTop;
    results.forEach(function (r) {
      if (r.value) oy += K.text(els, ox, oy, colW, 32, r.value, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.blue }).height + 2;
      if (r.label) oy += K.text(els, ox, oy, colW, 60, r.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.ink }).height;
      oy += 12;
    });
    if (s.outcome && oy < BOTTOM - 30) oy += K.text(els, ox, oy, colW, BOTTOM - oy, s.outcome, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink }).height + 12;
    colEnd = Math.min(BOTTOM, Math.max(colEnd, oy - 12) + 10);
    [1, 2].forEach(function (i) { var lx = rx + i * (colW + gap) - gap / 2; K.line(els, lx, top, lx, colEnd, T.blue, 1); });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  });

  /* ---------- Team grid: initials avatars + team fact bar — proposals pages 224, 33, 225 ---------- */
  add('P66_TEAM_PHOTOS', 'team', { min: 4, max: 8, needs: 'people',
    desc: 'proposed team grid: 4-8 people (people[{name,title}]) with a round initials avatar, name and role, and a blue bar at the bottom with a team fact (takeaway)',
    words: '3-8' }, function (s) {
    var people = K.arr(s.people, 8).filter(function (p) { return p && p.name; });
    var n = people.length;
    if (n < 4 || n > 8) return null;
    var els = [];
    var top = K.header(els, s);
    var barH = s.takeaway ? 30 : 0, barY = BOTTOM - barH;
    var avail = (s.takeaway ? barY - 16 : BOTTOM) - top;
    var cols = n <= 4 ? 2 : (n <= 6 ? 3 : 4), rows = Math.ceil(n / cols), gap = 12;
    var cw = (CW - gap * (cols - 1)) / cols, d = cols === 4 ? 36 : 46, pl = cols === 4 ? 12 : 14, iw = cw - pl - d - 12 - 10;
    var ch = Math.min(cols === 4 ? 96 : 84, (avail - gap * (rows - 1)) / rows);
    var nSize = K.uniformSize(people.map(function (p) { return p.name; }), iw, 30, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2 });
    var rB = maxH_(people.map(function (p) { return p.title; }), iw, TSZ.body, 400);
    var nB = maxH_(people.map(function (p) { return p.name; }), iw, nSize, 500);
    if (nB + 2 + rB > ch - 12) return null;
    var y0 = top + (avail - rows * ch - (rows - 1) * gap) / 2;
    people.forEach(function (p, i) {
      var r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
      var x = CX + (i % cols) * (cw + gap) + (cols - inRow) * (cw + gap) / 2, y = y0 + r * (ch + gap);
      K.rect(els, x, y, cw, ch, T.bgLight);
      K.ellipse(els, x + pl, y + ch / 2 - d / 2, d, d, T.blue);
      K.text(els, x + pl, y + ch / 2 - d / 2, d, d, initials_(p.name), { weight: 500, max: 13, min: 12, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var pn = tH_(p.name, iw, nSize, 500), bh = pn + 2 + tH_(p.title, iw, TSZ.body);
      var ty = y + (ch - bh) / 2;
      K.text(els, x + pl + d + 12, ty, iw, pn, p.name, { weight: 500, max: nSize, min: nSize, maxLines: 2, color: T.ink });
      K.text(els, x + pl + d + 12, ty + pn + 2, iw, rB + 4, p.title, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
    });
    if (s.takeaway) {
      K.roundrect(els, CX, barY, CW, barH, T.blue);
      K.text(els, CX + 20, barY, CW - 40, barH, s.takeaway, { weight: 500, max: 12, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Team approach: role blocks + client roles column — proposals page 302 ---------- */
  add('P66_TEAM_ROLES', 'team', { min: 4, max: 6, needs: 'items',
    desc: 'team approach: 4-6 role blocks (items[{title: role, text: "Serves as ..."}]) in a 2 x 2 or 2 x 3 grid, with a column on the right for the client roles or the way of working (right{label, points[] or text})',
    words: '15-30' }, function (s) {
    var items = K.items(s, 6);
    var n = items.length;
    if (n < 4 || n > 6) return null;
    var right = s.right || null, rPts = right ? list_(right.points, 6) : [], rText = right && right.text;
    var hasR = !!(right && (rPts.length || rText));
    var els = [];
    var top = K.header(els, s);
    var avail = BOTTOM - top;
    var rw = hasR ? 176 : 0, lw = CW - (hasR ? rw + 24 : 0);
    var cols = n === 4 ? 2 : 3, rows = 2, gap = 0;
    var cw = lw / cols, iw = cw - 32;
    var hB = maxH_(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500);
    var bB = maxH_(items.map(function (it) { return it.text; }), iw, TSZ.body, 400);
    var need = 0;
    items.forEach(function (it) { need = Math.max(need, 18 + tH_(it.title, iw, TSZ.heading, 500) + 8 + tH_(it.text, iw, TSZ.body) + 18); });
    var ch = avail / 2;
    if (need > ch + 2) return null;
    ch = Math.min(ch, Math.max(need + 20, ch * 0.8));
    var gy = top + (avail - ch * 2) / 2;
    K.rect(els, CX, gy, lw, ch * 2, T.bgLight);
    items.forEach(function (it, i) {
      var x = CX + (i % cols) * cw, y = gy + Math.floor(i / cols) * ch;
      var h1 = tH_(it.title, iw, TSZ.heading, 500);
      K.text(els, x + 16, y + 18, iw, h1, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.blue });
      K.text(els, x + 16, y + 18 + h1 + 8, iw, bB + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
    });
    // thin dividers between blocks, a small plus where they meet
    for (var c = 1; c < cols; c++) K.line(els, CX + c * cw, gy + 12, CX + c * cw, gy + ch * 2 - 12, T.cardLine, 0.75);
    K.line(els, CX + 12, gy + ch, CX + lw - 12, gy + ch, T.cardLine, 0.75);
    for (c = 1; c < cols; c++) {
      K.rect(els, CX + c * cw - 6, gy + ch - 6, 12, 12, T.bgLight);
      K.line(els, CX + c * cw - 6, gy + ch, CX + c * cw + 6, gy + ch, T.slate, 1);
      K.line(els, CX + c * cw, gy + ch - 6, CX + c * cw, gy + ch + 6, T.slate, 1);
    }
    if (hasR) {
      var rx = CX + lw + 24;
      K.line(els, rx - 12, gy, rx - 12, gy + ch * 2, T.ink, 0.75);
      var y = gy + 18;
      y += K.text(els, rx, y, rw, 32, right.label || right.title || 'Client roles', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.blue }).height + 12;
      if (rText) y += K.text(els, rx, y, rw, 110, rText, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 8, color: T.ink }).height + 12;
      if (rPts.length) {
        var rH = (gy + ch * 2 - 14 - y) / rPts.length;
        rPts.forEach(function (p, i) {
          var py = y + i * Math.min(rH, 34);
          K.rect(els, rx, py + 4, 6, 6, T.blue);
          K.text(els, rx + 14, py, rw - 14, Math.min(rH, 34) - 4, p, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink });
        });
      }
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Pricing / rate card table — proposals pages 130, 53, 219, 310 ---------- */
  function cell_(c) { return c == null ? '' : (typeof c === 'object' ? String(c.value || c.text || c.label || c.title || '') : String(c)); }
  add('P66_PRICING', 'table', { min: 2, max: 8, needs: 'rows',
    desc: 'pricing / rate card: blue header row (columns[], 2-4), 2-8 rows (rows[][]) with right-aligned prices, a highlighted total row (total = [label, value]) and an optional note box top right (note)',
    words: '3-10' }, function (s) {
    var cols = K.arr(s.columns, 4).map(cell_);
    var rows = (Array.isArray(s.rows) ? s.rows : []).slice(0, 9).map(function (r) {
      var o = (Array.isArray(r) ? r : [r]).slice(0, Math.max(cols.length, 1)).map(cell_);
      while (o.length < cols.length) o.push('');
      return o;
    });
    var nc = cols.length;
    if (nc < 2 || rows.length < 2 || rows.length > 8) return null;
    var total = Array.isArray(s.total) ? s.total.map(cell_) : (s.total && typeof s.total === 'object' ? [cell_(s.total.label), cell_(s.total.value)] : null);
    var els = [];
    var noteW = 210, nx = 688 - noteW, noteBottom = 0;
    var top = K.header(els, s, s.note ? { maxW: nx - X0 - 20 } : null);
    if (s.note) {
      var nh = tH_(s.note, noteW - 28, TSZ.body) + 22;
      K.rect(els, nx, 22, noteW, nh, T.bgLight);
      K.rect(els, nx, 22, 3, nh, T.blue);
      K.text(els, nx + 16, 33, noteW - 28, nh - 20, s.note, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 5, color: T.ink });
      noteBottom = 22 + nh + 16;
    }
    top = Math.max(top, noteBottom);
    // column widths: value columns fixed, the first column takes the rest
    var vw = nc === 2 ? 170 : (nc === 3 ? 140 : 120), fw = CW - vw * (nc - 1);
    var colX = [CX];
    for (var j = 1; j < nc; j++) colX.push(CX + fw + (j - 1) * vw);
    var colW = function (j) { return j === 0 ? fw : vw; };
    var pad = 14, hh = 28;
    var rowHs = rows.map(function (r) {
      var m = 0;
      r.forEach(function (c, j) { m = Math.max(m, tH_(c, colW(j) - 2 * pad, TSZ.body)); });
      return Math.max(30, m + 14);
    });
    var totH = total ? 34 : 0;
    var tableH = hh + rowHs.reduce(function (a, b) { return a + b; }, 0) + totH;
    var avail = BOTTOM - top;
    if (tableH > avail) return null;
    // stretch rows a little when there is room (rows up to 40)
    var extra = Math.min((avail - tableH) * 0.6, rows.length * 10);
    rowHs = rowHs.map(function (h) { return h + extra / rows.length; });
    tableH += extra;
    var y = top + Math.min(20, (avail - tableH) / 2);
    K.rect(els, CX, y, CW, hh, T.blue);
    cols.forEach(function (c, j) {
      K.text(els, colX[j] + pad, y, colW(j) - 2 * pad, hh, c, { weight: 500, max: TSZ.body, min: 9, maxLines: 1, align: j ? 'right' : 'left', valign: 'middle', color: T.white });
    });
    y += hh;
    rows.forEach(function (r, i) {
      var h = rowHs[i];
      K.rect(els, CX, y, CW, h, i % 2 ? T.bgLight : T.white);
      r.forEach(function (c, j) {
        K.text(els, colX[j] + pad, y, colW(j) - 2 * pad, h, c, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, align: j ? 'right' : 'left', valign: 'middle', color: T.ink });
      });
      K.line(els, CX, y + h, CX + CW, y + h, T.cardLine, 0.5);
      y += h;
    });
    if (total) {
      K.rect(els, CX, y, CW, totH, T.bgLight);
      K.line(els, CX, y, CX + CW, y, T.blue, 1.5);
      K.text(els, CX + pad, y, fw - 2 * pad, totH, total[0] || 'Total', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, valign: 'middle', color: T.blue });
      K.text(els, colX[nc - 1] + pad, y, vw - 2 * pad, totH, total[total.length - 1], { weight: 500, max: 12, min: TSZ.heading, maxLines: 1, align: 'right', valign: 'middle', color: T.blue });
    }
    for (j = 1; j < nc; j++) K.line(els, colX[j], top + Math.min(20, (avail - tableH) / 2) + hh, colX[j], y + totH, T.cardLine, 0.5);
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Package options: 3 cards, middle one highlighted — proposals page 309 ---------- */
  add('P66_PACKAGES', 'cards', { min: 2, max: 4, needs: 'items',
    desc: 'package options: 2-4 cards side by side (items[{title: package name, value: price, label: period line such as "per month, 6 months", points[]: what is included}]); the middle card (or the item with highlight: true) is highlighted',
    words: '6-14' }, function (s) {
    var items = K.items(s, 4).filter(function (it) { return it && it.title && it.value; });
    var n = items.length;
    if (n < 2 || n > 4) return null;
    var hi = -1;
    items.forEach(function (it, i) { if (it.highlight) hi = i; });
    if (hi < 0) hi = n === 3 ? 1 : -1;
    var els = [];
    var top = K.header(els, s);
    var avail = BOTTOM - top - 8;
    var gap = 16, cw = Math.min(200, (CW - gap * (n - 1)) / n), iw = cw - 32;
    var x0 = CX + (CW - (cw * n + gap * (n - 1))) / 2;
    var tB = maxH_(items.map(function (it) { return it.title; }), iw, 13, 500);
    var vSize = K.uniformSize(items.map(function (it) { return it.value; }), iw, 40, { font: 'mono', weight: 500, max: 26, min: 16, maxLines: 1 });
    var vH = lh_(vSize, 'mono');
    var lB = maxH_(items.map(function (it) { return it.label; }), iw, TSZ.body, 400);
    var listH = 0;
    items.forEach(function (it) {
      var h = 0;
      list_(it.points, 7).forEach(function (p) { h += tH_(p, iw - 16, TSZ.body) + 6; });
      listH = Math.max(listH, h);
    });
    var head = 24 + tB + 8 + vH + 4 + lB + 16;
    var need = head + 16 + listH + 14;
    if (need > avail + 2) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.85));
    var y = top + 8;
    items.forEach(function (it, i) {
      var x = x0 + i * (cw + gap), on = i === hi;
      K.rect(els, x, y, cw, ch, on ? T.white : T.bgLight, on ? { color: T.blue, width: 1 } : { color: T.cardLine, width: 0.75 });
      if (on) K.rect(els, x, y, cw, 6, T.blue);
      var yy = y + 24;
      K.text(els, x + 16, yy, iw, tB, it.title, { weight: 500, max: 13, min: 13, align: 'center', color: T.blue });
      yy += tB + 8;
      K.text(els, x + 16, yy, iw, vH, it.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, align: 'center', color: T.ink });
      yy += vH + 4;
      if (it.label) K.text(els, x + 16, yy, iw, lB + 2, it.label, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.ink });
      yy = y + head;
      K.line(els, x + 16, yy, x + cw - 16, yy, on ? T.blue : T.slate, 0.75);
      K.bulletList(els, x + 16, yy + 16, iw, y + ch - yy - 26, list_(it.points, 7), { max: TSZ.body, min: TSZ.body, gap: 6 });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Investment summary: headline number + figure tiles — proposals pages 139, 275, 276 ---------- */
  add('P66_INVESTMENT', 'stats', { min: 0, max: 6, needs: 'value',
    desc: 'investment summary: big headline number centred in a panel (value, label = what it is, text = variance line such as "ROM variance +/- 5%", note = one-line basis), a row of 3-6 figure tiles (items[{value,label}]) and a row of 2-4 count tiles (stats[{value,label}])',
    words: '2-6' }, function (s) {
    if (!s.value) return null;
    var items = K.items(s, 6).filter(function (it) { return it && it.value; });
    var stats = K.arr(s.stats, 4).filter(function (it) { return it && it.value; });
    if (items.length && items.length < 3) return null;
    var els = [];
    var top = K.header(els, s);
    var avail = BOTTOM - top;
    var tileH = items.length ? 52 : 0, statH = stats.length ? 56 : 0, gap = 10;
    var ph = avail - (tileH ? tileH + gap : 0) - (statH ? statH + gap : 0);
    ph = Math.min(ph, 170);
    if (ph < 104) return null;
    var used = ph + (tileH ? tileH + gap : 0) + (statH ? statH + gap : 0);
    var y = top + Math.max(0, (avail - used) / 2);
    // panel
    K.rect(els, CX, y, CW, ph, T.bgLight);
    var vS = ph < 150 ? 36 : 42, blk = (s.label ? 20 : 0) + lh_(vS, 'mono') + (s.text ? 22 : 0);
    var vy = y + (ph - blk - (s.note ? 20 : 0)) / 2;
    if (s.label) { K.text(els, CX + 20, vy, CW - 40, 16, s.label, { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, align: 'center', color: T.ink }); vy += 20; }
    K.text(els, CX + 20, vy, CW - 40, lh_(vS, 'mono'), s.value, { font: 'mono', weight: 500, max: vS, min: 30, maxLines: 1, align: 'center', color: T.blue });
    vy += lh_(vS, 'mono');
    if (s.text) K.text(els, CX + 20, vy + 4, CW - 40, 18, s.text, { weight: 500, max: 13, min: 11, maxLines: 1, align: 'center', color: T.ink });
    if (s.note) K.text(els, CX + 20, y + ph - 24, CW - 40, 14, s.note, { weight: 400, max: 9, min: 9, maxLines: 1, align: 'center', color: T.ink });
    y += ph + gap;
    function tiles(list, h, big, bar) {
      var n = list.length, tg = 10, tw = (CW - tg * (n - 1)) / n;
      var vSize = K.uniformSize(list.map(function (it) { return it.value; }), tw - 16, 30, { font: 'mono', weight: 500, max: big ? 20 : 15, min: 11, maxLines: 1 });
      var lSize = K.uniformSize(list.map(function (it) { return it.label; }), tw - 16, 26, { weight: 400, max: big ? TSZ.body : 9.5, min: 9, maxLines: 2 });
      var vH = lh_(vSize, 'mono'), lB = maxH_(list.map(function (it) { return it.label; }), tw - 16, lSize, 400);
      list.forEach(function (it, i) {
        var x = CX + i * (tw + tg), last = !big && i === n - 1 && it.highlight !== false && n >= 4;
        K.rect(els, x, y, tw, h, last ? T.bgLight : T.white, { color: T.cardLine, width: 0.75 });
        if (bar) K.rect(els, x, y, tw, 3, T.blue);
        var by = y + (h - vH - 2 - lB) / 2 + (bar ? 1.5 : 0);
        K.text(els, x + 8, by, tw - 16, vH, it.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, align: 'center', color: last ? T.blue : T.ink });
        K.text(els, x + 8, by + vH + 2, tw - 16, lB + 2, it.label, { weight: 400, max: lSize, min: lSize, maxLines: 2, align: 'center', color: T.ink });
      });
      y += h + gap;
    }
    if (items.length) tiles(items, tileH, false, false);
    if (stats.length) tiles(stats, statH, true, true);
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Next steps: light title panel + numbered vertical list — proposals pages 220, 335, 29 ---------- */
  add('P66_NEXT_STEPS', 'next_steps', { min: 3, max: 6, needs: 'items',
    desc: 'next steps: light panel on the left third with a large "Next steps" title, a vertical numbered list on the right (items[{title, text}], 3-6 steps, text one line)',
    words: '5-12' }, function (s) {
    var items = K.items(s, 6).map(function (it) { return typeof it === 'string' ? { title: it, text: '' } : it; }).filter(function (it) { return it && it.title; });
    var n = items.length;
    if (n < 3 || n > 6) return null;
    var els = [];
    var pw = 250;
    K.rect(els, 0, 0, pw, H, T.bgLight);
    K.line(els, pw, 0, pw, H, T.cardLine, 0.75);
    K.image(els, 'logo-dark', X0, 26, 64, 15);
    var tt = K.text(els, X0, 0, pw - 64, 80, s.title || 'Next steps', { weight: 500, max: 28, min: 20, maxLines: 2, color: T.ink });
    var leadH = s.lead ? tH_(s.lead, pw - 64, TSZ.body) + 10 : 0;
    // re-place title vertically centred (title + rule + lead)
    els.pop();
    var blockH = tt.height + 14 + leadH, ty = (H - blockH) / 2 - 6;
    K.text(els, X0, ty, pw - 64, tt.height, s.title || 'Next steps', { weight: 500, max: tt.size, min: tt.size, maxLines: 2, color: T.ink });
    K.rect(els, X0, ty + tt.height + 6, 40, 3, T.blue);
    if (s.lead) K.text(els, X0, ty + tt.height + 18, pw - 64, leadH, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 4, color: T.ink });
    // numbered list
    var lx = pw + 64, sq = 24, tx = lx + sq + 18, tw = 688 - tx;
    var hB = maxH_(items.map(function (it) { return it.title; }), tw, TSZ.heading, 500);
    var bB = maxH_(items.map(function (it) { return it.text; }), tw, TSZ.body, 400);
    var rowNeed = Math.max(sq, hB + (bB ? 3 + bB : 0));
    var rowH = Math.min(64, (330 - 40) / n);
    if (rowNeed > rowH - 8) return null;
    var y0 = 40 + ((330 - 40) - rowH * n) / 2 + (rowH - rowNeed) / 2;
    K.line(els, lx + sq / 2, y0 - 14, lx + sq / 2, y0 + (n - 1) * rowH + sq + 14, T.slate, 1);
    items.forEach(function (it, i) {
      var y = y0 + i * rowH;
      K.rect(els, lx, y, sq, sq, T.blue);
      K.text(els, lx, y, sq, sq, String(i + 1), { font: 'mono', weight: 500, max: 12, min: 12, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var hh = tH_(it.title, tw, TSZ.heading, 500);
      var ty2 = y + (it.text ? 0 : (sq - hh) / 2) + (hh < sq && it.text ? 2 : 0);
      K.text(els, tx, ty2, tw, hh, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.ink });
      if (it.text) K.text(els, tx, ty2 + hh + 3, tw, bB + 4, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Proposed team structure: governance over two lanes — proposals page 329 (cleaned up) ---------- */
  add('P66_TEAM_STRUCTURE', 'team', { min: 2, max: 2, needs: 'teams',
    desc: 'proposed team structure: a governance box on top (governance: text or {title, text}) connected to two lanes, the client team and the 66degrees team (teams[{name, roles[]: strings or {title, text of 2-5 words}}], 2-8 roles each)',
    words: '3-12' }, function (s) {
    var teams = K.arr(s.teams, 2).map(function (t) {
      // roles[] (proposal shape) or stakeholders[] + specialists[] (General team shape): the role is shown, never an invented name
      var list = K.arr(t.roles || t.points || t.members, 8);
      if (!list.length) list = K.arr(t.stakeholders, 8).concat(K.arr(t.specialists, 8)).slice(0, 8);
      return { name: K.str(t.name || t.title || t.label), roles: list.map(function (r) { return typeof r === 'string' ? { title: r, text: '' } : { title: r.title || r.role || r.name || '', text: r.text || r.responsibility || '' }; }).filter(function (r) { return r.title; }) };
    });
    if (teams.length !== 2 || teams.some(function (t) { return !t.roles.length; })) return null;
    var els = [];
    var top = K.header(els, s);
    var gov = s.governance, govT = gov ? (typeof gov === 'string' ? 'Governance' : (gov.title || 'Governance')) : '', govX = gov ? (typeof gov === 'string' ? gov : (gov.text || '')) : '';
    var gw = 440, gx = CX + (CW - gw) / 2, gh = 0;
    if (gov) {
      gh = 10 + 15 + (govX ? 2 + tH_(govX, gw - 32, TSZ.body) : 0) + 10;
      K.rect(els, gx, top, gw, gh, T.ink);
      K.text(els, gx + 16, top + 10, gw - 32, 16, govT, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', color: T.white });
      if (govX) K.text(els, gx + 16, top + 27, gw - 32, gh - 34, govX, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.white });
    }
    var lgap = 28, lw = (CW - lgap) / 2, ly = top + (gov ? gh + 24 : 0), lh = BOTTOM - ly;
    if (gov) {
      var my = top + gh + 12;
      K.line(els, W / 2, top + gh, W / 2, my, T.ink, 1);
      K.line(els, CX + lw / 2, my, CX + lw + lgap + lw / 2, my, T.ink, 1);
      K.line(els, CX + lw / 2, my, CX + lw / 2, ly, T.ink, 1);
      K.line(els, CX + lw + lgap + lw / 2, my, CX + lw + lgap + lw / 2, ly, T.ink, 1);
    }
    var headH = 30;
    var ok = true;
    var maxRows = Math.max.apply(null, teams.map(function (t) { var m = t.roles.length; return Math.ceil(m / (m > 3 ? 2 : 1)); }));
    teams.forEach(function (t, ti) {
      var x = CX + ti * (lw + lgap);
      K.rect(els, x, ly, lw, lh, T.bgLight);
      K.rect(els, x, ly, lw, headH, ti === 0 ? T.slate : T.blue);
      K.text(els, x + 14, ly, lw - 28, headH, t.name, { weight: 500, max: 12, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: ti === 0 ? T.ink : T.white });
      var m = t.roles.length, cols = m > 3 ? 2 : 1, rows = Math.ceil(m / cols), g = 8;
      var rw = (lw - 24 - (cols - 1) * g) / cols, area = lh - headH - 24;
      var rh = Math.min(56, (area - (maxRows - 1) * g) / maxRows), iw = rw - 18;
      var need = 0;
      t.roles.forEach(function (r) { need = Math.max(need, tH_(r.title, iw, TSZ.heading, 500) + (r.text ? 2 + tH_(r.text, iw, TSZ.body) : 0) + 8); });
      if (need > rh + 1) ok = false;
      var ry0 = ly + headH + 12 + (area - maxRows * rh - (maxRows - 1) * g) / 2;
      t.roles.forEach(function (r, i) {
        var rx = x + 12 + (i % cols) * (rw + g), ry = ry0 + Math.floor(i / cols) * (rh + g);
        K.rect(els, rx, ry, rw, rh, T.white, { color: T.cardLine, width: 0.75 });
        K.rect(els, rx, ry, 3, rh, ti === 0 ? T.slate : T.blue);
        var bh = tH_(r.title, iw, TSZ.heading, 500) + (r.text ? 2 + tH_(r.text, iw, TSZ.body) : 0);
        var yy = ry + (rh - bh) / 2;
        var hh = K.text(els, rx + 11, yy, iw, 32, r.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink }).height;
        if (r.text) K.text(els, rx + 11, yy + hh + 2, iw, 30, r.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink });
      });
    });
    if (!ok) return null;
    return { bg: T.white, els: els, noBalance: true };
  });
})();
