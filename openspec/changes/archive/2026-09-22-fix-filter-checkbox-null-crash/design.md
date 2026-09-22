# Design

## Context

`addMatchRow` (src/ASF-STM.ts) reconciles the per-game filter widget once per matched game, delegating the decision to the pure `planFilterUpdate(checkboxExists, checkboxChecked)` helper (src/lib/match-row.ts). The helper's contract: `checkboxExists === false` → `addedToFilter: true` (append entry, row visible); `checkboxExists === true` → honor `checkboxChecked` for display, never re-add. The call site passes `checkBox === null`, which satisfies the helper's parameter only when read as "checkbox is missing" — the opposite of the parameter name — so missing/existing are swapped:

- Missing checkbox → treated as existing → else-branch reads `checkBox.parentElement` on `null` → the reported `TypeError`, thrown before `compareCards`'s callback runs (scan chain stalls).
- Existing checkbox → treated as new → duplicate DOM checkbox (duplicate `astm_<appid>` id), duplicate `tradeParams.filter` push on every subsequent match, and the checked state is ignored.

The pure helper's unit tests pass because they exercise the helper with arguments matching its documented contract; nothing covered the call-site wiring. The inversion entered in commit `1f546ef` when the inline `if (checkBox === null)` was replaced by the helper call. See proposal.md for motivation; specs/match-row/spec.md for the required behavior.

## Goals / Non-Goals

**Goals:**

- One-line-correct call-site wiring: missing → add, existing → count + visibility.
- Guarantee the continuation runs: rendering cannot leave `compareCards` without invoking its callback.
- Regression coverage at the wiring seam, not just the pure helper.

**Non-Goals:**

- Redesigning the filter widget, its persistence format, or `tradeParams.filter` semantics.
- Changing `planFilterUpdate`'s signature or behavior (its contract is correct and tested).
- Hardening every DOM lookup in `addMatchRow` (`mainContentDiv`, blacklist/filter-all listeners) beyond the filter-widget path — those assume a Steam page rendered by the userscript's own injected markup and are unchanged by this defect.
- Deduplicating appids already persisted as duplicates by earlier buggy runs (a one-time cleanup is not required; `match=all` resolution tolerates duplicates because it filters appids with a match entry — see trade-offer-handoff).

## Decisions

**D1 — Fix the argument at the call site, not the helper.** Pass `checkBox !== null` (or pass the element/`getElementById` result into a wrapper that derives existence). Rationale: the helper's contract is named, documented, and unit-tested correctly; the defect is purely at the wiring seam. Alternatives considered: inverting the helper's logic to match the call site — rejected, it would invert the meaning of `checkboxExists` for every future caller and require rewriting the passing tests; removing the helper and restoring the inline `if` — rejected, it re-loses the extraction the modularization change deliberately made.

**D2 — Cover the wiring with a seam-level test.** Add tests that drive the decision the way `addMatchRow` does — feed the *DOM-derived existence* (`getElementById(...) === null`) through the helper exactly as the call site does, asserting: missing → added; existing+checked → not added, visible; existing+unchecked → not added, hidden. Rationale: the pure-helper tests passed through the regression because they hand-authored arguments instead of deriving them from element presence. A happy-dom test asserting the derived-existence wiring closes that gap without booting the whole userscript. Alternative considered: extracting a `resolveFilterUpdate(checkBox: HTMLInputElement | null)` wrapper into match-row.ts that takes the element itself — slightly stronger (the inversion becomes unrepresentable), chosen as the preferred shape if the apply step finds it trivial to wire; either satisfies the spec.

**D3 — Let the corrected branch structure guarantee the continuation.** With the argument fixed, the missing-checkbox path adds the entry (no null dereference exists on that path) and the existing-checkbox path reads `parentElement` only on a non-null element. `compareCards` keeps calling `addMatchRow` before `callback()`, so no reordering is needed. Alternative considered: try/finally around `addMatchRow` to force the callback — rejected as masking: it would let rendering failures silently drop rows while the scan claims success; the spec requires non-throwing rendering, not a swallowed exception.

## Risks / Trade-offs

- [Another call-site inversion of the same boolean could regress silently] → D2's seam-level test derives existence from element presence, failing if wiring flips again.
- [Users who ran buggy builds have duplicate appids already in `TempAsfStm.ASF.STM.Params`] → Out of scope (Non-Goals): duplicates are tolerated by `match=all` resolution; new renders stop adding more. If desired later, a storage-migration cleanup would be its own change.
- [Label/count update reads `label.dataset` which could be null if widget markup changes] → Low risk: the label ships in the same inserted `<span>` as the checkbox; markup is userscript-owned. Not part of this fix's scope.
- [Fix touches only one line, inviting over-broad "hardening" during apply] → Design boundaries above scope-limit the apply step to the filter-widget path plus tests.

## Migration Plan

None: pure defect fix in a single-file userscript. Users get it on next userscript update; no persisted-format change, no rollback concerns beyond reverting the release.

## Open Questions

None — the defect, its blast radius, and the fix seam are fully determined by the reported stack trace and code inspection.
