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

`npm run dev` opens the Electron app against the checked-out project and automatically reloads after changes to HTML, CSS, renderer JavaScript, frame definitions, or frame images. Changes under `desktop/` affect the privileged Electron main process, so stop and rerun `npm run dev` after those edits. Browser development at `localhost:8081` still works through `npm run start:browser` and retains IndexedDB as its fallback; Electron routes the same state contract to its SQLite worker.

The Electron renderer has no Node access. It runs sandboxed with context isolation, uses `set-conjurer://` for application assets, and receives a narrow frozen preload API. Privileged handlers validate both their caller and payload. Component frame definitions are generated into `generated/frame-definitions`; downloaded packs contain assets and declarative metadata, never JavaScript.

## Local package

`npm run package` creates a base app without the multi-gigabyte frame library or set-symbol library. `npm run make:local` creates a local-only developer installer whose seven asset-pack seeds point back to this checkout. Set Symbols and Standard are required; the other five packs are optional. That developer build is useful on the same machine but is not distributable. Public artifacts obtain packs from immutable GitHub pack releases.

Local macOS output uses ad-hoc signing when `APPLE_SIGN_IDENTITY` is absent. It proves bundle integrity but is not Developer ID trust or notarization.
