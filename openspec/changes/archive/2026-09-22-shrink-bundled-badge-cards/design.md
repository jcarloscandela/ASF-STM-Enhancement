# Design

## Context

See proposal.md Why. Current state: `data/badge_cards.json` (~5.3 MB, 1685 games) uses long keys with full icon URLs; `src/ASF-STM.ts:53` imports it raw so rolldown inlines all 5.3 MB. `src/lib/dataset.ts` already strips one icon prefix and accepts `s`/`n`/`c`/`h`/`t`/`u`. Biggest redundancies observed: repeated per-game `{"hash","title","iconUrl"}` objects, full icon URLs (~250 chars each, mostly one shared prefix plus long unique tails), `"<appid>-<title>"` hash prefixes, and game-name/title duplication.

## Goals / Non-Goals

**Goals:**

- Ship a publish encoding materially smaller than raw JSON with zero behavior change at runtime.
- Keep `data/` readable; compaction happens only in the build.
- Keep decode fast and dependency-free.

**Non-Goals:**

- Changing match/scan behavior, cache format, or badge-detail fallback.
- Binary/compressed (gzip) payloads requiring async decompression in the userscript.

## Decisions

- **Compaction as a rolldown plugin transform on the JSON import** (alternative: checked-in minified file or regeneration-time dual files). Rationale: source stays readable, publish stays small, no extra contributor step; plugin intercepts `data/badge_cards.json` and emits `export default <compact>` plus logs raw vs compact bytes.
- **Compact encoding: dense arrays, not objects.** Per game: `[size, name, cards]` where cards are `[hashSuffix, titleOrSuffixRef, iconTail]` tuples; omit `name`/empty slots positionally. Alternatives considered: short-key objects (smaller win, keeps per-card object overhead); string packing with custom delimiters (bigger win but fragile escaping). Arrays avoid key repetition and compress each card to ~3 short strings.
- **Hash elision: strip `"<appid>-"` prefix per card** and re-attach at decode (hashes are `"<appid>-<title>"` except foil/edge cases, which stay literal). Alternative: dictionary-coding all hashes — rejected as complexity for marginal extra gain.
- **Title dedup: store game `name` once; per-card title stored only when it differs**, else empty string; decode falls back to hash suffix. Icon: strip `BUNDLED_ICON_URL_PREFIX` (already asserted) and store the tail only.
- **Decoder extends `normalizeDataset`** with the tuple-array branch; legacy shapes pass through untouched. No changes to `resolveBadgeEntry`/cache.
- **Budgets:** compacted-bytes budget (e.g. 2.5 MB) + built-file budget, enforced in the plugin (build fails) and re-asserted in CI; unit tests assert round-trip equality on fixtures plus a size assertion (compacted fixture < raw fixture).

## Risks / Trade-offs

- [Foil/special cards whose hash lacks the `appid-` prefix] → Mitigation: encoder leaves them literal with an escape flag; decoder only re-attaches when the prefix was stripped; round-trip tests include foil fixtures.
- [Titles that differ from hash suffix (e.g. "(Trading Card)" variants)] → Mitigation: stored literally when different; tests cover.
- [Decode cost at startup] → Mitigation: single linear pass building the same `BadgeDataset` shape; callable once at startup as today.
- [Budget bit-rot as dataset grows] → Mitigation: CI fails with byte counts; AGENTS.md documents the levers (tighter encoding vs pruning size-only coverage).

## Migration Plan

1. Add encoder + plugin + decoder with round-trip tests.
2. Build, record new `dist/` size, set budgets.
3. Docs-sync AGENTS.md/README per repo rules + version bump. Rollback: revert plugin + decoder (legacy shapes still decode).
