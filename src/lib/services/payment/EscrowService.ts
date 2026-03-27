import crypto from "node:crypto";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { EscrowRepository } from "@/lib/repositories/EscrowRepository";
import { WalletRepository } from "@/lib/repositories/WalletRepository";
import { MilestoneRepository } from "@/lib/repositories/MilestoneRepository";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { WorkspaceRepository } from "@/lib/repositories/WorkspaceRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { DistributedLockService } from "@/lib/infra/redis/DistributedLockService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface CreateEscrowOrderCommand {
  projectId: string;
  developerId: string;
  amount: number;
  milestoneId?: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface PaymentCallbackCommand {
  orderNo: string;
  providerTradeNo: string;
  paymentStatus: "SUCCESS" | "FAILED";
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface RefundEscrowCommand {
  orderNo: string;
  reason: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class EscrowService {
  static async createEscrowOrder(actor: AuthActor, command: CreateEscrowOrderCommand) {
    if (actor.role !== "CLIENT") {
      throw new AppError("FORBIDDEN", "仅甲方可创建托管订单", 403);
    }

    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    if (project.clientId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无项目托管权限", 403);
    }

    const acceptedBid = await BidRepository.findAcceptedByProject(command.projectId);
    if (!acceptedBid) {
      throw new AppError("BID_NOT_AWARDED", "项目尚未确认中标，无法发起支付", 422);
    }
    if (acceptedBid.developerId !== command.developerId) {
      throw new AppError("DEVELOPER_MISMATCH", "支付对象必须为中标乙方", 422);
    }

    const hasApprovedSubmission = await WorkspaceRepository.hasApprovedSubmission(
      command.projectId,
      command.developerId
    );
    if (!hasApprovedSubmission) {
      throw new AppError(
        "WORKSPACE_SUBMISSION_NOT_APPROVED",
        "乙方需先提交并通过甲方验收后，才可发起中标支付",
        422
      );
    }

    const amount = new Decimal(command.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError("AMOUNT_INVALID", "托管金额不合法", 422);
    }

    const orderNo = `ESC${Date.now()}${crypto.randomInt(1000, 9999)}`;
    const contract = await this.ensureContract(project.id, project.clientId, command.developerId, amount.toFixed(2));

    const existingActiveOrder = await prisma.escrowOrder.findFirst({
      where: {
        contractId: contract.id,
        milestoneId: command.milestoneId ?? null,
        status: { in: ["PENDING", "PAID"] },
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    if (existingActiveOrder) {
      throw new AppError(
        "ESCROW_ORDER_ALREADY_EXISTS",
        "该项目已有待支付或已支付未结算的托管订单，请先完成当前流程",
        409,
        { orderNo: existingActiveOrder.orderNo }
      );
    }

    const order = await EscrowRepository.create({
      orderNo,
      contractId: contract.id,
      milestoneId: command.milestoneId,
      amount: amount.toFixed(2)
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "ESCROW_ORDER_CREATE",
      resource: "ESCROW_ORDER",
      resourceId: order.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return order;
  }

  static async handlePaymentCallback(command: PaymentCallbackCommand) {
    const lock = await DistributedLockService.acquire(`escrow:callback:${command.orderNo}`, 15_000);
    if (!lock) {
      throw new AppError("ESCROW_CALLBACK_IN_PROGRESS", "回调处理中，请稍后重试", 409);
    }
    try {
      const order = await EscrowRepository.findByOrderNo(command.orderNo);
      if (!order) {
        throw new AppError("ESCROW_ORDER_NOT_FOUND", "托管订单不存在", 404);
      }

      if (order.status === "PAID" || order.status === "RELEASED") {
        return { idempotent: true, order };
      }

      if (command.paymentStatus === "FAILED") {
        const failedOrder = await EscrowRepository.markFailed(command.orderNo);
        return { idempotent: false, order: failedOrder };
      }

      const contract = await prisma.contract.findFirst({
        where: { id: order.contractId, deletedAt: null }
      });
      if (!contract) {
        throw new AppError("CONTRACT_NOT_FOUND", "合约不存在", 404);
      }

      await prisma.$transaction(async (tx) => {
        const clientWallet = await tx.wallet.findFirst({
          where: { userId: contract.clientId, deletedAt: null }
        });
        if (!clientWallet) {
          throw new AppError("WALLET_NOT_FOUND", "甲方钱包不存在", 404);
        }

        const amount = new Decimal(order.amount.toString()).toFixed(2);
        const updated = await WalletRepository.updateBalanceWithVersion(
          clientWallet.id,
          clientWallet.version,
          {
            availableDecrement: amount,
            frozenIncrement: amount,
            requireAvailableAtLeast: amount
          },
          tx
        );
        if (!updated) {
          throw new AppError("INSUFFICIENT_BALANCE", "可用余额不足或并发冲突", 409);
        }

        await WalletRepository.createTransaction(
          {
            walletId: clientWallet.id,
            amount,
            direction: "OUT",
            reason: "ESCROW_FREEZE",
            referenceId: order.orderNo,
            idempotencyKey: `escrow-freeze-${order.orderNo}`
          },
          tx
        );

        await tx.escrowLedger.create({
          data: {
            escrowOrderId: order.id,
            type: "FREEZE",
            amount,
            fromWalletId: clientWallet.id,
            status: "SUCCESS",
            details: { providerTradeNo: command.providerTradeNo }
          }
        });

        await tx.escrowOrder.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            providerTradeNo: command.providerTradeNo,
            paidAt: new Date()
          }
        });
      });

      await AuditLogService.record({
        action: "ESCROW_CALLBACK",
        resource: "ESCROW_ORDER",
        resourceId: order.id,
        status: "SUCCESS",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: { providerTradeNo: command.providerTradeNo }
      });

      const paid = await EscrowRepository.findByOrderNo(order.orderNo);
      return { idempotent: false, order: paid };
    } finally {
      await lock.release();
    }
  }

  static async releaseMilestone(
    actor: AuthActor,
    milestoneId: string,
    meta?: { requestIp?: string | null; requestDevice?: string | null }
  ) {
    const lock = await DistributedLockService.acquire(`escrow:release:${milestoneId}`, 15_000);
    if (!lock) {
      throw new AppError("MILESTONE_RELEASE_IN_PROGRESS", "里程碑放款处理中，请稍后重试", 409);
    }
    try {
      const milestone = await MilestoneRepository.findByIdWithProject(milestoneId);
      if (!milestone) {
        throw new AppError("MILESTONE_NOT_FOUND", "里程碑不存在", 404);
      }
      if (actor.role !== "ADMIN" && milestone.project.clientId !== actor.userId) {
        throw new AppError("FORBIDDEN", "无里程碑放款权限", 403);
      }
      if (milestone.isCompleted) {
        return { released: true, idempotent: true };
      }

      const escrow = await EscrowRepository.findByMilestoneId(milestoneId);
      if (!escrow || escrow.status !== "PAID") {
        throw new AppError("ESCROW_NOT_PAID", "未找到已支付托管订单", 422);
      }

      const contract = await prisma.contract.findFirst({
        where: { id: escrow.contractId, deletedAt: null }
      });
      if (!contract) {
        throw new AppError("CONTRACT_NOT_FOUND", "合约不存在", 404);
      }

      await prisma.$transaction(async (tx) => {
        const [clientWallet, developerWallet] = await Promise.all([
          tx.wallet.findFirst({ where: { userId: contract.clientId, deletedAt: null } }),
          tx.wallet.findFirst({ where: { userId: contract.developerId, deletedAt: null } })
        ]);
        if (!clientWallet || !developerWallet) {
          throw new AppError("WALLET_NOT_FOUND", "钱包不存在", 404);
        }

        const amount = new Decimal(escrow.amount.toString()).toFixed(2);
        const deductFrozen = await WalletRepository.updateBalanceWithVersion(
          clientWallet.id,
          clientWallet.version,
          {
            frozenDecrement: amount,
            requireFrozenAtLeast: amount
          },
          tx
        );
        if (!deductFrozen) {
          throw new AppError("FROZEN_BALANCE_INVALID", "冻结金额不足或并发冲突", 409);
        }

        const addAvailable = await WalletRepository.updateBalanceWithVersion(
          developerWallet.id,
          developerWallet.version,
          {
            availableIncrement: amount
          },
          tx
        );
        if (!addAvailable) {
          throw new AppError("WALLET_CONFLICT", "钱包并发冲突", 409);
        }

        await WalletRepository.createTransaction(
          {
            walletId: clientWallet.id,
            amount,
            direction: "OUT",
            reason: "ESCROW_RELEASE_OUT",
            referenceId: escrow.orderNo,
            idempotencyKey: `escrow-release-out-${escrow.orderNo}`
          },
          tx
        );
        await WalletRepository.createTransaction(
          {
            walletId: developerWallet.id,
            amount,
            direction: "IN",
            reason: "ESCROW_RELEASE_IN",
            referenceId: escrow.orderNo,
            idempotencyKey: `escrow-release-in-${escrow.orderNo}`
          },
          tx
        );

        await tx.escrowLedger.create({
          data: {
            escrowOrderId: escrow.id,
            type: "RELEASE",
            amount,
            fromWalletId: clientWallet.id,
            toWalletId: developerWallet.id,
            status: "SUCCESS"
          }
        });

        await tx.escrowOrder.update({
          where: { id: escrow.id },
          data: { status: "RELEASED", releasedAt: new Date() }
        });
        await tx.milestone.update({
          where: { id: milestone.id },
          data: { isCompleted: true }
        });
      });

      await AuditLogService.record({
        userId: actor.userId,
        action: "MILESTONE_RELEASE",
        resource: "MILESTONE",
        resourceId: milestone.id,
        status: "SUCCESS",
        requestIp: meta?.requestIp,
        requestDevice: meta?.requestDevice
      });

      return { released: true, idempotent: false };
    } finally {
      await lock.release();
    }
  }

  static async refundEscrowOrder(actor: AuthActor, command: RefundEscrowCommand) {
    if (!["CLIENT", "ADMIN"].includes(actor.role)) {
      throw new AppError("FORBIDDEN", "仅甲方或管理员可退款", 403);
    }

    const escrow = await EscrowRepository.findByOrderNo(command.orderNo);
    if (!escrow) {
      throw new AppError("ESCROW_ORDER_NOT_FOUND", "托管订单不存在", 404);
    }
    if (escrow.status === "REFUNDED") {
      return { refunded: true, idempotent: true };
    }
    if (escrow.status !== "PAID") {
      throw new AppError("ESCROW_NOT_REFUNDABLE", "仅已支付未放款订单可退款", 422);
    }

    const contract = await prisma.contract.findFirst({
      where: { id: escrow.contractId, deletedAt: null }
    });
    if (!contract) {
      throw new AppError("CONTRACT_NOT_FOUND", "合约不存在", 404);
    }
    if (actor.role !== "ADMIN" && contract.clientId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无托管退款权限", 403);
    }

    await prisma.$transaction(async (tx) => {
      const clientWallet = await tx.wallet.findFirst({
        where: { userId: contract.clientId, deletedAt: null }
      });
      if (!clientWallet) {
        throw new AppError("WALLET_NOT_FOUND", "甲方钱包不存在", 404);
      }

      const amount = new Decimal(escrow.amount.toString()).toFixed(2);
      const updated = await WalletRepository.updateBalanceWithVersion(
        clientWallet.id,
        clientWallet.version,
        {
          frozenDecrement: amount,
          availableIncrement: amount,
          requireFrozenAtLeast: amount
        },
        tx
      );
      if (!updated) {
        throw new AppError("FROZEN_BALANCE_INVALID", "冻结金额不足或并发冲突", 409);
      }

      await WalletRepository.createTransaction(
        {
          walletId: clientWallet.id,
          amount,
          direction: "IN",
          reason: "ESCROW_REFUND",
          referenceId: escrow.orderNo,
          idempotencyKey: `escrow-refund-${escrow.orderNo}`
        },
        tx
      );

      await tx.escrowLedger.create({
        data: {
          escrowOrderId: escrow.id,
          type: "REFUND",
          amount,
          fromWalletId: clientWallet.id,
          toWalletId: clientWallet.id,
          status: "SUCCESS",
          details: { reason: command.reason }
        }
      });

      await tx.escrowOrder.update({
        where: { id: escrow.id },
        data: { status: "REFUNDED" }
      });
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "ESCROW_REFUND",
      resource: "ESCROW_ORDER",
      resourceId: escrow.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: { reason: command.reason }
    });

    return { refunded: true, idempotent: false };
  }

  private static async ensureContract(
    projectId: string,
    clientId: string,
    developerId: string,
    totalAmount: string
  ) {
    const existing = await ContractRepository.findByProjectId(projectId);
    if (existing) {
      return existing;
    }
    return ContractRepository.create({ projectId, clientId, developerId, totalAmount });
  }
}
