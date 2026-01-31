-- CreateTable
CREATE TABLE "diagnostic_report_history" (
    "id" TEXT NOT NULL,
    "reportAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggregates" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "aiSummary" TEXT,

    CONSTRAINT "diagnostic_report_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_report_history_reportAt_idx" ON "diagnostic_report_history"("reportAt");
