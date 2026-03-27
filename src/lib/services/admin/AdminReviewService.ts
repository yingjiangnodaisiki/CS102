import { AppError } from "@/lib/errors/AppError";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { RiskRepository } from "@/lib/repositories/RiskRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class AdminReviewService {
  static async listReviewCases(
    actor: AuthActor,
    query: {
      page: number;
      pageSize: number;
      status?: "PENDING" | "APPROVED" | "REJECTED";
      targetType?: "PROJECT" | "BID" | "DISPUTE" | "USER" | "PAYMENT" | "CERTIFICATION";
    }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可查看审核单", 403);
    }
    return AdminReviewRepository.list(query);
  }

  static async resolveReviewCase(
    actor: AuthActor,
    reviewCaseId: string,
    input: { decision: "APPROVE" | "REJECT"; note: string }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可处理审核单", 403);
    }
    const reviewCase = await AdminReviewRepository.findById(reviewCaseId);
    if (!reviewCase) {
      throw new AppError("REVIEW_CASE_NOT_FOUND", "审核单不存在", 404);
    }
    if (reviewCase.status !== "PENDING") {
      return { idempotent: true, reviewCase };
    }

    const updated = await AdminReviewRepository.updateById(reviewCase.id, {
      status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      operatorUserId: actor.userId,
      decidedAt: new Date(),
      decisionNote: input.note
    });

    if (reviewCase.riskEventId) {
      await RiskRepository.updateById(reviewCase.riskEventId, {
        status: input.decision === "APPROVE" ? "MITIGATED" : "FALSE_POSITIVE",
        operatorUserId: actor.userId,
        resolvedAt: new Date(),
        resolutionNote: `审核单#${reviewCase.id} 裁决：${input.decision}`
      });
    }

    await AuditLogService.record({
      userId: actor.userId,
      action: "REVIEW_CASE_RESOLVE",
      resource: "REVIEW_CASE",
      resourceId: updated.id,
      status: "SUCCESS",
      details: {
        decision: input.decision,
        note: input.note
      }
    });

    return { idempotent: false, reviewCase: updated };
  }
}
