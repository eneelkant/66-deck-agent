/**
 * 66° Deck Agent — Solution Deck kit (V.1_52)
 *
 * A Solution Deck explains what 66degrees built or offers and proves that it works. It is built ONLY from Solution
 * designs (SolutionDesigns_*.gs) — never from the Proposal Deck's designs, and the Proposal Deck never uses them; the
 * only frames both share are the strict cover, the two 66degrees section dividers and the strict Thank you.
 *
 * The content follows the voice of the 66degrees solution decks (the Solution Deck Content Tone Guide): Gemini first
 * picks one of five tones from the request and the attached files, plans the storyline in that tone, and writes every
 * part with the tone's card (voice rules, do and don't, real lines from the decks as examples of the voice — never as
 * facts). The tone also orders the designs Gemini is offered.
 */

var SOLUTION_TYPE_ = 'Solution Deck';
function isSolutionDeck_(ctx) { return !!ctx && ctx.presentationType === SOLUTION_TYPE_; }

/* ---------- 1. The five tones of the 66degrees solution decks ---------- */
var SOLUTION_TONES_ = {
  technical: {
    label: 'Technical',
    purpose: 'For architects and engineers: how it is built, configured, run and proved.',
    signals: /\b(architecture|architect|runbook|run book|playbook|migration|migrate|failover|topology|configur\w*|settings?|deploy\w*|terraform|ansible|kubernetes|gke|latency|throughput|apis?|schema|pipelines?|cluster|network\w*|sql|database|infrastructure|technical|engineering|integration|iam|vpc|how it works|high availability|disaster recovery|dr\b|ha\b|mlops|devops|observability)\b/gi,
    voice: [
      'Exact names, versions, settings, ports, regions, sizes and test IDs (only from the request and the sources).',
      'Short labelled phrases: "Health check: TCP port 59998, check-interval 2 s".',
      'Compare options with ✓ and ✗, and say which one is recommended and why.',
      'Steps in the order they are run, with what each step proves.',
      'No sales words: no "seamless", "robust", "world-class"; let the specifics carry the point.'
    ],
    examples: [
      'Health check: TCP port 59998, check-interval 2 s, unhealthy threshold 2',
      'Metadata portability: logins, Agent jobs and permissions travel with the database',
      'Failover across the distributed AG is always manual (FORCE_FAILOVER_ALLOW_DATA_LOSS)',
      'Zero public IPs on all VMs; all RDP administration through IAP tunnels',
      'Layer 1 · Terraform · 5–10 min: VPC, 4 subnets, internal load balancers',
      '✗ Logins live in instance master only — ✓ contained master and msdb replicate in the AG',
      'Set 1–5 ms for a p99 improvement on sub-millisecond inter-zone links'
    ]
  },
  executive: {
    label: 'Executive',
    purpose: 'For leaders and sponsors: the business result, what it is worth and the decision needed.',
    signals: /\b(executive|leadership|board|cfo|ceo|cio|cto|sponsors?|business case|roi|value|savings?|revenue|margin|cost reduction|success criteria|steering|investment|strategic|strategy|outcomes?|impact|opportunity|decision)\b/gi,
    voice: [
      'Open with one context line ("Objective: ...", "Context: ...") and lead with the business result.',
      'Big figures with what they mean, grouped by stage (quick win, targeted, strategic) — figures only from the sources; otherwise targets.',
      'Short sentences; one idea per slide; no technical detail the decision does not need.',
      'Close with one recommended next step or a direct question for the leaders.'
    ],
    examples: [
      'Objective: align on engagement success criteria and the future state',
      'Substitution: a system-wide efficiency opportunity, starting with low-risk items',
      'Tier 1 · Quick win: an immediate, low-friction pilot opportunity',
      'Recommended next step: approve the pilot of the automated deactivation logic',
      'Reality: the problems are quantified; the foundation for end-to-end solutions is in place',
      'Executive feedback: are these the most critical short-term priorities?'
    ]
  },
  offering: {
    label: 'Offering',
    purpose: 'For buyers of a service or package: what it is, who it is for, what is included and how to start.',
    signals: /\b(services?|offerings?|packages?|tiers?|sla|slos?|support|managed services|pricing|price|subscription|portfolio|catalog|engagement models?|accelerators?|jumpstart|what we offer|operating model)\b/gi,
    voice: [
      'Each offer as fixed labels: what it is, best for, outcome, inclusions, out of scope, timing, cost, funding.',
      'Service names and tiers stay exactly the same on every slide (the named parts of the offer).',
      'Commitments as numbers with their unit ("P1: 15 minutes") — only the ones the request or sources give.',
      'Show how to start: onboarding steps, the first 30 days, the next step.'
    ],
    examples: [
      'What it is: a run-focused, priority-based support service for existing estates',
      'Best for: teams that need reliable day-to-day operations without large new builds',
      'Outcome: faster incident response, safer deployments and predictable operations',
      'P1: 15 minutes · P2: 1 hour · P3: 4 business hours',
      'Advisory · Surveil · Unfold: trusted intelligence, incident resolution, agile delivery',
      'Onboarding (first 30 days): access, baseline, tooling, a stabilise-and-improve backlog'
    ]
  },
  enablement: {
    label: 'Enablement',
    purpose: 'For people who will learn and adopt: levels, formats, audiences and what each step achieves.',
    signals: /\b(training|enablement|workshops?|adoption|change management|fluency|curriculum|learning|onboarding|upskill\w*|bootcamp|courses?|webinars?|champions?|literacy|academy|l100|l200|l300)\b/gi,
    voice: [
      'Levels or stages in order, each with format, audience, duration, focus and goal.',
      'Plain, encouraging words; say what people will be able to do afterwards.',
      'Numbers for reach and length (participants, hours, sessions) — from the request or the sources.',
      'Name the roles that carry adoption (champions, team leads) and what they do.'
    ],
    examples: [
      'L100 · Beginner foundations: a 1-hour webinar for a large audience',
      'Format: 2-hour workshop (virtual or in person) with a discovery prerequisite',
      'Goal: establish foundational knowledge and everyday usage',
      'Capacity: 30–40 participants per workshop',
      'Change champions: share best practices and raise training needs'
    ]
  },
  internal: {
    label: 'Internal strategy',
    purpose: 'For the 66degrees team and partners: the situation, the gaps, what they cost, owners and the ask.',
    signals: /\b(internal|team update|pipeline review|sales team|wins|our wins|asks|h1|h2|quarterly review|qbr|blockers?|our pipeline|win\/loss|lessons learned|retrospective|partner review|go-to-market|gtm|our asks?|account plan|growth story|showcase|renewals?)\b/gi,
    voice: [
      'Candid and direct: the gap, what it costs, who owns it, what we ask for.',
      'Each item specific, owned and executable; no client pitch, no marketing words.',
      'Figures as they are (pipeline, renewals, cycle times) — only from the request or the sources.',
      'End with the commitments or decisions needed, owner by owner.'
    ],
    examples: [
      'Each of these is specific, owned and executable.',
      'Blocker: 60+ day voucher approvals · What it is costing: deals stalling at the worst point',
      'We are not asking for a plan — we are asking for commitment on four fronts.',
      'Platform readiness: the agent platform is not yet ready for a live, customer-facing deployment',
      'Owner: engineering and product'
    ]
  }
};
var SOLUTION_TONE_ORDER_ = ['technical', 'executive', 'offering', 'enablement', 'internal'];

