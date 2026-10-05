/**
 * 66degrees brand pass — 66degrees Presentation Template 2026 standard (via Reference.gs),
 * built on the earlier iPAY brand-pass mechanics.
 *
 * 1. Reads every slide (Slides API) and builds an inventory of images, text and shapes.
 * 2. Gemini reviews each slide image: images to remove (fake logos, UI, text in pictures), icons to swap for
 *    66degrees icons, placeholder text to delete, and slides that must be redrawn (with their content).
 * 3. Cover, agenda, section dividers, charts and the closing slide are ALWAYS drawn by the engine (template layouts).
 * 4. Every other slide is normalized to the 2026 template: title top-left Plus Jakarta Sans Medium 20pt, subtitle 10pt,
 *    card style taken from the slide's template reference (flat #F3F2F0 panels / 66° White cards on #F3F2F0 / left-rule cards),
 *    KPI numbers in IBM Plex Mono blue, table headers blue, template palette, 66° footer mark.
 * 5. A deterministic brand check runs at the end and its findings are reported in the result message.
 */

const EMU = 12700;
// Only slides that carry brand identity or need structured data rendering are redrawn by our engine.
// Everything else (cards, stats, process, comparison, next_steps, case_study) keeps Beautiful.ai's rich layout
// and is only RECOLORED/RE-FONTED by the brand pass — that's how we preserve gradient cards, dark callout bars,
// pill tags and layout variety instead of flattening every deck.
const ALWAYS_ENGINE = ['cover', 'agenda', 'section', 'chart', 'closing'];
// Create mode only: these types lose their structure when Beautiful.ai's images are removed, and the engine
// layouts match the template references (66D_LAYOUT_COMPARISON_002, 66D_LAYOUT_TIMELINE_001), so always redraw them.
// stats: KPI numbers must show exactly the planned values, so they are always drawn from the plan.
// cards / process: drawn in the template design chosen for the slide (rotates between decks).
const CREATE_ENGINE = ['comparison', 'timeline', 'next_steps', 'stats', 'cards', 'process', 'case_study'];
// Design tokens — defaults are the 2026 template values; applyReferenceTokens_() refreshes them from the library.
const IPAY = {
  // 66degrees Brand Guidelines 2026 colors (applyReferenceTokens_() sets the same values from Reference.gs)
  white: '#FFFDF9', bgLight: '#F3F2F0', ink: '#040A1B', title: '#040A1B', body: '#040A1B', blue: '#0052FF',
  slate: '#B3C5D0', cardLine: '#DBDDE1', tileBlue: '#F3F2F0', tileGrey: '#ECECEC', panelAlt: '#ECECEC',
  ramp: ['#0052FF', '#0052FF', '#0052FF', '#0052FF', '#0052FF'],
  tints: ['#0052FF', '#0052FF', '#0052FF', '#B3C5D0', '#ECECEC']
};
let FILL_KEEP = null;   // colors the brand pass leaves as they are (set per run)

function applyReferenceTokens_(ctx) {
  const t = ctx.tokens || libraryTokens(ctx.lib || null);
  ['white', 'bgLight', 'ink', 'title', 'body', 'blue', 'slate', 'cardLine', 'tileBlue', 'tileGrey', 'panelAlt'].forEach(function (k) {
    if (t[k]) IPAY[k] = t[k];
  });
  if (t.ramp) IPAY.ramp = t.ramp.slice(0, 5);
  if (t.tints) IPAY.tints = t.tints.slice();
  FILL_KEEP = libraryKeepColors(ctx.lib || null, t);
}

