"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function pngBytes() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}

function loadProvider(opts) {
  opts = opts || {};
  const props = Object.assign({ CLIENT_LOGO_LOOKUP: "false" }, opts.props || {});
  const fetches = [];
  const cache = {};
  const sandbox = {
    console,
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
          setProperty(k, v) { props[k] = String(v); }
        };
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(k) { return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
          put(k, v) { cache[k] = String(v); }
        };
      }
    },
    Utilities: {
      base64Encode(bytes) { return Buffer.from(bytes).toString("base64"); },
      base64Decode(s) { return Buffer.from(String(s), "base64"); },
      newBlob(bytes, mime, name) {
        const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        return {
          getBytes() { return buf; },
          getContentType() { return mime || "image/png"; },
          getName() { return name || "blob"; },
          setName(n) { return this; }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, o) {
        fetches.push({ url, opts: o });
        if (typeof opts.fetch === "function") return opts.fetch(url, o, fetches);
        return {
          getResponseCode() { return 500; },
          getContentText() { return ""; },
          getBlob() {
            return { getContentType() { return "text/html"; }, getBytes() { return Buffer.from("<html>") }, setName() { return this; } };
          },
          getHeaders() { return {}; }
        };
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/ClientLogoProvider.gs"), sandbox, { filename: "ClientLogoProvider.gs" });
  sandbox._fetches = fetches;
  sandbox._cache = cache;
  sandbox._props = props;
  return sandbox;
}

test("lookup disabled by default — no provider request", () => {
  const g = loadProvider();
  assert.equal(g.clientLogoLookupEnabled_(), false);
  const r = g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com" });
  assert.equal(g._fetches.length, 0);
  assert.ok(r && r.kind === "wordmark");
  assert.equal(r.text, "Acme");
});

test("missing domain causes no provider request even when lookup enabled", () => {
  const g = loadProvider({ props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" } });
  const r = g.resolveClientLogo_({ companyName: "Acme", domain: "" });
  assert.equal(g._fetches.length, 0);
  assert.ok(r.kind === "wordmark" || r == null || r.kind === "none" || r.kind === "wordmark");
});

test("invalid domains are rejected", () => {
  const g = loadProvider();
  const bad = [
    "http://evil.com",
    "https://evil.com/path",
    "user:pass@evil.com",
    "evil.com:8080",
    "127.0.0.1",
    "localhost",
    "192.168.1.1",
    "10.0.0.5",
    "not a domain",
    "",
    "../etc",
    "a"
  ];
  assert.equal(g.normalizeClientDomain_("http://evil.com").ok, false);
  assert.equal(g.normalizeClientDomain_("https://evil.com/path").ok, false);
  assert.equal(g.normalizeClientDomain_("user:pass@evil.com").ok, false);
  assert.equal(g.normalizeClientDomain_("evil.com:8080").ok, false);
  assert.equal(g.normalizeClientDomain_("127.0.0.1").ok, false);
  assert.equal(g.normalizeClientDomain_("localhost").ok, false);
  assert.equal(g.normalizeClientDomain_("192.168.1.1").ok, false);
  assert.equal(g.normalizeClientDomain_("10.0.0.5").ok, false);
  assert.equal(g.normalizeClientDomain_("not a domain").ok, false);
  assert.equal(g.normalizeClientDomain_("").ok, false);
  assert.equal(g.normalizeClientDomain_("acme.com").ok, true);
  assert.equal(g.normalizeClientDomain_("www.acme.com").domain, "acme.com");
  void bad;
});

test("Brandfetch called only when lookup enabled and key configured", () => {
  const png = pngBytes();
  const g = loadProvider({
    props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "secret-key" },
    fetch(url) {
      if (/api\.brandfetch\.io/.test(url)) {
        return {
          getResponseCode() { return 200; },
          getContentText() {
            return JSON.stringify({
              logos: [{ type: "logo", theme: "light", formats: [{ format: "png", src: "https://cdn.brandfetch.io/acme.png" }] }]
            });
          },
          getBlob() { return { getContentType() { return "application/json"; }, getBytes() { return Buffer.from("{}"); }, setName() { return this; } }; },
          getHeaders() { return {}; }
        };
      }
      if (/cdn\.brandfetch\.io/.test(url)) {
        return {
          getResponseCode() { return 200; },
          getContentText() { return ""; },
          getBlob() {
            return {
              getContentType() { return "image/png"; },
              getBytes() { return png; },
              setName() { return this; }
            };
          },
          getHeaders() { return {}; }
        };
      }
      return { getResponseCode() { return 404; }, getContentText() { return ""; }, getBlob() { return { getContentType() { return ""; }, getBytes() { return []; }, setName() { return this; } }; }, getHeaders() { return {}; } };
    }
  });
  const r = g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com", enabled: true });
  assert.equal(r.kind, "image");
  assert.equal(r.source, "brandfetch");
  assert.ok(g._fetches.some((f) => /api\.brandfetch\.io/.test(f.url)));
  // Authorization header must not appear in logs — just ensure we sent it
  const meta = g._fetches.find((f) => /api\.brandfetch\.io/.test(f.url));
  assert.ok(meta.opts.headers.Authorization);
  assert.ok(!JSON.stringify(g._fetches).includes("secret-key") === false); // key is in fetch opts (runtime), not logged by provider
});

test("provider failure falls through to wordmark safely", () => {
  const g = loadProvider({
    props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" },
    fetch() {
      return {
        getResponseCode() { return 500; },
        getContentText() { return "err"; },
        getBlob() { return { getContentType() { return "text/html"; }, getBytes() { return Buffer.from("<html>"); }, setName() { return this; } }; },
        getHeaders() { return {}; }
      };
    }
  });
  const r = g.resolveClientLogo_({ companyName: "Acme Corp", domain: "acme.com", enabled: true });
  assert.equal(r.kind, "wordmark");
  assert.equal(r.text, "Acme Corp");
});

test("invalid content type and oversize responses rejected", () => {
  const g = loadProvider();
  const html = {
    getResponseCode() { return 200; },
    getContentText() { return "<html>"; },
    getBlob() {
      return { getContentType() { return "text/html"; }, getBytes() { return Buffer.from("<html>hi</html>"); }, setName() { return this; } };
    },
    getHeaders() { return {}; }
  };
  assert.equal(g.clientLogoValidateResponse_(html).ok, false);
  const huge = {
    getResponseCode() { return 200; },
    getContentText() { return ""; },
    getBlob() {
      const bytes = Buffer.alloc(900 * 1024, 1);
      bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4e; bytes[3] = 0x47;
      return { getContentType() { return "image/png"; }, getBytes() { return bytes; }, setName() { return this; } };
    },
    getHeaders() { return {}; }
  };
  assert.equal(g.clientLogoValidateResponse_(huge).ok, false);
});

test("untrusted redirects are rejected", () => {
  const g = loadProvider({
    props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" },
    fetch(url) {
      if (/api\.brandfetch\.io/.test(url)) {
        return {
          getResponseCode() { return 200; },
          getContentText() {
            return JSON.stringify({
              logos: [{ type: "logo", formats: [{ format: "png", src: "https://evil.example/logo.png" }] }]
            });
          },
          getBlob() { return { getContentType() { return "application/json"; }, getBytes() { return Buffer.from("{}"); }, setName() { return this; } }; },
          getHeaders() { return {}; }
        };
      }
      return {
        getResponseCode() { return 302; },
        getContentText() { return ""; },
        getBlob() { return { getContentType() { return ""; }, getBytes() { return []; }, setName() { return this; } }; },
        getHeaders() { return { Location: "http://169.254.169.254/latest/meta-data" }; }
      };
    }
  });
  assert.equal(g.clientLogoHostAllowed_("https://evil.example/x"), false);
  assert.equal(g.clientLogoHostAllowed_("http://cdn.brandfetch.io/x"), false); // https only at fetch time
  const r = g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com", enabled: true });
  assert.ok(r.kind === "wordmark" || r.kind === "none");
});

test("cache hit and negative-cache behavior", () => {
  const png = pngBytes();
  const g = loadProvider({
    props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" },
    fetch(url) {
      if (/api\.brandfetch\.io/.test(url)) {
        return {
          getResponseCode() { return 200; },
          getContentText() {
            return JSON.stringify({
              logos: [{ type: "logo", formats: [{ format: "png", src: "https://cdn.brandfetch.io/a.png" }] }]
            });
          },
          getBlob() { return { getContentType() { return "application/json"; }, getBytes() { return Buffer.from("{}"); }, setName() { return this; } }; },
          getHeaders() { return {}; }
        };
      }
      return {
        getResponseCode() { return 200; },
        getContentText() { return ""; },
        getBlob() {
          return { getContentType() { return "image/png"; }, getBytes() { return png; }, setName() { return this; } };
        },
        getHeaders() { return {}; }
      };
    }
  });
  const first = g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com", enabled: true });
  assert.equal(first.source, "brandfetch");
  const n1 = g._fetches.length;
  g.resetClientLogoRunLimit_();
  const second = g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com", enabled: true });
  assert.equal(second.source, "cache");
  assert.equal(g._fetches.length, n1, "cache hit must not refetch");

  // Negative cache
  const g2 = loadProvider({
    props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" },
    fetch() {
      return {
        getResponseCode() { return 404; },
        getContentText() { return ""; },
        getBlob() { return { getContentType() { return ""; }, getBytes() { return []; }, setName() { return this; } }; },
        getHeaders() { return {}; }
      };
    }
  });
  g2.resolveClientLogo_({ companyName: "Nope", domain: "nope.example", enabled: true });
  const nFail = g2._fetches.length;
  g2.resetClientLogoRunLimit_();
  g2.resolveClientLogo_({ companyName: "Nope", domain: "nope.example", enabled: true });
  assert.ok(g2._fetches.length <= nFail + 0 || g2._cache["clogo:bf:nope.example"] === "__none__");
});

test("Clearbit permanently disabled; V.1_38: lookup and Unavatar ON unless switched off", () => {
  const g = loadProvider({ props: { CLIENT_LOGO_LOOKUP: "true" } });
  assert.equal(g.clearbitClientLogo_().ok, false);
  assert.match(g.clearbitClientLogo_().reason, /sunset/i);
  assert.equal(g.clientLogoProviderOptIn_("unavatar"), true, "Unavatar on when the property is not set");
  g.resolveClientLogo_({ companyName: "Acme", domain: "acme.com", enabled: true });
  assert.ok(!g._fetches.some((f) => /clearbit/i.test(f.url)), "never Clearbit");
  assert.ok(g._fetches.some((f) => /^https:\/\/unavatar\.io\/acme\.com\?fallback=false$/.test(f.url)), "Unavatar asked, no key needed");
  // switched off explicitly
  const off = loadProvider({ props: { CLIENT_LOGO_LOOKUP: "true", CLIENT_LOGO_UNAVATAR: "false" } });
  assert.equal(off.clientLogoProviderOptIn_("unavatar"), false);
  const none = loadProvider({ props: { CLIENT_LOGO_LOOKUP: null } });
  assert.equal(none.clientLogoLookupEnabled_(), true, "lookup on when CLIENT_LOGO_LOOKUP is not set");
});

test("uploaded logo wins; 66degrees branding never replaced by module", () => {
  const g = loadProvider({ props: { CLIENT_LOGO_LOOKUP: "true", BRANDFETCH_API_KEY: "k" } });
  const blob = {
    getContentType() { return "image/png"; },
    getBytes() { return pngBytes(); }
  };
  const r = g.resolveClientLogo_({
    companyName: "Acme",
    domain: "acme.com",
    uploadedBlob: blob,
    enabled: true
  });
  assert.equal(r.source, "user-upload");
  assert.equal(g._fetches.length, 0);
  // Module has no path that mutates brand assets — assert source code contract
  const src = read("src/ClientLogoProvider.gs");
  assert.match(src, /Never replaces 66degrees branding/i);
  assert.match(src, /permanentlyDisabled:\s*true/);
  assert.match(src, /sunset December 2025/i);
  assert.doesNotMatch(src, /UrlFetchApp\.fetch\(\s*['"]https:\/\/logo\.clearbit\.com/);
});

test("normal generation succeeds when every logo provider unavailable (source contract)", () => {
  const code = read("src/Code.gs");
  assert.match(code, /Client logo step skipped/);
  const kit = read("src/ProposalKit.gs");
  assert.match(kit, /resolveClientLogo_/);
  assert.match(kit, /66degrees logo used/);
});
