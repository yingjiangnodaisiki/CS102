import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { WorkspaceService } from "@/lib/services/workspace/WorkspaceService";
import { fail, ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource workspace
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const todos = await WorkspaceService.listTodoProjects(actor);
    return ok(todos, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