function rebrandPresentation(presId, ctx, opts) {
  opts = opts || {};
  const stats = { slides: 0, fonts: 0, colors: 0, icons: 0, removed: 0, redrawn: 0, normalized: 0, failed: 0, libraryIcons: 0, issues: 0 };
  applyReferenceTokens_(ctx);

  const pres = Slides.Presentations.get(presId, {
    fields: 'pageSize,slides(objectId,pageProperties(pageBackgroundFill),pageElements)'
  });
  const pageW = pres.pageSize.width.magnitude / EMU;
  const pageH = pres.pageSize.height.magnitude / EMU;
  const S = pageW / 720; // scale from the 720pt iPAY canvas
  const slides = pres.slides || [];
  stats.slides = slides.length;

  // ---- Inventory + Gemini review ----
  const inv = slides.map(function (pg, i) { return buildInventory(pg, i, pageW, pageH); });
  // Rebrand mode: the progress list shows the deck's own slides (first text of each slide)
  if (ctx.progress && !opts.specs) {
    progressSlides_(ctx, inv.map(function (it, i) {
      const top = it.texts.slice().sort(function (a, b) { return a.y - b.y; })[0];
      return top ? top.text.replace(/\s+/g, ' ').slice(0, 70) : 'Slide ' + (i + 1);
    }));
  }
  progressStage_(ctx, 'review', 'active', 'Gemini is checking ' + slides.length + ' slides against the 66degrees template');
  let review = {};
  if (CONFIG.reviewWithGemini) {
    try { review = reviewSlidesWithGemini(presId, slides, inv, ctx, opts); }
    catch (e) { ctx.log.push('Slide review skipped: ' + e.message); }
  }
  progressStage_(ctx, 'review', 'done', slides.length + ' slides reviewed');
  checkCancel_(ctx);
  const specs = opts.specs && opts.specs.length === slides.length ? opts.specs : null;
  const isCreate = !!opts.specs;

  // Template reference per slide: from the plan (Create) or from Gemini's slide_type classification (Rebrand)
  const usage = { lastTag: null, counts: {}, darkCount: 0 };
  const refs = inv.map(function (it, i) {
    if (specs && specs[i] && specs[i].reference) return specs[i].reference;
    const r = review[i] || {};
    const t = r.slide_type || (r.redraw_spec && r.redraw_spec.type);
    return (ctx.lib && t) ? selectReferenceForSpec(ctx.lib, Object.assign({ type: t }, r.redraw_spec || {}), usage) : null;
  });
  saveRotation_(usage);

  inv.forEach(function (it, i) {
    const r = review[i] || (review[i] = {});
    r.remove_images = (r.remove_images || []).filter(function (id) { return it.imageIds.indexOf(id) !== -1; });
    r.delete_shapes = (r.delete_shapes || []).filter(function (id) { return it.textIds.indexOf(id) !== -1; });
    r.icons = r.icons || {};
    const spec = specs ? specs[i] : null;
    const kind = spec ? String(spec.type || '').toLowerCase() : (r.redraw_spec ? String(r.redraw_spec.type || '').toLowerCase() : '');
    // Order matters here — safety net must run FIRST and its spec must not be overwritten below.
    if (ALWAYS_ENGINE.indexOf(kind) !== -1 || (isCreate && spec && CREATE_ENGINE.indexOf(kind) !== -1)) {
      r.redraw = true; r.spec = spec || r.redraw_spec || null;
    }
    else if (r.redraw) { r.spec = spec || r.redraw_spec || null; }
    // Create mode: if Beautiful.ai dropped or changed any planned item, redraw from the plan so the slide
    // shows exactly the planned content (and matches the agenda).
    if (!r.redraw && isCreate && spec && specContentMissing_(spec, it)) {
      r.redraw = true;
      r.spec = spec;
      ctx.log.push('Slide ' + (i + 1) + ': Beautiful.ai left out planned content, redrawn from the plan.');
    }
    // Beautiful.ai sometimes leaves half the slide empty after its images are removed: redraw from content instead
    if (!r.redraw && (spec || r.redraw_spec) && it.texts.length > 1 &&
        (contentWidthShare(it, r, pageW) < 0.65 || contentAsymmetric(it, r, pageW, pageH) ||
         contentBottomShare(it, r, pageH) < 0.62)) {
      r.redraw = true;
      r.spec = spec || r.redraw_spec;
    }
    // Safety net (Create mode only): the LAST slide of a generated deck is always a Thank You closing.
    // In Rebrand mode the user's last slide is kept unless Gemini classified it as a closing slide.
    if (isCreate && i === inv.length - 1) {
      const guess = spec || r.redraw_spec || r.spec || {};
      r.redraw = true;
      r.spec = { type: 'closing', title: 'Thank You!', subtitle: guess.subtitle || guess.lead || (guess.cta ? String(guess.cta) : '') || guess.title || '' };
    }
    if (r.redraw && !r.spec) r.redraw = false;
    // Closing slide: title MUST be "Thank You!" — demote whatever came in to subtitle
    if (r.redraw && r.spec && String(r.spec.type || '').toLowerCase() === 'closing') {
      const original = r.spec.title || '';
      if (!original || original.toLowerCase().indexOf('thank') === -1) {
        r.spec.subtitle = r.spec.subtitle || r.spec.lead || original;
        r.spec.title = 'Thank You!';
      }
    }
    if (r.redraw && r.spec && !r.spec.reference && refs[i]) r.spec.reference = refs[i];
    it.texts.forEach(function (t) {
      if (/^(presenter name|your name|click to (add|edit)|lorem ipsum|subtitle here|title here)\b/i.test(t.text.trim()) &&
          r.delete_shapes.indexOf(t.id) === -1) r.delete_shapes.push(t.id);
    });
  });

  // ---- Batch: normalize every non-redrawn slide to the 2026 template ----
  progressStage_(ctx, 'brand', 'active', 'Applying colors, fonts and card styles to all slides');
  const requests = [];
  slides.forEach(function (page, i) {
    const r = review[i];
    const it = inv[i];
    if (r.redraw) {
      (page.pageElements || []).forEach(function (el) { requests.push({ deleteObject: { objectId: el.objectId } }); });
      return;
    }
    const skip = {};
    r.remove_images.forEach(function (id) { skip[id] = true; requests.push({ deleteObject: { objectId: id } }); stats.removed++; });
    r.delete_shapes.forEach(function (id) { skip[id] = true; requests.push({ deleteObject: { objectId: id } }); });

    const roles = detectRoles(page, it, pageW, pageH, S, skip);
    const ref = refs[i];
    const cardStyle = (ref && ref.cardStyle) || 'panel';
    roles.cardFill = cardStyle === 'elevated' ? IPAY.white : IPAY.bgLight;
    const bg = (roles.cards.length >= 2 && cardStyle === 'elevated') || (ref && ref.background === 'panel' && roles.cards.length < 2)
      ? IPAY.bgLight : IPAY.white;
    requests.push({
      updatePageProperties: {
        objectId: page.objectId,
        pageProperties: { pageBackgroundFill: { solidFill: { color: apiColor(bg) } } },
        fields: 'pageBackgroundFill.solidFill.color'
      }
    });
    normalizeElements(page.pageElements || [], requests, ctx.brand, stats, skip, roles, isCreate, S, pageW * pageH, bg);
    positionTitle(requests, roles, S);
    styleCards(requests, page.objectId, roles, S, i, cardStyle);
    stats.normalized++;
  });
  if (isCreate) requests.push({ replaceAllText: { containsText: { text: '\u000b', matchCase: true }, replaceText: ' ' } });
  runBatches(presId, requests, stats);

  // ---- ALL CAPS titles -> sentence case (brand rule) ----
  const capsFixes = [];
  slides.forEach(function (page, i) {
    if (review[i].redraw) return;
    inv[i].texts.forEach(function (t) {
      const fixed = fixAllCaps(t.text);
      if (fixed !== t.text && t.text.length < 120) {
        capsFixes.push({ replaceAllText: { containsText: { text: t.text, matchCase: true }, replaceText: fixed, pageObjectIds: [page.objectId] } });
      }
    });
  });
  if (capsFixes.length) runBatches(presId, capsFixes, stats);

  // ---- SlidesApp phase: icons, patterns, footer mark, redraws ----
  const deck = SlidesApp.openById(presId);
  const deckSlides = deck.getSlides();
  const dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');

  // Per slide: redraw (engine) or icons + footer mark. Progress is reported slide by slide.
  const brandSlide = function (slide, i) {
    const r = review[i] || {};
    const it = inv[i];
    if (!it) return;

    if (r.redraw) {
      try {
        // Template section dividers carry no number (66D_LAYOUT_SECTION_001); a number is only shown if the spec has one.
        renderEngineSlide(slide, r.spec, i + 1, ctx, pageW, pageH, dateLabel);
        stats.redrawn++;
      } catch (e) {
        ctx.log.push('Slide ' + (i + 1) + ' redraw failed: ' + e.message);
      }
      return;
    }

    Object.keys(r.icons || {}).forEach(function (imgId) {
      if (r.remove_images.indexOf(imgId) !== -1) return;
      try {
        const el = slide.getPageElementById(imgId);
        if (el && placeBrandIcon(slide, el, r.icons[imgId], ctx)) stats.icons++;
      } catch (e) { Logger.log('Icon swap failed: ' + e.message); }
    });

    r.remove_images.forEach(function (id) {
      const b = it.bounds[id];
      if (!b) return;
      const area = (b.w * b.h) / (pageW * pageH);
      // Only fill the gap with a pattern when no remaining text sits on top of it
      if (area > 0.04 && area < 0.7 && !overlapsText(it, r, b)) insertPattern(slide, b, ctx);
    });

    const occupied = it.elements.filter(function (e) {
      return r.remove_images.indexOf(e.id) === -1 && r.delete_shapes.indexOf(e.id) === -1;
    });
    addFooterMark(slide, occupied, pageW, pageH, S, ctx);
  };
  deckSlides.forEach(function (slide, i) {
    checkCancel_(ctx);
    progressSlide_(ctx, i, 'active');
    brandSlide(slide, i);
    progressSlide_(ctx, i, 'done');
  });

  flushPresentation(deck);
  progressStage_(ctx, 'brand', 'done', deckSlides.length + ' slides branded');
  stats.libraryIcons = ctx.libraryIconsPlaced || 0;

  // ---- Deterministic brand check (reported, not blocking) ----
  const issues = validateDeckAgainstReference(presId, refs, ctx);
  if (issues.length) {
    stats.issues = issues.length;
    ctx.log.push('Brand check: ' + issues.slice(0, 6).join('; ') + (issues.length > 6 ? ' (+' + (issues.length - 6) + ' more)' : '') + '.');
  }
  return stats;
}

