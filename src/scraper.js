const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const {
    humanDelay,
    humanTypeIntoElement,
    log,
    detectCaptcha,
    dismissCookieConsent,
    safeText,
    safeAttr,
    randomUserAgent,
} = require('./utils');

// Apply stealth plugin
chromium.use(stealth());

/**
 * Scroll the results feed panel until we hit the end or max scroll attempts
 */
async function scrollResults(page) {
    const feed = page.locator(config.selectors.resultsFeed);
    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < config.limits.maxScrollAttempts) {
        // Check for "end of list" marker
        const endMarker = page.locator(config.selectors.endOfList);
        const endCount = await endMarker.count();
        if (endCount > 0) {
            log('info', 'Reached end of results list');
            break;
        }

        // Scroll the feed panel
        await feed.evaluate(el => el.scrollBy(0, 600));
        scrollCount++;
        log('info', `Scroll #${scrollCount}/${config.limits.maxScrollAttempts}`);

        const d = config.delays.afterScroll;
        await humanDelay(d.min, d.max);

        // Check if scroll position changed (stuck = end)
        const currentHeight = await feed.evaluate(el => el.scrollTop);
        if (currentHeight === previousHeight) {
            log('info', 'Scroll position unchanged — likely at end');
            break;
        }
        previousHeight = currentHeight;
    }
}

/**
 * Extract data from a single business listing's detail panel
 */
async function extractListingData(page, query) {
    const sel = config.selectors;

    // Name
    const name = await safeText(page.locator(sel.name));

    // Category
    let category = 'N/A';
    try {
        // Method 1: config selector
        category = await safeText(page.locator(sel.category), '');

        // Method 2: Look for the class commonly used for category next to rating
        if (!category || category === 'N/A') {
            category = await page.evaluate(() => {
                // Often the category is a button inside a div that also contains the rating
                // Or it's a font-body-medium element with a specific class, usually next to the rating
                const potentialBtns = Array.from(document.querySelectorAll('button'));
                for (const btn of potentialBtns) {
                    if (btn.getAttribute('jsaction') === 'pane.rating.category') {
                        return btn.innerText.trim();
                    }
                }

                // Fallback: finding the text node directly preceding the address or next to rating
                const ratingLabels = document.querySelectorAll('[aria-label*="stars"]');
                if (ratingLabels.length > 0) {
                    const container = ratingLabels[0].closest('.RkPPbb') || ratingLabels[0].parentElement?.parentElement;
                    if (container) {
                        const buttons = container.querySelectorAll('button');
                        if (buttons.length > 0) {
                            return buttons[buttons.length - 1].innerText.trim();
                        }
                    }
                }

                // Fallback: look for the class `.DkEaL` which often holds the category
                const dkEls = document.querySelectorAll('button.DkEaL');
                if (dkEls.length > 0) {
                    return dkEls[0].innerText.trim();
                }

                return '';
            });
        }
    } catch (e) {
        log('error', 'Category extraction failed: ' + e.message);
    }
    category = category || 'N/A';

    // Address
    let address = 'N/A';
    try {
        const addrBtn = page.locator(sel.address);
        if ((await addrBtn.count()) > 0) {
            const ariaLabel = await addrBtn.first().getAttribute('aria-label');
            address = ariaLabel ? ariaLabel.replace(/^Address:\s*/i, '').trim() : 'N/A';
            if (address === 'N/A') {
                address = (await addrBtn.first().innerText()).trim();
            }
        }
    } catch { /* fallback already set */ }

    // Website (using stable data-item-id="authority")
    const website = await safeAttr(page.locator(sel.website), 'href');

    // Phone
    let phone = 'N/A';
    try {
        const phoneBtn = page.locator(sel.phone);
        if ((await phoneBtn.count()) > 0) {
            const ariaLabel = await phoneBtn.first().getAttribute('aria-label');
            phone = ariaLabel ? ariaLabel.replace(/^Phone:\s*/i, '').trim() : 'N/A';
        }
    } catch { /* fallback already set */ }

    // Rating & Reviews
    let rating = 'N/A';
    let reviewCount = 'N/A';
    try {
        const ratingContainer = page.locator('.F7nice').first();
        if ((await ratingContainer.count()) > 0) {
            // Rating is typically in an aria-hidden span inside this container
            const ratingSpan = ratingContainer.locator('span[aria-hidden="true"]').first();
            if ((await ratingSpan.count()) > 0) {
                const text = await ratingSpan.innerText();
                const match = text.match(/([\d.,]+)/);
                if (match) rating = match[1].replace(',', '.');
            }

            // If that fails, scrape the first aria-label with star/ster
            if (rating === 'N/A') {
                const starSpan = ratingContainer.locator('span[aria-label*="star"], span[aria-label*="ster"]').first();
                if ((await starSpan.count()) > 0) {
                    const text = await starSpan.getAttribute('aria-label');
                    const match = text && text.match(/([\d.,]+)/);
                    if (match) rating = match[1].replace(',', '.');
                }
            }

            // Reviews
            const reviewSpan = ratingContainer.locator('span[aria-label*="review"], span[aria-label*="resensies"]').first();
            if ((await reviewSpan.count()) > 0) {
                const text = await reviewSpan.getAttribute('aria-label');
                const match = text && text.match(/([\d.,]+)/);
                if (match) reviewCount = match[1].replace(/[,.]/g, '');
            }
        }

        // Global Fallback
        if (reviewCount === 'N/A') {
            const fallbackReview = page.locator('span[aria-label*="review"], span[aria-label*="resensies"]').first();
            if (await fallbackReview.count() > 0) {
                const text = await fallbackReview.getAttribute('aria-label');
                const match = text && text.match(/([\d.,]+)/);
                if (match) reviewCount = match[1].replace(/[,.]/g, '');
            }
        }
    } catch { /* fallback */ }

    // Social Media Extract
    const socialLinks = [];
    try {
        const links = await page.locator('a[data-item-id^="authority"]').all();
        for (const link of links) {
            const href = await link.getAttribute('href');
            if (href && (href.includes('facebook.com') || href.includes('instagram.com') || href.includes('linkedin.com') || href.includes('twitter.com'))) {
                socialLinks.push(href);
            }
        }
    } catch { /* ignore */ }

    const hasWebsite = !!(website && !website.includes('facebook.com') && !website.includes('instagram.com'));

    return {
        name,
        category,
        address,
        phone,
        website: website || 'None',
        hasWebsite,
        rating,
        reviewCount,
        socials: socialLinks.join(', '),
        query,
        scrapedAt: new Date().toISOString(),
        // New enrichment fields
        techStack: '',
        seoStatus: '',
        websiteStatus: '',
    };
}

