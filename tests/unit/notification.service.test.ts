import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { NotificationService } from "@/lib/services/notification/NotificationService";
import { RealtimeEventBus } from "@/lib/realtime/RealtimeEventBus";
import * as SocketEmitter from "@/lib/realtime/SocketEmitter";

describe("notification service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create notification and emit realtime event", async () => {
    const createSpy = jest.spyOn(NotificationRepository, "create").mockResolvedValueOnce({
      id: "noti-1",
      userId: "user-1",
      title: "title",
      content: "content",
      type: "DISPUTE_CREATED",
      metadata: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    const emitSpy = jest.spyOn(RealtimeEventBus, "emitToUser").mockImplementation(() => undefined);

    await NotificationService.notifyUser({
      userId: "user-1",
      title: "title",
      content: "content",
      type: "DISPUTE_CREATED"
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it("should mark one notification read and emit read event", async () => {
    jest.spyOn(NotificationRepository, "markAsRead").mockResolvedValueOnce({
      id: "noti-1",
      userId: "user-1",
      title: "title",
      content: "content",
      type: "DISPUTE_CREATED",
      metadata: null,
      readAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });
    jest.spyOn(NotificationRepository, "unreadCount").mockResolvedValueOnce(3);
    const busSpy = jest.spyOn(RealtimeEventBus, "emitToUser").mockImplementation(() => undefined);
    const socketSpy = jest.spyOn(SocketEmitter, "emitSocketToUser").mockImplementation(() => undefined);

    const result = await NotificationService.markAsRead("user-1", "noti-1");

    expect(result?.unreadCount).toBe(3);
    expect(busSpy).toHaveBeenCalledTimes(1);
    expect(socketSpy).toHaveBeenCalledTimes(1);
  });

  it("should mark many notifications read and emit read event", async () => {
    jest.spyOn(NotificationRepository, "markManyAsRead").mockResolvedValueOnce({
      updatedIds: ["noti-1", "noti-2"],
      updatedCount: 2
    });
    jest.spyOn(NotificationRepository, "unreadCount").mockResolvedValueOnce(1);
    const busSpy = jest.spyOn(RealtimeEventBus, "emitToUser").mockImplementation(() => undefined);
    const socketSpy = jest.spyOn(SocketEmitter, "emitSocketToUser").mockImplementation(() => undefined);

    const result = await NotificationService.markManyAsRead("user-1", ["noti-1", "noti-2"]);

    expect(result.updatedCount).toBe(2);
    expect(result.unreadCount).toBe(1);
    expect(busSpy).toHaveBeenCalledTimes(1);
    expect(socketSpy).toHaveBeenCalledTimes(1);
  });
});
