# Set Conjurer desktop development

## Requirements

- Node.js 24.x LTS
- npm 11 or newer
- macOS for DMG generation; Windows for Squirrel Setup generation

## Run and verify

```sh
npm ci
npm run packs:compile
npm run typecheck
npm run lint
npm test
npm run build:desktop
npm run test:electron
npm run dev
```

Pull requests begin with a blobless, non-cone sparse checkout and classify the changed files through `packs/config.json`. Application jobs materialize only source plus the four renderer-global frame assets; set-symbol and frame-pack payloads remain absent. Pack-owned changes run metadata validation for the affected logical packs, while physical image validation materializes only those packs. Shared ownership inputs deliberately expand validation to every pack. `npm run ci:classify -- --base <sha> --head <sha>` prints the same routing decision locally, and `npm run ci:checkout-report -- --expect-sparse` enforces the application checkout boundary.

The Windows package job runs independently from the ordinary verification matrix after classification, so checkout and packaging no longer wait for unrelated app tests. It still executes the packaged Electron smoke test and a fresh Squirrel install/uninstall test. The latter resolves Squirrel's stable root executable stub (`%LOCALAPPDATA%\set_conjurer\set-conjurer.exe`), rather than assuming an implementation-specific `current` directory.

`npm run dev` opens the Electron app against the checked-out project and automatically reloads after changes to HTML, CSS, renderer JavaScript, frame definitions, or frame images. Changes under `desktop/` affect the privileged Electron main process, so stop and rerun `npm run dev` after those edits. Browser development at `localhost:8081` still works through `npm run start:browser` and retains IndexedDB as its fallback; Electron routes the same state contract to its SQLite worker.

The Electron renderer has no Node access. It runs sandboxed with context isolation, uses `set-conjurer://` for application assets, and receives a narrow frozen preload API. Privileged handlers validate both their caller and payload. Component frame definitions are generated into `generated/frame-definitions`; downloaded packs contain assets and declarative metadata, never JavaScript.

## Local package

`npm run package` creates a base app without the multi-gigabyte frame library or set-symbol library. `npm run make:local` creates a local-only developer installer whose seven asset-pack seeds point back to this checkout. Set Symbols and Standard are required; the other five packs are optional. That developer build is useful on the same machine but is not distributable. Public artifacts obtain packs from immutable GitHub pack releases.

The pack service downloads each archive into a resumable `.partial` file and extracts ZIP entries as streams. Tests must not reintroduce whole-archive `Buffer.concat`/JSZip extraction. `npm test` compiles the desktop service and exercises a local Range-capable HTTP fixture, checksum verification, monotonic aggregate progress, streamed extraction, and unsafe archive rejection.

Electron smoke tests set `SET_CONJURER_TEST_PACK_ROOT` to a generated minimal fixture containing the required base assets. This keeps ordinary CI independent from the multi-gigabyte pack payload while exercising the same protocol and preload boundaries as a packaged application.

On Windows, `npm run make -- --arch=x64` produces the Squirrel Setup. The CI integration script installs that Setup into the disposable runner profile, then verifies the stable executable stub, Start-menu and desktop shortcuts, Installed Apps registration, and uninstall. Run the same check from PowerShell with:

```powershell
./scripts/test-windows-installer.ps1 -Installer ./out/make/squirrel.windows/x64/Set-Conjurer-Windows-x64-Setup.exe
```

This is an installed-artifact test and modifies the current Windows user profile; use a test account or disposable machine for local runs.

Local macOS output uses ad-hoc signing when `APPLE_SIGN_IDENTITY` is absent. It proves bundle integrity but is not Developer ID trust or notarization.
