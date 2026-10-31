# 66° Deck Agent: the deck checklist (V.1_73)

One list for every deck type. It is both the review list for people and the list of what the add-on checks by itself.
**Auto** means the add-on checks it on every slide before the slide is drawn, draws the slide again with a better
design when the check fails, and writes the result to the slide log (`deck_agent.deck_slides`).
**Test** means `npm test` checks it on every release.

## The checker (V.1_68): every slide of every deck type, including new types (HR...)

| Check | When | What happens |
|---|---|---|
| A text, heading or icon half outside its box (top, bottom or side) | before drawing | the slide is drawn again in another design |
| Fitting boxes to their text would leave a heading, text or icon behind | before drawing | the fitting is undone for that slide (`fit-reverted` in the slide log) |
| A shape or text outside the slide | before and after drawing | another design; on the real slide the shape is moved back inside |
| Another typeface than Plus Jakarta Sans | after drawing | set to Plus Jakarta Sans |
| A box much taller than its text | before drawing | reported (`hollow`) |
| "Field: x · Field: y" texts, "·" headings, the title written twice | before drawing | another design; reported |
| A topic shown twice (scope, RACI, KPIs, pricing, risks, support, team, why 66degrees, next steps) | outline | the later slide's place gets another topic |
| Release gate | every release | every design of every library and every logged / reported slide must pass; old tests are never loosened |

Everything the checker finds or corrects is in the slide log (`issues`, `fixed`) and, for a slide still wrong, in the result message.

## Every deck (General, Proposal, Solution, Rebrand redraws)

| Rule | How it is kept |
|---|---|
| A content slide always shows content under its title | Auto: `empty` |
| No part of the slide's content goes missing (at least 60% of its words are on the slide) | Auto: `lost-content` |
| Never only the headings when the slide has texts | Auto: `headings-only` |
| Points are sentences, never "a; b; c" run together | Auto: `joined-points`; Test v63 |
| No text cut short ("…") | Auto: `cut` |
| No texts on top of each other | Auto: `overlap` |
| The dark streak picture is only the transition slide, never behind content | Auto: `streak-content`; Test v63 |
| Every section break is the same transition slide (dark streaks, number, title, line) | Test v63 |
| No blank slide before the cover in a new presentation | Test v51, v63 |
| Sentence case for titles and headings; product names and real names keep their capitals; ordinary words in the request are not names | Test v59, v60, v63 |
| Plus Jakarta Sans; brand colours | Test (quality gate) |
| The same design is not repeated on nearby slides | Test v63 |
| A box is as tall as its text needs; boxes in one row are the same height; a single list is spread over its box | Auto (every slide); Test v65 |
| Bullets are real Slides bullets with the same space between points | Test v65 |
| Every word can be read: a lead-in on a dark slide takes the text's colour | Test v65 |
| Content in its real shape before drawing: a chart needs figures, notes are one text, targets are KPI tiles, a closing paragraph is the takeaway | Auto (shape check); Test v65 |
| No sentence cut in the middle; points are never run together | Test v65 |
| Nothing said twice: a caption, takeaway or callout never repeats the lead | Auto (shape check); Test v65 |
| Designs whose look names a topic (tiers, pyramid, curve) only for that topic | Auto; Test v65 |
| Thin lists get more points and short texts are lengthened before drawing | Auto (fit step); Test v65 |
| Every slide's title belongs to its content (a long deck's parts are matched to the outline by content, not position) | Auto; Test v66 |
| A slide Gemini did not write is written again, or left out - never an empty slide | Auto; Test v66 |
| Content written in a shape the deck cannot draw (a Gantt in a General deck) is shown as a table | Auto (shape check); Test v66 |
| Figures are KPI tiles, never inside a heading ("205% · ...") or buried in a sentence on a KPI slide | Auto (shape check); Test v66 |
| The speaker notes never give other figures than the slide | Auto (shape check); Test v66 |
| A why-66degrees slide states facts, not targets | Auto (shape check); Test v66 |
| A levels slide (L1-L3) shows the levels only; a stack of layers keeps every point, in order | Auto; Test v66 |
| Real icons, never "!" or "i" typed into a dot | Test v66 |
| One typeface: Plus Jakarta Sans for every text, figures and step numbers too | Test v67 |
| Texts are sentences, never records ("Scope: ... · Purpose: ..."); no "Target:" labels on a KPI slide | Auto (shape check); Test v67 |
| Topics with lists of details: icon rows or an icon grid, never a wall of bullets | Auto; Test v67 |
| Icons in brand colours; a tag is one shape with its word inside, all tags of a column the same width | Test v67 |
| The streak picture only on transition slides (a strip or band gets a stock photo, or stays Night Blue) | Test v67 |
| Everything Gemini wrote is shown: a headline figure becomes a tile, a RACI matrix a table, heading-only points get their content | Auto; Test v67 |
| No invented prices (only amounts the request gives; otherwise "Pricing is confirmed after the scoping workshop."), no 100% SLA, no chart of unrelated measures | Auto; Test v67 |
| Product and place names keep their capitals (Always On, North America); a capital after a colon | Test v67 |
| Every text starts with a capital; option texts under six words are written out in full | Auto (shape check, fill step); Test v66 |
| A box ends just under its text; the group of boxes moves down a little instead of stretching | Auto; Test v67 |

