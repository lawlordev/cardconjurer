# Windows Desktop Reliability Plan

## Structured brief

### Desired outcome

Make the first public Windows build behave like an installed desktop application and make its first-run path dependable. A user should run the downloaded Setup executable once, launch Set Conjurer later from Windows, choose any published frame packs during onboarding, reach a healthy default set, edit and save immediately, render installed frames, and see an update action only when a newer eligible application release actually exists.

The current beta fails as a chain: the pack catalog is unavailable when onboarding choices render; multi-gigabyte pack downloads are buffered in memory and cannot retry or resume; shared renderer images were excluded from both the base application and pack release; the resulting render exception persists an invalid default card; subsequent loads fail before workspace event handlers finish binding; and CSS forces the idle update action to remain visible.

### Success criteria

1. Running `Set-Conjurer-Windows-x64-Setup.exe` once installs a launchable Start-menu entry and desktop shortcut, registers Set Conjurer in Windows Installed Apps, and launches through the stable Squirrel stub. The downloaded Setup file may remain in Downloads, but it is not needed for ordinary launches.
2. Squirrel install, update, uninstall, and first-run arguments are handled before normal app startup. A first-run installer launch does not create a second editor instance or race updater checks.
3. Fresh packaged onboarding loads and validates the published catalog before pack choices become interactive. Set Symbols and Standard remain selected and locked; every published optional pack can be selected. Offline/catalog failures show a retryable message rather than presenting published packs as permanently disabled.
4. Pack downloads stream to disk with bounded memory, retry transient failures, resume valid partial files, verify declared size and SHA-256, extract incrementally with the current traversal/symlink/expanded-size protections, and atomically activate one healthy pack at a time. Relaunching after an interruption never converts a partial pack into an installed pack.
5. Progress is based on actual downloaded and extracted bytes across all archive parts. It continues updating through download, verification, extraction, and activation, and does not use the current fixed 70/76/95 percent jumps.
6. Release pack construction includes every renderer-global dependency and gives every downloadable asset exactly one owning pack (with Standard owning truly shared assets because it is required). It eliminates the current multi-pack directory duplication and limits every release part to at most 256 MiB.
7. A pack marked installed passes a health check against its immutable release manifest. Existing beta profiles with the broken `packs-v0.1.0` Standard generation are detected and offered repair/update rather than trusted because `active.json` contains an entry.
8. The editor does not initialize or persist a workspace behind incomplete onboarding. It captures its default card template only after the required packs and global renderer images are healthy and the default M15 layout has completed.
9. Existing workspaces containing the beta corruption signature (missing `cardData.text`, zero frames, and the incomplete M15 default fields) are repaired transactionally from a verified default template. Set metadata, card identity, art, collector data, and any valid user fields are preserved. A pre-repair SQLite snapshot is created before the repaired state is committed.
10. A clean profile and a repaired beta profile both open a default set without "Cannot convert undefined or null to object," report "Saved successfully," allow Set Details edits immediately, survive relaunch, and render the selected Standard frame in the preview.
11. Frame catalog entries are selectable only when their owning pack is installed and healthy. Missing categories lead to the pack-management action; installed profile thumbnails and full-size layers resolve through the same active pack generation.
12. The top-bar update control is absent in computed layout while idle, checking, up to date, offline, or failed. Check results and errors remain available in Settings. The control appears only for a newer release eligible for the chosen Stable/Beta channel, shows determinate download progress, and becomes Restart when the verified installer is staged.
13. Changing release channel invalidates stale update state and performs a new metadata check. Windows N-1 to N upgrade launches the staged Squirrel installer, exits the old process without immediately relaunching it into the installer lock, and returns with user data and active packs intact.
14. Automated tests reproduce the packaged-build failures that the current development-only smoke test misses, and the final Windows candidate passes a clean installed-artifact walkthrough on Windows x64.

## Scope

- Windows Squirrel installation lifecycle, shortcuts, registration, and update handoff.
- Pack catalog discovery, onboarding selection, downloads, extraction, activation, validation, repair, and progress.
- Frame-pack release construction and its release/CI verification.
- Renderer-global frame assets, default-card boot ordering, damaged beta-state recovery, set saving, set-details readiness, and installed-frame rendering.
- Update visibility/state/channel behavior and Windows staged-installer activation.
- Unit, integration, packaged Electron, and real installed-artifact Windows coverage.
- Release/development documentation and a corrective beta application/pack release.

