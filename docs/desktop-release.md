# Set Conjurer release runbook

## Preview the macOS installer

Run `npm run preview:mac-installer` with the repository-supported Node 24 or 25 runtime on a Mac to build the same branded DMG used by the release workflow, mount it, and open its Finder window. The preview uses the current machine architecture by default; pass `--arch=x64` or `--arch=arm64` to inspect a specific build. This command creates local output only and does not sign, notarize, upload, or publish anything.

## Release gates

Public release is intentionally manual. Before publishing:

1. Confirm the inherited GNU GPL v3.0 license and contributor credits remain present in the packaged release.
2. Configure Apple Developer ID Application credentials and App Store Connect API notarization credentials.
3. Keep Azure Artifact Signing configured with the repository's OIDC identity, Public Trust certificate profile, and profile-scoped signer role. Public releases must use the fail-closed `required` signing mode; unsigned artifacts are preview-only.
4. Publish an immutable `packs-vX.Y.Z` asset-pack release containing all catalog entries before publishing the application that consumes it. Archives target 256 MiB source parts, every payload file has one owner, and the catalog records measured compressed and installed sizes.
5. Validate macOS arm64, best-effort macOS x64, and Windows x64 artifacts on real systems.

## GitHub secrets

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_SIGN_IDENTITY`
- `APPLE_API_KEY_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## GitHub release environment

The Windows job uses the `release` environment so its Azure federated identity can be restricted to the subject `repo:lawlordev/cardconjurer:environment:release`. The environment's deployment policy permits only the repository's default `master` branch. Configure these non-secret environment variables there:

- `AZURE_ARTIFACT_SIGNING_ENDPOINT`
- `AZURE_ARTIFACT_SIGNING_ACCOUNT`
- `AZURE_ARTIFACT_SIGNING_PROFILE`

In Azure, give the federated application only the Artifact Signing Certificate Profile Signer role on the certificate profile used by this repository. The workflow uses GitHub OIDC, so there is no Azure client secret or exportable Windows certificate in GitHub.

`required` is the fail-closed production option and the workflow default. `auto` remains available for a non-publishing rehearsal that signs when the profile is configured, while `disabled` deliberately produces an unsigned preview. The publish preflight rejects any mode except `required`. If signing fails or configuration is removed, supersede the candidate with a new immutable beta or stable tag instead of publishing or replacing an unsigned release.

The release workflow never runs on a branch push. Create and push a reviewed `vX.Y.Z` or `vX.Y.Z-beta.N` tag that exactly matches `package.json`, then dispatch **Release Set Conjurer** from `master` with that existing tag and channel. Leave **Publish** off for a signing-validation run; turn it on to attach the exact build outputs to a GitHub Release. The workflow builds separate macOS arm64/x64 and Windows x64 artifacts, signs and notarizes macOS apps and final DMGs, creates checksums, and uploads release assets. When Azure signing is active, the Windows job signs the packaged app binaries and Squirrel updater before creating the NuGet package, then signs and verifies the final installer.

The production Azure lane requires all of the following:

1. Maintain the Public Trust certificate profile.
2. Keep the Entra application assigned the Artifact Signing Certificate Profile Signer role scoped to that profile.
3. Keep `AZURE_ARTIFACT_SIGNING_ENDPOINT`, `AZURE_ARTIFACT_SIGNING_ACCOUNT`, and `AZURE_ARTIFACT_SIGNING_PROFILE` in the GitHub `release` environment.
4. Bump the application version, merge it, create the matching tag, and run with `windows_signing: required`.

Content packs use the separate **Release Content Packs** workflow and `packs-vX.Y.Z` namespace. This includes frame packs, Set Symbols, and the required Keywords catalog. They are prereleases and never become the repository's latest application release. Pack archives are immutable; new versions receive new URLs and SHA-256 values. The legacy `frame-packs.json` and `frame-pack-catalog-v3.json` asset names remain unchanged for compatibility.

The pack workflow defaults to a non-publishing rehearsal. Supply a version and either a comma-separated pack selection or `all`; selected releases materialize and validate only the chosen logical packs plus shared ownership metadata. Publishing compares against the prior catalog, refuses to replace an existing immutable asset, and emits schema-v3 catalog data with per-file integrity metadata. Use a full release when shared ownership inputs change.

Application releases use the same sparse application checkout as pull-request packaging. They do not compile, download, or rebuild content packs. `resources/pack-compatibility.json` records the catalog schemas and pack-version compatibility accepted by that app build; preflight validates it before any platform build starts. The nullable catalog pin is a migration-only state for the existing beta line. Set an immutable catalog version and SHA-256 before promoting a stable release. Publish a catalog containing Set Symbols, Keywords, and Standard before shipping an app version that requires all three.

Inspect `frame-pack-ownership.json` before promotion: renderer-global base assets must not be present, every payload file must have exactly one owner, and no compressed archive may exceed the desktop safety limit. Confirm `js/mseKeywordCatalog.js` is owned only by Keywords and `img/setSymbols/**` only by Set Symbols. Complete onboarding with all three required packs plus two optional packs and verify that the single aggregate bar is monotonic, reaches exactly 100 percent, and resumes after interrupting one archive.

## Updates

The app checks GitHub metadata after startup for the application and only the packs already installed. It never advertises uninstalled optional packs. If either kind of compatible update exists, one **Update Now** action stages all applicable items in the background. Pack archives remain inactive generations and the application installer remains unopened, so the running process is undisturbed. After every checksum, file digest, schema, and compatibility check succeeds, that action becomes **Restart** and activation occurs as one recorded transaction on restart.

First-time onboarding, repair, and explicit manual pack installation retain their partial-success behavior; the staged update transaction does not replace those flows. A failed update keeps the active app and pack generations, exposes retry details in Settings, and cleans incomplete staging. Startup recovery uses the transaction journal and pre-stage SQLite snapshot to finish or roll back interrupted activation. Windows launches the staged Setup only after pack activation is committed, then exits the old process without relaunching into Squirrel's installation lock. Stable is the default; beta is explicit opt-in.

Before release, install the Windows Setup and run the installed-artifact check. Also validate an N-1 upgrade using a disposable user profile and confirm that workspace data, active pack generations, Start-menu/Desktop shortcuts, Installed Apps registration, and the running version survive the upgrade. A damaged beta workspace must create a `repair-beta-card-layouts` snapshot before targeted card repair.

For beta.4 and later, copy a beta.3 profile with multiple large uploaded artworks into a disposable profile before upgrade testing. Confirm that the first launch migrates to normalized workspace tables, all artwork resolves through `set-conjurer://user-asset`, edit/undo/restart succeeds, and portable card/set exports contain usable embedded artwork. Also open the deterministic 1,000-card fixture and exercise selection near the start, middle, and end of the list. Rollback must preserve the legacy `app_state` recovery document and original content-addressed asset files; do not garbage-collect user assets during this release line.

No workflow releases automatically, and no website or S3 bucket is touched.
