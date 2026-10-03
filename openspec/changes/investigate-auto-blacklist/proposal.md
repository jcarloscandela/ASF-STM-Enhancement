# Proposal

## Why

Users report accounts appearing in the blacklist (`TempAsfStm.ASF.STM.Blacklist`) without manual action. The scan path auto-appends any partner whose badge page lacks `.badge_card_set_cards` (private profile / friends-only inventory) and persists it via `SaveConfig`, so a transient privacy state becomes a permanent, silent exclusion.

## What Changes

- Document the confirmed automatic-blacklist trigger and its persistence side effect.
- Change private-profile handling so transient skips do not permanently mutate the user-managed blacklist (e.g., in-memory skip vs persisted entry, opt-in setting, or visible notice with undo).
- Guard the blacklist write path: deduplicate entries, log automatic additions when the debug setting is on, and keep manual blacklist add/remove/textarea flows unchanged.
- Cover the corrected behavior with fixture tests; no change to matching, offer, or tradability logic.

## Capabilities

### New Capabilities

- None — this change corrects existing behavior within existing capabilities.

### Modified Capabilities

- `settings-storage`: blacklist persistence semantics — what may append to the persisted blacklist and when `SaveConfig` writes it.
- `scan-lifecycle`: partner handling during the bot/friend badge-check phase — how private/unreadable profiles are skipped without permanently blacklisting them.

## Impact

- Affected code: `src/ASF-STM.ts` scan loop (`GetCards` private-profile branch ~L1025-1045), `SaveConfig`/`LoadConfig`/`ResetConfig`, `blacklistEventHandler`, persisted key `TempAsfStm.ASF.STM.Blacklist`.
- Affected specs: `settings-storage`, `scan-lifecycle`.
- No new dependencies, no API changes, no matching/offer changes. Reset already clears the blacklist per spec; this change does not alter reset semantics.
