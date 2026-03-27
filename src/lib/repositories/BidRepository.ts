import { Bid, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface CreateBidData {
  projectId: string;
  developerId: string;
  amount: string;
  proposal: string;
  expectedDays: number;
  submittedIp?: string | null;
  submittedDevice?: string | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }>;
}

export class BidRepository {
  static async findById(id: string): Promise<Bid | null> {
    return prisma.bid.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async findByIdWithProject(id: string): Promise<(Bid & { project: { id: string; clientId: string; status: string } }) | null> {
    return prisma.bid.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            status: true
          }
        }
      }
    });
  }

  static async findAcceptedByProject(projectId: string): Promise<Bid | null> {
    return prisma.bid.findFirst({
      where: {
        projectId,
        status: "ACCEPTED",
        deletedAt: null
      }
    });
  }

  static async findProjectBidByDeveloper(projectId: string, developerId: string): Promise<Bid | null> {
    return prisma.bid.findFirst({
      where: { projectId, developerId, deletedAt: null }
    });
  }

  static async findRiskConflict(projectId: string, developerId: string, ip?: string | null, device?: string | null): Promise<Bid | null> {
    if (!ip && !device) {
      return null;
    }

    return prisma.bid.findFirst({
      where: {
        projectId,
        developerId: { not: developerId },
        deletedAt: null,
        OR: [
          ...(ip ? [{ submittedIp: ip }] : []),
          ...(device ? [{ submittedDevice: device }] : [])
        ]
      }
    });
  }

  static async create(data: CreateBidData, tx?: Prisma.TransactionClient): Promise<Bid> {
    const db = tx ?? prisma;
    return db.bid.create({
      data: {
        projectId: data.projectId,
        developerId: data.developerId,
        amount: data.amount,
        proposal: data.proposal,
        expectedDays: data.expectedDays,
        submittedIp: data.submittedIp ?? null,
        submittedDevice: data.submittedDevice ?? null,
        attachments: data.attachments
          ? {
              create: data.attachments
            }
          : undefined
      }
    });
  }

  static async listByProject(projectId: string): Promise<Bid[]> {
    return prisma.bid.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  static async listForActor(userId: string, role: "CLIENT" | "DEVELOPER" | "ADMIN") {
    return prisma.bid.findMany({
      where: {
        deletedAt: null,
        ...(role === "DEVELOPER" ? { developerId: userId } : {}),
        ...(role === "CLIENT"
          ? {
              project: {
                clientId: userId
              }
            }
          : {})
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true
          }
        },
        developer: {
          select: {
            id: true,
            developerProfile: {
              select: {
                displayName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  static async updateById(
    id: string,
    data: {
      amount?: string;
      proposal?: string;
      expectedDays?: number;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileSize: number;
        mimeType: string;
      }>;
      status?: "PENDING" | "WITHDRAWN" | "ACCEPTED" | "REJECTED";
    }
  ): Promise<Bid> {
    return prisma.$transaction(async (tx) => {
      if (data.attachments) {
        await tx.bidAttachment.updateMany({
          where: { bidId: id, deletedAt: null },
          data: { deletedAt: new Date() }
        });
      }

      return tx.bid.update({
        where: { id },
        data: {
          amount: data.amount,
          proposal: data.proposal,
          expectedDays: data.expectedDays,
          status: data.status,
          attachments: data.attachments
            ? {
                create: data.attachments
              }
            : undefined
        }
      });
    });
  }

  static async updateStatus(
    id: string,
    status: "PENDING" | "WITHDRAWN" | "ACCEPTED" | "REJECTED",
    tx?: Prisma.TransactionClient
  ): Promise<Bid> {
    const db = tx ?? prisma;
    return db.bid.update({
      where: { id },
      data: { status }
    });
  }

  static async rejectOtherPendingBids(projectId: string, acceptedBidId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? prisma;
    const result = await db.bid.updateMany({
      where: {
        projectId,
        status: "PENDING",
        deletedAt: null,
        id: { not: acceptedBidId }
      },
      data: { status: "REJECTED" }
    });
    return result.count;
  }
}
