#!/usr/bin/env node
/**
 * Reset Database — Clears all data for a fresh start.
 * Usage: npm run reset  (or: node scripts/reset-db.js)
 *
 * What it does:
 *   1. Deletes all leads, jobs, queries, and logs from Postgres
 *   2. Flushes the BullMQ Redis queue
 *   3. Cleans the output/ directory
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function resetDatabase() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ⚠️  DATABASE RESET                           ║');
    console.log('║  This will delete ALL data!                  ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ── 1. Clear Postgres ────────────────────────────────────────────
    console.log('  Clearing Postgres...');

    const leadLogs = await prisma.leadLog.deleteMany();
    console.log(`    🗑  Deleted ${leadLogs.count} lead logs`);

    const leads = await prisma.lead.deleteMany();
    console.log(`    🗑  Deleted ${leads.count} leads`);

    const jobs = await prisma.job.deleteMany();
    console.log(`    🗑  Deleted ${jobs.count} jobs`);

    const queries = await prisma.query.deleteMany();
    console.log(`    🗑  Deleted ${queries.count} completed queries`);

    const settings = await prisma.setting.deleteMany();
    console.log(`    🗑  Deleted ${settings.count} settings`);

    // ── 2. Flush Redis Queue ─────────────────────────────────────────
    console.log('\n  Flushing Redis queue...');
    try {
        const redis = new Redis({
            host: '127.0.0.1',
            port: 6379,
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
        await redis.connect();
        // Delete all BullMQ keys for the scraperQueue
        const keys = await redis.keys('bull:scraperQueue:*');
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`    🗑  Deleted ${keys.length} Redis queue entries`);
        } else {
            console.log('    ✓  Redis queue already empty');
        }
        await redis.quit();
    } catch (err) {
        console.log(`    ⚠  Could not flush Redis (is it running?): ${err.message}`);
    }

    // ── 3. Clean Output Directory ────────────────────────────────────
    console.log('\n  Cleaning output directory...');
    const outputDir = path.resolve(__dirname, '..', 'output');
    if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
            fs.unlinkSync(path.join(outputDir, file));
            console.log(`    🗑  Deleted output/${file}`);
        }
        if (files.length === 0) {
            console.log('    ✓  Output directory already empty');
        }
    } else {
        console.log('    ✓  No output directory');
    }

    console.log('\n  ✅ Reset complete — ready for fresh scrapes!\n');
    await prisma.$disconnect();
}

resetDatabase().catch(err => {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
});
