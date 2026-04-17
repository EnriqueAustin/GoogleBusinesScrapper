/**
 * Base44 Module Configuration
 * Reads from .env with sensible defaults
 */
require('dotenv').config();
const path = require('path');
const os = require('os');

const base44Config = {
    // Chrome profile path (must have Base44 login + Downloader extension)
    chromeProfilePath: process.env.BASE44_CHROME_PROFILE
        || path.join(os.homedir(), '.config', 'google-chrome'),

    // Base44 Downloader Chrome extension ID
    extensionId: process.env.BASE44_EXTENSION_ID || '',

    // Base44 Downloader Chrome extension Path
    extensionPath: process.env.BASE44_EXTENSION_PATH || '',

    // How long to wait for Base44 to finish building (ms)
    buildTimeoutMs: parseInt(process.env.BASE44_BUILD_TIMEOUT) || 120000,

    // Default root directory for saved demos
    defaultRootDir: process.env.BASE44_ROOT_DIR
        || path.join(os.homedir(), 'Client-Demos'),

    // Base44 URL
    base44Url: 'https://app.base44.com',

    // Browser settings
    browser: {
        headless: false,
        slowMo: 50,
        viewport: { width: 1400, height: 900 },
        args: [
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
        ],
    },

    // Timeouts
    timeouts: {
        navigation: 30000,
        elementWait: 10000,
        downloadWait: 60000,
        pollInterval: 3000,
    },

    // Logging
    logging: {
        dir: path.join(process.cwd(), 'logs'),
        filename: 'base44.log',
        level: 'info',
    },
};

module.exports = base44Config;
