import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { AuthService } from "@/lib/services/auth/AuthService";

/**
 * @permission public
 * @role guest
 * @resource auth
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const payload = forgotPasswordSchema.parse(body);
    const meta = await getRequestMeta();
    const result = await AuthService.requestForgotPasswordVerification({
      email: payload.email,
      requestIp: meta.ip,
      requestDevice: meta.device,
      appBaseUrl: request.nextUrl.origin
    });
    return ok(result, 200);
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
