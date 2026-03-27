import { z } from "zod";

export const updateProfileSchema = z
  .object({
    avatarUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
        message: "头像地址必须是站内路径或 http/https 链接"
      })
      .optional(),
    bio: z.string().trim().max(500).optional(),
    companyName: z.string().trim().min(2).max(100).optional(),
    contactName: z.string().trim().min(2).max(50).optional(),
    displayName: z.string().trim().min(2).max(50).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "至少提供一个更新字段"
  });
