import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { ProjectService } from "@/lib/services/project/ProjectService";
import { createProjectSchema, listProjectsSchema } from "@/lib/validations/project";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource project
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const parsed = listProjectsSchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "20",
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });

    const result = await ProjectService.listProjects(actor, parsed);
    return ok(
      {
        items: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total
        }
      },
      200
    );
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
 * @role client
 * @resource project
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const data = createProjectSchema.parse(body);
    const meta = await getRequestMeta();
    const project = await ProjectService.createProject(actor, {
      ...data,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(project, 201);
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
