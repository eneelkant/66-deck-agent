"use strict";

// V.1_41: the Create tab with fewer words. Deck type first; Client name and Website only for a Proposal Deck (hidden and
// not sent otherwise); "Content source" with the link box and the upload box, no "(optional)" and no help lines;
// "Topic"; plain "Slides"; the header shows only "Deck Agent".
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "Generator.html"), "utf8");
const create = html.slice(html.indexOf('<div class="form" data-only="create">'), html.indexOf("<!-- Running -->"));

test("Create tab: short labels, no help lines, no '(optional)'", () => {
  assert.match(create, /<label for="presentationType">Deck type<\/label>/);
  assert.match(create, /<label for="prompt">Topic<\/label>/);
  assert.match(create, /<span>Content source<\/span>/);
  assert.match(create, /<label for="clientName">Client name<\/label>/);
  assert.match(create, /<label for="clientDomain">Website<\/label>/);
  assert.match(create, /<label for="slideCountInput">Slides<\/label>/);
  assert.match(create, /placeholder="Doc, Sheet, Slides, PDF or image link"/);
  assert.match(create, /Drop files here or <span>choose files<\/span>/);
  assert.doesNotMatch(create, /\(Optional|\(optional/i, "no '(optional)' on the Create tab");
  const visible = create.replace(/<!--[\s\S]*?-->/g, "").replace(/\s(aria-label|placeholder)="[^"]*"/g, "");   // what the user reads
  ["Used for co-branded", "Link a Google Doc", "Uploaded pictures", "Includes cover and Thank You", "Upload files", "Presentation topic", "Source document", "Company domain"]
    .forEach((t) => assert.ok(!visible.includes(t), t));
  assert.doesNotMatch(html, /On-brand Google Slides in minutes/);
});

test("Create tab order: deck type, client, topic, content source (link then files), slides", () => {
  const order = (id) => Number((html.match(new RegExp("#" + id + "\\s*\\{\\s*order:\\s*(\\d+)")) || [])[1]);
  assert.deepEqual(["metaRow", "clientField", "promptField", "sourceField", "filesField", "slidesField"].map(order), [0, 1, 2, 3, 4, 5]);
});

test("client fields only for a Proposal Deck: shown, hidden and sent accordingly", () => {
  assert.match(html, /function isProposal_\(\) \{[^}]*sel\.value === "Proposal Deck"/);
  assert.match(html, /cf\.hidden = !isProposal_\(\)/);
  assert.match(html, /\$\("presentationType"\)\.addEventListener\("change", syncClientField_\);\s*syncClientField_\(\);/);
  assert.match(html, /clientName: isProposal_\(\) \?/);
  assert.match(html, /clientDomain: isProposal_\(\) \?/);
  assert.match(html, /#clientField\[hidden\] \{ display: none !important; \}/);
});
