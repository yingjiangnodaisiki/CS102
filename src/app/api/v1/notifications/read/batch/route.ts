import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { batchReadNotificationSchema } from "@/lib/validations/notification";
import { NotificationService } from "@/lib/services/notification/NotificationService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource notification
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = batchReadNotificationSchema.parse(body);
    const result = await NotificationService.markManyAsRead(actor.userId, payload.notificationIds);
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
