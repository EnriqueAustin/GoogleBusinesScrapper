-- CreateTable: Dataset
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Dataset_name_key" ON "Dataset"("name");

-- Seed the default dataset for existing data
INSERT INTO "Dataset" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-guest-houses', 'Guest Houses', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 1: Add datasetId as nullable first
ALTER TABLE "Lead" ADD COLUMN "datasetId" TEXT;
ALTER TABLE "Query" ADD COLUMN "datasetId" TEXT;
ALTER TABLE "Job" ADD COLUMN "datasetId" TEXT;
ALTER TABLE "DemoJob" ADD COLUMN "datasetId" TEXT;

-- Step 2: Backfill all existing rows to "Guest Houses"
UPDATE "Lead" SET "datasetId" = 'default-guest-houses' WHERE "datasetId" IS NULL;
UPDATE "Query" SET "datasetId" = 'default-guest-houses' WHERE "datasetId" IS NULL;
UPDATE "Job" SET "datasetId" = 'default-guest-houses' WHERE "datasetId" IS NULL;
UPDATE "DemoJob" SET "datasetId" = 'default-guest-houses' WHERE "datasetId" IS NULL;

-- Step 3: Make columns NOT NULL now that all rows have values
ALTER TABLE "Lead" ALTER COLUMN "datasetId" SET NOT NULL;
ALTER TABLE "Query" ALTER COLUMN "datasetId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "datasetId" SET NOT NULL;
ALTER TABLE "DemoJob" ALTER COLUMN "datasetId" SET NOT NULL;

-- Step 4: Drop old unique constraints
DROP INDEX "Lead_name_address_key";
DROP INDEX "Query_query_key";

-- Step 5: Create new unique constraints (scoped to dataset)
CREATE UNIQUE INDEX "Lead_name_address_datasetId_key" ON "Lead"("name", "address", "datasetId");
CREATE UNIQUE INDEX "Query_query_datasetId_key" ON "Query"("query", "datasetId");

-- Step 6: Create indexes
CREATE INDEX "Lead_datasetId_idx" ON "Lead"("datasetId");
CREATE INDEX "Query_datasetId_idx" ON "Query"("datasetId");
CREATE INDEX "Job_datasetId_idx" ON "Job"("datasetId");
CREATE INDEX "DemoJob_datasetId_idx" ON "DemoJob"("datasetId");

-- Step 7: Add foreign keys
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Query" ADD CONSTRAINT "Query_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoJob" ADD CONSTRAINT "DemoJob_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
