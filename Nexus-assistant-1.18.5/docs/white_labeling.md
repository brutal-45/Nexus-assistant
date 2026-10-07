# White-Labeling Guide: Nexus (Mobile On-Device AI, iOS & Android)

Step-by-step guide to fork, rebrand, and customize this open-source local-LLM
app into your own standalone assistant with a custom GGUF model.

This repo **is** the finished example: a white-labeled fork of the
MIT-licensed [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai).
Every path below is real and verified against the current tree.

---

## 1. Codebase & Architecture

### 1.1 Recommended base codebases

| Codebase | Stack | Inference binding | Notes |
|---|---|---|---|
| **This repo (Nexus / PocketPal AI fork)** | React Native 0.82 + TypeScript | `llama.rn` (llama.cpp) | The most battle-tested local-LLM wrapper; chat UI, model manager, benchmarks, TTS, vision-capable models |
| [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai) (upstream) | React Native | `llama.rn` | Sync source for bug fixes |
| [LLMFarm](https://github.com/guinmoon/LLMFarm) | Flutter/Dart | llama.cpp (via `llama.cpp` Go bindings) | Alternative if you prefer Flutter |
| [MediaPipe LLM Inference API](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference) | Android/iOS native, or via Flutter/RN plugin | Google MediaPipe (`.task` / LiteRT) | Best for Google's small Gemini-family `.task` models; this repo's `Model Release` workflow already accepts `.task`/`.litertlm` payloads |

### 1.2 How local execution works on mobile hardware

- **iOS — Metal.** llama.cpp compiles a Metal backend; `llama.rn` enables it by
  default on device. The iOS simulator runs CPU-only, so always benchmark on a
  real device (see §4.2). Layers are offloaded to GPU (`n_gpu_layers`) by the
  app's model settings; the app's *Auto Offload/Load* feature unloads weights
  when the app backgrounds.
- **Android — Vulkan / OpenCL / NPU.** The app builds llama.cpp backends from
  source in CI (`ORG_GRADLE_PROJECT_rnllamaBuildFromSource=true`), producing
  variant libraries per backend set (see `scripts/android-payload-manifest.json`
  for the exact shipped `.so` set). On Qualcomm devices a **Hexagon NPU**
  variant is compiled when the Hexagon SDK is provisioned
  (`.github/actions/setup-hexagon-sdk`). Without it, the build succeeds and
  ships without NPU support.
- **Memory model.** Weights are mmap'd; prompt processing (KV-cache) scales
  with context length (`n_ctx`). The app guards OOM via per-device-RAM model
  tiers (§4.3) and auto-offload.

---

## 2. Rebranding & Identity Overhaul

Everything below is what the Nexus rebrand changed. Treat §2.1 as *required*
and §2.2 Step 4 as optional hygiene.

### 2.1 App name, bundle IDs, and text strings

| What | File | Value to change |
|---|---|---|
| App display name (both platforms) | `app.json` | `"name"` (also the RN root-component key — see warning below) and `"displayName"` |
| npm package name | `package.json` | `"name": "nexus-app"` |
| Version reset | `.version`, `package.json`, `android/app/build.gradle` (`versionCode 1` / `versionName "1.0.0"`), `ios/PocketPal.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) | 1.0.0 (1) |
| Android applicationId (Play Store ID) | `android/app/build.gradle` → `defaultConfig.applicationId` | `com.nexusai.nexus` |
| Android visible name | `android/app/src/main/res/values/strings.xml` → `app_name` | `Nexus` |
| Android deep-link scheme | `android/app/src/main/AndroidManifest.xml` (`nexus://hub`, `nexus://checkout`), `android/app/src/e2e/AndroidManifest.xml` | `nexus` |
| iOS display name | `ios/PocketPal/Info.plist` → `CFBundleDisplayName` | `Nexus` |
| iOS bundle ID | `ios/PocketPal.xcodeproj/project.pbxproj` → every `PRODUCT_BUNDLE_IDENTIFIER` (app + tests targets) | `com.nexusai.nexus` |
| iOS URL scheme | `ios/PocketPal/Info.plist` → `CFBundleURLTypes` | `nexus` |
| iOS keychain scope | `ios/PocketPal/PocketPal.entitlements` → keychain-access-groups | re-scope to the new bundle ID |
| In-app strings | `src/locales/*.json` | product name appears in ~16 languages; replace the brand token in every file (CI: `yarn l10n:validate`) |
| iOS permission prompts | `ios/PocketPal/Info.plist` (`NSCameraUsageDescription`, `NSLocalNetworkUsageDescription`, `NSLocationUsageDescription`, `NSPhotoLibraryUsageDescription`, Siri usage) | product name in each sentence |
| Store listing copy | `fastlane/metadata/android/en-US/{title,short_description,full_description}.txt` | your copy |
| Outbound user agent | `src/utils/hfUserAgent.ts`, `android/app/src/main/java/com/pocketpalai/download/DownloadWorker.kt` | `Nexus/<version> (com.nexusai.nexus)` |

> ⚠️ **Root-component name is a contract, not a label.** `index.js` registers
> the app under `app.json → name`. Both native entry points must match it or
> the app launches to a blank screen:
> - Android: `android/app/src/main/java/com/pocketpalai/MainActivity.kt` → `getMainComponentName()`
> - iOS: `ios/PocketPal/AppDelegate.swift` → `factory.startReactNative(withModuleName:)`
>
> And every deep link must use the **one** registered scheme (`nexus://`):
> `src/store/CheckoutFlowStore.ts` (`CALLBACK_SCHEME`),
> `ios/PocketPal/AppDelegate.swift` (`url.scheme == "nexus"`),
> `ios/PocketPal/AppIntents/OpenPalChatIntent.swift`.

### 2.2 Visual assets

**Step 1 — Android launcher icons.** Replace every `ic_launcher.png` /
`ic_launcher_round.png` in `android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/`.
Sizes: 48/72/96/144/192 px. Generate all densities at once:

```bash
# from a 1024×1024 source icon
npx @bam.tech/react-native-make icons --path ./icon.png  # or use Android Studio → Image Asset
```

**Step 2 — iOS app icon.** Replace the PNGs in
`ios/PocketPal/Images.xcassets/AppIcon.appiconset/` (filenames listed in its
`Contents.json`: 1024 App Store, 120/180 iPhone app, 76/152/167 iPad,
20/29/40/58/60/87 settings & notifications). Open the asset catalog in Xcode
to verify there are no unassigned slots.

**Step 3 — Splash / launch screen.** Edit
`ios/PocketPal/LaunchScreen.storyboard` (label text → your name). Android uses
the launcher icon + theme; adjust `android/app/src/main/res/values/styles.xml`
if you ship a branded splash. Also replace the in-app logos
`src/assets/pocketpal-*.png` (filenames kept on purpose — they are referenced
from `src/components/*/…Placeholder*.tsx`).

**Step 4 — (optional hygiene) build-internal identifiers.** Deliberately
*not* renamed in this fork because renaming them risks breaking compilation
with zero user-visible benefit:

- Kotlin `namespace "com.pocketpal"` + source dir `com/pocketpalai/` +
  `package.json → codegenConfig` (`PocketPalSpecs`, `com.pocketpal.specs`)
- Xcode project/target `PocketPal` (`ios/PocketPal.xcodeproj`,
  `ios/PocketPal.xcworkspace`, scheme, `.entitlements` filename,
  `android/settings.gradle → rootProject.name`)
- Published npm deps `@pocketpalai/llama.rn`-family imports (`@pocketpalai/react-native-speech`)

If you do rename them, move the Kotlin dir, update `namespace`,
`applicationIdSuffix` consumers, codegen config, pbxproj paths, Podfile target,
all fastlane schemes, and CI xcodebuild args **in one commit**, then run the
full CI matrix.

### 2.3 Assistant identity

- Default per-template system prompts: `src/utils/chat.ts` (e.g. change
  `"You are a helpful assistant named …"` lines).
- Siri/App Shortcuts phrasing: `ios/PocketPal/AppIntents/PocketPalShortcuts.swift`
  (uses `\.applicationName`, so it follows the display name automatically).
- Legal links on the About screen: `src/screens/AboutScreen/AboutScreen.tsx`
  → this fork points at `PRIVACY_POLICY.md` / `TERMS_OF_SERVICE.md` in the repo;
  host them wherever your store listings need.

---

## 3. Custom Model & Database Configuration

### 3.1 Ship a default model

**Option A — auto-download from Hugging Face (recommended).** The Models tab
catalog is data-driven:

- Catalog entries: `src/store/bundledDeviceRules/rules.android.json` /
  `rules.ios.json` — each entry carries `display_name`, `hf_repo`,
  `hf_filename`, quant, size, and the RAM tier it is recommended for. Point
  `hf_repo`/`hf_filename` at your own HF repo and the app downloads it on
  first use; the `Model Release` workflow (§3.3) can publish the same files
  from this repo.
- Online override: `src/services/deviceRules/rulesUrls.ts` fetches
  `nexus-ai-official/nexus-device-rules` via jsDelivr at runtime and falls
  back to the bundled JSON on failure. Fork that repo to update the catalog
  without an app release.

**Option B — pre-pack the GGUF in the bundle.**

- iOS: drag `your-model.gguf` into the Xcode target, then on first run copy it
  from `RNFS.MainBundlePath` to `RNFS.DocumentDirectoryPath` before registering
  it in the model store.
- Android: place the file under `android/app/src/main/assets/models/` and copy
  with `RNFS.copyFileAssets(...)`.
- ⚠️ Mind store limits: Google Play's ~200 MB base-module cap and App Store
  OTA limits — prefer Option A for anything larger than ~150 MB.

**Publish your own model releases from this repo:**

```bash
# 1) put quantized files in models/ (Git LFS for >100 MB)
# 2) Actions → Model Release → Run workflow → version e.g. models-v1.0
#    → assets land on the GitHub Release (2 GiB/asset cap enforced)
```

### 3.2 Default prompts, parameters, and UI metadata

- **System prompt**: `src/utils/chat.ts` — per chat-template defaults
  (`gemmaIt`, `chatML`, `phi3`, …). The model's own GGUF metadata
  (`tokenizer.chat_template`) picks the template.
- **Default runtime parameters**: `src/store/ModelStore.ts`
  (`defaultCompletionSettings`, context-init `n_ctx`, GPU-layer defaults).
- **UI metadata (names, tiers, HF coordinates)**: the `rules.*.json` files
  above; see `models/README.md` for the full Nexus lineup table.

### 3.3 Local database

WatermelonDB/SQLite storage is named in exactly three places — rename all of
them together (this fork uses `nexus`):

- `src/database/index.ts` → `dbName: 'nexus'`
- `ios/PocketPal/AppIntents/PalDataProvider.swift` → `nexus.db` (Siri intents read the same DB)
- `android/app/src/main/res/xml/backup_rules_legacy.xml` → `nexus.db{,-wal,-shm}`

---

## 4. Build & Verification Checklist

### 4.1 Android (Android Studio / CLI)

```bash
yarn install && yarn lint && yarn typecheck && yarn test   # JS gates

# Release AAB (Play Store) — needs signing secrets, see README:
cd android && ./gradlew bundleProdRelease
# → app/build/outputs/bundle/prodRelease/app-prod-release.aab

# Or let CI do it: push a version tag → the Android Release workflow
# publishes signed Nexus-<tag>.apk/.aab to GitHub Releases.
git tag v1.0.0 && git push origin v1.0.0
```

Checks before shipping: `versionCode`/`versionName` bumped, `applicationId`
is yours, `nexus-release-key.keystore` (alias `nexus_key_alias`) is your key
and backed up, payload gate green (`scripts/verify-android-payload.js` runs in CI).

### 4.2 iOS (Xcode)

```bash
cd ios && pod install && open PocketPal.xcworkspace
```

1. Target → Signing & Capabilities: your team + bundle ID `com.nexusai.nexus`
   (must match `Matchfile`/`export_options` in `ios/fastlane/Fastfile` if you
   use the TestFlight lane).
2. `Product → Archive` → Distribute App.
3. **Archive on a real device at least once** — simulators never exercise
   Metal, so simulator-only testing hides GPU regressions.
4. CI equivalent: the `CI Pipeline` workflow builds the simulator Release
   configuration on every push to `master`.

### 4.3 Model sizing & OOM safety

Budget = **weights + KV-cache (∝ n_ctx) + OS headroom**. Q4_K_M rule of thumb
for healthy chat on each RAM class (matches the bundled catalog tiers):

| Device RAM | Max model | Suggested `n_ctx` | Example |
|---|---|---|---|
| 4 GB | ≤ 1 GB file (~0.5–1B params) | 2048 | Qwen3 0.6B Q4_K_M |
| 6 GB | ~1.3–1.6 GB | 2048–4096 | Gemma 3 1B / Qwen3 1.7B |
| 8 GB | 3–4B (~2.5 GB) | 4096 | Gemma 3 4B / Phi-4 Mini |
| 12 GB+ | 7–8B (~4.5–5 GB) | 4096–8192 | LFM2.5 8B-A1B (MoE) |

Practices baked into this codebase — keep them:

- Tiered catalog prevents users from loading models their RAM can't hold
  (`rules.*.json` RAM tiers + ModelStore guards).
- **Auto Offload/Load** (default on) releases weights in background.
- Ship **one file per model** — split archives are not resumable in-app and
  complicate mmap.
- Keep the 2 GiB GitHub asset cap in mind when choosing quants (Q4_K_M is the
  default recommendation; go Q4_0/Q3 for larger models).

### 4.4 Pre-release verification run

- [ ] `yarn lint`, `yarn typecheck`, `yarn test`, `yarn l10n:validate`, `yarn verify:fonts` all green
- [ ] CI Pipeline green on the release branch (JS gates + Android prod build + iOS sim build)
- [ ] Fresh install on a 4 GB-class Android device and an iPhone: download a
      tier-appropriate model, chat 20+ turns, background/foreground the app
- [ ] Deep links: `nexus://hub/run?repo_id=…&filename=…` opens the run sheet;
      checkout returns via `nexus://checkout/…`
- [ ] Siri Shortcuts: "Ask Nexus …" and "Open Nexus chat" resolve (iOS)
- [ ] About screen: version string, GitHub/Privacy/Terms links open
- [ ] Store assets: icon renders correctly on both OSes, launch screen shows your name

---

## 5. Keeping up with upstream

```bash
git remote add upstream https://github.com/a-ghorbani/pocketpal-ai.git
git fetch upstream
git cherry-pick <commit>      # pull fixes selectively; avoid bulk merges
```

Conflict hotspots after a white-label: `app.json`, locale files,
`MainActivity.kt` / `AppDelegate.swift` module names, deep-link scheme
constants, and `rules.*.json`. Re-run §4.4 after every sync.
