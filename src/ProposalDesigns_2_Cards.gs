/* =========================================================================================================
   66° Deck Agent — Proposal Deck design library (V.1_42), part 2: cards, panels and grids
   Icon columns, question columns with a photo strip, two panels, two cards with an arrow, card grids, 2 x 2 cards
   with a callout, deliverable rows, pros and cons, KPI tiles with categories, personas, diagonal options, app tile
   grid, pillars with name chips, paradigm cards (dark) and paradigm columns (light), text with an illustration.
   Every design here draws only in a Proposal Deck (ENGINE.addProposalDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addProposalDesign;
  var LINE = T.cardLine || '#DBDDE1', SLATE = T.slate || '#B3C5D0', ALT = T.panelAlt || '#ECECEC';
  var BLUE_2 = '#4D86FF', BLUE_3 = '#80A9FF';          // tints of the 66° blue (diagonal options)

  /* ---------------- helpers ---------------- */
  function lh(size) { return K.lineHeight('sans', size); }
  function th(str, w, size, weight) { return str ? K.textH(String(str), w, size, weight || 400) : 0; }
  function maxH(list, w, size, weight) {
    var m = 0;
    list.forEach(function (t) { m = Math.max(m, th(t, w, size, weight)); });
    return m;
  }
  // height of a bullet list drawn with K.bulletList (text indented 16pt)
  function ptsH(points, w, size, gap) {
    if (!points || !points.length) return 0;
    var t = 0;
    points.forEach(function (p) { t += th(p, w - 16, size) + gap; });
    return t - gap;
  }
  function norm(it) {
    if (typeof it === 'string') return { title: it, text: '', points: [], icon: '' };
    it = it || {};
    return {
      title: String(it.title || it.label || it.name || '').trim(), text: String(it.text || it.description || '').trim(),
      points: K.arr(it.points || it.bullets, 8).map(K.str).map(function (p) { return String(p).trim(); }).filter(Boolean),
      icon: it.icon || '', material: it.material || '', value: it.value, label: it.label
    };
  }
  function itemsOf(s, max) { return K.items(s, max + 1).map(norm).filter(function (it) { return it.title; }); }
  // A line icon in a round badge; the icon is chosen from the item's words when no icon was planned
  function badge(els, it, x, y, d, fill, onDark) {
    K.ellipse(els, x, y, d, d, fill);
    var src = (it.icon || it.material) ? it : { icon: (it.title + ' ' + it.text).toLowerCase().slice(0, 160) };
    var sz = Math.round(d * 0.58);
    K.icon(els, src, x + (d - sz) / 2, y + (d - sz) / 2, sz, !!onDark);
  }
  function heading(els, x, y, w, str, color, maxLines) {
    return K.text(els, x, y, w, 60, str, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: maxLines || 3, color: color || T.ink });
  }
  function body(els, x, y, w, h, str, color) {
    return K.text(els, x, y, w, Math.max(h, lh(TSZ.body)), str, { weight: 400, max: TSZ.body, min: TSZ.body, color: color || T.ink });
  }
  function bullets(els, x, y, w, h, points, gap, color) {
    return K.bulletList(els, x, y, w, Math.max(h, lh(TSZ.body)), points, { max: TSZ.body, min: TSZ.body, gap: gap || 6, color: color || T.ink, bullet: color || T.ink });
  }
  // right-pointing thin arrow
  function arrow(els, x1, x2, y, color) {
    K.line(els, x1, y, x2, y, color, 1);
    K.line(els, x2 - 6, y - 4, x2, y, color, 1);
    K.line(els, x2 - 6, y + 4, x2, y, color, 1);
  }
  // Light area on the left of a dark photo slide: the photo stays visible from x to the right edge
  function photoPanel(els, x) { K.rect(els, 0, 0, x, H, T.bgLight); }
  function photoOut(els) { return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true }; }

  /* ---------- 1. Icon columns — proposals page 124 (117, 167, 181, 186, 270, 323, 324) ---------- */
  add('P66_ICON_COLUMNS', 'cards', { min: 3, max: 6, needs: 'items[{title,text,icon}]',
    desc: 'one row of 3-6 light cards: round icon top-right, blue heading, divider, short text (stages, capabilities, pillars)', words: '15-35' }, function (s) {
    var items = itemsOf(s, 6), n = items.length;
    if (n < 3 || n > 6) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = n >= 5 ? 8 : 12, cw = (CW - gap * (n - 1)) / n, pad = n >= 5 ? 10 : 14, iw = cw - 2 * pad;
    var bd = 28;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 3);
    var bB = maxH(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var need = pad + bd + 8 + hB + 10 + 1 + 10 + bB + 16, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.88));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = top;
      K.rect(els, x, y, cw, ch, T.bgLight);
      badge(els, it, x + cw - pad - bd, y + pad, bd, T.white);
      var hy = y + pad + bd + 8;
      heading(els, x + pad, hy, iw, it.title, T.blue, 3);
      var ly = hy + hB + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      body(els, x + pad, ly + 10, iw, y + ch - ly - 20, it.text);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 2. Question columns + photo strip — proposals page 90 (64, 83, 94) ---------- */
  add('P66_COLUMNS_PHOTO', 'cards', { min: 3, max: 4, needs: 'items[{title,icon,points[]}]',
    desc: '3-4 white cards with an icon, a short question-style heading (What? How? Who?) and 2-5 bullets each, dark photo strip on the right', words: '4-10 per bullet' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 3 || n > 4) return null;
    items.forEach(function (it) { if (!it.points.length && it.text) it.points = [it.text]; });
    if (items.some(function (it) { return !it.points.length || it.points.length > 6; })) return null;
    var els = [];
    var px = n === 3 ? 548 : 600;
    photoPanel(els, px);
    var top = K.header(els, s, { maxW: px - 70 }) + 4;
    var gap = 12, cw = (px - 24 - CX - gap * (n - 1)) / n, pad = 14, iw = cw - 2 * pad, bd = 30;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var pB = 0;
    items.forEach(function (it) { pB = Math.max(pB, ptsH(it.points, iw, TSZ.body, 6)); });
    var need = pad + bd + 12 + hB + 10 + 1 + 12 + pB + 16, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.88));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = top;
      K.rect(els, x, y, cw, ch, T.white, { color: LINE, width: 0.75 });
      badge(els, it, x + pad, y + pad, bd, T.bgLight);
      var hy = y + pad + bd + 12;
      heading(els, x + pad, hy, iw, it.title, T.blue, 2);
      var ly = hy + hB + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      bullets(els, x + pad, ly + 12, iw, y + ch - ly - 24, it.points, 6);
    });
    return photoOut(els);
  });

  /* ---------- 3. Two panels (blue / slate header bars) + photo strip — proposals page 11 (59, 62, 315, 22) ---------- */
  function sideOf(o) {
    o = o || {};
    return { label: String(o.label || o.title || '').trim(), title: o.label ? String(o.title || '').trim() : '', text: String(o.text || '').trim(),
      points: K.arr(o.points, 8).map(K.str).map(function (p) { return String(p).trim(); }).filter(Boolean) };
  }
  add('P66_TWO_PANELS', 'comparison', { min: 2, max: 2, needs: 'left{label,title,text,points[]}, right{...}',
    desc: 'two panels side by side, blue and slate header bars (label + optional short title), optional intro line and bullets, dark photo strip on the right (two options, environments, phases)', words: '6-14 per bullet' }, function (s) {
    var L2 = sideOf(s.left), R2 = sideOf(s.right);
    if (!L2.label || !R2.label || (!L2.points.length && !L2.text) || (!R2.points.length && !R2.text)) return null;
    var els = [];
    var px = 548;
    photoPanel(els, px);
    var top = K.header(els, s, { maxW: px - 70 }) + 6;
    var gap = 14, pw = (px - 24 - CX - gap) / 2, pad = 14, iw = pw - 2 * pad;
    function headH(p) { return 12 + th(p.label, iw, TSZ.heading, 500) + (p.title ? 2 + th(p.title, iw, TSZ.body) : 0) + 12; }
    function bodyH(p) { return 14 + (p.text ? th(p.text, iw, TSZ.body, 500) + (p.points.length ? 10 : 0) : 0) + ptsH(p.points, iw, TSZ.body, 7) + 16; }
    var hh = Math.max(headH(L2), headH(R2), 40);
    var need = hh + Math.max(bodyH(L2), bodyH(R2)), avail = BOTTOM - top;
    if (need > avail) return null;
    var ph = K.boxH(need, avail);
    [L2, R2].forEach(function (p, i) {
      var x = CX + i * (pw + gap), y = top, fill = i === 0 ? T.blue : SLATE, fg = i === 0 ? T.white : T.ink;
      K.roundrect(els, x, y, pw, hh + 8, fill);
      K.rect(els, x, y + hh, pw, ph - hh, T.white, { color: LINE, width: 0.75 });
      var tH = th(p.label, iw, TSZ.heading, 500) + (p.title ? 2 + th(p.title, iw, TSZ.body) : 0);
      var ty = y + (hh - tH) / 2;
      var r = K.text(els, x + pad, ty, iw, 40, p.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: 'center', color: fg });
      if (p.title) K.text(els, x + pad, ty + r.height + 2, iw, 30, p.title, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: fg });
      var cy = y + hh + 14;
      if (p.text) {
        var t = K.text(els, x + pad, cy, iw, 60, p.text, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.ink });
        cy += t.height + 10;
      }
      bullets(els, x + pad, cy, iw, y + ph - cy - 12, p.points, 7);
    });
    return photoOut(els);
  });

  /* ---------- 4. Two cards with an arrow + photo panel with a caption — proposals page 169 (184, 172, 174, 179, 242) ---------- */
  add('P66_TWO_CARDS_PHOTO', 'cards', { min: 2, max: 2, needs: 'items[{title,text,points[],icon}] (2), callout{title}',
    desc: 'two white cards (icon, blue heading, short text and/or bullets) joined by an arrow, dark photo on the right with a short caption band (from / to, before / after, today / with AI)', words: '20-50' }, function (s) {
    var items = itemsOf(s, 2), n = items.length;
    if (n !== 2) return null;
    if (items.some(function (it) { return !it.text && !it.points.length; })) return null;
    var cap = s.callout && (s.callout.title || s.callout.text) ? String(s.callout.title || s.callout.text) : '';
    var els = [];
    var px = 510;
    photoPanel(els, px);
    var top = K.header(els, s, { maxW: px - 50 }) + 10;
    if (cap) {
      K.rect(els, px, 34, W - px, 34, T.ink);
      K.icon(els, { icon: cap.toLowerCase() }, px + 16, 43, 16, true);
      K.text(els, px + 40, 34, W - px - 54, 34, cap, { weight: 500, max: TSZ.heading, min: 9.5, maxLines: 2, valign: 'middle', color: T.white });
    }
    var gap = 44, cw = (px - 22 - CX - gap) / 2, pad = 16, iw = cw - 2 * pad, bd = 28;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    function bh(it) { return (it.text ? th(it.text, iw, TSZ.body) : 0) + (it.text && it.points.length ? 10 : 0) + ptsH(it.points, iw, TSZ.body, 6); }
    var need = pad + bd + 12 + hB + 10 + Math.max(bh(items[0]), bh(items[1])) + 18, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.62));
    var y0 = top + Math.max(0, (avail - ch) * 0.45);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = y0;
      K.rect(els, x, y, cw, ch, T.white, { color: LINE, width: 0.75 });
      badge(els, it, x + pad, y + pad, bd, T.bgLight);
      var hy = y + pad + bd + 12;
      heading(els, x + pad, hy, iw, it.title, T.blue, 2);
      var cy = hy + hB + 10;
      if (it.text) { var t = body(els, x + pad, cy, iw, th(it.text, iw, TSZ.body), it.text); cy += t.height + (it.points.length ? 10 : 0); }
      if (it.points.length) bullets(els, x + pad, cy, iw, y + ch - cy - 14, it.points, 6);
    });
    arrow(els, CX + cw + 8, CX + cw + gap - 8, y0 + ch / 2, T.ink);
    return photoOut(els);
  });

  /* ---------- 5. Card grid with blue rules — proposals page 8 (4, 129, 161, 175, 210, 212) ---------- */
  add('P66_CARD_GRID', 'cards', { min: 4, max: 8, needs: 'items[{title,text}]',
    desc: 'grid of 4-8 white text cards in two columns, each with a blue left rule, blue heading and 1-2 lines (tools, components, workstreams, requirements)', words: '8-20' }, function (s) {
    var items = itemsOf(s, 8), n = items.length;
    if (n < 4 || n > 8) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var rows = Math.ceil(n / 2), gap = rows >= 4 ? 8 : 12, cgap = 16, cw = (CW - cgap) / 2, padL = 18, iw = cw - padL - 14, vp = rows >= 4 ? 9 : 12;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var bB = maxH(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var need1 = vp + hB + 3 + bB + vp, avail = BOTTOM - top;
    var needAll = rows * need1 + (rows - 1) * gap;
    if (needAll > avail) return null;
    var total = K.boxH(needAll, avail), rh = (total - (rows - 1) * gap) / rows;
    items.forEach(function (it, i) {
      var r = Math.floor(i / 2), c = i % 2, full = (n % 2 === 1 && i === n - 1);
      var x = CX + (full ? 0 : c * (cw + cgap)), y = top + r * (rh + gap), w = full ? CW : cw;
      K.rect(els, x, y, w, rh, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, y, 3.5, rh, T.blue);
      var hy = y + Math.max(vp, (rh - need1) / 2 + vp);
      var ht = heading(els, x + padL, hy, w - padL - 14, it.title, T.blue, 2);
      body(els, x + padL, hy + ht.height + 3, w - padL - 14, y + rh - hy - ht.height - 3 - vp, it.text);
    });
    return { bg: T.bgLight, els: els, noBalance: true };
  });

  /* ---------- 6. 2 x 2 icon cards + a callout note top-right — proposals page 126 (23, 63, 277, 284, 316) ---------- */
  add('P66_CARDS_2X2', 'cards', { min: 4, max: 4, needs: 'items[{title,text,icon}] (4), callout{text}',
    desc: 'four light cards in a 2 x 2 grid (blue heading, icon, divider, short text) with a short callout note next to the title', words: '12-25; callout 12-25 words' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n !== 4) return null;
    var note = s.callout ? String(s.callout.text || s.callout.title || '').trim() : '';
    var els = [];
    var cwN = 206, cxN = W - X0 - cwN;
    var top = K.header(els, s, note ? { maxW: cxN - X0 - 20 } : null);
    if (note) {
      var nh = th(note, cwN - 28, TSZ.body) + 26;
      var ny = Math.max(22, top - 10 - nh * 0.55);
      K.line(els, 0, ny + nh * 0.62, cxN, ny + nh * 0.62, SLATE, 0.75);
      K.rect(els, cxN, ny, cwN, nh, T.white, { color: LINE, width: 0.75 });
      K.rect(els, cxN, ny, 3.5, nh, T.blue);
      body(els, cxN + 16, ny + 13, cwN - 28, nh - 26, note);
      top = Math.max(top, ny + nh + 16);
    }
    var inset = 24, gap = 14, cw = (CW - 2 * inset - gap) / 2, pad = 18, bd = 26, iw = cw - 2 * pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw - bd - 10, TSZ.heading, 500, 2);
    hB = Math.max(hB, bd);
    var bB = maxH(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var need1 = pad + hB + 10 + 1 + 10 + bB + pad, avail = BOTTOM - top;
    var needAll = 2 * need1 + gap;
    if (needAll > avail) return null;
    var total = K.boxH(needAll, avail), ch = (total - gap) / 2;
    items.forEach(function (it, i) {
      var x = CX + inset + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap);
      K.rect(els, x, y, cw, ch, T.bgLight);
      K.text(els, x + pad, y + pad, iw - bd - 10, hB, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, valign: 'middle', color: T.blue });
      badge(els, it, x + cw - pad - bd, y + pad + (hB - bd) / 2, bd, T.white);
      var ly = y + pad + hB + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      body(els, x + pad, ly + 10, iw, y + ch - ly - 10 - pad, it.text);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 7. Deliverable rows + photo strip — proposals page 42 (43, 44, 45, 47, 49) ---------- */
  add('P66_DELIVERABLE_ROWS', 'cards', { min: 3, max: 5, needs: 'items[{title,text,icon}], deliverable',
    desc: '3-5 white rows (icon, short label, one-line text) and a blue "Deliverable" bar at the bottom, dark photo strip on the right (one workstream or phase and what it delivers)', words: '8-16; label 1-3 words' }, function (s) {
    var items = itemsOf(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    var del = String(s.deliverable || (s.callout && (s.callout.text || s.callout.title)) || s.takeaway || '').trim();
    var els = [];
    var px = 500;
    photoPanel(els, px);
    var top = K.header(els, s) + 2;
    var x0 = CX - 14, rw = px - 16 - x0, bd = 26, labW = 100, tx = x0 + 14 + bd + 12 + labW + 10, tw = x0 + rw - 14 - tx;
    var lab = items.map(function (it) { return th(it.title, labW, TSZ.heading, 500); });
    var txt = items.map(function (it) { return th(it.text, tw, TSZ.body); });
    var need = items.map(function (it, i) { return Math.max(lab[i], txt[i], bd) + 16; });
    var barLbl = String(s.deliverableLabel || 'Deliverable');
    var lw = K.textWidth(barLbl, 'sans', 500, TSZ.heading) + 6;
    var barH = del ? Math.max(28, th(del, rw - 46 - lw - 12, TSZ.body) + 14) : 0;
    var gap = 8, avail = BOTTOM - top - (del ? barH + gap : 0);
    var sum = need.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1);
    if (sum > avail) return null;
    var extra = Math.min(14, (avail - sum) / n);
    var y = top;
    items.forEach(function (it, i) {
      var rh = need[i] + extra;
      K.rect(els, x0, y, rw, rh, T.white);
      badge(els, it, x0 + 14, y + (rh - bd) / 2, bd, T.bgLight);
      K.text(els, x0 + 14 + bd + 12, y + 4, labW, rh - 8, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 3, valign: 'middle', color: T.ink });
      K.text(els, tx, y + 4, tw, rh - 8, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, valign: 'middle', color: T.ink });
      y += rh + gap;
    });
    if (del) {
      K.rect(els, x0, y, rw, barH, T.blue);
      K.icon(els, { icon: 'document deliverable' }, x0 + 14, y + barH / 2 - 7, 14, true);
      K.text(els, x0 + 34, y, lw, barH, barLbl, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, valign: 'middle', color: T.white });
      K.text(els, x0 + 34 + lw + 12, y, rw - 46 - lw - 12, barH, del, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: T.white });
    }
    return photoOut(els);
  });

  /* ---------- 8. Pros and cons — proposals page 204 (205, 206) ---------- */
  add('P66_PROS_CONS', 'comparison', { min: 2, max: 2, needs: 'left{label,points[]}, right{label,points[]}',
    desc: 'two columns with blue header bars (Pros / Cons or given labels) and bullets that start with a short lead-in ("Lead-in: explanation")', words: '15-30 per bullet' }, function (s) {
    var L2 = sideOf(s.left), R2 = sideOf(s.right);
    L2.label = L2.label || 'Pros'; R2.label = R2.label || 'Cons';
    if (!L2.points.length || !R2.points.length) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 22, pw = (CW - gap) / 2, hh = 24, pad = 20, iw = pw - 2 * pad, tw = iw - 16, pg = 9;
    // "Lead-in: explanation" -> a Medium lead-in line, the explanation underneath
    function split(p) {
      var ci = p.indexOf(': ');
      if (ci > 2 && ci < 60) { var r = p.slice(ci + 2).trim(); return { lead: p.slice(0, ci), rest: r.charAt(0).toUpperCase() + r.slice(1) }; }
      return { lead: '', rest: p };
    }
    function pH(q) { return (q.lead ? th(q.lead, tw, TSZ.body, 500) + 1 : 0) + th(q.rest, tw, TSZ.body); }
    function listH(list) { return list.reduce(function (a, q) { return a + pH(q); }, 0) + pg * (list.length - 1); }
    var Lq = L2.points.map(split), Rq = R2.points.map(split);
    var need = hh + 6 + 16 + Math.max(listH(Lq), listH(Rq)) + 18, avail = BOTTOM - top;
    if (need > avail) return null;
    var ph = K.boxH(need, avail);
    [[L2, Lq], [R2, Rq]].forEach(function (pq, i) {
      var p = pq[0], x = CX + i * (pw + gap), y = top;
      K.roundrect(els, x, y, pw, hh, T.blue);
      K.text(els, x + 10, y, pw - 20, hh, p.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      K.roundrect(els, x, y + hh + 6, pw, ph - hh - 6, T.white, { color: LINE, width: 0.75 });
      var cy = y + hh + 6 + 16;
      pq[1].forEach(function (q) {
        K.ellipse(els, x + pad + 1, cy + lh(TSZ.body) / 2 - 2.5, 5, 5, T.blue);
        var yy = cy;
        if (q.lead) { var a = K.text(els, x + pad + 16, yy, tw, 40, q.lead, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.ink }); yy += a.height + 1; }
        var b = body(els, x + pad + 16, yy, tw, th(q.rest, tw, TSZ.body), q.rest);
        cy = yy + b.height + pg;
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 9. KPI tiles + categories — proposals page 21 (7, 120) ---------- */
  // KPI tiles without category boxes: one row of tall tiles (big blue number, label, one or two lines of text) and the
  // takeaway on the blue bar underneath
  function kpiTilesOnly_(els, s, stats) {
    var n = stats.length, top = K.header(els, s) + 4, gap = 12, tw = (CW - gap * (n - 1)) / n, iw = tw - 32;
    var take = String(s.takeaway || s.banner || '').trim();
    var vSize = K.uniformSize(stats.map(function (st) { return st.value; }), iw, 50, { font: 'mono', weight: 500, max: 32, min: 20, maxLines: 1 });
    var lB = K.linesBlock(stats.map(function (st) { return st.label; }), iw, TSZ.heading, 500, 2);
    var tB = K.linesBlock(stats.map(function (st) { return st.text; }), iw, TSZ.body, 400, 6);
    var need = 20 + K.lineHeight('mono', vSize) + 10 + lB + (tB ? 8 + tB : 0) + 20;
    var bottom = BOTTOM - (take ? 44 : 0);
    if (need > bottom - top) return null;
    var tileH = Math.min(bottom - top, need + 40), y0 = top + Math.max(0, (bottom - top - tileH) / 2);
    stats.forEach(function (st, i) {
      var x = CX + i * (tw + gap);
      K.rect(els, x, y0, tw, tileH, i % 2 ? ALT : T.bgLight);
      K.rect(els, x, y0, tw, 3, T.blue);
      var y = y0 + 20;
      K.text(els, x + 16, y, iw, K.lineHeight('mono', vSize), st.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, color: T.blue });
      y += K.lineHeight('mono', vSize) + 10;
      K.text(els, x + 16, y, iw, lB, st.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      y += lB + 8;
      if (st.text) K.text(els, x + 16, y, iw, tB, st.text, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 6, color: T.body });
    });
    if (take) {
      K.roundrect(els, CX, BOTTOM - 32, CW, 32, T.blue);
      K.text(els, CX + 16, BOTTOM - 32, CW - 32, 32, take, { weight: 500, max: TSZ.heading, min: 9.5, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
    }
    return { bg: T.white, els: els, noBalance: true };
  }
  add('P66_KPI_TILES', 'stats', { min: 3, max: 4, needs: 'items[{value,label,text}] (3-4), takeaway; optional banner + groups[{label,points[]}] (2-6)',
    desc: 'row of 3-4 KPI tiles (big blue number + label) above a blue section bar (banner) and a grid of category boxes with short lists (inventory, scope in numbers); without groups: tall tiles with value, label and a short text, and the takeaway on a blue bar (KPIs, targets, market figures)', words: 'label 2-5; 2-6 short names per group' }, function (s) {
    var stats = K.arr(s.stats || s.results || s.items, 4).map(function (st) { return { value: String(st && st.value || '').trim(), label: String(st && (st.label || st.title) || '').trim(), text: String(st && st.text || '').trim() }; })
      .filter(function (st) { return st.value; });
    var groups = K.arr(s.groups, 6).map(function (g) { return { label: String(g && (g.label || g.title) || '').trim(), points: K.arr(g && g.points, 8).map(K.str).filter(Boolean) }; })
      .filter(function (g) { return g.label && g.points.length; });
    var n = stats.length, m = groups.length;
    if (n < 3 || n > 4 || m === 1 || m > 6) return null;
    var els = [];
    if (!m) return kpiTilesOnly_(els, s, stats);     // V.1_42b: plain KPIs (value, label, text) -> the tiles with their text
    var top = K.header(els, s) + 2;
    var gap = 10, tw = (CW - gap * (n - 1)) / n;
    var vSize = K.uniformSize(stats.map(function (st) { return st.value; }), tw - 24, 40, { font: 'mono', weight: 500, max: 26, min: 18, maxLines: 1 });
    var lB = K.linesBlock(stats.map(function (st) { return st.label; }), tw - 24, TSZ.body, 400, 2);
    var tileH = 12 + K.lineHeight('mono', vSize) + 2 + lB + 12;
    stats.forEach(function (st, i) {
      var x = CX + i * (tw + gap);
      K.rect(els, x, top, tw, tileH, i % 2 ? ALT : T.bgLight);
      K.text(els, x + 12, top + 12, tw - 24, K.lineHeight('mono', vSize), st.value, { font: 'mono', weight: 500, max: vSize, min: vSize, maxLines: 1, align: 'center', color: T.blue });
      K.text(els, x + 12, top + 14 + K.lineHeight('mono', vSize), tw - 24, lB, st.label, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.ink });
    });
    var y = top + tileH + 14;
    var banner = String(s.banner || s.subtitle2 || 'Categories');
    K.roundrect(els, CX, y, CW, 22, T.blue);
    K.text(els, CX + 12, y, CW - 24, 22, banner, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    y += 22 + 8;
    var cols = m <= 4 && m !== 3 ? 2 : 3, rows = Math.ceil(m / cols), cg = 12, gw = (CW - cg * (cols - 1)) / cols, iw = gw - 30;
    var rowNeed = [];
    for (var r = 0; r < rows; r++) {
      var mx = 0;
      groups.slice(r * cols, r * cols + cols).forEach(function (g) {
        mx = Math.max(mx, 10 + th(g.label, iw, TSZ.heading, 500) + 6 + th(g.points.join(', '), iw, TSZ.body) + 10);
      });
      rowNeed.push(mx);
    }
    var sumNeed = rowNeed.reduce(function (a, b) { return a + b; }, 0) + 8 * (rows - 1), avail = BOTTOM - y;
    if (sumNeed > avail) return null;
    var extra = Math.min(16, (avail - sumNeed) / rows);
    groups.forEach(function (g, i) {
      var r = Math.floor(i / cols), c = i % cols;
      var gy = y + rowNeed.slice(0, r).reduce(function (a, b) { return a + b + extra + 8; }, 0), gh = rowNeed[r] + extra;
      var x = CX + c * (gw + cg);
      K.rect(els, x, gy, gw, gh, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, gy, 4, gh, SLATE);
      var ht = heading(els, x + 16, gy + 10, iw, g.label, T.ink, 2);
      body(els, x + 16, gy + 10 + ht.height + 6, iw, gh - ht.height - 26, g.points.join(', '));
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 10. Personas + callout — proposals page 143 ---------- */
  add('P66_PERSONAS', 'cards', { min: 3, max: 5, needs: 'items[{title,text,points[],icon}], callout{title,text}',
    desc: '3-5 persona rows (icon, persona name, description or 2-4 bullets) on the left and a "+ one more" callout on the right (cohorts, user groups, champions)', words: '10-25 per persona' }, function (s) {
    var items = itemsOf(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    if (items.some(function (it) { return !it.text && !it.points.length; })) return null;
    var co = s.callout || {}, cT = String(co.title || '').trim(), cX = String(co.text || '').trim();
    var els = [];
    var top = K.header(els, s) + 2;
    var rw = cT || cX ? 440 : CW, bd = 30, tx = CX + 16 + bd + 16, tw = CX + rw - 16 - tx, gap = 6, vp = 8, colGap = 14;
    // bullets in one column, or in two columns when the rows would not fit the slide otherwise
    var two = false;
    function listH(it) {
      if (!it.points.length) return th(it.text, tw, TSZ.body);
      if (!two || it.points.length < 2) return ptsH(it.points, tw, TSZ.body, 2);
      var half = Math.ceil(it.points.length / 2), cw2 = (tw - colGap) / 2;
      return Math.max(ptsH(it.points.slice(0, half), cw2, TSZ.body, 2), ptsH(it.points.slice(half), cw2, TSZ.body, 2));
    }
    function rowNeed(it) { return Math.max(vp + th(it.title, tw, TSZ.heading, 500) + 2 + listH(it) + vp, bd + 18); }
    var avail = BOTTOM - top, need, sum;
    function measure() {
      need = items.map(rowNeed);
      sum = need.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1);
    }
    measure();
    if (sum > avail) { two = true; measure(); }
    if (sum > avail) return null;
    var extra = Math.min(16, (avail - sum) / n);
    var y = top;
    items.forEach(function (it, i) {
      var rh = need[i] + extra;
      K.rect(els, CX, y, rw, rh, T.bgLight);
      badge(els, it, CX + 16, y + (rh - bd) / 2, bd, T.white);
      var cy = y + (rh - (need[i] - 2 * vp)) / 2;
      var ht = heading(els, tx, cy, tw, it.title, T.blue, 2);
      cy += ht.height + 2;
      var lH = listH(it);
      if (!it.points.length) body(els, tx, cy, tw, lH, it.text);
      else if (!two || it.points.length < 2) bullets(els, tx, cy, tw, lH, it.points, 2);
      else {
        var half = Math.ceil(it.points.length / 2), cw2 = (tw - colGap) / 2;
        bullets(els, tx, cy, cw2, lH, it.points.slice(0, half), 2);
        bullets(els, tx + cw2 + colGap, cy, cw2, lH, it.points.slice(half), 2);
      }
      y += rh + gap;
    });
    if (cT || cX) {
      var cx = CX + rw + 24, cw = CX + CW - cx, mid = top + (y - gap - top) / 2;
      var tH = cT ? th(cT, cw - 40, 14, 500) : 0, xH = cX ? th(cX, cw - 40, TSZ.body) : 0, blk = tH + (cX ? 8 + xH : 0);
      var by = mid - blk / 2;
      K.rect(els, cx, mid - 4, 26, 8, T.blue);
      K.rect(els, cx + 9, mid - 13, 8, 26, T.blue);
      if (cT) K.text(els, cx + 40, by, cw - 40, tH, cT, { weight: 500, max: 14, min: 14, maxLines: 4, color: T.ink });
      if (cX) body(els, cx + 40, by + tH + 8, cw - 40, xH, cX);
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. Diagonal options under a dark band — proposals page 74 ---------- */
  add('P66_DIAGONAL_OPTIONS', 'cards', { min: 3, max: 3, needs: 'items[{title,text}] (3)',
    desc: 'dark streaks band with the title, then three options as diagonal blue bars of growing length with numbered circles 01-03 and their labels on the left (options, tiers, levels)', words: 'title 3-8; text 0-15' }, function (s) {
    var items = itemsOf(s, 3), n = items.length;
    if (n !== 3) return null;
    var els = [];
    var bandH = 104;
    // the streaks photo is the slide background; everything under the band is covered by the light panel
    K.text(els, X0, 30, 560, 34, s.title, { weight: 500, max: 20, min: 16, maxLines: 1, color: T.white });
    if (s.lead) K.text(els, X0, 62, 560, 30, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.white });
    K.rect(els, 0, bandH, W, H - bandH, T.bgLight);
    var cTop = bandH + 14, cBot = BOTTOM - 4, cL = 26, cR = W - 26;
    K.rect(els, cL, cTop, cR - cL, cBot - cTop, T.white);
    var d = 54, bw = 66, fills = [T.blue, BLUE_2, BLUE_3];
    var pos = [{ x: 466, y: cTop + 62 }, { x: 396, y: cTop + 132 }, { x: 326, y: cTop + 202 }];
    pos.forEach(function (p, i) {
      var len = (cBot - p.y) * Math.SQRT2 + 60;
      K.rbox(els, p.x + Math.cos(Math.PI / 4) * len / 2, p.y + Math.sin(Math.PI / 4) * len / 2, len, bw, 45, fills[i]);
    });
    // clip the bars at the card's bottom edge
    K.rect(els, 0, cBot, W, H - cBot, T.bgLight);
    K.rect(els, cR, cTop, W - cR, cBot - cTop, T.bgLight);
    pos.forEach(function (p, i) {
      K.ellipse(els, p.x - bw / 2, p.y - bw / 2, bw, bw, fills[i]);      // round end of the bar
      K.ellipse(els, p.x - d / 2 + 0.5, p.y - d / 2 + 0.5, d - 1, d - 1, T.white);
      K.text(els, p.x - d / 2, p.y - 13, d, 26, K.pad2(i + 1), { font: 'mono', weight: 400, max: 18, min: 18, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    });
    var labW = 230;
    if (items.some(function (it, i) { return th(it.title, labW, TSZ.heading, 500) + (it.text ? 3 + th(it.text, labW, TSZ.body) : 0) > 66; })) return null;
    items.forEach(function (it, i) {
      var p = pos[i];
      var hH = th(it.title, labW, TSZ.heading, 500), bH = it.text ? 3 + th(it.text, labW, TSZ.body) : 0;
      var y = p.y - (hH + bH) / 2;
      heading(els, cL + 22, y, labW, it.title, T.ink, 2);
      if (it.text) body(els, cL + 22, y + hH + 3, labW, bH - 3, it.text);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  });

  /* ---------- 12. App tile grid + note bar — proposals page 160 ---------- */
  add('P66_ICON_GRID', 'cards', { min: 6, max: 10, needs: 'items[{title,text,icon}], takeaway',
    desc: 'grid of 6-10 small tiles in two rows (icon + name + one or two lines) and a note bar at the bottom (apps, tools, training modules)', words: '10-25' }, function (s) {
    var items = itemsOf(s, 10), n = items.length;
    if (n < 6 || n > 10) return null;
    var note = String(s.takeaway || '').trim();
    var els = [];
    var top = K.header(els, s) + 2;
    var cols = Math.ceil(n / 2), gap = 8, tw = (CW - gap * (cols - 1)) / cols, pad = 10, iw = tw - 2 * pad, ic = 18;
    var hB = Math.max(K.linesBlock(items.map(function (it) { return it.title; }), iw - ic - 8, TSZ.heading, 500, 2), ic);
    var bB = maxH(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var noteH = note ? Math.max(32, th(note, CW - 60, TSZ.body) + 18) : 0;
    var need1 = pad + 2 + hB + 8 + 1 + 8 + bB + pad, avail = BOTTOM - top - (note ? noteH + 10 : 0);
    if (2 * need1 + gap > avail) return null;
    var total = Math.min(avail, Math.max(2 * need1 + gap, note ? avail : avail * 0.9)), th1 = (total - gap) / 2;
    items.forEach(function (it, i) {
      var r = Math.floor(i / cols), c = i % cols;
      var rowN = r === 0 ? cols : n - cols, off = r === 1 && rowN < cols ? (tw + gap) * (cols - rowN) / 2 : 0;
      var x = CX + off + c * (tw + gap), y = top + r * (th1 + gap);
      K.rect(els, x, y, tw, th1, T.bgLight);
      var src = (it.icon || it.material) ? it : { icon: (it.title + ' ' + it.text).toLowerCase() };
      K.icon(els, src, x + pad, y + pad + 2 + (hB - ic) / 2, ic, false);
      K.text(els, x + pad + ic + 8, y + pad + 2, iw - ic - 8, hB, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, valign: 'middle', color: T.ink });
      var ly = y + pad + 2 + hB + 8;
      K.line(els, x + pad, ly, x + tw - pad, ly, T.ink, 0.75);
      body(els, x + pad, ly + 8, iw, y + th1 - ly - 8 - pad, it.text);
    });
    if (note) {
      var ny = BOTTOM - noteH;
      K.rect(els, CX, ny, CW, noteH, T.bgLight);
      K.rect(els, CX, ny, 3.5, noteH, T.blue);
      K.text(els, CX + 20, ny, CW - 40, noteH, note, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, valign: 'middle', color: T.ink });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 13. Three pillars with name chips — proposals page 285 ---------- */
  function chipRows(names, w, size) {
    var rows = [[]], rw = 0, gap = 6;
    names.forEach(function (nm) {
      var cw = K.textWidth(nm, 'sans', 500, size) + 18;
      if (rows[rows.length - 1].length && rw + gap + cw > w) { rows.push([]); rw = 0; }
      rows[rows.length - 1].push({ name: nm, w: Math.min(cw, w) });
      rw += (rw ? gap : 0) + cw;
    });
    return rows;
  }
  add('P66_PILLARS', 'cards', { min: 3, max: 3, needs: 'items[{title,text,points[] (partner / product names)}] (3)',
    desc: 'three pillar cards (icon, heading, short paragraph) with a row of partner or product name chips at the bottom of each, dark photo strip on the right', words: '25-45; 2-5 names' }, function (s) {
    var items = itemsOf(s, 3), n = items.length;
    if (n !== 3 || items.some(function (it) { return !it.text; })) return null;
    var els = [];
    var px = 620;
    photoPanel(els, px);
    var top = K.header(els, s, { maxW: 480 }) + 4;
    // V.1_46: the cards end before the photo strip (the third card ran 46pt into it in deck 19)
    var gap = 12, cw = (px - 16 - CX - gap * 2) / 3, pad = 14, iw = cw - 2 * pad, bd = 28, chipH = 20, cs = 9.5;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var bB = maxH(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var chips = items.map(function (it) { return chipRows(it.points, iw, cs); });
    var cRows = Math.max.apply(null, chips.map(function (c) { return it0(c); }));
    function it0(c) { return c[0].length ? c.length : 0; }
    var chipBlock = cRows ? 14 + cRows * chipH + (cRows - 1) * 6 : 0;
    var need = pad + bd + 12 + hB + 8 + bB + 14 + chipBlock + pad, avail = BOTTOM - top;
    if (need > avail || cRows > 2) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.88));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = top;
      K.rect(els, x, y, cw, ch, T.white, { color: LINE, width: 0.75 });
      badge(els, it, x + pad, y + pad, bd, T.bgLight);
      var hy = y + pad + bd + 12;
      heading(els, x + pad, hy, iw, it.title, T.ink, 2);
      body(els, x + pad, hy + hB + 8, iw, bB, it.text);
      if (cRows) {
        var cy = y + ch - pad - (cRows * chipH + (cRows - 1) * 6);
        K.line(els, x + pad, cy - 12, x + cw - pad, cy - 12, LINE, 0.75);
        chips[i].forEach(function (row, r) {
          var cx = x + pad;
          row.forEach(function (c) {
            K.roundrect(els, cx, cy + r * (chipH + 6), c.w, chipH, T.bgLight, { color: LINE, width: 0.75 });
            K.text(els, cx + 4, cy + r * (chipH + 6), c.w - 8, chipH, c.name, { weight: 500, max: cs, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
            cx += c.w + 6;
          });
        });
      }
    });
    return photoOut(els);
  });

  /* ---------- 14a. Paradigm cards on the dark photo — proposals page 288 ---------- */
  add('P66_PARADIGM_DARK', 'cards', { min: 3, max: 4, needs: 'items[{title,points[]}] (3-4)',
    desc: 'dark photo slide: title and lead in white, a row of 3-4 white cards each with a blue header bar and a short bullet list (legacy / modern / future, eras, maturity stages)', words: '3-8 per bullet' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 3 || n > 4) return null;
    items.forEach(function (it) { if (!it.points.length && it.text) it.points = [it.text]; });
    if (items.some(function (it) { return !it.points.length; })) return null;
    var els = [];
    var t = K.text(els, X0, 24, 470, 50, s.title, { weight: 500, max: 20, min: 16, maxLines: 2, color: T.white });
    var y = 24 + t.height + 5;
    if (s.lead) { var l = K.text(els, X0, y, 470, 44, s.lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.white }); y += l.height; }
    var top = Math.max(y + 26, 84);
    var gap = 14, cw = (CW - gap * (n - 1)) / n, pad = 14, iw = cw - 2 * pad, hh = 30;
    var pB = 0;
    items.forEach(function (it) { pB = Math.max(pB, ptsH(it.points, iw, TSZ.body, 7)); });
    var need = hh + 16 + pB + 18, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = Math.min(avail, Math.max(need, avail * 0.62));
    top = top + (avail - ch) * 0.4;
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, top, cw, ch, T.white);
      K.rect(els, x, top, cw, hh, T.blue);
      K.text(els, x + pad, top, iw, hh, it.title, { weight: 500, max: TSZ.heading, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      bullets(els, x + pad, top + hh + 16, iw, ch - hh - 30, it.points, 7);
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, dark: true, noBalance: true };
  });

  /* ---------- 14b. Paradigm columns + full-width bar — proposals page 289 ---------- */
  add('P66_PARADIGM_COLUMNS', 'process', { min: 4, max: 6, needs: 'items[{title,points[]}] (4-6), takeaway',
    desc: '4-6 columns with blue header tabs and short lists (stages of a method), joined by dotted connectors to a full-width bar underneath that names what runs across all of them', words: '2-5 per point' }, function (s) {
    var items = itemsOf(s, 6), n = items.length;
    if (n < 4 || n > 6) return null;
    items.forEach(function (it) { if (!it.points.length && it.text) it.points = [it.text]; });
    if (items.some(function (it) { return !it.points.length; })) return null;
    var bar = String(s.takeaway || '').trim();
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = n >= 6 ? 8 : 12, cw = (CW - gap * (n - 1)) / n, pad = 9, iw = cw - 2 * pad, hh = 24;
    var pB = 0;
    items.forEach(function (it) { pB = Math.max(pB, ptsH(it.points, iw, TSZ.body, 5)); });
    var barH = bar ? 30 : 0, conn = bar ? 22 : 0;
    var need = hh + 4 + 10 + pB + 12, avail = BOTTOM - top - barH - conn;
    if (need > avail) return null;
    var ch = K.boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.roundrect(els, x, top, cw, hh, T.blue);
      K.text(els, x + 4, top, cw - 8, hh, it.title, { weight: 500, max: TSZ.heading, min: 9.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      K.roundrect(els, x, top + hh + 4, cw, ch - hh - 4, T.white, { color: LINE, width: 0.75 });
      bullets(els, x + pad, top + hh + 14, iw, ch - hh - 26, it.points, 5);
      if (bar) K.dashedLine(els, x + cw / 2, top + ch + 3, x + cw / 2, top + ch + conn + 3, BLUE_3, 1, 2, 2.5);
    });
    if (bar) {
      var by = top + ch + conn + 3;
      K.roundrect(els, CX, by, CW, barH, SLATE);
      K.text(els, CX + 16, by, CW - 32, barH, bar, { weight: 500, max: TSZ.heading, min: TSZ.body, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 15. Text with an abstract illustration — proposals pages 127, 144 ---------- */
  add('P66_ILLUSTRATION_TEXT', 'cards', { min: 2, max: 4, needs: 'text, items[{title,text}] (2-4)',
    desc: 'left: short paragraph and 2-4 blue labelled points with leader lines; right: an abstract on-brand illustration of overlapping circles (roles, responsibilities, how two teams work together)', words: 'text 25-45; points 8-20' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    var para = String(s.text || '').trim();
    var els = [];
    var top = K.header(els, s, { maxW: 600 }) + 4;
    var lw = 300, gap = 16;
    var paraH = para ? th(para, lw, TSZ.body) : 0;
    var need = items.map(function (it) { return th(it.title, lw, TSZ.heading, 500) + (it.text ? 3 + th(it.text, lw, TSZ.body) : 0); });
    var sum = (para ? paraH + 22 : 0) + need.reduce(function (a, b) { return a + b; }, 0) + gap * (n - 1), avail = BOTTOM - top;
    if (sum > avail) return null;
    var y = top + Math.max(0, (avail - sum) * 0.35);
    if (para) {
      body(els, CX, y, lw, paraH, para);
      y += paraH + 10;
      K.line(els, CX, y, CX + 40, y, T.blue, 1.5);
      y += 12;
    }
    var ys = [];
    var spare = Math.min(14, (BOTTOM - y - (sum - (para ? paraH + 22 : 0))) / Math.max(1, n));
    items.forEach(function (it, i) {
      var ht = heading(els, CX, y, lw, it.title, T.blue, 2);
      if (it.text) body(els, CX, y + ht.height + 3, lw, need[i] - ht.height - 3, it.text);
      ys.push(y + lh(TSZ.heading) / 2);
      y += need[i] + gap + spare;
    });
    // illustration: a soft disc, three overlapping circles, a dotted orbit and small nodes
    var cx = 548, cy = top + (BOTTOM - top) / 2, R = Math.min(118, (BOTTOM - top) / 2 - 4);
    K.ellipse(els, cx - R, cy - R, 2 * R, 2 * R, T.bgLight);
    for (var a = 0; a < 360; a += 7) {
      var rr = R * 0.86, ra = a * Math.PI / 180;
      K.ellipse(els, cx + rr * Math.cos(ra) - 0.9, cy + rr * Math.sin(ra) - 0.9, 1.8, 1.8, SLATE);
    }
    // three discs in a triangle (one per side of the partnership), separated by white outlines, a hub in the middle
    var r1 = R * 0.36, dd = r1 * 0.62;
    [[-90, BLUE_3], [150, SLATE], [30, T.blue]].forEach(function (c) {
      var ang = c[0] * Math.PI / 180, ox = cx + dd * Math.cos(ang), oy = cy + dd * Math.sin(ang);
      K.ring(els, ox - r1, oy - r1, 2 * r1, c[1], T.white, 2.5);
    });
    var hr = r1 * 0.42;
    K.ring(els, cx - hr, cy - hr, 2 * hr, T.white, T.blue, 1.5);
    K.ellipse(els, cx - hr * 0.42, cy - hr * 0.42, hr * 0.84, hr * 0.84, T.blue);
    // leader lines from each point to a node on the illustration
    ys.forEach(function (yy, i) {
      var dy = Math.max(-R * 0.86, Math.min(R * 0.86, yy - cy)), ex = cx - Math.sqrt(Math.max(0, R * R * 0.74 - dy * dy));
      var sx = CX + Math.min(lw, (th(items[i].title, lw, TSZ.heading, 500) <= lh(TSZ.heading) + 1 ? K.textWidth(items[i].title, 'sans', 500, TSZ.heading) : lw)) + 12;
      sx = Math.max(sx, CX + lw + 10);
      K.line(els, sx, yy, ex, yy, SLATE, 0.75);
      K.ring(els, ex - 4.5, yy - 4.5, 9, T.blue, T.white, 1.5);
    });
    return { bg: T.white, els: els, noBalance: true };
  });
})();
