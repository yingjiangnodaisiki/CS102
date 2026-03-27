import { Contract } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import { ContractRepository } from "@/lib/repositories/ContractRepository";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface GetProjectContractCommand {
  projectId: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class ContractService {
  static async getProjectContract(actor: AuthActor, command: GetProjectContractCommand): Promise<Contract> {
    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }

    const contract = await ContractRepository.findByProjectId(command.projectId);
    if (!contract) {
      throw new AppError("CONTRACT_NOT_FOUND", "项目合同不存在", 404);
    }

    const isAdmin = actor.role === "ADMIN";
    const isClientOwner = actor.userId === project.clientId;
    const isDeveloperOwner = actor.userId === contract.developerId;
    const hasPermission = isAdmin || isClientOwner || isDeveloperOwner;

    if (!hasPermission) {
      await AuditLogService.record({
        userId: actor.userId,
        action: "CONTRACT_VIEW",
        resource: "CONTRACT",
        resourceId: contract.id,
        status: "FAILED",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: {
          projectId: command.projectId,
          reason: "PERMISSION_DENIED"
        }
      });
      throw new AppError("FORBIDDEN", "无合同查看权限", 403);
    }

    await AuditLogService.record({
      userId: actor.userId,
      action: "CONTRACT_VIEW",
      resource: "CONTRACT",
      resourceId: contract.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        projectId: command.projectId
      }
    });

    return contract;
  }
}
