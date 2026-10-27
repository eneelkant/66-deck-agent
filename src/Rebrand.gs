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
const CREATE_ENGINE = ['comparison', 'timeline', 'next_steps', 'stats', 'cards', 'process', 'case_study', 'diagram', 'table', 'bullets', 'statement'];
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
    fields: 'pageSize,masters(objectId,pageProperties(colorScheme)),slides(objectId,pageProperties(pageBackgroundFill),pageElements)'
  });
  readTheme_(pres);
  const pageW = pres.pageSize.width.magnitude / EMU;
  const pageH = pres.pageSize.height.magnitude / EMU;
  const S = pageW / 720; // scale from the 720pt iPAY canvas
  const slides = pres.slides || [];
  // Large decks are rebranded in parts: only slides start..end-1 are touched in this run (V.1_27+)
  const start = Math.max(0, opts.start || 0), end = Math.min(slides.length, opts.end != null ? opts.end : slides.length);
  const inPart = function (i) { return i >= start && i < end; };
  const whole = start === 0 && end === slides.length;
  stats.slides = end - start;

  // ---- Inventory + Gemini review ----
  const inv = slides.map(function (pg, i) { return buildInventory(pg, i, pageW, pageH); });
  // Rebrand mode: the progress list shows the deck's own slides (first text of each slide)
  if (ctx.progress && !opts.specs && start === 0) {
    progressSlides_(ctx, inv.map(function (it, i) {
      const top = it.texts.slice().sort(function (a, b) { return a.y - b.y; })[0];
      return top ? top.text.replace(/\s+/g, ' ').slice(0, 70) : 'Slide ' + (i + 1);
    }));
  }
  progressStage_(ctx, 'review', 'active', 'Gemini is checking ' + slides.length + ' slides against the 66degrees template');
  let review = {};
  if (CONFIG.reviewWithGemini) {
    try { review = reviewSlidesWithGemini(presId, slides.slice(start, end), inv.slice(start, end), ctx, Object.assign({}, opts, { offset: start })); }
    catch (e) { ctx.log.push('Slide review skipped: ' + e.message); }
  }
  progressStage_(ctx, 'review', 'done', slides.length + ' slides reviewed');
  checkCancel_(ctx);
  const specs = opts.specs && opts.specs.length === slides.length ? opts.specs : null;
  const isCreate = !!opts.specs;

  // Template reference per slide: from the plan (Create) or from Gemini's slide_type classification (Rebrand)
  const usage = { lastTag: null, counts: {}, darkCount: 0 };
  const refs = inv.map(function (it, i) {
    if (!inPart(i)) return null;
    if (specs && specs[i] && specs[i].reference) return specs[i].reference;
    const r = review[i] || {};
    const t = r.slide_type || (r.redraw_spec && r.redraw_spec.type);
    return (ctx.lib && t) ? selectReferenceForSpec(ctx.lib, Object.assign({ type: t }, r.redraw_spec || {}), usage) : null;
  });
  saveRotation_(usage);

  inv.forEach(function (it, i) {
    if (!inPart(i)) return;
    const r = review[i] || (review[i] = {});
    r.remove_images = (r.remove_images || []).filter(function (id) { return it.imageIds.indexOf(id) !== -1; });
    r.delete_shapes = (r.delete_shapes || []).filter(function (id) { return it.textIds.indexOf(id) !== -1; });
    r.icons = isCreate ? (r.icons || {}) : {};                  // V.1_60: a rebrand keeps the deck's own icons
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
    // V.1_36: a slide that is a title + a table is redrawn from the SOURCE table, cell by cell (every row, every column,
    // merged groups kept) - Gemini's retyped copy of a table can drop or change data
    if (!isCreate) {
      const tEl = largestTable_(slides[i]);
      const others = it.texts.filter(function (t) { return !OLD_BRAND_TEXT_RE_.test(t.text); });
      if (tEl && others.length <= 2) {
        const tbl = extractSourceTable_(tEl);
        if (tbl.columns.length >= 2 && tbl.rows.length >= 1) {
          const top = others.slice().sort(function (a, b) { return a.y - b.y; })[0];
          const title = (r.redraw_spec && r.redraw_spec.title) || (top && top.text) || '';
          r.redraw = true;
          r.spec = { type: 'table', title: title, lead: (r.redraw_spec && r.redraw_spec.lead) || '', columns: tbl.columns, rows: tbl.rows, fromSource: true, reference: null,
            notes: (r.redraw_spec && r.redraw_spec.notes) || '' };
        }
      }
    }
    if (r.redraw && r.spec && !isCreate) keepOriginalWording_(r.spec, it);   // V.1_59: a rebrand never rewrites the content
    if (r.redraw && r.spec) {
      stripOldBrandText_(r.spec);                               // "#LetsGetYouThere" and other old taglines never come back
      const kind2 = String(r.spec.type || '').toLowerCase();
      if (kind2 !== 'closing') {
        if (r.spec.title) r.spec.title = rebrandCase_(r.spec.title);
        if (Array.isArray(r.spec.columns)) r.spec.columns = r.spec.columns.map(function (c) { return typeof c === 'string' ? rebrandCase_(c) : c; });
      }
    }
    if (r.redraw && r.spec && !r.spec.reference && !r.spec.fromSource && refs[i]) r.spec.reference = refs[i];
    it.texts.forEach(function (t) {
      if ((/^(presenter name|your name|click to (add|edit)|lorem ipsum|subtitle here|title here)\b/i.test(t.text.trim()) || OLD_BRAND_TEXT_RE_.test(t.text)) &&
          r.delete_shapes.indexOf(t.id) === -1) r.delete_shapes.push(t.id);
    });
  });

  // V.1_59: names the deck writes with capitals inside its sentences keep them when headings go to sentence case
  if (!isCreate && typeof setRunNames_ === 'function') {
    const body = [];
    inv.forEach(function (it2, i) {
      if (!inPart(i)) return;
      it2.texts.forEach(function (t) {
        // V.1_60: only sentences count ("Execute Test Queries: Run one..." starts with a label, not a name)
        t.text.split(/\n+/).forEach(function (line) {
          const sent = line.replace(/^[^.:]{2,48}:\s+/, '').trim();
          if (sent.split(/\s+/).length >= 8 && /[a-z]{3,}\s+[a-z]{3,}/.test(sent)) body.push(sent);
        });
      });
    });
    try {
      setRunNames_('', []);
      if (typeof namesFromNotes_ === 'function' && typeof addRunNames_ === 'function') addRunNames_(namesFromNotes_([{ notes: body.join(' ') }]));
    } catch (e) {}
  }
  // ---- Batch: normalize every non-redrawn slide to the 2026 template ----
  progressStage_(ctx, 'brand', 'active', 'Applying colors, fonts and card styles to all slides');
  const requests = [];
  const titleFixes = [];
  slides.forEach(function (page, i) {
    if (!inPart(i)) return;
    const r = review[i];
    const it = inv[i];
    if (r.redraw) {
      // V.1_61 (deck 34 slide 1: the Gemini star left the cover): a rebrand's cover keeps its product picture - an image on
      // the right half, clear of the top and bottom brand bands - and the new cover is drawn around it
      const keep = !isCreate && r.spec && /cover/i.test(String(r.spec.type || '')) ? coverArt_(page, pageW, pageH) : null;
      if (keep) r.keepArt = keep;
      (page.pageElements || []).forEach(function (el) { if (!keep || el.objectId !== keep.id) requests.push({ deleteObject: { objectId: el.objectId } }); });
      return;
    }
    const skip = {};
    r.remove_images.forEach(function (id) { skip[id] = true; requests.push({ deleteObject: { objectId: id } }); stats.removed++; });
    r.delete_shapes.forEach(function (id) { skip[id] = true; requests.push({ deleteObject: { objectId: id } }); });

    // V.1_59 (deck 32: a second 66 mark on top of the deck's own, over "CUSTOMER · ..."): a small picture in the bottom-left
    // corner is the deck's old footer mark; it goes, and the brand pass places exactly one mark there
    // V.1_60 (deck 33 slide 10: the old mark drawn as vector shapes stayed under the new one): pictures, vector shapes and
    // groups without text in that corner are the old mark; the new mark takes their place and size
    if (!isCreate) {
      const corner = function (b) { return b && b.w > 2 && b.y > pageH * 0.86 && b.x < pageW * 0.12 && b.w < 60 * S && b.h < 34 * S; };
      const visit = function (els) {
        (els || []).forEach(function (el) {
          if (skip[el.objectId]) return;
          const b = elementBounds(el);
          const textless = !shapeText(el) && !(el.elementGroup && flatten(el.elementGroup.children, []).some(function (c) { return shapeText(c); }));
          if (corner(b) && textless && (el.image || el.elementGroup || (el.shape && /FREEFORM|CUSTOM/.test(el.shape.shapeType || '')))) {
            skip[el.objectId] = true; requests.push({ deleteObject: { objectId: el.objectId } });
            flatten([el], []).forEach(function (c) { skip[c.objectId] = true; });
            if (!r.oldMark || b.x < r.oldMark.x) r.oldMark = b;
            return;
          }
          if (el.elementGroup) visit(el.elementGroup.children);
        });
      };
      visit(page.pageElements);
    }
    const roles = detectRoles(page, it, pageW, pageH, S, skip);
    const ref = refs[i];
    // V.1_60: a rebrand adds no decoration the slide did not have (deck 33: blue bars appeared on every card)
    // V.1_61: and the same card style on every slide (deck 34: grey cards on some slides, white outlined cards on others)
    const cardStyle = !isCreate ? 'panel' : ((ref && ref.cardStyle) || 'panel');
    roles.cardFill = cardStyle === 'elevated' ? IPAY.white : IPAY.bgLight;
    // V.1_59: one background for every content slide of a rebranded deck (deck 32: cream and grey slides mixed)
    const bg = !isCreate ? IPAY.white : ((roles.cards.length >= 2 && cardStyle === 'elevated') || (ref && ref.background === 'panel' && roles.cards.length < 2)
      ? IPAY.bgLight : IPAY.white);
    requests.push({
      updatePageProperties: {
        objectId: page.objectId,
        pageProperties: { pageBackgroundFill: { solidFill: { color: apiColor(bg) } } },
        fields: 'pageBackgroundFill.solidFill.color'
      }
    });
    normalizeElements(page.pageElements || [], requests, ctx.brand, stats, skip, roles, isCreate, S, pageW * pageH, bg);
    if (!isCreate) {
      // V.1_59: titles and Title Case headings in sentence case ("Core Adoption team Structure" -> "Core adoption team
      // structure"); names the deck writes with capitals in its sentences keep them ("Gemini Enterprise", "Model Armor")
      flatten(page.pageElements || [], []).forEach(function (el) {
        if (skip[el.objectId] || !el.shape) return;
        const b = elementBounds(el);
        if (b.y > pageH * 0.86) return;                                      // footer texts stay as they are
        caseFixRequests_(el, page.objectId, roles.title && roles.title.el === el).forEach(function (q) { titleFixes.push(q); });
      });
    }
    // old brand corner marks (small triangles) left on the slide itself
    flatten(page.pageElements || [], []).forEach(function (el) {
      if (skip[el.objectId] || !el.shape || !/TRIANGLE/.test(el.shape.shapeType || '') || shapeText(el)) return;
      const b = elementBounds(el);
      if ((b.w * b.h) / (pageW * pageH) < 0.02) { requests.push({ deleteObject: { objectId: el.objectId } }); skip[el.objectId] = true; }
    });
    positionTitle(requests, roles, S);
    styleCards(requests, page.objectId, roles, S, i, cardStyle);
    stats.normalized++;
  });
  if (isCreate) requests.push({ replaceAllText: { containsText: { text: '\u000b', matchCase: true }, replaceText: ' ' } });
  runBatches(presId, requests, stats);

  // ---- ALL CAPS titles -> sentence case (brand rule) ----
  const capsFixes = [];
  slides.forEach(function (page, i) {
    if (!inPart(i) || review[i].redraw || !isCreate) return;
    inv[i].texts.forEach(function (t) {
      const fixed = fixAllCaps(t.text);
      if (fixed !== t.text && t.text.length < 120) {
        capsFixes.push({ replaceAllText: { containsText: { text: t.text, matchCase: true }, replaceText: fixed, pageObjectIds: [page.objectId] } });
      }
    });
  });
  if (capsFixes.length) runBatches(presId, capsFixes, stats);
  if (titleFixes.length) runBatches(presId, titleFixes, stats);
  // ---- The file itself: old-brand decorations on the slide masters / layouts go, placeholders get the brand font ----
  if (!isCreate && start === 0) {
    try { cleanOldBrandLayouts_(presId, ctx, stats); } catch (e) { ctx.log.push('Layout clean-up skipped: ' + e.message); }
  }

  // ---- SlidesApp phase: icons, patterns, footer mark, redraws ----
  const deck = SlidesApp.openById(presId);
  const deckSlides = deck.getSlides();
  // V.1_59 (deck 32: "September 2026" became today's date): a rebranded cover keeps the date it had (none if it had none)
  const dateLabel = isCreate ? Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy') : null;
  if (!isCreate) ctx.sansOnly = true;                                      // V.1_59: Plus Jakarta Sans only in a rebrand

  // Per slide: redraw (engine) or icons + footer mark. Progress is reported slide by slide.
  const brandSlide = function (slide, i) {
    const r = review[i] || {};
    const it = inv[i];
    if (!it) return;

    if (r.redraw) {
      try {
        // A table that does not fit one slide continues on new slides right after it (same design, every row kept)
        // (a run that rebrands only part of a large deck cannot add slides - the next part counts slides by position - so
        //  there the table is drawn compact on one slide instead)
        const parts = r.spec.fromSource ? (whole ? splitTableSpec_(r.spec) : [Object.assign({}, r.spec, { compact: true })]) : [r.spec];
        // Template section dividers carry no number (66D_LAYOUT_SECTION_001); a number is only shown if the spec has one.
        // the renderer clears the slide, so the kept cover picture is taken first and put back after
        let artBlob = null;
        if (r.keepArt) { try { artBlob = slide.getPageElementById(r.keepArt.id).asImage().getBlob(); } catch (e) { Logger.log('Cover picture read failed: ' + e.message); } }
        renderEngineSlide(slide, parts[0], i + 1, ctx, pageW, pageH, dateLabel != null ? dateLabel : originalDate_(it));
        if (artBlob) placeCoverArt_(slide, artBlob, r.keepArt, pageW, pageH, S);
        let after = slide;
        for (let k = 1; k < parts.length; k++) {
          const ids = deck.getSlides().map(function (sl) { return sl.getObjectId(); });
          const at = ids.indexOf(after.getObjectId()) + 1;
          let ns;
          try { ns = deck.insertSlide(at, SlidesApp.PredefinedLayout.BLANK); } catch (e) { ns = deck.insertSlide(at, after.getLayout()); }
          renderEngineSlide(ns, parts[k], at + 1, ctx, pageW, pageH, dateLabel != null ? dateLabel : originalDate_(it));
          after = ns;
          stats.redrawn++;
        }
        if (parts.length > 1) ctx.log.push('Slide ' + (i + 1) + ': the table continues on ' + (parts.length - 1) + ' more slide(s) so no row is left out.');
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
    // V.1_60: the new mark sits where the deck's old mark was (on slides without one too, so every slide matches) and
    // footer text that still touches it moves right (deck 30 slide 14: the mark covered "CUSTOMER · Phase 5")
    const markAt = !isCreate ? (r.oldMark || deckOldMark_(review)) : null;
    const mk = addFooterMark(slide, occupied, pageW, pageH, S, ctx, markAt);
    if (!isCreate && mk) clearFooterText_(slide, mk, pageH);
  };
  deckSlides.forEach(function (slide, i) {
    if (!inPart(i)) return;
    checkCancel_(ctx);
    progressSlide_(ctx, i, 'active');
    brandSlide(slide, i);
    progressSlide_(ctx, i, 'done');
  });

  flushPresentation(deck);
  progressStage_(ctx, 'brand', 'done', (end - start) + ' slides branded');
  stats.libraryIcons = ctx.libraryIconsPlaced || 0;

  // ---- V.1_59: rebrand check - texts on top of each other, text that cannot be read, shapes off the slide ----
  if (!isCreate) {
    try {
      const qa = rebrandQa_(presId, start, end);
      stats.qa = qa.length;
      // V.1_64: the check's findings go to the slide log, slide by slide (redrawn slides are logged when they are drawn)
      if (typeof recordRebrandChecks_ === 'function') {
        const redrawn = {};
        for (let i = start; i < end; i++) if (review[i] && review[i].redraw) redrawn[i] = true;
        recordRebrandChecks_(qa, start, end, redrawn);
      }
      if (qa.length) ctx.log.push('Rebrand check: ' + qa.slice(0, 6).join('; ') + (qa.length > 6 ? ' (+' + (qa.length - 6) + ' more)' : '') + '.');
      else ctx.log.push('Rebrand check: no overlapping or unreadable text found.');
    } catch (e) { ctx.log.push('Rebrand check skipped: ' + e.message); }
    if (stats.shrunk) ctx.log.push(stats.shrunk + ' text(s) set slightly smaller so they fit their boxes in Plus Jakarta Sans.');
  }
  // ---- Deterministic brand check (reported, not blocking) ----
  const issues = whole ? validateDeckAgainstReference(presId, refs, ctx) : [];
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
  const cards0 = all.filter(function (el) {
    if (!el.shape || !fillHex_((el.shape.shapeProperties || {}).shapeBackgroundFill)) return false;
    const b = elementBounds(el), share = (b.w * b.h) / (pageW * pageH);
    return share > 0.01 && share < 0.9 && b.y > 30 * S;
  }).map(elementBounds);
  const inCard0 = function (b) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2; return cards0.some(function (o) { return cx > o.x + 1 && cx < o.x + o.w - 1 && cy > o.y + 1 && cy < o.y + o.h - 1; }); };
  all.forEach(function (el) {
    if (!el.shape || !el.shape.text) return;
    const b = elementBounds(el);
    const txt = shapeText(el);
    if (!txt || txt.length > 140 || b.y > pageH * 0.24) return;
    const size = firstRunSize(el);
    // V.1_61 (deck 34 slide 14: the KPI "WAU" in a card was taken for the title and set black): inside a card is never the title
    if (inCard0(b)) return;
    if (!best || size > best.size) best = { el: el, b: b, size: size };
  });
  if (best && best.size >= 14 * S) {
    roles.title = best;
    // Subtitle: next smaller text right below the title
    let sub = null;
    // V.1_59: the subtitle starts at the title's left edge and never sits inside a card or panel (a card's small label
    // was moved up over the real subtitle)
    const boxes = all.filter(function (el) {
      if (!el.shape || !fillHex_((el.shape.shapeProperties || {}).shapeBackgroundFill)) return false;
      const b = elementBounds(el), share = (b.w * b.h) / (pageW * pageH);
      return share > 0.01 && share < 0.9;
    }).map(elementBounds);
    const inBox = function (b) { const cx = b.x + Math.min(b.w, 40) / 2, cy = b.y + b.h / 2; return boxes.some(function (o) { return cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h; }); };
    all.forEach(function (el) {
      if (el === best.el || !el.shape || !el.shape.text || !shapeText(el)) return;
      const b = elementBounds(el), size = firstRunSize(el);
      if (b.y >= best.b.y && b.y < best.b.y + best.b.h + 45 * S && size && size < best.size && size <= 16 * S && shapeText(el).length < 200 &&
          Math.abs(b.x - best.b.x) < 40 * S && !inBox(b)) {
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
    const hasFill = !!fillHex_(props.shapeBackgroundFill);
    const hasOutline = props.outline && (!props.outline.propertyState || props.outline.propertyState === 'RENDERED') && fillHex_(props.outline.outlineFill);
    if (!hasFill && !hasOutline) return;
    const type = el.shape.shapeType || '';
    if (/ELLIPSE|ARROW|LINE|CHEVRON|TRIANGLE/.test(type)) return;
    const b = elementBounds(el);
    const share = (b.w * b.h) / area;
    if (share < 0.015 || share > 0.35 || b.w < 60 * S || b.h < 40 * S || b.w > pageW * 0.9) return;
    const fh = hasFill ? fillHex_(props.shapeBackgroundFill) : null;
    // V.1_59 (option A): dark panels stay dark and blue panels stay blue; only light cards take the template card style
    const light = !fh || (luminance(fh) > 0.45 && hexInfo(fh).sat < 0.35);
    roles.cards.push({ el: el, b: b, light: light });
  });
  if (roles.cards.length < 2) roles.cards = [];
  roles.cards.forEach(function (c) { if (c.light) roles.headingIds[c.el.objectId] = true; });

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
    const hue = hueOf(origHex);
    if (h.sat > 0.45 && h.lum > 0.06 && h.lum < 0.6) return IPAY.blue; // accent text stays an accent
    if (h.sat > 0.6 && hue >= 200 && hue <= 250 && h.lum > 0.01) return IPAY.blue;   // V.1_60: a deep blue figure ("WAU") too
  }
  return (size >= 12 * S || weight >= 500) ? IPAY.ink : IPAY.body;
}

/* ---------------- Normalization requests ---------------- */

// V.1_59: the colour every filled shape of a slide will have after the brand pass, in drawing order (bottom first), so
// a text takes its colour from what is really behind it (deck 32: text on dark panels turned Night Blue on Night Blue)
function planFills_(elements, roles, S, pageArea, pageBg, isCreate) {
  const order = [], fill = {}, orig = {};
  const pageW = Math.sqrt(pageArea * 16 / 9);
  const behind = function (b) {                                        // the planned fill under a point, topmost first
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (let k = order.length - 1; k >= 0; k--) {
      const o = order[k];
      if (cx >= o.b.x && cx <= o.b.x + o.b.w && cy >= o.b.y && cy <= o.b.y + o.b.h) return fill[o.id];
    }
    return pageBg;
  };
  flatten(elements, []).forEach(function (el) {
    if (!el.shape) return;
    const props = el.shape.shapeProperties || {};
    const bgf = props.shapeBackgroundFill || {};
    const eb = elementBounds(el);
    if (!eb.w || !eb.h) return;
    if (bgf.solidFill && bgf.solidFill.alpha !== undefined && bgf.solidFill.alpha < 0.3) return;   // see-through: no fill
    const o = fillHex_(bgf);
    let hex = null;
    if (o) {
      orig[el.objectId] = o;
      const under = behind(eb);
      const darkUnder = under && luminance(under) < 0.2;
      const tiny = eb.w * eb.h < pageArea * 0.002 && Math.max(eb.w, eb.h) < 26 * S;
      if (roles.headingIds[el.objectId]) {
        // V.1_61 (deck 34 slides 5, 8, 14: the inner panels vanished into the grey card around them): a card on a card is white
        hex = roles.cardFill || IPAY.white;
        if (under && under === hex) hex = hex === IPAY.white ? IPAY.bgLight : IPAY.white;
      }
      else if (tiny) {
        // V.1_60 (deck 33: the bullet dots and accent dashes of two columns vanished): a small accent stays an accent
        const hi = hexInfo(o);
        hex = hi.sat > 0.25 ? (darkUnder && hi.lum > 0.2 ? o : IPAY.blue) : (darkUnder ? o : (hi.lum > 0.6 ? IPAY.slate : o));
      }
      else if (!isCreate && luminance(o) < 0.2 && darkUnder) hex = o;   // (option A) a dark box on a dark panel keeps its shade
      else {
        hex = mapFillColor(o, (eb.w * eb.h) / pageArea, eb.w / pageW);
        if (hex === IPAY.bgLight && pageBg === IPAY.bgLight) hex = IPAY.white;
      }
      // V.1_60 (deck 33 slide 9: the circles behind the icons disappeared): a box never takes the colour of what is behind it
      if (!isCreate && hex && under && hex === under && o !== under) hex = luminance(under) > 0.9 ? IPAY.bgLight : (luminance(under) > 0.6 ? IPAY.white : hex);
    } else if (bgf.solidFill && (!bgf.propertyState || bgf.propertyState === 'RENDERED')) {
      const areaShare = (eb.w * eb.h) / pageArea, wideBand = eb.w > pageW * 0.5 && eb.h < 60 * S;
      hex = wideBand ? IPAY.blue : (areaShare > 0.15 ? IPAY.bgLight : IPAY.tileBlue);
      if (hex === IPAY.bgLight && pageBg === IPAY.bgLight) hex = IPAY.white;
    }
    if (hex) { fill[el.objectId] = hex; order.push({ id: el.objectId, b: eb }); }
  });
  return { fill: fill, orig: orig, behind: behind };
}

// V.1_59: Plus Jakarta Sans is wider than Calibri / Arial, so a text restyled in it can need more lines than its box has
// and run into the next text. The share of the size the text keeps so it fits its box again (1 = fits as it is).
function fitFactor_(el, sizeOf, weightOf) {
  if (!el.shape || !el.shape.text || typeof ENGINE === 'undefined' || !ENGINE.kit) return 1;
  const b = elementBounds(el);
  if (!b.w || !b.h || b.w < 20) return 1;
  const paras = [];
  let cur = { text: '', size: 0, weight: 400 };
  (el.shape.text.textElements || []).forEach(function (te) {
    if (te.paragraphMarker) { if (cur.text.trim()) paras.push(cur); cur = { text: '', size: 0, weight: 400 }; return; }
    if (te.textRun && te.textRun.content) {
      cur.text += te.textRun.content.replace(/\n$/, '');
      if (!cur.size) { cur.size = sizeOf(te) || 10; cur.weight = weightOf(te); }
    }
  });
  if (cur.text.trim()) paras.push(cur);
  if (!paras.length) return 1;
  // V.1_61: measured against the box itself (the decks' text boxes have no inner margin: deck 34 slide 3 showed "communications
  // calendar" at 7 pt on one line in a 87 pt box, which the old 4 pt margin called too wide) and tried in real half-point
  // steps, so the size chosen is the largest that fits
  const need = function (f) {
    return paras.reduce(function (h, p) {
      const sz = Math.max(6, Math.floor(p.size * f * 2 + 0.001) / 2);
      const lines = ENGINE.kit.wrap(p.text.replace(/\u000b/g, '\n'), Math.max(10, (b.w - 0.5) / 0.94), 'sans', Math.min(p.weight, 500), sz).length;
      return h + lines * ENGINE.kit.lineHeight('sans', sz) * 0.92;
    }, 0);
  };
  if (need(1) <= b.h + 3) return 1;
  const s0 = paras[0].size || 10;
  for (let sz = Math.floor(s0 * 2) / 2 - 0.5; sz >= Math.max(6, s0 * 0.75); sz -= 0.5) if (need(sz / s0) <= b.h + 3) return sz / s0;
  return Math.max(6, s0 * 0.75) / s0;
}

function normalizeElements(elements, requests, brand, stats, skip, roles, isCreate, S, pageArea, pageBg, plan) {
  const top = !plan;
  plan = plan || planFills_(elements, roles, S, pageArea, pageBg, isCreate);
  roles.plan = plan;
  // V.1_60: texts of the same kind (same size, same box width - the three card bodies, the bullet rows of a list) shrink
  // together, so one card is not set smaller than its neighbours (deck 33 slide 8: 6.5 pt next to 7 pt); a text that needs
  // more than its kind keeps going down on its own
  // V.1_61 (deck 34 slide 3: the Role 02 card at 6 pt next to four cards at 8 pt): kinds are found across the whole slide,
  // not inside each group
  const fits = plan.fits = plan.fits || {};
  if (!isCreate && top) {
    const sz = function (te) { const st = (te.textRun && te.textRun.style) || {}; return st.fontSize && st.fontSize.magnitude; };
    const wt = function (te) { const st = (te.textRun && te.textRun.style) || {}; const w = (st.weightedFontFamily || {}).weight; return Math.min(w || (st.bold ? 500 : 400), 500); };
    const kinds = {};
    flatten(elements, []).forEach(function (el) {
      if (skip[el.objectId] || !el.shape || !el.shape.text || !shapeText(el)) return;
      if ((roles.title && roles.title.el === el) || (roles.subtitle && roles.subtitle.el === el)) return;
      const first = (el.shape.text.textElements || []).filter(function (t) { return t.textRun && t.textRun.content.trim(); })[0];
      const f = fitFactor_(el, sz, wt);
      const key = Math.round((sz(first) || 10) * 2) + '|' + Math.round(elementBounds(el).w / 6);
      fits[el.objectId] = f;
      (kinds[key] = kinds[key] || []).push(el.objectId);
    });
    Object.keys(kinds).forEach(function (k) {
      const ids = kinds[k];
      if (ids.length < 2) return;
      const kindF = Math.max(0.75, Math.min.apply(null, ids.map(function (id) { return fits[id]; })));
      ids.forEach(function (id) { fits[id] = Math.min(fits[id], kindF); });
    });
  }
  elements.forEach(function (el) {
    if (skip[el.objectId]) return;
    if (el.elementGroup) { normalizeElements(el.elementGroup.children || [], requests, brand, stats, skip, roles, isCreate, S, pageArea, pageBg, plan); return; }
    const isCard = !!roles.headingIds[el.objectId];
    const isTitle = roles.title && roles.title.el === el;
    const isSub = roles.subtitle && roles.subtitle.el === el;
    const eb = elementBounds(el);

    // the planned fill of this shape (applied here) and the colour the text sits on (its own fill, else what is behind it)
    let fillHex = plan.fill[el.objectId] || null;
    if (el.shape && fillHex && !isCard && fillHex !== plan.orig[el.objectId]) {
      requests.push({ updateShapeProperties: { objectId: el.objectId, shapeProperties: { shapeBackgroundFill: { solidFill: { color: apiColor(fillHex) } } }, fields: 'shapeBackgroundFill.solidFill.color' } });
      stats.colors++;
    }
    if (el.shape) {
      const props = el.shape.shapeProperties || {};
      const outlineVisible = props.outline && (!props.outline.propertyState || props.outline.propertyState === 'RENDERED');
      const ocHex = outlineVisible ? fillHex_(props.outline.outlineFill) : null;
      if (ocHex) {
        const o = ocHex;
        // V.1_60 (deck 33: blue frames appeared on dark cards): an outline on a dark panel keeps its colour
        const n = !isCreate && luminance(plan.behind(eb) || IPAY.white) < 0.2 ? o : mapLineColor(o);
        if (n !== o) {
          requests.push({ updateShapeProperties: { objectId: el.objectId, shapeProperties: { outline: { outlineFill: { solidFill: { color: apiColor(n) } } } }, fields: 'outline.outlineFill.solidFill.color' } });
          stats.colors++;
        }
      }
    }
    if (isCard) fillHex = plan.fill[el.objectId] || roles.cardFill || IPAY.white;
    const textBg = fillHex || plan.behind(eb);

    if (el.line && el.line.lineProperties) {
      const lc = solidRgb(el.line.lineProperties.lineFill);
      if (lc) {
        const o = rgbObjToHex(lc), n = luminance(plan.behind(eb) || IPAY.white) < 0.2 && luminance(o) > 0.2 ? o : mapLineColor(o);
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

    const sizeOf = function (te) { const st = (te.textRun && te.textRun.style) || {}; return st.fontSize && st.fontSize.magnitude; };
    const weightOf = function (te) { const st = (te.textRun && te.textRun.style) || {}; const w = (st.weightedFontFamily || {}).weight; return Math.min(w || (st.bold ? 500 : 400), 500); };
    // V.1_59: a text that would no longer fit its box in the brand font is set a little smaller (titles and subtitles keep
    // the template sizes)
    const fit = (!isTitle && !isSub && !isCreate) ? (fits[el.objectId] || 1) : 1;
    // V.1_61 (deck 34 slide 5: the subtitle went to two lines and ran down to the cards): at 10 pt the subtitle may not take
    // more lines than it had; it steps down to 8 pt first
    let subSize = 10 * S;
    if (isSub && !isCreate && typeof ENGINE !== 'undefined' && ENGINE.kit) {
      const st0 = ((el.shape.text.textElements || []).filter(function (t) { return t.textRun && t.textRun.content.trim(); })[0] || {}).textRun;
      const o = st0 && st0.style && st0.style.fontSize ? st0.style.fontSize.magnitude : 10 * S;
      const txt = shapeText(el), w = Math.max(10, eb.w - 4);
      const had = ENGINE.kit.wrap(txt, w, 'sans', 400, o * 0.92).length;
      while (subSize > 8 * S && ENGINE.kit.wrap(txt, w, 'sans', 400, subSize).length > had) subSize -= 0.5 * S;
    }
    if (fit < 1) stats.shrunk = (stats.shrunk || 0) + 1;

    forEachText(el, function (objectId, cellLocation, te) {
      const st = te.textRun.style || {};
      const wff = st.weightedFontFamily || {};
      const family = wff.fontFamily || st.fontFamily;
      // Brand Guidelines: Regular and Medium only (no SemiBold, no Bold)
      let weight = Math.min(wff.weight || (st.bold ? 500 : 400), 500);
      const size = st.fontSize && st.fontSize.magnitude;
      const style = {}, fields = [];
      if (family && /material (icons|symbols)/i.test(family)) return;

      // KPI / big numbers (template rule): Medium in blue
      const content = te.textRun.content || '';
      const isKpi = !isTitle && !isSub && !cellLocation && size && size >= 20 * S &&
        /^[\s$€£~<>]*\d[\d.,]*\s*(%|x|k|m|bn|b|pp|\+)?\+?\s*$/i.test(content);

      let targetSize = null;
      if (isTitle) { targetSize = 20 * S; weight = 500; }                 // title: Medium 20pt
      else if (isSub) { targetSize = subSize; weight = 400; }             // template subtitle: 10pt (fewer if it would wrap more)
      else if (isKpi) { weight = 500; }
      else if (isCreate && size && size >= 24 * S) targetSize = size * CONFIG.headlineShrink;
      if (!targetSize && fit < 1 && size && !cellLocation) targetSize = Math.max(6, Math.floor(size * fit * 2 + 0.001) / 2);   // down: rounding up undid the fit

      // V.1_59: a rebranded deck uses Plus Jakarta Sans only (labels, numbers and code too); a created deck keeps the
      // template's mono font for figures
      const mono = isCreate && (isKpi || (family && /mono|md ?io|courier|consolas|code/i.test(family)));
      const targetFamily = mono ? brand.fonts.mono.slides : brand.fonts.heading.slides;
      if (family !== targetFamily || isTitle || isSub || isKpi || (wff.weight || 400) > 500 || st.bold) {
        style.weightedFontFamily = { fontFamily: targetFamily, weight: weight };
        fields.push('weightedFontFamily');
        stats.fonts++;
      }
      if (targetSize) { style.fontSize = { magnitude: Math.round(targetSize * 2) / 2, unit: 'PT' }; fields.push('fontSize'); }

      const origHex = colorHex_(st.foregroundColor && st.foregroundColor.opaqueColor);
      const onDark = textBg && luminance(textBg) < 0.25;
      let color;
      if (cellLocation) color = cellLocation.rowIndex === 0 ? IPAY.white : IPAY.body;
      else if (onDark) color = IPAY.white;                                 // V.1_59: anything on a dark or blue panel is white
      else if (isTitle) color = IPAY.title || IPAY.ink;
      else if (isSub) color = IPAY.body;
      else if (isKpi) color = IPAY.blue;
      else color = textColorFor(origHex, textBg, targetSize || size || 10, weight, S);
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
  // V.1_59: a title or subtitle inside a group keeps its place (its transform is relative to the group: moving it with
  // slide positions put it somewhere else); it is restyled only
  if (IN_GROUP_[roles.title.el.objectId]) return;
  if (roles.subtitle && IN_GROUP_[roles.subtitle.el.objectId]) roles.subtitle = null;
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
    if (!c.light) return;                                                   // V.1_59: dark and blue panels keep their colour
    const planned = roles.plan && roles.plan.fill[c.el.objectId];
    const props = { shapeBackgroundFill: { solidFill: { color: apiColor(planned || (style === 'elevated' ? IPAY.white : IPAY.bgLight)) } } };
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
  // V.1_59: short labels in capitals too ("ROLE 01", "CRITERION", "EXIT CRITERIA"), never an acronym on its own ("WAU", "CSAT")
  if (letters.length < 4 || letters !== letters.toUpperCase()) return text;
  const wordsU = text.trim().split(/\s+/);
  if (wordsU.length === 1 && (letters.length < 6 || ACRONYMS.indexOf(letters) !== -1)) return text;
  if (wordsU.every(function (w) { const b = w.replace(/[^A-Za-z]/g, ''); return !b || b.length <= 3 || ACRONYMS.indexOf(b) !== -1; }) && wordsU.length <= 2 && !/\d/.test(text)) return text;
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

// V.1_59 (rebrand deck: labels inside grouped cards were taken for the subtitle and moved, text on dark panels turned
// Night Blue): a shape inside a group is placed relative to its group, so its place on the slide is its own transform
// combined with every parent group's. ABS_ holds the place on the slide of every element of the deck being rebranded.
var ABS_ = {}, IN_GROUP_ = {}, THEME_ = {};
// V.1_60 (deck 33 slide 6: the title and the whole right panel turned white on white): a fill that is see-through
// (alpha under 0.3, the invisible boxes some decks put behind every text) is no fill at all, and a theme colour
// ("dark 2" of the slide master) is read from the deck's colour scheme
function readTheme_(pres) {
  THEME_ = {};
  ((pres && pres.masters) || []).forEach(function (m) {
    const cs = m.pageProperties && m.pageProperties.colorScheme;
    ((cs && cs.colors) || []).forEach(function (c) { if (c.type && c.color && !THEME_[c.type]) THEME_[c.type] = rgbObjToHex(c.color); });
  });
}
function colorHex_(color) {
  if (!color) return null;
  if (color.rgbColor) return rgbObjToHex(color.rgbColor);
  if (color.themeColor) return THEME_[color.themeColor] || ({ DARK1: '#000000', TEXT1: '#000000', LIGHT1: '#FFFFFF', BACKGROUND1: '#FFFFFF' })[color.themeColor] || null;
  return null;
}
function fillHex_(fill) {
  if (!fill || !fill.solidFill || !fill.solidFill.color) return null;
  if (fill.propertyState && fill.propertyState !== 'RENDERED') return null;
  if (fill.solidFill.alpha !== undefined && fill.solidFill.alpha < 0.3) return null;
  return colorHex_(fill.solidFill.color);
}
function mulT_(p, c) {
  return {
    a: p.a * c.a + p.c * c.b, b: p.b * c.a + p.d * c.b,
    c: p.a * c.c + p.c * c.d, d: p.b * c.c + p.d * c.d,
    e: p.a * c.e + p.c * c.f + p.e, f: p.b * c.e + p.d * c.f + p.f
  };
}
function tOf_(t) {
  t = t || {};
  return { a: t.scaleX === undefined ? 1 : t.scaleX, b: t.shearY || 0, c: t.shearX || 0, d: t.scaleY === undefined ? 1 : t.scaleY,
    e: (t.translateX || 0) / EMU, f: (t.translateY || 0) / EMU };
}
function indexAbsolute_(els, parent, inGroup) {
  (els || []).forEach(function (el) {
    const m = mulT_(parent, tOf_(el.transform));
    const sz = el.size || {};
    const w = ((sz.width && sz.width.magnitude) || 0) / EMU, h = ((sz.height && sz.height.magnitude) || 0) / EMU;
    const xs = [m.e, m.e + m.a * w, m.e + m.c * h, m.e + m.a * w + m.c * h], ys = [m.f, m.f + m.b * w, m.f + m.d * h, m.f + m.b * w + m.d * h];
    ABS_[el.objectId] = { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
    if (inGroup) IN_GROUP_[el.objectId] = true;
    if (el.elementGroup) {
      indexAbsolute_(el.elementGroup.children, m, true);
      const bs = (el.elementGroup.children || []).map(function (c) { return ABS_[c.objectId]; }).filter(Boolean);
      if (bs.length) {
        const x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })), y0 = Math.min.apply(null, bs.map(function (b) { return b.y; }));
        ABS_[el.objectId] = { x: x0, y: y0, w: Math.max.apply(null, bs.map(function (b) { return b.x + b.w; })) - x0, h: Math.max.apply(null, bs.map(function (b) { return b.y + b.h; })) - y0 };
      }
    }
  });
}
function elementBounds(el) {
  if (el && ABS_[el.objectId]) return ABS_[el.objectId];
  const t = el.transform || {};
  const sz = el.size || {};
  const w = ((sz.width && sz.width.magnitude) || 0) * (t.scaleX === undefined ? 1 : t.scaleX) / EMU;
  const h = ((sz.height && sz.height.magnitude) || 0) * (t.scaleY === undefined ? 1 : t.scaleY) / EMU;
  return { x: (t.translateX || 0) / EMU, y: (t.translateY || 0) / EMU, w: Math.abs(w), h: Math.abs(h) };
}

function buildInventory(page, index, pageW, pageH) {
  indexAbsolute_(page.pageElements, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, false);
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
  const offset = opts.offset || 0;                     // index of the first slide of this part in the whole deck
  const parts = [];
  const lines = [];
  slides.forEach(function (page, i) {
    try {
      const thumb = Slides.Presentations.Pages.getThumbnail(presId, page.objectId, {
        'thumbnailProperties.thumbnailSize': 'MEDIUM', 'thumbnailProperties.mimeType': 'PNG'
      });
      const img = UrlFetchApp.fetch(thumb.contentUrl).getBlob();
      parts.push({ text: 'SLIDE ' + (i + offset) + ' image:' });
      parts.push({ inline_data: { mime_type: 'image/png', data: Utilities.base64Encode(img.getBytes()) } });
    } catch (e) {
      Logger.log('Thumbnail failed for slide ' + i + ': ' + e.message);
    }
    const it = inv[i];
    const ref = specs && specs[i] && specs[i].reference;
    lines.push('SLIDE ' + (i + offset) + ': icon_images=' + JSON.stringify(it.icons) + ' other_images=' + JSON.stringify(it.photos) +
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
  * Every text in a redraw_spec is copied EXACTLY as the slide shows it (same words, numbers and dates): never rewrite, shorten, translate or add text.
  * Never ask to redraw a content slide only because it is dense; redraw only covers, agendas, dividers, charts and closing slides.
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
function addFooterMark(slide, elements, pageW, pageH, S, ctx, at) {
  const id = (ctx.assets.design || {})['ds-mark-dark'];
  if (!id) return;
  let x = 22.3 * S, y = 376.8 * S, w = 24.3 * S, h = 16.2 * S;
  // V.1_60: in a rebrand the mark takes the place and height of the deck's old mark, so the footer text keeps its room
  if (at && at.h > 4) { h = Math.min(at.h, 18 * S); w = h * 1.5; x = at.x; y = at.y + (at.h - h) / 2; }
  try {
    const img = slide.insertImage(getBlobCached(id, ctx), x, y, w, h);
    img.setTitle('66 Mark');
    try { img.bringToFront(); } catch (e) {}
    return { x: x, y: y, w: w, h: h };
  } catch (e) { Logger.log('Footer mark failed: ' + e.message); }
  return null;
}
// The cover's product picture (the largest image on the right half, between the top and bottom bands), or null
function coverArt_(page, pageW, pageH) {
  let best = null;
  (page.pageElements || []).forEach(function (el) {
    if (!el.image) return;
    const b = elementBounds(el), a = b.w * b.h;
    if (b.x + b.w / 2 < pageW * 0.5 || b.y < pageH * 0.15 || b.y + b.h > pageH * 0.82 || a < pageW * pageH * 0.015) return;
    if (!best || a > best.a) best = { id: el.objectId, b: b, a: a };
  });
  return best;
}
// The kept picture goes back to the right of the cover's title (the template's title box ends at x 525 and its badge
// starts at y 318), at its own size up to 150 pt wide
function placeCoverArt_(slide, blob, art, pageW, pageH, S) {
  try {
    const w = Math.min(art.b.w, 150 * S), h = art.b.h * w / art.b.w;
    const x = Math.min(Math.max(art.b.x, 540 * S), pageW - w - 12 * S);
    const y = Math.min(Math.max(art.b.y, 92 * S), 310 * S - h);
    const img = slide.insertImage(blob, x, y, w, h);
    try { img.setTitle('Cover picture'); } catch (e) {}
  } catch (e) { Logger.log('Cover picture failed: ' + e.message); }
}
// The old mark most slides of the deck had (its first one), for slides that had none
function deckOldMark_(results) {
  let m = null;
  const list = Array.isArray(results) ? results : Object.keys(results || {}).sort(function (a, b) { return a - b; }).map(function (k) { return results[k]; });
  list.some(function (r) { if (r && r.oldMark) { m = r.oldMark; return true; } return false; });
  return m;
}



/* ---------------- V.1_59: rebrand that keeps the deck's content ---------------- */

// Sentence case for a heading of a rebranded deck: everyday words lowered, acronyms, product names and the names the
// deck itself writes with capitals kept; the word after a colon keeps its capital ("Phase 1: Data integration").
// Google and partner product names that keep their capitals inside a sentence-case heading
const REBRAND_PRODUCTS_ = ['Google Calendar', 'Google Drive', 'Google Docs', 'Google Sheets', 'Google Slides', 'Google Meet', 'Google Chat',
  'Google Workspace', 'Google Cloud', 'Google Cloud Console', 'Gmail', 'Gemini Enterprise', 'Gemini Assistant', 'Gemini', 'Vertex AI', 'BigQuery', 'Looker',
  'Access Transparency', 'Access Approval', 'Cloud Identity', 'Workforce Identity Federation', 'Model Armor', 'Sensitive Data Protection',
  'Cloud KMS', 'VPC Service Controls', 'Identity and Access Management', 'Agent Assist', 'Customer Engagement Suite', 'Cloud Run',
  'SharePoint', 'Salesforce', 'Jira', 'Slack', 'Microsoft Teams', 'ServiceNow', 'Workday', 'Okta'];
function keepProducts_(str) {
  let out = String(str || '');
  REBRAND_PRODUCTS_.forEach(function (n) { out = out.replace(new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), n); });
  return out;
}
function rebrandLine_(line) {
  const m = /^([^A-Za-z]*)([\s\S]*)$/.exec(line);                       // "• ", "1. ", "(a) " stay in front
  const pre = m[1], str = m[2];
  if (!str) return line;
  let out;
  if (!/[a-z]/.test(str)) out = fixAllCaps(str);                       // labels in capitals: their own rule
  else {
    const words = str.split(/\s+/).filter(Boolean);
    const caps = words.filter(function (w) { return /^[A-Z][a-z]/.test(w); }).length;
    const plain = words.filter(function (w) { return /^[A-Za-z][a-z]/.test(w); }).length;
    if (plain < 2 || caps < Math.max(2, plain * 0.5) || words.length > 14) return line;   // already sentence case
    out = str.split(/(:\s+)/).map(function (part, k) {
      if (/^:\s+$/.test(part)) return part;
      const sc = typeof sentenceCase_ === 'function' ? sentenceCase_(part, 2) : rebrandCase_(part);
      return k === 0 ? sc : sc.replace(/^./, function (c) { return c.toUpperCase(); });
    }).join('');
    if (typeof keepNames_ === 'function') out = keepNames_(out);
  }
  // the first word, and the first word after a colon or a " · " separator, start with a capital ("Stage 1: Prerequisites",
  // "Adoption lead · Monthly")
  out = keepProducts_(out).replace(/^([^A-Za-z]*)([a-z])/, function (x, a, c) { return a + c.toUpperCase(); })
    .replace(/(:\s+|\s[·|–—]\s+)([a-z])/g, function (x, a, c) { return a + c.toUpperCase(); });
  return pre + sameSpacing_(str, out);
}
// The casing of `cased` laid onto `orig` word by word, so spacing and length stay exactly as written
function sameSpacing_(orig, cased) {
  const words = cased.split(/\s+/).filter(Boolean);
  const parts = orig.split(/(\s+)/);
  if (parts.filter(function (p) { return p && !/^\s+$/.test(p); }).length !== words.length) return cased;
  let k = 0;
  return parts.map(function (p) { return !p || /^\s+$/.test(p) ? p : (words[k] && words[k].length === p.length ? words[k++] : (k++, p)); }).join('');
}
function rebrandSentence_(text) {
  return String(text || '').split(/(\n)/).map(function (l) { return l === '\n' ? l : rebrandLine_(l); }).join('');
}
// Case fixes for one shape, run by run (V.1_60: a fix across runs gave every run the first run's style - "TOTAL SCORE 12 /
// 15" lost its big 12): the heading is fixed as a whole and each run takes its own part of the result
function caseFixRequests_(el, pageId, isTitle) {
  const tes = ((el.shape && el.shape.text && el.shape.text.textElements) || []).filter(function (t) { return t.textRun && t.textRun.content; });
  const whole = tes.map(function (t) { return t.textRun.content; }).join('');
  if (!whole.trim() || whole.length > 200) return [];
  // line by line: label and heading lines take sentence case, lines that are sentences stay as written
  const headingLine = function (l) { return isTitle || (l.split(/\s+/).length <= 14 && !/[.!?]\s*$/.test(l.trim())); };
  const fixed = whole.split(/(\n)/).map(function (l) { return l === '\n' || !l.trim() || !headingLine(l) ? l : rebrandLine_(l); }).join('');
  if (fixed === whole || fixed.length !== whole.length) return [];
  const out = [];
  let at = 0;
  tes.forEach(function (t) {
    const c = t.textRun.content, nc = fixed.substr(at, c.length);
    at += c.length;
    const a = c.trim(), b = nc.trim();
    if (!a || a === b || a.length < 2) return;
    if (a.split(/\s+/).length < 2 && /^[A-Z][a-z]+$/.test(a) && !isTitle) return;   // one ordinary word: also inside sentences
    out.push({ replaceAllText: { containsText: { text: a, matchCase: true }, replaceText: b, pageObjectIds: [pageId] } });
  });
  return out;
}

// The date written on a slide (a cover's ">> September 2026"), as written; '' when it has none
const DATE_RE_ = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|(?:q[1-4]|h[12]|fy)\s*'?\d{2,4})\b/i;
function originalDate_(it) {
  const texts = (it && it.texts) || [];
  for (let k = 0; k < texts.length; k++) {
    const m = DATE_RE_.exec(texts[k].text);
    if (m) return m[0].trim();
  }
  return '';
}

// A slide redrawn in a rebrand shows the slide's own words: a text the reviewer retyped differently is put back to the
// slide's closest text (same words); dates and numbers are never changed
function keepOriginalWording_(spec, it) {
  const originals = ((it && it.texts) || []).map(function (t) { return t.text.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  if (!originals.length) return;
  const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9%$]+/g, ' ').trim(); };
  const all = norm(originals.join(' '));
  const toks = function (t) { const o = {}; norm(t).split(' ').forEach(function (w) { if (w.length > 1) o[w] = 1; }); return o; };
  const best = function (txt) {
    const a = toks(txt), ka = Object.keys(a);
    let top = null, score = 0;
    originals.forEach(function (o) {
      const b = toks(o), kb = Object.keys(b), inter = ka.filter(function (w) { return b[w]; }).length;
      const j = inter / Math.max(1, ka.length + kb.length - inter);
      if (j > score) { score = j; top = o; }
    });
    return score >= 0.5 ? top : null;
  };
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      if (k === 'type' || k === 'reference' || k === 'notes' || k === 'chart') return;
      const v = o[k];
      if (typeof v === 'string' && v.trim()) {
        if (k === 'title' && /^thank you!?$/i.test(v.trim())) return;
        const same = originals.filter(function (o) { return norm(o) === norm(v); })[0];
        if (same) { o[k] = same; return; }                             // the slide's own text, punctuation included
        if (all.indexOf(norm(v)) !== -1) return;                       // the slide's words, as they are
        const b = best(v);
        if (b) o[k] = b;
      } else if (v && typeof v === 'object') walk(v);
    });
  })(spec);
}

// A footer text of the deck that would sit under the 66 mark moves just right of it
function clearFooterText_(slide, mark, pageH) {
  const markL = mark.x, markR = mark.x + mark.w + 5;
  const hasText = function (el) {
    try {
      const t = String(el.getPageElementType());
      if (t === 'GROUP') return el.asGroup().getChildren().some(hasText);
      if (t !== 'SHAPE') return false;
      return !!el.asShape().getText().asString().trim();
    } catch (e) { return false; }
  };
  try {
    slide.getPageElements().forEach(function (el) {
      try {
        if (el.getTitle && el.getTitle() === '66 Mark') return;
        const left = el.getLeft(), top = el.getTop(), w = el.getWidth(), h = el.getHeight();
        if (top + h < mark.y || top > mark.y + mark.h || top < pageH * 0.8) return;   // not on the mark's line
        if (left >= markR || left + w <= markL || !hasText(el)) return;
        if (left + w - markR < 30) return;                                            // too narrow to move
        el.setLeft(markR); el.setWidth(Math.max(30, left + w - markR));
      } catch (e) { Logger.log('Footer text move failed: ' + e.message); }
    });
  } catch (e) {}
}

// After a rebrand: texts whose words run into each other, text that cannot be read on what is behind it, and shapes
// that sit outside the slide. Returns readable findings for the result message (not blocking).
function rebrandQa_(presId, start, end) {
  const pres = Slides.Presentations.get(presId, { fields: 'pageSize,masters(objectId,pageProperties(colorScheme)),slides(objectId,pageProperties(pageBackgroundFill),pageElements)' });
  readTheme_(pres);
  const pageW = pres.pageSize.width.magnitude / EMU, pageH = pres.pageSize.height.magnitude / EMU;
  const out = [];
  (pres.slides || []).forEach(function (page, i) {
    if (i < start || i >= end) return;
    indexAbsolute_(page.pageElements, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, false);
    const bgRgb = solidRgb((page.pageProperties || {}).pageBackgroundFill);
    const pageBg = bgRgb ? rgbObjToHex(bgRgb) : IPAY.white;
    const els = flatten(page.pageElements || [], []);
    const fills = [];
    const texts = [];
    els.forEach(function (el) {
      const b = elementBounds(el);
      if (el.shape) {
        const f = fillHex_((el.shape.shapeProperties || {}).shapeBackgroundFill);
        if (f && b.w * b.h < pageW * pageH * 0.9) fills.push({ b: b, hex: f });
        const txt = shapeText(el);
        if (txt) {
          let color = null, size = 10;
          (el.shape.text.textElements || []).some(function (te) {
            const st = te.textRun && te.textRun.style;
            if (!st || !te.textRun.content.trim()) return false;
            color = colorHex_(st.foregroundColor && st.foregroundColor.opaqueColor); size = (st.fontSize && st.fontSize.magnitude) || 10;
            return true;
          });
          const kit = typeof ENGINE !== 'undefined' && ENGINE.kit;
          const lines = kit ? kit.wrap(txt, Math.max(10, (b.w - 0.5) / 0.94), 'sans', 400, size).length : 1;   // same measure as the fit
          const h = Math.min(b.h + 400, lines * size * 1.25);
          const anchor = (el.shape.shapeProperties || {}).contentAlignment;
          const y = anchor === 'MIDDLE' ? b.y + (b.h - h) / 2 : anchor === 'BOTTOM' ? b.y + b.h - h : b.y;
          // V.1_60: a one-line text only covers its words (two boxes overlapping with room between their words is fine)
          let x = b.x, w = b.w;
          if (lines === 1 && kit && kit.textWidth) {
            const tw = Math.min(b.w, kit.textWidth(txt, 'sans', 500, size) * 1.04 + 7);
            const pm = (el.shape.text.textElements || []).filter(function (te) { return te.paragraphMarker; })[0];
            const al = pm && pm.paragraphMarker.style && pm.paragraphMarker.style.alignment;
            x = al === 'CENTER' ? b.x + (b.w - tw) / 2 : al === 'END' ? b.x + b.w - tw : b.x;
            w = tw;
          }
          texts.push({ text: txt, b: b, ink: { x: x, y: y, w: w, h: h }, color: color, fills: fills.slice() });
        }
      }
      if (b.w && (b.y > pageH - 2 || b.x > pageW - 2 || b.y + b.h < 2 || b.x + b.w < 2)) out.push('slide ' + (i + 1) + ': "' + (shapeText(el) || 'a shape').slice(0, 30) + '" is outside the slide');
    });
    texts.forEach(function (t) {
      if (!t.color) return;
      const cx = t.b.x + t.b.w / 2, cy = t.ink.y + t.ink.h / 2;
      let under = pageBg;
      for (let k = t.fills.length - 1; k >= 0; k--) { const o = t.fills[k].b; if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) { under = t.fills[k].hex; break; } }
      const l1 = luminance(t.color), l2 = luminance(under), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 2.2) out.push('slide ' + (i + 1) + ': "' + t.text.slice(0, 30) + '" cannot be read on its background');
    });
    for (let a = 0; a < texts.length; a++) for (let c = a + 1; c < texts.length; c++) {
      const p = texts[a].ink, q = texts[c].ink;
      const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (ox > 6 && oy > 3) out.push('slide ' + (i + 1) + ': "' + texts[a].text.slice(0, 24) + '" runs into "' + texts[c].text.slice(0, 24) + '"');
    }
  });
  return out;
}

/* ---------------- V.1_36: tables from the source, old-brand clean-up, sentence case ---------------- */

// Old 66degrees brand taglines / marks that never come back after a rebrand
const OLD_BRAND_TEXT_RE_ = /#\s*lets\s*get\s*you\s*there/i;

function largestTable_(page) {
  let best = null, area = 0;
  flatten((page && page.pageElements) || [], []).forEach(function (el) {
    if (!el.table) return;
    const b = elementBounds(el), a = b.w * b.h;
    if (!best || a > area) { best = el; area = a; }
  });
  return best;
}

// Every cell of a Slides API table as text; merged cells: the value sits in the first cell of the merge, the cells it
// covers stay '' (the engine shows a first-column group once across its rows)
function extractSourceTable_(el) {
  const t = el.table || {};
  const nr = t.rows || (t.tableRows || []).length, nc = t.columns || 0;
  const grid = [];
  for (let r = 0; r < nr; r++) { grid.push([]); for (let c = 0; c < nc; c++) grid[r].push(''); }
  (t.tableRows || []).forEach(function (row, r) {
    (row.tableCells || []).forEach(function (cell, k) {
      const loc = cell.location || {};
      const rr = loc.rowIndex != null ? loc.rowIndex : r, cc = loc.columnIndex != null ? loc.columnIndex : k;
      const txt = ((cell.text && cell.text.textElements) || []).map(function (te) { return te.textRun ? te.textRun.content : ''; })
        .join('').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (grid[rr] && cc < nc) grid[rr][cc] = txt;
    });
  });
  // drop fully empty rows / columns (spacers), keep everything else
  const rows = grid.filter(function (r) { return r.some(function (v) { return v; }); });
  const keepCol = [];
  for (let c = 0; c < nc; c++) keepCol.push(rows.some(function (r) { return r[c]; }));
  const trim = function (r) { return r.filter(function (v, c) { return keepCol[c]; }); };
  const header = rows.length ? trim(rows[0]) : [];
  return { columns: header, rows: rows.slice(1).map(trim) };
}

// A table spec split into slides that each fit; a group label carries onto the next slide
function splitTableSpec_(spec) {
  const rows = spec.rows || [];
  const out = [];
  let i = 0;
  while (i < rows.length || !out.length) {
    const rest = rows.slice(i);
    if (rest.length && !String(rest[0][0] || '').trim()) {
      for (let q = i - 1; q >= 0; q--) if (String(rows[q][0] || '').trim()) { rest[0] = [rows[q][0]].concat(rest[0].slice(1)); break; }
    }
    const part = Object.assign({}, spec, { rows: rest, title: out.length ? spec.title + ' (continued)' : spec.title });
    const fit = rest.length ? Math.max(1, Math.min(rest.length, ENGINE.tableRowsThatFit(part))) : 0;
    part.rows = rest.slice(0, fit);
    out.push(part);
    if (!fit) break;
    i += fit;
  }
  return out;
}

function stripOldBrandText_(o) {
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    Object.keys(v).forEach(function (k) {
      if (typeof v[k] === 'string' && OLD_BRAND_TEXT_RE_.test(v[k])) v[k] = v[k].replace(/#\s*lets\s*get\s*you\s*there/ig, '').replace(/\s{2,}/g, ' ').trim();
      else if (typeof v[k] === 'object') walk(v[k]);
    });
  })(o);
}

// Sentence case for rebranded titles and table headers WITHOUT touching names: only everyday words are lowered
// ("Rate Card (INR)" -> "Rate card (INR)", "Burns & McDonnell India" stays). Each line keeps its first capital.
const COMMON_WORDS_ = ('a an and or of for to in on at by with from the our your their its as is are be this that these those ' +
  'rate rates card cards proposed proposal hourly weekly monthly daily annual yearly experience role roles skill skills level levels ' +
  'cost costs price prices pricing total totals summary overview plan plans approach team teams project projects phase phases timeline ' +
  'scope deliverables next steps step key data cloud platform platforms engineering engineer engineers development developer developers ' +
  'application applications management manager services service solution solutions business strategy strategic results result impact ' +
  'benefits benefit challenges challenge objectives objective goals goal agenda introduction about contact questions thank you ' +
  'architecture security operations support model models process processes framework analysis report reports review status update ' +
  'updates value values growth customer customers client clients partner partners partnership people resources resource budget budgets ' +
  'estimate estimates rate-card schedule milestones milestone risks risk issues issue actions action owner owners table details detail ' +
  'description descriptions name names type types category categories item items option options recommendation recommendations ' +
  'current future state roadmap vision mission market markets product products feature features capability capabilities ' +
  'implementation migration modernization transformation adoption training testing quality assurance analyst analysts consultant ' +
  'consultants lead leads architect architects senior junior program programme delivery governance compliance performance metrics ' +
  'kpis outcomes outcome success factors factor work working new our why how what who when where').split(' ');
const COMMON_SET_ = {};
COMMON_WORDS_.forEach(function (w) { COMMON_SET_[w] = true; });
function rebrandCase_(text) {
  const str = String(text || '');
  if (str.length > 140) return str;
  return str.split(/(\n)/).map(function (line) {
    if (line === '\n') return line;
    let first = true, prevName = false;
    return line.split(/(\s+)/).map(function (w) {
      if (/^\s+$/.test(w) || !w) return w;
      const bare = w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
      if (!bare) return w;
      const isCap = /^[A-Z]/.test(bare), common = !!COMMON_SET_[bare.toLowerCase()];
      if (first) { first = false; prevName = isCap && !common; return w; }
      // a capitalised everyday word right after a name is part of the name ("Google Cloud", "Burns & McDonnell")
      if (/^[A-Z][a-z]+$/.test(bare) && common && !prevName) { prevName = false; return w.replace(bare, bare.toLowerCase()); }
      prevName = isCap && !common;
      return w;
    }).join('');
  }).join('');
}

// Slide masters and layouts carry the OLD brand (taglines, corner triangles, Work Sans, old colors) and show through on
// every slide. A deck that is not on the 2026 template loses every decoration on its masters / layouts (the rebrand
// draws the 66° marks on the slides itself); a deck already on the template only loses explicit old-brand pieces.
// Placeholders stay and get Plus Jakarta Sans in the brand ink color.
function cleanOldBrandLayouts_(presId, ctx, stats) {
  const p = Slides.Presentations.get(presId, { fields: 'masters(objectId,pageElements),layouts(objectId,pageElements)' });
  const pages = (p.masters || []).concat(p.layouts || []);
  const fontsOf = function (el) {
    const out = [];
    ((el.shape && el.shape.text && el.shape.text.textElements) || []).forEach(function (te) {
      const f = te.textRun && te.textRun.style && te.textRun.style.fontFamily;
      if (f) out.push(f);
    });
    return out;
  };
  // already the 2026 template? (brand font on the masters, or the brand blue)
  let onTemplate = false;
  pages.forEach(function (pg) {
    flatten(pg.pageElements || [], []).forEach(function (el) {
      if (fontsOf(el).some(function (f) { return /plus jakarta/i.test(f); })) onTemplate = true;
      const fill = el.shape && el.shape.shapeProperties && solidRgb(el.shape.shapeProperties.shapeBackgroundFill);
      if (fill && rgbObjToHex(fill) === '#0052FF') onTemplate = true;
    });
  });
  const reqs = [];
  let removed = 0;
  pages.forEach(function (pg) {
    (pg.pageElements || []).forEach(function (el) {
      const isPh = !!(el.shape && el.shape.placeholder);
      if (isPh) {
        if (shapeText(el)) {
          reqs.push({ updateTextStyle: { objectId: el.objectId, textRange: { type: 'ALL' },
            style: { fontFamily: 'Plus Jakarta Sans', foregroundColor: { opaqueColor: apiColor(IPAY.ink) } }, fields: 'fontFamily,foregroundColor' } });
        }
        return;
      }
      const txt = shapeText(el);
      const oldText = OLD_BRAND_TEXT_RE_.test(txt) || fontsOf(el).some(function (f) { return /work sans/i.test(f); });
      const triangle = !!(el.shape && /TRIANGLE/.test(el.shape.shapeType || ''));
      if (!onTemplate || oldText || triangle) { reqs.push({ deleteObject: { objectId: el.objectId } }); removed++; }
    });
  });
  if (reqs.length) runBatches(presId, reqs, stats);
  if (removed) ctx.log.push('Removed ' + removed + ' old-brand element(s) from the slide masters and layouts (taglines, corner marks, old fonts).');
}
