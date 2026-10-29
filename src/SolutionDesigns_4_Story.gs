/* =========================================================================================================
   66° Deck Agent — Solution Deck design library (V.1_53), part 4: statements, lists, journeys and dark slides
   From the 66degrees solution decks (Managed Services 2026, MLOps, Sales agent metrics, AI-driven firms, add-on
   services, Agent lifecycle, GE enablement, AI fluency pathway, client story, services framework): a dark statement
   on the streak photo, a statement with explainers, a photo banner with steps and figures, present -> gap -> solution,
   a list with leads, two bullet columns, lifecycle columns, rising stages, a dark U-shaped journey, level cards, a
   client story and a dark service hub. Solution Deck only (ENGINE.addSolutionDesign).
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
    var n0 = els.length;
    var tw = (opts && opts.maxW) || (W - 2 * X0);
    var t = K.text(els, X0, 24, tw, 50, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white });
    var y = 24 + t.height + 5, lead = s.lead || s.subtitle;
    if (lead) { var l = K.text(els, X0, y, Math.min(tw, W - 2 * X0 - 40), 30, lead, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: DARK_BODY }); y += l.height; }
    for (var hk = n0; hk < els.length; hk++) els[hk].hdr = true;      // V.1_68: the header
    return Math.max(y + 16, 68);
  }
  function done(els, P) { var o = { bg: P.bg, els: els, noBalance: true }; if (P.dark) o.dark = true; return o; }

  function cellText(c) { return clean(c && typeof c === 'object' ? (c.text || c.value || c.title || '') : c); }
  // items given as strings or objects (title, text, icon)
  function nodeItems(list, max) {
    return K.arr(list, max + 1).map(function (it) {
      if (typeof it === 'string') return { title: clean(it), text: '', icon: '' };
      it = it || {};
      return { title: clean(it.title || it.name || it.label), text: clean(it.text || it.description || it.subtitle), icon: it.icon || '', material: it.material || '' };
    }).filter(function (it) { return it.title; });
  }

  /* ---------- 12. Dark statement on the streak photo — Managed Services p1 ---------- */
  add('S66_DARK_STATEMENT', 'statement', { min: 0, max: 99, needs: 'statement (one sentence, 8-22 words), text (1-2 short supporting sentences)',
    desc: 'a dark slide on the 66degrees streak photo: the title, one statement in large white type, a short supporting paragraph and a blue accent bar (a message to remember, why this matters, the promise of the offer)', words: 'statement 8-22; text 15-45' }, function (s) {
    var st = clean(s.statement || s.quote || s.message), txt = clean(s.text || s.lead_text || s.support);
    if (!real(st) || st.split(/\s+/).length > 28) return null;
    var els = [];
    var tw = W * 0.56;
    K.text(els, X0, 34, tw, 44, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, color: T.white });
    var sH = th(st, tw, 18, 500), tH = txt ? th(txt, tw, 10.5, 400) : 0;
    if (sH > 120 || tH > 90) return null;
    var y = Math.max(110, (H - (sH + 18 + tH)) / 2);
    K.text(els, X0, y, tw, sH, st, { weight: 500, max: 18, min: 15, color: T.white });
    y += sH + 18;
    if (txt) { K.text(els, X0, y, tw, tH, txt, { weight: 400, max: 10.5, min: 10, color: '#D8DEEA' }); y += tH + 14; }
    K.rect(els, X0, Math.min(y, BOTTOM - 10), tw * 0.42, 4, T.blue);
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true, dark: true };
  });

  /* ---------- 13. A short statement on the left, explainers on the right — MLOps p? / next-step slides ---------- */
  add('S66_EXPLAINER_SPLIT', 'statement', { min: 2, max: 4, needs: 'statement (one sentence), items[{title,text}] (2-4)',
    desc: 'a short statement with an icon on a tinted panel on the left, and 2-4 explainers on the right, each a blue heading and one or two sentences (what it is and why it matters, the next step and what it involves, the scope of a pilot)', words: 'statement 8-20; text 15-35' }, function (s) {
    var st = clean(s.statement || s.message);
    var items = itemsOf(s, 4);
    if (!real(st) || items.length < 2 || items.length > 4 || items.some(function (it) { return !linesOf(it).length; })) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var lw = CW * 0.36, gap = 30, rw = CW - lw - gap, avail = BOTTOM - top;
    var sH = th(st, lw - 36, 14, 500);
    if (sH + 70 > avail) return null;
    var need = items.reduce(function (a, it) { return a + lh(TSZ.heading) + 4 + ptsH(linesOf(it), rw, TSZ.body, 4) + 16; }, 0);
    if (need > avail) return null;
    var lh0 = Math.min(avail, Math.max(sH + 90, avail * 0.75));
    K.rect(els, CX, top, lw, lh0, TINT);
    icon(els, { icon: s.icon || '', title: st, text: s.title || '' }, CX + 18, top + 18, 24);
    K.text(els, CX + 18, top + 56, lw - 36, lh0 - 74, st, { weight: 500, max: 14, min: 12, color: T.ink });
    K.dashedLine(els, CX + lw + gap / 2, top, CX + lw + gap / 2, top + avail, SLATE, 0.75, 2, 3);
    var rx = CX + lw + gap, gapI = Math.min(24, (avail - need) / Math.max(1, items.length - 1) + 16), y = top;
    items.forEach(function (it) {
      heading(els, rx, y, rw, it.title, T.blue, 2);
      var hh = th(it.title, rw, TSZ.heading, 500);
      var r = bullets(els, rx, y + hh + 4, rw, ptsH(linesOf(it), rw, TSZ.body, 4), linesOf(it), 4);
      y += hh + 4 + ptsH(linesOf(it), rw, TSZ.body, 4) + gapI;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 14. Photo banner, text and steps on the left, figures on the right — Metrics in action (Sales agent) ---------- */
  add('S66_BANNER_SPLIT', 'stats', { min: 2, max: 6, needs: 'items[{value,label}] (2-6 figures), text, points[] (2-5 steps)',
    desc: 'the title on a streak photo band, then on the left a short use case text and 2-5 numbered steps, on the right 2-6 figure tiles (big blue number and its label) (a use case with its metrics, how it works and what it delivers)', words: 'text 10-25; steps 6-14; labels 2-6' }, function (s) {
    var figs = K.items(s, 7).map(function (it) { return { value: clean(it && it.value), label: clean(it && (it.label || it.title)) }; }).filter(function (f) { return f.value && /\d/.test(f.value) && f.label; });
    var steps = K.arr(s.points, 6).map(K.str).map(clean).filter(real);
    var txt = clean(s.text || s.lead);
    var nf = figs.length;
    if (nf < 2 || nf > 6 || steps.length < 2 || steps.length > 5) return null;
    var els = [];
    var bandH = 74;
    K.rect(els, 0, bandH, W, H - bandH, T.white);
    K.text(els, X0, 20, W - 2 * X0 - 60, bandH - 30, s.title || '', { weight: 500, max: 20, min: 15, maxLines: 2, valign: 'middle', color: T.white });
    var top = bandH + 18, lw = CW * 0.44, gap = 18, rw = CW - lw - gap, avail = BOTTOM - top;
    var y = top;
    if (txt) { var tr = body(els, CX, y, lw, th(txt, lw, TSZ.body), txt, T.ink); y += tr.height + 12; }
    var sh = steps.map(function (p) { return Math.max(18, th(p, lw - 30, 9.5, 400)); });
    var tot = sh.reduce(function (a, b) { return a + b; }, 0) + 10 * (steps.length - 1);
    if (y - top + tot > avail) return null;
    steps.forEach(function (p, i) {
      K.rect(els, CX, y, 18, 18, T.blue);
      K.text(els, CX, y, 18, 18, String(i + 1), { font: 'mono', weight: 500, max: 9, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      K.text(els, CX + 28, y + (sh[i] === 18 ? 3 : 0), lw - 30, sh[i], p, { weight: 400, max: 9.5, min: 9, color: T.ink });
      y += sh[i] + 10;
    });
    var rx = CX + lw + gap, cols = nf <= 2 ? 1 : 2, rows = Math.ceil(nf / cols), tg = 10;
    var tw = (rw - tg * (cols - 1)) / cols, tH = Math.min(70, (avail - tg * (rows - 1)) / rows);
    if (tH < 44) return null;
    K.rect(els, rx - 8, top - 8, rw + 16, rows * tH + (rows - 1) * tg + 16, T.bgLight);
    figs.forEach(function (f, i) {
      var x = rx + (i % cols) * (tw + tg), yy = top + Math.floor(i / cols) * (tH + tg);
      K.rect(els, x, yy, tw, tH, T.white, { color: LINE, width: 0.75 });
      K.text(els, x + 10, yy + 8, tw - 20, 26, f.value, { font: 'mono', weight: 500, max: 20, min: 13, maxLines: 1, color: T.blue });
      K.text(els, x + 10, yy + 36, tw - 20, tH - 42, f.label, { weight: 400, max: 9, min: 8.5, maxLines: 2, color: T.ink });
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  });

  /* ---------- 15. Present -> gap -> solution infographic — "Firms are doing AI but few will become AI driven" ---------- */
  add('S66_GAP_BRIDGE', 'comparison', { min: 0, max: 99, needs: 'present[{title,text}] (2-3), gap[] (2-3 short gaps), solution[{title,text}] (2-3), stages[3] (labels on the arrow), takeaway',
    desc: 'an arrow across the top naming three stages, the present on the left (grey boxes), the gap in the middle (short chips), the solution on the right (blue-tinted boxes) and a takeaway bar (where the client is, what is missing, what the solution makes possible)', words: 'boxes 10-25; gaps 2-5' }, function (s) {
    var pre = nodeItems(s.present || s.today, 3), sol = nodeItems(s.solution || s.future, 3);
    var gaps = K.arr(s.gap || s.gaps, 4).map(function (g) { return clean(typeof g === 'object' ? (g && (g.title || g.text)) : g); }).filter(real);
    var stages = K.arr(s.stages || s.columns, 3).map(cellText).filter(Boolean);
    if (pre.length < 2 || sol.length < 2 || gaps.length < 2 || gaps.length > 3) return null;
    if (stages.length !== 3) stages = ['Today', 'The gap', 'With the solution'];
    var take = clean(s.takeaway);
    var els = [];
    var top = K.header(els, s) + 2;
    var arrowH = 24, takeH = take ? 26 : 0, avail = BOTTOM - top - arrowH - 10 - (takeH ? takeH + 10 : 0);
    var gw = 132, cw = (CW - gw - 24) / 2;
    K.shape(els, 'HOME_PLATE', CX, top, CW, arrowH, '#B9C9D6');
    [CX + cw / 2, CX + cw + 12 + gw / 2, CX + cw + 24 + gw + cw / 2].forEach(function (cx, i) {
      K.text(els, cx - 90, top, 180, arrowH, stages[i], { weight: 500, max: 9.5, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    });
    var y0 = top + arrowH + 10;
    var col = function (list, x, fill, head) {
      var n = list.length, g = 8, bh = (avail - g * (n - 1)) / n;
      var need = maxOf(list, function (it) { return 10 + th(it.title, cw - 20, 9.5, 500) + 4 + th(it.text, cw - 20, 8.5, 400) + 10; });
      if (need > bh) return false;
      list.forEach(function (it, i) {
        var y = y0 + i * (bh + g);
        K.rect(els, x, y, cw, bh, fill);
        var r = K.text(els, x + 10, y + 10, cw - 20, 14, it.title, { weight: 500, max: 9.5, min: 9, maxLines: 2, color: head });
        if (it.text) K.text(els, x + 10, y + 14 + r.height, cw - 20, bh - 24 - r.height, it.text, { weight: 400, max: 8.5, min: 8, color: T.ink });
      });
      return true;
    };
    if (!col(pre, CX, T.bgLight, T.ink) || !col(sol, CX + cw + 24 + gw, TINT, T.blue)) return null;
    var gx = CX + cw + 12, gh = (avail - 8 * (gaps.length - 1)) / gaps.length;
    gaps.forEach(function (g, i) {
      var y = y0 + i * (gh + 8);
      K.rect(els, gx, y + gh / 2 - 20, gw, 40, T.white, { color: LINE, width: 0.75 });
      K.text(els, gx + 6, y + gh / 2 - 20, gw - 12, 40, g, { weight: 400, max: 9, min: 8.5, maxLines: 3, align: 'center', valign: 'middle', color: T.ink });
    });
    if (take) {
      K.rect(els, CX, BOTTOM - takeH, CW, takeH, T.blue);
      K.text(els, CX + 12, BOTTOM - takeH, CW - 24, takeH, take, { weight: 500, max: 9.5, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 16. One panel of bullets that start with a lead — Add-on services (any platform) ---------- */
  add('S66_BOLD_LEAD_LIST', 'bullets', { min: 4, max: 8, needs: 'points["Lead: what it is"] (4-8)',
    desc: 'one white panel of 4-8 bullets, each starting with a short lead in medium weight and a colon, then what it is (add-on services, what is included, rules, the list of capabilities)', words: 'lead 1-4; text 8-20' }, function (s) {
    var pts = K.arr(s.points, 9).map(K.str).map(clean).filter(real);
    var n = pts.length;
    if (n < 4 || n > 8) return null;
    var leads = pts.map(function (p) { var m = p.match(/^([^:]{2,40}):\s+(.+)$/); return m ? { lead: m[1], rest: m[2] } : null; });
    if (leads.filter(Boolean).length < Math.ceil(n * 0.75)) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var pad = 20, iw = CW - 2 * pad - 18, avail = BOTTOM - top;
    var hs = pts.map(function (p) { return th(p, iw, TSZ.body, 400); });
    var tot = hs.reduce(function (a, b) { return a + b; }, 0) + 10 * (n - 1) + 2 * pad;
    if (tot > avail) return null;
    var ph = Math.min(avail, Math.max(tot, avail * 0.8)), gapP = (ph - 2 * pad - hs.reduce(function (a, b) { return a + b; }, 0)) / Math.max(1, n - 1);
    gapP = Math.min(gapP, 18);
    K.rect(els, CX, top, CW, ph, T.white, { color: LINE, width: 0.75 });
    var y = top + pad;
    pts.forEach(function (p, i) {
      K.ellipse(els, CX + pad, y + 5, 5, 5, T.ink);
      var L = leads[i];
      K.text(els, CX + pad + 18, y, iw, hs[i], p, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.ink, runs: L ? [{ start: 0, end: L.lead.length + 1, color: T.ink, weight: 500 }] : null });
      y += hs[i] + gapP;
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 17. Two plain bullet columns in one panel — AWT critical blocker ---------- */
  add('S66_TWO_COL_BULLETS', 'bullets', { min: 4, max: 12, needs: 'points[] (4-12) or items[{title,points[]}] (2)',
    desc: 'one white panel with two bullet columns, each with an optional heading (blockers and the support needed, what is in and out, two lists side by side)', words: '5-16 per bullet' }, function (s) {
    var items = itemsOf(s, 2), cols;
    if (items.length === 2 && items.every(function (it) { return linesOf(it).length >= 2; })) cols = items.map(function (it) { return { title: it.title, points: linesOf(it) }; });
    else {
      var pts = K.arr(s.points, 13).map(K.str).map(clean).filter(real);
      if (pts.length < 4 || pts.length > 12) return null;
      var h = Math.ceil(pts.length / 2);
      cols = [{ title: '', points: pts.slice(0, h) }, { title: '', points: pts.slice(h) }];
    }
    var els = [];
    var top = K.header(els, s) + 2;
    var pad = 22, gap = 30, cw = (CW - 2 * pad - gap) / 2, avail = BOTTOM - top;
    var hasHead = cols.some(function (c) { return c.title; });
    var need = maxOf(cols, function (c) { return (hasHead ? lh(TSZ.heading) + 10 : 0) + ptsH(c.points, cw, TSZ.body, 8); }) + 2 * pad;
    if (need > avail) return null;
    var ph = boxH(need, avail);
    K.rect(els, CX, top, CW, ph, T.white, { color: LINE, width: 0.75 });
    // V.1_58: the bullets spread over the panel (no empty lower half)
    var most = maxOf(cols, function (c) { return c.points.length; });
    var bg = 8 + Math.min(22, Math.max(0, ph - need) / Math.max(1, most));
    cols.forEach(function (c, i) {
      var x = CX + pad + i * (cw + gap), y = top + pad;
      if (hasHead) { heading(els, x, y, cw, c.title, T.blue, 1); y += lh(TSZ.heading) + 10; }
      bullets(els, x, y, cw, top + ph - pad - y, c.points, bg);
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 18. Lifecycle columns with a thin top rule and a footer line — "Manage agents like employees" ---------- */
  add('S66_LIFECYCLE_COLUMNS', 'process', { min: 4, max: 5, needs: 'items[{label,title,points[],footer}] (4-5)',
    desc: '4-5 columns, each under a thin blue rule: a small numbered label (01 · Hire), the stage name, 2-4 bullets and a short footer line on what it produces (a lifecycle, the stages of an operating model)', words: 'bullets 4-10; footer 3-8' }, function (s) {
    var items = itemsOf(s, 5).map(function (it, i) { var raw = K.items(s, 6)[i] || {}; it.footer = clean(raw.footer || raw.output || raw.artifact); return it; });
    var n = items.length;
    if (n < 4 || n > 5 || items.some(function (it) { return linesOf(it).length < 2 || linesOf(it).length > 4; })) return null;
    var els = [], P = pal(s);
    var top = hdr(els, s, P) + 2;
    var take = clean(s.takeaway), takeH = take ? 20 : 0;
    var gap = 12, cw = (CW - gap * (n - 1)) / n, pad = 10, iw = cw - 2 * pad;
    var hB = K.linesBlock(items.map(function (it) { return it.title; }), iw, TSZ.heading, 500, 3);
    var pB = maxOf(items, function (it) { return ptsH(linesOf(it), iw, 9, 4); });
    var fB = maxOf(items, function (it) { return it.footer ? th(it.footer, iw, 8, 400) + 10 : 0; });
    var need = 4 + 12 + 14 + hB + 10 + pB + 12 + fB + pad, avail = BOTTOM - top - takeH;
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.rect(els, x, top, cw, ch, P.dark ? P.card : '#F7F8FA');
      K.rect(els, x, top, cw, 3, T.blue);
      K.text(els, x + pad, top + 12, iw, 12, K.pad2(i + 1) + (it.label && !/^\s*(step|stage|phase)?\s*0?\d{1,2}\s*[.·:)]?\s*$/i.test(it.label) ? ' · ' + String(it.label).replace(/^\s*0?\d{1,2}\s*[·.):\-–]\s+/, '') : ''), { font: 'mono', weight: 500, max: 8.5, min: 8, maxLines: 1, color: P.head });
      heading(els, x + pad, top + 28, iw, it.title, P.ink, 3);
      K.bulletList(els, x + pad, top + 28 + hB + 10, iw, pB + 4, linesOf(it), { max: 9, min: 9, gap: 4, color: P.body, bullet: P.head });
      if (it.footer) {
        K.line(els, x + pad, top + ch - pad - fB + 2, x + cw - pad, top + ch - pad - fB + 2, P.line, 0.5);
        K.text(els, x + pad, top + ch - pad - fB + 7, iw, fB, it.footer, { weight: 400, max: 8, min: 8, color: P.muted });
      }
    });
    if (take) K.text(els, CX, BOTTOM - 14, CW, 14, take, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: 'center', color: P.muted });
    return done(els, P);
  });

  /* ---------- 19. Stages as dots on a rising line + a note — Gemini Enterprise enablement life-cycle ---------- */
  add('S66_RISING_STAGES', 'process', { min: 5, max: 8, needs: 'items[{title}] (5-8 one-to-three-word stages), takeaway',
    desc: '5-8 stages as dots climbing a rising dotted line, the stage names placed alternately above and below, and a note box underneath with what the model adds (an adoption model, a maturity path, a step-by-step journey)', words: 'stage 1-3; note 20-45' }, function (s) {
    var items = itemsOf(s, 8), n = items.length;
    if (n < 5 || n > 8 || items.some(function (it) { return it.title.split(/\s+/).length > 3; })) return null;
    var take = clean(s.takeaway || s.text);
    var els = [];
    var top = K.header(els, s) + 2;
    var noteH = take ? th(take, CW - 40, TSZ.body) + 24 : 0;
    if (noteH > 90) return null;
    var y1 = BOTTOM - noteH - (take ? 16 : 0) - 26, y2 = top + 30, x1 = CX + 60, x2 = CX + CW - 50;
    if (y1 - y2 < 120) return null;
    var colors = ['#E5484D', '#1B2A6B', T.blue, T.blue, '#F2A33A', '#2FB37A', T.blue, '#3D1E8F'];
    K.dashedLine(els, x1 - 30, y1 + 8, x2 + 20, y2 - 8, SLATE, 1, 2, 3);
    items.forEach(function (it, i) {
      var t = i / (n - 1), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * Math.pow(t, 1.35);
      K.ellipse(els, x - 6, y - 6, 12, 12, colors[i % colors.length]);
      var above = i % 2 === 1;
      K.text(els, x - 45, above ? y - 26 : y + 10, 90, 14, it.title, { weight: 500, max: 9.5, min: 9, maxLines: 1, align: 'center', color: T.ink });
    });
    if (take) {
      K.rect(els, CX, BOTTOM - noteH, CW, noteH, T.bgLight);
      body(els, CX + 20, BOTTOM - noteH + 12, CW - 40, noteH - 24, take);
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 20. Dark U-shaped journey of 6-8 numbered steps — "Transition to managed services, end to end" ---------- */
  add('S66_U_JOURNEY', 'process', { min: 6, max: 8, needs: 'items[{title,points[]}] (6-8 steps, 2-3 short points each)',
    desc: 'a dark slide: 6-8 numbered steps on a U-shaped path (left to right along the top, down the right side, back along the bottom), each with its name and 2-3 short points (an end-to-end transition, a full engagement from discovery to run)', words: 'points 2-6' }, function (s) {
    var items = itemsOf(s, 8), n = items.length;
    if (n < 6 || n > 8 || items.some(function (it) { return !linesOf(it).length || linesOf(it).length > 3; })) return null;
    var els = [];
    var P = pal({ dark: true });
    var top = hdr(els, s, P) + 6;
    var topN = Math.floor(n / 2), right = n % 2, botN = n - topN - right;
    var R = right ? 136 : 24, usable = CW - R, stepW = usable / Math.max(topN, botN), colW = Math.min(150, stepW - 14);
    var xB = CX + usable + 6;                                            // the right-hand bend of the U
    var yT = top + 18, yB = BOTTOM - 112;
    if (yB - yT < 120) return null;
    if (items.some(function (it, i) { return 16 + th(it.title, i === topN && right ? R - 18 : colW, 9, 500) + ptsH(linesOf(it), i === topN && right ? R - 18 : colW, 8.5, 2) > (yB - yT) - 30; })) return null;
    var lineC = '#4A5A86';
    var colX = function (k) { return CX + k * stepW; };
    K.line(els, colX(0) + 7, yT, xB - 22, yT, lineC, 1);
    K.line(els, xB - 22, yT, xB, yT + 22, lineC, 1);
    K.line(els, xB, yT + 22, xB, yB - 22, lineC, 1);
    K.line(els, xB, yB - 22, xB - 22, yB, lineC, 1);
    K.line(els, xB - 22, yB, colX(0) + 7, yB, lineC, 1);
    var place = function (it, i, cx, cy, tx, ty, w) {
      K.ring(els, cx - 7, cy - 7, 14, P.bg, T.white, 1);
      K.text(els, cx - 20, cy - 22, 40, 12, String(i + 1), { weight: 400, max: 8.5, min: 8, maxLines: 1, align: 'center', color: T.white });
      var r = K.text(els, tx, ty, w, th(it.title, w, 9, 500), it.title, { weight: 500, max: 9, min: 9, color: T.white });
      K.bulletList(els, tx, ty + r.height + 3, w, ptsH(linesOf(it), w, 8.5, 2) + 4, linesOf(it), { max: 8.5, min: 8.5, gap: 2, color: '#D8DEEA', bullet: T.white });
    };
    for (var i = 0; i < topN; i++) place(items[i], i, colX(i) + 7, yT, colX(i), yT + 14, colW);
    if (right) place(items[topN], topN, xB, (yT + yB) / 2, xB + 14, (yT + yB) / 2 - 8, R - 18);
    for (var j = 0; j < botN; j++) { var k = topN + right + j, c = botN - 1 - j; place(items[k], k, colX(c) + 7, yB, colX(c), yB + 14, colW); }
    return done(els, P);
  });

  /* ---------- 21. Level cards with check rows and a progression arrow — AI fluency learning pathway L100-L300 ---------- */
  add('S66_LEVEL_CARDS', 'cards', { min: 3, max: 3, needs: 'items[{title,subtitle,points["Label: text"]}] (3 levels), takeaway',
    desc: 'three level cards (icon, level name in blue, one-line subtitle, then 3-4 check rows "Format: ...", "Focus: ...") with a progression arrow underneath (learning levels, service tiers, maturity levels)', words: 'subtitle 4-10; rows 3-10' }, function (s) {
    var items = itemsOf(s, 3);
    if (items.length !== 3 || items.some(function (it) { return it.points.filter(real).length < 2 || it.points.length > 5; })) return null;
    var take = clean(s.takeaway) || 'Progression';
    var els = [], P = pal(s);
    var top = hdr(els, s, P) + 2;
    var gap = 14, cw = (CW - 2 * gap) / 3, pad = 14, iw = cw - 2 * pad, arrowH = 22, avail = BOTTOM - top - arrowH - 12;
    var rowsOf = function (it) { return it.points.filter(real).map(function (p) { var m = p.match(/^([^:]{2,24}):\s*(.+)$/); return m ? { label: m[1], text: m[2] } : { label: '', text: p }; }); };
    var lw = 54;
    var need = maxOf(items, function (it) {
      return pad + 22 + 8 + th(it.title, iw, 10, 500) + 4 + (it.subtitle ? th(it.subtitle, iw, 8.5, 400) + 10 : 6) +
        rowsOf(it).reduce(function (a, r) { return a + Math.max(14, th(r.text, iw - (r.label ? lw : 16), 8.5, 400)) + 8; }, 0) + pad;
    });
    if (need > avail) return null;
    var ch = boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap);
      K.roundrect(els, x, top, cw, ch, P.dark ? P.card : T.white, { color: P.line, width: 0.75 });
      icon(els, it, x + pad, top + pad, 20, P.dark);
      var y = top + pad + 30;
      var r = K.text(els, x + pad, y, iw, 14, it.title, { weight: 500, max: 10, min: 9.5, maxLines: 2, color: P.head });
      y += r.height + 4;
      if (it.subtitle) { var sr = K.text(els, x + pad, y, iw, 14, it.subtitle, { weight: 400, max: 8.5, min: 8, maxLines: 2, color: P.muted }); y += sr.height + 10; } else y += 6;
      rowsOf(it).forEach(function (rw) {
        K.text(els, x + pad, y, 12, 12, '✓', { weight: 500, max: 9, min: 9, maxLines: 1, color: P.head });
        var tx = x + pad + 16;
        if (rw.label) K.text(els, tx, y, lw - 16, 12, rw.label + ':', { weight: 500, max: 8.5, min: 8, maxLines: 1, color: P.ink });
        var tr = K.text(els, tx + (rw.label ? lw - 16 : 0), y, iw - 16 - (rw.label ? lw - 16 : 0), 14, rw.text, { weight: 400, max: 8.5, min: 8, color: P.body });
        y += Math.max(14, tr.height) + 8;
      });
    });
    var ay = Math.min(BOTTOM - arrowH, top + ch + 14);                   // the arrow right under the cards
    K.shape(els, 'HOME_PLATE', CX, ay, CW, arrowH, T.blue);
    K.text(els, CX + 16, ay, CW - 50, arrowH, take, { weight: 500, max: 9, min: 8.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    return done(els, P);
  });

  /* ---------- 22. Client story: who they are, the challenge, the journey, the figures — Building a $1.2M partnership ---------- */
  add('S66_CLIENT_STORY', 'case_study', { min: 0, max: 99, needs: 'challenge[] (2-4), client[] (3-5 points about the client), journey (one sentence), items[{value,label}] (2-3 figures)',
    desc: 'a client story: who the client is (blue heading and bullets) on the left, a challenge box and a journey box on the right, the figures in a row at the bottom of the journey (a client result the request or the material gives)', words: 'points 6-16; journey 12-30' }, function (s) {
    var who = K.arr(s.client || s.about, 6).map(K.str).map(clean).filter(real);
    var ch = K.arr(s.challenge, 5).map(K.str).map(clean).filter(real);
    var jr = clean(s.journey || s.approach);
    var figs = K.items(s, 4).map(function (it) { return { value: clean(it && it.value), label: clean(it && (it.label || it.title)) }; }).filter(function (f) { return f.value && /\d/.test(f.value); });
    if (who.length < 2 || ch.length < 2 || !real(jr) || figs.length > 3) return null;
    var els = [];
    var top = K.header(els, s) + 2;
    var lw = CW * 0.52, gap = 20, rw = CW - lw - gap, avail = BOTTOM - top, pad = 12;
    var lNeed = lh(TSZ.heading) + 8 + ptsH(who, lw, TSZ.body, 6);
    if (lNeed > avail) return null;
    heading(els, CX, top + 4, lw, clean(s.clientLabel) || 'The client', T.blue, 1);
    bullets(els, CX, top + 4 + lh(TSZ.heading) + 8, lw, avail - lh(TSZ.heading) - 12, who, 6);
    var rx = CX + lw + gap;
    var cH = pad + lh(TSZ.heading) + 6 + ptsH(ch, rw - 2 * pad, 9, 3) + pad;
    var jH = pad + lh(TSZ.heading) + 6 + th(jr, rw - 2 * pad, 9, 400) + (figs.length ? 44 : 0) + pad;
    if (cH + 12 + jH > avail) return null;
    K.rect(els, rx, top, rw, cH, T.white, { color: LINE, width: 0.75 });
    heading(els, rx + pad, top + pad, rw - 2 * pad, 'The challenge', T.ink, 1);
    K.bulletList(els, rx + pad, top + pad + lh(TSZ.heading) + 6, rw - 2 * pad, cH - 2 * pad - lh(TSZ.heading) - 6, ch, { max: 9, min: 9, gap: 3, color: T.ink, bullet: T.ink });
    var jy = top + cH + 12, jh = Math.max(jH, avail - cH - 12);
    K.rect(els, rx, jy, rw, jh, T.white, { color: LINE, width: 0.75 });
    heading(els, rx + pad, jy + pad, rw - 2 * pad, 'The journey', T.ink, 1);
    K.text(els, rx + pad, jy + pad + lh(TSZ.heading) + 6, rw - 2 * pad, 40, jr, { weight: 400, max: 9, min: 9, color: T.ink });
    if (figs.length) {
      var fy = jy + jh - pad - 36, fw = (rw - 2 * pad) / figs.length;
      K.roundrect(els, rx + pad, fy, rw - 2 * pad, 36, T.bgLight);
      figs.forEach(function (f, i) {
        K.text(els, rx + pad + i * fw + 4, fy + 3, fw - 8, 18, f.value, { font: 'mono', weight: 500, max: 13, min: 10, maxLines: 1, align: 'center', color: T.blue });
        K.text(els, rx + pad + i * fw + 4, fy + 21, fw - 8, 12, f.label, { weight: 400, max: 8, min: 7.5, maxLines: 1, align: 'center', color: T.ink });
      });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 23. Dark hub: services around a centre, governance underneath — Services support and delivery framework ---------- */
  add('S66_SERVICE_HUB_DARK', 'diagram', { min: 4, max: 6, needs: 'center (the hub name), items[{title}] (4-6 services), governance[] (2-4 short boxes)',
    desc: 'a dark slide: the hub in a blue circle at the centre, 4-6 services on pills to the left and right joined to it, and a governance bar under the hub with 2-4 governance boxes (a service model, a support framework, how delivery is governed)', words: 'service 1-4; governance 3-8' }, function (s) {
    var center = clean(s.center || s.hub || s.core);
    var items = itemsOf(s, 6), n = items.length;
    var gov = K.arr(s.governance || s.boxes, 5).map(function (g) { return clean(typeof g === 'object' ? (g && (g.title || g.text)) : g); }).filter(real);
    // V.1_55 (deck 26: a prediction slide with "How the model" in the hub): a service or delivery model, and a hub that is a name
    var hubTitle = String(s.title || '') + ' ' + String(s.lead || '');
    if (!/\b(servic\w*|support\w*|operat\w*|govern\w*|deliver\w*|run\b|running|team\w*|managed|hub|centre|center of)\b/i.test(hubTitle)) return null;
    if (center && /^(how|what|why|the|a|an|our|your|when|where)\b/i.test(center)) return null;
    if (center && center.split(/\s+/).length >= 2 && String(s.title || '').toLowerCase().indexOf(center.toLowerCase()) === 0) return null;
    if (!center || center.split(/\s+/).length > 3 || n < 4 || n > 6 || gov.length > 4 || items.some(function (it) { return it.title.split(/\s+/).length > 5; })) return null;
    var els = [], P = pal({ dark: true });
    var top = hdr(els, s, P) + 6;
    var govH = gov.length ? 44 : 0, govBar = gov.length ? 18 : 0;
    var hubBottom = BOTTOM - (gov.length ? govH + govBar + 26 : 0);
    var cy = top + (hubBottom - top) / 2, cx = W / 2, d = 70;
    if (hubBottom - top < 130) return null;
    var left = items.slice(0, Math.ceil(n / 2)), right = items.slice(Math.ceil(n / 2));
    var pillW = 190, pillH = 24;
    var side = function (list, dir) {
      var m = list.length, span = Math.min(hubBottom - top - 20, m * 44), y0 = cy - span / 2 + span / (2 * m);
      list.forEach(function (it, i) {
        var py = y0 + i * (span / m), px = dir < 0 ? cx - d / 2 - 50 - pillW : cx + d / 2 + 50;
        K.line(els, dir < 0 ? px + pillW : px, py, dir < 0 ? cx - d / 2 : cx + d / 2, cy, '#4A5A86', 0.75);
        K.roundrect(els, px, py - pillH / 2, pillW, pillH, '#152049', { color: '#2E3E70', width: 0.75 });
        K.ellipse(els, dir < 0 ? px + pillW - 16 : px + 6, py - 5, 10, 10, '#2FB37A');
        K.text(els, px + (dir < 0 ? 10 : 22), py - pillH / 2, pillW - 32, pillH, it.title, { weight: 400, max: 9, min: 8.5, maxLines: 1, align: dir < 0 ? 'right' : 'left', valign: 'middle', color: T.white });
      });
    };
    side(left, -1); side(right, 1);
    K.ellipse(els, cx - d / 2 - 6, cy - d / 2 - 6, d + 12, d + 12, '#1B2C6E');
    K.ellipse(els, cx - d / 2, cy - d / 2, d, d, T.blue);
    K.text(els, cx - d / 2 + 6, cy - d / 2, d - 12, d, center, { weight: 500, max: 11, min: 9, maxLines: 3, align: 'center', valign: 'middle', color: T.white });
    if (gov.length) {
      var gy = BOTTOM - govH, by = gy - govBar - 8;
      K.line(els, cx, cy + d / 2 + 6, cx, by, '#4A5A86', 0.75);
      K.rect(els, cx - 70, by, 140, govBar, T.blue);
      K.text(els, cx - 70, by, 140, govBar, clean(s.governanceLabel) || 'Governance', { weight: 500, max: 9, min: 8.5, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      var gw = (CW - 10 * (gov.length - 1)) / gov.length;
      gov.forEach(function (g, i) {
        var x = CX + i * (gw + 10);
        K.line(els, x + gw / 2, gy - 6, x + gw / 2, gy, '#4A5A86', 0.75);
        K.rect(els, x, gy, gw, govH, '#1B2C6E');
        K.text(els, x + 8, gy, gw - 16, govH, g, { weight: 400, max: 8.5, min: 8, maxLines: 3, align: 'center', valign: 'middle', color: T.white });
      });
      K.line(els, CX + gw / 2, gy - 6, CX + CW - gw / 2, gy - 6, '#4A5A86', 0.75);
      K.line(els, cx, by + govBar, cx, gy - 6, '#4A5A86', 0.75);
    }
    return done(els, P);
  });
})();
