import { z } from "zod";

export const createPortfolioSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(2000),
  projectUrl: z.string().trim().url().optional(),
  repositoryUrl: z.string().trim().url().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([])
});

export const updatePortfolioSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(20).max(2000).optional(),
    projectUrl: z.string().trim().url().optional(),
    repositoryUrl: z.string().trim().url().optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.projectUrl !== undefined ||
      value.repositoryUrl !== undefined ||
      value.tags !== undefined,
    {
      message: "至少提供一个可更新字段"
    }
  );
