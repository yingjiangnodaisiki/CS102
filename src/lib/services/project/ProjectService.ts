import Decimal from "decimal.js";
import { Project } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import {
  PROJECT_STATUS_TRANSITIONS,
  ProjectStatus,
  ProjectStatusValue
} from "@/lib/constants/project";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface CreateProjectCommand {
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  biddingEndsAt: string;
  tags: string[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface UpdateProjectCommand {
  projectId: string;
  title?: string;
  description?: string;
  budgetMin?: number;
  budgetMax?: number;
  biddingEndsAt?: string;
  tags?: string[];
  status?: ProjectStatusValue;
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface ListProjectPlazaQuery {
  page: number;
  pageSize: number;
  status?: ProjectStatusValue;
  keyword?: string;
}

interface ProjectPlazaItem {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetMin: string;
  budgetMax: string;
  biddingEndsAt: string;
  tags: string[];
  clientId: string;
  createdAt: string;
  isMine: boolean;
  hasMyBid: boolean;
  bidCount: number;
  canBid: boolean;
}

export class ProjectService {
  static async createProject(actor: AuthActor, command: CreateProjectCommand): Promise<Project> {
    if (actor.role !== "CLIENT") {
      throw new AppError("FORBIDDEN", "仅甲方可发布项目", 403);
    }

    if (new Decimal(command.budgetMin).greaterThan(new Decimal(command.budgetMax))) {
      throw new AppError("BUDGET_INVALID", "预算区间不合法", 422);
    }

    const project = await ProjectRepository.create({
      title: command.title,
      description: command.description,
      budgetMin: new Decimal(command.budgetMin).toFixed(2),
      budgetMax: new Decimal(command.budgetMax).toFixed(2),
      biddingEndsAt: new Date(command.biddingEndsAt),
      tags: command.tags,
      clientId: actor.userId
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "PROJECT_CREATE",
      resource: "PROJECT",
      resourceId: project.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return project;
  }

  static async getProjectById(actor: AuthActor, projectId: string): Promise<Project> {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    const isOwner = actor.userId === project.clientId;
    if (project.status === ProjectStatus.DRAFT && actor.role !== "ADMIN" && !isOwner) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    return project;
  }

  static async listProjects(
    actor: AuthActor,
    query: {
    page: number;
    pageSize: number;
    status?: ProjectStatusValue;
  }): Promise<{ items: Project[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await ProjectRepository.list({
      ...query,
      actorUserId: actor.userId,
      actorRole: actor.role
    });
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  static async listPlazaProjects(
    actor: AuthActor,
    query: ListProjectPlazaQuery
  ): Promise<{ items: ProjectPlazaItem[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await ProjectRepository.listPlaza({
      ...query,
      actorUserId: actor.userId,
      actorRole: actor.role
    });

    const mapped = items.map((item) => {
      const hasMyBid = item.bids.some((bid) => bid.status !== "WITHDRAWN");
      const canBid =
        actor.role === "DEVELOPER" &&
        item.clientId !== actor.userId &&
        !hasMyBid &&
        ["PUBLISHED", "BIDDING"].includes(item.status) &&
        new Date() < item.biddingEndsAt;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        budgetMin: item.budgetMin.toString(),
        budgetMax: item.budgetMax.toString(),
        biddingEndsAt: item.biddingEndsAt.toISOString(),
        tags: item.tags,
        clientId: item.clientId,
        createdAt: item.createdAt.toISOString(),
        isMine: item.clientId === actor.userId,
        hasMyBid,
        bidCount: item._count.bids,
        canBid
      };
    });

    return {
      items: mapped,
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  }

  static async updateProject(actor: AuthActor, command: UpdateProjectCommand): Promise<Project> {
    const current = await this.getProjectByIdRaw(command.projectId);
    this.assertProjectWritePermission(actor, current.clientId);

    if (command.budgetMin !== undefined && command.budgetMax !== undefined) {
      if (new Decimal(command.budgetMin).greaterThan(new Decimal(command.budgetMax))) {
        throw new AppError("BUDGET_INVALID", "预算区间不合法", 422);
      }
    }

    if (command.status && !this.canTransitStatus(current.status as ProjectStatusValue, command.status)) {
      throw new AppError("PROJECT_STATUS_INVALID", "非法状态流转", 422, {
        from: current.status,
        to: command.status
      });
    }

    const updated = await ProjectRepository.updateById(command.projectId, {
      title: command.title,
      description: command.description,
      budgetMin: command.budgetMin !== undefined ? new Decimal(command.budgetMin).toFixed(2) : undefined,
      budgetMax: command.budgetMax !== undefined ? new Decimal(command.budgetMax).toFixed(2) : undefined,
      biddingEndsAt: command.biddingEndsAt ? new Date(command.biddingEndsAt) : undefined,
      tags: command.tags,
      status: command.status as Project["status"] | undefined
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "PROJECT_UPDATE",
      resource: "PROJECT",
      resourceId: updated.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        fromStatus: current.status,
        toStatus: command.status ?? current.status
      }
    });

    return updated;
  }

  static async deleteProject(
    actor: AuthActor,
    projectId: string,
    meta?: { requestIp?: string | null; requestDevice?: string | null }
  ): Promise<void> {
    const current = await this.getProjectByIdRaw(projectId);
    this.assertProjectWritePermission(actor, current.clientId);

    if (
      !([ProjectStatus.DRAFT, ProjectStatus.PUBLISHED, ProjectStatus.CANCELLED] as ProjectStatusValue[]).includes(
        current.status as ProjectStatusValue
      )
    ) {
      throw new AppError("PROJECT_DELETE_FORBIDDEN", "当前状态不可删除项目", 422);
    }

    await ProjectRepository.softDeleteById(projectId);

    await AuditLogService.record({
      userId: actor.userId,
      action: "PROJECT_DELETE",
      resource: "PROJECT",
      resourceId: projectId,
      status: "SUCCESS",
      requestIp: meta?.requestIp,
      requestDevice: meta?.requestDevice
    });
  }

  private static assertProjectWritePermission(actor: AuthActor, clientId: string): void {
    const isOwner = actor.userId === clientId;
    if (!isOwner && actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "无项目操作权限", 403);
    }
  }

  private static canTransitStatus(
    from: ProjectStatusValue,
    to: ProjectStatusValue
  ): boolean {
    if (from === to) {
      return true;
    }
    return PROJECT_STATUS_TRANSITIONS[from].includes(to);
  }

  private static async getProjectByIdRaw(projectId: string): Promise<Project> {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    return project;
  }
}
