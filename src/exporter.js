const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('./config');
const { log } = require('./utils');

const OUTPUT_DIR = path.resolve(config.output.dir);
const CSV_PATH = path.join(OUTPUT_DIR, config.output.csvFile);
const JSON_PATH = path.join(OUTPUT_DIR, config.output.jsonFile);
const COMPLETED_PATH = path.join(OUTPUT_DIR, config.output.completedFile);

/**
 * Ensure the output directory exists
 */
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        log('info', `Created output directory: ${OUTPUT_DIR}`);
    }
}

/**
 * Load existing leads from JSON (for deduplication)
 */
function loadExistingLeads() {
    try {
        if (fs.existsSync(JSON_PATH)) {
            const data = fs.readFileSync(JSON_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        log('warn', `Could not load existing leads: ${err.message}`);
    }
    return [];
}

/**
 * Deduplicate leads by name + address
 */
function deduplicateLeads(leads) {
    const seen = new Map();
    for (const lead of leads) {
        const key = `${lead.name}|${lead.address}`.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, lead);
        }
    }
    return [...seen.values()];
}

/**
 * Save leads to both CSV and JSON
 */
async function saveLeads(newLeads) {
    ensureOutputDir();

    // Merge with existing leads and deduplicate
    const existing = loadExistingLeads();
    const allLeads = deduplicateLeads([...existing, ...newLeads]);

    // Save JSON
    fs.writeFileSync(JSON_PATH, JSON.stringify(allLeads, null, 2), 'utf-8');
    log('success', `Saved ${allLeads.length} leads to ${JSON_PATH}`);

    // Save CSV
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
    log('success', `Saved ${allLeads.length} leads to ${CSV_PATH}`);

    return allLeads;
}

/**
 * Rewrite all data completely (used by the dashboard when updating a lead)
 */
async function rewriteAllData(leads) {
    ensureOutputDir();

    // Save JSON
    fs.writeFileSync(JSON_PATH, JSON.stringify(leads, null, 2), 'utf-8');

    // Save CSV
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
    await csvWriter.writeRecords(leads);
}

/**
 * Load completed queries (for resume logic)
 */
function loadCompletedQueries() {
    try {
        if (fs.existsSync(COMPLETED_PATH)) {
            const data = fs.readFileSync(COMPLETED_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        // ignore
    }
    return [];
}

/**
 * Mark a query as completed
 */
function markQueryCompleted(query) {
    ensureOutputDir();
    const completed = loadCompletedQueries();
    if (!completed.includes(query)) {
        completed.push(query);
        fs.writeFileSync(COMPLETED_PATH, JSON.stringify(completed, null, 2), 'utf-8');
    }
}

module.exports = {
    saveLeads,
    loadExistingLeads,
    loadCompletedQueries,
    markQueryCompleted,
    ensureOutputDir,
    rewriteAllData,
};
