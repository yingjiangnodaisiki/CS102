import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { WorkspaceRepository } from "@/lib/repositories/WorkspaceRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class WorkspaceService {
  static async createSubmission(
    actor: AuthActor,
    command: {
      projectId: string;
      title: string;
      description?: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      requestIp?: string | null;
      requestDevice?: string | null;
    }
  ) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅乙方可上传工作区交付物", 403);
    }
    const project = await ProjectRepository.findById(command.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    if (project.status !== "AWARDED") {
      throw new AppError("PROJECT_NOT_DELIVERABLE", "仅中标后的项目可提交交付物", 422);
    }
    const myBid = await BidRepository.findProjectBidByDeveloper(command.projectId, actor.userId);
    if (!myBid) {
      throw new AppError("FORBIDDEN", "你不是该项目关联乙方，无法上传", 403);
    }
    if (myBid.status !== "ACCEPTED") {
      throw new AppError("FORBIDDEN", "仅中标乙方可提交交付物", 403);
    }

    const submission = await WorkspaceRepository.create({
      projectId: command.projectId,
      submitterUserId: actor.userId,
      title: command.title,
      description: command.description,
      fileName: command.fileName,
      fileUrl: command.fileUrl,
      fileSize: command.fileSize,
      mimeType: command.mimeType
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "WORKSPACE_SUBMISSION_CREATE",
      resource: "WORKSPACE_SUBMISSION",
      resourceId: submission.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return submission;
  }

  static async listSubmissions(
    actor: AuthActor,
    query: {
      projectId?: string;
      status?: "PENDING" | "APPROVED" | "REJECTED";
    }
  ) {
    return WorkspaceRepository.listForActor(actor, query);
  }

  static async listTodoProjects(actor: AuthActor) {
    const rows = await WorkspaceRepository.listTodoProjects(actor);
    return rows
      .map((item) => {
        const acceptedDeveloperId = item.bids[0]?.developerId ?? null;
        const latestForAcceptedDeveloper = acceptedDeveloperId
          ? item.workspaceSubmissions.find((submission) => submission.submitterUserId === acceptedDeveloperId)
          : null;

        const completed = latestForAcceptedDeveloper?.status === "APPROVED";
        return {
          projectId: item.id,
          title: item.title,
          status: item.status,
          clientId: item.clientId,
          acceptedDeveloperId,
          latestSubmissionStatus: latestForAcceptedDeveloper?.status ?? null,
          latestSubmissionAt: latestForAcceptedDeveloper?.createdAt.toISOString() ?? null,
          counterpartUserId:
            actor.role === "DEVELOPER"
              ? item.clientId
              : acceptedDeveloperId,
          isCompleted: completed
        };
      })
      .filter((item) => !item.isCompleted);
  }

  static async reviewSubmission(
    actor: AuthActor,
    submissionId: string,
    input: {
      action: "APPROVE" | "REJECT";
      reviewNote?: string;
      requestIp?: string | null;
      requestDevice?: string | null;
    }
  ) {
    const submission = await WorkspaceRepository.findById(submissionId);
    if (!submission) {
      throw new AppError("WORKSPACE_SUBMISSION_NOT_FOUND", "交付物不存在", 404);
    }
    if (actor.role !== "ADMIN" && submission.project.clientId !== actor.userId) {
      throw new AppError("FORBIDDEN", "仅甲方或管理员可审核交付物", 403);
    }
    if (submission.status !== "PENDING") {
      throw new AppError("WORKSPACE_SUBMISSION_REVIEWED", "交付物已审核，无需重复操作", 409);
    }

    const reviewed = await WorkspaceRepository.review(submissionId, {
      status: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewerUserId: actor.userId,
      reviewNote: input.reviewNote?.trim() || undefined
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "WORKSPACE_SUBMISSION_REVIEW",
      resource: "WORKSPACE_SUBMISSION",
      resourceId: reviewed.id,
      status: "SUCCESS",
      requestIp: input.requestIp,
      requestDevice: input.requestDevice,
      details: {
        action: input.action
      }
    });

    return reviewed;
  }
}
