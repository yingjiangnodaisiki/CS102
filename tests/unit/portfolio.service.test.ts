import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { PortfolioRepository } from "@/lib/repositories/PortfolioRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { PortfolioService } from "@/lib/services/developer/PortfolioService";

describe("portfolio service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject when actor is not developer", async () => {
    await expect(
      PortfolioService.create(
        { userId: "client-1", role: "CLIENT" },
        {
          title: "作品A",
          description: "这是一段满足最小长度的作品描述内容，用于测试校验逻辑。",
          tags: []
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should create portfolio and write audit log", async () => {
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1"
    } as never);
    const createSpy = jest.spyOn(PortfolioRepository, "create").mockResolvedValueOnce({
      id: "portfolio-1",
      developerProfileId: "profile-1",
      title: "作品A",
      description: "这是一段满足最小长度的作品描述内容，用于测试校验逻辑。",
      projectUrl: null,
      repositoryUrl: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await PortfolioService.create(
      { userId: "dev-1", role: "DEVELOPER" },
      {
        title: "作品A",
        description: "这是一段满足最小长度的作品描述内容，用于测试校验逻辑。",
        tags: []
      }
    );

    expect(result.id).toBe("portfolio-1");
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });
});
