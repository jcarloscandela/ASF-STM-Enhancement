# Proposal

## Why

There is no `AGENTS.md`, so contributors and AI agents lack an authoritative, root-level source for how to work in this repository. Architecture-relevant changes risk drifting from `README.md` with no stated sync rule, and code changes risk shipping without a version bump even though `package.json` is the single version source injected into both distributables and the release tag.

## What Changes

- Add a root-level `AGENTS.md` (note: user wrote `AGENTS.MD`; this repo and tooling use lowercase `.md`, so the file will be `AGENTS.md`) that documents:
  - Repository overview and layout (`src/ASF-STM.js`, `src/lib/*.ts`, `src/templates/`, `scripts/build.ts`, `test/*.test.ts`, `dist/` gitignored output).
  - Required working commands: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format` / `format:check`.
  - Code conventions: strict TypeScript libs, oxlint + oxfmt, vitest with plain fixtures (no browser/network/new runtime deps), build placeholder discipline (fail on missing/unreplaced `{{PLACEHOLDER}}`).
  - Docs-sync rule: any architecture-relevant addition or modification MUST update `AGENTS.md` and/or `README.md` in the same change.
  - Versioning rule: any change touching shipped or tested code MUST bump the `package.json` version (patch at minimum), because the build injects it into both userscript headers and the release flow tags from it.
- Keep the change docs-only: no `src/`, `scripts/`, `test/`, CI, or `dist/` behavior changes.

## Capabilities

### New Capabilities

- None. This change introduces contributor/process guidance only; it does not add runtime or build-system behavior.

### Modified Capabilities

- None. No existing spec REQUIREMENTS change (`tradable-card-filter`, `trade-matching`, `userscript-build` are unaffected). The versioning and docs-sync expectations are process rules enforced by review, not scanner/build behavior, so no delta spec is warranted. This change will set `skip_specs: true` in its `.openspec.yaml`.

## Impact

- New file: `AGENTS.md` at repository root.
- No affected runtime code, APIs, dependencies, or CI workflows.
- Future impact: subsequent code changes carry two review obligations (docs-sync check + version bump); reviewers/CI consumers should verify both.
