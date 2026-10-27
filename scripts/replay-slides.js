#!/usr/bin/env node
"use strict";
/*
 * V.1_64 — replay slides from the slide log (BigQuery deck_agent.deck_slides) with the current code.
 *
 * 1. In BigQuery run, for example:
 *      SELECT run_id, slide_no, title, issues, spec_json FROM `d-marketing-ai-applications.deck_agent.v_slide_issues`
 *      WHERE ts_ist > DATETIME_SUB(CURRENT_DATETIME('Asia/Kolkata'), INTERVAL 7 DAY)
 *    and save the results as JSON (Save results -> JSON (local file)).
 * 2. node scripts/replay-slides.js results.json            shows each slide's design and what the check finds now
 *    node scripts/replay-slides.js results.json --save     also keeps each slide as a test in tests/fixtures/reported/
 * Every file in tests/fixtures/reported/ is drawn by `npm test` (tests/v64.test.js): once fixed, a slide stays fixed.
 */
const fs = require("fs");
const path = require("path");
const { loadAddon, replay, ROOT } = require("../tests/fixtures/load-addon.js");

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/replay-slides.js <results.json> [--save]"); process.exit(1); }
const save = process.argv.includes("--save");
const raw = fs.readFileSync(file, "utf8").trim();
const rows = raw.startsWith("[") ? JSON.parse(raw) : raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));   // array or one row per line
const sb = loadAddon();
let bad = 0;
rows.forEach((r, i) => {
  let spec;
  try { spec = typeof r.spec_json === "string" ? JSON.parse(r.spec_json) : r.spec_json; } catch (e) { console.log("row " + i + ": spec_json is not readable"); return; }
  if (!spec || !spec.type) return;
  const res = replay(sb, spec);
  if (res.issues.length) bad++;
  console.log([String(r.run_id || "").slice(0, 24), "slide " + (r.slide_no || i + 1), JSON.stringify(String(spec.title || "").slice(0, 50)),
    "was: " + (r.issues || "-"), "now: " + res.design + (res.issues.length ? " [" + res.issues.join(",") + "]" : " [clean]")].join("  "));
  if (save) {
    const name = (String(r.run_id || "row").replace(/[^A-Za-z0-9_-]/g, "") + "-s" + (r.slide_no || i + 1)).slice(0, 80) + ".json";
    fs.writeFileSync(path.join(ROOT, "tests", "fixtures", "reported", name), JSON.stringify({ reported: r.issues || "", title: spec.title || "", spec }, null, 1));
  }
});
console.log(rows.length + " slide(s) replayed, " + bad + " still with a problem." + (save ? " Saved to tests/fixtures/reported/." : ""));
