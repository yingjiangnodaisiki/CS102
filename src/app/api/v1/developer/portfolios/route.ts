import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { PortfolioService } from "@/lib/services/developer/PortfolioService";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { createPortfolioSchema } from "@/lib/validations/portfolio";

/**
 * @permission authenticated
 * @role developer
 * @resource portfolio
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const data = await PortfolioService.listMine(actor);
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
 * @resource portfolio
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = createPortfolioSchema.parse(body);
    const meta = await getRequestMeta();
    const result = await PortfolioService.create(actor, {
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
