require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./src/config');
const { enrichWebsite } = require('./src/enricher');
const { prisma, exportAllCsv } = require('./src/exporter');

const app = express();
app.use(express.json());
app.use(cors());
const PORT = config.dashboard.port;

/**
 * GET /api/leads — return paginated leads with sorting and advanced filters
 */
app.get('/api/leads', async (req, res) => {
    try {
        const {
            hasWebsite, query, category, minRating, search,
            page = 1, limit = 50,
            sortBy = 'scrapedAt', sortDir = 'desc',
            city, minReviews, maxReviews, minScore, tags
        } = req.query;

        // Build Prisma where clause
        const where = {};

        if (hasWebsite === 'yes') where.hasWebsite = true;
        else if (hasWebsite === 'no') where.hasWebsite = false;

        if (query) where.query = { contains: query, mode: 'insensitive' };
        if (category) where.category = { contains: category, mode: 'insensitive' };
        if (city) where.city = { contains: city, mode: 'insensitive' };

        if (minRating) where.rating = { ...where.rating, gte: parseFloat(minRating) };
        if (minReviews) where.reviewCount = { ...where.reviewCount, gte: parseInt(minReviews) };
        if (maxReviews) where.reviewCount = { ...where.reviewCount, lte: parseInt(maxReviews) };
        if (minScore) where.leadScore = { gte: parseInt(minScore) };
        if (tags) where.tags = { contains: tags, mode: 'insensitive' };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { query: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Build orderBy — validate allowed columns
        const allowedSortCols = ['name', 'category', 'rating', 'reviewCount', 'leadScore', 'scrapedAt', 'city'];
        const orderCol = allowedSortCols.includes(sortBy) ? sortBy : 'scrapedAt';
        const orderDir = sortDir === 'asc' ? 'asc' : 'desc';

        const pageNum = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 50;

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { [orderCol]: orderDir },
                skip: (pageNum - 1) * pageSize,
                take: pageSize,
            }),
            prisma.lead.count({ where })
        ]);

        res.json({
            data: leads,
            pagination: {
                total,
                page: pageNum,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
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
        const categoriesData = await prisma.lead.groupBy({
            by: ['category'],
            _count: { category: true },
            where: { category: { not: null, notIn: ['N/A', ''] } },
            orderBy: { _count: { category: 'desc' } },
            take: 10
        });

        const queriesData = await prisma.lead.findMany({
            select: { query: true },
            distinct: ['query'],
            where: { query: { not: null } }
        });

        const topCategories = categoriesData.map(c => ({
            name: c.category,
            count: c._count.category
        }));

        const queryList = queriesData.map(q => q.query).filter(Boolean);

        res.json({
            total,
            withWebsite,
            noWebsite,
            categories: topCategories.length, // Approximate for dashboard
            queries: queryList.length,
            topCategories,
            queryList,
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * POST /api/enrich/bulk — trigger enrichment for multiple websites
 * This runs asynchronously in the background so it doesn't block the API response.
 */
app.post('/api/enrich/bulk', async (req, res) => {
    const { websites } = req.body;
    if (!websites || !Array.isArray(websites)) {
        return res.status(400).json({ error: 'Missing or invalid websites array' });
    }

    // Respond immediately
    res.json({ message: `Queued ${websites.length} websites for enrichment` });

    // Process asynchronously
    (async () => {
        for (const website of websites) {
            try {
                const targetLead = await prisma.lead.findFirst({ where: { website } });
                if (!targetLead) continue;

                const enrichment = await enrichWebsite(website);
                await prisma.lead.update({
                    where: { id: targetLead.id },
                    data: { ...enrichment }
                });
            } catch (err) {
                console.error(`Failed to enrich ${website} in background:`, err);
            }
        }
        exportAllCsv().catch(e => console.error(e));
    })();
});

/**
 * DELETE /api/leads/bulk — delete multiple leads by ID
 */
app.delete('/api/leads/bulk', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'Missing or invalid ids array' });
    }

    try {
        await prisma.lead.deleteMany({
            where: { id: { in: ids } }
        });

        exportAllCsv().catch(e => console.error(e));
        res.json({ message: `Deleted ${ids.length} leads` });
    } catch (err) {
        console.error('Failed to bulk delete:', err);
        res.status(500).json({ error: 'Failed to delete leads' });
    }
});

// ── New Phase B Endpoints ────────────────────────────────────────────

const multer = require('multer');
const { parse } = require('csv-parse/sync');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * PATCH /api/leads/:id — inline edit a single lead field
 */
app.patch('/api/leads/:id', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const updates = req.body; // { field: value, ... }

        const existing = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!existing) return res.status(404).json({ error: 'Lead not found' });

        // Log each changed field
        const logEntries = [];
        for (const [field, newValue] of Object.entries(updates)) {
            const oldValue = existing[field];
            if (String(oldValue) !== String(newValue)) {
                logEntries.push({
                    leadId,
                    action: 'edited',
                    field,
                    oldValue: oldValue != null ? String(oldValue) : null,
                    newValue: newValue != null ? String(newValue) : null,
                });
            }
        }

        const updated = await prisma.lead.update({
            where: { id: leadId },
            data: updates,
        });

        if (logEntries.length > 0) {
            await prisma.leadLog.createMany({ data: logEntries });
        }

        res.json(updated);
    } catch (err) {
        console.error('Error updating lead:', err);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

/**
 * GET /api/leads/:id/logs — audit history for a specific lead
 */
app.get('/api/leads/:id/logs', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const logs = await prisma.leadLog.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(logs);
    } catch (err) {
        console.error('Error fetching lead logs:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * POST /api/leads/import — import leads from CSV file
 */
app.post('/api/leads/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const csvContent = req.file.buffer.toString('utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        let imported = 0;
        let duplicatesSkipped = 0;
        let errors = 0;

        for (const row of records) {
            try {
                const name = row.Name || row.name || row.business_name;
                const address = row.Address || row.address || 'N/A';
                if (!name) { errors++; continue; }

                // Extract city
                let city = null;
                const parts = address.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    city = parts[parts.length - 2].replace(/\d+/g, '').trim() || null;
                }

                const rating = parseFloat(row.Rating || row.rating) || null;
                const reviewCount = parseInt(String(row.Reviews || row.reviewCount || row.review_count || '').replace(/[^0-9]/g, '')) || null;
                const hasWebsite = !!(row.Website || row.website) && (row.Website || row.website) !== 'None';

                let score = 50;
                if (!hasWebsite) score += 25; else score -= 15;
                if (rating && rating >= 4.0) score += 10;
                if (reviewCount && reviewCount >= 50) score += 5;
                score = Math.max(0, Math.min(100, score));

                await prisma.lead.upsert({
                    where: { name_address: { name, address } },
                    update: {}, // Don't overwrite existing data
                    create: {
                        name,
                        category: row.Category || row.category || null,
                        address,
                        city,
                        phone: row.Phone || row.phone || null,
                        website: row.Website || row.website || null,
                        hasWebsite,
                        rating,
                        reviewCount,
                        leadScore: score,
                        socials: row.Socials || row.socials || null,
                        query: row.Query || row.query || 'imported',
                    },
                });

                imported++;
            } catch (upsertErr) {
                if (upsertErr.code === 'P2002') {
                    duplicatesSkipped++;
                } else {
                    errors++;
                    console.error('Import row error:', upsertErr.message);
                }
            }
        }

        res.json({ imported, duplicatesSkipped, errors, totalRows: records.length });
    } catch (err) {
        console.error('CSV import failed:', err);
        res.status(500).json({ error: 'Failed to import CSV' });
    }
});

