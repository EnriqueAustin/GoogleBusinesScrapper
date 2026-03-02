const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const { enrichWebsite } = require('./src/enricher');
const { rewriteAllData } = require('./src/exporter');

const app = express();
app.use(express.json());
const PORT = config.dashboard.port;
const JSON_PATH = path.resolve(config.output.dir, config.output.jsonFile);
const COMPLETED_PATH = path.resolve(config.output.dir, config.output.completedFile);

// Serve dashboard static files
app.use(express.static(path.join(__dirname, 'dashboard')));

/**
 * Load leads from JSON file
 */
function loadLeads() {
    try {
        if (fs.existsSync(JSON_PATH)) {
            return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
        }
    } catch (err) {
        console.error('Error loading leads:', err.message);
    }
    return [];
}

/**
 * GET /api/leads — return all leads, with optional query param filtering
 */
app.get('/api/leads', (req, res) => {
    let leads = loadLeads();
    const { hasWebsite, query, category, minRating, search } = req.query;

    if (hasWebsite === 'yes') {
        leads = leads.filter(l => l.hasWebsite === true);
    } else if (hasWebsite === 'no') {
        leads = leads.filter(l => l.hasWebsite === false);
    }

    if (query) {
        leads = leads.filter(l => l.query && l.query.toLowerCase().includes(query.toLowerCase()));
    }

    if (category) {
        leads = leads.filter(l => l.category && l.category.toLowerCase().includes(category.toLowerCase()));
    }

    if (minRating) {
        const min = parseFloat(minRating);
        leads = leads.filter(l => l.rating !== 'N/A' && parseFloat(l.rating) >= min);
    }

    if (search) {
        const s = search.toLowerCase();
        leads = leads.filter(l =>
            (l.name && l.name.toLowerCase().includes(s)) ||
            (l.address && l.address.toLowerCase().includes(s)) ||
            (l.category && l.category.toLowerCase().includes(s)) ||
            (l.phone && l.phone.toLowerCase().includes(s))
        );
    }

    res.json(leads);
});

/**
 * GET /api/stats — summary statistics
 */
app.get('/api/stats', (req, res) => {
    const leads = loadLeads();
    const withWebsite = leads.filter(l => l.hasWebsite).length;
    const noWebsite = leads.filter(l => !l.hasWebsite).length;

    // Unique categories
    const categories = new Set(leads.map(l => l.category).filter(c => c && c !== 'N/A'));

    // Unique queries
    const queries = new Set(leads.map(l => l.query).filter(q => q));

    res.json({
        total: leads.length,
        withWebsite,
        noWebsite,
        categories: categories.size,
        queries: queries.size,
        categoryList: [...categories],
        queryList: [...queries],
    });
});

/**
 * GET /api/queries — list of completed scrape queries
 */
app.get('/api/queries', (req, res) => {
    try {
        if (fs.existsSync(COMPLETED_PATH)) {
            const data = JSON.parse(fs.readFileSync(COMPLETED_PATH, 'utf-8'));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch {
        res.json([]);
    }
});

/**
 * POST /api/enrich — enrich a specific lead by website URL
 */
app.post('/api/enrich', async (req, res) => {
    const { website } = req.body;
    if (!website) {
        return res.status(400).json({ error: 'Missing website URL' });
    }

    const leads = loadLeads();
    const leadIndex = leads.findIndex(l => l.website === website);

    if (leadIndex === -1) {
        return res.status(404).json({ error: 'Lead not found' });
    }

    try {
        const enrichment = await enrichWebsite(website);

        // Update the lead
        leads[leadIndex] = { ...leads[leadIndex], ...enrichment };

        // Save the updated leads
        await rewriteAllData(leads);

        res.json(leads[leadIndex]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to enrich website' });
    }
});

app.listen(PORT, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │                                              │`);
    console.log(`  │   Google Business Scraper — Dashboard        │`);
    console.log(`  │   http://localhost:${PORT}                      │`);
    console.log(`  │                                              │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
});
