/**
 * Base44 Export Handler
 * Download listener + file mover
 */
const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger');
const base44Config = require('./config');

/**
 * Set up a download listener on the browser context.
 * Returns a promise that resolves with the downloaded file path.
 *
 * @param {import('playwright').Page} page
 * @param {string} tempDir - Temporary directory to save download
 * @param {number} timeoutMs - Max wait time for download
 * @returns {Promise<string>} Path to downloaded file
 */
function setupDownloadListener(page, tempDir, timeoutMs) {
    const timeout = timeoutMs || base44Config.timeouts.downloadWait;

    // Ensure temp dir exists
    fs.ensureDirSync(tempDir);

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Download timed out after ${timeout / 1000}s`));
        }, timeout);

        page.on('download', async (download) => {
            clearTimeout(timer);

            try {
                const suggestedName = download.suggestedFilename();
                const tempPath = path.join(tempDir, suggestedName);

                logger.info(`Download started: ${suggestedName}`);
                await download.saveAs(tempPath);
                logger.info(`Download saved to temp: ${tempPath}`);

                resolve(tempPath);
            } catch (err) {
                reject(new Error(`Download failed: ${err.message}`));
            }
        });
    });
}

/**
 * Move downloaded file to final target directory.
 *
 * Creates folder structure: {rootDir}/{townFolder}/{categoryFolder}/{businessName}-demo.zip
 *
 * @param {string} tempFilePath - Path to the downloaded temp file
 * @param {Object} opts
 * @param {string} opts.businessName
 * @param {string} opts.townFolder
 * @param {string} opts.categoryFolder
 * @param {string} opts.rootDir
 * @returns {Promise<string>} Final file path
 */
async function moveToTarget(tempFilePath, opts) {
    const {
        businessName,
        townFolder = 'uncategorized',
        categoryFolder = 'general',
        rootDir,
    } = opts;

    const targetRoot = rootDir || base44Config.defaultRootDir;

    // Sanitize folder/file names
    const safeName = sanitize(businessName);
    const safeTown = sanitize(townFolder);
    const safeCategory = sanitize(categoryFolder);

    // Build target path
    const targetDir = path.join(targetRoot, safeTown, safeCategory);
    const ext = path.extname(tempFilePath) || '.zip';
    const targetFile = path.join(targetDir, `${safeName}-demo${ext}`);

    // Create directory tree
    await fs.ensureDir(targetDir);

    // Move file (overwrite if exists)
    await fs.move(tempFilePath, targetFile, { overwrite: true });

    logger.info(`File moved to: ${targetFile}`);
    return targetFile;
}

/**
 * Sanitize a string for use as folder/file name
 */
function sanitize(str) {
    if (!str) return 'unknown';
    return str
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // remove illegal chars
        .replace(/\s+/g, '-')                     // spaces → hyphens
        .replace(/-+/g, '-')                       // collapse multiple hyphens
        .replace(/^-|-$/g, '')                     // trim leading/trailing hyphens
        .substring(0, 100);                         // cap length
}

module.exports = { setupDownloadListener, moveToTarget, sanitize };
