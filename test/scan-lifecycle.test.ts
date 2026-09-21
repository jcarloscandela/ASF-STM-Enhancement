import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression test for the Tampermonkey crash:
// `finish() <- GetOwnCards()` threw `Cannot access 'aborted' before
// initialization` on the zero-pending fast path because `let aborted`
// was declared after the early `finish()` return. GetOwnCards lives
// inside the userscript closure (no browser here), so assert the
// declaration-order contract on the source itself.
describe("scan lifecycle zero-pending fast path", () => {
  const src = readFileSync("src/ASF-STM.ts", "utf8");
  const body = src.slice(src.indexOf("function GetOwnCards()"));

  it("declares `aborted` before the first finish() call", () => {
    const decl = body.indexOf("let aborted = false");
    const finishCall = body.indexOf("finish();");
    expect(decl).toBeGreaterThanOrEqual(0);
    expect(finishCall).toBeGreaterThanOrEqual(0);
    expect(decl).toBeLessThan(finishCall);
  });

  it("issues no badge-detail request scaffolding before the fast-path return", () => {
    const fastPathReturn = body.indexOf("if (pending.length === 0)");
    const xhrOpen = body.indexOf("new XMLHttpRequest()");
    expect(fastPathReturn).toBeGreaterThanOrEqual(0);
    expect(xhrOpen).toBeGreaterThan(fastPathReturn);
  });
});
