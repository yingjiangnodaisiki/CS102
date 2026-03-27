import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { AuthService } from "@/lib/services/auth/AuthService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource auth
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const meta = await getRequestMeta();
    const result = await AuthService.requestChangePasswordVerification(actor, {
      requestIp: meta.ip,
      requestDevice: meta.device,
      appBaseUrl: request.nextUrl.origin
    });
    return ok(result, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
