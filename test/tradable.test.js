// Unit tests for the tradability helpers (src/lib/tradable.js).
//
// Run with exactly one command from the repo root (no dependencies, no browser,
// no network):
//
//   node --test test/
//
// Uses plain Steam-inventory-shaped fixtures. `describe`/`it` come from
// node:test, assertions from node:assert/strict.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    isTradableDescription,
    getTradableAfterTime,
    hasFutureTradeHold,
    isCurrentlyTradableDescription,
    isTradeOfferItemTradable,
    buildTradableCardCounts,
    resolveOwnedCount,
    buildScanEligibility,
} = require('../src/lib/tradable.js');

function cardDescription(overrides = {}) {
    return {
        classid: '100',
        instanceid: '200',
        market_fee_app: 753,
        market_hash_name: 'Game-Card A',
        tradable: 1,
        tags: [
            { category: 'item_class', internal_name: 'item_class_2' },
            { category: 'cardborder', internal_name: 'cardborder_0' },
        ],
        ...overrides,
    };
}

function asset(classid = '100', instanceid = '200') {
    return { classid, instanceid };
}

describe('isTradableDescription', () => {
    it('treats missing/positive flags as tradable', () => {
        for (const desc of [
            cardDescription({ tradable: 1 }),
            cardDescription({ tradable: '1' }),
            cardDescription({ tradable: true }),
        ]) {
            assert.equal(isTradableDescription(desc), true);
        }
        const noFlag = cardDescription();
        delete noFlag.tradable;
        assert.equal(isTradableDescription(noFlag), true);
    });

    it('treats false, 0 and "0" as trade-held', () => {
        for (const flag of [false, 0, '0']) {
            assert.equal(isTradableDescription(cardDescription({ tradable: flag })), false, `flag=${JSON.stringify(flag)}`);
        }
    });

    it('ignores market_tradable_restriction on tradable items', () => {
        const desc = cardDescription({ tradable: 1, market_tradable_restriction: 7 });
        assert.equal(isTradableDescription(desc), true);
    });
});

describe('time-gated trade holds ("Tradable After")', () => {
    // Fixed clock: 21 Sep 2026, noon local. All dates below are fixed relative
    // to it so the tests stay deterministic regardless of the real run date.
    const NOW = new Date(2026, 8, 21, 12, 0, 0).getTime();

    function heldDescription(value, overrides = {}) {
        return cardDescription({
            tradable: 1,
            descriptions: [{ value, color: '' }],
            ...overrides,
        });
    }

    it('treats a future DD/MM/YYYY hold as non-tradable (reported Alyx Vance case)', () => {
        const desc = heldDescription('Tradable After: 26/09/2026, 09:00:00');
        assert.equal(hasFutureTradeHold(desc, NOW), true);
        assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
    });

    it('treats a past hold as tradable again', () => {
        const desc = heldDescription('Tradable After: 01/09/2026, 09:00:00');
        assert.equal(hasFutureTradeHold(desc, NOW), false);
        assert.equal(isCurrentlyTradableDescription(desc, NOW), true);
    });

    it('parses month-name and ISO dates', () => {
        assert.equal(hasFutureTradeHold(heldDescription('Tradable After Sep 26, 2026'), NOW), true);
        assert.equal(hasFutureTradeHold(heldDescription('Tradable After 26 Sep 2026'), NOW), true);
        assert.equal(hasFutureTradeHold(heldDescription('Tradable After 2026-09-26'), NOW), true);
        assert.equal(hasFutureTradeHold(heldDescription('Tradable After Jan 1, 2020'), NOW), false);
    });

    it('reads the hold from owner_descriptions too', () => {
        const desc = cardDescription({
            tradable: 1,
            owner_descriptions: [{ value: 'Tradable After: 26/09/2026, 09:00:00', color: '' }],
        });
        assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
    });

    it('falls back to the tradable flag when the hold date is missing or unparseable', () => {
        const noDate = heldDescription('Tradable After soon');
        assert.equal(getTradableAfterTime(noDate), null);
        assert.equal(isCurrentlyTradableDescription(noDate, NOW), true);

        const policyText = heldDescription('Items are tradable after purchase on the market');
        assert.equal(isCurrentlyTradableDescription(policyText, NOW), true);

        const noLines = cardDescription({ tradable: 1 });
        assert.equal(isCurrentlyTradableDescription(noLines, NOW), true);
    });

    it('keeps the tradable flag authoritative for hard holds', () => {
        const heldFlag = heldDescription('Tradable After: 01/09/2026, 09:00:00', { tradable: 0 });
        assert.equal(isCurrentlyTradableDescription(heldFlag, NOW), false);

        const heldFlagPast = cardDescription({ tradable: false });
        assert.equal(isCurrentlyTradableDescription(heldFlagPast, NOW), false);
    });

    it('still ignores market_tradable_restriction when a dated hold is present', () => {
        const desc = heldDescription('Tradable After: 26/09/2026, 09:00:00', {
            market_tradable_restriction: 7,
        });
        assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
        const noHold = cardDescription({ tradable: 1, market_tradable_restriction: 7 });
        assert.equal(isCurrentlyTradableDescription(noHold, NOW), true);
    });

    it('excludes future-dated copies from tradable counts', () => {
        const future = cardDescription({
            classid: '101', instanceid: '201', tradable: 1,
            descriptions: [{ value: 'Tradable After: 26/09/2099, 09:00:00', color: '' }],
        });
        const past = cardDescription({
            classid: '102', instanceid: '202', tradable: 1,
            market_hash_name: 'Game-Card A',
            descriptions: [{ value: 'Tradable After: 01/01/2020, 09:00:00', color: '' }],
        });
        const inventory = {
            descriptions: [cardDescription(), future, past],
            assets: [asset(), asset('101', '201'), asset('102', '202')],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 2 } });
    });
});

