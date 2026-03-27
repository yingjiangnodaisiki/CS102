import { Message } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class MessageRepository {
  static async create(data: {
    projectId: string;
    senderId: string;
    receiverId: string;
    content: string;
    messageType?: string;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        projectId: data.projectId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        messageType: data.messageType ?? "TEXT"
      }
    });
  }

  static async listByProject(
    projectId: string,
    userId: string | null,
    page: number,
    pageSize: number
  ): Promise<{ items: Message[]; total: number }> {
    const where = {
      projectId,
      deletedAt: null,
      ...(userId
        ? {
            OR: [{ senderId: userId }, { receiverId: userId }]
          }
        : {})
    };
    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.message.count({ where })
    ]);
    return { items, total };
  }

  static async listConversationsByUser(userId: string): Promise<
    Array<{
      projectId: string;
      projectTitle: string;
      counterpartUserId: string;
      lastMessage: string;
      lastMessageAt: Date;
    }>
  > {
    const recentMessages = await prisma.message.findMany({
      where: {
        deletedAt: null,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        projectId: true,
        senderId: true,
        receiverId: true,
        content: true,
        createdAt: true
      }
    });

    const projectIds = Array.from(new Set(recentMessages.map((item) => item.projectId)));
    const projectRows = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        deletedAt: null
      },
      select: {
        id: true,
        title: true
      }
    });
    const projectTitleMap = new Map(projectRows.map((item) => [item.id, item.title]));

    const conversations = new Map<
      string,
      {
        projectId: string;
        projectTitle: string;
        counterpartUserId: string;
        lastMessage: string;
        lastMessageAt: Date;
      }
    >();

    for (const item of recentMessages) {
      const counterpartUserId = item.senderId === userId ? item.receiverId : item.senderId;
      const key = `${item.projectId}:${counterpartUserId}`;
      if (conversations.has(key)) {
        continue;
      }
      conversations.set(key, {
        projectId: item.projectId,
        projectTitle: projectTitleMap.get(item.projectId) ?? "未知项目",
        counterpartUserId,
        lastMessage: item.content,
        lastMessageAt: item.createdAt
      });
    }

    return Array.from(conversations.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }

  static async findLatestConversationProjectId(userId: string, counterpartUserId: string): Promise<string | null> {
    const latest = await prisma.message.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { senderId: userId, receiverId: counterpartUserId },
          { senderId: counterpartUserId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        projectId: true
      }
    });
    return latest?.projectId ?? null;
  }
}
