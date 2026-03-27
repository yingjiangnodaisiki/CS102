import { Portfolio } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import { prisma } from "@/lib/prisma";
import { PortfolioRepository } from "@/lib/repositories/PortfolioRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface CreatePortfolioCommand {
  title: string;
  description: string;
  projectUrl?: string;
  repositoryUrl?: string;
  tags: string[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface UpdatePortfolioCommand {
  portfolioId: string;
  title?: string;
  description?: string;
  projectUrl?: string;
  repositoryUrl?: string;
  tags?: string[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class PortfolioService {
  static async create(actor: AuthActor, command: CreatePortfolioCommand): Promise<Portfolio> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const portfolio = await PortfolioRepository.create({
      developerProfileId: developerProfile.id,
      title: command.title,
      description: command.description,
      projectUrl: command.projectUrl,
      repositoryUrl: command.repositoryUrl,
      tags: command.tags
    });
    await AuditLogService.record({
      userId: actor.userId,
      action: "PORTFOLIO_CREATE",
      resource: "PORTFOLIO",
      resourceId: portfolio.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });
    return portfolio;
  }

  static async listMine(actor: AuthActor): Promise<Portfolio[]> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    return PortfolioRepository.listByDeveloperProfile(developerProfile.id);
  }

  static async update(actor: AuthActor, command: UpdatePortfolioCommand): Promise<Portfolio> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const existing = await PortfolioRepository.findById(command.portfolioId);
    if (!existing) {
      throw new AppError("PORTFOLIO_NOT_FOUND", "作品不存在", 404);
    }
    if (existing.developerProfileId !== developerProfile.id) {
      throw new AppError("FORBIDDEN", "无权限修改该作品", 403);
    }

    const updated = await PortfolioRepository.updateById(command.portfolioId, {
      title: command.title,
      description: command.description,
      projectUrl: command.projectUrl,
      repositoryUrl: command.repositoryUrl,
      tags: command.tags
    });
    await AuditLogService.record({
      userId: actor.userId,
      action: "PORTFOLIO_UPDATE",
      resource: "PORTFOLIO",
      resourceId: updated.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });
    return updated;
  }

  static async delete(
    actor: AuthActor,
    portfolioId: string,
    meta?: { requestIp?: string | null; requestDevice?: string | null }
  ): Promise<void> {
    const developerProfile = await this.getDeveloperProfileOrThrow(actor);
    const existing = await PortfolioRepository.findById(portfolioId);
    if (!existing) {
      throw new AppError("PORTFOLIO_NOT_FOUND", "作品不存在", 404);
    }
    if (existing.developerProfileId !== developerProfile.id) {
      throw new AppError("FORBIDDEN", "无权限删除该作品", 403);
    }
    await PortfolioRepository.softDeleteById(portfolioId);
    await AuditLogService.record({
      userId: actor.userId,
      action: "PORTFOLIO_DELETE",
      resource: "PORTFOLIO",
      resourceId: portfolioId,
      status: "SUCCESS",
      requestIp: meta?.requestIp,
      requestDevice: meta?.requestDevice
    });
  }

  private static async getDeveloperProfileOrThrow(actor: AuthActor): Promise<{ id: string }> {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可操作作品", 403);
    }
    const developerProfile = await prisma.developerProfile.findFirst({
      where: {
        userId: actor.userId,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!developerProfile) {
      throw new AppError("DEVELOPER_PROFILE_NOT_FOUND", "开发者资料不存在", 404);
    }
    return developerProfile;
  }
}
