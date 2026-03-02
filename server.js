const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');

const app = express();
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

app.listen(PORT, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │                                              │`);
    console.log(`  │   Google Business Scraper — Dashboard        │`);
    console.log(`  │   http://localhost:${PORT}                      │`);
    console.log(`  │                                              │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
});
