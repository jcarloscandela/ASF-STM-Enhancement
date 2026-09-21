// Unit tests for the pure helpers (src/lib/helpers.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Plain fixtures; no browser, network, or host state.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  arrayToText,
  deepClone,
  getPartner,
  hexToRgba,
  mixAlpha,
  rgbaToHex,
  sanitizeNickname,
  textToArray,
} from "../src/lib/helpers";

describe("deepClone", () => {
  it("returns an independent copy", () => {
    const original = { a: 1, nested: { b: [1, 2] } };
    const copy = deepClone(original);
    assert.deepEqual(copy, original);
    copy.nested.b.push(3);
    assert.deepEqual(original.nested.b, [1, 2], "mutating the clone must not touch the source");
  });

  it("drops undefined-valued keys exactly like JSON round-tripping", () => {
    const copy = deepClone({ a: 1, b: undefined }) as Record<string, unknown>;
    assert.equal("b" in copy, false);
  });
});

describe("getPartner", () => {
  it("reduces a SteamID64 to its 32-bit account id", () => {
    assert.equal(getPartner("76561198000000001"), (BigInt("76561198000000001") % BigInt(4294967296)).toString());
  });

  it("handles the small-id boundary", () => {
    assert.equal(getPartner("0"), "0");
    assert.equal(getPartner("4294967295"), "4294967295");
    assert.equal(getPartner("4294967296"), "0");
  });
});

describe("arrayToText / textToArray", () => {
  it("joins with comma-newline and parses back numeric entries", () => {
    const ids = ["123", "456"];
    assert.equal(arrayToText(ids), "123,\n456");
    assert.deepEqual(textToArray(arrayToText(ids)), ids);
  });

  it("filters out non-numeric and blank entries while trimming", () => {
    assert.deepEqual(textToArray(" 123 , abc , , 456 ,12x"), ["123", "456"]);
  });

  it("returns an empty list for empty or non-numeric input", () => {
    assert.deepEqual(textToArray(""), []);
    assert.deepEqual(textToArray("abc, def"), []);
  });
});

describe("hexToRgba", () => {
  it("converts #rrggbb to rgba with alpha 1", () => {
    assert.equal(hexToRgba("#171a21"), "rgba(23,26,33,1)");
    assert.equal(hexToRgba("#ffffff"), "rgba(255,255,255,1)");
    assert.equal(hexToRgba("#000000"), "rgba(0,0,0,1)");
  });
});

describe("rgbaToHex", () => {
  it("round-trips a well-formed rgba string", () => {
    assert.deepEqual(rgbaToHex(hexToRgba("#171a21")), ["#171a21", 1]);
  });

  it("keeps the alpha component", () => {
    const [hex, alpha] = rgbaToHex("rgba(23,26,33,0.8)") as [string, number];
    assert.equal(hex, "#171a21");
    assert.equal(alpha, 0.8);
  });

  it("falls back to the default and logs when unparseable", () => {
    const messages: string[] = [];
    assert.deepEqual(
      rgbaToHex("not-a-color", (m) => messages.push(m)),
      ["#171a21", 0.8],
    );
    assert.deepEqual(messages, ["failed to parse color!"]);
  });

  it("does not log for a valid color", () => {
    const messages: string[] = [];
    rgbaToHex("rgba(1,2,3,0.5)", (m) => messages.push(m));
    assert.deepEqual(messages, []);
  });
});

describe("mixAlpha", () => {
  it("replaces the alpha component", () => {
    assert.equal(mixAlpha("rgba(23,26,33,0.8)", "0.5"), "rgba(23,26,33,0.5)");
  });

  it("returns the input and logs when unparseable", () => {
    const messages: string[] = [];
    assert.equal(
      mixAlpha("nope", "0.5", (m) => messages.push(m)),
      "nope",
    );
    assert.deepEqual(messages, ["failed to mix alpha!"]);
  });

  it("does not log for a valid color", () => {
    const messages: string[] = [];
    mixAlpha("rgba(1,2,3,0.2)", "0.9", (m) => messages.push(m));
    assert.deepEqual(messages, []);
  });
});

describe("sanitizeNickname", () => {
  it("escapes every HTML-sensitive character", () => {
    assert.equal(
      sanitizeNickname(`<b>"Bob" & 'Alice'/x</b>`),
      "&lt;b&gt;&quot;Bob&quot; &amp; &#x27;Alice&#x27;&#x2F;x&lt;&#x2F;b&gt;",
    );
  });

  it("leaves ordinary nicknames untouched", () => {
    assert.equal(sanitizeNickname("Plain Nickname 123"), "Plain Nickname 123");
  });

  it("handles an empty nickname", () => {
    assert.equal(sanitizeNickname(""), "");
  });
});
