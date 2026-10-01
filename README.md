# 66° Deck Agent

AI-powered Google Workspace / Google Slides add-on that turns short prompts and source documents into **structured, visually diverse, on-brand, editable** 66degrees presentations.

The agent does **not** let Gemini emit arbitrary `SlidesApp` code. Gemini (or a deterministic fallback planner) emits a validated **PresentationSpec** intermediate representation (IR). A native rendering engine then creates editable Google Slides shapes, text, tables, and connectors.

## Architecture

```
INPUT
  → Source / Document Analysis
  → Research
  → Content Planning
  → Presentation Intermediate Representation (PresentationSpec)
  → Reference Layout Selection
  → Visual / Diagram Planning
  → Native Google Slides Rendering
  → Brand Enforcement
  → Quality Assurance
  → Final Google Slides Presentation
```

Separated concerns:

| Concern | Module |
|---|---|
| Content / pipeline | `Code.gs`, `Engine.gs` |
| IR schema + validation | `Spec.gs` |
| Layout selection | `Reference.gs` |
| Visuals / diagrams / rendering | `EngineRenderer.gs` |
| Branding | `Brand.gs` |
| Brand QA / rebrand | `Qa.gs`, `Rebrand.gs` |
| Sidebar UI | `Generator.html` |

### Reference repositories inspected (patterns only)

These public repos were inspected for architecture ideas. No source was copied verbatim.

