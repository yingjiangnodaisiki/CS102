import { cookies } from "next/headers";
import { AppError } from "@/lib/errors/AppError";
import { verifyAccessToken, AccessTokenPayload } from "@/lib/utils/jwt";

export async function getAuthUser(): Promise<AccessTokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    throw new AppError("UNAUTHORIZED", "未登录", 401);
  }
  return verifyAccessToken(token);
}