/**
 * POST /api/leads/deduplicate — find and merge duplicate leads
 */
app.post('/api/leads/deduplicate', async (req, res) => {
    try {
        // Find exact duplicates (same name + same city, different IDs)
        const duplicates = await prisma.$queryRawUnsafe(`
            SELECT name, city, COUNT(*)::int as count, array_agg(id ORDER BY id) as ids
            FROM "Lead"
            WHERE city IS NOT NULL
            GROUP BY name, city
            HAVING COUNT(*) > 1
            LIMIT 100
        `);

        let mergedCount = 0;
        for (const group of duplicates) {
            const keepId = group.ids[0]; // Keep the first (oldest) record
            const deleteIds = group.ids.slice(1);

            await prisma.lead.deleteMany({
                where: { id: { in: deleteIds } }
            });

            await prisma.leadLog.create({
                data: {
                    leadId: keepId,
                    action: 'deduplicated',
                    field: 'merged',
                    newValue: `Merged ${deleteIds.length} duplicate(s)`,
                }
            });

            mergedCount += deleteIds.length;
        }

        res.json({
            duplicateGroups: duplicates.length,
            mergedCount,
            message: `Found ${duplicates.length} duplicate groups, merged ${mergedCount} records.`
        });
    } catch (err) {
        console.error('Deduplication failed:', err);
        res.status(500).json({ error: 'Failed to deduplicate' });
    }
});

