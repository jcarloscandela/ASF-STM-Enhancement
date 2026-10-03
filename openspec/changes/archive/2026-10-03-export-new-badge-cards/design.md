# Design

## Context

See `proposal.md` (Why). Current state: learned entries persist via `writeBadgeCardCacheEntry` into `TempAsfStm.ASF.STM.BadgeCards.v1` (`src/lib/dataset.ts`, called from `learnBadgeCards` in `src/ASF-STM.ts`); the bundled dataset arrives as `data/badge_cards.json` authoring source compacted at build; coverage precedence is bundled-rich wins, then cache (`resolveBadgeEntry`). Constraints: single-file userscript (behavior in `src/lib/*`, thin wiring in `src/ASF-STM.ts`); templates are typed render functions; no new runtime dependencies; vitest fixture-only tests, DOM suites via happy-dom harness.

## Goals / Non-Goals

**Goals:**

- One-click download of exactly the not-yet-bundled entries in merge-ready authoring shape.
- Button state always truthful (disabled on empty diff) without manual refresh.
- Contributor token discipline for the huge dataset, enforced via `AGENTS.md`.

**Non-Goals:**

- No automatic upload, sync, or in-place repo write — the browser cannot touch `data/`; merge stays manual.
- No change to learning, caching, publish encoding, budgets, matching, or offers.
- No new persisted keys or settings.

## Decisions

- **Decision: Pure diff + serialize helpers in `src/lib/dataset.ts`, thin host wiring.**
  - Diff reuses the existing precedence (bundled-rich suppresses; size-only bundled + rich cache = new; unbundled cache = new) and the serializer emits authoring shape with full icon URLs (re-expanding the shared prefix where stored stripped). Rationale: matches the lib/host split, unit-testable without DOM, and reuses the corruption tolerance already in `readBadgeCardCache`/`normalizeDataset`.
  - Alternative considered: computing the diff inline in `src/ASF-STM.ts` — rejected, untestable without a browser seam and duplicates precedence logic.

- **Decision: New "Dataset" tab in the config dialog holding the button, count text, and merge hint.**
  - Rationale: the four existing tabs are dense and unrelated; a dedicated tab keeps the maintainer workflow discoverable without disturbing user settings layout.
  - Alternative considered: fieldset inside the Matcher tab — rejected, that tab is already crowded and the export is a distinct workflow.

- **Decision: Download via Blob + temporary anchor (`download="badge_cards.json"`), pretty-printed JSON.**
  - Rationale: no new dependencies, works in the userscript page context, and pretty print keeps the file diffable for manual merge review.
  - Alternative considered: clipboard copy — rejected, payload can be large and clipboard round-trips mangle formatting.

- **Decision: Recompute state on dialog open and on scan completion paths that learned entries.**
  - Rationale: satisfies "enabled as soon as new data exists" without polling; learning only happens on those paths, so no other refresh point is needed.

## Risks / Trade-offs

- [Risk] Learned entries from anomalous API responses get exported and merged blindly → Mitigation: file holds only new-vs-current-bundle entries and merge stays a manual diff review; `AGENTS.md` documents comparing keys and keeping curated names before overwriting.
- [Risk] Export filename collides with the real `badge_cards.json` on disk → Mitigation: that is the intent (drop-in merge source); the dialog hint states it must be merged, not mistaken for a full dataset.
- [Risk] Large caches make the diff or download heavy → Mitigation: only new entries serialize (bounded by what one browser learned); icons stay URLs, never embedded bytes.

## Migration Plan

- No migration. Rollback is a version downgrade; no persisted format changes, so older builds ignore nothing new. Release notes point maintainers at the new tab and the manual merge step.

## Open Questions

- None.
