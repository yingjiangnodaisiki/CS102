import { ProjectService } from "@/lib/services/project/ProjectService";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { AppError } from "@/lib/errors/AppError";

describe("project service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should deny non-client creating project", async () => {
    await expect(
      ProjectService.createProject(
        { userId: "dev-1", role: "DEVELOPER" },
        {
          title: "AI Agent",
          description: "Build an ai agent for customer service",
          budgetMin: 1000,
          budgetMax: 2000,
          biddingEndsAt: "2026-04-01T00:00:00.000Z",
          tags: ["agent"]
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject invalid status transition", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "description",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "DRAFT",
      biddingEndsAt: new Date(),
      tags: ["nlp"],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      ProjectService.updateProject(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1",
          status: "AWARDED"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should create project and write audit log", async () => {
    const createSpy = jest.spyOn(ProjectRepository, "create").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "description",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "DRAFT",
      biddingEndsAt: new Date(),
      tags: ["nlp"],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await ProjectService.createProject(
      { userId: "client-1", role: "CLIENT" },
      {
        title: "AI客服项目",
        description: "Build an ai agent for customer service",
        budgetMin: 1000,
        budgetMax: 3000,
        biddingEndsAt: "2026-04-01T00:00:00.000Z",
        tags: ["nlp"]
      }
    );

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("project-1");
  });

  it("should return plaza projects with bid flags", async () => {
    jest.spyOn(ProjectRepository, "listPlaza").mockResolvedValueOnce({
      items: [
        {
          id: "project-1",
          title: "公开项目",
          description: "desc",
          budgetMin: "1000.00" as unknown as never,
          budgetMax: "3000.00" as unknown as never,
          status: "BIDDING",
          biddingEndsAt: new Date(Date.now() + 86_400_000),
          tags: ["nlp"],
          clientId: "client-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          bids: [],
          _count: {
            bids: 3
          }
        },
        {
          id: "project-2",
          title: "我已投标项目",
          description: "desc",
          budgetMin: "2000.00" as unknown as never,
          budgetMax: "5000.00" as unknown as never,
          status: "PUBLISHED",
          biddingEndsAt: new Date(Date.now() + 86_400_000),
          tags: ["cv"],
          clientId: "client-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          bids: [{ id: "bid-1", status: "PENDING" }],
          _count: {
            bids: 8
          }
        }
      ] as never,
      total: 2
    });

    const result = await ProjectService.listPlazaProjects(
      { userId: "dev-1", role: "DEVELOPER" },
      { page: 1, pageSize: 20 }
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].canBid).toBe(true);
    expect(result.items[0].hasMyBid).toBe(false);
    expect(result.items[1].canBid).toBe(false);
    expect(result.items[1].hasMyBid).toBe(true);
  });
});
