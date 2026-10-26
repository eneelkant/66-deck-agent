/**
 * 66° Deck Agent — model check (V.1_56)
 *
 * From the add-on menu: Extensions ▸ 66° Deck Agent ▸ Test AI models (testAiModels in Code.gs calls
 * testConfiguredModels_ below: the models the add-on is set to use, on its own region).
 * From the Apps Script editor: Run ▸ testNewModels, then open View ▸ Logs (or Executions).
 * It sends one tiny request to each new model in each region and logs whether it answered, how long it took and
 * how many tokens it used. It changes nothing: no Script properties are written and no deck is touched.
 *
 * It reuses the add-on's own Vertex AI connection (the project in VERTEX_PROJECT_ID and the signed-in user's
 * Google login). No API key is used or needed.
 */

var MODEL_TEST_TEXT_MODELS_ = ['gemini-4-argon', 'gemini-3.8-flash'];
var MODEL_TEST_IMAGE_MODELS_ = ['gemini-3.1-flash-image'];
var MODEL_TEST_LOCATIONS_ = ['us-central1', 'global'];

function testNewModels() {
  var base = getVertexConfig_();
  if (!base.projectId) throw new Error('VERTEX_PROJECT_ID is not set in Script properties.');
  var rows = [];
  MODEL_TEST_LOCATIONS_.forEach(function (loc) {
    MODEL_TEST_TEXT_MODELS_.forEach(function (model) {
      rows.push(modelTestText_(base.projectId, loc, model, false));
      rows.push(modelTestText_(base.projectId, loc, model, true));
    });
    MODEL_TEST_IMAGE_MODELS_.forEach(function (model) {
      rows.push(modelTestImage_(base.projectId, loc, model));
    });
  });
  var lines = ['Model check for project ' + base.projectId + ' (add-on region now: ' + base.location + ')', ''];
  rows.forEach(function (r) {
    lines.push([r.ok ? 'OK  ' : 'FAIL', r.model, r.location, r.test, r.ms + ' ms', r.detail].join(' | '));
  });
  var report = lines.join('\n');
  Logger.log(report);
  console.log(report);
  return report;
}

// One JSON request, like the add-on's outline and writing calls; withThinking also sends a low thinking level
function modelTestText_(projectId, location, model, withThinking) {
  var body = {
    contents: [{ role: 'user', parts: [{ text: 'Return ONLY JSON: {"points": [4 plain sentences on streaming Pub/Sub data into BigQuery for 1,200 rail switch sensors]}. No hype words.' }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 1.0 }
  };
  if (withThinking) body.generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  var r = modelTestCall_(projectId, location, model, body);
  r.test = withThinking ? 'json + thinking LOW' : 'json';
  if (r.ok) {
    var text = modelTestText0_(r.result);
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) {}
    var u = r.result.usageMetadata || {};
    r.detail = (parsed && parsed.points ? parsed.points.length + ' points' : 'answer was not valid JSON') +
      '; tokens in ' + (u.promptTokenCount || 0) + ', out ' + (u.candidatesTokenCount || 0) + ', thinking ' + (u.thoughtsTokenCount || 0);
  }
  return r;
}

// One image request, like the add-on's icon call
function modelTestImage_(projectId, location, model) {
  var body = {
    contents: [{ role: 'user', parts: [{ text: 'A single minimal line icon of a railway switch. Blue outline on a flat white background, no text.' }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } }
  };
  var r = modelTestCall_(projectId, location, model, body);
  r.test = 'image';
  if (r.ok) {
    var parts = (r.result.candidates && r.result.candidates[0] && r.result.candidates[0].content && r.result.candidates[0].content.parts) || [];
    var img = parts.filter(function (p) { return (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data); })[0];
    if (img) {
      var d = img.inlineData || img.inline_data;
      r.detail = 'image returned (' + (d.mimeType || d.mime_type || 'image') + ', ' + Math.round(String(d.data).length * 0.75 / 1024) + ' KB)';
    } else {
      r.ok = false;
      r.detail = 'answered but returned no image';
    }
  }
  return r;
}

function modelTestCall_(projectId, location, model, body) {
  var url = buildVertexEndpoint_({ projectId: projectId, location: location, model: model }, model);
  var started = Date.now();
  var out = { model: model, location: location, ok: false, ms: 0, detail: '', result: null };
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: vertexAuthHeaders_(),
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    out.ms = Date.now() - started;
    var code = resp.getResponseCode();
    var json = {};
    try { json = JSON.parse(resp.getContentText()); } catch (e) {}
    if (code >= 200 && code < 300 && !json.error) {
      out.ok = true;
      out.result = json;
    } else {
      out.detail = 'HTTP ' + code + ': ' + String((json.error && json.error.message) || resp.getContentText()).slice(0, 180);
    }
  } catch (e) {
    out.ms = Date.now() - started;
    out.detail = 'request failed: ' + e.message;
  }
  return out;
}

function modelTestText0_(result) {
  var parts = (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) || [];
  return parts.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('');
}

// V.1_56: the models the add-on is set to use (Script properties or defaults), on its own region
function testConfiguredModels_() {
  var base = getVertexConfig_();
  if (!base.projectId) return 'VERTEX_PROJECT_ID is not set in Script properties.';
  var jobs = [
    ['Outline', typeof outlineModel_ === 'function' ? outlineModel_() : ''],
    ['Slide writing', typeof contentModel_ === 'function' ? contentModel_() : ''],
    ['Research and checks', CONFIG.model],
    ['Fallback', typeof FALLBACK_TEXT_MODEL_ !== 'undefined' ? FALLBACK_TEXT_MODEL_ : 'gemini-2.5-flash']
  ];
  var lines = ['Project ' + base.projectId + ', region ' + base.location + '.', ''];
  jobs.forEach(function (j) {
    var model = j[1] || CONFIG.model;
    var body = {
      contents: [{ role: 'user', parts: [{ text: 'Return ONLY JSON: {"ok": true}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    var tc = typeof geminiThinkingConfig_ === 'function' ? geminiThinkingConfig_(model) : null;
    if (tc) body.generationConfig.thinkingConfig = tc;
    var r = modelTestCall_(base.projectId, base.location, model, body);
    lines.push((r.ok ? 'OK    ' : 'FAIL  ') + j[0] + ': ' + model + ' (' + r.ms + ' ms)' + (r.ok ? '' : ' — ' + r.detail));
  });
  var img = CONFIG.imageModel && CONFIG.imageModel !== 'auto' ? CONFIG.imageModel : 'gemini-2.5-flash-image';
  var ri = modelTestImage_(base.projectId, base.location, img);
  lines.push((ri.ok ? 'OK    ' : 'FAIL  ') + 'Icons: ' + img + ' (' + ri.ms + ' ms)' + (ri.ok ? '' : ' — ' + ri.detail));
  var fails = lines.filter(function (l) { return /^FAIL/.test(l); }).length;
  lines.push('');
  lines.push(fails ? fails + ' model(s) did not answer: decks still build, with ' + (typeof FALLBACK_TEXT_MODEL_ !== 'undefined' ? FALLBACK_TEXT_MODEL_ : 'gemini-2.5-flash') + ' for text. ' +
    (String(base.location) !== 'global' ? 'The new models need VERTEX_LOCATION = global in Script properties.' : 'Check the model names in Script properties.')
    : 'All models answered.');
  var report = lines.join('\n');
  Logger.log(report);
  return report;
}
