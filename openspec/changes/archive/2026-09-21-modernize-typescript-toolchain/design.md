# Design

## Context

See proposal.md for motivation. Current state: `script/build.py` expands `{{PLACEHOLDERS}}` from `src/templates/` plus inlines `src/lib/tradable.js` and `src/lib/settings.js` into `src/ASF-STM.js`, emitting release/debug variants via `// DEBUG` line filtering; version lives in `src/templates/version` (`6.0.0.15`); tests are dependency-free `node:test` files; `.prettierrc` exists but no formatter runs; CI (`build.yml`) runs tests, the Python build, and drafts a release on version bump. No `package.json` exists. Scope confirmed with the user: incremental TypeScript (libs first, userscript stays JS), pnpm.

## Goals / Non-Goals

**Goals:**
- Identical distributable behavior (modulo version): the TS port must not change scan/match/offer logic.
- One-command JS-only workflows: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm typecheck`.
- Clean cutover: Python, prettier config, and `6.x` versioning gone; new repo publishing `1.0.0`.

**Non-Goals:**
- Converting `src/ASF-STM.js` to TypeScript (deferred follow-up).
- Bundler migration (esbuild/tsup) or test-browser automation.
- Backfilling tests for the untyped userscript body.

## Decisions

1. **pnpm + `package.json` scripts as the single entrypoint.**
   Rationale: user chose pnpm; scripts give the documented one-command surface CI also calls. Alternative (npm) rejected per user choice.
2. **Port `src/lib/*.js` to strict `src/lib/*.ts`, keep inlining compiled JS into the userscript.**
   Rationale: smallest change preserving the single-file dist contract and the `// DEBUG` convention; `tsc` emits the JS the build inlines, so the userscript body is untouched. Alternative (bundle everything with esbuild now) rejected: it would force the deferred userscript conversion early and risk debug-stripping drift.
3. **Build script becomes TypeScript (`scripts/build.ts`) run via `tsx`, same placeholder semantics as `build.py`.**
   Rationale: behavior parity is reviewable line-for-line; `tsx` avoids a separate compile step for the tool itself. Alternative (plain `.mjs`) rejected: the project is standardizing on TS.
4. **vitest for tests, oxlint + oxfmt for lint/format; delete `.prettierrc`.**
   Rationale: matches the requested stack; existing `node:test` files map mechanically to vitest (`describe`/`it`/`expect`). Alternative (keep zero-dep `node:test`) rejected: user explicitly wants vitest.
5. **Version source becomes `package.json` (`1.0.0`), injected at build time.**
   Rationale: one source of truth for the release tag, package metadata, and userscript headers; `src/templates/version` is removed to prevent skew. Alternative (keep version file) rejected: two sources inevitably drift.
6. **New repo + README + published `1.0.0` release close the change.**
   New public repo `ASF-STM-Enhancement` (assumed under `jcarloscandela`), remotes repointed, full history pushed, release published from CI artifacts. README documents features, the new toolchain, and the fork origin/divergence.

## Risks / Trade-offs

- [Risk] TS port subtly changes runtime behavior → Mitigation: port is line-for-line, existing fixtures must pass unchanged under vitest, and built dist is diffed against the Python-built output (only version + formatting deltas allowed).
- [Risk] Version reset breaks Tampermonkey auto-update continuity (old installs point at the deleted fork) → Mitigation: documented as a known limitation; README tells users to reinstall from the new release page.
- [Risk] oxfmt reformats more than intended → Mitigation: run once, review the diff, commit formatting separately inside the change branch before logic edits.
- [Risk] Assumed repo owner (`jcarloscandela`) is wrong → Mitigation: creation is a discrete late task; confirm owner at apply time before creating anything remote.

## Migration Plan

Land code/toolchain changes, verify `pnpm build` output parity and full CI green, then: create public repo, repoint `origin`, push history + tags, publish `1.0.0` from CI artifacts, update README links. Rollback before the push is `git revert`; after publishing, rollback is a `1.0.1` with fixes (releases are immutable).

## Open Questions

None.
