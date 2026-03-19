const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const pipelineValue = await prisma.lead.groupBy({ by: ['crmStatus'], _sum: { estimatedValue: true }, _count: { id: true } });
        console.log("Pipeline:", pipelineValue);
        const activities = await prisma.callLog.groupBy({ by: ['type'], _count: { id: true } });
        console.log("Activities:", activities);
    } catch(e) { console.error("ERROR:", e); }
    finally { await prisma.$disconnect(); }
}
run();
