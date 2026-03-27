import { z } from "zod";

const roleValues = ["CLIENT", "DEVELOPER"] as const;
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("邮箱格式不正确")
  .max(254, "邮箱长度不能超过254字符")
  .refine((value) => !value.includes(".."), "邮箱格式不正确")
  .refine((value) => {
    const [localPart, domainPart] = value.split("@");
    if (!localPart || !domainPart) {
      return false;
    }
    if (localPart.length < 4 || localPart.length > 64 || domainPart.length > 190) {
      return false;
    }
    return domainPart.includes(".") && !domainPart.startsWith(".") && !domainPart.endsWith(".");
  }, "邮箱格式不正确")
  .refine((value) => {
    const [localPart, domainPart] = value.split("@");
    if (!localPart || !domainPart) {
      return false;
    }

    const isNumericLocal = /^\d+$/.test(localPart);
    if (!isNumericLocal) {
      return true;
    }

    if (domainPart === "qq.com") {
      return localPart.length >= 5 && localPart.length <= 11;
    }

    return localPart.length >= 5;
  }, "邮箱账号格式不符合规范");

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "密码至少8位").max(64, "密码不能超过64位"),
  role: z.enum(roleValues),
  profile: z.object({
    companyName: z.string().min(2).max(100).optional(),
    contactName: z.string().min(2).max(50).optional(),
    displayName: z.string().min(2).max(50).optional()
  })
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "密码至少8位")
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  verificationToken: z.string().trim().min(1, "邮箱验证令牌不能为空"),
  newPassword: z.string().min(8, "密码至少8位").max(64, "密码不能超过64位")
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "当前密码至少8位").max(64, "当前密码不能超过64位"),
    newPassword: z.string().min(8, "新密码至少8位").max(64, "新密码不能超过64位"),
    verificationToken: z.string().trim().min(1, "邮箱验证令牌不能为空")
  })
  .superRefine((value, ctx) => {
    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "新密码不能与当前密码相同"
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
