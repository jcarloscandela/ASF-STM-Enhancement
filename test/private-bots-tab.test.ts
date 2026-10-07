// Unit tests for the Private bots config tab renderer
// (src/templates/configDialogTemplate.ts): profile links, Limpiar buttons,
// fallbacks, and the empty state. No browser, no network.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { renderConfigDialog, renderPrivateBotsTab } from "../src/templates/configDialogTemplate";
import type { ConfigDialogSettings } from "../src/templates/configDialogTemplate";

function settings(): ConfigDialogSettings {
  return {
    matchFriends: false,
    anyBots: true,
    fairBots: true,
    botMinItems: 0,
    botMaxItems: 0,
    sortByName: true,
    preventClose: true,
    debug: false,
    weblimiter: 300,
    errorLimiter: 30000,
    maxErrors: 3,
    inventoryScanDelay: 3000,
    tradeMessage: "msg",
    doAfterTrade: "NOTHING",
    order: "AS_IS",
    autoSend: false,
    useScanFilters: false,
    autoAddScanFilters: true,
    autoDeleteScanFilters: true,
  };
}

describe("renderPrivateBotsTab", () => {
  it("renders profile links and Limpiar buttons for fixture entries", () => {
    const html = renderPrivateBotsTab([
      { steamId: "76561198000000001", nickname: "SomeBot", avatarHash: "abc123", totalItems: 42 },
    ]);
    assert.ok(html.includes("https://steamcommunity.com/profiles/76561198000000001"));
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes("SomeBot"));
    assert.ok(html.includes("(42 items)"));
    assert.ok(html.includes('data-private-clean="76561198000000001"'));
    assert.ok(html.includes("Limpiar"));
  });

  it("falls back to SteamID and default avatar when display data is missing", () => {
    const html = renderPrivateBotsTab([
      { steamId: "76561198000000002", nickname: null, avatarHash: null, totalItems: null },
    ]);
    assert.ok(html.includes("76561198000000002"));
    assert.ok(html.includes("fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb"));
  });

  it("renders an empty state with no rows and no fetches implied", () => {
    const html = renderPrivateBotsTab([]);
    assert.ok(!html.includes("data-private-clean"));
    assert.ok(html.includes("No hay bots privados"));
  });
});

describe("renderConfigDialog private tab", () => {
  it("includes the Private bots tab6 with the provided rows", () => {
    const rows = renderPrivateBotsTab([
      { steamId: "76561198000000001", nickname: "SomeBot", avatarHash: "abc123", totalItems: 1 },
    ]);
    const html = renderConfigDialog(settings(), "#ffffff", "q.png", "", "", "", rows);
    assert.ok(html.includes("Private bots"));
    assert.ok(html.includes("asf_stm_tab6"));
    assert.ok(html.includes("asf-stm-private-bots"));
    assert.ok(html.includes("SomeBot"));
  });
});
