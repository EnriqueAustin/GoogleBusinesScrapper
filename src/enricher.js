const { chromium } = require('playwright-extra');
const { log } = require('./utils');
const config = require('./config');

/**
 * Super lightweight fetch-based URL checker.
 * Doesn't render JavaScript, just grabs the HTML to look for meta tags and tech stack fingerprints.
 */
async function enrichWebsite(url) {
    if (!url || url === 'None' || url === 'N/A') {
        return {
            websiteStatus: 'No URL',
            techStack: 'N/A',
            seoStatus: 'N/A',
        };
    }

    // Ensure it has http(s)
    let fullUrl = url;
    if (!fullUrl.startsWith('http')) {
        fullUrl = `https://${url}`;
    }

    try {
        log('info', `Enriching website: ${fullUrl}`);

        // Use a 15-second timeout. We want this to be relatively fast.
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'User-Agent': config.userAgents[0],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            return {
                websiteStatus: `Error HTTP ${response.status}`,
                techStack: 'N/A',
                seoStatus: 'N/A',
            };
        }

        const html = await response.text();
        const htmlLower = html.toLowerCase();

        // 1. Analyze Tech Stack
        const stacks = [];
        if (htmlLower.includes('wp-content') || htmlLower.includes('wp-includes') || htmlLower.includes('wordpress')) {
            stacks.push('WordPress');
        }
        if (htmlLower.includes('cdn.shopify.com') || htmlLower.includes('shopify')) {
            stacks.push('Shopify');
        }
        if (htmlLower.includes('wix.com') || htmlLower.includes('wix-')) {
            stacks.push('Wix');
        }
        if (htmlLower.includes('squarespace.com')) {
            stacks.push('Squarespace');
        }
        if (htmlLower.includes('weebly.com')) {
            stacks.push('Weebly');
        }
        if (htmlLower.includes('__next') || htmlLower.includes('_next/static')) {
            stacks.push('Next.js');
        } else if (htmlLower.includes('react')) {
            // Next.js usually also matches react, so we check next first
            stacks.push('React');
        }
        if (htmlLower.includes('elementor')) {
            stacks.push('Elementor');
        }

        const techStack = stacks.length > 0 ? stacks.join(', ') : 'Custom/Unknown';

        // 2. Analyze Basic SEO
        const seoIssues = [];

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        if (!title) {
            seoIssues.push('Missing Title');
        } else if (title.length < 10) {
            seoIssues.push('Title Too Short');
        }

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i) ||
            html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);

        const description = descMatch ? descMatch[1].trim() : '';
        if (!description) {
            seoIssues.push('Missing Meta Desc');
        }

        const seoStatus = seoIssues.length > 0 ? seoIssues.join(', ') : 'Good';

        return {
            websiteStatus: 'Active',
            techStack,
            seoStatus,
        };

    } catch (err) {
        log('warn', `Failed to enrich ${fullUrl}: ${err.message}`);

        // If fetch fails (e.g. timeout, DNS error), it might be offline
        let status = 'Error / Offline';
        if (err.name === 'TimeoutError') {
            status = 'Timeout (Slow)';
        }

        return {
            websiteStatus: status,
            techStack: 'N/A',
            seoStatus: 'N/A',
        };
    }
}

module.exports = { enrichWebsite };
