class PlaylistWriter {
    constructor() {
        this.lines = ['#EXTM3U'];
    }

    addRow(row) {
        this.lines.push(row.toM3u());
    }

    addRaw(content) {
        if (content) {
            this.lines.push(content);
        }
    }

    toString() {
        return this.lines.join('\n') + '\n';
    }
}

module.exports = PlaylistWriter;
