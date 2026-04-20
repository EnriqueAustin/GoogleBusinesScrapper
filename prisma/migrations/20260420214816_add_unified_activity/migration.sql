-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'call',
    "outcome" TEXT,
    "notes" TEXT,
    "duration" INTEGER,
    "dueDate" TIMESTAMP(3),
    "assignedTo" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_dueDate_idx" ON "Activity"("dueDate");

-- CreateIndex
CREATE INDEX "Activity_isDone_idx" ON "Activity"("isDone");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DATA MIGRATION: Copy existing CallLogs into the new Activity table safely
INSERT INTO "Activity" ("id", "leadId", "type", "outcome", "notes", "duration", "createdAt", "updatedAt", "isDone")
SELECT 
    gen_random_uuid()::text, 
    "leadId", 
    "type", 
    "outcome", 
    "notes", 
    "duration", 
    "createdAt", 
    "createdAt",
    true -- Historical logs are assumed to be "done"
FROM "CallLog";