## Every deck: the agenda

| Rule | How it is kept |
|---|---|
| The agenda lists the numbered sections only (no Introduction or Thank you rows), in short and long decks | Test v34, v35, v65 |
| Up to 6 sections: the spiral agenda; 7 or more: the deck's list design; no "slides 3–9" ranges | Auto; Test v42, v66 |

## V.1_77 and the deck-48 fixes: every deck type

| Rule | How it is kept |
|---|---|
| A slide is made pale for a stock picture only once the picture is placed (a white title on a band stays readable) | Auto (EngineRenderer); Test v77 |
| The checker's own notes (fix names) never appear as content | Auto (Solution fallback); Test v77 |
| Each KPI tile names its own target, never another target's label | Auto (`conformKpi_`); Test v77 |
| The pricing line is put back at the end when an earlier step removed it | Auto (`finishSlides_`); Test v77 |

## The clean-up (V.1_76) and the deck-47 fixes: every deck type

| Rule | How it is kept |
|---|---|
| Money with a one-letter unit is one figure ($61.6B, $7.4M, $250K): a sourced one stays, an unsourced one goes whole | Auto (`FIG_TOKEN_RE_`); Test v76 |
| A figure word left without its figure ("Up to reduction", "down to MAPE") is repaired or its sentence goes | Auto (`fragmentRepair_`); Test v76 |
| A slide whose items or points are the request's targets is the KPI slide when the deck has none | Auto (`conformSlides_`); Test v76 |
| A client name the request also writes as a web address keeps its capital | Auto (`setRunNames_`); Test v76 |
| A heading never ends on a half phrase ("Design technical"); a shortened text is never kept when it does | Auto (fit step, `finishSlides_`); Test v76 |
| Without prices given, the pricing slide's lead says "Pricing is confirmed after the scoping workshop." | Auto (`conformPricing_`); Test v76 |
| No "guaranteeing completion" or "zero dropped requests" | Auto (`finishSlides_`); Test v76 |
| Items with a heading and a text are the slide's content; points beside them go to the takeaway or the notes | Auto (Engine rule 19); Test v76 |
| A slide left out and a short outline are written to the slide log ("left-out", "outline-short") | Auto; Test v76 |

## The last fix round (V.1_75) and the deck-46 fixes: every deck type

