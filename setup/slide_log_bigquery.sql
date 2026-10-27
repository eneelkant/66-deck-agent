-- 66° Deck Agent slide log (V.1_64) - one-time BigQuery setup, in the same dataset as the usage log
-- Run once in the BigQuery console with project d-marketing-ai-applications selected. Safe to run again.

-- One row per slide drawn: what the slide asked for (spec_json), which design drew it, and what the deck check found
CREATE TABLE IF NOT EXISTS `d-marketing-ai-applications.deck_agent.deck_slides` (
  run_id         STRING    NOT NULL OPTIONS (description = 'The deck run (same run_id as deck_usage)'),
  part           INT64,
  ts             TIMESTAMP NOT NULL,
  name           STRING,
  email          STRING,
  mode           STRING    OPTIONS (description = 'Create, Rebrand or Flowchart'),
  deck_category  STRING,
  deck_url       STRING,
  slide_no       INT64,
  slide_type     STRING    OPTIONS (description = 'cards, process, comparison ... or rebrand for a restyled slide'),
  deck_library   STRING    OPTIONS (description = 'general, proposal, solution or rebrand'),
  design         STRING    OPTIONS (description = 'The design that drew the slide (base:... = a plain layout)'),
  title          STRING,
  issues         STRING    OPTIONS (description = 'What the deck check still found (comma list); empty = clean'),
  fixed          STRING    OPTIONS (description = 'What the deck check corrected by drawing the slide again'),
  fixed_from     STRING    OPTIONS (description = 'The design it replaced'),
  spec_json      STRING    OPTIONS (description = 'The slide content as the add-on drew it - replayable in the tests'),
  agent_version  STRING
)
PARTITION BY DATE(ts)
CLUSTER BY deck_library, design
OPTIONS (description = '66° Deck Agent slide log, written by the add-on');

-- Slides with a problem the check could not correct, newest first (the list to fix)
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_slide_issues` AS
SELECT DATETIME(ts, 'Asia/Kolkata') AS ts_ist, name, mode, deck_category, deck_library, deck_url, slide_no, slide_type, design, title, issues, fixed, agent_version, spec_json
FROM `d-marketing-ai-applications.deck_agent.deck_slides`
WHERE issues IS NOT NULL AND issues != '';

-- How each design does across all decks: slides drawn, slides with problems, slides the check corrected
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_design_health` AS
SELECT deck_library, design,
  COUNT(*) AS slides,
  COUNTIF(issues != '') AS with_issues,
  COUNTIF(fixed != '') AS corrected,
  ROUND(SAFE_DIVIDE(COUNTIF(issues != ''), COUNT(*)), 3) AS issue_rate,
  MAX(DATETIME(ts, 'Asia/Kolkata')) AS last_used_ist
FROM `d-marketing-ai-applications.deck_agent.deck_slides`
GROUP BY deck_library, design;
