/**
 * One-time data migration script
 * - Converts rating (String) → Float
 * - Converts reviewCount (String) → Int
 * - Extracts city from address
 * - Runs initial lead scoring
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractCity(address) {
    if (!address || address === 'N/A') return null;
    // Try to extract city from typical address formats
    // e.g. "123 Main St, Chicago, IL 60601" → "Chicago"
    // e.g. "Chicago, IL" → "Chicago"
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
        // Second-to-last part is typically the city (before state/zip)
        const cityCandidate = parts[parts.length - 2];
        // Remove any numbers (zip codes that might be attached)
        const cleaned = cityCandidate.replace(/\d+/g, '').trim();
        return cleaned || null;
    }
    return parts[0] || null;
}

function calculateLeadScore(lead) {
    let score = 50; // Start at neutral

    // No website = hot prospect for web design agency
    if (!lead.hasWebsite) score += 25;
    else score -= 15;

    // Higher rating = more established business = better client
    const rating = typeof lead.rating === 'number' ? lead.rating : parseFloat(lead.rating);
    if (!isNaN(rating)) {
        if (rating >= 4.5) score += 15;
        else if (rating >= 4.0) score += 10;
        else if (rating >= 3.0) score += 5;
    }

    // Has phone = contactable
    if (lead.phone && lead.phone !== 'N/A') score += 5;

    // Has socials = active online presence
    if (lead.socials && lead.socials.length > 0 && lead.socials !== 'None found') score += 5;

    // Review count = business volume indicator
    const reviews = typeof lead.reviewCount === 'number' ? lead.reviewCount : parseInt(lead.reviewCount);
    if (!isNaN(reviews)) {
        if (reviews >= 100) score += 10;
        else if (reviews >= 50) score += 5;
    }

    return Math.max(0, Math.min(100, score));
}

async function migrate() {
    console.log('Starting data migration...\n');

    const leads = await prisma.$queryRawUnsafe(`SELECT id, "rating_old" as rating, "reviewCount_old" as "reviewCount", address, phone, socials, "hasWebsite" FROM "Lead"`);
    console.log(`Found ${leads.length} leads to migrate.\n`);

    let converted = 0;
    let errors = 0;

    for (const lead of leads) {
        try {
            // Parse rating
            let ratingFloat = null;
            if (lead.rating && lead.rating !== 'N/A' && lead.rating !== '') {
                const parsed = parseFloat(lead.rating);
                if (!isNaN(parsed)) ratingFloat = parsed;
            }

            // Parse reviewCount
            let reviewInt = null;
            if (lead.reviewCount && lead.reviewCount !== 'N/A' && lead.reviewCount !== '') {
                // Handle formats like "123 reviews" or "(123)"
                const numStr = lead.reviewCount.replace(/[^0-9]/g, '');
                const parsed = parseInt(numStr, 10);
                if (!isNaN(parsed)) reviewInt = parsed;
            }

            // Extract city
            const city = extractCity(lead.address);

            // Calculate lead score
            const score = calculateLeadScore({
                ...lead,
                rating: ratingFloat,
                reviewCount: reviewInt,
            });

            await prisma.$executeRawUnsafe(
                `UPDATE "Lead" SET rating = $1, "reviewCount" = $2, city = $3, "leadScore" = $4 WHERE id = $5`,
                ratingFloat,
                reviewInt,
                city,
                score,
                lead.id
            );

            converted++;
        } catch (err) {
            errors++;
            console.error(`  Error migrating lead #${lead.id}:`, err.message);
        }
    }

    console.log(`\n✅ Migration complete:`);
    console.log(`   Converted: ${converted}`);
    console.log(`   Errors: ${errors}`);

    await prisma.$disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
