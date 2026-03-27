import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { CapabilityService } from "@/lib/services/developer/CapabilityService";
import { verifyCapabilitySchema } from "@/lib/validations/developer-capability";

/**
 * @permission authenticated
 * @role developer
 * @resource capability
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = verifyCapabilitySchema.parse(body);
    const meta = await getRequestMeta();
    const result = await CapabilityService.verifyMine(actor, {
      answers: payload.answers,
      requestIp: meta.ip,
      requestDevice: meta.device
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