// What every Solution Deck has in common (the Solution voice)
var SOLUTION_VOICE_ = [
  'Phrases, not prose: most text is a short phrase with a label in front of it ("Best for: ...", "Trigger: ... · Action: ...").',
  'Named specifics: real product names, versions, settings, regions, time boxes and SLAs — only from the request and the sources.',
  'Proof next to the claim: results carry their evidence (test count, date, client, source).',
  'Named parts: the solution is split into a few named parts (services, tiers, levels, steps) that keep the same names on every slide.',
  'Problem → solution → result, on a slide and across the deck.',
  '"We" is 66degrees; the client is named; "you" only for offers and onboarding.',
  'A clear ask at the end: the recommended next step or one direct question.'
];

// The tone of a deck: "tone: technical" (or "technical tone") in the request wins; otherwise the tone whose words the
// request uses most (the request counts three times as much as the attached text); "executive" when nothing points
function solutionTone_(userPrompt, sources) {
  const req = String(userPrompt || ''), src = String((sources && sources.text) || '').slice(0, 6000);
  const asked = req.match(/\b(technical|executive|offering|service|enablement|training|internal)\s+(tone|deck|voice)\b|\btone\s*[:=]\s*(technical|executive|offering|enablement|internal)\b/i);
  if (asked) {
    const w = String(asked[1] || asked[3]).toLowerCase();
    return w === 'service' ? 'offering' : w === 'training' ? 'enablement' : w;
  }
  let best = 'executive', bestScore = 0;
  SOLUTION_TONE_ORDER_.forEach(function (k) {
    const re = SOLUTION_TONES_[k].signals;
    const count = function (t) { re.lastIndex = 0; const m = t.match(re); return m ? m.length : 0; };
    const score = 3 * count(req) + count(src);
    if (score > bestScore) { best = k; bestScore = score; }
  });
  return best;
}
function solutionToneLabel_(tone) { return (SOLUTION_TONES_[tone] || SOLUTION_TONES_.executive).label; }

