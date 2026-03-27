import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { CapabilityService } from "@/lib/services/developer/CapabilityService";

/**
 * @permission authenticated
 * @role developer
 * @resource capability
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const capability = await CapabilityService.getMine(actor);
    return ok(capability, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
