const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('./config');
const { log } = require('./utils');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const OUTPUT_DIR = path.resolve(config.output.dir);
const CSV_PATH = path.join(OUTPUT_DIR, config.output.csvFile);

/**
 * Ensure the output directory exists for CSV export
 */
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        log('info', `Created output directory: ${OUTPUT_DIR}`);
    }
}

/**
 * Save leads locally and to the PostgreSQL database via Prisma
 */
async function saveLeads(newLeads) {
    if (!newLeads || newLeads.length === 0) return [];

    let savedCount = 0;

    // Save to Postgres (upsert based on name + address)
    for (const lead of newLeads) {
        try {
            // Parse rating to Float
            let ratingFloat = null;
            if (lead.rating && lead.rating !== 'N/A' && lead.rating !== '') {
                const parsed = parseFloat(lead.rating);
                if (!isNaN(parsed)) ratingFloat = parsed;
            }

            // Parse reviewCount to Int
            let reviewInt = null;
            if (lead.reviewCount && lead.reviewCount !== 'N/A' && lead.reviewCount !== '') {
                const numStr = String(lead.reviewCount).replace(/[^0-9]/g, '');
                const parsed = parseInt(numStr, 10);
                if (!isNaN(parsed)) reviewInt = parsed;
            }

            // Extract city from address
            let city = null;
            if (lead.address && lead.address !== 'N/A') {
                const parts = lead.address.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    city = parts[parts.length - 2].replace(/\d+/g, '').trim() || null;
                }
            }

            // Calculate lead score
            let score = 50;
            if (!lead.hasWebsite) score += 25; else score -= 15;
            if (ratingFloat && ratingFloat >= 4.5) score += 15;
            else if (ratingFloat && ratingFloat >= 4.0) score += 10;
            else if (ratingFloat && ratingFloat >= 3.0) score += 5;
            if (lead.phone && lead.phone !== 'N/A') score += 5;
            if (lead.socials && lead.socials.length > 0 && lead.socials !== 'None found') score += 5;
            if (reviewInt && reviewInt >= 100) score += 10;
            else if (reviewInt && reviewInt >= 50) score += 5;
            score = Math.max(0, Math.min(100, score));

            await prisma.lead.upsert({
                where: {
                    name_address: {
                        name: lead.name,
                        address: lead.address || 'N/A'
                    }
                },
                update: {
                    phone: lead.phone,
                    website: lead.website,
                    hasWebsite: lead.hasWebsite,
                    rating: ratingFloat,
                    reviewCount: reviewInt,
                    city,
                    leadScore: score,
                    socials: lead.socials,
                    websiteStatus: lead.websiteStatus,
                    techStack: lead.techStack,
                    seoStatus: lead.seoStatus,
                    query: lead.query,
                },
                create: {
                    name: lead.name,
                    category: lead.category,
                    address: lead.address || 'N/A',
                    city,
                    phone: lead.phone,
                    website: lead.website,
                    hasWebsite: lead.hasWebsite,
                    rating: ratingFloat,
                    reviewCount: reviewInt,
                    leadScore: score,
                    socials: lead.socials,
                    websiteStatus: lead.websiteStatus,
                    techStack: lead.techStack,
                    seoStatus: lead.seoStatus,
                    query: lead.query,
                }
            });
            savedCount++;
        } catch (err) {
            log('error', `Failed to save lead ${lead.name} to DB: ${err.message}`);
        }
    }

    log('success', `Saved ${savedCount}/${newLeads.length} leads to PostgreSQL`);

    // Optionally export flat CSV directly from the entire database table
    try {
        await exportAllCsv();
    } catch (e) {
        log('warn', `CSV export failed: ${e.message}`);
    }

    return newLeads;
}

/**
 * Helper function to dump all DB leads to highly readable generic CSV format
 */
async function exportAllCsv() {
    ensureOutputDir();
    const allLeads = await prisma.lead.findMany({
        orderBy: { scrapedAt: 'desc' }
    });

    const csvWriter = createCsvWriter({
        path: CSV_PATH,
        header: [
            { id: 'name', title: 'Name' },
            { id: 'category', title: 'Category' },
            { id: 'address', title: 'Address' },
            { id: 'phone', title: 'Phone' },
            { id: 'website', title: 'Website' },
            { id: 'hasWebsite', title: 'Has Website' },
            { id: 'rating', title: 'Rating' },
            { id: 'reviewCount', title: 'Reviews' },
            { id: 'socials', title: 'Social Links' },
            { id: 'websiteStatus', title: 'Website Status' },
            { id: 'techStack', title: 'Tech Stack' },
            { id: 'seoStatus', title: 'SEO Status' },
            { id: 'query', title: 'Search Query' },
            { id: 'scrapedAt', title: 'Scraped At' },
        ],
    });
    await csvWriter.writeRecords(allLeads);
    log('success', `Exported ${allLeads.length} total leads to ${CSV_PATH}`);
}

/**
 * Re-export all data (used when enrichment is performed sequentially outside the loop)
 */
async function rewriteAllData() {
    await exportAllCsv();
}

/**
 * Fetch previously completed query strings from Postgres
 */
async function loadCompletedQueriesAsync() {
    try {
        const queries = await prisma.query.findMany({
            select: { query: true }
        });
        return queries.map(q => q.query);
    } catch (err) {
        log('error', `Failed loading completed queries: ${err.message}`);
        return [];
    }
}

/**
 * Synchronous backward-compat wrapper for legacy scrape loop support where needed,
 * but ideally scrape cycle should use async db interactions over JSON.
 * We'll use a local cache to keep it synchronous for now if strictly needed 
 * by unmodified calling routines.
 */
let _completedQueriesCache = null;
function loadCompletedQueries() {
    if (_completedQueriesCache !== null) return _completedQueriesCache;

    // Fallback block if caller refuses to wait setup.
    // Real implementation should await loadCompletedQueriesAsync()
    try {
        const p = path.join(OUTPUT_DIR, config.output.completedFile);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { }
    return [];
}

/**
 * Mark a query as completed in the DB
 */
async function markQueryCompletedAsync(query) {
    try {
        await prisma.query.upsert({
            where: { query },
            update: {},
            create: { query }
        });
    } catch (err) {
        log('error', `Failed to mark query completed in DB: ${err.message}`);
    }
}

function markQueryCompleted(query) {
    // Fire and forget wrapper for legacy synchronous logic in scrape.js
    markQueryCompletedAsync(query).catch(() => { });
}


module.exports = {
    saveLeads,
    loadCompletedQueriesAsync,
    loadCompletedQueries,
    markQueryCompletedAsync,
    markQueryCompleted,
    ensureOutputDir,
    rewriteAllData,
    exportAllCsv,
    prisma
};
