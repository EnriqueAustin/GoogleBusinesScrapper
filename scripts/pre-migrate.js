/**
 * Pre-migration: Alter columns from String to numeric types BEFORE prisma db push.
 * This safely renames old columns, so Prisma can create the new typed columns,
 * then the migrate-rating-types.js script copies data over.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function preMigrate() {
    console.log('Pre-migration: Preparing columns for type change...\n');

    try {
        // Rename old string columns to backup names
        await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" RENAME COLUMN "rating" TO "rating_old"`);
        console.log('  ✓ Renamed rating → rating_old');
    } catch (e) {
        console.log('  ⚠ rating column already renamed or does not exist:', e.message);
    }

    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" RENAME COLUMN "reviewCount" TO "reviewCount_old"`);
        console.log('  ✓ Renamed reviewCount → reviewCount_old');
    } catch (e) {
        console.log('  ⚠ reviewCount column already renamed or does not exist:', e.message);
    }

    console.log('\n✅ Pre-migration complete. Now run: npx prisma db push');
    console.log('   Then run: node scripts/migrate-rating-types.js');

    await prisma.$disconnect();
}

preMigrate().catch(err => {
    console.error('Pre-migration failed:', err);
    process.exit(1);
});
