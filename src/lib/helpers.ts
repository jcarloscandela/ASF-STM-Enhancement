// Pure, side-effect-free helper functions extracted verbatim from the
// userscript body. No DOM, XHR, `GM_*`, or storage access: the two color
// helpers take an optional logger for their existing fallback diagnostics so
// debug output stays identical while the module remains host-free.
//
// Behavior is intentionally unchanged from `src/ASF-STM.ts`.

/** Optional diagnostics sink; defaults to a no-op. */
export type HelperLogger = (message: string) => void;

const noop: HelperLogger = () => {};

/** Deep clone via JSON round-trip, matching the original behavior. */
export function deepClone<T>(object: T): T {
  return JSON.parse(JSON.stringify(object));
}

/** Steam trailing-id helper (account id within the 2^32 space). */
export function getPartner(str: string): string {
  if (typeof BigInt !== "undefined") {
    return (BigInt(str) % BigInt(4294967296)).toString(); // eslint-disable-line
  } else {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      result = (result * 10 + Number(str[i])) % 4294967296;
    }
    return result.toString();
  }
}

export function arrayToText(array: string[]): string {
  return array.join(",\n");
}

const NUMERIC_ENTRY = /^\d+$/;

export function textToArray(text: string): string[] {
  let res: string[] = [];
  text.split(",").forEach(function (elem) {
    if (NUMERIC_ENTRY.test(elem.trim())) {
      res.push(elem.trim());
    }
  });
  return res;
}

export function hexToRgba(hex: string): string {
  return (
    "rgba(" +
    [Number("0x" + hex.substring(1, 3)), Number("0x" + hex.substring(3, 5)), Number("0x" + hex.substring(5, 7))].join(
      ",",
    ) +
    ",1)"
  );
}

/**
 * Parses an `rgba(...)` string into `[#rrggbb, alpha]`. Falls back to the
 * original default and reports through the injected logger when unparseable.
 */
export function rgbaToHex(rgba: string, log: HelperLogger = noop): [string, number] | string {
  let re = /rgba\(([.\d]+),([.\d]+),([.\d]+),([.\d]+)\)/g;
  let result = re.exec(rgba);
  if (result === null || result.length !== 5) {
    log("failed to parse color!");
    return ["#171a21", 0.8];
  }
  return [
    "#" + Number(result[1]).toString(16) + Number(result[2]).toString(16) + Number(result[3]).toString(16),
    Number(result[4]),
  ];
}

/**
 * Replaces the alpha component of an `rgba(...)` string. Returns the input
 * unchanged and reports through the injected logger when unparseable.
 */
export function mixAlpha(rgba: string, alpha: string, log: HelperLogger = noop): string {
  let re = /(rgba\([.\d]+,[.\d]+,[.\d]+,)([.\d]+)\)/g;
  let result = re.exec(rgba);
  if (result) {
    return result[1] + alpha + ")";
  }
  log("failed to mix alpha!");
  return rgba;
}

/**
 * Simple function to sanitize nicknames before adding them to the DOM.
 * Taken from https://stackoverflow.com/a/48226843/5853386
 */
export function sanitizeNickname(nickname: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  const reg = /[&<>"'/]/gi;
  return nickname.replace(reg, (match) => map[match] as string);
}
