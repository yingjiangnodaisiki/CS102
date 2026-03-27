import { AppError } from "@/lib/errors/AppError";
import { EscrowService } from "@/lib/services/payment/EscrowService";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { EscrowRepository } from "@/lib/repositories/EscrowRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { MilestoneRepository } from "@/lib/repositories/MilestoneRepository";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { WorkspaceRepository } from "@/lib/repositories/WorkspaceRepository";
import { DistributedLockService } from "@/lib/infra/redis/DistributedLockService";

describe("escrow service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-client creating escrow order", async () => {
    await expect(
      EscrowService.createEscrowOrder(
        { userId: "dev-1", role: "DEVELOPER" },
        {
          projectId: "project-1",
          developerId: "dev-2",
          amount: 1000
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject creating escrow when delivery not approved", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
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
    jest.spyOn(BidRepository, "findAcceptedByProject").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "100.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 7,
      status: "ACCEPTED",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(WorkspaceRepository, "hasApprovedSubmission").mockResolvedValueOnce(false);

    await expect(
      EscrowService.createEscrowOrder(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1",
          developerId: "dev-1",
          amount: 100
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should return idempotent result for paid callback", async () => {
    jest.spyOn(EscrowRepository, "findByOrderNo").mockResolvedValueOnce({
      id: "esc-1",
      orderNo: "ESC0001",
      contractId: "contract-1",
      milestoneId: null,
      amount: "1000.00" as unknown as never,
      status: "PAID",
      providerTradeNo: "T20260001",
      paidAt: new Date(),
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const result = await EscrowService.handlePaymentCallback({
      orderNo: "ESC0001",
      providerTradeNo: "T20260001",
      paymentStatus: "SUCCESS"
    });

    expect(result.idempotent).toBe(true);
  });

  it("should reject callback when distributed lock is occupied", async () => {
    jest.spyOn(DistributedLockService, "acquire").mockResolvedValueOnce(null);

    await expect(
      EscrowService.handlePaymentCallback({
        orderNo: "ESCLOCK001",
        providerTradeNo: "TLOCK001",
        paymentStatus: "SUCCESS"
      })
    ).rejects.toMatchObject({
      code: "ESCROW_CALLBACK_IN_PROGRESS"
    });
  });

  it("should return idempotent release when milestone already completed", async () => {
    jest.spyOn(MilestoneRepository, "findByIdWithProject").mockResolvedValueOnce({
      id: "m-1",
      projectId: "p-1",
      title: "milestone",
      amount: "500.00" as unknown as never,
      dueAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      project: {
        id: "p-1",
        title: "project",
        description: "desc",
        budgetMin: "1000.00" as unknown as never,
        budgetMax: "2000.00" as unknown as never,
        status: "BIDDING",
        biddingEndsAt: new Date(),
        tags: [],
        clientId: "client-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    });
    jest.spyOn(ProjectRepository, "findById");
    jest.spyOn(ContractRepository, "findByProjectId");

    const result = await EscrowService.releaseMilestone(
      { userId: "client-1", role: "CLIENT" },
      "m-1"
    );

    expect(result.idempotent).toBe(true);
  });

  it("should reject milestone release when distributed lock is occupied", async () => {
    jest.spyOn(DistributedLockService, "acquire").mockResolvedValueOnce(null);

    await expect(
      EscrowService.releaseMilestone({ userId: "client-1", role: "CLIENT" }, "m-lock")
    ).rejects.toMatchObject({
      code: "MILESTONE_RELEASE_IN_PROGRESS"
    });
  });

  it("should return idempotent refund for refunded order", async () => {
    jest.spyOn(EscrowRepository, "findByOrderNo").mockResolvedValueOnce({
      id: "esc-2",
      orderNo: "ESC0002",
      contractId: "contract-1",
      milestoneId: null,
      amount: "1000.00" as unknown as never,
      status: "REFUNDED",
      providerTradeNo: "T20260002",
      paidAt: new Date(),
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const result = await EscrowService.refundEscrowOrder(
      { userId: "client-1", role: "CLIENT" },
      {
        orderNo: "ESC0002",
        reason: "客户取消项目"
      }
    );

    expect(result.idempotent).toBe(true);
  });
});
