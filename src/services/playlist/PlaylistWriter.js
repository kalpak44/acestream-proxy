const fs = require('node:fs');

class PlaylistWriter {
    constructor(filePath, {epgUrl} = {}) {
        this.filePath = filePath;
        this.stream = fs.createWriteStream(filePath, {encoding: 'utf8'});
        this.count = 0;
        const header = epgUrl ? `#EXTM3U url-tvg="${epgUrl}"\n` : '#EXTM3U\n';
        this.stream.write(header);
    }

    write(chunk) {
        if (this.stream.write(chunk)) return Promise.resolve();
        return new Promise((resolve) => this.stream.once('drain', resolve));
    }

    async addRow(row) {
        await this.write(row.toM3u() + '\n');
        this.count += 1;
    }

    close() {
        return new Promise((resolve, reject) => {
            this.stream.end((err) => (err ? reject(err) : resolve(this.count)));
        });
    }
}

module.exports = PlaylistWriter;