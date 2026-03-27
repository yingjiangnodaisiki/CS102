import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { ProjectMessageService } from "@/lib/services/message/ProjectMessageService";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { listProjectMessageSchema, sendProjectMessageSchema } from "@/lib/validations/message";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource message
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const query = listProjectMessageSchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "20"
    });
    const result = await ProjectMessageService.listMine(actor, id, query.page, query.pageSize);
    return ok(
      {
        items: result.items,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
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
 * @role client|developer|admin
 * @resource message
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const payload = sendProjectMessageSchema.parse(body);
    const meta = await getRequestMeta();
    const message = await ProjectMessageService.send(actor, {
      projectId: id,
      receiverId: payload.receiverId,
      content: payload.content,
      messageType: payload.messageType,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(message, 201);
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
