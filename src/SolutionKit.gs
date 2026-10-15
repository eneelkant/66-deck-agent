/**
 * 66° Deck Agent — Solution Deck kit (V.1_52, V.1_53)
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
    '- Only topics the request asks for or that explain how the solution works: no market size, industry trends or adjacent opportunities (e.g. predictive maintenance in a monitoring deck) unless the request asks.',
    '- Sections of similar size; a slide sits in the section whose subject it is (the model training slide sits with the prediction, not with the problem).',
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
  S66_NUMBERED_CARD_GRID: 'use for: 4-6 characteristics, findings or things proved (numbered, no order implied). never for: steps in an order or a run book (use S66_STEP_COLUMNS)',
  S66_TINT_PANELS: 'use for: a context line, 2-3 decisions or facts, and what follows from them. never for: figures or results (use S66_TIER_VALUE or S66_SCORECARD)',
  S66_OFFER_TIERS: 'use for: 3-5 packaged offers or tiers with timing, price (only from the request) and funding. never for: rollout phases, a team or governance',
  S66_CROSS_CHECK: 'use for: the old way vs the new way, point by point (crosses and ticks)',
  S66_TEXT_SECTIONS: 'use for: background, history or components as 2-5 short headed sections',
  S66_BULLETS_PHOTO_HALF: 'use for: why it matters or the need, as 3-6 bullets (one per slide in a series of why / how slides)',
  S66_OFFER_DETAIL: 'use for: ONE offer or tier in detail (what it is, best for, outcome, activities)',
  S66_WHY_WHAT_HOW: 'use for: why / what / how, or 2-4 service lines read left to right',
  S66_STEP_LOOP_FLOW: 'use for: an operating model of three steps that feeds back (advise, run, improve), with 1-2 loop notes. never for: controls or areas that run side by side (no order)',
  S66_STEP_COLUMNS: 'use for: 4-6 steps of a run book, cut-over or transition, each with who or where (the run book design)',
  S66_LABEL_ROWS: 'use for: 3-4 layers or phases, each with its timing and activities. timing is a duration (5-10 min, 2 weeks): leave it out when there is none',
  S66_PHASE_TIMELINE_BARS: 'use for: 3-5 phases of an engagement with the timing of each (and how each is funded)',
  S66_VALUE_CURVE: 'use for: value that grows over three stages, each with a stage label (day 1, early weeks, ongoing). never for: the steps of a process or a pipeline',
  S66_BANNER_NUMBERED_ROWS: 'use for: the conclusion or three reasons, each a heading and one or two sentences',
  S66_COMPARE_STATUS_TABLE: 'use for: options compared on criteria with short answers (yes / no / manual / automatic)',
  S66_PLAIN_TABLE: 'use for: structured facts in rows (offers with timeline and cost, metrics with definition and target)',
  S66_SCORECARD: 'use for: results with evidence: 2-4 big numbers and the results table',
  S66_TIER_VALUE: 'use for: value by stage: three tiers with a big figure each and the next step',
  S66_PILLAR_IMAGE_STATS: 'use for: one pillar or theme with two figures (a series of pillars, one per slide)',
  // V.1_53 (batch 2)
  S66_ARCH_NUMBERED: 'use for: the reference architecture as numbered groups of Google Cloud products, with a numbered note per group. the architecture design for technical decks',
  S66_ARCH_ICON_GRAPH: 'use for: a data flow or request path read left to right (sources -> ingestion -> processing -> users) with labels on the arrows',
  S66_REGION_TOPOLOGY: 'use for: two regions or sites with their zones and the link between them (HA / DR, primary and standby)',
  S66_LAYER_STACK: 'use for: a platform or a deployment as 3-6 stacked layers, each with its parts. never for: steps in an order',
  S66_CODE_PROBLEM_SOLUTION: 'use for: a configuration change or fix with the exact commands or settings (only commands the request or sources give)',
  S66_TABLE_NOTES: 'use for: settings or options in a table plus 1-2 note panels (why, what to watch)',
  S66_PRIORITY_TABLE: 'use for: support priorities P1-P4 with response and resolution times (only times the request gives)',
  S66_ISSUE_ROWS: 'use for: known issues or risks, each with its fix, runbook or mitigation',
  S66_TWO_MODE_COMPARE: 'use for: two ways compared aspect by aspect (today vs with the solution) in short boxes',
  S66_NEED_MAPPING: 'use for: the client needs mapped to how the solution delivers each one, with the service pillar',
  S66_CHART_INSIGHT: 'use for: a trend in real data (8+ points from the request or sources) with 2-3 insights. never for: invented data',
  S66_DARK_STATEMENT: 'use for: one message to remember, on a dark slide (why this matters, the promise). at most one per deck',
  S66_EXPLAINER_SPLIT: 'use for: a short statement and 2-4 explainers (the next step and what it involves, the scope of a pilot, what something is)',
  S66_BANNER_SPLIT: 'use for: a use case with its steps and 2-6 figures (metrics only from the request or sources, otherwise targets)',
  S66_GAP_BRIDGE: 'use for: where the client is today, what is missing, and what the solution makes possible',
  S66_BOLD_LEAD_LIST: 'use for: a list of 4-8 named items, each "Name: what it is" (what is included, add-ons, rules)',
  S66_TWO_COL_BULLETS: 'use for: two lists side by side (in scope / out of scope, blockers / support needed)',
  S66_LIFECYCLE_COLUMNS: 'use for: 4-5 stages of a lifecycle or operating model, each with what it produces',
  S66_RISING_STAGES: 'use for: a maturity or adoption path of 5-8 one-to-three-word stages with one explaining note',
  S66_U_JOURNEY: 'use for: an end-to-end journey of 6-8 steps (from kickoff to run), on a dark slide',
  S66_LEVEL_CARDS: 'use for: three levels or tiers, each with 2-4 "Label: text" rows (format, focus, goal)',
  S66_CLIENT_STORY: 'use for: a client story the request or the material gives (who they are, the challenge, the journey, the figures)',
  S66_SERVICE_HUB_DARK: 'use for: how a service is run: services around one hub and the governance underneath, on a dark slide. use for team and governance slides'
};
// The designs that suit each tone come first in the list Gemini chooses from
var SOLUTION_TONE_BIAS_ = {
  technical: ['S66_ARCH_NUMBERED', 'S66_ARCH_ICON_GRAPH', 'S66_COMPARE_STATUS_TABLE', 'S66_REGION_TOPOLOGY', 'S66_LAYER_STACK', 'S66_CODE_PROBLEM_SOLUTION', 'S66_TWO_MODE_COMPARE', 'S66_CROSS_CHECK', 'S66_LABEL_ROWS', 'S66_STEP_COLUMNS', 'S66_TABLE_NOTES', 'S66_ISSUE_ROWS', 'S66_SCORECARD', 'S66_QUAD_RULE_CARDS', 'S66_HEADER_COLUMNS', 'S66_NUMBERED_CARD_GRID', 'S66_TEXT_SECTIONS'],
  executive: ['S66_DARK_STATEMENT', 'S66_GAP_BRIDGE', 'S66_TIER_VALUE', 'S66_TINT_PANELS', 'S66_VALUE_CURVE', 'S66_BANNER_SPLIT', 'S66_PILLAR_IMAGE_STATS', 'S66_CHART_INSIGHT', 'S66_EXPLAINER_SPLIT', 'S66_BANNER_NUMBERED_ROWS', 'S66_THREE_CARD_COLUMNS', 'S66_CARDS_PHOTO_STRIP', 'S66_CLIENT_STORY'],
  offering: ['S66_OFFER_TIERS', 'S66_OFFER_DETAIL', 'S66_WHY_WHAT_HOW', 'S66_SERVICE_HUB_DARK', 'S66_NEED_MAPPING', 'S66_PRIORITY_TABLE', 'S66_BOLD_LEAD_LIST', 'S66_U_JOURNEY', 'S66_STEP_LOOP_FLOW', 'S66_PHASE_TIMELINE_BARS', 'S66_PLAIN_TABLE', 'S66_DARK_STATEMENT', 'S66_CARDS_PHOTO_STRIP', 'S66_HEADER_COLUMNS'],
  enablement: ['S66_LEVEL_CARDS', 'S66_RISING_STAGES', 'S66_LIFECYCLE_COLUMNS', 'S66_LABEL_ROWS', 'S66_PHASE_TIMELINE_BARS', 'S66_U_JOURNEY', 'S66_HEADER_COLUMNS', 'S66_ICON_CARD_GRID', 'S66_VALUE_CURVE', 'S66_PLAIN_TABLE'],
  internal: ['S66_QUAD_RULE_CARDS', 'S66_TINT_PANELS', 'S66_ISSUE_ROWS', 'S66_TWO_COL_BULLETS', 'S66_BANNER_SPLIT', 'S66_CHART_INSIGHT', 'S66_HEADER_COLUMNS', 'S66_PLAIN_TABLE', 'S66_TEXT_SECTIONS', 'S66_NUMBERED_CARD_GRID']
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
    '- The slide shows what its title says (a "team and governance" title shows the team and how it is governed, not the rollout).',
    '- Labels and headings in sentence case ("Model type", never "Model Type"); a label is text, never a field name: "Source: in-truck devices", not "source: in-truck devices".',
    '- Never start a point with ✓ or ✗ (the design adds the marks); never write markdown such as `code` marks.',
    '- Results (pilot, tests, savings) only as the request or the attached material gives them; a result nobody gave is a target ("Target: ...").',
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

/* ---------- 7. V.1_53: how a Solution Deck reads on the slide (deck 24) ----------
   Gemini sometimes writes labels like field names ("source: in-truck devices", "google cloud pub/sub", table headers
   "aspect / description"), Title Case labels ("Model Type"), and its own ✓ / ✗ in front of points the design marks
   already. Every shown text gets: its first letter capitalised, labels in sentence case, product names and technical
   acronyms with their own capitals (Pub/Sub, JSON, IoT), and no leading tick or cross in a point. */