/* ---------------- Roles: title, subtitle, cards, tables ---------------- */

function firstRunSize(el) {
  const tes = (el.shape && el.shape.text && el.shape.text.textElements) || [];
  for (let k = 0; k < tes.length; k++) {
    const st = tes[k].textRun && tes[k].textRun.style;
    if (st && st.fontSize && st.fontSize.magnitude && tes[k].textRun.content.trim()) return st.fontSize.magnitude;
  }
  return 0;
}

function flatten(els, out) {
  (els || []).forEach(function (el) {
    if (el.elementGroup) flatten(el.elementGroup.children, out);
    else out.push(el);
  });
  return out;
}

function detectRoles(page, it, pageW, pageH, S, skip) {
  const all = flatten(page.pageElements, []).filter(function (el) { return !skip[el.objectId]; });
  const roles = { title: null, subtitle: null, cards: [], tables: [], headingIds: {} };

  // Title: the largest text near the top
  let best = null;
  all.forEach(function (el) {
    if (!el.shape || !el.shape.text) return;
    const b = elementBounds(el);
    const txt = shapeText(el);
    if (!txt || txt.length > 140 || b.y > pageH * 0.24) return;
    const size = firstRunSize(el);
    if (!best || size > best.size) best = { el: el, b: b, size: size };
  });
  if (best && best.size >= 14 * S) {
    roles.title = best;
    // Subtitle: next smaller text right below the title
    let sub = null;
    all.forEach(function (el) {
      if (el === best.el || !el.shape || !el.shape.text || !shapeText(el)) return;
      const b = elementBounds(el), size = firstRunSize(el);
      if (b.y >= best.b.y && b.y < best.b.y + best.b.h + 45 * S && size && size < best.size && size <= 16 * S && shapeText(el).length < 200) {
        if (!sub || b.y < sub.b.y) sub = { el: el, b: b, size: size };
      }
    });
    roles.subtitle = sub;
  }

  // Cards: medium-sized filled or outlined boxes
  const area = pageW * pageH;
  all.forEach(function (el) {
    if (!el.shape || (roles.title && el === roles.title.el) || (roles.subtitle && el === roles.subtitle.el)) return;
    const props = el.shape.shapeProperties || {};
    const hasFill = !!solidRgb(props.shapeBackgroundFill);
    const hasOutline = props.outline && (!props.outline.propertyState || props.outline.propertyState === 'RENDERED') && solidRgb(props.outline.outlineFill);
    if (!hasFill && !hasOutline) return;
    const type = el.shape.shapeType || '';
    if (/ELLIPSE|ARROW|LINE|CHEVRON|TRIANGLE/.test(type)) return;
    const b = elementBounds(el);
    const share = (b.w * b.h) / area;
    if (share < 0.015 || share > 0.35 || b.w < 60 * S || b.h < 40 * S || b.w > pageW * 0.9) return;
    roles.cards.push({ el: el, b: b });
  });
  if (roles.cards.length < 2) roles.cards = [];
  roles.cards.forEach(function (c) { roles.headingIds[c.el.objectId] = true; });

  all.forEach(function (el) { if (el.table) roles.tables.push(el); });
  return roles;
}

function shapeText(el) {
  return ((el.shape && el.shape.text && el.shape.text.textElements) || [])
    .map(function (te) { return te.textRun ? te.textRun.content : ''; }).join('').trim();
}

// Share of the page width used by content (excluding title/subtitle, removed images and full-page elements)
function contentWidthShare(it, r, pageW) {
  let minX = Infinity, maxX = -Infinity;
  it.elements.forEach(function (e) {
    if ((r.remove_images || []).indexOf(e.id) !== -1) return;
    if (e.w >= pageW * 0.95) return;
    if (e.y < it.pageH * 0.2) return; // header area
    minX = Math.min(minX, e.x);
    maxX = Math.max(maxX, e.x + e.w);
  });
  if (minX === Infinity) return 1;
  return (maxX - minX) / pageW;
}

// True when a planned item (card / step / KPI / point title) is not found anywhere in the slide's text.
function specContentMissing_(spec, it) {
  const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9%$+.]+/g, ' ').trim(); };
  const slideText = norm(it.texts.map(function (t) { return t.text; }).join(' '));
  const keys = [];
  (spec.items || []).forEach(function (x) {
    if (typeof x === 'string') keys.push(x);
    else if (x) keys.push(x.value || x.title || x.label || '');
  });
  (spec.points || []).forEach(function (p) { keys.push(typeof p === 'string' ? p : (p && p.title) || ''); });
  ['left', 'right'].forEach(function (k) { if (spec[k] && spec[k].label) keys.push(spec[k].label); });
  return keys.some(function (k) {
    const key = norm(k).split(' ').slice(0, 4).join(' ');   // first words are enough; wording may be re-wrapped
    return key.length >= 2 && slideText.indexOf(key) === -1;
  });
}

