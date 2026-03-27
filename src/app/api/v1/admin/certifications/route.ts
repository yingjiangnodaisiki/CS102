import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { AdminCertificationService } from "@/lib/services/admin/AdminCertificationService";
import { listCertificationsForAdminSchema } from "@/lib/validations/admin-certification";

/**
 * @permission authenticated
 * @role admin
 * @resource certification
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const query = listCertificationsForAdminSchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "20",
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });
    const result = await AdminCertificationService.listCertifications(actor, query);
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
