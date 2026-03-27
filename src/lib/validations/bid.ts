import { z } from "zod";

const bidAttachmentSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  mimeType: z.string().min(3).max(100)
});

export const createBidSchema = z.object({
  amount: z.number().positive("投标金额必须大于0"),
  proposal: z.string().min(20, "方案说明至少20个字符").max(5000, "方案说明不能超过5000个字符"),
  expectedDays: z.number().int().min(1, "预计工期最少1天").max(365, "预计工期不能超过365天"),
  attachments: z.array(bidAttachmentSchema).max(5).optional()
});

export const updateBidSchema = z
  .object({
    amount: z.number().positive().optional(),
    proposal: z.string().min(20).max(5000).optional(),
    expectedDays: z.number().int().min(1).max(365).optional(),
    attachments: z.array(bidAttachmentSchema).max(5).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "至少提供一个更新字段"
  });

export type CreateBidInput = z.infer<typeof createBidSchema>;
export type UpdateBidInput = z.infer<typeof updateBidSchema>;