// Where the content ends, as a share of page height. Below ~0.62 the bottom third of the slide is empty.
function contentBottomShare(it, r, pageH) {
  let maxY = -Infinity;
  it.elements.forEach(function (e) {
    if ((r.remove_images || []).indexOf(e.id) !== -1) return;
    if ((r.delete_shapes || []).indexOf(e.id) !== -1) return;
    if (e.y < pageH * 0.2 || e.y > pageH * 0.85) return;   // header and footer areas
    if (e.h > pageH * 0.9) return;                          // full-page backgrounds
    maxY = Math.max(maxY, e.y + e.h);
  });
  return maxY === -Infinity ? 1 : maxY / pageH;
}

// True when content sits entirely on one half of the page (leaving the other half empty).
// Catches Beautiful.ai outputs where our brand pass removed the illustration on one side and
// left just bullets or cards stuck to the opposite edge — the classic "half-empty slide" bug.
function contentAsymmetric(it, r, pageW, pageH) {
  let minX = Infinity, maxX = -Infinity;
  it.elements.forEach(function (e) {
    if ((r.remove_images || []).indexOf(e.id) !== -1) return;
    if (e.w >= pageW * 0.95) return;               // ignore full-width bands
    if (e.y < pageH * 0.22) return;                // ignore header area
    if (e.y > pageH * 0.85) return;                // ignore footer area
    if (e.w * e.h < 200) return;                   // ignore tiny elements
    minX = Math.min(minX, e.x);
    maxX = Math.max(maxX, e.x + e.w);
  });
  if (minX === Infinity) return false;
  const startsFarRight = minX > pageW * 0.40;      // nothing in left 40% of page
  const endsFarLeft    = maxX < pageW * 0.60;      // nothing in right 40% of page
  const narrowSpan     = (maxX - minX) < pageW * 0.55;
  return startsFarRight || endsFarLeft || narrowSpan;
}

/* ---------------- Colors (iPAY) ---------------- */

function hexInfo(hex) {
  const c = hexToRgb(hex);
  const max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
  return { lum: luminance(hex), sat: max === 0 ? 0 : (max - min) / max };
}

function hueOf(hex) {
  const c = hexToRgb(hex);
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = h * 60;
  return h < 0 ? h + 360 : h;
}

function nearestColor_(hex, list) {
  const c = hexToRgb(hex);
  let best = list[0], bestD = Infinity;
  list.forEach(function (h) {
    const d = hexToRgb(h), dist = Math.pow(c[0] - d[0], 2) + Math.pow(c[1] - d[1], 2) + Math.pow(c[2] - d[2], 2);
    if (dist < bestD) { bestD = dist; best = h; }
  });
  return best;
}

function mapFillColor(hex, areaShare, widthShare) {
  const up = hex.toUpperCase();
  const keep = FILL_KEEP || [IPAY.white, IPAY.bgLight, IPAY.ink, IPAY.blue, IPAY.slate, IPAY.cardLine, IPAY.tileBlue];
  if (keep.indexOf(up) !== -1) return up;
  const h = hexInfo(up);
  if (h.lum > 0.85 && h.sat < 0.1) return IPAY.white;
  // Preserve dark navy (Beautiful.ai's dark callout bars & dark cards) — map to brand ink #040A1B.
  // This includes any color whose luminance is very low, regardless of saturation.
  if (h.lum < 0.12) return IPAY.ink;
  if (h.sat < 0.15) return h.lum > 0.55 ? IPAY.tileGrey : (h.lum > 0.2 ? IPAY.slate : IPAY.ink);
  // Warm hues (orange / red / yellow / brown) — Beautiful.ai's "minimal" theme accent — force to brand blue
  const hue = hueOf(up);
  const isWarm = (hue >= 0 && hue < 60) || hue >= 300;
  if (isWarm && h.sat >= 0.2) {
    return (widthShare || 0) > 0.5 || (areaShare || 0) > 0.04 ? IPAY.blue : IPAY.tileBlue;
  }
  // Blue hues (Beautiful.ai's gradient cards, pill tags, icon circles) — keep them BLUE (brand blue for saturated, tile for pastel).
  const isBlue = hue >= 180 && hue <= 260;
  if (isBlue) {
    if (h.lum > 0.75) return IPAY.tileBlue;   // pastel blue background → light panel
    if (h.sat >= 0.4) return nearestColor_(up, IPAY.ramp.concat(IPAY.tints));   // saturated blue → nearest template blue
    return IPAY.tileBlue;
  }
  if (h.lum > 0.5) return IPAY.tileBlue;                               // pastel tints -> iPAY light blue tile
  if ((widthShare || 0) > 0.85) return IPAY.blue;                      // full-width bands
  return (areaShare !== undefined && areaShare > 0.015) ? IPAY.tileBlue : IPAY.blue; // large saturated boxes -> light tile, small accents -> blue
}

function mapLineColor(hex) {
  const h = hexInfo(hex);
  if (h.sat > 0.35 && h.lum < 0.7) return IPAY.blue;
  if (h.lum > 0.6) return IPAY.cardLine;
  if (h.lum > 0.2) return IPAY.slate;
  return IPAY.ink;
}

function textColorFor(origHex, fillHex, size, weight, S) {
  if (fillHex && (fillHex === IPAY.blue || fillHex === IPAY.ink || luminance(fillHex) < 0.25)) return IPAY.white;
  if (origHex) {
    const h = hexInfo(origHex);
    if (h.sat > 0.45 && h.lum > 0.06 && h.lum < 0.6) return IPAY.blue; // accent text stays an accent
  }
  return (size >= 12 * S || weight >= 500) ? IPAY.ink : IPAY.body;
}

/* ---------------- Normalization requests ---------------- */

