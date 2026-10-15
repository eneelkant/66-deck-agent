/* =========================================================================================================
   66° Deck Agent — Solution Deck design library (V.1_52), part 1: cards, columns and text
   Built from the slides of the 66degrees Solutions folder (Managed Services 2026, SQL Server playbook, SQL AG customer
   deck, GE Accelerator Services, GE Unlock, HCA Control Tower, Solution Consulting Showcase, Paradigm, MCO, GWS GE H2'26,
   GenMedia66). Header columns (optional photo banner), cards beside a photo strip, three card columns with a footer
   arrow, icon card grid, 2 x 2 cards with a left rule, numbered card grid, tinted panels under a context bar, offer
   tiers on a track, crosses and ticks, headed text sections, bullets with a half photo, one offer in detail.
   Every design here draws only in a Solution Deck (ENGINE.addSolutionDesign): the Proposal Deck never uses them, and a
   Solution Deck never uses a Proposal design (only the shared section dividers).
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
  function linesOf(it) { return it.points.length ? it.points : (it.text ? [it.text] : []); }
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
  function boxH(need, avail) { return Math.min(avail, Math.max(need, avail * 0.7)); }

  /* ---------- 1. Header columns: 2-4 columns under blue header bars (optional photo banner) — Managed Services p31-38,
     GWS GE p17, SQL AG p4/p15, HCA p20, MCO p7 ---------- */
  add('S66_HEADER_COLUMNS', 'cards', { min: 2, max: 4, needs: 'items[{title,points[]}] (2-4), banner (true/false), takeaway',
    desc: '2-4 columns, each a card under a full-width blue header bar with its name, bullets below; banner: true puts the slide title on a photo band across the top (service lines, workstreams, current vs future)', words: '6-16 per bullet' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 7; })) return null;
    var banner = s.banner === true || String(s.banner) === 'true';
    var els = [], top, bandH = 84;
    if (banner) {
      K.rect(els, 0, bandH, W, H - bandH, T.white);
      bandTitle(els, s, bandH);
      top = bandH + 18;
      if (s.lead) { var lr = body(els, X0, top, CW, 14, s.lead); top += lr.height + 12; }
    } else top = K.header(els, s) + 2;
    var take = clean(s.takeaway), takeH = take ? 30 : 0;
    var gap = n === 4 ? 12 : 16, cw = (CW - gap * (n - 1)) / n, pad = 12, iw = cw - 2 * pad;
    var headLines = maxOf(items, function (it) { return Math.min(2, K.wrap(it.title, iw, 'sans', 500, TSZ.heading).length); });
    var barH = headLines > 1 ? 38 : 26;
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 7); });
    var need = barH + 14 + pB + 16, avail = BOTTOM - top - takeH;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, top + barH, cw, ch - barH, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, top, cw, barH, T.blue);
      K.text(els, x + 8, top, cw - 16, barH, it.title, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
      bullets(els, x + pad, top + barH + 14, iw, ch - barH - 26, linesOf(it), 7);
    });
    if (take) {
      var ty = top + ch + 10;
      K.rect(els, CX, ty, CW, 22, T.bgLight);
      K.text(els, CX + 12, ty, CW - 24, 22, take, { weight: 500, max: TSZ.body, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.blue });
    }
    return banner ? photoOut(els) : { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 2. Cards beside a photo strip: icon, heading, text, blue base line — Managed Services p6-12, GenMedia66,
     Showcase p17/p26/p27, Paradigm p3/p4 ---------- */
  add('S66_CARDS_PHOTO_STRIP', 'cards', { min: 2, max: 4, needs: 'items[{title,text,icon}] (2-4)',
    desc: '2-4 white cards on a light page beside a photo strip on the right: small line icon, heading, divider, short text or 2-4 bullets, a blue line along the base of each card (capabilities, service areas, problem / solution / result)', words: '15-35' }, function (s) {
    var items = itemsOf(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var px = 560, els = [];
    K.rect(els, 0, 0, px, H, T.bgLight);
    var top = K.header(els, s, { maxW: px - 50 }) + 4;
    var gap = 10, cw = (px - 18 - CX - gap * (n - 1)) / n, pad = n === 4 ? 10 : 12, iw = cw - 2 * pad, ic = 20;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 3);
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 5); });
    var need = pad + ic + 10 + hB + 10 + 1 + 10 + tB + 16, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, top, cw, ch, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, top + ch - 3, cw, 3, T.blue);
      icon(els, it, x + pad, top + pad, ic, false);
      var hy = top + pad + ic + 10;
      heading(els, x + pad, hy, iw, it.title, T.ink, 3);
      var ly = hy + hB + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      bullets(els, x + pad, ly + 10, iw, top + ch - ly - 24, linesOf(it), 5);
    });
    return photoOut(els);
  });

  /* ---------- 3. Three card columns + footer arrow — Showcase p3/p13, SQL playbook p3/p18, Managed Services p66 ---------- */
  add('S66_THREE_CARD_COLUMNS', 'cards', { min: 3, max: 3, needs: 'items[{title,points[]}] (3), takeaway',
    desc: 'three light grey cards side by side: blue heading, hairline, bullets; optional takeaway in a blue arrow band across the bottom (three pillars, three areas, three steps)', words: '6-16 per bullet' }, function (s) {
    var items = itemsOf(s, 3);
    if (items.length !== 3) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 6; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var take = clean(s.takeaway), takeH = take ? 36 : 0;
    var gap = 14, cw = (CW - 2 * gap) / 3, pad = 16, iw = cw - 2 * pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 8); });
    var need = pad + hB + 10 + 1 + 12 + pB + pad, avail = BOTTOM - top - takeH;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, top, cw, ch, T.bgLight);
      heading(els, x + pad, top + pad, iw, it.title, T.blue, 2);
      var ly = top + pad + hB + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, SLATE, 0.75);
      bullets(els, x + pad, ly + 12, iw, top + ch - ly - 12 - pad, linesOf(it), 8);
    });
    if (take) {
      var ty = top + ch + 12;
      K.shape(els, 'HOME_PLATE', CX, ty, CW, 24, T.blue);
      K.text(els, CX + 16, ty, CW - 60, 24, take, { weight: 500, max: TSZ.body, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 4. Icon card grid: round blue badge left of each heading, 2 columns — SQL AG p8/p12, Managed Services p2x,
     GWS GE p15 ---------- */
  add('S66_ICON_CARD_GRID', 'cards', { min: 4, max: 6, needs: 'items[{title,text,icon}] (4 or 6)',
    desc: '4 or 6 white cards in two columns: round blue icon badge beside the heading, one or two sentences below (decisions, benefits, capabilities, gaps)', words: '15-30' }, function (s) {
    var items = itemsOf(s, 6), n = items.length;
    if (n !== 4 && n !== 6) return null;
    if (items.some(function (it) { return !it.text && !it.points.length; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var rows = n / 2, gapX = 16, gapY = 12, cw = (CW - gapX) / 2, pad = 14, bd = 26, tx = pad + bd + 12, iw = cw - tx - pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var cardNeed = pad + Math.max(bd, hB + 6 + tB) + pad, avail = BOTTOM - top;
    var rh = (avail - gapY * (rows - 1)) / rows;
    if (cardNeed > rh) return null;
    rh = Math.min(rh, Math.max(cardNeed, rh * 0.8));
    items.forEach(function (it, i) {
      var x = CX + (i % 2) * (cw + gapX), y = top + Math.floor(i / 2) * (rh + gapY);
      K.rect(els, x, y, cw, rh, T.white, { color: LINE, width: 0.75 });
      badge(els, it, x + pad, y + pad, bd, T.blue);
      var hr = heading(els, x + tx, y + pad + (hB < bd ? (bd - hB) / 2 : 0), iw, it.title, T.ink, 2);
      bullets(els, x + tx, y + pad + Math.max(hB, bd - 2) + 6, iw, rh - pad * 2 - hB - 6, linesOf(it), 4);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 5. 2 x 2 cards with a blue left rule (optional owner chip) — GWS GE p13, SQL playbook p10/p12/p16 ---------- */
  add('S66_QUAD_RULE_CARDS', 'cards', { min: 4, max: 4, needs: 'items[{title,text|points[],tag}] (4)',
    desc: 'four white boxes in a 2 x 2 grid, each with a blue rule down its left edge: heading, text or bullets, optional small chip for the owner or area (areas to align on, design rules, recommendations)', words: '12-30' }, function (s) {
    var items = itemsOf(s, 4);
    if (items.length !== 4) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 5; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = 14, cw = (CW - gap) / 2, pad = 16, iw = cw - 2 * pad - 4;
    var hasTag = items.some(function (it) { return it.tag; });
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 5); });
    var need = pad + hB + 8 + pB + (hasTag ? 26 : 0) + pad, avail = BOTTOM - top;
    var rh = (avail - gap) / 2;
    if (need > rh) return null;
    rh = Math.min(rh, Math.max(need, rh * 0.82));
    items.forEach(function (it, i) {
      var x = CX + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (rh + gap);
      K.rect(els, x, y, cw, rh, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, y, 4, rh, T.blue);
      heading(els, x + pad + 4, y + pad, iw, it.title, T.blue, 2);
      bullets(els, x + pad + 4, y + pad + hB + 8, iw, rh - pad * 2 - hB - 8 - (hasTag ? 26 : 0), linesOf(it), 5);
      if (it.tag) chip(els, x + pad + 4, y + rh - pad - 16, it.tag, T.bgLight, T.ink, iw);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 6. Numbered card grid: 01-06 in rows of three — Managed Services p25/p27/p29, SQL AG p11 ---------- */
  add('S66_NUMBERED_CARD_GRID', 'cards', { min: 4, max: 6, needs: 'items[{title,text}] (4-6)',
    desc: '4-6 white cards in rows of three, each with a blue number (01, 02...), heading, hairline and one or two sentences (characteristics, things proved, principles)', words: '12-30' }, function (s) {
    var items = itemsOf(s, 6), n = items.length;
    if (n < 4 || n > 6) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var take = clean(s.takeaway), takeH = take ? 22 : 0;
    var gap = 12, cw = (CW - 2 * gap) / 3, pad = 12, iw = cw - 2 * pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var need = pad + 16 + 4 + hB + 8 + 1 + 8 + tB + pad, avail = BOTTOM - top - takeH;
    var rh = (avail - gap) / 2;
    if (need > rh) return null;
    rh = Math.min(rh, Math.max(need, rh * 0.85));
    items.forEach(function (it, i) {
      var x = CX + (i % 3) * (cw + gap), y = top + Math.floor(i / 3) * (rh + gap);
      K.rect(els, x, y, cw, rh, T.white, { color: LINE, width: 0.75 });
      K.text(els, x + pad, y + pad, 40, 16, K.pad2(i + 1), { font: 'mono', weight: 500, max: 13, min: 12, maxLines: 1, color: T.blue });
      var hy = y + pad + 20;
      heading(els, x + pad, hy, iw, it.title, T.ink, 2);
      var ly = hy + hB + 8;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      bullets(els, x + pad, ly + 8, iw, y + rh - ly - 8 - pad, linesOf(it), 4);
    });
    if (take) K.text(els, CX, BOTTOM - 16, CW, 16, '→ ' + take, { weight: 400, max: 9.5, min: 9, maxLines: 1, color: T.blue });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 7. Context bar + tinted panels + footer panel — HCA p5/p11, GWS GE p11 ---------- */
  add('S66_TINT_PANELS', 'cards', { min: 2, max: 3, needs: 'context, items[{title,text}] (2-3), footer{title,text}',
    desc: 'one-line context bar at the top ("Context: ..."), 2-3 tinted panels with a heading and two sentences (the first one blue), a full-width footer panel with a heading and text (decisions agreed, the reality, what comes next)', words: '18-40' }, function (s) {
    var items = itemsOf(s, 3), n = items.length;
    var ctxText = clean(s.context);
    if (n < 2 || n > 3 || !ctxText) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var foot = s.footer && typeof s.footer === 'object' ? { title: clean(s.footer.title), text: clean(s.footer.text) } : { title: '', text: clean(s.footer || s.takeaway) };
    var els = [];
    var top = K.header(els, s) + 2;
    var lab = /^[^:]{2,24}:/.test(ctxText) ? '' : 'Context: ';
    var full = lab + ctxText, cH = th(full, CW - 28, TSZ.body) + 18;
    K.rect(els, CX, top, CW, cH, T.white, { color: LINE, width: 0.75 });
    var lead = full.indexOf(':') + 1;
    K.text(els, CX + 14, top + 9, CW - 28, cH - 18, full, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink, runs: lead > 0 && lead < 26 ? [{ start: 0, end: lead, color: T.ink, weight: 500 }] : null });
    var y = top + cH + 14;
    var gap = 12, cw = (CW - gap * (n - 1)) / n, pad = 14, iw = cw - 2 * pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 2);
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var footH = foot.text ? 14 + (foot.title ? lh(TSZ.heading) + 4 : 0) + th(foot.text, CW - 28, TSZ.body) + 14 : 0;
    var pNeed = pad + hB + 8 + tB + pad, avail = BOTTOM - y - (footH ? footH + 14 : 0);
    if (pNeed > avail) return null;
    var ph = Math.min(avail, Math.max(pNeed, avail * 0.75));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, y, cw, ph, i === 0 ? TINT : T.bgLight);
      heading(els, x + pad, y + pad, iw, it.title, i === 0 ? T.blue : T.ink, 2);
      bullets(els, x + pad, y + pad + hB + 8, iw, ph - pad * 2 - hB - 8, linesOf(it), 4);
    });
    if (footH) {
      var fy = y + ph + 14;
      K.rect(els, CX, fy, CW, footH, T.bgLight);
      var yy = fy + 14;
      if (foot.title) { heading(els, CX + 14, yy, CW - 28, foot.title, T.ink, 1); yy += lh(TSZ.heading) + 4; }
      body(els, CX + 14, yy, CW - 28, footH - (yy - fy) - 14, foot.text);
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 8. Offer tiers on a track: timing, name, text, price, funding — GE Unlock p6, Showcase p23, Managed
     Services p41/p45 ---------- */
  add('S66_OFFER_TIERS', 'cards', { min: 3, max: 5, needs: 'items[{title,timing,text,price,funding}] (3-5)',
    desc: '3-5 offer columns along a dotted track: timing chip, offer name in blue, short description, starting price (only from the request) and how it is funded or delivered (packaged offerings, service tiers, engagement options)', words: '12-28' }, function (s) {
    var items = itemsOf(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    if (!items.every(function (it) { return it.timing || it.price; })) return null;
    if (items.some(function (it) { return !linesOf(it).length; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var gap = n === 5 ? 8 : 12, cw = (CW - gap * (n - 1)) / n, pad = n === 5 ? 9 : 12, iw = cw - 2 * pad;
    var trackY = top + 4;
    K.line(els, CX + cw / 2, trackY, CX + CW - cw / 2, trackY, SLATE, 1);
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 3);
    var tB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, TSZ.body, 4); });
    var hasPrice = items.some(function (it) { return it.price; }), hasFund = items.some(function (it) { return it.funding; });
    var priceH = hasPrice ? 26 : 0, fundH = hasFund ? 22 : 0;
    var y0 = trackY + 12;
    var need = pad + 16 + 10 + hB + 8 + tB + 12 + priceH + fundH + pad, avail = BOTTOM - y0;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), cx = x + cw / 2;
      K.ellipse(els, cx - 4.5, trackY - 4.5, 9, 9, T.blue);
      K.rect(els, x, y0, cw, ch, T.white, { color: LINE, width: 0.75 });
      K.rect(els, x, y0, cw, 3, T.blue);
      var yy = y0 + pad;
      if (it.timing) chip(els, x + pad, yy, it.timing, T.bgLight, T.ink, iw);
      yy += 16 + 10;
      heading(els, x + pad, yy, iw, it.title, T.blue, 3);
      yy += hB + 8;
      bullets(els, x + pad, yy, iw, tB, linesOf(it), 4);
      var by = y0 + ch - pad - fundH - priceH;
      if (it.price) K.text(els, x + pad, by, iw, 24, it.price, { font: 'mono', weight: 500, max: 16, min: 11, maxLines: 1, color: T.blue });
      if (it.funding) {
        K.rect(els, x + pad, y0 + ch - pad - 18, iw, 18, T.ink);
        K.text(els, x + pad + 4, y0 + ch - pad - 18, iw - 8, 18, it.funding, { weight: 400, max: 9, min: 8, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      }
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 9. Crosses and ticks: two lists side by side + photo strip — SQL playbook p4 (contained vs traditional) ---------- */
  function sideOf(o) {
    o = o || {};
    return { label: clean(o.label || o.title), points: K.arr(o.points, 8).map(K.str).map(clean).filter(Boolean) };
  }
  add('S66_CROSS_CHECK', 'comparison', { min: 2, max: 2, needs: 'left{label,points[]}, right{label,points[]}',
    desc: 'two white panels beside a photo strip: the old way with a cross before each point, the new way with a tick before each point (what changes, before and after, traditional vs new)', words: '5-12 per point' }, function (s) {
    var L = sideOf(s.left), R = sideOf(s.right);
    if (!L.label || !R.label || L.points.length < 2 || R.points.length < 2 || L.points.length > 7 || R.points.length > 7) return null;
    var px = 580, els = [];
    K.rect(els, 0, 0, px, H, T.bgLight);
    var top = K.header(els, s, { maxW: px - 50 }) + 4;
    var gap = 14, cw = (px - 20 - CX - gap) / 2, pad = 14, iw = cw - 2 * pad - 16;
    var rowsH = function (pts) { var t = 0; pts.forEach(function (p) { t += th(p, iw, TSZ.body) + 9; }); return t; };
    var need = pad + lh(TSZ.heading) + 10 + 1 + 12 + Math.max(rowsH(L.points), rowsH(R.points)) + pad, avail = BOTTOM - top;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    [L, R].forEach(function (side, k) {
      var x = CX + k * (cw + gap);
      K.rect(els, x, top, cw, ch, T.white, { color: LINE, width: 0.75 });
      heading(els, x + pad, top + pad, cw - 2 * pad, side.label, k ? T.blue : T.ink, 1);
      var ly = top + pad + lh(TSZ.heading) + 10;
      K.line(els, x + pad, ly, x + cw - pad, ly, LINE, 0.75);
      var yy = ly + 12;
      side.points.forEach(function (p) {
        K.text(els, x + pad, yy, 14, lh(TSZ.body), k ? '✓' : '✗', { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: k ? T.blue : MUTED });
        var r = body(els, x + pad + 16, yy, iw, th(p, iw, TSZ.body), p, k ? T.ink : MUTED);   // the full point, wrapped (never cut to one line)
        yy += r.height + 9;
      });
    });
    return photoOut(els);
  });

  /* ---------- 10. Headed text sections in one panel — Paradigm p6/p7/p8/p15, Showcase p21 ---------- */
  add('S66_TEXT_SECTIONS', 'bullets', { min: 2, max: 5, needs: 'items[{title,points[]}] (2-5)',
    desc: 'one white panel holding 2-5 short sections, each a blue heading with 1-3 bullets below (one or two columns): background, history, components, what we heard', words: '8-24 per bullet' }, function (s) {
    var items = itemsOf(s, 5), n = items.length;
    if (n < 2 || n > 5) return null;
    if (items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 4; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var avail = BOTTOM - top, pad = 18;
    var secH = function (it, w) { return lh(TSZ.heading) + 6 + ptsH(linesOf(it), w, TSZ.body, 5); };
    var w1 = CW - 2 * pad, total1 = pad * 2 + items.reduce(function (a, it) { return a + secH(it, w1) + 14; }, -14);
    var cols = total1 <= avail ? 1 : 2;
    var colW = cols === 1 ? w1 : (CW - 3 * pad) / 2;
    var groups = cols === 1 ? [items] : [items.slice(0, Math.ceil(n / 2)), items.slice(Math.ceil(n / 2))];
    var colNeed = groups.map(function (g) { return pad * 2 + g.reduce(function (a, it) { return a + secH(it, colW) + 14; }, -14); });
    var need = Math.max.apply(null, colNeed);
    if (need > avail) return null;
    var ph = Math.min(avail, Math.max(need, avail * 0.72));
    K.rect(els, CX, top, CW, ph, T.white, { color: LINE, width: 0.75 });
    groups.forEach(function (g, c) {
      var x = CX + pad + c * (colW + pad), y = top + pad;
      g.forEach(function (it) {
        heading(els, x, y, colW, it.title, T.blue, 1);
        var hh = secH(it, colW);
        bullets(els, x, y + lh(TSZ.heading) + 6, colW, hh - lh(TSZ.heading) - 6, linesOf(it), 5);
        y += hh + 14;
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. Bullets with the photo filling the right half — Managed Services p47/p49/p51/p53/p55 ---------- */
  add('S66_BULLETS_PHOTO_HALF', 'bullets', { min: 3, max: 6, needs: 'points[] (3-6)',
    desc: 'title and 3-6 bullets on the left half, a photo filling the right half (why it matters, the need, onboarding in 30 days)', words: '10-24 per bullet' }, function (s) {
    var pts = K.arr(s.points, 7).map(K.str).map(clean).filter(Boolean);
    if (pts.length < 3 || pts.length > 6) return null;
    var px = 372, els = [];
    K.rect(els, 0, 0, px, H, T.white);
    var top = K.header(els, s, { maxW: px - X0 - 20 }) + 8;
    var w = px - X0 - 28;
    var need = ptsH(pts, w, TSZ.body, 10), avail = BOTTOM - top;
    if (need > avail) return null;
    var y = top + Math.max(0, (avail - need) * 0.3);
    bullets(els, X0, y, w, need + 4, pts, 10);
    return photoOut(els);
  });

  /* ---------- 12. One offer in detail: what it is, best for, outcome, activities — Managed Services p42-44 ---------- */
  add('S66_OFFER_DETAIL', 'bullets', { min: 3, max: 10, needs: 'what, bestFor, outcome, points[] (3-10 activities)',
    desc: 'one offer or service tier in detail: rows for what it is, best for and the outcome, then its activities as bullets in two columns (a service tier, a package, an engagement)', words: 'rows 12-30; activities 5-14' }, function (s) {
    var rows = [['What it is', clean(s.what)], ['Best for', clean(s.bestFor || s.best_for)], ['Outcome', clean(s.outcome)]].filter(function (r) { return r[1]; });
    var pts = K.arr(s.points, 10).map(K.str).map(clean).filter(Boolean);
    if (rows.length < 2 || pts.length < 3) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var pad = 16, labW = 96, tw = CW - 2 * pad - labW;
    var rowH = rows.map(function (r) { return th(r[1], tw, TSZ.body) + 14; });
    var half = Math.ceil(pts.length / 2), colW = (CW - 3 * pad) / 2;
    var actH = lh(TSZ.heading) + 8 + Math.max(ptsH(pts.slice(0, half), colW, TSZ.body, 6), ptsH(pts.slice(half), colW, TSZ.body, 6));
    var need = pad + rowH.reduce(function (a, b) { return a + b; }, 0) + 12 + actH + pad, avail = BOTTOM - top;
    if (need > avail) return null;
    K.rect(els, CX, top, CW, Math.min(avail, Math.max(need, avail * 0.75)), T.white, { color: LINE, width: 0.75 });
    var y = top + pad;
    rows.forEach(function (r, i) {
      K.text(els, CX + pad, y + 2, labW - 8, 16, r[0], { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 1, color: T.blue });
      body(els, CX + pad + labW, y + 2, tw, rowH[i] - 14, r[1]);
      y += rowH[i];
      K.line(els, CX + pad, y - 6, CX + CW - pad, y - 6, LINE, 0.75);
    });
    y += 12;
    heading(els, CX + pad, y, CW - 2 * pad, clean(s.activitiesLabel) || 'Activities', T.ink, 1);
    y += lh(TSZ.heading) + 8;
    bullets(els, CX + pad, y, colW, actH, pts.slice(0, half), 6);
    if (pts.length > half) bullets(els, CX + 2 * pad + colW, y, colW, actH, pts.slice(half), 6);
    return { bg: T.white, els: els, noBalance: true };
  });
})();
