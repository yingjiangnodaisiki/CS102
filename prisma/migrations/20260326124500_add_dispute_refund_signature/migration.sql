-- CreateEnum
CREATE TYPE "EscrowOrderStatus" AS ENUM ('PENDING', 'PAID', 'RELEASED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EscrowLedgerType" AS ENUM ('FREEZE', 'RELEASE', 'REFUND');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('REQUESTED', 'IN_ARBITRATION', 'RESOLVED', 'REJECTED');

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "EscrowOrderStatus" NOT NULL DEFAULT 'PENDING',
    "providerTradeNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "escrow_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_ledgers" (
    "id" TEXT NOT NULL,
    "escrowOrderId" TEXT NOT NULL,
    "type" "EscrowLedgerType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "fromWalletId" TEXT NOT NULL,
    "toWalletId" TEXT,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "escrow_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_cases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "escrowOrderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'REQUESTED',
    "clientRequested" BOOLEAN NOT NULL DEFAULT false,
    "developerRequested" BOOLEAN NOT NULL DEFAULT false,
    "autoTriggered" BOOLEAN NOT NULL DEFAULT false,
    "arbitrationStartedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dispute_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_contract_client_created" ON "contracts"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_contract_developer_created" ON "contracts"("developerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_projectId_key" ON "contracts"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_orders_orderNo_key" ON "escrow_orders"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_orders_providerTradeNo_key" ON "escrow_orders"("providerTradeNo");

-- CreateIndex
CREATE INDEX "idx_escrow_contract_created" ON "escrow_orders"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_escrow_status_created" ON "escrow_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_escrow_ledger_order_created" ON "escrow_ledgers"("escrowOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_dispute_project_created" ON "dispute_cases"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_dispute_status_created" ON "dispute_cases"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_orders" ADD CONSTRAINT "escrow_orders_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_orders" ADD CONSTRAINT "escrow_orders_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_ledgers" ADD CONSTRAINT "escrow_ledgers_escrowOrderId_fkey" FOREIGN KEY ("escrowOrderId") REFERENCES "escrow_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_escrowOrderId_fkey" FOREIGN KEY ("escrowOrderId") REFERENCES "escrow_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

