import { Portfolio } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class PortfolioRepository {
  static async create(data: {
    developerProfileId: string;
    title: string;
    description: string;
    projectUrl?: string;
    repositoryUrl?: string;
    tags: string[];
  }): Promise<Portfolio> {
    return prisma.portfolio.create({
      data: {
        developerProfileId: data.developerProfileId,
        title: data.title,
        description: data.description,
        projectUrl: data.projectUrl ?? null,
        repositoryUrl: data.repositoryUrl ?? null,
        tags: data.tags
      }
    });
  }

  static async findById(id: string): Promise<Portfolio | null> {
    return prisma.portfolio.findFirst({
      where: { id, deletedAt: null }
    });
  }

  static async listByDeveloperProfile(developerProfileId: string): Promise<Portfolio[]> {
    return prisma.portfolio.findMany({
      where: { developerProfileId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  static async updateById(
    id: string,
    data: {
      title?: string;
      description?: string;
      projectUrl?: string;
      repositoryUrl?: string;
      tags?: string[];
    }
  ): Promise<Portfolio> {
    return prisma.portfolio.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        projectUrl: data.projectUrl,
        repositoryUrl: data.repositoryUrl,
        tags: data.tags
      }
    });
  }

  static async softDeleteById(id: string): Promise<void> {
    await prisma.portfolio.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
