require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
    try {
        console.log("Initializing Prisma Client...");
        const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });
        console.log("Testing connection...");
        await prisma.$connect();
        console.log("Connection successful!");
        const count = await prisma.lead.count();
        console.log("Current leads in DB:", count);
    } catch (e) {
        console.error("Connection failed!! -----");
        console.error(e);
    }
}

testConnection();
