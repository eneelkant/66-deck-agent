/**
 * Rebrand mode — normalize an existing Google Slides deck to 66degrees brand.
 */

var Rebrand = (function () {
  function extractPresentationId(urlOrId) {
    if (!urlOrId) {
      return '';
    }
    var text = String(urlOrId);
    var match = text.match(/presentation\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      return match[1];
    }
    if (/^[a-zA-Z0-9-_]+$/.test(text)) {
      return text;
    }
    return '';
  }

  function rebrandPresentation(sourceUrl) {
    var id = extractPresentationId(sourceUrl);
    if (!id) {
      throw Engine.stageError(
        'rebrand',
        'Provide a valid Google Slides URL or presentation id.'
      );
    }

    var source;
    try {
      source = SlidesApp.openById(id);
    } catch (e) {
      throw Engine.stageError('rebrand', 'Unable to open source presentation: ' + e.message);
    }

    var title = '66degrees Rebrand · ' + source.getName();
    var target = SlidesApp.create(title);
    var targetSlides = target.getSlides();
    for (var r = targetSlides.length - 1; r > 0; r--) {
      targetSlides[r].remove();
    }
    var first = target.getSlides()[0];
    first.getPageElements().forEach(function (el) {
      el.remove();
    });

    var sourceSlides = source.getSlides();
    for (var i = 0; i < sourceSlides.length; i++) {
      var slide = i === 0 ? first : target.appendSlide(SlidesApp.PredefinedLayout.BLANK);
      slide.getPageElements().forEach(function (el) {
        el.remove();
      });

      // Structural rebrand: recreate as branded content slides from extracted text.
      var texts = [];
      var elements = sourceSlides[i].getPageElements();
      for (var e = 0; e < elements.length; e++) {
        try {
          if (elements[e].getPageElementType() === SlidesApp.PageElementType.SHAPE) {
            var t = elements[e].asShape().getText().asString();
            if (t && t.trim()) {
              texts.push(t.trim());
            }
          }
        } catch (ignore) {}
      }

      var slideSpec = {
        id: 'rebrand_' + (i + 1),
        category: i === 0 ? 'cover' : i === sourceSlides.length - 1 ? 'closing' : 'content',
        purpose: 'rebrand',
        title: texts[0] || 'Slide ' + (i + 1),
        subtitle: texts[1] || '',
        body: texts.slice(i === 0 ? 2 : 1).join('\n'),
        visualType: 'content',
        elements: texts.slice(1, 6).map(function (line, idx) {
          return { type: 'text', title: 'Point ' + (idx + 1), body: line };
        }),
        layoutId: i === 0 ? 'ref_cover_hero' : i === sourceSlides.length - 1 ? 'ref_closing' : 'ref_content_bullets'
      };

      EngineRenderer.renderSlide(slide, slideSpec, { title: title });
    }

    return {
      presentationId: target.getId(),
      url: target.getUrl(),
      slideCount: sourceSlides.length,
      mode: 'Rebrand'
    };
  }

  return {
    extractPresentationId: extractPresentationId,
    rebrandPresentation: rebrandPresentation
  };
})();
