import { AppError } from "@/lib/errors/AppError";
import { DisputeService } from "@/lib/services/arbitration/DisputeService";
import { DisputeRepository } from "@/lib/repositories/DisputeRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { NotificationService } from "@/lib/services/notification/NotificationService";

describe("dispute resolve", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-admin resolver", async () => {
    await expect(
      DisputeService.resolveDispute(
        { userId: "client-1", role: "CLIENT" },
        {
          disputeId: "dispute-1",
          action: "REJECT",
          resolution: "无效争议"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should resolve dispute by rejection", async () => {
    jest.spyOn(DisputeRepository, "findById").mockResolvedValueOnce({
      id: "dispute-1",
      projectId: "project-1",
      escrowOrderId: null,
      amount: "100.00" as unknown as never,
      reason: "争议说明",
      status: "IN_ARBITRATION",
      clientRequested: true,
      developerRequested: true,
      autoTriggered: false,
      arbitrationStartedAt: new Date(),
      resolvedAt: null,
      resolution: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(DisputeRepository, "updateById").mockResolvedValueOnce({
      id: "dispute-1",
      projectId: "project-1",
      escrowOrderId: null,
      amount: "100.00" as unknown as never,
      reason: "争议说明",
      status: "REJECTED",
      clientRequested: true,
      developerRequested: true,
      autoTriggered: false,
      arbitrationStartedAt: new Date(),
      resolvedAt: new Date(),
      resolution: "驳回",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();
    jest.spyOn(ContractRepository, "findByProjectId").mockResolvedValueOnce({
      id: "contract-1",
      projectId: "project-1",
      clientId: "client-1",
      developerId: "dev-1",
      totalAmount: "100.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(NotificationService, "notifyUser").mockResolvedValue({
      id: "n-1",
      userId: "u-1",
      title: "t",
      content: "c",
      type: "DISPUTE_RESOLVED",
      metadata: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const result = await DisputeService.resolveDispute(
      { userId: "admin-1", role: "ADMIN" },
      {
        disputeId: "dispute-1",
        action: "REJECT",
        resolution: "证据不足，驳回争议"
      }
    );

    expect(result.idempotent).toBe(false);
    expect(result.dispute?.status).toBe("REJECTED");
  });
});
