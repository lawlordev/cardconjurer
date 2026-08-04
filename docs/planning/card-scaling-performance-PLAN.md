# Card Scaling and Performance Plan

## Structured brief

Set Conjurer 0.1.0-beta.3 becomes nearly unusable after roughly ten completed cards with artwork and can eventually crash. The beta.4 fix must remove the art-size multiplier from normal editing and make a workspace of approximately 1,000 cards a supported, deliberately tested case rather than an accidental edge case.

The user-visible goal is that selecting, editing, creating, duplicating, deleting, saving, undoing, and reopening cards remain responsive as a set grows. Large original artwork must remain durable and portable, but inactive full-resolution art must not be copied into renderer history, serialized on every keystroke, or decoded merely to show the card list.

### Success criteria

- A workspace containing 1,000 cards can open, display its card list, select cards, edit the active card, autosave, undo/redo, and restart without a crash or art loss.
- Original uploaded artwork is stored once by SHA-256 in the desktop asset directory. Runtime card records and undo history contain bounded references, not base64 copies.
- Forty edits to one card do not grow history in proportion to the total workspace or artwork byte size.
- A normal active-card edit persists only changed records and history metadata; it does not send or rewrite all 1,000 card records.
- Card selection does not rebuild the entire workspace or decode inactive full-resolution art.
- Existing beta.3 workspaces migrate automatically and atomically. Legacy data-URI and persisted asset-descriptor states remain readable, and failed migration leaves the original state recoverable.
- Browser-mode IndexedDB behavior and portable card/set exports remain compatible.
- A deterministic 1,000-card stress test and an isolated Electron GUI scenario cover the regression before merge.

## Scope

### Included

- Content-addressed desktop asset references and a validated local asset protocol.
- Legacy workspace migration away from eagerly hydrated base64 artwork.
- Entity-delta undo history for sets, cards, and active selection.
- Incremental desktop persistence for changed/deleted sets, cards, histories, and preferences.
- Hot-path card-list updates that avoid full workspace reconstruction during selection and active-card edits.
- Regression, migration, stress, and Electron GUI coverage.
- Documentation of the scalable persistence model and beta.4 upgrade behavior.

### Explicit non-goals

- Cloud synchronization or accounts.
- Automatic deletion/garbage collection of unreferenced original artwork in beta.4; avoiding accidental user-data loss is more important than reclaiming disk space in this change.
- Loading or rendering 1,000 full-resolution canvases at once. Only the active card needs full-resolution art; the list uses stored thumbnails.
- Changing card/set portable file formats beyond resolving desktop asset references back to their existing embedded-asset format during export.
- Implementing issue #17 or unrelated beta.4 UI requests.

## Current-state findings

- `js/setWorkspace.js` records undo transactions with complete cloned `{sets, cards, activeSetId}` snapshots. An active-card edit therefore copies every card in the workspace twice.
- `js/setModel.js` deep-clones the entire accumulated history on every push, undo, and redo using JSON serialization. History is capped at forty entries, but every entry contains two complete workspace snapshots.
- `desktop/services/storage-worker.ts` stores the whole workspace in one `app_state.payload_json` row. Every save recursively scans the full state, hashes every encountered data URI, serializes the full result, and returns the original full payload through a worker message and IPC.
- The same worker eagerly hydrates every persisted asset descriptor back into a base64 data URI on load, including duplicate occurrences inside legacy undo snapshots.
- `desktop/main.ts` already reserves `set-conjurer://user-asset`, but it currently returns 404 and does not expose the content-addressed asset directory.
- `js/setWorkspace.js` calls `renderWorkspace()` during card selection and reconstructs the card-list DOM during active-card capture. This makes unrelated UI work scale with the entire set.
- A safe reproduction with ten cards, 64 KiB art, and twenty edits produced 25.05 MiB of serialized history, increased a history push from 1.79 ms to 25.58 ms, and consumed about 201 MiB of heap. Real art multiplies those costs by tens or hundreds.

## Decisions

### Canonical desktop asset references

