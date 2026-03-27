import { prisma } from "@/lib/prisma";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { CertificationRepository } from "@/lib/repositories/CertificationRepository";
import { AppError } from "@/lib/errors/AppError";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { CertificationService } from "@/lib/services/developer/CertificationService";

describe("certification service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create certification and write audit log", async () => {
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1"
    } as never);
    const createSpy = jest.spyOn(CertificationRepository, "create").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "AWS Certified",
      issuer: "AWS",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "PENDING",
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const reviewSpy = jest.spyOn(AdminReviewRepository, "create").mockResolvedValueOnce({
      id: "review-1",
      targetType: "CERTIFICATION",
      targetId: "cert-1",
      title: "开发者认证审核",
      description: "认证待审核",
      status: "PENDING",
      riskEventId: null,
      disputeCaseId: null,
      operatorUserId: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await CertificationService.create(
      { userId: "dev-1", role: "DEVELOPER" },
      {
        name: "AWS Certified",
        issuer: "AWS",
        certificateNo: "NO-1",
        verifyUrl: "https://example.com",
        issuedAt: "2026-01-01T00:00:00.000Z"
      }
    );

    expect(result.id).toBe("cert-1");
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(reviewSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  it("should reject uploading attachment after certification reviewed", async () => {
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1"
    } as never);
    jest.spyOn(CertificationRepository, "findById").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "AWS Certified",
      issuer: "AWS",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "VERIFIED",
      reviewedAt: new Date(),
      reviewNote: "ok",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      CertificationService.addAttachment(
        { userId: "dev-1", role: "DEVELOPER" },
        {
          certificationId: "cert-1",
          fileName: "cert.pdf",
          fileUrl: "https://oss.example.com/cert.pdf",
          fileSize: 1024,
          mimeType: "application/pdf"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should upload attachment when certification is pending", async () => {
    jest.spyOn(prisma.developerProfile, "findFirst").mockResolvedValueOnce({
      id: "profile-1"
    } as never);
    jest.spyOn(CertificationRepository, "findById").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "AWS Certified",
      issuer: "AWS",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "PENDING",
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const createAttachmentSpy = jest.spyOn(CertificationRepository, "createAttachment").mockResolvedValueOnce({
      id: "att-1",
      certificationId: "cert-1",
      fileName: "cert.pdf",
      fileUrl: "https://oss.example.com/cert.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const attachment = await CertificationService.addAttachment(
      { userId: "dev-1", role: "DEVELOPER" },
      {
        certificationId: "cert-1",
        fileName: "cert.pdf",
        fileUrl: "https://oss.example.com/cert.pdf",
        fileSize: 1024,
        mimeType: "application/pdf"
      }
    );

    expect(attachment.id).toBe("att-1");
    expect(createAttachmentSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });
});
