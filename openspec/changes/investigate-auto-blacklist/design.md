# Design

## Context

See `proposal.md` (Why): the scan loop in `src/ASF-STM.ts` (`GetCards`, private-profile branch) appends the partner SteamID to the in-memory `blacklist` array and calls `SaveConfig()`, persisting to `TempAsfStm.ASF.STM.Blacklist`. Constraints: single-file userscript discipline (behavior in `src/lib/*`, thin wiring in `src/ASF-STM.ts`); existing specs `settings-storage` (persist/load/reset) and `scan-lifecycle` (progress, Stop preserves blacklist); no new runtime dependencies; vitest fixture-only tests (see `test/tradable.test.ts`, `test/settings.test.ts`).

## Goals / Non-Goals

**Goals:**

- Make the automatic-add trigger observable and removable: private/unreadable partners skip the running scan only.
- Keep manual blacklist flows (row button, textarea, reset) behaving exactly as today, plus dedup guard.
- Add fixture coverage proving skips do not touch persisted state.

**Non-Goals:**

- No change to match/offer/tradability, bot ordering, caching, or progress UI.
- No new settings UI or new persisted keys in this change.
- No retroactive cleanup of already-polluted blacklists beyond existing manual edit/reset.

## Decisions

- **Decision: Transient session-skip set separate from persisted blacklist.**
  - Keep the user-managed `blacklist` array as the only persisted list. Add a scan-scoped in-memory set (e.g., `Set<string>` cleared at scan start) for unreadable partners; the bot-filter predicate checks both. Rationale: preserves the "saves time within this scan" intent without permanent side effects; a partner that flips back to public is retried next scan.
  - Alternative considered: boolean setting "remember private bots" — rejected as extra UI/persistence surface for behavior users did not ask for. Alternative considered: separate persisted auto-list shown in dialog — rejected as scope creep; can be a follow-up if users want it.

- **Decision: Remove the persist-on-skip write; keep a debug trace.**
  - The private-profile branch emits the existing `debugPrint` line and advances progress, but no longer pushes or saves. Rationale: `SaveConfig` on every private bot is chatty and the source of the reported symptom; manual saves already persist when the user acts.
  - Alternative considered: keep persisting but ask for confirmation — rejected: modal per private bot would stall unattended scans.

- **Decision: Centralize blacklist mutation behind a dedup-guarded helper in `src/lib`.**
  - Manual paths (`blacklistEventHandler`, dialog textarea apply) route through one `addToBlacklist`-style pure helper returning a new array with no duplicates; `src/ASF-STM.ts` keeps only wiring. Rationale: matches the repo's lib/host split and makes the rule unit-testable without DOM.
  - Alternative considered: inline `includes` checks at each call site — rejected, duplicates the current ad-hoc pattern that missed the auto path.

## Risks / Trade-offs

- [Risk] Private bots re-checked every scan costs extra badge-page requests → Mitigation: session-skip set still avoids repeats within one scan; web-limiter and existing skip-trace keep cost bounded and visible.
- [Risk] Users who relied on auto-blacklist as a "don't ask again" shortcut see repeats → Mitigation: they can still blacklist manually in one click; release note calls out the behavior change and the textarea/reset cleanup for existing entries.
- [Risk] Existing blacklists already contain auto-added IDs indistinguishable from manual ones → Mitigation: no silent purge; document manual removal; reset already clears all four keys per spec.

## Migration Plan

- No data migration. Shipped file rebuilds via `pnpm build`; existing persisted blacklists are left untouched. Rollback is a version downgrade — prior auto-append behavior returns, no format change involved.

## Open Questions

- None. The only deferred item (optional visible "N private partners skipped this scan" count or opt-in remember list) is a follow-up proposal, not required for this fix.
