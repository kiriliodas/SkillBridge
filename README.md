# SkillBridge

**A Skill library manager for LM Arena — browse a GitHub repository of Markdown skills, select any combination, compile them into one lossless package, and install them into an LM Arena conversation with a generated prompt.**

SkillBridge is a Chrome extension (Manifest V3) with no backend, no account and no telemetry. The GitHub repository is the single source of truth for the library: adding a folder or a Markdown file is enough for it to appear in the extension.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Chrome Developer Mode instructions](#chrome-developer-mode-instructions)
- [Build from source](#build-from-source)
- [GitHub repository configuration](#github-repository-configuration)
- [How to organize the Skill repository](#how-to-organize-the-skill-repository)
- [The bundled Skill library](#the-bundled-skill-library)
- [How to add new Skills](#how-to-add-new-skills)
- [How compilation works](#how-compilation-works)
- [Prompt generation](#prompt-generation)
- [LM Arena integration](#lm-arena-integration)
- [Fallback workflow](#fallback-workflow)
- [Settings](#settings)
- [Architecture](#architecture)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Security and privacy](#security-and-privacy)
- [Release artifacts](#release-artifacts)
- [License](#license)

---

## Features

**Library**

- Dynamic discovery of every `.md` file in a GitHub repository (or a configured root directory). Arbitrary nesting depth, no hardcoded skills, categories or file names.
- Full support for spaces, accents, Unicode and emoji in folder and file names.
- Hierarchical category browser with expand/collapse and tri-state checkboxes (unchecked / checked / indeterminate).
- Select individual skills, whole subcategories, whole categories, or the entire repository.
- Instant search across skill names, file names, category names, subcategories and paths.
- Preview the **original** Markdown of any skill before selecting it (rendered + raw source view).
- Selection summary: skill count, categories represented, estimated package size and estimated line count.
- Manual refresh, cached metadata (10 min) and cached skill content (24 h). Skill bodies are only downloaded when previewed or compiled.
- **Cache entries are scoped to `owner/repo` + the commit SHA** (never the file path alone), so two repositories sharing a path — or a branch switch or new commit — can never serve another repository's or an older revision's bytes. Cache writes are best-effort: a full storage quota degrades to "no cache" instead of failing a build.

**Compilation**

- One Markdown package per selection, with a package header, an integrity manifest and per-skill metadata.
- Original content is preserved **byte-for-byte**: no summarization, rewriting, reflowing, trimming, reordering or normalization. Blank lines, code fences, tables, links, Unicode and trailing newlines are untouched.
- Collision-proof boundaries: each package gets a unique boundary token (derived from a hash of all content) that is verified not to occur in any selected file.
- Deterministic ordering: category hierarchy → skill name → file path.
- SHA-256 integrity manifest, plus an internal round-trip check that re-extracts every skill from the produced document and compares it with the original before the package is handed to the UI.
- Large files are supported; a configurable soft limit (2–32 MB, default 8 MB) protects the message size.

**LM Arena integration**

- Content script restricted to LM Arena hosts, with a DOM adapter isolated in its own module.
- Attaches the package to the page's file input, verifies the attachment, fills the message input, verifies the prompt, and only sends automatically when **Auto-send** is enabled **and** both verifications pass.
- Step-by-step report of what succeeded and what failed, with an interface diagnostic dump when something does not match.
- Never claims success silently, never discards the package, and never sends a message the user did not authorise.

**Fallback**

- If LM Arena is unreachable or the upload interface changed: download the package, copy the prompt, follow the on-screen instructions.
- The package and prompt are always available after a run, successful or not.

**Interface**

- Dark-first, neutral, high-density developer tool. System / Dark / Light themes, compact mode.
- Popup (440 × 600) and a full-page manager (`manager.html`) sharing one component and one state source.

---

**Accessibility.** The category tree is a real keyboard surface: rows are focusable, `Enter` opens a preview, `Space` toggles selection, `←`/`→` collapse and expand branches, `/` focuses search, and `Esc` closes the preview or dialog. The result dialog is a true modal: focus moves into it, `Tab` cycles inside, `Esc` closes it and focus returns to where it was. Focus rings use the accent colour at 2 px.

---

## How it works

```
GitHub repository
      │  git tree (1 request) + raw content (on demand)
      ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ Discovery           │────▶│ Selection + Search   │────▶│ Compilation engine  │
│ repoTree.ts         │     │ selection/search.ts  │     │ compiler.ts         │
└─────────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                     │ one .md package
                                                                     ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ LM Arena adapter    │◀────│ Prompt generation    │◀────│ Integrity manifest  │
│ (content script)    │     │ prompt.ts            │     │ SHA-256 per skill   │
└──────────┬──────────┘     └──────────────────────┘     └─────────────────────┘
           │ attach + fill + optional send
           ▼
   LM Arena conversation ──▶ rebuilds skills/ from the package
```

1. **Discovery** reads the repository tree once (`/git/trees/:ref?recursive=1`), keeps every `.md` file under the configured root, and builds the category tree from the folder paths.
2. **Selection** is stored as ids (or an "all" flag) and pruned whenever the repository changes.
3. **Compilation** downloads the selected files (cache first), verifies each hash, and concatenates them into one package. Nothing inside a boundary is ever modified.
4. **Prompt generation** builds a generic installation prompt from the package manifest — no hardcoded skill names.
5. **Integration** finds the LM Arena tab, attaches the package, verifies it, fills the prompt, verifies it, and optionally sends.

---

## Installation

### Option A — Use the prebuilt extension (recommended)

1. Download `release/skillbridge-extension-1.0.0.zip`.
2. Unzip it into a permanent folder (for example `~/SkillBridge`). Do not delete the folder afterwards — Chrome loads the extension from it.
3. Open Chrome and follow [Chrome Developer Mode instructions](#chrome-developer-mode-instructions).

### Option B — Build from source

```bash
git clone <this-repository> SkillBridge
cd SkillBridge
npm install
npm run build
```

The production extension is written to `dist/`. Then load `dist/` as described below.

To produce the release ZIPs as well:

```bash
npm run package:zip
```

---

## Chrome Developer Mode instructions

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge `edge://extensions`, Brave `brave://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the folder that contains `manifest.json` — either the unzipped release folder or `dist/` from the build.
5. The SkillBridge icon appears in the toolbar. Pin it for quick access.
6. Open the extension. On first run it loads the default library (`anthropics/skills`).
7. To test LM Arena integration, open <https://lmarena.ai> in a tab, select skills in SkillBridge, and click **Insert Skills into LM Arena**.
8. After updating the extension, press the **Reload** button on its card in `chrome://extensions`, and reload any open LM Arena tab.

> Chrome only grants host access on demand: the first GitHub request prompts for `api.github.com` / `raw.githubusercontent.com` access. Allow it — requests are read-only.

---

## Build from source

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies (Node ≥ 20.19). |
| `npm run dev` | Serves a UI preview at `http://localhost:5173` with a local fixture library. LM Arena integration is disabled in preview. |
| `npm run typecheck` | TypeScript strict check, no emit. |
| `npm test` | Runs the full Vitest suite (unit, integration, DOM, UI). |
| `npm run build` | Typecheck, build the two HTML pages, then bundle `background.js` and `content.js` into `dist/`. |
| `npm run build:ui` | Only the popup/manager bundles (Vite). |
| `npm run build:targets` | Only `dist/background.js`, `dist/content.js`, `manifest.json` and icons (esbuild). |
| `npm run package:zip` | Creates `release/skillbridge-extension-<version>.zip`, `release/skillbridge-source-<version>.zip` and `release/CHECKSUMS.txt`. |
| `npm run verify` | Typecheck → tests → build → ZIP. The complete release gate. |
| `npm run icons` | Re-renders `public/icons/*.png` from `icon.svg` (uses `sharp` if installed, otherwise ImageMagick). Only needed when the SVG changes; the PNGs are committed. |

### Build output (`dist/`)

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest (3 permissions, 2 optional host permissions). |
| `background.js` | Service worker: state, GitHub access, caching, tab bridge. |
| `content.js` | Content script injected on LM Arena pages only. |
| `popup.html` + `assets/*` | Popup UI. |
| `manager.html` + `assets/*` | Full-page library manager. |
| `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` | Extension icons. |

---

## GitHub repository configuration

Open **Settings → Repository** in the extension:

| Field | Example | Notes |
| --- | --- | --- |
| Owner | `LM-Arena` | GitHub user or organisation. |
| Repository | `LM-Arena-Skills` | Repository name (`.git` suffix is stripped). |
| Branch | `main` | Any branch, tag or commit SHA. |
| Root directory | `skills` | Optional. Empty means the repository root. |
| Excluded files or directories | `**/drafts/**`, `**/template.md` | Optional glob patterns. |

Defaults: `anthropics/skills`, branch `main`, root `skills` — a public repository that works without authentication.

Built-in exclusions (always applied): `README.md`, `readme.md`, `LICENSE*`, `CHANGELOG*`, `.github/**`, `node_modules/**`, `.git/**`, and any hidden folder or file.

Private repositories are **not** supported in V1. The integration is structured so a token can be supplied at runtime later (`GithubDeps.token`), and the service worker never stores or embeds one.

---

## How to organize the Skill repository

Every folder is a category; every `.md` file is one skill. Depth is unlimited.

```
LM-Arena-Skills/
├── Android/
│   ├── Kotlin/
│   │   ├── kotlin-standards.md      → Category "Android / Kotlin", skill "Kotlin Standards"
│   │   └── coroutines.md            → Category "Android / Kotlin", skill "Coroutines"
│   └── Jetpack Compose/
│       ├── architecture.md
│       └── material-design.md
├── Web Development/
│   ├── Frontend/
│   │   ├── react-best-practices.md
│   │   └── accessibility.md
│   └── Backend/
│       └── api-design.md
├── Database/
│   ├── SQL/
│   │   └── sql-best-practices.md
│   └── Design/
│       └── database-design.md
└── General/
    └── project-management.md
```

Naming rules:

- **File name → skill name.** `kotlin-standards.md` → *Kotlin Standards*; `Réseau & Sécurité.md` → *Réseau & Sécurité*.
- Generic file names (`SKILL.md`, `index.md`, `skill.md`, `main.md`) use the parent folder name instead, which suits folder-per-skill repositories.
- **Folder path → category hierarchy.** Spaces, accents, emoji and non-Latin scripts are preserved exactly.
- Sorting is deterministic and locale-aware.

---

## The bundled Skill library

This repository ships a curated library of **40 skills** in `skills/`, ready to be used as the
SkillBridge source with no further configuration.

```
skills/                      ← the only folder the scanner reads (rootDir = "skills")
├── development/             backend, frontend, typescript, python, databases,
│                            testing, debugging, git
├── ai/                      prompting, agents, evaluation, retrieval
├── security/                application-security, supply-chain, systems (defensive only)
├── analysis/                reasoning, decisions, data
├── research/                source verification, literature, spikes
├── writing/                 technical writing, editing, translation
├── design/                  accessibility, UI review, design systems
├── productivity/            planning, prioritisation, notes
├── business/                proposals, discovery, meetings
└── education/               explanation, study design

skill-library/               ← documentation, deliberately OUTSIDE the scanned root
├── INDEX.md                 start here: discovery by task
├── CATALOG.md               every skill with its description and score
├── SOURCES.md               method, rubric, what was taken from where
├── CANDIDATES.md            every candidate examined, including rejections
└── LM-ARENA-CONSTRAINTS.md  measured sandbox limits
```

`INDEX.md` and the other documents live in `skill-library/`, **not** in `skills/`, on purpose:
every `.md` file under the root directory becomes a selectable skill, and documentation must
never be shipped to LM Arena as if it were one. `tests/skillLibrary.test.ts` enforces this,
along with the absence of secrets, duplicates, empty files and orphan categories.

Scope is deliberate: Java/Kotlin/Android, Rust, Go, cloud deployment, browser automation and
offensive security are **not** included, because none of them can be verified in the LM Arena
sandbox (no JVM, no browser, no credentials). Shipping unverified instructions would be worse
than shipping none.

---

## How to add new Skills

1. Add a Markdown file anywhere under the configured root directory (or under the repository root when no root is configured).
2. Commit and push to the configured branch.
3. In SkillBridge, press **Refresh** (header) or **Settings → Refresh repository**.

The skill appears immediately in its folder hierarchy. No extension update, rebuild or configuration change is required — the library is entirely dynamic. To exclude a file, add a glob pattern under **Settings → Repository → Excluded files or directories**.

---

## How compilation works

`src/core/compiler.ts` performs a pure concatenation. Nothing inside a content boundary is read back, trimmed, normalized or re-rendered.

### Package structure

```markdown
# SKILLBRIDGE PACKAGE

Package ID: SB-20261121-4F2A9C1B
Package Name: SkillBridge Package 20261121
Repository: LM-Arena/LM-Arena-Skills
Branch: main
Root Directory: skills
Compilation Date: 2026-11-21T10:00:00Z
Total Skills: 2
Total Categories: 1
Original Content: 5120 bytes, 143 lines
Boundary Token: 9C1B7A44D0E3F812

## SKILL MANIFEST
| # | Skill | Category | Source file | Bytes | Lines | SHA-256 |
...

---

## SKILL METADATA

Name: Coroutines
Category: Android / Kotlin
Source File: Android/Kotlin/coroutines.md
Index: 1 of 2
Original Size: 2048 bytes, 60 lines
SHA-256: a3f1…(64 hex chars)

<!-- SKILLBRIDGE:BEGIN:SB-20261121-4F2A9C1B:0001:9C1B7A44D0E3F812:Android%2FKotlin%2Fcoroutines.md -->
…original file, byte for byte…
<!-- SKILLBRIDGE:END:SB-20261121-4F2A9C1B:0001:9C1B7A44D0E3F812:Android%2FKotlin%2Fcoroutines.md -->

<!-- END OF SKILL -->

---
```

- **Content preservation.** Each file's text is inserted verbatim between its BEGIN and END markers. The compiler performs a round-trip verification before returning: it re-parses the produced document and compares every extracted skill against the source with SHA-256. A mismatch raises `ROUNDTRIP_FAILED` instead of producing a corrupted package.
- **Boundaries.** The 16-character boundary token is derived from the package id and the hash of all selected content, then checked against every selected file. If the token (or its BEGIN marker) appears anywhere in the content, a new token is generated. The package id and per-skill index/skill id are also part of the marker, so a package nested inside another package can never be confused with the outer one (tested).
- **Ordering.** Category hierarchy, then skill name (locale-aware, numeric-aware), then file path. The same selection always produces the same document, byte for byte, for a fixed compilation timestamp.
- **Manifest.** Records the package id, counts, total bytes and lines, and for every skill: index, name, category, source path, byte length, line count and SHA-256. If a hash captured at discovery no longer matches, the entry is flagged `CHANGED SINCE DISCOVERY` and the UI surfaces it.
- **Package id.** `SB-YYYYMMDD-XXXXXXXX`, where the suffix is a hash of the ordered `path:contentHash` pairs. Identical content produces the same id; the file name is `skillbridge-package-xxxxxxxx.md`.

### Re-extracting a package

```ts
import { extractSkills } from './src/core/compiler';

for (const skill of extractSkills(packageMarkdown)) {
  console.log(skill.index, decodeURIComponent(skill.skillId), skill.content.length);
}
```

---

## Prompt generation

`src/core/prompt.ts` builds **one** generic template. Skill names, counts and categories are injected from the manifest; there is no per-library logic.

The prompt asks LM Arena to:

1. Read the entire attached package.
2. Identify every skill, its category and its source file from the metadata and manifest.
3. Recreate the original category hierarchy inside a `skills/` directory.
4. Write one Markdown file per skill, copying the text between boundaries byte-for-byte.
5. Create `skills/INDEX.md` (name, category, path, short description).
6. Create `skills/README.md` describing the library.
7. Provide a selection mechanism based on the index and categories.
8. Read `INDEX.md` before a task and load only the relevant skills.
9. Avoid loading unrelated skills.
10. Resolve conflicting instructions sensibly and state the resolution.
11. Verify the installation (file count vs manifest, spot-check) and report the result.

The prompt scales from 1 to 100+ skills: above 40 skills / 30 categories the listings are compacted with a “see the manifest” pointer, and the template never exceeds ~6 KB.

---

## LM Arena integration

**Where it lives:** `src/integration/lmarena/` (selectors, DOM actions, adapter) plus `src/content/index.ts` (message bridge). The rest of the extension knows only the report format, so the adapter can be replaced without touching the UI.

**What it does**

1. Find the LM Arena tab (active tab first, restricted to LM Arena hosts).
2. Ensure the content script is reachable; inject it on demand if the tab predates the extension install.
3. Locate the composer: `textarea[data-sentry-element="AutoResizeTextarea"]`, then any visible `textarea`, then `[contenteditable="true"][role="textbox"]`.
4. Attach the package by assigning a `File` to the page's `input[type=file]` (native value setter + `input`/`change` events, as a real upload would produce). Falls back to the last file input when several exist. If no input is mounted yet, the attach control is clicked once (safely: a submit button's default is suppressed) and the page is re-scanned.
5. Verify attachment: wait for a rendered attachment chip containing the file name (up to 8 s). If only the input still holds the file, report a warning instead of success.
6. Fill the composer using the native value setter + events (or `execCommand('insertText')` for contenteditable), then read it back and compare.
7. Send only when **Auto-send installation prompt** is ON **and** the attachment was verified as `ok` **and** the composer still contains the exact prompt. Any deviation aborts the send.
8. Report every step (ok / warning / skipped / failed) plus diagnostics, and keep the package + prompt available.

**Network resilience.** Skill bodies are fetched from `raw.githubusercontent.com`. If that host is blocked (corporate proxy, DNS filtering) or answers with a server error, SkillBridge transparently retries the same file through the REST contents API (`api.github.com/repos/.../contents/...`), verifies the decoded byte length, and only then compiles. A genuine `404` is reported as a missing file — it does not silently retry.

**Why it degrades gracefully:** LM Arena is a React app with hashed class names and an interface that changes. The adapter relies on roles, labels, `aria-*` attributes and the presence of an upload input; selectors are plain data in `selectors.ts`. When the interface changes, the fallback path still works and the diagnostics panel shows what was found.

> ⚠️ **Verification status.** The integration could not be verified against the live LM Arena interface while building this project: the build environment has no browser and no network access to LM Arena. Everything down to the DOM level is covered by tests against a simulated composer (hidden file input, attachment chip, send button, contenteditable variant), including attachment failure, verification failure and auto-send safety. Treat the first real run as a field test and use **Settings → diagnostics** (shown in the result dialog) if selectors need updating.

---

## Fallback workflow

Whenever integration is unavailable, incomplete or fails verification, the result dialog offers:

1. **Download package** — the exact compiled `.md` file.
2. **Copy prompt** — the full installation prompt.
3. Step-by-step manual instructions.
4. The interface diagnostics (what the adapter found on the page).

Nothing is discarded. The last compiled package and prompt are stored in `chrome.storage.local`; if you close the dialog, a **Last compiled package** banner on the library screen still offers **Download** and **Copy prompt**.

Manual installation: open LM Arena → attach the downloaded `.md` with the attach/upload control → paste the prompt → send. LM Arena reconstructs the `skills/` library from the package.

---

## Settings

**Repository**

- Owner, repository, branch, root directory, excluded patterns.
- Refresh repository, connection status (with commit, fetch time and skill count), default repository shortcut.

**Behavior**

| Setting | Default | Effect |
| --- | --- | --- |
| Auto-send installation prompt | **OFF** | When ON, sends automatically *only* after attachment and prompt verification. |
| Automatically attach compiled package | **ON** | Attach the package to the message. |
| Copy generated prompt | **OFF** | Copies the prompt to the clipboard automatically as soon as a package is compiled, so the fallback needs no extra click. |
| Remember selected skills between sessions | **ON** | Restores the selection on reopen. Turning it **off** also erases the stored selection, so a restarted worker never resurrects an old one. |
| Maximum package size | 8 MB | Compilation stops with a clear error above this size. |

**Interface**

- Theme: System / Dark / Light (dark by default).
- Compact mode.

**Cache**

- Cached skill count and size, and a “Clear cached data” action.
- Entries are keyed by `sha256(owner::repo::revision::path)` and stored under `skillbridge.skill.v2:`. They are scoped to a commit, so a refresh that moves the branch re-downloads changed files and never mixes revisions.
- Each entry's SHA-256 is verified on read: a record corrupted at rest is treated as a miss and re-downloaded, never compiled into a package. The cache is strictly optional — a full quota or an unavailable `chrome.storage.local` degrades to “no cache” instead of failing a build.
- Turning off “Remember selected skills” erases the stored selection. Pointing the extension at another repository starts from an empty selection, because path-derived skill ids can collide across repositories.
- Entries from the older path-only format (`skillbridge.skill.v1:`) are unreadable by design and are purged automatically on install and on browser startup.

Settings are stored with `chrome.storage.local`, merged with defaults on read, and sanitized field by field — a corrupt or outdated value can never break the extension.

---

## Architecture

```
src/
├── core/                    pure, dependency-free logic (fully tested)
│   ├── compiler.ts          package compilation, boundaries, manifest, round-trip check
│   ├── prompt.ts            generic installation-prompt generation
│   ├── repoTree.ts          tree → skills → category tree, naming, ordering, validation
│   ├── selection.ts         selection model, tri-state, summaries, pruning
│   ├── search.ts            ranked instant search + tree filtering
│   ├── glob.ts              exclude-pattern matcher
│   ├── hash.ts              SHA-256 (verified against Node crypto)
│   └── identity.ts          deterministic package ids and file names
├── services/                side-effectful, injectable dependencies
│   ├── github.ts            REST tree + raw content, error mapping, timeouts
│   ├── cache.ts             chrome.storage.local / memory cache, TTL + LRU-style eviction
│   ├── packageService.ts    resolve contents → verify → compile → prompt
│   └── settings.ts          persistence, merging, sanitizing
├── background/              service worker
│   ├── index.ts             message protocol, insert orchestration
│   ├── state.ts             single source of truth for repo/selection/settings
│   ├── storage.ts           runtime storage wiring
│   └── tabs.ts              LM Arena tab discovery and messaging
├── content/                 content script (LM Arena pages only)
├── integration/lmarena/    selectors, DOM actions, adapter (isolated)
├── ui/                      React UI (popup + manager share components)
│   ├── App.tsx  Manager.tsx  views/  components/  styles/
│   └── lib/                 runtime client, hooks, markdown renderer, files
└── shared/                  types, defaults, formatting
```

Design rules:

- **Core is pure.** No DOM, no `chrome`, no network — which is why compilation and prompt generation can be exhaustively tested.
- **One state source.** The service worker owns repository, selection and settings; popup and manager subscribe to `STATE_CHANGED`.
- **One UI codebase.** `App` renders both surfaces; only layout and chrome differ.
- **Isolated integration.** All LM Arena knowledge lives behind the adapter interface and its selector data.
- **No secrets, no backend, no analytics.**

Extension permissions and why:

| Permission | Reason |
| --- | --- |
| `storage` | Settings, selection, caches, last package. |
| `activeTab` | Act on the LM Arena tab the user is looking at. |
| `scripting` | Inject the content script into an already-open LM Arena tab. |
| `optional_host_permissions` | `api.github.com`, `raw.githubusercontent.com`. Chrome asks **once**, the first time you refresh or load a repository (the request is tied to that click). |

Optional host permissions are genuinely optional: GitHub's API and raw endpoints send permissive CORS headers, so fetching still works if you decline — the grant only removes the browser's CORS restrictions and lets you use higher rate limits through the extension origin.

No `web_accessible_resources`: the manager page opens as a normal extension tab, so nothing is exposed to web pages.

The content script matches only `https://lmarena.ai/*`, `https://www.lmarena.ai/*`, `https://arena.ai/*`, `https://www.arena.ai/*`. There is no `<all_urls>` access.

---

## Testing

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run typecheck     # strict TypeScript
npm run verify        # typecheck + tests + build + ZIP
```

Coverage by area:

| Suite | What it proves |
| --- | --- |
| `hash.test.ts` | SHA-256 matches Node crypto for every padding boundary and Unicode. |
| `glob.test.ts` | Exclude patterns: `*`, `**`, `?`, name-style patterns, directories, accents. |
| `repoTree.test.ts` | Discovery, nesting, spaces, Unicode, empty folders, excludes, ordering, config validation. |
| `selection.test.ts` | Individual/group/all selection, tri-state, pruning, summaries. |
| `search.test.ts` | Name/file/category matching, AND semantics, ranking, tree filtering. |
| `compiler.test.ts` | Byte-exact preservation (Unicode, CRLF, code fences, tables, empty files, hostile content, 1.5 MB file, 120 skills), metadata, boundaries, ordering, manifest, integrity, round-trip. |
| `prompt.test.ts` | 1/many/large packages, categories, counts, file name, no hardcoded names, stability. |
| `github.test.ts` | URL building, 404/401/403/409/451/5xx mapping, network errors, truncation, token handling. |
| `packageService.test.ts` | Download/cache behaviour, subset ordering, failures, size limit, eviction. |
| `cacheScope.test.ts` | Cache isolation: same path in two repositories, commit and branch changes, legacy entries, eviction, quota failures, and compilation/prefetch scoping. |
| `background.test.ts` | Settings sanitizing, repository lifecycle, caching, pruning, selection reset on repository change, tab bridge, error reporting. |
| `lmarena.test.ts` | Full adapter flows on a simulated composer: success, missing composer/input, attachment failure, verification warning, auto-send safety, contenteditable. |
| `markdown.test.ts` | Rendering plus XSS safety (raw HTML, `javascript:`/`data:` URLs, attribute injection). |
| `ui.test.tsx` | Real React app in jsdom: tree, selection, search, preview, settings, insert flow, error states. |
| `worker.test.ts` | The real service worker with a Chrome-like environment and a fake LM Arena tab: message envelope, refresh, persistence, insert orchestration, missing-tab and build-failure paths. |
| `contentBundle.test.ts` | The built `dist/content.js` executed in jsdom: listener registration, ping/diagnostics, message filtering, honest `prompt-only` degradation. |
| `previewRuntime.test.ts` | The dev-preview fixture stays loadable and complete (guards `npm run dev`). |
| `docs.test.ts` | README/manifest consistency: permissions, defaults, content-script scope, icons, no hardcoded skills (doc comments excluded). |

---

## Troubleshooting

**“Repository, branch or path not found (404).”**
Check owner/repository/branch spelling and that the root directory exists. Private repositories are not supported in V1.

**“GitHub rate limit reached (403).”**
Unauthenticated GitHub allows 60 API requests per hour per IP. Metadata is cached for 10 minutes and skill bodies for 24 hours. Wait, or switch to a smaller root directory.

**No skills found.**
Verify that the root directory contains `.md` files and they are not excluded. Hidden folders and `README.md`/`LICENSE*` are ignored by design. Press **Refresh**.

**“No LM Arena tab found.”**
Open <https://lmarena.ai> (or `arena.ai`) in a tab, then run the insert again.

**“The LM Arena page is not reachable.”**
Reload the LM Arena tab (the content script ships with the page load), or re-run the insert — SkillBridge attempts a programmatic injection.

**Package attached but prompt not inserted.**
Copy the prompt from the dialog and paste it into the composer manually; the package stays attached.

**Auto-send did not happen.**
By design, auto-send requires: setting ON, attachment verified, prompt verified and unchanged. The dialog lists which condition failed.

**LM Arena changed its interface.**
Open the diagnostics section in the result dialog, then update `src/integration/lmarena/selectors.ts` and rebuild. The adapter is the only place that needs changes.

**Preview mode banner in the UI.**
You are running `npm run dev` in a normal tab. Load `dist/` as an unpacked extension for the real thing.

---

## Known limitations

- **LM Arena integration is not verified against the live interface** in this build environment (no browser, no network access to LM Arena). It is fully covered by tests against a simulated composer and ships with honest failure reporting and a complete fallback.
- **No direct LM Arena API.** Integration works at the DOM level, so it is subject to interface changes; the adapter and selectors are isolated to make updates small.
- **Private repositories** are not supported in V1. The GitHub client accepts a runtime token so this can be added without restructuring.
- **Very large packages** depend on the LM Arena upload/message limit. The default 8 MB cap is configurable; the compiled size is shown before insertion.
- **Unicode normalization** is deliberately *not* applied: file content is preserved exactly as stored in Git.
- **GitHub API rate limits** apply without authentication. Metadata caching mitigates this but does not remove it.
- **No multi-repository support** yet (single repository configuration per install).
- The dev preview (`npm run dev`) runs on a fixture library and cannot reach GitHub or LM Arena; it exists for UI work only.

---

## Security and privacy

- **No secrets** in source: no GitHub token, no API key, no credentials. Token support is runtime-only and optional.
- **Minimal permissions**: 3 API permissions, 2 optional host permissions, content script limited to LM Arena hosts.
- **Skill content is data.** Markdown is rendered by a custom renderer that escapes all HTML and allows only `http(s)`, `mailto`, relative and anchor links with `rel="noopener noreferrer"`. Raw HTML in a skill is displayed as text, never executed.
- **No remote code.** MV3 CSP is `script-src 'self'; object-src 'self'`.
- **No telemetry.** Network traffic is limited to GitHub (discovery/content) and LM Arena (user-initiated insertion).
- **Send safety.** Auto-send is OFF by default and requires both verifications; any composer drift aborts it.
- **Data locality.** Settings, selection, caches and the last package live in `chrome.storage.local`; “Clear cached data” removes cached repository and skill data.

---

## Release artifacts

`npm run package:zip` writes to `release/`:

| Artifact | Contents |
| --- | --- |
| `skillbridge-extension-1.0.0.zip` | Production extension: `manifest.json`, `background.js`, `content.js`, `popup.html`, `manager.html`, `assets/`, `icons/`. Ready for **Load unpacked**. |
| `skillbridge-source-1.0.0.zip` | Complete source: `src/`, `skills/`, `skill-library/`, `tests/`, `scripts/`, `public/`, configs, docs. |
| `CHECKSUMS.txt` | SHA-256 of both archives plus a per-file size table. |

---

## License

MIT. See [LICENSE](LICENSE).

Skill content belongs to the repository you point SkillBridge at; the extension only reads it. `anthropics/skills` is used as the default library example and is governed by its own license.
