import { z } from "zod";

export const verifyCapabilitySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1, "题目ID不能为空"),
        optionId: z.string().trim().min(1, "选项ID不能为空")
      })
    )
    .min(1, "至少回答一道题")
    .max(20, "回答题目数量异常")
});

export type VerifyCapabilityInput = z.infer<typeof verifyCapabilitySchema>;
