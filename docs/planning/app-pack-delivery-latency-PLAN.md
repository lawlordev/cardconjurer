# App and Frame-Pack Delivery Latency

## Planning metadata

- Status: amended after a read-only compatibility review of GitHub PR #7; implementation has not started and is blocked on the post-merge prerequisite below.
- Planning branch: `perf/decouple-app-and-pack-delivery`
- Planning worktree: `C:\Users\Jake\.codex\worktrees\86fa\cardconjurer`
- Remote default branch: `origin/master`
- Base commit: `feeaa45da25301231b9420a360a5a625f37441e5` (`Merge pull request #6 from lawlordev/codex/fix-windows-release-verification`)
- Planning date: 2026-08-04
- Compatibility review: GitHub PR #7, `fix/windows-desktop-reliability`, was reviewed at head `a51e28afd7593d53d14d190ac18819b6e7c56a2e`. At review time it was open and mergeable, but not merged, and its Windows/Desktop CI run was still in progress. Treat that SHA as review evidence, not the implementation base.
- Repository instructions inspected: `README.md`, `package.json`, `docs/desktop-development.md`, `docs/desktop-release.md`, all three workflows under `.github/workflows/`, relevant scripts/tests, and existing `docs/planning/*-PLAN.md` conventions. No `AGENTS.md`, `.agents`, or `.codex` repository instructions are present in this revision.
- Isolation: the existing `fix/windows-desktop-reliability` worktree at `C:\Users\Jake\.codex\visualizations\2026\08\04\019fcd99-1509-7913-9ed3-38b199482c2a\cardconjurer-windows-reliability` was not modified, stashed, reset, or reused.

### Mandatory post-merge implementation prerequisite

PR #7 is expected to merge before this work, but this plan does not claim that it has merged or passed CI. Before invoking `standardized-feature` or changing implementation files:

1. Confirm PR #7 has actually merged into `origin/master`, record the final merged commit SHA, and confirm its final Windows/Desktop CI—including packaged-app and fresh Windows installer coverage—passed on that SHA.
2. Fetch `origin`, rebase or refresh this existing `perf/decouple-app-and-pack-delivery` branch/worktree onto that merged default-branch state without replacing the worktree or discarding the planning commits.
3. Reinspect the merged files named in the compatibility section below, update stale line/file assumptions in this plan if the final PR differs from reviewed head `a51e28a`, and commit that final planning refresh only.
4. Record CI/release latency baselines from the post-PR-#7 default branch. Pre-PR-#7 measurements are not comparable because PR #7 adds Windows package, packaged-app, and installer work.
5. Joseph and the voice coordinator review the refreshed plan and explicitly authorize implementation. A prior approval of this pre-merge amendment is not implementation authorization.

## Structured product brief

### Desired outcome

Drastically reduce ordinary pull-request CI time and normal Set Conjurer application-release latency without weakening validation. The multi-gigabyte frame and set-symbol library must stop sitting on the critical path for changes that do not use it. Frame-pack changes must instead receive focused, ownership-aware validation and remain independently, manually, and immutably releasable.

Installed users receive one coherent updater experience. Background checks may discover a newer application and newer versions of packs the user already has installed, but must never advertise uninstalled optional packs. One consolidated **Update Now** action downloads and verifies every applicable item in the background. The running app and active packs remain untouched while this happens. When every item is safely staged, the same action becomes **Restart**; only that restart activates the new application and staged pack set together. Integrity, compatibility, failed downloads, interrupted staging, activation failure, rollback, and recovery must be explicit and testable.

This plan must test the proposed architecture against viable alternatives rather than treating sparse checkout as a foregone conclusion.

### Success criteria

#### CI and release latency

- After PR #7 merges and its Windows CI passes, record a reproducible baseline from at least ten representative completed ordinary PR runs and the latest successful dry-run application release before changing workflows. Capture checkout duration, dependency installation, verification, packaged-app/installer coverage, packaging, and end-to-end critical path in a checked-in before/after table in `docs/desktop-development.md` or a dedicated CI runbook.
- For an app-only PR, every job uses partial-clone filtering plus sparse checkout and transfers no pack payload blobs beneath `img/frames/**`, `img/setSymbols/**`, or other explicitly excluded large legacy asset roots. The only initial `img/frames/**` exceptions are PR #7's four app-owned renderer globals: `cornerCutout.png`, `maskRightHalf.png`, `maskMiddleThird.png`, and `serial.png`. A CI assertion proves the sparse working tree, exact allowlist, and transferred/checked-out bytes.
- Against the recorded median baseline, app-only PR checkout time falls by at least 80% and end-to-end required-check critical path falls by at least 60%. If GitHub-hosted-runner variance prevents the critical-path target over ten post-change runs, retain the architecture only if checkout meets its target and the remaining bottleneck is documented with the next action.
- App-only PRs never compile, validate, archive, download, or package frame-pack payloads. They still run application typechecking, security linting, unit tests, desktop build, the Electron smoke test, and packaging checks appropriate to the changed surface.
- Packaging-sensitive and release validation preserves PR #7's Squirrel lifecycle/AUMID checks, packaged Windows Electron smoke, Setup creation, fresh install, stable stub, shortcuts, Installed Apps registration, and uninstall coverage; optimization may route these checks but may not delete or silently weaken them.
- A normal application release checks out the application surface sparsely, validates a small pinned compatibility/catalog document, and does not build or download any pack archives.
- A pack PR identifies the affected logical pack set from repository evidence, fetches only those pack assets, and validates definitions, metadata, assets, archives, and installability for that set. Shared or unclassifiable pack changes fail closed into the all-pack validation lane rather than silently skipping work.
- Manual pack releases build only explicitly selected and validated packs, merge them into a new immutable catalog generation, and leave unchanged pack versions pointing to their prior immutable assets.

#### Pack correctness and compatibility

- A single machine-readable ownership graph accounts for catalog/search entries, semantic registry relationships, compiled definitions, shared renderer/version scripts, shared set-symbol assets, release/compiler scripts, and every referenced image path. Directory names alone are never the authority.
- The ownership graph evolves PR #7's generated `frame-pack-ownership.json` rather than creating a competing ownership system. It distinguishes one physical archive owner from every logical consumer and centralizes the base-runtime allowlist that PR #7 currently hard-codes in packaging and release scripts.
- Every published pack archive contains declarative metadata/definitions and assets only, never executable JavaScript. Every file is listed with path, byte length, and SHA-256; the archive and expanded tree are validated against those declarations.
- Every changed definition resolves to an owned pack, every referenced pack asset exists with exact case, every changed asset is owned by at least one definition or an explicit shared rule, and deleted/renamed assets cannot leave a published definition dangling.
- The application embeds a small compatibility pin that identifies a known-good catalog generation and supported pack schema/renderer API. Application-release preflight verifies the pin against published catalog metadata without downloading pack archives.
- Catalog history retains enough immutable version metadata for the updater to select the highest non-revoked version compatible with either the running app or a staged target app.

#### User-facing updates