/**
 * POST /api/leads/score — recalculate lead scores for all or selected leads
 */
app.post('/api/leads/score', async (req, res) => {
    try {
        const { ids } = req.body; // Optional: array of specific lead IDs
        const where = ids && Array.isArray(ids) ? { id: { in: ids } } : {};

        const leads = await prisma.lead.findMany({ where });
        let updated = 0;

        for (const lead of leads) {
            let score = 50;
            if (!lead.hasWebsite) score += 25; else score -= 15;
            if (lead.rating && lead.rating >= 4.5) score += 15;
            else if (lead.rating && lead.rating >= 4.0) score += 10;
            else if (lead.rating && lead.rating >= 3.0) score += 5;
            if (lead.phone && lead.phone !== 'N/A') score += 5;
            if (lead.socials && lead.socials.length > 0 && lead.socials !== 'None found') score += 5;
            if (lead.reviewCount && lead.reviewCount >= 100) score += 10;
            else if (lead.reviewCount && lead.reviewCount >= 50) score += 5;
            score = Math.max(0, Math.min(100, score));

            if (score !== lead.leadScore) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { leadScore: score }
                });
                updated++;
            }
        }

        res.json({ message: `Recalculated scores for ${leads.length} leads, ${updated} changed.` });
    } catch (err) {
        console.error('Scoring failed:', err);
        res.status(500).json({ error: 'Failed to recalculate scores' });
    }
});

/**
 * GET /api/leads/categories — distinct category list for filter dropdowns
 */
app.get('/api/leads/categories', async (req, res) => {
    try {
        const categories = await prisma.lead.findMany({
            select: { category: true },
            distinct: ['category'],
            where: { category: { not: null, notIn: ['N/A', ''] } },
            orderBy: { category: 'asc' },
        });
        res.json(categories.map(c => c.category));
    } catch (err) {
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
        await prisma.job.upsert({
            where: { id: String(job.id) },
            update: {
                query: query,
                status: 'waiting',
                params: params ? JSON.stringify(params) : null
            },
            create: {
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
 * POST /api/jobs/batch — submit multiple queries at once
 */
app.post('/api/jobs/batch', async (req, res) => {
    const { queries, params } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid queries array' });
    }

    try {
        const { addScrapeJob } = require('./src/queue/scraperQueue');
        const jobs = [];

        for (const query of queries) {
            const trimmedQuery = query.trim();
            if (!trimmedQuery) continue;

            const job = await addScrapeJob(trimmedQuery, params);

            // Ensure a DB record exists initially
            await prisma.job.create({
                data: {
                    id: String(job.id),
                    query: trimmedQuery,
                    status: 'waiting',
                    params: params ? JSON.stringify(params) : null
                }
            });
            jobs.push(job.id);
        }

        res.json({ message: `Added ${jobs.length} jobs to queue`, jobIds: jobs });
    } catch (err) {
        console.error('Error adding batch jobs to queue:', err);
        res.status(500).json({ error: 'Failed to add batch jobs' });
    }
});

/**
 * DELETE /api/jobs/clear — remove completed/failed/stalled jobs from history
 */
app.delete('/api/jobs/clear', async (req, res) => {
    try {
        await prisma.job.deleteMany({
            where: {
                status: {
                    in: ['completed', 'failed', 'stalled']
                }
            }
        });
        res.json({ message: 'History cleared' });
    } catch (err) {
        console.error('Error clearing jobs:', err);
        res.status(500).json({ error: 'Failed to clear jobs' });
    }
});

/**
 * POST /api/jobs/:id/cancel — cancel a waiting/active/stalled job
 */
app.post('/api/jobs/:id/cancel', async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });

        if (!jobRecord) return res.status(404).json({ error: 'Job not found' });
        if (jobRecord.status === 'completed') return res.status(400).json({ error: 'Job already completed' });

        const { scraperQueue } = require('./src/queue/scraperQueue');
        const bullJob = await scraperQueue.getJob(jobId);

        if (bullJob) {
            try { await bullJob.remove(); } catch { /* job may not exist in Redis anymore */ }
        }

        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'failed', completedAt: new Date() }
        });

        res.json({ message: 'Job cancelled' });
    } catch (err) {
        console.error('Error cancelling job:', err);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
});

