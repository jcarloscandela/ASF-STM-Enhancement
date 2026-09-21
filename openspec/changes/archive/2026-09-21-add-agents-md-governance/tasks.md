# Tasks

## 1. Author AGENTS.md

- [x] 1.1 Create root `AGENTS.md` with overview, layout (`src/ASF-STM.js`, `src/lib/*.ts`, `src/templates/`, `scripts/build.ts`, `test/*.test.ts`, `dist/` gitignored), and working commands from `package.json`/`README.md`, and verify the file exists at the repository root with those sections present
- [x] 1.2 Document code conventions (strict TypeScript, oxlint/oxfmt, vitest plain fixtures with no browser/network/new runtime deps, `{{PLACEHOLDER}}` discipline) in `AGENTS.md`, and verify each convention matches the current toolchain (`pnpm typecheck`, `lint`, `format`, `test`, `build`)
- [x] 1.3 Add the docs-sync rule (architecture-relevant additions/modifications MUST update `AGENTS.md` and/or `README.md` in the same change) and the versioning rule (any `src/`/`scripts/`/`test/` change MUST bump `package.json` version, patch minimum, as single version source for headers and release tag), and verify both rules appear verbatim as MUST requirements with their scope defined

## 2. Consistency and validation

- [x] 2.1 Cross-check `AGENTS.md` paths and commands against `README.md`, `package.json`, and the on-disk layout, and verify no contradictions (fix `AGENTS.md` wording where drift is found)
- [x] 2.2 Run `openspec validate --change "add-agents-md-governance"` and verify it passes with `skip_specs: true` and no missing artifacts
