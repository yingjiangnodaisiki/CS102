import Decimal from "decimal.js";
import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { MilestoneRepository } from "@/lib/repositories/MilestoneRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { prisma } from "@/lib/prisma";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface MilestoneTemplateItem {
  title: string;
  amount: number;
  dueAt: string;
}

interface InitMilestoneTemplateCommand {
  projectId: string;
  milestones: MilestoneTemplateItem[];
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class ProjectMilestoneService {
  static async initializeTemplate(actor: AuthActor, command: InitMilestoneTemplateCommand) {
    if (!["CLIENT", "ADMIN"].includes(actor.role)) {
      throw new AppError("FORBIDDEN", "仅甲方或管理员可初始化里程碑", 403);
    }

    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    if (actor.role !== "ADMIN" && project.clientId !== actor.userId) {
      throw new AppError("FORBIDDEN", "无里程碑初始化权限", 403);
    }
    if (project.status !== "AWARDED") {
      throw new AppError("PROJECT_NOT_AWARDED", "项目未中标，不能初始化里程碑", 422);
    }

    const contract = await ContractRepository.findByProjectId(project.id);
    if (!contract) {
      throw new AppError("CONTRACT_NOT_FOUND", "中标合约不存在", 404);
    }

    const total = command.milestones.reduce((acc, item) => acc.plus(new Decimal(item.amount)), new Decimal(0));
    const contractAmount = new Decimal(contract.totalAmount.toString());
    if (!total.equals(contractAmount)) {
      throw new AppError("MILESTONE_TOTAL_MISMATCH", "里程碑总金额必须等于合约金额", 422, {
        milestoneTotal: total.toFixed(2),
        contractAmount: contractAmount.toFixed(2)
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const exists = await MilestoneRepository.listByProject(project.id, tx);
      if (exists.length > 0) {
        throw new AppError("MILESTONE_ALREADY_INITIALIZED", "里程碑已初始化，请勿重复提交", 409);
      }

      return MilestoneRepository.createMany(
        project.id,
        command.milestones.map((item) => ({
          title: item.title,
          amount: new Decimal(item.amount).toFixed(2),
          dueAt: new Date(item.dueAt)
        })),
        tx
      );
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "MILESTONE_TEMPLATE_INIT",
      resource: "PROJECT",
      resourceId: project.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        projectId: project.id,
        contractId: contract.id,
        milestoneCount: created.length,
        totalAmount: total.toFixed(2)
      }
    });

    return {
      projectId: project.id,
      contractId: contract.id,
      milestoneCount: created.length,
      totalAmount: total.toFixed(2),
      milestones: created
    };
  }
}
