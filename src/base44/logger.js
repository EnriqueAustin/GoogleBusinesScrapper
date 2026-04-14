/**
 * Base44 Module Logger
 * Winston-based, writes to console + file
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const base44Config = require('./config');

// Ensure log directory exists
if (!fs.existsSync(base44Config.logging.dir)) {
    fs.mkdirSync(base44Config.logging.dir, { recursive: true });
}

const logger = winston.createLogger({
    level: base44Config.logging.level,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} [base44] ${level.toUpperCase()}: ${message}`
        )
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) =>
                    `${timestamp} [base44] ${level}: ${message}`
                )
            ),
        }),
        new winston.transports.File({
            filename: path.join(base44Config.logging.dir, base44Config.logging.filename),
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 3,
        }),
    ],
});

module.exports = logger;
