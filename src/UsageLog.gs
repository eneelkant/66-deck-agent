/**
 * Usage log (V.1_62)
 *
 * Every Create, Rebrand and Flowchart run writes, for each part of the run (long decks run in parts of up to ~4.5
 * minutes) and each Gemini model it used, one row to BigQuery:
 *   d-marketing-ai-applications.deck_agent.deck_usage
 * (project from USAGE_BQ_PROJECT, else VERTEX_PROJECT_ID; dataset / table from USAGE_BQ_DATASET / USAGE_BQ_TABLE).
 *
 * Token counts come from Vertex AI itself (usageMetadata of every response, read in callVertexGemini_ in Brand.gs):
 * input = promptTokenCount, output = candidatesTokenCount + thoughtsTokenCount (thinking is billed as output).
 *
 * Silent by design: nothing is shown in the panel or the result message, and a failed write never changes the run's
 * result (it is only written to the script's execution log). Cost, per-run, per-day and summary figures are worked
 * out by the BigQuery views (setup/usage_bigquery.sql), so no price is kept in the code.
 */

const USAGE_DEFAULTS_ = { dataset: 'deck_agent', table: 'deck_usage' };

// Tokens used in this Apps Script execution, per model
var USAGE_ = { byModel: {}, started: Date.now() };

// Called after every Vertex AI response (Brand.gs, callVertexGemini_)
function recordModelUsage_(model, meta) {
  try {
    meta = meta || {};
    const name = String(model || 'unknown');
    const u = USAGE_.byModel[name] || (USAGE_.byModel[name] = { calls: 0, input: 0, output: 0, total: 0 });
    const input = Number(meta.promptTokenCount) || 0;
    const output = (Number(meta.candidatesTokenCount) || 0) + (Number(meta.thoughtsTokenCount) || 0);
    u.calls++;
    u.input += input;
    u.output += output;
    u.total += Number(meta.totalTokenCount) || (input + output);
  } catch (e) {}
}

// Runs one part of a run and writes its usage rows. The result (or the error) of the part is passed on unchanged.
//   info: { runId, mode: 'Create' | 'Rebrand' | 'Flowchart', category }  (later parts only know the runId)
function usageRun_(info, fn) {
  USAGE_ = { byModel: {}, started: Date.now() };
  let res, err = null;
  try { res = fn(); } catch (e) { err = e; }
  try { writeUsage_(info || {}, usageStatus_(res, err), res); } catch (e2) { Logger.log('Usage log: ' + (e2 && e2.message ? e2.message : e2)); }
  if (err) throw err;
  return res;
}

function usageStatus_(res, err) {
  if (err) return err.cancelled ? 'cancelled' : 'failed';
  if (!res || typeof res !== 'object') return 'done';
  if (res.continue) return 'continuing';
  if (res.cancelled) return 'cancelled';
  return res.ok === false ? 'failed' : 'done';
}

function writeUsage_(info, status, res) {
  const runId = String(info.runId || ('r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6))).slice(0, 60);
  const cache = CacheService.getUserCache();
  // the first part knows the mode and the category; later parts take them from here
  const key = 'usage_' + runId;
  let saved = null;
  try { saved = JSON.parse(cache.get(key) || 'null'); } catch (e) { saved = null; }
  saved = saved || { part: 0, mode: info.mode || '', category: info.category || '' };
  saved.part++;
  if (info.mode) saved.mode = info.mode;
  if (info.category) saved.category = info.category;
  try { cache.put(key, JSON.stringify(saved), 21600); } catch (e) {}

  const who = usageUser_();
  let deckName = '', deckUrl = '';
  try { const p = SlidesApp.getActivePresentation(); deckName = p.getName(); deckUrl = p.getUrl(); } catch (e) {}
  const slides = res && typeof res === 'object' ? (Number(res.slideCount) || Number(res.done) || null) : null;
  const version = String(typeof AGENT_VERSION_ !== 'undefined' ? AGENT_VERSION_ : '').replace(/^.*\b(V\.\S+)$/, '$1');
  const ts = new Date().toISOString();
  const duration = Math.round((Date.now() - USAGE_.started) / 100) / 10;

  const models = Object.keys(USAGE_.byModel);
  if (!models.length) models.push('none');                    // a part that made no Gemini call is still recorded
  const rows = models.map(function (m) {
    const u = USAGE_.byModel[m] || { calls: 0, input: 0, output: 0, total: 0 };
    return {
      insertId: (runId + '-' + saved.part + '-' + m).slice(0, 128),
      json: {
        run_id: runId, part: saved.part, ts: ts, name: who.name, email: who.email,
        mode: saved.mode, deck_category: saved.category, deck_name: deckName, deck_url: deckUrl, slides: slides,
        model: m, calls: u.calls, input_tokens: u.input, output_tokens: u.output, total_tokens: u.total,
        duration_sec: duration, status: status, agent_version: version
      }
    };
  });
  insertUsageRows_(rows);
}

function usageTarget_() {
  const prop = function (k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } };
  return {
    project: prop('USAGE_BQ_PROJECT') || prop('VERTEX_PROJECT_ID'),
    dataset: prop('USAGE_BQ_DATASET') || USAGE_DEFAULTS_.dataset,
    table: prop('USAGE_BQ_TABLE') || USAGE_DEFAULTS_.table
  };
}

function insertUsageRows_(rows) {
  const t = usageTarget_();
  if (!t.project || !rows.length) return;
  const url = 'https://bigquery.googleapis.com/bigquery/v2/projects/' + encodeURIComponent(t.project) + '/datasets/' +
    encodeURIComponent(t.dataset) + '/tables/' + encodeURIComponent(t.table) + '/insertAll';
  const resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ kind: 'bigquery#tableDataInsertAllRequest', ignoreUnknownValues: true, rows: rows })
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText() || '';
  if (code < 200 || code >= 300 || /"insertErrors"/.test(body)) Logger.log('Usage log HTTP ' + code + ': ' + body.slice(0, 300));
}

// The user's name and email from their Google Drive profile (the add-on already has Drive access), kept for 6 hours
function usageUser_() {
  const cache = CacheService.getUserCache();
  try { const c = JSON.parse(cache.get('usage_who') || 'null'); if (c && c.email) return c; } catch (e) {}
  let who = { name: '', email: '' };
  try {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (r.getResponseCode() === 200) {
      const u = (JSON.parse(r.getContentText()) || {}).user || {};
      who = { name: u.displayName || '', email: u.emailAddress || '' };
    }
  } catch (e) {}
  if (!who.email) { try { who.email = Session.getEffectiveUser().getEmail() || ''; } catch (e) {} }
  if (!who.name && who.email) {
    who.name = who.email.split('@')[0].split(/[._-]+/).map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' ');
  }
  try { if (who.email) cache.put('usage_who', JSON.stringify(who), 21600); } catch (e) {}
  return who;
}
