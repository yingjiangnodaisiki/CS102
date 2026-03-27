import { Contract, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ContractRepository {
  static async findByProjectId(projectId: string, tx?: Prisma.TransactionClient): Promise<Contract | null> {
    const db = tx ?? prisma;
    return db.contract.findFirst({
      where: { projectId, deletedAt: null }
    });
  }

  static async create(
    data: {
      projectId: string;
      clientId: string;
      developerId: string;
      totalAmount: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Contract> {
    const db = tx ?? prisma;
    return db.contract.create({
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        developerId: data.developerId,
        totalAmount: data.totalAmount
      }
    });
  }
}
