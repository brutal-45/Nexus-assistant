# Activating the iOS (IPA) release — one small manual step

GitHub only runs workflow files that live in `.github/workflows/` on the
default branch, and the automation token used to open PRs in this repo is
not allowed to write there (GitHub hard-blocks app tokens without the
`workflows` scope — verified). So this one file needs a human commit.

## In plain words

1. The full, ready workflow is already written:
   [**docs/fixes/ios-release.yml**](fixes/ios-release.yml) (open it, then
   use the **copy raw file** button in that page's toolbar).
2. Add it to GitHub at `.github/workflows/ios-release.yml` on `master`
   (two ways below).
3. Tell the agent "done" — it will tag the release and watch the build.
   About an hour later, `Nexus-vX.Y.Z.ipa` appears on the release page,
   next to the APK and AAB.

## Option A — from your phone / browser (2 minutes)

1. Open this link (it pre-fills the path):
   <https://github.com/brutal-45/Nexus-assistant/new/master?filename=.github/workflows/ios-release.yml>
2. Open
   [docs/fixes/ios-release.yml on the branch](https://github.com/brutal-45/Nexus-assistant/blob/arena/01a0d418-nexus-assistant/docs/fixes/ios-release.yml),
   press the **Copy raw file** button, and paste into the editor from step 1.
3. Scroll down → **Commit changes** → commit directly to `master`.

## Option B — from any computer

```bash
git clone https://github.com/brutal-45/Nexus-assistant.git && cd Nexus-assistant
git checkout master
git mv release/ios-release.yml .github/workflows/ios-release.yml
git commit -m "chore(ci): activate iOS release workflow"
git push
```

## Optional, same sitting — kill the red workflow noise

While you're in the web editor, the CI fixes from PR #7 can be applied
identically (each file is in `docs/fixes/` with its copy button):

- paste `docs/fixes/ci.yml` → `.github/workflows/ci.yml`
- paste `docs/fixes/l10n-upload.yml` → `.github/workflows/l10n-upload.yml`
- **delete** `.github/workflows/android-release.yml` (broken duplicate)

## What happens next (agent does this part)

1. Merge **PR #7**, bump the version (1.18.2), push tag `v1.18.2`.
2. The tag fires **both** release workflows:
   - `release.yml` → publishes the APK + AAB (~45 min, proven flow).
   - `ios-release.yml` → publishes the IPA alongside them (~60–90 min).
3. The IPA is **unsigned** by design (no Apple Developer account / signing
   secrets in the repo): install it with AltStore, Sideloadly or
   TrollStore, which re-sign it with their own certificates. App Store /
   TestFlight would need Apple signing secrets added to the repo — say the
   word and the workflow can be extended for that.

Repo is public, so GitHub-hosted `macos-15` runner minutes are free.
