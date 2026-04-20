import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Creating default pipeline...");
  const pipeline = await prisma.pipeline.create({
    data: { name: "General Sales", isDefault: true }
  });

  console.log("Creating default stages...");
  const stagesData = [
    { name: "New", order: 1, winProbability: 10, color: "#3b82f6" },
    { name: "Contacted", order: 2, winProbability: 20, color: "#8b5cf6" },
    { name: "Qualified", order: 3, winProbability: 40, color: "#f59e0b" },
    { name: "Proposal Sent", order: 4, winProbability: 60, color: "#f97316" },
    { name: "Negotiation", order: 5, winProbability: 80, color: "#ec4899" },
    { name: "Closed Won", order: 6, winProbability: 100, color: "#10b981" },
    { name: "Closed Lost", order: 7, winProbability: 0, color: "#ef4444" },
  ];

  const stages = [];
  for (const s of stagesData) {
    const stage = await prisma.stage.create({
      data: { ...s, pipelineId: pipeline.id }
    });
    stages.push({ ...stage, originalName: s.name.toLowerCase() });
  }

  console.log("Migrating existing leads...");
  const newStageId = stages.find(s => s.originalName === "new").id;
  const contactedStageId = stages.find(s => s.originalName === "contacted").id;
  const qualifiedStageId = stages.find(s => s.originalName === "qualified").id;
  const wonStageId = stages.find(s => s.originalName === "closed won").id;
  const lostStageId = stages.find(s => s.originalName === "closed lost").id;

  const leads = await prisma.lead.findMany();
  
  for (const lead of leads) {
    // Map old legacy crmStatus string to new relation
    let targetStageId = newStageId;
    
    // new | attempting | connected | qualified | disqualified | closed_won | closed_lost
    if (lead.crmStatus === 'attempting' || lead.crmStatus === 'connected') targetStageId = contactedStageId;
    if (lead.crmStatus === 'qualified') targetStageId = qualifiedStageId;
    if (lead.crmStatus === 'disqualified') targetStageId = lostStageId;
    if (lead.crmStatus === 'closed_won') targetStageId = wonStageId;
    if (lead.crmStatus === 'closed_lost') targetStageId = lostStageId;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineId: pipeline.id,
        stageId: targetStageId,
      }
    });
  }
  
  console.log(`Successfully migrated ${leads.length} leads!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
