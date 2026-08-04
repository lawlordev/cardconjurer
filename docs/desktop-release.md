# Set Conjurer release runbook

## Release gates

Public release is intentionally manual. Before publishing:

1. Confirm the inherited GNU GPL v3.0 license and contributor credits remain present in the packaged release.
2. Configure Apple Developer ID Application credentials and App Store Connect API notarization credentials.
3. Configure Azure Artifact Signing when public-trust identity validation is available. Until then, Windows artifacts are explicitly labeled unsigned previews.
4. Publish an immutable `packs-vX.Y.Z` asset-pack release containing at least Set Symbols and Standard.
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

`AZURE_ARTIFACT_SIGNING_PROFILE` may remain unset while Microsoft's identity validation is pending. With Windows signing set to `auto`, the workflow still builds and verifies a Windows x64 preview, publishes `WINDOWS-SIGNING.txt`, and states clearly in the release notes that SmartScreen warnings are expected. `required` is the fail-closed production option; `disabled` deliberately produces an unsigned preview even when a profile exists. Once the profile and scoped signer role are configured, `auto` signs automatically. Publish the signed build under a new immutable beta or stable tag instead of silently replacing an unsigned release.

The release workflow never runs on a branch push. Create and push a reviewed `vX.Y.Z` or `vX.Y.Z-beta.N` tag that exactly matches `package.json`, then dispatch **Release Set Conjurer** from `master` with that existing tag and channel. Leave **Publish** off for a signing-validation run; turn it on to attach the exact build outputs to a GitHub Release. The workflow builds separate macOS arm64/x64 and Windows x64 artifacts, signs and notarizes macOS apps and final DMGs, creates checksums, and uploads release assets. When Azure signing is active, the Windows job signs the packaged app binaries and Squirrel updater before creating the NuGet package, then signs and verifies the final installer.

For the current unsigned Windows preview lane, use `windows_signing: auto`. After Azure identity validation completes:

1. Create the Public Trust certificate profile.
2. Assign the Entra application the Artifact Signing Certificate Profile Signer role scoped to that profile.
3. Set `AZURE_ARTIFACT_SIGNING_PROFILE` in the GitHub `release` environment.
4. Bump the application prerelease version, merge it, create the matching tag, and run with `windows_signing: required`.

Frame packs use the separate **Release Frame Packs** workflow and `packs-vX.Y.Z` namespace. They are prereleases and never become the repository's latest application release. Pack archives are immutable; new versions receive new URLs and SHA-256 values.

## Updates

The app checks GitHub metadata but downloads nothing until **Update Now**. It creates a SQLite snapshot immediately before staging, verifies the published checksum, shows determinate circular progress, and changes the same control to **Restart** when ready. Stable is the default; beta is explicit opt-in.

No workflow releases automatically, and no website or S3 bucket is touched.