- Store uploaded image bytes under the existing `assets/sha256/<prefix>/<hash>.<extension>` layout.
- Use the canonical runtime URL `set-conjurer://user-asset/<sha256>.<extension>` in desktop card records and history.
- Validate hash, extension, containment, existence, and MIME type before serving an asset. Content-addressed responses may use immutable caching.
- Add narrow preload/storage operations to ingest data URLs and to materialize referenced assets for portable export. Do not expose arbitrary filesystem paths.
- Browser mode retains data URLs in IndexedDB because it has no native asset directory.

### Entity-delta history

- Replace full-workspace before/after history snapshots with atomic entity deltas keyed by set/card ID plus active-set selection.
- A delta records `before` and `after` only for added, removed, or changed entities. Missing sides represent creation/deletion.
- Coalescing updates the `after` side of the existing transaction without cloning unrelated history.
- Undo/redo applies the delta to the current state and returns the inverse transition atomically, preserving cross-set moves and set deletion recovery.
- Load-time compatibility converts legacy snapshot entries to deltas before normal editing continues.

### Incremental persistence

- Advance the desktop SQLite schema from the single JSON document to normalized `sets`, `cards`, `histories`, and `workspace_preferences` rows while retaining the legacy `app_state` row for one-time migration and rollback evidence.
- The renderer sends a validated mutation batch containing only upserts/deletes and the active/revision preference. The worker applies each batch in one immediate transaction.
- Bulk import/reset paths may send a full replacement transaction, but normal edits must use the delta path.
- The desktop storage API returns normalized records/asset URLs, never a second full copy of the submitted workspace.

### Rendering hot paths

- Card selection updates selected-row state and active-card controls without rebuilding the whole workspace.
- Active-card edits update the affected row/thumbnail and only rerender/reorder the list when a field changes current sort/filter membership.
- Add `content-visibility`/containment to card rows so a 1,000-row list does not paint offscreen content. Implement full windowed virtualization only if measured list construction remains outside the stress budget after the data fixes.
- Optimize collector-family discovery to avoid per-card scans where the 1,000-card fixture exposes quadratic behavior.

## Ordered implementation

1. **Add scalable performance fixtures and baseline assertions.**
   - Add a deterministic workspace generator that creates 1,000 cards with unique asset references, thumbnails, and representative metadata without committing large binaries.
   - Add a focused history benchmark/regression proving payload growth is independent of total art bytes and unrelated cards.
   - Add storage migration fixtures for beta.3 `app_state` payloads with repeated asset descriptors.

2. **Implement validated content-addressed runtime assets.**
   - Extend `StorageService`/`storage-worker.ts` with ingest and export-materialization requests.
   - Implement the `set-conjurer://user-asset` handler in `desktop/main.ts` using a contained resolver owned by the storage service.
   - Extend IPC contracts/preload with exact schemas and no arbitrary path access.
   - Normalize newly captured/imported desktop card data before it enters history.

3. **Migrate to entity-delta history.**
   - Add delta construction/application and legacy conversion helpers to `js/setModel.js`.
   - Update `setWorkspace.js` history recording, coalescing, undo, and redo call sites.
   - Preserve atomic cross-set moves, card/set creation/deletion, import, rarity, and reset behavior.

4. **Normalize and increment desktop persistence.**
   - Add schema-v2 tables and migration in `storage-worker.ts`.
   - Add mutation-batch validation to `desktop/ipc/contracts.ts` and corresponding preload/main handlers.
   - Add dirty-record tracking in `setStorage.js`/`setWorkspace.js`; keep browser-mode full IndexedDB saves as a compatibility fallback.
   - Migrate beta.3 state within one database transaction and retain recovery data until the new schema is verified.

5. **Remove full-workspace UI work from edit/select hot paths.**
   - Update selection classes/ARIA and active controls in place.
   - Refresh only affected card rows and thumbnails after active-card edits.
   - Add rendering containment and measure the 1,000-card list before deciding whether windowed virtualization is necessary.
   - Optimize any measured quadratic collector/list code exposed by the fixture.

6. **Preserve portable exports and compatibility.**
   - Resolve desktop asset URLs back to the existing embedded data-URL asset table before card/set export.
   - Verify imports, duplicate/variant flows, restart, undo/redo, print, and set-image download continue to resolve art.

