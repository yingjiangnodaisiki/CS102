import { AppError } from "@/lib/errors/AppError";
import { AdminReviewService } from "@/lib/services/admin/AdminReviewService";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { RiskRepository } from "@/lib/repositories/RiskRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

describe("admin review service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-admin resolving review case", async () => {
    await expect(
      AdminReviewService.resolveReviewCase(
        { userId: "client-1", role: "CLIENT" },
        "review-1",
        { decision: "APPROVE", note: "ok" }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should resolve pending review and sync risk event", async () => {
    jest.spyOn(AdminReviewRepository, "findById").mockResolvedValueOnce({
      id: "review-1",
      targetType: "BID",
      targetId: "bid-1",
      title: "风控复核",
      description: "desc",
      status: "PENDING",
      riskEventId: "risk-1",
      disputeCaseId: null,
      operatorUserId: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AdminReviewRepository, "updateById").mockResolvedValueOnce({
      id: "review-1",
      targetType: "BID",
      targetId: "bid-1",
      title: "风控复核",
      description: "desc",
      status: "APPROVED",
      riskEventId: "risk-1",
      disputeCaseId: null,
      operatorUserId: "admin-1",
      decidedAt: new Date(),
      decisionNote: "通过",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(RiskRepository, "updateById").mockResolvedValueOnce({
      id: "risk-1",
      type: "BID_COLLUSION",
      level: "HIGH",
      status: "MITIGATED",
      title: "疑似串标",
      description: "same ip",
      projectId: "project-1",
      bidId: "bid-1",
      reporterUserId: "dev-1",
      operatorUserId: "admin-1",
      resolvedAt: new Date(),
      resolutionNote: "审核单#review-1 裁决：APPROVE",
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await AdminReviewService.resolveReviewCase(
      { userId: "admin-1", role: "ADMIN" },
      "review-1",
      { decision: "APPROVE", note: "审核通过" }
    );

    expect(result.idempotent).toBe(false);
    expect(result.reviewCase.status).toBe("APPROVED");
  });
});