// The tone card every Solution Deck prompt gets
function solutionToneCard_(tone) {
  const t = SOLUTION_TONES_[tone] || SOLUTION_TONES_.executive;
  return [
    'TONE OF THE CONTENT: ' + t.label + '. ' + t.purpose,
    'THE SOLUTION VOICE (every slide):', SOLUTION_VOICE_.map(function (l) { return '- ' + l; }).join('\n'),
    'IN THIS TONE:', t.voice.map(function (l) { return '- ' + l; }).join('\n'),
    'EXAMPLES OF THE VOICE (lines from 66degrees solution decks: copy the style, never the facts, figures or names):',
    t.examples.map(function (l) { return '- "' + l + '"'; }).join('\n'),
    'NEVER: emoji, hashtags, exclamation marks, ALL CAPS labels, Title Case titles, hype words, invented products, clients, prices or results.'
  ].join('\n');
}

/* ---------- 2. The storyline of a Solution Deck (outline) ---------- */
function solutionOutlineRules_(ctx) {
  const tone = (ctx && ctx.solutionTone) || 'executive';
  const arc = {
    technical: '(1) the problem with today\'s way, (2) what we built and how it works (architecture, components, flow), (3) what we proved (tests, results) and the decisions, (4) how to deploy and run it, and the next step',
    executive: '(1) the situation and why it matters now, (2) the solution and what it changes, (3) the value (by stage) and the proof, (4) how we get there and the decision needed',
    offering: '(1) why organizations need it, (2) what we deliver (the named services or tiers, what is included), (3) how we deliver it (operating model, commitments) and the proof, (4) how to start',
    enablement: '(1) the adoption goal and the gap, (2) the levels or stages and their formats, (3) the plan (cohorts, champions, timeline), (4) how success is measured and the next step',
    internal: '(1) where we stand (results, pipeline), (2) what works and the gaps, (3) what each gap costs and the plan, (4) the asks and owners'
  }[tone] || '';
  return [
    'THINK LIKE THE SOLUTION ARCHITECT WHO WILL PRESENT THIS SOLUTION DECK. First decide the argument, then the slides.',
    solutionToneCard_(tone),
    '- The sections tell ONE story: ' + arc + ' (with fewer sections, neighbouring parts share a section, in this order).',
    '- Each section has a "storyline": one sentence saying what the section proves.',
    '- Each slide has a "message": the ONE thing it proves (max 110 characters), and "points": 2-4 short phrases (3-8 words) that ONLY this slide',
    '  covers. A point (a capability, a figure, a step, a product explanation) never appears on two slides.',
    '- The named parts of the solution (services, tiers, levels, layers, steps) keep the same names on every slide.',
    '- The Google Cloud products are explained where they are used (the architecture, how it works), never one slide per product.',
    '- The last body slide gives the recommended next step or the ask.',
    '- No 66degrees credentials or "why 66degrees" slide unless the request asks for it; a client result only from the request or the sources.',
    '- No filler: no "future of", "in summary", "key takeaways" slides.'
  ].join('\n');
}

