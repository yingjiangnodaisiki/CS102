import { z } from "zod";

export const listWorkspaceSubmissionsSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional()
});

export const createWorkspaceSubmissionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().min(1).max(500),
  fileSize: z.number().int().positive().max(200 * 1024 * 1024),
  mimeType: z.string().trim().min(3).max(120)
});

export const reviewWorkspaceSubmissionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(1000).optional()
}).superRefine((input, ctx) => {
  if (input.action === "REJECT" && (!input.reviewNote || input.reviewNote.trim().length < 5)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "驳回时请填写至少5个字符的审核意见",
      path: ["reviewNote"]
    });
  }
});
