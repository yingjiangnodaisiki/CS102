import { Prisma, RiskEvent, RiskEventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class RiskRepository {
  static async create(data: {
    type: "BID_COLLUSION" | "PAYMENT_ANOMALY" | "ACCOUNT_ABUSE" | "DISPUTE_SPIKE";
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description: string;
    projectId?: string;
    bidId?: string;
    reporterUserId?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<RiskEvent> {
    const input: Prisma.RiskEventUncheckedCreateInput = {
      type: data.type,
      level: data.level,
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      bidId: data.bidId,
      reporterUserId: data.reporterUserId,
      metadata: data.metadata
    };
    return prisma.riskEvent.create({ data: input });
  }

  static async findById(id: string): Promise<RiskEvent | null> {
    return prisma.riskEvent.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async list(query: {
    page: number;
    pageSize: number;
    level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status?: RiskEventStatus;
    type?: "BID_COLLUSION" | "PAYMENT_ANOMALY" | "ACCOUNT_ABUSE" | "DISPUTE_SPIKE";
  }): Promise<{ items: RiskEvent[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(query.level ? { level: query.level } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {})
    };
    const [items, total] = await Promise.all([
      prisma.riskEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.riskEvent.count({ where })
    ]);
    return { items, total };
  }

  static async updateById(
    id: string,
    data: {
      status?: RiskEventStatus;
      operatorUserId?: string;
      resolvedAt?: Date;
      resolutionNote?: string;
    }
  ): Promise<RiskEvent> {
    return prisma.riskEvent.update({
      where: { id },
      data
    });
  }
}
