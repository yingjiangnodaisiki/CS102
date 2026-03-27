import { Certification, CertificationAttachment, CertificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class CertificationRepository {
  static async create(data: {
    developerProfileId: string;
    name: string;
    issuer: string;
    certificateNo?: string;
    verifyUrl?: string;
    issuedAt: Date;
    expiresAt?: Date;
  }): Promise<Certification> {
    return prisma.certification.create({
      data: {
        developerProfileId: data.developerProfileId,
        name: data.name,
        issuer: data.issuer,
        certificateNo: data.certificateNo ?? null,
        verifyUrl: data.verifyUrl ?? null,
        issuedAt: data.issuedAt,
        expiresAt: data.expiresAt ?? null
      }
    });
  }

  static async listByDeveloperProfile(developerProfileId: string): Promise<Certification[]> {
    return prisma.certification.findMany({
      where: { developerProfileId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  static async findById(id: string): Promise<Certification | null> {
    return prisma.certification.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async listForAdmin(query: {
    page: number;
    pageSize: number;
    status?: CertificationStatus;
  }): Promise<{ items: Certification[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {})
    };
    const [items, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.certification.count({ where })
    ]);
    return { items, total };
  }

  static async reviewById(
    id: string,
    data: {
      status: CertificationStatus;
      reviewedAt: Date;
      reviewNote: string;
    }
  ): Promise<Certification> {
    return prisma.certification.update({
      where: { id },
      data: {
        status: data.status,
        reviewedAt: data.reviewedAt,
        reviewNote: data.reviewNote
      }
    });
  }

  static async createAttachment(data: {
    certificationId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }): Promise<CertificationAttachment> {
    return prisma.certificationAttachment.create({
      data: {
        certificationId: data.certificationId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType
      }
    });
  }

  static async listAttachments(certificationId: string): Promise<CertificationAttachment[]> {
    return prisma.certificationAttachment.findMany({
      where: {
        certificationId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
