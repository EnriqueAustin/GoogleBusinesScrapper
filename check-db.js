require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function checkDb() {
    const prisma = new PrismaClient();
    try {
        const count = await prisma.lead.count();
        console.log(`\n\nDatabase has ${count} leads currently.`);

        const lastFew = await prisma.lead.findMany({
            take: 3,
            orderBy: { scrapedAt: 'desc' }
        });

        console.log("Latest leads:");
        lastFew.forEach(l => console.log(` - ${l.name} (${l.website})`));
    } finally {
        await prisma.$disconnect();
    }
}
checkDb();