function normalizeElements(elements, requests, brand, stats, skip, roles, isCreate, S, pageArea, pageBg) {
  elements.forEach(function (el) {
    if (skip[el.objectId]) return;
    if (el.elementGroup) { normalizeElements(el.elementGroup.children || [], requests, brand, stats, skip, roles, isCreate, S, pageArea, pageBg); return; }
    const isCard = !!roles.headingIds[el.objectId];
    const isTitle = roles.title && roles.title.el === el;
    const isSub = roles.subtitle && roles.subtitle.el === el;
    const eb = elementBounds(el);
    const pageW = Math.sqrt(pageArea * 16 / 9);

    let fillHex = null;
    if (el.shape && !isCard) {
      const props = el.shape.shapeProperties || {};
      const fill = solidRgb(props.shapeBackgroundFill);
      const bgf = props.shapeBackgroundFill || {};
      const hasSolidFill = !!(bgf.solidFill);
      const fillRendered = !bgf.propertyState || bgf.propertyState === 'RENDERED';
      if (fill) {
        const orig = rgbObjToHex(fill);
        fillHex = mapFillColor(orig, (eb.w * eb.h) / pageArea, eb.w / pageW);
        if (fillHex === IPAY.bgLight && pageBg === IPAY.bgLight) fillHex = IPAY.white;   // keep panels visible on panel backgrounds
        if (fillHex !== orig) {
          requests.push({ updateShapeProperties: { objectId: el.objectId, shapeProperties: { shapeBackgroundFill: { solidFill: { color: apiColor(fillHex) } } }, fields: 'shapeBackgroundFill.solidFill.color' } });
          stats.colors++;
        }
      } else if (hasSolidFill && fillRendered) {
        // Theme color (no RGB) — Beautiful.ai / PPTX-converted decks. Force to a brand color based on shape size.
        const areaShare = (eb.w * eb.h) / pageArea;
        const wideBand = eb.w > pageW * 0.5 && eb.h < 60 * S;
        fillHex = wideBand ? IPAY.blue : (areaShare > 0.15 ? IPAY.bgLight : IPAY.tileBlue);
        if (fillHex === IPAY.bgLight && pageBg === IPAY.bgLight) fillHex = IPAY.white;
        requests.push({ updateShapeProperties: { objectId: el.objectId, shapeProperties: { shapeBackgroundFill: { solidFill: { color: apiColor(fillHex) } } }, fields: 'shapeBackgroundFill.solidFill.color' } });
        stats.colors++;
      }
      const outlineVisible = props.outline && (!props.outline.propertyState || props.outline.propertyState === 'RENDERED');
      const oc = outlineVisible ? solidRgb(props.outline.outlineFill) : null;
      if (oc) {
        const o = rgbObjToHex(oc), n = mapLineColor(o);
        if (n !== o) {
          requests.push({ updateShapeProperties: { objectId: el.objectId, shapeProperties: { outline: { outlineFill: { solidFill: { color: apiColor(n) } } } }, fields: 'outline.outlineFill.solidFill.color' } });
          stats.colors++;
        }
      }
    }
    if (isCard) fillHex = roles.cardFill || IPAY.white;

    if (el.line && el.line.lineProperties) {
      const lc = solidRgb(el.line.lineProperties.lineFill);
      if (lc) {
        const o = rgbObjToHex(lc), n = mapLineColor(o);
        if (n !== o) {
          requests.push({ updateLineProperties: { objectId: el.objectId, lineProperties: { lineFill: { solidFill: { color: apiColor(n) } } }, fields: 'lineFill.solidFill.color' } });
          stats.colors++;
        }
      }
    }

    // Tables: blue header row with white bold text, white body rows
    if (el.table && el.table.tableRows) {
      el.table.tableRows.forEach(function (row, r) {
        (row.tableCells || []).forEach(function (cell, c) {
          const loc = cell.location || { rowIndex: r, columnIndex: c };
          requests.push({
            updateTableCellProperties: {
              objectId: el.objectId,
              tableRange: { location: { rowIndex: loc.rowIndex || 0, columnIndex: loc.columnIndex || 0 }, rowSpan: 1, columnSpan: 1 },
              tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: apiColor(r === 0 ? IPAY.blue : IPAY.white) } } },
              fields: 'tableCellBackgroundFill.solidFill.color'
            }
          });
        });
      });
    }

    forEachText(el, function (objectId, cellLocation, te) {
      const st = te.textRun.style || {};
      const wff = st.weightedFontFamily || {};
      const family = wff.fontFamily || st.fontFamily;
      // Brand Guidelines: Regular and Medium only (no SemiBold, no Bold)
      let weight = Math.min(wff.weight || (st.bold ? 500 : 400), 500);
      const size = st.fontSize && st.fontSize.magnitude;
      const style = {}, fields = [];
      if (family && /material (icons|symbols)/i.test(family)) return;

      // KPI / big numbers (template rule): IBM Plex Mono SemiBold in blue
      const content = te.textRun.content || '';
      const isKpi = !isTitle && !isSub && !cellLocation && size && size >= 20 * S &&
        /^[\s$€£~<>]*\d[\d.,]*\s*(%|x|k|m|bn|b|pp|\+)?\+?\s*$/i.test(content);

      let targetSize = null;
      if (isTitle) { targetSize = 20 * S; weight = 500; }                 // title: Medium 20pt
      else if (isSub) { targetSize = 10 * S; weight = 400; }              // template subtitle: 10pt
      else if (isKpi) { weight = 500; }
      else if (isCreate && size && size >= 24 * S) targetSize = size * CONFIG.headlineShrink;

      const mono = isKpi || (family && /mono|md ?io|courier|consolas|code/i.test(family));
      const targetFamily = mono ? brand.fonts.mono.slides : brand.fonts.heading.slides;
      if (family !== targetFamily || isTitle || isSub || isKpi || (wff.weight || 400) > 500 || st.bold) {
        style.weightedFontFamily = { fontFamily: targetFamily, weight: weight };
        fields.push('weightedFontFamily');
        stats.fonts++;
      }
      if (targetSize) { style.fontSize = { magnitude: Math.round(targetSize * 2) / 2, unit: 'PT' }; fields.push('fontSize'); }

      const fg = st.foregroundColor && st.foregroundColor.opaqueColor && st.foregroundColor.opaqueColor.rgbColor;
      const origHex = fg ? rgbObjToHex(fg) : null;
      let color;
      if (cellLocation) color = cellLocation.rowIndex === 0 ? IPAY.white : IPAY.body;
      else if (isTitle) color = IPAY.title || IPAY.ink;
      else if (isSub) color = IPAY.body;
      else if (isKpi) color = (fillHex && luminance(fillHex) < 0.25) ? IPAY.white : IPAY.blue;
      else color = textColorFor(origHex, fillHex, targetSize || size || 10, weight, S);
      if (color !== origHex) { style.foregroundColor = { opaqueColor: apiColor(color) }; fields.push('foregroundColor'); stats.colors++; }
      if (cellLocation && cellLocation.rowIndex === 0 && weight < 500) {
        style.weightedFontFamily = { fontFamily: targetFamily, weight: 500 };
        if (fields.indexOf('weightedFontFamily') === -1) fields.push('weightedFontFamily');
      }
      if (!fields.length) return;
      const req = { updateTextStyle: { objectId: objectId, style: style, textRange: { type: 'FIXED_RANGE', startIndex: te.startIndex || 0, endIndex: te.endIndex }, fields: fields.join(',') } };
      if (cellLocation) req.updateTextStyle.cellLocation = cellLocation;
      requests.push(req);
    });

    if ((isTitle || isSub) && el.shape && el.shape.text) {
      requests.push({ updateParagraphStyle: { objectId: el.objectId, style: { alignment: 'START' }, textRange: { type: 'ALL' }, fields: 'alignment' } });
    }
  });
}

