/**
 * CORS 允许的来源列表（与 middleware 共用，需在 Edge 可运行，勿引入 Node 专用模块）。
 */

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

/** 从环境变量解析允许跨域访问 API 的 Origin（完整 scheme://host[:port]）。 */
export function getAllowedCorsOrigins(): string[] {
  const fromList =
    process.env.ALLOWED_ORIGINS?.split(",")
      .map((s) => normalizeOrigin(s))
      .filter(Boolean) ?? [];
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const out = new Set<string>(fromList);
  if (base) {
    out.add(normalizeOrigin(base));
  }
  if (process.env.NODE_ENV === "development") {
    out.add("http://localhost:3000");
    out.add("http://127.0.0.1:3000");
  }
  return [...out];
}

export function isCorsOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  const normalized = normalizeOrigin(origin);
  const allowed = getAllowedCorsOrigins();
  if (allowed.length === 0) {
    // 生产未配置任何来源时，不反射 Origin（浏览器跨域调用将被拒绝）
    return process.env.NODE_ENV !== "production";
  }
  return allowed.includes(normalized);
}
