import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { listRiskEventsSchema } from "@/lib/validations/admin-risk";
import { AdminRiskService } from "@/lib/services/admin/AdminRiskService";

/**
 * @permission authenticated
 * @role admin
 * @resource risk-event
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const query = listRiskEventsSchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "20",
      level: request.nextUrl.searchParams.get("level") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined
    });
    const result = await AdminRiskService.listRiskEvents(actor, query);
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
