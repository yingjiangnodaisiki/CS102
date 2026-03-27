import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/profile", "/projects", "/bids", "/wallet", "/messages", "/workspace"];
const authPages = ["/login", "/register"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
