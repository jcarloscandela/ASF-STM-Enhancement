# Design

## Context

See `proposal.md` (Why) for motivation. Current state, verified in the repo:

- The userscript banner is generated in `rolldown.config.ts` (`BANNER` constant, `@version` injected from `package.json`). It has no `@updateURL`/`@downloadURL`, so Tampermonkey has nothing to poll for updates.
- `dist/` is gitignored, so a `raw.githubusercontent.com` stable URL cannot work — the built file only exists as a CI artifact and a release asset.
- `.github/workflows/build.yml` runs typecheck, lint, tests, build on `master` push/PR, then creates a **draft** release (`draft: true`) with `dist/ASF-STM.user.js` attached when `package.json` version increases. Draft releases are invisible to the `.../releases/latest/download/<asset>` URL pattern, so there is currently no stable always-latest download URL.
- Release tags use the bare version (`tag_name: ${{ env.VERSION }}`, e.g. `1.0.16`).

## Goals / Non-Goals

**Goals:**

- After a one-time manual install from the stable URL, Tampermonkey updates the script automatically on every published version bump with no user action.
- Every version bump keeps working exactly as today (single version source, full CI verification, release named for the version).

**Non-Goals:**

- No GreasyFork/OpenUserJS publishing or second distribution channel.
- No in-script (self-update) logic; the update mechanism is Tampermonkey's native metadata polling.
- No change to version scheme, tag format, or the `package.json`-as-source-of-truth rule.

## Decisions

1. **Update endpoint = GitHub `releases/latest/download` asset URL.**
   Rationale: zero new infrastructure, stays on the existing distribution channel, and Tampermonkey follows the redirect to the versioned asset transparently.
   Alternatives considered: `raw.githubusercontent.com` — rejected because `dist/` is gitignored and committing build output would violate the repo's single-file-build discipline; GitHub Pages — rejected as an unnecessary second hosting surface.

2. **Emit both `@updateURL` and `@downloadURL` with the same stable URL in the banner.**
   Rationale: `@updateURL` drives Tampermonkey's version check; `@downloadURL` tells it where to fetch the new file (defaults to the install URL otherwise, which for release-asset installs is already version-pinned). Setting both to the always-latest URL keeps check and fetch consistent. The values are static strings in `rolldown.config.ts` next to the existing banner — no version interpolation needed since the URL is version-independent.
   Alternatives considered: `@updateURL`-only — rejected because a version-pinned install URL would still re-download the old file on some managers.

3. **CI publishes the release (or auto-publishes the draft) keeping the stable asset filename `ASF-STM.user.js`.**
   Rationale: `.../releases/latest/download/ASF-STM.user.js` only resolves when the release is published and the asset name is identical on every release. Minimal change: flip the release step from draft to published (or add a publish step), keep everything else (tag, name, version-gating logic) untouched.

4. **One-time manual migration for existing users.**
   Already-installed copies have no `@updateURL`, so they cannot self-migrate. `README.md` install instructions change to the stable URL; existing users reinstall once from it. No code can avoid this — recorded here so the task list includes the docs update.

## Risks / Trade-offs

- [Risk] A release left as draft (e.g. manual `workflow_dispatch` rebuild) breaks the latest-download URL until published → Mitigation: CI publishes automatically on version bump; document that manual rebuilds must also be published.
- [Risk] Renaming the asset later breaks every installed copy's update check → Mitigation: spec pins the stable filename `ASF-STM.user.js`; any rename is a breaking change requiring a new migration note.
- [Risk] `releases/latest` tracks the newest **published** release by creation order, so a hotfix published for an older version could shadow the true latest → Mitigation: accepted; the project releases linearly from the default branch, and the version-gating step already assumes that.
- [Trade-off] Update polling cadence is controlled by the user's Tampermonkey settings, not by us — updates are automatic but not instantaneous.

## Migration Plan

1. Land banner + workflow changes with the next patch version bump (per the repo's versioning rule any `src/`-touching change bumps `package.json`).
2. CI publishes the release; verify the `.../latest/download/ASF-STM.user.js` URL returns the new `@version`.
3. Update `README.md` install link to the stable URL; announce that existing users reinstall once from it.
4. Rollback: reverting the banner lines restores the previous behavior; already-installed copies keep working, they just stop auto-updating.

## Open Questions

- None. The asset host (`github.com/jcarloscandela/ASF-STM-Enhancement`) and filename (`ASF-STM.user.js`) are fixed by the current workflow; if the repo moves, the stable URL in the banner moves with it in the same change.
