import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class WorkspaceRepository {
  static async create(
    data: {
      projectId: string;
      submitterUserId: string;
      title: string;
      description?: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    return db.workspaceSubmission.create({
      data: {
        projectId: data.projectId,
        submitterUserId: data.submitterUserId,
        title: data.title,
        description: data.description,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType
      }
    });
  }

  static async findById(id: string) {
    return prisma.workspaceSubmission.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            title: true
          }
        }
      }
    });
  }

  static async listForActor(actor: { userId: string; role: "CLIENT" | "DEVELOPER" | "ADMIN" }, query: { projectId?: string; status?: "PENDING" | "APPROVED" | "REJECTED" }) {
    return prisma.workspaceSubmission.findMany({
      where: {
        deletedAt: null,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(actor.role === "ADMIN"
          ? {}
          : actor.role === "CLIENT"
            ? {
                project: {
                  clientId: actor.userId
                }
              }
            : {
                submitterUserId: actor.userId
              })
      },
      include: {
        project: {
          select: { id: true, title: true, clientId: true }
        },
        submitterUser: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async review(
    id: string,
    data: {
      status: "APPROVED" | "REJECTED";
      reviewerUserId: string;
      reviewNote?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    return db.workspaceSubmission.update({
      where: { id },
      data: {
        status: data.status,
        reviewerUserId: data.reviewerUserId,
        reviewNote: data.reviewNote,
        reviewedAt: new Date()
      }
    });
  }

  static async hasApprovedSubmission(projectId: string, submitterUserId: string): Promise<boolean> {
    const row = await prisma.workspaceSubmission.findFirst({
      where: {
        projectId,
        submitterUserId,
        status: "APPROVED",
        deletedAt: null
      },
      select: {
        id: true
      }
    });
    return Boolean(row);
  }

  static async listTodoProjects(actor: { userId: string; role: "CLIENT" | "DEVELOPER" | "ADMIN" }) {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: "AWARDED",
        ...(actor.role === "ADMIN"
          ? {}
          : actor.role === "CLIENT"
            ? { clientId: actor.userId }
            : {
                bids: {
                  some: {
                    developerId: actor.userId,
                    status: "ACCEPTED",
                    deletedAt: null
                  }
                }
              })
      },
      include: {
        bids: {
          where: {
            status: "ACCEPTED",
            deletedAt: null
          },
          select: {
            developerId: true
          },
          take: 1
        },
        workspaceSubmissions: {
          where: {
            deletedAt: null
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            submitterUserId: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return projects;
  }
}