/* ---------- 3. What each Solution design is for (shown to Gemini with the design) ---------- */
var SOLUTION_DESIGN_GUIDE_ = {
  S66_HEADER_COLUMNS: 'use for: 2-4 parallel things with a few points each (service lines, workstreams, current state vs plan). never for: steps in an order',
  S66_CARDS_PHOTO_STRIP: 'use for: 2-4 capabilities, service areas or problem / solution / result, each with a short text',
  S66_THREE_CARD_COLUMNS: 'use for: exactly three pillars or areas with bullets, and one line that ties them together',
  S66_ICON_CARD_GRID: 'use for: 4 or 6 decisions, benefits or capabilities, each one or two sentences',
  S66_QUAD_RULE_CARDS: 'use for: exactly four areas, rules or recommendations (an owner chip when each has an owner)',
  S66_NUMBERED_CARD_GRID: 'use for: 4-6 characteristics, findings or things proved (numbered, no order implied)',
  S66_TINT_PANELS: 'use for: a context line, 2-3 decisions or facts, and what follows from them',
  S66_OFFER_TIERS: 'use for: 3-5 packaged offers or tiers with timing, price (only from the request) and funding',
  S66_CROSS_CHECK: 'use for: the old way vs the new way, point by point (crosses and ticks)',
  S66_TEXT_SECTIONS: 'use for: background, history or components as 2-5 short headed sections',
  S66_BULLETS_PHOTO_HALF: 'use for: why it matters or the need, as 3-6 bullets (one per slide in a series of why / how slides)',
  S66_OFFER_DETAIL: 'use for: ONE offer or tier in detail (what it is, best for, outcome, activities)',
  S66_WHY_WHAT_HOW: 'use for: why / what / how, or 2-4 service lines read left to right',
  S66_STEP_LOOP_FLOW: 'use for: an operating model of three steps that feeds back (advise, run, improve)',
  S66_STEP_COLUMNS: 'use for: 4-6 steps of a run book, cut-over or transition, each with who or where',
  S66_LABEL_ROWS: 'use for: 3-4 layers or phases, each with its timing and activities',
  S66_PHASE_TIMELINE_BARS: 'use for: 3-5 phases of an engagement with the timing of each (and how each is funded)',
  S66_VALUE_CURVE: 'use for: value that grows over three stages (day 1, early weeks, ongoing)',
  S66_BANNER_NUMBERED_ROWS: 'use for: the conclusion or three reasons, each a heading and one or two sentences',
  S66_COMPARE_STATUS_TABLE: 'use for: options compared on criteria with short answers (yes / no / manual / automatic)',
  S66_PLAIN_TABLE: 'use for: structured facts in rows (offers with timeline and cost, metrics with definition and target)',
  S66_SCORECARD: 'use for: results with evidence: 2-4 big numbers and the results table',
  S66_TIER_VALUE: 'use for: value by stage: three tiers with a big figure each and the next step',
  S66_PILLAR_IMAGE_STATS: 'use for: one pillar or theme with two figures (a series of pillars, one per slide)'
};
// The designs that suit each tone come first in the list Gemini chooses from
var SOLUTION_TONE_BIAS_ = {
  technical: ['S66_COMPARE_STATUS_TABLE', 'S66_CROSS_CHECK', 'S66_LABEL_ROWS', 'S66_STEP_COLUMNS', 'S66_SCORECARD', 'S66_QUAD_RULE_CARDS', 'S66_HEADER_COLUMNS', 'S66_NUMBERED_CARD_GRID', 'S66_TEXT_SECTIONS'],
  executive: ['S66_TIER_VALUE', 'S66_TINT_PANELS', 'S66_VALUE_CURVE', 'S66_PILLAR_IMAGE_STATS', 'S66_BANNER_NUMBERED_ROWS', 'S66_THREE_CARD_COLUMNS', 'S66_CARDS_PHOTO_STRIP'],
  offering: ['S66_OFFER_TIERS', 'S66_OFFER_DETAIL', 'S66_WHY_WHAT_HOW', 'S66_STEP_LOOP_FLOW', 'S66_PHASE_TIMELINE_BARS', 'S66_PLAIN_TABLE', 'S66_CARDS_PHOTO_STRIP', 'S66_HEADER_COLUMNS'],
  enablement: ['S66_LABEL_ROWS', 'S66_PHASE_TIMELINE_BARS', 'S66_HEADER_COLUMNS', 'S66_ICON_CARD_GRID', 'S66_VALUE_CURVE', 'S66_PLAIN_TABLE'],
  internal: ['S66_QUAD_RULE_CARDS', 'S66_TINT_PANELS', 'S66_HEADER_COLUMNS', 'S66_PLAIN_TABLE', 'S66_TEXT_SECTIONS', 'S66_NUMBERED_CARD_GRID']
};

