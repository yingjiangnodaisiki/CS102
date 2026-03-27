import Decimal from "decimal.js";
import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { prisma } from "@/lib/prisma";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { AdminRiskService } from "@/lib/services/admin/AdminRiskService";
import { ContractRepository } from "@/lib/repositories/ContractRepository";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface BidAttachmentInput {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface CreateBidCommand {
  projectId: string;
  amount: number;
  proposal: string;
  expectedDays: number;
  attachments?: BidAttachmentInput[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface UpdateBidCommand {
  bidId: string;
  amount?: number;
  proposal?: string;
  expectedDays?: number;
  attachments?: BidAttachmentInput[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

interface AcceptBidCommand {
  bidId: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class BidService {
  static async placeBid(actor: AuthActor, command: CreateBidCommand) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可投标", 403);
    }

    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    if (!["PUBLISHED", "BIDDING"].includes(project.status)) {
      throw new AppError("PROJECT_NOT_BIDDING", "项目当前不可投标", 422);
    }
    if (new Date() >= project.biddingEndsAt) {
      throw new AppError("BID_DEADLINE_REACHED", "投标截止后不可提交", 422);
    }

    const duplicate = await BidRepository.findProjectBidByDeveloper(command.projectId, actor.userId);
    if (duplicate && duplicate.status !== "WITHDRAWN") {
      throw new AppError("BID_ALREADY_EXISTS", "同一项目仅允许一个有效投标", 409);
    }

    const riskConflict = await BidRepository.findRiskConflict(
      command.projectId,
      actor.userId,
      command.requestIp,
      command.requestDevice
    );
    if (riskConflict) {
      await AdminRiskService.reportBidCollusion({
        projectId: command.projectId,
        reporterUserId: actor.userId,
        submittedIp: command.requestIp,
        submittedDevice: command.requestDevice,
        bidId: riskConflict.id
      });
      throw new AppError("BID_RISK_DETECTED", "检测到同IP或设备多账号投标风险", 403);
    }

    const profile = await prisma.developerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
      include: {
        skills: {
          where: { deletedAt: null },
          include: {
            skill: {
              select: {
                code: true,
                deletedAt: true
              }
            }
          }
        }
      }
    });
    if (!profile || !profile.capabilityPassed) {
      throw new AppError("CAPABILITY_NOT_VERIFIED", "开发者能力未通过认证", 403);
    }

    const requiredTags = Array.from(
      new Set(
        project.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      )
    );
    if (requiredTags.length > 0) {
      const verifiedSkillCodes = new Set(
        profile.skills
          .filter((item) => item.isVerified && item.skill.deletedAt === null)
          .map((item) => item.skill.code.trim().toLowerCase())
          .filter((code) => code.length > 0)
      );
      const missingSkills = requiredTags.filter((tag) => !verifiedSkillCodes.has(tag));
      if (missingSkills.length > 0) {
        throw new AppError("SKILL_NOT_VERIFIED", "未完成项目所需技能认证，暂不可投标", 403, {
          requiredSkills: requiredTags,
          verifiedSkills: Array.from(verifiedSkillCodes),
          missingSkills
        });
      }
    }

    const bid = await BidRepository.create({
      projectId: command.projectId,
      developerId: actor.userId,
      amount: new Decimal(command.amount).toFixed(2),
      proposal: command.proposal,
      expectedDays: command.expectedDays,
      submittedIp: command.requestIp,
      submittedDevice: command.requestDevice,
      attachments: command.attachments
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "BID_CREATE",
      resource: "BID",
      resourceId: bid.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return bid;
  }

  static async listProjectBids(projectId: string) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    return BidRepository.listByProject(projectId);
  }

  static async listMyBids(actor: AuthActor) {
    const rows = await BidRepository.listForActor(actor.userId, actor.role);
    return rows.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      projectTitle: item.project.title,
      developerId: item.developerId,
      developerName: item.developer.developerProfile?.displayName ?? item.developer.id,
      amount: item.amount.toString(),
      proposal: item.proposal,
      expectedDays: item.expectedDays,
      status: item.status,
      createdAt: item.createdAt.toISOString()
    }));
  }

  static async updateBid(actor: AuthActor, command: UpdateBidCommand) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可修改投标", 403);
    }
    const bid = await BidRepository.findById(command.bidId);
    if (!bid) {
      throw new AppError("BID_NOT_FOUND", "投标不存在", 404);
    }
    if (bid.developerId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无投标修改权限", 403);
    }
    if (bid.status !== "PENDING") {
      throw new AppError("BID_NOT_EDITABLE", "当前投标状态不可修改", 422);
    }

    const project = await ProjectRepository.findById(bid.projectId);
    if (!project || new Date() >= project.biddingEndsAt) {
      throw new AppError("BID_DEADLINE_REACHED", "投标截止后不可修改", 422);
    }

    const updated = await BidRepository.updateById(command.bidId, {
      amount: command.amount !== undefined ? new Decimal(command.amount).toFixed(2) : undefined,
      proposal: command.proposal,
      expectedDays: command.expectedDays,
      attachments: command.attachments
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "BID_UPDATE",
      resource: "BID",
      resourceId: updated.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return updated;
  }

  static async withdrawBid(
    actor: AuthActor,
    bidId: string,
    meta?: { requestIp?: string | null; requestDevice?: string | null }
  ) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可撤回投标", 403);
    }
    const bid = await BidRepository.findById(bidId);
    if (!bid) {
      throw new AppError("BID_NOT_FOUND", "投标不存在", 404);
    }
    if (bid.developerId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无投标撤回权限", 403);
    }
    if (bid.status !== "PENDING") {
      throw new AppError("BID_NOT_WITHDRAWABLE", "当前投标状态不可撤回", 422);
    }

    const project = await ProjectRepository.findById(bid.projectId);
    if (!project || new Date() >= project.biddingEndsAt) {
      throw new AppError("BID_DEADLINE_REACHED", "投标截止后不可撤回", 422);
    }

    const updated = await BidRepository.updateById(bid.id, {
      status: "WITHDRAWN"
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "BID_WITHDRAW",
      resource: "BID",
      resourceId: updated.id,
      status: "SUCCESS",
      requestIp: meta?.requestIp,
      requestDevice: meta?.requestDevice
    });

    return updated;
  }

  static async acceptBid(actor: AuthActor, command: AcceptBidCommand) {
    if (!["CLIENT", "ADMIN"].includes(actor.role)) {
      throw new AppError("FORBIDDEN", "仅甲方或管理员可确认中标", 403);
    }

    const targetBid = await BidRepository.findByIdWithProject(command.bidId);
    if (!targetBid) {
      throw new AppError("BID_NOT_FOUND", "投标不存在", 404);
    }

    if (actor.role !== "ADMIN" && targetBid.project.clientId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无中标确认权限", 403);
    }

    if (targetBid.project.status === "CANCELLED" || targetBid.project.status === "CLOSED") {
      throw new AppError("PROJECT_NOT_AWARDABLE", "当前项目状态不可确认中标", 422);
    }

    if (targetBid.status !== "PENDING" && targetBid.status !== "ACCEPTED") {
      throw new AppError("BID_NOT_AWARDABLE", "当前投标状态不可中标", 422);
    }

    const accepted = await BidRepository.findAcceptedByProject(targetBid.projectId);
    if (accepted && accepted.id !== targetBid.id) {
      throw new AppError("PROJECT_ALREADY_AWARDED", "项目已有中标投标", 409, {
        acceptedBidId: accepted.id
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let acceptedBidId = targetBid.id;
      let rejectedCount = 0;

      if (targetBid.status !== "ACCEPTED") {
        const acceptedBid = await BidRepository.updateStatus(targetBid.id, "ACCEPTED", tx);
        acceptedBidId = acceptedBid.id;
        rejectedCount = await BidRepository.rejectOtherPendingBids(targetBid.projectId, acceptedBid.id, tx);
      }

      const project = await ProjectRepository.updateById(
        targetBid.projectId,
        {
          status: "AWARDED"
        },
        tx
      );

      let contract = await ContractRepository.findByProjectId(targetBid.projectId, tx);
      if (!contract) {
        contract = await ContractRepository.create(
          {
            projectId: targetBid.projectId,
            clientId: targetBid.project.clientId,
            developerId: targetBid.developerId,
            totalAmount: new Decimal(targetBid.amount.toString()).toFixed(2)
          },
          tx
        );
      }

      return {
        acceptedBidId,
        rejectedCount,
        projectStatus: project.status,
        contractId: contract.id
      };
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "BID_ACCEPT",
      resource: "BID",
      resourceId: targetBid.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        projectId: targetBid.projectId,
        contractId: result.contractId,
        projectStatus: result.projectStatus,
        rejectedCount: result.rejectedCount
      }
    });

    return {
      projectId: targetBid.projectId,
      acceptedBidId: result.acceptedBidId,
      rejectedCount: result.rejectedCount,
      projectStatus: result.projectStatus,
      contractId: result.contractId,
      idempotent: targetBid.status === "ACCEPTED"
    };
  }
}
