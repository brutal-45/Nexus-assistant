# CI / Workflow Fix — what to change and why

> **Sandbox limitation (2026-09-24).** The GitHub App token used here can read
> the repo and push *code/content*, but it is denied `actions` (rerun /
> dispatch / cancel) and the `workflows` scope (create/update/delete files
> under `.github/workflows/`). It also cannot reach the Android SDK / JDK /
> Gradle / Xcode network hosts needed to build a React‑Native APK/AAB/IPA
> locally. So the workflow edits below could not be pushed from the sandbox —
> apply them from an account that has the required permissions (instructions
> follow), then rerun the failed v1.18.1 release.

## Root cause of the red CI

* `.github/workflows/ci.yml` and `.github/workflows/l10n-upload.yml` were not
  workflows at all — each contained a **raw applied diff** (the `main` →
  `master` rename fragment), i.e. invalid YAML. Every push therefore produced a
  red “failure” run for both. Neither ran a single check.
* `.github/workflows/android-release.yml` was a **stale duplicate** of
  `release.yml`. Both are named “Android Release (APK + AAB)” and both trigger
  on the same `v*` tag push, but the duplicate builds old **un‑flavored**
  Gradle targets (`assembleRelease` / `bundleRelease`) that no longer exist
  once product flavors (prod/e2e) were added → guaranteed **Build** failure.
  That duplicate is what failed the v1.18.1 run (the real builder `release.yml`
  uses the correct `assembleProdRelease` / `bundleProdRelease` and is the same
  file that produced the successful v1.18.0 APK/AAB).

## Changes

### 1. Disable the broken duplicate — `android-release.yml` → removed
Delete `.github/workflows/android-release.yml`. Keep a copy as
`.github/workflows/android-release.yml.disabled` (no `on:` trigger, cannot
run) for reference. **The single APK/AAB release workflow stays
`release.yml`.** Reference content is at `docs/fixes/android-release.yml.disabled`.

### 2. Fix `ci.yml` — new valid CI
Replaces the raw diff with a real, minimal static‑checks workflow: `on:`
PR/`push` (skips `v*` tags), yarn install, **lint**, **typecheck**
(`tsc --noEmit`), **l10n:validate**, and **unit tests** (jest, `--ci`,
2 workers). Distinct from the manual `E2E Android Build (manual)` workflow.
Replacement content is at `docs/fixes/ci.yml`.

### 3. Fix `l10n-upload.yml` — valid, safe i18n sync
Replaces the raw diff with a workflow that runs on pushes to `master`
touching `src/locales/en.json` (or manual): validates `en.json` via
`scripts/validate-l10n.js`, then uploads it to Weblate via
`scripts/sync-weblate.js upload` — **only when the `WEBLATE_TOKEN` secret is
set** (the script exits 0 with a notice when it is absent, so forks/PRs are
unaffected). Replacement content is at `docs/fixes/l10n-upload.yml`.

## How to apply (from an account with the workflows scope)

```bash
git checkout master
# remove the broken duplicate and move the fixes into place
git rm .github/workflows/android-release.yml
mkdir -p .github/workflows
cp docs/fixes/android-release.yml.disabled .github/workflows/android-release.yml.disabled
cp docs/fixes/ci.yml         .github/workflows/ci.yml
cp docs/fixes/l10n-upload.yml .github/workflows/l10n-upload.yml
git commit -m "ci: fix broken workflows; disable duplicate android-release"
git push
```

The fixed `ci.yml` / `l10n-upload.yml` will then validate on the next push.