## Non-goals

- Deleting the user's downloaded Setup executable; Windows/browser download cleanup remains user-controlled.
- Replacing Squirrel.Windows, redesigning the editor, or rewriting the legacy canvas renderer.
- Cloud storage, accounts, telemetry, or a new backup product.
- Azure Artifact Signing enrollment. Existing signed/unsigned release policy remains; the reliability release must still be labeled according to its actual signature status.
- macOS installer or update redesign, except for keeping shared update contracts compatible and retaining existing macOS behavior.
- Changing card/set portable file schemas unless a compatibility defect is found while adding the repair path.

## Current-state findings

### Installer lifecycle

- `forge.config.ts` uses `MakerSquirrel`, but `desktop/main.ts` has no Squirrel lifecycle handler and the package does not include `electron-squirrel-startup`.
- The installed beta was present under `%LOCALAPPDATA%\set_conjurer` with a stable stub and versioned app directory, but inspection found no Set Conjurer Start-menu/Desktop shortcut and no Installed Apps uninstall registration.
- `desktop/main.ts` does not set the Squirrel App User Model ID. Electron Forge recommends handling Squirrel startup arguments at the beginning of the main process and matching the generated Squirrel ID for apps whose user-facing name contains spaces.

### Onboarding and catalog state

- `PackService` starts with an empty catalog and only refreshes it inside `install()` after the user clicks Download & Continue.
- `desktopBridge.js::packCard()` disables optional onboarding checkboxes when `pack.available` is false. On a fresh public package that is every optional pack because there is no development root, seed, installed generation, or loaded catalog.
- `tests/desktop/security-contract.test.js` currently asserts this broken behavior, and `scripts/test-electron.mjs` runs an unpackaged development build where every pack is automatically reported available.
- `PackService.list()` substitutes version `1.0.0` when catalog data is absent, producing misleading states.

### Download and activation behavior

- The published `packs-v0.1.0` catalog declares Standard as 3,050,612,991 compressed bytes across three approximately 1 GB ZIPs and 3,172,745,275 expanded bytes. Other optional packs are 1.24-2.53 GB compressed.
- `PackService.#installRemote()` accumulates each archive in a `Uint8Array[]`, concatenates it into a single `Buffer`, then asks JSZip to parse and CRC-check it. This creates large memory spikes and long CPU/extraction stalls.
- The service has no retry, HTTP Range resume, durable partial file, cancellation, or timeout policy. A transient stream close surfaces directly as Node's `TypeError: terminated`.
- Progress reserves 5-70 for download, jumps to a hard-coded 76 for verification, then remains still during extraction until 95 activation. This exactly matches the reported progress behavior.
- `install()` mutates in-memory `#state` after each pack but writes `active.json` only after the complete requested list succeeds. A later failure leaves ghost installed entries in memory. On retry, `#sourceFor()` finds those entries and assigns the fallback version `1.0.0`; the inspected profile showed Set Symbols `version: 1.0.0` pointing at the `0.1.0` directory.
- `hasRequiredPacks()` checks only IDs in `active.json`; it does not verify the source directory, manifest, or required runtime files.

### Pack release construction and renderer assets

- `forge.config.ts` excludes all `img/frames` and `img/setSymbols` files from the base ASAR.
- `scripts/build-frame-pack-release.mjs` scans only `js/frames/pack*.js` and captures the first path component after `/img/frames/`. One reference under `m15/...` therefore packages the entire `img/frames/m15` tree for that category.
- Replaying that ownership logic found 7,645 Standard files (2.95 GiB expanded) and 6,996 files duplicated across two or more packs, adding 7.04 GiB of duplicate expanded content across the six frame packs.
- Renderer-global root assets referenced outside pack scripts are omitted entirely. At minimum `cornerCutout.png`, `maskRightHalf.png`, `maskMiddleThird.png`, and `serial.png` are absent from the installed Standard generation and base app.
- Full M15 frame and thumbnail files do exist in the installed Standard generation. This explains why catalog thumbnails can appear while the global renderer still fails.

### Workspace corruption and frame rendering