/**
 * Main scraping function — searches Google Maps and extracts business data
 */
async function scrapeGoogleMaps(query, maxResults) {
    const max = maxResults || config.limits.maxResultsPerQuery;
    const results = [];

    log('info', `Starting scrape for: "${query}" (max ${max} results)`);

    const browser = await chromium.launch({
        headless: config.browser.headless,
        args: config.browser.args,
        slowMo: config.browser.slowMo,
    });

    const context = await browser.newContext({
        viewport: config.browser.viewport,
        userAgent: randomUserAgent(),
        locale: config.locale,
        timezoneId: config.timezoneId,
    });

    const page = await context.newPage();

    try {
        // Navigate to Google Maps with retry logic
        log('info', 'Navigating to Google Maps...');
        await page.goto('https://www.google.com/maps', { waitUntil: 'load', timeout: 30000 });
        await humanDelay(4, 8);

        // Handle cookie consent (try multiple times)
        await dismissCookieConsent(page);
        await humanDelay(2, 4);

        // Check for CAPTCHA
        if (await detectCaptcha(page)) {
            log('error', '⛔ CAPTCHA detected! Stop scraping and wait 24+ hours.');
            await browser.close();
            return results;
        }

        // Try consent again (sometimes it takes a moment)
        await dismissCookieConsent(page);

        // Find search box — try multiple selectors since Google varies by locale
        log('info', 'Looking for search box...');
        const searchSelectors = [
            '#searchboxinput',
            'input[aria-label="Search Google Maps"]',
            'input[name="q"]',
            'input[aria-label*="Search"]',
            'input[aria-label*="search"]',
            'input[aria-label*="Soek"]', // Afrikaans
            '#searchbox input',
            'input[type="text"]',
        ];

        let searchBox = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const sel of searchSelectors) {
                try {
                    const el = page.locator(sel).first();
                    const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
                    if (visible) {
                        searchBox = el;
                        log('info', `Found search box with selector: ${sel}`);
                        break;
                    }
                } catch {
                    // Try next
                }
            }
            if (searchBox) break;

            // If not found, try dismissing consent again and reloading
            log('warn', `Search box not found (attempt ${attempt + 1}/3), retrying...`);
            await dismissCookieConsent(page);
            await humanDelay(3, 5);

            if (attempt === 1) {
                // On second retry, try reloading the page
                log('info', 'Reloading page...');
                await page.reload({ waitUntil: 'load', timeout: 30000 });
                await humanDelay(4, 7);
                await dismissCookieConsent(page);
                await humanDelay(2, 3);
            }
        }

        if (!searchBox) {
            // Take a debug screenshot to help diagnose
            const outputDir = path.resolve(config.output.dir);
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
            const debugPath = path.join(outputDir, 'debug_screenshot.png');
            await page.screenshot({ path: debugPath, fullPage: true });
            log('error', `Could not find search box! Debug screenshot saved to: ${debugPath}`);
            log('error', `Current URL: ${page.url()}`);
            await browser.close();
            return results;
        }

        // Type the search query
        log('info', 'Typing search query...');
        await searchBox.click();
        await humanDelay(0.5, 1.5);
        await humanTypeIntoElement(searchBox, query);
        await humanDelay(0.5, 1);
        await searchBox.press('Enter');

        const d = config.delays.afterSearch;
        await humanDelay(d.min, d.max);

        // Check for CAPTCHA after search
        if (await detectCaptcha(page)) {
            log('error', '⛔ CAPTCHA detected after search! Stop scraping and wait 24+ hours.');
            await browser.close();
            return results;
        }

        // Scroll to load more results
        log('info', 'Scrolling to load results...');
        await scrollResults(page);

        // Get all listing cards
        const listings = await page.locator(config.selectors.listingCards).all();
        const totalFound = listings.length;
        log('info', `Found ${totalFound} listing cards, will process up to ${max}`);

        // Click each listing and extract data
        for (let i = 0; i < Math.min(totalFound, max); i++) {
            try {
                // Check CAPTCHA periodically
                if (i > 0 && i % 10 === 0) {
                    if (await detectCaptcha(page)) {
                        log('error', '⛔ CAPTCHA detected mid-scrape! Saving what we have and stopping.');
                        break;
                    }
                }

                const listing = listings[i];

                // Make sure the listing is still visible/attached
                try {
                    await listing.scrollIntoViewIfNeeded();
                } catch {
                    log('warn', `Listing ${i + 1} not accessible, skipping`);
                    continue;
                }

                await listing.click();

                const dc = config.delays.afterClick;
                await humanDelay(dc.min, dc.max);

                // Extract data from the detail panel
                const data = await extractListingData(page, query);

                if (data.name !== 'N/A') {
                    results.push(data);
                    const status = data.hasWebsite ? chalk.green('HAS WEBSITE') : chalk.red('NO WEBSITE');
                    log('lead', `[${i + 1}/${Math.min(totalFound, max)}] ${data.name} — ${status}`);
                }

                // Close detail panel
                await page.keyboard.press('Escape');
                const de = config.delays.afterEscape;
                await humanDelay(de.min, de.max);

            } catch (err) {
                log('warn', `Error on listing ${i + 1}: ${err.message}`);
                // Try to recover
                try { await page.keyboard.press('Escape'); } catch { }
                await humanDelay(2, 4);
                continue;
            }
        }

    } catch (err) {
        log('error', `Fatal error during scrape: ${err.message}`);
    } finally {
        await browser.close();
        log('success', `Scrape complete for "${query}" — ${results.length} businesses extracted`);
    }

    return results;
}

// Need chalk for the colored status in the scrape loop
const chalk = require('chalk');

module.exports = { scrapeGoogleMaps };
