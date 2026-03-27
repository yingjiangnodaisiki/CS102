import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { ProjectService } from "@/lib/services/project/ProjectService";
import { updateProjectSchema } from "@/lib/validations/project";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource project
 */
export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const project = await ProjectService.getProjectById(actor, id);
    return ok(project, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}

/**
 * @permission authenticated
 * @role client|admin
 * @resource project
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const data = updateProjectSchema.parse(body);
    const meta = await getRequestMeta();

    const updated = await ProjectService.updateProject(actor, {
      projectId: id,
      ...data,
      requestIp: meta.ip,
      requestDevice: meta.device
    });

    return ok(updated, 200);
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

/**
 * @permission authenticated
 * @role client|admin
 * @resource project
 */
export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const meta = await getRequestMeta();
    await ProjectService.deleteProject(actor, id, {
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok({ deleted: true }, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
