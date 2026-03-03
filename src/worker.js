require('dotenv').config();
const { Worker } = require('bullmq');
const connection = require('./queue/scraperQueue').connection;
const { scrapeGoogleMaps } = require('./scraper');
const { saveLeads, markQueryCompletedAsync, prisma } = require('./exporter');
const { enrichWebsite } = require('./enricher');
const config = require('./config');
const { log, humanDelay } = require('./utils');

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
}, { connection, concurrency: 1 });

// Worker lifecycle events — keep process alive
scraperWorker.on('completed', (job, result) => {
    log('success', `Job ${job.id} completed with result: ${JSON.stringify(result)}`);
});

scraperWorker.on('failed', (job, err) => {
    log('error', `Job ${job.id} failed: ${err.message}`);
});

scraperWorker.on('error', (err) => {
    log('error', `Worker error: ${err.message}`);
});

// Keep process alive
process.on('unhandledRejection', (reason) => {
    log('error', `Unhandled Rejection: ${reason}`);
});

log('info', '✅ Scraper Worker is running and listening for jobs...');