- A clean isolated launch of the actual installed package reproduced `InvalidStateError` in `drawCard()` when it attempted to draw the missing global `corner` image.
- The exception occurs inside the M15 layout action at `autoFitArt()` before `loadTextOptions()` and automatic frame application complete.
- `setWorkspace.bootstrap()` then captures and persists the ambient partial global card. The reproduced record had `version: m15Regular`, no `text`, and `frames: []`.
- On the next load, `loadCardData()` calls `loadTextOptions(card.text)`, and `Object.keys(textObject)` throws `TypeError: Cannot convert undefined or null to object`. `initialize()` catches it, replaces the workspace with "Sets could not open," marks global status "Issue saving," and never finishes binding normal workspace interactions. This accounts for default-set failure, the save warning, and Set Details only recovering after later state changes/restarts.
- The inspected real beta database contains the same corruption signature on every saved card: no `text`, zero frames, and no thumbnail.
- Frame catalog rendering does not consult installed pack health before presenting all semantic profiles.

### Update control and update handoff

- `updateControl()` correctly sets the button's `hidden` property for idle/checking/up-to-date states, but `.desktop-update-action { display: inline-flex; }` overrides native hidden rendering because no `.desktop-update-action[hidden]` rule exists.
- In idle state the forced-visible button still says Update Now. Clicking it performs a metadata check; checking state falls through to `0%`, producing the reported inert control.
- `scripts/test-electron.mjs` asserts only the DOM `hidden` property, not computed visibility, so it passes while the button is visible.
- Update failures are promoted into the top bar even when no update exists. Channel changes do not clear or re-evaluate stale release state.
- Windows restart currently opens the staged Setup executable, immediately calls `app.relaunch()`, and exits. Relaunching the old app while Squirrel owns installation locks is an avoidable update race.

### Existing verification gaps

- The 44 current Node tests pass, but they are predominantly static/source-contract checks and pure model tests.
- The Electron smoke test uses development-mode pack sources, so it cannot detect missing public pack assets, fresh packaged catalog behavior, multi-part downloads, or installed Squirrel lifecycle behavior.
- Desktop CI currently runs on macOS only. The release workflow verifies output existence and signatures but does not install the Windows artifact or validate shortcuts, registry, launch, onboarding, frame resolution, or upgrade behavior.

## Implementation decisions

1. Keep Squirrel.Windows and add its lifecycle handling at the first executable main-process line. Use the generated package/executable names to set the exact Squirrel App User Model ID. Do not manually invent shortcut paths in application code.
2. Move renderer-global, always-required frame helpers out of downloadable ownership into a base-app path such as `core/frame-runtime/`, update all renderer/registry references, and verify those assets in the ASAR. Pack generations own only independently downloadable content.
3. Retain catalog schema version 2 for compatibility with the current beta while adding backward-compatible optional health metadata and immutable per-pack file manifests. Publish corrected packs under a new immutable `packs-v0.1.x` tag; never replace `packs-v0.1.0` assets.
4. Replace coarse top-directory grouping with a deterministic asset-ownership manifest/resolver. Standard owns assets used by Standard and any optional category; each optional pack owns assets used only by that category. Build fails on unresolved references, duplicate ownership, missing files, unsafe names, or unbudgeted size growth.
5. Limit release archive parts to 256 MiB and stream both download and extraction. Use a ZIP reader that supports lazy entry streaming (for example `yauzl`) behind a small internal adapter so path containment, symlink rejection, CRC/error handling, file-count limits, and expanded-byte limits remain explicit and testable.
6. Persist downloads as versioned `.partial` files with sidecar metadata under the pack staging directory. Retry transient fetch/stream errors with bounded exponential backoff; resume only when server Range/validator behavior and the local length match expectations; otherwise safely restart that part.
7. Treat each pack as an independent atomic operation. Build next state locally, activate only after every archive and required health file verifies, then atomically write `active.json`. Required success is retained if an optional pack later fails; the UI reports per-pack results and retries only failed packs.
8. Load catalog state before onboarding choices. Cache the last verified catalog for later/offline management, but require network access for a fresh profile with no archives. Catalog failure remains a first-run gate with Retry and a clear offline explanation.
9. Gate editor initialization on verified onboarding completion and required-pack health. A default workspace is never written while onboarding is open or while the default renderer template is incomplete.
10. Make card loading defensive (`text`, frames, masks, bottom info, and collections normalized before iteration), then add a targeted beta repair migration after a healthy default template is available. Snapshot first, merge only missing/corrupt structural defaults, render-check the repaired active card, and commit once.
11. Separate update-check status from actionable update state. The top bar renders only `available`, `downloading`, `verifying`, and `staged`; checking/up-to-date/offline/failure messaging belongs in Settings. CSS must explicitly honor `[hidden]`.
12. Reuse the durable streaming downloader for application installers. On Windows Restart, flush/snapshot, launch the verified staged Setup, and quit without `app.relaunch()`; let Squirrel complete and launch the installed stub. Preserve the existing explicit-download consent model.

