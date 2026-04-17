/**
 * Base44 Browser Controller
 * Playwright persistent context automation for Base44.ai
 */
const { chromium } = require('playwright');
const logger = require('./logger');
const base44Config = require('./config');

/**
 * Launch Chrome with persistent profile (keeps login + extensions)
 * @param {Object} opts - { headless, profilePath }
 * @returns {Object} { context, page }
 */
async function launchPersistentBrowser(opts = {}) {
    const headless = opts.headless ?? base44Config.browser.headless;
    const profilePath = opts.profilePath ?? base44Config.chromeProfilePath;

    logger.info(`Launching Chrome with profile: ${profilePath}`);
    logger.info(`Headless: ${headless}`);

    const context = await chromium.launchPersistentContext(profilePath, {
        headless,
        slowMo: base44Config.browser.slowMo,
        viewport: base44Config.browser.viewport,
        args: [
            ...base44Config.browser.args,
            `--disable-extensions-except=${getExtensionPath()}`,
            `--load-extension=${getExtensionPath()}`,
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
    });

    // Use existing page or open new one
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    logger.info('Browser launched successfully');
    return { context, page };
}

/**
 * Get extension path from extension ID (Chrome stores extensions here)
 */
function getExtensionPath() {
    if (base44Config.extensionPath) {
        return base44Config.extensionPath;
    }
    const path = require('path');
    // Chrome extensions live under the profile's Extensions folder
    // User may need to adjust — this is best-effort default
    return path.join(
        base44Config.chromeProfilePath,
        'Default', 'Extensions',
        base44Config.extensionId
    );
}

/**
 * Navigate to Base44 and wait for the app to load
 * @param {import('playwright').Page} page
 */
async function navigateToBase44(page) {
    logger.info(`Navigating to ${base44Config.base44Url}`);

    await page.goto(base44Config.base44Url, {
        waitUntil: 'networkidle',
        timeout: base44Config.timeouts.navigation,
    });

    logger.info('Waiting for Base44 to be ready (Please log in manually if prompted)...');
    
    try {
        // Wait up to 5 minutes for a prompt textarea or "New Project" button to appear
        // This gives the user plenty of time to log in on the first run
        const readySelectors = [
            'textarea',
            'input[type="text"][placeholder*="describe"]',
            'button:has-text("New")',
            'button:has-text("Create Project")',
            'a:has-text("New Project")',
            '[data-testid="new-project"]'
        ];
        
        await page.waitForSelector(readySelectors.join(', '), { state: 'visible', timeout: 300000 });
        logger.info('Base44 authenticated and ready!');
    } catch (err) {
        logger.warn('Timed out waiting for login or ready state. Will try to proceed anyway.');
    }

    // Wait for the page to settle
    await page.waitForTimeout(1000);
}

/**
 * Find the prompt input area, paste the full prompt, and trigger generation.
 *
 * Base44 UI changes — this tries multiple strategies:
 * 1. Look for textarea / contenteditable prompt input
 * 2. Look for "Create" or "New Project" button first if needed
 * 3. Paste via clipboard
 * 4. Click Generate / Create button
 *
 * @param {import('playwright').Page} page
 * @param {string} prompt
 */
async function pastePromptAndGenerate(page, prompt) {
    logger.info('Looking for prompt input area...');

    // Strategy: look for common prompt input selectors on Base44
    const inputSelectors = [
        'textarea',
        '[contenteditable="true"]',
        'input[type="text"][placeholder*="describe"]',
        'input[type="text"][placeholder*="prompt"]',
        'input[type="text"][placeholder*="create"]',
        '[role="textbox"]',
        '.prompt-input',
        '#prompt-input',
    ];

    let inputEl = null;

    // First check if we need to click "New Project" or "Create" to open prompt
    const newProjectSelectors = [
        'button:has-text("New")',
        'button:has-text("Create")',
        'a:has-text("New Project")',
        'button:has-text("Start")',
        '[data-testid="new-project"]',
    ];

    for (const sel of newProjectSelectors) {
        try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 })) {
                logger.info(`Found new project button: ${sel}`);
                await btn.click();
                await page.waitForTimeout(2000);
                break;
            }
        } catch { /* try next */ }
    }

    // Now find the prompt input
    for (const sel of inputSelectors) {
        try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
                inputEl = el;
                logger.info(`Found prompt input: ${sel}`);
                break;
            }
        } catch { /* try next */ }
    }

    if (!inputEl) {
        // Last resort: take screenshot for debugging
        await page.screenshot({
            path: require('path').join(base44Config.logging.dir, 'base44_no_input.png'),
        });
        throw new Error('Could not find prompt input area on Base44. Screenshot saved.');
    }

    // Click into input and paste prompt
    await inputEl.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(200);

    // Use clipboard paste for speed (avoids typing 5000+ chars)
    await page.evaluate((text) => {
        navigator.clipboard.writeText(text);
    }, prompt).catch(() => {
        // Clipboard API might fail — fallback to fill
        logger.warn('Clipboard API failed, using fill fallback');
    });

    // Try clipboard paste first
    try {
        await page.evaluate((text) => {
            // Directly set value for textarea
            const active = document.activeElement;
            if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
                active.value = text;
                active.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (active && active.contentEditable === 'true') {
                active.innerText = text;
                active.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, prompt);
        logger.info('Prompt injected via DOM');
    } catch (err) {
        logger.warn(`DOM injection failed: ${err.message}, trying keyboard paste`);
        await inputEl.fill(prompt);
    }

    await page.waitForTimeout(1000);
    logger.info(`Prompt pasted (${prompt.length} chars)`);

    // Find and click generate button
    const generateSelectors = [
        'button:has-text("Generate")',
        'button:has-text("Create")',
        'button:has-text("Build")',
        'button:has-text("Submit")',
        'button[type="submit"]',
        '[data-testid="generate-btn"]',
    ];

    let clicked = false;
    for (const sel of generateSelectors) {
        try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 })) {
                logger.info(`Clicking generate button: ${sel}`);
                await btn.click();
                clicked = true;
                break;
            }
        } catch { /* try next */ }
    }

    // Fallback: try Enter key
    if (!clicked) {
        logger.warn('No generate button found, pressing Enter');
        await page.keyboard.press('Enter');
    }

    logger.info('Generation triggered');
}

