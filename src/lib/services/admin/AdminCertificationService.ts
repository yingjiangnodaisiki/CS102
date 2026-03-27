import { AppError } from "@/lib/errors/AppError";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { CertificationRepository } from "@/lib/repositories/CertificationRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class AdminCertificationService {
  static async listCertifications(
    actor: AuthActor,
    query: {
      page: number;
      pageSize: number;
      status?: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
    }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可查看认证记录", 403);
    }
    return CertificationRepository.listForAdmin(query);
  }

  static async resolveCertification(
    actor: AuthActor,
    certificationId: string,
    input: { decision: "APPROVE" | "REJECT"; note: string }
  ) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可处理认证审核", 403);
    }
    const certification = await CertificationRepository.findById(certificationId);
    if (!certification) {
      throw new AppError("CERTIFICATION_NOT_FOUND", "认证记录不存在", 404);
    }
    if (certification.status === "VERIFIED" || certification.status === "REJECTED") {
      return { idempotent: true, certification };
    }
    if (certification.status === "EXPIRED") {
      throw new AppError("CERTIFICATION_REVIEW_FORBIDDEN", "过期认证不可审核", 422);
    }

    const status = input.decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    const updated = await CertificationRepository.reviewById(certification.id, {
      status,
      reviewedAt: new Date(),
      reviewNote: input.note
    });

    const pendingReview = await AdminReviewRepository.findPendingByTarget("CERTIFICATION", updated.id);
    if (pendingReview) {
      await AdminReviewRepository.updateById(pendingReview.id, {
        status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        operatorUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: input.note
      });
    }

    await AuditLogService.record({
      userId: actor.userId,
      action: "CERTIFICATION_REVIEW_RESOLVE",
      resource: "CERTIFICATION",
      resourceId: updated.id,
      status: "SUCCESS",
      details: {
        decision: input.decision,
        note: input.note,
        reviewCaseResolved: pendingReview?.id ?? null
      }
    });

    return { idempotent: false, certification: updated };
  }

  static async listCertificationAttachments(actor: AuthActor, certificationId: string) {
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可查看认证材料", 403);
    }
    const certification = await CertificationRepository.findById(certificationId);
    if (!certification) {
      throw new AppError("CERTIFICATION_NOT_FOUND", "认证记录不存在", 404);
    }
    return CertificationRepository.listAttachments(certificationId);
  }
}
