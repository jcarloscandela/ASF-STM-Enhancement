// Reusable GM/HTTP request service.
//
// Provides request-mechanism resolution, a promise-returning GET, and the
// shared retry/backoff policy the scan flows used to duplicate. Host-free by
// design: the GM functions and any scheduler are injected so this module is
// unit-testable without a browser.

/** The subset of a GM request response this module reads. */
export interface GmRequestResponse {
  status: number;
  responseText: string;
  /** Present on real GM responses; the raw body (used for HTML parsing). */
  response?: string;
}

/** The GM request options this module constructs. */
export interface GmRequestDetails {
  method: string;
  url: string;
  headers?: Record<string, string>;
  onload: (response: GmRequestResponse) => void;
  onerror: (error: unknown) => void;
  ontimeout: (error: unknown) => void;
  onabort?: (error: unknown) => void;
}

/** A GM request function (modern or legacy shape). */
export type GmRequestFunction = (details: GmRequestDetails) => void;

/** The modern userscript request API namespace, when the host provides one. */
export interface ModernGmApi {
  xmlHttpRequest: GmRequestFunction;
}

/** Host-provided request mechanisms; either may be absent. */
export interface RequestHost {
  legacyRequest?: GmRequestFunction | undefined;
  modernApi?: ModernGmApi | undefined;
}

/**
 * Resolves the request function to use: the modern API wins when present,
 * otherwise the legacy function. Throws a clear error when neither exists so
 * callers report a useful failure instead of crashing on `undefined`.
 */
export function resolveRequestFunction(host: RequestHost): GmRequestFunction {
  if (host.modernApi && typeof host.modernApi.xmlHttpRequest === "function") {
    return host.modernApi.xmlHttpRequest.bind(host.modernApi);
  }
  if (typeof host.legacyRequest === "function") {
    return host.legacyRequest;
  }
  throw new Error("No userscript request mechanism available (GM.xmlHttpRequest or GM_xmlhttpRequest)");
}

/** Success range for an HTTP status. */
function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export interface GmGetOptions {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Promise-returning GET. Resolves with the response text on a success status,
 * rejects with an error naming the HTTP status otherwise, and rejects on
 * transport error or timeout.
 */
export function gmGet(request: GmRequestFunction, options: GmGetOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    request({
      method: "GET",
      url: options.url,
      headers: options.headers,
      onload: (response) => {
        if (isSuccessStatus(response.status)) {
          resolve(response.responseText);
          return;
        }
        reject(new Error(`HTTP Error ${response.status}`));
      },
      onerror: () => reject(new Error("Request failed")),
      ontimeout: () => reject(new Error("Request timed out")),
    });
  });
}

/** Retry policy inputs as persisted in settings. */
export interface RetryPolicy {
  weblimiter: number;
  errorLimiter: number;
  maxErrors: number;
}

/**
 * One shared retry-delay calculation: the base web-limiter delay plus the
 * error limiter multiplied by the attempt count (0 for the first attempt).
 */
export function retryDelay(policy: RetryPolicy, attempt: number): number {
  return policy.weblimiter + policy.errorLimiter * attempt;
}

/**
 * Whether another attempt may be scheduled after `attempt` failures.
 * Retries stop once the failures exceed the configured maximum.
 */
export function canRetry(policy: RetryPolicy, attempt: number): boolean {
  return attempt <= policy.maxErrors;
}