describe('isTradeOfferItemTradable', () => {
    const NOW = new Date(2026, 8, 21, 12, 0, 0).getTime();

    function offerItem(overrides = {}) {
        return {
            market_hash_name: 'Game-Card A',
            tradable: 1,
            type: 'Trading Card',
            ...overrides,
        };
    }

    it('accepts plain tradable copies', () => {
        assert.equal(isTradeOfferItemTradable(offerItem(), NOW), true);
    });

    it('rejects flag-held copies', () => {
        assert.equal(isTradeOfferItemTradable(offerItem({ tradable: 0 }), NOW), false);
    });

    it('rejects future-dated holds', () => {
        const item = offerItem({
            descriptions: [{ value: 'Tradable After: 26/09/2026, 09:00:00', color: '' }],
        });
        assert.equal(isTradeOfferItemTradable(item, NOW), false);
    });

    it('accepts past-dated holds and unknown shapes (fail open)', () => {
        const past = offerItem({
            descriptions: [{ value: 'Tradable After: 01/01/2020, 09:00:00', color: '' }],
        });
        assert.equal(isTradeOfferItemTradable(past, NOW), true);
        assert.equal(isTradeOfferItemTradable(null, NOW), true);
        assert.equal(isTradeOfferItemTradable({}, NOW), true);
    });
});

