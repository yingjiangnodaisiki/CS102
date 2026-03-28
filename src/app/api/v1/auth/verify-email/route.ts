import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { verifyRegistrationEmailSchema } from "@/lib/validations/auth";
import { fail, ok } from "@/lib/utils/api-response";
import { AuthService } from "@/lib/services/auth/AuthService";

/**
 * @permission public
 * @role guest
 * @resource user
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const data = verifyRegistrationEmailSchema.parse(body);
    await AuthService.verifyRegistrationEmail({ token: data.token });
    return ok({ verified: true }, 200);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    console.error("verify-email route unhandled error:", error);
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
