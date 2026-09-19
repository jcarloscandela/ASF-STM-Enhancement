// Shared tradability helpers for ASF-STM-Enhancement.
//
// Single source of truth: unit tests import this file directly with Node,
// and script/build.py inlines it into src/ASF-STM.js (TRADABLE_LIB slot) so
// the distributed userscripts stay single-file.
//
// Logging: debugPrint() only exists in the debug userscript build (the release
// build strips its definition). The typeof guard below is safe in all three
// contexts: debug build logs, release build and Node stay silent unless the
// host defines a global debugPrint (tests use that to capture the message).

function isTradableDescription(description) {
    // `tradable` is the current trade state. `market_tradable_restriction` is only the
    // post-market cooldown period (e.g. 7) and is present even on tradable items, so it
    // must not be used to decide tradability here.
    return description.tradable !== false && description.tradable !== 0 && description.tradable !== "0";
}

function buildTradableCardCounts(inventoryData) {
    const counts = {};
    const descriptionByClassInstance = new Map();
    const heldClassInstances = new Set();
    let excluded = 0;

    for (const description of inventoryData.descriptions) {
        const isCard = description.tags?.some(
            tag => tag.category === "item_class" && tag.internal_name === "item_class_2"
        );
        const isRegular = description.tags?.some(tag => tag.internal_name === "cardborder_0");

        if (!isCard || !isRegular) {
            continue;
        }

        const appId = description.market_fee_app;
        if (appId === undefined) {
            continue;
        }

        if (!(appId in counts)) {
            counts[appId] = {};
        }

        const classInstance = `${description.classid}_${description.instanceid}`;

        if (!isTradableDescription(description)) {
            heldClassInstances.add(classInstance);
            continue;
        }

        descriptionByClassInstance.set(classInstance, description);
    }

    for (const asset of inventoryData.assets) {
        const classInstance = `${asset.classid}_${asset.instanceid}`;
        const description = descriptionByClassInstance.get(classInstance);

        if (!description) {
            if (heldClassInstances.has(classInstance)) {
                excluded++;
            }
            continue;
        }

        const hash = description.market_hash_name;
        if (!hash) {
            continue;
        }

        counts[description.market_fee_app][hash] = (counts[description.market_fee_app][hash] || 0) + 1;
    }

    if (typeof debugPrint === "function") {
        debugPrint(`Tradability: ${Object.keys(counts).length} card app(s), ${excluded} trade-held card(s) excluded`);
    }

    return counts;
}

// Owned-count override used by GetOwnCards: tradable counts win when known,
// otherwise fall back to the Steam badge-page `owned` value.
//   tradableCardCounts === null/undefined  -> unknown, use ownedFallback
//   appId absent from lookup              -> unknown for this badge, use ownedFallback
//   appId present (even with empty map)   -> known, missing hashes count as 0
function resolveOwnedCount(tradableCardCounts, appId, marketHash, ownedFallback) {
    if (tradableCardCounts === null || tradableCardCounts === undefined) {
        return ownedFallback;
    }
    if (!(appId in tradableCardCounts)) {
        return ownedFallback;
    }
    return tradableCardCounts[appId][marketHash] || 0;
}

// Maps tradable card counts onto the badges database: only games present in the
// database get an entry, each flagged `unbalanced` when the tradable copies are
// unevenly distributed (i.e. the badge is worth matching).
function buildScanEligibility(tradableCardCounts, badgeCardData) {
    const scanResult = {};

    /* Map tradable card counts to appId */
    for (const appId of Object.keys(tradableCardCounts)) {
        if (!(appId in badgeCardData)) {
            continue;
        }

        scanResult[appId] = {
            data: tradableCardCounts[appId],
            max_size: badgeCardData[appId].size,
            unbalanced: undefined,
        };
    }

    /* Check for unbalanced appIds */
    for (const appId in scanResult) {
        const { data, max_size } = scanResult[appId];

        const counts = Object.values(data);
        const count = counts.reduce((acc, a) => acc + a, 0);
        const size = Object.keys(data).length;

        const min = Math.floor(count / max_size);
        const max = Math.ceil(count / max_size);

        scanResult[appId].unbalanced = counts.some(
            count => count !== min && count !== max
        );

        // Missing classids count as 0
        if (size < max_size && min > 0) {
            scanResult[appId].unbalanced = true;
        }
    }

    return scanResult;
}

// Inert when inlined into the userscript (no `module` there); used by Node tests.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        isTradableDescription,
        buildTradableCardCounts,
        resolveOwnedCount,
        buildScanEligibility,
    };
}
