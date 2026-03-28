import { NextRequest } from "next/server";

/** 邮件内链接、回调等使用的站点根地址（优先 NEXT_PUBLIC_APP_URL，否则从请求头推断）。 */
export function buildAppBaseUrlFromRequest(request: NextRequest): string | undefined {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) {
    return env;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return undefined;
  }
  const proto =
    request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