/**
 * DELETE /api/jobs/:id — cancel and completely delete a job
 */
app.delete('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });

        if (!jobRecord) return res.status(404).json({ error: 'Job not found' });

        const { scraperQueue } = require('./src/queue/scraperQueue');
        const bullJob = await scraperQueue.getJob(jobId);

        // Remove from bull queue if it exists
        if (bullJob) {
            try { await bullJob.remove(); } catch { /* job may be locked or already gone from Redis */ }
        }

        // Delete from postgres
        await prisma.job.delete({
            where: { id: jobId }
        });

        res.json({ message: 'Job deleted' });
    } catch (err) {
        console.error('Error deleting job:', err);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

/**
 * POST /api/jobs/:id/retry — retry a failed/stalled/cancelled job
 */
app.post('/api/jobs/:id/retry', async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });

        if (!jobRecord) return res.status(404).json({ error: 'Job not found' });
        if (!['failed', 'stalled', 'completed'].includes(jobRecord.status)) {
            return res.status(400).json({ error: `Cannot retry a job with status "${jobRecord.status}"` });
        }

        const { addScrapeJob } = require('./src/queue/scraperQueue');
        const params = jobRecord.params ? JSON.parse(jobRecord.params) : {};
        const bullJob = await addScrapeJob(jobRecord.query, params);

        await prisma.job.create({
            data: {
                id: String(bullJob.id),
                query: jobRecord.query,
                status: 'waiting',
                params: jobRecord.params
            }
        });

        res.json({ message: 'Job retried', jobId: bullJob.id });
    } catch (err) {
        console.error('Error retrying job:', err);
        res.status(500).json({ error: 'Failed to retry job' });
    }
});

/**
 * POST /api/jobs/requeue-stalled — re-queue all stalled jobs as new jobs
 */
