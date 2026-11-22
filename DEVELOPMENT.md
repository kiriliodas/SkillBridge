# SkillBridge — Developer Guide

Everything a maintainer needs: module contracts, the extension's runtime protocol,
how to change selectors when LM Arena moves, how to add a feature, and the release
checklist.

---

## 1. Getting started

```bash
npm install          # Node >= 20.19
npm run dev          # UI preview on http://localhost:5173 (fixture library)
npm run typecheck    # strict TS, no emit
npm test             # Vitest (unit + DOM + UI)
npm run build        # -> dist/  (loadable extension)
npm run package:zip  # -> release/*.zip + CHECKSUMS.txt
npm run verify       # the whole gate
```

`npm run dev` serves the manager UI against `src/ui/lib/previewRuntime.ts`, a
fixture that uses the real discovery/compilation/prompt engines. It is the fastest
way to iterate on UI. It cannot reach GitHub or LM Arena by design.

When iterating on the extension itself, run `npm run build`, then click **Reload**
on the extension card in `chrome://extensions`. Reload the LM Arena tab too, so the
content script is re-injected.

---

## 2. Module map and contracts

### `src/core` — pure, no I/O

| Module | Contract |
| --- | --- |
| `compiler.ts` | `compileSkillSources(sources, options, expectedHashes?) → { pkg, verification }`. Never mutates content. Throws `CompileError` on empty selection, duplicates or a failed round-trip. Also exports `extractSkills`, `createBoundaryToken`, `verifyRoundTrip`, `countLines`. |
| `prompt.ts` | `generateInstallPrompt(pkg, options?) → string`. Pure function of the package manifest. |
| `repoTree.ts` | `parseRepositoryTree(files, { config, rootName?, defaultExcludes? }) → { skills, tree, warnings, ignoredCount }`. `compareSkills`, `sortSkillsForCompilation`, `collectSkillIds`, `deriveSkillName`, `validateRepoConfig`. |
| `selection.ts` | Pure selection transitions: `toggleSkillWithCatalog`, `setGroupSelected`, `setSkillSelected`, `nodeCheckboxState`, `resolveSelectedSkills`, `pruneSelection`, `summarizeSelection`. |
| `search.ts` | `searchSkills`, `filterTreeForSearch`. Token-AND matching, ranked. |
| `glob.ts` | `compilePatterns`, `isExcluded`. Globs: `*`, `?`, `**`; name-style patterns match any segment. |
| `hash.ts` | Synchronous SHA-256 verified against `node:crypto`. |
| `identity.ts` | `createPackageIdentity` → deterministic `packageId`, `packageName`, `fileName`. |

**Rules:** no `chrome.*`, no `fetch`, no DOM, no `Date.now()` unless injected. These
modules carry the correctness guarantees, so every behaviour change needs a test.

### `src/services` — effects behind injectable dependencies

| Module | Notes |
| --- | --- |
| `github.ts` | `fetchRepoTree`, `loadRepositorySnapshot`, `resolveRevision`, `fetchSkillContent`, `probeRepository`. Every function takes `{ fetchImpl?, token? }`, so tests never touch the network. Errors are `RepoErrorInfo` with an actionable `hint`. `buildRawUrl` accepts paths that are already repository-relative and applies `rootDir` at most once; a 404 from the raw host always falls through to the Contents API before `NOT_FOUND` is reported. |
| `cache.ts` | `KeyValueStore` interface (`ChromeLocalStore`, `MemoryStore`), `RepoCache` (snapshots + skill bodies, TTL, size cap, eviction). Skill entries are keyed by `skillCacheKey(scope, path)` = `sha256(owner::repo::revision::path)`; `repoCache.readSkillAny(scope, path)` / `writeSkill(scope, entry)` require a `CacheScope` and refuse unscoped records. Writes are best-effort and evict on quota errors. |
| `packageService.ts` | `buildPackage(snapshot, selection, deps)` = resolve (cache→network) → verify hashes → compile → prompt. `resolveSkillSources`, `prefetchSkillContents`. Both derive the cache scope with `snapshotScope(snapshot)`, so content is never shared across repositories or commits. |
| `settings.ts` | `sanitizeSettings` (never throws), `SettingsService` with deep merge. |

### `src/background` — service worker

