import { WalletService } from "@/lib/services/wallet/WalletService";
import { WalletRepository } from "@/lib/repositories/WalletRepository";

describe("wallet service", () => {
  it("should return total balance with decimal precision", async () => {
    jest.spyOn(WalletRepository, "findByUserId").mockResolvedValueOnce({
      id: "wallet-id",
      userId: "user-id",
      availableBalance: "12.50" as unknown as never,
      frozenBalance: "7.50" as unknown as never,
      currency: "CNY",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const result = await WalletService.getWalletByUserId("user-id");
    expect(result.totalBalance).toBe("20.00");
  });
});
