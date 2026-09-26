# Tasks

## 1. Ordered bumps (gates after each)

- [x] 1.1 Bump `vitest` + `@vitest/coverage-v8` 5.0.1 → 5.0.2, reinstall, and verify with `pnpm test`.
- [x] 1.2 Bump `rolldown` 1.2.9 → 1.2.11, rebuild, and verify `dist` size/budgets plus `pnpm test`.
- [x] 1.3 Bump `oxlint` 1.83.0 → 1.85.0 and verify with `pnpm lint`, adapting config or code to any newly-warning rules (record adaptations).
- [x] 1.4 Bump `oxfmt` 0.68.0 → 0.70.0, accept any reflow, and verify with `pnpm format:check`.

## 2. Regression and release gates

- [x] 2.1 Run the full verification suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all gates pass with no `dist/` commit.
- [x] 2.2 Verify `openspec validate dependency-updates --strict` passes (no version bump: dev-only tooling change).
