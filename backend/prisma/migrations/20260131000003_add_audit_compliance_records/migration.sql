-- CreateTable
CREATE TABLE "audit_compliance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "previousHash" TEXT,
    "currentHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_compliance_records_organizationId_idx" ON "audit_compliance_records"("organizationId");

-- CreateIndex
CREATE INDEX "audit_compliance_records_organizationId_entityType_entityId_idx" ON "audit_compliance_records"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_compliance_records_occurredAt_idx" ON "audit_compliance_records"("occurredAt");
