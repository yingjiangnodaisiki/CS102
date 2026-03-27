import { AppError } from "@/lib/errors/AppError";
import { AdminRiskService } from "@/lib/services/admin/AdminRiskService";
import { RiskRepository } from "@/lib/repositories/RiskRepository";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

describe("admin risk service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-admin listing risk events", async () => {
    await expect(
      AdminRiskService.listRiskEvents(
        { userId: "dev-1", role: "DEVELOPER" },
        { page: 1, pageSize: 20 }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should escalate risk event to review", async () => {
    jest.spyOn(RiskRepository, "findById").mockResolvedValueOnce({
      id: "risk-1",
      type: "BID_COLLUSION",
      level: "HIGH",
      status: "OPEN",
      title: "疑似串标",
      description: "same ip",
      projectId: "project-1",
      bidId: "bid-1",
      reporterUserId: "dev-1",
      operatorUserId: null,
      resolvedAt: null,
      resolutionNote: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AdminReviewRepository, "create").mockResolvedValueOnce({
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
    jest.spyOn(RiskRepository, "updateById").mockResolvedValueOnce({
      id: "risk-1",
      type: "BID_COLLUSION",
      level: "HIGH",
      status: "IN_REVIEW",
      title: "疑似串标",
      description: "same ip",
      projectId: "project-1",
      bidId: "bid-1",
      reporterUserId: "dev-1",
      operatorUserId: "admin-1",
      resolvedAt: null,
      resolutionNote: "升级审核",
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await AdminRiskService.actionRiskEvent(
      { userId: "admin-1", role: "ADMIN" },
      "risk-1",
      { action: "ESCALATE_REVIEW", note: "升级审核" }
    );

    expect(result.reviewCase?.id).toBe("review-1");
  });
});
