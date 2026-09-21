// Unit tests for the scan resilience helpers (src/lib/resilience.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Ported-pattern fixtures (steam-cards-bot: steamErrorClassifier +
// rateLimitCircuitBreaker). `describe`/`it` come from vitest, assertions from
// node:assert/strict; the breaker uses an injectable clock so tests never
// wait on real cooldowns.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  buildRateLimitFailFastError,
  classifySteamError,
  RateLimitCircuitBreaker,
  type SteamErrorCategory,
} from "../src/lib/resilience";

describe("classifySteamError", () => {
  it("classifies HTTP 429 as rate-limited", () => {
    assert.equal(classifySteamError(429, null), "RateLimited");
  });

  it("classifies rate-limit bodies as rate-limited regardless of status", () => {
    for (const text of ["Rate limit exceeded", "HTTP Error 429", "RateLimitExceeded"]) {
      assert.equal(classifySteamError(500, text), "RateLimited", `text=${text}`);
      assert.equal(classifySteamError(null, text), "RateLimited", `text=${text}`);
    }
  });

  it("classifies auth failures from status and session signals", () => {
    assert.equal(classifySteamError(401, null), "Auth");
    assert.equal(classifySteamError(403, null), "Auth");
    assert.equal(classifySteamError(null, "InvalidPassword"), "Auth");
    assert.equal(classifySteamError(null, "AccountLoginDeniedNeedTwoFactor"), "Auth");
    assert.equal(classifySteamError(200, "private profile"), "Auth");
  });

  it("classifies transport failures and 5xx as transient", () => {
    assert.equal(classifySteamError(0, null), "Transient");
    assert.equal(classifySteamError(500, null), "Transient");
    assert.equal(classifySteamError(503, null), "Transient");
    assert.equal(classifySteamError(null, "timeout while fetching"), "Transient");
    assert.equal(classifySteamError(null, "Service unavailable"), "Transient");
  });

  it("classifies bare upstream body errors as transient unless terminal", () => {
    assert.equal(classifySteamError(null, "deleted"), "Transient");
    assert.equal(classifySteamError(null, "empty"), "Transient");
    assert.equal(classifySteamError(null, "private"), "Auth", "terminal marker is not transient");
    assert.equal(classifySteamError(null, "This profile is private"), "Auth", "terminal marker is not transient");
  });

  it("returns unknown for inconclusive failures", () => {
    assert.equal(classifySteamError(null, null), "Unknown");
    assert.equal(classifySteamError(404, "not found"), "Unknown");
    assert.equal(classifySteamError(400, "bad request"), "Unknown");
  });

  it("keeps every category reachable and distinct", () => {
    const categories = new Set<SteamErrorCategory>();
    for (const category of ["RateLimited", "Auth", "Transient", "Unknown"] as const) {
      categories.add(category);
    }
    assert.equal(categories.size, 4);
  });
});