/* ---------- 4. The short prompt that writes Solution Deck slides from the storyline plan ---------- */
// a = { userPrompt, n, batch, ctx, sources, approvedFacts, facts, iconNames }
function solutionContentPrompt_(a) {
  const ctx = a.ctx, b = a.batch, sources = a.sources || {};
  const used = (ctx.chooserState && ctx.chooserState.used) || {};
  const tone = ctx.solutionTone || 'executive';
  const client = String((ctx.proposal && ctx.proposal.client) || ctx.clientName || '');
  const plan = b && Array.isArray(b.plan) ? b.plan : [];
  const catalogue = [], inCat = {};
  const write = (b ? b.slides : []).map(function (o, k) {
    const sl = proposalShortlist_(Object.assign({ request: a.userPrompt, tone: tone }, o), used, 'solution');
    sl.forEach(function (x) { if (!inCat[x.tag]) { inCat[x.tag] = true; catalogue.push(x); } });
    return [(k + 1) + '. type "' + o.type + '" | title "' + o.title + '"',
      o.message ? '   message (what this slide proves): ' + o.message : (o.brief ? '   about: ' + o.brief : ''),
      Array.isArray(o.points) && o.points.length ? '   points ONLY this slide covers: ' + o.points.join('; ') : '',
      sl.length ? '   designs to choose from: ' + sl.map(function (x) { return x.tag; }).join(', ') : ''].filter(Boolean).join('\n');
  }).join('\n');
  const ledger = (b && b.ledger || []).slice(-150);
  return [
    'You are a senior solution architect at ' + ctx.brand.name + ' (a Google Cloud partner) writing a solution deck' + (client ? ' for ' + client : '') + '.',
    'REQUEST: "' + String(a.userPrompt || '').slice(0, 1500) + '"',
    solutionToneCard_(tone),
    plan.length ? 'THE STORYLINE OF THE WHOLE DECK (fixed; every slide advances it, no slide repeats another):\n' + plan.join('\n') : '',
    ledger.length ? 'ALREADY SAID ON EARLIER SLIDES (never say these again, in any words):\n- ' + ledger.join('\n- ') : '',
    Object.keys(used).length ? 'Designs already used on earlier slides of this deck (not offered again): ' + Object.keys(used).slice(0, 40).join(', ') : '',
    (b && (b.usedNumbers || []).length) ? 'FIGURES ALREADY SHOWN (never show them again): ' + b.usedNumbers.slice(-80).join(', ') : '',
    'THIS IS PART OF A LONG DECK (' + ((b && b.deckSize) || a.n) + ' slides in all). WRITE EXACTLY THESE ' + a.n + ' SLIDES, in this order, keeping each title word for word (the type is the planned kind of slide):',
    write,
    catalogue.length ? 'THE DESIGNS (write "design" and exactly the fields, item counts and words it needs):\n' + proposalShortlistText_(catalogue) : '',
    'RULES',
    '- Each slide proves its message with its own points: specific to the request, concrete (named systems, settings, steps, numbers).',
    '- Never repeat a point, capability, product explanation or figure that another slide of the storyline covers.',
    '- Choose ONE design per slide from its list and write exactly the fields, item counts and word counts that design needs.',
    '- Title: the planned title. "lead": one sentence (max 110 characters) under the title; never the same words as the title.',
    '- Sentence case everywhere (titles, headings, labels): only the first word, names and acronyms capitalised.',
    '- Item headings 2-5 words, never starting with a number; item texts in the voice above (labelled phrases), similar length on one slide.',
    '- Numbers only from the research sources, the approved facts or the request. A number you need but do not have is a target ("Target: ...").',
    '- Prices, SLAs, funding and test results only when the request or the sources give them; otherwise leave the field out.',
    '- Only real Google Cloud product names; never invent products, clients, awards or claims about ' + ctx.brand.name + '.',
    '- Cards and steps carry an "icon": one concrete concept for that item (e.g. "shield", "database", "wrench"), each different on a slide.',
    '- Plain text only: no markdown, no asterisks, no emoji, no line breaks inside a text, no reference markers like [1] in slide text.',
    '- "notes": 2-3 sentences for the presenter, with research source numbers like [2] when used. "fact_tags": IDs of approved facts used, or [].',
    'APPROVED FACTS ABOUT ' + ctx.brand.name.toUpperCase() + ' (the only claims allowed about it):\n' + (a.approvedFacts || []).slice(0, 25).map(function (f) { return '- ' + f; }).join('\n'),
    (a.facts && a.facts.verify && a.facts.verify.length) ? 'Facts to use only if essential (add "Verify before sharing." to the notes): ' + a.facts.verify.slice(0, 6).join(' | ') : '',
    sources.research && sources.research.length && typeof formatSciteForPrompt === 'function' ? formatSciteForPrompt(sources.research, sources.researchProvider) : '',
    sources.text ? 'USER SOURCE MATERIAL:\n' + String(sources.text).slice(0, 8000) : '',
    a.iconNames && a.iconNames.length ? 'ICON NAMES you may use: ' + a.iconNames.slice(0, 80).join(', ') : '',
    'OUTPUT: ONLY JSON {"deck_title":"","facts_note":"","slides":[{"type":"","design":"","title":"","lead":"", ...fields of the design..., "notes":"","fact_tags":[]}]} with exactly ' + a.n + ' slides.'
  ].filter(Boolean).join('\n');
}

