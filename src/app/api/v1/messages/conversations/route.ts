import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { ProjectMessageService } from "@/lib/services/message/ProjectMessageService";
import { fail, ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource message
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const conversations = await ProjectMessageService.listConversations(actor);
    return ok(conversations, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
