# Design

## Context

See proposal.md Why. Current state: `src/lib/matcher-core.ts` resolves `partner`/`match`/`filter`/`cardNames` into `Cards[2]` (`resolveTradeFilter`, `resolvePartnerMatches`, `resolveTradeCards`) and throws `missing url parameter` / `invalid url parameter` / `no matches with this partner` / `Different items amount` / `nothing to add, exiting`; `src/lib/offer-writer.ts` plans live selection (`planOfferSelection`, `formatShortfallMessage`); `src/ASF-STM.ts` wires them on the trade-offer page (`addCards`, `checkContexts`, handoff `try/catch`) with two dialog families (Params-key dialog for setup, per-card dialog for shortfalls) and a zero-moves-on-failure guarantee. The reported symptom (error dialog + both sides empty) matches every abort path, so the fix is diagnostic precision plus keeping atomicity explicit. Constraints: single-file rolldown build, strict TypeScript, oxlint/oxfmt, vitest with plain fixtures and no browser/network, docs-sync and version-bump MUST rules.

## Goals / Non-Goals

**Goals:**
- Attribute each empty offer to exactly one stage with the data needed to act (rescan vs wait out hold vs bug report).
- Keep pure resolvers/planner fixture-testable; keep DOM/dialogs thin in `src/ASF-STM.ts`.
- Preserve zero-moves atomicity and make it user-visible.

**Non-Goals:**
- No matcher/scan-plan changes (surplus, fairness, ANY-mode rules untouched).
- No auto-retry of held cards, no hash-fuzzy matching, no persistence-format migration.
- No new runtime dependencies.

## Decisions

- **Structured handoff diagnosis over stringly-typed errors:** extend the pure resolvers to return (or throw with) a diagnosis object — partner-key candidates tried, resolved filter, filter appids with/without match entries, skipped unknown card ids, `Cards[2]` lengths — and let `src/ASF-STM.ts` format it into the existing Params-key dialog + `debugPrint`. Alternative (format strings inside lib): rejected, keeps lib pure and dialog text in one wiring place.
- **Keep two dialog families, sharpen the boundary:** `trade setup` dialog only for handoff-data failures (keeps Params-key pointer + new diagnosis fields); `live inventory` dialog only for `planOfferSelection` shortfalls (per-card side + absent/unselectable, no Params blame). Alternative (single unified dialog): rejected, would reintroduce the misattribution the current spec already forbids.
- **Explicit empty-offer sentence in every abort dialog** ("No items were added.") plus existing zero-moves behavior (return before any `MoveItemToTrade`). Alternative (partial moves + warning): rejected, violates the atomicity requirement users rely on.
- **Fixture-first coverage:** each abort path gets a vitest fixture (unknown partner, `match=all` with no overlapping appids, all ids unknown, unbalanced sides, fully-held live pool) asserting dialog payload + zero moves. Alternative (manual Steam testing only): rejected, not repeatable in CI.

## Risks / Trade-offs

- [Risk] Verbose dialogs overwhelm users → Mitigation: dialog shows one-line cause + counts; full per-appid/per-card lists go to dialog body capped (existing `cap = 10` pattern) with remainder in debug log.
- [Risk] Diagnosis objects leak into persisted `Params` shape → Mitigation: diagnosis is computed at offer time only, never persisted; `TradePageStore` shape unchanged.
- [Risk] Over-attributing stale-Params cases to live inventory → Mitigation: handoff-data checks run and abort before `checkContexts` polling starts, so inventory is only consulted with balanced non-empty `Cards[2]`.
- [Trade-off] Slightly larger trade-page bundle for formatting helpers — accepted, text-only, no dependencies.

## Migration Plan

- No migration: additive dialog/diagnosis fields, no storage or URL contract change. Rollback is a version bump revert; old `Params` payloads resolve identically.

## Open Questions

- None. The exact shortfall `cap` and debug-log verbosity follow the existing `formatShortfallMessage` convention and can be tuned during implementation without changing specs.