var SOLUTION_TECH_TERMS_ = { json: 'JSON', yaml: 'YAML', api: 'API', apis: 'APIs', iot: 'IoT', sql: 'SQL', vpc: 'VPC', iam: 'IAM', cmek: 'CMEK',
  kms: 'KMS', gcp: 'GCP', sla: 'SLA', slas: 'SLAs', slo: 'SLO', slos: 'SLOs', etl: 'ETL', elt: 'ELT', 'ci/cd': 'CI/CD', http: 'HTTP', https: 'HTTPS',
  grpc: 'gRPC', dns: 'DNS', tls: 'TLS', ssl: 'SSL', vm: 'VM', vms: 'VMs', gke: 'GKE', gcs: 'GCS', kpi: 'KPI', kpis: 'KPIs', roi: 'ROI', llm: 'LLM',
  llms: 'LLMs', ai: 'AI', ml: 'ML', pii: 'PII', dlp: 'DLP', rbac: 'RBAC', sso: 'SSO', saml: 'SAML', oauth: 'OAuth', hipaa: 'HIPAA', gdpr: 'GDPR',
  iap: 'IAP', rpo: 'RPO', rto: 'RTO', id: 'ID', ids: 'IDs', gpu: 'GPU', gpus: 'GPUs', cpu: 'CPU', sdk: 'SDK', cli: 'CLI', ui: 'UI', ux: 'UX',
  mqtt: 'MQTT', ilb: 'ILB', nlb: 'NLB', waf: 'WAF', siem: 'SIEM', soc: 'SOC', sre: 'SRE', mfa: 'MFA' };
