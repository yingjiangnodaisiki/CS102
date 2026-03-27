import { NextResponse } from "next/server";
import { AuthService } from "@/lib/services/auth/AuthService";
import { AppError } from "@/lib/errors/AppError";

const PASSWORD_RESET_TOKEN_COOKIE = "password_reset_verification_token";

interface PasswordResetRouteProps {
  params: Promise<{
    verificationToken: string;
  }>;
}

/**
 * @permission public
 * @role guest
 * @resource auth
 */
export async function GET(request: Request, context: PasswordResetRouteProps): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const rawToken = resolvedParams.verificationToken ?? "";
  const verificationToken = decodeURIComponent(rawToken).trim();
  const targetUrl = new URL("/reset-password", request.url);

  if (!verificationToken) {
    targetUrl.pathname = "/forgot-password";
    targetUrl.searchParams.set("error", "missing_token");
    return NextResponse.redirect(targetUrl);
  }

  try {
    await AuthService.validateForgotPasswordVerificationToken(verificationToken);
    targetUrl.searchParams.set("verificationToken", verificationToken);
    const response = NextResponse.redirect(targetUrl);
    response.cookies.set(PASSWORD_RESET_TOKEN_COOKIE, verificationToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60
    });
    return response;
  } catch (error: unknown) {
    const errorCode = error instanceof AppError ? error.code : "token_invalid";
    targetUrl.pathname = "/forgot-password";
    targetUrl.searchParams.set("error", errorCode.toLowerCase());
    const response = NextResponse.redirect(targetUrl);
    response.cookies.set(PASSWORD_RESET_TOKEN_COOKIE, "", {
      maxAge: 0,
      path: "/"
    });
    return response;
  }
}