## Ordered implementation

### 1. Establish reproducible Windows/package fixtures

Intended files:

- `tests/desktop/` new lifecycle, updater, recovery, and packaged-asset tests
- `tests/packs/` new catalog, ownership, interruption, and activation tests
- `scripts/test-electron.mjs` or focused new Electron test scripts
- `scripts/verify-package.mjs`
- `.github/workflows/ci.yaml`

Work:

- Turn the observed stacks and beta corruption signature into fixtures before changing runtime code.
- Add a public-package mode to Electron tests: no development root, a local HTTP catalog/archive server, a copied minimal pack generation, and a temporary SQLite/user-data directory.
- Assert computed visibility (`isVisible()`/computed `display`), not only the DOM `hidden` property.
- Add a package inventory assertion for every base renderer dependency and assert downloadable frame roots remain excluded.
- Add Windows CI coverage for typecheck/unit tests and packaged Electron tests; keep portable model tests on existing runners.

Checkpoint:

- Tests fail for optional onboarding selection, missing global frame helpers, invalid default-card persistence, update visibility, and interrupted pack activation on the current code.

### 2. Repair Squirrel installation lifecycle

Intended files:

- `package.json`, `package-lock.json`
- `desktop/main.ts`
- `forge.config.ts`
- `tests/desktop/` installer contract tests

Work:

- Add `electron-squirrel-startup` as a packaged runtime dependency and execute it before protocols, locks, paths, windows, storage workers, or update checks are initialized.
- Configure the exact App User Model ID matching MakerSquirrel's package name and `set-conjurer.exe`.
- Ensure first-run/updated/uninstall event instances exit cleanly and associated-file/single-instance behavior runs only in normal launches.
- Add an installed-artifact Windows test that runs Setup in a fresh per-user environment and checks Start-menu/Desktop shortcuts, Installed Apps registration, stable stub target, one normal editor process, and clean uninstall.

Checkpoint:

- Setup is needed once; subsequent launches work from Windows UI and uninstall removes registration/shortcuts without deleting `%APPDATA%` user content unless explicitly requested by Windows/uninstaller policy.

### 3. Make renderer-global assets part of the base app

Intended files:

- `core/frame-runtime/` moved shared assets
- `js/creator-23.js`, `js/autoFrame.js`, `js/frameRegistry.js`
- `forge.config.ts`
- `scripts/verify-package.mjs`
- relevant renderer/package tests

Work:

- Inventory every non-pack-script `/img/frames/` reference. Move always-required masks/corners/serial helpers to the base path and update references.
- Await/decode global renderer images before any draw that consumes them; a broken global helper produces a named boot/recovery error rather than an uncaught canvas exception.
- Verify the base ASAR contains the helpers while continuing to exclude pack-owned frame and set-symbol trees.

Checkpoint:

- The existing installed `packs-v0.1.0` Standard directory can render a regular frame once the corrected application is installed, even before pack repair, because global helpers come from the base app.

### 4. Rebuild deterministic, smaller pack releases

Intended files:

- `scripts/build-frame-pack-release.mjs`
- a focused asset ownership configuration/manifest under `scripts/` or `resources/`
- generated per-pack manifests/catalog metadata
- `tests/packs/frame-pack-release.test.js` and new asset-coverage tests
- `.github/workflows/release-frame-packs.yaml`

Work:

- Resolve literal, generated, component, fallback, and auto-frame asset references into exact file ownership rather than first-directory ownership.
- Assign shared referenced assets to Standard and optional-only assets to their semantic category. Fail on duplicate ownership or references not satisfied by base + Standard + selected category.
- Emit manifest file count, expanded bytes, archive bytes, SHA-256, and required health paths for every pack.
- Partition at no more than 256 MiB per archive, verify the actual compressed output limit, and publish a machine-readable size/duplication report.
- Test every catalog profile and component against the generated ownership graph so thumbnails, main layers, masks, fallbacks, and dynamic color variants all resolve.

