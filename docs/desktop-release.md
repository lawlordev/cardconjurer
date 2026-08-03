# Set Conjurer release runbook

## Release gates

Public release is intentionally manual. Before publishing:

1. Add a root open-source license chosen by the maintainer.
2. Configure Apple Developer ID Application credentials and App Store Connect API notarization credentials.
3. Configure a trusted Windows code-signing certificate.
4. Publish an immutable `packs-vX.Y.Z` frame-pack release containing at least Standard.
5. Validate macOS arm64, best-effort macOS x64, and Windows x64 artifacts on real systems.

## GitHub secrets

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_SIGN_IDENTITY`
- `APPLE_API_KEY_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `WINDOWS_CERTIFICATE_PFX_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

The release workflow never runs on a branch push. Create and push a reviewed `vX.Y.Z` or `vX.Y.Z-beta.N` tag, then dispatch **Release Set Conjurer** with that existing tag and channel. The workflow builds separate macOS arm64/x64 and Windows x64 artifacts, signs them, notarizes macOS, creates checksums, and attaches them to a GitHub Release.

Frame packs use the separate **Release Frame Packs** workflow and `packs-vX.Y.Z` namespace. They are prereleases and never become the repository's latest application release. Pack archives are immutable; new versions receive new URLs and SHA-256 values.

## Updates

The app checks GitHub metadata but downloads nothing until **Update Now**. It creates a SQLite snapshot immediately before staging, verifies the published checksum, shows determinate circular progress, and changes the same control to **Restart** when ready. Stable is the default; beta is explicit opt-in.

No workflow releases automatically, and no website or S3 bucket is touched.