// Title top-left (2026 template: x 25.2, y 16.6, width 670 on the 720pt canvas) and subtitle right below it.
// Also strips any visible border on the title/subtitle boxes so their frame doesn't overlap the content below.
function positionTitle(requests, roles, S) {
  if (!roles.title) return;
  const t = roles.title.el, tb = roles.title.b;
  const tw = t.size && t.size.width && t.size.width.magnitude;
  const th = t.size && t.size.height && t.size.height.magnitude;
  if (!tw) return;
  const tf = t.transform || {};
  // Cap the title box's rendered height so a tall Beautiful.ai title box can't extend into the next element.
  const targetH = Math.min(60 * S, tb.h);
  const scaleY = th ? (targetH * EMU) / th : (tf.scaleY === undefined ? 1 : tf.scaleY);
  requests.push({
    updatePageElementTransform: {
      objectId: t.objectId, applyMode: 'ABSOLUTE',
      transform: { scaleX: (670 * S * EMU) / tw, scaleY: scaleY, shearX: 0, shearY: 0,
        translateX: 25.2 * S * EMU, translateY: 16.6 * S * EMU, unit: 'EMU' }
    }
  });
  // Kill any border on the title text box (Beautiful.ai leaves outlined boxes that visibly overlap tables/content below).
  requests.push({
    updateShapeProperties: {
      objectId: t.objectId,
      shapeProperties: { outline: { propertyState: 'NOT_RENDERED' } },
      fields: 'outline.propertyState'
    }
  });
  const titleH = targetH;
  if (!roles.subtitle) return;
  const s = roles.subtitle.el;
  const sw = s.size && s.size.width && s.size.width.magnitude;
  const sh = s.size && s.size.height && s.size.height.magnitude;
  if (!sw) return;
  const sf = s.transform || {};
  const subY = Math.max(49.6 * S, 16.6 * S + titleH - 4 * S);
  const subTargetH = Math.min(30 * S, roles.subtitle.b.h);
  const subScaleY = sh ? (subTargetH * EMU) / sh : (sf.scaleY === undefined ? 1 : sf.scaleY);
  requests.push({
    updatePageElementTransform: {
      objectId: s.objectId, applyMode: 'ABSOLUTE',
      transform: { scaleX: (642 * S * EMU) / sw, scaleY: subScaleY, shearX: 0, shearY: 0,
        translateX: 25.2 * S * EMU, translateY: subY * EMU, unit: 'EMU' }
    }
  });
  requests.push({
    updateShapeProperties: {
      objectId: s.objectId,
      shapeProperties: { outline: { propertyState: 'NOT_RENDERED' } },
      fields: 'outline.propertyState'
    }
  });
}

// Cards in the style of the slide's template reference:
//   panel    (66D_UI_CARD_001) flat #F3F2F0 (neutral tone), no border, no bar — the template default
//   elevated (66D_UI_CARD_003) 66° White card with a thin #DBDDE1 border, on a #F3F2F0 slide
//   rule     (66D_UI_CARD_004) flat #F3F2F0 card with a 3.5pt blue bar on the left
function styleCards(requests, pageId, roles, S, slideIndex, style) {
  style = style || 'panel';
  roles.cards.forEach(function (c, k) {
    const props = { shapeBackgroundFill: { solidFill: { color: apiColor(style === 'elevated' ? IPAY.white : IPAY.bgLight) } } };
    let fields = 'shapeBackgroundFill.solidFill.color';
    if (style === 'elevated') {
      props.outline = { outlineFill: { solidFill: { color: apiColor(IPAY.cardLine) } }, weight: { magnitude: 0.75 * S, unit: 'PT' } };
      fields += ',outline.outlineFill.solidFill.color,outline.weight';
    } else {
      props.outline = { propertyState: 'NOT_RENDERED' };
      fields += ',outline.propertyState';
    }
    requests.push({ updateShapeProperties: { objectId: c.el.objectId, shapeProperties: props, fields: fields } });
    if (style !== 'rule') return;
    const barId = 'refbar_' + slideIndex + '_' + k + '_' + Math.floor(Math.random() * 1e6);
    requests.push({
      createShape: {
        objectId: barId, shapeType: 'RECTANGLE',
        elementProperties: {
          pageObjectId: pageId,
          size: { width: { magnitude: 3.5 * S * EMU, unit: 'EMU' }, height: { magnitude: c.b.h * EMU, unit: 'EMU' } },
          transform: { scaleX: 1, scaleY: 1, translateX: c.b.x * EMU, translateY: c.b.y * EMU, unit: 'EMU' }
        }
      }
    });
    requests.push({
      updateShapeProperties: {
        objectId: barId,
        shapeProperties: { shapeBackgroundFill: { solidFill: { color: apiColor(IPAY.blue) } }, outline: { propertyState: 'NOT_RENDERED' } },
        fields: 'shapeBackgroundFill.solidFill.color,outline.propertyState'
      }
    });
  });
}

/* ---------------- ALL CAPS -> sentence case ---------------- */

const KEEP_CASE = ['66degrees', 'Google Cloud', 'Google Workspace', 'Gemini Enterprise', 'Gemini', 'Google', 'Vertex AI',
  'BigQuery', 'Looker', 'Agentic AI', 'GenAI', 'MLOps', 'LLMOps', 'DevOps', 'SaaS', 'GTM'];
const ACRONYMS = ['AI', 'ML', 'GCP', 'ROI', 'KPI', 'KPIS', 'CX', 'IT', 'API', 'APIS', 'SRE', 'EDW', 'LLM', 'LLMS', 'GKE', 'SQL',
  'CIO', 'CTO', 'CEO', 'CFO', 'B2B', 'B2C', 'US', 'UK', 'EMEA', 'APAC', 'Q1', 'Q2', 'Q3', 'Q4', 'HR', 'ERP', 'CRM', 'SAP', 'PII', 'GCE', 'GCS'];

function fixAllCaps(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 8 || letters !== letters.toUpperCase() || text.trim().split(/\s+/).length < 2) return text;
  let out = text.toLowerCase().replace(/[A-Za-z0-9]+/g, function (w) {
    const up = w.toUpperCase();
    return ACRONYMS.indexOf(up) !== -1 ? (up === 'KPIS' ? 'KPIs' : up === 'APIS' ? 'APIs' : up === 'LLMS' ? 'LLMs' : up) : w;
  });
  KEEP_CASE.forEach(function (term) {
    out = out.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), term);
  });
  return out.replace(/^(\s*)([a-z])/, function (m, sp, c) { return sp + c.toUpperCase(); });
}

