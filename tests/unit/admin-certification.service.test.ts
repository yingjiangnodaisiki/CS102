import { AppError } from "@/lib/errors/AppError";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { CertificationRepository } from "@/lib/repositories/CertificationRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { AdminCertificationService } from "@/lib/services/admin/AdminCertificationService";

describe("admin certification service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject non-admin resolving certification", async () => {
    await expect(
      AdminCertificationService.resolveCertification(
        { userId: "dev-1", role: "DEVELOPER" },
        "cert-1",
        { decision: "APPROVE", note: "审核通过，信息真实" }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should resolve pending certification", async () => {
    jest.spyOn(CertificationRepository, "findById").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "TensorFlow Expert",
      issuer: "TF Org",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com/cert/1",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "PENDING",
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(CertificationRepository, "reviewById").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "TensorFlow Expert",
      issuer: "TF Org",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com/cert/1",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "VERIFIED",
      reviewedAt: new Date(),
      reviewNote: "材料完整，审核通过",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const findReviewSpy = jest.spyOn(AdminReviewRepository, "findPendingByTarget").mockResolvedValueOnce({
      id: "review-1",
      targetType: "CERTIFICATION",
      targetId: "cert-1",
      title: "开发者认证审核",
      description: "待审核",
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
    const updateReviewSpy = jest.spyOn(AdminReviewRepository, "updateById").mockResolvedValueOnce({
      id: "review-1",
      targetType: "CERTIFICATION",
      targetId: "cert-1",
      title: "开发者认证审核",
      description: "待审核",
      status: "APPROVED",
      riskEventId: null,
      disputeCaseId: null,
      operatorUserId: "admin-1",
      decidedAt: new Date(),
      decisionNote: "材料完整，审核通过",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await AdminCertificationService.resolveCertification(
      { userId: "admin-1", role: "ADMIN" },
      "cert-1",
      { decision: "APPROVE", note: "材料完整，审核通过" }
    );

    expect(result.idempotent).toBe(false);
    expect(result.certification.status).toBe("VERIFIED");
    expect(findReviewSpy).toHaveBeenCalledTimes(1);
    expect(updateReviewSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  it("should list certification attachments for admin", async () => {
    jest.spyOn(CertificationRepository, "findById").mockResolvedValueOnce({
      id: "cert-1",
      developerProfileId: "profile-1",
      name: "TensorFlow Expert",
      issuer: "TF Org",
      certificateNo: "NO-1",
      verifyUrl: "https://example.com/cert/1",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      status: "PENDING",
      reviewedAt: null,
      reviewNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const listSpy = jest.spyOn(CertificationRepository, "listAttachments").mockResolvedValueOnce([
      {
        id: "att-1",
        certificationId: "cert-1",
        fileName: "cert.pdf",
        fileUrl: "https://oss.example.com/cert.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    ]);

    const result = await AdminCertificationService.listCertificationAttachments(
      { userId: "admin-1", role: "ADMIN" },
      "cert-1"
    );

    expect(result.length).toBe(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