- `state.ts` — `BackgroundState`: the single in-memory source of truth (settings,
  selection, snapshot, status, error). Subscribers are notified through `emit()`.
- `index.ts` — message protocol (`handleRequest`), `performInsert()` orchestration,
  last-package persistence.
- `tabs.ts` — `pickLmArenaTab`, `pingContentScript`, `sendInsertPayload`
  (all accept injected `send`, so the bridge is testable without Chrome).

### `src/integration/lmarena` — the only place that knows LM Arena's DOM

- `selectors.ts` — ordered selector data (composer, file input, attach, send).
- `domActions.ts` — finding elements, React-safe filling, attachment evidence.
- `adapter.ts` — `LmArenaAdapter.run(input, document) → IntegrationReport`.
  Pure state machine over a `Document`; `options.sleep/now` make timing testable.

### `src/ui` — React

- `App.tsx` renders both surfaces (`popup` and `manager`), owns view state
  (search, tabs, preview) and composes `useInsertFlow`.
- `lib/runtime.ts` — `Runtime` interface; `createExtensionRuntime()` talks to the
  worker, `getPreviewRuntime()` powers the dev preview.
- `lib/useSkillBridge.ts` — `useManagerState` (initial load + live updates),
  `useActions`, `useTheme`.
- `lib/useInsertFlow.ts` — compile in the page (so the package is always in hand),
  then ask the worker to integrate.
- `lib/markdown.ts` — XSS-safe renderer. **Never** replace it with a raw-HTML
  renderer; skill content is untrusted.
- `components/*` — design-system primitives + feature components.
- `styles/{tokens,base,components,views,manager}.css` — tokens first; use variables.

---

## 3. Runtime message protocol

All messages are `{ type, ... }` objects sent with `chrome.runtime.sendMessage`.
Responses are `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Type | Payload | Data |
| --- | --- | --- |
| `GET_STATE` | — | `ManagerState` |
| `REFRESH_REPO` | `force?: boolean` | `ManagerState` |
| `SET_SETTINGS` | `settings: Partial<Settings>` | `ManagerState` |
| `SET_SELECTION` | `selection: SelectionState` | `ManagerState` |
| `CLEAR_SELECTION` | — | `ManagerState` |
| `GET_SKILL_CONTENT` | `id` | `{ content, cached }` |
| `PREFETCH_SKILLS` | `ids` | `{ ok, failed }` |
| `GET_STORAGE_STATS` | — | `StorageStats` |
| `CLEAR_CACHE` | — | `{ ok }` |
| `OPEN_MANAGER` | — | `{ ok }` |
| `INSERT_INTO_LM_ARENA` | — | `IntegrationReport` |

Page-level messages (content script only, prefix `SKILLBRIDGE_`):
`SKILLBRIDGE_PING`, `SKILLBRIDGE_DIAGNOSTICS`, `SKILLBRIDGE_INSERT`.

The background broadcasts `{ type: 'STATE_CHANGED' }` to every open extension page
after any state mutation. Pages re-read `GET_STATE`; they never assume payload shape.

---

## 4. Updating the LM Arena integration

**Symptom:** the result dialog reports a failed step and shows "Interface
diagnostics".

1. Open LM Arena, open DevTools, and run the discovery helpers in the console
   (they are exported from `src/integration/lmarena/domActions.ts`, so replicate
   their selectors manually):

   ```js
   document.querySelectorAll('input[type=file]').length;
   [...document.querySelectorAll('textarea, [contenteditable="true"]')].map((el) => el.outerHTML.slice(0, 120));
   [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent?.trim()).slice(0, 40);
   ```

2. Add the new, more stable selectors **at the top** of the relevant array in
   `src/integration/lmarena/selectors.ts`. Keep the fallbacks below.
3. If the upload no longer uses `input[type=file]`, add the new mechanism as an
   alternative attach strategy in `adapter.ts#attachPackage`, keeping
   `verifyAttachment` independent of *how* the file was attached.
4. Extend `tests/lmarena.test.ts`'s fake page so the new structure is covered.
5. `npm test && npm run build`.

Never make the adapter return success unless verification actually passed: the UI,
the auto-send guard and the fallback all depend on that honesty.

---

## 5. Recipes

### Add a setting

1. `src/shared/types.ts` → add the field to `Settings` (pick `repository`,
   `behavior` or `interface`).
