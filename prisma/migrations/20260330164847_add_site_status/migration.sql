-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "siteStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE INDEX "Lead_siteStatus_idx" ON "Lead"("siteStatus");