/* ---------- 5. The Solution Deck agenda: its sections as numbered rows ---------- */
function solutionAgenda_(agenda, rows) {
  rows = (rows || []).map(function (r) {
    return { title: String(r.title || '').trim().slice(0, 60), text: String(r.description || '').trim() ? String(r.description).trim().slice(0, 110) : (r.points || []).slice(0, 3).map(function (x) { return String(x).trim(); }).filter(Boolean).join(' · ').slice(0, 110) };
  }).filter(function (r) { return r.title && !/^(introduction|thank you)$/i.test(r.title); });   // the sections only (no Introduction / Thank you rows)
  agenda.title = 'Agenda';
  agenda.lockTag = 'S66_AGENDA_ROWS';
  if (rows.length <= 10) { agenda.items = rows; return null; }
  agenda.items = rows.slice(0, 10);
  return { type: 'agenda', title: 'Agenda', continued: true, items: rows.slice(10, 20), lockTag: 'S66_AGENDA_ROWS' };
}

/* ---------- 6. The voice check after writing: no emoji, hashtags, exclamation marks or ALL CAPS ---------- */
var SOLUTION_EMOJI_RE_ = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
var SOLUTION_KEEP_SYMBOLS_ = { '✓': 1, '✗': 1, '→': 1, '★': 1 };
var SOLUTION_ACRONYMS_ = { HIPAA: 1, GDPR: 1, JSON: 1, YAML: 1, HTTP: 1, HTTPS: 1, REST: 1, OAUTH: 1, SAML: 1, NIST: 1, FINRA: 1, FEDRAMP: 1, CMEK: 1, WSFC: 1, MLOPS: 1, FINOPS: 1, AIOPS: 1, DNS: 1, VPN: 1, IPSEC: 1, NVME: 1, ISO: 1 };
var SOLUTION_SMALL_WORDS_ = { THE: 1, AND: 1, FOR: 1, OF: 1, TO: 1, IN: 1, ON: 1, AN: 1, OUR: 1, ITS: 1, ARE: 1, IS: 1, NEW: 1, HOW: 1, WHY: 1, WE: 1, BY: 1, AT: 1, OR: 1, ALL: 1, YOU: 1, NOW: 1 };
function solutionVoiceText_(t) {
  if (typeof t !== 'string' || !t) return t;
  let s = t.replace(SOLUTION_EMOJI_RE_, function (m) { return SOLUTION_KEEP_SYMBOLS_[m] ? m : ''; });
  s = s.replace(/(^|\s)#[A-Za-z][\w]*/g, '$1');                                  // hashtags (#SuccessIsPredictable)
  s = s.replace(/!+/g, function (m, off, all) { const rest = all.slice(off + m.length); return !rest.trim() || /^\s+[A-Z]/.test(rest) ? '.' : ','; }).replace(/[.,]\./g, '.');   // a new sentence after it: a full stop
  // ALL CAPS words of 4+ letters that are not acronyms become sentence case ("THE PROBLEM" -> "The problem")
  const caps = (s.match(/\b[A-Z]{4,}\b/g) || []).filter(function (w) { return !SOLUTION_ACRONYMS_[w]; });
  if (caps.length >= 2 || (caps.length === 1 && /^[A-Z\s]{6,}$/.test(s.trim()))) {
    const shout = !/[a-z]/.test(s);                                              // the whole text in capitals: the small words too
    s = s.replace(/\b[A-Z]{2,}\b/g, function (w) { return SOLUTION_ACRONYMS_[w] || (w.length < 4 && !(shout && SOLUTION_SMALL_WORDS_[w])) ? w : w.toLowerCase(); })
      .replace(/^(\s*)([a-z])/, function (m, sp, c) { return sp + c.toUpperCase(); });
  }
  return s.replace(/\s{2,}/g, ' ').trim();
}
function solutionVoiceClean_(sp) {
  if (!sp || typeof sp !== 'object') return sp;
  (function walk(o) {
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'design' || k === 'type' || k === 'icon' || k === 'material' || k === 'notes') return;
      const v = o[k];
      if (typeof v === 'string') o[k] = solutionVoiceText_(v);
      else if (v && typeof v === 'object') walk(v);
    });
  })(sp);
  return sp;
}
