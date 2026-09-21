# Design

## Context

`oxfmt@0.16.0` is the only formatting tool and is invoked via `pnpm format` / `pnpm format:check` over `src scripts test rolldown.config.ts` with `printWidth: 120` (`.oxfmtrc.json`). The installed `0.16.0` is 52 minor versions behind `0.68.0`; as a 0.x package the caret range cannot move past `0.16.x`, so the bump is a manual, breaking change. CI runs typecheck, lint, tests, and build but not `format:check`, so formatting drift cannot break CI — the gate is local discipline. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Land `oxfmt@0.68.0` with the whole repo re-canonicalized in one reviewable change.
- Keep all five verification gates green (`format:check`, `typecheck`, `lint`, `test`, `build`).

**Non-Goals:**
- Changing any formatting configuration semantics we rely on today (`printWidth: 120` stays unless the new version drops or repurposes it).
- Hand-tuning output style to minimize the diff; the formatter's canonical output wins.
- Touching `vitest` or `typescript` (separate changes, applied after this one).

## Decisions

- **Update first among the three packages.** Formatting-only churn, zero runtime surface, and it de-noises later diffs: when `vitest`/`typescript` land, their code edits are already in canonical 0.68.0 form. Alternative: bump everything at once — rejected because the user asked for progressive, separately-verifiable steps.
- **Commit the version bump and the reformat as two logical steps within one change**: bump + config check first (gates green, tree still mostly unformatted per old style), then `pnpm format` re-canonicalization commit. This keeps any gate failure attributable to either the tool swap or the mass reformat. Alternative: single squashed commit — rejected, harder to bisect.
- **Accept the full reformat diff as-is; no style-preservation options.** Pinning dozens of per-file ignores would be unbounded maintenance. Alternative: incremental migration (format one directory at a time) — rejected; the surface is small (4 paths) and CI does not gate on format.
- **Only touch `.oxfmtrc.json` if the new version demands it.** Read `oxfmt --help` / changelog on apply; do not adopt new options preemptively.

## Risks / Trade-offs

- [0.68.0 output differs drastically from 0.16.0, producing a large cosmetic diff] → Expected and accepted; single dedicated commit keeps review cheap (`git diff --stat` only) and blame can jump over it.
- [New formatter drops or changes an option we depend on] → Verify `pnpm format:check` immediately after the bump; if `printWidth` or file scoping changed, adjust `.oxfmtrc.json` in the bump commit.
- [Format changes inside `src/` alter bundle output] → Cosmetic only, but `pnpm build` + `pnpm test` after the reformat commit confirm the distributable and suite stay green.
- [Editor/extension auto-format on save used by contributors drifts from 0.68.0 until they update] → Note the required version in README only if the project docs name a formatter version; otherwise nothing to do (docs currently don't pin it).

## Migration Plan

1. Bump `oxfmt` to `^0.68.0`, `pnpm install --frozen-lockfile=false` to refresh the lockfile; run the gates.
2. Commit bump (+ any `.oxfmtrc.json` adjustment, + version patch bump per the versioning rule).
3. Run `pnpm format`, run all gates again, commit the reformat.
4. Rollback: `git revert` the two commits and reinstall; nothing else depends on 0.68.0.

## Open Questions

(none)
