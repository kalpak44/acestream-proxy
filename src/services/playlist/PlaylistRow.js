class PlaylistRow {
    constructor(name, streamUrl, options = {}) {
        this.name = name;
        this.streamUrl = streamUrl;
        this.tvgName = options.tvgName || name;
        this.tvgId = options.tvgId || '';
        this.logo = options.logo || '';
        this.group = options.group || '';
        this.epgTitle = options.epgTitle || '';
    }

    getDisplayName() {
        return this.epgTitle ? `${this.name} — ${this.epgTitle}` : this.name;
    }

    toM3u() {
        const tvgIdAttr = this.tvgId ? ` tvg-id="${this.tvgId}"` : '';
        const tvgLogoAttr = this.logo ? ` tvg-logo="${this.logo}"` : '';
        const groupAttr = this.group ? ` group-title="${this.group}"` : '';
        const extinf = `#EXTINF:-1 tvg-name="${this.tvgName}"${tvgIdAttr}${tvgLogoAttr}${groupAttr},${this.getDisplayName()}`;
        const extgrp = this.group ? `#EXTGRP:${this.group}\n` : '';
        return `${extgrp}${extinf}\n${this.streamUrl}`;
    }
}

module.exports = PlaylistRow;
