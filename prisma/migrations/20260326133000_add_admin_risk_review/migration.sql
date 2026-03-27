-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('PROJECT', 'BID', 'DISPUTE', 'USER', 'PAYMENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('BID_COLLUSION', 'PAYMENT_ANOMALY', 'ACCOUNT_ABUSE', 'DISPUTE_SPIKE');

-- CreateEnum
CREATE TYPE "RiskEventStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'MITIGATED', 'FALSE_POSITIVE');

-- AlterTable
ALTER TABLE "developer_profiles" ADD COLUMN     "isRiskFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskFrozenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" TEXT NOT NULL,
    "type" "RiskEventType" NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "status" "RiskEventStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectId" TEXT,
    "bidId" TEXT,
    "reporterUserId" TEXT,
    "operatorUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_review_cases" (
    "id" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "riskEventId" TEXT,
    "disputeCaseId" TEXT,
    "operatorUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "admin_review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_risk_type_created" ON "risk_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "idx_risk_level_status_created" ON "risk_events"("level", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_risk_project_created" ON "risk_events"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_review_target_status_created" ON "admin_review_cases"("targetType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_review_risk_event" ON "admin_review_cases"("riskEventId");

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_review_cases" ADD CONSTRAINT "admin_review_cases_riskEventId_fkey" FOREIGN KEY ("riskEventId") REFERENCES "risk_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_review_cases" ADD CONSTRAINT "admin_review_cases_disputeCaseId_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "dispute_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_review_cases" ADD CONSTRAINT "admin_review_cases_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

