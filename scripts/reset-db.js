#!/usr/bin/env node
/**
 * Reset Database — Clears all leads, jobs, queries, and logs for a fresh start.
 * Usage: node scripts/reset-db.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function resetDatabase() {
    console.log('\n⚠️  WARNING: This will delete ALL data from the database!\n');

    // Delete in order to respect foreign key constraints
    const leadLogs = await prisma.leadLog.deleteMany();
    console.log(`  🗑  Deleted ${leadLogs.count} lead logs`);

    const leads = await prisma.lead.deleteMany();
    console.log(`  🗑  Deleted ${leads.count} leads`);

    const jobs = await prisma.job.deleteMany();
    console.log(`  🗑  Deleted ${jobs.count} jobs`);

    const queries = await prisma.query.deleteMany();
    console.log(`  🗑  Deleted ${queries.count} completed queries`);

    // Clear the CSV output file if it exists
    const csvPath = path.resolve('output/leads.csv');
    if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
        console.log('  🗑  Deleted output/leads.csv');
    }

    console.log('\n✅ Database reset complete — ready for fresh tests!\n');
    await prisma.$disconnect();
}

resetDatabase().catch(err => {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
});
