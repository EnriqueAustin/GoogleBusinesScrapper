-- CreateTable
CREATE TABLE "DemoJob" (
    "id" TEXT NOT NULL,
    "leadId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "finalPath" TEXT,
    "error" TEXT,
    "inputData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DemoJob_pkey" PRIMARY KEY ("id")
);
