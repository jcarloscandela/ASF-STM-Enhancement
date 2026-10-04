# Design

## Context

See `proposal.md` (Why) for motivation. Current state: `diffNewBadgeCardEntries` (`src/lib/dataset.ts`) computes the not-yet-bundled diff, `serializeBadgeCardsExport` serializes exactly that diff in authoring shape, and `triggerDatasetExport` (`src/lib/dataset-export.ts`) downloads it. The existing `badge-cards-export` spec explicitly forbids exporting the whole dataset; this change reverses that requirement. Detection, button state (`updateDatasetExportState`), filename, and cache/storage formats stay as-is.

## Goals / Non-Goals

**Goals:**

- Produce a drop-in `badge_cards.json` full archive (bundled + new) on every gated export, reusing the existing authoring serialization.
- Define deterministic overlap resolution so repeated exports are stable and reviewable.
- Keep the change small and fully covered by existing fixture-style tests.

**Non-Goals:**

- No change to new-entry detection, button enable/disable rules, count text, filename, cache key, compact publish encoding, or scan/match behavior.
- No automatic merge into `data/badge_cards.json`, no upload endpoint, no migration of existing user caches.
- No change to the badge-detail learning path.

## Decisions

- **Merge in `dataset-export` over a new `dataset` helper, reuse the serializer.** Add a pure merge (e.g. `mergeBadgeCardsForExport(dataset, fresh)`) in `src/lib/dataset.ts` next to `diffNewBadgeCardEntries`, and call it from `triggerDatasetExport`: start from a verbatim copy of the bundled entries, overlay the diff result. Reuse `serializeBadgeCardsExport` for the final payload so authoring keys, full icon URLs (`expandBundledIconUrl`), pretty-printing, and `normalizeDataset` round-trip guarantees are unchanged. Alternative considered: building the merge inline in `triggerDatasetExport` — rejected because overlap rules deserve an isolated, unit-testable pure function following the repo's lib/host split.
- **Bundled-wins overlap, size-only upgrade only.** A bundled rich entry is copied verbatim even when the cache twin differs (preserves curated data); a bundled entry without a card list is replaced by the diff entry for that appId (which by construction only exists when the cache holds a full list); all other bundled entries pass through untouched. Alternative considered: cache-wins — rejected because the bundle is the curated source of truth and cache entries may be partial or stale.
- **Gate the download on the diff count, not the archive size.** `triggerDatasetExport` still computes `diffNewBadgeCardEntries` first and returns early (disabled-state refresh only) when it is empty; the full archive is assembled and downloaded only when at least one new entry exists. This preserves the existing button contract while the payload grows.
- **Deterministic key order (numeric ascending) in the output.** Sort merged appIds numerically before serializing so consecutive exports diff cleanly for manual review. Alternative considered: preserving bundled-then-new insertion order — rejected because cache iteration order is incidental and produces noisy diffs.

## Risks / Trade-offs

- [Risk] Full-archive downloads are larger than diff-only files → Mitigation: dataset is still small (single-digit games today); pretty-printed JSON stays trivial; no pagination or chunking needed. Revisit if the bundle grows past comfortable download size.
- [Risk] Maintainer drops the full archive over `data/badge_cards.json` without review and bakes in a bad cached entry → Mitigation: output stays pretty-printed and sorted for review; spec keeps the side-effect-free guarantee so re-export after a cache correction self-heals; no behavior change on the user side.
- [Risk] Stale requirement title ("exactly the new entries") persists for traceability → Mitigation: delta keeps the exact header per workflow rules; body fully redefines the payload; rename the requirement title in a follow-up spec edit if desired.

## Migration Plan

- No data migration: cache format, storage key, and bundled compact encoding unchanged. Rollback is re-exporting from the previous build or discarding the downloaded file (nothing is written automatically).
- Release steps: implement, update `AGENTS.md`/`README.md` Dataset-tab wording, bump patch version, rebuild `dist/` via CI as usual.

## Open Questions

- None. Button copy ("Download new badge cards") and count semantics are intentionally left unchanged to minimize UI churn; a relabel (e.g. "Download full badge_cards.json") can be proposed separately.
