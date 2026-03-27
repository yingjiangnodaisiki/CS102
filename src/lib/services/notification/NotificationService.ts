import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { RealtimeEventBus } from "@/lib/realtime/RealtimeEventBus";
import { Prisma } from "@prisma/client";
import { emitSocketToUser } from "@/lib/realtime/SocketEmitter";

export class NotificationService {
  static async notifyUser(data: {
    userId: string;
    title: string;
    content: string;
    type: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const notification = await NotificationRepository.create(data);
    RealtimeEventBus.emitToUser({
      userId: data.userId,
      event: "notification.created",
      payload: {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        createdAt: notification.createdAt.toISOString()
      }
    });
    emitSocketToUser(data.userId, "notification.created", {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      createdAt: notification.createdAt.toISOString()
    });
    return notification;
  }

  static async markAsRead(userId: string, notificationId: string) {
    const notification = await NotificationRepository.markAsRead(userId, notificationId);
    if (!notification) {
      return null;
    }
    const unreadCount = await NotificationRepository.unreadCount(userId);
    const payload = {
      notificationId: notification.id,
      unreadCount
    };
    RealtimeEventBus.emitToUser({
      userId,
      event: "notification.read",
      payload
    });
    emitSocketToUser(userId, "notification.read", payload);
    return { notification, unreadCount };
  }

  static async markManyAsRead(userId: string, notificationIds: string[]) {
    const result = await NotificationRepository.markManyAsRead(userId, notificationIds);
    const unreadCount = await NotificationRepository.unreadCount(userId);
    const payload = {
      notificationIds: result.updatedIds,
      updatedCount: result.updatedCount,
      unreadCount
    };
    RealtimeEventBus.emitToUser({
      userId,
      event: "notification.read",
      payload
    });
    emitSocketToUser(userId, "notification.read", payload);
    return payload;
  }
}
