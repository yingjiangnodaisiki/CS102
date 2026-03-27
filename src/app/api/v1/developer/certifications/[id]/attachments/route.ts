import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { CertificationService } from "@/lib/services/developer/CertificationService";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { addCertificationAttachmentSchema } from "@/lib/validations/certification";

/**
 * @permission authenticated
 * @role developer
 * @resource certification
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const attachments = await CertificationService.listMyAttachments(actor, id);
    return ok(attachments, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}

/**
 * @permission authenticated
 * @role developer
 * @resource certification
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const payload = addCertificationAttachmentSchema.parse(body);
    const meta = await getRequestMeta();
    const attachment = await CertificationService.addAttachment(actor, {
      certificationId: id,
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(attachment, 201);
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
