const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const { log, humanDelay } = require('./src/utils');
const { scrapeGoogleMaps } = require('./src/scraper');
const { saveLeads, loadCompletedQueries, markQueryCompleted } = require('./src/exporter');

/**
 * Load queries from queries.txt or CLI arguments
 */
function loadQueries() {
    // Check CLI args first
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length > 0) {
        log('info', `Using ${cliArgs.length} queries from command line arguments`);
        return cliArgs;
    }

    // Fall back to queries.txt
    const queriesFile = path.resolve('queries.txt');
    if (fs.existsSync(queriesFile)) {
        const lines = fs.readFileSync(queriesFile, 'utf-8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('#'));
        log('info', `Loaded ${lines.length} queries from queries.txt`);
        return lines;
    }

    log('error', 'No queries found! Pass queries as CLI args or add them to queries.txt');
    process.exit(1);
}

/**
 * Main execution
 */
async function main() {
    console.log('');
    log('info', '═══════════════════════════════════════════════');
    log('info', '  Google Business Scraper — Starting');
    log('info', '═══════════════════════════════════════════════');
    console.log('');

    const queries = loadQueries();
    const completed = loadCompletedQueries();
    let totalNewLeads = 0;

    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];

        // Skip already completed queries (resume logic)
        if (completed.includes(query)) {
            log('info', `Skipping already completed query: "${query}"`);
            continue;
        }

        log('info', `\n━━━ Query ${i + 1}/${queries.length}: "${query}" ━━━`);

        // Run the scraper
        const leads = await scrapeGoogleMaps(query);

        if (leads.length > 0) {
            // Save after each query (crash-safe)
            await saveLeads(leads);
            markQueryCompleted(query);
            totalNewLeads += leads.length;

            // Stats for this query
            const withSite = leads.filter(l => l.hasWebsite).length;
            const noSite = leads.filter(l => !l.hasWebsite).length;
            log('success', `Query results: ${leads.length} total | ${noSite} NO website (prospects!) | ${withSite} with website`);
        } else {
            log('warn', `No results found for "${query}"`);
            markQueryCompleted(query);
        }

        // Wait between queries (if not the last one)
        if (i < queries.length - 1) {
            const d = config.delays.betweenQueries;
            const waitSec = Math.random() * (d.max - d.min) + d.min;
            const waitMin = Math.round(waitSec / 60);
            log('info', `Waiting ~${waitMin} minutes before next query (safety delay)...`);
            await humanDelay(d.min, d.max);
        }
    }

    console.log('');
    log('success', '═══════════════════════════════════════════════');
    log('success', `  Done! ${totalNewLeads} new leads collected total`);
    log('success', '  Run "node server.js" to view results in the dashboard');
    log('success', '═══════════════════════════════════════════════');
    console.log('');
}

main().catch(err => {
    log('error', `Fatal: ${err.message}`);
    process.exit(1);
});