/**
 * Wait for the Base44 build to complete.
 * Polls for completion indicators and loading state changes.
 *
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
async function waitForBuild(page, timeoutMs) {
    const timeout = timeoutMs || base44Config.buildTimeoutMs;
    const pollInterval = base44Config.timeouts.pollInterval;

    logger.info(`Waiting for build completion (timeout: ${timeout / 1000}s)...`);

    const startTime = Date.now();
    let hasSeenLoading = false;
    let consecutiveIdleChecks = 0;

    // Give the UI a few seconds to transition to the "loading" state after clicking generate
    await page.waitForTimeout(4000);

    while (Date.now() - startTime < timeout) {
        // 1. Check if still loading
        const loadingSelectors = [
            '.loading', '.spinner', '[data-testid="loading"]',
            ':text("Building")', ':text("Generating")', ':text("Creating")',
            ':text("Please wait")', 'svg.animate-spin'
        ];

        let stillLoading = false;
        for (const sel of loadingSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 300 })) {
                    stillLoading = true;
                    hasSeenLoading = true;
                    consecutiveIdleChecks = 0; // reset
                    break;
                }
            } catch { /* not visible */ }
        }

        if (stillLoading) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            logger.info(`Still building... (${elapsed}s)`);
            await page.waitForTimeout(pollInterval);
            continue; // Skip checking for completion, we know it's not done
        }

        // 2. Not loading. Increment idle counter.
        consecutiveIdleChecks++;

        // 3. Check for error states
        const errorSelectors = [
            '.error-message',
            '[data-testid="error"]',
            'text="Generation failed"'
        ];

        for (const sel of errorSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 300 })) {
                    const text = await el.textContent().catch(() => 'Unknown error');
                    throw new Error(`Base44 build error: ${text}`);
                }
            } catch (err) {
                if (err.message.startsWith('Base44 build error')) throw err;
            }
        }

        // 4. Check for strict completion indicators
        if (consecutiveIdleChecks >= 2) {
            const completionSelectors = [
                'button:has-text("Download ZIP")',
                'button:has-text("Download Code")',
                '[data-testid="site-ready"]'
            ];

            for (const sel of completionSelectors) {
                try {
                    const el = page.locator(sel).first();
                    if (await el.isVisible({ timeout: 400 })) {
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        logger.info(`Build complete! (${elapsed}s) — found: ${sel}`);
                        return true;
                    }
                } catch { /* not visible yet */ }
            }
            
            // If we successfully saw a spinner and now it's gone for 2 consecutive cycles, it's done!
            if (hasSeenLoading) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                logger.info(`Build complete! (${elapsed}s) — loading indicators vanished.`);
                // Give it a final 2 seconds to render the download/export buttons in the DOM
                await page.waitForTimeout(2000);
                return true;
            }
        }

        await page.waitForTimeout(pollInterval);
    }

    // Timeout
    await page.screenshot({
        path: require('path').join(base44Config.logging.dir, 'base44_timeout.png'),
    });
    throw new Error(`Build timed out after ${timeout / 1000}s. Screenshot saved.`);
}

