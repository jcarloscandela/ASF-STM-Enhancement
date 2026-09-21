// Unit tests for the request service (src/lib/requests.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Uses injected fake request functions; no network, GM host, or timers.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  canRetry,
  gmGet,
  resolveRequestFunction,
  retryDelay,
  type GmRequestDetails,
  type GmRequestFunction,
  type RetryPolicy,
} from "../src/lib/requests";

/** A fake request function that records calls and replies as scripted. */
function fakeRequest(reply: (details: GmRequestDetails) => void): GmRequestFunction & { calls: GmRequestDetails[] } {
  const calls: GmRequestDetails[] = [];
  const fn = ((details: GmRequestDetails) => {
    calls.push(details);
    reply(details);
  }) as GmRequestFunction & { calls: GmRequestDetails[] };
  fn.calls = calls;
  return fn;
}

describe("resolveRequestFunction", () => {
  it("prefers the modern API when both mechanisms exist", () => {
    const legacy = fakeRequest(() => {});
    const modern = fakeRequest(() => {});
    const resolved = resolveRequestFunction({ legacyRequest: legacy, modernApi: { xmlHttpRequest: modern } });
    resolved({} as GmRequestDetails);
    assert.equal(modern.calls.length, 1);
    assert.equal(legacy.calls.length, 0);
  });

  it("falls back to the legacy function when the modern API is absent", () => {
    const legacy = fakeRequest(() => {});
    const resolved = resolveRequestFunction({ legacyRequest: legacy });
    resolved({} as GmRequestDetails);
    assert.equal(legacy.calls.length, 1);
  });

  it("uses the modern API when only it is available", () => {
    const modern = fakeRequest(() => {});
    const resolved = resolveRequestFunction({ modernApi: { xmlHttpRequest: modern } });
    resolved({} as GmRequestDetails);
    assert.equal(modern.calls.length, 1);
  });

  it("throws a clear error when neither mechanism exists", () => {
    assert.throws(() => resolveRequestFunction({}), /No userscript request mechanism available/);
    assert.throws(
      () => resolveRequestFunction({ legacyRequest: undefined, modernApi: undefined }),
      /No userscript request mechanism available/,
    );
  });
});

describe("gmGet", () => {
  it("resolves with the response text on a success status", async () => {
    const request = fakeRequest((d) => d.onload({ status: 200, responseText: '{"ok":true}' }));
    assert.equal(await gmGet(request, { url: "https://example.test/ok" }), '{"ok":true}');
    assert.equal(request.calls[0]?.method, "GET");
    assert.equal(request.calls[0]?.url, "https://example.test/ok");
  });

  it("accepts any status in the success range", async () => {
    for (const status of [200, 201, 204, 299]) {
      const request = fakeRequest((d) => d.onload({ status, responseText: "body" }));
      assert.equal(await gmGet(request, { url: "u" }), "body", `status ${status}`);
    }
  });

  it("rejects with the status for client and server errors", async () => {
    for (const status of [400, 403, 404, 500, 503]) {
      const request = fakeRequest((d) => d.onload({ status, responseText: "" }));
      await assert.rejects(gmGet(request, { url: "u" }), new RegExp(`HTTP Error ${status}`), `status ${status}`);
    }
  });

  it("rejects on transport error", async () => {
    const request = fakeRequest((d) => d.onerror(new Error("boom")));
    await assert.rejects(gmGet(request, { url: "u" }), /Request failed/);
  });

  it("rejects on timeout", async () => {
    const request = fakeRequest((d) => d.ontimeout(new Error("slow")));
    await assert.rejects(gmGet(request, { url: "u" }), /Request timed out/);
  });

  it("forwards headers when given", async () => {
    const request = fakeRequest((d) => d.onload({ status: 200, responseText: "ok" }));
    await gmGet(request, { url: "u", headers: { "User-Agent": "ASF-STM/1.0.0" } });
    assert.deepEqual(request.calls[0]?.headers, { "User-Agent": "ASF-STM/1.0.0" });
  });
});

describe("retryDelay", () => {
  const policy: RetryPolicy = { weblimiter: 300, errorLimiter: 30000, maxErrors: 3 };

  it("uses the base web-limiter delay for the first attempt", () => {
    assert.equal(retryDelay(policy, 0), 300);
  });

  it("increases by the error limiter per accumulated failure", () => {
    assert.equal(retryDelay(policy, 1), 30300);
    assert.equal(retryDelay(policy, 2), 60300);
    assert.equal(retryDelay(policy, 3), 90300);
  });
});

describe("canRetry", () => {
  const policy: RetryPolicy = { weblimiter: 300, errorLimiter: 30000, maxErrors: 3 };

  it("allows retries up to and including the configured maximum", () => {
    assert.equal(canRetry(policy, 0), true);
    assert.equal(canRetry(policy, 1), true);
    assert.equal(canRetry(policy, 2), true);
    assert.equal(canRetry(policy, 3), true);
  });

  it("stops once failures exceed the configured maximum", () => {
    assert.equal(canRetry(policy, 4), false);
    assert.equal(canRetry(policy, 10), false);
  });

  it("stops immediately when no errors are tolerated", () => {
    const strict: RetryPolicy = { weblimiter: 300, errorLimiter: 30000, maxErrors: 0 };
    assert.equal(canRetry(strict, 0), true);
    assert.equal(canRetry(strict, 1), false);
  });
});
