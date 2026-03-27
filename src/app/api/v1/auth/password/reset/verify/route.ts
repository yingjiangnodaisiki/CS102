import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { AuthService } from "@/lib/services/auth/AuthService";

const PASSWORD_RESET_TOKEN_COOKIE = "password_reset_verification_token";

/**
 * @permission public
 * @role guest
 * @resource auth
 */
export async function GET(request: NextRequest) {
  try {
    const verificationToken =
      request.nextUrl.searchParams.get("verificationToken") ??
      request.cookies.get(PASSWORD_RESET_TOKEN_COOKIE)?.value;
    if (!verificationToken) {
      return fail("VALIDATION_ERROR", "缺少验证令牌", 422);
    }
    const result = await AuthService.validateForgotPasswordVerificationToken(verificationToken);
    return ok(result, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
