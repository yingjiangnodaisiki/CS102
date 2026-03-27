import { z } from "zod";
import { ProjectStatusValue } from "@/lib/constants/project";

const projectStatusValues = [
  "DRAFT",
  "PUBLISHED",
  "BIDDING",
  "CLOSED",
  "AWARDED",
  "CANCELLED"
] as const satisfies readonly ProjectStatusValue[];

export const createProjectSchema = z.object({
  title: z.string().min(4, "标题至少4个字符").max(120, "标题不能超过120个字符"),
  description: z.string().min(10, "描述至少10个字符").max(5000, "描述不能超过5000个字符"),
  budgetMin: z.number().positive("最小预算必须大于0"),
  budgetMax: z.number().positive("最大预算必须大于0"),
  biddingEndsAt: z.string().datetime(),
  tags: z.array(z.string().min(1).max(32)).max(10)
});

export const updateProjectSchema = z
  .object({
    title: z.string().min(4).max(120).optional(),
    description: z.string().min(10).max(5000).optional(),
    budgetMin: z.number().positive().optional(),
    budgetMax: z.number().positive().optional(),
    biddingEndsAt: z.string().datetime().optional(),
    tags: z.array(z.string().min(1).max(32)).max(10).optional(),
    status: z.enum(projectStatusValues).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "至少提供一个更新字段"
  });

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(projectStatusValues).optional()
});

export const listProjectPlazaSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(projectStatusValues).optional(),
  keyword: z.string().trim().max(80).optional()
});

export const initMilestoneTemplateSchema = z.object({
  milestones: z
    .array(
      z.object({
        title: z.string().min(2, "里程碑标题至少2个字符").max(120, "里程碑标题不能超过120个字符"),
        amount: z.number().positive("里程碑金额必须大于0"),
        dueAt: z.string().datetime()
      })
    )
    .min(1, "至少需要一个里程碑")
    .max(20, "里程碑数量不能超过20")
    .refine((items) => new Set(items.map((item) => item.title.trim())).size === items.length, {
      message: "里程碑标题不能重复"
    })
    .refine((items) => {
      for (let index = 1; index < items.length; index += 1) {
        if (new Date(items[index - 1].dueAt).getTime() > new Date(items[index].dueAt).getTime()) {
          return false;
        }
      }
      return true;
    }, "里程碑截止时间需按时间升序")
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;
export type ListProjectPlazaInput = z.infer<typeof listProjectPlazaSchema>;
export type InitMilestoneTemplateInput = z.infer<typeof initMilestoneTemplateSchema>;
