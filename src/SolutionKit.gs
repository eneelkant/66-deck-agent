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
    'NEVER: emoji, hashtags, exclamation marks, ALL CAPS labels, Title Case titles, hype words, invented products, clients, prices or results.',
    // V.1_57 (deck 30 review)
    'ALSO: current Google Cloud names (Pub/Sub, Dataflow, Cloud Run functions; never "Cloud Pub/Sub", "Cloud Dataflow" or IoT Core); a figure from industry ' +
    'research is labelled on the slide as an industry figure; no 66degrees results, credentials or proof boxes unless the request asks; the notes name the same ' +
    'products and design as the slide; a passive disaster recovery region runs no active services; two topics the request lists (e.g. support and the next step) are two slides. ' +
    'Layers are written as layers[{label, items[]}]; a primary / DR pair as regions[{label, zones[{title,text}]}]; runbooks as items[{title: issue, fix}]; ' +
    'next steps as items[{title, text}] (one sentence each, never "Goal: ... Action: ..." chains); a KPI label says exactly what the figure measures; a study period is never a KPI; support priorities list each level with its response time.'
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
    '- EVERY topic the request lists gets its OWN slide whose title names it (a section title never counts as covering a topic).',
    '- Each slide has a "message": the ONE thing it proves (max 110 characters), and "points": 2-4 short phrases (3-8 words) that ONLY this slide',
    '  covers. A point (a capability, a figure, a step, a product explanation) never appears on two slides.',
    '- The named parts of the solution (services, tiers, levels, layers, steps) keep the same names on every slide.',
    '- The Google Cloud products are explained where they are used (the architecture, how it works), never one slide per product.',
    '- The last body slide gives the recommended next step or the ask.',
    '- V.1_58: a today-versus-new comparison (manual checks vs predicted alerts) sits in the first section, where the problem is told; deployment (Terraform) sits with operations.',
    '- No 66degrees credentials or "why 66degrees" slide unless the request asks for it; a client result only from the request or the sources.',
    '- Only topics the request asks for or that explain how the solution works: no market size, industry trends or adjacent opportunities (e.g. predictive maintenance in a monitoring deck) unless the request asks.',
    '- Sections of similar size; a slide sits in the section whose subject it is (the model training slide sits with the prediction, not with the problem).',
    '- No filler: no "future of", "in summary", "key takeaways" slides.',
    '- V.1_55: no KPI or target slide, cost or pricing slide, or roadmap slide unless the request or the tone story asks for it; targets, prices and times are never invented.',
    '- V.1_56: every topic the request lists keeps its own slide, named with the request\'s words (e.g. "Reference architecture", "Deployment layers with Terraform"); no value, benefits or "why now" slide in a technical deck unless asked; the last body slide is the next step (what happens first, who, when).'
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
    '- A chip, tag or owner is a real team or role ("Dispatch", "Data team"); leave it out rather than write a label such as "Current state" or "Impact".',
    '- No KPI, target, risk, scope or assumption slide unless the request asks for it; never invent a target figure.',
    '- Results (pilot, tests, savings) only as the request or the attached material gives them; a result nobody gave is a target ("Target: ...").',
    '- Sentence case everywhere (titles, headings, labels): only the first word, names and acronyms capitalised.',
    '- Item headings 2-5 words, never starting with a number; item texts in the voice above (labelled phrases), similar length on one slide.',
    '- Numbers only from the research sources, the approved facts or the request. A number you need but do not have is a target ("Target: ...").',
    '- Prices, SLAs, funding and test results only when the request or the sources give them; otherwise leave the field out.',
    '- A body slide is never typed "agenda", "cover", "closing" or "section" (the code draws those); a source goes in the notes, never in a table column.',
    '- V.1_56: only current Google Cloud products (Cloud IoT Core, Container Registry and AI Platform are retired: never name them). Pub/Sub feeds Dataflow through a streaming pull subscription.',
    '- A figure from a study or an industry report describes that study, never this solution: never present it as the model\'s accuracy or the client\'s result.',
    '- Recovery, uptime and response targets (RTO, RPO, SLA) that the request does not give are labelled "Target" and kept realistic (never 100% uptime).',
    '- Nothing about ' + ctx.brand.name + '\'s own operating model (follow-the-sun, 24/7, team size, certifications) unless the approved facts say it.',
    '- Every sentence adds a fact: no closing sentences such as "This is crucial." or "This streamlines repair efforts."; acronyms keep their capitals (DR, HA, P1-P4).',
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
      if (k === 'reference' || k === 'design' || k === 'type' || k === 'icon' || k === 'material' || k === 'notes' || k === 'code') return;   // (V.1_54: a code block is left exactly as written)
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
  mqtt: 'MQTT', ilb: 'ILB', nlb: 'NLB', waf: 'WAF', siem: 'SIEM', soc: 'SOC', sre: 'SRE', mfa: 'MFA',
  dr: 'DR', ha: 'HA', p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', sev1: 'Sev1', sev2: 'Sev2', sev3: 'Sev3' };   // V.1_56 (deck 29: "Dr region", "p2 (high)")
