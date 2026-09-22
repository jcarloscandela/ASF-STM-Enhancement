# Proposal

## Why

A 6-vs-6 match produced a 4-vs-6 trade offer and aborted with "ASF-STM trade setup failed … Cards missing", pointing the user at the `TempAsfStm.ASF.STM.Params` localStorage key — even though the persisted handoff data can be perfectly balanced. The failure happens one stage later, when requested names are resolved against the live Steam inventory, and the error gives no per-card diagnosis.

## What Changes

- Diagnose the reported case: persisted `Cards` pass the balance check (`src/ASF-STM.ts:2186`), but `planOfferSelection` (`src/lib/offer-writer.ts:53`) flags `failLater` when a requested name has no tradable copy in the live inventory pool (trade-held, missing, or name-mismatched), moves are applied partially, and the slot-count check (`src/ASF-STM.ts:2051`) throws "Cards missing".
- Name the unresolvable cards in the failure dialog and debug log (side, market-hash name, and whether the name was absent vs. present-but-untradable), so the next report pinpoints the cause instead of blaming the Params key.
- Stop applying partial moves before the abort check: plan first, move only when the full plan resolves (or leave already-tested behavior otherwise intact — decision recorded in design.md).
- Correct the misleading error text: distinguish "handoff data unbalanced" (Params problem) from "live inventory could not supply N cards" (inventory problem).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trade-offer-handoff`: offer-page failure reporting and partial-move behavior change (new observable dialog content and no-partial-offer guarantee).

## Impact

- `src/lib/offer-writer.ts` (`planOfferSelection` result shape/consumers), `src/ASF-STM.ts` (`addCards`, both `ShowAlertDialog` call sites), `test/offer-harness.test.ts` + `test/offer-writer.test.ts` fixture coverage.
- No scan, matching, storage-schema, or build changes.
