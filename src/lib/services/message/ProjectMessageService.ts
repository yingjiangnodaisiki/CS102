import { Message } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { MessageRepository } from "@/lib/repositories/MessageRepository";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { RealtimeEventBus } from "@/lib/realtime/RealtimeEventBus";
import { emitSocketToUser } from "@/lib/realtime/SocketEmitter";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface SendProjectMessageCommand {
  projectId?: string;
  receiverId: string;
  content: string;
  messageType?: string;
  requestIp?: string | null;
  requestDevice?: string | null;
}

export class ProjectMessageService {
  static async send(actor: AuthActor, command: SendProjectMessageCommand): Promise<Message> {
    const resolvedProjectId = await this.resolveProjectIdForSend(actor.userId, command.projectId, command.receiverId);
    const project = await ProjectRepository.findById(resolvedProjectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }

    if (command.receiverId === actor.userId) {
      throw new AppError("MESSAGE_RECEIVER_INVALID", "接收人不能是自己", 422);
    }

    const participants = await this.resolveParticipants(project.id, project.clientId);
    if (!participants.includes(actor.userId)) {
      throw new AppError("FORBIDDEN", "非项目参与方不可发送消息", 403);
    }
    if (!participants.includes(command.receiverId)) {
      throw new AppError("MESSAGE_RECEIVER_INVALID", "接收人不是项目参与方", 422);
    }

    const message = await MessageRepository.create({
      projectId: resolvedProjectId,
      senderId: actor.userId,
      receiverId: command.receiverId,
      content: command.content,
      messageType: command.messageType ?? "TEXT"
    });

    const payload = {
      id: message.id,
      projectId: message.projectId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt.toISOString()
    };

    RealtimeEventBus.emitToUser({
      userId: command.receiverId,
      event: "message.created",
      payload
    });
    emitSocketToUser(command.receiverId, "message.created", payload);

    await AuditLogService.record({
      userId: actor.userId,
      action: "PROJECT_MESSAGE_SEND",
      resource: "MESSAGE",
      resourceId: message.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice
    });

    return message;
  }

  static async listMine(actor: AuthActor, projectId: string, page: number, pageSize: number) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在", 404);
    }
    const participants = await this.resolveParticipants(project.id, project.clientId);
    if (!participants.includes(actor.userId) && actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "非项目参与方不可查看消息", 403);
    }
    return MessageRepository.listByProject(projectId, actor.role === "ADMIN" ? null : actor.userId, page, pageSize);
  }

  static async listConversations(actor: AuthActor) {
    return MessageRepository.listConversationsByUser(actor.userId);
  }

  private static async resolveParticipants(projectId: string, clientId: string): Promise<string[]> {
    const bids = await BidRepository.listByProject(projectId);
    const developerIds = bids.map((item) => item.developerId);
    return Array.from(new Set([clientId, ...developerIds]));
  }

  private static async resolveProjectIdForSend(
    senderId: string,
    projectId: string | undefined,
    receiverId: string
  ): Promise<string> {
    if (projectId && projectId.trim()) {
      return projectId.trim();
    }
    const latestProjectId = await MessageRepository.findLatestConversationProjectId(senderId, receiverId);
    if (!latestProjectId) {
      throw new AppError("PROJECT_ID_REQUIRED", "首次沟通请先选择项目ID", 422);
    }
    return latestProjectId;
  }
}
