// Unit tests for the settings helpers (src/lib/settings.js).
//
// Run with exactly one command from the repo root (no dependencies, no browser,
// no network):
//
//   node --test test/
//
// Uses plain settings-shaped fixtures. `describe`/`it` come from
// node:test, assertions from node:assert/strict.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    mergeWithDefaults,
    getActiveScanFilters,
    resolveScanPlan,
} = require('../src/lib/settings.js');

function baseDefaults() {
    return {
        inventoryScan: false,
        inventoryScanDelay: 3000,
        useScanFilters: false,
        scanFilters: [],
        sortBotsBy: ['MatchEverythingFirst'],
    };
}

describe('mergeWithDefaults', () => {
    it('preserves a stored inventoryScan:true and fills missing keys with defaults', () => {
        const stored = { inventoryScan: true };
        const merged = mergeWithDefaults(stored, baseDefaults());
        assert.equal(merged.inventoryScan, true);
        assert.equal(merged.inventoryScanDelay, 3000);
        assert.equal(merged.useScanFilters, false);
        assert.deepEqual(merged.scanFilters, []);
    });

    it('returns fresh defaults when nothing usable was stored', () => {
        for (const stored of [null, undefined, 'corrupt', 42, []]) {
            const merged = mergeWithDefaults(stored, baseDefaults());
            assert.deepEqual(merged, baseDefaults(), `stored=${JSON.stringify(stored)}`);
        }
    });

    it('keeps explicit falsy stored values instead of overwriting them', () => {
        const stored = { inventoryScan: false, inventoryScanDelay: 0 };
        const merged = mergeWithDefaults(stored, baseDefaults());
        assert.equal(merged.inventoryScan, false);
        assert.equal(merged.inventoryScanDelay, 0);
    });

    it('does not alias the defaults object', () => {
        const defaults = baseDefaults();
        const merged = mergeWithDefaults(null, defaults);
        merged.scanFilters.push({ appId: 1 });
        merged.sortBotsBy.push('None');
        assert.deepEqual(defaults.scanFilters, []);
        assert.deepEqual(defaults.sortBotsBy, ['MatchEverythingFirst']);
    });

    it('preserves unknown stored keys', () => {
        const merged = mergeWithDefaults({ futureFlag: 1 }, baseDefaults());
        assert.equal(merged.futureFlag, 1);
    });
});

describe('resolveScanPlan', () => {
    it('selects the inventory scan when inventoryScan is saved as true', () => {
        const plan = resolveScanPlan({ inventoryScan: true, useScanFilters: false, scanFilters: [] });
        assert.equal(plan.mode, 'inventory');
        assert.equal(plan.inventoryScan, true);
    });

    it('selects the badge-page scan when inventoryScan is saved as false', () => {
        const plan = resolveScanPlan({ inventoryScan: false, useScanFilters: false, scanFilters: [] });
        assert.equal(plan.mode, 'badge');
    });

    it('gives active scan filters precedence over the inventory scan', () => {
        const plan = resolveScanPlan({
            inventoryScan: true,
            useScanFilters: true,
            scanFilters: [{ appId: 730, title: 'Game', active: true }],
        });
        assert.equal(plan.mode, 'filters');
        assert.deepEqual(plan.activeFilterAppIds, [730]);
    });

    it('ignores inactive scan filters', () => {
        const plan = resolveScanPlan({
            inventoryScan: true,
            useScanFilters: true,
            scanFilters: [{ appId: 730, title: 'Game', active: false }],
        });
        assert.equal(plan.mode, 'inventory');
    });

    it('falls back to the badge-page scan for missing settings', () => {
        assert.equal(resolveScanPlan(null).mode, 'badge');
        assert.equal(resolveScanPlan({}).mode, 'badge');
    });
});

describe('getActiveScanFilters', () => {
    it('returns only active filters and tolerates bad shapes', () => {
        const settings = {
            scanFilters: [
                { appId: 1, active: true },
                { appId: 2, active: false },
                null,
            ],
        };
        assert.deepEqual(getActiveScanFilters(settings), [{ appId: 1, active: true }]);
        assert.deepEqual(getActiveScanFilters(null), []);
        assert.deepEqual(getActiveScanFilters({}), []);
    });
});
