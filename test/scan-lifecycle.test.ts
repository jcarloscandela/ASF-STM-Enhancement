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

// Regression test for the end-of-phase crash: after the last pending
// badge-detail entry, fetchNext re-entered via setTimeout read
// `pending[pendingIndex]` past the end -> undefined -> `entry.appId`
// threw `Cannot read properties of undefined`, and finish() was reachable
// only from the zero-pending fast path. Pins the completion contract:
// guard before the read, handoff through finish(), progress advancing
// only with the queue, per-scan reset.
describe("scan lifecycle serial badge-detail phase", () => {
  const src = readFileSync("src/ASF-STM.ts", "utf8");
  const body = src.slice(src.indexOf("function GetOwnCards()"));
  const PROGRESS_CALL = 'updateProgress("badges")';

  it("guards the pending read with a bounds check that hands off to finish()", () => {
    const guardIdx = body.indexOf("pendingIndex >= pending.length");
    const readIdx = body.indexOf("pending[pendingIndex]");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(readIdx);
    expect(body.slice(guardIdx, readIdx)).toContain("finish();");
  });

  it("advances badges progress only alongside pendingIndex advancement", () => {
    const readIdx = body.indexOf("pending[pendingIndex]");
    const advances = body.split("pendingIndex++").length - 1;
    const progressCalls = body.split(PROGRESS_CALL).length - 1;
    expect(advances).toBe(2);
    expect(progressCalls).toBe(advances);
    // The progress call must not sit before the pending read (fetchNext top).
    expect(body.indexOf(PROGRESS_CALL)).toBeGreaterThan(readIdx);
    // Every progress call is preceded by a queue advance after the read.
    let searchFrom = 0;
    let found = body.indexOf(PROGRESS_CALL, searchFrom);
    while (found !== -1) {
      expect(body.lastIndexOf("pendingIndex++", found)).toBeGreaterThanOrEqual(readIdx);
      searchFrom = found + PROGRESS_CALL.length;
      found = body.indexOf(PROGRESS_CALL, searchFrom);
    }
  });

  it("resets badges progress at the steps assignment before any advancement", () => {
    const stepsIdx = body.indexOf("progressRadials.badges.steps = pending.length");
    const resetIdx = body.indexOf("progressRadials.badges.currentStep = 0");
    const firstProgress = body.indexOf(PROGRESS_CALL);
    expect(stepsIdx).toBeGreaterThanOrEqual(0);
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(resetIdx).toBeGreaterThan(stepsIdx);
    expect(resetIdx).toBeLessThan(firstProgress);
  });

  it("wires resume reads, record writes, and clears", () => {
    // The resume read sits after the plan snapshot and before inventory work.
    const planSnapshot = src.indexOf("const scanPlan = (pendingPlan as ScanPlan | undefined)");
    const resumeRead = src.indexOf("readScanResume(sessionStorage");
    const inventoryWork = src.indexOf("prepareInventoryScan(runId, scanPlan)");
    expect(planSnapshot).toBeGreaterThanOrEqual(0);
    expect(resumeRead).toBeGreaterThan(planSnapshot);
    expect(resumeRead).toBeLessThan(inventoryWork);

    // The phase snapshots its record once at start (after the zero-pending
    // fast path) and once per queue advance.
    const saves = body.split("saveResumeRecord();").length - 1;
    expect(saves).toBe(3);
    const fastPathReturn = body.indexOf("if (pending.length === 0)");
    expect(fastPathReturn).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("saveResumeRecord();")).toBeGreaterThan(fastPathReturn);

    // GetOwnCards consumes the record read at the scan entry.
    expect(body).toContain("pendingScanResume");
    expect(body).toContain("pendingAppIds");

    // Clears: one at phase completion (finish) and one at stop/abort.
    const clears = src.split("clearScanResume(sessionStorage").length - 1;
    expect(clears).toBe(2);
    const finishStart = src.indexOf("function finish()");
    const finishClear = src.indexOf("clearScanResume(sessionStorage", finishStart);
    expect(finishClear).toBeGreaterThan(finishStart);
    expect(finishClear).toBeLessThan(finishStart + 400);
    const stopStart = src.indexOf("function stopEventCleanup");
    const stopClear = src.indexOf("clearScanResume(sessionStorage", stopStart);
    expect(stopClear).toBeGreaterThan(stopStart);
    expect(stopClear).toBeLessThan(stopStart + 500);
  });
});
