import { AppError } from "@/lib/errors/AppError";
import { BidService } from "@/lib/services/bid/BidService";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { prisma } from "@/lib/prisma";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { AdminRiskService } from "@/lib/services/admin/AdminRiskService";

describe("bid service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject bidding after deadline", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(Date.now() - 1000),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      BidService.placeBid(
        { userId: "dev-1", role: "DEVELOPER" },
        {
          projectId: "project-1",
          amount: 150,
          proposal: "这是一份足够长的方案说明，满足最小长度要求。",
          expectedDays: 10
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject risk conflict with same ip", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(Date.now() + 60_000),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "findProjectBidByDeveloper").mockResolvedValueOnce(null);
    jest.spyOn(BidRepository, "findRiskConflict").mockResolvedValueOnce({
      id: "bid-risk",
      projectId: "project-1",
      developerId: "dev-other",
      amount: "120.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 12,
      status: "PENDING",
      submittedIp: "1.1.1.1",
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AdminRiskService, "reportBidCollusion").mockResolvedValueOnce({
      id: "risk-1",
      type: "BID_COLLUSION",
      level: "HIGH",
      status: "OPEN",
      title: "疑似串标",
      description: "same ip",
      projectId: "project-1",
      bidId: "bid-risk",
      reporterUserId: "dev-1",
      operatorUserId: null,
      resolvedAt: null,
      resolutionNote: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      BidService.placeBid(
        { userId: "dev-1", role: "DEVELOPER" },
        {
          projectId: "project-1",
          amount: 150,
          proposal: "这是一份足够长的方案说明，满足最小长度要求。",
          expectedDays: 10,
          requestIp: "1.1.1.1"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should create bid when requirements matched", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(Date.now() + 60_000),
      tags: ["nlp"],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "findProjectBidByDeveloper").mockResolvedValueOnce(null);
    jest.spyOn(BidRepository, "findRiskConflict").mockResolvedValueOnce(null);
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1",
      userId: "dev-1",
      displayName: "dev",
      capabilityPassed: true,
      riskDeviceHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      skills: [
        {
          id: "ds-1",
          developerProfileId: "profile-1",
          skillId: "skill-1",
          isVerified: true,
          passedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          skill: {
            id: "skill-1",
            code: "nlp",
            name: "NLP",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
          }
        }
      ]
    } as never);
    jest.spyOn(BidRepository, "create").mockResolvedValueOnce({
      id: "bid-1",
      projectId: "project-1",
      developerId: "dev-1",
      amount: "150.00" as unknown as never,
      proposal: "proposal",
      expectedDays: 10,
      status: "PENDING",
      submittedIp: null,
      submittedDevice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const bid = await BidService.placeBid(
      { userId: "dev-1", role: "DEVELOPER" },
      {
        projectId: "project-1",
        amount: 150,
        proposal: "这是一份足够长的方案说明，满足最小长度要求。",
        expectedDays: 10
      }
    );

    expect(bid.id).toBe("bid-1");
  });

  it("should reject when verified skills do not cover project tags", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-2",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(Date.now() + 60_000),
      tags: ["nlp", "rag"],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "findProjectBidByDeveloper").mockResolvedValueOnce(null);
    jest.spyOn(BidRepository, "findRiskConflict").mockResolvedValueOnce(null);
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-2",
      userId: "dev-2",
      displayName: "dev-2",
      capabilityPassed: true,
      riskDeviceHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      skills: [
        {
          id: "ds-2",
          developerProfileId: "profile-2",
          skillId: "skill-nlp",
          isVerified: true,
          passedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          skill: {
            code: "nlp",
            deletedAt: null
          }
        }
      ]
    } as never);

    await expect(
      BidService.placeBid(
        { userId: "dev-2", role: "DEVELOPER" },
        {
          projectId: "project-2",
          amount: 120,
          proposal: "这是一份足够长的方案说明，满足最小长度要求。",
          expectedDays: 8
        }
      )
    ).rejects.toMatchObject({
      code: "SKILL_NOT_VERIFIED"
    });
  });
});