describe('buildTradableCardCounts', () => {
    it('counts tradable copies per app and card, excluding held copies', () => {
        const held = cardDescription({ classid: '101', instanceid: '201', tradable: 0 });
        const inventory = {
            descriptions: [cardDescription(), held],
            assets: [asset(), asset(), asset('101', '201'), asset('101', '201')],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 2 } });
    });

    it('keeps an empty map for games whose cards are all held (known-zero)', () => {
        const inventory = {
            descriptions: [cardDescription({ tradable: false })],
            assets: [asset()],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: {} });
    });

    it('excludes foil cards and non-card items', () => {
        const foil = cardDescription({
            classid: '102', instanceid: '202',
            tags: [
                { category: 'item_class', internal_name: 'item_class_2' },
                { category: 'cardborder', internal_name: 'cardborder_1' },
            ],
        });
        const booster = cardDescription({
            classid: '103', instanceid: '203',
            tags: [{ category: 'item_class', internal_name: 'item_class_3' }],
        });
        const inventory = {
            descriptions: [cardDescription(), foil, booster],
            assets: [asset(), asset('102', '202'), asset('103', '203')],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 1 } });
    });

    it('skips descriptions without market_fee_app or market_hash_name', () => {
        const noApp = cardDescription({ classid: '104', instanceid: '204' });
        delete noApp.market_fee_app;
        const noHash = cardDescription({ classid: '105', instanceid: '205' });
        delete noHash.market_hash_name;
        const inventory = {
            descriptions: [cardDescription(), noApp, noHash],
            assets: [asset(), asset('104', '204'), asset('105', '205')],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 1 } });
    });

    it('ignores assets with no matching description', () => {
        const inventory = {
            descriptions: [cardDescription()],
            assets: [asset(), asset('999', '999')],
        };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 1 } });
    });

    it('works without a debugPrint global (release build / Node)', () => {
        assert.equal(typeof globalThis.debugPrint, 'undefined');
        const inventory = { descriptions: [cardDescription()], assets: [asset()] };
        assert.deepEqual(buildTradableCardCounts(inventory), { 753: { 'Game-Card A': 1 } });
    });

    it('logs a summary when a debugPrint global exists', () => {
        const messages = [];
        globalThis.debugPrint = (msg) => messages.push(msg);
        try {
            const inventory = { descriptions: [cardDescription()], assets: [asset()] };
            buildTradableCardCounts(inventory);
            assert.match(messages.join('\n'), /1 card app\(s\)/);
        } finally {
            delete globalThis.debugPrint;
        }
    });
});

describe('resolveOwnedCount', () => {
    it('returns the owned fallback when tradability is unknown (null)', () => {
        assert.equal(resolveOwnedCount(null, 753, 'Game-Card A', 5), 5);
    });

    it('returns the owned fallback when the badge has no tradability entry', () => {
        assert.equal(resolveOwnedCount({ 999: { 'Other': 2 } }, 753, 'Game-Card A', 5), 5);
    });

    it('returns zero for a known-empty game instead of the owned value', () => {
        assert.equal(resolveOwnedCount({ 753: {} }, 753, 'Game-Card A', 5), 0);
    });

    it('returns the tradable count, defaulting missing hashes to zero', () => {
        const counts = { 753: { 'Game-Card A': 2 } };
        assert.equal(resolveOwnedCount(counts, 753, 'Game-Card A', 5), 2);
        assert.equal(resolveOwnedCount(counts, 753, 'Game-Card B', 5), 0);
    });
});

describe('buildScanEligibility', () => {
    it('flags evenly distributed badges as balanced', () => {
        const result = buildScanEligibility(
            { 753: { A: 2, B: 2, C: 2, D: 2, E: 2 } },
            { 753: { size: 5, name: 'Game' } },
        );
        assert.equal(result[753].unbalanced, false);
        assert.equal(result[753].max_size, 5);
    });

    it('flags unevenly distributed badges as unbalanced', () => {
        const result = buildScanEligibility(
            { 753: { A: 3, B: 1, C: 1, D: 1, E: 1 } },
            { 753: { size: 5, name: 'Game' } },
        );
        assert.equal(result[753].unbalanced, true);
    });

    it('flags badges with missing cards as unbalanced once a set exists', () => {
        const result = buildScanEligibility(
            { 753: { A: 2, B: 2 } },
            { 753: { size: 5, name: 'Game' } },
        );
        assert.equal(result[753].unbalanced, true);
    });

    it('skips games absent from the badges database', () => {
        const result = buildScanEligibility(
            { 12345: { A: 5 } },
            { 753: { size: 5, name: 'Game' } },
        );
        assert.deepEqual(result, {});
    });
});
