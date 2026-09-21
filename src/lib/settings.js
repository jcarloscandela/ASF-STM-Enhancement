// Shared settings helpers for ASF-STM-Enhancement.
//
// Single source of truth: unit tests import this file directly with Node,
// and script/build.py inlines it into src/ASF-STM.js (SETTINGS_LIB slot) so
// the distributed userscripts stay single-file.

function cloneSettingValue(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// Merges persisted settings over the defaults: stored values win (including
// explicit false/0), missing keys receive a fresh copy of their default, and
// unknown stored keys are preserved. A missing or corrupt stored object yields
// the defaults, so a stored `inventoryScan: true` is never clobbered.
function mergeWithDefaults(stored, defaults) {
    const base = defaults && typeof defaults === "object" && !Array.isArray(defaults) ? defaults : {};
    const merged = {};
    for (const key of Object.keys(base)) {
        merged[key] = cloneSettingValue(base[key]);
    }
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        for (const key of Object.keys(stored)) {
            if (stored[key] !== undefined) {
                merged[key] = stored[key];
            }
        }
    }
    return merged;
}

function getActiveScanFilters(settings) {
    if (!settings || !Array.isArray(settings.scanFilters)) {
        return [];
    }
    return settings.scanFilters.filter(filter => filter && filter.active);
}

// Resolves which scan path a run must take from the settings snapshot captured
// when Scan was clicked. Scan filters take precedence by design; otherwise the
// persisted `inventoryScan` flag decides between the inventory scan and the
// badge-page scan, so the executed path always matches the saved setting.
function resolveScanPlan(settings) {
    const activeFilters = getActiveScanFilters(settings);
    if (settings && settings.useScanFilters && activeFilters.length > 0) {
        return {
            mode: "filters",
            inventoryScan: Boolean(settings.inventoryScan),
            useScanFilters: true,
            activeFilterAppIds: activeFilters.map(filter => filter.appId),
        };
    }
    if (settings && settings.inventoryScan) {
        return {
            mode: "inventory",
            inventoryScan: true,
            useScanFilters: false,
            activeFilterAppIds: [],
        };
    }
    return {
        mode: "badge",
        inventoryScan: false,
        useScanFilters: false,
        activeFilterAppIds: [],
    };
}

// Inert when inlined into the userscript (no `module` there); used by Node tests.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        mergeWithDefaults,
        getActiveScanFilters,
        resolveScanPlan,
    };
}
