"use strict";

// V.1_38: client logos come from the ClientLogoProvider added in PR #44 (Drive, Brandfetch with a key, Unavatar without
// a key), with no built-in logo.dev key. The website is found before the provider is asked; a tiny site icon is only a
// last resort after the full logo on Wikipedia / Wikimedia; "Apple" (the fruit page) is found as "Apple Inc.".
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function png(width, size) {
  const b = Buffer.alloc(size || 4000);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(b, 0);
  b.writeUInt32BE(width, 16); b.writeUInt32BE(width, 20);
  return b;
}
function blob(bytes, type) {
  return { getBytes: () => bytes, getContentType: () => type, setName() { return this; }, getName: () => "x" };
}
function resp(code, body, type, json) {
  return {
    getResponseCode: () => code,
    getBlob: () => blob(Buffer.isBuffer(body) ? body : Buffer.from(String(body || "")), type || "text/plain"),
    getContentText: () => (json ? JSON.stringify(json) : String(body || "")),
    getHeaders: () => ({})
  };
}

// a small web: what each logo source answers
function web(routes) {
  const fetched = [];
  return {
    fetched,
    UrlFetchApp: {
      fetch(url) {
        fetched.push(url);
        for (const [re, fn] of routes) if (re.test(url)) return fn(url);
        return resp(404, "");
      }
    }
  };
}

function load(w, props) {
  props = props || {};
  const cache = {};
  const saved = [];
  const sandbox = {
    console, Logger: { log() {} }, Math, JSON, Date,
    CONFIG: { iconOrder: ["material"], maxSourceChars: 60000 }, progressStage_() {}, checkCancel_() {},
    UrlFetchApp: w.UrlFetchApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; } }) },
    Utilities: {
      base64Encode: (b) => Buffer.from(b).toString("base64"),
      base64Decode: (s) => Buffer.from(String(s), "base64"),
      newBlob: (bytes, mime) => blob(Buffer.from(bytes), mime)
    },
    DriveApp: {
      getFoldersByName: () => ({ hasNext: () => false }),
      searchFiles: () => ({ hasNext: () => false }),
      createFolder: () => ({ createFile: (b) => { saved.push(b); return { getId: () => "file" + saved.length }; } })
    }
  };
  vm.createContext(sandbox);
  ["src/Engine.gs", "src/Reference.gs", "src/ProposalKit.gs", "src/ClientLogoProvider.gs"].forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  sandbox._saved = saved;
  return sandbox;
}

const company = (title, image) => resp(200, "", "application/json", { type: "standard", title, description: "American multinational company", originalimage: { source: image } });
const wikidata429 = [/wikidata\.org/, () => resp(429, "")];

test("Apple: Unavatar's SVG is refused, the fruit page is skipped, 'Apple Inc.' on Wikipedia gives the real logo", () => {
  const w = web([
    wikidata429,
    [/unavatar\.io\/apple\.com\?fallback=false/, () => resp(200, "<svg/>", "image/svg+xml")],
    [/rest_v1\/page\/summary\/Apple$/, () => resp(200, "", "application/json", { type: "standard", title: "Apple", description: "Fruit of the apple tree", extract: "An apple is a round fruit." })],
    [/list=search.*Apple%20company/, () => resp(200, "", "application/json", { query: { search: [{ title: "Apple Inc." }] } })],
    [/rest_v1\/page\/summary\/Apple_Inc\./, () => company("Apple Inc.", "https://upload.wikimedia.org/x/Apple_logo_black.svg.png")],
    [/upload\.wikimedia\.org/, () => resp(200, png(960), "image/png")]
  ]);
  const g = load(w);
  const r = g.findClientLogo_({ name: "Apple", domain: "" }, {});
  assert.ok(r && r.blob, "a logo for Apple");
  assert.match(r.source, /Wikipedia/);
  assert.ok(w.fetched.some((u) => /unavatar\.io\/apple\.com/.test(u)), "the new provider was asked first, with the guessed apple.com");
  assert.ok(!w.fetched.some((u) => /logo\.dev|clearbit/.test(u)), "no logo.dev (no key) and never Clearbit");
  assert.ok(g.LOGO_TRAIL_.some((t) => /domain guessed: apple\.com/.test(t)));
});

test("Home Depot: Unavatar's 32 px icon waits; the full logo wins; the icon is used only when nothing better exists", () => {
  const routes = [
    wikidata429,
    [/unavatar\.io\/homedepot\.com/, () => resp(200, png(32, 1017), "image/png")]
  ];
  const full = web(routes.concat([
    [/rest_v1\/page\/summary\/The_Home_Depot/, () => company("The Home Depot", "https://upload.wikimedia.org/x/TheHomeDepot.svg.png")],
    [/upload\.wikimedia\.org/, () => resp(200, png(800), "image/png")]
  ]));
  const g = load(full);
  const r = g.findClientLogo_({ name: "The Home Depot", domain: "" }, {});
  assert.match(r.source, /Wikipedia/);
  assert.equal(g.imageWidth_(r.blob), 800);

  const iconOnly = web(routes);
  const g2 = load(iconOnly);
  const r2 = g2.findClientLogo_({ name: "The Home Depot", domain: "" }, {});
  assert.ok(r2 && r2.blob, "logo should be there: the site icon rather than nothing");
  assert.match(r2.source, /website icon \(unavatar\)/);
});

test("a 128 px Unavatar logo is used straight away; the sidebar domain is used as given", () => {
  const w = web([[/unavatar\.io\/google\.com/, () => resp(200, png(128, 2326), "image/png")]]);
  const g = load(w);
  const r = g.findClientLogo_({ name: "Google", domain: "google.com" }, {});
  assert.match(r.source, /^unavatar/);
  assert.ok(!w.fetched.some((u) => /wikidata|wikipedia/.test(u)), "no extra lookups once a good logo is found");
});

test("CLIENT_LOGO_LOOKUP=false switches the provider off; the other sources still run", () => {
  const w = web([wikidata429, [/rest_v1\/page\/summary\/Acme_Corp/, () => company("Acme Corp", "https://upload.wikimedia.org/x/Acme_logo.png")], [/upload\.wikimedia\.org/, () => resp(200, png(500), "image/png")]]);
  const g = load(w, { CLIENT_LOGO_LOOKUP: "false" });
  const r = g.findClientLogo_({ name: "Acme Corp", domain: "" }, {});
  assert.ok(!w.fetched.some((u) => /unavatar/.test(u)));
  assert.match(r.source, /Wikipedia/);
});

test("image width reader: PNG, GIF, JPEG", () => {
  const g = load(web([]));
  assert.equal(g.imageWidth_(blob(png(321), "image/png")), 321);
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0x10, 0x00]);
  assert.equal(g.imageWidth_(blob(gif, "image/gif")), 320);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x01, 0x90, 0x03, 0, 0, 0, 0]);
  assert.equal(g.imageWidth_(blob(jpg, "image/jpeg")), 400);
});