Checkpoint:

- Zero unresolved runtime references, zero duplicate-owned downloadable files, all six category combinations pass asset resolution, and the corrective immutable pack catalog is ready for release.

### 5. Implement resilient pack catalog/download/extraction/activation

Intended files:

- `desktop/services/pack-service.ts`
- new focused download/ZIP/manifest helper services under `desktop/services/`
- `desktop/ipc/contracts.ts`, `desktop/preload.ts`, `desktop/main.ts`
- `js/desktopBridge.js`, `css/style-9.css`
- pack service and IPC tests

Work:

- Add explicit catalog states (`loading`, `ready`, `offline/error`) and refresh/cache APIs; stop inventing `1.0.0` without metadata.
- Validate installed entries against source existence, immutable manifest identity, declared health paths, and expected version before reporting installed/healthy.
- Stream parts to durable staging files with bounded retry/resume and checksum verification. Stream ZIP entries to a temporary generation with containment, symlink, count, per-file, total-expanded, and declared-size checks.
- Emit byte-based phase/per-pack/aggregate progress and human-readable downloaded/total sizes.
- Commit activation state after each successful pack; leave the previous healthy generation active on any failure and retain only safe resumable partials.
- Expose repair/update/retry state in onboarding and Settings. Required packs cannot be removed; unhealthy required packs show Repair rather than Installed.
- During onboarding, allow optional selection after catalog load, install required packs first, retain successful optional installs, and summarize/retry any optional failures.

Checkpoint:

- Simulated termination at 6%, process exit between parts, checksum mismatch, corrupt ZIP, traversal, symlink, disk-full, and retry all leave active state valid and recover without re-downloading verified completed parts.

### 6. Gate startup and repair damaged beta workspaces

Intended files:

- `js/desktopBridge.js`
- `js/setStorage.js`, `js/setModel.js`, `js/setWorkspace.js`
- `js/frameSearch.js`, `js/creator-23.js`
- `desktop/services/storage-worker.ts` if migration metadata is stored there
- storage/model/Electron recovery tests

Work:

- Publish a desktop readiness promise/state that resolves only after onboarding preference and required pack health pass; do not initialize/persist the Sets workspace on the first onboarding page.
- Make default frame selection/layout application a fully awaited operation. Validate the template has a text object, at least one valid frame, dimensions, and decoded global assets before `bootstrap()` may create the first set.
- Normalize collections before every `Object.keys`/`Object.entries` path involved in card load so malformed records produce recoverable validation messages rather than initialization aborts.
- Detect the specific beta incomplete-M15 record, snapshot SQLite once, merge a clean M15 text/frame template into missing structural fields, preserve valid user/set fields, render the active card, then persist the repaired revision transactionally.
- Keep listeners and Set Details controls available whenever storage is healthy; "Issue saving" is reserved for an actual failed save and includes a retryable detail message.
- Filter/select frame profiles by healthy installed pack and provide a direct pack-management path for unavailable categories.

Checkpoint:

- Clean and captured-beta fixtures create/edit/save set details and cards on first launch, render Regular Frames, relaunch identically, and never persist a partial default template.

### 7. Correct update discovery, visibility, and Windows activation

Intended files:

- `desktop/services/update-service.ts`
- `desktop/ipc/contracts.ts`, `desktop/preload.ts`, `desktop/main.ts`
- `js/desktopBridge.js`, `css/style-9.css`
- update unit/Electron tests

Work:

- Add a delayed automatic metadata check after normal editor readiness, skipping/delaying Squirrel first-run locks.
- Recompute eligible release by SemVer/channel and clear stale release state on channel change.
- Add explicit Settings check status for checking, up-to-date, offline, and failure; do not turn metadata failure into a top-bar action.
- Add a `[hidden]` rule with sufficient precedence and render the top action only for actual actionable phases.
- Stream/resume installer download, validate size and release checksum, snapshot data before staging, and keep Restart available after the staged state is restored/revalidated.
- On Windows activation, open the staged Setup and quit the old process without relaunching. Validate N-1 to N, beta/stable eligibility, no-update, offline, interrupted, tampered, and missing-installer cases.

Checkpoint:

- Current version on Stable or Beta has no top action; a genuinely newer eligible fixture shows Update Now, progresses, stages, and upgrades the installed app without data loss or a locked old relaunch.