| Rule | How it is kept |
|---|---|
| A deck whose request gives target figures has its KPI slide; an SLA named in another slide's title does not count as the KPI slide | Auto (outline); Test v75 |
| The notes say which figures were left out and why (that line is never removed with the figures) | Auto (Engine rule 8); Test v75 |
| A section divider's title is never taken for the pricing slide; the engagement-models slide is the pricing slide | Auto (`contractKind_`); Test v75 |
| A risk's mitigation the design cannot show is written into its text ("Mitigation: ..."), not moved to the notes | Auto (render, `fix-in-text`); Test v75 |
| Support and severity tables are headed "Level / What happens" | Auto (`tableHeaders_`); Test v75 |
| A reference marker, a tag or an invisible character between two words leaves a space | Auto (`cleanText`); Test v75 |
| Step 5: only rows of boxes spread; checklists, bullets and table rows keep even spacing; only what stands under a grown row moves | Auto (`placeBody_`); Test v75 |
| At most 3 dark content slides in every deck type, also when the Solution rhythm and the design choice both add one | Auto (`solutionDarkRhythm_`, chooser); Test v75 |
| A slide Gemini wrote fills a free outline place before any slide is left out; an empty Solution KPI/timeline slide is written as cards | Auto (`matchOutline_`, fill step); Test v75 |
| A new slide goes to the section of its subject family (deployment and runbooks to operations, IAM and network to security ...) | Auto (`placeInSection_`); Test v75 |
| "Differentiators" is the why-66degrees topic; enablement / knowledge transfer / handover at most twice in a deck of 35+ | Auto (outline); Test v75 |
| Words the notes capitalise are no names when the slides write them in lower case | Auto (`namesFromNotes_`); Test v75 |
| The figures note names its sources in words; an empty figures line goes | Auto; Test v75 |
| No absolute promise in any wording ("zero message loss", "eliminate data loss", "eliminate downtime") | Auto (`finishSlides_`); Test v75 |
| A one-line divider title keeps its rule right under it (General too) | Test v75 |
| A short slide (body under ~75% of the space) gets fuller texts sized to the room, list items a point or two more; boxes still end under their text | Auto (fit step); Test v75 |

## Step 5 - the drawing (V.1_74) and the deck-45 fixes: every deck type

| Rule | How it is kept |
|---|---|
| The body starts 20-30 pt under the title or lead - never a band of empty space under the title | Auto (`placeBody_`); Test v74 |
| Free space under the body: the main row of boxes grows a little (a box still ends just under its text), rows that stand apart get more room between them | Auto; Test v58, v67, v74 |
| Only a compact design (rings, a short chain) is centred on the slide | Auto; Test v74 |
| A table heading or cell written as an object is its text - never "[object Object]" | Auto (`normalizeCells_`); Test v74 |
| A RACI written as sentences ("66degrees is Responsible for ...") becomes one role column per party; the details go to the notes | Auto (`raciFromSentences_`); Test v74 |
| The outline's KPI slide shows the request's targets as tiles, also when Gemini wrote it as lists; one KPI slide per deck (also across the parts of a long deck) | Auto (`conformSlides_`, `ctx.deckState`); Test v74 |
| A team or governance slide is never renamed "Pricing options"; a slide is pricing by its content only when no slide is titled for pricing | Auto (`contractKind_`); Test v74 |
| One target read twice from the request is one tile | Auto (`briefTargets_`); Test v74 |
| On a KPI slide no tile label says "Target" again | Auto (Engine rule 15); Test v74 |
| The request's own figures are never flagged "not found in the research sources" | Auto; Test v74 |
| Research by 66degrees itself is never a research source (66degrees facts come from the approved facts) | Auto (`weakSource_`); Test v74 |
| Titles: no full stop, no figures hung on with a dash; the gate's rewrite never moves figures into a title | Auto (`finishSlides_`, `gateApply_`); Test v74 |
| Headings in sentence case without a full stop; no step that only counts the steps; counts in titles match the slide | Auto (`finishSlides_`); Test v74 |
| Product names as Google Cloud writes them; no absolute promise ("zero data loss") | Auto (`finishSlides_`); Test v74 |
| An item that only repeats another item goes to the notes | Auto (`finishSlides_`); Test v74 |
| Points shown as one text are sentences with full stops; rows keep their column headings when drawn as text | Auto; Test v74 |
| Agenda: the spiral for up to 6 sections also with long section names (wider tags, three lines for up to five) | Test v74 |
| A divider's rule sits right under a one-line title | Test v74 |
| A Gantt legend only when the bars carry its groups | Test v74 |
| A new outline slide goes to the section it is about, before pricing and next steps | Auto (`placeInSection_`); Test v74 |
| Slides of a part that came back empty are written once more before any is left out | Auto (`longDeckStep_`); Test v74 |

