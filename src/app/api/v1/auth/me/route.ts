import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource user
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    return ok(actor, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