### 8. Close CI, documentation, and release loop

Intended files:

- `.github/workflows/ci.yaml`
- `.github/workflows/release-app.yaml`
- `.github/workflows/release-frame-packs.yaml`
- `docs/desktop-development.md`, `docs/desktop-release.md`, `README.md`
- release verification scripts/tests

Work:

- Run Windows-specific package and installed-artifact tests on Windows CI/release runners.
- Require pack ownership/health/size reports and package inventory verification before release upload.
- Install the draft Windows artifact, complete onboarding against the draft corrective pack release, render/save/relaunch, then test N-1 upgrade before publishing.
- Document that Setup remains a downloaded installer but normal use is through Windows shortcuts; document local data location, pack repair/resume behavior, expected disk requirements, and update channel semantics.
- Publish a new immutable pack tag first, then a new application beta referencing/repairing that catalog. Do not mutate existing tags or release assets.

Checkpoint:

- Draft corrective artifacts pass the full Windows release checklist before promotion; rollback remains the prior immutable app release plus previous active pack generation and pre-repair/pre-update SQLite snapshots.

## Edge cases and recovery

- Fresh install offline: catalog state explains the network requirement and retries; no empty workspace is written.
- Existing user offline: healthy installed packs and sets continue working; update/catalog errors stay in Settings.
- Required succeeds, optional fails: onboarding may continue with required healthy packs after clearly summarizing optional failures and offering retry; successful packs are retained.
- Interrupted process/power loss: `.partial` downloads and temporary extraction generations are never active; startup validates and resumes or discards them safely.
- Server ignores Range or changes validator: discard only the affected partial part and restart it; never append incompatible bytes.
- Disk full/permissions/antivirus lock: report required/free path context without exposing sensitive full paths in telemetry (there is none), keep prior active pack/state, and allow retry after the condition clears.
- Catalog or archive tampering: reject before activation, preserve old generation, and show verification failure.
- Broken/missing active pack directory: mark unhealthy and offer repair; do not satisfy onboarding from `active.json` alone.
- Existing corrupt SQLite payload: snapshot before repair; normalize at model boundary; keep an explicit recovery error and backup path if repair cannot render/commit.
- Intentionally frameless valid card: do not add a frame merely because `frames` is empty. Repair framing only when the missing-text/incomplete-default beta signature proves initialization corruption.
- Large uploaded art during repair/update: asset extraction/hydration remains content-addressed, snapshot succeeds before mutation, and save/update flush ordering is tested.
- Stable/Beta changes: no stale higher beta remains actionable after switching Stable; switching Beta rechecks without downloading.
- No newer release, GitHub rate limit, DNS failure, or malformed release: no top-bar Update Now; Settings shows the result and Retry.
- Staged installer removed/quarantined: staged state revalidates the file and checksum, falls back to available/failed Settings state, and does not offer a dead Restart.
- Installer upgrade while app is open: one controlled quit/handoff, no immediate old-version relaunch, and the stable stub points at the new version afterward.
- Uninstall: application registration and shortcuts are removed; local workspace retention/deletion behavior is documented and never silently expanded beyond Squirrel defaults.

## Test strategy

### Automated commands

Run from a clean checkout/worktree with Node 24 and npm 11:

```powershell
npm ci
npm run packs:compile
npm run typecheck
npm run lint
npm test
npm run build:desktop
npm run test:electron
npm run package -- --arch=x64
npm run package:verify
npm run make -- --arch=x64
```

Add focused scripts/tests to the appropriate npm commands rather than relying on manual-only checks.

### Unit and service coverage

- Catalog parsing/caching/availability and SemVer comparisons.
- Pack health manifests, source containment, activation transaction, and prior-generation preservation.
- Retry classification, Range resume, validators, partial lengths, checksum, cancellation/exit cleanup, and byte progress monotonicity.
- Lazy ZIP extraction, CRC/read errors, traversal, absolute/drive paths, symlinks, file-count/expanded-size limits, and disk errors.
- Asset ownership: every profile/component/runtime source resolves from base + required + selected optional pack; zero duplicate owners; archive part budget.
- Workspace normalization and targeted beta repair preserve user fields and do not alter valid frameless cards.
- Update channel/SemVer/state transitions, computed actionability, staged file revalidation, and Windows handoff.

### Electron integration coverage

