/**
 * Base44 Orchestrator
 * Ties everything together: validate → prompt → browser → export → move
 */
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const { validateInput } = require('./validator');
const { buildPrompt } = require('./promptTemplate');
const {
    launchPersistentBrowser,
    navigateToBase44,
    pastePromptAndGenerate,
    waitForBuild,
    triggerExport,
} = require('./browserController');
const { setupDownloadListener, moveToTarget } = require('./exportHandler');
const logger = require('./logger');
const base44Config = require('./config');

/**
 * Generate a demo site end-to-end.
 *
 * Flow:
 * 1. Validate input
 * 2. Build prompt from template
 * 3. Resolve target folder path
 * 4. Launch persistent Chrome
 * 5. Navigate to Base44 → paste prompt → generate
 * 6. Wait for build completion
 * 7. Trigger export (extension or in-page)
 * 8. Catch download → move to final folder
 * 9. Return result
 *
 * @param {Object} inputData - Raw input payload
 * @param {Function} onStatus - Optional status callback (status, message)
 * @returns {Promise<Object>} { success, finalPath, duration, error }
 */
async function generateDemoSite(inputData, onStatus) {
    const startTime = Date.now();
    const status = (s, msg) => {
        logger.info(`[${s}] ${msg}`);
        if (onStatus) onStatus(s, msg);
    };

    let context = null;

    try {
        // 1. Validate
        status('validating', 'Validating input data');
        const validation = validateInput(inputData);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.error}`);
        }
        const data = validation.data;

        // 2. Build prompt
        status('building_prompt', 'Building prompt from template');
        const prompt = buildPrompt(data);
        logger.info(`Prompt built: ${prompt.length} chars`);

        // 3. Resolve target path
        const targetRootDir = data.targetRootDir || base44Config.defaultRootDir;
        const townFolder = data.townFolder || extractTownFromLocation(data.location);
        const categoryFolder = data.categoryFolder || extractCategoryFromIndustry(data.industry);

        const expectedPath = path.join(
            targetRootDir, townFolder, categoryFolder, `${data.businessName}-demo.zip`
        );
        status('resolved_path', `Target: ${expectedPath}`);

        // 4. Launch browser
        status('launching_browser', 'Launching Chrome with persistent profile');
        const result = await launchPersistentBrowser({
            headless: data.runHeadless,
        });
        context = result.context;
        const page = result.page;

        // 5. Set up download listener BEFORE triggering anything
        const tempDir = path.join(os.tmpdir(), 'base44-downloads');
        const downloadPromise = setupDownloadListener(
            page, tempDir, base44Config.timeouts.downloadWait
        );

        // 6. Navigate to Base44
        status('navigating', 'Opening Base44.ai');
        await navigateToBase44(page);

        // 7. Paste prompt + generate
        status('generating', 'Pasting prompt and triggering generation');
        await pastePromptAndGenerate(page, prompt);

        // 8. Wait for build
        status('building', 'Waiting for Base44 to build site');
        await waitForBuild(page, base44Config.buildTimeoutMs);

        // 9. Trigger export
        status('exporting', 'Triggering site export');
        downloadPromise.startTimer();
        await triggerExport(page, base44Config.extensionId);

        // 10. Wait for download
        status('downloading', 'Waiting for download to complete');
        const tempFilePath = await downloadPromise;

        // 11. Move to final location
        status('moving', 'Moving file to target directory');
        const finalPath = await moveToTarget(tempFilePath, {
            businessName: data.businessName,
            townFolder,
            categoryFolder,
            rootDir: targetRootDir,
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        status('completed', `Done in ${duration}s → ${finalPath}`);

        return {
            success: true,
            finalPath,
            duration: parseFloat(duration),
            businessName: data.businessName,
            leadId: data.leadId || null,
        };

    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(`Generation failed after ${duration}s: ${err.message}`);
        status('failed', err.message);

        return {
            success: false,
            finalPath: null,
            duration: parseFloat(duration),
            error: err.message,
            businessName: inputData?.businessName || 'unknown',
            leadId: inputData?.leadId || null,
        };

    } finally {
        // Always close browser
        if (context) {
            try {
                await context.close();
                logger.info('Browser closed');
            } catch (err) {
                logger.warn(`Error closing browser: ${err.message}`);
            }
        }
    }
}

/**
 * Extract town name from location string
 * e.g. "Weskusplek, Jacobs Bay, West Coast, South Africa" → "Jacobs-Bay"
 */
function extractTownFromLocation(location) {
    if (!location) return 'uncategorized';
    const parts = location.split(',').map(p => p.trim());
    // Usually second part is town, first is specific area
    const town = parts.length >= 2 ? parts[1] : parts[0];
    return town.replace(/\s+/g, '-');
}

/**
 * Extract category from industry string
 * e.g. "self-catering guesthouse" → "guesthouses"
 */
function extractCategoryFromIndustry(industry) {
    if (!industry) return 'general';
    const lower = industry.toLowerCase();
    // Simple pluralization / keyword extraction
    if (lower.includes('guesthouse')) return 'guesthouses';
    if (lower.includes('hotel')) return 'hotels';
    if (lower.includes('restaurant')) return 'restaurants';
    if (lower.includes('plumb')) return 'plumbing';
    if (lower.includes('electric')) return 'electricians';
    if (lower.includes('self-catering') || lower.includes('self catering')) return 'self-catering';
    if (lower.includes('b&b') || lower.includes('bed and breakfast')) return 'bnb';
    return lower.replace(/\s+/g, '-');
}

module.exports = { generateDemoSite, extractTownFromLocation, extractCategoryFromIndustry };
