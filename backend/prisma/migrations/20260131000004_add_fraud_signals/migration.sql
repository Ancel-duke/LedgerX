-- CreateTable
CREATE TABLE "fraud_signals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "factors" JSONB NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fraud_signals_organizationId_entityType_entityId_key" ON "fraud_signals"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "fraud_signals_organizationId_idx" ON "fraud_signals"("organizationId");

-- CreateIndex
CREATE INDEX "fraud_signals_organizationId_isFlagged_idx" ON "fraud_signals"("organizationId", "isFlagged");

-- CreateIndex
CREATE INDEX "fraud_signals_entityType_entityId_idx" ON "fraud_signals"("entityType", "entityId");
