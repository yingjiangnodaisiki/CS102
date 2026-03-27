import { Prisma, Wallet } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class WalletRepository {
  static async findByUserId(userId: string): Promise<Wallet | null> {
    return prisma.wallet.findFirst({
      where: {
        userId,
        deletedAt: null
      }
    });
  }

  static async findById(id: string, tx?: Prisma.TransactionClient): Promise<Wallet | null> {
    const db = tx ?? prisma;
    return db.wallet.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async createForUser(userId: string): Promise<Wallet> {
    return prisma.wallet.create({
      data: {
        userId,
        availableBalance: 0,
        frozenBalance: 0,
        currency: "CNY"
      }
    });
  }

  static async updateBalanceWithVersion(
    walletId: string,
    version: number,
    changes: {
      availableIncrement?: string;
      availableDecrement?: string;
      frozenIncrement?: string;
      frozenDecrement?: string;
      requireAvailableAtLeast?: string;
      requireFrozenAtLeast?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const db = tx ?? prisma;
    const result = await db.wallet.updateMany({
      where: {
        id: walletId,
        version,
        deletedAt: null,
        ...(changes.requireAvailableAtLeast
          ? { availableBalance: { gte: changes.requireAvailableAtLeast } }
          : {}),
        ...(changes.requireFrozenAtLeast ? { frozenBalance: { gte: changes.requireFrozenAtLeast } } : {})
      },
      data: {
        ...(changes.availableIncrement
          ? { availableBalance: { increment: changes.availableIncrement } }
          : {}),
        ...(changes.availableDecrement
          ? { availableBalance: { decrement: changes.availableDecrement } }
          : {}),
        ...(changes.frozenIncrement ? { frozenBalance: { increment: changes.frozenIncrement } } : {}),
        ...(changes.frozenDecrement ? { frozenBalance: { decrement: changes.frozenDecrement } } : {}),
        version: { increment: 1 }
      }
    });

    return result.count === 1;
  }

  static async createTransaction(
    data: {
      walletId: string;
      amount: string;
      direction: "IN" | "OUT";
      reason: string;
      referenceId?: string;
      idempotencyKey?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.walletTransaction.create({
      data: {
        walletId: data.walletId,
        amount: data.amount,
        direction: data.direction,
        reason: data.reason,
        referenceId: data.referenceId,
        idempotencyKey: data.idempotencyKey
      }
    });
  }

  static async listRecentTransactionsByUser(
    userId: string,
    limit: number = 20
  ): Promise<
    Array<{
      id: string;
      amount: string;
      direction: string;
      reason: string;
      referenceId: string | null;
      createdAt: Date;
    }>
  > {
    const items = await prisma.walletTransaction.findMany({
      where: {
        deletedAt: null,
        wallet: {
          userId,
          deletedAt: null
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        direction: true,
        reason: true,
        referenceId: true,
        createdAt: true
      }
    });
    return items.map((item) => ({
      id: item.id,
      amount: item.amount.toString(),
      direction: item.direction,
      reason: item.reason,
      referenceId: item.referenceId,
      createdAt: item.createdAt
    }));
  }
}
