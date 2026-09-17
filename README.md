<div align="center">
<img src="src/assets/pocketpal-dark-v2.png" alt="Nexus logo" width="120" />

# Nexus

**A private AI assistant that runs entirely on your phone. Chat with language models fully on-device — no server, no account, no data leaving the device.**

iOS + Android · Built on the MIT-licensed [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai) (React Native + llama.cpp via `llama.rn`)
</div>

---

## What This Is

This repository is a **white-labeled fork** of PocketPal AI. Store-facing identity, visual branding, and default assistant behavior have been replaced; all inference internals are upstream. Current identity:

| Property | Value |
|---|---|
| App display name | `Nexus` |
| Android `applicationId` (Play Store ID) | `com.nexusai.nexus` |
| iOS bundle ID | `com.nexusai.nexus` |
| Deep-link scheme | `nexus://` |
| Version | `1.0.0` (build 1) |

> **Before releasing:** search-and-replace the placeholder brand — `Nexus`, `nexus-app`, `com.nexusai.nexus`, `nexus://` — with your real brand. All identity tokens are centralized (see table in *Identity Map* below).

## Quick Start (Debug Builds)

Prerequisites: Node 18+, JDK 17, Android Studio (SDK 34/35), Xcode 15+, CocoaPods.

```bash
yarn install                 # JS dependencies (updates yarn.lock root entry)
cd ios && pod install && cd ..

yarn android                 # run on Android device/emulator
yarn ios                     # run on iOS device (Metal) / simulator (CPU-only)
```

First launch: open **Models** tab → search Hugging Face (`your-org/your-model`) → download a GGUF (start with a 0.5–1.5B `Q4_K_M`) → chat.

## Release Builds

### Android

```bash
# 1) create YOUR release keystore (back it up — lost key = lost update channel)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/my-release-key.keystore \
  -alias nexus-app -keyalg RSA -keysize 2048 -validity 10000

# 2) wire it into android/app/build.gradle (replace the upstream
#    nexus-release-key.keystore signingConfigs.release block)

cd android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

`versionCode` / `versionName` live in `android/app/build.gradle`.

### iOS

```bash
cd ios && pod install
open PocketPal.xcworkspace    # target name kept as 'PocketPal' by design (build-internal)
```

1. Target → Signing & Capabilities → your team + bundle ID `com.nexusai.nexus`.
2. `Product → Archive` → Distribute App. Archive on a **real device** at least once (simulators never exercise Metal).

## Identity Map (what was rebranded vs. kept)

**Replaced (store-facing / user-visible):**
- `app.json` → `Nexus` · `package.json` → `nexus-app`
- `android/app/build.gradle` → `applicationId com.nexusai.nexus`, versions reset
- `android/app/src/main/res/values/strings.xml` → `app_name`
- `android/app/src/main/AndroidManifest.xml` → deep-link schemes → `nexus://`
- `ios/PocketPal/Info.plist` → `CFBundleDisplayName` / `CFBundleName` / URL scheme
- `ios/PocketPal.xcodeproj/project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER` (+ tests target), `MARKETING_VERSION 1.0.0`, `CURRENT_PROJECT_VERSION 1`
- `ios/PocketPal/PocketPal.entitlements` → keychain group re-scoped to new bundle ID
- All `pocketpal://` deep-link routes in JS/Kotlin/Swift (parser: `src/services/hubRunLink.ts`)
- Launcher icons: `mipmap-*` (5 densities + round) and `AppIcon.appiconset` (12 sizes)
- In-app/README logos: `src/assets/pocketpal-*.png` (filenames kept)
- Default chat-template system prompts (`src/utils/chat.ts`)
- Store metadata (`fastlane/metadata/`), CI workflow package refs

**Intentionally kept (build-internal, renaming them risks breaking compilation):**
- Kotlin namespace `com.pocketpal` + source dir `com/pocketpalai/` (matches upstream gradle `namespace`)
- RN New-Architecture codegen name `PocketPalSpecs` (`package.json → codegenConfig`)
- Xcode project/target name `PocketPal` (paths, scheme, entitlements filename)
- npm packages `@pocketpalai/llama.rn`, `@pocketpalai/react-native-speech` (published dependency names)

Users never see any of the above; changing them is optional hygiene (see the white-label guide §2.2 Step 4).

## Ship Your Own Model

- **Nexus catalog (built-in):** the Models tab recommends the **Nexus lineup** (Nexus 1.0 → 3.0) automatically matched to device RAM. Names/entries live in `src/store/bundledDeviceRules/rules.<platform>.json`; see **models/README.md** for the full table.
- **Release models on GitHub (automated):** drop `.gguf` files into `models/`, run **Actions → Model Release** → they publish as versioned GitHub Release assets (`models-vX.Y`). The workflow enforces the 2 GiB-per-asset limit.
- **Online rules override:** the app refreshes its catalog from `nexus-ai-official/nexus-device-rules` (via jsDelivr). Fork the upstream rules repo, rename entries, push — until then the bundled Nexus catalog is used (fetch failures fall back gracefully).
- **Pre-bundle a model:** iOS — add `.gguf` to the Xcode target and copy from `RNFS.MainBundlePath` at first run. Android — `android/app/src/main/assets/models/` + `RNFS.copyFileAssets(...)`. Mind Google Play's ~200 MB base-module limit.
- **Sizing:** 4 GB devices → ≤1 GB `Q4_K_M`, `n_ctx: 2048`; 8 GB → 3–4B; 12 GB+ → 7–8B. Defaults live in `src/store/ModelStore.ts`.

## Automated Releases (GitHub Actions)

| Workflow | Trigger | Produces |
|---|---|---|
| `Android Release` | push tag `v*` or manual run | Signed **APK + AAB** attached to a GitHub Release |
| `Model Release` | manual run (version input) | **Model pack** attached to a GitHub Release |
| `release.yml` (upstream) | tag | Play Store lane via fastlane (needs service-account secret) |

**APK release flow:** push a tag → Actions builds → Release page gets `Nexus-vX.Y.Z.apk`:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Signing secrets (optional — builds fall back to debug signing without them):
`ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.

## Upstream Sync

```bash
git remote add upstream https://github.com/a-ghorbani/pocketpal-ai.git
git fetch upstream && git cherry-pick <commit>   # pull upstream bug fixes selectively
```

## License

Upstream code is MIT (see `LICENSE`) — keep the notice. **Model licenses are separate**: verify your GGUF's license (Gemma, Llama, Qwen families each have their own terms) before distribution.
