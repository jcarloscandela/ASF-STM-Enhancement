# Design

## Context

See proposal.md for motivation. Today, `src/ASF-STM.ts` loads and saves blacklist and Private bots state, filters partners by stored SteamID, attaches a blacklist action to every result row, and records private-inventory partners during badge checks. The configuration template has dedicated Blacklist and Private bots tabs. Browser storage uses `.Blacklist` and `.PrivateBots.v1`; reset and the Stop lifecycle also reference blacklist state. The contributor guide and README describe the feature.

The detailed behavior contract is in the three spec deltas: `private-bots`, `settings-storage`, and `scan-lifecycle`.

## Goals / Non-Goals

**Goals:**
- Remove the blacklist and Private bots feature end-to-end, including UI, scan filtering, persistence, code paths, tests, and user/contributor documentation.
- Keep private-partner handling efficient within a scan: after a missing card section, move on from that partner for the current run without storing a future exclusion.
- Remove legacy browser-storage keys without disturbing other user data.
- Ship the change as a patch release using the existing package-version-driven build and release process.

**Non-Goals:**
- Change how public bot/friend matches, trade offers, scan filters, or normal partner profile links work.
- Add a replacement partner-management or exclusion feature.
- Change release automation or introduce dependencies.

## Decisions

1. **Remove blacklist state rather than hiding its controls.** Delete the in-memory list and its load/save/reset/filter logic, remove the row-level blacklist control and tab, and remove the keys from the active storage-key API. Keep the exact legacy key names only in an idempotent cleanup routine; do not retain reads, writes, or filtering. Keeping a hidden filter would preserve state and behavior the user explicitly asked to eliminate.
   - **Alternative considered:** Hide only the two configuration tabs and leave stored IDs filtering scans. Rejected because the requested complete removal includes adding, listing, and the underlying blacklist behavior.

2. **Treat an inaccessible badge page as a scan-local skip, not a persistent classification.** Continue to advance to the next partner for the current scan, but do not save the ID or suppress it on later scans. This avoids repeatedly requesting the remaining badges from a profile known to be inaccessible during this run without reintroducing blacklist semantics.
   - **Alternative considered:** Continue checking every badge after the first missing card section. Rejected as redundant requests within one run.

3. **Perform an idempotent legacy-key cleanup during initialization.** Remove `.Blacklist` and `.PrivateBots.v1` from localStorage whenever the updated script initializes, while leaving settings, bot cache, Params, badge-card data, and scan-resume data untouched. Do not retain a compatibility reader or migrate IDs into another structure.
   - **Alternative considered:** Ignore old keys and leave them in storage. Rejected because it leaves obsolete user data behind and risks accidental future reuse.

4. **Keep the remaining configuration tabs contiguous.** After removing the Blacklist and Private bots tabs, renumber Scan filters and Dataset tabs and their associated radio/content IDs. Keep other settings and dataset-export behavior unchanged.
   - **Alternative considered:** Leave numeric gaps in tab IDs. Rejected because the IDs are internal UI wiring and contiguous numbering keeps the dialog and its tests coherent.

5. **Update docs and release metadata together.** Remove feature claims and architecture entries from `README.md` and `AGENTS.md`, update relevant tests and OpenSpec requirements, and bump `package.json` to `1.0.19` (or a later patch if the version has moved before implementation). The existing build remains responsible for injecting that value into the userscript.

## Risks / Trade-offs

- [Existing blacklist IDs will no longer prevent partners from appearing in scans] → Remove the legacy key during upgrade and make the behavior explicit in the release notes/documentation; this is intentional under the approved full-removal scope.
- [Previously private partners may be requested again on later runs] → Skip only the remainder of the current partner's checks when a badge page is inaccessible, but do not persist that observation.
- [Old releases cannot recover discarded list data after downgrade] → Treat cleanup as intentional and document that the removed lists are not migrated; users who downgrade would need to recreate any preferences manually.
- [Removing one of several tabs can leave stale selectors or index assumptions] → Update template IDs, event wiring, rendering tests, and any tab-style/CSS references together; verify the generated dialog contains only the remaining tabs.

## Migration Plan

1. On each initialization of the new version, remove the two obsolete localStorage keys (an idempotent cleanup) while preserving all unrelated keys.
2. Ship version `1.0.19` through the normal single-file build and release flow; no data migration or server-side change is required.
3. If a rollback is needed, reinstall the previous userscript version. Removed list data is not recoverable from the new version after cleanup; users would need to recreate any desired exclusions in the old version.

## Open Questions

None.
