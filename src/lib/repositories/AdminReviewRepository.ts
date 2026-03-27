import { AdminReviewCase, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class AdminReviewRepository {
  static async create(data: {
    targetType: "PROJECT" | "BID" | "DISPUTE" | "USER" | "PAYMENT" | "CERTIFICATION";
    targetId: string;
    title: string;
    description: string;
    riskEventId?: string;
    disputeCaseId?: string;
  }): Promise<AdminReviewCase> {
    return prisma.adminReviewCase.create({ data });
  }

  static async findById(id: string): Promise<AdminReviewCase | null> {
    return prisma.adminReviewCase.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async list(query: {
    page: number;
    pageSize: number;
    status?: ReviewStatus;
    targetType?: "PROJECT" | "BID" | "DISPUTE" | "USER" | "PAYMENT" | "CERTIFICATION";
  }): Promise<{ items: AdminReviewCase[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {})
    };
    const [items, total] = await Promise.all([
      prisma.adminReviewCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.adminReviewCase.count({ where })
    ]);
    return { items, total };
  }

  static async findPendingByTarget(
    targetType: "PROJECT" | "BID" | "DISPUTE" | "USER" | "PAYMENT" | "CERTIFICATION",
    targetId: string
  ): Promise<AdminReviewCase | null> {
    return prisma.adminReviewCase.findFirst({
      where: {
        targetType,
        targetId,
        status: "PENDING",
        deletedAt: null
      }
    });
  }

  static async updateById(
    id: string,
    data: {
      status?: ReviewStatus;
      operatorUserId?: string;
      decidedAt?: Date;
      decisionNote?: string;
    }
  ): Promise<AdminReviewCase> {
    return prisma.adminReviewCase.update({
      where: { id },
      data
    });
  }
}
