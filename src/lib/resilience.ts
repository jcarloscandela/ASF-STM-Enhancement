// Request-resilience helpers for the scan flows, ported from the
// steam-cards-bot project (steamErrorClassifier + rateLimitCircuitBreaker)
// and adapted to the userscript: pure functions and state, an injectable
// clock, and zero runtime dependencies.
//
// Classification decides retryability (rate-limited/transient retry within
// the existing budgets; auth/unknown abort); the circuit breaker decides
// whether a request may be attempted at all. The per-retry delay formula
// stays in the requests layer — composition is one-directional.

export type SteamErrorCategory = "RateLimited" | "Auth" | "Transient" | "Unknown";

const RATE_LIMIT_SUBSTRINGS = ["rate limit", "429", "ratelimitexceeded"];

const AUTH_SUBSTRINGS = [
  "invalidpassword",
  "invalidloginauthcode",
  "accountlogondenied",
  "accountlogindeniedneedtwofactor",
  "expiredloginauthcode",
  "invalidprotocolversion",
  "private profile",
  "not logged in",
];

const TRANSIENT_SUBSTRINGS = ["timeout", "temporarily", "service unavailable", "bad gateway", "gateway timeout"];

/**
 * Terminal body-error markers (private profiles, credentials, bans): such
 * failures are not retryable, so they are never classified as transient.
 */
const TERMINAL_MARKERS = [
  "private",
  "auth",
  "denied",
  "invalid",
  "banned",
  "restricted",
  "login",
  "password",
  "twofactor",
  "two-factor",
];

/**
 * Bare upstream body-error tokens forwarded verbatim by Steam (e.g.
 * `{"success":false,"error":"deleted"}`). Short single-token payloads with no
 * terminal marker indicate a degraded endpoint rather than a terminal
 * failure, so they are safe to retry.
 */
const BARE_BODY_ERROR_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/i;

/**
 * Classifies a Steam request failure from its HTTP status (null for
 * transport-level failures) and its error text (response body or error
 * message; null when unavailable). Pure: same inputs, same category.
 */
export function classifySteamError(status: number | null, errorText: string | null): SteamErrorCategory {
  if (status === 429) {
    return "RateLimited";
  }
  if (status === 401 || status === 403) {
    return "Auth";
  }

  const text = (errorText ?? "").trim();
  const lowered = text.toLowerCase();

  if (RATE_LIMIT_SUBSTRINGS.some((marker) => lowered.includes(marker))) {
    return "RateLimited";
  }
  if (AUTH_SUBSTRINGS.some((marker) => lowered.includes(marker))) {
    return "Auth";
  }

  // Terminal body markers (private profiles, credentials, bans): access
  // failures rather than degraded endpoints, so they are never transient.
  if (TERMINAL_MARKERS.some((marker) => lowered.includes(marker))) {
    return "Auth";
  }

  if (status !== null && status >= 500) {
    return "Transient";
  }
  if (TRANSIENT_SUBSTRINGS.some((marker) => lowered.includes(marker))) {
    return "Transient";
  }
  if (status === 0) {
    return "Transient";
  }
  if (text.length > 0 && BARE_BODY_ERROR_PATTERN.test(text)) {
    return "Transient";
  }
  return "Unknown";
}

export interface RateLimitCircuitBreakerOptions {
  /** Consecutive rate-limited failures before the breaker opens (default 1). */
  threshold?: number;
  /** Base cooldown in milliseconds (default 300000 = 5 min). */
  cooldownMs?: number;
  /** Upper bound for the growing cooldown (default 1800000 = 30 min). */
  maxCooldownMs?: number;
  /** Multiplier applied to the cooldown per consecutive rate-limit failure. */
  backoffFactor?: number;
  /** Injectable clock (defaults to Date.now) for deterministic tests. */
  now?: () => number;
}

/**
 * Fail-fast error for scan requests rejected while the breaker is open. The
 * message contains "rate limit" so `classifySteamError` maps it back to
 * `RateLimited`, and the `remainingMs` property carries the remaining cooldown
 * so callers can surface an actionable retry hint without parsing the message.
 */
export function buildRateLimitFailFastError(remainingMs: number): Error {
  const retryInSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const err = new Error(`Steam rate limit cooldown active, retry in ${retryInSeconds}s`);
  (err as Error & { remainingMs?: number }).remainingMs = remainingMs;
  return err;
}

/**
 * Global cooldown for scan requests to steamcommunity.com. Community rate
 * limits apply per session/IP, so a rate limit observed on one request
 * predicts failure on all of them: while open, every scan request fails fast
 * without calling Steam. Closes automatically once the cooldown elapses.
 *
 * Consecutive live rate-limit failures extend the effective cooldown with
 * exponential backoff (bounded by the cap), because Steam throttles can
 * outlast a single cooldown window. Fail-fast rejections never extend the
 * cooldown; only live failures do. A successful request resets the backoff.
 */
export class RateLimitCircuitBreaker {
  private openedAt: number | null = null;
  private consecutiveRateLimited = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly maxCooldownMs: number;
  private readonly backoffFactor: number;
  private readonly now: () => number;

  constructor(options: RateLimitCircuitBreakerOptions = {}) {
    const threshold = options.threshold ?? 1;
    this.threshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 1;
    const base = options.cooldownMs ?? 300000;
    this.cooldownMs = Number.isFinite(base) && base > 0 ? base : 300000;
    const max = options.maxCooldownMs ?? 1800000;
    this.maxCooldownMs = Number.isFinite(max) && max > 0 ? Math.max(max, this.cooldownMs) : 1800000;
    const factor = options.backoffFactor ?? 2;
    this.backoffFactor = Number.isFinite(factor) && factor > 1 ? factor : 2;
    this.now = options.now ?? Date.now;
  }

  /** Records a live rate-limit failure, opening the breaker once the threshold is reached. */
  recordRateLimited(): void {
    this.consecutiveRateLimited += 1;
    if (this.consecutiveRateLimited >= this.threshold && this.openedAt === null) {
      this.openedAt = this.now();
    }
  }

  /** Resets the backoff after a successful request. */
  recordSuccess(): void {
    this.consecutiveRateLimited = 0;
  }

  /**
   * Remaining cooldown in milliseconds, or 0 when the breaker is closed.
   * Closes an elapsed breaker. Fail-fast rejections leave the cooldown
   * expiry untouched.
   */
  check(): { allowed: boolean; remainingMs: number } {
    if (this.openedAt === null) {
      return { allowed: true, remainingMs: 0 };
    }
    const remainingMs = this.openedAt + this.effectiveCooldownMs() - this.now();
    if (remainingMs <= 0) {
      this.openedAt = null;
      return { allowed: true, remainingMs: 0 };
    }
    return { allowed: false, remainingMs };
  }

  private effectiveCooldownMs(): number {
    const extended = this.cooldownMs * Math.pow(this.backoffFactor, Math.max(0, this.consecutiveRateLimited - 1));
    return Math.min(extended, this.maxCooldownMs);
  }
}
