#!/bin/bash
set -euo pipefail
KEYCHAIN_PATH="$RUNNER_TEMP/set-conjurer-signing.keychain-db"
CERTIFICATE_PATH="$RUNNER_TEMP/set-conjurer-signing.p12"
printf '%s' "$CERTIFICATE_P12_BASE64" | base64 --decode > "$CERTIFICATE_PATH"
security create-keychain -p "$CERTIFICATE_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$CERTIFICATE_PASSWORD" "$KEYCHAIN_PATH"
security import "$CERTIFICATE_PATH" -P "$CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security list-keychain -d user -s "$KEYCHAIN_PATH" login.keychain-db
security set-key-partition-list -S apple-tool:,apple: -s -k "$CERTIFICATE_PASSWORD" "$KEYCHAIN_PATH"
