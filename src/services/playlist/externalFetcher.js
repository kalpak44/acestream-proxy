const axios = require('axios');
const logger = require('../../logger');
const PlaylistRow = require('./PlaylistRow');

async function fetchExternalPlaylist(url, label) {
    try {
        logger.info(`Fetching external playlist: ${url}...`);
        const response = await axios.get(url, {timeout: 15000});
        const content = response.data;
        const lines = content.split(/\r?\n/);
        const resultRows = [];

        let currentExtinfRow = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#EXTM3U')) continue;

            if (trimmed.startsWith('#EXTINF:')) {
                let name = 'Unknown';
                let tvgName = '';
                let tvgId = '';
                let logo = '';
                let group = label;

                const tvgNameMatch = trimmed.match(/tvg-name="([^"]*)"/);
                if (tvgNameMatch) tvgName = tvgNameMatch[1];

                const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/);
                if (tvgIdMatch) tvgId = tvgIdMatch[1];

                const logoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
                if (logoMatch) logo = logoMatch[1];

                const groupMatch = trimmed.match(/group-title="([^"]*)"/);
                // We strictly use the provided label as the group, ignoring any group-title from the external M3U
                group = label;

                const commaIdx = trimmed.lastIndexOf(',');
                if (commaIdx !== -1) {
                    const originalName = trimmed.substring(commaIdx + 1).trim();
                    name = `External ${originalName}`;
                    // Ensure tvgName also has the "External " prefix if it was parsed or if it defaults to the name
                    tvgName = `External ${tvgName || originalName}`;
                }

                currentExtinfRow = {tvgName, tvgId, logo, group, name};
            } else if (!trimmed.startsWith('#')) {
                if (currentExtinfRow) {
                    resultRows.push(new PlaylistRow(currentExtinfRow.name, trimmed, {
                        tvgName: currentExtinfRow.tvgName,
                        tvgId: currentExtinfRow.tvgId,
                        logo: currentExtinfRow.logo,
                        group: currentExtinfRow.group
                    }));
                    currentExtinfRow = null;
                }
            }
        }
        return resultRows;
    } catch (error) {
        logger.error(`Failed to fetch external playlist ${url}: ${error.message}`);
        return [];
    }
}

module.exports = {
    fetchExternalPlaylist
};
