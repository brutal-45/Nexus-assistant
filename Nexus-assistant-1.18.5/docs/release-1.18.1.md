# Nexus 1.18.1 release — status & how to publish

## Current state (verified 2026-09-24)

* Tag **`v1.18.1`** exists on the remote (annotated, commit `1e7622ab`). Its
  **source tree is byte‑for‑byte identical to `master`** — same tree SHA
  (`84cb5d7b…`). It bumps only versions (`1.18.0 → 1.18.1`, versionCode 5→6)
  and adds the `assistantIdentity` TypeScript.
* **No GitHub Release was published** for `v1.18.1` (latest release is
  `v1.18.0`). The original tag push fired two runs on 2026‑09‑23 that both
  failed:
    * `release.yml` (the real builder) — failed at/transient during the
      **Build release APK + AAB** step.
    * `android-release.yml` (the broken duplicate) — failed earlier at
      **Install JS dependencies** (Node 18 vs required 22).
* The v1.18.1 code differs from the **successfully‑built v1.18.0** only in
  TypeScript + version numbers — nothing that should break a Gradle build. So
  the failure is almost certainly a **transient first‑run** (cold cache /
  resource) rather than a code regression.

## To publish the APK + AAB

The builder `release.yml` is unchanged since it produced the good v1.18.0
artifacts (correct flavored targets, Node 22, output paths). It only needs a
clean rerun. Any one of:

1. **Actions → “Android Release (APK + AAB)” → Re‑run failed jobs** on the
   failed `release.yml` run for tag `v1.18.1`, **or**
2. `gh run rerun <run-id> --failed` (run id `35901104158`), **or**
3. After applying the workflow fixes (see `docs/ci-fix.md`) push a tiny commit
   to `master`, delete & re‑push tag `v1.18.1`, and let only `release.yml`
   build/upload.

It will produce **`Nexus-v1.18.1.apk`** and **`Nexus-v1.18.1.aab`** and attach
them to release `v1.18.1`.

## There are no pre‑built 1.18.1 binaries in the sandbox

I could not build the APK/AAB locally and the environment has no Android SDK /
JDK / Gradle network access, and the bot token cannot trigger a remote build —
so the binaries must be produced by re‑running the workflow as above.

## IPA — “if possible”

**Not deliverable in this sandbox or by automation.** Publishing an iOS `.ipa`
requires a **macOS (`macos-15`) runner**, and there is **no active/dispatchable
iOS workflow**: `release/ios-release.yml` exists but is *not* under
`.github/workflows/` (the file’s own header says GitHub only runs workflows
from `.github/workflows/`). To publish an IPA you must, from an account with
the permissions:
1. `git mv release/ios-release.yml .github/workflows/ios-release.yml` and push
   (adds the workflow), then re‑run for `v1.18.1`, **and**
2. provide the Apple signing assets. The recipe builds an **unsigned** IPA
   (for AltStore/Sideloadly/TrollStore). App Store/TestFlight signing needs an
   Apple Developer certificate/profile the repo does not hold (no such secrets
   are configured).
