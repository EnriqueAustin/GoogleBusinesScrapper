require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./src/config');
const { enrichWebsite } = require('./src/enricher');
const { prisma, exportAllCsv } = require('./src/exporter');

const app = express();
app.use(express.json());
const PORT = config.dashboard.port;

// Serve dashboard static files
app.use(express.static(path.join(__dirname, 'dashboard')));

/**
 * GET /api/leads — return all leads, with optional query param filtering
 */
app.get('/api/leads', async (req, res) => {
    try {
        const { hasWebsite, query, category, minRating, search } = req.query;

        // Build Prisma where clause
        const where = {};

        if (hasWebsite === 'yes') {
            where.hasWebsite = true;
        } else if (hasWebsite === 'no') {
            where.hasWebsite = false;
        }

        if (query) {
            where.query = { contains: query, mode: 'insensitive' };
        }

        if (category) {
            where.category = { contains: category, mode: 'insensitive' };
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
            ];
        }

        let leads = await prisma.lead.findMany({
            where,
            orderBy: { scrapedAt: 'desc' }
        });

        // Prisma doesn't natively support > filtering on strings, so we filter rating in memory
        // (If we change schema to float later, we could push this to the DB)
        if (minRating) {
            const min = parseFloat(minRating);
            leads = leads.filter(l => l.rating !== 'N/A' && l.rating !== null && parseFloat(l.rating) >= min);
        }

        res.json(leads);
    } catch (err) {
        console.error('Error fetching leads:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * GET /api/stats — summary statistics
 */
app.get('/api/stats', async (req, res) => {
    try {
        const total = await prisma.lead.count();
        const withWebsite = await prisma.lead.count({ where: { hasWebsite: true } });
        const noWebsite = await prisma.lead.count({ where: { hasWebsite: false } });

        // Get unique categories and queries
        const categoriesData = await prisma.lead.findMany({
            select: { category: true },
            distinct: ['category'],
            where: { category: { not: 'N/A', not: null } }
        });

        const queriesData = await prisma.lead.findMany({
            select: { query: true },
            distinct: ['query'],
            where: { query: { not: null } }
        });

        const categoryList = categoriesData.map(c => c.category).filter(Boolean);
        const queryList = queriesData.map(q => q.query).filter(Boolean);

        res.json({
            total,
            withWebsite,
            noWebsite,
            categories: categoryList.length,
            queries: queryList.length,
            categoryList,
            queryList,
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * GET /api/queries — list of completed scrape queries
 */
app.get('/api/queries', async (req, res) => {
    try {
        const queries = await prisma.query.findMany({
            orderBy: { scrapedAt: 'desc' },
            select: { query: true, scrapedAt: true }
        });
        res.json(queries.map(q => q.query));
    } catch (err) {
        console.error('Error fetching completed queries:', err);
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

    try {
        // Find lead by website
        const targetLead = await prisma.lead.findFirst({
            where: { website }
        });

        if (!targetLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Run enrichment fetcher
        const enrichment = await enrichWebsite(website);

        // Update the lead in DB
        const updatedLead = await prisma.lead.update({
            where: { id: targetLead.id },
            data: {
                ...enrichment,
            }
        });

        // Trigger a background CSV rewrite so it stays in sync
        exportAllCsv().catch(err => console.error('Failed to sync CSV:', err));

        res.json(updatedLead);
    } catch (err) {
        console.error('Error enriching website:', err);
        res.status(500).json({ error: 'Failed to enrich website' });
    }
});

app.listen(PORT, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │                                              │`);
    console.log(`  │   Google Business Scraper — Dashboard V2     │`);
    console.log(`  │   (Powered by PostgreSQL)                    │`);
    console.log(`  │                                              │`);
    console.log(`  │   http://localhost:${PORT}                      │`);
    console.log(`  │                                              │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
});
