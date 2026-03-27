import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export interface ProfileView {
  userId: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  companyName?: string;
  contactName?: string;
  displayName?: string;
}

export class ProfileRepository {
  static async findMyProfile(userId: string): Promise<ProfileView | null> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        clientProfile: true,
        developerProfile: true
      }
    });
    if (!user) {
      return null;
    }

    if (user.role === "CLIENT") {
      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        avatarUrl: user.clientProfile?.avatarUrl ?? null,
        bio: user.clientProfile?.bio ?? null,
        companyName: user.clientProfile?.companyName ?? undefined,
        contactName: user.clientProfile?.contactName ?? undefined
      };
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      avatarUrl: user.developerProfile?.avatarUrl ?? null,
      bio: user.developerProfile?.bio ?? null,
      displayName: user.developerProfile?.displayName ?? undefined
    };
  }

  static async updateClientProfile(
    userId: string,
    data: {
      avatarUrl?: string | null;
      bio?: string | null;
      companyName?: string;
      contactName?: string;
    }
  ): Promise<void> {
    await prisma.clientProfile.update({
      where: { userId },
      data: {
        avatarUrl: data.avatarUrl,
        bio: data.bio,
        companyName: data.companyName,
        contactName: data.contactName
      }
    });
  }

  static async updateDeveloperProfile(
    userId: string,
    data: {
      avatarUrl?: string | null;
      bio?: string | null;
      displayName?: string;
    }
  ): Promise<void> {
    await prisma.developerProfile.update({
      where: { userId },
      data: {
        avatarUrl: data.avatarUrl,
        bio: data.bio,
        displayName: data.displayName
      }
    });
  }

  static async findPublicProfile(userId: string): Promise<ProfileView | null> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        clientProfile: true,
        developerProfile: true
      }
    });
    if (!user) {
      return null;
    }
    if (user.role === "CLIENT") {
      return {
        userId: user.id,
        email: "",
        role: user.role,
        avatarUrl: user.clientProfile?.avatarUrl ?? null,
        bio: user.clientProfile?.bio ?? null,
        companyName: user.clientProfile?.companyName ?? undefined,
        contactName: user.clientProfile?.contactName ?? undefined
      };
    }
    return {
      userId: user.id,
      email: "",
      role: user.role,
      avatarUrl: user.developerProfile?.avatarUrl ?? null,
      bio: user.developerProfile?.bio ?? null,
      displayName: user.developerProfile?.displayName ?? undefined
    };
  }

  static async searchPublicUsers(keyword: string): Promise<
    Array<{
      userId: string;
      role: UserRole;
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
    }>
  > {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { email: { contains: keyword, mode: "insensitive" } },
          { clientProfile: { companyName: { contains: keyword, mode: "insensitive" } } },
          { clientProfile: { contactName: { contains: keyword, mode: "insensitive" } } },
          { developerProfile: { displayName: { contains: keyword, mode: "insensitive" } } }
        ]
      },
      include: {
        clientProfile: true,
        developerProfile: true
      },
      take: 20,
      orderBy: { createdAt: "desc" }
    });

    return users.map((user) => ({
      userId: user.id,
      role: user.role,
      displayName:
        user.role === "CLIENT"
          ? user.clientProfile?.companyName ?? user.clientProfile?.contactName ?? "甲方用户"
          : user.developerProfile?.displayName ?? "开发者用户",
      avatarUrl: user.role === "CLIENT" ? user.clientProfile?.avatarUrl ?? null : user.developerProfile?.avatarUrl ?? null,
      bio: user.role === "CLIENT" ? user.clientProfile?.bio ?? null : user.developerProfile?.bio ?? null
    }));
  }
}
