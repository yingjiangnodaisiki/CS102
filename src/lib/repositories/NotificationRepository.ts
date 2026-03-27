import { Notification, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class NotificationRepository {
  static async create(data: {
    userId: string;
    title: string;
    content: string;
    type: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Notification> {
    return prisma.notification.create({
      data
    });
  }

  static async listByUser(userId: string, page: number, pageSize: number): Promise<{ items: Notification[]; total: number }> {
    const where = { userId, deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.notification.count({ where })
    ]);
    return { items, total };
  }

  static async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        readAt: null,
        deletedAt: null
      }
    });
  }

  static async markAsRead(userId: string, notificationId: string): Promise<Notification | null> {
    const current = await prisma.notification.findFirst({
      where: { id: notificationId, userId, deletedAt: null }
    });
    if (!current) {
      return null;
    }
    if (current.readAt) {
      return current;
    }
    return prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() }
    });
  }

  static async markManyAsRead(
    userId: string,
    notificationIds: string[]
  ): Promise<{ updatedIds: string[]; updatedCount: number }> {
    if (notificationIds.length === 0) {
      return { updatedIds: [], updatedCount: 0 };
    }

    const existed = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId,
        readAt: null,
        deletedAt: null
      },
      select: { id: true }
    });
    const existedIds = existed.map((item) => item.id);
    if (existedIds.length === 0) {
      return { updatedIds: [], updatedCount: 0 };
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: existedIds },
        userId,
        readAt: null,
        deletedAt: null
      },
      data: { readAt: new Date() }
    });

    return { updatedIds: existedIds, updatedCount: result.count };
  }
}
