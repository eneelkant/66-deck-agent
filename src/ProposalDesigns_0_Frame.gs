/* =========================================================================================================
   66° Deck Agent — Proposal Deck design library (V.1_42), part 0: frame slides
   Agenda (spiral for up to 7 sections; dark two columns or dark table of contents for longer agendas, continued
   on a second slide when needed), section dividers (dark streaks numbered, navy with its topics) and the light
   workstream divider. Cover and Thank you stay the strict designs in Engine.gs.
   Every design here draws only in a Proposal Deck (ENGINE.addProposalDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0;
  var add = ENGINE.addProposalDesign;

  function agendaTitle_(s, fallback) {
    var t = String(s.title || fallback || 'Agenda');
    return s.continued ? t.replace(/\s*\(continued\)\s*$/i, '') + ' (continued)' : t;
  }
  // Agenda rows: { title, points[] } (sub-topics optional)
  function agendaRows_(s) {
    return K.arr(s.items, 24).map(function (it) {
      if (typeof it === 'string') return { title: it, points: [] };
      return { title: it.title || it.text || '', points: K.arr(it.points || it.topics, 8).map(K.str).filter(Boolean) };
    }).filter(function (r) { return r.title; });
  }

  /* ---------- Agenda D: spiral (3-7 sections) — proposals page 268 ---------- */
  add('P66_AGENDA_SPIRAL', 'agenda', { min: 3, max: 7, desc: 'proposal agenda: spiral graphic with the sections as tags on a dotted arc (3-7 sections)' }, function (s) {
    var rows = agendaRows_(s), n = rows.length;
    if (n < 3 || n > 7) return null;
    // V.1_69: a section name that would be cut short in its tag (more than two lines) gives the agenda to the list design
    if (rows.some(function (r) { return K.textH(String(r.title), (168 - 16) * 0.9, 9.5, 500) > 2 * K.lineHeight('sans', 9.5) + 1; })) return null;   // (measured 10% narrower, as Slides wraps)
    var els = [];
    K.text(els, X0, 24, W - 2 * X0, 30, agendaTitle_(s), { weight: 500, max: 20, min: 15, maxLines: 2, color: T.ink });   // V.1_69: a long agenda title is never cut
    // spiral of short dashes (three turns, getting smaller towards the centre)
    var cx = 236, cy = 214;
    // dashes along a spiral: each dash lies along the curve (tangent), the curve winds inwards over ~2.6 turns
    var a = 0, r = 96;
    while (r > 30) {
      var px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      K.rbox(els, px, py, 15, 4.2, (a * 180 / Math.PI + 90 + 26) % 360, T.ink);
      var step = 22 / r;                                   // even spacing along the curve
      a += step; r -= 4.1 * step;
    }
    // dotted arc with blue nodes, one per section, and a tag for each section
    var arcR = 128, span = Math.min(110, 22 * (n - 1) + 10), a0 = -span / 2;
    rows.forEach(function (r, i) {
      var ang = (a0 + (n === 1 ? 0 : span * i / (n - 1))) * Math.PI / 180;
      var nx = cx + arcR * Math.cos(ang), ny = cy + arcR * Math.sin(ang);
      if (i < n - 1) {
        var ang2 = (a0 + span * (i + 1) / (n - 1)) * Math.PI / 180;
        for (var d = 0; d < 1; d += 0.12) {
          var aa = ang + (ang2 - ang) * d;
          K.ellipse(els, cx + arcR * Math.cos(aa) - 0.8, cy + arcR * Math.sin(aa) - 0.8, 1.6, 1.6, T.ink);
        }
      }
      K.ring(els, nx - 5, ny - 5, 10, T.white, T.blue, 1);
      K.ellipse(els, nx - 2.5, ny - 2.5, 5, 5, T.blue);
      var tw = 168, th = 30, tx = 446 + (i % 2) * 18, ty = ny - th / 2;
      K.dashedLine(els, nx + 7, ny, tx, ny, '#9AA4B2', 0.6, 1.5, 2);
      K.roundrect(els, tx, ty, tw, th, '#ECECEC', { color: '#DBDDE1', width: 0.75 });
      K.text(els, tx + 8, ty + 1, tw - 16, th - 2, r.title, { weight: 500, max: TSZ.heading, min: 9.5, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  // Navy header band with the 66° watermark, white title (agenda B and C)
  function navyBand_(els, title) {
    K.image(els, 'navy-band', 0, 0, W, 112);
    K.text(els, X0, 40, 520, 34, title, { weight: 500, max: 22, min: 18, maxLines: 1, color: T.white, valign: 'middle' });
  }

  /* ---------- Agenda C: dark two columns (sections with their topics) — proposals page 57 ---------- */
  add('P66_AGENDA_TWO_COLUMNS', 'agenda', { min: 6, max: 24, desc: 'proposal agenda: navy band, sections in two columns with their topics underneath' }, function (s) {
    var rows = agendaRows_(s);
    if (rows.length < 2) return null;
    var els = [];
    navyBand_(els, agendaTitle_(s));
    // lines needed: one per section + one per topic; columns balanced by lines
    var lines = rows.map(function (r) { return 1 + r.points.length; });
    var total = lines.reduce(function (a, b) { return a + b; }, 0);
    if (total > 26) return null;                                  // the planner continues the agenda on a second slide
    var half = total / 2, acc = 0, split = rows.length;
    for (var i = 0; i < rows.length; i++) { acc += lines[i]; if (acc >= half) { split = i + 1; break; } }
    if (split >= rows.length && rows.length > 1) split = Math.ceil(rows.length / 2);
    var cols = [rows.slice(0, split), rows.slice(split)];
    var top = 136, maxLines = Math.max(cols[0].reduce(function (a, r) { return a + 1 + r.points.length; }, 0), cols[1].reduce(function (a, r) { return a + 1 + r.points.length; }, 0));
    var lh = Math.min(22, (350 - top) / Math.max(1, maxLines));
    var sec = 0;
    cols.forEach(function (list, c) {
      var x = X0 + 6 + c * 300, y = top;
      list.forEach(function (r) {
        sec++;
        // V.1_63: each section carries its number (01, 02 ...) like the transition slides
        K.text(els, x - 4, y, 22, lh, K.pad2(sec), { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, color: T.blue, valign: 'middle' });
        K.text(els, x + 20, y, 264, lh, r.title, { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, color: T.ink, valign: 'middle' });
        y += lh;
        r.points.forEach(function (p) {
          K.ring(els, x + 22, y + lh / 2 - 2.5, 5, T.white, T.ink, 0.6);
          K.text(els, x + 36, y, 248, lh, p, { weight: 400, max: TSZ.body, min: 9, maxLines: 1, color: T.body, valign: 'middle' });
          y += lh;
        });
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Agenda B: dark 66° table of contents — proposals page 32 ---------- */
  add('P66_AGENDA_CONTENTS', 'agenda', { min: 6, max: 11, desc: 'proposal agenda: navy band with the 66° watermark, one list of sections below' }, function (s) {
    var rows = agendaRows_(s), n = rows.length;
    if (n < 2 || n > 11) return null;
    var els = [];
    navyBand_(els, agendaTitle_(s, 'Table of contents'));
    var top = 138, lh = Math.min(24, (350 - top) / n);
    rows.forEach(function (r, i) {
      var y = top + i * lh;
      K.text(els, X0 + 2, y, 24, lh, K.pad2(i + 1), { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, color: T.blue, valign: 'middle' });   // V.1_63
      K.text(els, X0 + 30, y, 554, lh, r.title, { weight: 400, max: TSZ.heading, min: 10, maxLines: 1, color: T.ink, valign: 'middle' });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- Section divider A: dark streaks, numbered — proposals pages 3, 6, 9 ... ---------- */
  add('P66_SECTION_DARK', 'section', { desc: 'proposal section divider: dark streaks, section number and title' }, function (s, lctx) {
    var els = [];
    var no = s.noNumber ? '' : (s.number || (lctx && lctx.sectionNo ? K.pad2(lctx.sectionNo) : ''));   // V.1_63: a workstream has none
    if (no) K.text(els, 32.4, 150, 80, 26, String(no), { weight: 400, max: 18, min: 16, maxLines: 1, color: T.white });
    var t = K.text(els, 32.4, 180, 330, 60, s.title, { weight: 400, max: 15, min: 13, maxLines: 2, color: T.white });
    var lw = Math.min(330, Math.max(110, (t.width || 160) + 6));
    K.line(els, 33.4, 180 + t.height + 6, 33.4 + lw, 180 + t.height + 6, T.white, 0.75);
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  });

  /* ---------- Section divider B: navy, title and its topics — proposals pages 166, 170 ... ---------- */
  add('P66_SECTION_NAVY', 'section', { desc: 'proposal section divider: navy with the 66° watermark, title and the topics of the section' }, function (s, lctx) {
    var els = [];
    K.image(els, 'mark-white', 32.4, 26, 30, 20);
    var pts = K.arr(s.points || s.topics || [], 6).map(K.str).filter(Boolean);
    var y = pts.length ? 188 : 200;
    var t = K.text(els, 32.4, y, 360, 50, s.title, { weight: 400, max: 18, min: 15, maxLines: 2, color: T.white });
    y += t.height + 8;
    pts.forEach(function (p) {
      K.ellipse(els, 40, y + 4, 4.5, 4.5, T.white);
      var r = K.text(els, 52, y, 330, 14, p, { weight: 400, max: 9.5, min: 9, maxLines: 1, color: T.white });
      y += Math.max(13, r.height + 1);
    });
    return { bg: T.ink, bgImage: 'navy-bg', els: els, dark: true, noBalance: true, noFooter: true };
  });

  /* ---------- Light workstream divider: title only — proposals pages 68, 100 ---------- */
  add('P66_SECTION_LIGHT', 'section', { desc: 'proposal workstream divider inside a section: light, 66degrees wordmark, title, 66° watermark' }, function (s) {
    var els = [];
    K.image(els, 'logo-dark', 32.4, 24, 64, 15);
    K.image(els, 'watermark-66', 420, 200, 300, 205);
    var t = K.text(els, 32.4, 196, 380, 50, s.title, { weight: 400, max: 18, min: 15, maxLines: 2, color: T.ink });
    K.line(els, 33.4, 196 + t.height + 6, 33.4 + Math.min(360, Math.max(120, (t.width || 160) + 6)), 196 + t.height + 6, '#9AA4B2', 0.75);
    return { bg: '#EEF1F3', els: els, noBalance: true, noFooter: true };
  });
})();