2. `src/shared/config.ts` → default value in `DEFAULT_SETTINGS`.
3. `src/services/settings.ts` → coerce it in `sanitizeSettings`.
4. `src/ui/views/SettingsView.tsx` → add a control bound to `draft`, calling
   `updateBehavior`/`updateInterface`.
5. `tests/background.test.ts` → assert the default and the sanitizing behaviour.

### Add a tab to the manager

`App.tsx` has a `Tab` union and a `manager__nav`. Add the tab id, a nav button, and
render the view inside the existing content area. Keep state in `App` so the popup
and manager behave identically.

### Change the package format

Everything lives in `compiler.ts`. Requirements that must not regress:

- Content between `BEGIN`/`END` markers is byte-identical to the source.
- The boundary token never occurs in any selected file (see
  `createBoundaryToken`).
- `extractSkills` can recover every skill (round-trip is enforced at runtime).
- Ordering stays deterministic (`sortSkillsForCompilation`).

Update `compiler.test.ts` (preservation + structure) and the README’s format section
(`tests/docs.test.ts` checks the README stays in sync).

### Handle a lazily mounted upload input

Some chat UIs mount `input[type=file]` only after the attach control is clicked.
`attachPackage` handles that: it looks for the input, and if there is none it
calls `clickElement()` on the first match from `SELECTORS.attachButton`, settles,
and re-scans. `clickElement` dispatches pointer/mouse events and `click()`, and it
suppresses the default action when the control is a submit button so a probe can
never send a message. If LM Arena later uploads through a drop zone or a paste
handler instead, add that as another strategy in `attachPackage` — keep
`verifyAttachment` independent of *how* the file got there.

### Change how files are downloaded

Two invariants keep downloads correct; both are covered by `tests/downloadRevision.test.ts`.

1. **`rootDir` is applied exactly once.** `SkillEntry.path` is repository-relative (it already
   contains the root directory) while `SkillEntry.relPath` is relative to it. `buildRawUrl`
   detects which of the two it was given, so `skills/ai/x.md` with `rootDir: "skills"` never
   becomes `skills/skills/ai/x.md`.
2. **The download ref is a commit or a branch, never a tree.** `GET /git/trees/{ref}` echoes a
   commit SHA for a branch name but a tree SHA when asked for a tree, and a tree SHA is not a
   valid `ref` for `raw.githubusercontent.com` or the Contents API. `resolveRevision` verifies
   the value through `/git/commits/{sha}` and falls back to the branch when it cannot; the
   verified SHA lives in `RepoSnapshot.revision` (used for downloads and cache scoping) while
   `RepoSnapshot.commit` stays abbreviated for the UI.

### Add a repository source (future: multiple repos)

`RepoConfig` + `RepoSnapshot` are already self-describing (`config` inside the
snapshot). Wrap `BackgroundState` in a map keyed by repository and expose an active
id. The snapshot cache key (`repoCacheKey`) already includes owner/repo/branch/root/excludes,
and skill content is scoped by `snapshotScope(snapshot)` (owner/repo/commit), so
entries cannot collide.

---

## 6. Testing conventions

- `tests/*.test.ts` — logic and services. Prefer fakes over mocks: pass
  `fetchImpl`, `sleep`, `now`.
- `tests/*.test.tsx` — UI. Mount the real `App` with a stub `Runtime` via
  `vi.mock('../src/ui/lib/runtime')`. Seed the page cache with
  `setPageCacheFactory(...)` for insert-flow tests.
- DOM tests for the adapter use a hand-written fake LM Arena page, not snapshots,
  so they document the expected structure.
- Every bug fix gets a regression test. Security-relevant rendering changes must
  keep `markdown.test.ts` green.

---

## 7. Release checklist

1. `npm run typecheck`
2. `npm test`
3. `npm run build` → inspect `dist/` (manifest references are verified by the build)
4. `npm run package:zip` → `release/`
5. Load `release/skillbridge-extension-<version>.zip` (unpacked) in a clean Chrome
   profile; verify popup, manager, settings persistence and a real GitHub
   repository.
6. Field-test LM Arena integration on a live tab; if selectors changed, repeat
   section 4 before releasing.
7. Bump `version` in `public/manifest.json` and `package.json` (keep them equal).
8. Update `README.md` if behaviour, defaults or permissions changed
   (`tests/docs.test.ts` will catch most drift).
