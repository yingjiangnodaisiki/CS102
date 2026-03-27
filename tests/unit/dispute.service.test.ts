import { AppError } from "@/lib/errors/AppError";
import { DisputeService } from "@/lib/services/arbitration/DisputeService";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { DisputeRepository } from "@/lib/repositories/DisputeRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { NotificationService } from "@/lib/services/notification/NotificationService";

describe("dispute service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should start arbitration automatically when amount > 5000", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "p",
      description: "d",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
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
    jest.spyOn(DisputeRepository, "findOpenByScope").mockResolvedValueOnce(null);
    jest.spyOn(DisputeRepository, "create").mockResolvedValueOnce({
      id: "dispute-1",
      projectId: "project-1",
      escrowOrderId: null,
      amount: "6000.00" as unknown as never,
      reason: "争议金额较大",
      status: "IN_ARBITRATION",
      clientRequested: true,
      developerRequested: false,
      autoTriggered: true,
      arbitrationStartedAt: new Date(),
      resolvedAt: null,
      resolution: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();
    jest.spyOn(NotificationService, "notifyUser").mockResolvedValue({
      id: "n-1",
      userId: "u-1",
      title: "t",
      content: "c",
      type: "DISPUTE_CREATED",
      metadata: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const result = await DisputeService.requestDispute(
      { userId: "client-1", role: "CLIENT" },
      {
        projectId: "project-1",
        amount: 6000,
        reason: "争议金额较大，申请仲裁"
      }
    );

    expect(result.dispute.status).toBe("IN_ARBITRATION");
  });

  it("should reject requester not in contract", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "p",
      description: "d",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
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
    jest.spyOn(AuditLogService, "record").mockResolvedValue();
    jest.spyOn(NotificationService, "notifyUser").mockResolvedValue({
      id: "n-2",
      userId: "u-1",
      title: "t",
      content: "c",
      type: "DISPUTE_CREATED",
      metadata: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      DisputeService.requestDispute(
        { userId: "dev-2", role: "DEVELOPER" },
        {
          projectId: "project-1",
          amount: 1000,
          reason: "无关人员尝试发起争议"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });
});
