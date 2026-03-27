import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { MilestoneRepository } from "@/lib/repositories/MilestoneRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { ProjectMilestoneService } from "@/lib/services/project/ProjectMilestoneService";

describe("project milestone template service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize template milestones successfully", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: ["nlp"],
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
      totalAmount: "3000.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(MilestoneRepository, "listByProject").mockResolvedValueOnce([]);
    jest.spyOn(MilestoneRepository, "createMany").mockResolvedValueOnce([
      {
        id: "m-1",
        projectId: "project-1",
        title: "需求分析",
        amount: "1000.00" as unknown as never,
        dueAt: new Date("2026-04-01T00:00:00.000Z"),
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      },
      {
        id: "m-2",
        projectId: "project-1",
        title: "交付上线",
        amount: "2000.00" as unknown as never,
        dueAt: new Date("2026-05-01T00:00:00.000Z"),
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    ]);
    jest.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => callback({} as never));
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await ProjectMilestoneService.initializeTemplate(
      { userId: "client-1", role: "CLIENT" },
      {
        projectId: "project-1",
        milestones: [
          { title: "需求分析", amount: 1000, dueAt: "2026-04-01T00:00:00.000Z" },
          { title: "交付上线", amount: 2000, dueAt: "2026-05-01T00:00:00.000Z" }
        ]
      }
    );

    expect(result.milestoneCount).toBe(2);
    expect(result.totalAmount).toBe("3000.00");
  });

  it("should reject when milestone total mismatches contract amount", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: ["nlp"],
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
      totalAmount: "3000.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      ProjectMilestoneService.initializeTemplate(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1",
          milestones: [{ title: "需求分析", amount: 1200, dueAt: "2026-04-01T00:00:00.000Z" }]
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject duplicated initialization", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "1000.00" as unknown as never,
      budgetMax: "3000.00" as unknown as never,
      status: "AWARDED",
      biddingEndsAt: new Date(),
      tags: ["nlp"],
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
      totalAmount: "3000.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(MilestoneRepository, "listByProject").mockResolvedValueOnce([
      {
        id: "m-old",
        projectId: "project-1",
        title: "旧里程碑",
        amount: "3000.00" as unknown as never,
        dueAt: new Date(),
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    ]);
    jest.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => callback({} as never));

    await expect(
      ProjectMilestoneService.initializeTemplate(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1",
          milestones: [{ title: "需求分析", amount: 3000, dueAt: "2026-04-01T00:00:00.000Z" }]
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });
});
