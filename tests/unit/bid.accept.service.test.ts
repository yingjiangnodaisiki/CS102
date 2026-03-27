import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { BidService } from "@/lib/services/bid/BidService";

describe("bid accept service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should accept bid and create contract", async () => {
    jest.spyOn(BidRepository, "findByIdWithProject").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "1500.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 20,
      status: "PENDING",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      project: {
        id: "project-1",
        clientId: "client-1",
        status: "BIDDING"
      }
    });
    jest.spyOn(BidRepository, "findAcceptedByProject").mockResolvedValueOnce(null);
    jest.spyOn(BidRepository, "updateStatus").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "1500.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 20,
      status: "ACCEPTED",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "rejectOtherPendingBids").mockResolvedValueOnce(2);
    jest.spyOn(ProjectRepository, "updateById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(ContractRepository, "findByProjectId").mockResolvedValueOnce(null);
    jest.spyOn(ContractRepository, "create").mockResolvedValueOnce({
      id: "contract-1",
      projectId: "project-1",
      clientId: "client-1",
      developerId: "dev-1",
      totalAmount: "1500.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest
      .spyOn(prisma, "$transaction")
      .mockImplementationOnce(async (callback) => callback({} as never));
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await BidService.acceptBid(
      { userId: "client-1", role: "CLIENT" },
      {
        bidId: "bid-1"
      }
    );

    expect(result.acceptedBidId).toBe("bid-1");
    expect(result.projectStatus).toBe("AWARDED");
    expect(result.contractId).toBe("contract-1");
    expect(result.idempotent).toBe(false);
  });

  it("should reject when project already has another accepted bid", async () => {
    jest.spyOn(BidRepository, "findByIdWithProject").mockResolvedValueOnce({
      id: "bid-2",
      projectId: "project-1",
      developerId: "dev-2",
      amount: "1800.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 22,
      status: "PENDING",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      project: {
        id: "project-1",
        clientId: "client-1",
        status: "BIDDING"
      }
    });
    jest.spyOn(BidRepository, "findAcceptedByProject").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "1500.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 20,
      status: "ACCEPTED",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      BidService.acceptBid(
        { userId: "client-1", role: "CLIENT" },
        {
          bidId: "bid-2"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject non-owner client accepting bid", async () => {
    jest.spyOn(BidRepository, "findByIdWithProject").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "1500.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 20,
      status: "PENDING",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      project: {
        id: "project-1",
        clientId: "client-1",
        status: "BIDDING"
      }
    });

    await expect(
      BidService.acceptBid(
        { userId: "client-2", role: "CLIENT" },
        {
          bidId: "bid-1"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });
});
