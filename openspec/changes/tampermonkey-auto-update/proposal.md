# Proposal

## Why

The script is distributed through GitHub Releases, but the built userscript carries no update metadata (`@updateURL`/`@downloadURL`), and CI leaves new releases as drafts — so Tampermonkey never offers an automatic update and every user must manually reinstall each version. Adding a stable update endpoint removes that manual step.

## What Changes

- Add stable `@updateURL` and `@downloadURL` metadata to the built `dist/ASF-STM.user.js` banner, pointing at a single always-latest download URL for the release asset.
- Make the CI release flow produce a published (not draft-only) release with a stable asset filename, so the always-latest download URL resolves on every version bump.
- Keep `package.json` as the single version source; the existing version-injection mechanism stays unchanged, so Tampermonkey detects each bump as a new version.
- Document the install-once flow in `README.md`: install from the stable URL, Tampermonkey handles the rest.

## Capabilities

### New Capabilities

- None — the behavior is expressed as requirement changes to the two existing capabilities below.

### Modified Capabilities

- `userscript-build`: the built banner SHALL carry stable update/download metadata pointing at the always-latest asset URL.
- `userscript-release`: a version bump on the default branch SHALL yield a published release with a stable asset filename reachable via the always-latest download URL.

## Impact

- `rolldown.config.ts` (banner metadata), `.github/workflows/build.yml` (release publish step / asset handling), `README.md` (install instructions).
- No scanner, matching, or UI behavior changes; no new runtime dependencies.
- Assumption: GitHub Releases remains the distribution channel (no GreasyFork/OpenUserJS publishing); the always-latest URL is `https://github.com/jcarloscandela/ASF-STM-Enhancement/releases/latest/download/ASF-STM.user.js` (or the repo's equivalent stable asset name).
