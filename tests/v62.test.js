"use strict";

// V.1_62: usage log. Every run part writes one row per Gemini model to BigQuery (deck_agent.deck_usage) with the
// user's name and email, the run, the deck and the tokens Vertex AI reported; silently (the result is never changed,
// a failed write is only logged) and without new permissions.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function sandbox(opts) {
  opts = opts || {};
  const fetches = [];
  const store = {};
  const logs = [];
  const sb = {
    console, Math, JSON, Date, logs, fetches,
    Logger: { log: (m) => logs.push(String(m)) },
    CacheService: { getUserCache: () => ({ get: (k) => (k in store ? store[k] : null), put: (k, v) => { store[k] = v; }, remove: (k) => { delete store[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "VERTEX_PROJECT_ID" ? "d-marketing-ai-applications" : null) }) },
    ScriptApp: { getOAuthToken: () => "TOKEN" },
    Session: { getEffectiveUser: () => ({ getEmail: () => "neelkant.ekbote@66degrees.com" }) },
    SlidesApp: { getActivePresentation: () => ({ getName: () => "Acme proposal", getUrl: () => "https://docs.google.com/presentation/d/abc/edit" }) },
    UrlFetchApp: {
      fetch(url, o) {
        fetches.push({ url, o });
        if (opts.bqDown && /bigquery/.test(url)) throw new Error("network down");
        if (/drive\/v3\/about/.test(url)) {
          if (opts.noDrive) return { getResponseCode: () => 403, getContentText: () => "{}" };
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ user: { displayName: "Priya Sharma", emailAddress: "priya.sharma@66degrees.com" } }) };
        }
        return { getResponseCode: () => 200, getContentText: () => "{}" };
      }
    },
    AGENT_VERSION_: "66° Deck Agent V.1_62"
  };
  vm.createContext(sb);
  vm.runInContext(read("src/UsageLog.gs"), sb, { filename: "UsageLog.gs" });
  return sb;
}
const bqRows = (sb) => sb.fetches.filter((f) => /insertAll$/.test(f.url)).map((f) => JSON.parse(f.o.payload).rows);

test("version label is V.1_62 or later; UsageLog.gs is pushed", () => {
  assert.match(read("src/Code.gs"), /AGENT_VERSION_\s*=\s*'66° Deck Agent V\.1_(6[2-9]|[7-9]\d)'/);
  assert.ok(JSON.parse(read(".clasp.json")).filePushOrder.includes("UsageLog.gs"));
});

test("Brand.gs: every Vertex response passes its usageMetadata to the log, nothing else in the call changes", () => {
  const src = read("src/Brand.gs");
  const fn = src.slice(src.indexOf("function callVertexGemini_"), src.indexOf("function getApiKey"));
  assert.equal((fn.match(/recordModelUsage_\(model, result\.usageMetadata\)/g) || []).length, 1);
  assert.match(fn, /typeof recordModelUsage_ === 'function'/);
  assert.match(fn, /catch \(eUsage\) \{\}/);
});