| Repository | Useful pattern | Mapped to |
|---|---|---|
| [presenton/presenton](https://github.com/presenton/presenton) | Structured generation + layout-driven assembly | `Engine.gs`, `Reference.gs` |
| [textboy/mk-present](https://github.com/textboy/mk-present) | Multi-stage research → storyline → render pipeline | `Code.gs` pipeline stages |
| [alfonsograziano/pptx-gen](https://github.com/alfonsograziano/pptx-gen) | Native editable shape output contract | `EngineRenderer.gs` |
| [sci-gen/diagram-pptx](https://github.com/sci-gen/diagram-pptx) | Node/edge diagram DSL → native shapes | diagram DSL in `Spec.gs` / renderer |
| [OpenDCAI/Paper2Any](https://github.com/OpenDCAI/Paper2Any) | Document/content understanding before visuals | source analysis in `Engine.gs` |
| [Whatsonyourmind/deckforge](https://github.com/Whatsonyourmind/deckforge) | Presentation IR + validation/QA | `Spec.gs`, `Qa.gs` |
| [soumadip1/ai-marp-slidegen](https://github.com/soumadip1/ai-marp-slidegen) | AI slide planning + diagram planning | `Engine.gs` planning stages |

## Directory structure

```
66-deck-agent/
├── .github/workflows/deploy.yml
├── src/
│   ├── appsscript.json
│   ├── Code.gs
│   ├── Brand.gs
│   ├── Spec.gs
│   ├── Reference.gs
│   ├── Rebrand.gs
│   ├── Engine.gs
│   ├── EngineRenderer.gs
│   ├── Qa.gs
│   └── Generator.html
├── scripts/validate.js
├── tests/
├── .clasp.json
├── .gitignore
├── package.json
└── README.md
```

## Features

- **Create** and **Rebrand** modes in a Workspace-style sidebar (540×720 target)
- Mandatory **Department** filter: Sales, Delivery, Solutions, Executive, General
- Presentation IR (`PresentationSpec`) with repair + validation
- Reference layout library with scoring, reuse penalties, and top-N random sampling
- Native editable rendering: cards, KPI grids, process flows, timelines, tables, comparisons
- Flowchart / architecture diagram DSL rendered with shapes + connectors (not flattened images)
- Centralized 66degrees brand palette + typography helpers
- Brand enforcement / QA pass before completion
- GitHub Actions deploy workflow via `@google/clasp`
- Deterministic planner fallback when `GEMINI_API_KEY` is not configured

## Brand system

Centralized in `Brand.gs`:

| Token | Value |
|---|---|
| Primary Blue | `#0052FF` |
| Ink | `#040A1B` |
| Panel | `#F2F7FB` |
| Panel Alt | `#D1DBDF` |
| Title | `#000000` |
| Body | `#333333` |

Typography:

- Titles / UI: **Plus Jakarta Sans** (~20pt semibold for titles)
- KPI / numerical: **IBM Plex Mono**

## Presentation IR (PresentationSpec)

```json
{
  "metadata": {
    "title": "Cloud value story",
    "subtitle": "Executive Brief",
    "audience": "Executive"
  },
  "department": "Executive",
  "presentationType": "Executive Brief",
  "theme": "66degrees",
  "slides": [
    {
      "id": "slide_1",
      "category": "cover",
      "purpose": "opening",
      "title": "Cloud value story",
      "subtitle": "Executive Brief",
      "body": "",
      "layoutId": "ref_cover_hero",
      "visualType": "cover",
      "elements": [],
      "diagram": null,
      "speakerNotes": ""
    }
  ]
}
```

Supported element types include: `text`, `richText`, `image`, `card`, `metric`, `KPI`, `chart`, `table`, `process`, `flowchart`, `decision`, `timeline`, `comparison`, `architecture`, `quote`, `icon`, `connector`.

### Diagram DSL

```json
{
  "type": "flowchart",
  "direction": "LR",
  "nodes": [
    { "id": "lead", "type": "process", "label": "Lead" },
    { "id": "qualify", "type": "decision", "label": "Qualified?" }
  ],
  "edges": [
    { "from": "lead", "to": "qualify" }
  ]
}
```

Node types: `process`, `decision`, `start`, `end`. Directions: `LR`, `TB`.

## Reference library format

Each layout entry in `Reference.gs` includes:

- `id`, `category`, `visualType`
- `departments` (includes `general` for shared layouts)
- `presentationTypes`
- `purpose`, `contentTypes`

Selection scoring considers content type, purpose, visual type, department, presentation type, prior category, and reuse.

Penalties:

- `-50` if layout id already used
- `-25` if category matches the immediately previous slide

The selector randomly samples among the top-scoring candidates to avoid repetitive decks.

## Local development

### Prerequisites

- Node.js 18+
- Git
- Google account with access to Google Apps Script / Slides
- Optional: [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`)

### Install & validate

```bash
npm install
npm test
```

This runs:

1. Static validation (`scripts/validate.js`) — JSON/YAML/HTML/manifest/secret scans + Apps Script module load checks
2. Unit tests for IR validation, reference selection, planner fallback, diagram planning

### clasp setup

1. Create a new Apps Script project (or use an existing one).
2. `clasp login`
3. Copy the Script ID into `.clasp.json` (`scriptId`).
4. From repo root:

```bash
clasp push
```

`rootDir` is `src/`.

### Google Cloud / Gemini configuration

1. In Apps Script → **Project Settings** → **Script properties**, set:

   - `GEMINI_API_KEY` = your Gemini API key

2. Enable required Google services / APIs for the Apps Script project as prompted (Slides, Drive readonly, UrlFetch).

3. If the key is missing, the agent uses a deterministic on-brand planner so local structural testing still works. Live AI quality requires the key.

OAuth scopes (minimum evaluated set in `src/appsscript.json`):

- `https://www.googleapis.com/auth/presentations`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/script.container.ui`

## Using the add-on

1. Open Google Slides.
2. Use menu **66° Deck Agent → Open Generator**.
3. Choose **Create** or **Rebrand**.
4. Select Presentation Type + Department.
5. Set slide count (3–20).
6. Enter prompt and optional source Doc/Slides URL.
7. Generate and open the resulting presentation.

## Deployment (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

Flow:

1. Checkout
2. Setup Node.js
3. `npm ci` + `npm test`
4. Install `@google/clasp`
5. Write credentials from GitHub Secrets
6. `clasp push`
7. `clasp deploy` (uses `DEPLOYMENT_ID` when provided)

### Required secrets

| Secret | Purpose |
|---|---|
| `CLASPRC_JSON` | Contents of local `.clasprc.json` from `clasp login` |
| `SCRIPT_ID` | Apps Script project id |
| `DEPLOYMENT_ID` | Optional existing deployment id to update |

Never commit `.clasprc.json`, OAuth client secrets, API keys, or service-account keys.

If secrets are absent, the workflow validates successfully and skips deploy steps safely.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sidebar bootstrap says “Fallback planner” | `GEMINI_API_KEY` missing | Set Script Property |
| Source document ignored | URL not Drive/Docs or no access | Use HTTPS Drive URL; authorize Drive readonly |
| Rebrand fails | Invalid Slides URL / permissions | Paste a full Slides URL you can open |
| Deploy skipped in Actions | Secrets not configured | Add `CLASPRC_JSON` + `SCRIPT_ID` |
| Fonts look different | Plus Jakarta / IBM Plex unavailable in account | Brand helpers fall back to Arial / Courier New |

## Known limitations

- Gemini planning quality depends on API availability/quota; fallback planner is deterministic, not research-grade.
- Source document ingestion is best-effort text extraction for Drive files; complex PDFs/binaries are summarized by filename/metadata when text cannot be read.
- Chart rendering currently focuses on KPI/metric/table primitives; advanced chart types can be extended in `EngineRenderer.gs`.
- Cancel in the sidebar signals intent; Apps Script cannot preempt an in-flight server function mid-stage.
- Production Apps Script deployment requires configured GitHub secrets / clasp credentials and is not claimed successful unless those secrets are present and the workflow deploy job is verified.

## License

See [LICENSE](./LICENSE).