/**
 * Trigger the Base44 Downloader Chrome extension to export the site.
 *
 * Strategy:
 * 1. Try navigating to extension popup URL
 * 2. Click download/export button inside popup
 * 3. Fallback: try keyboard shortcut if configured
 *
 * @param {import('playwright').Page} page
 * @param {string} extensionId
 */
async function triggerExport(page, extensionId) {
    const extId = extensionId || base44Config.extensionId;

    if (!extId) {
        logger.warn('No extension ID configured — looking for in-page export button');
        return await tryInPageExport(page);
    }

    logger.info(`Triggering Base44 Downloader extension: ${extId}`);

    try {
        // Open extension popup in new tab
        const popupUrl = `chrome-extension://${extId}/popup.html`;
        const popupPage = await page.context().newPage();
        await popupPage.goto(popupUrl, { timeout: 10000 });
        await popupPage.waitForTimeout(2000);

        // Click download button in extension popup
        const downloadSelectors = [
            'button:has-text("Download")',
            'button:has-text("Export")',
            'button:has-text("Save")',
            'button',  // fallback: click first button
        ];

        for (const sel of downloadSelectors) {
            try {
                const btn = popupPage.locator(sel).first();
                if (await btn.isVisible({ timeout: 2000 })) {
                    logger.info(`Clicking extension download: ${sel}`);
                    await btn.click();
                    await popupPage.waitForTimeout(3000);
                    await popupPage.close();
                    return;
                }
            } catch { /* try next */ }
        }

        await popupPage.close();
        logger.warn('Extension popup had no download button — trying in-page export');
    } catch (err) {
        logger.warn(`Extension popup failed: ${err.message} — trying in-page export`);
    }

    // Fallback to in-page export
    await tryInPageExport(page);
}

/**
 * Try to find and click an export/download button on the Base44 page itself
 */
async function tryInPageExport(page) {
    const exportSelectors = [
        'button:has-text("Download")',
        'button:has-text("Export")',
        'button:has-text("Download ZIP")',
        'button:has-text("Download Code")',
        '[data-testid="download"]',
        '[data-testid="export"]',
    ];

    for (const sel of exportSelectors) {
        try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 })) {
                logger.info(`Found in-page export button: ${sel}`);
                await btn.click();
                return;
            }
        } catch { /* try next */ }
    }

    throw new Error('Could not find any export/download trigger');
}

module.exports = {
    launchPersistentBrowser,
    navigateToBase44,
    pastePromptAndGenerate,
    waitForBuild,
    triggerExport,
};