## Step 4 - the checker blocks a bad slide (V.1_73) and the deck-44 fixes: every deck type

| Rule | How it is kept |
|---|---|
| A slide the checker still finds a problem on (cut, lost content or figures, out of its box, off the slide, overlapping, headings only, empty) is written again once to fit its design, then drawn with a safe layout | Gate.gs, before the notes and drawing, in short and long decks; a budget per part. Test v73 |
| The safe layout never drops a figure | Test v73 |
| Dark content slides: at most 3, never beside a dark slide or divider - also Solution decks and across parts | SolutionKit + chooser. Test v70, v73 |
| A RACI shows roles only; rows written as objects become table rows; the detail goes to the notes | Contracts (code). Test v73 |
| A risk slide shows its mitigations ("Risk: ... Mitigation: ..." fields are read) | Contracts (code). Test v73 |
| No broken text after a figure or amount is taken out | Brief.gs fragment repair, last step. Test v73 |
| Support in any wording is the support slide; testing, monitoring and security once (twice in a 35+ deck only on another angle) | Outline. Test v73 |
| Section balancing keeps a slide with the section it belongs to | Test v73 |
| Headings-only lists of up to six words get their descriptions | Test v73 |
| The request's target beats a research figure in any text; 66degrees credential counts only as approved | Test v73 |
| Each target has one slide of its own besides the KPI slide | Outline. Test v73 |

## Step 3 - each slide kind in its shape (V.1_72) and the deck-43 fixes: every deck type

| Rule | How it is kept |
|---|---|
| Gemini can be given the shape its answer must have (response schema); a call without one is unchanged; a model that refuses it is asked again without it | Brand.gs callGeminiJSON. Test v72 |
| KPI slide: the request's figures in its order, as tiles with their texts | Contracts (code). Test v72 |
| Pricing slide: its title says pricing; without prices it says "Pricing is confirmed after the scoping workshop." | Contracts (code). Test v72 |
| RACI, team, risks, next steps: written again with the schema when out of shape; used only when the answer passes | Contracts + schema. Test v72 |
| The brief is asked with its schema | Test v72 |
| A dark slide is never next to a dark divider, also across the parts of a long deck | Test v70, v72 |
| A section never has a slide's name; next steps is the last body slide; no one-word titles | Outline. Test v72 |
| The agenda is the spiral up to 6 sections (wider tags for long names) | Test v69, v72 |
| 66degrees credentials only as approved (600+ certifications, 6 specializations, no ranking claims) | Test v71, v72 |
| Risk tables never cut their mitigations; no non-English words; no "·" headings in regions or links | Test v72 |

## Step 2 - the outline (V.1_71) and the deck-42 fixes: every deck type

| Rule | How it is kept |
|---|---|
| A topic shown once (scope, RACI, KPIs, pricing, risks, support, team, why 66degrees, next steps, timeline, sizing) has exactly one slide | One shared topic list for every outline step; a last check removes any repeat. Test v68, v71 |
| A slide added for a requested topic has a real title ("Key risks and how we mitigate them", never "Risks") | Test v71 |
| Sections are named after topics, never after a target or a figure | Outline prompt + rename. Test v71 |
| The KPI slide keeps its figures (no design that hides them) | Engine. Test v71 |
| Speaker notes and design names (P66_, S66_, 66D_) never become slide text | Engine. Test v71 |
| No status words ("Amber", "Status: Grey") in a text | Test v71 |
| No word broken inside a tag or a text box | Text smaller until the longest word fits; the checker reports a broken word. Test v71 |
| The figure check never breaks a sentence; ranges count as one figure; technical settings are not claims | Test v71 |
| "Pricing is confirmed after the scoping workshop" only on the pricing slide | Test v71 |
| The request's target beats a research figure for the same measure; targets only on the KPI slide; a time as a target needs a source | Test v71 |
| A RACI keeps every party's column | Test v71 |
| What a design cannot show goes to the speaker notes | Engine + renderer. Test v71 |
| One figure per 66degrees credential (600+ certifications, 1000+ projects, from the approved facts) | Test v71 |

