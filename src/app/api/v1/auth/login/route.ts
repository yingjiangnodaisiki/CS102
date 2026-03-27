import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { loginSchema } from "@/lib/validations/auth";
import { fail, ok } from "@/lib/utils/api-response";
import { AuthService } from "@/lib/services/auth/AuthService";
import { getRequestMeta } from "@/lib/utils/request-meta";

/**
 * @permission public
 * @role guest
 * @resource user
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const data = loginSchema.parse(body);
    const meta = await getRequestMeta();

    const result = await AuthService.login({
      email: data.email,
      password: data.password,
      requestIp: meta.ip,
      requestDevice: meta.device
    });

    const response = ok(result, 200);
    response.cookies.set("access_token", result.accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60
    });

    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
    ) {
      return fail("DB_UNAVAILABLE", "数据库连接不可用，请先启动 PostgreSQL 服务", 503);
    }
    console.error("login route unhandled error:", error);
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
