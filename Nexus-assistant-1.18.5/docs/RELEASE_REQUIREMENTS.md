# Release Requirements — Nexus Assistant

This document defines the requirements for a proper Nexus release. It is the single source of truth for CI and release workflows.

## Toolchain Versions (pinned)

| Tool | Version | Source |
|------|---------|--------|
| Node | 22.21.0 | `.nvmrc`, `package.json` engines, all workflows |
| Yarn | 1.22.22 | `packageManager` in package.json |
| JDK | 17 (Temurin/Zulu) | `setup-java` in workflows |
| Ruby | 3.2.3 | `Gemfile`, `ruby/setup-ruby` |
| Xcode | 16+ (macos-14 runner) | CI + release.yml |
| Android | SDK 34/35, NDK pinned in `android/build.gradle` | `android/gradle.properties` |
| CocoaPods | >=1.13, !=1.15.0, !=1.15.1 | `Gemfile` |

## Secrets & Variables Required for Full Release

### Android Release (APK + AAB) — `release.yml`
**Trigger:** tag `v*` or manual dispatch. Produces signed APK + AAB to GitHub Release.
The release is always keyed off the version in `.version` (tag `vX.Y.Z`), so a
manual dispatch from any branch updates the same release as a tag push.

| Secret / Var | Type | Required | Purpose |
|--------------|------|----------|---------|
| `ANDROID_KEYSTORE_BASE64` | Secret | Recommended | Base64 of `nexus-release-key.keystore` (alias `nexus_key_alias`). Without it, debug-signed APK is published. |
| `ANDROID_STORE_PASSWORD` | Secret | Recommended | Keystore password |
| `ANDROID_KEY_PASSWORD` | Secret | Recommended | Key password |
| `GOOGLE_SERVICES_JSON` | Secret | Optional | Real Firebase config; dummy is used otherwise |
| `FIREBASE_FUNCTIONS_URL` | Var | Optional | Firebase Functions URL |
| `SUPABASE_URL` | Var | Optional | Supabase URL |
| `SUPABASE_ANON_KEY` | Secret | Optional | Supabase anon key |
| `PALSHUB_API_BASE_URL` | Var | Optional | PalsHub API |
| `GOOGLE_IOS_CLIENT_ID` | Var | Optional | Google Sign-In iOS |
| `GOOGLE_WEB_CLIENT_ID` | Var | Optional | Google Sign-In Web |

### iOS Release (IPA) — `release/ios-release.yml`
**Trigger:** tag `v*` or manual dispatch (macos-15 runner) once the file is
moved to `.github/workflows/ios-release.yml`. Builds the IPA
(`xcodebuild archive` with unsigned fallback) and attaches
`Nexus-vX.Y.Z.ipa` to the same GitHub Release as the Android artifacts.

Signing secrets (all required for a signed IPA; any missing → unsigned
fallback IPA with warning, release still published):

| Secret | Purpose |
|--------|---------|
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | .p8 key content |
| `APP_STORE_CONNECT_USER_ID` | User ID |
| `MATCH_GIT_URL` | fastlane match repo URL |
| `MATCH_GITHUB_TOKEN` | token for match repo |
| `MATCH_PASSWORD` | fastlane match password |

Optional:

| Secret | Purpose |
|--------|---------|
| `GOOGLE_SERVICES_PLIST` | iOS GoogleService-Info.plist (dummy used otherwise) |

A signed build uses the `build_for_device_farm` lane in `ios/fastlane/Fastfile`
(development export via match-managed profiles). If the signed build fails,
the workflow falls back to the unsigned IPA so a bad credential set can never
block the release.

### Model Release — `model-release.yml`
**Trigger:** manual dispatch. Publishes GGUF from `models/` to GitHub Release.

- Requires model files in `models/*.gguf` (or `.litertlm`, `.task`)
- Enforces 2 GiB per-file limit (GitHub Release asset cap)

### CI Pipeline — `ci.yml`
**Trigger:** push/PR to `master`

Jobs:
1. **detect-changes** — skips heavy builds if only `src/locales/` changed
2. **build-and-test**
   - `yarn install --frozen-lockfile`
   - `node scripts/validate-l10n.js` — 1241 keys, placeholder consistency
   - `node scripts/verify-fonts.js` — 13 font families, Fraunces subset coverage
   - `yarn lint` (ESLint + Prettier)
   - `yarn typecheck` (tsc --noEmit)
   - `yarn test --coverage` (Jest, 60% threshold)
