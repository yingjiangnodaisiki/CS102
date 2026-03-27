import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class UserRepository {
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null
      }
    });
  }

  static async createWithProfileAndWallet(
    data: {
      email: string;
      passwordHash: string;
      role: "CLIENT" | "DEVELOPER";
      profile: {
        companyName?: string;
        contactName?: string;
        displayName?: string;
      };
    },
    tx: Prisma.TransactionClient
  ): Promise<User> {
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        clientProfile:
          data.role === "CLIENT"
            ? {
                create: {
                  companyName: data.profile.companyName ?? "未命名公司",
                  contactName: data.profile.contactName ?? "默认联系人"
                }
              }
            : undefined,
        developerProfile:
          data.role === "DEVELOPER"
            ? {
                create: {
                  displayName: data.profile.displayName ?? "新开发者"
                }
              }
            : undefined,
        wallet: {
          create: {
            availableBalance: 0,
            frozenBalance: 0,
            currency: "CNY"
          }
        }
      }
    });

    return user;
  }

  static async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });
  }

  static async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash
      }
    });
  }
}
