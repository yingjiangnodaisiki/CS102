import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource notification
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const unreadCount = await NotificationRepository.unreadCount(actor.userId);
    return ok({ unreadCount }, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