## Step 1 - the brief (V.1_70): every deck type

| Rule | How it is kept |
|---|---|
| The request is read once into a fixed brief: client, slide count, topics, figures in order, prices (or none) | Gemini (temperature 0), checked by the code; the code alone when Gemini is not reachable. Test v70 |
| Every prompt that writes slides gets the brief; every part of a long deck uses the same brief | Test v70 |
| A figure on a slide comes from the brief, the request, the attached files, the approved facts or the research | Auto: the figure check, before and after the fill steps; what is left out is listed in the speaker notes. Test v70 |
| A research figure on a slide names its source in the speaker notes | Auto. Test v70 |
| Never 100% uptime, availability or SLA; no "Amber." / "Green." left in a text | Auto. Test v70 |
| KPI tiles: the brief's figures in the request's order, the label does not repeat the figure, every tile has its text | Auto. Test v69, v70 |
| One measure, one figure in the whole deck (the request's figure wins) | Auto; otherwise a "Check before sharing" note. Test v70 |
| Dark content slides: at most 3, never next to another dark slide or a dark divider | Design choice rule. Test v70 |

## The request is the source (V.1_69): every deck type

| Rule | How it is kept |
|---|---|
| No shape is placed at a position that is not a number (designs with circles or arcs) | Auto: `off-slide` and the safety net; Test v69 |
| Agenda: the spiral for up to 6 sections, also when the sections have descriptions; the list design for 7 or more | Test v69 |
| KPI tiles are the figures the request wrote, in its order; never 100% SLA, never the same figure twice | Auto (plan and draw); Test v69 |
| A RACI is a table: Workstream, then Responsible / Accountable / Consulted / Informed; team structure and RACI are two slides | Auto; Test v69 |
| No unnumbered workstream dividers in a Proposal Deck | Test v69 |
| Notes beside numbered groups are bullets, not a second set of numbers | Test v69 |
| Scope, RACI, KPIs, pricing, risks, support, team, why 66degrees, next steps, timeline, sizing: one slide each | Auto (outline); Test v68, v69 |
| Every topic the request names has a slide, and the deck has exactly the slide count asked | Auto (outline); Test v69 |
| Pricing tables are left-aligned; no amount the request did not give | Test v67, v69 |
| "Target:" only on a KPI slide; one target among facts reads "(target)" | Auto; Test v69 |
| A slide is called "benchmarks" only when it shows figures | Auto; Test v69 |

## Proposal and Solution decks

| Rule | How it is kept |
|---|---|
| Every content slide is drawn in a design of its own library, never a plain General layout | Auto: `plain-layout`; Test v63, v64 |
| Content in its real shape: two sides as a comparison, rows as a table, two teams as the team structure, actions as numbered rows, figures as KPI tiles | Auto (redraw); Test v63 |
| The agenda banner spans the slide; the agenda lists the numbered sections only | Test v63 |
| Client logo on content slides of a Proposal Deck, never in a Solution Deck | Test v37, v53 |

## Rebrand

| Rule | How it is kept |
|---|---|
| The deck's words and dates do not change | Test v59, v60 |
| Plus Jakarta Sans only; dark panels stay dark with white text | Test v59, v60 |
| No overlapping or unreadable text | Auto: the rebrand check (`overlap`, `unreadable`, `outside`) goes to the slide log |
| The 66° mark takes the old mark's place and never covers the footer text | Test v60 |

## When a slide is still wrong

1. In BigQuery, `deck_agent.v_slide_issues` lists the slides the check could not correct (with their content).
2. Save the rows as JSON and run `node scripts/replay-slides.js results.json --save`: each slide becomes a file in
   `tests/fixtures/reported/`.
3. The fix is done when `npm test` passes: every file in that folder must come out clean, so the slide stays fixed.
