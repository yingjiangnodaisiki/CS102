import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { resolveReviewCaseSchema } from "@/lib/validations/admin-risk";
import { AdminReviewService } from "@/lib/services/admin/AdminReviewService";

/**
 * @permission authenticated
 * @role admin
 * @resource review
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const payload = resolveReviewCaseSchema.parse(body);
    const result = await AdminReviewService.resolveReviewCase(actor, id, payload);
    return ok(result, 200);
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
