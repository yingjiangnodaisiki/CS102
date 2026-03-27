import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/AppError";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { verifyPassword, hashPassword } from "@/lib/utils/password";
import { signAccessToken } from "@/lib/utils/jwt";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import {
  getPasswordHashFingerprint,
  signEmailVerificationToken,
  verifyEmailVerificationToken
} from "@/lib/utils/email-verification-token";
import { sendEmail } from "@/lib/utils/email-sender";

interface RegisterCommand {
  email: string;
  password: string;
  role: "CLIENT" | "DEVELOPER";
  profile: {
    companyName?: string;
    contactName?: string;
    displayName?: string;
  };
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface LoginCommand {
  email: string;
  password: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface AuthResult {
  user: Pick<User, "id" | "email" | "role">;
  accessToken: string;
}

export class AuthService {
  private static readonly EMAIL_VERIFY_REQUEST_PER_MINUTE = 1;
  private static readonly EMAIL_VERIFY_REQUEST_PER_DAY = 10;
  private static readonly DISABLE_EMAIL_VERIFY_RATE_LIMIT =
    process.env.EMAIL_VERIFY_RATE_LIMIT_DISABLED === "true";

  private static async ensureEmailVerifyRateLimit(resourceKey: string): Promise<void> {
    if (this.DISABLE_EMAIL_VERIFY_RATE_LIMIT) {
      return;
    }
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [countInMinute, countInDay] = await Promise.all([
      prisma.auditLog.count({
        where: {
          deletedAt: null,
          action: "AUTH_EMAIL_VERIFY_REQUEST",
          resourceId: resourceKey,
          createdAt: { gte: oneMinuteAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          deletedAt: null,
          action: "AUTH_EMAIL_VERIFY_REQUEST",
          resourceId: resourceKey,
          createdAt: { gte: oneDayAgo }
        }
      })
    ]);

    if (countInMinute >= this.EMAIL_VERIFY_REQUEST_PER_MINUTE) {
      throw new AppError("EMAIL_VERIFY_RATE_LIMIT", "请求过于频繁，请1分钟后重试", 429);
    }
    if (countInDay >= this.EMAIL_VERIFY_REQUEST_PER_DAY) {
      throw new AppError("EMAIL_VERIFY_DAILY_LIMIT", "今日邮箱验证请求已达上限，请明日再试", 429);
    }
  }

  private static async sendVerificationEmail(input: {
    email: string;
    verifyUrl: string;
    purpose: "FORGOT_PASSWORD" | "CHANGE_PASSWORD";
  }): Promise<void> {
    const title = input.purpose === "FORGOT_PASSWORD" ? "重置密码邮箱验证" : "修改密码邮箱验证";
    const actionText = input.purpose === "FORGOT_PASSWORD" ? "前往重置密码" : "前往确认修改密码";
    const text = [
      `你正在进行${title}。`,
      "验证链接有效期 15 分钟，请尽快完成操作：",
      input.verifyUrl
    ].join("\n");
    const html = [
      `<p>你正在进行<strong>${title}</strong>。</p>`,
      "<p>验证链接有效期 15 分钟，请尽快完成操作：</p>",
      `<p><a href="${input.verifyUrl}" style="display:inline-block;padding:10px 16px;background:#1677ff;color:#fff;text-decoration:none;border-radius:6px;">${actionText}</a></p>`,
      `<p style="color:#666;font-size:12px;word-break:break-all;">若按钮无法点击，请复制以下链接到浏览器打开：<br/>${input.verifyUrl}</p>`
    ].join("");
    await sendEmail({
      to: input.email,
      subject: `[AI开发者平台] ${title}`,
      text,
      html
    });
  }

  static async register(command: RegisterCommand): Promise<AuthResult> {
    const existed = await UserRepository.findByEmail(command.email);
    if (existed) {
      await AuditLogService.record({
        action: "AUTH_REGISTER",
        resource: "USER",
        status: "FAILED",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: { email: command.email, reason: "EMAIL_CONFLICT" }
      });
      throw new AppError("EMAIL_EXISTS", "邮箱已被注册", 409);
    }

    const passwordHash = await hashPassword(command.password);
    const createdUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return UserRepository.createWithProfileAndWallet(
        {
          email: command.email,
          passwordHash,
          role: command.role,
          profile: command.profile
        },
        tx
      );
    });

    await AuditLogService.record({
      userId: createdUser.id,
      action: "AUTH_REGISTER",
      resource: "USER",
      resourceId: createdUser.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: { role: createdUser.role }
    });

    return {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role
      },
      accessToken: signAccessToken({ userId: createdUser.id, role: createdUser.role })
    };
  }