- Development mode remains a fast smoke path.
- Public-package mode uses a local HTTP release server and temporary profile so optional availability, multi-part downloads, resume, health, onboarding gate, editor render/save/relaunch, and Settings states are deterministic without production writes.
- Captured beta SQLite/`active.json` fixture proves automatic recovery and snapshot creation.
- Renderer test fails on console/page errors and failed required images, including canvas image broken-state errors.
- Update visibility uses Playwright visibility/computed CSS and exercises idle, checking, up-to-date, available, downloading, staged, offline, and failed states.

### Installed Windows artifact coverage

- Clean install from Setup, shortcut/Installed Apps/stub verification, single launch, clean onboarding, default frame render, set-detail edit, save, quit/relaunch.
- Network interruption/resume during Standard and one optional pack.
- Install corrective app over the current beta profile and verify broken card repair.
- N-1 stable-to-stable and beta-to-newer-beta update through staged Setup; verify files, user data, shortcuts, and running version.
- Uninstall registration/shortcut cleanup and documented user-data behavior.

The packaged Electron test is adequate for deterministic renderer/IPC/download failure coverage. It does not prove Squirrel/Windows shell integration, so installed-artifact checks on a Windows runner and the owner's Windows x64 machine remain release gates.

## Verification and evidence plan

### Full functional coverage

Exercise all of the following even when no screenshot is retained:

- clean/offline/catalog-retry onboarding;
- required-only, all-packs, optional partial failure, interrupted/resumed, corrupt/tampered, disk-full, and relaunch pack flows;
- clean and damaged-beta workspace startup, set-details edit, new set/card, save, relaunch, and frame/category selection;
- healthy, missing, stale, and repaired installed pack generations;
- updater no-update, wrong channel, newer update, offline, interrupted/resumed, checksum failure, staged-file loss, and N-1 activation;
- Squirrel clean install, launch from both shortcuts/stub, update, and uninstall on Windows x64;
- representative 1366x768 minimum and 1920x1080 desktop window sizes for onboarding, editor, Settings, and update states.

### Minimal PR visual set

1. **Windows onboarding choices** - installed Windows build at 1665x1040; show Set Symbols/Standard locked, optional published packs enabled, measured size/status, and ready-to-download state. Purpose: prove the fresh public-package catalog path.
2. **Healthy first editor** - same installed build after required-only onboarding; show rendered Regular frame, default set/card, and Saved successfully. Purpose: cover default-set load, saving, and frame rendering together.
3. **Resumable pack operation** - Settings drawer at 1665x1040 during a resumed optional download/extraction with byte progress and phase text. Purpose: demonstrate recovery/progress; other optional packs receive a concise coverage statement rather than repeated screenshots.
4. **Actionable update only** - N-1 installed build at 1665x1040 showing the actual newer version's Update Now or determinate progress. Pair its caption with verified no-update/up-to-date states where the control was absent. Purpose: prove actionability and state separation.
5. **Windows installation integration** - Start menu/Installed Apps view showing Set Conjurer after Setup. Purpose: prove ordinary relaunch/uninstall entry points; no duplicate desktop screenshot is needed if the checklist confirms the desktop shortcut.

Render every selected image inline in the PR description and verify it is legible. Do not include local usernames, full app-data paths, set contents, or other private data in evidence.

## Documentation, release, and rollback

- Update development docs with public-package/local-release-server testing and Windows installed-artifact commands.
- Update release docs with Squirrel lifecycle/AUMID expectations, immutable corrective pack order, size/health reports, installed smoke test, and N-1 upgrade gate.
- Update user-facing docs with one-time Setup behavior, launch/uninstall locations, pack sizes/disk needs, resume/repair behavior, local-data location, and update channel behavior.
- Create a pre-repair snapshot for damaged workspaces and retain the previous active pack generation until the corrected generation passes health checks.
- If repair fails, keep the original database active and expose the backup/retry path; never overwrite with an empty default workspace.
- If a new pack generation fails, reactivate the prior immutable generation. If the app beta fails, users can reinstall the prior immutable Setup; data remains protected by local snapshots and compatible schema.
- Publish new tags/assets only. Existing `v0.1.0-beta.1` and `packs-v0.1.0` remain immutable historical artifacts.

## Review checkpoint

Review and approve this plan before implementation. After approval, execute it in this same `fix/windows-desktop-reliability` worktree and branch with the Standardized Feature workflow.