test("Code.gs: Create/Rebrand, every continued part and Flowchart runs are logged", () => {
  const src = read("src/Code.gs");
  assert.match(src, /function runDeckGeneration\(data\) \{[\s\S]{0,700}withUsage_\(/);
  assert.match(src, /function continueDeckGeneration\(runId\) \{\s*return withUsage_\(/);
  assert.match(src, /function runFlowchartGeneration\(data\) \{[\s\S]{0,200}withUsage_\(\{ runId: data\.runId, mode: 'Flowchart'/);
});

test("tokens per model: thinking tokens count as output; one row per model to deck_agent.deck_usage", () => {
  const sb = sandbox();
  const res = sb.usageRun_({ runId: "run-1", mode: "Create", category: "Proposal" }, () => {
    sb.recordModelUsage_("gemini-4-argon", { promptTokenCount: 1000, candidatesTokenCount: 300, thoughtsTokenCount: 200, totalTokenCount: 1500 });
    sb.recordModelUsage_("gemini-4-argon", { promptTokenCount: 500, candidatesTokenCount: 100, totalTokenCount: 600 });
    sb.recordModelUsage_("gemini-3.8-flash", { promptTokenCount: 50, candidatesTokenCount: 10, totalTokenCount: 60 });
    return { ok: true, message: "SUCCESS: done", slideCount: 12 };
  });
  assert.equal(res.message, "SUCCESS: done");
  const ins = sb.fetches.find((f) => /insertAll$/.test(f.url));
  assert.equal(ins.url, "https://bigquery.googleapis.com/bigquery/v2/projects/d-marketing-ai-applications/datasets/deck_agent/tables/deck_usage/insertAll");
  assert.equal(ins.o.headers.Authorization, "Bearer TOKEN");
  const rows = bqRows(sb)[0];
  assert.equal(rows.length, 2);
  const a = rows.find((r) => r.json.model === "gemini-4-argon").json;
  assert.deepEqual([a.calls, a.input_tokens, a.output_tokens, a.total_tokens], [2, 1500, 600, 2100]);
  assert.equal(a.name, "Priya Sharma");
  assert.equal(a.email, "priya.sharma@66degrees.com");
  assert.equal(a.mode, "Create");
  assert.equal(a.deck_category, "Proposal");
  assert.equal(a.deck_name, "Acme proposal");
  assert.equal(a.slides, 12);
  assert.equal(a.status, "done");
  assert.equal(a.part, 1);
  assert.equal(a.agent_version, "V.1_62");
  assert.equal(rows[0].insertId, "run-1-1-gemini-4-argon");
});

test("a long run: each part is written at once, later parts keep the mode and category, last part says done", () => {
  const sb = sandbox();
  sb.usageRun_({ runId: "run-2", mode: "Rebrand", category: "General" }, () => { sb.recordModelUsage_("gemini-3.8-flash", { promptTokenCount: 10, candidatesTokenCount: 5 }); return { ok: true, continue: true, done: 10, total: 30 }; });
  sb.usageRun_({ runId: "run-2" }, () => { sb.recordModelUsage_("gemini-3.8-flash", { promptTokenCount: 20, candidatesTokenCount: 5 }); return { ok: true, continue: true, done: 20, total: 30 }; });
  sb.usageRun_({ runId: "run-2" }, () => ({ ok: true, message: "SUCCESS", slideCount: 30 }));
  const rows = bqRows(sb).map((r) => r[0].json);
  assert.deepEqual(rows.map((r) => [r.part, r.status, r.mode, r.deck_category, r.slides]), [
    [1, "continuing", "Rebrand", "General", 10], [2, "continuing", "Rebrand", "General", 20], [3, "done", "Rebrand", "General", 30]]);
  assert.equal(rows[1].input_tokens, 20, "each part counts only its own calls");
  assert.equal(rows[2].model, "none", "a part with no Gemini call is still recorded");
});

test("failed and cancelled runs are recorded; the error and the result reach the panel unchanged", () => {
  const sb = sandbox();
  assert.throws(() => sb.usageRun_({ runId: "run-3", mode: "Create" }, () => { sb.recordModelUsage_("gemini-4-argon", { promptTokenCount: 7 }); throw new Error("Vertex AI HTTP 500"); }), /Vertex AI HTTP 500/);
  const cancelled = { ok: false, cancelled: true, message: "CANCELLED: Stopped at your request." };
  assert.equal(sb.usageRun_({ runId: "run-4", mode: "Create" }, () => cancelled), cancelled);
  const st = bqRows(sb).map((r) => r[0].json.status);
  assert.deepEqual(st, ["failed", "cancelled"]);
});

test("silent: BigQuery down never changes the result and nothing is shown, only the execution log", () => {
  const sb = sandbox({ bqDown: true });
  const result = { ok: true, message: "SUCCESS: 12 slides", slideCount: 12 };
  const out = sb.usageRun_({ runId: "run-5", mode: "Create" }, () => result);
  assert.equal(out, result);
  assert.equal(out.message, "SUCCESS: 12 slides");
  assert.ok(sb.logs.some((l) => /^Usage log: network down/.test(l)));
  assert.doesNotMatch(read("src/Generator.html"), /usage|deck_usage|bigquery/i);
});

test("name and email: from the Google profile; without it, the account email and a name made from it", () => {
  const sb = sandbox({ noDrive: true });
  sb.usageRun_({ runId: "run-6", mode: "Create" }, () => ({ ok: true }));
  const r = bqRows(sb)[0][0].json;
  assert.equal(r.email, "neelkant.ekbote@66degrees.com");
  assert.equal(r.name, "Neelkant Ekbote");
});

test("no new permission: the log uses the add-on's existing Google Cloud and Drive access", () => {
  const scopes = JSON.parse(read("src/appsscript.json")).oauthScopes;
  assert.ok(scopes.includes("https://www.googleapis.com/auth/cloud-platform"));
  assert.ok(scopes.includes("https://www.googleapis.com/auth/drive"));
  assert.equal(scopes.length, 5);
});

test("setup SQL: dataset, log table, rates, and the cost / run / daily / summary views", () => {
  const sql = read("setup/usage_bigquery.sql");
  ["CREATE SCHEMA IF NOT EXISTS `d-marketing-ai-applications.deck_agent`", "deck_agent.deck_usage", "deck_agent.model_rates",
    "VIEW `d-marketing-ai-applications.deck_agent.v_usage_cost`", "v_runs", "v_daily_user", "v_summary_model", "v_summary_user", "v_summary_category",
    "PARTITION BY DATE(ts)", "'Asia/Kolkata'"].forEach((s) => assert.ok(sql.includes(s), s));
  assert.doesNotMatch(sql, /''/, "BigQuery strings do not escape quotes by doubling");
  // every column the add-on writes exists in the table
  const sb = sandbox();
  sb.usageRun_({ runId: "run-7", mode: "Create" }, () => ({ ok: true }));
  const table = sql.slice(sql.indexOf("deck_agent.deck_usage` ("), sql.indexOf("PARTITION BY"));
  Object.keys(bqRows(sb)[0][0].json).forEach((c) => assert.match(table, new RegExp("\\n\\s+" + c + "\\s"), c));
});
