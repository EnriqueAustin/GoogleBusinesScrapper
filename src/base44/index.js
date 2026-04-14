#!/usr/bin/env node
/**
 * Base44 Standalone CLI
 * Run: node src/base44/index.js '{"businessName":"Test",...}'
 * Or:  echo '{"businessName":"Test"}' | node src/base44/index.js
 */
const { generateDemoSite } = require('./orchestrator');

async function main() {
    let inputData;

    // Try arg first, then stdin
    if (process.argv[2]) {
        try {
            inputData = JSON.parse(process.argv[2]);
        } catch {
            console.error('ERROR: Invalid JSON argument');
            console.error('Usage: node src/base44/index.js \'{"businessName":"MyBiz",...}\'');
            process.exit(1);
        }
    } else {
        // Read from stdin
        const chunks = [];
        process.stdin.setEncoding('utf8');

        await new Promise((resolve) => {
            process.stdin.on('data', (chunk) => chunks.push(chunk));
            process.stdin.on('end', resolve);

            // Timeout after 5s if no stdin
            setTimeout(() => {
                if (chunks.length === 0) {
                    console.error('No input. Pass JSON as argument or pipe to stdin.');
                    console.error('Usage: node src/base44/index.js \'{"businessName":"MyBiz"}\'');
                    process.exit(1);
                }
                resolve();
            }, 5000);
        });

        try {
            inputData = JSON.parse(chunks.join(''));
        } catch {
            console.error('ERROR: Invalid JSON from stdin');
            process.exit(1);
        }
    }

    console.log('\n🚀 Base44 Demo Site Generator — Standalone Mode\n');
    console.log(`Business: ${inputData.businessName || '(not set)'}`);
    console.log(`Industry: ${inputData.industry || '(default)'}`);
    console.log(`Location: ${inputData.location || '(default)'}\n`);

    const result = await generateDemoSite(inputData, (status, msg) => {
        const icon = status === 'completed' ? '✅' :
            status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} [${status}] ${msg}`);
    });

    console.log('\n─── Result ───');
    console.log(JSON.stringify(result, null, 2));

    process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
