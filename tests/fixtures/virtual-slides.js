"use strict";
// V.1_59: a small stand-in for the Slides API: Presentations.get returns the deck, batchUpdate applies the requests the
// brand pass sends (text styles, fills, deletions, moves, text replacements), SlidesApp edits go to the same deck.
const EMU = 12700;
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function virtualSlides(deck) {
  const state = clone(deck);
  const log = { requests: [], images: [], moved: [] };
  const all = () => { const out = []; const walk = (els, page) => (els || []).forEach((e) => { out.push({ e, page, list: els }); if (e.elementGroup) walk(e.elementGroup.children, page); }); state.slides.forEach((p) => walk(p.pageElements, p)); return out; };
  const find = (id) => all().find((x) => x.e.objectId === id);
  const runs = (el) => ((el.shape && el.shape.text && el.shape.text.textElements) || []).filter((t) => t.textRun);
  const textOf = (el) => runs(el).map((t) => t.textRun.content).join("").trim();
  function apply(r) {
    log.requests.push(r);
    if (r.deleteObject) { const f = find(r.deleteObject.objectId); if (f) f.list.splice(f.list.indexOf(f.e), 1); return; }
    if (r.updateTextStyle) {
      const f = find(r.updateTextStyle.objectId); if (!f || r.updateTextStyle.cellLocation) return;
      const u = r.updateTextStyle, rg = u.textRange || {};
      runs(f.e).forEach((t) => {
        if (rg.type === "FIXED_RANGE" && (t.endIndex <= rg.startIndex || t.startIndex >= rg.endIndex)) return;
        const st = t.textRun.style = t.textRun.style || {};
        u.fields.split(",").forEach((k) => { st[k] = clone(u.style[k]); if (k === "weightedFontFamily") st.fontFamily = u.style[k].fontFamily; });
      });
      return;
    }
    if (r.updateShapeProperties) {
      const f = find(r.updateShapeProperties.objectId); if (!f || !f.e.shape) return;
      const sp = f.e.shape.shapeProperties = f.e.shape.shapeProperties || {};
      const p = r.updateShapeProperties.shapeProperties;
      if (p.shapeBackgroundFill) sp.shapeBackgroundFill = clone(p.shapeBackgroundFill);
      if (p.outline) sp.outline = Object.assign(sp.outline || {}, clone(p.outline));
      return;
    }
    if (r.updatePageProperties) { const p = state.slides.find((s) => s.objectId === r.updatePageProperties.objectId); if (p) p.pageProperties = clone(r.updatePageProperties.pageProperties); return; }
    if (r.updatePageElementTransform) { const f = find(r.updatePageElementTransform.objectId); if (f) { f.e.transform = clone(r.updatePageElementTransform.transform); log.moved.push(f.e.objectId); } return; }
    if (r.replaceAllText) {
      const want = r.replaceAllText.containsText.text, rep = r.replaceAllText.replaceText;
      all().forEach(({ e, page }) => {
        if (r.replaceAllText.pageObjectIds && r.replaceAllText.pageObjectIds.indexOf(page.objectId) === -1) return;
        runs(e).forEach((t) => { if (t.textRun.content.indexOf(want) !== -1) t.textRun.content = t.textRun.content.split(want).join(rep); });
      });
      return;
    }
    if (r.createShape) {
      const p = state.slides.find((s) => s.objectId === r.createShape.elementProperties.pageObjectId);
      if (p) p.pageElements.push({ objectId: r.createShape.objectId, size: r.createShape.elementProperties.size, transform: r.createShape.elementProperties.transform, shape: { shapeType: "RECTANGLE", shapeProperties: {} } });
    }
  }
  const pageMock = (p) => ({
    getObjectId: () => p.objectId,
    insertImage(blob, x, y, w, h) { const e = { objectId: "img" + log.images.length, image: {}, size: { width: { magnitude: w * EMU }, height: { magnitude: h * EMU } }, transform: { scaleX: 1, scaleY: 1, translateX: x * EMU, translateY: y * EMU } }; p.pageElements.push(e); log.images.push({ page: p.objectId, x, y, w, h }); return { setTitle(t) { e.title = t; }, bringToFront() {} }; },
    getPageElementById(id) {
      const f = find(id); if (!f) return null;
      return { setLeft(x) { f.e.transform.translateX = x * EMU; log.moved.push(id); }, getParentGroup: () => null, getLeft: () => (f.e.transform.translateX || 0) / EMU };
    },
    getPageElements: () => p.pageElements.map((e) => {
      const tr = () => e.transform || (e.transform = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 });
      const kids = (g) => (g.elementGroup ? g.elementGroup.children : []);
      const wrap = (x) => ({
        getPageElementType: () => (x.elementGroup ? "GROUP" : x.image ? "IMAGE" : x.shape ? "SHAPE" : "OTHER"),
        asShape: () => ({ getText: () => ({ asString: () => textOf(x) || "" }) }),
        asGroup: () => ({ getChildren: () => kids(x).map(wrap) })
      });
      const w = wrap(e);
      w.getTitle = () => e.title || "";
      w.getLeft = () => (tr().translateX || 0) / EMU;
      w.getTop = () => (tr().translateY || 0) / EMU;
      w.getWidth = () => ((e.size ? e.size.width.magnitude : 0) * (tr().scaleX || 1)) / EMU;
      w.getHeight = () => ((e.size ? e.size.height.magnitude : 0) * (tr().scaleY || 1)) / EMU;
      w.setLeft = (x) => { tr().translateX = x * EMU; log.moved.push(e.objectId); };
      w.setWidth = (v) => { if (e.size) tr().scaleX = (v * EMU) / e.size.width.magnitude; };
      return w;
    }),
    getBackground: () => ({ setSolidFill() {} }), getLayout: () => null
  });
  const api = {
    Slides: {
      Presentations: {
        get: () => clone(state),
        batchUpdate: (body) => { (body.requests || []).forEach(apply); return {}; },
        Pages: { getThumbnail: () => { throw new Error("no thumbnails offline"); } }
      }
    },
    SlidesApp: { openById: () => ({ getSlides: () => state.slides.map(pageMock), insertSlide() { throw new Error("no"); } }), PredefinedLayout: { BLANK: "BLANK" } }
  };
  return { state, log, api, textOf, all };
}
module.exports = { virtualSlides };
