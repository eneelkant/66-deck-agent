/* =========================================================================================================
   66° Deck Agent — stock images in the photo strips (V.1_46)
   Designs with a photo strip, panel or band (right strip, left panel, top band) show a stock image from the brand
   folder in about 95 slides out of 100, and the 66° streak pattern in the rest. The image is chosen for the slide:
   its shape (tall images for strips, wide images for bands), its name / description against the slide's words, and
   images not used yet in the deck first. It is cropped to fill the strip exactly (no bands, no stretching), placed
   behind the content as a normal picture (select, replace, crop or delete), on a pale background.
   Folder: Script property STOCK_IMAGES_FOLDER_ID (Brand assets > Images > Stock Images by default, V.1_49);
   STOCK_IMAGES_FOLDER_ID = off switches stock images off. Images: JPEG or PNG; a short descriptive file name
   ("human-robot-hand-touching.jpg") or a Drive description helps the agent match them to slides.
   ========================================================================================================= */
// V.1_49: the "Stock Images" folder (it replaces "Stock Images Testing", 1hlpJeCwfLMNTfYjw97vJjj-Ug5se4rIL)
var STOCK_IMAGES_DEFAULT_FOLDER_ = '1DVsF7jnyWonnKW7z6GlUgDUvR8UA68_T';
var STOCK_IMAGES_OLD_TEST_FOLDER_ = '1hlpJeCwfLMNTfYjw97vJjj-Ug5se4rIL';
var STOCK_IMAGE_SHARE_ = 0.95;              // share of photo strips that get a stock image (the rest: the streak pattern)

function stockImagesFolderId_() {
  let id = STOCK_IMAGES_DEFAULT_FOLDER_;
  try { id = String(PropertiesService.getScriptProperties().getProperty('STOCK_IMAGES_FOLDER_ID') || id).trim(); } catch (e) {}
  if (id === STOCK_IMAGES_OLD_TEST_FOLDER_) id = STOCK_IMAGES_DEFAULT_FOLDER_;   // a property still pointing at the testing folder
  return /^(off|false|none|0)$/i.test(id) ? '' : id;
}

// The images in the folder (listed once per run): { id, name, desc, size }
function stockImagesList_(ctx) {
  if (ctx && ctx.stockImages) return ctx.stockImages;
  const list = [];
  const folderId = stockImagesFolderId_();
  if (folderId) {
    try {
      const it = DriveApp.getFolderById(folderId).getFiles();
      while (it.hasNext() && list.length < 200) {
        const f = it.next();
        if (!/^image\/(jpeg|jpg|png)$/i.test(String(f.getMimeType() || ''))) continue;
        list.push({ id: f.getId(), name: f.getName(), desc: String(f.getDescription() || ''), size: f.getSize() });
      }
    } catch (e) {
      if (ctx && ctx.log) ctx.log.push('Stock images folder not readable (' + e.message + '): the streak pattern is used.');
    }
  }
  if (ctx) { ctx.stockImages = list; ctx.stockUsed = ctx.stockUsed || {}; }   // (long decks keep stockUsed in the run state)
  return list;
}

// Width and height of a PNG or JPEG blob ([0, 0] when unknown)
function imageSize_(blob) {
  try {
    const b = blob.getBytes();
    const u = function (i) { return b[i] & 0xff; };
    if (u(0) === 0x89 && u(1) === 0x50) return [(u(16) << 24 | u(17) << 16 | u(18) << 8 | u(19)) >>> 0, (u(20) << 24 | u(21) << 16 | u(22) << 8 | u(23)) >>> 0];
    if (u(0) === 0xff && u(1) === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (u(i) !== 0xff) { i++; continue; }
        const m = u(i + 1);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [u(i + 7) << 8 | u(i + 8), u(i + 5) << 8 | u(i + 6)];
        i += 2 + (u(i + 2) << 8 | u(i + 3));
      }
    }
  } catch (e) {}
  return [0, 0];
}

