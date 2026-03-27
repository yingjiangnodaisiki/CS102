import { AppError } from "@/lib/errors/AppError";
import { BidRepository } from "@/lib/repositories/BidRepository";
import { MessageRepository } from "@/lib/repositories/MessageRepository";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { RealtimeEventBus } from "@/lib/realtime/RealtimeEventBus";
import * as SocketEmitter from "@/lib/realtime/SocketEmitter";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";
import { ProjectMessageService } from "@/lib/services/message/ProjectMessageService";

describe("project message service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject sender who is not participant", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "listByProject").mockResolvedValueOnce([
      {
        id: "bid-1",
        projectId: "project-1",
        developerId: "dev-1",
        amount: "120.00" as unknown as never,
        proposal: "proposal",
        expectedDays: 10,
        status: "PENDING",
        submittedIp: null,
        submittedDevice: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    ]);

    await expect(
      ProjectMessageService.send(
        { userId: "outsider-1", role: "DEVELOPER" },
        {
          projectId: "project-1",
          receiverId: "client-1",
          content: "hello"
        }
      )
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should send message and emit realtime event", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "title",
      description: "desc",
      budgetMin: "100.00" as unknown as never,
      budgetMax: "200.00" as unknown as never,
      status: "BIDDING",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(BidRepository, "listByProject").mockResolvedValueOnce([
      {
        id: "bid-1",
        projectId: "project-1",
        developerId: "dev-1",
        amount: "120.00" as unknown as never,
        proposal: "proposal",
        expectedDays: 10,
        status: "PENDING",
        submittedIp: null,
        submittedDevice: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      }
    ]);
    const createSpy = jest.spyOn(MessageRepository, "create").mockResolvedValueOnce({
      id: "msg-1",
      projectId: "project-1",
      senderId: "client-1",
      receiverId: "dev-1",
      content: "请补充里程碑细节",
      messageType: "TEXT",
      metadata: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const busSpy = jest.spyOn(RealtimeEventBus, "emitToUser").mockImplementation(() => undefined);
    const socketSpy = jest.spyOn(SocketEmitter, "emitSocketToUser").mockImplementation(() => undefined);
    const auditSpy = jest.spyOn(AuditLogService, "record").mockResolvedValueOnce();

    const result = await ProjectMessageService.send(
      { userId: "client-1", role: "CLIENT" },
      {
        projectId: "project-1",
        receiverId: "dev-1",
        content: "请补充里程碑细节"
      }
    );

    expect(result.id).toBe("msg-1");
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(busSpy).toHaveBeenCalledTimes(1);
    expect(socketSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });
});
