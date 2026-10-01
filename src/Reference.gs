/**
 * Reference layout library, department filtering, and scored selection.
 */

var Reference = (function () {
  function loadReferenceLibrary() {
    return [
      {
        id: 'ref_cover_hero',
        category: 'cover',
        visualType: 'cover',
        departments: ['general', 'sales', 'executive', 'solutions', 'delivery'],
        presentationTypes: ['Pitch', 'Proposal', 'Executive Brief', 'General'],
        purpose: 'opening',
        contentTypes: ['title', 'hero'],
        description: 'Full-bleed brand cover with title and subtitle'
      },
      {
        id: 'ref_section_band',
        category: 'section',
        visualType: 'section',
        departments: ['general', 'sales', 'executive', 'solutions', 'delivery'],
        presentationTypes: ['Pitch', 'Proposal', 'Workshop', 'Status Update', 'General'],
        purpose: 'transition',
        contentTypes: ['section'],
        description: 'Section divider with accent band'
      },
      {
        id: 'ref_agenda_list',
        category: 'agenda',
        visualType: 'list',
        departments: ['general', 'executive', 'delivery', 'solutions'],
        presentationTypes: ['Workshop', 'Status Update', 'Executive Brief', 'General'],
        purpose: 'agenda',
        contentTypes: ['list', 'agenda'],
        description: 'Numbered agenda list'
      },
      {
        id: 'ref_kpi_2x2',
        category: 'kpi',
        visualType: 'kpi-grid',
        departments: ['general', 'sales', 'executive', 'delivery'],
        presentationTypes: ['Status Update', 'Executive Brief', 'Pitch', 'Case Study'],
        purpose: 'metrics',
        contentTypes: ['kpi', 'metric'],
        description: '2x2 KPI metric grid'
      },
      {
        id: 'ref_cards_3',
        category: 'cards',
        visualType: 'card-grid',
        departments: ['general', 'sales', 'solutions', 'delivery'],
        presentationTypes: ['Pitch', 'Proposal', 'Case Study', 'Workshop', 'General'],
        purpose: 'concepts',
        contentTypes: ['card', 'bullets'],
        description: 'Three equal cards'
      },
      {
        id: 'ref_cards_4',
        category: 'cards',
        visualType: 'card-grid',
        departments: ['general', 'solutions', 'delivery'],
        presentationTypes: ['Proposal', 'Workshop', 'General'],
        purpose: 'capabilities',
        contentTypes: ['card'],
        description: 'Four capability cards'
      },
      {
        id: 'ref_process_h',
        category: 'process',
        visualType: 'process',
        departments: ['general', 'delivery', 'solutions', 'sales'],
        presentationTypes: ['Proposal', 'Workshop', 'Case Study', 'General'],
        purpose: 'process',
        contentTypes: ['process', 'steps'],
        description: 'Horizontal process steps'
      },
      {
        id: 'ref_flowchart_lr',
        category: 'flowchart',
        visualType: 'flowchart',
        departments: ['general', 'delivery', 'solutions'],
        presentationTypes: ['Proposal', 'Workshop', 'Case Study', 'General'],
        purpose: 'flow',
        contentTypes: ['flowchart', 'decision'],
        description: 'Left-to-right flowchart with connectors'
      },
      {
        id: 'ref_comparison_2',
        category: 'comparison',
        visualType: 'comparison',
        departments: ['general', 'sales', 'solutions', 'executive'],
        presentationTypes: ['Pitch', 'Proposal', 'Executive Brief', 'General'],
        purpose: 'compare',
        contentTypes: ['comparison'],
        description: 'Two-column comparison'
      },
      {
        id: 'ref_timeline_h',
        category: 'timeline',
        visualType: 'timeline',
        departments: ['general', 'delivery', 'executive', 'sales'],
        presentationTypes: ['Status Update', 'Proposal', 'Workshop', 'Case Study'],
        purpose: 'timeline',
        contentTypes: ['timeline'],
        description: 'Horizontal milestone timeline'
      },
      {
        id: 'ref_architecture',
        category: 'architecture',
        visualType: 'architecture',
        departments: ['solutions', 'delivery', 'general'],
        presentationTypes: ['Proposal', 'Workshop', 'Case Study', 'General'],
        purpose: 'architecture',
        contentTypes: ['architecture'],
        description: 'Layered architecture diagram'
      },
      {
        id: 'ref_table',
        category: 'table',
        visualType: 'table',
        departments: ['general', 'delivery', 'executive', 'sales'],
        presentationTypes: ['Status Update', 'Executive Brief', 'Proposal', 'General'],
        purpose: 'data',
        contentTypes: ['table'],
        description: 'Data table layout'
      },
      {
        id: 'ref_quote',
        category: 'quote',
        visualType: 'quote',
        departments: ['general', 'sales', 'executive'],
        presentationTypes: ['Case Study', 'Pitch', 'Executive Brief', 'General'],
        purpose: 'proof',
        contentTypes: ['quote'],
        description: 'Customer quote / insight'
      },
      {
        id: 'ref_content_bullets',
        category: 'content',
        visualType: 'bullets',
        departments: ['general', 'sales', 'delivery', 'solutions', 'executive'],
        presentationTypes: ['Pitch', 'Proposal', 'Status Update', 'Workshop', 'General'],
        purpose: 'content',
        contentTypes: ['text', 'bullets'],
        description: 'Title plus body bullets'
      },
      {
        id: 'ref_closing',
        category: 'closing',
        visualType: 'closing',
        departments: ['general', 'sales', 'executive', 'solutions', 'delivery'],
        presentationTypes: ['Pitch', 'Proposal', 'Executive Brief', 'Case Study', 'General'],
        purpose: 'close',
        contentTypes: ['cta', 'next-steps'],
        description: 'Closing / next steps'
      }
    ];
  }

  function getFilteredReferenceLibrary(department) {
    var lib = loadReferenceLibrary();
    var dept = String(department || 'General').toLowerCase();
    var filtered = lib.filter(function (item) {
      var deps = item.departments || [];
      return deps.indexOf(dept) !== -1 || deps.indexOf('general') !== -1;
    });

    if (filtered.length < 6) {
      return lib.filter(function (item) {
        return (item.departments || []).indexOf('general') !== -1;
      });
    }
    return filtered;
  }

  function scoreReference(ref, slide, context) {
    var score = 0;
    var dept = String(context.department || 'General').toLowerCase();
    var presentationType = context.presentationType || 'General';
    var usedLayoutIds = context.usedLayoutIds || {};
    var previousCategory = context.previousCategory || '';

    if (ref.category === slide.category) {
      score += 40;
    }
    if (ref.visualType === slide.visualType) {
      score += 25;
    }
    if ((ref.purpose || '') === (slide.purpose || '')) {
      score += 15;
    }
    if ((ref.departments || []).indexOf(dept) !== -1) {
      score += 20;
    } else if ((ref.departments || []).indexOf('general') !== -1) {
      score += 8;
    }
    if ((ref.presentationTypes || []).indexOf(presentationType) !== -1) {
      score += 12;
    }

    var contentTypes = ref.contentTypes || [];
    if (slide.diagram && contentTypes.indexOf('flowchart') !== -1) {
      score += 18;
    }
    if (slide.elements && slide.elements.length) {
      for (var i = 0; i < slide.elements.length; i++) {
        var t = slide.elements[i].type;
        if (contentTypes.indexOf(t) !== -1 || contentTypes.indexOf(t.toLowerCase()) !== -1) {
          score += 6;
        }
      }
    }

    if (usedLayoutIds[ref.id]) {
      score -= 50;
    }
    if (previousCategory && previousCategory === ref.category) {
      score -= 25;
    }

    return score;
  }

  function selectReferenceForSpec(spec, usedLayoutIds, department) {
    usedLayoutIds = usedLayoutIds || {};
    var library = getFilteredReferenceLibrary(department || spec.department);
    var assigned = [];
    var previousCategory = '';
    var localUsed = {};
    for (var key in usedLayoutIds) {
      if (usedLayoutIds.hasOwnProperty(key)) {
        localUsed[key] = usedLayoutIds[key];
      }
    }

    for (var i = 0; i < spec.slides.length; i++) {
      var slide = spec.slides[i];
      var scored = library.map(function (ref) {
        return {
          ref: ref,
          score: scoreReference(ref, slide, {
            department: department || spec.department,
            presentationType: spec.presentationType,
            usedLayoutIds: localUsed,
            previousCategory: previousCategory
          })
        };
      });

      scored.sort(function (a, b) {
        return b.score - a.score;
      });

      var topN = scored.slice(0, Math.min(3, scored.length));
      var pick = topN[Math.floor(Math.random() * topN.length)] || scored[0];
      var layoutId = pick.ref.id;

      slide.layoutId = layoutId;
      localUsed[layoutId] = true;
      previousCategory = pick.ref.category;
      assigned.push({
        slideId: slide.id,
        layoutId: layoutId,
        score: pick.score,
        category: pick.ref.category
      });
    }

    return {
      spec: spec,
      assignments: assigned
    };
  }

  return {
    loadReferenceLibrary: loadReferenceLibrary,
    getFilteredReferenceLibrary: getFilteredReferenceLibrary,
    selectReferenceForSpec: selectReferenceForSpec,
    scoreReference: scoreReference
  };
})();