var SOLUTION_TECH_RE_ = new RegExp('(?<![./@\\w-])(' + Object.keys(SOLUTION_TECH_TERMS_).map(function (k) { return k.replace('/', '\\/'); }).join('|') + ')(?![\\w-]|:\\/\\/)', 'g');
var SOLUTION_MARK_RE_ = /^\s*[✓✔✗✘×❌✅☑]️?\s*/;
// keys whose text is a heading or label (sentence case); keys never touched
var SOLUTION_HEAD_KEYS_ = { title: 1, label: 1, heading: 1, name: 1, timing: 1, funding: 1, tag: 1, owner: 1, chip: 1, role: 1, step: 1, stage: 1, level: 1, region: 1, zone: 1, group: 1, bar: 1, tier: 1 };
var SOLUTION_SKIP_KEYS_ = { reference: 1, notes: 1, design: 1, type: 1, icon: 1, material: 1, fact_tags: 1, lockTag: 1, code: 1, value: 1, url: 1, href: 1, deckLibrary: 1, sectionStyle: 1, number: 1 };
function solutionCodeLike_(w) { return /[_(){}<>=]|^\.|\.\w+\(|^(i[A-Z]|e[A-Z]|e\.g\.|vs\b|kubectl|gcloud|gsutil|bq\b|npm|pip|git\b|terraform\s+(plan|apply|init))/.test(w); }
function solutionCapFirst_(t) {
  const s = String(t || '');
  const first = (s.match(/^\S+/) || [''])[0];
  if (!/^[a-z]/.test(s) || solutionCodeLike_(first)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function solutionTerms_(t) {
  let s = String(t || '');
  if (/:\/\//.test(s)) return s;
  s = s.replace(SOLUTION_TECH_RE_, function (m) { return SOLUTION_TECH_TERMS_[m] || m; });
  if (typeof termCase_ === 'function') s = termCase_(s);
  if (typeof keepNames_ === 'function') s = keepNames_(s);
  return s;
}
function solutionLabelCase_(t) {
  const s = solutionCapFirst_(solutionTerms_(t));
  return typeof headingCase_ === 'function' && s.split(/\s+/).length <= 8 ? solutionTerms_(headingCase_(s)) : s;
}
// "source: in-truck devices" -> "Source: in-truck devices"; "Model Type · Trained on..." -> "Model type · Trained on..."
function solutionPointCase_(t, isPoint) {
  let s = solutionTerms_(String(t || ''));
  if (isPoint) s = s.replace(SOLUTION_MARK_RE_, function (m) { return s.replace(SOLUTION_MARK_RE_, '').trim() ? '' : m; });
  const m = s.match(/^([^:·]{2,40}?)(\s*:\s+|\s+·\s+)(.+)$/);
  if (m && m[1].split(/\s+/).length <= 5 && !/\d{2,}/.test(m[1])) s = solutionLabelCase_(m[1]) + m[2].replace(/^\s*:/, ':') + m[3];   // after the colon the phrase runs on in lower case
  return solutionCapFirst_(s);
}
function solutionDisplayCase_(sp) {
  if (!sp || typeof sp !== 'object') return sp;
  const walk = function (o, key, inPoints) {
    if (Array.isArray(o)) {
      o.forEach(function (v, i) {
        if (typeof v === 'string') o[i] = key === 'columns' || key === 'headers' ? solutionLabelCase_(v) : solutionPointCase_(v, inPoints);
        else if (Array.isArray(v) && key === 'rows') {
          v.forEach(function (c, j) { if (typeof c === 'string') v[j] = j === 0 && c.split(/\s+/).length <= 6 ? solutionLabelCase_(c) : solutionPointCase_(c, false); });
        } else if (v && typeof v === 'object') walk(v, key, false);
      });
      return;
    }
    Object.keys(o).forEach(function (k) {
      if (SOLUTION_SKIP_KEYS_[k]) return;
      const v = o[k];
      if (typeof v === 'string') {
        if (k === 'title' && o === sp) o[k] = solutionCapFirst_(solutionTerms_(v));            // the slide title is cased by the planner already
        else o[k] = SOLUTION_HEAD_KEYS_[k] && v.split(/\s+/).length <= 8 ? solutionLabelCase_(v) : solutionPointCase_(v, false);
      } else if (v && typeof v === 'object') walk(v, k, k === 'points' || k === 'bullets');
    });
  };
  walk(sp, '', false);
  return sp;
}

/* ---------- 8. V.1_53: results only from the request (deck 24 slide 23: "<2% pilot result" from a web article) ----------
   On a results slide (pilot, tests, validation, scorecard) a figure presented as the client's or our result must come
   from the request or the attached material; otherwise it becomes a target. Industry figures from the research stay
   when they are not presented as the result. */
var SOLUTION_RESULT_SLIDE_RE_ = /\b(pilot|poc|proof of concept|tests?|tested|results?|proved|proven|validation|validated|scorecard|benchmark\w*|measured|outcomes? so far)\b/i;
var SOLUTION_OWN_CLAIM_RE_ = /\b(pilot|our|we|achieved|observed|measured|delivered|reduced|cut|saved|improvement|result|passed)\b/i;
function solutionResultsGuard_(slides, prompt, sources, ctx) {
  const own = String(prompt || '') + ' ' + String((sources && sources.text) || '');
  const research = JSON.stringify((sources && sources.research) || []);
  const client = String((ctx && ctx.proposal && ctx.proposal.client) || (ctx && ctx.clientName) || '').trim();
  const has = function (corpus, fig) {
    const d = (String(fig).match(/\d+(?:[.,]\d+)?/) || [''])[0];
    return !!d && new RegExp('(^|[^0-9.])' + d.replace(/[.,]/, '[.,]') + '(?![0-9])').test(corpus);
  };
  const figs = function (t) { return String(t || '').match(/[<>~≈]?[$€£]?\d+(?:[.,]\d+)?\s?(?:%|x\b|[kmb]\b|\+)?/gi) || []; };
  const claims = function (t) { return SOLUTION_OWN_CLAIM_RE_.test(t) || (client && new RegExp('\\b' + client.split(/\s+/)[0] + '\\b', 'i').test(t)); };
  let n = 0;
  (slides || []).forEach(function (sp) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (!sp || ['cover', 'agenda', 'closing', 'section', 'template'].indexOf(t) !== -1) return;
    if (!SOLUTION_RESULT_SLIDE_RE_.test(String(sp.title || '') + ' ' + String(sp.lead || ''))) return;
    let changed = false;
    (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) {
      if (!it || typeof it !== 'object' || !/\d/.test(String(it.value || ''))) return;
      const words = [it.label, it.title, it.text, sp.title].join(' ');
      if (has(own, it.value) || (!claims(words) && has(research, it.value))) return;
      const label = String(it.label || it.title || '').replace(/^target:\s*/i, '').trim();
      it.title = it.title || label;
      it.label = 'Target: ' + (label ? label.charAt(0).toLowerCase() + label.slice(1) : 'to be measured');
      delete it.value;
      changed = true;
    });
    // sentences that state an unconfirmed result go (the box keeps its other sentences)
    const trim = function (str) {
      const parts = String(str || '').split(/(?<=[.!?])\s+/);
      const keep = parts.filter(function (x) { return !figs(x).some(function (f) { return /\d/.test(f) && !has(own, f) && (claims(x) || !has(research, f)); }); });
      if (keep.length && keep.length < parts.length) { changed = true; return keep.join(' '); }
      return str;
    };
    ['takeaway', 'lead', 'statement', 'text'].forEach(function (k) { if (typeof sp[k] === 'string') sp[k] = trim(sp[k]); });
    (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) { if (it && typeof it.text === 'string') it.text = trim(it.text); });
    if (sp.footer && typeof sp.footer.text === 'string') sp.footer.text = trim(sp.footer.text);
    if (changed) { n++; sp.notes = String(sp.notes || '') + '\nResults not given in the request are shown as targets: add the measured figures before sharing.'; }
  });
  if (n && ctx && ctx.log) ctx.log.push(n + ' results slide(s): figures the request did not give are shown as targets (no invented results).');
  return n;
}

/* ---------- 9. V.1_53: nothing falls back to a General layout ----------
   When no Solution design can show a slide (deck 24 slide 13 came out as two empty bars), all its text is gathered and
   it becomes headed text sections or a bullet list, which the Solution designs always draw. */
function solutionRescue_(sp) {
  if (!sp || typeof sp !== 'object') return false;
  const str = function (v) { return String(v == null ? '' : (typeof v === 'object' ? (v.text || v.title || v.label || v.value || '') : v)).replace(/\s+/g, ' ').trim(); };
  const groups = [];
  const addGroup = function (title, pts) { pts = (pts || []).map(str).filter(Boolean); if (title || pts.length) groups.push({ title: str(title), points: pts }); };
  (Array.isArray(sp.items) ? sp.items : []).forEach(function (it) {
    if (typeof it === 'string') { addGroup('', [it]); return; }
    if (!it) return;
    const pts = [].concat(it.points || it.bullets || []);
    if (it.text || it.description) pts.unshift(it.text || it.description);
    if (it.value) pts.unshift(String(it.value) + (it.label && it.title ? ' ' + it.label : ''));
    addGroup(it.title || it.name || it.label, pts);
  });
  ['left', 'right'].forEach(function (k) { const s = sp[k]; if (s && typeof s === 'object') addGroup(s.label || s.title, [].concat(s.points || s.items || [])); });
  (Array.isArray(sp.columns) ? sp.columns : []).forEach(function (c) {
    if (c && typeof c === 'object' && !Array.isArray(c)) addGroup(c.title || c.label || c.name, [].concat(c.items || c.points || []));
  });
  (Array.isArray(sp.columns) && Array.isArray(sp.rows) ? sp.rows : []).forEach(function (r) {
    const cells = Array.isArray(r) ? r : (r && r.cells) || [];
    const c = cells.map(str).filter(Boolean);
    if (c.length) addGroup(c[0], c.slice(1).length ? [c.slice(1).join(' · ')] : []);
  });
  const loose = [].concat(sp.points || []).map(str).filter(Boolean);
  ['statement', 'text', 'takeaway'].forEach(function (k) { if (typeof sp[k] === 'string' && sp[k].trim()) loose.push(sp[k].trim()); });
  const titled = groups.filter(function (g) { return g.title && g.points.length; });
  const keep = { title: sp.title, lead: sp.lead, notes: sp.notes, fact_tags: sp.fact_tags, deckLibrary: sp.deckLibrary, cobrand: sp.cobrand, section: sp.section };
  let next = null;
  if (titled.length >= 2) next = { type: 'bullets', items: titled.slice(0, 5).map(function (g) { return { title: g.title, points: g.points.slice(0, 4) }; }) };
  else {
    const flat = groups.reduce(function (a, g) { return a.concat(g.title && g.points.length ? [g.title + ': ' + g.points.join(' ')] : g.points.length ? g.points : [g.title]); }, []).concat(loose).filter(Boolean);
    if (!flat.length) return false;
    next = { type: 'bullets', points: flat.slice(0, 6) };
  }
  Object.keys(sp).forEach(function (k) { delete sp[k]; });
  Object.assign(sp, keep, next);
  Object.keys(sp).forEach(function (k) { if (sp[k] === undefined) delete sp[k]; });
  return true;
}

/* ---------- 10. V.1_53: the outline of a Solution Deck (deck 24) ----------
   Near-duplicate slides (the same comparison twice), topics nobody asked for (market size, adjacent opportunities) and
   lopsided sections (8 / 4 / 5 / 7 slides) are fixed in the outline, before any slide is written. */
var SOLUTION_OFFTOPIC_RE_ = /\b(market|industry|trends?|landscape|imperative|opportunit(?:y|ies)|future of)\b/i;
function solutionStems_(o) {
  const t = [o && o.title, o && o.message, (o && o.points || []).join(' ')].join(' ');
  return typeof topicStems_ === 'function' ? Object.keys(topicStems_(t, true)).filter(function (w) { return w.charAt(0) !== '#'; }) : String(t).toLowerCase().split(/\W+/).filter(function (w) { return w.length > 4; });
}
// indexes of outline entries to replace: a near copy of an earlier slide, or an unrequested topic
function solutionOutlineChecks_(slides, prompt, tone, before) {
  const out = [];
  const req = String(prompt || '');
  const seen = (before || []).map(solutionStems_);
  const cmpSeen = (before || []).filter(function (o) { return o && o.type === 'comparison'; }).map(solutionStems_);
  (slides || []).forEach(function (o, i) {
    if (!o || o.type === 'section') { seen.push([]); return; }
    const st = solutionStems_(o);
    const dup = st.length >= 2 && seen.some(function (prev) {
      if (prev.length < 2) return false;
      const shared = st.filter(function (w) { return prev.indexOf(w) !== -1; }).length;
      return shared >= 3 || shared / Math.min(st.length, prev.length) >= 0.6;
    }) || (o.type === 'comparison' && cmpSeen.some(function (prev) { return st.some(function (w) { return prev.indexOf(w) !== -1; }); }));   // the same comparison twice
    if (o.type === 'comparison') cmpSeen.push(st);
    const words = (String(o.title || '').match(SOLUTION_OFFTOPIC_RE_) || [])[0];
    const off = tone !== 'executive' && words && !new RegExp('\\b' + words.slice(0, 5), 'i').test(req);
    if (dup || off) out.push(i);
    seen.push(st);
  });
  return out;
}
// sections of similar size: a slide moves across a boundary (the last slide of a long section opens the next one, or
// the first slide closes the previous one), choosing the slide that matches the other section's words
function solutionBalanceSections_(secs) {
  if (!secs || secs.length < 2) return 0;
  const total = secs.reduce(function (a, sc) { return a + sc.list.length; }, 0);
  const avg = total / secs.length;
  const words = secs.map(function (sc) { return solutionStems_({ title: sc.title, message: (sc.description || '') + ' ' + (sc.storyline || '') }); });
  const fit = function (o, k) { const st = solutionStems_(o); return st.filter(function (w) { return words[k].indexOf(w) !== -1; }).length; };
  let moves = 0;
  for (let guard = 0; guard < 60; guard++) {
    const sizes = secs.map(function (sc) { return sc.list.length; });
    if (Math.max.apply(null, sizes) - Math.min.apply(null, sizes) <= 2) break;
    // the boundary with the largest difference moves one slide (moves cascade: 7,7,5,4 -> 6,6,6,5)
    let best = null;
    for (let k = 0; k < secs.length - 1; k++) {
      const d = sizes[k] - sizes[k + 1];
      if (Math.abs(d) >= 2 && (!best || Math.abs(d) > Math.abs(best.d))) best = { k: k, d: d };
    }
    if (!best) break;
    const from = best.d > 0 ? best.k : best.k + 1, to = best.d > 0 ? best.k + 1 : best.k;
    const list = secs[from].list;
    if (list.length <= 1) break;
    if (to > from) secs[to].list.unshift(list.pop()); else secs[to].list.push(list.shift());
    moves++;
  }
  return moves;
}

/* ---------- 11. V.1_53: dark slides — some Solution slides are black with the content in white ----------
   Like the solution decks (dark icon cards, dark hub, dark journey, dark statement): about one body slide in five,
   never right after another dark slide or a dark divider. Designs drawn only dark count as dark slides too. */
var SOLUTION_DARK_OK_ = { S66_ICON_CARD_GRID: 1, S66_NUMBERED_CARD_GRID: 1, S66_THREE_CARD_COLUMNS: 1, S66_QUAD_RULE_CARDS: 1, S66_LEVEL_CARDS: 1, S66_LIFECYCLE_COLUMNS: 1, S66_STEP_COLUMNS: 1 };
var SOLUTION_DARK_ONLY_ = { S66_DARK_STATEMENT: 1, S66_U_JOURNEY: 1, S66_SERVICE_HUB_DARK: 1 };
function solutionDarkRhythm_(specs, ctx) {
  if (!specs || !specs.length || !isSolutionDeck_(ctx)) return 0;
  const p = ctx.proposal || (ctx.proposal = { client: null, logoId: '', sectionStyle: 'dark' });
  let since = typeof p.sinceDark === 'number' ? p.sinceDark : 2, n = 0;
  specs.forEach(function (sp) {
    if (!sp) return;
    const t = String(sp.type || '').toLowerCase();
    if (t === 'cover' || t === 'agenda' || t === 'closing') return;
    const tag = (sp.reference && sp.reference.tag) || sp.lockTag || '';
    if (t === 'section') { if (tag !== 'P66_SECTION_LIGHT') since = 0; return; }
    if (SOLUTION_DARK_ONLY_[tag]) { since = 0; return; }
    if (SOLUTION_DARK_OK_[tag] && since >= 4) { sp.dark = true; since = 0; n++; return; }
    delete sp.dark;
    since++;
  });
  p.sinceDark = since;
  return n;
}
