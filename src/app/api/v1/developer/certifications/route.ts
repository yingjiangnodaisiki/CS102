import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { CertificationService } from "@/lib/services/developer/CertificationService";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { createCertificationSchema } from "@/lib/validations/certification";

/**
 * @permission authenticated
 * @role developer
 * @resource certification
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const data = await CertificationService.listMine(actor);
    return ok(data, 200);
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
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = createCertificationSchema.parse(body);
    const meta = await getRequestMeta();
    const result = await CertificationService.create(actor, {
      ...payload,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(result, 201);
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
