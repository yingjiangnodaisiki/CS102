import type { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function createRequest(pathname: string, token?: string): NextRequest {
  return {
    url: `https://example.com${pathname}`,
    nextUrl: new URL(`https://example.com${pathname}`),
    cookies: {
      get: (name: string) => {
        if (name !== "access_token" || !token) {
          return undefined;
        }
        return { name: "access_token", value: token };
      }
    }
  } as unknown as NextRequest;
}

describe("middleware auth guard", () => {
  it("should redirect to login when no token on protected path", () => {
    const response = proxy(createRequest("/wallet"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login?next=%2Fwallet");
  });

  it("should allow protected path when token exists", () => {
    const response = proxy(createRequest("/wallet", "token-value"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("should redirect login to dashboard when token exists", () => {
    const response = proxy(createRequest("/login", "token-value"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/dashboard");
  });

  it("should redirect root to login", () => {
    const response = proxy(createRequest("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login");
  });
});
