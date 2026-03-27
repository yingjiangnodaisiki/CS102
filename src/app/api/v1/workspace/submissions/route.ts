import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { WorkspaceService } from "@/lib/services/workspace/WorkspaceService";
import {
  createWorkspaceSubmissionSchema,
  listWorkspaceSubmissionsSchema
} from "@/lib/validations/workspace";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource workspace
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const query = listWorkspaceSubmissionsSchema.parse({
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });
    const submissions = await WorkspaceService.listSubmissions(actor, query);
    return ok(submissions, 200);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return fail("DB_SCHEMA_NOT_READY", "工作区数据表未初始化，请先执行数据库迁移", 503);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}

/**
 * @permission authenticated
 * @role developer
 * @resource workspace
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = createWorkspaceSubmissionSchema.parse(body);
    const meta = await getRequestMeta();
    const created = await WorkspaceService.createSubmission(actor, {
      ...payload,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(created, 201);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return fail("DB_SCHEMA_NOT_READY", "工作区数据表未初始化，请先执行数据库迁移", 503);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
