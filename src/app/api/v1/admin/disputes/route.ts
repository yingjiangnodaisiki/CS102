import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { DisputeRepository } from "@/lib/repositories/DisputeRepository";
import { listDisputeAdminSchema } from "@/lib/validations/dispute";

/**
 * @permission authenticated
 * @role admin
 * @resource dispute
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可查看仲裁列表", 403);
    }

    const query = listDisputeAdminSchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "20",
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      keyword: request.nextUrl.searchParams.get("keyword") ?? undefined
    });
    const result = await DisputeRepository.listForAdmin(query);
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
