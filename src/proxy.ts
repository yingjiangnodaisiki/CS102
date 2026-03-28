import { NextRequest, NextResponse } from "next/server";
import { isCorsOriginAllowed } from "@/lib/utils/cors-allowlist";

const protectedPrefixes = [
  "/dashboard",
  "/profile",
  "/projects",
  "/bids",
  "/wallet",
  "/messages",
  "/workspace"
];
const authPages = ["/login", "/register"];

const CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD";
const CORS_HEADERS = "Content-Type, Authorization";

function applyApiCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (!origin || !isCorsOriginAllowed(origin)) {
    return response;
  }
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
  return response;
}

function stripIdentifyingHeaders(response: NextResponse): void {
  response.headers.delete("x-powered-by");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      stripIdentifyingHeaders(preflight);
      return applyApiCors(request, preflight);
    }
    const res = NextResponse.next();
    stripIdentifyingHeaders(res);
    return applyApiCors(request, res);
  }

  const token = request.cookies.get("access_token")?.value;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isAuthPage = authPages.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/",
    "/login/:path*",
    "/register/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/projects/:path*",
    "/bids/:path*",
    "/wallet/:path*",
    "/messages/:path*",
    "/workspace/:path*"
  ]
};
