const chalk = require('chalk');
const config = require('./config');

/**
 * Human-like delay — random wait between min and max seconds
 */
function humanDelay(minSec, maxSec) {
    const min = minSec ?? 3;
    const max = maxSec ?? 8;
    const ms = Math.random() * (max - min) * 1000 + min * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type text character-by-character with random pauses (mimics real typing)
 */
async function humanType(page, selector, text) {
    const element = page.locator(selector);
    await element.click();
    for (const char of text) {
        await element.pressSequentially(char, {
            delay: Math.random() * (config.delays.typing.max - config.delays.typing.min) * 1000 + config.delays.typing.min * 1000,
        });
    }
}

/**
 * Type text into an already-located element character-by-character
 */
async function humanTypeIntoElement(element, text) {
    for (const char of text) {
        await element.pressSequentially(char, {
            delay: Math.random() * (config.delays.typing.max - config.delays.typing.min) * 1000 + config.delays.typing.min * 1000,
        });
    }
}

/**
 * Timestamped colored logging
 */
function log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = chalk.gray(`[${timestamp}]`);

    switch (level) {
        case 'info':
            console.log(`${prefix} ${chalk.blue('ℹ')} ${message}`);
            break;
        case 'success':
            console.log(`${prefix} ${chalk.green('✔')} ${message}`);
            break;
        case 'warn':
            console.log(`${prefix} ${chalk.yellow('⚠')} ${message}`);
            break;
        case 'error':
            console.log(`${prefix} ${chalk.red('✖')} ${message}`);
            break;
        case 'lead':
            console.log(`${prefix} ${chalk.magenta('★')} ${message}`);
            break;
        default:
            console.log(`${prefix} ${message}`);
    }
}

/**
 * Detect CAPTCHA on the page
 */
async function detectCaptcha(page) {
    try {
        const captcha = page.locator(config.selectors.captchaFrame);
        const count = await captcha.count();
        if (count > 0) return true;

        // Also check for "unusual traffic" text
        const bodyText = await page.locator('body').innerText();
        if (bodyText.includes('unusual traffic') || bodyText.includes('not a robot')) {
            return true;
        }
    } catch {
        // Ignore errors during detection
    }
    return false;
}

/**
 * Dismiss Google cookie consent / "Before you continue" dialogs
 * Google shows different consent patterns depending on locale and region
 */
async function dismissCookieConsent(page) {
    const consentSelectors = [
        // Standard cookie consent buttons
        'button[aria-label="Accept all"]',
        'button[aria-label="Reject all"]',
        'button[aria-label="Accept All"]',
        // "Before you continue to Google" page
        'form[action*="consent"] button',
        'button:has-text("Accept all")',
        'button:has-text("Reject all")',
        'button:has-text("I agree")',
        'button:has-text("Accept")',
        // consent.google.com iframe
        '[aria-label="Consent"] button',
        // Generic patterns
        '#L2AGLb',  // Google's consent "Accept all" button ID
        '#W0wltc',  // Google's consent "Reject all" button ID
    ];

    for (const selector of consentSelectors) {
        try {
            const btn = page.locator(selector).first();
            const isVisible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
            if (isVisible) {
                await btn.click();
                log('info', `Dismissed consent dialog using: ${selector}`);
                await humanDelay(2, 4);
                return true;
            }
        } catch {
            // Try next selector
        }
    }

    // Also check for consent inside iframes
    try {
        const frames = page.frames();
        for (const frame of frames) {
            if (frame.url().includes('consent.google')) {
                const agreeBtn = frame.locator('button:has-text("I agree"), button:has-text("Accept"), #introAgreeButton');
                const count = await agreeBtn.count();
                if (count > 0) {
                    await agreeBtn.first().click();
                    log('info', 'Dismissed consent dialog in iframe');
                    await humanDelay(2, 4);
                    return true;
                }
            }
        }
    } catch {
        // No iframe consent — fine
    }

    return false;
}

/**
 * Safe text extraction — returns fallback if element not found
 */
async function safeText(locator, fallback = 'N/A') {
    try {
        const count = await locator.count();
        if (count > 0) {
            const text = await locator.first().innerText();
            return text.trim() || fallback;
        }
    } catch {
        // swallow
    }
    return fallback;
}

/**
 * Safe attribute extraction
 */
async function safeAttr(locator, attr, fallback = null) {
    try {
        const count = await locator.count();
        if (count > 0) {
            const val = await locator.first().getAttribute(attr);
            return val || fallback;
        }
    } catch {
        // swallow
    }
    return fallback;
}

/**
 * Pick a random user agent from the pool
 */
function randomUserAgent() {
    return config.userAgents[Math.floor(Math.random() * config.userAgents.length)];
}

module.exports = {
    humanDelay,
    humanType,
    humanTypeIntoElement,
    log,
    detectCaptcha,
    dismissCookieConsent,
    safeText,
    safeAttr,
    randomUserAgent,
};
