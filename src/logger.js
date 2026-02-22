const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({timestamp, level, message, name}) => {
            return `${timestamp} [${level.toUpperCase()}] ${name || 'acestream-proxy'}: ${message}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

module.exports = logger;
