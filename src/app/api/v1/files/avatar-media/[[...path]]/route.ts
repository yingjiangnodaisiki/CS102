import { NextRequest, NextResponse } from "next/server";
import { getBlobReadWriteToken } from "@/lib/utils/avatar-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 私有 Blob Store 下头像无法使用公网直链，通过服务端带 Token 拉流并缓存给浏览器。
 * 仅允许 `avatars/` 前缀，防止遍历其它对象。
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const pathname = segments.map((s) => decodeURIComponent(s)).join("/");
  if (!pathname.startsWith("avatars/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return new NextResponse("Not Found", { status: 503 });
  }

  const { get } = await import("@vercel/blob");

  for (const access of ["public", "private"] as const) {
    try {
      const res = await get(pathname, { access, token });
      if (res && res.statusCode === 200 && res.stream) {
        const headers = new Headers();
        headers.set("Content-Type", res.blob.contentType);
        headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return new NextResponse(res.stream, { status: 200, headers });
      }
    } catch {
      /* 尝试下一种 access */
    }
  }

  return new NextResponse("Not Found", { status: 404 });
}
