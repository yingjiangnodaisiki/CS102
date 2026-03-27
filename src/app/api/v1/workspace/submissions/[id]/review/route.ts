import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { WorkspaceService } from "@/lib/services/workspace/WorkspaceService";
import { reviewWorkspaceSubmissionSchema } from "@/lib/validations/workspace";

/**
 * @permission authenticated
 * @role client|admin
 * @resource workspace
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const payload = reviewWorkspaceSubmissionSchema.parse(body);
    const meta = await getRequestMeta();
    const reviewed = await WorkspaceService.reviewSubmission(actor, id, {
      action: payload.action,
      reviewNote: payload.reviewNote,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(reviewed, 200);
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
