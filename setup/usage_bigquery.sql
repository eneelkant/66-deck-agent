-- 66° Deck Agent usage log (V.1_62) - one-time BigQuery setup
-- Project: d-marketing-ai-applications   Dataset: deck_agent
-- Run the whole file once in the BigQuery console (project d-marketing-ai-applications selected).
-- Safe to run again: tables are only created if missing, views are replaced.
-- Location: US. If the data must stay in India, change 'US' to 'asia-south1' BEFORE the first run (it cannot be changed later).

-- 1. Dataset
CREATE SCHEMA IF NOT EXISTS `d-marketing-ai-applications.deck_agent`
OPTIONS (location = 'US', description = '66° Deck Agent usage log');

-- 2. Raw log: one row per run part per Gemini model, written by the add-on
CREATE TABLE IF NOT EXISTS `d-marketing-ai-applications.deck_agent.deck_usage` (
  run_id         STRING    NOT NULL OPTIONS (description = 'One deck run; all its parts and models share it'),
  part           INT64              OPTIONS (description = 'Part of the run (long decks run in parts of up to ~4.5 minutes)'),
  ts             TIMESTAMP NOT NULL OPTIONS (description = 'When the part finished (UTC; the views show IST)'),
  name           STRING             OPTIONS (description = 'Display name from the Google profile'),
  email          STRING,
  mode           STRING             OPTIONS (description = 'Create, Rebrand or Flowchart'),
  deck_category  STRING             OPTIONS (description = 'Presentation type picked in the panel'),
  deck_name      STRING,
  deck_url       STRING,
  slides         INT64              OPTIONS (description = 'Slides made or rebranded so far'),
  model          STRING             OPTIONS (description = 'Gemini model; none = the part made no Gemini call'),
  calls          INT64,
  input_tokens   INT64,
  output_tokens  INT64              OPTIONS (description = 'Includes thinking tokens (billed as output)'),
  total_tokens   INT64,
  duration_sec   FLOAT64            OPTIONS (description = 'Duration of this part (same on every model row of the part)'),
  status         STRING             OPTIONS (description = 'continuing, done, failed or cancelled'),
  agent_version  STRING
)
PARTITION BY DATE(ts)
CLUSTER BY email, model
OPTIONS (description = '66° Deck Agent token usage, written by the add-on');

-- 3. Prices (USD per 1 million tokens). Fill in once, add a new row with a new effective_from when Google changes a price.
CREATE TABLE IF NOT EXISTS `d-marketing-ai-applications.deck_agent.model_rates` (
  model             STRING  NOT NULL,
  input_usd_per_1m  NUMERIC NOT NULL,
  output_usd_per_1m NUMERIC NOT NULL,
  effective_from    DATE    NOT NULL
);
-- Example (replace the 0 values with the current Vertex AI prices, then run):
-- INSERT INTO `d-marketing-ai-applications.deck_agent.model_rates` VALUES
--   ('gemini-4-argon',         0, 0, DATE '2026-01-01'),
--   ('gemini-3.8-flash',       0, 0, DATE '2026-01-01'),
--   ('gemini-3.1-flash-image', 0, 0, DATE '2026-01-01');

