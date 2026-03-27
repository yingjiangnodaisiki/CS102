import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { ProfileService } from "@/lib/services/profile/ProfileService";
import { updateProfileSchema } from "@/lib/validations/profile";
import { getRequestMeta } from "@/lib/utils/request-meta";

/**
 * @permission authenticated
 * @role client|developer
 * @resource profile
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const profile = await ProfileService.getMine(actor);
    return ok(profile, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}

/**
 * @permission authenticated
 * @role client|developer
 * @resource profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const input = updateProfileSchema.parse(body);
    const meta = await getRequestMeta();
    const profile = await ProfileService.updateMine(actor, {
      ...input,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(profile, 200);
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
