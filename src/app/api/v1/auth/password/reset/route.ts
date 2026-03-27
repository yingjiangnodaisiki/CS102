import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { AuthService } from "@/lib/services/auth/AuthService";

const PASSWORD_RESET_TOKEN_COOKIE = "password_reset_verification_token";

/**
 * @permission public
 * @role guest
 * @resource auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<{ verificationToken: string; newPassword: string }>;
    const payload = resetPasswordSchema.parse({
      verificationToken: body.verificationToken ?? request.cookies.get(PASSWORD_RESET_TOKEN_COOKIE)?.value ?? "",
      newPassword: body.newPassword ?? ""
    });
    const meta = await getRequestMeta();
    await AuthService.resetPasswordWithVerification({
      verificationToken: payload.verificationToken,
      newPassword: payload.newPassword,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    const response = ok({ updated: true }, 200);
    response.cookies.set(PASSWORD_RESET_TOKEN_COOKIE, "", {
      maxAge: 0,
      path: "/"
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
