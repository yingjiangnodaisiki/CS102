import { cookies } from "next/headers";
import { AppError } from "@/lib/errors/AppError";
import { verifyAccessToken, AccessTokenPayload } from "@/lib/utils/jwt";

const roles = new Set<AccessTokenPayload["role"]>(["CLIENT", "DEVELOPER", "ADMIN"]);

export async function getAuthUser(): Promise<AccessTokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    throw new AppError("UNAUTHORIZED", "未登录", 401);
  }
  try {
    const payload = verifyAccessToken(token);
    if (typeof payload.userId !== "string" || !roles.has(payload.role)) {
      throw new AppError("UNAUTHORIZED", "登录已失效，请重新登录", 401);
    }
    return payload;
  } catch (e: unknown) {
    if (e instanceof AppError) {
      throw e;
    }
    throw new AppError("UNAUTHORIZED", "登录已失效，请重新登录", 401);
  }
}
