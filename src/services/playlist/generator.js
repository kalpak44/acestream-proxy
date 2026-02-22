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

            const countries = item.countries || [];
            const itemCategories = item.categories || [];

            let assignedGroup = null;
            let countryCode = null;

            // 1. Check INFOHASH_CATEGORY_OVERRIDE
            for (const [gName, infohashes] of Object.entries(config.INFOHASH_CATEGORY_OVERRIDE)) {
                if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
                    assignedGroup = gName;
                    break;
                }
            }

            // 2. Check INFOHASH_COUNTRY_OVERRIDE
            if (!assignedGroup) {
                for (const [gName, infohashes] of Object.entries(config.INFOHASH_COUNTRY_OVERRIDE)) {
                    if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
                        assignedGroup = gName;
                        const countryEntry = config.COUNTRY_MAP.find(cm => cm.name === gName);
                        if (countryEntry) countryCode = countryEntry.code;
                        break;
                    }
                }
            }

            // 3. Check CATEGORY_REMAP
            if (!assignedGroup) {
                for (const cat of itemCategories) {
                    const catLower = cat.toLowerCase();
                    const remap = config.CATEGORY_REMAP.find(r => r.sources.includes(catLower));
                    if (remap) {
                        assignedGroup = remap.name;
                        break;
                    }
                }
            }

            // 4. Check COUNTRY_MAP
            if (!assignedGroup) {
                for (const c of countries) {
                    const cLower = c.toLowerCase();
                    const countryEntry = config.COUNTRY_MAP.find(cm => cm.code === cLower);
                    if (countryEntry) {
                        assignedGroup = countryEntry.name;
                        countryCode = countryEntry.code;
                        break;
                    }
                }
            }

            if (!assignedGroup) continue;

            for (const cat of itemCategories) {
                uniqueCategories.add(cat.toLowerCase());
            }
            for (const c of countries) {
                uniqueCountries.add(c.toLowerCase());
            }

            const finalName = countryCode ? `[${countryCode.toUpperCase()}] ${name}` : name;
            const channelId = item.channel_id || res.channel_id;
            const streamUrl = `${config.STREAM_BASE_URL}?infohash=${infohash}`;

            if (!groupToItems[assignedGroup]) {
                groupToItems[assignedGroup] = [];
                groupToInfohashes[assignedGroup] = [];
            }
            groupToItems[assignedGroup].push(new PlaylistRow(finalName, streamUrl, {
                tvgName: finalName,
                tvgId: channelId,
                logo: logo,
                group: assignedGroup,
                epgTitle: epgTitle
            }));
            groupToInfohashes[assignedGroup].push(`${name}: ${infohash}`);
            break; // Found the first matching group for this infohash, don't look for more
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
