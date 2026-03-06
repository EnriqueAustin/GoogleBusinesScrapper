const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Connect to the Redis instance set up in docker-compose
const connection = new Redis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null
});

// Create the scraping job queue with safe defaults
const scraperQueue = new Queue('scraperQueue', {
    connection,
    defaultJobOptions: {
        attempts: 1,             // No auto-retry — stalled jobs go to frontend for manual action
        removeOnComplete: 100,   // Keep last 100 completed jobs in Redis, auto-clean older ones
        removeOnFail: 50,        // Keep last 50 failed jobs in Redis
    }
});

async function addScrapeJob(query, params = {}) {
    // Add a new job to the queue
    const job = await scraperQueue.add('scrapeMaps', { query, params });
    return job;
}

module.exports = {
    scraperQueue,
    addScrapeJob,
    connection
};
