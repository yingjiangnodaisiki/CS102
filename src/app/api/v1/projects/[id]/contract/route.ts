import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { ContractService } from "@/lib/services/contract/ContractService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource contract
 */
export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const meta = await getRequestMeta();

    const contract = await ContractService.getProjectContract(actor, {
      projectId: id,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(contract, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