app.post('/api/jobs/requeue-stalled', async (req, res) => {
    try {
        const stalledJobs = await prisma.job.findMany({
            where: { status: 'stalled' }
        });

        if (stalledJobs.length === 0) {
            return res.json({ message: 'No stalled jobs to re-queue', count: 0 });
        }

        const { addScrapeJob } = require('./src/queue/scraperQueue');
        const newJobIds = [];

        for (const stalledJob of stalledJobs) {
            const params = stalledJob.params ? JSON.parse(stalledJob.params) : {};
            const bullJob = await addScrapeJob(stalledJob.query, params);

            await prisma.job.create({
                data: {
                    id: String(bullJob.id),
                    query: stalledJob.query,
                    status: 'waiting',
                    params: stalledJob.params
                }
            });

            newJobIds.push(bullJob.id);
        }

        // Delete the old stalled job records
        await prisma.job.deleteMany({
            where: { status: 'stalled' }
        });

        res.json({ message: `Re-queued ${newJobIds.length} stalled job(s)`, count: newJobIds.length, jobIds: newJobIds });
    } catch (err) {
        console.error('Error re-queuing stalled jobs:', err);
        res.status(500).json({ error: 'Failed to re-queue stalled jobs' });
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

/**
 * GET /api/settings — get global settings from DB
 */
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await prisma.setting.findMany();
        const settingsObj = {};
        for (const s of settings) {
            try {
                settingsObj[s.key] = JSON.parse(s.value);
            } catch {
                settingsObj[s.key] = s.value;
            }
        }
        res.json(settingsObj);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * POST /api/settings — update global settings in DB
 */
app.post('/api/settings', async (req, res) => {
    try {
        const updates = req.body;

        // Convert object to key-value upsert queries
        const queries = Object.keys(updates).map(key => {
            const value = typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : String(updates[key]);
            return prisma.setting.upsert({
                where: { key },
                update: { value },
                create: { key, value }
            });
        });

        await prisma.$transaction(queries);
        res.json({ message: 'Settings updated' });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── CRM Sales Pipeline Endpoints ──────────────────────────────────────────

/**
 * GET /api/crm/stats — pipeline counts per CRM status
 */
app.get('/api/crm/stats', async (req, res) => {
    try {
        const statuses = ['new', 'attempting', 'connected', 'qualified', 'disqualified', 'closed_won', 'closed_lost'];
        const counts = await prisma.lead.groupBy({
            by: ['crmStatus'],
            _count: { crmStatus: true },
        });

        const statsMap = {};
        for (const s of statuses) statsMap[s] = 0;
        for (const c of counts) {
            if (statsMap[c.crmStatus] !== undefined) {
                statsMap[c.crmStatus] = c._count.crmStatus;
            }
        }

        const totalCalls = await prisma.callLog.count();
        const followUpsDueToday = await prisma.lead.count({
            where: {
                nextFollowUp: { lte: new Date(new Date().setHours(23, 59, 59, 999)) },
                crmStatus: { notIn: ['closed_won', 'closed_lost', 'disqualified'] }
            }
        });

        res.json({ ...statsMap, totalCalls, followUpsDueToday });
    } catch (err) {
        console.error('CRM stats error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * GET /api/crm/queue — smart prioritized queue for dialer
 * Ordered: follow-ups due first, then by leadScore desc, uncontacted first
 */
app.get('/api/crm/queue', async (req, res) => {
    try {
        const { status = 'all', minScore = '0', limit = '50' } = req.query;

        const where = {
            leadScore: { gte: parseInt(minScore) || 0 },
        };

        if (status !== 'all') {
            where.crmStatus = status;
        } else {
            // Default: exclude closed/disqualified
            where.crmStatus = { notIn: ['closed_won', 'closed_lost', 'disqualified'] };
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: [
                { nextFollowUp: 'asc' },
                { crmStatus: 'asc' },  // new before attempting before connected
                { leadScore: 'desc' },
            ],
            take: parseInt(limit) || 50,
        });

        res.json(leads);
    } catch (err) {
        console.error('CRM queue error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * PATCH /api/leads/:id/crm — update CRM status fields
 */
app.patch('/api/leads/:id/crm', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const { crmStatus, nextFollowUp, qualificationNotes } = req.body;

        const existing = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!existing) return res.status(404).json({ error: 'Lead not found' });

        const data = {};
        if (crmStatus !== undefined) data.crmStatus = crmStatus;
        if (nextFollowUp !== undefined) data.nextFollowUp = nextFollowUp ? new Date(nextFollowUp) : null;
        if (qualificationNotes !== undefined) data.qualificationNotes = qualificationNotes;

        const updated = await prisma.lead.update({ where: { id: leadId }, data });

        // Log the status change
        if (crmStatus && crmStatus !== existing.crmStatus) {
            await prisma.leadLog.create({
                data: {
                    leadId,
                    action: 'status_changed',
                    field: 'crmStatus',
                    oldValue: existing.crmStatus,
                    newValue: crmStatus,
                }
            });
        }

        res.json(updated);
    } catch (err) {
        console.error('CRM update error:', err);
        res.status(500).json({ error: 'Failed to update CRM status' });
    }
});

/**
 * POST /api/leads/:id/calls — log a call for a lead
 */
app.post('/api/leads/:id/calls', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const { outcome, notes, duration, crmStatus } = req.body;

        if (!outcome) return res.status(400).json({ error: 'Missing outcome' });

        const existing = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!existing) return res.status(404).json({ error: 'Lead not found' });

        // Create call log
        const callLog = await prisma.callLog.create({
            data: { leadId, outcome, notes: notes || null, duration: duration || null }
        });

        // Update lead: increment callCount, set lastCalledAt, optionally update crmStatus
        const updateData = {
            callCount: { increment: 1 },
            lastCalledAt: new Date(),
        };
        if (crmStatus) updateData.crmStatus = crmStatus;

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
        });

        // Log call in audit trail
        await prisma.leadLog.create({
            data: {
                leadId,
                action: 'call_logged',
                field: 'outcome',
                newValue: `${outcome}${notes ? ` — ${notes.substring(0, 80)}` : ''}`,
            }
        });

        res.json({ callLog, lead: updatedLead });
    } catch (err) {
        console.error('Call log error:', err);
        res.status(500).json({ error: 'Failed to log call' });
    }
});

/**
 * GET /api/leads/:id/calls — get call history for a lead
 */
app.get('/api/leads/:id/calls', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const calls = await prisma.callLog.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(calls);
    } catch (err) {
        console.error('Call history error:', err);
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
