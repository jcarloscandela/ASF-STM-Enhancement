import { describe, expect, it } from "vitest";

import {
  BUILT_USERSCRIPT_BUDGET_BYTES,
  COMPACT_DATASET_BUDGET_BYTES,
  compactDatasetForPublish,
  normalizeDataset,
} from "../src/lib/dataset";

const FIXTURE = {
  "220": {
    size: 8,
    name: "Half-Life 2",
    cards: [
      {
        hash: "220-Alyx Vance",
        title: "Alyx Vance",
        iconUrl:
          "https://community.fastly.steamstatic.com/economy/image/IzMF03bk9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdA3g5gMEPvUZZEfSMJ6dESN8p_2SVTY7V2NsNxTAIL1",
      },
      {
        hash: "220-Gordon & Alyx (Trading Card)",
        title: "Gordon & Alyx",
        iconUrl:
          "https://community.fastly.steamstatic.com/economy/image/IzMF03bk9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdA3g5gMEPvUZZEfSMJ6dESN8p_2SVTY7V2NsNxTAIL2",
      },
      { hash: "220-Foil Escape", title: "Foil Escape", iconUrl: "https://example.com/foil.png" },
      { hash: "Special Promo Card" },
    ],
  },
  "1000010": { size: 5 },
};

describe("compact publish dataset", () => {
  it("round-trips losslessly through the publish encoding", () => {
    const compact = compactDatasetForPublish(FIXTURE);
    const decoded = normalizeDataset(compact);
    expect(decoded).toEqual(normalizeDataset(FIXTURE));
    expect(decoded["220"]?.cards?.[0]?.hash).toBe("220-Alyx Vance");
    expect(decoded["220"]?.cards?.[0]?.title).toBe("Alyx Vance");
    expect(decoded["220"]?.cards?.[0]?.iconUrl).toBe(FIXTURE["220"].cards[0]?.iconUrl);
    expect(decoded["220"]?.cards?.[1]?.title).toBe("Gordon & Alyx");
    expect(decoded["220"]?.cards?.[2]?.iconUrl).toBe("https://example.com/foil.png");
    expect(decoded["220"]?.cards?.[3]).toEqual({ hash: "Special Promo Card" });
    expect(decoded["1000010"]).toEqual({ size: 5 });
  });

  it("compact encoding is smaller than the authoring JSON and within budget", () => {
    const rawBytes = Buffer.byteLength(JSON.stringify(FIXTURE), "utf8");
    const compactBytes = Buffer.byteLength(JSON.stringify(compactDatasetForPublish(FIXTURE)), "utf8");
    expect(compactBytes).toBeLessThan(rawBytes);
    expect(COMPACT_DATASET_BUDGET_BYTES).toBeGreaterThan(0);
    expect(BUILT_USERSCRIPT_BUDGET_BYTES).toBeGreaterThan(COMPACT_DATASET_BUDGET_BYTES);
  });

  it("legacy shapes still decode", () => {
    expect(normalizeDataset([{ app_id: "7", card_count: "3" }])).toEqual({ "7": { size: 3 } });
    expect(normalizeDataset({ "7": { s: 3, n: "G", c: [{ h: "x", t: "y", u: "z" }] } })["7"]?.size).toBe(3);
  });

  it("round-trips the real bundled dataset losslessly", async () => {
    const raw = (await import("../data/badge_cards.json")).default as Record<string, { size: number }>;
    const expected = normalizeDataset(raw);
    const decoded = normalizeDataset(compactDatasetForPublish(expected));
    expect(decoded).toEqual(expected);
  }, 30000);
});
