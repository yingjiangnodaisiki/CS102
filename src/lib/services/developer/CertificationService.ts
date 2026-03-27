import { Certification, CertificationAttachment } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { AdminReviewRepository } from "@/lib/repositories/AdminReviewRepository";
import { CertificationRepository } from "@/lib/repositories/CertificationRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface CreateCertificationCommand {
  name: string;
  issuer: string;
  certificateNo?: string;
  verifyUrl?: string;
  issuedAt: string;
  expiresAt?: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface AddCertificationAttachmentCommand {
  certificationId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class CertificationService {
  static async create(actor: AuthActor, command: CreateCertificationCommand): Promise<Certification> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const certification = await CertificationRepository.create({
      developerProfileId: developerProfile.id,
      name: command.name,
      issuer: command.issuer,
      certificateNo: command.certificateNo,
      verifyUrl: command.verifyUrl,
      issuedAt: new Date(command.issuedAt),
      expiresAt: command.expiresAt ? new Date(command.expiresAt) : undefined
    });

    await AdminReviewRepository.create({
      targetType: "CERTIFICATION",
      targetId: certification.id,
      title: "开发者认证审核",
      description: `认证「${certification.name}」待管理员审核`
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "CERTIFICATION_CREATE",
      resource: "CERTIFICATION",
      resourceId: certification.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });
    return certification;
  }

  static async listMine(actor: AuthActor): Promise<Certification[]> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    return CertificationRepository.listByDeveloperProfile(developerProfile.id);
  }

  static async addAttachment(
    actor: AuthActor,
    command: AddCertificationAttachmentCommand
  ): Promise<CertificationAttachment> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const certification = await CertificationRepository.findById(command.certificationId);
    if (!certification) {
      throw new AppError("CERTIFICATION_NOT_FOUND", "认证记录不存在", 404);
    }
    if (certification.developerProfileId !== developerProfile.id) {
      throw new AppError("FORBIDDEN", "无权限操作该认证记录", 403);
    }
    if (certification.status !== "PENDING") {
      throw new AppError("CERTIFICATION_ATTACHMENT_LOCKED", "认证已裁决，不可再上传材料", 422);
    }

    const attachment = await CertificationRepository.createAttachment({
      certificationId: certification.id,
      fileName: command.fileName,
      fileUrl: command.fileUrl,
      fileSize: command.fileSize,
      mimeType: command.mimeType
    });
    await AuditLogService.record({
      userId: actor.userId,
      action: "CERTIFICATION_ATTACHMENT_CREATE",
      resource: "CERTIFICATION_ATTACHMENT",
      resourceId: attachment.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        certificationId: certification.id
      }
    });
    return attachment;
  }

  static async listMyAttachments(actor: AuthActor, certificationId: string): Promise<CertificationAttachment[]> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const certification = await CertificationRepository.findById(certificationId);
    if (!certification) {
      throw new AppError("CERTIFICATION_NOT_FOUND", "认证记录不存在", 404);
    }
    if (certification.developerProfileId !== developerProfile.id) {
      throw new AppError("FORBIDDEN", "无权限查看该认证材料", 403);
    }
    return CertificationRepository.listAttachments(certificationId);
  }

  private static async getDeveloperProfileOrThrow(actor: AuthActor): Promise<{ id: string }> {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可操作认证", 403);
    }
    const developerProfile = await prisma.developerProfile.findFirst({
      where: {
        userId: actor.userId,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!developerProfile) {
      throw new AppError("DEVELOPER_PROFILE_NOT_FOUND", "开发者资料不存在", 404);
    }
    return developerProfile;
  }
}