/* ---------------- Inventory ---------------- */

function elementBounds(el) {
  const t = el.transform || {};
  const sz = el.size || {};
  const w = ((sz.width && sz.width.magnitude) || 0) * (t.scaleX === undefined ? 1 : t.scaleX) / EMU;
  const h = ((sz.height && sz.height.magnitude) || 0) * (t.scaleY === undefined ? 1 : t.scaleY) / EMU;
  return { x: (t.translateX || 0) / EMU, y: (t.translateY || 0) / EMU, w: Math.abs(w), h: Math.abs(h) };
}

function buildInventory(page, index, pageW, pageH) {
  const it = { index: index, pageId: page.objectId, pageH: pageH, photos: [], icons: [], texts: [], imageIds: [], textIds: [], elements: [], bounds: {} };
  flatten(page.pageElements, []).forEach(function (el) {
    const b = elementBounds(el);
    it.bounds[el.objectId] = b;
    it.elements.push({ id: el.objectId, x: b.x, y: b.y, w: b.w, h: b.h });
    if (el.image) {
      it.imageIds.push(el.objectId);
      const small = b.w <= 70 * pageW / 720 && b.h <= 70 * pageW / 720;
      (small ? it.icons : it.photos).push({ id: el.objectId, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });
    }
    const txt = shapeText(el);
    if (txt) {
      it.texts.push({ id: el.objectId, text: txt.slice(0, 160), x: Math.round(b.x), y: Math.round(b.y) });
      it.textIds.push(el.objectId);
    }
  });
  return it;
}

/* ---------------- Gemini review ---------------- */

function reviewSlidesWithGemini(presId, slides, inv, ctx, opts) {
  opts = opts || {};
  const isCreate = !!opts.specs;
  const specs = opts.specs && opts.specs.length === slides.length ? opts.specs : null;
  const parts = [];
  const lines = [];
  slides.forEach(function (page, i) {
    try {
      const thumb = Slides.Presentations.Pages.getThumbnail(presId, page.objectId, {
        'thumbnailProperties.thumbnailSize': 'MEDIUM', 'thumbnailProperties.mimeType': 'PNG'
      });
      const img = UrlFetchApp.fetch(thumb.contentUrl).getBlob();
      parts.push({ text: 'SLIDE ' + i + ' image:' });
      parts.push({ inline_data: { mime_type: 'image/png', data: Utilities.base64Encode(img.getBytes()) } });
    } catch (e) {
      Logger.log('Thumbnail failed for slide ' + i + ': ' + e.message);
    }
    const it = inv[i];
    const ref = specs && specs[i] && specs[i].reference;
    lines.push('SLIDE ' + i + ': icon_images=' + JSON.stringify(it.icons) + ' other_images=' + JSON.stringify(it.photos) +
      ' texts=' + JSON.stringify(it.texts.map(function (t) { return { id: t.id, text: t.text.slice(0, 90), x: t.x, y: t.y }; })) +
      (ref && !ref.fallback ? ' reference=' + ref.tag + ' (' + String(ref.layoutPattern || '').slice(0, 160) + ')' : ''));
  });

  // The template reference designs used by this deck (each shown once) — Create mode, after the harvest has run
  const refImages = [];
  if (specs && ctx.refRuntime) {
    const seen = {};
    specs.forEach(function (sp) {
      const ref = sp && sp.reference;
      if (!ref || ref.fallback || seen[ref.tag] || refImages.length >= 10) return;
      seen[ref.tag] = true;
      const blob = referenceThumbnailBlob(ref.tag, ctx);
      if (blob) refImages.push({ tag: ref.tag, blob: blob });
    });
    if (refImages.length) {
      parts.push({ text: 'REFERENCE DESIGNS from the 66degrees 2026 template (the target look for slides that name them):' });
      refImages.forEach(function (r) {
        parts.push({ text: 'REFERENCE ' + r.tag + ' image:' });
        parts.push({ inline_data: { mime_type: 'image/png', data: Utilities.base64Encode(r.blob.getBytes()) } });
      });
    }
  }

  const icons = Object.keys(ctx.assets.icons).sort().join(', ');
  const libIcons = ctx.lib ? ctx.lib.icons.map(function (i) { return i.name; }).join(', ') : '';
  const structureRules = isCreate
    ? `  * The FIRST slide is always redraw:true with {"type":"cover","title","subtitle"}.
  * The LAST slide, or any thank-you / contact / closing slide: redraw:true with {"type":"closing","title":"Thank You!","subtitle":<the deck's closing message or CTA>}. The title MUST be exactly "Thank You!" — put anything else in subtitle.`
    : `  * This is an EXISTING deck: keep its content. Never turn a content slide into a cover or closing.
  * A title / cover slide (normally the first): redraw:true with {"type":"cover","title","subtitle"}.
  * Only a real thank-you / contact / closing slide: redraw:true with {"type":"closing","title":"Thank You!","subtitle":<its message>}.`;

  parts.unshift({
    text: `You are the brand reviewer for ${ctx.brand.name}. Each slide image is followed by its inventory (element IDs, positions in points).
The deck will be restyled automatically to the ${ctx.brand.name} 2026 presentation template. Decide, for EVERY slide:
- "slide_type": what the slide is — one of cover, agenda, statement, cards, process, timeline, stats, chart, comparison, table, case_study, bullets, next_steps, quote, section, closing.
- "remove_images": IDs from other_images that are photos or illustrations showing logos, brand marks, product/app screenshots, fake UI,
  readable text, or anything that could misrepresent a real company; also purely decorative stock photos. Never list icon_images.
- "icons": for EVERY id in icon_images: { "icon": best name from ${libIcons ? 'LIBRARY_ICONS (preferred) or ' : ''}BRAND_ICONS for the text next to it, "material": closest Google Material Icons name }.
- "delete_shapes": text IDs holding placeholder text ("Presenter Name", "Click to add", "Lorem ipsum").
- "redraw" and "redraw_spec" (content read from the slide):
${structureRules}
  * An agenda / contents / "what we'll cover" slide: redraw:true with {"type":"agenda","title":"Agenda","items":[{"title","text"}, ...]} — 3 to 7 short items.
  * A section divider: redraw:true with {"type":"section","title"}.
  * A chart, or a diagram with text baked into images, or text cut off / overlapping / unreadable: redraw:true with a spec of type
    "chart" {"chart":{"type":"column"|"bar"|"line","categories":[],"series":[{"name","values":[]}],"unit","unitLabel"},"insight":{"title","text"}},
    "stats" {"items":[{"value","label","text"}],"takeaway"}, "cards" {"items":[{"title","text"}]}, "process" {"items":[{"title","text"}]},
    "timeline" {"items":[{"date","title","text"}]}, "table" {"columns":[],"rows":[[]]}, "comparison" {"left":{"label","points":[]},"right":{"label","points":[]}},
    "case_study" {"challenge","solution","results":[{"value","label"}]}, "bullets" {"points":[]} or "next_steps" {"items":[{"title","text"}]} — always with "title" and optional "lead".
  * A slide whose inventory names a reference but whose structure clearly cannot be restyled to look like that REFERENCE design
    (wrong structure, half empty, cluttered): redraw:true with its content as a spec of its slide_type.
  * Otherwise redraw:false and redraw_spec null.
${libIcons ? '\nLIBRARY_ICONS: ' + libIcons : ''}
BRAND_ICONS: ${icons}

INVENTORY:
${lines.join('\n')}

Return ONLY JSON: { "slides": [ { "index": 0, "slide_type": "cover", "remove_images": [], "icons": {}, "delete_shapes": [], "redraw": false, "redraw_spec": null } ] }`
  });

  const out = callGeminiJSON(parts, ctx.apiKey, 0.2);
  const map = {};
  (out && out.slides || []).forEach(function (s) { if (typeof s.index === 'number') map[s.index] = s; });
  return map;
}

