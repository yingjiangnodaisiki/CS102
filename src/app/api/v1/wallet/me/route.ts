import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { WalletService } from "@/lib/services/wallet/WalletService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource wallet
 */
export async function GET() {
  try {
    const authUser = await getAuthUser();
    const wallet = await WalletService.getWalletOverviewByUserId(authUser.userId);
    return ok(wallet, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
