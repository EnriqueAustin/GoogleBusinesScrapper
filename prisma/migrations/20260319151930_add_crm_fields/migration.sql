-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "socials" TEXT,
    "emails" TEXT,
    "websiteStatus" TEXT,
    "techStack" TEXT,
    "seoStatus" TEXT,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tags" TEXT,
    "customFields" JSONB,
    "query" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "crmStatus" TEXT NOT NULL DEFAULT 'new',
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "qualificationNotes" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadLog" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "params" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Lead_hasWebsite_idx" ON "Lead"("hasWebsite");

-- CreateIndex
CREATE INDEX "Lead_query_idx" ON "Lead"("query");

-- CreateIndex
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

-- CreateIndex
CREATE INDEX "Lead_rating_idx" ON "Lead"("rating");

-- CreateIndex
CREATE INDEX "Lead_leadScore_idx" ON "Lead"("leadScore");

-- CreateIndex
CREATE INDEX "Lead_city_idx" ON "Lead"("city");

-- CreateIndex
CREATE INDEX "Lead_crmStatus_idx" ON "Lead"("crmStatus");

-- CreateIndex
CREATE INDEX "Lead_nextFollowUp_idx" ON "Lead"("nextFollowUp");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_name_address_key" ON "Lead"("name", "address");

-- CreateIndex
CREATE INDEX "LeadLog_leadId_idx" ON "LeadLog"("leadId");

-- CreateIndex
CREATE INDEX "CallLog_leadId_idx" ON "CallLog"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Query_query_key" ON "Query"("query");

-- AddForeignKey
ALTER TABLE "LeadLog" ADD CONSTRAINT "LeadLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
