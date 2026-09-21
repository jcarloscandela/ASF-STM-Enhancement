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

// Time-gated trade holds ("Tradable After <date>").
//
// Steam renders a per-item hold as a "Tradable After" text line inside the description
// text (the `descriptions` / `owner_descriptions` entries of the inventory response,
// mirrored on the trade-offer page). The line only appears while a hold is active, so
// a parseable date in the future means the copy cannot be traded yet. Anything
// unparseable fails open: the `tradable` flag verdict applies (see
// isCurrentlyTradableDescription). The fixed post-market cooldown field
// (`market_tradable_restriction`) is never consulted here.
const TRADABLE_AFTER_MARKER = /tradable\s+after/i;

function stripMarkup(value) {
    return String(value).replace(/<[^>]*>/g, " ");
}

function descriptionHoldTexts(description) {
    const texts = [];
    for (const key of ["descriptions", "owner_descriptions"]) {
        const lines = description[key];
        if (!Array.isArray(lines)) {
            continue;
        }
        for (const line of lines) {
            if (line && typeof line.value === "string" && TRADABLE_AFTER_MARKER.test(line.value)) {
                texts.push(stripMarkup(line.value));
            }
        }
    }
    return texts;
}

function monthNameToIndex(name) {
    const months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ];
    const lower = name.toLowerCase();
    return months.findIndex(month => month.startsWith(lower));
}

function toTimestamp(year, monthIndex, day, hour, minute, second) {
    if (
        !Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day) ||
        monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31 ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
    ) {
        return null;
    }
    return new Date(year, monthIndex, day, hour, minute, second).getTime();
}

// Parses every "Tradable After" date found in a description and returns the latest
// hold timestamp (ms epoch), or null when no date can be parsed. Pure parse step:
// callers decide what "future" means by comparing against their clock.
function getTradableAfterTime(description) {
    if (!description || typeof description !== "object") {
        return null;
    }
    let latest = null;
    const consider = (timestamp) => {
        if (timestamp !== null && (latest === null || timestamp > latest)) {
            latest = timestamp;
        }
    };

    for (const text of descriptionHoldTexts(description)) {
        let match;

        // ISO: 2026-09-26, optional time.
        const isoRe = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/g;
        while ((match = isoRe.exec(text)) !== null) {
            consider(toTimestamp(
                Number(match[1]), Number(match[2]) - 1, Number(match[3]),
                Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)
            ));
        }

        // Month names: "Sep 26, 2026", "26 Sep 2026", "September 26, 2026", optional time.
        const monthRe = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?/gi;
        const monthDayYearRe = new RegExp(
            monthRe.source + "\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})" +
            "(?:\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)?)?",
            "gi"
        );
        while ((match = monthDayYearRe.exec(text)) !== null) {
            let hour = Number(match[4] ?? 0);
            const meridiem = (match[7] || "").toLowerCase();
            if (meridiem === "pm" && hour < 12) {
                hour += 12;
            }
            if (meridiem === "am" && hour === 12) {
                hour = 0;
            }
            consider(toTimestamp(
                Number(match[3]), monthNameToIndex(match[1]), Number(match[2]),
                hour, Number(match[5] ?? 0), Number(match[6] ?? 0)
            ));
        }
        const dayMonthYearRe = new RegExp(
            "(\\d{1,2})(?:st|nd|rd|th)?\\s+" + monthRe.source + "\\.?\\s*,?\\s+(\\d{4})" +
            "(?:\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?",
            "gi"
        );
        while ((match = dayMonthYearRe.exec(text)) !== null) {
            consider(toTimestamp(
                Number(match[3]), monthNameToIndex(match[2]), Number(match[1]),
                Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)
            ));
        }

        // Numeric: 26/09/2026 or 09/26/2026, optional time. The inventory is fetched
        // with l=english, so an ambiguous all-small date reads month-first; an
        // out-of-range part disambiguates day-first (e.g. 26/09/2026).
        const numericRe = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g;
        while ((match = numericRe.exec(text)) !== null) {
            const first = Number(match[1]);
            const second = Number(match[2]);
            let year = Number(match[3]);
            if (year < 100) {
                year += 2000;
            }
            const dayFirst = first > 12 || second > 12 ? first > 12 : false;
            const month = (dayFirst ? second : first) - 1;
            const day = dayFirst ? first : second;
            consider(toTimestamp(
                year, month, day,
                Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)
            ));
        }
    }
    return latest;
}

function hasFutureTradeHold(description, now) {
    const current = now === undefined ? Date.now() : now;
    const holdTime = getTradableAfterTime(description);
    return holdTime !== null && holdTime > current;
}

// Full verdict for one inventory description: the `tradable` flag AND the
// time-gated hold must both allow trading right now.
function isCurrentlyTradableDescription(description, now) {
    return isTradableDescription(description) && !hasFutureTradeHold(description, now);
}

// Verdict for one live trade-offer inventory entry (`rgInventory` items mirror the
// description shape: a `tradable` flag plus `descriptions` text lines).
function isTradeOfferItemTradable(item, now) {
    if (!item || typeof item !== "object") {
        return true;
    }
    return isCurrentlyTradableDescription(item, now);
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

        if (!isCurrentlyTradableDescription(description)) {
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
        getTradableAfterTime,
        hasFutureTradeHold,
        isCurrentlyTradableDescription,
        isTradeOfferItemTradable,
        buildTradableCardCounts,
        resolveOwnedCount,
        buildScanEligibility,
    };
}