var SOLUTION_TECH_RE_ = new RegExp('(?<![./@\\w-])(' + Object.keys(SOLUTION_TECH_TERMS_).map(function (k) { return k.replace('/', '\\/'); }).join('|') + ')(?![\\w-]|:\\/\\/)', 'g');
var SOLUTION_MARK_RE_ = /^\s*[✓✔✗✘×❌✅☑]️?\s*/;
// keys whose text is a heading or label (sentence case); keys never touched
var SOLUTION_HEAD_KEYS_ = { title: 1, label: 1, heading: 1, name: 1, timing: 1, funding: 1, tag: 1, owner: 1, chip: 1, role: 1, step: 1, stage: 1, level: 1, region: 1, zone: 1, group: 1, bar: 1, tier: 1 };
var SOLUTION_SKIP_KEYS_ = { reference: 1, notes: 1, design: 1, type: 1, icon: 1, material: 1, fact_tags: 1, lockTag: 1, code: 1, value: 1, url: 1, href: 1, deckLibrary: 1, sectionStyle: 1, number: 1 };
function solutionCodeLike_(w) { return /[_(){}<>=]|^\.|\.\w+\(|[a-z]-?\d|^[a-z]+[A-Z]|^(i[A-Z]|e[A-Z]|e\.g\.|vs\b|kubectl|gcloud|gsutil|bq\b|npm|pip|git\b|terraform\s+(plan|apply|init))/.test(w); }   // V.1_54: ids such as us-central1-a stay as written
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
// V.1_55: "1 · data ingestion", "01 Data validation", "2. Dataflow" -> the design numbers its items itself
function solutionNoNumber_(t) { return String(t || '').replace(/^\s*(\d{1,2}|[ivx]{1,4})\s*[·.):\-–]\s+(?=\S)/i, ''); }
// V.1_55: "Condition-Based" -> "Condition-based", "End-To-End" -> "End-to-end" (acronyms and names keep their capitals)
function solutionHyphenCase_(t) { return String(t || '').replace(/([A-Za-z0-9])-([A-Z])([a-z]+)/g, function (m, a, b, c) { return a + '-' + b.toLowerCase() + c; }); }
function solutionLabelCase_(t) {
  const s = solutionCapFirst_(solutionTerms_(solutionHyphenCase_(solutionNoNumber_(t))));
  const out = typeof headingCase_ === 'function' && s.split(/\s+/).length <= 8 ? solutionTerms_(headingCase_(s)) : s;
  return solutionKeepCaps_(String(t || ''), out);
}
// V.1_56: words written in capitals (DR, HA, P2, BQ) keep them after sentence case
function solutionKeepCaps_(orig, out) {
  const caps = String(orig || '').match(/\b(?:[A-Z]{2,5}s?|[A-Z]\d{1,2})\b/g) || [];
  let r = String(out || '');
  caps.forEach(function (w) { r = r.replace(new RegExp('\\b' + w + '\\b', 'gi'), w); });
  return r;
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
        if (typeof v === 'string') o[i] = key === 'columns' || key === 'headers' ? solutionLabelCase_(v) : solutionPointCase_(/^(callouts|steps|notes_list)$/.test(key) ? solutionNoNumber_(v) : v, inPoints);
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
        else o[k] = SOLUTION_HEAD_KEYS_[k] && v.split(/\s+/).length <= 8 ? solutionLabelCase_(v) : solutionPointCase_(SOLUTION_HEAD_KEYS_[k] ? solutionNoNumber_(v) : v, false);
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
    // V.1_56 (deck 29 slide 6): figures that stay because they come from published research say so on the slide
    const shown = JSON.stringify([sp.items, sp.rows, sp.points]);
    // V.1_65 (deck 37: the same sentence replaced the subtitle of four slides, also a rollout plan): the slide keeps its own
    // subtitle; the note on the figures goes to the speaker notes
    if (figs(shown).some(function (f) { return /\d/.test(f) && !has(own, f) && has(research, f); }) && !/industry|benchmark|published|research/i.test(String(sp.lead || ''))) {
      const line = 'Industry figures from published research (sources in the notes), not measured results' + (client ? ' for ' + client : '') + '.';
      if (!String(sp.lead || '').trim()) sp.lead = line;
      else if (!/industry figures from published research/i.test(String(sp.notes || ''))) sp.notes = String(sp.notes || '').replace(/\s+$/, '') + '\n' + line;
    }
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
  // V.1_56 (deck 29 slide 15: the security controls were in fields such as "layers" / "controls" and were lost): text in
  // any other field is gathered too
  if (groups.length + loose.length < 2) solutionOtherTexts_(sp).forEach(function (g) { addGroup(g.title, g.points); });
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
var SOLUTION_UNASKED_ = [
  { title: /\b(kpis?|key performance|success (metrics|measures|criteria)|measur\w* success|how we measure|targets)\b/i, asked: /\b(kpis?|metrics?|measur\w*|targets?|success criteria)\b/i, keep: ['executive', 'internal'] },
  { title: /\b(market (size|growth|landscape|trends?|opportunity|overview)|industry (benchmarks?|trends?|landscape)|benchmarks?|cagr)\b/i, asked: /\b(market|industry|benchmark|trend)\w*/i, keep: ['executive'] },
  { title: /\b(costs?|pricing|savings|roi|business case|tco|finops)\b/i, asked: /\b(cost|pricing|price|saving|roi|tco|budget|business case|finops)\w*/i, keep: ['executive', 'offering', 'internal'] },
  { title: /\b(roadmap|phased|phases|timeline|implementation plan|rollout plan)\b/i, asked: /\b(roadmap|phase|timeline|plan|rollout|implementation|wave)\w*/i, keep: ['enablement', 'offering', 'executive'] },
  // V.1_56 (decks 27-29: "The proven value of predictive maintenance", "The impact of CBM", "A paradigm shift"): selling
  // slides with industry figures stay out of a technical or enablement deck unless the request asks for them
  { title: /\b(value|benefits?|impact|business case|why now|imperative|paradigm|opportunit\w*|proven|financial)\b/i, asked: /\b(value|benefit|impact|business case|roi|why|financial|savings?)\w*/i, keep: ['executive', 'offering', 'internal'] },
];
var SOLUTION_OFFTOPIC_RE_ = /\b(market|industry|trends?|landscape|imperative|opportunit(?:y|ies)|future of)\b/i;
function solutionStems_(o) {
  const t = [o && o.title, o && o.message, (o && o.points || []).join(' ')].join(' ');
  return typeof topicStems_ === 'function' ? Object.keys(topicStems_(t.toLowerCase(), false)).filter(function (w) { return w.charAt(0) !== '#'; }) : String(t).toLowerCase().split(/\W+/).filter(function (w) { return w.length > 4; });
}
// indexes of outline entries to replace: a near copy of an earlier slide, or an unrequested topic
function solutionOutlineChecks_(slides, prompt, tone, before) {
  const out = [];
  const req = String(prompt || '');
  // V.1_54: the words of the deck's subject (leak, meter, water...) are on most slides: they never make two slides repeats
  const all = (before || []).concat(slides || []).filter(function (o) { return o && o.type !== 'section'; });
  const df = {};
  all.forEach(function (o) { const seenW = {}; solutionStems_(o).forEach(function (w) { if (!seenW[w]) { seenW[w] = 1; df[w] = (df[w] || 0) + 1; } }); });
  const common = function (w) { return all.length >= 5 && df[w] > Math.max(2, all.length * 0.25); };
  const stemsOf = function (o) { return solutionStems_(o).filter(function (w) { return !common(w); }); };
  const seen = (before || []).map(stemsOf);
  const cmpSeen = (before || []).filter(function (o) { return o && o.type === 'comparison'; }).map(stemsOf);
  (slides || []).forEach(function (o, i) {
    if (!o || o.type === 'section') { seen.push([]); return; }
    const st = stemsOf(o);
    const dup = st.length >= 2 && seen.some(function (prev) {
      if (prev.length < 2) return false;
      const shared = st.filter(function (w) { return prev.indexOf(w) !== -1; }).length;
      return shared >= 4 || (shared >= 2 && shared / Math.min(st.length, prev.length) >= 0.7);
    }) || (o.type === 'comparison' && cmpSeen.some(function (prev) { return st.some(function (w) { return prev.indexOf(w) !== -1; }); }));   // the same comparison twice
    if (o.type === 'comparison') cmpSeen.push(st);
    const words = (String(o.title || '').match(SOLUTION_OFFTOPIC_RE_) || [])[0];
    let off = tone !== 'executive' && words && !new RegExp('\\b' + words.slice(0, 5), 'i').test(req);
    // V.1_55 (deck 26: KPIs with invented targets, market size, cost tips, a roadmap nobody asked for): slides of a kind the
    // request does not ask for and the tone's story does not need are replaced
    SOLUTION_UNASKED_.forEach(function (u) {
      if (off || u.keep.indexOf(tone) !== -1) return;
      if (u.title.test(String(o.title || '')) && !u.asked.test(req)) off = true;
    });
    if (/\bnext steps?\b|getting started|the ask\b/i.test(String(o.title || ''))) off = false;   // V.1_56: the next step always stays
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
  let since = typeof p.sinceDark === 'number' ? p.sinceDark : 2, n = 0, blockNext = false;
  specs.forEach(function (sp) {
    if (!sp) return;
    const t = String(sp.type || '').toLowerCase();
    if (t === 'cover' || t === 'agenda' || t === 'closing') return;
    const tag = (sp.reference && sp.reference.tag) || sp.lockTag || '';
    // V.1_54 (deck 25): a dark divider only keeps the slide right after it light (it used to restart the count, so
    // sections of 3-4 slides never had a dark slide)
    if (t === 'section') { if (tag !== 'P66_SECTION_LIGHT') blockNext = true; return; }
    if (SOLUTION_DARK_ONLY_[tag]) { since = 0; blockNext = true; return; }
    if (SOLUTION_DARK_OK_[tag] && since >= 4 && !blockNext) { sp.dark = true; since = 0; n++; return; }
    delete sp.dark;
    blockNext = false;
    since++;
  });
  p.sinceDark = since;
  return n;
}

/* ---------- 12. V.1_54: what fills a short Solution outline (deck 25) ----------
   A Solution outline that comes back short was filled from the Proposal list (risks, KPIs, scope, assumptions, testing,
   change management): deck 25 lost architecture, prediction and support priorities to them. A Solution Deck fills first
   with the topics the request lists, then with solution topics of its tone. */
var SOLUTION_BACKLOG_ = {
  technical: [
    { type: 'diagram', title: 'How the solution works end to end', brief: 'The components and how data flows between them' },
    { type: 'process', title: 'Integration with existing systems', brief: 'How the solution connects to the systems the client runs today' },
    { type: 'cards', title: 'Monitoring and observability', brief: 'What is monitored, the alerts and who receives them' },
    { type: 'table', title: 'Configuration and sizing', brief: 'The main settings and sizes of the components' },
    { type: 'process', title: 'How the solution is deployed', brief: 'The deployment steps from code to production' },
    { type: 'cards', title: 'Operating the platform day to day', brief: 'Who runs it, routine tasks and runbooks' }],
  executive: [
    { type: 'cards', title: 'What changes for the business', brief: 'The difference the solution makes for each team' },
    { type: 'process', title: 'How we get there', brief: 'The stages from start to value' },
    { type: 'statement', title: 'The decision needed', brief: 'What the sponsors are asked to approve' },
    { type: 'cards', title: 'How the solution works', brief: 'The solution in plain words' }],
  offering: [
    { type: 'cards', title: 'What is included', brief: 'The services and deliverables in the offer' },
    { type: 'process', title: 'How we deliver it', brief: 'The delivery model from onboarding to run' },
    { type: 'table', title: 'Service levels and support', brief: 'Support hours and response times (only as the request gives them)' },
    { type: 'statement', title: 'How to get started', brief: 'The first step and what it involves' }],
  enablement: [
    { type: 'cards', title: 'Learning levels and formats', brief: 'The levels, who they are for and their formats' },
    { type: 'process', title: 'The rollout plan', brief: 'Cohorts, champions and timing' },
    { type: 'cards', title: 'How adoption is measured', brief: 'What is tracked to see the change land' }],
  internal: [
    { type: 'cards', title: 'What is working', brief: 'Results and wins so far' },
    { type: 'cards', title: 'Gaps and what they cost', brief: 'Where we fall short and the impact' },
    { type: 'cards', title: 'The asks and owners', brief: 'What we need and who owns it' }]
};
function solutionBacklog_(tone, prompt) {
  const list = (SOLUTION_BACKLOG_[tone] || SOLUTION_BACKLOG_.executive).concat(tone === 'technical' ? [] : SOLUTION_BACKLOG_.technical.slice(0, 2));
  const asksArch = /architecture|end to end|end-to-end/i.test(String(prompt || ''));   // V.1_55: the architecture slide the request names covers it
  return list.filter(function (b) { return !(asksArch && /end to end|how the solution works/i.test(b.title)); }).map(function (b) { return Object.assign({}, b); });
}
// a requested topic Gemini left out becomes its own slide, of the type its words call for
function solutionTopicEntry_(topic) {
  const t = String(topic || '').replace(/\s*\([^)]*\)/g, '').trim();
  const words = String(topic || '');
  const type = /architecture|data flow|topology|region|\bdr\b|layers?|stack/i.test(words) ? 'diagram'
    : /\bvs\.?\b|versus|compared|today|before and after|manual .* automat/i.test(words) ? 'comparison'
    : /priorit|sla|slo|matrix|table|sizing|thresholds?/i.test(words) ? 'table'
    : /runbook|steps?|process|pipeline|stream|ingest|deploy|run book|cut-?over|onboard|prediction|model/i.test(words) ? 'process'
    : /next step|decision|ask/i.test(words) ? 'statement'
    : /results?|metrics?|kpis?|figures/i.test(words) ? 'stats' : 'cards';
  let title = t.charAt(0).toUpperCase() + t.slice(1);
  if (/^(the )?next steps?$/i.test(t)) return { type: 'process', title: 'The next step', brief: 'The recommended next step: 3-4 steps, what happens first, who does it and by when (a workshop, a pilot, a decision)', message: 'What happens next, who does it and when' };   // V.1_56
  return { type: type, title: title.length > 58 ? title.slice(0, 58).replace(/\s+\S*$/, '') : title, brief: 'The requested topic: ' + t, message: 'Covers the requested topic: ' + t };
}

/* ---------- 13. V.1_54: the designs a slide's words call for come first in its list ----------
   Deck 25: "deployment layers" got numbered cards, the architecture got no diagram. A word in the title puts the design
   made for it at the top of the slide's shortlist (the tone order follows). */
var SOLUTION_KEYWORD_DESIGNS_ = [
  [/\barchitecture\b|\bend to end\b|how .* works|components/i, ['S66_ARCH_NUMBERED', 'S66_ARCH_ICON_GRAPH']],
  [/data flow|pipeline|\bstream(s|ing|ed)?\b|\bingest\w*|request path/i, ['S66_ARCH_ICON_GRAPH', 'S66_LABEL_ROWS', 'S66_STEP_COLUMNS']],
  [/\blayers?\b|\bstack\b|\btiers? of\b/i, ['S66_LAYER_STACK', 'S66_LABEL_ROWS']],
  [/regions?|\bdr\b|disaster recovery|failover|high availability|topology/i, ['S66_REGION_TOPOLOGY']],
  [/priorit|\bslas?\b|\bslos?\b|response time|support levels?/i, ['S66_PRIORITY_TABLE', 'S66_PLAIN_TABLE']],
  [/runbook|run book|known issues|troubleshoot|day-?2/i, ['S66_ISSUE_ROWS', 'S66_STEP_COLUMNS']],
  [/cut-?over|migration steps|onboarding steps|\bsteps\b/i, ['S66_STEP_COLUMNS', 'S66_LABEL_ROWS']],
  [/\bvs\.?\b|versus|compared|today and|before and after|manual .* automat/i, ['S66_TWO_MODE_COMPARE', 'S66_CROSS_CHECK', 'S66_COMPARE_STATUS_TABLE']],
  [/\brisks?\b|mitigat/i, ['S66_ISSUE_ROWS']],
  [/needs?|requirements/i, ['S66_NEED_MAPPING']],
  [/security|controls|protect/i, ['S66_LAYER_STACK', 'S66_THREE_CARD_COLUMNS', 'S66_QUAD_RULE_CARDS']],
  [/next step|decision|get started|getting started/i, ['S66_EXPLAINER_SPLIT', 'S66_DARK_STATEMENT']],
  [/levels?|pathway|learning/i, ['S66_LEVEL_CARDS', 'S66_RISING_STAGES']],
  [/journey|transition|from kickoff|end-to-end/i, ['S66_U_JOURNEY', 'S66_PHASE_TIMELINE_BARS']],
  [/phases?|roadmap|timeline|plan\b/i, ['S66_PHASE_TIMELINE_BARS', 'S66_LABEL_ROWS']],
  [/tiers?|packages?|offers?|offerings?/i, ['S66_OFFER_TIERS', 'S66_LEVEL_CARDS']],
  [/results?|tests?|scorecard|proved|validation/i, ['S66_SCORECARD', 'S66_CHART_INSIGHT', 'S66_NUMBERED_CARD_GRID']],
  [/\bcode\b|script|configur|setting/i, ['S66_CODE_PROBLEM_SOLUTION', 'S66_TABLE_NOTES']],
  [/governance|operating model|how we run|support model|team/i, ['S66_SERVICE_HUB_DARK', 'S66_LIFECYCLE_COLUMNS']]
];
function solutionKeywordDesigns_(words) {
  const out = [];
  SOLUTION_KEYWORD_DESIGNS_.forEach(function (row) { if (row[0].test(String(words || ''))) row[1].forEach(function (t) { if (out.indexOf(t) === -1) out.push(t); }); });
  return out;
}

/* ---------- 14. V.1_54: a roadmap in a Solution Deck is phases with their timing (the Gantt is a Proposal design) ---------- */
function solutionTimelineAsProcess_(sp) {
  if (!sp || String(sp.type || '').toLowerCase() !== 'timeline') return false;
  const per = Array.isArray(sp.periods) ? sp.periods.map(String) : [];
  let items = Array.isArray(sp.items) ? sp.items.filter(Boolean) : [];
  if (!items.length && Array.isArray(sp.lanes)) {
    items = sp.lanes.filter(Boolean).map(function (l) {
      const bars = Array.isArray(l.bars) ? l.bars : [];
      const a = bars.length ? Math.min.apply(null, bars.map(function (b) { return +b.start || 1; })) : 0;
      const b = bars.length ? Math.max.apply(null, bars.map(function (x) { return +x.end || +x.start || 1; })) : 0;
      const timing = per.length && a ? (per[a - 1] || '') + (b && b !== a && per[b - 1] ? '–' + per[b - 1] : '') : '';
      return { title: String(l.name || l.title || ''), timing: timing, points: bars.map(function (x) { return String(x.label || ''); }).filter(Boolean) };
    });
  }
  if (!items.length && Array.isArray(sp.points)) items = sp.points.map(function (p) { return { title: String(p) }; });
  items = items.map(function (it) {
    if (typeof it === 'string') return { title: it };
    return Object.assign({}, it, { title: it.title || it.label || it.name, timing: it.timing || it.date || it.period || it.when || '' });
  });
  ['lanes', 'periods', 'tasks', 'workstreams'].forEach(function (k) { delete sp[k]; });
  sp.type = 'process';
  sp.items = items;
  if (sp.design && !/^S66_/.test(String(sp.design))) delete sp.design;
  return true;
}

// V.1_54: a requested topic counts as covered by a slide whose title holds most of the topic's own words (deck 25 replay:
// "Security controls (IAM / VPC Service Controls / CMEK)" and "Securing data with defense-in-depth" became two slides)
function solutionTopicCovered_(slides, topic) {
  if (typeof topicStems_ !== 'function') return false;
  // V.1_56 (deck 29): one shared word ("architecture" in a data-flow slide's message) no longer covers a topic: most of
  // the topic's words must be on one slide, or the product it names must be in that slide's title
  const ts = Object.keys(topicStems_(String(topic || '').replace(/\([^)]*\)/g, ' ').toLowerCase(), false)).filter(function (w) { return !/^(throu|using|via|into|with|known)$/.test(w); });
  const products = (String(topic || '').replace(/\([^)]*\)/g, ' ').match(/\b(?:[A-Z][a-z]*[A-Z][\w]*|[A-Za-z]+\/[A-Za-z]+|Dataflow|Dataproc|Terraform|Ansible|Looker|Vertex AI|Kubernetes|Pub\/Sub|BigQuery|Spanner|Bigtable|Firestore|Cloud SQL|AlloyDB|CMEK|IAM|VPC|GKE|Kafka)\b/g) || [])
    .filter(function (w) { return !/^(I|A|DR|AI)$/.test(w); });
  // the next step is covered by any slide that proposes one (a workshop, a pilot, a decision to start)
  if (/next steps?|getting started|how to start/i.test(topic) && (slides || []).some(function (o) {
    return o && o.type !== 'section' && /next step|workshop|initiate|get(ting)? started|kick-?off|start with|first step|decision|approve/i.test(String(o.title || ''));
  })) return true;
  if (!ts.length && !products.length) return false;
  const need = ts.length <= 2 ? ts.length : Math.ceil(ts.length * 0.6);
  return (slides || []).some(function (o) {
    if (!o || o.type === 'section') return false;
    const ss = topicStems_([o.title, o.message].filter(Boolean).join(' ').toLowerCase(), false);   // (lower case: a first word is not a name)
    const hits = ts.filter(function (w) { return ss[w]; }).length;
    if (ts.length && hits >= need) return true;
    if (ss['#security'] && ts.indexOf('#security') !== -1 && hits >= need - 1) return true;   // a security slide covers the security controls
    const title = String(o.title || '').toLowerCase();
    // the product the topic names is the slide's subject - unless the topic also names a kind of slide (layers,
    // architecture, runbooks, priorities, regions...): then those words must be there too
    if (ts.some(function (w) { return /^(layer|archi|runbo|prior|#goal|regio|desig|compa|roadm|phase|steps?|next|#secur|contr|sizin|confi|thres)/.test(w); })) return false;
    return products.some(function (p) { return title.indexOf(p.toLowerCase()) !== -1; });
  });
}

/* ---------- 15. V.1_55: the deck 26 fixes on written slides ---------- */
// a body slide Gemini types as a frame (agenda, cover, closing, section) is a content slide: frames are the code's own
function solutionBodyTypes_(slides, longPart) {
  const n = (slides || []).length;
  let changed = 0;
  (slides || []).forEach(function (sp, i) {
    const t = String((sp && sp.type) || '').toLowerCase();
    if (['agenda', 'cover', 'closing', 'section', 'divider', 'title'].indexOf(t) === -1) return;
    if (!longPart && ((t === 'cover' && i === 0) || (t === 'agenda' && i <= 1) || (t === 'closing' && i === n - 1))) return;
    sp.type = Array.isArray(sp.items) && sp.items.length ? 'cards' : 'bullets';
    if (sp.lockTag) delete sp.lockTag;
    if (sp.reference) sp.reference = null;
    changed++;
  });
  return changed;
}
// sources belong in the notes, not in a "Source" column; market sizes stay out of a deck that does not ask for them
var SOLUTION_MARKET_RE_ = /\b(market size|market value|market (is|will|to) (reach|grow)|projected market|cagr|tam\b|sam\b)/i;
function solutionCleanFigures_(sp, prompt) {
  if (!sp || typeof sp !== 'object') return 0;
  let n = 0;
  if (Array.isArray(sp.columns) && Array.isArray(sp.rows)) {
    const drop = sp.columns.map(function (c, j) { return /^\s*(sources?|references?|refs?|citation)\s*$/i.test(String(c && typeof c === 'object' ? (c.title || c.label || '') : c)) ? j : -1; }).filter(function (j) { return j >= 0; });
    if (drop.length && sp.columns.length - drop.length >= 2) {
      const src = [];
      sp.rows.forEach(function (r) { if (Array.isArray(r)) drop.forEach(function (j) { if (r[j]) src.push(String(r[j])); }); });
      sp.columns = sp.columns.filter(function (c, j) { return drop.indexOf(j) === -1; });
      sp.rows = sp.rows.map(function (r) { return Array.isArray(r) ? r.filter(function (c, j) { return drop.indexOf(j) === -1; }) : r; });
      const uniq = src.filter(function (x, k) { return src.indexOf(x) === k; });
      if (uniq.length) sp.notes = String(sp.notes || '') + '\nSources: ' + uniq.join(', ') + '.';
      n++;
    }
  }
  if (!SOLUTION_MARKET_RE_.test(String(prompt || '')) && !/\bmarket\b/i.test(String(prompt || ''))) {
    const bad = function (x) { return SOLUTION_MARKET_RE_.test(typeof x === 'string' ? x : JSON.stringify(x || '')); };
    if (Array.isArray(sp.rows)) { const before = sp.rows.length; sp.rows = sp.rows.filter(function (r) { return !bad(r); }); if (sp.rows.length !== before) n++; }
    if (Array.isArray(sp.items)) { const before = sp.items.length; sp.items = sp.items.filter(function (it) { return !bad(it); }); if (sp.items.length !== before) n++; }
    if (Array.isArray(sp.points)) sp.points = sp.points.filter(function (p) { return !bad(p); });
  }
  return n;
}
// response, resolution, RTO and RPO times the request did not give are proposals: the presenter confirms them
function solutionGivenTimes_(slides, prompt, sources) {
  const own = String(prompt || '') + ' ' + String((sources && sources.text) || '');
  let n = 0;
  (slides || []).forEach(function (sp) {
    // V.1_56 (deck 29): any slide whose title or text speaks of service levels or recovery (a "DR region" slide too), and
    // times written as "15-min", "<1 hour", "RPO < 15 minutes"
    if (!sp || typeof sp !== 'object') return;
    // "100% uptime" is a promise nobody can make: the slide says high availability instead
    (function walk(o) { Object.keys(o).forEach(function (k) { if (k === 'notes' || k === 'reference') return; const v = o[k];
      if (typeof v === 'string') o[k] = v.replace(/\b100\s*%\s*(?:uptime|availability)/gi, 'high availability');
      else if (v && typeof v === 'object') walk(v); }); })(sp);
    const body = JSON.stringify([sp.items, sp.rows, sp.points, sp.lead, sp.takeaway, sp.statement, sp.text, sp.regions, sp.footer, sp.callout, sp.note]);
    if (!/\b(priorit\w*|slas?|slos?|support|rto|rpo|recovery|response|resolution|dr|failover|uptime|availability)\b/i.test(String(sp.title || '') + ' ' + body)) return;
    if (/^(cover|agenda|closing|section|template)$/i.test(String(sp.type || ''))) return;
    const times = (body.match(/\b\d+(?:[.,]\d+)?\s*-?\s*(?:min(?:ute)?s?|hours?|hrs?|h|days?|business days?|seconds?|s)\b|\b\d+(?:\.\d+)?\s*%\s*(?:uptime|availability)/gi) || []);
    const missing = times.filter(function (x) { const d = (x.match(/\d+(?:[.,]\d+)?/) || [''])[0]; return d && !new RegExp('(^|[^0-9.])' + d.replace('.', '[.,]') + '(?![0-9])').test(own); });
    if (missing.length && !/confirm them before sharing/.test(String(sp.notes || ''))) {
      sp.notes = String(sp.notes || '') + '\nThe times on this slide (' + missing.slice(0, 4).join(', ') + ') are proposals, not given in the request: confirm them before sharing.';
      n++;
    }
  });
  return n;
}
// the lead never repeats the plan's brief (deck 26 slide 8 showed "The components and how data flows between them.")
function solutionLeadNotBrief_(slides, plan) {
  const norm = function (t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  const briefs = {};
  Object.keys(SOLUTION_BACKLOG_).forEach(function (k) { SOLUTION_BACKLOG_[k].forEach(function (b) { briefs[norm(b.brief)] = 1; }); });
  ((plan && plan.slides) || []).forEach(function (o) { if (o && o.brief) briefs[norm(o.brief)] = 1; if (o && o.lead) briefs[norm(o.lead)] = 1; if (o && o.message) briefs[norm(o.message)] = 1; });
  let n = 0;
  (slides || []).forEach(function (sp) { if (sp && sp.lead && briefs[norm(sp.lead)]) { delete sp.lead; n++; } });
  return n;
}
// bullets of three or four words each are labels without their text: they become items, and the thin-slide fill writes the text
function solutionThinBullets_(sp) {
  if (!sp || String(sp.type || '').toLowerCase() !== 'bullets' || !Array.isArray(sp.points)) return false;
  const pts = sp.points.map(function (p) { return typeof p === 'string' ? p : String((p && (p.title || p.text)) || ''); }).filter(Boolean);
  if (pts.length < 3 || pts.length > 6 || !pts.every(function (p) { return p.split(/\s+/).length <= 5; })) return false;
  sp.type = 'cards';
  sp.items = pts.map(function (p) { return { title: solutionLabelCase_(p.replace(/[.;:]+$/, '')), text: '' }; });
  delete sp.points;
  sp.reference = null;
  return true;
}

/* ---------- 16. V.1_56: the deck 28 / 29 fixes ---------- */
// slides that cover a topic the request lists are never removed by the outline checks (deck 29 lost the reference
// architecture, the Terraform layers and the next step that way); the first slide per topic is kept
function solutionProtectedSlides_(slides, prompt) {
  const keep = {};
  const topics = typeof requestedTopics_ === 'function' ? requestedTopics_(prompt) : [];
  topics.forEach(function (t) {
    for (let i = 0; i < (slides || []).length; i++) {
      const o = slides[i];
      if (!o || o.type === 'section') continue;
      if (!solutionTopicCovered_([o], t)) continue;
      // the same comparison twice: the first one is the topic's slide, a later copy can go
      if (String(o.type || '').toLowerCase() === 'comparison' && slides.slice(0, i).some(function (p) { return p && String(p.type || '').toLowerCase() === 'comparison'; })) break;
      keep[i] = 1; break;
    }
  });
  (slides || []).forEach(function (o, i) { if (o && /\bnext steps?\b|getting started|the ask\b/i.test(String(o.title || ''))) keep[i] = 1; });
  return keep;
}

// V.1_56: text a slide holds in fields the designs do not name ("controls", "layers", "groups", "pillars"...), as headed groups
var SOLUTION_META_KEYS_ = { title: 1, lead: 1, subtitle: 1, notes: 1, reference: 1, type: 1, design: 1, deckLibrary: 1, dark: 1, cobrand: 1, clientLogo: 1,
  icon: 1, material: 1, fact_tags: 1, lockTag: 1, section: 1, number: 1, sectionStyle: 1, code: 1, items: 1, points: 1, left: 1, right: 1, columns: 1,
  rows: 1, statement: 1, text: 1, takeaway: 1, brief: 1, message: 1, tone: 1, status: 1 };
function solutionOtherTexts_(sp) {
  const out = [];
  const real = function (t) { return /[A-Za-z]{3}/.test(String(t || '')); };
  const head = function (o) { const k = ['title', 'name', 'label', 'layer', 'control', 'heading', 'area']; for (let i = 0; i < k.length; i++) if (typeof o[k[i]] === 'string' && real(o[k[i]])) return o[k[i]]; return ''; };
  const texts = function (v, acc, skip) {
    if (typeof v === 'string') { if (real(v) && v !== skip) acc.push(v.trim()); return acc; }
    if (Array.isArray(v)) { v.forEach(function (x) { texts(x, acc, skip); }); return acc; }
    if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (k !== 'icon' && k !== 'status') texts(v[k], acc, skip); });
    return acc;
  };
  Object.keys(sp || {}).forEach(function (k) {
    if (SOLUTION_META_KEYS_[k]) return;
    const v = sp[k];
    if (Array.isArray(v)) v.forEach(function (x) {
      if (x && typeof x === 'object' && !Array.isArray(x)) { const h = head(x); out.push({ title: h, points: texts(x, [], h) }); }
      else if (real(x)) out.push({ title: '', points: texts(x, []) });
    });
    else if (v && typeof v === 'object') { const h = head(v); out.push({ title: h, points: texts(v, [], h) }); }
    else if (typeof v === 'string' && real(v) && v.split(/\s+/).length >= 4) out.push({ title: '', points: [v] });
  });
  return out.filter(function (g) { return g.title || g.points.length; });
}
function solutionTextCount_(sp) {
  return solutionOtherTexts_(sp).reduce(function (a, g) { return a + (g.title ? 1 : 0) + g.points.length; }, 0);
}

// V.1_56 (deck 28: "IoT Core"): products Google has retired are never proposed
var SOLUTION_RETIRED_ = [
  [/\b(?:Google\s+)?(?:Cloud\s+)?IoT\s+Core\b/gi, 'IoT gateway'],
  [/\b(?:Google\s+)?Container\s+Registry\b/g, 'Artifact Registry'],
  [/\b(?<!Agent\s)(?:Google\s+)?(?:Cloud\s+)?AI\s+Platform\b(?!\s+Notebooks)/g, 'Vertex AI'],
  [/\bCloud\s+Debugger\b/g, 'Cloud Logging'],
  [/\bCloud\s+Source\s+Repositories\b/g, 'a Git repository']
];
// (decks 28-29: "66degrees operates a follow-the-sun model", "worked by expert engineers day or night"): claims about
// 66degrees that the request or the approved facts do not make are left out; filler tails ("This precision is vital.") go
var SOLUTION_BRAND_CLAIM_RE_ = /\b(follow[- ]the[- ]sun|24\s*\/\s*7|24x7|around the clock|day or night|global team|certified (?:experts|engineers)|years of experience|award[- ]winning|industry[- ]leading)\b/i;
var SOLUTION_FILLER_TAIL_RE_ = /^(this|these|that|it)\b[^.!?]{0,90}\b(is|are|was|remains)\s+(crucial|vital|essential|key|critical|paramount|important|fundamental)\b[^.!?]{0,40}[.!]$|^(this|these)\s+(\w+\s+){0,3}(streamlines?|ensures?|enables?|guarantees?|empowers?)\b[^.!?]{0,60}[.!]$/i;
function solutionFactsClean_(sp, prompt, facts) {
  if (!sp || typeof sp !== 'object') return 0;
  const allowed = (String(prompt || '') + ' ' + JSON.stringify(facts || [])).toLowerCase();
  let n = 0;
  const clean = function (str, isNotes) {
    let t = String(str);
    SOLUTION_RETIRED_.forEach(function (r) { const u = t.replace(r[0], r[1]); if (u !== t) { n++; t = u; } });
    const parts = t.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const keep = parts.filter(function (x, i) {
      const m = x.match(SOLUTION_BRAND_CLAIM_RE_);
      if (m && (/66\s*degrees|66°/i.test(x) || isNotes) && allowed.indexOf(m[1].toLowerCase()) === -1) return false;   // (the notes speak for 66degrees)
      if (!isNotes && parts.length > 1 && i > 0 && SOLUTION_FILLER_TAIL_RE_.test(x.trim())) return false;
      return true;
    });
    if (keep.length && keep.length < parts.length) { n++; t = keep.join(' '); }
    return t;
  };
  (function walk(o) {
    Object.keys(o).forEach(function (k) {
      if (k === 'reference' || k === 'design' || k === 'type' || k === 'icon' || k === 'code' || k === 'fact_tags') return;
      const v = o[k];
      if (typeof v === 'string') o[k] = clean(v, k === 'notes');
      else if (Array.isArray(v)) v.forEach(function (x, i) { if (typeof x === 'string') v[i] = clean(x, false); else if (x && typeof x === 'object') walk(x); });
      else if (v && typeof v === 'object') walk(v);
    });
  })(sp);
  return n;
}
// a closing line that is a slogan ("Let's build the future of rail maintenance, together.") says what comes next instead
function solutionClosingLine_(text) {
  const t = String(text || '').trim();
  if (!t || /\b(future|together|journey|transform\w*|unlock|empower\w*|revolution\w*|reimagin\w*|let'?s build|partner(ship)? for)\b/i.test(t)) return 'Questions and next steps';
  return t;
}
