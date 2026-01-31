-- CreateTable
CREATE TABLE "domain_event_audit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_event_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_detection_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_detection_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_event_audit_organizationId_idx" ON "domain_event_audit"("organizationId");

-- CreateIndex
CREATE INDEX "domain_event_audit_eventType_idx" ON "domain_event_audit"("eventType");

-- CreateIndex
CREATE INDEX "domain_event_audit_occurredAt_idx" ON "domain_event_audit"("occurredAt");

-- CreateIndex
CREATE INDEX "fraud_detection_events_organizationId_idx" ON "fraud_detection_events"("organizationId");

-- CreateIndex
CREATE INDEX "fraud_detection_events_eventType_idx" ON "fraud_detection_events"("eventType");

-- CreateIndex
CREATE INDEX "fraud_detection_events_createdAt_idx" ON "fraud_detection_events"("createdAt");
