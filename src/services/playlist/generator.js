const logger = require('../../logger');
const config = require('../../config');
const PlaylistRow = require('./PlaylistRow');

function pickLogo(urls) {
    if (!urls || urls.length === 0) {
        return '';
    }
    const type0 = urls.filter((u) => u.type === 0 && u.url).map((u) => u.url);
    if (type0.length > 0) {
        return type0[0];
    }
    const anyUrl = urls.find((u) => u.url);
    return anyUrl ? anyUrl.url : '';
}

function generateM3u8(results) {
    const groupToItems = {};
    const groupToInfohashes = {};
    const uniqueCountries = new Set();
    const uniqueCategories = new Set();

    for (const res of results) {
        const name = res.name || 'Unknown';
        const epg = res.epg || [];
        const epgTitle = (Array.isArray(epg) && epg.length > 0 ? epg[0].name : '') || '';
        const icons = res.icons || [];
        const logo = pickLogo(icons);

        const items = res.items || [];
        if (items.length === 0) continue;

        for (const item of items) {
            const infohash = item.infohash;
            if (!infohash) continue;

            if (Array.isArray(config.INFOHASH_BLACKLIST) && config.INFOHASH_BLACKLIST.includes(infohash)) {
                logger.info(`Skipping blacklisted infohash: ${infohash} (${name})`);
                continue;
            }

            const countries = item.countries || [];
            const itemCategories = item.categories || [];

            const assignedGroups = []; // Change to collect all assigned groups
            let hasCategoryOverride = false;
            let hasCountryOverride = false;

            // 1. Check INFOHASH_CATEGORY_OVERRIDE
            for (const [gName, infohashes] of Object.entries(config.INFOHASH_CATEGORY_OVERRIDE)) {
                if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
                    assignedGroups.push({name: gName});
                    hasCategoryOverride = true;
                }
            }

            // 2. Check INFOHASH_COUNTRY_OVERRIDE
            for (const [gName, infohashes] of Object.entries(config.INFOHASH_COUNTRY_OVERRIDE)) {
                if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
                    const countryEntry = config.COUNTRY_MAP.find(cm => cm.name === gName);
                    assignedGroups.push({
                        name: gName,
                        countryCode: countryEntry ? countryEntry.code : null
                    });
                    hasCountryOverride = true;
                }
            }

            // 3. Check CATEGORY_REMAP
            if (!hasCategoryOverride) {
                for (const cat of itemCategories) {
                    const catLower = cat.toLowerCase();
                    const remap = config.CATEGORY_REMAP.find(r => r.sources.includes(catLower));
                    if (remap) {
                        if (!assignedGroups.some(g => g.name === remap.name)) {
                            assignedGroups.push({name: remap.name});
                        }
                    }
                }
            }

            // 4. Check COUNTRY_MAP
            if (!hasCountryOverride) {
                for (const c of countries) {
                    const cLower = c.toLowerCase();
                    const countryEntry = config.COUNTRY_MAP.find(cm => cm.code === cLower);
                    if (countryEntry) {
                        if (!assignedGroups.some(g => g.name === countryEntry.name)) {
                            assignedGroups.push({
                                name: countryEntry.name,
                                countryCode: countryEntry.code
                            });
                        }
                    }
                }
            }

            if (assignedGroups.length === 0) continue;

            for (const cat of itemCategories) {
                uniqueCategories.add(cat.toLowerCase());
            }
            for (const c of countries) {
                uniqueCountries.add(c.toLowerCase());
            }

            const channelId = item.channel_id || res.channel_id;
            const streamUrl = `${config.STREAM_BASE_URL}?infohash=${infohash}`;

            for (const groupInfo of assignedGroups) {
                const gName = groupInfo.name;
                const cCode = groupInfo.countryCode;
                const finalName = cCode ? `[${cCode.toUpperCase()}] ${name}` : name;

                if (!groupToItems[gName]) {
                    groupToItems[gName] = [];
                    groupToInfohashes[gName] = [];
                }
                groupToItems[gName].push(new PlaylistRow(finalName, streamUrl, {
                    tvgName: finalName,
                    tvgId: channelId,
                    logo: logo,
                    group: gName,
                    epgTitle: epgTitle
                }));
                groupToInfohashes[gName].push(`${name}: ${infohash}`);
            }
            break; // We processed this result via its first item that has an infohash
        }
    }

    if (uniqueCountries.size > 0) logger.info(`Unique countries: ${Array.from(uniqueCountries).sort().join(', ')}`);
    if (uniqueCategories.size > 0) logger.info(`Unique categories: ${Array.from(uniqueCategories).sort().join(', ')}`);

    for (const [group, infohashes] of Object.entries(groupToInfohashes)) {
        logger.info(`Group "${group}" infohashes:\n  ${infohashes.join('\n  ')}`);
    }

    return groupToItems;
}

module.exports = {
    generateM3u8
};
