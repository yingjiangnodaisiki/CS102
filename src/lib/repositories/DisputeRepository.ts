import { DisputeCase } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class DisputeRepository {
  static async findById(id: string): Promise<DisputeCase | null> {
    return prisma.disputeCase.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async findOpenByScope(projectId: string, escrowOrderId?: string): Promise<DisputeCase | null> {
    return prisma.disputeCase.findFirst({
      where: {
        projectId,
        escrowOrderId: escrowOrderId ?? null,
        status: { in: ["REQUESTED", "IN_ARBITRATION"] },
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async create(data: {
    projectId: string;
    escrowOrderId?: string;
    amount: string;
    reason: string;
    status: "REQUESTED" | "IN_ARBITRATION";
    clientRequested: boolean;
    developerRequested: boolean;
    autoTriggered: boolean;
    arbitrationStartedAt?: Date;
  }): Promise<DisputeCase> {
    return prisma.disputeCase.create({
      data
    });
  }

  static async updateById(
    id: string,
    data: {
      status?: "REQUESTED" | "IN_ARBITRATION" | "RESOLVED" | "REJECTED";
      clientRequested?: boolean;
      developerRequested?: boolean;
      arbitrationStartedAt?: Date;
      resolvedAt?: Date;
      resolution?: string;
    }
  ): Promise<DisputeCase> {
    return prisma.disputeCase.update({
      where: { id },
      data
    });
  }

  static async listForAdmin(query: {
    page: number;
    pageSize: number;
    status?: "REQUESTED" | "IN_ARBITRATION" | "RESOLVED" | "REJECTED";
    projectId?: string;
    keyword?: string;
  }): Promise<{ items: DisputeCase[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.keyword
        ? {
            OR: [
              { reason: { contains: query.keyword, mode: "insensitive" as const } },
              { resolution: { contains: query.keyword, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.disputeCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.disputeCase.count({ where })
    ]);

    return { items, total };
  }
}