7. **Verify, document, and hand off.**
   - Run typecheck, security lint, focused tests, full tests, generated-pack drift checks where applicable, and isolated Electron GUI coverage.
   - Capture the compact evidence set below, update desktop development/release documentation, and prepare a PR that closes #19.

## Edge cases and recovery

- Duplicate artwork hashes must share one file but remain independently referenced by cards and history.
- Changing artwork must keep the prior asset readable while an undo entry references it.
- Missing, corrupt, wrong-MIME, traversal-shaped, or malformed asset URLs fail closed and show the existing recoverable workspace error rather than reading another file.
- Legacy records may contain the same asset descriptor thousands of times in history; migration must resolve it once and never expand every occurrence to base64.
- Set deletion and cross-set moves remain atomic under undo/redo.
- Interrupted schema migration rolls back. The prior `app_state` payload remains available for recovery until a successful normalized load/save checkpoint.
- Multi-window browser BroadcastChannel behavior remains unchanged; desktop single-instance persistence uses the new mutation batches.
- Searches/sorts that exclude or reorder an edited card must trigger the necessary list update even though ordinary selection does not rebuild the list.
- Portable export must embed referenced local art and must never leak a machine-local path or unusable `set-conjurer://` URL.

## Test strategy

### Automated coverage

- `node --test tests/set-history.test.js tests/set-storage.test.js tests/desktop/storage-recovery.test.js tests/desktop/card-scaling.test.js`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:electron`

The new stress suite will assert:

- 1,000 cards and forty edits produce bounded history entries containing no data URLs and no full workspace snapshots.
- Incremental save batches contain only the affected card/set/history rows.
- Legacy repeated descriptors migrate to one runtime asset URL per unique hash.
- Random selection/edit/save cycles over 1,000 cards complete within a generous deterministic CI budget, while local diagnostic output records p50/p95 timings and payload sizes.
- Reload, undo, redo, import/export, and duplicate artwork retain byte-identical SHA-256 content.

### GUI tester scenario

Use an isolated `SET_CONJURER_USER_DATA` profile and development pack root:

1. Load the generated 1,000-card fixture.
2. Select cards near the start, middle, and end of the list; rapidly switch among ten cards.
3. Edit text and art positioning repeatedly, create/duplicate/delete a card, then undo/redo.
4. Restart the app and repeat selection/editing.
5. Export and re-import a representative card and set, confirming artwork fidelity.
6. Watch renderer/main-process memory and save payload diagnostics for bounded growth and absence of crashes/errors.

The isolated Electron application is the strongest available surface because the defect spans renderer state, IPC, worker-thread SQLite, custom protocol loading, and native app lifecycle. Browser-only testing cannot prove the native asset/persistence behavior.

## Verification and evidence

Full verification covers all 1,000 fixture records and the scenarios above. PR visuals remain intentionally small:

- **`01-thousand-card-workspace.png`** — one desktop screenshot showing the 1,000-card list and a rendered selected card. Purpose: demonstrate the supported scale and intact editor layout.
- **`02-post-restart-art-and-history.png`** — one desktop screenshot after restart and undo/redo, showing the restored selected card with artwork. Purpose: demonstrate persistence/history fidelity.

The PR will state that additional start/middle/end selections, rapid switching, edits, import/export, and error checks were exercised without attaching repetitive screenshots. Both selected images must render inline in the PR before review.

## Documentation, rollback, and release follow-up

- Document the content-addressed asset URL, normalized database schema, migration, incremental mutation API, stress fixture, and local profiling procedure in `docs/desktop-development.md` and `docs/desktop-release.md`.
- The PR targets `master` from `perf/issue-19-card-scaling` and includes `Fixes #19`.
- Rollback reverts the application code while retaining the legacy `app_state` recovery payload and original asset files. No automatic asset deletion occurs in beta.4.
- Beta.4 release validation must include a beta.3-to-beta.4 upgrade using a copied disposable profile with multiple cards/art, in addition to the synthetic 1,000-card fixture.
