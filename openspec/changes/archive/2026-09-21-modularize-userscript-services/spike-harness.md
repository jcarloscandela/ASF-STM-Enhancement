# Spike note 1.1: DOM harness choice

Exercised every DOM API `src/ASF-STM.ts` uses (badge-page parse, trade-page
slots/cookies/DOM building) under `happy-dom@20.14.5` and `jsdom@30.1.0`
with a canned gamecards + tradeoffer document.

## Winner: happy-dom

- `innerText` (used at the quantity read: `.badge_card_set_text_qty` +
  `.trim()`): happy-dom returns `"(2)"`; **jsdom does not implement
  `innerText`** (undefined → production `.trim()` would throw TypeError).
  This alone disqualifies jsdom without a code change, which is out of scope
  for a behavior-preserving refactor.
- All other checks green on both: querySelector(All), TEXT_NODE child walk,
  `.gamecard` src resolution, null-vs-missing qty element, `#your_slots
  .has_item` counting, createElement/text nodes, cookie write-back.

## Emulation gaps (accepted)

- `xhr.responseType = "document"` / `responseURL`: not DOM — XHR stays behind
  seam-injected fakes; the harness only parses provided HTML strings.
- Steam page objects (`rgInventory`, `rgContexts`, `BuildInventoryDisplayElements`,
  jQuery `.show()`): plain canned JS objects in tests, not emulated.
- Network remains forbidden in all suites.

## Consequence

- `jsdom` removed; `happy-dom` kept as the single DOM-harness devDependency.
- Harness suites opt in per file (`// @vitest-environment happy-dom`);
  pure suites stay environment-free.
