import { AppError } from "@/lib/errors/AppError";
import { ContractService } from "@/lib/services/contract/ContractService";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

describe("contract service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject when project not found", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce(null);

    await expect(
      ContractService.getProjectContract(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject when contract not found", async () => {
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
    jest.spyOn(ContractRepository, "findByProjectId").mockResolvedValueOnce(null);

    await expect(
      ContractService.getProjectContract(
        { userId: "client-1", role: "CLIENT" },
        {
          projectId: "project-1"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should reject unauthorized actor and write failed audit", async () => {
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
    jest.spyOn(ContractRepository, "findByProjectId").mockResolvedValueOnce({
      id: "contract-1",
      projectId: "project-1",
      clientId: "client-1",
      developerId: "dev-1",
      totalAmount: "5000.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    await expect(
      ContractService.getProjectContract(
        { userId: "user-x", role: "DEVELOPER" },
        {
          projectId: "project-1",
          requestIp: "10.0.0.1"
        }
      )
    ).rejects.toBeInstanceOf(AppError);

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONTRACT_VIEW",
        status: "FAILED"
      })
    );
  });

  it("should return contract for owner and write success audit", async () => {
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
    jest.spyOn(ContractRepository, "findByProjectId").mockResolvedValueOnce({
      id: "contract-1",
      projectId: "project-1",
      clientId: "client-1",
      developerId: "dev-1",
      totalAmount: "5000.00" as unknown as never,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const contract = await ContractService.getProjectContract(
      { userId: "client-1", role: "CLIENT" },
      {
        projectId: "project-1",
        requestIp: "10.0.0.2"
      }
    );

    expect(contract.id).toBe("contract-1");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONTRACT_VIEW",
        status: "SUCCESS"
      })
    );
  });
});
