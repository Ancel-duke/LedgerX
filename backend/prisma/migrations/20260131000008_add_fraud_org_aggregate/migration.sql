-- CreateTable
CREATE TABLE "fraud_org_aggregates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "aggregatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_org_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fraud_org_aggregates_organizationId_key" ON "fraud_org_aggregates"("organizationId");

-- CreateIndex
CREATE INDEX "fraud_org_aggregates_aggregatedAt_idx" ON "fraud_org_aggregates"("aggregatedAt");
