# Tasks

## 1. Replay the reported scenarios

- [x] 1.1 Execute user scenario 1 as a fixture (A×5 tradable, D×1 held, B/C/E×0 vs bot 2-of-each, ANY mode) and verify exactly A→B, A→C, A→E with D never requested via `pnpm test`
- [x] 1.2 Execute user scenario 2 as a fixture (A×5 with 4 held, D×1 held, B/C/E×0 vs bot 2-of-each) and verify exactly one swap for a missing card with D never requested via `pnpm test`

## 2. Probe the audit edges

- [x] 2.1 Execute the fair (non-ANY) bot variant of scenario 1 and verify no swap requests D, offered A copies stay within tradable capacity, and sides stay balanced via `pnpm test`
- [x] 2.2 Trace multi-iteration accounting (sends decrement owned+tradable, receives increment both) and verify no iteration offers an unowned or untradable copy, recording whether a just-received card can be re-offered, via `pnpm test`
- [x] 2.3 Verify badge eligibility and match-row display for the scenarios (zero-tradable badge excluded, rows show only exchanged tradable copies) via `pnpm test`

## 3. Close the audit

- [x] 3.1 Add fixture tests for every edge in section 2 lacking coverage and verify `pnpm test` passes on the full suite
- [x] 3.2 Correct the delta specs if execution contradicts their scenario text, fix the implementation if the audit proves a behavior bug, and verify `pnpm typecheck` passes
- [x] 3.3 Bump the `package.json` patch version only if implementation code changed, then verify `pnpm lint` and `pnpm format:check` pass
