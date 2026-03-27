import { EscrowOrder, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class EscrowRepository {
  static async findById(id: string): Promise<EscrowOrder | null> {
    return prisma.escrowOrder.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async findByOrderNo(orderNo: string): Promise<EscrowOrder | null> {
    return prisma.escrowOrder.findFirst({
      where: { orderNo, deletedAt: null }
    });
  }

  static async findByMilestoneId(milestoneId: string): Promise<EscrowOrder | null> {
    return prisma.escrowOrder.findFirst({
      where: {
        milestoneId,
        status: { in: ["PAID", "RELEASED"] },
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async create(
    data: {
      orderNo: string;
      contractId: string;
      milestoneId?: string;
      amount: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<EscrowOrder> {
    const db = tx ?? prisma;
    return db.escrowOrder.create({
      data: {
        orderNo: data.orderNo,
        contractId: data.contractId,
        milestoneId: data.milestoneId,
        amount: data.amount
      }
    });
  }

  static async markPaid(orderNo: string, providerTradeNo: string): Promise<EscrowOrder> {
    return prisma.escrowOrder.update({
      where: { orderNo },
      data: {
        status: "PAID",
        providerTradeNo,
        paidAt: new Date()
      }
    });
  }

  static async markFailed(orderNo: string): Promise<EscrowOrder> {
    return prisma.escrowOrder.update({
      where: { orderNo },
      data: {
        status: "FAILED"
      }
    });
  }

  static async markReleased(orderNo: string): Promise<EscrowOrder> {
    return prisma.escrowOrder.update({
      where: { orderNo },
      data: {
        status: "RELEASED",
        releasedAt: new Date()
      }
    });
  }

  static async markRefunded(orderNo: string): Promise<EscrowOrder> {
    return prisma.escrowOrder.update({
      where: { orderNo },
      data: {
        status: "REFUNDED"
      }
    });
  }
}
