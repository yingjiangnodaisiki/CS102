import { AppError } from "@/lib/errors/AppError";
import { ProfileRepository } from "@/lib/repositories/ProfileRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class ProfileService {
  static async getMine(actor: AuthActor) {
    const profile = await ProfileRepository.findMyProfile(actor.userId);
    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", "用户资料不存在", 404);
    }
    return profile;
  }

  static async updateMine(
    actor: AuthActor,
    input: {
      avatarUrl?: string;
      bio?: string;
      companyName?: string;
      contactName?: string;
      displayName?: string;
      requestIp?: string | null;
      requestDevice?: string | null;
    }
  ) {
    if (actor.role === "CLIENT") {
      await ProfileRepository.updateClientProfile(actor.userId, {
        avatarUrl: input.avatarUrl,
        bio: input.bio,
        companyName: input.companyName,
        contactName: input.contactName
      });
    } else if (actor.role === "DEVELOPER") {
      await ProfileRepository.updateDeveloperProfile(actor.userId, {
        avatarUrl: input.avatarUrl,
        bio: input.bio,
        displayName: input.displayName
      });
    } else {
      throw new AppError("FORBIDDEN", "当前角色不支持自定义资料", 403);
    }

    await AuditLogService.record({
      userId: actor.userId,
      action: "PROFILE_UPDATE",
      resource: "PROFILE",
      resourceId: actor.userId,
      status: "SUCCESS",
      requestIp: input.requestIp,
      requestDevice: input.requestDevice
    });

    return this.getMine(actor);
  }

  static async getPublicProfile(userId: string) {
    const profile = await ProfileRepository.findPublicProfile(userId);
    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", "用户资料不存在", 404);
    }
    return profile;
  }

  static async searchUsers(keyword: string) {
    return ProfileRepository.searchPublicUsers(keyword.trim());
  }
}
