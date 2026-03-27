import { Prisma, Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ListProjectQuery {
  page: number;
  pageSize: number;
  status?: string;
  actorUserId: string;
  actorRole: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface ListProjectPlazaQuery {
  page: number;
  pageSize: number;
  status?: string;
  keyword?: string;
  actorUserId: string;
  actorRole: "CLIENT" | "DEVELOPER" | "ADMIN";
}

export class ProjectRepository {
  static async create(
    data: {
      title: string;
      description: string;
      budgetMin: string;
      budgetMax: string;
      biddingEndsAt: Date;
      tags: string[];
      clientId: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Project> {
    const db = tx ?? prisma;
    return db.project.create({
      data: {
        title: data.title,
        description: data.description,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        biddingEndsAt: data.biddingEndsAt,
        tags: data.tags,
        clientId: data.clientId
      }
    });
  }

  static async findById(id: string): Promise<Project | null> {
    return prisma.project.findFirst({
      where: {
        id,
        deletedAt: null
      }
    });
  }

  static async list(query: ListProjectQuery): Promise<{ items: Project[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as Project["status"] } : {}),
      ...(query.actorRole === "ADMIN"
        ? {}
        : query.actorRole === "CLIENT"
          ? {
              clientId: query.actorUserId
            }
          : {
              bids: {
                some: {
                  developerId: query.actorUserId,
                  deletedAt: null
                }
              }
            })
    };
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.project.count({ where })
    ]);

    return { items, total };
  }

  static async listPlaza(query: ListProjectPlazaQuery): Promise<{
    items: Array<
      Project & {
        bids: Array<{ id: string; status: string }>;
        _count: { bids: number };
      }
    >;
    total: number;
  }> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as Project["status"] } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword, mode: "insensitive" } },
              { description: { contains: query.keyword, mode: "insensitive" } },
              { tags: { has: query.keyword } }
            ]
          }
        : {}),
      ...(query.actorRole === "ADMIN"
        ? {}
        : {
            OR: [{ status: { not: "DRAFT" } }, { clientId: query.actorUserId }]
          })
    };

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          bids: {
            where: {
              deletedAt: null,
              developerId: query.actorUserId
            },
            select: {
              id: true,
              status: true
            },
            take: 1
          },
          _count: {
            select: {
              bids: {
                where: {
                  deletedAt: null,
                  status: {
                    not: "WITHDRAWN"
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.project.count({ where })
    ]);

    return { items, total };
  }

  static async updateById(
    id: string,
    data: {
      title?: string;
      description?: string;
      budgetMin?: string;
      budgetMax?: string;
      biddingEndsAt?: Date;
      tags?: string[];
      status?: Project["status"];
    },
    tx?: Prisma.TransactionClient
  ): Promise<Project> {
    const db = tx ?? prisma;
    return db.project.update({
      where: { id },
      data
    });
  }

  static async softDeleteById(id: string): Promise<void> {
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
