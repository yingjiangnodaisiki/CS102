import Decimal from "decimal.js";
import { AppError } from "@/lib/errors/AppError";
import { WalletRepository } from "@/lib/repositories/WalletRepository";
import { prisma } from "@/lib/prisma";

export interface WalletView {
  userId: string;
  availableBalance: string;
  frozenBalance: string;
  currency: string;
  totalBalance: string;
}

export interface WalletOverviewView extends WalletView {
  recentTransactions: Array<{
    id: string;
    amount: string;
    direction: string;
    reason: string;
    referenceId: string | null;
    createdAt: string;
  }>;
}

export class WalletService {
  static async getWalletByUserId(userId: string): Promise<WalletView> {
    let wallet = await WalletRepository.findByUserId(userId);
    if (!wallet) {
      // 兼容历史用户：首次访问自动初始化钱包
      wallet = await WalletRepository.createForUser(userId);
    }

    const available = new Decimal(wallet.availableBalance.toString());
    const frozen = new Decimal(wallet.frozenBalance.toString());

    return {
      userId,
      availableBalance: available.toFixed(2),
      frozenBalance: frozen.toFixed(2),
      currency: wallet.currency,
      totalBalance: available.plus(frozen).toFixed(2)
    };
  }

  static async getWalletOverviewByUserId(userId: string): Promise<WalletOverviewView> {
    const wallet = await this.getWalletByUserId(userId);
    const transactions = await WalletRepository.listRecentTransactionsByUser(userId, 20);
    return {
      ...wallet,
      recentTransactions: transactions.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString()
      }))
    };
  }

  static async mockTopUp(userId: string, amount: number, channel: "ALIPAY" | "WECHAT"): Promise<WalletOverviewView> {
    if (amount <= 0) {
      throw new AppError("TOPUP_AMOUNT_INVALID", "充值金额必须大于0", 422);
    }

    const amountDecimal = new Decimal(amount).toFixed(2);
    const wallet = await WalletRepository.findByUserId(userId);
    const existing = wallet ?? (await WalletRepository.createForUser(userId));

    await prisma.$transaction(async (tx) => {
      let success = false;
      let currentVersion = existing.version;

      for (let i = 0; i < 3; i++) {
        const updated = await WalletRepository.updateBalanceWithVersion(
          existing.id,
          currentVersion,
          {
            availableIncrement: amountDecimal
          },
          tx
        );
        if (updated) {
          success = true;
          break;
        }
        const latest = await WalletRepository.findById(existing.id, tx);
        currentVersion = latest?.version ?? currentVersion + 1;
      }

      if (!success) {
        throw new AppError("WALLET_CONFLICT", "钱包并发更新失败，请重试", 409);
      }

      await WalletRepository.createTransaction(
        {
          walletId: existing.id,
          amount: amountDecimal,
          direction: "IN",
          reason: "MOCK_TOPUP",
          referenceId: `${channel}-${Date.now()}`
        },
        tx
      );
    });

    return this.getWalletOverviewByUserId(userId);
  }
}
