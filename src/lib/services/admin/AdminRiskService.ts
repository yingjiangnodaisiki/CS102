import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { RiskRepository } from "@/lib/repositories/RiskRepository";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class AdminRiskService {
  static async reportBidCollusion(input: {
    projectId: string;
    reporterUserId: string;
    bidId?: string;
    submittedIp?: string | null;
    submittedDevice?: string | null;
  }) {
    return RiskRepository.create({
      type: "BID_COLLUSION",
      level: "HIGH",
      title: "疑似串标风险",
      description: "同项目检测到相同IP/设备多账号投标",
      projectId: input.projectId,
      bidId: input.bidId,
      reporterUserId: input.reporterUserId,
      metadata: {
        submittedIp: input.submittedIp,
        submittedDevice: input.submittedDevice
      }
    });
  }

  static async listRiskEvents(
    actor: AuthActor,
    query: {
      page: number;
      pageSize: number;
      level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      status?: "OPEN" | "IN_REVIEW" | "MITIGATED" | "FALSE_POSITIVE";
      type?: "BID_COLLUSION" | "PAYMENT_ANOMALY" | "ACCOUNT_ABUSE" | "DISPUTE_SPIKE";
    }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可查看风控事件", 403);
    }
    return RiskRepository.list(query);
  }

  static async actionRiskEvent(
    actor: AuthActor,
    riskEventId: string,
    input: {
      action: "MARK_FALSE_POSITIVE" | "MARK_MITIGATED" | "FREEZE_DEVELOPER" | "ESCALATE_REVIEW";
      note: string;
    }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可处置风控事件", 403);
    }
    const event = await RiskRepository.findById(riskEventId);
    if (!event) {
      throw new AppError("RISK_EVENT_NOT_FOUND", "风控事件不存在", 404);
    }

    if (input.action === "MARK_FALSE_POSITIVE") {
      const updated = await RiskRepository.updateById(event.id, {
        status: "FALSE_POSITIVE",
        operatorUserId: actor.userId,
        resolvedAt: new Date(),
        resolutionNote: input.note
      });
      await this.audit(actor.userId, updated.id, input.action, input.note);
      return { riskEvent: updated };
    }

    if (input.action === "MARK_MITIGATED") {
      const updated = await RiskRepository.updateById(event.id, {
        status: "MITIGATED",
        operatorUserId: actor.userId,
        resolvedAt: new Date(),
        resolutionNote: input.note
      });
      await this.audit(actor.userId, updated.id, input.action, input.note);
      return { riskEvent: updated };
    }

    if (input.action === "FREEZE_DEVELOPER") {
      const bidId = event.bidId;
      if (!bidId) {
        throw new AppError("RISK_ACTION_INVALID", "当前事件缺少投标标识，无法冻结开发者", 422);
      }
      const bid = await prisma.bid.findFirst({
        where: { id: bidId, deletedAt: null }
      });
      if (!bid) {
        throw new AppError("BID_NOT_FOUND", "关联投标不存在", 404);
      }
      await prisma.developerProfile.updateMany({
        where: { userId: bid.developerId, deletedAt: null },
        data: {
          isRiskFrozen: true,
          riskFrozenAt: new Date()
        }
      });
      const updated = await RiskRepository.updateById(event.id, {
        status: "MITIGATED",
        operatorUserId: actor.userId,
        resolvedAt: new Date(),
        resolutionNote: input.note
      });
      await this.audit(actor.userId, updated.id, input.action, input.note);
      return { riskEvent: updated };
    }

    const reviewCase = await AdminReviewRepository.create({
      targetType: "BID",
      targetId: event.bidId ?? event.projectId ?? event.id,
      title: `风控复核：${event.title}`,
      description: `${event.description}\n处置备注：${input.note}`,
      riskEventId: event.id
    });
    const updated = await RiskRepository.updateById(event.id, {
      status: "IN_REVIEW",
      operatorUserId: actor.userId,
      resolutionNote: input.note
    });
    await this.audit(actor.userId, updated.id, input.action, input.note);
    return { riskEvent: updated, reviewCase };
  }

  private static async audit(
    operatorUserId: string,
    riskEventId: string,
    action: string,
    note: string
  ): Promise<void> {
    await AuditLogService.record({
      userId: operatorUserId,
      action: "RISK_EVENT_ACTION",
      resource: "RISK_EVENT",
      resourceId: riskEventId,
      status: "SUCCESS",
      details: { action, note }
    });
  }
}
