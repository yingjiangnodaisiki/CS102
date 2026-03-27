import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { ProfileService } from "@/lib/services/profile/ProfileService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource user
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthUser();
    const keyword = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!keyword) {
      return ok([], 200);
    }
    const users = await ProfileService.searchUsers(keyword);
    return ok(users, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