- Automatic checks run after the editor is ready and at most once per 24 hours; manual **Check for Updates** always bypasses that throttle. Checks download metadata only. Network failure is non-destructive and retryable.
- Update availability is the union of a newer eligible app release and newer compatible versions of currently installed packs only. Optional packs that are not installed are absent from the update state, badge, copy, and download plan.
- PR #7's individual Settings **Update** action for installed packs is removed or routed into this same consolidated plan. It must not remain as an immediate second update path that calls ordinary installation and changes the active pointer while the app is running.
- The update UI distinguishes checking, available (app only, packs only, or both), downloading with aggregate determinate progress, verifying, staged/Restart, failed/retryable, compatibility-blocked, and recovery-required states. Pack names and target versions are available in Settings details without crowding the toolbar control.
- **Update Now** creates one durable transaction, flushes storage, creates the existing pre-update snapshot, downloads all targets to inactive versioned locations, verifies them, and never edits the active pack pointer.
- A partial or failed download does not expose partial contents. Retry reuses verified completed artifacts where safe and retries only missing/invalid items. Cancellation, process termination, loss of network, or loss of disk space leaves the running app and active packs unchanged.
- **Restart** is enabled only when every planned artifact is ready. The platform updater installs the staged app when present. On the first launch whose application version matches the transaction target, Set Conjurer validates and atomically swaps the active pack pointer before the renderer opens. Pack-only transactions use the same controlled relaunch/activation path.
- If the app installer is canceled or fails, the old app and old active packs remain paired. If pack activation or a data migration fails, the prior pointer and pre-update snapshot are restored before normal editing resumes; recovery UI explains the result and offers retry. Immutable prior pack directories are retained until the transaction succeeds and normal retention cleanup runs.
- First install/onboarding, repair, and deliberate manual installation remain separate from update activation: preserve PR #7's healthy per-pack commits and required/optional partial-success behavior there. Only an installed-pack/app update uses the all-items-staged, Restart-gated transaction.

## Scope

- GitHub Actions change classification, partial/sparse checkout, required-check aggregation, and conditional application/package/pack lanes.
- An explicit pack ownership and compatibility model covering all seven logical packs: `set-symbols`, `standard`, `booster-fun`, `tokens`, `basics`, `legacy`, and `custom`.
- Deterministic compilation of downloadable declarative pack definitions and metadata.
- Focused pack validation tiers, archive/install smoke tests, and a selective manual pack-release workflow.
- Decoupled application-release checkout and compatibility preflight while preserving current macOS arm64/x64 and Windows x64 signing, notarization, and artifact verification.
- Pack catalog discovery, installed-pack update discovery, versioned staging, atomic activation, transaction recovery, and compatibility resolution.
- Consolidation of application discovery and PR #7's installed-pack `updateAvailable`/immediate Settings Update path into one user-facing update transaction while keeping first install, onboarding, repair, and deliberate manual installation as separate service modes.
- Settings/toolbar UI, accessibility, progress, error states, automated verification, visual evidence, and release/developer documentation.
- Migration from the existing catalog schema 2 and `active.json` schema 1 without invalidating current installations.

## Explicit non-goals

- Do not implement, deploy, publish a release, open a PR, change GitHub/Azure/Apple production settings, or touch the Windows x64 reliability work in this planning task.
- Do not automatically publish app or pack releases. Tags and workflow dispatch remain deliberate human actions.
- Do not move the asset library to a separate repository in the first implementation, rewrite Git history, introduce Git LFS, or delete the existing assets. Those remain measurable future options.
- Do not notify users about uninstalled optional packs, recommend optional packs through the updater, or install them as a side effect of an app update.
- Do not add accounts, telemetry, background services, recurring user-data backups, or a hosted update service. GitHub Releases remains the distribution source.
- Do not allow downloaded JavaScript or renderer logic in packs. Renderer changes ship in signed app releases.
- Do not promise a single filesystem transaction spanning an operating-system app install and user-data pack activation; that is not portable. The supported atomic boundary is a durable handoff: the new app version must launch successfully and then commit the prepared pack pointer before the renderer starts.
- Do not weaken current macOS signing/notarization or Windows signing/preview behavior, and do not overwrite immutable published artifacts to repair a bad release.
- Do not replace PR #7's proven streaming/resume/extraction, pack-health, Squirrel/AUMID, packaged Windows, or installer-test foundations with parallel implementations. Extend them behind the planned schemas and coordinator.

## Current-state findings

The findings immediately below describe this planning branch's committed base, `feeaa45d`. They remain the reason for the feature but are not a claim about post-merge `master`. The following PR #7 compatibility subsection records the likely next foundation separately because the PR was not merged and its CI was not complete when reviewed.

### Repository weight and workflow cost

- `git count-objects -vH` reports a 4.89 GiB packed object database in this partial clone, consistent with the verified roughly 5.1 GiB repository finding. The worktree contains 11,215 tracked files under `img/frames/**` and 2,562 under `img/setSymbols/**`, out of 16,041 tracked files total.
- The largest working-tree frame roots include `img/frames/m15` (about 1.02 GB), `img/frames/custom` (about 987 MB), `img/frames/modal` (about 272 MB), and `img/frames/8th` (about 195 MB). Individual tracked image blobs exceed 15 MB.
- `.github/workflows/ci.yaml` performs a default full `actions/checkout@v5` in the verify job and all three packaging jobs. It runs pack compilation even for app-only changes and packages macOS arm64, macOS x64, and Windows x64 on every PR.
- `.github/workflows/release-app.yaml` likewise performs default full checkouts in preflight and all platform jobs and runs `npm run packs:compile` in every platform build even though `forge.config.ts` excludes `img/frames/**` and `img/setSymbols/**` from the base app.
- A sparse working tree alone is not enough: Git must also use partial-clone filtering (`filter: blob:none`) so checkout does not transfer excluded blobs. This is the key refinement to the proposed architecture.

### Pack ownership and build behavior

- Logical ownership is seven categories, but physical storage is not seven directories. `js/frameRegistry.js` assigns semantic profiles/components/variants to categories and may redirect through `assetPack`; `js/frameSearch.js` supplies catalog/search membership; 380 `js/frames/pack*.js` files reference assets across shared top-level image directories.
- Shared metadata is behaviorally significant. `js/frameRegistry.js` controls categories, family/engine relationships, automatic variants, and component `assetPack` aliases. `js/frameSearch.js` controls discoverability and dynamically loads definitions. `js/frames/version*.js`, group files, mana-symbol files, and renderer logic may reference pack assets outside the primary `pack*.js` source.
- `scripts/build-frame-pack-release.mjs` currently infers top-level asset directories by regexing `/img/frames/<first-segment>` references in pack scripts. That is insufficient for dynamic paths, version scripts, aliases, shared assets, exact file ownership, and deletion checks.
- `scripts/compile-frame-packs.mjs` compiles only the semantic component packs found through `registry.components` (37 outputs in the current manifest), not all 380 regular pack definitions. `tests/packs/frame-pack-compiler.test.js` verifies those JSON files exist but does not verify referenced assets.
- The release builder creates multipart ZIPs, per-pack file manifests, a schema-2 `frame-packs.json`, and checksums. Tests assert archive size limits and workflow tag checkout, but do not build/install representative archives or verify catalog/archive/file agreement.
- Published pack archives currently contain images only. Regular frame scripts, search metadata, the registry, and the 37 compiled component definitions remain in the base app. Therefore an image correction can ship independently, but a genuinely new discoverable frame definition generally cannot. Independent pack delivery requires a new declarative pack format and renderer consumption path.

### Pack installation and application updates

- `desktop/services/pack-service.ts` supports first-time discovery/install and removal. It verifies archive byte counts, SHA-256, ZIP CRC, traversal, symlinks, and expanded-size limits, then writes directly to a versioned directory and updates `active.json` after each requested pack. It has no installed-pack update planner, multi-pack transaction journal, compatibility model, rollback pointer, or startup recovery.
- Catalog discovery scans recent GitHub releases and selects the first asset named `frame-packs.json`. It does not semantically choose the newest pack release, page beyond 30 releases, retain version history, validate catalog authenticity against an app pin, or filter by app compatibility.
- `desktop/services/update-service.ts` checks only `v*` application releases. It downloads one installer, verifies SHA-256 from `SHA256SUMS`, and exposes `includesApp: true` with no packs. `desktop/main.ts` opens the installer path, immediately calls `app.relaunch()`, and exits; it does not coordinate installer success with pack activation.
- `desktop/ipc/contracts.ts` already anticipates a combined state with `includesApp` and `packIds`, and `js/desktopBridge.js` already exposes one toolbar control that changes from **Update Now** to **Restart**. This is a useful UI seam, but the current state is too coarse for multiple artifacts, compatibility blocks, recovery, and detailed failures.
- The updater does not currently perform the documented automatic background check; it checks only when the Settings button or toolbar retry path invokes it.
- `js/setFiles.js` writes `{id, version:'1.0.0'}` requirements based on category, regardless of the actually installed version. Import checks only for missing pack IDs, not exact/compatible versions.

