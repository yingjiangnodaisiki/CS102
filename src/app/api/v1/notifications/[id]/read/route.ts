import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { NotificationService } from "@/lib/services/notification/NotificationService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource notification
 */
export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const result = await NotificationService.markAsRead(actor.userId, id);
    if (!result) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "通知不存在", 404);
    }
    return ok(result, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