-- 4. Every row with its approximate cost (the price in force on the run's date, IST)
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_usage_cost` AS
WITH rates AS (
  SELECT model, input_usd_per_1m, output_usd_per_1m, effective_from,
         LEAD(effective_from) OVER (PARTITION BY model ORDER BY effective_from) AS effective_to
  FROM `d-marketing-ai-applications.deck_agent.model_rates`
)
SELECT
  u.run_id, u.part,
  DATETIME(u.ts, 'Asia/Kolkata') AS ts_ist,
  u.name, u.email, u.mode, u.deck_category, u.deck_name, u.deck_url, u.slides,
  u.model, u.calls, u.input_tokens, u.output_tokens, u.total_tokens,
  u.duration_sec, u.status, u.agent_version,
  ROUND(CAST((u.input_tokens * r.input_usd_per_1m + u.output_tokens * r.output_usd_per_1m) / 1000000 AS FLOAT64), 4) AS approx_cost_usd
FROM `d-marketing-ai-applications.deck_agent.deck_usage` AS u
LEFT JOIN rates AS r
  ON r.model = u.model
 AND DATE(u.ts, 'Asia/Kolkata') >= r.effective_from
 AND (r.effective_to IS NULL OR DATE(u.ts, 'Asia/Kolkata') < r.effective_to);

-- 5. One row per run and model (parts added together; status, slides and duration of the whole run)
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_runs` AS
WITH parts AS (
  SELECT run_id, part, MAX(duration_sec) AS part_sec
  FROM `d-marketing-ai-applications.deck_agent.deck_usage`
  GROUP BY run_id, part
),
run AS (
  SELECT
    u.run_id,
    ARRAY_AGG(u.status ORDER BY u.part DESC, u.ts DESC LIMIT 1)[OFFSET(0)] AS run_status,
    MAX(u.slides) AS run_slides,
    MIN(DATETIME(u.ts, 'Asia/Kolkata')) AS first_part_ist,
    MAX(DATETIME(u.ts, 'Asia/Kolkata')) AS finished_ist,
    COUNT(DISTINCT u.part) AS parts
  FROM `d-marketing-ai-applications.deck_agent.deck_usage` AS u
  GROUP BY u.run_id
),
dur AS (SELECT run_id, SUM(part_sec) AS run_sec FROM parts GROUP BY run_id)
SELECT
  c.run_id,
  run.finished_ist AS ts_ist,
  ANY_VALUE(c.name) AS name, ANY_VALUE(c.email) AS email,
  ANY_VALUE(c.mode) AS mode, ANY_VALUE(c.deck_category) AS deck_category,
  ANY_VALUE(c.deck_name) AS deck_name, ANY_VALUE(c.deck_url) AS deck_url,
  run.run_slides AS slides,
  c.model,
  SUM(c.calls) AS calls,
  SUM(c.input_tokens) AS input_tokens, SUM(c.output_tokens) AS output_tokens, SUM(c.total_tokens) AS total_tokens,
  ROUND(SUM(c.approx_cost_usd), 4) AS approx_cost_usd,
  dur.run_sec AS duration_sec,
  run.parts,
  run.run_status AS status,
  MAX(c.agent_version) AS agent_version
FROM `d-marketing-ai-applications.deck_agent.v_usage_cost` AS c
JOIN run USING (run_id)
JOIN dur USING (run_id)
GROUP BY c.run_id, c.model, run.finished_ist, run.run_slides, dur.run_sec, run.parts, run.run_status;

-- 6. Per user per day (IST)
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_daily_user` AS
SELECT
  DATE(r.ts_ist) AS day,
  ANY_VALUE(r.name) AS name,
  r.email,
  COUNT(DISTINCT r.run_id) AS runs,
  COUNT(DISTINCT IF(r.status = 'done', r.run_id, NULL)) AS decks_done,
  COUNT(DISTINCT IF(r.status = 'failed', r.run_id, NULL)) AS failed,
  COUNT(DISTINCT IF(r.status = 'cancelled', r.run_id, NULL)) AS cancelled,
  STRING_AGG(DISTINCT IF(r.model = 'none', NULL, r.model), ', ') AS models_used,
  SUM(r.input_tokens) AS input_tokens,
  SUM(r.output_tokens) AS output_tokens,
  SUM(r.total_tokens) AS total_tokens,
  ROUND(SUM(r.approx_cost_usd), 2) AS approx_cost_usd
FROM `d-marketing-ai-applications.deck_agent.v_runs` AS r
GROUP BY day, r.email;

-- 7. Monthly summaries
CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_summary_model` AS
SELECT
  FORMAT_DATETIME('%Y-%m', ts_ist) AS month, model,
  COUNT(DISTINCT email) AS users, COUNT(DISTINCT run_id) AS runs, SUM(calls) AS calls,
  SUM(total_tokens) AS total_tokens, ROUND(SUM(approx_cost_usd), 2) AS approx_cost_usd
FROM `d-marketing-ai-applications.deck_agent.v_runs`
WHERE model != 'none'
GROUP BY month, model;

CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_summary_user` AS
SELECT
  FORMAT_DATETIME('%Y-%m', ts_ist) AS month, ANY_VALUE(name) AS name, email,
  COUNT(DISTINCT run_id) AS runs,
  COUNT(DISTINCT IF(status = 'done', run_id, NULL)) AS decks_done,
  STRING_AGG(DISTINCT IF(model = 'none', NULL, model), ', ') AS models_used,
  SUM(total_tokens) AS total_tokens, ROUND(SUM(approx_cost_usd), 2) AS approx_cost_usd
FROM `d-marketing-ai-applications.deck_agent.v_runs`
GROUP BY month, email;

CREATE OR REPLACE VIEW `d-marketing-ai-applications.deck_agent.v_summary_category` AS
SELECT
  FORMAT_DATETIME('%Y-%m', ts_ist) AS month, mode, deck_category,
  COUNT(DISTINCT run_id) AS runs, COUNT(DISTINCT email) AS users,
  SUM(total_tokens) AS total_tokens, ROUND(SUM(approx_cost_usd), 2) AS approx_cost_usd
FROM `d-marketing-ai-applications.deck_agent.v_runs`
GROUP BY month, mode, deck_category;

-- 8. V.1_64: the slide log (also in setup/slide_log_bigquery.sql)
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
