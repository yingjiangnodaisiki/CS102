import { Milestone, Prisma, Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MilestoneWithProject = Milestone & { project: Project };

export class MilestoneRepository {
  static async findByIdWithProject(id: string): Promise<MilestoneWithProject | null> {
    return prisma.milestone.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: true
      }
    });
  }

  static async markCompleted(id: string): Promise<void> {
    await prisma.milestone.update({
      where: { id },
      data: { isCompleted: true }
    });
  }

  static async listByProject(projectId: string, tx?: Prisma.TransactionClient): Promise<Milestone[]> {
    const db = tx ?? prisma;
    return db.milestone.findMany({
      where: {
        projectId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
  }

  static async createMany(
    projectId: string,
    items: Array<{ title: string; amount: string; dueAt: Date }>,
    tx?: Prisma.TransactionClient
  ): Promise<Milestone[]> {
    const db = tx ?? prisma;
    const created = await Promise.all(
      items.map((item) =>
        db.milestone.create({
          data: {
            projectId,
            title: item.title,
            amount: item.amount,
            dueAt: item.dueAt
          }
        })
      )
    );
    return created;
  }
}
