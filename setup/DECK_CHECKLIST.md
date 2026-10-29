# 66° Deck Agent: the deck checklist (V.1_70)

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