/* ---------------- Icons, patterns, footer mark ---------------- */

// Icon order (CONFIG.iconOrder): template icon library (vector, slide 114) -> Drive brand icons -> Material Icons
function placeBrandIcon(slide, el, choice, ctx) {
  if (!choice) return false;
  if (typeof choice === 'string') choice = { icon: choice };
  const name = String(choice.icon || '');
  const b = { left: el.getLeft(), top: el.getTop(), width: el.getWidth(), height: el.getHeight() };
  const side = Math.max(b.width, b.height);
  const sq = { left: b.left + (b.width - side) / 2, top: b.top + (b.height - side) / 2, size: side };
  const order = CONFIG.iconOrder || ['library', 'drive', 'material'];

  for (let k = 0; k < order.length; k++) {
    const step = order[k];
    if (step === 'library' && ctx.lib) {
      const tag = libraryIconByName(ctx.lib, name) || pickLibraryIcon(ctx.lib, [name, choice.material].filter(Boolean).join(' '));
      if (tag && insertLibraryIcon(slide, tag, sq.left, sq.top, sq.size, false, ctx)) {
        ctx.libraryIconsPlaced = (ctx.libraryIconsPlaced || 0) + 1;
        el.remove();
        return true;
      }
    } else if (step === 'drive') {
      let blob = null;
      if (/^gcp:/i.test(name)) {
        const id = ctx.assets.gcp[normalizeName(name.replace(/^gcp:/i, ''))];
        if (id) blob = getBlobCached(id, ctx);
      } else if (name && !/^lib:/i.test(name)) {
        const match = findBrandIcon(name, ctx.assets.icons, {});
        if (match && match.entry.blue) blob = getBlobCached(match.entry.blue, ctx);
      }
      if (blob) {
        slide.insertImage(blob, sq.left, sq.top, sq.size, sq.size);
        el.remove();
        return true;
      }
    } else if (step === 'material') {
      // Material Icons is not a Slides font (the icon name showed up as a word), so draw a neutral brand mark instead
      const ringEl = (typeof insertShapeSafe_ === 'function')
        ? insertShapeSafe_(slide, 'ELLIPSE', sq.left + sq.size * 0.2, sq.top + sq.size * 0.2, sq.size * 0.6, sq.size * 0.6)
        : slide.insertShape(SlidesApp.ShapeType.ELLIPSE, sq.left + sq.size * 0.2, sq.top + sq.size * 0.2, Math.max(1, sq.size * 0.6), Math.max(1, sq.size * 0.6));
      ringEl.getFill().setTransparent();
      ringEl.getBorder().setWeight(Math.max(1, sq.size * 0.08));
      ringEl.getBorder().getLineFill().setSolidFill(IPAY.blue);
      el.remove();
      return true;
    }
  }
  return false;
}

function insertPattern(slide, b, ctx) {
  const pats = ctx.assets.patterns || {};
  const ratio = b.w / Math.max(b.h, 1);
  const id = ratio > 2.5 ? (pats['pattern-blue'] || pats['pattern-blue-square']) : (pats['pattern-blue-square'] || pats['pattern-blue']);
  if (!id) return;
  try {
    const blob = getBlobCached(id, ctx);
    const img = slide.insertImage(blob, b.x, b.y, b.w, b.h);
    img.replace(blob, true);
    img.sendToBack();
  } catch (e) { Logger.log('Pattern failed: ' + e.message); }
}

function overlapsText(it, r, b) {
  return it.texts.some(function (t) {
    if ((r.delete_shapes || []).indexOf(t.id) !== -1) return false;
    const tb = it.bounds[t.id];
    if (!tb) return false;
    const ox = Math.min(tb.x + tb.w, b.x + b.w) - Math.max(tb.x, b.x);
    const oy = Math.min(tb.y + tb.h, b.y + b.h) - Math.max(tb.y, b.y);
    return ox > 4 && oy > 4;
  });
}

function regionFree(elements, x, y, w, h, pageArea) {
  return !elements.some(function (e) {
    if (pageArea && e.w * e.h > 0.8 * pageArea) return false;
    return e.x < x + w && e.x + e.w > x && e.y < y + h && e.y + e.h > y;
  });
}

// iPAY footer: small dark 66° mark bottom-left — always place it, on top of any overlap
function addFooterMark(slide, elements, pageW, pageH, S, ctx) {
  const id = (ctx.assets.design || {})['ds-mark-dark'];
  if (!id) return;
  const x = 22.3 * S, y = 376.8 * S, w = 24.3 * S, h = 16.2 * S;
  try {
    const img = slide.insertImage(getBlobCached(id, ctx), x, y, w, h);
    img.setTitle('66 Mark');
    try { img.bringToFront(); } catch (e) {}
  } catch (e) { Logger.log('Footer mark failed: ' + e.message); }
}
