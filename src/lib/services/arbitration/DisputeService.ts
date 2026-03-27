import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { EscrowRepository } from "@/lib/repositories/EscrowRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { DisputeRepository } from "@/lib/repositories/DisputeRepository";
import { WalletRepository } from "@/lib/repositories/WalletRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { NotificationService } from "@/lib/services/notification/NotificationService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface CreateDisputeCommand {
  projectId: string;
  escrowOrderId?: string;
  amount: number;
  reason: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface ResolveDisputeCommand {
  disputeId: string;
  action: "REJECT" | "FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE";
  refundAmount?: number;
  resolution: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class DisputeService {
  static async requestDispute(actor: AuthActor, command: CreateDisputeCommand) {
    if (!["CLIENT", "DEVELOPER"].includes(actor.role)) {
      throw new AppError("FORBIDDEN", "仅甲方或乙方可发起争议", 403);
    }

    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }

    const contract = await ContractRepository.findByProjectId(project.id);
    if (!contract) {
      throw new AppError("CONTRACT_NOT_FOUND", "争议需基于已签约项目", 422);
    }

    if (command.escrowOrderId) {
      const escrow = await EscrowRepository.findById(command.escrowOrderId);
      if (!escrow || escrow.contractId !== contract.id) {
        throw new AppError("ESCROW_ORDER_NOT_FOUND", "托管订单不存在或不匹配", 404);
      }
    }

    const isClient = actor.userId === contract.clientId;
    const isDeveloper = actor.userId === contract.developerId;
    if (!isClient && !isDeveloper) {
      throw new AppError("FORBIDDEN", "非合约参与方不可发起争议", 403);
    }

    const amount = new Decimal(command.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError("AMOUNT_INVALID", "争议金额不合法", 422);
    }

    const existing = await DisputeRepository.findOpenByScope(project.id, command.escrowOrderId);
    const autoTriggered = amount.greaterThan(5000);

    if (existing) {
      if ((isClient && existing.clientRequested) || (isDeveloper && existing.developerRequested)) {
        return { idempotent: true, dispute: existing };
      }

      const clientRequestedNext = existing.clientRequested || isClient;
      const developerRequestedNext = existing.developerRequested || isDeveloper;
      const shouldArbitrate = autoTriggered || (clientRequestedNext && developerRequestedNext);
      const updated = await DisputeRepository.updateById(existing.id, {
        clientRequested: clientRequestedNext,
        developerRequested: developerRequestedNext,
        status: shouldArbitrate ? "IN_ARBITRATION" : existing.status,
        arbitrationStartedAt: shouldArbitrate ? new Date() : existing.arbitrationStartedAt ?? undefined
      });

      await AuditLogService.record({
        userId: actor.userId,
        action: "DISPUTE_REQUEST",
        resource: "DISPUTE",
        resourceId: updated.id,
        status: "SUCCESS",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice
      });

      return { idempotent: false, dispute: updated };
    }

    const startArbitration = autoTriggered;
    const dispute = await DisputeRepository.create({
      projectId: project.id,
      escrowOrderId: command.escrowOrderId,
      amount: amount.toFixed(2),
      reason: command.reason,
      status: startArbitration ? "IN_ARBITRATION" : "REQUESTED",
      clientRequested: isClient,
      developerRequested: isDeveloper,
      autoTriggered,
      arbitrationStartedAt: startArbitration ? new Date() : undefined
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "DISPUTE_REQUEST",
      resource: "DISPUTE",
      resourceId: dispute.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    await NotificationService.notifyUser({
      userId: contract.clientId,
      title: "争议申请已创建",
      content: `项目 ${project.id} 已创建争议单，当前状态：${dispute.status}`,
      type: "DISPUTE_CREATED",
      metadata: { disputeId: dispute.id, projectId: project.id }
    });
    await NotificationService.notifyUser({
      userId: contract.developerId,
      title: "项目进入争议流程",
      content: `项目 ${project.id} 争议已创建，当前状态：${dispute.status}`,
      type: "DISPUTE_CREATED",
      metadata: { disputeId: dispute.id, projectId: project.id }
    });

    return { idempotent: false, dispute };
  }

  static async resolveDispute(actor: AuthActor, command: ResolveDisputeCommand) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可执行仲裁裁决", 403);
    }

    const dispute = await DisputeRepository.findById(command.disputeId);
    if (!dispute) {
      throw new AppError("DISPUTE_NOT_FOUND", "争议单不存在", 404);
    }
    if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
      return { idempotent: true, dispute };
    }

    if (command.action === "REJECT") {
      const rejected = await DisputeRepository.updateById(dispute.id, {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolution: command.resolution
      });
      await AuditLogService.record({
        userId: actor.userId,
        action: "DISPUTE_RESOLVE",
        resource: "DISPUTE",
        resourceId: dispute.id,
        status: "SUCCESS",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: { action: command.action }
      });
      const contract = await ContractRepository.findByProjectId(dispute.projectId);
      if (contract) {
        await NotificationService.notifyUser({
          userId: contract.clientId,
          title: "争议已驳回",
          content: command.resolution,
          type: "DISPUTE_RESOLVED",
          metadata: { disputeId: dispute.id, action: command.action }
        });
        await NotificationService.notifyUser({
          userId: contract.developerId,
          title: "争议已驳回",
          content: command.resolution,
          type: "DISPUTE_RESOLVED",
          metadata: { disputeId: dispute.id, action: command.action }
        });
      }
      return { idempotent: false, dispute: rejected };
    }

    if (!dispute.escrowOrderId) {
      throw new AppError("DISPUTE_ESCROW_REQUIRED", "该争议不包含可结算托管单", 422);
    }

    const escrow = await EscrowRepository.findById(dispute.escrowOrderId);
    if (!escrow) {
      throw new AppError("ESCROW_ORDER_NOT_FOUND", "托管订单不存在", 404);
    }
    if (escrow.status === "REFUNDED" || escrow.status === "RELEASED") {
      const resolved = await DisputeRepository.updateById(dispute.id, {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolution: `${command.resolution}（托管已结算）`
      });
      return { idempotent: true, dispute: resolved };
    }
    if (escrow.status !== "PAID") {
      throw new AppError("ESCROW_NOT_SETTLABLE", "仅已支付托管单可裁决", 422);
    }

    const contract = await prisma.contract.findFirst({
      where: { id: escrow.contractId, deletedAt: null }
    });
    if (!contract) {
      throw new AppError("CONTRACT_NOT_FOUND", "合约不存在", 404);
    }

    const totalAmount = new Decimal(escrow.amount.toString());
    const refundAmount =
      command.action === "FULL_REFUND"
        ? totalAmount
        : command.action === "PARTIAL_REFUND"
          ? new Decimal(command.refundAmount ?? 0)
          : new Decimal(0);

    if (command.action === "PARTIAL_REFUND") {
      if (refundAmount.lessThanOrEqualTo(0) || refundAmount.greaterThanOrEqualTo(totalAmount)) {
        throw new AppError("REFUND_AMOUNT_INVALID", "部分退款金额必须大于0且小于托管总额", 422);
      }
    }
    if (command.action !== "PARTIAL_REFUND" && command.refundAmount !== undefined) {
      throw new AppError("REFUND_AMOUNT_UNEXPECTED", "当前裁决动作不应传refundAmount", 422);
    }

    await prisma.$transaction(async (tx) => {
      const [clientWallet, developerWallet] = await Promise.all([
        tx.wallet.findFirst({ where: { userId: contract.clientId, deletedAt: null } }),
        tx.wallet.findFirst({ where: { userId: contract.developerId, deletedAt: null } })
      ]);
      if (!clientWallet || !developerWallet) {
        throw new AppError("WALLET_NOT_FOUND", "钱包不存在", 404);
      }

      const payoutAmount = totalAmount.minus(refundAmount);
      const totalText = totalAmount.toFixed(2);
      const refundText = refundAmount.toFixed(2);
      const payoutText = payoutAmount.toFixed(2);

      const clientBalanceUpdated = await WalletRepository.updateBalanceWithVersion(
        clientWallet.id,
        clientWallet.version,
        {
          frozenDecrement: totalText,
          requireFrozenAtLeast: totalText,
          ...(refundAmount.greaterThan(0) ? { availableIncrement: refundText } : {})
        },
        tx
      );
      if (!clientBalanceUpdated) {
        throw new AppError("FROZEN_BALANCE_INVALID", "冻结余额不足或并发冲突", 409);
      }

      if (refundAmount.greaterThan(0)) {
        await WalletRepository.createTransaction(
          {
            walletId: clientWallet.id,
            amount: refundText,
            direction: "IN",
            reason: "ARBITRATION_REFUND",
            referenceId: escrow.orderNo,
            idempotencyKey: `arbitration-refund-${escrow.orderNo}`
          },
          tx
        );

        await tx.escrowLedger.create({
          data: {
            escrowOrderId: escrow.id,
            type: "REFUND",
            amount: refundText,
            fromWalletId: clientWallet.id,
            toWalletId: clientWallet.id,
            status: "SUCCESS",
            details: { action: command.action }
          }
        });
      }

      if (payoutAmount.greaterThan(0)) {
        const developerBalanceUpdated = await WalletRepository.updateBalanceWithVersion(
          developerWallet.id,
          developerWallet.version,
          {
            availableIncrement: payoutText
          },
          tx
        );
        if (!developerBalanceUpdated) {
          throw new AppError("WALLET_CONFLICT", "乙方钱包并发冲突", 409);
        }

        await WalletRepository.createTransaction(
          {
            walletId: clientWallet.id,
            amount: payoutText,
            direction: "OUT",
            reason: "ARBITRATION_RELEASE_OUT",
            referenceId: escrow.orderNo,
            idempotencyKey: `arbitration-release-out-${escrow.orderNo}`
          },
          tx
        );
        await WalletRepository.createTransaction(
          {
            walletId: developerWallet.id,
            amount: payoutText,
            direction: "IN",
            reason: "ARBITRATION_RELEASE_IN",
            referenceId: escrow.orderNo,
            idempotencyKey: `arbitration-release-in-${escrow.orderNo}`
          },
          tx
        );

        await tx.escrowLedger.create({
          data: {
            escrowOrderId: escrow.id,
            type: "RELEASE",
            amount: payoutText,
            fromWalletId: clientWallet.id,
            toWalletId: developerWallet.id,
            status: "SUCCESS",
            details: { action: command.action }
          }
        });
      }

      await tx.escrowOrder.update({
        where: { id: escrow.id },
        data: {
          status: refundAmount.greaterThanOrEqualTo(totalAmount) ? "REFUNDED" : "RELEASED",
          releasedAt: payoutAmount.greaterThan(0) ? new Date() : escrow.releasedAt
        }
      });
      await tx.disputeCase.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolution: command.resolution
        }
      });
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "DISPUTE_RESOLVE",
      resource: "DISPUTE",
      resourceId: dispute.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        action: command.action,
        refundAmount: command.refundAmount
      }
    });

    await NotificationService.notifyUser({
      userId: contract.clientId,
      title: "争议已裁决",
      content: `裁决动作：${command.action}。${command.resolution}`,
      type: "DISPUTE_RESOLVED",
      metadata: {
        disputeId: dispute.id,
        action: command.action,
        refundAmount: command.refundAmount
      }
    });
    await NotificationService.notifyUser({
      userId: contract.developerId,
      title: "争议已裁决",
      content: `裁决动作：${command.action}。${command.resolution}`,
      type: "DISPUTE_RESOLVED",
      metadata: {
        disputeId: dispute.id,
        action: command.action,
        refundAmount: command.refundAmount
      }
    });

    const resolved = await DisputeRepository.findById(dispute.id);
    return { idempotent: false, dispute: resolved };
  }
}
