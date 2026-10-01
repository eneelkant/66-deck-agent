/**
 * Brand enforcement and lightweight presentation QA.
 */

var Qa = (function () {
  function enforceBrandOnSpec(spec) {
    if (!spec || !spec.slides) {
      return { ok: false, error: 'QA requires a validated PresentationSpec.' };
    }

    var issues = [];
    for (var i = 0; i < spec.slides.length; i++) {
      var slide = spec.slides[i];
      if (!slide.title || !String(slide.title).trim()) {
        slide.title = 'Slide ' + (i + 1);
        issues.push('Filled missing title on slide ' + (i + 1));
      }
      if (String(slide.title).length > 80) {
        slide.title = String(slide.title).slice(0, 77) + '...';
        issues.push('Truncated long title on slide ' + (i + 1));
      }
      if (slide.brandOverrides && slide.brandOverrides.color) {
        slide.brandOverrides.color = Brand.snapToPalette(slide.brandOverrides.color);
      }
      // Normalize empty element bodies to avoid render holes.
      slide.elements = (slide.elements || []).map(function (el) {
        if (!el.body && el.items && el.items.length) {
          el.body = el.items.join('\n');
        }
        return el;
      });
    }

    // Encourage visual diversity markers for QA report.
    var categories = {};
    for (var c = 0; c < spec.slides.length; c++) {
      categories[spec.slides[c].category] = true;
    }
    var diversity = Object.keys(categories).length;
    if (diversity < Math.min(3, spec.slides.length)) {
      issues.push('Low visual diversity detected (' + diversity + ' categories).');
    }

    return {
      ok: true,
      spec: spec,
      issues: issues,
      diversityScore: diversity
    };
  }

  function validateRenderResult(result) {
    if (!result || !result.presentationId || !result.url) {
      return { ok: false, error: 'Render result missing presentationId/url.' };
    }
    if (!result.slideCount || result.slideCount < 1) {
      return { ok: false, error: 'Render produced no slides.' };
    }
    return { ok: true, result: result };
  }

  return {
    enforceBrandOnSpec: enforceBrandOnSpec,
    validateRenderResult: validateRenderResult
  };
})();
