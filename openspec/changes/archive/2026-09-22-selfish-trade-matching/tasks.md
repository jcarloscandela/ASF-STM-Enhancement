# Tasks

## 1. ANY-mode selfish fixtures (red first)

- [x] 1.1 Add the pasted specification's §20 selfish cases as ANY-mode fixtures to `test/matcher-core.test.ts`: (a) ours `[1,2,0,1,1]` vs an ANY partner owning only the needed card (`C: 1`) → exactly the `B -> C` swap is proposed although the partner is left with zero copies of C; (b) ours `[1,2,0,1,1]` vs an ANY partner `B: 2, C: 1` → `B -> C` is still proposed although the partner ends with three B and zero C; verify both are red against the current retain-one guard
- [x] 1.2 Flip the single ANY-mode fixture "never takes an ANY-mode partner's last copy" into "takes an ANY-mode partner's last copy" (the swap IS proposed) and verify it is red against the current matcher
- [x] 1.3 Leave the fair-partner fixtures untouched as guardrails — "never takes a fair partner's last copy", "rejects an unfair-to-bot swap that an ANY bot accepts", and "keeps held cards out for fair bots while capping offers at tradable capacity" (still exactly 2 swaps) — and verify they are green before any code change
- [x] 1.4 Run `pnpm test` and confirm exactly the new/flipped ANY-mode cases are red while every other suite stays green (the golden suite still passes because it mirrors the current rules)

## 2. Mode-conditional selfish give rule

- [x] 2.1 In `src/lib/matcher-core.ts` make the partner give guard mode-conditional per design D1: for ANY-mode partners require only `theirBadge.cards[j]!.count > 0` (retain-one dropped), for fair partners keep `count > 0 && (tradableCount ?? count) > 1`; leave the fairness block, `MatchDeps`, and all signatures untouched; verify the 1.1/1.2 fixtures pass and the fair-partner plus our-side fixtures (capacity, need, balance, determinism, badge states, multi-iteration accounting) stay green
- [x] 2.2 Update the golden reference loop in `test/matcher-core-golden.test.ts` in lockstep per design D4: the same mode-conditional give guard, fairness block unchanged, keeping the `isMatchEverything` parameter and the `for (const any of [false, true])` dimension; verify `pnpm test` passes with the exhaustive sweeps agreeing with the real matcher

## 3. Full verification and housekeeping

- [x] 3.1 Run `pnpm test` and verify the whole suite is green: both matcher suites, the new selfish fixtures, the flipped fixture, and every untouched suite (tradable gating, scan-lifecycle, offer-writer, match-row, settings, steam-schema)
- [x] 3.2 Run `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` and verify all three pass (format the touched files if needed)
- [x] 3.3 Reword the stale blanket partner-spare sentence in `AGENTS.md` (overview) and `README.md` (trade-matching bullet) — both currently say partners are "only asked for cards they can spare while keeping at least one copy" — to the two-mode model per design D5 (ANY-mode partners are pure card sources: `owned > 0` suffices, even the last copy; fair partners keep at least one copy and only take badge-neutral swaps), and verify by searching both files that no unqualified "can spare while keeping" wording remains outside archived changes
- [x] 3.4 Bump the `package.json` version (patch: 1.0.3 → 1.0.4), sync the version references in `README.md` and `AGENTS.md`, run `pnpm build`, and verify `dist/ASF-STM.user.js` carries `@version 1.0.4` with no `{{PLACEHOLDER}}` tokens or `// DEBUG` markers
- [x] 3.5 Run `openspec validate --change "selfish-trade-matching" --strict` and verify it passes with the MODIFIED requirement header matching the main spec exactly and the full updated content present
- [x] 3.6 Walk the pasted specification's §20 checklist against the confirmed scope (design D6) by re-reading the matcher and its tests: complete badge → no search/no trades; no cards → no search; missing cards but no surplus → no search; duplicate + missing → alternatives bounded by our surplus; held duplicate unusable; held single copy not missing (never requested); ANY partner's only copy taken; ANY partner ending with duplicates still accepted; owned 5/tradable 1 → surplus 0; no plan generates more trades than the available surplus allows; fair partners keep both rules (last copy retained, fairness gate intact)
