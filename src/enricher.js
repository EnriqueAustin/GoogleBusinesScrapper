const { log } = require('./utils');
const config = require('./config');

// Social media domains to look for in href attributes
const SOCIAL_DOMAINS = [
    { domain: 'facebook.com', name: 'Facebook' },
    { domain: 'instagram.com', name: 'Instagram' },
    { domain: 'linkedin.com', name: 'LinkedIn' },
    { domain: 'twitter.com', name: 'Twitter' },
    { domain: 'x.com', name: 'X' },
    { domain: 'youtube.com', name: 'YouTube' },
    { domain: 'tiktok.com', name: 'TikTok' },
    { domain: 'pinterest.com', name: 'Pinterest' },
];

// Email patterns to exclude (false positives)
const EMAIL_BLACKLIST_PATTERNS = [
    /^noreply@/i,
    /^no-reply@/i,
    /^info@example\./i,
    /^test@/i,
    /^admin@example\./i,
    /^email@example\./i,
    /^name@example\./i,
    /^user@example\./i,
    /^example@/i,
    /@sentry/i,
    /@wixpress\./i,
    /@sentry-next\./i,
    /@example\.com$/i,
    /@example\.org$/i,
    /@mysite\.com$/i,
    /@domain\.com$/i,
    /@yoursite\.com$/i,
    /@yourwebsite\.com$/i,
    /@website\.com$/i,
    /@email\.com$/i,
    /^xxx@/i,
    /@xxx\./i,
];

// File extension patterns that look like emails but aren't
const FALSE_EMAIL_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|css|js|map|woff|woff2|ttf|eot)$/i;

/**
 * Extract email addresses from HTML content
 */
function extractEmails(html) {
    // URL-decode common encoded characters before matching
    const decodedHtml = html
        .replace(/%40/g, '@')
        .replace(/%20/g, ' ')
        .replace(/%2E/gi, '.');

    // Match common email patterns in the HTML
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const rawMatches = decodedHtml.match(emailRegex) || [];

    // Deduplicate and filter out junk
    const seen = new Set();
    const emails = [];
    const MAX_EMAILS = 10; // Cap to avoid noise from chain/franchise sites

    for (const email of rawMatches) {
        if (emails.length >= MAX_EMAILS) break;

        // Trim whitespace and lowercase
        const lower = email.trim().toLowerCase();

        // Skip empty after trim
        if (!lower || lower.length < 5) continue;

        // Skip if already seen
        if (seen.has(lower)) continue;
        seen.add(lower);

        // Skip file extensions that look like emails
        if (FALSE_EMAIL_EXTENSIONS.test(lower)) continue;

        // Skip blacklisted patterns
        if (EMAIL_BLACKLIST_PATTERNS.some(pattern => pattern.test(lower))) continue;

        // Skip very long emails (likely encoded data)
        if (lower.length > 60) continue;

        // Skip emails with hex-hash-like local parts (e.g. Sentry DSN hashes)
        const localPart = lower.split('@')[0];
        if (/^[a-f0-9]{16,}$/.test(localPart)) continue;

        emails.push(lower);
    }

    return emails;
}

/**
 * Extract social media links from HTML content
 */
function extractSocialLinks(html) {
    // Match all href values in anchor tags
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
    const socialLinks = [];
    const seen = new Set();
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
        const url = match[1];

        for (const social of SOCIAL_DOMAINS) {
            if (url.includes(social.domain)) {
                // Normalize: remove trailing slashes and query params for dedup
                const normalized = url.split('?')[0].replace(/\/+$/, '').toLowerCase();

                // Skip generic/homepage links (e.g. just "https://facebook.com")
                const pathAfterDomain = normalized.split(social.domain)[1] || '';
                if (pathAfterDomain.length <= 1) continue; // just "/" or empty

                // Skip share/sharer/intent links
                if (normalized.includes('/sharer') || normalized.includes('/share')
                    || normalized.includes('/intent/') || normalized.includes('/dialog/')) continue;

                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    socialLinks.push(url.split('?')[0]); // Keep original casing but strip query
                }
                break;
            }
        }
    }

    return socialLinks;
}

/**
 * Enrich a website URL — fetches the HTML and extracts:
 * - Tech stack fingerprints
 * - Basic SEO analysis
 * - Email addresses
 * - Social media links
 */
async function enrichWebsite(url) {
    if (!url || url === 'None' || url === 'N/A') {
        return {
            websiteStatus: 'No URL',
            techStack: 'N/A',
            seoStatus: 'N/A',
            emails: '',
            socials: '',
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
                emails: '',
                socials: '',
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

        // 3. Extract Emails
        const foundEmails = extractEmails(html);
        const emails = foundEmails.join(', ');
        if (foundEmails.length > 0) {
            log('info', `  📧 Found ${foundEmails.length} email(s): ${emails}`);
        }

        // 4. Extract Social Media Links
        const foundSocials = extractSocialLinks(html);
        const socials = foundSocials.join(', ');
        if (foundSocials.length > 0) {
            log('info', `  🔗 Found ${foundSocials.length} social link(s)`);
        }

        return {
            websiteStatus: 'Active',
            techStack,
            seoStatus,
            emails,
            socials,
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
            emails: '',
            socials: '',
        };
    }
}

module.exports = { enrichWebsite };