### Existing verification seams

- The normal repository commands are `npm run packs:compile`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:desktop`, `npm run test:electron`, and `npm run package:verify`.
- `scripts/test-electron.mjs` already verifies onboarding, Settings/frame-pack rows, update-button placement/styles/progress/Restart appearance, editor state, and screenshots. It currently mocks visual state by mutating the DOM and does not exercise real update planning or staging.
- `tests/desktop/security-contract.test.js` contains source-pattern assertions for pack checksum and extraction protections. Focused behavioral service tests are absent.
- `forge.config.ts` intentionally excludes all pack payloads from distributable apps and includes local source-pointer seeds only for `make:local`; this separation should be preserved.

### PR #7 compatibility review: likely post-merge foundation, not current base

At reviewed head `a51e28a`, PR #7 changes 25 files and directly overlaps the planned implementation surface. It should be treated as a prerequisite foundation after, and only after, its final merge and passing Windows CI are confirmed:

- New `desktop/services/pack-archive.ts` streams archives and ZIP entries to disk, supports bounded Range resume/retry and verified `.partial` reuse, incrementally hashes downloads, and uses lazy `yauzl` extraction with path, symlink, file-count, and expanded-byte limits. `package.json`/`package-lock.json` add `yauzl` and its types; `tests/desktop/pack-archive.test.js` covers resume/reuse and traversal.
- `desktop/services/pack-service.ts` validates cached catalog schema 2, refreshes/caches the public catalog, checks installed roots and `.set-conjurer-pack.json` health identity, reports `updateAvailable`, aggregates byte-based progress, uses 512 MiB per-part client safety with 256 MiB release source parts, retains resumable downloads, and commits each healthy onboarding/manual pack independently.
- `js/desktopBridge.js` loads catalog metadata before onboarding, shows per-pack/selected download sizes and one aggregate onboarding progress indicator, exposes an immediate per-pack Settings **Update** button, keeps metadata-check failures in Settings, and shows the toolbar action only for actionable update phases. `css/style-9.css` explicitly honors `[hidden]`.
- `desktop/main.ts` handles Squirrel lifecycle events and the stable AUMID before normal startup, exits after opening staged Windows Setup instead of immediately relaunching the old app, and starts packaged app/catalog metadata checks after a fixed 15-second delay. This is a foundation to coordinate and throttle, not a second timer to retain alongside `UpdateCoordinator`.
- `scripts/build-frame-pack-release.mjs` targets 256 MiB source parts, excludes four renderer-global base assets, promotes multiply referenced downloadable files to Standard for one archive owner, and emits `frame-pack-ownership.json`. Its regex/top-directory inference is still insufficient as the final logical ownership graph.
- `forge.config.ts` and `scripts/verify-package.mjs` keep and verify exactly four base-runtime files under `img/frames/**`: `cornerCutout.png`, `maskRightHalf.png`, `maskMiddleThird.png`, and `serial.png`. They must remain app-owned throughout legacy schema-2 compatibility unless a later explicit path migration updates all consumers and tests.
- `.github/workflows/ci.yaml`, `scripts/test-electron.mjs`, new `scripts/test-windows-installer.ps1`, and `tests/desktop/windows-reliability.test.js` add Windows unit/Electron execution, packaged-executable smoke, Setup build, fresh install, shortcut/stable-stub/Installed Apps checks, and uninstall coverage. The reviewed CI run was still in progress; final passing status must be confirmed after merge.
- PR #7 also gates editor initialization/persistence on healthy onboarding and performs a snapshot-first targeted repair for structurally damaged beta cards. Update snapshots and activation must start after that readiness/repair seam so recovery cannot race or undo repair.

Compatibility conclusion: PR #7 reduces implementation work but does not supply partial/sparse checkout, a complete consumer-aware ownership graph, selective pack releases, schema-3 declarative payloads, compatibility pins/history, a durable combined transaction, or Restart-coupled installed-pack activation. No product decision changes; the ordered plan must reuse these foundations and remove the conflicting immediate installed-pack update route.

## Evidence-based decisions and alternatives

### 1. Keep the monorepo initially; combine partial clone with sparse checkout

**Decision:** retain source assets in this repository for the first implementation, but make every ordinary CI/release job use `actions/checkout@v5` with `filter: blob:none`, an explicit sparse set, and `fetch-depth` only as deep as classification/release validation requires. Dynamically expand sparse patterns only in pack jobs after ownership classification.

Why this is best now:

- Checkout is the verified dominant cost, while app checks after checkout are short. Avoiding blob transfer directly attacks the measured bottleneck with low product risk.
- Pack definitions and shared assets currently have cross-cutting relationships; preserving a single commit keeps code/asset review atomic while the ownership graph is made explicit.
- The base app excludes pack payloads except PR #7's four small renderer-global compatibility assets, so application packaging naturally fits an exact-allowlist sparse source checkout.
- This approach is reversible and provides metrics that can justify a later repository split if pack jobs remain too slow.

Rejected for this phase:

- **Sparse checkout without partial clone:** rejected because excluded blobs may still be fetched, leaving network cost largely intact.
- **Git LFS:** rejected for now because it requires repository/history migration, changes contributor workflows, introduces bandwidth/storage policy and availability concerns, and still downloads LFS objects when pack jobs need them. It is not necessary to remove assets from app-only CI.
- **Immediate separate pack repository:** strongest long-term repository-size reduction, but currently adds cross-repository commit coordination, compatibility publication, permissions, and review complexity before ownership is trustworthy. Re-evaluate after 20 app PRs and three selective pack releases using measured checkout/build data.
- **GitHub cache of the full asset tree:** rejected as the primary design because caches are mutable/evictable, close to platform size limits, and do not solve unnecessary app-job checkout or source-of-truth validation.
- **Skip pack validation entirely on app PRs using path globs:** rejected because ownership is not directory-only and shared metadata can affect every pack.

### 2. Generate and validate one conservative ownership graph

**Decision:** evolve PR #7's generated `frame-pack-ownership.json` into a single checked-in/configured ownership system for the seven logical packs, app-owned base-runtime files, and shared rules, then generate a deterministic consumer/archive index from it plus `frameRegistry`, `frameSearch`, compiled definitions, version/group scripts, and literal/dynamic asset rules. Both CI classification and release building must consume the same library and output format. Unknown or ambiguous changes select the conservative superset; they never select zero packs.

The ownership index records, for every logical pack:

- catalog profiles/search entries;
- semantic components, variants, parents, engines, and `assetPack` aliases;
- source definition and renderer helper files;
- exact referenced asset files and explicit dynamic-path prefixes;
- shared assets, the union of their logical consumers, and their one physical archive owner (preserving Standard ownership for cross-category assets unless the validated schema specifies another owner);
- set-symbol ownership;
- the exact app-owned base-runtime allowlist introduced by PR #7;
- schema/compiler/release files that force all-pack validation.

This avoids duplicating fragile regexes between CI and release scripts and makes ownership drift testable in ordinary local commands.

### 3. Publish schema-3 declarative packs and an immutable catalog history

**Decision:** evolve downloads to pack schema 3. Each changed logical pack receives the global `packs-vX.Y.Z` release version and contains declarative catalog/search/registry slices, compiled frame definitions, file metadata, and assets. Packs contain no JavaScript. A schema-3 catalog snapshot keeps version history per pack, including immutable archive URLs/digests, manifest digest, minimum app version, pack schema, renderer API version, dependencies, revoked status, and installed/archive byte counts.

Selective release behavior:

- The operator supplies the immutable `packs-vX.Y.Z` tag and an explicit comma-separated logical pack list (or `all`).
- Preflight checks that the tag points to reviewed default-branch history, the selected packs match changes since the previous catalog generation, and versions only advance.
- The workflow downloads only the previous small catalog snapshot, builds/validates selected payloads, appends their versions, and carries unchanged version histories forward without rebuilding their archives.
- Every release publishes the complete new schema-3 catalog snapshot plus selected archives/manifests/checksums. It remains a prerelease and never becomes the latest application release.
- During migration, new releases use a distinct asset name such as `frame-pack-catalog-v3.json`. Do not overwrite or publish an incompatible schema under `frame-packs.json`; old apps can continue finding the last schema-2 release. Publish a schema-2 projection only when all entries in that projection remain image-only compatible with old clients.

### 4. Pin app compatibility to metadata, not payloads

**Decision:** add `resources/pack-compatibility.json` to the base app with a schema version, exact known-good catalog tag and catalog SHA-256, supported pack schema range, supported renderer API range, and minimum known-good versions for required packs. Optional packs are not bundled or fetched at app build time.

Application release preflight downloads only the pinned catalog asset and verifies its checksum, required pack entries, compatibility ranges, dependency closure, and immutable HTTPS URLs. Packaging verifies that the pin is present in the ASAR. This makes app releases reproducible and fast while allowing runtime discovery of later compatible packs.

The runtime resolver uses the running or staged target app compatibility descriptor to choose the highest compatible, non-revoked version. An app update is blocked before download if any installed pack would have no compatible current or upgrade version under the target app. Uninstalled optional packs do not participate.

### 5. Use one durable update transaction with platform-specific app staging

**Decision:** retain separate pack and app service modules but introduce an `UpdateCoordinator` as the sole owner of user-visible update state. Reuse PR #7's catalog cache, `updateAvailable` signal, archive adapter, and Squirrel lifecycle; remove or reroute its individual immediate Settings Update action. Add a narrow `AppUpdateAdapter` around the supported Electron/Squirrel/macOS updater mechanism with automatic download/install disabled. GitHub metadata checks remain custom so checking never starts a download. On **Update Now**, the coordinator starts pack downloads and the app adapter, combines byte-weighted progress, and persists a journal after every artifact/state transition.

The implementation must build on PR #7's corrected Windows behavior—open verified Setup and exit without immediately relaunching the old app—but must not treat `shell.openPath(installer)` alone as a confirmed installation. The app adapter must report downloaded/staged/installation events and invoke the supported platform `quitAndInstall`/Squirrel equivalent only from **Restart**. Application release assets/feed metadata must be adjusted as needed while preserving the current signed DMG/ZIP and Squirrel outputs. Feed metadata and published SHA-256 are verified in release tests; operating-system code signatures remain the application trust boundary.

### 6. Commit packs only after the target app launches

**Decision:** stage packs in immutable version directories and leave `active.json` unchanged. The transaction records prior and target pointers plus current/target app versions. On restart:

1. Flush storage and ensure the pre-update snapshot/journal are durable.
2. If an app update exists, hand control to the platform updater and quit; otherwise perform a controlled relaunch.
3. At startup, before creating the renderer window, recover the journal.
4. If the running app version does not equal the target, do not activate packs; leave the transaction staged/retryable.
5. If it matches, re-verify target manifests/directories and compatibility, write a new pointer to a temporary file, fsync where supported, and atomically rename it over `active.json`.
6. Run any pack/data migration gate. Only after success mark the transaction committed and open the renderer.
7. On failure, restore the prior pointer and storage snapshot, record recovery details, and open a recovery state using the prior compatible set. Never delete the only known-good version during recovery.

This provides coherent activation without pretending the OS app install and user-data rename are one cross-platform filesystem transaction.

### 7. Background checks are quiet; download remains explicit

**Decision:** replace PR #7's fixed 15-second app/catalog timers with one coordinator-owned metadata-only check after its existing editor/onboarding/repair readiness seam, throttle success or failure attempts to once per 24 hours, and retain the manual Settings action. Background failure does not interrupt editing or open a dialog and remains Settings-only when there is no actionable plan. No download starts until **Update Now**. Pack-only updates still wait for **Restart** so user expectations remain uniform.

### 8. Keep required checks stable through an aggregate gate

**Decision:** use a small always-running classify job and a final always-running `required` job that evaluates the conditional lane results. This avoids GitHub branch-protection problems caused by entirely absent path-filtered workflows. A skipped lane is acceptable only when the classifier explicitly marks it unnecessary; an unknown classification must request broader validation.

## Ownership and CI routing model

| Changed surface | Required route |
| --- | --- |
| Application renderer/core, desktop services, CSS/HTML, ordinary tests/docs | App verify; package lane only when packaging/runtime surface warrants it |
| `desktop/services/pack-service.ts`, pack IPC contracts, compatibility resolver | App verify plus all-pack contract/install fixture tests; no image blobs unless fixture tests request them |
| `js/frames/pack*.js` or future declarative definition source | Logical pack(s) derived through search/registry/category/assetPack graph |
| `js/frameRegistry.js` / `js/frameSearch.js` | Diff-aware ownership; affected union when keys can be resolved, otherwise all packs; app verify because renderer behavior changes |
| `js/frames/version*.js`, group files, mana-symbol helpers, renderer frame logic | App verify plus every consuming pack; all packs when dynamic use cannot be proven narrower |
| Pack-owned `img/frames/**` (excluding the exact base-runtime row below) | Reverse exact/prefix ownership index; union for logical consumers, one archive owner; fail if unmapped |
| PR #7 base runtime files `cornerCutout.png`, `maskRightHalf.png`, `maskMiddleThird.png`, `serial.png` | App/package lane and legacy-pack compatibility tests; never classify as downloadable pack payload while the compatibility contract retains them |
| `img/setSymbols/**` | `set-symbols` |
| Pack schema, compiler, ownership, validation, release builder/workflow | All packs; app verify when runtime/catalog contract changes |
| App release/Forge/signing/package verification | App verify plus full platform package lane; never pack payload build |
| Mixed app and pack change | Union of app lane and affected pack lane, running concurrently after classification |
| Rename/delete | Classify both old and new paths and validate consumers against the target tree |
| Unknown/unparseable pack-related path | Fail closed to all-pack validation and emit an actionable ownership error |

### Validation tiers

1. **Tier 0 — classification and metadata (every PR):** blobless sparse checkout of workflows, package metadata, pack ownership/configuration, registry/search/definition sources, scripts, and tests. Validate ownership graph determinism, changed-path routing, dependency cycles, version syntax, catalog schema, and generated-file freshness.
2. **Tier 1 — app verification (when app/shared runtime is affected):** sparse application checkout with heavy pack/legacy assets excluded and only the four base-runtime frame files allowlisted. Run dependency install, typecheck, security lint, non-pack unit tests, desktop build, Electron smoke, and package-surface checks. Run the three-OS packaging matrix only for packaging/runtime/dependency/release changes; otherwise one representative package smoke is sufficient and full matrix remains a release gate. The Windows packaging lane retains PR #7's packaged-executable and fresh Squirrel install/uninstall verification.
3. **Tier 2 — affected pack source/assets (when packs are affected):** dynamically extend sparse checkout with exact files/prefixes from the ownership graph. Compile selected declarative payloads; validate exact-case paths, allowed extensions/MIME signatures, readable dimensions, duplicate output paths, dynamic-prefix bounds, dependency closure, no executable content, file hashes/sizes, and no dangling or unexplained changed assets.
4. **Tier 3 — archive/installability (pack changes):** build selected multipart archives using the production builder, validate archive limits/catalog/manifests/checksums, install via `PackService` against local file/HTTP fixtures, exercise multipart merge and corruption/traversal/duplicate/symlink/oversize failures, and render a small representative definition from each affected logical pack in Electron.
5. **Tier 4 — all-pack/full release rehearsal:** required for shared/unclassifiable ownership changes, manual workflow dispatch, and pack release preflight. Validate the entire ownership graph and definitions. Asset checkout/build remains selective for a normal pack release; an explicit `all` rehearsal is available before foundational schema/compiler changes merge.

## Ordered implementation plan

### 0. Refresh the branch and plan after PR #7 actually merges

Files:

- `docs/planning/app-pack-delivery-latency-PLAN.md`
- merged PR #7 files listed in the compatibility review, read-only during this checkpoint

Actions:

- Confirm PR #7 is merged, capture the final merge SHA, and confirm the final Windows/Desktop CI run passed packaged-app and fresh-installer jobs.
- Fetch and rebase/refresh this existing branch/worktree onto that merged `origin/master`; do not replace the worktree, duplicate the branch, or begin implementation during the refresh.
- Compare the final merged diff with reviewed head `a51e28a`, update this plan's base metadata/current-state/file assumptions if necessary, and commit only the refreshed plan.
- Obtain Joseph/voice-coordinator approval of that post-merge plan before invoking `standardized-feature`.

Checkpoint: the planning branch contains PR #7's final merged foundation, the plan names the actual merged SHA and passing CI evidence, the worktree contains no implementation changes, and approval is explicit.

### 1. Capture baseline and create reusable checkout assertions

Files:

- `docs/desktop-development.md`
- `.github/workflows/ci.yaml`
- new `scripts/report-checkout-surface.mjs`
- new `tests/ci/checkout-surface.test.js`

Actions:

- Record ten-run baseline timing and current repository/object/file counts from the post-PR-#7 default branch before changing job layout. Include the newly merged Windows packaged-app, Setup, fresh-install, shortcut/Installed Apps, and uninstall work so before/after critical paths are comparable.
- Add a script that reports present paths, working-tree bytes, and whether forbidden large roots are materialized. In CI it fails an app-only lane if any pack payload path exists, any one of the four expected base-runtime files is missing from a package-sensitive checkout, or any unallowlisted `img/frames/**` file is materialized.
- Preserve timing markers around checkout, install, checks, and packaging so post-change measurements compare like with like.

Checkpoint: baseline table is reviewable and the assertion fails against a deliberately full app checkout fixture.

### 2. Define pack schema, compatibility, and ownership sources

Files:

- new `packs/config.json`
- new `packs/schema.ts`
- new `packs/ownership.ts` (or `.mjs` if shared directly with Node scripts)
- new `resources/pack-compatibility.json`
- `desktop/ipc/contracts.ts`
- new `tests/packs/ownership.test.js`
- new `tests/packs/schema.test.js`

Actions:

- Define the seven pack IDs once and consume them from runtime/build code rather than copying arrays.
- Import PR #7's `frame-pack-ownership.json` fields and `BASE_RUNTIME_ASSETS` behavior into this single schema; do not leave independent hard-coded ownership/allowlist copies in the builder, Forge config, verifier, and classifier.
- Define strict schemas for pack manifests, schema-3 catalog history, compatibility pins, installed state schema 2, and update transaction journals.
- Seed explicit shared/dynamic ownership rules that cannot be recovered safely from literals. Require a reason for every prefix/shared rule.
- Generate a normalized graph from config plus registry/search/definition sources. Expose `ownersForSource`, `ownersForAsset`, `filesForPack`, and `classifyChanges` APIs.
- Validate that every registry/search profile, `assetPack` alias, definition source, and referenced image has one physical archive/base owner and the correct logical consumer set; reject cycles, duplicate archive ownership, unresolved references, and case collisions.
- Pin the current known catalog/base versions without downloading payloads.

Checkpoint: the current tree maps deterministically, with any pre-existing orphan/dynamic exceptions explicitly enumerated and justified rather than silently ignored.

### 3. Make compilation complete, deterministic, and pack-scoped

Files:

- `scripts/compile-frame-packs.mjs`
- `js/frameRegistry.js`
- `js/frameSearch.js`
- `js/frames/pack*.js` only where safe compilation requires declarative cleanup
- `generated/frame-definitions/**`
- `tests/packs/frame-pack-compiler.test.js`

Actions:

- Extend compilation from the current 37 semantic component packs to every downloadable/searchable frame definition needed by each logical pack.
- Replace runtime-executable pack source in downloaded artifacts with normalized JSON for frames, masks, bounds, variants, catalog labels/search terms, and registry slices. Keep executable renderer/version logic in the signed app and represent its required renderer API in metadata.
- Support `--packs <ids>` and `--check`. `--check` builds in a temporary directory and fails on differences without modifying the worktree.
- Produce deterministic ordering and stable JSON so unrelated packs do not change.
- Update the renderer lookup contract so packaged development can consume compiled data from active pack roots while browser/local development has an explicit checked-in/generated fallback.

Checkpoint: all current searchable frames load from compiled declarative data in a local test, and downloaded payload design contains no JavaScript.

### 4. Implement changed-path classification and conditional CI

Files:

- new `scripts/classify-ci-changes.mjs`
- new `tests/ci/classify-ci-changes.test.js`
- `.github/workflows/ci.yaml`
- `package.json`

Actions:

- Read base/head SHAs from the pull-request event, classify additions/modifications/deletions/renames using the shared ownership graph, and emit JSON plus GitHub outputs for `app`, `package`, `packs`, `allPacks`, and sparse patterns.
- Use a tiny initial checkout with `filter: blob:none` and metadata/source sparse paths. Fetch only the commit history required to diff the PR safely.
- Run app and pack lanes concurrently after classification. Add the final always-running `required` job that rejects any failed/canceled required lane or unexplained classifier output.
- App lane uses blobless sparse checkout and excludes pack payloads. Package matrix runs only for Forge, dependency, desktop-main/preload/native integration, package verification, or release workflow changes; ordinary renderer changes use the representative package smoke plus release-time full matrix.
- Preserve PR #7's Windows checks in the routed package lane: `npm test`, development and packaged Electron smoke, clean distributable repackage/verification, Squirrel Setup creation, and `scripts/test-windows-installer.ps1`. The classifier must select that lane for Squirrel lifecycle/AUMID, native main/preload, Forge/maker, package dependency, installer, signing, or package-inventory changes.
- Make packaged Electron smoke compatible with sparse checkout. Replace PR #7's broad local source-root seed dependency with a minimal checked-in/local-HTTP schema-2 fixture or dynamically include only the exact representative required assets; never restore the multi-gigabyte frame checkout merely to keep the smoke passing.
- Pack lane expands sparse checkout from classifier output and logs the selected logical packs and reasons.
- Add `workflow_dispatch` inputs for `all`/specific-pack rehearsal without publishing.

Checkpoint: fixture PR diffs cover app-only, one pack definition, one pack image, shared image, set symbols, mixed change, registry edit, rename/delete, pack-script edit, workflow edit, and unknown pack path. Each produces the expected required lanes.

### 5. Add comprehensive focused pack validation

Files:

- new `scripts/validate-frame-packs.mjs`
- `scripts/build-frame-pack-release.mjs`
- PR #7's `desktop/services/pack-archive.ts`
- `tests/packs/frame-pack-release.test.js`
- new `tests/packs/frame-pack-assets.test.js`
- PR #7's `tests/desktop/pack-archive.test.js`
- new `tests/packs/pack-installation.test.js`
- `desktop/services/pack-service.ts` refactored to expose/test pure verification helpers
- `package.json`

Actions:

- Validate all Tier 2 properties for selected packs, including exact-case existence on Windows-insensitive filesystems by comparing path segments to directory entries.
- Inspect supported image headers/dimensions and SVG structure without adding a heavyweight native dependency to the app-only install path. Reject extension/signature mismatch, zero/truncated files, unsafe SVG external/script content, and unbounded dynamic prefixes.
- Generate per-file SHA-256/size metadata and a manifest digest; require archive entries to match exactly once.
- Reuse and extend PR #7's pure/injectable `downloadArchive`/`extractArchive` adapter and `yauzl` dependency. Preserve Range resume, retry, incremental hashing, verified archive reuse, lazy extraction, traversal/symlink rejection, file-count and expanded-byte limits; add manifest agreement, free-space accounting, duplicate-entry rejection, cancellation, and transaction-specific destination behavior rather than reimplementing the adapter.
- Preserve the 256 MiB release partition target and current 512 MiB client ceiling unless measurements and schema migration justify a reviewed change; test both the source target and hard safety ceiling.
- Make the release builder accept selected packs and an explicit previous catalog input; evolve its PR #7 `frame-pack-ownership.json` output and use identical ownership/manifest logic in CI and release.

Checkpoint: a deliberately corrupt image, missing referenced asset, unexpected asset, wrong-case reference, tampered archive, duplicate path, traversal, symlink, and incompatible manifest each fail with the pack/file named.

### 6. Make frame-pack release selective and catalog-history aware

Files:

- `.github/workflows/release-frame-packs.yaml`
- `scripts/build-frame-pack-release.mjs`
- new `scripts/validate-pack-release-request.mjs`
- `tests/packs/frame-pack-release.test.js`
- `docs/desktop-release.md`

Actions:

- Add required `packs` input and optional non-publishing rehearsal mode. Continue requiring an immutable `packs-vX.Y.Z` tag.
- Perform metadata-only preflight from a blobless sparse tag checkout. Resolve and verify the newest prior schema-3 catalog by semantic pack tag, then expand checkout only for selected pack files.
- Prove selected packs cover relevant changes since the prior catalog and reject an unchanged/omitted affected pack unless `all` is deliberately selected.
- Build/validate only selected packs, append version records, preserve unchanged history, and publish a complete catalog snapshot, manifests, archives, and checksums only when the operator enabled publishing.
- Continue emitting the ownership/size report introduced by PR #7, but source it from the shared consumer/archive graph. The report names app-owned base-runtime files separately, proves exactly one archive owner per downloadable file, and lists all logical consumers used for validation routing.
- Keep releases prerelease/non-latest. Use concurrency keyed by pack tag and refuse asset replacement/republication.
- Preserve the old schema-2 client path as described in the migration section.

Checkpoint: a dry-run release for one fixture pack checks out/builds only that pack, produces a complete merged catalog, and cannot mutate an existing tag/release.

### 7. Remove pack payload work from normal app release and pin compatibility

Files:

- `.github/workflows/release-app.yaml`
- `scripts/validate-release-request.mjs`
- new `scripts/validate-app-pack-compatibility.mjs`
- `scripts/verify-package.mjs`
- `forge.config.ts`
- `tests/desktop/release-workflow.test.js`
- `resources/pack-compatibility.json`
- `docs/desktop-release.md`

Actions:

- Use blobless sparse checkout at the requested app tag in preflight/macOS/Windows jobs. Remove `npm run packs:compile` from platform jobs after compiled runtime metadata boundaries are established.
- Download and checksum only the pinned catalog metadata in preflight; validate supported schemas/APIs, required-pack baseline versions, dependencies, and URLs.
- Ensure the compatibility pin and required fallback runtime metadata are packaged while all pack archives/images remain forbidden.
- Preserve and verify the four legacy base-runtime frame files in the ASAR while all other pack archives/images remain forbidden. Keep them until the schema-2 support window is explicitly retired; do not accidentally omit them from sparse package/release checkouts.
- Preserve all current Apple secret validation, certificate import, signing, notarization/stapling, Windows Azure modes, package signing, installer verification, checksums, publish gating, Squirrel lifecycle/AUMID behavior, and fresh installed-artifact verification.
- Generate the platform update-feed metadata required by the chosen app adapter and validate it before artifact upload/publish. Do not make app releases automatic.

Checkpoint: non-publishing application release rehearsal completes without materializing any pack-owned image root or invoking pack build/archive commands, while the exact four app-owned base-runtime files and PR #7 Windows installation lifecycle checks pass.

### 8. Upgrade PackService to versioned catalogs and inactive staging

Files:

- `desktop/services/pack-service.ts`
- PR #7's `desktop/services/pack-archive.ts`
- new `desktop/services/pack-catalog-service.ts`
- new `desktop/services/update-transaction-store.ts`
- `desktop/ipc/contracts.ts`
- `desktop/main.ts`
- new `tests/desktop/pack-service.test.js`
- PR #7's `tests/desktop/pack-archive.test.js`
- new `tests/desktop/update-transaction-store.test.js`

Actions:

- Discover the highest valid schema-3 catalog by semantic pack tag, verify it against the embedded baseline/pin and catalog self-metadata, cache it atomically, and retain the last-known-good catalog for offline use.
- Migrate PR #7's schema-1 `active.json` plus `.set-conjurer-pack.json` health identity into schema 2 with explicit active/previous version pointers and immutable version directories. Keep both legacy forms readable, validate health before migration, and back up the old pointer before the one-time write.
- Reuse PR #7's cached catalog and `updateAvailable` as discovery inputs, then resolve installed-only candidates against schema-3 history and running/target app compatibility rather than treating a simple version mismatch as sufficient.
- Split service entry points and semantics explicitly: `install/repair` may download and atomically commit each healthy pack for first install, onboarding, repair, or deliberate manual installation; `stageUpdate` downloads verified versions without changing `active.json`; `activateUpdate` is startup-only and commits the complete journaled target set.
- Reuse PR #7's durable `.partial`/verified archive paths and streaming extraction. Add transaction-specific ownership, per-file manifest verification, duplicate-entry rejection, expanded-size/free-space budgeting, inactive immutable destinations, and safe reuse across retry.
- Preserve PR #7's first-install/onboarding partial-success rule: required packs that become healthy stay active if a later optional pack fails, and repair/manual install can complete independently. Do not apply the update transaction's all-or-nothing Restart gate to those flows.
- Garbage-collect partial files after safe retention and old immutable versions only after a successful transaction, always retaining the active and immediately previous known-good version.

Checkpoint: behavioral tests prove healthy/repair/manual per-pack activation and optional partial success, installed-only discovery, multi-part staged updates, interrupted resume/retry, no active-pointer mutation during `stageUpdate`, and last-known-good offline behavior.

### 9. Introduce the consolidated UpdateCoordinator and app adapter

Files:

- new `desktop/services/update-coordinator.ts`
- new `desktop/services/app-update-adapter.ts`
- `desktop/services/update-service.ts` (replace or narrow to GitHub app discovery)
- `desktop/services/pack-service.ts`
- `desktop/ipc/contracts.ts`
- `desktop/preload.ts`
- `desktop/main.ts`
- new `tests/desktop/update-coordinator.test.js`
- new `tests/desktop/app-update-adapter.test.js`

Actions:

- Expand typed update state to include transaction ID, app target, installed-pack targets, total/completed bytes, per-item phase/error, compatibility block, recoverability, and timestamps while exposing a compact summary to the toolbar.
- Fold PR #7's `PackStatus.updateAvailable`, catalog refresh/cache, app release check, and fixed 15-second startup calls into one coordinator. Trigger it only after PR #7's editor/onboarding/beta-repair readiness seam; enforce the 24-hour throttle only for background checks and do not leave duplicate main/renderer timers.
- Metadata check concurrently discovers eligible app releases by channel and compatible updates for installed packs. A per-pack Settings Update click, if retained visually, must open/focus this same immutable consolidated plan and must never call immediate `packs.install()` for an already installed update.
- Build one immutable update plan against either current or target app compatibility. Revalidate it immediately before download so a changed/revoked catalog cannot be confused with the displayed plan.
- Flush storage and create exactly one pre-update snapshot when a transaction begins. Download app and pack items concurrently with a conservative limit, aggregate progress by declared bytes, and persist journal transitions.
- Configure the platform app updater not to auto-download or auto-install. Map its progress/errors/staged state into the coordinator. Extend PR #7's corrected Windows Setup-and-exit behavior with durable staged/installed confirmation; never reintroduce the old immediate `app.relaunch()` race.
- All-or-nothing readiness: one failed or incompatible item prevents Restart, but verified items remain reusable for retry.

Checkpoint: local HTTP fixtures cover app-only, pack-only, combined, beta/stable, uninstalled optional exclusion, no-update, metadata offline, checksum failure, disk-full simulation, partial retry, catalog revocation, incompatible installed pack, and process restart during every phase.

### 10. Implement startup activation, rollback, and recovery

Files:

- `desktop/main.ts`
- `desktop/services/update-transaction-store.ts`
- `desktop/services/pack-service.ts`
- `desktop/services/storage-service.ts`
- `desktop/ipc/contracts.ts`
- new `tests/desktop/update-activation.test.js`

Actions:

- Recover transaction state before protocol registration/window creation exposes packs.
- Begin update recovery only after Squirrel lifecycle event handling has exited special installer processes, and order normal activation so PR #7's onboarding gate/targeted beta repair cannot run concurrently with update snapshot restore or pointer commit.
- Validate the target app version, target pack trees, manifest digests, compatibility, prior pointer, and snapshot.
- Atomically commit the target active pointer only after target app launch. Mark success only after migrations and a minimal renderer-independent pack open/read validation.
- If the installer did not change the app version, leave packs staged and present retry/cancel rather than activating them under the old app.
- If activation/migration fails, restore the prior pointer and data snapshot, quarantine the failed target, and write a bounded redacted diagnostic. If the prior pack set is incompatible with the new app, open recovery UI rather than the editor and offer app-update retry or documented manual rollback; never silently substitute packs.
- On next successful startup, rotate the snapshot and retain the immediate prior pack set for rollback until normal cleanup.

Checkpoint: crash-injection tests at each journal transition always recover to either the complete old set or complete target set, never a mixture.

### 11. Complete updater UI and renderer integration

Files:

- `js/desktopBridge.js`
- `css/style-9.css`
- `creator/index.html` and/or `index.html` only if semantic hosts are needed
- `scripts/test-electron.mjs`
- `desktop/ipc/contracts.ts`

Actions:

- Keep one primary toolbar action. Available copy is **Update Now**; staged copy is **Restart** as approved. The title/accessibility description states whether the plan contains the app, named installed packs, or both.
- Remove PR #7's immediate individual pack-update behavior. Settings may list each installed candidate and may provide a details/focus affordance, but there is one actionable update transaction and one **Update Now** control for app plus compatible installed packs.
- Add a Settings update-detail region showing current/target app version, each installed pack update, total size, channel, last check, and compatibility/recovery messages. Do not list update candidates for uninstalled optional packs.
- Preserve PR #7's actionable-only toolbar and `[hidden]` CSS rule. Checking, up-to-date, rate-limit, offline, or metadata failure with no durable plan remains Settings-only; a failed user-started transaction may expose Retry only when its durable plan still exists. Render aggregate progress, verifying, retry, compatibility-blocked, and recovery states without disabling unrelated editor work. The running renderer continues using the old active roots while staging.
- Announce meaningful phase changes through an `aria-live` region, retain keyboard/focus behavior, and avoid rapid progress announcements.
- Automatically check after editor readiness; throttle in the main process, not local DOM state.
- Update import/export requirements to record actual immutable pack versions. Import accepts exact available versions or a documented compatible range, offers installed-only/current catalog downloads as required by the file, and does not silently upgrade unrelated packs.

Checkpoint: Electron tests drive service fixtures through real IPC and assert user-visible state instead of directly changing button DOM.

### 12. Finish documentation, measurements, and rollout gates

Files:

- `README.md`
- `docs/desktop-development.md`
- `docs/desktop-release.md`
- tests and workflows named above

Actions:

- Document local app-only checks, focused pack commands, ownership updates, version bumps, dry-run release steps, compatibility-pin updates, recovery directories, and how to interpret the aggregate required check.
- Add the post-change ten-run measurement table and decision checkpoint for retaining the monorepo. Record data rather than anecdotal speed claims.
- Document schema-2/3 transition and the rule that a bad immutable pack/app release is superseded, never overwritten.
- Before merge, run a non-publishing app-release rehearsal and a non-publishing selected-pack rehearsal. No production settings or releases are changed by feature implementation.

Checkpoint: docs allow a maintainer to add an asset, definition, shared metadata rule, app compatibility pin, and selective pack release without reverse-engineering scripts.

## Compatibility, migration, and rollback details

### Existing installations

- Read `active.json` schema 1, cached catalog schema 2, and PR #7's `.set-conjurer-pack.json` health identity. Before writing schema 2, copy the old pointer to a transaction-specific backup and validate every referenced root/health record.
- Treat current `1.0.0` installs as legacy image-only versions compatible with the current app descriptor. Do not force a redownload merely to migrate bookkeeping.
- Retain `cornerCutout.png`, `maskRightHalf.png`, `maskMiddleThird.png`, and `serial.png` as base-app compatibility assets while legacy schema-2 packs are supported. A post-PR-#7 app must render an existing healthy old Standard generation before and after installed-state migration.
- The first schema-3 update for a legacy pack stages full declarative metadata plus assets and switches only on restart.
- Keep the old catalog asset name/path usable for old apps. New clients prefer `frame-pack-catalog-v3.json`; a malformed/new catalog never destroys the cached last-known-good catalog.
- Existing exported files that say pack version `1.0.0` remain importable. New exports record actual active versions. Unsupported future schemas fail closed with a useful message.
- Update transaction creation is unavailable until PR #7's onboarding gate and any snapshot-first beta-card repair have completed. The update snapshot is taken afterward and cannot overwrite, rotate, or restore across the independent repair snapshot.

### Compatibility policy

- Pack versions declare pack schema, renderer API, minimum app version, dependencies, and optional revocation. Avoid a maximum app version unless evidence shows an actual incompatibility; renderer API ranges are the stable contract.
- Application compatibility pins declare supported schema/API ranges and exact known-good catalog/checksum. Required packs must have a compatible version in that catalog.
- Update resolution is deterministic and logged: target app first, then installed pack candidates, then dependency closure. A candidate is never selected merely because its semantic version is highest.
- If an installed pack blocks an app update, show the blocker and do not download the app until a compatible pack version exists. Never uninstall or hide the pack automatically.

### Failure and recovery

- Metadata failure: keep last-known-good state, show retry, no active mutation.
- Background metadata failure with no actionable plan stays in Settings and does not surface a misleading toolbar Retry action; transaction failure after explicit **Update Now** may offer Retry for that persisted plan.
- Download/integrity failure: delete/quarantine only the invalid partial, retain verified items, no Restart.
- Disk-space failure: calculate declared archive plus expanded headroom before download and recheck while expanding; name the required space and cleanup options.
- App install canceled/failed: transaction remains staged, old active packs remain. Next launch offers retry/cancel.
- App updated but pack commit failed: restore old pointer/snapshot when compatible; otherwise open recovery UI before editor startup.
- Pack-only activation failed: restore the prior pointer and relaunch old pack set.
- Bad published pack: publish a new immutable successor/catalog marking the bad version revoked. Do not delete an active user version automatically; update/recovery policy handles it explicitly.
- Bad app release: publish a higher fixed version or direct manual rollback using retained release artifacts. Never replace assets under an existing tag.
- Workflow regression: retain manual all-pack and full-package dispatch paths so maintainers can validate while reverting classifier/sparse changes.

## Test strategy and exact non-production verification commands

### Automated commands

After implementation, run from the repository root with Node 24/npm 11:

```powershell
npm ci
npm run ci:classify -- --base <base-sha> --head <head-sha>
npm run packs:ownership -- --check
npm run packs:compile -- --check
npm run packs:validate -- --packs standard
npm run packs:release:dry-run -- --tag packs-v0.0.0-test --packs standard --catalog tests/fixtures/packs/catalog-v3.json
npm run typecheck
npm run lint
npm test
npm run build:desktop
npm run test:electron
npm run package
npm run package:verify
```

On a disposable/fresh Windows x64 runner only, also run the PR #7 installation lifecycle gate against the locally built unsigned test artifact:

```powershell
npm run make -- --arch=x64
./scripts/test-windows-installer.ps1 -Installer <absolute-path-to-Set-Conjurer-Windows-x64-Setup.exe>
```

Run the classifier repeatedly with checked-in fixtures for all routes; do not use a production tag or publish flag. On macOS arm64/x64 and Windows x64, run the repository-supported package command and updater fixture suite. GitHub workflow rehearsals must use non-publishing inputs. Preserve the post-PR-#7 behavior that `npm test` builds `dist` before archive tests import compiled services.

### Required functional matrix

- Change routing: app-only; packaging-sensitive; one definition; one image; one set symbol; shared asset; shared registry/search key; version helper; mixed app/pack; rename; delete; unknown path; shallow-history/base-fetch failure.
- Pack build: each of seven logical packs; PR #7 ownership-output migration; one archive owner versus multiple logical consumers; exact four-file base-runtime allowlist; 256 MiB source partition/512 MiB client ceiling; multi-part archive; empty selected pack rejection; shared asset union; dynamic prefix; exact-case mismatch; orphan changed asset; missing asset; duplicate; corrupt/truncated PNG/JPEG/WebP/GIF/SVG; unsafe SVG; unexpected executable; manifest/hash/size mismatch.
- Install/update: first install; onboarding required-success/optional-failure retention; manual install; repair; legacy schema-1 plus PR #7 health-manifest migration; old Standard rendering with base-runtime assets; consolidated installed-pack update; required and optional installed pack; uninstalled optional exclusion; multiple packs; dependency closure; Range resume/retry/verified reuse; offline cached catalog; corrupt archive; traversal; symlink; duplicate; decompression limit; insufficient disk; interrupted process.
- App update: stable and beta discovery; current/no update; missing platform asset; invalid feed/checksum/signature metadata; download disabled until click; staged install; canceled installer; version unchanged on relaunch; successful new-version launch.
- Combined transaction: app only, pack only, app plus one pack, app plus multiple packs, one item fails, target compatibility changes before begin, installed pack blocks app, crash at every journal transition, successful commit, pointer failure, migration failure, snapshot restore.
- UI: idle hidden control and `[hidden]` computed style; background checking; up-to-date/offline/metadata failure in Settings only; app-only available; pack-only available; combined available; no immediate individual installed-pack Update activation; aggregate determinate download; verifying; Restart; durable-transaction Retry; compatibility block; recovery required; Settings details; keyboard/focus; screen-reader announcements; editor remains usable while staging.
- Release: selected pack dry run, all-pack dry run, unchanged pack history preserved, immutable tag mismatch, old catalog fallback, app release pin success/failure, sparse app checkout exact allowlist, legacy base-runtime package inventory, macOS signing/notarization checks, Windows signed/unsigned-preview checks, Squirrel special events/AUMID, packaged Electron smoke, fresh Setup install, shortcuts/stable stub/Installed Apps registration, and uninstall.

### Verification surface rationale

Node tests are strongest for ownership, schemas, classifier diffs, compatibility resolution, catalogs, hashing, PR #7's stream/resume/extraction adapter, journals, and crash recovery. The Electron Playwright harness is necessary for real IPC, main-process lifecycle, protocol/base-runtime resolution, background checks, progress, restart handoff seams, accessibility, and proving the renderer continues using old packs while staging. The sparse packaged smoke must use a minimal pack fixture rather than the multi-gigabyte source tree. GitHub Actions dry runs are necessary to prove partial/sparse checkout and conditional job wiring; local tests alone cannot reproduce checkout transfer or hosted-runner expressions. Real macOS package rehearsals and PR #7's fresh-runner Windows installer lifecycle test are required for updater/signing/OS integration, but no production publish is needed.

## Verification and PR evidence plan

Full coverage is the matrix above. Keep reviewer visuals small and render them inline in the implementation PR:

1. **`combined-update-available` — desktop 1665×1040:** editor toolbar with one **Update Now** action and Settings detail listing one app target plus two representative installed pack targets. Purpose: prove consolidation and installed-only disclosure.
2. **`combined-update-progress` — desktop 1665×1040:** determinate aggregate progress with the editor still usable and Settings showing per-item phases. Purpose: prove non-disruptive background staging and honest progress.
3. **`update-ready-restart` — desktop 1665×1040:** same action changed to **Restart**, with staged app/pack versions summarized. Purpose: prove the explicit activation boundary.
4. **`update-recovery` — desktop minimum 980×680 only if recovery UI is materially separate:** activation failure with old version restored and retry guidance. Purpose: make the highest-risk failure path reviewable.

The PR must state that app-only, pack-only, uninstalled optional exclusion, all error/compatibility states, keyboard/accessibility, macOS/Windows adapters, and crash-recovery transitions were exercised even when not pictured. Do not include redundant screenshots for each pack or progress percentage. Verify every selected image renders inline.

## Documentation, PR handoff, and release follow-up

- Implementation PR description must lead with post-PR-#7 before/after CI timing, list changed routing rules, name selected/full validation evidence, and state that no release was published.
- Include the exact catalog/manifest schema changes and migration compatibility notes for existing beta clients.
- Call out any new package dependency and its effect on app-only `npm ci`; avoid heavyweight image dependencies unless measurements justify them.
- Attach or link non-publishing workflow run results for app release, one selected pack, and all-pack foundational validation.
- After merge, observe at least ten ordinary app PRs and the first three pack releases. Re-open the separate-repository decision if app jobs materialize pack blobs, checkout misses the 80% target, selective pack release remains dominated by Git history transfer, or ownership exceptions grow instead of shrink.
- Production pack/app tags, release publication, branch protection changes, Azure/Apple/GitHub environment changes, and user rollout require their normal separate authorization.

## Approval checkpoint

This pre-merge amended plan is not yet executable. The exact post-merge/pre-implementation checkpoint is:

1. PR #7 is merged; its final merged SHA is recorded; and Windows/Desktop CI on that final SHA is passing.
2. This existing `perf/decouple-app-and-pack-delivery` branch/worktree is rebased/refreshed onto that merged `origin/master` without implementation changes.
3. The plan is revalidated against the final diff, updated if necessary, and committed with the actual new base metadata and post-PR-#7 baseline procedure.
4. Joseph and the voice coordinator explicitly approve that refreshed committed plan.

Only then should the next instruction invoke `standardized-feature` in this same branch and worktree. Approval authorizes plan execution only; it does not authorize deployment, release publication, production-setting changes, or a pull request beyond the later feature workflow's explicit scope.