describe("RateLimitCircuitBreaker", () => {
  function breakerWithClock(): { breaker: RateLimitCircuitBreaker; time: () => number; advance: (ms: number) => void } {
    let now = 1_000_000;
    const breaker = new RateLimitCircuitBreaker({
      cooldownMs: 300000,
      maxCooldownMs: 1800000,
      backoffFactor: 2,
      now: () => now,
    });
    return {
      breaker,
      time: () => now,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }

  it("starts closed and stays closed without failures", () => {
    const { breaker, advance } = breakerWithClock();
    advance(10_000_000);
    assert.deepEqual(breaker.check(), { allowed: true, remainingMs: 0 });
  });

  it("opens after the first rate-limited failure and fails fast", () => {
    const { breaker } = breakerWithClock();
    breaker.recordRateLimited();
    const gate = breaker.check();
    assert.equal(gate.allowed, false);
    assert.ok(gate.remainingMs > 0, "cooldown must be pending while open");
  });

  it("closes automatically once the cooldown elapses", () => {
    const { breaker, advance } = breakerWithClock();
    breaker.recordRateLimited();
    advance(300_001);
    assert.deepEqual(breaker.check(), { allowed: true, remainingMs: 0 });
  });

  it("extends the cooldown exponentially on consecutive rate-limited failures", () => {
    const { breaker, advance } = breakerWithClock();
    breaker.recordRateLimited();
    advance(300_001);
    assert.equal(breaker.check().allowed, true, "first cooldown elapsed");
    breaker.recordRateLimited();
    const gate = breaker.check();
    assert.equal(gate.allowed, false);
    assert.ok(gate.remainingMs > 300_000, `second cooldown must exceed the base, got ${gate.remainingMs}`);
  });

  it("caps the growing cooldown at the maximum", () => {
    let now = 1_000_000;
    const breaker = new RateLimitCircuitBreaker({
      cooldownMs: 300_000,
      maxCooldownMs: 400_000,
      backoffFactor: 2,
      now: () => now,
    });
    for (let round = 0; round < 6; round++) {
      breaker.recordRateLimited();
      const gate = breaker.check();
      if (!gate.allowed) {
        assert.ok(gate.remainingMs <= 400_000, `cooldown must stay capped, got ${gate.remainingMs}`);
        now = now + gate.remainingMs + 1;
      }
    }
  });

  it("resets the backoff after a successful request", () => {
    const { breaker, advance } = breakerWithClock();
    breaker.recordRateLimited();
    advance(300_001);
    assert.equal(breaker.check().allowed, true);
    breaker.recordSuccess();
    breaker.recordRateLimited();
    const gate = breaker.check();
    assert.equal(gate.allowed, false);
    assert.ok(gate.remainingMs <= 300_000, "backoff must restart from the base cooldown after success");
  });

  it("supports a higher threshold before opening", () => {
    let now = 1_000_000;
    const breaker = new RateLimitCircuitBreaker({ threshold: 3, now: () => now });
    breaker.recordRateLimited();
    breaker.recordRateLimited();
    assert.equal(breaker.check().allowed, true, "below the threshold the breaker stays closed");
    breaker.recordRateLimited();
    assert.equal(breaker.check().allowed, false, "reaching the threshold opens the breaker");
  });

  it("never extends the cooldown on fail-fast rejections", () => {
    const { breaker, advance } = breakerWithClock();
    breaker.recordRateLimited();
    const first = breaker.check();
    advance(1);
    const second = breaker.check();
    assert.equal(second.allowed, false);
    assert.equal(second.remainingMs, first.remainingMs - 1, "fail-fast checks must not grow the cooldown");
  });
});

describe("classification and breaker compose", () => {
  it("feeds rate-limited classifications into the breaker and fails fast with a classifiable error", () => {
    let now = 1_000_000;
    const breaker = new RateLimitCircuitBreaker({ now: () => now });
    const category = classifySteamError(429, null);
    assert.equal(category, "RateLimited");
    breaker.recordRateLimited();
    const gate = breaker.check();
    assert.equal(gate.allowed, false);
    const failFast = buildRateLimitFailFastError(gate.remainingMs);
    assert.equal(classifySteamError(null, failFast.message), "RateLimited", "fail-fast error stays rate-limited");
    assert.ok((failFast as Error & { remainingMs?: number }).remainingMs !== undefined);
    now += gate.remainingMs;
    assert.equal(breaker.check().allowed, true, "breaker closes after the cooldown");
    breaker.recordSuccess();
    breaker.recordRateLimited();
    assert.equal(breaker.check().allowed, false, "counting restarts from the base cooldown");
  });

  it("does not open the breaker for transient or auth failures", () => {
    const breaker = new RateLimitCircuitBreaker();
    assert.equal(classifySteamError(0, null), "Transient");
    assert.equal(classifySteamError(403, null), "Auth");
    assert.equal(breaker.check().allowed, true, "non-rate-limited failures never open the breaker");
  });
});
