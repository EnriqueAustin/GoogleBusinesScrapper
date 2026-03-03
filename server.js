require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const { enrichWebsite } = require('./src/enricher');
const { prisma, exportAllCsv } = require('./src/exporter');

const app = express();
app.use(express.json());
app.use(cors());
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

/**
 * POST /api/jobs — add a new scraping query to the queue
 */
app.post('/api/jobs', async (req, res) => {
    const { query, params } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        const { addScrapeJob } = require('./src/queue/scraperQueue');
        const job = await addScrapeJob(query, params);

        // Ensure a DB record exists initially
        await prisma.job.create({
            data: {
                id: String(job.id),
                query: query,
                status: 'waiting',
                params: params ? JSON.stringify(params) : null
            }
        });

        res.json({ message: 'Job added to queue', jobId: job.id });
    } catch (err) {
        console.error('Error adding job to queue:', err);
        res.status(500).json({ error: 'Failed to add job' });
    }
});

/**
 * GET /api/jobs — list all scraping jobs and their statuses
 */
app.get('/api/jobs', async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(jobs);
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * GET /api/jobs/:id — get a specific job
 */
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const job = await prisma.job.findUnique({
            where: { id: req.params.id }
        });
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).json({ error: 'Database error' });
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
