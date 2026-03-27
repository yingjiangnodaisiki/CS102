import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { ProfileService } from "@/lib/services/profile/ProfileService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource profile
 */
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await getAuthUser();
    const { id } = await context.params;
    const profile = await ProfileService.getPublicProfile(id);
    return ok(profile, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
