# 66° Deck Agent: the deck checklist (V.1_64)

One list for every deck type. It is both the review list for people and the list of what the add-on checks by itself.
**Auto** means the add-on checks it on every slide before the slide is drawn, draws the slide again with a better
design when the check fails, and writes the result to the slide log (`deck_agent.deck_slides`).
**Test** means `npm test` checks it on every release.

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