3. **build-android** (from-source)
   - Hexagon SDK provisioning with SHA256 verification (`setup-hexagon-sdk` action)
   - ccache with `compiler_check=content` and `time_macros,include_file_mtime,include_file_ctime` sloppiness
   - Dummy `google-services.json` with `com.nexusai.nexus` + `com.nexusai.nexus.e2e`
   - Dummy `.env` with `nexus://app`
   - Dummy keystore `nexus-release-key.keystore` alias `nexus_key_alias`
   - `./gradlew assembleProdRelease` with variant allowlist check
   - `verify-android-payload.js` — checks native libs per `android-payload-manifest.json`
   - DCE check — prod bundle must not contain `AUTOMATION_BRIDGE` etc.
4. **build-ios** (macos-14)
   - Dummy `Env.xcconfig` + `GoogleService-Info.plist` (bundle ID `com.nexusai.nexus`)
   - `pod install`
   - `xcodebuild -sdk iphonesimulator` Release, no signing

### E2E Android Build — `e2e-tests.yml`
Manual dispatch, builds `assembleE2eReleaseE2e` with payload verification, uploads APK artifact.

### L10n Upload — `l10n-upload.yml`
Push to `master` touching `src/locales/en.json` → uploads to Weblate via `sync-weblate.js`. Requires `WEBLATE_TOKEN`.

## Versioning Contract

- `package.json` version — source of truth
- `.version` file — mirrors package.json
- `android/app/build.gradle` — `versionCode` (incrementing integer) + `versionName` (semver)
- `ios/PocketPal.xcodeproj/project.pbxproj` — `MARKETING_VERSION` (semver) + `CURRENT_PROJECT_VERSION` (incrementing integer)

Bump via: `bundle exec fastlane bump_version version_type:patch` (or major/minor/etc). The lane updates all 4 locations atomically.

Current: **1.18.1** / versionCode 6 / build 6

## Release Flow (recommended)

1. Ensure `master` is green (CI passes)
2. Bump the version locally: `bundle exec fastlane bump_version version_type:patch`
   (updates package.json, .version, Android versionCode/Name and iOS
   MARKETING_VERSION/build number atomically), then commit and push
3. Push tag `vX.Y.Z` → triggers **Android Release (APK + AAB)** (`release.yml`)
   and, once activated, **iOS Release (IPA)** (`ios-release.yml`); both attach
   their artifacts to the same GitHub Release (idempotent — a rerun updates
   the release)
4. For models: add `.gguf` to `models/` → run **Model Release** → versioned model pack release

For a hotfix without a version bump: run **Android Release (APK + AAB)** and/or
**iOS Release (IPA)** manually from the Actions tab (they key off `.version`),
or push the existing tag again.

## Local Verification (without full Android build)

```bash
node scripts/validate-l10n.js
node scripts/verify-fonts.js
yarn lint
yarn typecheck
yarn test --coverage
```

YAML syntax:
```bash
python3 -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"
```

## Why These Requirements Matter

- **Hexagon SDK digest pinning** — third-party SDK, mutable tag, compiled into shipped `.so`; verified by SHA256 of tarball + consumed subset
- **Payload manifest** — single declaration for variant allowlist + required libs/assets/symbols; enforced in CI and release
- **DCE check** — ensures `__E2E__` automation bridge is stripped from prod bundle via `babel-plugin-transform-define`
- **Dummy secrets** — CI builds without real Firebase/Supabase secrets; real secrets injected via repo vars/secrets in release workflows
- **Flavor pinning** — `prod` vs `e2e` flavors; bare `assembleRelease` doesn't exist, must pin `prod` to avoid building unintended variants
- **Node 22.21.0** — matches `engines` and `.nvmrc`; required for React 19.1.1 + RN 0.82.1

## Troubleshooting CI Failures

| Failure | Cause | Fix |
|---------|-------|-----|
| `Building rnllama variants: ...` mismatch | `ORG_GRADLE_PROJECT_rnllamaVariants` didn't reach subproject or upstream reworded log line | Check env propagation, update literal in workflow |
| Payload gate fails missing lib | Hexagon SDK not provisioned or NDK mismatch | Ensure `setup-hexagon-sdk` action ran, check manifest |
| DCE check fails | Automation marker in prod bundle | Ensure `__E2E__` is replaced by babel, check `babel.config.js` |
| iOS build fails | Missing dummy plist/xcconfig or CocoaPods | Check `ios/Config/Env.xcconfig` creation, `pod install` |
| Android signing fails | Empty password treated as set | Unset empty env vars so Groovy falsy check works (handled in workflow) |

## Security Notes

- Never commit real `google-services.json`, `GoogleService-Info.plist`, or keystore
- Use repo **Secrets and variables → Actions** for all secrets
- `ANDROID_KEYSTORE_BASE64` created via `base64 -w0 nexus-release-key.keystore`
- Play Store JSON key written to `android/play-store-key.json` only during release job, not cached
