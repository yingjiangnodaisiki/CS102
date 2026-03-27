import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { CapabilityService } from "@/lib/services/developer/CapabilityService";

describe("capability service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-developer querying capability", async () => {
    await expect(
      CapabilityService.getMine({
        userId: "client-1",
        role: "CLIENT"
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should verify developer capability with passing answers", async () => {
    const now = new Date();
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1",
      userId: "dev-1",
      displayName: "dev",
      avatarUrl: null,
      bio: null,
      capabilityPassed: false,
      riskDeviceHash: null,
      isRiskFrozen: false,
      riskFrozenAt: null,
      createdAt: new Date(),
      updatedAt: now,
      deletedAt: null
    } as never);
    jest.spyOn(prisma.developerProfile, "update").mockResolvedValueOnce({} as never);
    jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await CapabilityService.verifyMine(
      {
        userId: "dev-1",
        role: "DEVELOPER"
      },
      {
        answers: [
          { questionId: "q1", optionId: "b" },
          { questionId: "q2", optionId: "c" },
          { questionId: "q3", optionId: "b" },
          { questionId: "q4", optionId: "a" },
          { questionId: "q5", optionId: "a" }
        ]
      }
    );

    expect(result.capabilityPassed).toBe(true);
    expect(result.score).toBe(4);
  });

  it("should return idempotent result when already passed", async () => {
    const now = new Date();
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1",
      userId: "dev-1",
      displayName: "dev",
      avatarUrl: null,
      bio: null,
      capabilityPassed: true,
      riskDeviceHash: null,
      isRiskFrozen: false,
      riskFrozenAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    } as never);

    const result = await CapabilityService.verifyMine(
      {
        userId: "dev-1",
        role: "DEVELOPER"
      },
      {
        answers: [
          { questionId: "q1", optionId: "a" },
          { questionId: "q2", optionId: "a" },
          { questionId: "q3", optionId: "a" },
          { questionId: "q4", optionId: "a" },
          { questionId: "q5", optionId: "a" }
        ]
      }
    );

    expect(result.capabilityPassed).toBe(true);
    expect(result.idempotent).toBe(true);
  });
});
