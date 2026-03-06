require('dotenv').config();
const { Worker } = require('bullmq');
const connection = require('./queue/scraperQueue').connection;
const { scrapeGoogleMaps } = require('./scraper');
const { saveLeads, markQueryCompletedAsync, prisma } = require('./exporter');
const { enrichWebsite } = require('./enricher');
const config = require('./config');
const { log, humanDelay } = require('./utils');

// ── Startup Recovery ─────────────────────────────────────────────────
// Mark any leftover 'active' jobs as 'stalled' (catches ungraceful shutdowns)
(async () => {
    try {
        const stalledCount = await prisma.job.updateMany({
            where: { status: 'active' },
            data: { status: 'stalled' }
        });
        if (stalledCount.count > 0) {
            log('warn', `Startup recovery: Marked ${stalledCount.count} leftover active job(s) as stalled`);
        }
    } catch (e) {
        log('error', `Startup recovery failed: ${e.message}`);
    }
})();

// ── Worker Setup ─────────────────────────────────────────────────────
const scraperWorker = new Worker('scraperQueue', async (job) => {
    const { query, params } = job.data;
    log('info', `\n==== Worker started job ${job.id} for query: "${query}" ====`);

    try {
        // 1. Mark job as active in DB (server.js already created it with 'waiting')
        await prisma.job.upsert({
            where: { id: String(job.id) },
            update: {
                status: 'active',
                startedAt: new Date()
            },
            create: {
                id: String(job.id),
                query: query,
                status: 'active',
                startedAt: new Date(),
                params: params ? JSON.stringify(params) : null
            }
        });

        const startTime = Date.now();

        // 1.5 Fetch and Override Global Settings
        try {
            const dbSettings = await prisma.setting.findMany();
            const s = {};
            dbSettings.forEach(row => {
                try { s[row.key] = JSON.parse(row.value); }
                catch { s[row.key] = row.value; }
            });

            if (s.headless !== undefined) config.browser.headless = s.headless === "true" || s.headless === true;
            if (s.proxyUrl) config.browser.proxy = { server: s.proxyUrl };
            if (s.maxResultsPerQuery !== undefined) config.limits.maxResultsPerQuery = parseInt(s.maxResultsPerQuery, 10);
            if (s.maxScrollAttempts !== undefined) config.limits.maxScrollAttempts = parseInt(s.maxScrollAttempts, 10);
            if (s.enrichWebsitesDuringScrape !== undefined) config.features.enrichWebsitesDuringScrape = s.enrichWebsitesDuringScrape === "true" || s.enrichWebsitesDuringScrape === true;

            log('info', `Applied Dynamic Settings from DB: ${JSON.stringify(s)}`);
        } catch (e) {
            log('warn', `Failed to apply dynamic settings, using default config.js. Error: ${e.message}`);
        }

        // 2. Scrape
        const leads = await scrapeGoogleMaps(query);

        // 3. Optional Enrichment
        if (config.features && config.features.enrichWebsitesDuringScrape) {
            log('info', `Enriching websites for query "${query}"...`);
            for (let j = 0; j < leads.length; j++) {
                if (leads[j].hasWebsite && leads[j].website !== 'None') {
                    const enrichment = await enrichWebsite(leads[j].website);
                    leads[j] = { ...leads[j], ...enrichment };
                    await humanDelay(1, 2);
                }
            }
        }

        // 4. Save and Update
        if (leads.length > 0) {
            await saveLeads(leads);
            // Mark the query itself as completed
            await markQueryCompletedAsync(query);
        } else {
            log('warn', `No results found for "${query}"`);
            await markQueryCompletedAsync(query);
        }

        // 5. Mark job as completed
        const durationMs = Date.now() - startTime;
        await prisma.job.update({
            where: { id: String(job.id) },
            data: {
                status: 'completed',
                resultsCount: leads.length,
                durationMs,
                completedAt: new Date()
            }
        });

        log('success', `==== Worker completed job ${job.id} - ${leads.length} leads ====`);
        return { success: true, count: leads.length };

    } catch (error) {
        log('error', `==== Worker failed job ${job.id} ====`);
        log('error', error.message);

        // Mark Job as failed
        try {
            await prisma.job.update({
                where: { id: String(job.id) },
                data: {
                    status: 'failed',
                    completedAt: new Date()
                }
            });
        } catch (e) {
            console.error("Failed to update job status to failed", e);
        }

        throw error;
    }
}, {
    connection,
    concurrency: 1,
    lockDuration: 600000,      // 10 minutes — scrapes are long-running
    lockRenewTime: 60000,      // Renew lock every 60 seconds
    stalledInterval: 300000,   // Check for stalled jobs every 5 minutes
    maxStalledCount: 0,        // Do NOT auto-retry stalled jobs — mark as stalled instead
});

// ── Worker Lifecycle Events ──────────────────────────────────────────

scraperWorker.on('completed', (job, result) => {
    log('success', `Job ${job.id} completed with result: ${JSON.stringify(result)}`);
});

scraperWorker.on('failed', (job, err) => {
    log('error', `Job ${job.id} failed: ${err.message}`);
});

scraperWorker.on('stalled', async (jobId) => {
    log('warn', `Job ${jobId} stalled — marking as stalled in database`);
    try {
        await prisma.job.update({
            where: { id: String(jobId) },
            data: { status: 'stalled' }
        });
    } catch (e) {
        log('error', `Failed to mark stalled job ${jobId}: ${e.message}`);
    }
});

scraperWorker.on('error', (err) => {
    log('error', `Worker error: ${err.message}`);
});

// ── Graceful Shutdown ────────────────────────────────────────────────
// On shutdown, mark all active and waiting jobs as 'stalled'
async function gracefulShutdown(signal) {
    log('warn', `Received ${signal} — shutting down gracefully...`);

    try {
        // Stop accepting new jobs
        await scraperWorker.close();
        log('info', 'Worker closed, no longer accepting jobs');

        // Mark active & waiting jobs as stalled so they can be re-queued from the frontend
        const result = await prisma.job.updateMany({
            where: { status: { in: ['active', 'waiting'] } },
            data: { status: 'stalled' }
        });

        if (result.count > 0) {
            log('warn', `Marked ${result.count} active/waiting job(s) as stalled`);
        }
    } catch (e) {
        log('error', `Shutdown error: ${e.message}`);
    } finally {
        await prisma.$disconnect();
        log('info', 'Shutdown complete');
        process.exit(0);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Keep process alive
process.on('unhandledRejection', (reason) => {
    log('error', `Unhandled Rejection: ${reason}`);
});

log('info', '✅ Scraper Worker is running and listening for jobs...');