// A resized copy of a Drive image (the originals can be 15+ MB / 30+ megapixels, more than Slides accepts)
function stockImageFetch_(img, size) {
  try {
    const r = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + encodeURIComponent(img.id) + '&sz=' + size, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() === 200) {
      const blob = r.getBlob();
      if (/^image\/(jpeg|jpg|png)/i.test(String(blob.getContentType() || '')) && blob.getBytes().length > 2000) return blob;
    }
  } catch (e) {}
  return null;
}
function stockImageDims_(img) {
  if (img.w && img.h) return [img.w, img.h];
  const key = 'STOCK_DIM_' + img.id;
  let cache = null;
  try { cache = CacheService.getScriptCache(); const hit = cache.get(key); if (hit) { const d = hit.split('x').map(Number); img.w = d[0]; img.h = d[1]; return d; } } catch (e) {}
  const blob = stockImageFetch_(img, 'w400');
  const d = blob ? imageSize_(blob) : [0, 0];
  if (d[0] && d[1]) { img.w = d[0]; img.h = d[1]; try { if (cache) cache.put(key, d[0] + 'x' + d[1], 21600); } catch (e) {} }
  return d;
}
function stockImageBlob_(img, portrait) {
  const blob = stockImageFetch_(img, portrait ? 'h1600' : 'w1600');
  if (blob) return blob;
  try { if (img.size && img.size < 8 * 1024 * 1024) return DriveApp.getFileById(img.id).getBlob(); } catch (e) {}
  return null;
}

function stockWords_(str) {
  // (V.1_49: "AdobeStock_124720034.jpeg" names say nothing: the Drive description carries the words)
  const STOP = /^(the|and|for|with|from|into|your|our|their|this|that|jpg|jpeg|png|img|image|photo|stock|shutterstock|istock|adobe|adobestock|getty|concept|background|job|by|of|in|on|to|a|an|is|are)$/;
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(function (w) { return w.length > 2 && !STOP.test(w) && !/^\d+$/.test(w); })
    .map(function (w) { return w.slice(0, 6); });
}

// The stock image blob for a slide's photo region, or null (pattern this time, no folder, nothing usable)
// region = [x0, y0, x1, y1] in slide points
function pickStockImage_(region, spec, ctx) {
  if (!ctx) return null;
  const what = '"' + String((spec && spec.title) || '').slice(0, 40) + '"';
  if (Math.random() >= STOCK_IMAGE_SHARE_) { if (ctx.log) ctx.log.push('Photo strip on ' + what + ': the streak pattern (about 1 slide in 20 keeps it).'); return null; }
  const list = stockImagesList_(ctx);
  if (!list.length) { if (ctx.log) ctx.log.push('Photo strip on ' + what + ': no stock images found in the folder, the streak pattern is used.'); return null; }
  const used = ctx.stockUsed || (ctx.stockUsed = {});
  const words = {};
  stockWords_([spec.title, spec.lead, spec.statement, ctx.userPrompt].join(' ')).forEach(function (w) { words[w] = true; });
  const ra = (region[2] - region[0]) / Math.max(1, region[3] - region[1]);
  // first by words and freshness, then the best few are checked for their shape
  const ranked = list.map(function (img) {
    const own = stockWords_(img.name + ' ' + img.desc);
    const hits = own.filter(function (w) { return words[w]; }).length;
    return { img: img, pre: hits * 10 - (used[img.id] || 0) * 40 + Math.random() * 6 };
  }).sort(function (a, b) { return b.pre - a.pre; }).slice(0, 12);
  let best = null;
  ranked.forEach(function (c) {
    const d = stockImageDims_(c.img);
    const ia = d[0] && d[1] ? d[0] / d[1] : 1.5;
    const shape = -Math.abs(Math.log(ia / ra)) * 12;            // a tall image for a tall strip, a wide one for a band
    // V.1_48: a narrow strip shows a slice of the picture: photos of people become unreadable there (deck 21 slide 4),
    // abstract / technology pictures read well at any width
    const narrow = (region[2] - region[0]) < 130 && (region[3] - region[1]) > (region[2] - region[0]);   // a thin upright strip
    const person = /\b(person|people|man|woman|men|women|businessman|businesswoman|portrait|human|hand|hands|face|team|worker|employee|robot)\b/i.test(c.img.name + ' ' + c.img.desc);
    const score = c.pre + shape + (narrow && person ? -25 : 0);
    if (!best || score > best.score) best = { img: c.img, score: score, portrait: ia < 1 };
  });
  if (!best) return null;
  const blob = stockImageBlob_(best.img, best.portrait);
  if (!blob) { if (ctx.log) ctx.log.push('Stock image "' + best.img.name + '" could not be loaded: the streak pattern is used.'); return null; }
  used[best.img.id] = (used[best.img.id] || 0) + 1;
  return blob;
}