  static async login(command: LoginCommand): Promise<AuthResult> {
    const existed = await UserRepository.findByEmail(command.email);
    if (!existed) {
      throw new AppError("AUTH_FAILED", "邮箱或密码错误", 401);
    }

    const pass = await verifyPassword(command.password, existed.passwordHash);
    if (!pass) {
      await AuditLogService.record({
        userId: existed.id,
        action: "AUTH_LOGIN",
        resource: "USER",
        resourceId: existed.id,
        status: "FAILED",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: { reason: "PASSWORD_NOT_MATCHED" }
      });
      throw new AppError("AUTH_FAILED", "邮箱或密码错误", 401);
    }

    await prisma.user.update({
      where: { id: existed.id },
      data: { lastLoginAt: new Date() }
    });

    await AuditLogService.record({
      userId: existed.id,
      action: "AUTH_LOGIN",
      resource: "USER",
      resourceId: existed.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return {
      user: {
        id: existed.id,
        email: existed.email,
        role: existed.role
      },
      accessToken: signAccessToken({ userId: existed.id, role: existed.role })
    };
  }

  static async requestForgotPasswordVerification(command: {
    email: string;
    requestIp?: string | null;
    requestDevice?: string | null;
    appBaseUrl?: string;
  }): Promise<{ accepted: true; resetUrl?: string }> {
    const existed = await UserRepository.findByEmail(command.email);
    const resourceKey = `FORGOT_PASSWORD:${command.email}`;
    await this.ensureEmailVerifyRateLimit(resourceKey);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? command.appBaseUrl ?? "http://localhost:3000";
    let resetUrl: string | undefined;
    if (existed) {
      const token = signEmailVerificationToken({
        userId: existed.id,
        email: existed.email,
        passwordHash: existed.passwordHash,
        purpose: "FORGOT_PASSWORD"
      });
      resetUrl = `${baseUrl}/password-reset/${encodeURIComponent(token)}`;
      await this.sendVerificationEmail({
        email: existed.email,
        verifyUrl: resetUrl,
        purpose: "FORGOT_PASSWORD"
      });
    }

    await AuditLogService.record({
      userId: existed?.id,
      action: "AUTH_EMAIL_VERIFY_REQUEST",
      resource: "USER",
      resourceId: resourceKey,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: { email: command.email, found: Boolean(existed), purpose: "FORGOT_PASSWORD" }
    });

    if (!existed) {
      return { accepted: true };
    }
    return {
      accepted: true,
      ...(process.env.NODE_ENV !== "production"
        ? { resetUrl }
        : {})
    };
  }

  static async requestChangePasswordVerification(
    actor: { userId: string; role: "CLIENT" | "DEVELOPER" | "ADMIN" },
    command: { requestIp?: string | null; requestDevice?: string | null; appBaseUrl?: string }
  ): Promise<{ accepted: true; verifyUrl?: string; verificationToken?: string }> {
    const user = await UserRepository.findById(actor.userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "用户不存在", 404);
    }
    const resourceKey = `CHANGE_PASSWORD:${user.email}`;
    await this.ensureEmailVerifyRateLimit(resourceKey);

    const token = signEmailVerificationToken({
      userId: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      purpose: "CHANGE_PASSWORD"
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? command.appBaseUrl ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/profile?verificationToken=${encodeURIComponent(token)}`;

    await this.sendVerificationEmail({
      email: user.email,
      verifyUrl,
      purpose: "CHANGE_PASSWORD"
    });

    await AuditLogService.record({
      userId: user.id,
      action: "AUTH_EMAIL_VERIFY_REQUEST",
      resource: "USER",
      resourceId: resourceKey,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: { email: user.email, purpose: "CHANGE_PASSWORD" }
    });

    return {
      accepted: true,
      ...(process.env.NODE_ENV !== "production"
        ? {
            verifyUrl,
            verificationToken: token
          }
        : {})
    };
  }

  static async resetPasswordWithVerification(command: {
    verificationToken: string;
    newPassword: string;
    requestIp?: string | null;
    requestDevice?: string | null;
  }): Promise<void> {
    const payload = verifyEmailVerificationToken(command.verificationToken, "FORGOT_PASSWORD");
    const user = await UserRepository.findById(payload.userId);
    if (!user || user.email !== payload.email) {
      throw new AppError("EMAIL_VERIFICATION_INVALID", "邮箱验证令牌无效或已过期", 400);
    }
    const currentFingerprint = getPasswordHashFingerprint(user.passwordHash);
    if (currentFingerprint !== payload.fingerprint) {
      throw new AppError("EMAIL_VERIFICATION_EXPIRED", "邮箱验证已失效，请重新申请", 400);
    }

    const nextPasswordHash = await hashPassword(command.newPassword);
    await UserRepository.updatePassword(user.id, nextPasswordHash);
    await AuditLogService.record({
      userId: user.id,
      action: "AUTH_PASSWORD_RESET",
      resource: "USER",
      resourceId: user.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });
  }

  static async validateForgotPasswordVerificationToken(verificationToken: string): Promise<{ valid: true }> {
    const payload = verifyEmailVerificationToken(verificationToken, "FORGOT_PASSWORD");
    const user = await UserRepository.findById(payload.userId);
    if (!user || user.email !== payload.email) {
      throw new AppError("EMAIL_VERIFICATION_INVALID", "邮箱验证令牌无效或已过期", 400);
    }
    const currentFingerprint = getPasswordHashFingerprint(user.passwordHash);
    if (currentFingerprint !== payload.fingerprint) {
      throw new AppError("EMAIL_VERIFICATION_EXPIRED", "邮箱验证已失效，请重新申请", 400);
    }
    return { valid: true };
  }

  static async changePasswordWithVerification(
    actor: { userId: string; role: "CLIENT" | "DEVELOPER" | "ADMIN" },
    command: {
      currentPassword: string;
      newPassword: string;
      verificationToken: string;
      requestIp?: string | null;
      requestDevice?: string | null;
    }
  ): Promise<void> {
    const user = await UserRepository.findById(actor.userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "用户不存在", 404);
    }
    const pass = await verifyPassword(command.currentPassword, user.passwordHash);
    if (!pass) {
      throw new AppError("AUTH_FAILED", "当前密码错误", 401);
    }
    const payload = verifyEmailVerificationToken(command.verificationToken, "CHANGE_PASSWORD");
    if (payload.userId !== user.id || payload.email !== user.email) {
      throw new AppError("EMAIL_VERIFICATION_INVALID", "邮箱验证令牌无效或已过期", 400);
    }
    const currentFingerprint = getPasswordHashFingerprint(user.passwordHash);
    if (currentFingerprint !== payload.fingerprint) {
      throw new AppError("EMAIL_VERIFICATION_EXPIRED", "邮箱验证已失效，请重新申请", 400);
    }

    const nextPasswordHash = await hashPassword(command.newPassword);
    await UserRepository.updatePassword(user.id, nextPasswordHash);
    await AuditLogService.record({
      userId: user.id,
      action: "AUTH_PASSWORD_CHANGE",
      resource: "USER",
      resourceId: user.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });
  }
}
