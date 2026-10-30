/* =========================================================================================================
   66° Deck Agent — Proposal Deck design library (V.1_42), part 3: delivery, phases and diagrams
   Phase bars and columns, Gantt roadmap, phase detail with photo strip, step flow, cycle, adoption curve,
   architecture flow, message / system flow, hub and spoke, isometric stack with callouts, L0-L2 tiers,
   governance tree, pyramid, puzzle and offering radar.
   Every design here draws only in a Proposal Deck (ENGINE.addProposalDesign).
   ========================================================================================================= */
(function () {
  var K = ENGINE.kit, T = K.T, TSZ = K.TSZ, W = K.W, H = K.H, X0 = K.X0, CX = K.CX, CW = K.CW, BOTTOM = K.BOTTOM;
  var add = ENGINE.addProposalDesign;

  /* ---------------- local helpers ---------------- */
  // Blue tints of the 66° blue (#0052FF) for ramps, stacks and fills
  var B1 = '#3375FF', B2 = '#6697FF', B3 = '#99BAFF', B4 = '#CCDCFF', GREY = '#9AA4B2';
  // n colours from dark to light (night blue, 66° blue, then lighter blue tints)
  function ramp_(n, from) {
    var all = [T.ink, T.blue, B1, B2, B3, B4].slice(from || 0);
    var out = [];
    for (var i = 0; i < n; i++) out.push(all[n === 1 ? 0 : Math.round(i * (all.length - 1) / (n - 1))]);
    return out;
  }
  function lh_(size) { return K.lineHeight('sans', size); }
  function th_(str, w, size, weight) { return str ? K.textH(String(str), w, size, weight || 400) : 0; }
  function maxH_(list, w, size, weight) { var m = 0; list.forEach(function (t) { m = Math.max(m, th_(t, w, size, weight)); }); return m; }
  function itemsOf_(s, max) {
    return K.arr(s.items, max).map(function (it) { return typeof it === 'string' ? { title: it, text: '' } : it; })
      .filter(function (it) { return it && (it.title || it.text || it.label); });
  }
  function pointsOf_(v, max) { return K.arr(v, max).map(K.str).filter(Boolean); }
  // Isosceles triangle with its apex at O and its base from P to Q (a rotated TRIANGLE shape)
  function iso_(els, O, P, Q, fill) {
    var M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    var dx = M.x - O.x, dy = M.y - O.y, h = Math.sqrt(dx * dx + dy * dy), w = Math.sqrt((P.x - Q.x) * (P.x - Q.x) + (P.y - Q.y) * (P.y - Q.y));
    if (h < 0.4 || w < 0.4) return;
    var cx = (O.x + M.x) / 2, cy = (O.y + M.y) / 2, rot = Math.atan2(-dx, dy) * 180 / Math.PI;
    h += 0.7; w += 0.7;                                          // a hair larger so neighbouring pieces close their seams
    els.push({ t: 'shape', shape: 'TRIANGLE', x: cx - w / 2, y: cy - h / 2, w: w, h: h, fill: fill, line: null, rot: Math.round(rot * 100) / 100 });
  }
  // Any triangle, drawn as up to four isosceles triangles (altitude split, then hypotenuse midpoints)
  function tri_(els, A, B, C, fill) {
    var P = [A, B, C], best = 0, bi = 0;
    for (var i = 0; i < 3; i++) {
      var U = P[(i + 1) % 3], V = P[(i + 2) % 3], d = (U.x - V.x) * (U.x - V.x) + (U.y - V.y) * (U.y - V.y);
      if (d > best) { best = d; bi = i; }
    }
    var Vx = P[bi], U1 = P[(bi + 1) % 3], U2 = P[(bi + 2) % 3];
    if (best < 0.5) return;
    var t = ((Vx.x - U1.x) * (U2.x - U1.x) + (Vx.y - U1.y) * (U2.y - U1.y)) / best;
    var F = { x: U1.x + t * (U2.x - U1.x), y: U1.y + t * (U2.y - U1.y) };
    [U1, U2].forEach(function (U) {
      var O = { x: (Vx.x + U.x) / 2, y: (Vx.y + U.y) / 2 };
      iso_(els, O, Vx, F, fill);
      iso_(els, O, F, U, fill);
    });
  }
  // Filled arrowhead with its tip at (x, y), pointing along angle `ang` (degrees, 0 = right, 90 = down)
  function head_(els, x, y, ang, len, half, fill) {
    var a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
    var mx = x - ux * len, my = y - uy * len;
    iso_(els, { x: x, y: y }, { x: mx - uy * half, y: my + ux * half }, { x: mx + uy * half, y: my - ux * half }, fill);
  }
  // Line with an arrowhead at its end; dash optional
  function arrow_(els, x1, y1, x2, y2, color, width, dash) {
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    if (len < 4) return;
    var ux = (x2 - x1) / len, uy = (y2 - y1) / len, hl = 6 + (width || 1);
    var ex = x2 - ux * (hl - 1), ey = y2 - uy * (hl - 1);
    if (dash) K.dashedLine(els, x1, y1, ex, ey, color, width || 1, 4, 3);
    else K.line(els, x1, y1, ex, ey, color, width || 1);
    head_(els, x2, y2, Math.atan2(uy, ux) * 180 / Math.PI, hl, hl * 0.55, color);
  }
  // Title (11 Medium) + text (10 Regular) block; returns its height. Height only when els is null.
  function cap_(els, x, y, w, title, body, align, tSize, bSize, tColor) {
    tSize = tSize || TSZ.heading; bSize = bSize || TSZ.body;
    var h1 = th_(title, w, tSize, 500), h2 = th_(body, w, bSize, 400), gap = title && body ? 2 : 0;
    if (els) {
      if (title) K.text(els, x, y, w, h1, title, { weight: 500, max: tSize, min: tSize, maxLines: 3, align: align || 'left', color: tColor || T.ink });
      if (body) K.text(els, x, y + h1 + gap, w, h2, body, { weight: 400, max: bSize, min: bSize, maxLines: 8, align: align || 'left', color: T.body });
    }
    return h1 + gap + h2;
  }
  function phaseLabel_(t, i, s) {
    t = String(t || '');
    if (/^(phase|stage|step|wave|sprint)\b/i.test(t)) return t;
    // V.1_47: "Phase n:" only on a plan (roadmap, rollout, methodology); other steps keep their own names
    var plan = !s || /\b(phases?|phased|stages?|waves?|roadmap|rollout|roll-out|deployment (plan|phases)|implementation (plan|phases)|delivery plan|methodology|go-?live|pilot)\b/i.test(String(s.title || ''));   // V.1_48: the title says it is a plan
    return plan ? 'Phase ' + (i + 1) + ': ' + t : t;
  }

  // V.1_47: data sources, systems or tools side by side are not levels: never on a pyramid or a layer stack
  function sourcesList_(items) {
    var k = items.filter(function (it) { return /\b(data|sources?|systems?|feeds?|tools?|apps?|platforms?|crm|erp)\s*$/i.test(String(it.title || '')); }).length;
    return k >= Math.ceil(items.length / 2);
  }

  /* ---------- 1. Numbered step bars with panels — proposals pages 13, 128, 149, 61, 196, 303 ---------- */
  add('P66_CHEVRON_PHASES', 'process', { min: 3, max: 6, needs: 'items',
    desc: 'phases or steps: a row of blue numbered bars (style "chevron" for chevrons) with a short title under each and a text panel below; optional takeaway line (items[{title, text}], 3-6)', words: '15-35' }, function (s) {
    var items = itemsOf_(s, 6), n = items.length;
    if (n < 3 || n > 6) return null;
    var els = [];
    var top = K.header(els, s);
    var chev = /chevron/i.test(String(s.style || (s.reference && s.reference.style) || ''));
    var gap = chev ? 2 : (n > 4 ? 8 : 12), colW = (CW - gap * (n - 1)) / n;
    var fills = ramp_(n, chev ? 1 : 0), barH = 28, tw = colW - 12, bw = colW - 20;
    var titles = items.map(function (it) { return it.title || ''; }), texts = items.map(function (it) { return it.text || ''; });
    var tSize = K.uniformSize(titles, tw, 2 * lh_(TSZ.heading) + 1, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2 });
    var titleH = maxH_(titles, tw, tSize, 500);
    var py = top + barH + 10 + titleH + 10;
    var take = s.takeaway ? String(s.takeaway) : '';
    var takeH = take ? th_(take, CW, TSZ.body) + 12 : 0;
    var avail = BOTTOM - py - takeH;
    var bSize = K.uniformSize(texts, bw, avail - 28, { weight: 400, max: TSZ.body, min: 9.5 });
    var need = maxH_(texts, bw, bSize) + 28;
    if (need > avail + 1) return null;
    var ph = K.boxH(need, avail);
    items.forEach(function (it, i) {
      var x = CX + i * (colW + gap);
      if (chev) {
        K.shape(els, i === 0 ? 'HOME_PLATE' : 'CHEVRON', x, top, colW + (i < n - 1 ? 8 : 0), barH, fills[i]);
      } else {
        K.rect(els, x, top, colW, barH, fills[i]);
        if (i < n - 1) K.line(els, x + colW, top + barH / 2, x + colW + gap, top + barH / 2, T.cardLine, 0.75);
      }
      K.text(els, x + (chev && i ? 8 : 0), top, colW - (chev ? 8 : 0), barH, String(i + 1), { font: 'mono', weight: 500, max: 12, min: 12, maxLines: 1, align: 'center', valign: 'middle', color: K.onFill(fills[i]) });
      K.text(els, x + 6, top + barH + 10, tw, titleH, it.title, { weight: 500, max: tSize, min: tSize, maxLines: 2, align: 'center', color: T.ink });
      K.rect(els, x, py, colW, ph, T.bgLight);
      K.rect(els, x, py, colW, 2, fills[i]);
      K.text(els, x + 10, py + 14, bw, ph - 24, it.text, { weight: 400, max: bSize, min: bSize, color: T.body });
    });
    if (take) K.text(els, X0, py + ph + 12, CW, takeH - 8, take, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, color: T.blue });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 2. Phase columns with a path line — proposals pages 240, 152, 198, 254 ---------- */
  add('P66_PHASE_COLUMNS', 'process', { min: 3, max: 4, needs: 'items',
    desc: 'deployment phases: 3-4 columns with a coloured "Phase n: ..." header bar and bullets, a thin path line at the bottom (items[{title, points[]}], takeaway = "Planning → Pilot → Scale")', words: '25-45' }, function (s) {
    var items = itemsOf_(s, 4), n = items.length;
    if (n < 3 || n > 4) return null;
    if (items.some(function (it) { return !pointsOf_(it.points, 7).length && !it.text; })) return null;
    var els = [];
    var top = K.header(els, s);
    var gap = 14, colW = (CW - gap * (n - 1)) / n, headH = 32, bw = colW - 28;
    var fills = n === 3 ? [B2, T.blue, T.ink] : [B2, B1, T.blue, T.ink];
    var path = s.takeaway ? String(s.takeaway) : items.map(function (it) { return String(it.title || '').replace(/^(phase|stage)\s*\d+\s*[:\-–]\s*/i, ''); }).join('  →  ');
    var pathH = 26, avail = BOTTOM - top - headH - pathH - 12;
    var lists = items.map(function (it) { var p = pointsOf_(it.points, 7); return p.length ? p : [it.text]; });
    function need(size) {
      var m = 0;
      lists.forEach(function (l) { var t = 0; l.forEach(function (p) { t += th_(p, bw - 16, size) + 7; }); m = Math.max(m, t - 7); });
      return m + 30;
    }
    var size = TSZ.body;
    while (size > 9.5 && need(size) > avail) size -= 0.5;
    if (need(size) > avail + 1) return null;
    var ch = Math.min(avail, Math.max(need(size), avail * 0.86));
    var hSize = K.uniformSize(items.map(function (it, i) { return phaseLabel_(it.title, i, s); }), colW - 20, headH - 4, { weight: 500, max: 11.5, min: 10, maxLines: 2 });
    items.forEach(function (it, i) {
      var x = CX + i * (colW + gap);
      K.rect(els, x, top, colW, headH, fills[i]);
      K.text(els, x + 10, top, colW - 20, headH, phaseLabel_(it.title, i, s), { weight: 500, max: hSize, min: hSize, maxLines: 2, align: 'center', valign: 'middle', color: T.white });
      K.rect(els, x, top + headH, colW, ch, T.bgLight);
      K.bulletList(els, x + 14, top + headH + 15, bw, ch - 24, lists[i], { max: size, min: size, gap: 7 });
    });
    var yP = top + headH + ch + 12;
    K.rect(els, CX, yP, CW, pathH, T.white, { color: T.cardLine, width: 0.75 });
    K.text(els, CX + 12, yP, CW - 24, pathH, path, { weight: 500, max: TSZ.body, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.ink });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 3. Gantt roadmap — proposals pages 136, 41, 235, 333, 145, 146 ---------- */
  function ganttLanes_(s, periods) {
    function idx(v) {
      if (typeof v === 'number') return v;
      var k = periods.indexOf(String(v));
      return k >= 0 ? k + 1 : parseFloat(v);
    }
    var lanes = [];
    if (Array.isArray(s.lanes) && s.lanes.length) {
      lanes = s.lanes.map(function (l) { return { name: l.name || l.title || '', bars: K.arr(l.bars, 6) }; });
    } else {
      var byName = {};
      K.arr(s.tasks, 24).forEach(function (t) {
        var key = t.lane || t.name || t.title || '';
        if (!byName[key]) { byName[key] = { name: key, bars: [] }; lanes.push(byName[key]); }
        byName[key].bars.push({ start: t.start, end: t.end, label: t.label != null ? t.label : (t.lane ? (t.name || t.title) : ''), group: t.group, milestone: t.milestone });
      });
    }
    lanes.forEach(function (l) {
      l.bars = l.bars.map(function (b) {
        var st = idx(b.start), en = b.end != null ? idx(b.end) : st;
        return { start: st, end: Math.max(st, en), label: b.label || '', group: b.group, milestone: !!b.milestone };
      }).filter(function (b) { return isFinite(b.start) && b.start <= periods.length && b.end >= 1; });
      // V.1_57: a bar that starts before the first period (start 0) is drawn from period 1, not dropped
      l.bars.forEach(function (b) { b.start = Math.max(1, b.start); b.end = Math.min(Math.max(b.end, b.start), periods.length); });
    });
    lanes = lanes.filter(function (l) { return l.name && l.bars.length; });
    // V.1_58 (deck 31: the Ulta roadmap with a gate inside each phase lane could not be drawn): checkpoints that share a
    // lane with bars move to one checkpoint lane of their own, under the phases
    lanes.forEach(function (l) {                                      // a one-period gate or checkpoint is a milestone diamond
      l.bars.forEach(function (b) { if (!b.milestone && b.start === b.end && /\b(gate|checkpoint|milestone|sign-?off|go-live|go\/no-go|handoff|decision)\b/i.test(String(b.label || '') + ' ' + l.name)) b.milestone = true; });
    });
    var mixed = lanes.filter(function (l) { return l.bars.some(function (b) { return b.milestone; }) && l.bars.some(function (b) { return !b.milestone; }); });
    if (mixed.length) {
      var ms = [];
      mixed.forEach(function (l) { l.bars = l.bars.filter(function (b) { if (b.milestone) { ms.push(b); return false; } return true; }); });
      var own = lanes.filter(function (l) { return l.bars.length && l.bars.every(function (b) { return b.milestone; }); })[0];
      if (own) own.bars = own.bars.concat(ms).sort(function (a, b) { return a.start - b.start; });
      else lanes.push({ name: /checkpoint|gate/i.test(ms.map(function (b) { return b.label; }).join(' ')) ? 'Value checkpoints' : 'Milestones', bars: ms.sort(function (a, b) { return a.start - b.start; }) });
    }
    // V.1_57: the roadmap names "Phase 2" and "Phase 3" but has no Phase 1 lane: the first phase gets its own lane
    // in the free periods before Phase 2, so the plan never starts at Phase 2
    var phaseNo = function (l) { var m = /\bphase\s*(\d)\b/i.exec(l.name); return m ? Number(m[1]) : 0; };
    var nums = lanes.map(phaseNo).filter(Boolean);
    if (nums.length && nums.indexOf(1) < 0 && nums.indexOf(2) >= 0) {
      var p2 = lanes.filter(function (l) { return phaseNo(l) === 2; })[0];
      var firstStart = Math.min.apply(null, p2.bars.map(function (b) { return b.start; }));
      if (firstStart > 1) {
        var said = String([s.text, s.subtitle, s.notes, s.lead].join(' '));
        var m1 = /phase\s*1\s*[:(\-–—]\s*([a-z][a-z ,&-]{3,40})/i.exec(said);
        var what = m1 ? m1[1].replace(/[\s,]+$/, '') : 'Discovery and data foundation';
        what = what.charAt(0).toUpperCase() + what.slice(1);
        lanes.unshift({ name: 'Phase 1: ' + what, bars: [{ start: 1, end: firstStart - 1, label: what, group: undefined, milestone: false }] });
        if (typeof Logger !== 'undefined') Logger.log('V.1_57 Gantt: added the missing Phase 1 lane (periods 1-' + (firstStart - 1) + ').');
      }
    }
    return lanes;
  }
  add('P66_GANTT', 'timeline', { min: 2, max: 8, needs: 'periods',
    desc: 'Gantt roadmap: blue period header, 3-6 workstream rows (never fewer than 3), bars spanning periods with short labels, legend (periods[] 4-12, lanes[{name, bars[{start, end, label, group}]}] or tasks[{name, lane, start, end, label, group}], start/end = period numbers from 1; legend[] names the groups; a bar with milestone:true is a diamond)', words: '30-60' }, function (s) {
    var periods = pointsOf_(s.periods, 12);
    if (periods.length < 4) return null;
    var lanes = ganttLanes_(s, periods), nl = lanes.length, np = periods.length;
    if (nl < 3 || nl > 8) return null;                         // V.1_47: a roadmap of 1-2 lanes leaves the slide empty (phases instead)
    var els = [];
    var top = K.header(els, s);
    var palette = [T.blue, T.ink, B2, T.slate, B3, B1];
    var legend = K.arr(s.legend, 6).map(function (l) { return typeof l === 'string' ? l : (l.label || l.title || ''); }).filter(Boolean);
    if (!legend.length) {
      var seen = {};
      lanes.forEach(function (l) { l.bars.forEach(function (b) { if (b.group && !seen[b.group]) { seen[b.group] = 1; legend.push(String(b.group)); } }); });
    }
    // V.1_74 (deck 45 Proposal 22: a legend "Active delivery phase / Milestone review at each phase exit" over bars coloured
    // by their row, so the Phase 2 bar read as a milestone review): a legend is drawn only when bars carry its groups
    var grouped = lanes.some(function (l) { return l.bars.some(function (b) { return b.group != null && b.group !== '' && (typeof b.group === 'number' || legend.indexOf(String(b.group)) !== -1); }); });
    if (!grouped) legend = [];
    function colorOf(b, li) {
      if (b.group != null && b.group !== '') {
        var k = typeof b.group === 'number' ? b.group : legend.indexOf(String(b.group));
        if (k >= 0) return palette[k % palette.length];
      }
      return palette[li % palette.length];
    }
    var labelW = 150, gx = CX + labelW, gw = CW - labelW, pw = gw / np, headH = 24;
    var legH = legend.length ? 30 : 0;
    // bars that overlap inside one lane go on separate tracks (the lane gets taller)
    var units = 0;
    lanes.forEach(function (l) {
      var ends = [];
      l.bars.forEach(function (b) {
        if (b.milestone) { b.track = 0; return; }
        var t = 0;
        while (ends[t] != null && ends[t] >= b.start) t++;
        b.track = t; ends[t] = b.end;
      });
      l.tracks = Math.max(1, ends.length);
      l.u = l.tracks === 1 ? 1 : 0.7 * l.tracks;
      units += l.u;
    });
    var hasMs = lanes.some(function (l) { return l.bars.some(function (b) { return b.milestone && b.label; }); });
    var rowsTop = top + headH + 4, unitH = Math.min(nl <= 3 ? 64 : nl <= 4 ? 52 : nl <= 5 ? 42 : (hasMs ? 42 : 32), (BOTTOM - legH - rowsTop) / units);   // V.1_47: few lanes fill the slide
    if (unitH < 24) return null;
    var gridH = units * unitH;
    // header row
    K.rect(els, CX, top, CW, headH, T.blue);
    K.text(els, CX + 10, top, labelW - 14, headH, s.laneLabel || 'Workstream', { weight: 500, max: TSZ.body, min: 9, maxLines: 1, valign: 'middle', color: T.white });
    var pSize = K.uniformSize(periods, pw - 4, headH - 2, { weight: 500, max: TSZ.body, min: 9, maxLines: 1 });
    periods.forEach(function (p, j) {
      var x = gx + j * pw;
      K.text(els, x + 2, top, pw - 4, headH, p, { weight: 500, max: pSize, min: pSize, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
    });
    // rows: alternate light bands, grid lines, lane names
    var yy = rowsTop;
    lanes.forEach(function (l, i) { l.y = yy; l.h = l.u * unitH; if (i % 2 === 0) K.rect(els, CX, yy, CW, l.h, T.bgLight); yy += l.h; });
    for (var j = 0; j <= np; j++) K.line(els, gx + j * pw, rowsTop, gx + j * pw, rowsTop + gridH, T.cardLine, 0.5);
    var nSize = K.uniformSize(lanes.map(function (l) { return l.name; }), labelW - 16, unitH - 4, { weight: 500, max: TSZ.body, min: 9, maxLines: 2 });
    lanes.forEach(function (l, i) {
      var y = l.y, rowH = l.h;
      K.text(els, CX + 10, y, labelW - 16, rowH, l.name, { weight: 500, max: nSize, min: nSize, maxLines: 2, valign: 'middle', color: T.ink });
      var trackH = rowH / l.tracks;
      // V.1_57: every label is measured with the wider brand font (Google Slides sets it about 12% wider than the
      // metrics) and placed where it overlaps nothing: inside the bar, inside on two lines, beside the bar in free
      // space, or (milestones) above / below the diamond. A label with no free place rejects the Gantt (another design).
      var taken = [];                                    // label and bar boxes already in this row
      var hits = function (bx) {
        return taken.some(function (o) { return bx.x < o.x + o.w && o.x < bx.x + bx.w && bx.y < o.y + o.h && o.y < bx.y + bx.h; });
      };
      var lwOf = function (t) { return K.textWidth(t, 'sans', 500, 9) * 1.12 + 6; };
      var trackH0 = rowH / l.tracks;
      l.bars.forEach(function (b) {
        if (b.milestone) return;
        var bx0 = gx + (b.start - 1) * pw + 3, bw0 = (b.end - b.start + 1) * pw - 6;
        b.box = { x: bx0, w: bw0 };
        var bh0 = Math.min(18, (l.tracks > 1 ? trackH0 - 4 : trackH0 - 12));
        var room = l.tracks > 1 ? (rowH - 8) / l.tracks - 2 : rowH - 8;
        b.bh = bh0;
        if (b.label && lwOf(b.label) > bw0 - 12) {
          // V.1_58: two or three lines inside a taller bar when the row has the room
          var nl = K.wrap(String(b.label), (bw0 - 12) / 1.12, 'sans', 500, 9).length, needH = nl * K.lineHeight('sans', 9) + 8;
          if (nl <= 3 && needH <= room) { b.two = true; b.lines = nl; b.bh = Math.max(bh0, needH); }
        }
        b.by = l.tracks > 1 ? y + 4 + b.track * (rowH - 8) / l.tracks + ((rowH - 8) / l.tracks - b.bh) / 2 : y + (rowH - b.bh) / 2;
        taken.push({ x: bx0, y: b.by, w: bw0, h: b.bh });
      });
      l.bars.forEach(function (b) {
        if (!b.milestone) return;
        var mx = gx + (b.start - 0.5) * pw, d = 11;
        b.mx = mx;
        taken.push({ x: mx - d / 2, y: y + rowH / 2 - d / 2, w: d, h: d });
      });
      var failed = false;
      l.bars.forEach(function (b) {
        var fill = colorOf(b, i);
        if (b.milestone) {
          var mx = b.mx, d = 11;
          var dy = y + rowH / 2 - d / 2;
          K.shape(els, 'DIAMOND', mx - d / 2, dy, d, d, T.blue);
          if (!b.label) return;
          var lw = lwOf(b.label);
          var lx = Math.max(gx + 2, Math.min(gx + gw - lw - 2, mx - lw / 2));
          var spots = [{ x: lx, y: dy - 14, w: lw, h: 12 }, { x: lx, y: dy + d + 2, w: lw, h: 12 }];
          // beside the diamond when there is no room above or below
          spots.push({ x: mx + d / 2 + 4, y: dy - 1, w: lw, h: 12 });
          spots.push({ x: mx - d / 2 - 4 - lw, y: dy - 1, w: lw, h: 12 });
          var spot = spots.filter(function (sp) {
            return sp.y >= y + 1 && sp.y + sp.h <= y + rowH - 1 && sp.x >= gx && sp.x + sp.w <= gx + gw && !hits(sp);
          })[0];
          if (!spot) { failed = true; return; }
          taken.push(spot);
          K.text(els, spot.x, spot.y, spot.w, spot.h, b.label, { weight: 500, max: 9, min: 9, maxLines: 1, align: spot.x === lx ? 'center' : 'left', valign: 'middle', color: T.blue });
          return;
        }
        var x = b.box.x, w = b.box.w, bh = b.bh, by = b.by;
        K.roundrect(els, x, by, w, bh, fill);
        if (!b.label) return;
        var lw2 = lwOf(b.label);
        if (lw2 <= w - 12) { K.text(els, x + 6, by, w - 10, bh, b.label, { weight: 500, max: 9, min: 9, maxLines: 1, valign: 'middle', color: K.onFill(fill) }); return; }
        if (b.two) { K.text(els, x + 6, by, w - 10, bh, b.label, { weight: 500, max: 9, min: 9, maxLines: b.lines || 2, valign: 'middle', color: K.onFill(fill) }); return; }
        var right = { x: x + w + 5, y: by, w: lw2, h: bh }, left = { x: x - 5 - lw2, y: by, w: lw2, h: bh };
        var side = [right, left].filter(function (sp) { return sp.x >= gx && sp.x + sp.w <= gx + gw && !hits(sp); })[0];
        if (!side) { failed = true; return; }
        taken.push(side);
        K.text(els, side.x, side.y, side.w, side.h, b.label, { weight: 500, max: 9, min: 9, maxLines: 1, valign: 'middle', align: side === left ? 'right' : 'left', color: T.ink });
      });
      if (failed) l.failed = true;
    });
    if (lanes.some(function (l) { return l.failed; })) {
      if (typeof Logger !== 'undefined') Logger.log('V.1_57 Gantt: a label had no free place next to its bar; another design is used.');
      return null;
    }
    // legend
    if (legend.length) {
      var ly = rowsTop + gridH + 18, widths = legend.map(function (l) { return 16 + K.textWidth(l, 'sans', 400, 9) + 24; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0), lx = gx + Math.max(0, (gw - total) / 2);
      legend.forEach(function (l, k) {
        K.roundrect(els, lx, ly - 4, 11, 8, palette[k % palette.length]);
        K.text(els, lx + 16, ly - 8, widths[k] - 16, 16, l, { weight: 400, max: 9, min: 9, maxLines: 1, valign: 'middle', color: T.body });
        lx += widths[k];
      });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 4. Phase detail with photo strip — proposals pages 200, 208, 214, 262 ---------- */
  add('P66_PHASE_DETAIL', 'statement', { needs: 'text',
    desc: 'one phase in detail: "Phase 1: ..." title, a white card with a "Description:" paragraph and a "Deliverable:" paragraph, dark photo strip on the right (text = description, deliverable)', words: '45-90' }, function (s) {
    var desc = String(s.text || s.statement || ''), del = String(s.deliverable || (s.callout && s.callout.text) || '');
    if (!desc) return null;
    var els = [];
    K.rect(els, 0, 0, 548, H, T.bgLight);
    var top = K.header(els, s, { maxW: 490 });
    var cw = 536, iw = cw - 52;
    var blocks = [{ label: s.textLabel || 'Description', body: desc }];
    if (del) blocks.push({ label: s.deliverableLabel || 'Deliverable', body: del });
    var size = 11;
    function need(sz) { var t = 52; blocks.forEach(function (b, i) { t += lh_(TSZ.heading) + 4 + th_(b.body, iw, sz) + (i ? 18 : 0); }); return t; }
    while (size > TSZ.body && need(size) > BOTTOM - top - 20) size -= 0.5;
    var ch = need(size);
    if (ch > BOTTOM - top - 10) return null;
    var cy = top + Math.max(10, (BOTTOM - top - ch) / 2 - 8);
    K.rect(els, X0, cy, cw, ch, T.white, { color: T.cardLine, width: 0.75 });
    K.rect(els, X0, cy, 3.5, ch, T.blue);
    var y = cy + 26;
    blocks.forEach(function (b, i) {
      if (i) { K.line(els, X0 + 26, y + 8, X0 + 26 + iw, y + 8, T.cardLine, 0.75); y += 18; }
      K.text(els, X0 + 26, y, iw, lh_(TSZ.heading), b.label, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.blue });
      y += lh_(TSZ.heading) + 4;
      var hb = th_(b.body, iw, size);
      K.text(els, X0 + 26, y, iw, hb, b.body, { weight: 400, max: size, min: size, color: T.body });
      y += hb;
    });
    return { bg: T.ink, bgImage: 'section-bg', els: els, noBalance: true };
  });

  /* ---------- 5. Step flow: boxes joined by arrows — proposals pages 326, 322, 178 ---------- */
  add('P66_STEP_FLOW', 'process', { min: 3, max: 5, needs: 'items',
    desc: 'how it works: 3-5 boxes joined by arrows (icon, heading, short text), optional row of 2-3 notes underneath (items[{title, text, icon}], points[])', words: '12-30' }, function (s) {
    var items = itemsOf_(s, 5), n = items.length;
    if (n < 3 || n > 5) return null;
    var notes = pointsOf_(s.points, 3);
    var els = [];
    var top = K.header(els, s);
    var aw = n > 4 ? 26 : 34, bw = (CW - aw * (n - 1)) / n, iw = bw - 24;
    var titles = items.map(function (it) { return it.title; }), texts = items.map(function (it) { return it.text || ''; });
    var hT = maxH_(titles, iw, TSZ.heading, 500), hB = maxH_(texts, iw, TSZ.body);
    var need = 16 + 26 + 10 + hT + 6 + hB + 18;
    var nw = notes.length ? (CW - 12 * (notes.length - 1)) / notes.length : 0;
    var notesH = notes.length ? maxH_(notes, nw - 30, TSZ.body) + 22 : 0;
    var avail = BOTTOM - top - (notes.length ? notesH + 18 : 0);
    if (need > avail) return null;
    var bh = Math.min(avail, Math.max(need, Math.min(avail * (notes.length ? 0.6 : 0.72), need + 60)));
    var total = bh + (notes.length ? notesH + 18 : 0);
    var y0 = top + Math.max(0, (BOTTOM - top - total) / 2 - 6);
    items.forEach(function (it, i) {
      var x = CX + i * (bw + aw);
      K.rect(els, x, y0, bw, bh, T.bgLight);
      var iy = y0 + (bh - (26 + 10 + hT + 6 + hB)) / 2;
      K.icon(els, it.icon ? it : { icon: [it.title, it.text].join(' ').slice(0, 120) }, x + bw / 2 - 13, iy, 26, false);
      K.text(els, x + 12, iy + 36, iw, hT, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 3, align: 'center', color: T.ink });
      K.text(els, x + 12, iy + 36 + hT + 6, iw, hB, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
      if (i < n - 1) K.shape(els, 'RIGHT_ARROW', x + bw + aw / 2 - 9, y0 + bh / 2 - 7, 18, 14, T.blue);
    });
    if (notes.length) {
      var ny = y0 + bh + 18;
      notes.forEach(function (p, k) {
        var x = CX + k * (nw + 12);
        K.rect(els, x, ny, nw, notesH, T.white, { color: T.cardLine, width: 0.75 });
        K.rect(els, x, ny, 3.5, notesH, T.blue);
        K.text(els, x + 18, ny + 11, nw - 30, notesH - 18, p, { weight: 400, max: TSZ.body, min: TSZ.body, color: T.body });
      });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  // Label block placed outside a circle at angle `deg` (0 = right, 90 = down) around (cx, cy) at radius r
  function radialLabel_(els, cx, cy, r, deg, w, title, body, wide) {
    var a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    var px = cx + r * c, py = cy + r * sn;
    var bw = Math.abs(c) < 0.3 ? (wide || w) : w;
    var hh = cap_(null, 0, 0, bw, title, body);
    var x, y, align;
    if (c > 0.3) { x = px; align = 'left'; y = py - hh / 2; }
    else if (c < -0.3) { x = px - bw; align = 'right'; y = py - hh / 2; }
    else { x = px - bw / 2; align = 'center'; y = sn < 0 ? py - hh : py; }
    cap_(els, x, y, bw, title, body, align);
    return { x: x, y: y, w: bw, h: hh };
  }

  /* ---------- 6. Cycle — proposals pages 157, 286 ---------- */
  add('P66_CYCLE', 'diagram', { min: 4, max: 6, needs: 'items',
    desc: 'repeating cycle: 4-6 numbered stages on a ring with a centre label and short text by each stage, optional bullets on the left (center, items[{title, text}], points[])', words: '6-16' }, function (s) {
    var items = itemsOf_(s, 6), n = items.length;
    if (n < 4 || n > 6) return null;
    var pts = pointsOf_(s.points, 5);
    var els = [];
    var top = K.header(els, s);
    var half = (BOTTOM - top) / 2, cy = top + half;
    var cx = pts.length ? 474 : 360, R = Math.min(pts.length ? 72 : 80, half - 58), lw = pts.length ? 128 : 170;
    var sweep = 360 / n, fills = ramp_(n, 1);
    // label sizes must fit above / below the ring (V.1_50: the ring gets smaller, down to 48pt, until they do)
    var tooTall = function (r) {
      return items.some(function (it, i) {
        var mid = -90 + i * sweep, c = Math.cos(mid * Math.PI / 180);
        var hh = cap_(null, 0, 0, Math.abs(c) < 0.3 ? 200 : lw, it.title, it.text);
        return Math.abs(c) < 0.3 ? hh > half - r - 14 : hh > 90;
      });
    };
    while (R > 48 && tooTall(R)) R -= 4;
    if (R < 48 || tooTall(R)) return null;
    items.forEach(function (it, i) {
      K.arc(els, 'ring', cx, cy, R, sweep, -90 + i * sweep - sweep / 2, fills[i]);
    });
    var thick = R * 0.36;
    items.forEach(function (it, i) {
      // white radial gap between segment i and i + 1
      var bd = -90 + i * sweep + sweep / 2, b = bd * Math.PI / 180, rm = R - thick / 2;
      K.rbox(els, cx + rm * Math.cos(b), cy + rm * Math.sin(b), 3, thick + 6, bd + 90, T.white);
      var m = (-90 + i * sweep) * Math.PI / 180;
      K.text(els, cx + rm * Math.cos(m) - 14, cy + rm * Math.sin(m) - 8, 28, 16, K.pad2(i + 1), { font: 'mono', weight: 500, max: 10, min: 10, maxLines: 1, align: 'center', valign: 'middle', color: K.onFill(fills[i]) });
    });
    var ir = R - thick - 6;
    K.ellipse(els, cx - ir, cy - ir, ir * 2, ir * 2, T.bgLight);
    K.text(els, cx - ir + 8, cy - ir + 6, ir * 2 - 16, ir * 2 - 12, s.center || s.statement || '', { weight: 500, max: 13, min: 10, maxLines: 3, align: 'center', valign: 'middle', color: T.ink });
    items.forEach(function (it, i) {
      radialLabel_(els, cx, cy, R + 14, -90 + i * sweep, lw, it.title, it.text, 200);
    });
    if (pts.length) {
      var lx = X0, lwid = 196, lt = s.text ? String(s.text) : '';
      var hL = lt ? th_(lt, lwid, TSZ.heading, 500) + 12 : 0;
      var hP = 0; pts.forEach(function (p) { hP += th_(p, lwid - 16, TSZ.body) + 10; });
      var ly = cy - (hL + hP) / 2;
      if (lt) K.text(els, lx, ly, lwid, hL, lt, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.blue });
      K.bulletList(els, lx, ly + hL, lwid, hP, pts, { max: TSZ.body, min: TSZ.body, gap: 10 });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 7. Adoption / change curve — proposals pages 142, 60 ---------- */
  add('P66_CURVE', 'process', { min: 5, max: 8, needs: 'items',
    desc: 'adoption or change curve: a rising curve with 5-8 labelled steps along it and one sentence under the chart (items[{title}], text)', words: '2-4 per step' }, function (s) {
    var items = itemsOf_(s, 8), n = items.length;
    if (n < 5 || n > 8) return null;
    var els = [];
    var top = K.header(els, s);
    var note = String(s.text || s.takeaway || '');
    var noteH = note ? th_(note, CW - 40, TSZ.body) + 22 : 0;
    // V.1_51 (deck 23 slide 18): a label is never wider than the gap to the next step (they overlapped), and the design
    // refuses labels that do not fit in that width (2 lines for a step, 3 for its text): another design is used
    var lw = Math.min(120, 570 * 0.86 / (n - 1) - 6);
    var oneT = th_('Step', lw, TSZ.heading, 500), oneB = th_('step', lw, 9.5);
    var labH = 0, tooBig = false;
    items.forEach(function (it) {
      var ht = th_(it.title, lw, TSZ.heading, 500), hb = it.text ? th_(it.text, lw, 9.5) : 0;
      if (ht > oneT * 2 + 1 || hb > oneB * 3 + 1) tooBig = true;
      labH = Math.max(labH, ht + (it.text ? 2 + hb : 0));
    });
    if (tooBig) return null;
    var x0 = 70, x1 = 640, yb = BOTTOM - (note ? noteH + 14 : 0) - labH - 12, yt = top + 14;
    if (yb - yt < 120) return null;
    var k = 2.4;
    function P(t) { return { x: x0 + (x1 - x0) * t, y: yb - (yb - yt) * (Math.exp(k * t) - 1) / (Math.exp(k) - 1) }; }
    // dashed curve: short segments with small gaps, an arrow at the end
    var prev = P(0), segs = 46;
    for (var j = 1; j <= segs; j++) {
      var q = P(j / segs);
      if (j < segs) K.line(els, prev.x, prev.y, prev.x + (q.x - prev.x) * 0.62, prev.y + (q.y - prev.y) * 0.62, T.ink, 1);
      else arrow_(els, prev.x, prev.y, q.x + (q.x - prev.x) * 0.8, q.y + (q.y - prev.y) * 0.8, T.ink, 1);
      prev = q;
    }
    var fills = ramp_(n, 1).reverse();
    items.forEach(function (it, i) {
      var t = 0.05 + i * (0.86 / (n - 1)), p = P(t), d = 13;
      K.ellipse(els, p.x - d / 2 - 2, p.y - d / 2 - 2, d + 4, d + 4, T.white);
      K.ellipse(els, p.x - d / 2, p.y - d / 2, d, d, fills[i]);
      var lwi = Math.min(lw, CX + CW - p.x - 4);
      var hT = th_(it.title, lwi, TSZ.heading, 500);
      K.text(els, p.x + 4, p.y + 9, lwi, hT, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, color: T.ink });
      if (it.text) K.text(els, p.x + 4, p.y + 11 + hT, lwi, th_(it.text, lwi, 9.5), it.text, { weight: 400, max: 9.5, min: 9.5, maxLines: 3, color: T.body });
      K.text(els, p.x - 30, p.y - 22, 26, 14, K.pad2(i + 1), { font: 'mono', weight: 500, max: 9, min: 9, maxLines: 1, align: 'right', color: T.blue });
    });
    if (note) {
      var ny = BOTTOM - noteH;
      K.rect(els, CX, ny, CW, noteH, T.bgLight);
      K.text(els, CX + 20, ny + 11, CW - 40, noteH - 18, note, { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 3, color: T.body });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 8. Architecture flow: columns of stacked boxes — proposals pages 10, 25, 201, 202, 320, 327, 65 ---------- */
  add('P66_ARCH_FLOW', 'diagram', { min: 2, max: 4, needs: 'columns',
    desc: 'architecture / data flow: 2-4 columns of stacked boxes (source systems → platform → target) with labelled arrows between the columns, optional dashed note under it (columns[{label, items[] (text or {title, text})}], links[] = arrow labels (text or {label, sub}), takeaway)', words: '2-6 per box' }, function (s) {
    var cols = K.arr(s.columns, 4).map(function (c) {
      return { label: c.label || c.title || '', items: K.arr(c.items || c.points, 6).map(function (it) { return typeof it === 'string' ? { title: it, text: '' } : { title: it.title || it.label || '', text: it.text || '' }; }).filter(function (it) { return it.title; }) };
    }).filter(function (c) { return c.items.length; });
    var nc = cols.length;
    if (nc < 2 || nc > 4) return null;
    var els = [];
    var top = K.header(els, s);
    var links = K.arr(s.links, 3).map(function (l) { return typeof l === 'string' ? { label: l, sub: '' } : { label: l.label || '', sub: l.sub || l.text || '' }; });
    var ga = nc > 3 ? 64 : 84, cw = (CW - ga * (nc - 1)) / nc, bw = cw - 24;
    var fills = nc === 2 ? [T.blue, T.slate] : nc === 3 ? [T.blue, T.ink, T.slate] : [T.blue, B2, T.ink, T.slate];
    var all = []; cols.forEach(function (c) { c.items.forEach(function (it) { all.push(it); }); });
    var needBox = 0;
    all.forEach(function (it) { needBox = Math.max(needBox, th_(it.title, bw - 16, TSZ.body, 500) + (it.text ? 2 + th_(it.text, bw - 16, 9.5) : 0)); });
    var take = s.takeaway ? String(s.takeaway) : '';
    var avail = BOTTOM - top - (take ? 30 : 0);
    var maxK = Math.max.apply(null, cols.map(function (c) { return c.items.length; }));
    var bh = Math.max(needBox + 14, 34), bg = 8;
    var hdr = 34, hMax = hdr + maxK * (bh + bg) - bg + 14;
    if (hMax > avail) {
      hdr = 28; bh = Math.max(needBox + 8, 26); bg = 6; hMax = hdr + maxK * (bh + bg) - bg + 10;
      if (hMax > avail) return null;
    }
    var stretch = Math.min(avail * 0.9 - hMax, maxK * 10);
    if (stretch > 0) { bh += stretch / maxK; hMax = hdr + maxK * (bh + bg) - bg + 14; }
    var midY = top + Math.min(avail, hMax + 20) / 2;
    cols.forEach(function (c, j) {
      var x = CX + j * (cw + ga), ch = hdr + c.items.length * (bh + bg) - bg + 14, y = midY - ch / 2;
      K.rect(els, x, y, cw, ch, T.bgLight, { color: T.cardLine, width: 0.75 });
      K.text(els, x + 10, y + 4, cw - 20, hdr - 4, c.label, { weight: 500, max: TSZ.heading, min: 10, maxLines: 2, align: 'center', valign: 'middle', color: T.ink });
      c.items.forEach(function (it, k) {
        var by = y + hdr + k * (bh + bg), fill = fills[j];
        K.rect(els, x + 12, by, bw, bh, fill);
        var hh = th_(it.title, bw - 16, TSZ.body, 500) + (it.text ? 2 + th_(it.text, bw - 16, 9.5) : 0), ty = by + (bh - hh) / 2;
        var h1 = th_(it.title, bw - 16, TSZ.body, 500);
        if (!it.text) K.text(els, x + 20, by, bw - 16, bh, it.title, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', valign: 'middle', color: K.onFill(fill) });
        else K.text(els, x + 20, ty, bw - 16, h1, it.title, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: K.onFill(fill) });
        if (it.text) K.text(els, x + 20, ty + h1 + 2, bw - 16, hh - h1 - 2, it.text, { weight: 400, max: 9.5, min: 9.5, maxLines: 2, align: 'center', color: K.onFill(fill) });
      });
      if (j < nc - 1) {
        var ax = x + cw + 6, bx = x + cw + ga - 6, l = links[j] || { label: '', sub: '' };
        arrow_(els, ax, midY, bx, midY, T.ink, 1);
        if (l.label) K.text(els, x + cw + 2, midY - 32, ga - 4, 28, l.label, { weight: 500, max: 9.5, min: 9, maxLines: 2, align: 'center', valign: 'bottom', color: T.ink });
        if (l.sub) K.text(els, x + cw + 2, midY + 6, ga - 4, 28, l.sub, { weight: 400, max: 9, min: 9, maxLines: 2, align: 'center', color: T.body });
      }
    });
    if (take) {
      var yT = BOTTOM - 20;
      K.dashedLine(els, CX + cw * 0.6, yT, CX + CW - cw * 0.6, yT, GREY, 0.75, 4, 3);
      var tw = Math.min(CW - 40, K.textWidth(take, 'sans', 400, 9.5) + 24);
      K.rect(els, CX + CW / 2 - tw / 2, yT - 8, tw, 16, T.white);
      K.text(els, CX + CW / 2 - tw / 2, yT - 9, tw, 18, take, { weight: 400, max: 9.5, min: 9, maxLines: 1, align: 'center', valign: 'middle', color: T.body });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 9. Message / system flow — proposals pages 78, 79, 77, 85, 250 ---------- */
  var FLOW_STYLES_ = function () { return [{ color: T.blue, dash: false }, { color: T.blue, dash: true }, { color: T.ink, dash: false }, { color: T.ink, dash: true }]; };
  add('P66_DELIVERY_FLOW', 'diagram', { min: 3, max: 8, needs: 'nodes',
    desc: 'message or system flow: actor circles with icons, a central platform node (main:true), target nodes, labelled arrows and a small legend; nodes are laid out left to right in the order given (nodes[{id, label, icon, main, col}], links[{from, to, label, kind}], legend[] = the kinds, e.g. Inbound / Internal / Outbound)', words: '2-5 per label' }, function (s) {
    var nodes = K.arr(s.nodes, 8).filter(function (nd) { return nd && nd.id && nd.label; });
    var nn = nodes.length;
    if (nn < 3 || nn > 8) return null;
    var byId = {}; nodes.forEach(function (nd, i) { byId[nd.id] = { i: i, nd: nd, col: 0 }; });
    var links = K.arr(s.links, 14).filter(function (l) { return l && byId[l.from] && byId[l.to] && l.from !== l.to; });
    if (!links.length) return null;
    // columns: longest forward path (forward = later in the node list); an explicit col wins
    for (var pass = 0; pass < nn; pass++) links.forEach(function (l) {
      var a = byId[l.from], b = byId[l.to];
      if (a.i < b.i && b.col < a.col + 1) b.col = a.col + 1;
    });
    nodes.forEach(function (nd) { if (nd.col != null && isFinite(nd.col)) byId[nd.id].col = Number(nd.col); });
    var ncol = 0; nodes.forEach(function (nd) { ncol = Math.max(ncol, byId[nd.id].col + 1); });
    if (ncol < 2 || ncol > 5) return null;
    var els = [];
    var top = K.header(els, s);
    var legend = K.arr(s.legend, 4).map(function (l) { return typeof l === 'string' ? l : (l.label || ''); }).filter(Boolean);
    var styles = FLOW_STYLES_();
    function styleOf(l) {
      var k = typeof l.kind === 'number' ? l.kind : -1;
      if (k < 0 && l.kind) legend.forEach(function (g, j) { if (k < 0 && g.toLowerCase().indexOf(String(l.kind).toLowerCase()) === 0) k = j; });
      return styles[Math.max(0, k) % styles.length];
    }
    var areaTop = top + 6, areaBot = BOTTOM - (legend.length ? 30 : 6) - 34;   // centres of the circles
    var colsArr = [];
    nodes.forEach(function (nd) { var c = byId[nd.id].col; (colsArr[c] = colsArr[c] || []).push(nd); });
    var xL = 96, xR = 624;
    colsArr.forEach(function (list, c) {
      list = list || [];
      var k = list.length, sp = Math.min(118, (areaBot - areaTop) / Math.max(1, k - 1 || 1));
      var mid = (areaTop + areaBot) / 2;
      list.forEach(function (nd, j) {
        var o = byId[nd.id];
        o.x = ncol === 1 ? 360 : xL + c * (xR - xL) / (ncol - 1);
        o.y = k === 1 ? mid : mid + (j - (k - 1) / 2) * sp;
        if (nd.dy) o.y += Number(nd.dy) || 0;
        o.r = nd.main ? 38 : 23;
      });
    });
    // boxes the link labels must stay clear of: circles and the node captions under them
    var busy = [];
    nodes.forEach(function (nd) {
      var o = byId[nd.id], capW = nd.main ? 120 : 130;
      o.capTop = o.y + o.r + (nd.main ? 9 : 6);
      o.capH = nd.main ? (nd.text ? th_(nd.text, 120, 9) : 0) : th_(nd.label, 110, TSZ.body, 500) + (nd.text ? 1 + th_(nd.text, 130, 9) : 0);
      busy.push({ x: o.x - o.r - 4, y: o.y - o.r - 4, w: o.r * 2 + 8, h: o.r * 2 + 8 });
      if (o.capH) busy.push({ x: o.x - capW / 2, y: o.capTop, w: capW, h: o.capH });
    });
    function hits(r) { return busy.some(function (q) { return r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y; }); }
    // links (under the circles)
    var pairs = {};
    links.forEach(function (l) { pairs[l.from + '>' + l.to] = 1; });
    var labelEls = [];
    links.forEach(function (l) {
      var a = byId[l.from], b = byId[l.to], st = styleOf(l);
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var off = pairs[l.to + '>' + l.from] ? 6 : 0, nx = -uy * off, ny = ux * off;
      // a link that leaves downwards starts under the source's caption; one that arrives from below ends under the target's caption
      var s0 = a.r + 5, e0 = b.r + 5;
      if (uy > 0.8 && a.capH) s0 = (a.capTop + a.capH + 4 - a.y) / uy;
      if (uy < -0.8 && b.capH) e0 = (b.capTop + b.capH + 4 - b.y) / -uy;
      var x1 = a.x + ux * s0 + nx, y1 = a.y + uy * s0 + ny, x2 = b.x - ux * e0 + nx, y2 = b.y - uy * e0 + ny;
      arrow_(els, x1, y1, x2, y2, st.color, 1.1, st.dash);
      if (!l.label) return;
      var lwid = K.textWidth(String(l.label), 'sans', 500, 9) * 1.08 + 16, tw = Math.min(118, lwid), th = Math.ceil(lwid / 118) * lh_(9);
      var horiz = Math.abs(ux) >= Math.abs(uy), cands = [];
      [0.5, 0.35, 0.65, 0.25, 0.75].forEach(function (t) {
        var mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
        [1, -1].forEach(function (sd) {
          var side = off ? (horiz ? (ux > 0 ? 1 : -1) : (uy > 0 ? -1 : 1)) : sd;
          var c = horiz ? { x: mx - tw / 2, y: side < 0 ? my - th - 5 : my + 5 } : { x: side > 0 ? mx + 6 : mx - tw - 6, y: my - th / 2 };
          if (!horiz && Math.abs(ux) > 0.25) c.y += (ux > 0 === side > 0 ? -1 : 1) * (th / 2 + 4);
          c.w = tw; c.h = th;
          cands.push(c);
        });
      });
      var pick = null;
      cands.forEach(function (c) { if (!pick && !hits(c) && c.x >= X0 && c.x + c.w <= CX + CW) pick = c; });
      pick = pick || cands[0];
      busy.push({ x: pick.x - 2, y: pick.y - 1, w: pick.w + 4, h: pick.h + 2 });
      labelEls.push({ x: pick.x, y: pick.y, w: tw, h: th, t: String(l.label), c: st.color === T.blue ? T.blue : T.ink });
    });
    labelEls.forEach(function (b) {
      K.rect(els, b.x - 2, b.y - 1, b.w + 4, b.h + 2, T.white);
      K.text(els, b.x, b.y, b.w, b.h, b.t, { weight: 500, max: 9, min: 9, maxLines: 2, align: 'center', color: b.c });
    });
    nodes.forEach(function (nd) {
      var o = byId[nd.id];
      if (nd.main) {
        K.ellipse(els, o.x - o.r - 5, o.y - o.r - 5, o.r * 2 + 10, o.r * 2 + 10, B4);
        K.ellipse(els, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2, T.blue);
        K.text(els, o.x - o.r + 8, o.y - o.r + 8, o.r * 2 - 16, o.r * 2 - 16, nd.label, { weight: 500, max: TSZ.body, min: 9, maxLines: 4, align: 'center', valign: 'middle', color: T.white });
        if (nd.text) K.text(els, o.x - 60, o.y + o.r + 9, 120, 26, nd.text, { weight: 400, max: 9, min: 9, maxLines: 2, align: 'center', color: T.body });
      } else {
        K.ellipse(els, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2, T.bgLight);
        K.ring(els, o.x - o.r, o.y - o.r, o.r * 2, T.bgLight, T.cardLine, 0.75);
        K.icon(els, { icon: nd.icon || nd.label }, o.x - 11, o.y - 11, 22, false);
        var h1 = th_(nd.label, 110, TSZ.body, 500);
        K.text(els, o.x - 55, o.y + o.r + 6, 110, h1, nd.label, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.ink });
        if (nd.text) K.text(els, o.x - 65, o.y + o.r + 7 + h1, 130, 24, nd.text, { weight: 400, max: 9, min: 9, maxLines: 2, align: 'center', color: T.body });
      }
    });
    if (legend.length) {
      var ly = BOTTOM - 12, wl = legend.map(function (g) { return 30 + K.textWidth(g, 'sans', 400, 9.5) + 26; });
      var tot = wl.reduce(function (a, b) { return a + b; }, 0) + 20, lx = CX + CW - tot;
      K.rect(els, lx, ly - 12, tot, 24, T.bgLight);
      lx += 10;
      legend.forEach(function (g, j) {
        var st = styles[j % styles.length];
        arrow_(els, lx, ly, lx + 24, ly, st.color, 1.1, st.dash);
        K.text(els, lx + 30, ly - 8, wl[j] - 30, 16, g, { weight: 400, max: 9.5, min: 9.5, maxLines: 1, valign: 'middle', color: T.body });
        lx += wl[j];
      });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 10. Hub and spoke ecosystem — proposals pages 115, 107, 110 ---------- */
  add('P66_HUB', 'diagram', { min: 5, max: 8, needs: 'items',
    desc: 'ecosystem / platform: a central circle with the platform name and 5-8 surrounding nodes with icons, labels and a short line each (center, items[{title, text, icon}])', words: '4-12' }, function (s) {
    var items = itemsOf_(s, 8), n = items.length;
    if (n < 5 || n > 8) return null;
    var els = [];
    var top = K.header(els, s);
    var half = (BOTTOM - top) / 2, cx = 360, cy = top + half;
    var rx = 150, ry = Math.min(96, half - 58), nd = 40, lw = 150;
    if (ry < 70) return null;
    var start = n % 2 === 0 ? -90 + 180 / n : -90 + 180 / n;
    var pos = items.map(function (it, i) { var a = (start + i * 360 / n) * Math.PI / 180; return { a: a, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });
    // dashed orbit
    var segs = 72;
    for (var j = 0; j < segs; j += 2) {
      var a1 = j / segs * 2 * Math.PI, a2 = (j + 1) / segs * 2 * Math.PI;
      K.line(els, cx + rx * Math.cos(a1), cy + ry * Math.sin(a1), cx + rx * Math.cos(a2), cy + ry * Math.sin(a2), GREY, 0.75);
    }
    var cr = 56;
    pos.forEach(function (p) {
      var dx = p.x - cx, dy = p.y - cy, len = Math.sqrt(dx * dx + dy * dy);
      K.line(els, cx + dx / len * (cr + 6), cy + dy / len * (cr + 6), p.x - dx / len * (nd / 2 + 3), p.y - dy / len * (nd / 2 + 3), T.slate, 1);
    });
    K.ellipse(els, cx - cr - 7, cy - cr - 7, cr * 2 + 14, cr * 2 + 14, B4);
    K.ellipse(els, cx - cr, cy - cr, cr * 2, cr * 2, T.blue);
    K.text(els, cx - cr + 12, cy - cr + 10, cr * 2 - 24, cr * 2 - 20, s.center || s.statement || '', { weight: 500, max: 13, min: 10, maxLines: 4, align: 'center', valign: 'middle', color: T.white });
    var tooTall = false, boxes = [];
    items.forEach(function (it, i) {
      var p = pos[i], c = Math.cos(p.a), sn = Math.sin(p.a);
      K.ellipse(els, p.x - nd / 2, p.y - nd / 2, nd, nd, T.white);
      K.ring(els, p.x - nd / 2, p.y - nd / 2, nd, T.white, T.blue, 1);
      K.icon(els, it.icon ? it : { icon: [it.title, it.text].join(' ').slice(0, 120) }, p.x - 10, p.y - 10, 20, false);
      var bw = Math.abs(c) < 0.2 ? 190 : lw, hh = cap_(null, 0, 0, bw, it.title, it.text), x, y, al;
      if (c > 0.2) { x = p.x + nd / 2 + 8; y = p.y - hh / 2; al = 'left'; }
      else if (c < -0.2) { x = p.x - nd / 2 - 8 - bw; y = p.y - hh / 2; al = 'left'; al = 'right'; }
      else { x = p.x - bw / 2; al = 'center'; y = sn < 0 ? p.y - nd / 2 - 6 - hh : p.y + nd / 2 + 6; }
      if (y < top - 4 || y + hh > BOTTOM + 2 || x < X0 - 1 || x + bw > CX + CW + 1) tooTall = true;
      // V.1_45: captions never run into each other ("Loyalty app" over the hotel operations text in deck 19)
      boxes.forEach(function (b) { if (x < b.x + b.w && b.x < x + bw && y < b.y + b.h + 6 && b.y < y + hh + 6) tooTall = true; });
      boxes.push({ x: x, y: y, w: bw, h: hh });
      var tw = Math.min(bw, Math.max(K.textWidth(String(it.title || ''), 'sans', 500, TSZ.heading), it.text ? bw : 0));
      K.rect(els, al === 'right' ? x + bw - tw : al === 'center' ? x + (bw - tw) / 2 : x, y - 1, tw, hh + 2, T.white);
      cap_(els, x, y, bw, it.title, it.text, al);
    });
    if (tooTall) return null;
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 11. Isometric stack with callouts — proposals pages 122, 123, 125, 121, 281 ---------- */
  add('P66_ISO_CALLOUTS', 'diagram', { min: 3, max: 4, needs: 'items',
    desc: 'layered platform: an isometric stack of 3-4 layers with a callout (heading + text) joined to each layer, optional statement card top right (items[{title, text}] from the top layer down, statement)', words: '8-20' }, function (s) {
    var items = itemsOf_(s, 4), n = items.length;
    if (n < 3 || n > 4 || sourcesList_(items)) return null;
    var els = [];
    var top = K.header(els, s, { maxW: 600 });
    var stmt = String(s.statement || s.takeaway || '');
    var cx = 352, depth = 13, w0 = n === 4 ? 270 : 260, dw = n === 4 ? 56 : 70;
    var base = BOTTOM - 8 - depth - w0 * 0.25;                            // centre of the bottom layer's top face
    var wTop = w0 - (n - 1) * dw, roof = stmt ? top + 4 : top + 14;
    var step = Math.min(n === 4 ? 46 : 54, (base - roof - wTop * 0.25) / (n - 1));
    var layers = [];
    for (var i = 0; i < n; i++) layers.push({ w: w0 - i * dw, cy: base - i * step });
    if (layers[n - 1].cy - layers[n - 1].w * 0.25 < top + 6) return null;
    var faces = [B3, B2, B1, T.blue], sides = [B2, B1, T.blue, T.ink];
    layers.forEach(function (L, i) {
      var w = L.w, h = w * 0.5, x = cx - w / 2;
      K.shape(els, 'DIAMOND', x, L.cy - h / 2 + depth, w, h, sides[i]);
      K.rect(els, x, L.cy, w, depth, sides[i]);
      K.shape(els, 'DIAMOND', x, L.cy - h / 2, w, h, faces[i]);
      K.line(els, x, L.cy, cx, L.cy + h / 2, T.white, 0.75);
      K.line(els, cx, L.cy + h / 2, x + w, L.cy, T.white, 0.75);
      K.line(els, cx, L.cy + h / 2, cx, L.cy + h / 2 + depth, T.white, 0.75);
    });
    // callouts: item 0 = top layer; alternate right / left
    var rightX = cx + w0 / 2 + 22, lw = Math.min(196, cx - w0 / 2 - 22 - X0), rw = CX + CW - rightX, sBox = null;
    if (stmt) {
      var sx = rightX - 14, sw = CX + CW - sx, sh = th_(stmt, sw - 34, TSZ.heading, 400) + 26;
      sBox = { x: sx, y: top, w: sw, h: sh };
      K.rect(els, sBox.x, sBox.y, sw, sh, T.bgLight);
      K.rect(els, sBox.x, sBox.y, 3.5, sh, T.blue);
      var dot = stmt.search(/[.:]\s|,\s/), hl = dot > 10 && dot < 70 ? dot : 0;
      K.text(els, sBox.x + 18, sBox.y + 13, sw - 34, sh - 20, stmt, { weight: 400, max: TSZ.heading, min: TSZ.heading, color: T.body, runs: hl ? [{ start: 0, end: hl, color: T.blue, weight: 500 }] : null });
    }
    var bad = false, lastR = sBox ? sBox.y + sBox.h + 8 : top, lastL = top;
    items.forEach(function (it, k) {
      var L = layers[n - 1 - k], right = k % 2 === 0;
      var bw = right ? rw : lw, hh = cap_(null, 0, 0, bw, it.title, it.text);
      var ax = right ? cx + L.w / 2 - 4 : cx - L.w / 2 + 4, ay = L.cy + depth / 2;
      var ty = Math.max(right ? lastR : lastL, ay - hh / 2 - 6);
      if (ty + hh > BOTTOM) bad = true;
      var tx = right ? rightX : X0;
      var ly = Math.min(Math.max(ay, ty + 8), ty + hh);
      if (right) { K.line(els, ax + 4, ay, tx - 14, ly, GREY, 0.75); K.line(els, tx - 14, ly, tx - 6, ly, GREY, 0.75); }
      else { K.line(els, ax - 4, ay, X0 + lw + 14, ly, GREY, 0.75); K.line(els, X0 + lw + 6, ly, X0 + lw + 14, ly, GREY, 0.75); }
      K.ellipse(els, ax - 2.5 + (right ? 4 : -4), ay - 2.5, 5, 5, T.ink);
      cap_(els, tx, ty, bw, it.title, it.text, 'left');
      if (right) lastR = ty + hh + 10; else lastL = ty + hh + 10;
    });
    if (bad) return null;
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 12. L0 / L1 / L2 tiers with key benefits — proposals pages 328, 176, 187 ---------- */
  add('P66_TIERS', 'cards', { min: 2, max: 4, needs: 'items',
    desc: 'tiers or levels: 2-4 boxes in a row (big mono label such as L0, name, quoted nickname, short text) and a "Key benefits" list below (items[{label, title, quote, text}], points[] 2-5 benefits, pointsTitle optional)', words: '10-20' }, function (s) {
    var items = itemsOf_(s, 4), n = items.length;
    if (n < 2 || n > 4) return null;
    var pts = pointsOf_(s.points, 5);
    if (pts.length < 2) return null;                               // the key benefits list is part of the design
    var els = [];
    var top = K.header(els, s);
    var gap = 16, cw = (CW - gap * (n - 1)) / n, iw = cw - 32;
    var hT = maxH_(items.map(function (it) { return it.title; }), iw, 13, 400);
    var hQ = maxH_(items.map(function (it) { return it.quote ? '“' + it.quote + '”' : ''; }), iw, TSZ.body, 400);
    var hB = maxH_(items.map(function (it) { return it.text; }), iw, TSZ.body);
    var need = 12 + 26 + 4 + hT + (hQ ? 3 + hQ : 0) + 12 + hB + 14;
    var benH = 0;
    if (pts.length) { benH = 34; pts.forEach(function (p) { benH += th_(p, CW - 56 - 16, TSZ.body) + 4; }); benH += 8; }
    var avail = BOTTOM - top - (pts.length ? benH + 14 : 0);
    if (need > avail) return null;
    var ch = pts.length ? need : Math.min(avail, Math.max(need, avail * 0.6));
    items.forEach(function (it, i) {
      var x = CX + i * (cw + gap), y = top;
      K.rect(els, x, y, cw, ch, T.bgLight);
      K.rect(els, x, y, cw, 3, i === n - 1 ? T.blue : (i === 0 ? B3 : B2));
      K.text(els, x + 16, y + 10, iw, 30, it.label || ('L' + i), { font: 'mono', weight: 500, max: 22, min: 18, maxLines: 1, align: 'center', color: T.blue });
      var yy = y + 42;
      K.text(els, x + 16, yy, iw, hT, it.title, { weight: 400, max: 13, min: 13, maxLines: 2, align: 'center', color: T.ink });
      yy += hT;
      if (hQ) { if (it.quote) K.text(els, x + 16, yy + 3, iw, hQ, '“' + it.quote + '”', { weight: 400, max: TSZ.body, min: TSZ.body, maxLines: 2, align: 'center', color: T.blue }); yy += 3 + hQ; }
      K.line(els, x + cw / 2 - 16, yy + 6, x + cw / 2 + 16, yy + 6, T.cardLine, 0.75);
      K.text(els, x + 16, yy + 12, iw, hB, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, align: 'center', color: T.body });
    });
    if (pts.length) {
      var by = top + ch + 14, bh = Math.max(benH, Math.min(BOTTOM - by, benH + 20));
      K.rect(els, CX, by, CW, bh, T.bgLight);
      K.text(els, CX + 28, by + 12, 300, 16, s.pointsTitle || 'Key benefits', { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 1, color: T.ink });
      K.bulletList(els, CX + 28, by + 34, CW - 56, bh - 38, pts, { max: TSZ.body, min: TSZ.body, gap: 4, bullet: T.blue });
    }
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 13. Governance / org tree — proposals pages 159, 156 ---------- */
  add('P66_ORG_TREE', 'team', { min: 2, max: 6, needs: 'org',
    desc: 'governance or team structure: top box, lines down to 2-6 boxes, optional third level stacked under each (org{name, role, reports[{name, role, reports[{name, role}]}]}; name = the body or role, role = who fills it; roles only, no people)', words: '2-6 per box' }, function (s) {
    var org = s.org;
    if (!org || !org.name) return null;
    var l2 = K.arr(org.reports, 6).filter(function (r) { return r && r.name; });
    var m = l2.length;
    if (m < 2 || m > 6) return null;
    var els = [];
    var top = K.header(els, s);
    var gap = m > 4 ? 8 : 16, bw = Math.min(170, (CW - gap * (m - 1)) / m), tot = bw * m + gap * (m - 1), x0 = CX + (CW - tot) / 2;
    var iw = bw - 16;
    function boxNeed(b, w, pad) { return th_(b.name, w, TSZ.body, 500) + (b.role ? 2 + th_(b.role, w, 9.5) : 0) + (pad || 16); }
    var topW = Math.min(330, Math.max(200, K.textWidth(org.name, 'sans', 500, TSZ.heading) + 40, K.textWidth(org.role || '', 'sans', 400, 9.5) * 1.08 + 30)), topH = Math.max(42, th_(org.name, topW - 20, TSZ.heading, 500) + (org.role ? th_(org.role, topW - 20, 9.5) + 2 : 0) + 16);
    var h2 = 0; l2.forEach(function (b) { h2 = Math.max(h2, boxNeed(b, iw, 14)); }); h2 = Math.max(h2, 40);
    var h3 = 0, k3 = 0;
    l2.forEach(function (b) { var r = K.arr(b.reports, 4).filter(function (x) { return x && x.name; }); b._r = r; k3 = Math.max(k3, r.length); r.forEach(function (c) { h3 = Math.max(h3, boxNeed(c, iw - 16, 12)); }); });
    h3 = Math.max(h3, 30);
    if (!k3) { h2 = Math.max(h2, 62); topH = Math.max(topH, 58); }
    var gapV = k3 ? 30 : 44, total = topH + gapV + h2 + (k3 ? 14 + k3 * (h3 + 8) - 8 : 0);
    var g3 = 8, gv3 = 14;
    if (total > BOTTOM - top) { gapV = 20; g3 = 5; gv3 = 10; total = topH + gapV + h2 + (k3 ? gv3 + k3 * (h3 + g3) - g3 : 0); }
    if (total > BOTTOM - top) return null;
    var y0 = top + Math.max(0, (BOTTOM - top - total) / 2 - 4);
    function drawBox(x, y, w, h, b, fill, line, tSize) {
      K.rect(els, x, y, w, h, fill, line);
      var c = K.onFill(fill), hn = th_(b.name, w - 16, tSize, 500), hr = b.role ? th_(b.role, w - 16, 9.5) : 0;
      if (!b.role) { K.text(els, x + 8, y, w - 16, h, b.name, { weight: 500, max: tSize, min: tSize, maxLines: 3, align: 'center', valign: 'middle', color: c }); return; }
      // name above the split line, role below it: stays centred whatever the final line breaks are
      var split = y + h / 2 + (hn - hr) / 2;
      K.text(els, x + 8, y + 4, w - 16, split - y - 4, b.name, { weight: 500, max: tSize, min: tSize, maxLines: 3, align: 'center', valign: 'bottom', color: c });
      K.text(els, x + 8, split + 1, w - 16, y + h - split - 5, b.role, { weight: 400, max: 9.5, min: 9.5, maxLines: 3, align: 'center', valign: 'top', color: c });
    }
    drawBox(CX + CW / 2 - topW / 2, y0, topW, topH, org, T.blue, null, TSZ.heading);
    var yBus = y0 + topH + gapV / 2, y2 = y0 + topH + gapV;
    K.line(els, CX + CW / 2, y0 + topH, CX + CW / 2, yBus, GREY, 0.75);
    K.line(els, x0 + bw / 2, yBus, x0 + tot - bw / 2, yBus, GREY, 0.75);
    l2.forEach(function (b, i) {
      var x = x0 + i * (bw + gap);
      K.line(els, x + bw / 2, yBus, x + bw / 2, y2, GREY, 0.75);
      drawBox(x, y2, bw, h2, b, T.ink, null, TSZ.body);
      var yy = y2 + h2 + gv3;
      if (b._r.length) K.line(els, x + 10, y2 + h2, x + 10, yy + (b._r.length - 1) * (h3 + g3) + h3 / 2, GREY, 0.75);
      b._r.forEach(function (c, k) {
        var by = yy + k * (h3 + g3);
        K.line(els, x + 10, by + h3 / 2, x + 16, by + h3 / 2, GREY, 0.75);
        drawBox(x + 16, by, bw - 16, h3, c, T.white, { color: T.cardLine, width: 0.75 }, TSZ.body);
      });
    });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 14. Pyramid with labels and callouts — proposals page 147 ---------- */
  add('P66_PYRAMID', 'diagram', { min: 3, max: 4, needs: 'items',
    desc: 'pyramid of 3-4 levels (top = most important): level names on the left, text or bullets on the right (items[{title, text or points[]}], top level first)', words: '10-25' }, function (s) {
    var items = itemsOf_(s, 4), n = items.length;
    if (n < 3 || n > 4 || sourcesList_(items)) return null;
    var els = [];
    var top = K.header(els, s);
    var ay = top + 4, Hp = BOTTOM - 6 - ay, B = Math.min(290, Hp * 1.12), cx = 348;
    var lvl = Hp / n, fills = n === 3 ? [T.blue, B1, B2] : [T.ink, T.blue, B1, B2];
    for (var k = n - 1; k >= 0; k--) {
      var hk = lvl * (k + 1), wk = B * (k + 1) / n;
      K.shape(els, 'TRIANGLE', cx - wk / 2, ay, wk, hk, fills[k]);
    }
    for (var g = 1; g < n; g++) K.rect(els, cx - B / 2 - 4, ay + g * lvl - 2.5, B + 8, 5, T.white);
    var rx = cx + B / 2 + 22, rw = CX + CW - rx, lwid = cx - B / 2 - X0 - 18, bad = false;
    items.forEach(function (it, i) {
      var ym = ay + lvl * (i + 0.5), yn = ym + (i === 0 ? lvl * 0.16 : 0);
      var half = B / 2 * (ym - ay) / Hp;
      K.text(els, cx - 20, yn - 9, 40, 18, K.pad2(i + 1), { font: 'mono', weight: 500, max: 11, min: 11, maxLines: 1, align: 'center', valign: 'middle', color: T.white });
      // left: level name with a rule to the pyramid
      var hT = th_(it.title, lwid, TSZ.heading, 500);
      K.text(els, X0, ym - hT / 2, lwid, hT, it.title, { weight: 500, max: TSZ.heading, min: TSZ.heading, maxLines: 2, align: 'right', valign: 'middle', color: T.blue });
      K.line(els, X0 + lwid + 8, ym, cx - half - 8, ym, GREY, 0.75);
      // right: text or bullets
      var pts = pointsOf_(it.points, 5), hR;
      K.line(els, cx + half + 8, ym, rx - 8, ym, GREY, 0.75);
      if (pts.length) {
        hR = 0; pts.forEach(function (p) { hR += th_(p, rw - 16, TSZ.body) + 3; }); hR -= 3;
        var yR = Math.min(Math.max(ay + lvl * i + 2, ym - hR / 2), ay + lvl * (i + 1) - hR);
        if (hR > lvl - 4) bad = true;
        K.bulletList(els, rx, yR, rw, hR + 2, pts, { max: TSZ.body, min: TSZ.body, gap: 3 });
      } else {
        hR = th_(it.text, rw, TSZ.body);
        if (hR > lvl + 6) bad = true;
        // V.1_66 (deck 38 Proposal slide 23: the texts sat ~19pt above their levels): centred on its level, however Slides wraps it
        K.text(els, rx, ym - hR / 2, rw, hR, it.text, { weight: 400, max: TSZ.body, min: TSZ.body, valign: 'middle', color: T.body });
      }
    });
    if (bad) return null;
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 15. Puzzle blocks — proposals page 93 ---------- */
  add('P66_PUZZLE', 'diagram', { min: 4, max: 6, needs: 'items',
    desc: 'considerations that fit together: 4 or 6 puzzle blocks in blue tints, one short label each (labels only, no text per block), optional sentence under the block (items[{title}], text)', words: '1-4 per block' }, function (s) {
    var items = itemsOf_(s, 6), n = items.length;
    if (n !== 4 && n !== 6) return null;                       // V.1_47: an even puzzle (2 + 2 or 3 + 3), never 3 + 2
    // V.1_47: the puzzle shows labels only: content with a sentence per item goes to a design that shows it
    if (items.filter(function (it) { return String(it.text || '').trim().split(/\s+/).length >= 3; }).length >= 2) return null;
    var els = [];
    var top = K.header(els, s);
    var note = String(s.text || s.takeaway || '');
    var noteH = note ? th_(note, 520, TSZ.heading) + 14 : 0;
    var top3 = n === 4 ? 2 : 3, bot = n - top3;
    var pw = n === 4 ? 200 : 160, PW = pw * top3;
    var ph = Math.min(104, (BOTTOM - top - noteH - 16) / 2);
    if (ph < 64) return null;
    var tot = ph * 2 + noteH, y0 = top + Math.max(0, (BOTTOM - top - tot) / 2 - 4), x0 = CX + (CW - PW) / 2;
    var pieces = [];
    var colFill = top3 === 2 ? [B2, T.blue] : [B3, B2, T.blue];
    for (var i = 0; i < top3; i++) pieces.push({ x: x0 + i * pw, y: y0, w: pw, h: ph, fill: colFill[i], row: 0 });
    var bwid = PW / bot, bFill = bot === 2 ? (top3 === 2 ? [B1, T.ink] : [B2, T.ink]) : [B1, B1, T.ink];
    if (bot === 3) bFill = [B2, B1, T.ink];
    for (var j = 0; j < bot; j++) pieces.push({ x: x0 + j * bwid, y: y0 + ph, w: bwid, h: ph, fill: bFill[j], row: 1 });
    pieces.forEach(function (p) { K.rect(els, p.x, p.y, p.w, p.h, p.fill, { color: T.white, width: 1.5 }); });
    var d = 26, r = d / 2, off = 8;
    function knobH(src, bx, my, dir) {        // horizontal knob from src across the vertical boundary bx (dir +1 = to the right)
      var kcx = bx + dir * off;
      K.ring(els, kcx - r, my - r, d, src.fill, T.white, 1.5);
      var cut = Math.sqrt(r * r - off * off);
      K.rect(els, dir > 0 ? bx - 6 : bx - 0.75, my - cut + 1, 6.75, cut * 2 - 2, src.fill);
    }
    function knobV(src, by, mx, dir) {
      var kcy = by + dir * off;
      K.ring(els, mx - r, kcy - r, d, src.fill, T.white, 1.5);
      var cut = Math.sqrt(r * r - off * off);
      K.rect(els, mx - cut + 1, dir > 0 ? by - 6 : by - 0.75, cut * 2 - 2, 6.75, src.fill);
    }
    pieces.forEach(function (p, k) {
      var nb = pieces[k + 1];
      if (nb && nb.row === p.row) {
        var left = (k % 2 === 0);
        knobH(left ? p : nb, p.x + p.w, p.y + p.h / 2, left ? 1 : -1);
      }
    });
    pieces.filter(function (p) { return p.row === 1; }).forEach(function (p, j) {
      var mx = p.x + p.w / 2, above = null;
      pieces.forEach(function (q) { if (q.row === 0 && mx > q.x + 24 && mx < q.x + q.w - 24) above = q; });
      if (!above) { mx = p.x + p.w * 0.3; pieces.forEach(function (q) { if (q.row === 0 && mx > q.x + 24 && mx < q.x + q.w - 24) above = q; }); }
      if (!above) return;
      if (j % 2 === 0) knobV(above, p.y, mx, 1); else knobV(p, p.y, mx, -1);
    });
    var size = K.uniformSize(items.map(function (it) { return it.title; }), Math.min(pw, bwid) - 70, ph - 50, { weight: 500, max: 12, min: 10, maxLines: 3 });
    pieces.forEach(function (p, k) {
      var it = items[k];
      K.text(els, p.x + 34, p.y + 24, p.w - 68, p.h - 48, it.title, { weight: 500, max: size, min: size, maxLines: 3, align: 'center', valign: 'middle', color: K.onFill(p.fill) });
    });
    if (note) K.text(els, x0, y0 + ph * 2 + 14, PW, noteH, note, { weight: 400, max: TSZ.heading, min: TSZ.heading, maxLines: 3, align: 'center', color: T.body });
    return { bg: T.white, els: els, noBalance: true };
  });

  /* ---------- 16. Offering radar — proposals pages 192, 193 ---------- */
  add('P66_RADAR', 'chart', { min: 5, max: 6, needs: 'items',
    desc: 'offering or maturity radar: a 5-6 axis spider chart with a filled blue shape, axis labels with scores, and a short list on the right (items[{title, value 1-5}], points[])', words: '2-5 per axis' }, function (s) {
    var items = itemsOf_(s, 6), n = items.length;
    if (n < 5 || n > 6) return null;
    var vals = items.map(function (it) { var v = parseFloat(it.value); return isFinite(v) ? Math.max(0, Math.min(5, v)) : NaN; });
    if (vals.some(function (v) { return !isFinite(v); })) return null;
    var pts = pointsOf_(s.points, 5);
    var els = [];
    var top = K.header(els, s);
    var half = (BOTTOM - top) / 2, cy = top + half + 2, cx = pts.length ? 250 : 360, R = Math.min(pts.length ? 100 : 108, half - 42), lw = pts.length ? 100 : 120;
    function V(i, r) { var a = (-90 + i * 360 / n) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
    // outer band
    for (var i = 0; i < n; i++) tri_(els, { x: cx, y: cy }, V(i, R), V((i + 1) % n, R), T.bgLight);
    // data shape
    for (i = 0; i < n; i++) tri_(els, { x: cx, y: cy }, V(i, R * vals[i] / 5), V((i + 1) % n, R * vals[(i + 1) % n] / 5), B3);
    // grid
    for (var g = 1; g <= 5; g++) for (i = 0; i < n; i++) { var a = V(i, R * g / 5), b = V((i + 1) % n, R * g / 5); K.line(els, a.x, a.y, b.x, b.y, g === 5 ? GREY : T.cardLine, g === 5 ? 0.75 : 0.5); }
    for (i = 0; i < n; i++) { var e = V(i, R); K.line(els, cx, cy, e.x, e.y, T.cardLine, 0.5); }
    for (i = 0; i < n; i++) { var p = V(i, R * vals[i] / 5), q = V((i + 1) % n, R * vals[(i + 1) % n] / 5); K.line(els, p.x, p.y, q.x, q.y, T.blue, 1.5); }
    for (i = 0; i < n; i++) { var dpt = V(i, R * vals[i] / 5); K.ellipse(els, dpt.x - 3.5, dpt.y - 3.5, 7, 7, T.blue); }
    items.forEach(function (it, k) {
      var deg = -90 + k * 360 / n, ar = deg * Math.PI / 180, c = Math.cos(ar), sn = Math.sin(ar);
      var px = cx + (R + 12) * c, py = cy + (R + 10) * sn;
      var label = it.title, score = String(Math.round(vals[k] * 10) / 10).replace(/\.0$/, '') + ' / 5';
      var bw = Math.abs(c) < 0.3 ? 180 : lw;
      var h1 = th_(label, bw, TSZ.body, 500), hh = h1 + 2 + lh_(9.5), x, y, al;
      if (c > 0.3) { x = px; al = 'left'; y = py - hh / 2; }
      else if (c < -0.3) { x = px - bw; al = 'right'; y = py - hh / 2; }
      else { x = px - bw / 2; al = 'center'; y = sn < 0 ? py - hh : py; }
      K.text(els, x, y, bw, h1, label, { weight: 500, max: TSZ.body, min: TSZ.body, maxLines: 2, align: al, color: T.ink });
      K.text(els, x, y + h1 + 2, bw, lh_(9.5), score, { font: 'mono', weight: 500, max: 9.5, min: 9.5, maxLines: 1, align: al, color: T.blue });
    });
    if (pts.length) {
      var px0 = 474, pw = CX + CW - px0, ttl = s.pointsTitle || s.text || '';
      var hP = 0; pts.forEach(function (p2) { hP += th_(p2, pw - 40 - 16, TSZ.body) + 10; }); hP -= 10;
      var hTt = ttl ? th_(ttl, pw - 40, TSZ.heading, 500) + 12 : 0;
      var ph = hP + hTt + 40;
      if (ph > BOTTOM - top) return null;
      var py0 = cy - ph / 2;
      K.rect(els, px0, py0, pw, ph, T.bgLight);
      K.rect(els, px0, py0, 3.5, ph, T.blue);
      if (ttl) K.text(els, px0 + 22, py0 + 20, pw - 40, hTt - 12, ttl, { weight: 500, max: TSZ.heading, min: TSZ.heading, color: T.ink });
      K.bulletList(els, px0 + 22, py0 + 20 + hTt, pw - 40, hP + 2, pts, { max: TSZ.body, min: TSZ.body, gap: 10 });
    }
    return { bg: T.white, els: els, noBalance: true };
  });
})();
