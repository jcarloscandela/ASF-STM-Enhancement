# Tasks

## 1. Fix the call-site wiring

- [x] 1.1 In `addMatchRow` (src/ASF-STM.ts), correct the `planFilterUpdate` first argument so checkbox existence matches the helper's contract (`checkBox !== null`), and verify by inspection that the missing-checkbox path can no longer reach the `checkBox.parentElement` statement
- [x] 1.2 Confirm the corrected wiring with `pnpm typecheck` passing (strict null checks make the previously-crashing branch type-consistent)

## 2. Regression coverage at the wiring seam

- [x] 2.1 Add seam-level tests in test/match-row.test.ts that derive existence from element presence the way the call site does (happy-dom `document.getElementById(...) === null` fed into `planFilterUpdate`, per design D2), covering: missing → add entry; existing+checked → not added, visible; existing+unchecked → not added, hidden — and verify they fail if the argument is flipped back
- [x] 2.2 Add a test asserting repeated reconciliations for the same appid keep exactly one checkbox/label and one persisted filter entry while incrementing the displayed count (spec requirement "Filter widget entries are added once and counted thereafter")
- [x] 2.3 Run `pnpm test` and verify the full suite passes, including the untouched existing `planFilterUpdate` tests

## 3. Verification and housekeeping

- [x] 3.1 Run `pnpm lint` and `pnpm format:check` and verify both pass
- [x] 3.2 Run `pnpm build` and verify `dist/ASF-STM.user.js` builds with no unreplaced placeholders or `// DEBUG` markers
- [x] 3.3 Bump the `package.json` version (patch) per the repo versioning MUST rule and verify the built userscript header carries the new version
- [x] 3.4 Manually smoke-check the reported scenario logic by re-reading `addMatchRow`: first match for a new game adds the filter, second match increments the count, unchecked game renders a hidden row, and `compareCards` always reaches `callback()` after `addMatchRow`
