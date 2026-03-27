import { ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource payment
 */
export async function GET() {
  await getAuthUser();
  return ok(
    [
      { code: "ALIPAY", name: "支付宝", status: "AVAILABLE" },
      { code: "WECHAT", name: "微信支付", status: "AVAILABLE" }
    ],
    200
  );
}
