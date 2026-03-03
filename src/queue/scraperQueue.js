const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Connect to the Redis instance set up in docker-compose
const connection = new Redis({
    host: '127.0.0.1',
    port: 6379, // We mapped Redis 6379 to host 6380 in docker-compose.yml
    maxRetriesPerRequest: null
});

// Create the scraping job queue
const scraperQueue = new Queue('scraperQueue', { connection });

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
