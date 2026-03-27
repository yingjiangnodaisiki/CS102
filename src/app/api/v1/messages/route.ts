import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { ProjectMessageService } from "@/lib/services/message/ProjectMessageService";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { sendFlexibleMessageSchema } from "@/lib/validations/message";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource message
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = sendFlexibleMessageSchema.parse(body);
    const meta = await getRequestMeta();
    const message = await ProjectMessageService.send(actor, {
      projectId: payload.projectId,
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
